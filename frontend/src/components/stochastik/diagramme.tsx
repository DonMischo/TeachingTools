"use client";
/**
 * Diagramme der Stochastik. Kategorien-Diagramme über recharts (Säule,
 * Balken, Kreis/Ring), alles mit eigener Geometrie als SVG
 * (Strichliste, Piktogramm, Punktstrahl, Boxplot, Histogramm, Venn,
 * Baumdiagramm, Urne, Glücksrad, Würfel). Achsen und Text nehmen die
 * Theme-Farben über `style`, Datenfarben kommen aus REIHE.
 */
import { useId, type ReactNode } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LabelList,
} from "recharts";
import type { Zeile } from "@/lib/stochastik/kenngroessen";
import { kenngroessen } from "@/lib/stochastik/kenngroessen";
import { blaetter, FARBEN, REIHE, type Knoten } from "@/lib/stochastik/zufall";
import { bt, prozent, wert, zahl, type Bruch } from "@/lib/stochastik/zahlen";
import { voll, type FeldName, type Tafel } from "@/lib/stochastik/vierfelder";

const T = { text: "var(--text)", muted: "var(--text-muted)", line: "var(--border)", surface: "var(--surface)", bg: "var(--bg)", accent: "var(--accent)" };
const tick = { fill: T.muted, fontSize: 12 };
const tip = { contentStyle: { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, color: T.text }, itemStyle: { color: T.text }, cursor: { fill: "rgba(127,127,127,.12)" } };

export type DiaArt = "saeulen" | "balken" | "kreis" | "ring" | "piktogramm" | "strichliste";
export const DIA_ARTEN: { id: DiaArt; label: string }[] = [
  { id: "saeulen", label: "📊 Säulen" }, { id: "balken", label: "📶 Balken" }, { id: "kreis", label: "🥧 Kreis" },
  { id: "ring", label: "🍩 Ring" }, { id: "piktogramm", label: "🙂 Piktogramm" },
  { id: "strichliste", label: "𝍸 Strichliste" },
];

