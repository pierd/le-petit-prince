# Notes for coding agents

The README (booklet, data pipeline) and `web/README.md` (the reader: features,
code map, data formats, how each part works) describe what exists. This file
records why it is built this way, what was tried and rejected, and how to
work on it safely.

## The project

- `content/fr.txt` and `content/es-part-*.txt` are the source of truth for
  the text. Paragraph keys like `ppchap2.7` tie French and Spanish together
  everywhere: booklet, reader data and audio timings.
- The LaTeX booklet (`tools/makebook.py`, `build-book.sh`) came first and is
  independent of the web reader.
- The web reader is `web/` (Vite 8, React 19, TypeScript 7). It is fed by two
  offline pipelines whose outputs are committed:
  1. `tools/annotate.py` writes `web/public/data/` from the text.
  2. `tools/audio.py` writes `web/public/audio/` and `data/audio.json` from
     the audiobook video.

  Run them in that order: audio timings refer to annotate's token indices,
  so any change to tokenization means re-running `audio.py`.
- Deployed by GitHub Actions to <https://pierd.github.io/le-petit-prince/> on
  every push to `main`.

## Working with the user

- They read the French and use the Spanish to understand it.
  - UI labels are short French ("Suivre", "Écouter d'ici", "Hors ligne").
  - Grammar explanations are English, keeping French terms (passé simple,
    subjonctif).
  - Translations of words are Spanish. English glosses were dropped because
    verbecc's were unreliable ("souvenir → to memory").
- Git:
  - Commit only when asked.
  - On `main`, create a branch first, commit there, and merge (fast-forward)
    into `main` when they ask.
  - Push only when asked; pushing deploys the site.
  - Never add AI attribution or co-author trailers.
- They report quality problems by example ("grande → persona is wrong").
  Fix the cause for the whole book, not the one instance, and measure the
  effect across the book (see Verifying).

## Pipeline decisions

**Annotation is rule-based and free, not LLM-generated.** No API key was
available, and the result must be reproducible.
- spaCy (`fr_core_news_lg`, `es_core_news_md`) for tokens, tags and lemmas.
- verbecc for conjugations.
- simalign (mBERT) for word alignment.

An LLM correction pass is the obvious next quality step if the user wants to
pay for it.

**spaCy needs help on French verbs.** It misreads the passé simple
(*préparai* as an infinitive) and person/number.
- Every VERB/AUX form is looked up in a reverse index of all verbecc forms
  (`tools/.cache/verb_index.pickle`, about 7000 verbs).
- The candidate readings are ranked against spaCy's features and the subject.
- A verb followed by a hyphenated object clitic (*dessine-moi*) can only be
  an imperative.
- A sentence-initial verb before a clitic (*Dessine-moi*) is re-tagged from
  NOUN.

**spaCy splits clitics inconsistently** (*veux - tu*, *demanda -t -il*).
`merge_clitics()` rejoins them before anything else, so `-tu` and `-t-il` are
single tokens with hand-written notes.

**All-caps text** (the dedication) is analysed in lower case and displayed in
its original case: spaCy tagged *IL* as a verb and *ÉTAIT* as an adverb.

**Alignment.** Each rule below fixes a reported or measured error:
- **Sentence by sentence** when both paragraphs have the same number of
  sentences. Aligned as whole paragraphs, mBERT swapped inverted
  adjective–noun pairs (*grande personne* → *persona mayor* as
  grande–persona).
