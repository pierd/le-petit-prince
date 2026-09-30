#!/usr/bin/env python3
"""Fetch the French text of Le Petit Prince, strip the hosting site's
branding, and write a clean structured file plus the illustrations.

    python3 tools/fetch_source.py

Writes:
    content/fr.txt      chapters and paragraphs, with [img] markers
    images/*.{jpg,png}  the 47 illustrations

The hosted edition is ISO-8859-1 with HTML entities, has unclosed <p> tags,
and wraps the body in the site's own header/footer table. All of that is
stripped here so the rest of the pipeline only sees clean text.
"""
import html
import os
import re
import subprocess
import sys
import urllib.request

SOURCE = "https://gutenberg.net.au/ebooks03/0300771h.html"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def fetch(url, dest):
    print(f"  {url}")
    with urllib.request.urlopen(url, timeout=60) as r, open(dest, "wb") as f:
        f.write(r.read())


def strip_tags(s):
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = s.replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def main():
    os.chdir(ROOT)
    os.makedirs("content", exist_ok=True)
    os.makedirs("images", exist_ok=True)

    cache = "content/.source.html"
    if not os.path.exists(cache):
        print("Downloading source text...")
        fetch(SOURCE, cache)
    raw = open(cache, "rb").read().decode("iso-8859-1")

    # --- keep only the book body: first anchor .. "THE END" -----------------
    start = re.search(r'<a\s+name="pp(?:ded|chap1)"', raw)
    end = raw.find("THE END")
    if not start or not end:
        sys.exit("could not locate the body boundaries in the source")
    body = raw[start.start():end]

    # --- split into chapters -------------------------------------------------
    marks = list(re.finditer(r'<a\s+name="(pp\w+)"', body))
    chapters = []
    for i, m in enumerate(marks):
        stop = marks[i + 1].start() if i + 1 < len(marks) else len(body)
        chunk = body[m.end():stop]
        title = ""
        h2 = re.search(r"<h2>(.*?)</h2>", chunk, re.S | re.I)
        if h2:
            title = strip_tags(h2.group(1))
            chunk = chunk[:h2.start()] + chunk[h2.end():]

        # --- split the chapter into blocks -----------------------------------
        blocks, img_dir = [], {}
        for part in re.split(r"<p\b[^>]*>", chunk, flags=re.I)[1:]:
            tag = re.search(r"<img\b[^>]*>", part, re.I | re.S)
            src = re.search(r'src=\s*"?([^"\s>]+)', part)
            if tag and src and re.search(r"\.(jpg|jpeg|gif|png)$", src.group(1), re.I):
                w = re.search(r'width="?(\d+)', tag.group(0))
                h = re.search(r'height="?(\d+)', tag.group(0))
                blocks.append(("img", src.group(1),
                               (int(w.group(1)) if w else 0,
                                int(h.group(1)) if h else 0)))
                continue
            text = strip_tags(part)
            if text:
                blocks.append(("p", text))

        # front matter (dedication) has no <h2> title of its own
        key = m.group(1)
        chapters.append((key, title or key, blocks))

    # --- images --------------------------------------------------------------
    wanted = sorted({b[1] for _, _, bs in chapters for b in bs if b[0] == "img"})
    print(f"Downloading {len(wanted)} illustrations...")
    for src in wanted:
        dest = os.path.join("images", os.path.basename(src))
        if not os.path.exists(dest) or os.path.getsize(dest) == 0:
            fetch("https://gutenberg.net.au/ebooks03/" + src, dest)

    # pdflatex cannot include GIF, so the four GIF plates are converted to PNG
    # and the book references those instead.
    for f in sorted(os.listdir("images")):
        if not f.lower().endswith(".gif"):
            continue
        png = os.path.splitext(f)[0] + ".png"
        if not os.path.exists(os.path.join("images", png)):
            subprocess.run(["sips", "-s", "format", "png",
                            os.path.join("images", f),
                            "--out", os.path.join("images", png)],
                           check=True, stdout=subprocess.DEVNULL)
            os.remove(os.path.join("images", f))
            print(f"  converted {f} -> {png}")

    # --- emit ----------------------------------------------------------------
    out, np = [], 0
    for key, title, blocks in chapters:
        out.append(f"\n=== {key} | {title}")
        n = 0
        for b in blocks:
            if b[0] == "img":
                name = os.path.splitext(os.path.basename(b[1]))[0] + ".png" \
                    if b[1].lower().endswith(".gif") else os.path.basename(b[1])
                out.append(f"[img] {name} {b[2][0]}x{b[2][1]}")
            else:
                n += 1
                np += 1
                out.append(f"[{key}.{n}]")
                out.append(b[1])
    open("content/fr.txt", "w", encoding="utf-8").write("\n".join(out) + "\n")

    npar = np
    nimg = sum(1 for c in chapters for b in c[2] if b[0] == "img")
    print(f"\n{len(chapters)} sections, {npar} paragraphs, {nimg} illustrations")
    print(f"wrote content/fr.txt ({os.path.getsize('content/fr.txt')} bytes)")


if __name__ == "__main__":
    main()
