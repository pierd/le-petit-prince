# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = [
#   "spacy>=3.8,<3.9",
#   "fr_core_news_lg @ https://github.com/explosion/spacy-models/releases/download/fr_core_news_lg-3.8.0/fr_core_news_lg-3.8.0-py3-none-any.whl",
#   "es_core_news_md @ https://github.com/explosion/spacy-models/releases/download/es_core_news_md-3.8.0/es_core_news_md-3.8.0-py3-none-any.whl",
#   "verbecc>=2,<3",
#   "simalign==0.4",
#   "torch",
#   "transformers<4.50",
# ]
# ///
"""Annotate the parallel text for the interactive reader in web/.

    uv run tools/annotate.py

Reads content/fr.txt and content/es-part-*.txt (via makebook's parsers) and
writes, under web/public/data/:

    toc.json            chapter list with French and Spanish titles
    chapters/<key>.json tokens of every paragraph, both languages, with
                        lemma, part of speech, morphology and alignment group
    verbs.json          simple-tense conjugations of every verb in the book
    lexicon.json        French lemma -> most frequent aligned Spanish lemmas

French analysis is spaCy (fr_core_news_lg); verb forms are re-analysed
against verbecc's conjugation tables, because spaCy misreads e.g. the passé
simple. Word alignment is simalign (mBERT), then a few rules attach words
Spanish has no counterpart for (subject pronouns, auxiliaries, "ne ... pas")
to the word they belong with. Tokens that share an alignment group are
highlighted together in the reader.

Alignments are cached in tools/.cache/, so re-runs after editing the rules
are quick.
"""
import json
import logging
import os
import pickle
import re
import sys
from collections import Counter, defaultdict
from glob import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import makebook  # noqa: E402

OUT = os.path.join(ROOT, "web", "public", "data")
CACHE = os.path.join(ROOT, "tools", ".cache")

PERSONS = ["1s", "2s", "3s", "1p", "2p", "3p"]
SIMPLE_TENSES = [
    ("indicatif", "présent"), ("indicatif", "imparfait"),
    ("indicatif", "passé-simple"), ("indicatif", "futur-simple"),
    ("conditionnel", "présent"), ("subjonctif", "présent"),
    ("subjonctif", "imparfait"), ("imperatif", "imperatif-présent"),
]
# Tense of the auxiliary -> name of the compound tense it forms.
COMPOUND = {
    "indicatif:présent": "passé composé",
    "indicatif:imparfait": "plus-que-parfait",
    "indicatif:passé-simple": "passé antérieur",
    "indicatif:futur-simple": "futur antérieur",
    "conditionnel:présent": "conditionnel passé",
    "subjonctif:présent": "subjonctif passé",
    "subjonctif:imparfait": "subjonctif plus-que-parfait",
    "infinitif:infinitif-présent": "infinitif passé",
    "participe:participe-présent": "participe passé composé",
    "imperatif:imperatif-présent": "impératif passé",
}
# When a form has several readings, the more common one goes first.
MOOD_RANK = {"indicatif": 0, "participe": 1, "infinitif": 1, "imperatif": 2,
             "subjonctif": 3, "conditionnel": 3}
CONTENT = {"NOUN", "PROPN", "VERB", "AUX", "ADJ", "ADV", "NUM"}
NEG = {"pas", "plus", "jamais", "rien", "point", "guère"}
REFLEXIVE = {"me", "m'", "te", "t'", "se", "s'", "nous", "vous"}
# Pronouns joined to a verb with a hyphen: objects after an imperative
# ("dessine-moi") or inverted subjects ("dit-il", "a-t-il").
OBJ_CLITICS = {"moi", "toi", "le", "la", "les", "lui", "leur", "en", "y"}
SUBJ_CLITICS = {"je": "1s", "tu": "2s", "il": "3s", "elle": "3s", "on": "3s", "t-il": "3s",
                "t-elle": "3s", "t-on": "3s", "ils": "3p", "elles": "3p", "t-ils": "3p", "t-elles": "3p",
                "ce": "3s"}


