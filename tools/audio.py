# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = [
#   "mlx-whisper",
# ]
# ///
"""Split the audiobook into chapters and time every French word.

    uv run --python 3.12 tools/audio.py [VIDEO]

VIDEO defaults to the one .mp4 in the repository root. Needs ffmpeg and an
Apple Silicon Mac (mlx-whisper). Run tools/annotate.py first: this reads the
French tokens from web/public/data/chapters/.

Writes:
    web/public/audio/<key>.m4a   one AAC file per chapter (mono, 48 kb/s)
    web/public/data/audio.json   per chapter: audio file (with a content hash
                                 so saved offline copies update), duration, and the
                                 start time of every French token, relative
                                 to the chapter file

The audio is transcribed with Whisper (word timestamps) and the transcript
is aligned with the book's words by difflib on normalized spellings; words
Whisper missed or misheard get times interpolated between their matched
neighbours. Chapter files are cut halfway through the silence between the
last word of a chapter and the first of the next, so each starts with the
narrator announcing the chapter.

The transcript is cached in tools/.cache/transcript.json (transcribing takes
a while); delete it to transcribe again.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata
from difflib import SequenceMatcher
from glob import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
DATA = os.path.join(ROOT, "web", "public", "data")
AUDIO_OUT = os.path.join(ROOT, "web", "public", "audio")
MODEL = "mlx-community/whisper-large-v3-turbo"


def norm(word):
    """Spelling-insensitive form for matching: "Vécues," -> "vecues"."""
    w = unicodedata.normalize("NFD", word.lower())
    w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    w = w.replace("œ", "oe").replace("æ", "ae")
    return re.sub(r"[^a-z0-9]", "", w)


def whisper(wav, offset=0.0):
    import mlx_whisper
    r = mlx_whisper.transcribe(wav, path_or_hf_repo=MODEL, language="fr", word_timestamps=True,
                               condition_on_previous_text=False, verbose=None)
    return [{"w": w["word"].strip(), "s": round(w["start"] + offset, 3), "e": round(w["end"] + offset, 3)}
            for seg in r["segments"] for w in seg.get("words", [])]


def transcribe(wav):
    """Whisper words with timestamps. Whisper sometimes skips a stretch of
    speech (22 s at the start of chapter 1), so every gap of more than 4 s
    is transcribed again on its own and whatever it finds is merged in."""
    path = os.path.join(CACHE, "transcript.json")
    if os.path.exists(path):
        words = json.load(open(path))
    else:
        print("transcribing (this takes a while)", file=sys.stderr)
        words = whisper(wav)
        json.dump(words, open(path, "w"), ensure_ascii=False)

    gaps_path = os.path.join(CACHE, "transcript-gaps.json")
    gaps = json.load(open(gaps_path)) if os.path.exists(gaps_path) else {}
    for a, b in zip(words, words[1:]):
        if b["s"] - a["e"] <= 4:
            continue
        key = f"{a['e']:.3f}-{b['s']:.3f}"
        if key not in gaps:
            clip = os.path.join(CACHE, "gap.wav")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a['e']}", "-to", f"{b['s']}", "-i", wav, clip],
                           check=True)
            gaps[key] = [w for w in whisper(clip, a["e"]) if a["e"] <= w["s"] < b["s"]]
            print(f"  gap {key}: {' '.join(w['w'] for w in gaps[key])[:80]}", file=sys.stderr)
            json.dump(gaps, open(gaps_path, "w"), ensure_ascii=False)
    return sorted(words + [w for ws in gaps.values() for w in ws], key=lambda w: w["s"])


def book_words():
    """-> [(chapter, paragraph key, token index, normalized text)] for every French word.

    The chapter title comes first with paragraph key None: the narrator reads
    it ("Chapitre deux"), and its time is where the chapter's audio starts.
    """
    toc = json.load(open(os.path.join(DATA, "toc.json")))
    out = []
    for entry in toc:
        out += [(entry["id"], None, None, norm(w)) for w in entry["fr"].split()]
        ch = json.load(open(os.path.join(DATA, "chapters", f"{entry['id']}.json")))
        for b in ch["blocks"]:
            if b["type"] != "p":
                continue
            for i, t in enumerate(b["fr"]):
                if "l" in t and norm(t["t"]):
                    out.append((entry["id"], b["key"], i, norm(t["t"])))
    return toc, out


def split_heard(words):
    """Whisper words, split like the book's tokens ("j'ai" -> "j'", "ai")."""
    out = []
    for w in words:
        parts = [p for p in re.split(r"(?<=['’])|[\s-]+", w["w"]) if norm(p)]
        n = len(parts)
        for k, p in enumerate(parts):
            s = w["s"] + (w["e"] - w["s"]) * k / max(n, 1)
            out.append((norm(p), round(s, 3), w["e"]))
    return out


