"use client";
/**
 * Gemeinsame Bauteile der Sim »Quadratische Funktionen«: Koordinatensystem
 * (wie im Funktionen-Tool), farbige Terme, Regler und die Kästen
 * »So geht's«, »Merke«, »Achtung«.
 *
 * Farbcode wie im Mathe-Heft Klasse 9: x violett, a pink, d/b türkis
 * (links-rechts), e/c grün (oben-unten).
 */
import type { ReactNode } from "react";
import { glatt, zahl, type GraphSpec, type NF, type Punkt, type Rolle, type Stueck } from "@/lib/quadratisch";

export const FARBE: Record<Rolle | "y" | "s", string> = {
  x: "#8b5cf6", a: "#db2777", d: "#0891b2", b: "#0891b2", p: "#0891b2", e: "#16a34a", c: "#16a34a", q: "#16a34a",
  y: "#2563eb", s: "#f59e0b",
};

/** Term aus farbigen Stücken, in Formelschrift. */
export function Term({ st, gross }: { st: Stueck[]; gross?: boolean }) {
  return (
    <span className={`font-serif whitespace-nowrap ${gross ? "text-2xl" : "text-lg"}`} style={{ fontFamily: "Cambria Math, Cambria, 'Times New Roman', serif" }}>
      {st.map((s, i) => <span key={i} style={s.r ? { color: FARBE[s.r], fontWeight: 700 } : undefined}>{s.t}</span>)}
    </span>
  );
}

/** Ein Buchstabe oder Wert in seiner Rollenfarbe. */
export const F = ({ r, children }: { r: keyof typeof FARBE; children: ReactNode }) =>
  <b style={{ color: FARBE[r] }}>{children}</b>;

export function Kasten({ art, titel, children }: { art: "so" | "merk" | "achtung" | "tipp"; titel: string; children: ReactNode }) {
  const stil = {
    so: "border-accent",
    merk: "border-ok",
    achtung: "border-bad",
    tipp: "border-line-active",
  }[art];
  const icon = { so: "🛠", merk: "💡", achtung: "⚠️", tipp: "🎯" }[art];
  return (
    <div className={`rounded-xl border border-line border-l-4 ${stil} bg-surface p-3 text-sm flex flex-col gap-1.5`}>
      <div className="font-black">{icon} {titel}</div>
      {children}
    </div>
  );
}

export function Regler({ name, r, wert, setze, min, max, schritt, hinweis }: {
  name: string; r: keyof typeof FARBE; wert: number; setze: (v: number) => void; min: number; max: number; schritt: number; hinweis?: string;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span><F r={r}>{name}</F> {hinweis && <span className="text-muted text-xs">{hinweis}</span>}</span>
        <F r={r}>{zahl(wert)}</F>
      </span>
      <input type="range" min={min} max={max} step={schritt} value={wert} aria-label={name}
        onChange={e => setze(glatt(Number(e.target.value)))} style={{ accentColor: FARBE[r] }} />
    </label>
  );
}

/* ─────────────────────────────────────────── Koordinatensystem ── */

export type Bereich = GraphSpec["bereich"];
export type Kurve = { f: NF | ((x: number) => number); farbe?: string; gestrichelt?: boolean; breite?: number; name?: string };
type Achsen = { sx: (x: number) => number; sy: (y: number) => number; W: number; H: number; M: number };

const W0 = 560, H0 = 420, M = 30;
const auswerten = (f: Kurve["f"], x: number) => (typeof f === "function" ? f(x) : f.a * x * x + f.b * x + f.c);

/** Teilung, die bei jedem Ausschnitt lesbar bleibt: 1, 2, 5, 10 … */
function teilung(span: number) {
  const roh = span / 14;
  const p = 10 ** Math.floor(Math.log10(roh));
  return [1, 2, 5, 10].map(k => k * p).find(k => k >= roh) ?? 10 * p;
}

