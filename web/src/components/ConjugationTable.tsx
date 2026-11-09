import { useState } from "react";
import { cellFor, conjugationTables } from "../grammar/conjugate";
import type { Verbs } from "../types";

interface Props {
  lemma: string;
  verbs: Verbs;
  reflexive: boolean;
  reading?: string;
  compound?: string;
  auxReading?: string;
}

/** One mood at a time, opening on the mood of the form being looked at. */
export function ConjugationTable({ lemma, verbs, reflexive, reading, compound, auxReading }: Props) {
  const moods = conjugationTables(lemma, verbs, reflexive);
  const cell = cellFor(reading, compound, auxReading);
  const current = moods.find((m) => m.tenses.some((t) => t.key === cell?.key))?.mood;
  const [picked, setPicked] = useState<string>();
  if (!moods.length) return <p className="muted">No conjugation table for « {lemma} ».</p>;
  const shown = moods.find((m) => m.mood === (picked ?? current)) ?? moods[0];
  return (
    <div className="conj">
      <div className="moods" role="tablist">
        {moods.map((m) => (
          <button
            key={m.mood}
            role="tab"
            aria-selected={m === shown}
            className={(m === shown ? "on" : "") + (m.mood === current ? " has-current" : "")}
            onClick={() => setPicked(m.mood)}
          >
            {m.mood}
          </button>
        ))}
      </div>
      <div className="conj-grid">
        {shown.tenses.map((t) => (
          <table key={t.key} className={cell?.key === t.key ? "current" : undefined}>
            <caption>{t.name}</caption>
            <tbody>
              {t.rows.map((r, i) => (
                <tr key={i} className={cell?.key === t.key && cell.row === i ? "here" : undefined}>
                  <td className="pron">{r.pronoun}</td>
                  <td>{r.form || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