/** Ein Kategorien-Diagramm in der gewählten Art. */
export function Diagramm({ art, zeilen, relativ, hoehe = 260, farbig = true, titel }: {
  art: DiaArt; zeilen: Zeile[]; relativ?: boolean; hoehe?: number; farbig?: boolean; titel?: string;
}) {
  const ges = zeilen.reduce((a, z) => a + z.anzahl, 0) || 1;
  const daten = zeilen.map((z, i) => ({ name: z.wert, wert: relativ ? Math.round((z.anzahl / ges) * 1000) / 10 : z.anzahl, farbe: farbig ? REIHE[i % REIHE.length] : REIHE[0] }));
  const fmt = (v: unknown) => (relativ ? `${zahl(Number(v), 1)} %` : String(v));
  const rahmen = (kind: ReactNode) => (
    <figure className="flex flex-col gap-1" aria-label={titel ?? "Diagramm"}>
      {titel && <figcaption className="text-sm font-bold text-center">{titel}</figcaption>}
      {kind}
    </figure>
  );
  if (art === "strichliste") return rahmen(<StrichTabelle zeilen={zeilen} />);
  if (art === "piktogramm") return rahmen(<Piktogramm zeilen={zeilen} />);
  if (art === "kreis" || art === "ring") return rahmen(
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div style={{ width: Math.min(hoehe, 280), height: Math.min(hoehe, 280) }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={daten} dataKey="wert" nameKey="name" innerRadius={art === "ring" ? "55%" : 0} outerRadius="92%" paddingAngle={art === "ring" ? 2 : 0}
              stroke={T.surface} strokeWidth={2} isAnimationActive={false}>
              {daten.map(d => <Cell key={d.name} fill={d.farbe} />)}
            </Pie>
            <Tooltip {...tip} formatter={(v) => `${fmt(v)} · ${prozent(Number(relativ ? Number(v) / 100 : Number(v) / ges))}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="text-sm flex flex-col gap-1">
        {zeilen.map((z, i) => (
          <li key={z.wert} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: REIHE[i % REIHE.length] }} />
            <span>{z.wert}</span><span className="text-muted tabular-nums">{z.anzahl} · {prozent(z.anzahl / ges)}</span>
            <span className="text-muted text-xs">({zahl((z.anzahl / ges) * 360, 0)}°)</span>
          </li>
        ))}
      </ul>
    </div>,
  );
  const quer = art === "balken";
  return rahmen(
    <ResponsiveContainer width="100%" height={quer ? Math.max(140, zeilen.length * 38 + 30) : hoehe}>
      <BarChart data={daten} layout={quer ? "vertical" : "horizontal"} margin={{ top: 18, right: 24, left: 0, bottom: 4 }}>
        <defs>
          {daten.map((d, i) => (
            <linearGradient key={i} id={`stoch-g${i}-${d.farbe.slice(1)}`} x1="0" y1="0" x2={quer ? "1" : "0"} y2={quer ? "0" : "1"}>
              <stop offset="0%" stopColor={d.farbe} stopOpacity={1} />
              <stop offset="100%" stopColor={d.farbe} stopOpacity={0.7} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={quer} horizontal={!quer} />
        {quer ? <>
          <XAxis type="number" tick={tick} stroke={T.line} allowDecimals={relativ} />
          <YAxis type="category" dataKey="name" tick={tick} stroke={T.line} width={110} />
        </> : <>
          <XAxis dataKey="name" tick={tick} stroke={T.line} interval={0} />
          <YAxis tick={tick} stroke={T.line} allowDecimals={relativ} />
        </>}
        <Tooltip {...tip} formatter={fmt} />
        <Bar dataKey="wert" radius={quer ? [0, 8, 8, 0] : [8, 8, 0, 0]} isAnimationActive={false} maxBarSize={64}>
          {daten.map((d, i) => <Cell key={i} fill={`url(#stoch-g${i}-${d.farbe.slice(1)})`} />)}
          <LabelList dataKey="wert" position={quer ? "right" : "top"} formatter={fmt} style={{ fill: T.text, fontSize: 12, fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>,
  );
}

// ── Strichliste und Piktogramm ───────────────────────────────────────────

export function Striche({ n, farbe = T.text }: { n: number; farbe?: string }) {
  // Bei sehr vielen Strichen (Simulation) nur den Anfang zeichnen – die Zahl steht daneben.
  if (n > 50) return <span className="inline-flex items-center gap-1"><Striche n={40} farbe={farbe} /><span className="text-muted font-black">…</span></span>;
  const buendel = Math.floor(n / 5), rest = n % 5;
  const w = buendel * 34 + rest * 7 + 4;
  return (
    <svg width={Math.max(8, w)} height={24} aria-label={`${n} Striche`} role="img">
      {Array.from({ length: buendel }, (_, b) => (
        <g key={b} transform={`translate(${b * 34 + 2},2)`} style={{ stroke: farbe }} strokeWidth={2} strokeLinecap="round">
          {[0, 1, 2, 3].map(i => <line key={i} x1={i * 7} y1={0} x2={i * 7} y2={20} />)}
          <line x1={-3} y1={17} x2={24} y2={3} />
        </g>
      ))}
      {Array.from({ length: rest }, (_, i) => (
        <line key={i} x1={buendel * 34 + 2 + i * 7} y1={2} x2={buendel * 34 + 2 + i * 7} y2={22} style={{ stroke: farbe }} strokeWidth={2} strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function StrichTabelle({ zeilen, relativ }: { zeilen: Zeile[]; relativ?: boolean }) {
  const summe = zeilen.reduce((a, z) => a + z.anzahl, 0);
  const ges = summe || 1;
  return (
    <table className="text-sm w-full max-w-xl">
      <thead><tr className="text-left text-muted text-xs"><th className="py-1">Merkmal</th><th>Strichliste</th><th className="text-right">absolut</th>{relativ && <th className="text-right">relativ</th>}</tr></thead>
      <tbody>
        {zeilen.map(z => (
          <tr key={z.wert} className="border-t border-line">
            <td className="py-1.5 pr-3 font-bold">{z.wert}</td>
            <td><Striche n={z.anzahl} /></td>
            <td className="text-right tabular-nums font-black">{z.anzahl}</td>
            {relativ && <td className="text-right tabular-nums pl-3">{z.anzahl}/{ges} ≈ {prozent(z.anzahl / ges)}</td>}
          </tr>
        ))}
        <tr className="border-t-2 border-line font-black"><td className="py-1.5">Summe</td><td /><td className="text-right">{summe}</td>{relativ && <td className="text-right">100 %</td>}</tr>
      </tbody>
    </table>
  );
}

export function Piktogramm({ zeilen, icon = "🙂", je = 1 }: { zeilen: Zeile[]; icon?: string; je?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {zeilen.map(z => (
        <div key={z.wert} className="flex items-center gap-2">
          <span className="w-28 text-sm font-bold truncate">{z.wert}</span>
          <span className="flex flex-wrap text-xl leading-none">{Array.from({ length: Math.round(z.anzahl / je) }, (_, i) => <span key={i}>{icon}</span>)}</span>
          <span className="text-xs text-muted">{z.anzahl}</span>
        </div>
      ))}
      <span className="text-xs text-muted">{icon} = {je} {je === 1 ? "Stimme" : "Stimmen"}</span>
    </div>
  );
}

// ── Punktstrahl und Boxplot ──────────────────────────────────────────────

const achse = (lo: number, hi: number) => {
  const sp = hi - lo || 1;
  const schritt = [1, 2, 5, 10, 20, 25, 50, 100].find(s => sp / s <= 12) ?? 200;
  const ticks: number[] = [];
  for (let x = Math.ceil(lo / schritt) * schritt; x <= hi; x += schritt) ticks.push(x);
  return ticks;
};

/** Punkte über einem Zahlenstrahl, gleiche Werte gestapelt; Kenngrößen als Marken. */
export function Punktstrahl({ zahlen, marken = [], einheit }: { zahlen: number[]; marken?: { x: number; label: string; farbe: string }[]; einheit?: string }) {
  if (!zahlen.length) return null;
  const lo = Math.min(...zahlen, ...marken.map(m => m.x)), hi = Math.max(...zahlen, ...marken.map(m => m.x));
  const pad = (hi - lo || 1) * 0.06;
  const a = lo - pad, b = hi + pad;
  const W = 640, X = (x: number) => 20 + ((x - a) / (b - a)) * (W - 40);
  const stapel = new Map<number, number>();
  const punkte = zahlen.map(x => { const h = stapel.get(x) ?? 0; stapel.set(x, h + 1); return { x, h }; });
  const maxH = Math.max(...stapel.values());
  const r = Math.min(9, 120 / Math.max(maxH, 1) / 2.2);
  const basis = 30 + maxH * r * 2.2;
  const H = basis + 60;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Punktstrahl">
      <line x1={10} x2={W - 10} y1={basis} y2={basis} style={{ stroke: T.muted }} strokeWidth={1.5} />
      {achse(a, b).map(t => (
        <g key={t}><line x1={X(t)} x2={X(t)} y1={basis} y2={basis + 6} style={{ stroke: T.muted }} />
          <text x={X(t)} y={basis + 20} textAnchor="middle" fontSize={12} style={{ fill: T.muted }}>{zahl(t)}</text></g>
      ))}
      {einheit && <text x={W - 10} y={basis + 20} textAnchor="end" fontSize={12} style={{ fill: T.muted }}>{einheit}</text>}
      {punkte.map((p, i) => <circle key={i} cx={X(p.x)} cy={basis - r - 2 - p.h * r * 2.2} r={r} fill={REIHE[0]} fillOpacity={0.85} />)}
      {marken.map((m, i) => (
        <g key={m.label}>
          <line x1={X(m.x)} x2={X(m.x)} y1={14} y2={basis} style={{ stroke: m.farbe }} strokeWidth={2.5} strokeDasharray="5 4" />
          <text x={X(m.x)} y={basis + 38 + (i % 2) * 14} textAnchor="middle" fontSize={12} fontWeight={800} style={{ fill: m.farbe }}>{m.label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Ein oder mehrere Boxplots auf gemeinsamer Achse. */
export function Boxplot({ reihen, einheit }: { reihen: { name: string; zahlen: number[]; farbe?: string }[]; einheit?: string }) {
  const da = reihen.filter(r => r.zahlen.length);
  if (!da.length) return null;
  const alle = da.flatMap(r => r.zahlen);
  const lo = Math.min(...alle), hi = Math.max(...alle);
  const pad = (hi - lo || 1) * 0.05;
  const a = lo - pad, b = hi + pad;
  const W = 640, L = 90, X = (x: number) => L + ((x - a) / (b - a)) * (W - L - 20);
  const ZH = 64, H = da.length * ZH + 40;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Boxplot">
      {achse(a, b).map(t => (
        <g key={t}><line x1={X(t)} x2={X(t)} y1={6} y2={H - 30} style={{ stroke: T.line }} strokeDasharray="2 4" />
          <text x={X(t)} y={H - 12} textAnchor="middle" fontSize={12} style={{ fill: T.muted }}>{zahl(t)}</text></g>
      ))}
      {einheit && <text x={W - 6} y={H - 12} textAnchor="end" fontSize={12} style={{ fill: T.muted }}>{einheit}</text>}
      {da.map((r, i) => {
        const k = kenngroessen(r.zahlen);
        const y = 14 + i * ZH, m = y + 20, f = r.farbe ?? REIHE[i % REIHE.length];
        return (
          <g key={r.name}>
            <text x={8} y={m + 4} fontSize={13} fontWeight={700} style={{ fill: T.text }}>{r.name}</text>
            <line x1={X(k.min)} x2={X(k.q1)} y1={m} y2={m} stroke={f} strokeWidth={2} />
            <line x1={X(k.q3)} x2={X(k.max)} y1={m} y2={m} stroke={f} strokeWidth={2} />
            <line x1={X(k.min)} x2={X(k.min)} y1={m - 9} y2={m + 9} stroke={f} strokeWidth={2} />
            <line x1={X(k.max)} x2={X(k.max)} y1={m - 9} y2={m + 9} stroke={f} strokeWidth={2} />
            <rect x={X(k.q1)} y={y} width={Math.max(2, X(k.q3) - X(k.q1))} height={40} rx={6} fill={f} fillOpacity={0.25} stroke={f} strokeWidth={2} />
            <line x1={X(k.median)} x2={X(k.median)} y1={y} y2={y + 40} stroke={f} strokeWidth={4} />
            <title>{`${r.name}: Min ${zahl(k.min)}, Q1 ${zahl(k.q1)}, Median ${zahl(k.median)}, Q3 ${zahl(k.q3)}, Max ${zahl(k.max)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

// ── Histogramm einer Zufallsgröße ────────────────────────────────────────

export function Histogramm({ werte, markiert, erwartung, beschriftung = true }: {
  werte: { x: number; p: Bruch | number }[]; markiert?: (x: number) => boolean; erwartung?: number; beschriftung?: boolean;
}) {
  const p = (v: Bruch | number) => (typeof v === "number" ? v : wert(v));
  const maxP = Math.max(...werte.map(w => p(w.p)), 0.01);
  const W = 640, H = 260, L = 46, B = 30;
  const bw = (W - L - 10) / werte.length;
  const Y = (v: number) => H - B - (v / maxP) * (H - B - 26);
  // Säulen stehen gleich breit nebeneinander; ein Wert dazwischen (E(X)) wird zwischen den Säulenmitten eingepasst.
  const X = (x: number) => {
    const xs = werte.map(w => w.x);
    if (x <= xs[0]) return L + bw / 2;
    for (let i = 0; i < xs.length - 1; i++) {
      if (x <= xs[i + 1]) return L + (i + 0.5 + (x - xs[i]) / (xs[i + 1] - xs[i])) * bw;
    }
    return L + (xs.length - 0.5) * bw;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Histogramm">
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}><line x1={L} x2={W - 6} y1={Y(maxP * f)} y2={Y(maxP * f)} style={{ stroke: T.line }} strokeDasharray="2 4" />
          <text x={L - 6} y={Y(maxP * f) + 4} textAnchor="end" fontSize={11} style={{ fill: T.muted }}>{zahl(maxP * f, 3)}</text></g>
      ))}
      {werte.map((w, i) => {
        const an = markiert?.(w.x);
        return (
          <g key={w.x}>
            <rect x={L + i * bw} y={Y(p(w.p))} width={bw} height={H - B - Y(p(w.p))} fill={an ? "#f97316" : REIHE[0]} fillOpacity={an ? 0.95 : 0.75} style={{ stroke: T.surface }} strokeWidth={1.5} />
            <text x={L + i * bw + bw / 2} y={H - B + 16} textAnchor="middle" fontSize={12} style={{ fill: T.text }}>{zahl(w.x)}</text>
            {beschriftung && bw > 34 && <text x={L + i * bw + bw / 2} y={Y(p(w.p)) - 5} textAnchor="middle" fontSize={10} style={{ fill: T.muted }}>{typeof w.p === "number" ? zahl(w.p, 3) : bt(w.p)}</text>}
          </g>
        );
      })}
      {erwartung !== undefined && werte.length > 0 && (
        <g>
          <line x1={X(erwartung)} x2={X(erwartung)} y1={10} y2={H - B} stroke="#ef4444" strokeWidth={3} />
          <text x={X(erwartung) + 5} y={20} fontSize={12} fontWeight={800} fill="#ef4444">E(X) = {zahl(erwartung, 2)}</text>
        </g>
      )}
    </svg>
  );
}

// ── Venn-Diagramm ────────────────────────────────────────────────────────

export type Region = "nurA" | "AB" | "nurB" | "aussen";
export const REGIONEN: Region[] = ["nurA", "AB", "nurB", "aussen"];

export function Venn({ an, a = "A", b = "B", elemente, onRegion }: {
  an: Region[]; a?: string; b?: string; elemente?: Partial<Record<Region, (string | number)[]>>; onRegion?: (r: Region) => void;
}) {
  const id = useId().replace(/:/g, "");
  const W = 460, H = 290, ca = { x: 175, y: 162 }, cb = { x: 285, y: 162 }, R = 95;
  const fuell = "#f97316";
  const klick = (r: Region) => onRegion && (() => onRegion(r));
  const pos: Record<Region, { x: number; y: number }> = { nurA: { x: 128, y: 168 }, AB: { x: 230, y: 168 }, nurB: { x: 332, y: 168 }, aussen: { x: 30, y: 272 } };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-lg" role="img" aria-label="Venn-Diagramm">
      <defs>
        <mask id={`${id}-ohneB`}><rect width={W} height={H} fill="white" /><circle cx={cb.x} cy={cb.y} r={R} fill="black" /></mask>
        <mask id={`${id}-ohneA`}><rect width={W} height={H} fill="white" /><circle cx={ca.x} cy={ca.y} r={R} fill="black" /></mask>
        <mask id={`${id}-aussen`}><rect width={W} height={H} fill="white" /><circle cx={ca.x} cy={ca.y} r={R} fill="black" /><circle cx={cb.x} cy={cb.y} r={R} fill="black" /></mask>
        <clipPath id={`${id}-inA`}><circle cx={ca.x} cy={ca.y} r={R} /></clipPath>
      </defs>
      <rect x={4} y={4} width={W - 8} height={H - 8} rx={14} fill={an.includes("aussen") ? fuell : "transparent"} fillOpacity={0.45} mask={`url(#${id}-aussen)`}
        onClick={klick("aussen")} style={{ cursor: onRegion ? "pointer" : undefined }} />
      <rect x={4} y={4} width={W - 8} height={H - 8} rx={14} fill="none" style={{ stroke: T.muted }} strokeWidth={2} pointerEvents="none" />
      <text x={16} y={26} fontSize={16} fontWeight={800} style={{ fill: T.muted }}>Ω</text>
      <circle cx={ca.x} cy={ca.y} r={R} fill={an.includes("nurA") ? fuell : "transparent"} fillOpacity={0.45} mask={`url(#${id}-ohneB)`} onClick={klick("nurA")} style={{ cursor: onRegion ? "pointer" : undefined }} />
      <circle cx={cb.x} cy={cb.y} r={R} fill={an.includes("nurB") ? fuell : "transparent"} fillOpacity={0.45} mask={`url(#${id}-ohneA)`} onClick={klick("nurB")} style={{ cursor: onRegion ? "pointer" : undefined }} />
      <circle cx={cb.x} cy={cb.y} r={R} fill={an.includes("AB") ? fuell : "transparent"} fillOpacity={0.55} clipPath={`url(#${id}-inA)`} onClick={klick("AB")} style={{ cursor: onRegion ? "pointer" : undefined }} />
      <circle cx={ca.x} cy={ca.y} r={R} fill="none" stroke="#3b82f6" strokeWidth={3} pointerEvents="none" />
      <circle cx={cb.x} cy={cb.y} r={R} fill="none" stroke="#22c55e" strokeWidth={3} pointerEvents="none" />
      <text x={ca.x - R + 10} y={ca.y - R - 12} fontSize={15} fontWeight={900} fill="#3b82f6">{a}</text>
      <text x={cb.x + R - 10} y={cb.y - R - 12} textAnchor="end" fontSize={15} fontWeight={900} fill="#22c55e">{b}</text>
      {elemente && REGIONEN.map(r => (
        <text key={r} x={pos[r].x} y={pos[r].y} textAnchor={r === "aussen" ? "start" : "middle"} fontSize={17} fontWeight={700} style={{ fill: T.text }} pointerEvents="none">
          {(elemente[r] ?? []).join("  ")}
        </text>
      ))}
    </svg>
  );
}

// ── Baumdiagramm ─────────────────────────────────────────────────────────

/**
 * Baumdiagramm von links nach rechts. Ohne `mitP` nur die Ergebnisse
 * (Kl. 5/6), mit `mitP` Astwahrscheinlichkeiten und Pfadprodukte.
 * `an(pfad)` hebt Pfade hervor, `onPfad` macht Blätter anklickbar.
 */
export function Baum({ wurzel, mitP, an, onPfad, format = "bruch", kurz }: {
  wurzel: Knoten; mitP?: boolean; an?: (pfad: string[]) => boolean; onPfad?: (pfad: string[]) => void;
  format?: "bruch" | "dezimal" | "prozent"; kurz?: (id: string) => string;
}) {
  const bl = blaetter(wurzel);
  const tiefe = bl[0]?.pfad.length ?? 0;
  if (bl.length > 64) return <p className="text-sm text-muted">Der Baum hätte {bl.length} Pfade – zu viele zum Zeichnen. Weniger Stufen wählen.</p>;
  const zh = bl.length > 24 ? 22 : 34, sx = 150, L = 30, rechts = mitP ? 170 : 70;
  const W = L + tiefe * sx + rechts, H = bl.length * zh + 20;
  const f = (b: Bruch) => (format === "bruch" ? bt(b) : format === "prozent" ? prozent(wert(b)) : zahl(wert(b), 3));
  const ys = new Map<Knoten, number>();
  let n = 0;
  const lege = (k: Knoten): number => {
    const y = k.kinder.length ? k.kinder.map(lege).reduce((a, b) => a + b, 0) / k.kinder.length : 10 + zh / 2 + zh * n++;
    ys.set(k, y);
    return y;
  };
  lege(wurzel);
  const elemente: ReactNode[] = [];
  const zeichne = (k: Knoten, x: number) => {
    const y = ys.get(k)!;
    k.kinder.forEach((c, i) => {
      const cx = x + sx, cy = ys.get(c)!;
      const hell = an ? an(c.pfad) || blaetter(c).some(b => an(b.pfad)) : false;
      elemente.push(<line key={`l${c.pfad.join()}`} x1={x + 12} y1={y} x2={cx - 13} y2={cy} strokeWidth={hell ? 3.5 : 2}
        style={{ stroke: hell ? "#f97316" : T.muted }} strokeLinecap="round" />);
      if (mitP) {
        const mx = (x + cx) / 2, my = (y + cy) / 2;
        elemente.push(
          <g key={`p${c.pfad.join()}`}>
            <rect x={mx - 22} y={my - 10} width={44} height={18} rx={6} style={{ fill: T.surface, stroke: T.line }} />
            <text x={mx} y={my + 3} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: T.text }}>{f(c.p)}</text>
          </g>,
        );
      }
      zeichne(c, cx);
      void i;
    });
    if (k.ausgang) {
      const label = kurz ? kurz(k.ausgang.id) : k.ausgang.label;
      elemente.push(
        <g key={`k${k.pfad.join()}`}>
          <circle cx={x} cy={y} r={12} fill={k.ausgang.farbe} />
          <text x={x} y={y + 4} textAnchor="middle" fontSize={label.length > 2 ? 8 : 11} fontWeight={900} fill="#fff">{label}</text>
        </g>,
      );
    } else elemente.push(<circle key="w" cx={x} cy={y} r={6} style={{ fill: T.muted }} />);
    if (!k.kinder.length && k.pfad.length) {
      const hell = an?.(k.pfad);
      elemente.push(
        <g key={`e${k.pfad.join()}`} onClick={onPfad ? () => onPfad(k.pfad) : undefined} style={{ cursor: onPfad ? "pointer" : undefined }}>
          <rect x={x + 18} y={y - zh / 2 + 3} width={rechts - 24} height={zh - 6} rx={7}
            style={{ fill: hell ? "rgba(249,115,22,.18)" : "transparent", stroke: hell ? "#f97316" : onPfad ? T.line : "transparent" }} />
          <text x={x + 26} y={y + 4} fontSize={12} fontWeight={700} style={{ fill: T.text }}>
            {k.pfad.map(p => (kurz ? kurz(p) : p)).join("")}{mitP ? `  ${f(k.pPfad)}` : ""}
          </text>
        </g>,
      );
    }
  };
  zeichne(wurzel, L);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ maxWidth: "100%", height: "auto" }} role="img" aria-label="Baumdiagramm">{elemente}</svg>
    </div>
  );
}

// ── Vierfeldertafel ──────────────────────────────────────────────────────

export function TafelAnsicht({ tafel, a, b, format = "anzahl", zeigen, eingabe, markiert, nA, nB }: {
  tafel: Tafel; a: string; b: string; format?: "anzahl" | "prozent" | "dezimal";
  zeigen?: FeldName[]; eingabe?: (k: FeldName) => ReactNode; markiert?: FeldName[]; nA?: string; nB?: string;
}) {
  const v = voll(tafel);
  const f = (x: number) => (format === "anzahl" ? zahl(x, 2) : format === "prozent" ? `${zahl(x * 100, 1)} %` : zahl(x, 3));
  const zelle = (k: FeldName, rand = false) => {
    const sicht = !zeigen || zeigen.includes(k);
    const an = markiert?.includes(k);
    return (
      <td key={k} className={`px-3 py-2 text-center tabular-nums border border-line ${rand ? "bg-surface-hover font-black" : "font-bold"}`}
        style={an ? { background: "rgba(249,115,22,.25)", outline: "2px solid #f97316" } : undefined}>
        {sicht ? f(v[k]) : eingabe ? eingabe(k) : <span className="text-muted">?</span>}
      </td>
    );
  };
  return (
    <table className="border-collapse text-sm">
      <thead>
        <tr><th className="p-2" /><th className="px-3 py-2 border border-line" style={{ color: "#22c55e" }}>{b}</th><th className="px-3 py-2 border border-line" style={{ color: "#22c55e" }}>{nB ?? `nicht ${b}`}</th><th className="px-3 py-2 border border-line text-muted">Summe</th></tr>
      </thead>
      <tbody>
        <tr><th className="px-3 py-2 border border-line text-left" style={{ color: "#3b82f6" }}>{a}</th>{zelle("ab")}{zelle("aNb")}{zelle("a", true)}</tr>
        <tr><th className="px-3 py-2 border border-line text-left" style={{ color: "#3b82f6" }}>{nA ?? `nicht ${a}`}</th>{zelle("nAb")}{zelle("nAnB")}{zelle("nA", true)}</tr>
        <tr><th className="px-3 py-2 border border-line text-left text-muted">Summe</th>{zelle("b", true)}{zelle("nB", true)}{zelle("ges", true)}</tr>
      </tbody>
    </table>
  );
}

// ── Zufallsgeräte ────────────────────────────────────────────────────────

/** Urne mit farbigen Kugeln; `weg` sind schon gezogene (ohne Zurücklegen). */
export function Urne({ kugeln, weg = [], gross }: { kugeln: Partial<Record<string, number>>; weg?: string[]; gross?: boolean }) {
  const liste = Object.entries(kugeln).flatMap(([f, n]) => Array.from({ length: n ?? 0 }, () => f));
  const rest = [...liste];
  for (const w of weg) { const i = rest.indexOf(w); if (i >= 0) rest[i] = `~${w}`; }
  const proReihe = 6, r = 13;
  const reihen = Math.ceil(rest.length / proReihe) || 1;
  const W = 200, H = 50 + reihen * 30;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={gross ? "w-56 h-auto" : "w-40 h-auto"} role="img" aria-label="Urne">
      <path d={`M20 18 Q20 ${H - 4} 100 ${H - 4} Q180 ${H - 4} 180 18`} style={{ fill: T.surface, stroke: T.muted }} strokeWidth={3} />
      <ellipse cx={100} cy={18} rx={80} ry={10} style={{ fill: T.bg, stroke: T.muted }} strokeWidth={3} />
      {rest.map((f, i) => {
        const z = Math.floor(i / proReihe), s = i % proReihe;
        const inReihe = Math.min(proReihe, rest.length - z * proReihe);
        const x = 100 + (s - (inReihe - 1) / 2) * 27, y = H - 22 - z * 28;
        const farbe = FARBEN[f.replace("~", "") as keyof typeof FARBEN] ?? "#888";
        return f.startsWith("~")
          ? <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={farbe} strokeWidth={2} strokeDasharray="3 3" />
          : <g key={i}><circle cx={x} cy={y} r={r} fill={farbe} /><circle cx={x - 4} cy={y - 4} r={4} fill="#fff" fillOpacity={0.45} /></g>;
      })}
    </svg>
  );
}

/** Glücksrad, Sektoren nach Anteil, Zeiger oben. `winkel` dreht das Rad. */
export function Rad({ felder, winkel = 0, groesse = 200 }: { felder: { label: string; farbe: string; anteil: number }[]; winkel?: number; groesse?: number }) {
  const ges = felder.reduce((a, f) => a + f.anteil, 0) || 1;
  let a0 = 0;
  const R = 90, C = 100;
  return (
    <svg viewBox="0 0 200 210" width={groesse} role="img" aria-label="Glücksrad">
      <g style={{ transform: `rotate(${winkel}deg)`, transformOrigin: "100px 110px", transition: "transform 1.2s cubic-bezier(.2,.8,.2,1)" }}>
        {felder.map((f, i) => {
          const w = (f.anteil / ges) * Math.PI * 2;
          const p = (t: number) => `${C + R * Math.sin(t)},${110 - R * Math.cos(t)}`;
          const d = felder.length === 1 ? undefined : `M${C},110 L${p(a0)} A${R},${R} 0 ${w > Math.PI ? 1 : 0} 1 ${p(a0 + w)} Z`;
          const mid = a0 + w / 2;
          a0 += w;
          return (
            <g key={i}>
              {d ? <path d={d} fill={f.farbe} style={{ stroke: T.surface }} strokeWidth={2} /> : <circle cx={C} cy={110} r={R} fill={f.farbe} />}
              <text x={C + R * 0.62 * Math.sin(mid)} y={110 - R * 0.62 * Math.cos(mid) + 4} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff">{f.label}</text>
            </g>
          );
        })}
      </g>
      <circle cx={C} cy={110} r={8} style={{ fill: T.surface, stroke: T.muted }} strokeWidth={2} />
      <path d="M100 26 L92 6 L108 6 Z" style={{ fill: T.text }} />
    </svg>
  );
}

const AUGEN: Record<number, [number, number][]> = {
  1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
};

export function Wuerfel({ augen, groesse = 56, farbe = "#ffffff" }: { augen: number; groesse?: number; farbe?: string }) {
  return (
    <svg viewBox="0 0 60 60" width={groesse} height={groesse} role="img" aria-label={`Würfel ${augen}`}>
      <rect x={3} y={3} width={54} height={54} rx={12} fill={farbe} stroke="#334155" strokeWidth={2.5} />
      {(AUGEN[augen] ?? []).map(([x, y], i) => <circle key={i} cx={x * 14 + 2} cy={y * 14 + 2} r={5} fill="#1e293b" />)}
      {!AUGEN[augen] && <text x={30} y={37} textAnchor="middle" fontSize={20} fontWeight={900} fill="#1e293b">{augen}</text>}
    </svg>
  );
}

export function Muenze({ seite, groesse = 56 }: { seite: "K" | "Z"; groesse?: number }) {
  return (
    <svg viewBox="0 0 60 60" width={groesse} height={groesse} role="img" aria-label={seite === "K" ? "Kopf" : "Zahl"}>
      <defs><radialGradient id={`m${seite}`} cx="35%" cy="30%"><stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#b45309" /></radialGradient></defs>
      <circle cx={30} cy={30} r={26} fill={`url(#m${seite})`} stroke="#92400e" strokeWidth={2} />
      <circle cx={30} cy={30} r={20} fill="none" stroke="#92400e" strokeWidth={1} strokeDasharray="2 2" />
      <text x={30} y={37} textAnchor="middle" fontSize={seite === "K" ? 20 : 22} fontWeight={900} fill="#78350f">{seite === "K" ? "🦅" : "1"}</text>
    </svg>
  );
}
