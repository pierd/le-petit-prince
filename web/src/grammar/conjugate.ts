// Full conjugation tables: simple tenses come from verbs.json, compound
// tenses are built here from the auxiliary and the past participle, and
// pronominal verbs get their reflexive pronouns and être.

import type { Verb, Verbs } from "../types";

export interface TenseTable {
  /** "mood:tense" key matching verb readings; compound tenses use their name. */
  key: string;
  name: string;
  rows: { pronoun: string; form: string }[];
}

export interface MoodTables {
  mood: string;
  tenses: TenseTable[];
}

const SUBJECTS = ["je", "tu", "il", "nous", "vous", "ils"];
const REFLEXIVES = ["me", "te", "se", "nous", "vous", "se"];
const IMPERATIVE = ["(tu)", "(nous)", "(vous)"];

const startsWithVowel = (w: string) => /^[aeiouyàâäéèêëîïôöûùüh]/i.test(w);

function subject(i: number, next: string, subjunctive: boolean): string {
  let p = SUBJECTS[i];
  if (i === 0 && startsWithVowel(next)) p = "j'";
  if (subjunctive) p = (i === 2 || i === 5 ? "qu'" : "que ") + p;
  return p;
}

function withReflexive(i: number, form: string): string {
  const r = REFLEXIVES[i];
  return r.length === 2 && startsWithVowel(form) ? `${r[0]}'${form}` : `${r} ${form}`;
}

function simple(verb: Verb, key: string, reflexive: boolean, subjunctive = false) {
  return (verb.t[key] ?? []).map((form, i) => {
    const f = reflexive ? withReflexive(i, form) : form;
    return { pronoun: subject(i, f, subjunctive), form: f };
  });
}

/** Past participle agreeing with the subject (only shown when the auxiliary is être). */
function participle(verb: Verb, i: number, agrees: boolean): string {
  const [ms] = verb.pp;
  if (!agrees) return ms;
  return i < 3 ? `${ms}(e)` : `${ms}(e)s`;
}

function compound(verb: Verb, verbs: Verbs, auxKey: string, reflexive: boolean, subjunctive = false) {
  const auxName = reflexive ? "être" : verb.aux;
  const aux = verbs[auxName];
  if (!aux) return [];
  return (aux.t[auxKey] ?? []).map((a, i) => {
    const first = reflexive ? withReflexive(i, a) : a;
    return {
      pronoun: subject(i, first, subjunctive),
      form: `${first} ${participle(verb, i, auxName === "être")}`,
    };
  });
}

export function conjugationTables(lemma: string, verbs: Verbs, reflexive: boolean): MoodTables[] {
  const v = verbs[lemma];
  if (!v) return [];
  const s = (key: string, name: string, subj = false): TenseTable => ({ key, name, rows: simple(v, key, reflexive, subj) });
  const c = (auxKey: string, name: string, subj = false): TenseTable => ({ key: name, name, rows: compound(v, verbs, auxKey, reflexive, subj) });
  const imp = (v.t["imperatif:imperatif-présent"] ?? []).map((form, i) => ({
    pronoun: IMPERATIVE[i],
    form: reflexive && form ? `${form}-${["toi", "nous", "vous"][i]}` : form,
  }));
  const se = reflexive ? (startsWithVowel(lemma) ? "s'" : "se ") : "";
  const auxInf = reflexive ? "être" : v.aux;
  return [
    {
      mood: "Indicatif",
      tenses: [
        s("indicatif:présent", "présent"),
        c("indicatif:présent", "passé composé"),
        s("indicatif:imparfait", "imparfait"),
        c("indicatif:imparfait", "plus-que-parfait"),
        s("indicatif:passé-simple", "passé simple"),
        c("indicatif:passé-simple", "passé antérieur"),
        s("indicatif:futur-simple", "futur simple"),
        c("indicatif:futur-simple", "futur antérieur"),
      ],
    },
    {
      mood: "Conditionnel",
      tenses: [s("conditionnel:présent", "présent"), c("conditionnel:présent", "conditionnel passé")],
    },
    {
      mood: "Subjonctif",
      tenses: [
        s("subjonctif:présent", "présent", true),
        c("subjonctif:présent", "subjonctif passé", true),
        s("subjonctif:imparfait", "imparfait", true),
        c("subjonctif:imparfait", "subjonctif plus-que-parfait", true),
      ],
    },
    {
      mood: "Impératif",
      tenses: [{ key: "imperatif:imperatif-présent", name: "présent", rows: imp }],
    },
    {
      mood: "Participes",
      tenses: [
        {
          key: "nonfinite",
          name: "formes",
          rows: [
            { pronoun: "infinitif", form: se + lemma },
            { pronoun: "infinitif passé", form: `${reflexive ? "s'" : ""}${auxInf} ${v.pp[0]}` },
            { pronoun: "participe présent", form: (reflexive ? se : "") + v.ppr },
            { pronoun: "participe passé", form: v.pp.filter(Boolean).join(", ") },
          ],
        },
      ],
    },
  ];
}

/** Which cell of the tables a reading or compound tense points at. */
export function cellFor(reading: string | undefined, compoundName?: string, auxReading?: string): { key: string; row: number } | null {
  const pnRow = (pn: string, imperative: boolean) => {
    const order = imperative ? ["2s", "1p", "2p"] : ["1s", "2s", "3s", "1p", "2p", "3p"];
    return order.indexOf(pn);
  };
  if (compoundName && auxReading) {
    const [, , pn] = auxReading.split(":");
    return { key: compoundName, row: pnRow(pn, false) };
  }
  if (!reading) return null;
  const [mood, tense, pn] = reading.split(":");
  if (mood === "infinitif") return { key: "nonfinite", row: 0 };
  if (tense === "participe-présent") return { key: "nonfinite", row: 2 };
  if (tense === "participe-passé") return { key: "nonfinite", row: 3 };
  return { key: `${mood}:${tense}`, row: pnRow(pn, mood === "imperatif") };
}
