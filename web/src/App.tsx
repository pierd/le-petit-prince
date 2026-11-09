import { useCallback, useEffect, useState } from "react";
import { ParagraphView, type Hint, type Selection } from "./components/ParagraphView";
import { niceTitle, Sidebar } from "./components/Sidebar";
import { WordPopup } from "./components/WordPopup";
import { imageUrl, loadChapter, loadToc, useData } from "./data";
import { useMedia } from "./useMedia";
import type { Paragraph } from "./types";

function useStored(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s === null ? initial : s === "1";
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (x: boolean) => {
      setV(x);
      try {
        localStorage.setItem(key, x ? "1" : "0");
      } catch {
        /* private mode */
      }
    },
    [key],
  );
  return [v, set];
}

const chapterFromHash = () => decodeURIComponent(location.hash.replace(/^#\/?/, ""));

export function App() {
  const toc = useData(loadToc, []);
  const [hash, setHash] = useState(chapterFromHash);
  const [showSpanish, setShowSpanish] = useStored("lpp.showSpanish", false);
  const [sidebarStored, setSidebarOpen] = useStored("lpp.sidebar", true);
  const narrow = useMedia("(max-width: 900px)");
  // On a phone the contents are an overlay: start closed, whatever was stored.
  const [overlayOpen, setOverlayOpen] = useState(false);
  const sidebarOpen = narrow ? overlayOpen : sidebarStored;
  const toggleSidebar = (v: boolean) => (narrow ? setOverlayOpen(v) : setSidebarOpen(v));
  const [sel, setSel] = useState<Selection | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);

  const id = toc?.some((c) => c.id === hash) ? hash : toc?.[0]?.id;
  const chapter = useData(() => (id ? loadChapter(id) : Promise.resolve(undefined)), [id]);
  const index = toc?.findIndex((c) => c.id === id) ?? -1;
  const prev = index > 0 ? toc![index - 1] : undefined;
  const next = toc && index >= 0 && index < toc.length - 1 ? toc[index + 1] : undefined;

  useEffect(() => {
    const onHash = () => {
      setHash(chapterFromHash());
      setSel(null);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft" && prev) location.hash = `/${prev.id}`;
      if (e.key === "ArrowRight" && next) location.hash = `/${next.id}`;
      if (e.key === "s") setShowSpanish(!showSpanish);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, showSpanish, setShowSpanish]);

  useEffect(() => {
    if (chapter) document.title = `${niceTitle(chapter.fr)} · Le Petit Prince`;
  }, [chapter]);

  const closePopup = useCallback(() => setSel(null), []);
  const selPara = sel && chapter?.blocks.find((b): b is Paragraph => b.type === "p" && b.key === sel.pkey);

  return (
    <div className={"app" + (sidebarOpen ? " with-sidebar" : "") + (showSpanish ? " bilingual" : "")}>
      <Sidebar toc={toc ?? []} current={id} open={sidebarOpen} onClose={() => toggleSidebar(false)} />
      <header className="topbar">
        <button className="icon" onClick={() => toggleSidebar(!sidebarOpen)} aria-label="Table of contents" title="Table of contents">
          ☰
        </button>
        <nav className="chapter-nav" aria-label="Chapter">
          <a className={"icon" + (prev ? "" : " disabled")} href={prev ? `#/${prev.id}` : undefined} aria-label="Previous chapter" title="Previous chapter (←)">
            ‹
          </a>
          <span className="current-title">{chapter ? niceTitle(chapter.fr) : ""}</span>
          <a className={"icon" + (next ? "" : " disabled")} href={next ? `#/${next.id}` : undefined} aria-label="Next chapter" title="Next chapter (→)">
            ›
          </a>
        </nav>
        <label className="toggle" title="Show the Spanish translation (S)">
          <input type="checkbox" checked={showSpanish} onChange={(e) => setShowSpanish(e.target.checked)} />
          <span className="track" />
          Español
        </label>
      </header>

      <main>
        {chapter ? (
          <article>
            <h1 className="pair-title">
              <span lang="fr">{niceTitle(chapter.fr)}</span>
              {showSpanish && <span lang="es" className="es">{niceTitle(chapter.es)}</span>}
            </h1>
            {chapter.blocks.map((b, i) =>
              b.type === "img" ? (
                <figure key={i}>
                  <img src={imageUrl(b.src)} width={b.w} height={b.h} alt="" loading="lazy" />
                </figure>
              ) : (
                <ParagraphView
                  key={b.key}
                  para={b}
                  showSpanish={showSpanish}
                  selected={sel?.pkey === b.key ? sel : undefined}
                  onSelect={setSel}
                  onHint={setHint}
                />
              ),
            )}
            <nav className="pager">
              {prev ? <a href={`#/${prev.id}`}>← {niceTitle(prev.fr)}</a> : <span />}
              {next ? <a href={`#/${next.id}`}>{niceTitle(next.fr)} →</a> : <span />}
            </nav>
          </article>
        ) : (
          <p className="loading">Chargement…</p>
        )}
      </main>

      {hint && !sel && (
        <div className="hint" style={{ left: hint.rect.left + hint.rect.width / 2, top: hint.rect.top }} lang="es">
          {hint.text}
        </div>
      )}
      {sel && selPara && <WordPopup key={`${sel.pkey}:${sel.lang}:${sel.index}`} para={selPara} sel={sel} onClose={closePopup} />}
    </div>
  );
}
