"use client";
/**
 * Zeichenfläche der Sim »dreiecke«: ein Dreieck in Weltkoordinaten (1 Einheit
 * = 1 cm, y nach unten), dessen Ecken sich mit Maus oder Finger ziehen lassen.
 * `fang` legt fest, wohin eine gezogene Ecke darf bzw. einrastet; was sonst zu
 * sehen ist (Winkelbögen, Linien, Kreise), malt der Aufrufer über `kinder`.
 * Dazu kleine SVG-Bausteine: Keil (Winkelbogen), Linie, Beschriftung.
 */
import { useRef, useState, type ReactNode } from "react";
import type { Pt } from "@/lib/geometrie/skizze";
import type { Dreieck } from "@/lib/dreiecke";

export const WELT = { x0: -1, y0: -0.5, b: 14, h: 9.5 };
export const K = 50;
export const VB = { w: WELT.b * K, h: WELT.h * K };
export const T = (p: Pt) => ({ x: (p.x - WELT.x0) * K, y: (p.y - WELT.y0) * K });

/** Farben je Winkel bzw. Linienart — Druckfarben, die in beiden Themen lesbar sind. */
export const FARBE = { alpha: "#2563eb", beta: "#16a34a", gamma: "#d97706", rot: "#dc2626", lila: "#9333ea", tuerkis: "#0891b2" };

export function Txt({ p, children, farbe = "var(--text)", groesse = 16, anker = "middle" }:
  { p: { x: number; y: number }; children: ReactNode; farbe?: string; groesse?: number; anker?: "start" | "middle" | "end" }) {
  return <text x={p.x} y={p.y} textAnchor={anker} dominantBaseline="central" fontSize={groesse} fontWeight={700} fill={farbe}
    stroke="var(--surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" pointerEvents="none">{children}</text>;
}

/** Richtung (Bildschirm-Winkel) von p nach q */
export const richtung = (p: Pt, q: Pt) => Math.atan2(q.y - p.y, q.x - p.x);
const norm = (w: number) => { while (w <= -Math.PI) w += 2 * Math.PI; while (w > Math.PI) w -= 2 * Math.PI; return w; };

/** Der kleinere Winkel bei p zwischen den Strahlen nach q und r: Startrichtung und Weite (im Uhrzeigersinn). */
export function keilVon(p: Pt, q: Pt, r: Pt) {
  const a = richtung(p, q), d = norm(richtung(p, r) - a);
  return d >= 0 ? { s: a, w: d } : { s: a + d, w: -d };
}

/** Winkelbogen als gefüllter Keil, in Weltkoordinaten. */
export function Keil({ p, q, r, farbe, radius = 0.9, text, deckkraft = 0.35, transform }:
  { p: Pt; q: Pt; r: Pt; farbe: string; radius?: number; text?: string; deckkraft?: number; transform?: string }) {
  const { s, w } = keilVon(p, q, r);
  const c = T(p), R = radius * K;
  const pt = (t: number) => `${c.x + R * Math.cos(t)} ${c.y + R * Math.sin(t)}`;
  const mitte = s + w / 2, ab = R + 16 + (text ? text.length * 2.5 : 0);
  return (
    <g transform={transform} pointerEvents="none">
      <path d={`M ${c.x} ${c.y} L ${pt(s)} A ${R} ${R} 0 ${w > Math.PI ? 1 : 0} 1 ${pt(s + w)} Z`} fill={farbe} fillOpacity={deckkraft} stroke={farbe} strokeWidth={1.5} />
      {text && <Txt p={{ x: c.x + ab * Math.cos(mitte), y: c.y + ab * Math.sin(mitte) }} farbe={farbe} groesse={14}>{text}</Txt>}
    </g>
  );
}

/** Rechter-Winkel-Zeichen bei p zwischen den Richtungen nach q und r. */
export function RechterWinkel({ p, q, r, farbe = "var(--text-muted)" }: { p: Pt; q: Pt; r: Pt; farbe?: string }) {
  // groß genug, dass der Ziehgriff an der Ecke das Zeichen nicht verdeckt
  const c = T(p), e = 24;
  const u = (z: Pt) => { const a = richtung(p, z); return { x: Math.cos(a), y: Math.sin(a) }; };
  const a = u(q), b = u(r);
  return (
    <g pointerEvents="none">
      <path d={`M ${c.x + a.x * e} ${c.y + a.y * e} L ${c.x + (a.x + b.x) * e} ${c.y + (a.y + b.y) * e} L ${c.x + b.x * e} ${c.y + b.y * e}`} fill="none" stroke={farbe} strokeWidth={1.5} />
      <circle cx={c.x + (a.x + b.x) * e * 0.5} cy={c.y + (a.y + b.y) * e * 0.5} r={1.8} fill={farbe} />
    </g>
  );
}

export function Linie({ a, b, farbe = "var(--text-muted)", breite = 2, gestrichelt = false }: { a: Pt; b: Pt; farbe?: string; breite?: number; gestrichelt?: boolean }) {
  const p = T(a), q = T(b);
  return <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={farbe} strokeWidth={breite} strokeDasharray={gestrichelt ? "7 5" : undefined} strokeLinecap="round" pointerEvents="none" />;
}

/** Gerade durch a und b, über die ganze Zeichenfläche verlängert. */
export function Gerade({ a, b, ...rest }: { a: Pt; b: Pt; farbe?: string; breite?: number; gestrichelt?: boolean }) {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, L = 40;
  return <Linie a={{ x: a.x - dx / l * L, y: a.y - dy / l * L }} b={{ x: a.x + dx / l * L, y: a.y + dy / l * L }} {...rest} />;
}

