// Audiobook playback for the open chapter: one <audio> element whose source
// follows the chapter, plus the word being read, found from word timings.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audioUrl } from "./data";
import type { ChapterAudio } from "./types";

export interface Spoken {
  pkey: string;
  index: number;
}

interface Cue extends Spoken {
  t: number;
}

const RATES = [0.75, 0.9, 1, 1.25, 1.5];
const RATE_KEY = "lpp.rate";

function cues(audio?: ChapterAudio): Cue[] {
  if (!audio) return [];
  const out: Cue[] = [];
  for (const [pkey, words] of Object.entries(audio.words)) {
    for (const [index, t] of words) out.push({ pkey, index, t });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Last cue starting at or before t. */
function cueAt(list: Cue[], t: number): Cue | undefined {
  let lo = 0;
  let hi = list.length - 1;
  let found: Cue | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].t <= t) {
      found = list[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export interface Player {
  ref: React.RefObject<HTMLAudioElement | null>;
  available: boolean;
  /** The chapter's audio failed to load (offline and not saved). */
  failed: boolean;
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  spoken: Spoken | null;
  toggle: () => void;
  seek: (t: number) => void;
  /** Start playing at a French word. */
  playFrom: (pkey: string, index: number) => void;
  /** Jump to the start of the previous / next paragraph. */
  skipParagraph: (dir: -1 | 1) => void;
  cycleRate: () => void;
}

/**
 * @param onEnded called when a chapter finishes; return true if playback
 * should continue (the next chapter has been opened).
 */
export function usePlayer(chapterId: string | undefined, audio: ChapterAudio | undefined, onEnded: () => boolean): Player {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(() => {
    try {
      return Number(localStorage.getItem(RATE_KEY)) || 1;
    } catch {
      return 1;
    }
  });
  const [spoken, setSpoken] = useState<Spoken | null>(null);
  const [failed, setFailed] = useState(false);
  const list = useMemo(() => cues(audio), [audio]);
  // Set when the source changes: where to start and whether to play.
  const pending = useRef<{ t: number; play: boolean } | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // New chapter: load its file, keep playing if we were.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!audio) {
      el.removeAttribute("src");
      el.load();
      setSpoken(null);
      setTime(0);
      return;
    }
    setFailed(false);
    // Set by onEnded when moving on to the next chapter; otherwise start paused.
    pending.current ??= { t: 0, play: false };
    el.src = audioUrl(audio.src);
    el.playbackRate = rate;
    setTime(0);
    setSpoken(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, audio]);

  // Back online after a failed load: try the file again.
  useEffect(() => {
    if (!failed) return;
    const retry = () => {
      setFailed(false);
      ref.current?.load();
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [failed]);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
    try {
      localStorage.setItem(RATE_KEY, String(rate));
    } catch {
      /* private mode */
    }
  }, [rate]);

  // Track the word being read; only re-render when it changes.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last: Cue | undefined;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const c = cueAt(list, el.currentTime + 0.05);
        if (c !== last) {
          last = c;
          setSpoken(c ? { pkey: c.pkey, index: c.index } : null);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, list]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => setTime(el.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => {
      const p = pending.current;
      pending.current = null;
      if (!p) return;
      el.currentTime = p.t;
      if (p.play) void el.play().catch(() => setPlaying(false));
    };
    const onError = () => {
      if (el.getAttribute("src")) {
        setFailed(true);
        setPlaying(false);
      }
    };
    const onEnd = () => {
      setPlaying(false);
      if (onEndedRef.current()) pending.current = { t: 0, play: true };
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("error", onError);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, []);

  const seek = useCallback((t: number) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(t, el.duration || t));
    setTime(el.currentTime);
    const c = cueAt(list, el.currentTime + 0.05);
    setSpoken(c ? { pkey: c.pkey, index: c.index } : null);
  }, [list]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el || !audio) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [audio]);

  const playFrom = useCallback((pkey: string, index: number) => {
    const el = ref.current;
    const words = audio?.words[pkey];
    if (!el || !words) return;
    // The word itself may have no timing (punctuation): take the nearest before it.
    const hit = [...words].reverse().find(([i]) => i <= index) ?? words[0];
    seek(Math.max(0, hit[1] - 0.15));
    void el.play().catch(() => setPlaying(false));
  }, [audio, seek]);

  const skipParagraph = useCallback((dir: -1 | 1) => {
    const el = ref.current;
    if (!el || !list.length) return;
    const starts = Object.values(audio!.words).map((w) => w[0][1]).sort((a, b) => a - b);
    const now = el.currentTime;
    // Back: to the start of this paragraph, or the previous one if just past its start.
    const target = dir > 0 ? starts.find((s) => s > now + 0.3) : [...starts].reverse().find((s) => s < now - 1.5);
    if (target !== undefined) seek(Math.max(0, target - 0.15));
    else if (dir < 0) seek(0);
  }, [audio, list, seek]);

  const cycleRate = useCallback(() => setRate((r) => RATES[(RATES.indexOf(r) + 1) % RATES.length] ?? 1), []);

  return {
    ref,
    available: !!audio,
    failed,
    playing,
    time,
    duration: audio?.duration ?? 0,
    rate,
    spoken,
    toggle,
    seek,
    playFrom,
    skipParagraph,
    cycleRate,
  };
}
