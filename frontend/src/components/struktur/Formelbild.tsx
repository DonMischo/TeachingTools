"use client";
/**
 * Zeichnet das Molekül als SVG.
 *
 * Drei Darstellungen, wie im Unterricht:
 *   gerade   — Valenzstrichformel in Schulform: Hauptkette waagerecht,
 *              Abzweigungen senkrecht, alle Bindungen gerade
 *   winkel   — dieselbe Formel, aber mit den echten Bindungswinkeln (120°)
 *   skelett  — C-Atome sind nur Knicke, nur Heteroatome tragen ihr Symbol
 *
 * Dazu die Schalter, die man dabei braucht: alle H zeigen, freie
 * Elektronenpaare, drehen und spiegeln.
 *
 * Damit kein Strich durch einen Buchstaben läuft, endet jede Bindung am Rand
 * des Schriftkastens ihres Atoms — nicht in dessen Mitte.
 */
import { useMemo } from "react";
import { hZahl, paare, type Molekuel } from "@/lib/struktur/molekuel";
import { lege, legeGerade } from "@/lib/struktur/layout";

export type Darstellung = "gerade" | "winkel" | "skelett";

export type Optionen = {
  art: Darstellung;
  alleH: boolean;
  paare: boolean;
  drehung: number;
  spiegelX: boolean;
  spiegelY: boolean;
};

export const STANDARD: Optionen = {
  art: "gerade", alleH: false, paare: false, drehung: 0, spiegelX: false, spiegelY: false,
};

