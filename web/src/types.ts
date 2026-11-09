// Shapes of the JSON written by tools/annotate.py into public/data/.

export interface Compound {
  /** Name of the compound tense, e.g. "passé composé". */
  n: string;
  /** Token indices (auxiliary, participle) forming it. */
  w: number[];
  /** Index of the auxiliary. */
  aux: number;
  /** Set when être + participle is a passive rather than a compound tense. */
  pass?: 1;
}

export interface Token {
  /** Text. */
  t: string;
  /** Trailing whitespace. */
  s?: string;
  /** Lemma (absent on punctuation). */
  l?: string;
  /** Universal POS tag. */
  p?: string;
  /** Universal morphological features, "Gender=Fem|Number=Plur". */
  f?: string;
  /** Indices of the Spanish tokens this French token is aligned with (French only). */
  a?: number[];
  /** Verb readings "mood:tense:pn", best first (French only). */
  v?: string[];
  /** Verb used pronominally ("se souvenir"). */
  r?: 1;
  /** Compound tense this token is part of. */
  c?: Compound;
}

export interface Paragraph {
  type: "p";
  key: string;
  fr: Token[];
  es: Token[];
}

export interface Image {
  type: "img";
  src: string;
  w: number;
  h: number;
}

export interface Chapter {
  id: string;
  fr: string;
  es: string;
  blocks: (Paragraph | Image)[];
}

export interface TocEntry {
  id: string;
  fr: string;
  es: string;
}

export interface Verb {
  aux: "avoir" | "être";
  /** Past participle: ms, mp, fs, fp. */
  pp: string[];
  /** Present participle. */
  ppr: string;
  /** "mood:tense" -> six forms (je..ils), or three for the imperative (tu, nous, vous). */
  t: Record<string, string[]>;
}

export type Verbs = Record<string, Verb>;

/** "lemma|POS" -> [[spanish lemma, count], ...]. */
export type Lexicon = Record<string, [string, number][]>;

export type Lang = "fr" | "es";
