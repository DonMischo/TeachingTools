"use client";
/** Gemeinsame Bausteine der Stationen von »Druck & Strömung«. */
import { useEffect, useRef, useState, type ReactNode } from "react";

export const zahl = (x: number, stellen = 2) =>
  Math.abs(x) < 0.0005 ? "0" : x.toLocaleString("de-DE", { maximumFractionDigits: Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? Math.min(1, stellen) : stellen });
/** Druck in Pa als bar. */
export const bar = (pa: number, stellen = 2) => `${zahl(pa / 1e5, stellen)} bar`;

export const WASSER = (hell = 0.5) => `hsl(205 80% ${Math.round(70 - 30 * hell)}%)`;
export const text = { fill: "var(--text)" } as const;
export const muted = { fill: "var(--text-muted)" } as const;

/** Bild links, Bedienung rechts; darüber Versuche und Leitfrage. */
export function StationRahmen({ versuche, bild, seite, unten }: {
  versuche?: { name: string; idee: string; los: () => void }[];
  bild: ReactNode; seite: ReactNode; unten?: ReactNode;
}) {
  const [idee, setIdee] = useState<string | null>(versuche?.[0]?.idee ?? null);
  return (
    <div className="flex flex-col gap-4">
      {versuche && (
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" value="" aria-label="Versuch wählen"
            onChange={e => { const v = versuche.find(x => x.name === e.target.value); if (v) { v.los(); setIdee(v.idee); } }}>
            <option value="">🧪 Versuch …</option>
            {versuche.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
          {idee && <span className="text-sm text-muted">💡 {idee}</span>}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card p-2 min-w-0">{bild}</div>
        <div className="flex flex-col gap-4 text-sm">{seite}</div>
      </div>
      {unten}
    </div>
  );
}

export function Karte({ titel, children }: { titel?: string; children: ReactNode }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      {titel && <div className="font-bold">{titel}</div>}
      {children}
    </div>
  );
}

export function Regler({ label, min, max, step, wert, setze }: { label: ReactNode; min: number; max: number; step: number; wert: number; setze: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={wert} onChange={e => setze(Number(e.target.value))} />
    </label>
  );
}

export function Wahl<T extends string>({ werte, wert, setze }: { werte: { id: T; label: string }[]; wert: T; setze: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
      {werte.map(w => (
        <button key={w.id} onClick={() => setze(w.id)}
          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${w.id === wert ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
          {w.label}
        </button>
      ))}
    </div>
  );
}

export function Werte({ zeilen }: { zeilen: [ReactNode, ReactNode][] }) {
  return (
    <table className="w-full">
      <tbody className="[&_td]:py-1">
        {zeilen.map(([a, b], i) => <tr key={i}><td className="text-muted pr-2">{a}</td><td className="font-bold text-right">{b}</td></tr>)}
      </tbody>
    </table>
  );
}

/** Wert auf einer Pille im SVG — in hellem und dunklem Schema lesbar. */
export function Pille({ x, y, t, gross = false, farbe = "#e0a000" }: { x: number; y: number; t: string; gross?: boolean; farbe?: string }) {
  const fs = gross ? 16 : 14;
  const w = t.length * fs * 0.56 + 16;
  return (
    <g>
      <rect x={x - w / 2} y={y - fs + 1} width={w} height={fs + 8} rx={(fs + 8) / 2} style={{ fill: "var(--surface)" }} stroke={farbe} strokeWidth={1.5} />
      <text x={x} y={y + 3} textAnchor="middle" fontSize={fs} fontWeight={700} style={text}>{t}</text>
    </g>
  );
}

/** Ruft `schritt(dt)` jedes Bild auf (dt in s, höchstens 0,05) und zeichnet danach neu. */
export function useTakt(schritt: (dt: number) => void, laufend = true) {
  const ref = useRef(schritt);
  ref.current = schritt;
  const [, setNr] = useState(0);
  useEffect(() => {
    if (!laufend) return;
    let vorher = performance.now(), id = 0;
    const los = (jetzt: number) => {
      ref.current(Math.min(0.05, (jetzt - vorher) / 1000));
      vorher = jetzt;
      setNr(n => (n + 1) % 1e6);
      id = requestAnimationFrame(los);
    };
    id = requestAnimationFrame(los);
    return () => cancelAnimationFrame(id);
  }, [laufend]);
}

/** Hinweis, wo die Analogie zum Stromkreis trägt und wo nicht. */
export function Analogie({ children }: { children: ReactNode }) {
  return <div className="card p-3 text-sm border-l-4" style={{ borderLeftColor: "#e0a000" }}>⚡ <b>Und im Stromkreis?</b> {children}</div>;
}
