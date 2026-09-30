"""Minimal PDF text-position reader for pdflatex output (no poppler needed)."""
import re
import zlib

A4H = 841.89          # default page height if a page has no /MediaBox


def load(path):
    data = open(path, "rb").read()
    objs = {}
    for m in re.finditer(rb"(?<![0-9])(\d+)\s+0\s+obj\b", data):
        num, end = int(m.group(1)), data.find(b"endobj", m.end())
        body = data[m.end():end]
        sm = re.search(rb"stream\r?\n", body)
        if sm:
            s = sm.end()
            raw = body[s:body.find(b"endstream", s)]
            stream = None
            if b"FlateDecode" in body[:sm.start()]:
                try:
                    stream = zlib.decompress(raw)
                except zlib.error:
                    pass
            else:
                stream = raw
            objs[num] = (body[:sm.start()], stream)
        else:
            objs[num] = (body, None)
    for d, stream in list(objs.values()):
        if stream is None or b"/ObjStm" not in d:
            continue
        first = int(re.search(rb"/First\s+(\d+)", d).group(1))
        n = int(re.search(rb"/N\s+(\d+)", d).group(1))
        hd = stream[:first].split()
        pairs = [(int(hd[2 * i]), int(hd[2 * i + 1])) for i in range(n)]
        for i, (onum, off) in enumerate(pairs):
            end = first + pairs[i + 1][1] if i + 1 < len(pairs) else len(stream)
            objs.setdefault(onum, (stream[first + off:end], None))
    return objs


def page_order(objs):
    """Walk the whole page tree. pdfTeX splits /Kids into several nodes of ~6
    pages each, so reading only the first node would miss most of the book."""
    roots = [b for b, s in objs.values() if b"/Pages" in b and b"/Kids" in b
             and b"/Parent" not in b] or \
            [b for b, s in objs.values() if b"/Pages" in b and b"/Kids" in b]
    out = []

    def walk(body):
        kids = re.search(rb"/Kids\s*\[(.*?)\]", body, re.S)
        if not kids:
            return
        for num in re.findall(rb"(\d+)\s+0\s+R", kids.group(1)):
            n = int(num)
            nb = objs.get(n, (b"", None))[0]
            if b"/Page" in nb and b"/Kids" not in nb:
                out.append(n)
            else:
                walk(nb)

    for r in roots:
        walk(r)
    seen, uniq = set(), []
    for n in out:
        if n not in seen:
            seen.add(n)
            uniq.append(n)
    return uniq


def page_size(objs, pnum):
    """-> (width, height) of a page from its /MediaBox, in pt."""
    body = objs.get(pnum, (b"", None))[0]
    m = re.search(rb"/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)", body)
    if not m:
        return 595.28, A4H
    x0, y0, x1, y1 = (float(v) for v in m.groups())
    return x1 - x0, y1 - y0


def content_of(objs, pnum):
    body = objs.get(pnum, (b"", None))[0]
    m = re.search(rb"/Contents\s+(\d+)\s+0\s+R", body)
    return objs.get(int(m.group(1)), (b"", b""))[1] if m else b""


def _mul(m2, m1):
    a2, b2, c2, d2, e2, f2 = m2
    a, b, c, d, e, f = m1
    return (a2 * a + b2 * c, a2 * b + b2 * d, c2 * a + d2 * c,
            c2 * b + d2 * d, a2 * e + b2 * f + e2, c2 * e + d2 * f + f2)


def _unescape(b):
    """Decode a PDF string literal body, including \\363 style octal escapes."""
    out, i = bytearray(), 0
    while i < len(b):
        if b[i] == 0x5C and i + 1 < len(b):
            i += 1
            n = b[i]
            if 0x30 <= n <= 0x37:                      # octal, up to 3 digits
                k = 0
                while k < 3 and i + k < len(b) and 0x30 <= b[i + k] <= 0x37:
                    k += 1
                out.append(int(b[i:i + k], 8) & 0xFF)
                i += k
            else:
                out.append(n)
                i += 1
        else:
            out.append(b[i])
            i += 1
    return bytes(out)


LIGATURES = {0x1B: "ff", 0x1C: "fi", 0x1D: "fl", 0x1E: "ffi", 0x1F: "ffl"}


def _decode(b):
    """PDF string literal -> text, with T1 ligature codes expanded."""
    s = _unescape(b).decode("latin-1")
    return "".join(LIGATURES.get(ord(c), c) for c in s)


def lines_from(content, page_h=A4H):
    """-> [(x, height_from_top, text)]"""
    out, cur, line = [], [0.0, 0.0], []
    ctm, stack = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0), []

    def dev():
        a, b, c, d, e, f = ctm
        return a * cur[0] + c * cur[1] + e, b * cur[0] + d * cur[1] + f

    def flush():
        txt = "".join(line)
        if txt.strip():
            x, y = dev()
            out.append((x, page_h - y, txt))
        line.clear()

    pat = (rb"([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+cm"
           rb"|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm"
           rb"|([-\d.]+)\s+([-\d.]+)\s+Td"
           rb"|\((?:[^()\\]|\\.)*\)\s*Tj"
           rb"|\[(?:[^\[\]\\]|\\.)*\]\s*TJ|T\*|q|Q|BT|ET")
    for tok in re.finditer(pat, content):
        s, g = tok.group(0), tok.groups()
        if s == b"q":
            stack.append(ctm)
        elif s == b"Q":
            ctm = stack.pop() if stack else ctm
        elif s == b"BT":
            # BT resets the text and line matrices to identity. Without this
            # a stale Tm/Td from an earlier text object leaks into the next one
            # and text is reported at wildly wrong heights.
            flush()
            cur = [0.0, 0.0]
        elif s in (b"T*", b"ET"):
            flush()
        elif s.endswith(b"cm"):
            ctm = _mul(ctm, [float(v) for v in g[:6]])
        elif s.endswith(b"Tm"):
            flush()
            cur = [float(g[10]), float(g[11])]
        elif s.endswith(b"Td"):
            flush()
            cur = [cur[0] + float(g[12]), cur[1] + float(g[13])]
        elif s.endswith(b"Tj"):
            line.append(_decode(s[s.index(b"(") + 1:s.rindex(b")")]))
        else:
            for p in re.finditer(rb"(\((?:[^()\\]|\\.)*\)|[-\d.]+)", s):
                t = p.group(1)
                if t.startswith(b"("):
                    line.append(_decode(t[1:-1]))
                elif float(t) < -120:
                    line.append(" ")
    flush()
    return out


def images_from(content, page_h=A4H):
    """-> [(x, y_from_top, w, h)] for every XObject drawn, in page coordinates.

    Useful for confirming the plates actually land inside the text block: a
    caption read at a wild height usually means the image box overflowed.
    """
    out = []
    ctm, stack = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0), []
    pat = (rb"([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+cm"
           rb"|q|Q|/(\w+)\s+Do\b")
    for tok in re.finditer(pat, content):
        s, g = tok.group(0), tok.groups()
        if s == b"q":
            stack.append(ctm)
        elif s == b"Q":
            ctm = stack.pop() if stack else ctm
        elif s.endswith(b"cm"):
            ctm = _mul(ctm, [float(v) for v in g[:6]])
        elif s.endswith(b"Do"):
            a, b, c, d, e, f = ctm
            # An image XObject paints a unit square transformed by the CTM.
            # These books contain no form XObjects, so every Do is one plate.
            out.append((min(e, e + a + c), page_h - max(f, f + b + d),
                        abs(a) + abs(c), abs(b) + abs(d)))
    return out
