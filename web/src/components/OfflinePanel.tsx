import { useEffect, useRef, useState } from "react";
import { offlineStatus, offlineSupported, removeOffline, saveOffline, type OfflineStatus } from "../offline";

const mb = (bytes: number) => `${Math.max(0.1, bytes / 1e6).toFixed(bytes < 1e7 ? 1 : 0)} Mo`;

type State =
  | { kind: "checking" }
  | { kind: "idle"; status: OfflineStatus }
  | { kind: "saving"; done: number; total: number }
  | { kind: "error"; message: string };

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Install the app and save the whole book (text, images, audio) for offline reading. */
export function OfflinePanel() {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const abort = useRef<AbortController | null>(null);

  const refresh = () =>
    offlineStatus()
      .then((status) => setState({ kind: "idle", status }))
      .catch(() => setState({ kind: "error", message: "État hors ligne indisponible." }));

  useEffect(() => {
    if (offlineSupported()) void refresh();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!offlineSupported()) return null;

  const save = async () => {
    abort.current = new AbortController();
    setState({ kind: "saving", done: 0, total: 1 });
    try {
      await saveOffline((done, total) => setState({ kind: "saving", done, total }), abort.current.signal);
      await refresh();
    } catch (e) {
      if (abort.current.signal.aborted) await refresh();
      else setState({ kind: "error", message: navigator.onLine ? "Le téléchargement a échoué." : "Pas de connexion." });
    }
  };
  const remove = async () => {
    if (!confirm("Supprimer les données hors ligne (texte, images et audio) ?")) return;
    await removeOffline();
    await refresh();
  };

  let body;
  if (state.kind === "checking") {
    body = <p className="muted">…</p>;
  } else if (state.kind === "saving") {
    const pct = Math.round((state.done / state.total) * 100);
    body = (
      <>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <p className="muted">
          {mb(state.done)} / {mb(state.total)}
          <button className="link small" onClick={() => abort.current?.abort()}>
            Annuler
          </button>
        </p>
      </>
    );
  } else if (state.kind === "error") {
    body = (
      <>
        <p className="muted">{state.message}</p>
        <button className="chip" onClick={save}>
          Réessayer
        </button>
      </>
    );
  } else if (state.status.missing.length === 0) {
    body = (
      <p className="muted">
        ✓ Disponible hors ligne · {mb(state.status.total)}
        <button className="link small" onClick={remove}>
          Supprimer
        </button>
      </p>
    );
  } else {
    const left = state.status.total - state.status.saved;
    body = (
      <>
        <button className="chip save" onClick={save}>
          ↓ Télécharger pour hors ligne · {mb(left)}
        </button>
        <p className="muted">Le texte, les images et l'audio de tous les chapitres.</p>
      </>
    );
  }

  return (
    <section className="offline">
      <h2>Hors ligne</h2>
      {body}
      {install && (
        <button
          className="chip"
          onClick={() => {
            void install.prompt();
            setInstall(null);
          }}
        >
          Installer l'application
        </button>
      )}
      {!install && isIos() && !standalone() && (
        <p className="muted">Pour installer : Partager → Sur l'écran d'accueil.</p>
      )}
    </section>
  );
}
