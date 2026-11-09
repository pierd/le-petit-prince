# Le Petit Prince: French / Spanish parallel edition

Saint-Exupéry's *Le Petit Prince* in the original French with a deliberately
literal Spanish translation, in two forms:

- **A printed booklet** (A5, `le-petit-prince.pdf`): every opening is a pair
  of facing pages, French on the left and Spanish on the right, paragraph
  for paragraph.
- **An interactive web reader** at <https://pierd.github.io/le-petit-prince/>
  (`web/`): one chapter at a time, with word-by-word alignment, grammar notes
  and conjugations for every French word, the audiobook with word-level
  sync, and an offline mode. See [`web/README.md`](web/README.md).

Both are built from the same text: `content/fr.txt` and
`content/es-part-*.txt`.

## Booklet

Every opening is a pair of facing pages: the French original on the left
(even) page and the Spanish translation on the right (odd) page. Matching
paragraphs begin at the same height on both pages, and a page break in one
language is a page break in the other. Each of the 47 original illustrations
is printed on both facing pages, at the same height.

The generated book contains 27 chapters, the dedication, and 739 paired
paragraphs. It contains no hosting-site headers, footers, logos, licence text,
or other branding.

### Build

```sh
./build-book.sh
```

This strictly refuses to build if any Spanish paragraph key is missing. It
generates `le-petit-prince.tex`, runs `pdflatex` twice, and writes
`le-petit-prince.pdf` (A5 pages, padded with blank pages to a multiple of
four).

macOS TeX executables are under `/Library/TeX/texbin`; the script adds that
directory to `PATH` automatically.

For a temporary draft with French on both pages despite missing translations:

```sh
./build-book.sh --draft
```

To regenerate only the LaTeX source:

```sh
./build-book.sh --tex-only
```

### Print

Page 1 is the title (a right-hand page); the text starts on page 2, so the
French is always on the left of an opening. To make a folded booklet from A4
sheets, print `le-petit-prince.pdf` double-sided using a booklet option (e.g.
Acrobat Reader: *Page Sizing & Handling > Booklet*, both sides, binding left;
or your printer driver's booklet mode). At 160 pages that is 40 A4 sheets,
which is thick for a single fold; Acrobat's *Sheets from ... to* setting can
split it into several signatures.

### Verify

```sh
python3 tools/check_alignment.py
```

The checker reads coordinates directly from the PDF. For every opening it
verifies that the French page and the facing Spanish page have the same
number of paragraphs, that all 739 paragraph pairs and the chapter titles
begin at matching heights, that each plate appears on both pages at the same
height, and that the page count is a multiple of four.

### How the facing pages line up

`\begin{paracol}[1]*{2}` is paracol's parallel-paging mode: column 0 (French)
goes on even pages and column 1 (Spanish) on the facing odd pages, with their
page breaks synchronized. `\pair` measures the French and Spanish paragraphs,
uses the taller height, and pads the shorter side invisibly. This keeps each
subsequent pair aligned; plain `paracol` column switching alone does not.
`\plate` is a `\pair` with the same illustration on both sides. `\firstline`
pins each box's first baseline at a fixed depth so that accented capitals
(`CAPÍTULO`, `¿`) do not push one side down.

Paragraphs are never split across pages, so a page may end early when the
next paragraph does not fit on it.

## Web reader

The reader is a static Vite + React + TypeScript site, deployed to GitHub
Pages on every push to `main` (`.github/workflows/pages.yml`; repository
Settings → Pages → Source: GitHub Actions). How it works, how to run it and
how its data is shaped: [`web/README.md`](web/README.md).

Everything the site shows is pre-computed and committed, so building and
deploying needs only Node. The data comes from two scripts, run in this
order after editing the text:

```sh
# text -> web/public/data/ (tokens, grammar, alignment)
uv run --python 3.12 tools/annotate.py
# audiobook -> web/public/audio/ and web/public/data/audio.json
uv run --python 3.12 tools/audio.py "Le Petit Prince audiobook in French (Full book)_1080p.mp4"
```

- **`tools/annotate.py`** tokenizes and tags both texts with spaCy, re-checks
  every French verb form against verbecc's conjugation tables, aligns the
  French and Spanish words with simalign (mBERT), and writes one JSON file
  per chapter plus the conjugations (`verbs.json`) and usual translations
  (`lexicon.json`). The first run downloads the models and takes about
  15 minutes; alignments are then cached in `tools/.cache/`.
- **`tools/audio.py`** needs ffmpeg and an Apple Silicon Mac. It transcribes
  the audiobook with Whisper (`mlx-whisper`, about 5 minutes, cached in
  `tools/.cache/`), aligns the transcript with the book's French words to
  time each of them, and cuts one AAC file per chapter. Its timings refer to
  `annotate.py`'s tokens, so run it again whenever those change. The video
  is not committed (`*.mp4` is ignored).

Both scripts declare their own dependencies (PEP 723), so `uv` installs
everything except ffmpeg. They need Python 3.11 or 3.12 (spaCy has no wheels
for newer versions), hence `--python 3.12`. The analyses are automatic and
occasionally wrong; the notes for contractions, elisions, articles and
pronouns are hand-written in `web/src/grammar/functionWords.ts`.

## Editing

Edit Spanish paragraphs by key in `content/es-part-*.txt`; do not edit the
generated `le-petit-prince.tex`. A section has this form:

```text
=== ppchap1 | CAPÍTULO PRIMERO
[ppchap1.1]
Cuando tenía seis años...
```

Run `./build-book.sh` after edits. Keys may be split across files, but every
French key must have exactly one Spanish counterpart. For the web reader, run
`tools/annotate.py` and then `tools/audio.py` (see "Web reader" above) and
commit the regenerated `web/public/`.

## Files

| Path | Purpose |
| --- | --- |
| `content/fr.txt` | Parsed French text and image positions |
| `content/es-part-*.txt` | Literal Spanish translation, split by chapter range |
| `images/` | Local copies of the 47 original illustrations |
| `book-template.tex` | A5 geometry, facing-page layout, plates |
| `tools/fetch_source.py` | Fetches and parses the supplied HTML source |
| `tools/makebook.py` | Validates keys and generates the complete LaTeX book |
| `tools/check_alignment.py` | Verifies paragraph and plate coordinates in the PDF |
| `tools/annotate.py` | Generates the interactive reader's data in `web/public/data/` |
| `tools/audio.py` | Splits the audiobook into chapters and times every word |
| `web/` | Interactive reader (Vite + React + TypeScript), see `web/README.md` |
| `.github/workflows/pages.yml` | Builds `web/` and deploys it to GitHub Pages |
| `CLAUDE.md` | Notes for coding agents: design decisions, pitfalls, how to verify |
| `bilingual-template.tex` | Earlier small, reusable parallel-text example |