def merge_clitics(doc):
    """Rejoin clitics spaCy splits: "veux - tu" -> "veux -tu", "-t -il" -> "-t-il"."""
    clitics = set(SUBJ_CLITICS) | OBJ_CLITICS | {"nous", "vous", "t"}
    spans = []
    for t in doc[:-1]:
        nxt = doc[t.i + 1]
        if t.whitespace_ or (spans and t.i < spans[-1].end):
            continue
        if t.text == "-" and nxt.lower_ in clitics and t.i > 0 and not doc[t.i - 1].whitespace_:
            spans.append(doc[t.i:t.i + 2])
        elif t.lower_ == "-t" and nxt.text.startswith("-"):
            spans.append(doc[t.i:t.i + 2])
    with doc.retokenize() as r:
        for sp in spans:
            r.merge(sp, attrs={"POS": "PRON", "LEMMA": sp.text.lower()})
    return doc


def hyphen_clitic(tok):
    """The clitic after tok ("moi" in "dessine-moi"), or None."""
    if tok.i + 1 < len(tok.doc) and tok.doc[tok.i + 1].text.startswith("-") and not tok.whitespace_:
        return tok.doc[tok.i + 1].lower_.lstrip("-")
    return None


def normalize(text):
    text = re.sub(r"^-\s*", "— ", text)          # dialogue dash
    text = re.sub(r"\s-(?=[A-ZÀ-Ý¿¡])", " — ", text)
    text = re.sub(r"\.\.\.(?=[^\s.,!?»\")])", "... ", text)
    text = text.replace(" -ce ", "-ce ")         # "Qu'est -ce que"
    return text


# --- verbs -------------------------------------------------------------------

def strip_pronoun(form):
    form = re.sub(r"^(que |qu')", "", form)
    return re.sub(r"^(je |j'|tu |il |elle |on |nous |vous |ils |elles )", "", form)


_conj_cache = {}


def conjugation_of(conj, inf):
    if inf not in _conj_cache:
        _conj_cache[inf] = _conjugation_of(conj, inf)
    return _conj_cache[inf]


def _conjugation_of(conj, inf):
    data = json.loads(str(conj.conjugate(inf)))
    moods = data["moods"]
    out = {"t": {}}
    for mood, tense in SIMPLE_TENSES:
        rows = moods.get(mood, {}).get(tense, [])
        slots = {}
        for row in rows:
            key = row.get("p", "") + row.get("n", "")
            if key not in slots and row.get("g", "m") == "m":
                slots[key] = strip_pronoun(row["c"][0]) if row["c"] else ""
        order = ["2s", "1p", "2p"] if mood == "imperatif" else PERSONS
        out["t"][f"{mood}:{tense}"] = [slots.get(k, "") for k in order]
    part = moods.get("participe", {})
    pp = {r.get("g", "") + r.get("n", ""): r["c"][0] for r in part.get("participe-passé", []) if r["c"]}
    out["pp"] = [pp.get(k, "") for k in ("ms", "mp", "fs", "fp")]
    out["ppr"] = (part.get("participe-présent") or [{"c": [""]}])[0]["c"][0]
    pc = moods["indicatif"].get("passé-composé") or [{"c": ["j'ai"]}]
    out["aux"] = "être" if re.match(r"je suis ", pc[0]["c"][0]) else "avoir"
    return out


def readings(conj, inf):
    """-> [(form, reading)] for every form of inf; reading is mood:tense:pn."""
    data = json.loads(str(conj.conjugate(inf)))
    res = []
    for mood, tenses in data["moods"].items():
        for tense, rows in tenses.items():
            for row in rows:
                for full in row["c"]:
                    if " " in strip_pronoun(full):   # compound tense
                        continue
                    pn = row.get("p", "") + row.get("n", "")
                    if mood == "participe" and tense == "participe-passé":
                        pn = row.get("g", "") + row.get("n", "")
                    res.append((strip_pronoun(full), f"{mood}:{tense}:{pn}"))
    return res


def verb_index(conj):
    """form -> {infinitive: [readings]} over all verbecc verbs (cached)."""
    path = os.path.join(CACHE, "verb_index.pickle")
    if os.path.exists(path):
        return pickle.load(open(path, "rb"))
    idx = defaultdict(lambda: defaultdict(list))
    infs = conj.get_infinitives()
    for n, inf in enumerate(infs):
        if n % 1000 == 0:
            print(f"  indexing verbs {n}/{len(infs)}", file=sys.stderr)
        try:
            for form, r in readings(conj, inf):
                if r not in idx[form][inf]:
                    idx[form][inf].append(r)
        except Exception:  # a few odd templates
            continue
    idx = {f: dict(v) for f, v in idx.items()}
    os.makedirs(CACHE, exist_ok=True)
    pickle.dump(idx, open(path, "wb"))
    return idx


COMMON_VERBS = ["être", "avoir", "faire", "aller", "dire", "pouvoir", "voir",
                "savoir", "vouloir", "venir", "devoir", "prendre", "falloir"]


