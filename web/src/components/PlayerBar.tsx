import type { Player } from "../usePlayer";

const fmt = (t: number) => {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

interface Props {
  player: Player;
  follow: boolean;
  onFollow: (v: boolean) => void;
}

export function PlayerBar({ player: p, follow, onFollow }: Props) {
  if (!p.available) return null;
  return (
    <div className="player" role="region" aria-label="Audiobook">
      <button className="icon" onClick={() => p.skipParagraph(-1)} aria-label="Previous paragraph" title="Previous paragraph">
        ⏮
      </button>
      <button className="icon play" onClick={p.toggle} aria-label={p.playing ? "Pause" : "Play"} title={p.playing ? "Pause (space)" : "Play (space)"}>
        {p.playing ? "❚❚" : "▶"}
      </button>
      <button className="icon" onClick={() => p.skipParagraph(1)} aria-label="Next paragraph" title="Next paragraph">
        ⏭
      </button>
      <span className="time">{fmt(p.time)}</span>
      <input
        type="range"
        className="scrub"
        min={0}
        max={p.duration || 1}
        step={0.1}
        value={p.time}
        onChange={(e) => p.seek(Number(e.target.value))}
        aria-label="Position"
        style={{ "--pos": `${(p.time / (p.duration || 1)) * 100}%` } as React.CSSProperties}
      />
      <span className="time">{fmt(p.duration)}</span>
      <button className="chip" onClick={p.cycleRate} title="Playback speed" aria-label={`Speed ${p.rate}×`}>
        {p.rate}×
      </button>
      <button
        className={"chip" + (follow ? " on" : "")}
        onClick={() => onFollow(!follow)}
        title="Scroll along with the reading"
        aria-pressed={follow}
      >
        Suivre
      </button>
    </div>
  );
}
