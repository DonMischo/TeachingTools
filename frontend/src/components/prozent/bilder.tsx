"use client";
/**
 * Bilder für Prozente: Kreis (Tortenstück), Prozentstreifen (zwei Skalen
 * übereinander: oben %, unten der Wert), Hunderterfeld und gezählte Dinge.
 * Über 100 % kommt ein zweiter Kreis bzw. ein zweites Feld dazu.
 */
import type { ReactNode } from "react";
import { Dinge, feld } from "@/components/groessen/bausteine";
import { z } from "@/lib/prozent";

export const FARBE = "#f97316";
export const FARBE2 = "#0ea5e9";
const TEXT = { fill: "var(--text)" } as const;
const MUTED = { fill: "var(--text-muted)" } as const;

/** Tortenstück ab 12 Uhr im Uhrzeigersinn. */
function stueck(cx: number, cy: number, r: number, anteil: number): string {
  if (anteil <= 0) return "";
  if (anteil >= 1) return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  const w = anteil * 2 * Math.PI;
  const x = cx + r * Math.sin(w), y = cy - r * Math.cos(w);
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${anteil > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
}

export function KreisBild({ p, beschriftung = true, klein = false }: { p: number; beschriftung?: boolean; klein?: boolean }) {
  const kreise = Math.max(1, Math.ceil(p / 100 - 1e-9));
  const r = 90, d = 2 * r + 30;
  return (
    <svg viewBox={`-10 -10 ${kreise * d} ${d + (beschriftung ? 20 : 0)}`} className={`w-full h-auto ${klein ? "max-h-40" : "max-h-[38vh]"}`}
      role="img" aria-label={beschriftung ? `Kreis, ${z(p)} % gefärbt` : "Kreis"}>
      {Array.from({ length: kreise }, (_, i) => {
        const anteil = Math.min(1, Math.max(0, (p - 100 * i) / 100));
        const cx = i * d + r + 5, cy = r + 5;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={2} style={{ stroke: "var(--border)" }} />
            <path d={stueck(cx, cy, r, anteil)} fill={i ? FARBE2 : FARBE} fillOpacity={0.85} />
            {/* Viertel-Striche zum Abschätzen */}
            {[0, 1, 2, 3].map(k => {
              const w = (k * Math.PI) / 2;
              return <line key={k} x1={cx} y1={cy} x2={cx + r * Math.sin(w)} y2={cy - r * Math.cos(w)} strokeWidth={1} strokeDasharray="3 4" style={{ stroke: "var(--text-muted)" }} />;
            })}
            {beschriftung && (
              <text x={cx} y={2 * r + 28} textAnchor="middle" fontSize={18} fontWeight={800} style={TEXT}>
                {z(anteil * 100)} %{i ? " dazu" : ""}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Prozentstreifen: oben die Prozentskala, unten die Werteskala — gleiche
 * Stellen gehören zusammen (≙). `marken` sind zusätzliche Prozentstellen.
 */
export function StreifenBild({ p, G, einheit = "", marken = [0, 25, 50, 75, 100], hervor }: {
  p: number; G: number; einheit?: string; marken?: number[]; hervor?: "W" | "G" | "p";
}) {
  const max = Math.max(100, p);
  const B = 760, x0 = 30, breite = B - 60, sx = (q: number) => x0 + (q / max) * breite;
  const e = einheit ? " " + einheit : "";
  // Marken zu dicht an p oder 100 % fallen weg, sonst überlappen die Zahlen.
  const frei = (m: number) => [p, 100].every(f => m === f || Math.abs(m - f) >= max * 0.05);
  const alle = [...new Set([...marken.filter(frei), 100, p].filter(m => m <= max))].sort((a, b) => a - b);
  const farbe = (was: "W" | "G" | "p") => (hervor === was ? "#e11d48" : undefined);
  return (
    <svg viewBox={`0 0 ${B} 150`} className="w-full h-auto max-h-[30vh]" role="img" aria-label={`Prozentstreifen: ${z(p)} % von ${z(G)}`}>
      <text x={x0} y={18} fontSize={13} fontWeight={700} style={MUTED}>Prozent</text>
      <text x={x0} y={146} fontSize={13} fontWeight={700} style={MUTED}>Wert</text>
      {/* das Ganze */}
      <rect x={x0} y={50} width={sx(100) - x0} height={40} rx={6} fill="none" strokeWidth={2} style={{ stroke: "var(--text)" }} />
      <rect x={x0} y={50} width={Math.max(0, sx(Math.min(p, 100)) - x0)} height={40} rx={6} fill={FARBE} fillOpacity={0.8} />
      {p > 100 && <rect x={sx(100)} y={50} width={sx(p) - sx(100)} height={40} rx={6} fill={FARBE2} fillOpacity={0.8} />}
      {alle.map(m => {
        const x = sx(m), istP = Math.abs(m - p) < 1e-9, ist100 = m === 100;
        const lang = istP || ist100;
        return (
          <g key={m}>
            <line x1={x} y1={lang ? 30 : 44} x2={x} y2={lang ? 110 : 96} strokeWidth={lang ? 2.5 : 1.2} style={{ stroke: lang ? "var(--text)" : "var(--text-muted)" }} />
            <text x={x} y={lang ? 26 : 40} textAnchor="middle" fontSize={lang ? 16 : 12} fontWeight={lang ? 900 : 500}
              style={istP && farbe("p") ? { fill: farbe("p") } : lang ? TEXT : MUTED}>{z(m, 2)} %</text>
            <text x={x} y={lang ? 126 : 110} textAnchor="middle" fontSize={lang ? 16 : 12} fontWeight={lang ? 900 : 500}
              style={istP && farbe("W") ? { fill: farbe("W") } : ist100 && farbe("G") ? { fill: farbe("G") } : lang ? TEXT : MUTED}>
              {z((G * m) / 100, 2)}{lang ? e : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 10 × 10 Kästchen, ein Kästchen = 1 %. */
export function HunderterBild({ p }: { p: number }) {
  const felder = Math.max(1, Math.ceil(p / 100 - 1e-9));
  const s = 22, gap = 30, w = 10 * s;
  return (
    <svg viewBox={`-4 -4 ${felder * (w + gap)} ${w + 34}`} className="w-full h-auto max-h-[38vh]" role="img" aria-label={`Hunderterfeld, ${z(p)} Kästchen gefärbt`}>
      {Array.from({ length: felder }, (_, f) => (
        <g key={f} transform={`translate(${f * (w + gap)} 0)`}>
          {Array.from({ length: 100 }, (_, i) => {
            const rest = p - 100 * f - i; // >= 1 voll, 0..1 teilweise
            const voll = Math.max(0, Math.min(1, rest));
            const x = (i % 10) * s, y = Math.floor(i / 10) * s;
            return (
              <g key={i}>
                <rect x={x} y={y} width={s - 2} height={s - 2} rx={3} fill="none" style={{ stroke: "var(--border)" }} />
                {voll > 0 && <rect x={x} y={y} width={(s - 2) * voll} height={s - 2} rx={3} fill={f ? FARBE2 : FARBE} />}
              </g>
            );
          })}
          <text x={w / 2} y={w + 22} textAnchor="middle" fontSize={16} fontWeight={800} style={TEXT}>
            {z(Math.min(100, Math.max(0, p - 100 * f)))} von 100
          </text>
        </g>
      ))}
    </svg>
  );
}

/** G Dinge, davon W hinterlegt. Bei nicht ganzem W wird angezeigt, wie viele es »rechnerisch« wären. */
export function DingeBild({ G, p, emoji }: { G: number; p: number; emoji: string }) {
  const W = (G * p) / 100;
  const ganzW = Math.min(G, Math.round(W));
  const spalten = G <= 20 ? 5 : 10, size = 36;
  const f = feld(G, size, spalten);
  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`-6 -6 ${f.w + 12} ${f.h + 12}`} className="w-full h-auto max-h-[38vh]" role="img" aria-label={`${G} Dinge, ${ganzW} markiert`}>
        <Dinge n={G} emoji={emoji} size={size} spalten={spalten} blau={ganzW} />
      </svg>
      {Math.abs(W - ganzW) > 1e-9 && p <= 100 && (
        <p className="text-xs text-muted text-center">
          Rechnerisch wären es {z(W)} — man kann aber nur ganze {emoji} zählen. Markiert sind gerundet {ganzW}.
        </p>
      )}
    </div>
  );
}

export function Gleichung({ children }: { children: ReactNode }) {
  return <p className="text-center text-2xl sm:text-3xl font-black tracking-tight">{children}</p>;
}
