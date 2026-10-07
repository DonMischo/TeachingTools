"use client";
/**
 * Zeichnet das Molekül als SVG.
 *
 * Zwei Darstellungen, wie im Unterricht:
 *   Skelettformel     — C-Atome sind nur Knicke, nur Heteroatome tragen ihr Symbol
 *   Valenzstrichformel — jedes Atom steht da, jede Bindung als Strich
 *
 * Dazu die Schalter, die man dabei braucht: alle H zeigen, freie
 * Elektronenpaare, drehen und spiegeln.
 */
import { useMemo } from "react";
import { hZahl, paare, type Molekuel } from "@/lib/struktur/molekuel";
import { lege } from "@/lib/struktur/layout";

export type Darstellung = "skelett" | "valenz";

export type Optionen = {
  art: Darstellung;
  alleH: boolean;
  paare: boolean;
  drehung: number;
  spiegelX: boolean;
  spiegelY: boolean;
};

export const STANDARD: Optionen = {
  art: "skelett", alleH: false, paare: false, drehung: 0, spiegelX: false, spiegelY: false,
};

/** Bindungslänge in Pixeln. */
const L = 46;
const RAND = 34;

/** Farben der Heteroatome — dieselben wie in der Gleichungswaage (CPK). */
const FARBE: Record<string, string> = {
  O: "#ff2d2d", N: "#3050f8", S: "#e8d21c", P: "#ff8000",
  F: "#7ecb45", Cl: "#3bc93b", Br: "#a62929", I: "#940094",
};

const hoch = (n: number): string =>
  String(n).replace(/\d/g, d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]);

export default function Formelbild({ m, opt, titel }: {
  m: Molekuel;
  opt: Optionen;
  /** Name unter dem Bild — bleibt beim Herunterladen stehen. */
  titel?: string;
}) {
  const bild = useMemo(() => zeichne(m, opt), [m, opt]);
  const hoeheMitTitel = bild.hoehe + (titel ? 30 : 0);

  return (
    <svg viewBox={`0 0 ${bild.breite} ${hoeheMitTitel}`} width="100%"
      style={{ maxHeight: 460 }} role="img" aria-label={titel ?? "Strukturformel"}>
      <g fill="none" stroke="var(--text)" strokeWidth={2} strokeLinecap="round">
        {bild.striche.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.farbe ?? "var(--text)"} />
        ))}
      </g>
      {bild.punkte.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.1} fill="var(--text)" />
      ))}
      {bild.texte.map((t, i) => (
        <text key={i} x={t.x} y={t.y} textAnchor="middle" dominantBaseline="central"
          fontSize={t.klein ? 13 : 18} fontWeight={700} fill={t.farbe}
          style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 5 }}>
          {t.text}
        </text>
      ))}
      {titel && (
        <text x={bild.breite / 2} y={hoeheMitTitel - 10} textAnchor="middle"
          fontSize={15} fill="var(--text-muted)">{titel}</text>
      )}
    </svg>
  );
}

type Strich = { x1: number; y1: number; x2: number; y2: number; farbe?: string };
type Beschriftung = { x: number; y: number; text: string; farbe: string; klein?: boolean };

/**
 * Baut Striche und Beschriftungen. Ausgelagert, damit der Export dieselbe
 * Rechnung benutzt wie die Anzeige.
 */
