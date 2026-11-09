# Le Petit Prince: French / Spanish parallel edition

An A5 booklet. Every opening is a pair of facing pages: the French original
on the left (even) page and a deliberately literal Spanish translation on the
right (odd) page. Matching paragraphs begin at the same height on both pages,
and a page break in one language is a page break in the other. Each of the 47
original illustrations is printed on both facing pages, at the same height.

The generated book contains 27 chapters, the dedication, and 739 paired
paragraphs. It contains no hosting-site headers, footers, logos, licence text,
or other branding.

## Build

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

## Print

Page 1 is the title (a right-hand page); the text starts on page 2, so the
French is always on the left of an opening. To make a folded booklet from A4
sheets, print `le-petit-prince.pdf` double-sided using a booklet option (e.g.
Acrobat Reader: *Page Sizing & Handling > Booklet*, both sides, binding left;
or your printer driver's booklet mode). At 160 pages that is 40 A4 sheets,
which is thick for a single fold; Acrobat's *Sheets from ... to* setting can
split it into several signatures.

## Verify

```sh
python3 tools/check_alignment.py
```

The checker reads coordinates directly from the PDF. For every opening it
verifies that the French page and the facing Spanish page have the same
number of paragraphs, that all 739 paragraph pairs and the chapter titles
begin at matching heights, that each plate appears on both pages at the same
height, and that the page count is a multiple of four.

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
| `web/` | Interactive reader (Vite + React + TypeScript) |
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

## Interactive reader

`web/` is a Vite + React + TypeScript site that shows one chapter at a time,
French by default, with an optional Spanish column. Hovering a word highlights
its counterpart in the Spanish (or shows it as a tooltip when the Spanish is
hidden). Clicking a word explains its form (tense, person, contraction,
elision, ...) and, for verbs, shows the full conjugation.

The site reads pre-computed JSON from `web/public/data/`, which is committed,
so deploying needs only Node. Regenerate it after editing the text:

```sh
uv run tools/annotate.py
```

This uses spaCy (French and Spanish models), verbecc for conjugations and
simalign (mBERT) for word alignment; the first run downloads the models and
takes about 15 minutes, later runs reuse the alignments cached in
`tools/.cache/`. The annotations are automatic and occasionally wrong.
Notes for contractions, elisions, articles and pronouns are hand-written in
`web/src/grammar/functionWords.ts`.

### Audio

The audiobook is split into one file per chapter and every French word is
timed, so the reader can highlight the word being read and play from any
word:

```sh
uv run tools/audio.py "Le Petit Prince audiobook in French (Full book)_1080p.mp4"
```

It needs ffmpeg and an Apple Silicon Mac: the audio is transcribed with
Whisper (`mlx-whisper`, about 10 minutes, cached in `tools/.cache/`) and the
transcript is aligned with the book's words. It writes
`web/public/audio/<chapter>.m4a` and `web/public/data/audio.json`, both
committed; the video itself is not. Run it again after `tools/annotate.py`,
since the timings refer to its tokens.

### Offline

The site is an installable PWA (`vite-plugin-pwa`, service worker in
`web/src/sw.ts`). Only the app shell is cached automatically; chapters you
open are kept as you read. "Télécharger pour hors ligne" in the table of
contents saves everything listed in `offline.json` (text, illustrations and
audio, about 43 MB; generated at build time by
`web/scripts/offline-manifest.mjs`). Audio URLs carry a content hash, so
saved copies are replaced only when the audio changes.

Develop and build:

```sh
cd web
npm install
npm run dev      # http://localhost:5173/le-petit-prince/
npm run build    # -> web/dist
```

Pushing to `main` builds and deploys the site with
`.github/workflows/pages.yml` (repository Settings → Pages → Source:
GitHub Actions).

## Alignment

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