def spacy_reading_score(reading, tok):
    mood, tense, pn = reading.split(":")
    m = tok.morph.to_dict()
    score = MOOD_RANK.get(mood, 4) * -1
    want_mood = {"Ind": "indicatif", "Sub": "subjonctif", "Cnd": "conditionnel",
                 "Imp": "imperatif"}.get(m.get("Mood"))
    if want_mood == mood:
        score += 3
    vf = m.get("VerbForm")
    if vf == "Inf" and mood == "infinitif":
        score += 5
    if vf == "Part" and mood == "participe":
        score += 5
    clitic = hyphen_clitic(tok)
    if clitic in SUBJ_CLITICS or clitic in ("nous", "vous") and tok.sent[-1].text == "?":
        if pn == SUBJ_CLITICS.get(clitic, {"nous": "1p", "vous": "2p"}.get(clitic)) and mood != "imperatif":
            score += 8
    elif clitic in OBJ_CLITICS or clitic in ("nous", "vous"):
        if mood == "imperatif":
            score += 8
    subj = [c for c in tok.children if c.dep_.startswith("nsubj") or c.dep_ == "expl:subj"]
    if subj and mood == "imperatif":
        score -= 10
    for s in subj:
        sm = s.morph.to_dict()
        person = sm.get("Person", "3" if s.pos_ in ("NOUN", "PROPN") else None)
        number = {"Sing": "s", "Plur": "p"}.get(sm.get("Number"))
        if s.lower_ in ("on", "ça", "cela", "ce", "c'", "qui"):
            person, number = "3", None if s.lower_ == "qui" else "s"
        if person and pn[:1] == person:
            score += 4
        if number and pn[1:2] == number:
            score += 2
    if not subj and "Person" in m and pn[:1] == m["Person"]:
        score += 1
    if mood == "imperatif" and not subj and tok.i == tok.sent.start + (1 if tok.sent[0].is_punct else 0):
        score += 2
    if mood == "subjonctif" and any(c.lower_ in ("que", "qu'") for c in tok.children):
        score += 4
    return score


def analyse_verb(tok, vidx):
    """-> (lemma, [readings best first]) or None if the form is unknown."""
    form = tok.lower_
    cands = vidx.get(form)
    if not cands:
        return None
    if tok.lemma_ in cands:
        lemma = tok.lemma_
    else:
        lemma = next((v for v in COMMON_VERBS if v in cands), None) or min(cands, key=len)
    rs = sorted(cands[lemma], key=lambda r: -spacy_reading_score(r, tok))
    if hyphen_clitic(tok) in OBJ_CLITICS:   # verb-hyphen-object only after an imperative
        rs = [r for r in rs if r.startswith("imperatif")] or rs
    return lemma, rs


# --- alignment ---------------------------------------------------------------

class Aligner:
    def __init__(self):
        self.path = os.path.join(CACHE, "alignments.json")
        self.cache = json.load(open(self.path)) if os.path.exists(self.path) else {}
        self.model = None

    def align(self, fr, es):
        key = json.dumps([fr, es], ensure_ascii=False)
        if key not in self.cache:
            if self.model is None:
                from simalign import SentenceAligner
                self.model = SentenceAligner(model="bert", token_type="bpe", matching_methods="m")
            self.cache[key] = [list(p) for p in self.model.get_word_aligns(fr, es)["mwmf"]]
        return [tuple(p) for p in self.cache[key]]

    def save(self):
        os.makedirs(CACHE, exist_ok=True)
        json.dump(self.cache, open(self.path, "w"), ensure_ascii=False)


def sent_spans(doc):
    return [(s.start, s.end) for s in doc.sents]


def align_docs(aligner, fd, ed):
    """Align two spaCy docs; long paragraphs sentence by sentence if they match."""
    fs, es = sent_spans(fd), sent_spans(ed)
    if len(fd) > 160 and len(fs) == len(es):
        pairs = []
        for (a, b), (c, d) in zip(fs, es):
            pairs += [(i + a, j + c) for i, j in
                      aligner.align([t.text for t in fd[a:b]], [t.text for t in ed[c:d]])]
        return pairs
    return aligner.align([t.text for t in fd], [t.text for t in ed])


