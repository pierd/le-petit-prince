import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { loadLexicon, loadVerbs, useData } from "../data";
import { describeFrench, describeSpanish } from "../grammar/describe";
import type { Paragraph } from "../types";
import { ConjugationTable } from "./ConjugationTable";
import { linked, textOf } from "../align";
import type { Selection } from "./ParagraphView";

interface Props {
  para: Paragraph;
  sel: Selection;
  onClose: () => void;
}

const CONJ_KEY = "lpp.showConjugation";

function usePosition(rect: DOMRect, ref: React.RefObject<HTMLDivElement | null>) {
  const [pos, setPos] = useState<{ left: number; top: number }>();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const margin = 8;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - w - margin));
    const below = rect.bottom + 6;
    const top = below + h > window.innerHeight - margin && rect.top - h - 6 > margin ? rect.top - h - 6 : below;
    setPos({ left: left + window.scrollX, top: top + window.scrollY });
  }, [rect, ref]);
  return pos;
}

export function WordPopup({ para, sel, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const verbs = useData(loadVerbs, []);
  const lexicon = useData(loadLexicon, []);
  const [showConj, setShowConj] = useState(() => {
    try {
      return localStorage.getItem(CONJ_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const pos = usePosition(sel.rect, ref);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest("[data-i]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const toggleConj = () => {
    setShowConj(!showConj);
    try {
      localStorage.setItem(CONJ_KEY, showConj ? "0" : "1");
    } catch {
      /* private mode */
    }
  };

  const tokens = para[sel.lang];
  const other = sel.lang === "fr" ? "es" : "fr";
  const tok = tokens[sel.index];
  const links = linked(para, sel.lang, sel.index);
  const here = textOf(para[other], links[other]);
  const phrase = textOf(tokens, links[sel.lang]);

  if (sel.lang === "es") {
    const d = describeSpanish(tok);
    return (
      <div ref={ref} className="popup" style={pos ?? { visibility: "hidden" }} role="dialog">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="head">
          <span className="word" lang="es">{tok.t}</span>
          {tok.l && tok.l !== tok.t.toLowerCase() && <span className="lemma"> → {tok.l}</span>}
        </div>
        <div className="kind">{d.kind}</div>
        {here && (
          <p className="tr">
            <span className="label">French</span> <span lang="fr">{here}</span>
          </p>
        )}
      </div>
    );
  }

  const d = describeFrench(tok, tokens);
  // An auxiliary in a compound tense shows the table of the main verb.
  const compound = tok.c && !tok.c.pass ? tok.c : undefined;
  const main = compound ? tokens[compound.w[compound.w.length - 1]] : tok;
  const isVerb = !!tok.v?.length && !!main.l && !!verbs?.[main.l];
  const pronominal = (t: typeof tok) => (t.r && t.l ? `se ${t.l}`.replace(/^se ([aeiouéèêh])/i, "s'$1") : t.l);
  const lemmaLabel = pronominal(tok);
  const lexKey = `${tok.l}|${tok.p === "AUX" ? "VERB" : tok.p}`;
  const usual = (lexicon?.[lexKey] ?? []).map(([w]) => w).filter((w) => w !== here.toLowerCase());

  return (
    <div ref={ref} className={"popup" + (isVerb && showConj ? " wide" : "")} style={pos ?? { visibility: "hidden" }} role="dialog">
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      <div className="head">
        <span className="word" lang="fr">{tok.t}</span>
        {lemmaLabel && lemmaLabel !== tok.t.toLowerCase() && <span className="lemma"> → {lemmaLabel}</span>}
      </div>
      <div className="kind">{d.kind}</div>
      <div className="tr">
        {here && (
          <p>
            <span className="label">Here</span>{" "}
            {phrase && phrase !== tok.t && <span lang="fr" className="muted">{phrase} = </span>}
            <span lang="es">{here}</span>
          </p>
        )}
        {d.es && (
          <p>
            <span className="label">Spanish</span> <span lang="es">{d.es}</span>
          </p>
        )}
        {!d.es && usual.length > 0 && (
          <p>
            <span className="label">Usually</span> <span lang="es">{usual.join(", ")}</span>
          </p>
        )}
      </div>
      {d.notes.length > 0 && (
        <ul className="notes">
          {d.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {isVerb && (
        <div className="conj-wrap">
          <button className="link" onClick={toggleConj}>
            {showConj ? "▾" : "▸"} Conjugation of {pronominal(main)}
          </button>
          {showConj && (
            <ConjugationTable
              lemma={main.l!}
              verbs={verbs!}
              reflexive={!!main.r}
              reading={main.v?.[0]}
              compound={compound?.n}
              auxReading={compound ? tokens[compound.aux].v?.[0] : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}
