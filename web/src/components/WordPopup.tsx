import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { loadLexicon, loadVerbs, useData } from "../data";
import { describeFrench, describeSpanish } from "../grammar/describe";
import type { Paragraph } from "../types";
import { ConjugationTable } from "./ConjugationTable";
import { linked, textOf } from "../align";
import type { Selection } from "./ParagraphView";
import { useMedia } from "../useMedia";

interface Props {
  para: Paragraph;
  sel: Selection;
  onClose: () => void;
  /** Start the audiobook at a French word; absent when there is no audio. */
  onPlay?: (pkey: string, index: number) => void;
}

const CONJ_KEY = "lpp.showConjugation";
/** Below this width the popup is a bottom sheet (keep in sync with styles.css). */
export const SHEET_QUERY = "(max-width: 600px)";

function usePosition(rect: DOMRect, ref: React.RefObject<HTMLDivElement | null>, sheet: boolean) {
  const [pos, setPos] = useState<{ left: number; top: number }>();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (sheet) {
      // The sheet covers up to 60% of the screen (it grows once the verb
      // tables load): bring the word above where its top edge can reach.
      const sheetTop = window.innerHeight * 0.4;
      if (rect.bottom > sheetTop - 8 || rect.top < 56) {
        window.scrollBy({ top: rect.top - Math.min(80, sheetTop / 2), behavior: "smooth" });
      }
      setPos({ left: 0, top: 0 });
      return;
    }
    // Next to the word, kept on screen; re-placed when the popup resizes
    // (it widens once the conjugation tables load).
    const place = () => {
      const margin = 8;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - w - margin));
      const below = rect.bottom + 6;
      const top = below + h > window.innerHeight - margin && rect.top - h - 6 > margin ? rect.top - h - 6 : below;
      setPos({ left: left + window.scrollX, top: top + window.scrollY });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rect, ref, sheet]);
  return pos;
}

/** Popup frame: a fixed head and a scrolling body. As a sheet, the head can be swiped down to close. */
function Shell(props: { head: ReactNode; children?: ReactNode; wide?: boolean; sel: Selection; onClose: () => void; innerRef: React.RefObject<HTMLDivElement | null> }) {
  const { head, children, wide, sel, onClose, innerRef } = props;
  const sheet = useMedia(SHEET_QUERY);
  const pos = usePosition(sel.rect, innerRef, sheet);
  const drag = useRef<number | null>(null);

  const move = (e: TouchEvent) => {
    if (drag.current === null || !innerRef.current) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.current);
    innerRef.current.style.transition = "none";
    innerRef.current.style.transform = `translateY(${dy}px)`;
  };
  const end = (e: TouchEvent) => {
    if (drag.current === null || !innerRef.current) return;
    const dy = e.changedTouches[0].clientY - drag.current;
    drag.current = null;
    innerRef.current.style.transition = "";
    if (dy > 80) onClose();
    else innerRef.current.style.transform = "";
  };

  return (
    <div
      ref={innerRef}
      className={"popup" + (wide ? " wide" : "")}
      style={sheet ? (pos ? undefined : { visibility: "hidden" }) : (pos ?? { visibility: "hidden" })}
      role="dialog"
    >
      <div
        className="popup-head"
        onTouchStart={(e) => sheet && (drag.current = e.touches[0].clientY)}
        onTouchMove={move}
        onTouchEnd={end}
      >
        <div className="grip" />
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {head}
      </div>
      {children && <div className="popup-body">{children}</div>}
    </div>
  );
}

export function WordPopup({ para, sel, onClose, onPlay }: Props) {
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
      <Shell
        innerRef={ref}
        sel={sel}
        onClose={onClose}
        head={
          <>
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
          </>
        }
      />
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
    <Shell
      innerRef={ref}
      sel={sel}
      onClose={onClose}
      wide={isVerb && showConj}
      head={
        <>
          <div className="head">
            <span className="word" lang="fr">{tok.t}</span>
            {lemmaLabel && lemmaLabel !== tok.t.toLowerCase() && <span className="lemma"> → {lemmaLabel}</span>}
          </div>
          <div className="kind">{d.kind}</div>
          {onPlay && (
            <button
              className="listen"
              onClick={() => {
                onPlay(sel.pkey, sel.index);
                onClose();
              }}
            >
              ▶ Écouter d'ici
            </button>
          )}
        </>
      }
    >
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
    </Shell>
  );
}
