import { memo, useState, type MouseEvent } from "react";
import { linked, textOf, type Linked } from "../align";
import type { Lang, Paragraph, Token } from "../types";

const canHover = window.matchMedia("(hover: hover)");

export interface Selection {
  pkey: string;
  lang: Lang;
  index: number;
  rect: DOMRect;
}

export interface Hint {
  text: string;
  rect: DOMRect;
}

interface Props {
  para: Paragraph;
  showSpanish: boolean;
  /** Index of the selected token, if the selection is in this paragraph. */
  selected?: { lang: Lang; index: number };
  onSelect: (s: Selection) => void;
  onHint: (h: Hint | null) => void;
  /** Index of the French word being read aloud, if it is in this paragraph. */
  spoken?: number;
}

function target(e: MouseEvent): { lang: Lang; index: number; el: HTMLElement } | null {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
  if (!el) return null;
  return { lang: el.dataset.lang as Lang, index: Number(el.dataset.i), el };
}

function Tokens({ tokens, lang, lit, selected, spoken }: { tokens: Token[]; lang: Lang; lit?: Set<number>; selected?: number; spoken?: number }) {
  return (
    <>
      {tokens.map((t, i) =>
        t.l === undefined ? (
          t.t + (t.s ?? "")
        ) : (
          <span key={i}>
            <span
              data-i={i}
              data-lang={lang}
              className={"w" + (lit?.has(i) ? " hl" : "") + (selected === i ? " sel" : "") + (spoken === i ? " cur" : "")}
            >
              {t.t}
            </span>
            {t.s}
          </span>
        ),
      )}
    </>
  );
}

export const ParagraphView = memo(function ParagraphView({ para, showSpanish, selected, onSelect, onHint, spoken }: Props) {
  const [lit, setLit] = useState<Linked | null>(null);

  const over = (e: MouseEvent) => {
    const t = target(e);
    if (!t) return;
    const l = linked(para, t.lang, t.index);
    setLit(l);
    // No tooltip on touch screens: a tap opens the popup, which shows the translation.
    if (!showSpanish && t.lang === "fr" && l.es.size && canHover.matches) {
      onHint({ text: textOf(para.es, l.es), rect: t.el.getBoundingClientRect() });
    }
  };
  const out = (e: MouseEvent) => {
    if (!target(e)) return;
    setLit(null);
    onHint(null);
  };
  const click = (e: MouseEvent) => {
    const t = target(e);
    if (!t) return;
    onHint(null);
    onSelect({ pkey: para.key, lang: t.lang, index: t.index, rect: t.el.getBoundingClientRect() });
  };

  const sel = (lang: Lang) => (selected?.lang === lang ? selected.index : undefined);
  return (
    <div
      className={(showSpanish ? "pair" : "single") + (spoken !== undefined ? " speaking" : "")}
      data-p={para.key}
      onMouseOver={over}
      onMouseOut={out}
      onClick={click}
    >
      <p lang="fr" className="fr">
        <Tokens tokens={para.fr} lang="fr" lit={lit?.fr} selected={sel("fr")} spoken={spoken} />
      </p>
      {showSpanish && (
        <p lang="es" className="es">
          <Tokens tokens={para.es} lang="es" lit={lit?.es} selected={sel("es")} />
        </p>
      )}
    </div>
  );
});
