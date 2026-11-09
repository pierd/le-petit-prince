// Alignment between the French and Spanish tokens of a paragraph. Links are
// stored on the French side only; a phrase is a word plus everything one hop
// away through the links ("J' ai vécu" <-> "viví").

import type { Lang, Paragraph, Token } from "./types";

export interface Linked {
  fr: Set<number>;
  es: Set<number>;
}

export function linked(para: Paragraph, lang: Lang, index: number): Linked {
  const fr = new Set<number>();
  const es = new Set<number>();
  const frOf = (k: number) => para.fr.forEach((t, i) => t.a?.includes(k) && fr.add(i));
  if (lang === "fr") {
    fr.add(index);
    for (const k of para.fr[index].a ?? []) {
      es.add(k);
      frOf(k);
    }
  } else {
    es.add(index);
    frOf(index);
    for (const i of fr) for (const k of para.fr[i].a ?? []) es.add(k);
  }
  return { fr, es };
}

/** Text of a set of tokens in reading order, with "…" over gaps. */
export function textOf(tokens: Token[], indices: Set<number>): string {
  const sorted = [...indices].sort((a, b) => a - b);
  return sorted
    .map((i, n) => {
      const next = sorted[n + 1];
      if (next === undefined) return tokens[i].t;
      if (next === i + 1) return tokens[i].t + (tokens[i].s ?? "");
      return `${tokens[i].t} … `;
    })
    .join("");
}
