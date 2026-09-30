#!/usr/bin/env python3
"""Check that the facing pages of le-petit-prince.pdf stay in step.

The promise of this layout is that every opening shows the French on the left
(even) page and the Spanish on the right (odd) page, with paragraph N of the
French starting at the same height as paragraph N of the Spanish - and that
this survives 27 chapter breaks and 47 plates, each printed on both pages.

Paragraph starts are identifiable in the PDF because every paragraph is
indented by \\parindent while its continuation lines sit flush at the text
edge. The text edge of left and right pages and the indent are found from the
book's own geometry (the commonest x is the edge, the commonest small offset
from it is \\parindent), so no hard-coded page numbers are involved. Centred
headings sit far from the edge and are ignored on both sides alike.

    python3 tools/check_alignment.py [--draft] [pdf]
"""
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdftext import (load, page_order, page_size, content_of,  # noqa: E402
                     lines_from, images_from)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = [a for a in sys.argv[1:] if a != "--draft"]
DRAFT = "--draft" in sys.argv
PDF = ARGS[0] if ARGS else os.path.join(ROOT, "le-petit-prince.pdf")

TOL = 1.0             # pt, slack for PDF coordinate rounding
EDGE_TOL = 1.5        # pt, slack when bucketing x positions
HEAD = 40.0           # pt from the top: running head, not body text
FOOT = 45.0           # pt from the bottom: folio, not body text


def norm(s):
    return re.sub(r"[^a-z0-9à-ÿ]", "", s.lower())


def mode(vals, tol=EDGE_TOL):
    """commonest value, merging values within tol"""
    counts = Counter(round(v, 1) for v in vals)
    best, best_n = None, 0
    for v in counts:
        n = sum(c for u, c in counts.items() if abs(u - v) <= tol)
        if n > best_n:
            best, best_n = v, n
    return best


def main():
    objs = load(PDF)
    pages = []
    for pnum in page_order(objs):
        w, h = page_size(objs, pnum)
        content = content_of(objs, pnum)
        body = [(x, y, t) for x, y, t in lines_from(content, h)
                if HEAD < y < h - FOOT and norm(t)]
        pages.append((w, h, content, sorted(body, key=lambda r: r[1])))

    # Learn the text edge of left (even) and right (odd) pages globally, then
    # the paragraph indent relative to that edge.
    edges = {par: mode([x for pno, (_, _, _, body) in enumerate(pages, 1)
                        if pno % 2 == par for x, _, _ in body])
             for par in (0, 1)}
    indent = mode([x - edges[pno % 2] for pno, (_, _, _, body) in enumerate(pages, 1)
                   for x, _, _ in body if 4 < x - edges[pno % 2] < 30])

    def starts(pno):
        edge, body = edges[pno % 2], pages[pno - 1][3]
        return [(y, t) for x, y, t in body if abs((x - edge) - indent) <= TOL]

    problems, offpage = [], []
    npairs = nspreads = plates = 0

    for pno, (w, h, content, _) in enumerate(pages, 1):
        for x, y, iw, ih in images_from(content, h):
            plates += 1
            if x < 0 or y < 0 or x + iw > w or y + ih > h or iw < 5 or ih < 5:
                offpage.append((pno, x, y, iw, ih))

    # Openings are (2,3), (4,5), ...: French left, Spanish right.
    for left in range(2, len(pages) + 1, 2):
        right = left + 1
        lbody = pages[left - 1][3]
        rbody = pages[right - 1][3] if right <= len(pages) else []
        if not lbody and not rbody:
            continue                      # blank padding pages
        nspreads += 1
        if bool(lbody) != bool(rbody):
            problems.append((left, "one page of the opening is empty"))
            continue

        limg = [round(y) for _, y, _, _ in images_from(pages[left - 1][2], pages[left - 1][1])]
        rimg = [round(y) for _, y, _, _ in images_from(pages[right - 1][2], pages[right - 1][1])]
        if len(limg) != len(rimg) or any(abs(a - b) > TOL for a, b in zip(limg, rimg)):
            problems.append((left, f"plates differ: left at {limg}, right at {rimg}"))

        fs, es = starts(left), starts(right)
        if len(fs) != len(es):
            problems.append((left, f"{len(fs)} French vs {len(es)} Spanish "
                                   f"paragraph starts"
                                   + (f" (first: {fs[0][1][:24]!r} / {es[0][1][:24]!r})"
                                      if fs and es else "")))
            continue
        for (hf, tf), (he, te) in zip(fs, es):
            npairs += 1
            if abs(hf - he) > TOL:
                problems.append((left, f"heights differ by {hf - he:+.1f}pt: "
                                       f"{tf[:26]!r} / {te[:26]!r}"))
            elif not DRAFT and len(norm(tf)) > 12 and norm(tf) == norm(te):
                problems.append((left, f"untranslated: {tf[:26]!r}"))

        # Chapter titles are centred, so they are not paragraph starts; check
        # the first body line of each page too.
        if abs(lbody[0][1] - rbody[0][1]) > TOL:
            problems.append((left, f"first lines differ by "
                                   f"{lbody[0][1] - rbody[0][1]:+.1f}pt: "
                                   f"{lbody[0][2][:26]!r} / {rbody[0][2][:26]!r}"))

    print(f"pages: {len(pages)}   openings checked: {nspreads}   "
          f"paragraph pairs: {npairs}   plates drawn: {plates}")
    if len(pages) % 4:
        problems.append((len(pages), f"{len(pages)} pages is not a multiple of 4"))
    if offpage:
        print(f"\n{len(offpage)} plate(s) drawn outside the page:")
        for pno, x, y, iw, ih in offpage[:8]:
            print(f"  p{pno:3d}: x={x:.0f} y={y:.0f} {iw:.0f}x{ih:.0f}")
    if problems:
        print(f"\n{len(problems)} problem(s):")
        for pno, msg in problems[:25]:
            print(f"  p{pno:3d}: {msg}")
        if len(problems) > 25:
            print(f"  ... and {len(problems) - 25} more")
        return 1
    if offpage:
        return 1
    print("OK: French on every left page, Spanish facing it, every paragraph "
          "and plate level with its counterpart")
    return 0


if __name__ == "__main__":
    sys.exit(main())