- **"inter" links first**, i.e. links the aligner finds in both directions.
  Its one-to-one matching ("mwmf") only fills words still unlinked on both
  sides. A fill-in must also join two content words or two function words;
  otherwise you get leftovers paired up (*vu*–*a* in *j'ai vu* / *vi a*).
- **Distortion filter:** links far from the diagonal are dropped, since the
  translation is literal.
- **Borrowing rules** for words Spanish drops or fuses:
  - subject pronouns take their verb's links, through the copula when spaCy
    attaches the subject to the predicate (*il était petit*)
  - auxiliaries and participles share links
  - *ne … pas* map together to *no*
- **Measured** (scripts under Verifying):
  - *grande(s) personne(s)*: 28/29 correct.
  - French words with no link: 7.3%. Unlinked was preferred to wrong.

**Audio.**
- Transcribed with `mlx-whisper` (large-v3-turbo, Apple Silicon only) with
  word timestamps. The transcript is aligned to the book's normalized words
  with difflib; 96% match, and the rest are interpolated.
- Whisper silently skipped five stretches of real speech (up to 28 s). Every
  gap over 4 s is re-transcribed alone (`transcript-gaps.json`).
- Chapter titles are part of the alignment, so each file starts just before
  the narrator says "Chapitre …".
- The recording has an English intro, an English sign-off and no
  dedication. The intro and sign-off are cut. A chapter with under 50% of
  its words matched counts as not narrated and gets no audio.
- Audio URLs carry a `?v=<sha256 prefix>` so offline copies update only when
  a file changes. Re-encoding gives identical bytes, so re-running doesn't
  churn git.
- The user was told the recording appears to be someone else's YouTube
  audiobook and chose to publish it.

**Offline is opt-in** (the user's decision). Only the app shell is precached;
the 43 MB download is a button that shows its size first. Details are in
`web/README.md`.

## Gotchas

- **Python:** the system Python is 3.15, which spaCy doesn't support. Run the
  tools as `uv run --python 3.12 tools/<script>.py`; dependencies are inline
  (PEP 723).
- **Caches** in `tools/.cache/` (ignored by git) are expensive to rebuild:
  - `alignments-v2.json`: about 12 min of mBERT
  - `transcript.json`, `transcript-gaps.json`: about 5 min of Whisper
  - `verb_index.pickle`
  - `audio16k.wav`

  If you change how the aligner is called, use a new cache file name rather
  than silently mixing in old results.
- **Generated, ignored files:** `web/public/images/` and
  `web/public/offline.json` are written by `npm run prepare-public`, which
  runs before dev and build.
- **The video** (`*.mp4`, 324 MB) is ignored and must never be committed.
- **The service worker** only runs in a build (`npm run build && npx vite
  preview`), not under `npm run dev`.
- **iOS plays `<audio>` outside the service worker.** Saved audio only works
  in flight mode because the player plays it from a `blob:` URL read from
  the cache (`savedBlob()`). Desktop WebKit in Playwright does route media
  through the service worker, so a passing offline test there proved
  nothing for iOS; that bug reached the user. To imitate iOS, test with
  `service_workers="block"`.
- **Audio timings refer to token indices.** Changing tokenization in
  `annotate.py` without re-running `audio.py` silently misplaces the
  highlighted word.

## Verifying

There are no unit tests. Changes were verified like this:

- **Type-check and build:** `cd web && npx tsc -b && npm run build`.
- **The UI:** the desktop app's built-in browser can't reach a localhost
  server started from the shell. Instead, run `npx vite preview --port <n>
  --strictPort` in the background and drive it with Playwright from a
  throwaway `uv` script (`# dependencies = ["playwright"]`).
  - Take screenshots and read them; check `pageerror` events.
  - Use `p.devices["iPhone 13"]` for phones.
  - Use **WebKit** for anything with audio: Playwright's Chromium can't
    decode AAC.
  - For offline, create the context with `service_workers="allow"`, wait for
    `navigator.serviceWorker.ready`, reload, then `ctx.set_offline(True)`.
- **Annotation quality:** load the chapter JSON and print token, POS, lemma,
  first reading, compound and aligned Spanish for a passage. Also count a
  known phrase across the book, e.g. how many *grande(s) personne(s)* map to
  *mayor(es)* / *persona(s)*. Report the before/after numbers.
- **Audio cuts:** transcribe the first and last 4 s of some chapter files
  with Whisper and check they start with "Chapitre …" and end on the
  chapter's last sentence.

## Known limitations and ideas

- Some alignment errors remain, mostly between two function words
  (*j'* → *el*), and some spaCy tags are wrong.
- The Spanish-side popup is minimal: type and French counterpart only.
- The dedication has no audio (not narrated).
- The deploy workflow uses `actions/checkout@v4` / `setup-node@v4`, which
  GitHub warns target the retiring Node 20; bump them when convenient.
- Possible next steps:
  - an LLM pass to correct alignment and readings
  - Spanish grammar notes
  - a vocabulary list or spaced repetition from words looked up