export function zeichne(m: Molekuel, opt: Optionen) {
  const lage = lege(m);
  const w = (opt.drehung * Math.PI) / 180;
  const cos = Math.cos(w), sin = Math.sin(w);

  // Erst drehen und spiegeln, dann auf Pixel bringen.
  let pts = lage.punkte.map(p => ({
    x: (opt.spiegelX ? -p.x : p.x) * cos - (opt.spiegelY ? -p.y : p.y) * sin,
    y: (opt.spiegelX ? -p.x : p.x) * sin + (opt.spiegelY ? -p.y : p.y) * cos,
  }));
  const minX = Math.min(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y));
  pts = pts.map(p => ({ x: (p.x - minX) * L + RAND, y: (p.y - minY) * L + RAND }));

  /** Welche Atome bekommen ein Symbol? */
  const beschriftet = m.atome.map((a, i) =>
    opt.art === "valenz" || a.el !== "C" || (opt.alleH && hZahl(m, i) > 0) || m.atome.length === 1);

  const striche: Strich[] = [];
  const texte: Beschriftung[] = [];
  const punkte: { x: number; y: number }[] = [];

  // Bindungen. Mehrfachbindungen als parallele Striche daneben.
  for (const b of m.bindungen) {
    const p = pts[b.a], q = pts[b.b];
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // Beschriftete Enden freistellen, damit der Strich nicht im Buchstaben endet.
    const kurz = (von: number) => (beschriftet[von] ? 13 / len : 0);
    const a0 = kurz(b.a), a1 = kurz(b.b);
    const x1 = p.x + dx * a0, y1 = p.y + dy * a0;
    const x2 = q.x - dx * a1, y2 = q.y - dy * a1;
    const nx = (-dy / len) * 4.5, ny = (dx / len) * 4.5;
    const versatz = b.grad === 1 ? [0] : b.grad === 2 ? [-1, 1] : [-1, 0, 1];
    for (const v of versatz) {
      striche.push({ x1: x1 + nx * v, y1: y1 + ny * v, x2: x2 + nx * v, y2: y2 + ny * v });
    }
  }

  // Atome.
  m.atome.forEach((a, i) => {
    const p = pts[i];
    const farbe = FARBE[a.el] ?? "var(--text)";
    if (!beschriftet[i]) {
      // In der Skelettformel ist ein C-Atom nur ein Knick — außer am Kettenende,
      // wo ohne Punkt nichts zu sehen wäre.
      if (m.bindungen.filter(b => b.a === i || b.b === i).length === 0) punkte.push(p);
      return;
    }
    const h = hZahl(m, i);
    const zeigeH = opt.art === "valenz" ? false : opt.alleH || a.el !== "C";
    const ladung = a.ladung
      ? (Math.abs(a.ladung) > 1 ? hoch(Math.abs(a.ladung)) : "") + (a.ladung > 0 ? "⁺" : "⁻")
      : "";
    texte.push({
      x: p.x, y: p.y, farbe,
      text: a.el + (zeigeH && h ? `H${h > 1 ? hoch(h) : ""}` : "") + ladung,
    });
  });

  // In der Valenzstrichformel steht jedes H als eigenes Atom am Strich.
  if (opt.art === "valenz") {
    m.atome.forEach((a, i) => {
      const h = hZahl(m, i);
      if (!h) return;
      const p = pts[i];
      const belegt = m.bindungen.flatMap(b => (b.a === i ? [pts[b.b]] : b.b === i ? [pts[b.a]] : []));
      for (let k = 0; k < h; k++) {
        const ziel = freieRichtung(p, belegt, L * 0.62);
        belegt.push(ziel);
        striche.push({ x1: p.x, y1: p.y, x2: ziel.x, y2: ziel.y });
        texte.push({ x: ziel.x, y: ziel.y, text: "H", farbe: "var(--text)", klein: true });
      }
    });
  }

  // Freie Elektronenpaare als zwei Punkte quer zur Bindung.
  if (opt.paare) {
    m.atome.forEach((a, i) => {
      const n = paare(m, i);
      if (!n) return;
      const p = pts[i];
      const belegt = m.bindungen.flatMap(b => (b.a === i ? [pts[b.b]] : b.b === i ? [pts[b.a]] : []));
      for (let k = 0; k < n; k++) {
        const ziel = freieRichtung(p, belegt, 17);
        belegt.push(ziel);
        const dx = ziel.x - p.x, dy = ziel.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * 3.4, ny = (dx / len) * 3.4;
        punkte.push({ x: ziel.x + nx, y: ziel.y + ny });
        punkte.push({ x: ziel.x - nx, y: ziel.y - ny });
      }
    });
  }

  // Der Rahmen umfasst alles Gezeichnete, nicht nur die Atome: H-Atome und
  // Elektronenpaare stehen weiter außen und wuerden sonst abgeschnitten.
  const xs = [...striche.flatMap(s => [s.x1, s.x2]), ...texte.map(t => t.x), ...punkte.map(p => p.x)];
  const ys = [...striche.flatMap(s => [s.y1, s.y2]), ...texte.map(t => t.y), ...punkte.map(p => p.y)];
  const minRX = Math.min(...xs) - RAND, minRY = Math.min(...ys) - RAND;
  for (const s of striche) { s.x1 -= minRX; s.x2 -= minRX; s.y1 -= minRY; s.y2 -= minRY; }
  for (const t of texte) { t.x -= minRX; t.y -= minRY; }
  for (const p of punkte) { p.x -= minRX; p.y -= minRY; }

  return {
    striche, texte, punkte,
    breite: Math.max(...xs) - minRX + RAND,
    hoehe: Math.max(...ys) - minRY + RAND,
  };
}

/**
 * Die Richtung um `p` mit dem größten Winkelabstand zu allem Belegten — so
 * verteilen sich H-Atome und Elektronenpaare gleichmäßig ums Atom herum.
 */
function freieRichtung(p: { x: number; y: number }, belegt: { x: number; y: number }[], r: number) {
  const winkel = belegt.map(q => Math.atan2(q.y - p.y, q.x - p.x));
  let beste = { x: p.x + r, y: p.y };
  let weit = -1;
  for (let k = 0; k < 72; k++) {
    const w = (2 * Math.PI * k) / 72;
    const d = winkel.length
      ? Math.min(...winkel.map(b => Math.abs(Math.atan2(Math.sin(w - b), Math.cos(w - b)))))
      : Infinity;
    if (d > weit) { weit = d; beste = { x: p.x + r * Math.cos(w), y: p.y + r * Math.sin(w) }; }
  }
  return beste;
}
