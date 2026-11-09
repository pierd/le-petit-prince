// Saving the whole book (data, images, audio) for offline use, on request.
// public/offline.json lists the files and their sizes; they go into
// OFFLINE_CACHE, which the service worker (sw.ts) answers from.

import { OFFLINE_CACHE } from "./offlineCache";

export interface OfflineFile {
  url: string;
  bytes: number;
}

export interface OfflineStatus {
  total: number;
  saved: number;
  missing: OfflineFile[];
}

const abs = (url: string) => new URL(import.meta.env.BASE_URL + url, location.href).href;

async function manifest(): Promise<{ total: number; files: OfflineFile[] }> {
  const r = await fetch(abs("offline.json"), { cache: "no-cache" });
  if (!r.ok) throw new Error(`offline.json: ${r.status}`);
  return r.json();
}

export const offlineSupported = () => "caches" in window && "serviceWorker" in navigator;

export async function offlineStatus(): Promise<OfflineStatus> {
  const { total, files } = await manifest();
  const cache = await caches.open(OFFLINE_CACHE);
  const missing: OfflineFile[] = [];
  for (const f of files) if (!(await cache.match(abs(f.url), { ignoreVary: true }))) missing.push(f);
  return { total, saved: total - missing.reduce((n, f) => n + f.bytes, 0), missing };
}

/** Download what is missing, reporting bytes done; drops audio of older versions. */
export async function saveOffline(onProgress: (done: number, total: number) => void, signal: AbortSignal) {
  await navigator.storage?.persist?.().catch(() => false);
  const { files } = await manifest();
  const { missing } = await offlineStatus();
  const cache = await caches.open(OFFLINE_CACHE);
  const total = missing.reduce((n, f) => n + f.bytes, 0);
  let done = 0;
  const queue = [...missing];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const r = await fetch(abs(f.url), { cache: "no-cache", signal });
      if (!r.ok) throw new Error(`${f.url}: ${r.status}`);
      await cache.put(abs(f.url), r);
      done += f.bytes;
      onProgress(done, total);
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  window.dispatchEvent(new Event(OFFLINE_SAVED_EVENT));

  const wanted = new Set(files.map((f) => abs(f.url)));
  for (const req of await cache.keys()) {
    if (req.url.includes("/audio/") && !wanted.has(req.url)) await cache.delete(req);
  }
}

export const removeOffline = () => caches.delete(OFFLINE_CACHE);

/** Dispatched on window when a download finishes, so the player can switch to the saved audio. */
export const OFFLINE_SAVED_EVENT = "lpp:offline-saved";

/**
 * A saved file's contents, or null if it isn't saved. The player plays saved
 * audio from this (as a blob: URL) rather than through the service worker:
 * iOS loads <audio> through its media stack, which bypasses the service
 * worker, so in flight mode the saved copy was never used.
 */
export async function savedBlob(url: string, type: string): Promise<Blob | null> {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    const r = await cache.match(new URL(url, location.href).href, { ignoreVary: true });
    if (!r) return null;
    // A typed blob: iOS won't play one without a media type.
    return new Blob([await r.arrayBuffer()], { type });
  } catch {
    return null;
  }
}
