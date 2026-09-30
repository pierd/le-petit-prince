#!/usr/bin/env python3
"""Turn the parsed text files into the bilingual LaTeX book.

    python3 tools/makebook.py [--draft]

Reads:
    content/fr.txt     French paragraphs (written by fetch_source.py)
    content/es-part-*.txt
                       Spanish translation, keyed [ppchap1.3] -> one paragraph

Writes:
    le-petit-prince.tex

Paragraph N of French (left, even page) always faces paragraph N of Spanish
(right, odd page), because both sides are read from the same key.
Illustrations are printed on both facing pages, at the same height, where they
occur in the source; both texts resume below.

Without --draft the build stops if any paragraph has no Spanish yet, which is
what keeps a half-finished translation from silently shipping the French twice.
"""
import os
import re
import sys
from glob import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
         "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII",
         "XXIII", "XXIV", "XXV", "XXVI", "XXVII"]

TEXTPT_W = 327.0       # A5 text width (148mm - 18mm - 15mm), in pt
TEXTPT = 495.0         # A5 text height (210mm - 17mm - 19mm), in pt
MAXHFRAC = 0.5         # tallest a plate may be


def read(path):
    p = os.path.join(ROOT, path)
    if not os.path.exists(p):
        return []
    return open(p, encoding="utf-8").read().split("\n")


def parse_fr(lines):
    """-> [(key, french_title, [('p', key, text) | ('img', name, w, h)])]

    Paragraph text may run over several lines; it is accumulated into the last
    block until the next [key] or [img] marker.
    """
    secs, cur = [], None
    for line in lines:
        line = line.rstrip()
        if line.startswith("=== "):
            key, title = (x.strip() for x in line.split("===", 1)[1].split("|", 1))
            cur = [key, title, []]
            secs.append(cur)
        elif not line.strip() or cur is None:
            continue
        elif line.startswith("[img]"):
            _, name, dims = line.split()
            w, h = (int(x) for x in dims.split("x"))
            cur[2].append(("img", name, w, h))
        elif re.fullmatch(r"\[\w+\.\d+\]", line):
            cur[2].append(("p", line[1:-1], []))
        else:
            cur[2][-1][2].append(line)
    return [(k, t, [b if b[0] == "img" else (b[0], b[1], " ".join(b[2]))
                    for b in bl])
            for k, t, bl in secs]


def parse_es(lines):
    """-> ({key: text}, {section: spanish_title})"""
    paras, titles, i = {}, {}, 0
    while i < len(lines):
        line = lines[i].rstrip()
        if line.startswith("=== "):
            key, title = (x.strip() for x in line.split("===", 1)[1].split("|", 1))
            titles[key] = title
        elif re.fullmatch(r"\[\w+\.\d+\]", line):
            key, i, buf = line[1:-1], i + 1, []
            while i < len(lines) and lines[i].strip() and not lines[i].startswith(("=", "[")):
                buf.append(lines[i].strip())
                i += 1
            if key in paras:
                raise ValueError(f"duplicate Spanish paragraph key: {key}")
            paras[key] = " ".join(buf)
            continue
        i += 1
    return paras, titles


def title_for(key):
    if key == "ppded":
        return "DEDICACIA"
    n = int(key.replace("ppchap", ""))
    return "PRIMER CAPÍTULO" if n == 1 else f"CAPÍTULO {ROMAN[n - 1]}"


def guill(t, in_quote=False, with_state=False):
    """Straight quotes -> guillemets, carrying state across paragraphs."""
    out = []
    for char in t:
        if char == '"':
            out.append("\\fg{}" if in_quote else "\\og ")
            in_quote = not in_quote
        else:
            out.append(char)
    text = "".join(out).replace("...", "...\\allowbreak{}")
    return (text, in_quote) if with_state else text


def wrap(t, indent="    "):
    out, line = [], ""
    for w in t.split():
        if line and len(line) + 1 + len(w) > 62:
            out.append(line)
            line = w
        else:
            line = f"{line} {w}" if line else w
    out.append(line)
    return ("\n" + indent).join(out)


def plate_size(name, w, h):
    """Keep the source display size, capped to the full text block."""
    if not os.path.exists(os.path.join(ROOT, "images", name)):
        return None
    nat_w, nat_h = (w * 0.75, h * 0.75) if w > 1 and h > 1 else (200.0, 150.0)
    s = min(1.0, TEXTPT_W / nat_w, MAXHFRAC * TEXTPT / nat_h)
    return f"{nat_w * s:.1f}pt", f"{nat_h * s:.1f}pt"


def main():
    os.chdir(ROOT)
    secs = parse_fr(read("content/fr.txt"))
    es_lines = []
    for path in sorted(glob(os.path.join(ROOT, "content", "es-part-*.txt"))):
        es_lines.extend(open(path, encoding="utf-8").read().split("\n"))
    es, es_titles = parse_es(es_lines)

    keys = [b[1] for _, _, bs in secs for b in bs if b[0] == "p"]
    missing = [k for k in keys if k not in es]
    if missing:
        print(f"Spanish: {len(keys) - len(missing)}/{len(keys)} paragraphs translated")
        print(f"  still missing {len(missing)}, first few: {', '.join(missing[:8])}")
        if "--draft" not in sys.argv:
            print("  (pass --draft to build with French in place of Spanish)")
            sys.exit(1)

    body, npl = [], 0
    fr_quote = es_quote = False
    for key, fr_title, blocks in secs:
        if body:
            body.append(r"\newsection")   # every chapter starts a fresh spread
        body.append(f"%% ================== {key} ==================")
        body.append(r"\chapterpair{%s}{%s}" % (guill(fr_title),
                                               guill(es_titles.get(key) or title_for(key))))
        for b in blocks:
            if b[0] == "img":
                _, name, w, h = b
                dims = plate_size(name, w, h)
                if not dims:
                    print(f"  ! missing illustration images/{name}", file=sys.stderr)
                    continue
                npl += 1
                body.append(r"\plate{%s}{%s}{%s}" % (name, dims[0], dims[1]))
            else:
                _, k, txt = b
                fr_text, fr_quote = guill(txt, fr_quote, True)
                es_text, es_quote = guill(es.get(k, txt), es_quote, True)
                body.append("\\pair{\\selectlanguage{\\origlang}\n"
                            + wrap(fr_text)
                            + "\n}{\\selectlanguage{\\translang}\n"
                            + wrap(es_text) + "\n}")

    if fr_quote or es_quote:
        sys.exit("unclosed quotation mark in the bilingual text")

    tmpl = open(os.path.join(ROOT, "book-template.tex"), encoding="utf-8").read()
    open("le-petit-prince.tex", "w", encoding="utf-8").write(
        tmpl.replace("%%BODY%%", "\n".join(body) + "\n"))
    print(f"wrote le-petit-prince.tex: {len(secs)} sections, {len(keys)} paragraphs, "
          f"{npl} plates")


if __name__ == "__main__":
    main()