export function Punkt({ p, text, farbe = "var(--text)" }: { p: Pt; text?: string; farbe?: string }) {
  const c = T(p);
  return (
    <g pointerEvents="none">
      <circle cx={c.x} cy={c.y} r={5} fill={farbe} stroke="var(--surface)" strokeWidth={1.5} />
      {text && <Txt p={{ x: c.x + 13, y: c.y - 13 }} farbe={farbe}>{text}</Txt>}
    </g>
  );
}

/** Text an einer Seite, nach außen gerückt (weg von `innen`). */
export function SeitenText({ a, b, innen, children, farbe = "var(--text)", ab = 18, groesse = 15 }:
  { a: Pt; b: Pt; innen: Pt; children: ReactNode; farbe?: string; ab?: number; groesse?: number }) {
  const p = T(a), q = T(b), m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, i = T(innen);
  const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
  let n = { x: -dy / l, y: dx / l };
  if ((m.x - i.x) * n.x + (m.y - i.y) * n.y < 0) n = { x: -n.x, y: -n.y };
  return <Txt p={{ x: m.x + n.x * ab, y: m.y + n.y * ab }} farbe={farbe} groesse={groesse}>{children}</Txt>;
}

/** Strichmarke(n) quer zur Seite — gleich viele Striche heißt gleich lang. */
export function Marke({ a, b, n = 1, farbe = "var(--text)" }: { a: Pt; b: Pt; n?: number; farbe?: string }) {
  const p = T(a), q = T(b), m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1, u = { x: dx / l, y: dy / l }, v = { x: -u.y, y: u.x };
  return (
    <g stroke={farbe} strokeWidth={2.5} pointerEvents="none">
      {Array.from({ length: n }, (_, i) => {
        const o = (i - (n - 1) / 2) * 6;
        return <line key={i} x1={m.x + u.x * o - v.x * 8} y1={m.y + u.y * o - v.y * 8} x2={m.x + u.x * o + v.x * 8} y2={m.y + u.y * o + v.y * 8} />;
      })}
    </g>
  );
}

const NAMEN = ["A", "B", "C"];

type Props = {
  d: Dreieck;
  setD?: (d: Dreieck) => void;
  /** Wohin Ecke i beim Ziehen nach p darf (Einrasten, Zwangslage) */
  fang?: (i: number, p: Pt, d: Dreieck) => Pt;
  ziehbar?: [boolean, boolean, boolean];
  /** unter dem Dreieck */
  hinten?: ReactNode;
  /** über dem Dreieck, unter den Griffen */
  kinder?: ReactNode;
  fuellung?: string;
  label: string;
  namen?: boolean;
};

export default function Zeichenblatt({ d, setD, fang, ziehbar = [true, true, true], hinten, kinder, fuellung = "var(--accent)", label, namen = true }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [zieht, setZieht] = useState<number | null>(null);
  const welt = (e: React.PointerEvent): Pt | null => {
    const m = svg.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return {
      x: Math.min(WELT.x0 + WELT.b - 0.3, Math.max(WELT.x0 + 0.3, p.x / K + WELT.x0)),
      y: Math.min(WELT.y0 + WELT.h - 0.3, Math.max(WELT.y0 + 0.3, p.y / K + WELT.y0)),
    };
  };
  const bewege = (e: React.PointerEvent) => {
    if (zieht === null || !setD) return;
    const p = welt(e);
    if (!p) return;
    const neu = [...d] as Dreieck;
    neu[zieht] = fang ? fang(zieht, p, d) : p;
    setD(neu);
  };
  const s = { x: (d[0].x + d[1].x + d[2].x) / 3, y: (d[0].y + d[1].y + d[2].y) / 3 };
  return (
    <svg ref={svg} viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full h-auto max-h-[70vh] rounded-xl border border-line bg-surface touch-none select-none"
      role="img" aria-label={label} onPointerMove={bewege} onPointerUp={() => setZieht(null)} onPointerLeave={() => setZieht(null)}>
      <g stroke="var(--border)" strokeWidth={1} opacity={0.35} pointerEvents="none">
        {Array.from({ length: WELT.b + 1 }, (_, i) => <line key={`x${i}`} x1={i * K} y1={0} x2={i * K} y2={VB.h} />)}
        {Array.from({ length: Math.ceil(WELT.h) + 1 }, (_, i) => <line key={`y${i}`} x1={0} y1={i * K} x2={VB.w} y2={i * K} />)}
      </g>
      {hinten}
      <polygon points={d.map(p => { const q = T(p); return `${q.x},${q.y}`; }).join(" ")} fill={fuellung} fillOpacity={0.12}
        stroke={fuellung} strokeWidth={3} strokeLinejoin="round" pointerEvents="none" />
      {kinder}
      {d.map((p, i) => {
        const c = T(p), cs = T(s), dx = c.x - cs.x, dy = c.y - cs.y, l = Math.hypot(dx, dy) || 1;
        const kannZiehen = ziehbar[i] && !!setD;
        return (
          <g key={i}>
            {namen && <Txt p={{ x: c.x + dx / l * 24, y: c.y + dy / l * 24 }} groesse={18}>{NAMEN[i]}</Txt>}
            {kannZiehen ? (
              <circle cx={c.x} cy={c.y} r={zieht === i ? 13 : 10} fill="var(--accent)" fillOpacity={0.85} stroke="var(--surface)" strokeWidth={2.5}
                style={{ cursor: "grab" }} role="slider" aria-label={`Ecke ${NAMEN[i]} ziehen`} aria-valuenow={Math.round(p.x * 10) / 10}
                onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); setZieht(i); }} />
            ) : <circle cx={c.x} cy={c.y} r={5} fill="var(--text)" pointerEvents="none" />}
          </g>
        );
      })}
    </svg>
  );
}
