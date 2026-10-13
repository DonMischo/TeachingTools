"use client";
/**
 * Bausteine für »Größen & Zeichen«: Dinge im Zwanzigerfeld, ein Würfel in
 * Schrägansicht, ein beschrifteter Schieberegler und ein Abspielknopf, der
 * einen Zähler hochzählt.
 */
import { useEffect, useState, type ReactNode } from "react";

/** Dinge in Fünferreihen; `weg` = durchgestrichen, `blau` = zweites Häufchen. */
export function Dinge({ n, emoji, x = 0, y = 0, size = 40, weg = 0, blau = 0, spalten = 5 }: {
  n: number; emoji: string; x?: number; y?: number; size?: number;
  /** die letzten `weg` sind durchgestrichen */ weg?: number;
  /** die letzten `blau` sind hinterlegt */ blau?: number;
  spalten?: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: n }, (_, i) => {
        const cx = (i % spalten) * size, cy = Math.floor(i / spalten) * size;
        const gestrichen = i >= n - weg, hinterlegt = i >= n - blau;
        return (
          <g key={i} transform={`translate(${cx} ${cy})`}>
            {hinterlegt && <rect width={size - 2} height={size - 2} rx={8} fill="#38bdf8" opacity={0.22} />}
            <text x={size / 2 - 1} y={size / 2} textAnchor="middle" dominantBaseline="central"
              fontSize={size * 0.78} opacity={gestrichen ? 0.3 : 1}>{emoji}</text>
            {gestrichen && (
              <g stroke="#e11d48" strokeWidth={4} strokeLinecap="round">
                <line x1={6} y1={6} x2={size - 8} y2={size - 8} />
                <line x1={size - 8} y1={6} x2={6} y2={size - 8} />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Breite und Höhe eines Felds aus `Dinge`. */
export const feld = (n: number, size = 40, spalten = 5) => ({
  w: Math.max(1, Math.min(n, spalten)) * size,
  h: Math.max(1, Math.ceil(n / spalten)) * size,
});

const C30 = Math.cos(Math.PI / 6), S30 = 0.5;

/**
 * Quader n × n × hoch in Schrägansicht (Isometrie), Gitter auf den drei
 * sichtbaren Seiten. Mit `rahmen` zusätzlich der ganze Würfel n × n × n
 * gestrichelt — so sieht man, wie weit er schon gefüllt ist.
 */
export function Wuerfel({ n, hoch = n, s, ox, oy, farbe, rahmen = false, gitter = true }: {
  n: number; hoch?: number; s: number; ox: number; oy: number; farbe: string; rahmen?: boolean; gitter?: boolean;
}) {
  const P = (x: number, y: number, z: number) => `${ox + (x - y) * C30 * s},${oy + (x + y) * S30 * s - z * s}`;
  const poly = (pts: [number, number, number][]) => pts.map(p => P(...p)).join(" ");
  const linien: ReactNode[] = [];
  if (gitter && hoch > 0) {
    for (let i = 1; i < n; i++) {
      // Deckel
      linien.push(<polyline key={`ta${i}`} points={poly([[i, 0, hoch], [i, n, hoch]])} />);
      linien.push(<polyline key={`tb${i}`} points={poly([[0, i, hoch], [n, i, hoch]])} />);
      // rechte Seite (x = n) und linke Seite (y = n): senkrechte Linien
      linien.push(<polyline key={`ra${i}`} points={poly([[n, i, 0], [n, i, hoch]])} />);
      linien.push(<polyline key={`la${i}`} points={poly([[i, n, 0], [i, n, hoch]])} />);
    }
    for (let k = 1; k < hoch; k++) {
      linien.push(<polyline key={`rk${k}`} points={poly([[n, 0, k], [n, n, k]])} />);
      linien.push(<polyline key={`lk${k}`} points={poly([[0, n, k], [n, n, k]])} />);
    }
  }
  return (
    <g strokeLinejoin="round">
      {rahmen && (
        <g fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="5 4">
          <polygon points={poly([[0, 0, n], [n, 0, n], [n, n, n], [0, n, n]])} />
          <polyline points={poly([[n, 0, 0], [n, 0, n]])} />
          <polyline points={poly([[0, n, 0], [0, n, n]])} />
          <polyline points={poly([[n, n, 0], [n, n, n]])} />
          <polyline points={poly([[n, 0, 0], [n, n, 0], [0, n, 0]])} />
        </g>
      )}
      {hoch > 0 && (
        <>
          <polygon points={poly([[n, 0, 0], [n, n, 0], [n, n, hoch], [n, 0, hoch]])} fill={farbe} fillOpacity={0.55} />
          <polygon points={poly([[0, n, 0], [n, n, 0], [n, n, hoch], [0, n, hoch]])} fill={farbe} fillOpacity={0.35} />
          <polygon points={poly([[0, 0, hoch], [n, 0, hoch], [n, n, hoch], [0, n, hoch]])} fill={farbe} fillOpacity={0.8} />
          <g stroke="#000" strokeOpacity={0.35} strokeWidth={1} fill="none">{linien}</g>
          <g fill="none" stroke={farbe} strokeWidth={2.5}>
            <polygon points={poly([[n, 0, 0], [n, n, 0], [n, n, hoch], [n, 0, hoch]])} />
            <polygon points={poly([[0, n, 0], [n, n, 0], [n, n, hoch], [0, n, hoch]])} />
            <polygon points={poly([[0, 0, hoch], [n, 0, hoch], [n, n, hoch], [0, n, hoch]])} />
          </g>
        </>
      )}
    </g>
  );
}

/** Ausmaß des Würfels aus `Wuerfel` (für die viewBox): Breite, Höhe, Lage des Ursprungs. */
export function wuerfelMass(n: number, s: number) {
  const w = 2 * n * C30 * s, h = n * s + n * s; // n·s Deckel-Tiefe + n·s Höhe
  return { w, h, ox: w / 2, oy: n * s };
}

export function Regler({ label, wert, setze, min, max, step = 1, breit = false }: {
  label: ReactNode; wert: number; setze: (n: number) => void; min: number; max: number; step?: number; breit?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${breit ? "flex-1 min-w-48" : "min-w-36"}`}>
      <span className="text-xs text-muted">{label} = <strong className="text-fg text-base">{String(wert).replace(".", ",")}</strong></span>
      <input type="range" min={min} max={max} step={step} value={wert} onChange={e => setze(Number(e.target.value))}
        className="accent-accent" />
    </label>
  );
}

/** Zählt beim Abspielen von 0 bis `bis` hoch, ein Schritt je `ms`. */
export function useZaehler(bis: number, ms = 600): [number, (n: number) => void, boolean, () => void] {
  const [n, setN] = useState(bis);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { setN(x => Math.min(x, bis)); }, [bis]);
  useEffect(() => {
    if (!laeuft) return;
    const id = setInterval(() => {
      setN(x => {
        if (x >= bis) { setLaeuft(false); return x; }
        return x + 1;
      });
    }, ms);
    return () => clearInterval(id);
  }, [laeuft, bis, ms]);
  const start = () => {
    if (laeuft) { setLaeuft(false); return; }
    setN(x => (x >= bis ? 0 : x));
    setLaeuft(true);
  };
  return [n, (x: number) => { setLaeuft(false); setN(x); }, laeuft, start];
}

export function AbspielKnopf({ laeuft, start, fertig }: { laeuft: boolean; start: () => void; fertig: boolean }) {
  return (
    <button className="btn-primary min-w-28" onClick={start}>
      {laeuft ? "⏸ Pause" : fertig ? "↺ Nochmal" : "▶ Abspielen"}
    </button>
  );
}
