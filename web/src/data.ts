import { useEffect, useState } from "react";
import type { Chapter, Lexicon, TocEntry, Verbs } from "./types";

const base = `${import.meta.env.BASE_URL}data/`;
const cache = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(base + path).then((r) => {
        if (!r.ok) throw new Error(`${path}: ${r.status}`);
        return r.json();
      }),
    );
  }
  return cache.get(path) as Promise<T>;
}

export const loadToc = () => load<TocEntry[]>("toc.json");
export const loadChapter = (id: string) => load<Chapter>(`chapters/${id}.json`);
export const loadVerbs = () => load<Verbs>("verbs.json");
export const loadLexicon = () => load<Lexicon>("lexicon.json");

/** The resolved value of a loader, or undefined while it is pending. */
export function useData<T>(loader: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<{ deps: unknown[]; v: T }>();
  useEffect(() => {
    let live = true;
    loader().then((v) => live && setValue({ deps, v }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value && value.deps.every((d, i) => d === deps[i]) ? value.v : undefined;
}

export const imageUrl = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;