/** Bindungslänge in Pixeln. Die Schulform braucht Platz für die H an jedem C. */
const LAENGE: Record<Darstellung, number> = { gerade: 70, winkel: 52, skelett: 46 };
const RAND = 30;
const SCHRIFT = 18;
const SCHRIFT_KLEIN = 15;
/** Luft zwischen Schriftkasten und Strich. */
const LUFT = 3.5;

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
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
        ))}
      </g>
      {bild.punkte.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.1} fill="var(--text)" />
      ))}
      {bild.texte.map((t, i) => (
        <text key={i} x={t.x} y={t.y} textAnchor="middle" dominantBaseline="central"
          fontSize={t.klein ? SCHRIFT_KLEIN : SCHRIFT} fontWeight={700} fill={t.farbe}>
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

type Strich = { x1: number; y1: number; x2: number; y2: number };
type Beschriftung = { x: number; y: number; text: string; farbe: string; klein?: boolean };
/** Halbe Breite und Höhe des Schriftkastens, an dem die Striche enden. */
type Kasten = { hb: number; hh: number };

/** Grobe Schriftbreite: Hochzahlen zählen schmaler, Buchstaben voll. */
function kastenFuer(text: string, klein: boolean): Kasten {
  const groesse = klein ? SCHRIFT_KLEIN : SCHRIFT;
  const breite = [...text].reduce((s, z) => s + ("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻".includes(z) ? 0.34 : 0.62), 0);
  return { hb: (breite * groesse) / 2 + LUFT, hh: groesse * 0.5 + LUFT };
}

/**
 * Wie weit ein Strich vom Atommittelpunkt aus freibleiben muss, damit er am
 * Kasten endet statt im Buchstaben: der Schnittpunkt der Richtung mit dem
 * Rechteck.
 */
function abstandZumRand(k: Kasten, dx: number, dy: number): number {
  const len = Math.hypot(dx, dy) || 1;
  const [ex, ey] = [Math.abs(dx / len), Math.abs(dy / len)];
  return Math.min(ex > 1e-6 ? k.hb / ex : Infinity, ey > 1e-6 ? k.hh / ey : Infinity);
}

/**
 * Baut Striche und Beschriftungen. Ausgelagert, damit der Export dieselbe
 * Rechnung benutzt wie die Anzeige.
 */
export function zeichne(m: Molekuel, opt: Optionen) {
  const L = LAENGE[opt.art];
  const lage = opt.art === "gerade" ? legeGerade(m) : lege(m);
  const w = (opt.drehung * Math.PI) / 180;
  const cos = Math.cos(w), sin = Math.sin(w);

  // Erst drehen und spiegeln, dann auf Pixel bringen.
  let pts = lage.punkte.map(p => ({
    x: (opt.spiegelX ? -p.x : p.x) * cos - (opt.spiegelY ? -p.y : p.y) * sin,
    y: (opt.spiegelX ? -p.x : p.x) * sin + (opt.spiegelY ? -p.y : p.y) * cos,
  }));
  const minX = Math.min(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y));
  pts = pts.map(p => ({ x: (p.x - minX) * L + RAND, y: (p.y - minY) * L + RAND }));

  const striche: Strich[] = [];
  const texte: Beschriftung[] = [];
  const punkte: { x: number; y: number }[] = [];

  // 1. Beschriftungen zuerst — die Striche brauchen die Kastengrößen.
  const alleAtome = opt.art !== "skelett";
  const kasten: (Kasten | null)[] = m.atome.map(() => null);

  m.atome.forEach((a, i) => {
    const beschriftet = alleAtome || a.el !== "C" || (opt.alleH && hZahl(m, i) > 0) || m.atome.length === 1;
    if (!beschriftet) {
      // In der Skelettformel ist ein C-Atom nur ein Knick — außer wenn es
      // allein steht, denn dann wäre nichts zu sehen.
      if (!m.bindungen.some(b => b.a === i || b.b === i)) punkte.push(pts[i]);
      return;
    }
    const h = hZahl(m, i);
    // Nur die Skelettformel schreibt H ans Symbol; sonst steht jedes H einzeln.
    const zeigeH = !alleAtome && (opt.alleH || a.el !== "C");
    const ladung = a.ladung
      ? (Math.abs(a.ladung) > 1 ? hoch(Math.abs(a.ladung)) : "") + (a.ladung > 0 ? "⁺" : "⁻")
      : "";
    const text = a.el + (zeigeH && h ? `H${h > 1 ? hoch(h) : ""}` : "") + ladung;
    kasten[i] = kastenFuer(text, false);
    texte.push({ x: pts[i].x, y: pts[i].y, text, farbe: FARBE[a.el] ?? "var(--text)" });
  });

  // 2. Bindungen — jede endet am Schriftkasten ihrer beiden Atome.
  for (const b of m.bindungen) {
    const p = pts[b.a], q = pts[b.b];
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const vonA = kasten[b.a] ? abstandZumRand(kasten[b.a]!, dx, dy) : 0;
    const vonB = kasten[b.b] ? abstandZumRand(kasten[b.b]!, dx, dy) : 0;
    const x1 = p.x + (dx / len) * vonA, y1 = p.y + (dy / len) * vonA;
    const x2 = q.x - (dx / len) * vonB, y2 = q.y - (dy / len) * vonB;
    const nx = (-dy / len) * 4.5, ny = (dx / len) * 4.5;
    const versatz = b.grad === 1 ? [0] : b.grad === 2 ? [-1, 1] : [-1, 0, 1];
    for (const v of versatz) {
      striche.push({ x1: x1 + nx * v, y1: y1 + ny * v, x2: x2 + nx * v, y2: y2 + ny * v });
    }
  }

  // 3. Wasserstoff als eigenes Atom am Strich (nicht in der Skelettformel).
  if (alleAtome) {
    // Etwas kürzer als eine Bindung — das H gehört sichtbar zu seinem Atom.
    // Wird es eng, zieht freieRichtung den Strich von sich aus weiter ein.
    const hAbstand = L * 0.54;
    // Jedes schon gesetzte Symbol zählt — sonst stellen zwei Gruppen ihre
    // H-Atome in dieselbe Lücke zwischen sich.
    const besetzt: { x: number; y: number }[] = m.atome.map((_, i) => pts[i]);
    m.atome.forEach((a, i) => {
      const h = hZahl(m, i);
      if (!h) return;
      const p = pts[i];
      const belegt = m.bindungen.flatMap(b => (b.a === i ? [pts[b.b]] : b.b === i ? [pts[b.a]] : []));
      const hKasten = kastenFuer("H", true);
      for (let k = 0; k < h; k++) {
        const ziel = freieRichtung(p, belegt, hAbstand, opt.art === "gerade", besetzt,
          d => eng(m, pts, i, p, d, L) ? L * 0.33 : hAbstand);
        belegt.push(ziel);
        besetzt.push(ziel);
        const dx = ziel.x - p.x, dy = ziel.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const vonA = kasten[i] ? abstandZumRand(kasten[i]!, dx, dy) : 0;
        const vonH = abstandZumRand(hKasten, dx, dy);
        striche.push({
          x1: p.x + (dx / len) * vonA, y1: p.y + (dy / len) * vonA,
          x2: ziel.x - (dx / len) * vonH, y2: ziel.y - (dy / len) * vonH,
        });
        texte.push({ x: ziel.x, y: ziel.y, text: "H", farbe: "var(--text)", klein: true });
      }
    });
  }

  // 4. Freie Elektronenpaare als zwei Punkte quer zur Bindung.
  if (opt.paare) {
    m.atome.forEach((a, i) => {
      const n = paare(m, i);
      if (!n) return;
      const p = pts[i];
      const belegt = m.bindungen.flatMap(b => (b.a === i ? [pts[b.b]] : b.b === i ? [pts[b.a]] : []));
      // Die H-Striche an diesem Atom zählen mit, sonst liegen Paare darauf.
      for (const t of texte) {
        if (t.text === "H" && Math.hypot(t.x - p.x, t.y - p.y) < L * 0.8) belegt.push({ x: t.x, y: t.y });
      }
      const weg = (kasten[i]?.hb ?? 6) + 9;
      for (let k = 0; k < n; k++) {
        const ziel = freieRichtung(p, belegt, weg, false, []);
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
  // Elektronenpaare stehen weiter außen und würden sonst abgeschnitten.
  const xs = [
    ...striche.flatMap(s => [s.x1, s.x2]),
    ...texte.flatMap(t => [t.x - kastenFuer(t.text, !!t.klein).hb, t.x + kastenFuer(t.text, !!t.klein).hb]),
    ...punkte.map(p => p.x),
  ];
  const ys = [
    ...striche.flatMap(s => [s.y1, s.y2]),
    ...texte.flatMap(t => [t.y - kastenFuer(t.text, !!t.klein).hh, t.y + kastenFuer(t.text, !!t.klein).hh]),
    ...punkte.map(p => p.y),
  ];
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
 * Steht in dieser Richtung eine Bindungslänge weiter ein fremdes Atom?
 *
 * Dann teilen sich zwei Gruppen den Platz dazwischen — etwa zwei Reste, die
 * nebeneinander an der Kette hängen. Beide erkennen das gleichermaßen und
 * ziehen ihre H-Atome darum gleich weit ein, statt dass eines ausweicht.
 */
function eng(
  m: Molekuel, pts: { x: number; y: number }[], i: number,
  p: { x: number; y: number }, d: { x: number; y: number }, L: number,
): boolean {
  const ziel = { x: p.x + d.x * L, y: p.y + d.y * L };
  return pts.some((q, j) =>
    j !== i
    && !m.bindungen.some(b => (b.a === i && b.b === j) || (b.a === j && b.b === i))
    && Math.hypot(q.x - ziel.x, q.y - ziel.y) < L * 0.3);
}

/**
 * Die Richtung um `p` mit dem größten Winkelabstand zu allem Belegten.
 *
 * In der Schulform werden zuerst die vier geraden Richtungen geprüft und nur
 * dann die schrägen, damit die H-Atome über, unter und neben dem Atom stehen
 * statt schief daneben.
 */
function freieRichtung(
  p: { x: number; y: number }, belegt: { x: number; y: number }[], r: number, gerade: boolean,
  meiden: { x: number; y: number }[],
  /** Wie weit das Symbol in dieser Richtung weg darf — knapper, wo es eng ist. */
  weite?: (d: { x: number; y: number }) => number,
) {
  const winkel = belegt.map(q => Math.atan2(q.y - p.y, q.x - p.x));
  const abstand = (w: number) =>
    winkel.length
      ? Math.min(...winkel.map(b => Math.abs(Math.atan2(Math.sin(w - b), Math.cos(w - b)))))
      : Math.PI;
  const punkt = (w: number) => ({ x: p.x + r * Math.cos(w), y: p.y + r * Math.sin(w) });
  /** Wie nah käme das Symbol einem anderen? Weniger als MINDEST ist zu nah. */
  const naehe = (q: { x: number; y: number }) =>
    meiden.length ? Math.min(...meiden.map(o => Math.hypot(o.x - q.x, o.y - q.y))) : Infinity;
  const MINDEST = 21;

  if (gerade) {
    // Nur oben, unten, rechts, links — in der Schulform steht nichts schief.
    // Das geht immer auf: ein Atom hat höchstens vier Bindungen und das
    // Gitter vier gerade Richtungen, also bleibt für jedes H eine frei.
    const reihe = [-90, 90, 0, 180].map(g => (g * Math.PI) / 180);
    const frei = reihe.filter(w => abstand(w) > Math.PI / 4 - 0.01);
    const kandidaten = frei.length ? frei : reihe;
    const w = kandidaten.reduce((a, b) => (naehe(punkt(b)) > naehe(punkt(a)) ? b : a));
    // Wird es trotzdem eng, den Strich einziehen: zwei H, die sich gegenüber
    // stehen, rücken dadurch auseinander statt schief auszuweichen.
    const voll = weite ? weite({ x: Math.cos(w), y: Math.sin(w) }) : r;
    let kurz = voll;
    while (kurz > voll * 0.6) {
      const q = { x: p.x + kurz * Math.cos(w), y: p.y + kurz * Math.sin(w) };
      if (naehe(q) >= MINDEST) return q;
      kurz -= voll * 0.08;
    }
    return { x: p.x + kurz * Math.cos(w), y: p.y + kurz * Math.sin(w) };
  }
  // Sonst: die Richtung mit dem größten Winkelabstand, die niemandem zu nah kommt.
  let beste = punkt(0), weit = -1;
  for (const nurFreie of [true, false]) {
    for (let k = 0; k < 72; k++) {
      const w = (2 * Math.PI * k) / 72;
      if (nurFreie && naehe(punkt(w)) < MINDEST) continue;
      if (abstand(w) > weit) { weit = abstand(w); beste = punkt(w); }
    }
    if (weit >= 0) break;
  }
  return beste;
}
