// Turns a token's tags into readable grammar notes.

import type { Token } from "../types";
import { functionWord } from "./functionWords";

export interface Description {
  /** Kind of word, e.g. "verb", "noun, feminine plural". */
  kind: string;
  /** Explanations, most important first. */
  notes: string[];
  /** Spanish equivalent from the hand-written table, for function words. */
  es?: string;
}

const POS: Record<string, string> = {
  NOUN: "noun",
  PROPN: "proper noun",
  VERB: "verb",
  AUX: "verb (auxiliary)",
  ADJ: "adjective",
  ADV: "adverb",
  ADP: "preposition",
  DET: "determiner",
  PRON: "pronoun",
  CCONJ: "conjunction",
  SCONJ: "subordinating conjunction",
  NUM: "number",
  INTJ: "interjection",
  PART: "particle",
  X: "word",
};

const TENSES: Record<string, { name: string; note: string }> = {
  "indicatif:présent": { name: "présent (present indicative)", note: "Something happening now, a habit or a general truth." },
  "indicatif:imparfait": { name: "imparfait (imperfect)", note: "Ongoing or habitual past, and background description. Like the Spanish pretérito imperfecto (« tenía », « hablaba »)." },
  "indicatif:passé-simple": { name: "passé simple (simple past)", note: "A completed event in the past. Literary: used in written narration, never in conversation, where the passé composé replaces it. Like the Spanish pretérito indefinido (« dije », « vi »)." },
  "indicatif:futur-simple": { name: "futur simple (future)", note: "Future: infinitive + -ai, -as, -a, -ons, -ez, -ont." },
  "conditionnel:présent": { name: "conditionnel présent (conditional)", note: "Would …; also polite requests and hearsay. Like the Spanish condicional (« daría »)." },
  "subjonctif:présent": { name: "subjonctif présent (present subjunctive)", note: "After que with wishes, doubt, necessity and emotion (« il faut que », « pour que »)." },
  "subjonctif:imparfait": { name: "subjonctif imparfait (imperfect subjunctive)", note: "Literary; replaced by the present subjunctive in modern speech. Like the Spanish « -ra / -se » forms." },
  "imperatif:imperatif-présent": { name: "impératif (imperative)", note: "An order or request; no subject pronoun. Object pronouns follow with a hyphen (« dessine-moi »)." },
  "infinitif:infinitif-présent": { name: "infinitif (infinitive)", note: "The dictionary form; used after prepositions and other verbs." },
  "participe:participe-présent": { name: "participe présent (present participle)", note: "-ant form. With en it is a gérondif: « en marchant » = caminando." },
  "participe:participe-passé": { name: "participe passé (past participle)", note: "Used with avoir / être to form compound tenses, in the passive, or as an adjective." },
};

const COMPOUNDS: Record<string, string> = {
  "passé composé": "Completed past action; the everyday spoken past tense. avoir / être in the present + past participle (« j'ai vu » = vi / he visto).",
  "plus-que-parfait": "Past before another past (had done). avoir / être in the imparfait + past participle (« j'avais vu » = había visto).",
  "passé antérieur": "Literary; an action completed just before another in the passé simple. Auxiliary in the passé simple + past participle (« j'eus vu » = hube visto).",
  "futur antérieur": "Will have done. Auxiliary in the future + past participle (« j'aurai vu » = habré visto).",
  "conditionnel passé": "Would have done. Auxiliary in the conditional + past participle (« j'aurais vu » = habría visto).",
  "subjonctif passé": "Past subjunctive. Auxiliary in the present subjunctive + past participle (« que j'aie vu » = que haya visto).",
  "subjonctif plus-que-parfait": "Literary; auxiliary in the imperfect subjunctive + past participle (« qu'il eût vu » = que hubiera visto).",
  "infinitif passé": "Past infinitive: avoir / être + past participle (« après avoir vu » = después de haber visto).",
  "participe passé composé": "Having done: ayant / étant + past participle (« ayant vu » = habiendo visto).",
  "impératif passé": "Rare: an order to have something done by a certain time.",
};

const PERSON: Record<string, string> = {
  "1s": "1st person singular (je)",
  "2s": "2nd person singular (tu)",
  "3s": "3rd person singular (il / elle / on)",
  "1p": "1st person plural (nous)",
  "2p": "2nd person plural (vous)",
  "3p": "3rd person plural (ils / elles)",
};

