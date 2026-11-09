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

export function ConjugationTable({ lemma, verbs, reflexive, reading, compound, auxReading }: Props) {
  const moods = conjugationTables(lemma, verbs, reflexive);
  if (!moods.length) return <p className="muted">No conjugation table for « {lemma} ».</p>;
  const cell = cellFor(reading, compound, auxReading);
  return (
    <div className="conj">
      {moods.map((m) => (
        <section key={m.mood}>
          <h4>{m.mood}</h4>
          <div className="conj-grid">
            {m.tenses.map((t) => (
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
        </section>
      ))}
    </div>
  );
}
