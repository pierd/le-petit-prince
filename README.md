# Le Petit Prince: French / Spanish parallel edition

The French original is on the left and a deliberately literal Spanish
translation is on the right. Matching paragraphs begin at the same height,
including across page breaks. The 47 original illustrations are centered
across the full text block rather than placed inside either language column.

The generated book contains 27 chapters, the dedication, and 739 paired
paragraphs. It contains no hosting-site headers, footers, logos, licence text,
or other branding.

## Build

```sh
./build-book.sh
```

This strictly refuses to build if any Spanish paragraph key is missing. It
generates `le-petit-prince.tex`, runs `pdflatex` twice, and writes
`le-petit-prince.pdf`.

macOS TeX executables are under `/Library/TeX/texbin`; the script adds that
directory to `PATH` automatically.

For a temporary French-in-both-columns draft despite missing translations:

```sh
./build-book.sh --draft
```

To regenerate only the LaTeX source:

```sh
./build-book.sh --tex-only
```

## Verify

```sh
python3 tools/check_alignment.py
```

The checker reads coordinates directly from the PDF. It verifies all 739
paragraph pairs begin at matching heights and all 47 plates are centered and
inside the page.

## Files

| Path | Purpose |
| --- | --- |
| `content/fr.txt` | Parsed French text and image positions |
| `content/es-part-*.txt` | Literal Spanish translation, split by chapter range |
| `images/` | Local copies of the 47 original illustrations |
| `book-template.tex` | Typography, synchronized columns, full-width plates |
| `tools/fetch_source.py` | Fetches and parses the supplied HTML source |
| `tools/makebook.py` | Validates keys and generates the complete LaTeX book |
| `tools/check_alignment.py` | Verifies paragraph and plate coordinates in the PDF |
| `bilingual-template.tex` | Earlier small, reusable parallel-text example |

## Editing

Edit Spanish paragraphs by key in `content/es-part-*.txt`; do not edit the
generated `le-petit-prince.tex`. A section has this form:

```text
=== ppchap1 | CAPÍTULO PRIMERO
[ppchap1.1]
Cuando tenía seis años...
```

Run `./build-book.sh` after edits. Keys may be split across files, but every
French key must have exactly one Spanish counterpart.

## Alignment

`\pair` measures the French and Spanish paragraphs, uses the taller height,
and pads the shorter side invisibly. This keeps each subsequent pair aligned;
plain `paracol` column switching alone does not. `\switchcolumn*` synchronizes
both streams before inserting each illustration across the full text width.