function pfad(f: Kurve["f"], b: Bereich, sx: Achsen["sx"], sy: Achsen["sy"]) {
  const out: string[] = [];
  let cur = "";
  const span = b.y1 - b.y0;
  for (let i = 0; i <= 400; i++) {
    const x = b.x0 + ((b.x1 - b.x0) * i) / 400;
    const y = auswerten(f, x);
    const drin = Number.isFinite(y) && y > b.y0 - span && y < b.y1 + span;
    if (!drin) { if (cur) out.push(cur); cur = ""; continue; }
    cur += `${cur ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Koordinatensystem mit Kurven und Punkten. `ueber` zeichnet Zusätzliches
 * (Pfeile, Treppen, Zielkurven) in Pixeln über das Raster.
 */
export function Graph({ bereich: b, kurven, punkte = [], ueber, label = "Koordinatensystem", breite = W0, hoehe = H0, onKlick }: {
  bereich: Bereich; kurven: Kurve[]; punkte?: (Punkt & { label?: string; farbe?: string })[];
  ueber?: (a: Achsen) => ReactNode; label?: string; breite?: number; hoehe?: number;
  onKlick?: (p: Punkt) => void;
}) {
  const W = breite, H = hoehe;
  const sx = (x: number) => M + ((x - b.x0) / (b.x1 - b.x0)) * (W - 2 * M);
  const sy = (y: number) => H - M - ((y - b.y0) / (b.y1 - b.y0)) * (H - 2 * M);
  const tx = teilung(b.x1 - b.x0), ty = teilung(b.y1 - b.y0);
  const ticks = (a: number, z: number, t: number) => {
    const o: number[] = [];
    for (let v = Math.ceil(a / t) * t; v <= z + 1e-9; v += t) o.push(glatt(v));
    return o;
  };
  const clip = `qclip-${W}-${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img" aria-label={label}
      style={{ maxHeight: "calc(100vh - 220px)", cursor: onKlick ? "crosshair" : undefined }}
      onClick={onKlick ? e => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        if (!(r.width > 0)) return;
        const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
        onKlick({ x: b.x0 + ((px - M) / (W - 2 * M)) * (b.x1 - b.x0), y: b.y0 + ((H - M - py) / (H - 2 * M)) * (b.y1 - b.y0) });
      } : undefined}>
      <defs>
        <clipPath id={clip}><rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} /></clipPath>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="var(--surface)" />
      <g stroke="var(--border)" strokeWidth={1} opacity={0.55}>
        {ticks(b.x0, b.x1, tx).map(t => <line key={`gx${t}`} x1={sx(t)} y1={M} x2={sx(t)} y2={H - M} />)}
        {ticks(b.y0, b.y1, ty).map(t => <line key={`gy${t}`} x1={M} y1={sy(t)} x2={W - M} y2={sy(t)} />)}
      </g>
      <g stroke="var(--text)" strokeWidth={1.6}>
        {b.y0 <= 0 && b.y1 >= 0 && <line x1={M} y1={sy(0)} x2={W - M + 8} y2={sy(0)} />}
        {b.x0 <= 0 && b.x1 >= 0 && <line x1={sx(0)} y1={H - M} x2={sx(0)} y2={M - 8} />}
      </g>
      <g fill="var(--text-muted)" fontSize={11} style={{ fontVariantNumeric: "tabular-nums" }}>
        {ticks(b.x0, b.x1, tx).filter(t => t !== 0).map(t => (
          <text key={`tx${t}`} x={sx(t)} y={Math.min(H - M, Math.max(M, sy(0))) + 14} textAnchor="middle">{zahl(t)}</text>
        ))}
        {ticks(b.y0, b.y1, ty).filter(t => t !== 0).map(t => (
          <text key={`ty${t}`} x={Math.min(W - M, Math.max(M, sx(0))) - 5} y={sy(t) + 4} textAnchor="end">{zahl(t)}</text>
        ))}
        <text x={W - M + 6} y={Math.min(H - M, Math.max(M, sy(0))) - 6} fontWeight={800} fontSize={14} fill={FARBE.x}>x</text>
        <text x={Math.min(W - M, Math.max(M, sx(0))) + 6} y={M - 10} fontWeight={800} fontSize={14} fill={FARBE.y}>y</text>
      </g>
      <g clipPath={`url(#${clip})`}>
        {kurven.map((k, i) => pfad(k.f, b, sx, sy).map((d, j) => (
          <path key={`${i}-${j}`} d={d} fill="none" stroke={k.farbe ?? "var(--accent)"} strokeWidth={k.breite ?? 2.6}
            strokeDasharray={k.gestrichelt ? "6 5" : undefined} strokeLinecap="round" />
        )))}
      </g>
      {ueber?.({ sx, sy, W, H, M })}
      {punkte.map((p, i) => (
        <g key={`p${i}`}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={5.5} fill={p.farbe ?? FARBE.s} stroke="var(--surface)" strokeWidth={1.5} />
          {p.label && <text x={sx(p.x) + 9} y={sy(p.y) - 8} fontSize={12.5} fontWeight={800} fill="var(--text)"
            stroke="var(--surface)" strokeWidth={3.5} paintOrder="stroke">{p.label}</text>}
        </g>
      ))}
    </svg>
  );
}