def fix_alignment(fd, ed, pairs):
    """Add links for French words Spanish doesn't spell out."""
    links = defaultdict(set)
    nf, ne = len(fd), len(ed)
    for i, j in pairs:
        if fd[i].is_punct != ed[j].is_punct:
            continue
        # The translation is literal, so a link far from the diagonal is noise.
        if nf > 12 and abs(i / nf - j / ne) > max(0.15, 6 / nf):
            continue
        links[i].add(j)

    def borrow(i, k):
        if not links.get(i) and links.get(k) and abs(i - k) <= 4:
            links[i] |= links[k]

    for t in fd:
        # subject pronoun / auxiliary / reflexive -> the verb (Spanish drops or fuses it)
        if t.pos_ in ("PRON", "AUX") and t.head.pos_ in ("VERB", "AUX") and (
                t.dep_ in ("nsubj", "aux:tense", "aux:pass", "expl:subj", "expl:comp", "expl")
                or t.lower_ in REFLEXIVE):
            borrow(t.i, t.head.i)
        # "ne ... pas": both halves map to "no"
        if t.lower_ in ("ne", "n'"):
            for c in t.head.children:
                if c.lower_ in NEG:
                    borrow(c.i, t.i)
                    borrow(t.i, c.i)
    return links


# --- compound tenses ---------------------------------------------------------

def is_pp(info, k):
    return any(x.startswith("participe:participe-passé") for x in info.get(k, {}).get("v", []))


def find_compounds(fd, info):
    """Pair auxiliaries avoir/être with their past participle."""
    out = {}
    for t in fd:
        if "v" not in info.get(t.i, {}) or info[t.i]["l"] not in ("avoir", "être") \
                or is_pp(info, t.i) and len(info[t.i]["v"]) == 1:
            continue
        r = info[t.i]["v"][0]
        part = None
        for k in range(t.i + 1, min(t.i + 6, len(fd))):   # "ai bien regardé", "n'ai jamais vu"
            u = fd[k]
            if is_pp(info, k) and u.pos_ in ("VERB", "AUX", "ADJ"):
                part = u
                break
            if u.pos_ not in ("ADV", "PRON", "PART") and u.lower_ not in NEG:
                break
        if part is None and t.head.i > t.i and t.head.i - t.i < 6 and is_pp(info, t.head.i):
            part = t.head
        if part is None:
            continue
        mood, tense = r.split(":")[:2]
        name = COMPOUND.get(f"{mood}:{tense}")
        if not name:
            continue
        before = [fd[k].lower_ for k in range(max(0, t.i - 3), t.i)]
        refl = info[t.i]["l"] == "être" and any(w in REFLEXIVE for w in before[-2:])
        c = {"n": name, "w": [t.i, part.i], "aux": t.i}
        if info[t.i]["l"] == "être" and not refl and info[part.i].get("aux") == "avoir":
            c["pass"] = 1
        if refl:
            info[part.i]["r"] = 1
        out[t.i] = out[part.i] = c
        info[part.i]["v"] = [x for x in info[part.i]["v"] if x.startswith("participe:participe-passé")]
    return out


# --- main --------------------------------------------------------------------

def tok_json(t):
    d = {"t": t.text}
    if t.whitespace_:
        d["s"] = t.whitespace_
    return d