def align(book, heard):
    """-> start time per book word (None where unmatched), via difflib."""
    times = [None] * len(book)
    sm = SequenceMatcher(None, [b[3] for b in book], [h[0] for h in heard], autojunk=False)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            times[a + k] = heard[b + k][1]
    matched = sum(t is not None for t in times)
    print(f"matched {matched}/{len(book)} words ({matched / len(book):.0%})", file=sys.stderr)
    return times


def interpolate(times):
    """Fill gaps linearly between matched neighbours."""
    known = [i for i, t in enumerate(times) if t is not None]
    out = list(times)
    for a, b in zip(known, known[1:]):
        for i in range(a + 1, b):
            out[i] = round(times[a] + (times[b] - times[a]) * (i - a) / (b - a), 3)
    for i in range(known[0]):
        out[i] = times[known[0]]
    for i in range(known[-1] + 1, len(out)):
        out[i] = times[known[-1]]
    return out


def main():
    video = sys.argv[1] if len(sys.argv) > 1 else (glob(os.path.join(ROOT, "*.mp4")) or [None])[0]
    if not video:
        sys.exit("usage: uv run --python 3.12 tools/audio.py VIDEO")
    os.makedirs(CACHE, exist_ok=True)
    wav = os.path.join(CACHE, "audio16k.wav")
    if not os.path.exists(wav):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000", wav], check=True)
    duration = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video],
                                    capture_output=True, text=True, check=True).stdout)

    heard = transcribe(wav)
    toc, book = book_words()
    raw = align(book, split_heard(heard))
    times = interpolate(raw)

    # A chapter the narrator skipped (the dedication) has almost no matches: no audio for it.
    matched = {}
    for (ch, pkey, _, _), t in zip(book, raw):
        if pkey is None:
            continue
        m = matched.setdefault(ch, [0, 0])
        m[0] += t is not None
        m[1] += 1
    toc = [e for e in toc if matched[e["id"]][0] > 0.5 * matched[e["id"]][1]]
    skipped = [ch for ch, (m, n) in matched.items() if m <= 0.5 * n]
    if skipped:
        print(f"not narrated: {', '.join(skipped)}", file=sys.stderr)
    kept = [k for k, b in enumerate(book) if b[0] not in skipped]
    book, times, raw = [book[k] for k in kept], [times[k] for k in kept], [raw[k] for k in kept]

    # Chapter spans: from just before the narrator announces the title (the
    # first title word Whisper heard), else midway through the silence before
    # the chapter's first word.
    firsts, lasts, titles = {}, {}, {}
    for (ch, pkey, _, _), t, r in zip(book, times, raw):
        if pkey is None:
            if r is not None:
                titles.setdefault(ch, r)
            continue
        firsts.setdefault(ch, t)
        lasts[ch] = t
    ids = [e["id"] for e in toc]
    starts = [t["s"] for t in heard]

    def after(t):
        """Start of the first heard word after the one starting at t."""
        return next((s for s in starts if s > t + 0.05), duration)

    cuts = []
    for k, ch in enumerate(ids):
        prev_end = after(lasts[ids[k - 1]]) if k else 0.0   # end of the previous chapter's last word, roughly
        cut = titles[ch] - 0.3 if ch in titles and titles[ch] < firsts[ch] else (prev_end + firsts[ch]) / 2
        cuts.append(round(max(prev_end - 0.1 if k else 0.0, min(cut, firsts[ch] - 0.2)), 2))
    # The recording ends with the narrator signing off in English: stop after the last word.
    cuts.append(round(min(duration, after(lasts[ids[-1]]) - 0.1), 2))

    os.makedirs(AUDIO_OUT, exist_ok=True)
    result = {}
    for k, ch in enumerate(ids):
        start, end = cuts[k], cuts[k + 1]
        name = f"{ch}.m4a"
        print(f"  {ch}: {start:8.2f} - {end:8.2f}", file=sys.stderr)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start}", "-to", f"{end}", "-i", video, "-vn",
                        "-ac", "1", "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart",
                        os.path.join(AUDIO_OUT, name)], check=True)
        paras = {}
        for (c, pkey, i, _), t in zip(book, times):
            if c == ch and pkey is not None:
                paras.setdefault(pkey, {})[i] = round(t - start, 2)
        digest = hashlib.sha256(open(os.path.join(AUDIO_OUT, name), "rb").read()).hexdigest()[:10]
        result[ch] = {"src": f"{name}?v={digest}", "duration": round(end - start, 2),
                      "words": {p: [[i, t] for i, t in sorted(ts.items())] for p, ts in paras.items()}}
    with open(os.path.join(DATA, "audio.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {len(result)} chapter files", file=sys.stderr)


if __name__ == "__main__":
    main()
