import type { TocEntry } from "../types";
import { OfflinePanel } from "./OfflinePanel";

/** "CHAPITRE XII" -> "Chapitre XII", "DEDICACE" -> "Dédicace". */
export function niceTitle(title: string): string {
  if (title === "DEDICACE") return "Dédicace";
  const t = title
    .split(" ")
    .map((w) => (/^[IVXL]+$/.test(w) ? w : w.toLowerCase()))
    .join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface Props {
  toc: TocEntry[];
  current?: string;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ toc, current, open, onClose }: Props) {
  return (
    <>
      <nav className={"sidebar" + (open ? " open" : "")} aria-label="Table des matières" aria-hidden={!open}>
        <div className="sidebar-head">
          <span>
            <span className="book">Le Petit Prince</span>
            Table des matières
          </span>
          <button className="icon" onClick={onClose} aria-label="Collapse" title="Collapse">
            «
          </button>
        </div>
        <ol>
          {toc.map((e) => (
            <li key={e.id}>
              <a
                href={`#/${e.id}`}
                className={e.id === current ? "current" : undefined}
                tabIndex={open ? 0 : -1}
                onClick={() => window.matchMedia("(max-width: 900px)").matches && onClose()}
              >
                {niceTitle(e.fr)}
              </a>
            </li>
          ))}
        </ol>
        <OfflinePanel />
      </nav>
      {open && <div className="scrim" onClick={onClose} />}
    </>
  );
}