const AGREEMENT: Record<string, string> = {
  ms: "masculine singular",
  mp: "masculine plural",
  fs: "feminine singular",
  fp: "feminine plural",
};

export function feats(t: Token): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kv of (t.f ?? "").split("|")) {
    const [k, v] = kv.split("=");
    if (k && v) out[k] = v;
  }
  return out;
}

function genderNumber(f: Record<string, string>): string {
  const g = { Masc: "masculine", Fem: "feminine" }[f.Gender ?? ""];
  const n = { Sing: "singular", Plur: "plural" }[f.Number ?? ""];
  return [g, n].filter(Boolean).join(" ");
}

export function readingLabel(reading: string): string {
  const [mood, tense, pn] = reading.split(":");
  const t = TENSES[`${mood}:${tense}`];
  const who = PERSON[pn] ?? AGREEMENT[pn];
  return [t?.name ?? `${mood} ${tense}`, who].filter(Boolean).join(", ");
}

export function describeFrench(t: Token, tokens: Token[]): Description {
  const pos = t.p ?? "";
  const f = feats(t);
  const fw = functionWord(t.t, pos);
  const notes: string[] = [];

  if (t.v?.length) {
    const reading = t.v[0];
    const [mood, tense] = reading.split(":");
    const lemma = t.r ? `se ${t.l}` : t.l;
    if (t.c) {
      const words = t.c.w.map((i) => tokens[i].t).join(" … ");
      if (t.c.pass) {
        notes.push(`Passive voice: « ${words} » = être + past participle (is / was done). The tense is carried by être.`);
      } else {
        notes.push(`Part of « ${words} », ${t.c.n} of ${lemma}. ${COMPOUNDS[t.c.n] ?? ""}`);
      }
    }
    const tenseNote = TENSES[`${mood}:${tense}`]?.note;
    if (tenseNote && !t.c) notes.push(tenseNote);
    if (t.r) notes.push(`Used as a pronominal verb (${lemma}): it takes a reflexive pronoun and forms its compound tenses with être.`);
    if (t.v.length > 1) {
      const others = t.v.slice(1, 4).map(readingLabel);
      notes.push(`The same spelling can also be: ${others.join("; ")}.`);
    }
    const kind = t.c && t.c.aux === tokens.indexOf(t) ? "auxiliary verb" : "verb";
    return { kind: `${kind} · ${readingLabel(reading)}`, notes, es: fw?.es };
  }

  if (fw) {
    if (fw.note) notes.push(fw.note);
    return { kind: fw.kind, notes, es: fw.es };
  }

  if (t.t.endsWith("'")) notes.push("Elided form: the final vowel is dropped before a vowel or mute h.");
  const gn = genderNumber(f);
  let kind = POS[pos] ?? pos.toLowerCase();
  if ((pos === "NOUN" || pos === "ADJ" || pos === "DET" || pos === "PRON") && gn) kind += `, ${gn}`;
  if (pos === "ADJ" && t.l && t.l !== t.t.toLowerCase()) notes.push(`Dictionary form (masculine singular): ${t.l}.`);
  if (pos === "NOUN" && f.Number === "Plur" && t.l && t.l !== t.t.toLowerCase()) notes.push(`Singular: ${t.l}.`);
  if (t.t.includes("-") && pos !== "PROPN") notes.push("Hyphenated compound word.");
  return { kind, notes };
}

const ES_POS = POS;

export function describeSpanish(t: Token): Description {
  const f = feats(t);
  const notes: string[] = [];
  let kind = ES_POS[t.p ?? ""] ?? (t.p ?? "").toLowerCase();
  if (t.p === "VERB" || t.p === "AUX") {
    const mood = { Ind: "indicativo", Sub: "subjuntivo", Cnd: "condicional", Imp: "imperativo" }[f.Mood ?? ""];
    const tense = { Pres: "presente", Past: "pretérito", Imp: "imperfecto", Fut: "futuro" }[f.Tense ?? ""];
    const form = { Inf: "infinitivo", Part: "participio", Ger: "gerundio" }[f.VerbForm ?? ""];
    const person = f.Person ? `${f.Person}ª persona ${f.Number === "Plur" ? "plural" : "singular"}` : "";
    kind += ` · ${[form, mood, tense, person].filter(Boolean).join(", ")}`;
  } else {
    const gn = genderNumber(f);
    if (gn) kind += `, ${gn}`;
  }
  return { kind, notes };
}
