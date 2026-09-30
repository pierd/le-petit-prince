#!/usr/bin/env python3
"""Check that the two columns of le-petit-prince.pdf stay in step.

The promise of this layout is that paragraph N of the French always faces
paragraph N of the Spanish, on the same page and at the same height - and that
this survives 27 chapter breaks and 47 plates.

Paragraph starts are identifiable in the PDF because every paragraph is
indented by \\parindent while its continuation lines sit flush at the column
edge. Column edges and the indent are found from the page's own geometry
(the commonest x is the edge, the commonest small indent is \\parindent), so no
hard-coded page numbers are involved. Centred headings and plate captions sit
far to the right of the edge and are ignored on both sides alike.

    python3 tools/check_alignment.py [--draft] [pdf]
"""
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdftext import load, page_order, content_of, lines_from, images_from  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = [a for a in sys.argv[1:] if a != "--draft"]
DRAFT = "--draft" in sys.argv
PDF = ARGS[0] if ARGS else os.path.join(ROOT, "le-petit-prince.pdf")

MID = 595.28 / 2      # A4 width / 2: the rule between the columns
TOL = 3.0             # pt, slack for PDF coordinate rounding
EDGE_TOL = 1.5        # pt, slack when bucketing x positions


def norm(s):
    return re.sub(r"[^a-z0-9à-ÿ]", "", s.lower())


def mode(vals, tol=EDGE_TOL):
    """commonest value, merging values within tol"""
    best, best_n = None, 0
    for v, _ in Counter(vals).most_common():
        n = sum(c for u, c in Counter(vals).items() if abs(u - v) <= tol)
        if n > best_n:
            best, best_n = v, n
    return best


def columns(lines):
    left = [(x, h, t) for x, h, t in lines if x < MID and norm(t)]
    right = [(x, h, t) for x, h, t in lines if x >= MID and norm(t)]
    return (sorted(left, key=lambda r: r[1]), sorted(right, key=lambda r: r[1]))


def starts(col, edge, para):
    """(height, text) of every indented line, i.e. every paragraph start."""
    return [(h, t) for x, h, t in col
            if 60 < h < 780 and abs((x - edge) - para) <= TOL]


def main():
    objs = load(PDF)
    pages = page_order(objs)
    page_data = []
    xs = {(side, parity): [] for side in (0, 1) for parity in (0, 1)}

    # Learn fixed column edges globally. Per-page inference is ambiguous on a
    # sparse page with equal numbers of continuation and paragraph-start lines.
    for pno, pnum in enumerate(pages, 1):
        content = content_of(objs, pnum)
        cols = columns(lines_from(content))
        page_data.append((content, cols))
        for side, col in enumerate(cols):
            xs[(side, pno % 2)].extend(x for x, h, _ in col if 60 < h < 780)

    edges = {k: mode(v) for k, v in xs.items() if v}
    indents = {0: [], 1: []}
    for pno, (_, cols) in enumerate(page_data, 1):
        for side, col in enumerate(cols):
            edge = edges.get((side, pno % 2))
            if edge is not None:
                indents[side].extend(x - edge for x, h, _ in col
                                     if 60 < h < 780 and 4 < x - edge < 30)
    paras = {side: mode(vals) for side, vals in indents.items()}

    problems, offpage, npairs, pages_ok = [], [], 0, 0
    plates = 0

    for pno, (content, (left, right)) in enumerate(page_data, 1):
        if pno == 1:                       # title page is single-column
            continue

        for x, y, w, h in images_from(content):
            plates += 1
            if y < 20 or y + h > 830 or w < 5 or h < 5:
                offpage.append((pno, x, y, w, h))

        if not left or not right:
            continue
        fs = starts(left, edges[(0, pno % 2)], paras[0])
        es = starts(right, edges[(1, pno % 2)], paras[1])
        if not fs and not es:
            continue
        pages_ok += 1

        if len(fs) != len(es):
            problems.append((pno, f"{len(fs)} French vs {len(es)} Spanish "
                                  f"paragraph starts (first: "
                                  f"{fs[0][1][:24]!r} / {es[0][1][:24]!r})"
                                  if fs and es else "one column found no paragraph"))
            continue
        for (hf, tf), (he, te) in zip(fs, es):
            npairs += 1
            if abs(hf - he) > TOL:
                problems.append((pno, f"heights differ by {hf - he:+.1f}pt: "
                                      f"{tf[:26]!r} / {te[:26]!r}"))
            elif not DRAFT and norm(tf) and norm(tf) == norm(te) and len(norm(tf)) > 12:
                problems.append((pno, f"untranslated: {tf[:26]!r}"))

    print(f"pages checked: {pages_ok}   paragraph pairs: {npairs}   plates: {plates}")
    if offpage:
        print(f"\n{len(offpage)} plate(s) drawn outside the text area:")
        for pno, x, y, w, h in offpage[:8]:
            print(f"  p{pno:3d}: x={x:.0f} y={y:.0f} {w:.0f}x{h:.0f}")
    if problems:
        print(f"\n{len(problems)} problem(s):")
        for pno, msg in problems[:25]:
            print(f"  p{pno:3d}: {msg}")
        if len(problems) > 25:
            print(f"  ... and {len(problems) - 25} more")
        return 1
    print("OK: every paragraph faces its counterpart at the same height"
          + (f", and all {plates} plates sit inside the text area"
             if not offpage else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
