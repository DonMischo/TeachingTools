"use client";
/**
 * Herleitung der Flächenformel als Trickfilm — Abspielen, Anhalten,
 * schrittweise vor und zurück, Tempo-Regler und Zeitleiste zum Ziehen.
 * Die Geometrie steckt in `lib/herleitung.ts`, hier wird nur gezeichnet.
 */
import { useEffect, useMemo, useState } from "react";
import { filmBounds, herleitung, kamera, starts, total, type Kind } from "@/lib/herleitung";
import type { ShapeKey, Vals } from "@/lib/vierecke";

const S = 48; // Pixel je Einheit
const RAND = 1.1; // Einheiten Luft um den Film

const FARBE: Record<Kind, string> = {
  orig: "var(--accent)",
  copy: "#0ea5e9",
  outer: "#f43f5e",
};
const HOEHE = "#f59e0b";

export default function Herleitung({ shapeKey, vals }: { shapeKey: ShapeKey; vals: Vals }) {
  const H = useMemo(() => herleitung(shapeKey, vals), [shapeKey, vals]);
  const T = H ? total(H.steps) : 0;
  const at = useMemo(() => (H ? starts(H.steps) : []), [H]);
  const box = useMemo(() => (H ? filmBounds(H) : null), [H]);
  const cam = useMemo(() => (H ? kamera(H) : null), [H]);

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.75);

  // Neue Form oder neue Maße → der Film beginnt von vorn.
  useEffect(() => { setT(0); setPlaying(false); }, [H]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now(), id = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT(x => {
        const n = Math.min(T, x + dt * speed);
        if (n >= T) setPlaying(false);
        return n;
      });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, speed, T]);

  if (!H || !box || !cam) return null;

  const step = Math.max(0, at.findLastIndex(s => s <= t + 1e-6));
  const f = H.frame(t);
  // Die Bühne hat das Format des ganzen Films; die Kamera zoomt darin auf
  // den Ausschnitt des Schritts (höchstens doppelt so groß).
  const w = (box.width + 2 * RAND) * S, h = (box.height + 2 * RAND) * S;
  const c = cam(t);
  const k = Math.min(w / (c.width + 2 * RAND), h / (c.height + 2 * RAND), 2 * S);
  const X = (x: number) => w / 2 + (x - c.minX - c.width / 2) * k;
  const Y = (y: number) => h / 2 + (y - c.minY - c.height / 2) * k;

  const play = () => {
    if (t >= T) setT(0);
    setPlaying(p => !p);
  };
  const jump = (i: number) => {
    setPlaying(false);
    setT(i >= at.length ? T : at[Math.max(0, i)]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-bold uppercase tracking-wide text-muted">Herleitung der Formel</div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto max-h-[55vh]" role="img"
        aria-label={`Herleitung, Schritt ${step + 1}: ${H.steps[step].text}`}>
        {f.pieces.map((p, i) => p.alpha > 0 && (
          <polygon key={i}
            points={p.pts.map(q => `${X(q.x)},${Y(q.y)}`).join(" ")}
            fill={FARBE[p.kind]} fillOpacity={0.3 * p.alpha}
            stroke={FARBE[p.kind]} strokeOpacity={p.alpha} strokeWidth={3} strokeLinejoin="round"
          />
        ))}
        {f.lines.map((l, i) => l.alpha > 0 && (
          <line key={i} x1={X(l.a.x)} y1={Y(l.a.y)} x2={X(l.b.x)} y2={Y(l.b.y)} opacity={l.alpha}
            stroke={l.kind === "hoehe" || l.kind === "diag" ? HOEHE : l.kind === "ziel" ? "#22c55e" : "var(--text-muted)"}
            strokeWidth={l.kind === "ziel" ? 4 : 2.5}
            strokeDasharray={l.kind === "ziel" ? undefined : "7 5"}
          />
        ))}
        {f.labels.map((l, i) => l.alpha > 0 && (
          <text key={i} x={X(l.at.x)} y={Y(l.at.y)} opacity={l.alpha}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={l.kind === "formel" ? 26 : 22} fontWeight={800}
            fontStyle={l.kind === "formel" ? "normal" : "italic"}
            fill={l.kind === "hoehe" ? HOEHE : l.kind === "formel" ? "#22c55e" : "var(--text)"}>
            {l.text}
          </text>
        ))}
      </svg>

      <p className="text-base font-semibold min-h-[3em]">
        <span className="text-muted mr-2">{step + 1}/{H.steps.length}</span>
        {H.steps[step].text}
      </p>

      <input type="range" min={0} max={T} step={0.01} value={t} aria-label="Zeitleiste"
        onChange={e => { setPlaying(false); setT(Number(e.target.value)); }}
        className="accent-accent w-full" />

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => jump(step - (t - at[step] < 0.5 ? 1 : 0))}
          aria-label="Schritt zurück">⏮</button>
        <button className="btn-primary min-w-28" onClick={play}>
          {playing ? "⏸ Pause" : t >= T ? "↺ Nochmal" : "▶ Abspielen"}
        </button>
        <button className="btn" onClick={() => jump(step + 1)} aria-label="Schritt vor">⏭</button>
        <label className="flex items-center gap-2 text-sm ml-auto">
          <span className="text-muted">🐢</span>
          <input type="range" min={0.25} max={2} step={0.25} value={speed} aria-label="Tempo"
            onChange={e => setSpeed(Number(e.target.value))} className="accent-accent w-32" />
          <span className="text-muted">🐇</span>
          <span className="font-mono w-12 text-right">{speed}×</span>
        </label>
      </div>
    </div>
  );
}