def main():
    logging.disable(logging.WARNING)
    import spacy
    from verbecc import CompleteConjugator

    secs = makebook.parse_fr(makebook.read("content/fr.txt"))
    es_lines = []
    for path in sorted(glob(os.path.join(ROOT, "content", "es-part-*.txt"))):
        es_lines.extend(open(path, encoding="utf-8").read().split("\n"))
    es_paras, es_titles = makebook.parse_es(es_lines)

    print("loading models", file=sys.stderr)
    nlp_fr = spacy.load("fr_core_news_lg")
    nlp_es = spacy.load("es_core_news_md")
    conj = CompleteConjugator(lang="fr")
    vidx = verb_index(conj)
    aligner = Aligner()

    verbs_used = {"avoir", "être"}
    lexicon = defaultdict(Counter)
    toc = []
    os.makedirs(os.path.join(OUT, "chapters"), exist_ok=True)

    for key, fr_title, blocks in secs:
        print(f"  {key}", file=sys.stderr)
        es_title = es_titles.get(key, makebook.title_for(key))
        out_blocks = []
        for b in blocks:
            if b[0] == "img":
                out_blocks.append({"type": "img", "src": b[1], "w": b[2], "h": b[3]})
                continue
            pkey, fr_text = b[1], normalize(b[2])
            es_text = normalize(es_paras[pkey])
            fd, ed = merge_clitics(nlp_fr(fr_text)), nlp_es(es_text)
            links = fix_alignment(fd, ed, align_docs(aligner, fd, ed))

            info = {}
            for t in fd:
                if t.is_punct or t.is_space:
                    continue
                d = {"l": t.lemma_.lower() if t.pos_ != "PROPN" else t.lemma_, "p": t.pos_}
                if str(t.morph):
                    d["f"] = str(t.morph)
                if t.text.startswith("-") or t.pos_ == "PRON":
                    d["l"], d["p"] = t.lower_, "PRON"
                elif t.lower_ == "s'" and t.pos_ == "SCONJ":
                    d["l"] = "si"
                elif hyphen_clitic(t) and t.pos_ not in ("VERB", "AUX") and t.lower_ in vidx:
                    d["p"] = "VERB"   # "Dessine-moi" at the start of a sentence
                if d["p"] in ("VERB", "AUX") or (t.pos_ == "ADJ" and t.lower_.endswith(("é", "ée", "és", "ées", "i", "is", "u", "us", "ue", "ues"))):
                    a = analyse_verb(t, vidx)
                    if a and (d["p"] != "ADJ" or a[1][0].startswith("participe:participe-passé")):
                        d["l"], d["v"] = a
                        if d["p"] == "ADJ":
                            d["v"] = [r for r in d["v"] if r.startswith("participe:participe-passé")]
                        verbs_used.add(a[0])
                        if any(c.lower_ in REFLEXIVE and c.pos_ == "PRON" and "Reflex=Yes" in str(c.morph)
                               for c in t.children):
                            d["r"] = 1
                info[t.i] = d
            for i, d in info.items():
                if "v" in d:
                    try:
                        d["aux"] = conjugation_of(conj, d["l"])["aux"]
                    except Exception:
                        pass
            comps = find_compounds(fd, info)

            fr_toks = []
            for t in fd:
                d = tok_json(t)
                if t.i in info:
                    inf = dict(info[t.i])
                    inf.pop("aux", None)
                    d.update(inf)
                if links.get(t.i) and not t.is_punct:
                    d["a"] = sorted(links[t.i])
                if t.i in comps:
                    d["c"] = comps[t.i]
                fr_toks.append(d)
                if t.pos_ in CONTENT and t.i in info and t.i in links:
                    es_c = [ed[j] for j in sorted(links[t.i]) if ed[j].pos_ in CONTENT and ed[j].lemma_ != "haber"]
                    if len(es_c) == 1:
                        p = "VERB" if info[t.i]["p"] == "AUX" else info[t.i]["p"]
                        gloss = es_c[0].lemma_.lower().split()[0]   # "acordar él" -> "acordar"
                        if p != "VERB" or re.search(r"[aeií]r$", gloss):   # not "dibújame"
                            lexicon[f"{info[t.i]['l']}|{p}"][gloss] += 1
            es_toks = []
            for t in ed:
                d = tok_json(t)
                if not t.is_punct and not t.is_space:
                    d["l"], d["p"] = t.lemma_.lower() if t.pos_ != "PROPN" else t.lemma_, t.pos_
                    if str(t.morph):
                        d["f"] = str(t.morph)
                es_toks.append(d)
            out_blocks.append({"type": "p", "key": pkey, "fr": fr_toks, "es": es_toks})

        chapter = {"id": key, "fr": fr_title, "es": es_title, "blocks": out_blocks}
        with open(os.path.join(OUT, "chapters", f"{key}.json"), "w", encoding="utf-8") as f:
            json.dump(chapter, f, ensure_ascii=False, separators=(",", ":"))
        toc.append({"id": key, "fr": fr_title, "es": es_title})
        aligner.save()

    verbs = {}
    for v in sorted(verbs_used):
        try:
            verbs[v] = conjugation_of(conj, v)
        except Exception as e:
            print(f"  no conjugation for {v}: {e}", file=sys.stderr)
    # One-off alignments are mostly noise (or spaCy misreading a Spanish lemma),
    # so beyond the top gloss only repeated ones are kept.
    lex = {k: [[w, n] for i, (w, n) in enumerate(c.most_common(4)) if i == 0 or n > 1]
           for k, c in sorted(lexicon.items())}

    def dump(name, obj):
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

    dump("toc.json", toc)
    dump("verbs.json", verbs)
    dump("lexicon.json", lex)
    print(f"wrote {len(toc)} chapters, {len(verbs)} verbs, {len(lex)} lexicon entries", file=sys.stderr)


if __name__ == "__main__":
    main()