/** Pfeil in Pixeln mit Beschriftung — für Verschiebungen und Treppen. */
export function Pfeil({ x1, y1, x2, y2, farbe, text, dx = 0, dy = -6 }: {
  x1: number; y1: number; x2: number; y2: number; farbe: string; text?: string; dx?: number; dy?: number;
}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 3) return null;
  // Spitze selbst zeichnen (context-stroke in Markern kann nicht jeder Browser)
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len, k = Math.min(10, len * 0.6);
  const bx = x2 - ux * k, by = y2 - uy * k;
  const spitze = `${x2},${y2} ${bx - uy * k * 0.55},${by + ux * k * 0.55} ${bx + uy * k * 0.55},${by - ux * k * 0.55}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={farbe} strokeWidth={3} />
      <polygon points={spitze} fill={farbe} />
      {text && <text x={(x1 + x2) / 2 + dx} y={(y1 + y2) / 2 + dy} textAnchor="middle" fontSize={12} fontWeight={800} fill={farbe}
        stroke="var(--surface)" strokeWidth={3.5} paintOrder="stroke">{text}</text>}
    </g>
  );
}

/** Statischer Graph einer Aufgabe. */
export function AufgabenGraph({ spec, label }: { spec: GraphSpec; label?: string }) {
  return <Graph bereich={spec.bereich} label={label}
    kurven={spec.kurven.map(k => ({ f: k.f, farbe: k.farbe, gestrichelt: k.gestrichelt }))}
    punkte={(spec.punkte ?? []).map(p => ({ ...p }))} />;
}

/**
 * Dasselbe als SVG-Text mit festen Druckfarben — für den Word-Export.
 * Absichtlich ohne CSS-Variablen: außerhalb der Seite gibt es die nicht.
 */
export function graphSvgText(spec: GraphSpec, W = 560, H = 380): string {
  const b = spec.bereich;
  const sx = (x: number) => M + ((x - b.x0) / (b.x1 - b.x0)) * (W - 2 * M);
  const sy = (y: number) => H - M - ((y - b.y0) / (b.y1 - b.y0)) * (H - 2 * M);
  const tx = teilung(b.x1 - b.x0), ty = teilung(b.y1 - b.y0);
  const o: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif">`,
    `<rect width="${W}" height="${H}" fill="#fff"/><defs><clipPath id="c"><rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}"/></clipPath></defs>`];
  for (let v = Math.ceil(b.x0 / tx) * tx; v <= b.x1 + 1e-9; v += tx) {
    o.push(`<line x1="${sx(v)}" y1="${M}" x2="${sx(v)}" y2="${H - M}" stroke="#d4d4d4"/>`);
    if (Math.abs(v) > 1e-9) o.push(`<text x="${sx(v)}" y="${Math.min(H - M, Math.max(M, sy(0))) + 14}" font-size="11" text-anchor="middle" fill="#555">${zahl(glatt(v))}</text>`);
  }
  for (let v = Math.ceil(b.y0 / ty) * ty; v <= b.y1 + 1e-9; v += ty) {
    o.push(`<line x1="${M}" y1="${sy(v)}" x2="${W - M}" y2="${sy(v)}" stroke="#d4d4d4"/>`);
    if (Math.abs(v) > 1e-9) o.push(`<text x="${Math.min(W - M, Math.max(M, sx(0))) - 5}" y="${sy(v) + 4}" font-size="11" text-anchor="end" fill="#555">${zahl(glatt(v))}</text>`);
  }
  if (b.y0 <= 0 && b.y1 >= 0) o.push(`<line x1="${M}" y1="${sy(0)}" x2="${W - M}" y2="${sy(0)}" stroke="#222" stroke-width="1.6"/>`);
  if (b.x0 <= 0 && b.x1 >= 0) o.push(`<line x1="${sx(0)}" y1="${H - M}" x2="${sx(0)}" y2="${M}" stroke="#222" stroke-width="1.6"/>`);
  o.push(`<text x="${W - M + 4}" y="${Math.min(H - M, Math.max(M, sy(0))) - 6}" font-size="14" font-weight="700" fill="${FARBE.x}">x</text>`);
  o.push(`<text x="${Math.min(W - M, Math.max(M, sx(0))) + 6}" y="${M - 8}" font-size="14" font-weight="700" fill="${FARBE.y}">y</text>`);
  o.push('<g clip-path="url(#c)">');
  for (const k of spec.kurven) for (const d of pfad(k.f, b, sx, sy))
    o.push(`<path d="${d}" fill="none" stroke="${k.farbe ?? "#e07820"}" stroke-width="2.6"${k.gestrichelt ? ' stroke-dasharray="6 5"' : ""}/>`);
  o.push("</g>");
  for (const p of spec.punkte ?? []) {
    o.push(`<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="5" fill="${FARBE.s}"/>`);
    if (p.label) o.push(`<text x="${sx(p.x) + 8}" y="${sy(p.y) - 8}" font-size="12" font-weight="700" fill="#222">${p.label}</text>`);
  }
  o.push("</svg>");
  return o.join("");
}

/** Wertetabelle quer, wie im Funktionen-Tool: x-Zeile violett. */
export function Wertetabelle({ xs, ys, name = "y", markiert, onZeile }: {
  xs: number[]; ys: number[]; name?: string; markiert?: number | null; onZeile?: (i: number | null) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse" style={{ fontVariantNumeric: "tabular-nums" }}>
        <tbody>
          {[["x", xs, FARBE.x], [name, ys, FARBE.y]].map(([k, werte, c]) => (
            <tr key={k as string} className="border-t border-line first:border-t-0">
              <th scope="row" className="pr-3 py-1 text-left font-bold" style={{ color: c as string }}>{k as string}</th>
              {(werte as number[]).map((v, i) => (
                <td key={i} className="px-2 py-1 border-l border-line text-center cursor-default"
                  style={markiert === i ? { background: "rgba(245,158,11,0.18)" } : undefined}
                  onPointerEnter={() => onZeile?.(i)} onPointerLeave={() => onZeile?.(null)}>{zahl(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
