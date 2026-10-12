/**
 * Herleitung der Flächenformeln als Trickfilm — reine Geometrie, kein React.
 *
 * Jede Form liefert eine Folge von Schritten (Dauer + Satz für die Tafel)
 * und eine Funktion `frame(t)`, die zum Zeitpunkt t (Sekunden bei Tempo 1)
 * die Teile beschreibt: Vielecke, Linien, Beschriftungen — in Einheiten der
 * Form, nicht in Pixeln. Die Komponente skaliert und zeichnet nur noch.
 *
 * Vorbild ist das Vierecke-Smartboard-Tool im Mathetool-Ordner, aber mit den
 * eingestellten Maßen statt fester Zahlen:
 *   Parallelogramm — Dreieck abschneiden, rüberschieben → Rechteck a · h.
 *                    Ist es so schief, dass der Schnitt nicht passt, wird es
 *                    als Kartenstapel geradegeschoben.
 *   Trapez         — zweites Trapez um die Mitte des Schenkels drehen →
 *                    Parallelogramm (a + c) · h → Rechteck → Hälfte.
 *   Raute, Drachen — Rechteck e · f drumherum, die vier Ecken nach innen
 *                    drehen → sie füllen die Form genau: halbes Rechteck.
 */
import type { Pt, ShapeKey, Vals } from "@/lib/vierecke";

/** orig = die Form selbst, copy = ihr Zwilling, outer = Ergänzung außen. */
export type Kind = "orig" | "copy" | "outer";

export type Piece = { pts: Pt[]; kind: Kind; alpha: number };
export type Line = { a: Pt; b: Pt; kind: "hoehe" | "diag" | "umriss" | "ziel"; alpha: number };
export type Label = { at: Pt; text: string; alpha: number; kind?: "hoehe" | "formel" };
export type Frame = { pieces: Piece[]; lines: Line[]; labels: Label[] };

export type Step = { dur: number; text: string };
export type Herleitung = { steps: Step[]; frame: (t: number) => Frame };

/* ─────────────────────────────────────────────────────────── Hilfen ── */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Weich an- und auslaufen. */
const ease = (x: number) => x * x * (3 - 2 * x);
const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const add = (p: Pt, dx: number, dy: number): Pt => ({ x: p.x + dx, y: p.y + dy });

/** Die vier Seiten eines Rechtecks als Ziellinien. */
function rahmen(x: number, y: number, w: number, h: number, alpha: number): Line[] {
  const p = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  return p.map((a, i) => ({ a, b: p[(i + 1) % 4], kind: "ziel" as const, alpha }));
}

function rot(p: Pt, c: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180, s = Math.sin(r), k = Math.cos(r);
  const x = p.x - c.x, y = p.y - c.y;
  return { x: c.x + x * k - y * s, y: c.y + x * s + y * k };
}

/** Startzeiten der Schritte. */
export function starts(steps: Step[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const s of steps) { out.push(t); t += s.dur; }
  return out;
}

export const total = (steps: Step[]) => steps.reduce((s, x) => s + x.dur, 0);

/**
 * Fortschritt 0…1 der Bewegung in Schritt i. Bewegt wird in den ersten
 * zwei Dritteln, danach steht das Bild — Zeit zum Mitlesen.
 */
function stepper(steps: Step[], t: number) {
  const at = starts(steps);
  return (i: number) => ease(clamp01((t - at[i]) / (steps[i].dur * 0.66)));
}

/* ───────────────────────────────────────────────────── Parallelogramm ── */

function parallelogramm({ a, b, h }: Vals): Herleitung {
  const hh = Math.min(h, b);
  const dx = Math.sqrt(Math.max(0, b * b - hh * hh));
  const A = { x: 0, y: hh }, B = { x: a, y: hh }, C = { x: dx + a, y: 0 }, D = { x: dx, y: 0 };
  const F = { x: dx, y: hh }; // Fußpunkt der Höhe

  const labelsEnde = (alpha: number): Label[] => [
    { at: { x: dx + a / 2, y: hh + 0.7 }, text: "a", alpha },
    { at: { x: dx - 0.45, y: hh / 2 }, text: "h", alpha, kind: "hoehe" },
    { at: { x: dx + a / 2, y: hh + 1.7 }, text: "A = a · h", alpha, kind: "formel" },
  ];

  // Schnitt entlang der Höhe passt nur, wenn deren Fußpunkt auf a liegt.
  if (dx <= a) {
    const steps: Step[] = [
      { dur: 4, text: "Das ist das Parallelogramm. Die Grundseite ist a, die Höhe h steht senkrecht darauf." },
      { dur: 4, text: "Entlang der Höhe schneiden wir links ein rechtwinkliges Dreieck ab …" },
      { dur: 5, text: "… und schieben es nach rechts an die andere Seite." },
      { dur: 5, text: "Es entsteht ein Rechteck mit den Seiten a und h. Also: A = a · h." },
    ];
    return {
      steps,
      frame(t) {
        const P = stepper(steps, t);
        const shift = -0.5 * P(1) + (a + 0.5) * P(2);
        const start = 1 - P(3);
        return {
          pieces: [
            { pts: [F, B, C, D], kind: "orig", alpha: 1 },
            { pts: [A, F, D].map(p => add(p, shift, 0)), kind: "copy", alpha: P(1) > 0 ? 1 : 0 },
            // Vor dem Schnitt ist das Dreieck noch Teil der Form.
            { pts: [A, F, D], kind: "orig", alpha: P(1) > 0 ? 0 : 1 },
          ],
          lines: [
            { a: D, b: F, kind: "hoehe", alpha: 1 },
            ...rahmen(dx, 0, a, hh, P(3)),
          ],
          labels: [
            { at: { x: a / 2, y: hh + 0.7 }, text: "a", alpha: start },
            { at: { x: dx + 0.4, y: hh / 2 }, text: "h", alpha: start, kind: "hoehe" },
            ...labelsEnde(P(3)),
          ],
        };
      },
    };
  }

  // Sehr schief: als Stapel dünner Karten denken und geradeschieben
  // (Cavalieri). Die Karten bleiben gleich — also auch die Fläche.
  const n = 12;
  const steps: Step[] = [
    { dur: 4, text: "Das ist das Parallelogramm. Die Grundseite ist a, die Höhe h steht senkrecht darauf." },
    { dur: 4, text: "So schief passt kein einzelner Schnitt. Wir denken es uns als Stapel dünner Karten …" },
    { dur: 6, text: "… und schieben die Karten gerade. Keine Karte kommt dazu, keine geht weg." },
    { dur: 5, text: "Es entsteht ein Rechteck mit den Seiten a und h. Also: A = a · h." },
  ];
  return {
    steps,
    frame(t) {
      const P = stepper(steps, t);
      const cards: Piece[] = Array.from({ length: n }, (_, k) => {
        const y0 = (k * hh) / n, y1 = ((k + 1) * hh) / n;
        const x = dx * (1 - (y0 + y1) / 2 / hh) * (1 - P(2)) + dx * P(2);
        return {
          pts: [{ x, y: y0 }, { x: x + a, y: y0 }, { x: x + a, y: y1 }, { x, y: y1 }],
          kind: k % 2 ? "orig" : "copy",
          alpha: P(1),
        };
      });
      return {
        pieces: [{ pts: [A, B, C, D], kind: "orig", alpha: 1 - P(1) }, ...cards],
        lines: [{ a: D, b: F, kind: "hoehe", alpha: 1 - P(1) }, ...rahmen(dx, 0, a, hh, P(3))],
        labels: [
          { at: { x: a / 2, y: hh + 0.7 }, text: "a", alpha: 1 - P(2) },
          ...labelsEnde(P(3)),
        ],
      };
    },
  };
}

/* ───────────────────────────────────────────────────────────── Trapez ── */

function trapez({ a, c, h }: Vals): Herleitung {
  const off = (a - c) / 2;
  const A = { x: 0, y: h }, B = { x: a, y: h }, C = { x: off + c, y: 0 }, D = { x: off, y: 0 };
  const M = mid(B, C); // Drehpunkt: Mitte des rechten Schenkels
  const lift = h + 1.2;

  // Das Dreieck links vom Parallelogramm — je nachdem, wohin es kippt.
  const tri = off >= 0
    ? [A, { x: off, y: h }, D]
    : [A, D, { x: 0, y: 0 }];
  const rest = off >= 0
    ? [{ x: off, y: h }, B, C, D]
    : [A, B, C, { x: 0, y: 0 }];
  const x0 = Math.max(0, off), base = a + c;

  const steps: Step[] = [
    { dur: 4, text: "Das ist unser Trapez: die parallelen Grundseiten a und c, dazwischen die Höhe h." },
    { dur: 3.5, text: "Wir nehmen ein zweites, genau gleiches Trapez dazu." },
    { dur: 5, text: "Das zweite Trapez drehen wir um die Mitte des Schenkels — eine halbe Drehung." },
    { dur: 5, text: "Zusammen ergeben beide ein Parallelogramm: Grundseite a + c, Höhe h." },
    { dur: 5, text: "Links schneiden wir ein Dreieck ab und schieben es nach rechts." },
    { dur: 5, text: "Ein Rechteck mit den Seiten (a + c) und h — seine Fläche ist (a + c) · h." },
    { dur: 6, text: "Unser Trapez ist genau die Hälfte davon: A = (a + c) : 2 · h." },
  ];

  return {
    steps,
    frame(t) {
      const P = stepper(steps, t);
      const s = P(2);
      const copy = [A, B, C, D].map(p => add(rot(p, M, 180 * s), 0, -lift * (1 - s)));
      const cut = P(4) > 0;
      const slide = base * P(4);
      const half = P(6);
      return {
        pieces: [
          { pts: copy, kind: "copy", alpha: P(1) * (1 - 0.65 * half) },
          ...(cut
            ? [
                { pts: rest, kind: "orig" as Kind, alpha: 1 },
                { pts: tri.map(p => add(p, slide, 0)), kind: "orig" as Kind, alpha: 1 },
              ]
            : [{ pts: [A, B, C, D], kind: "orig" as Kind, alpha: 1 }]),
        ],
        lines: [
          { a: { x: x0, y: 0 }, b: { x: x0, y: h }, kind: "hoehe", alpha: 1 - P(1) },
          {
            a: A, b: { x: base, y: h }, kind: "umriss", alpha: P(3) * (1 - P(5)),
          },
          { a: D, b: { x: off + base, y: 0 }, kind: "umriss", alpha: P(3) * (1 - P(5)) },
          ...rahmen(x0, 0, base, h, P(5)),
        ],
        labels: [
          { at: { x: a / 2, y: h + 0.7 }, text: "a", alpha: 1 - P(5) },
          { at: { x: off + c / 2, y: -0.45 }, text: "c", alpha: 1 - P(1) },
          { at: { x: x0 + 0.4, y: h / 2 }, text: "h", alpha: 1 - P(1), kind: "hoehe" },
          // Die gedrehte Kopie bringt ihr c nach unten neben das a.
          { at: { x: a + c / 2, y: h + 0.7 }, text: "c", alpha: P(3) * (1 - P(5)) },
          { at: { x: x0 + base / 2, y: h + 0.7 }, text: "a + c", alpha: P(5) },
          { at: { x: x0 - 0.45, y: h / 2 }, text: "h", alpha: P(5), kind: "hoehe" },
          { at: { x: x0 + base / 2, y: h + 1.8 }, text: "(a + c) · h", alpha: P(5) * (1 - half), kind: "formel" },
          { at: { x: x0 + base / 2, y: h + 1.8 }, text: "A = (a + c) : 2 · h", alpha: half, kind: "formel" },
        ],
      };
    },
  };
}

/* ───────────────────────────────────────────────────── Raute, Drachen ── */

/**
 * Raute und Drachen sind dasselbe Bild: Querdiagonale e, Längsdiagonale f,
 * die Querdiagonale schneidet f bei m (Raute: in der Mitte). Jedes Eckdreieck
 * des Rechtecks e · f landet durch eine halbe Drehung um die Mitte seiner
 * Vierecksseite genau im Inneren — die Ecke fällt auf den Diagonalenschnitt.
 */
type Name = { nom: string; akk: string; er: string };

function eckdreiecke(e: number, f: number, m: number, { nom, akk, er }: Name): Herleitung {
  const T = { x: e / 2, y: 0 }, R = { x: e, y: m }, U = { x: e / 2, y: f }, L = { x: 0, y: m };
  const ecken = [
    { pts: [{ x: 0, y: 0 }, T, L], pivot: mid(T, L) },
    { pts: [{ x: e, y: 0 }, R, T], pivot: mid(T, R) },
    { pts: [{ x: e, y: f }, U, R], pivot: mid(R, U) },
    { pts: [{ x: 0, y: f }, L, U], pivot: mid(U, L) },
  ];
  const steps: Step[] = [
    { dur: 4, text: `Das ist ${nom} mit den Diagonalen e und f. Sie stehen senkrecht aufeinander.` },
    { dur: 4.5, text: "Wir legen ein Rechteck darum: e breit, f hoch. Außen bleiben vier Dreiecke übrig." },
    { dur: 7, text: "Die vier Dreiecke drehen wir um die Seitenmitten nach innen …" },
    { dur: 6, text: `… sie füllen ${akk} genau aus. Also ist ${er} das halbe Rechteck: A = e · f : 2.` },
  ];
  return {
    steps,
    frame(t) {
      const P = stepper(steps, t);
      // Leicht versetzt nacheinander — sonst sieht man nur Gewimmel.
      const at = starts(steps);
      const d = steps[2].dur;
      return {
        pieces: [
          { pts: [T, R, U, L], kind: "orig", alpha: 1 },
          ...ecken.map((k, i) => {
            const s = ease(clamp01((t - at[2] - i * d * 0.12) / (d * 0.45)));
            return { pts: k.pts.map(p => rot(p, k.pivot, 180 * s)), kind: "outer" as Kind, alpha: P(1) };
          }),
        ],
        lines: [
          { a: L, b: R, kind: "diag", alpha: 1 },
          { a: T, b: U, kind: "diag", alpha: 1 },
          ...rahmen(0, 0, e, f, P(1)),
        ],
        labels: [
          { at: { x: e * 0.3, y: m - 0.3 }, text: "e", alpha: 1, kind: "hoehe" },
          { at: { x: e / 2 + 0.35, y: f * 0.8 }, text: "f", alpha: 1, kind: "hoehe" },
          { at: { x: e / 2, y: -0.5 }, text: "e", alpha: P(1) },
          { at: { x: e + 0.5, y: f / 2 }, text: "f", alpha: P(1) },
          { at: { x: e / 2, y: f + 1 }, text: "A = e · f : 2", alpha: P(3), kind: "formel" },
        ],
      };
    },
  };
}

/** Herleitung für die Form; Quadrat und Rechteck haben keine (sie werden ausgelegt). */
export function herleitung(key: ShapeKey, v: Vals): Herleitung | null {
  switch (key) {
    case "parallelogramm": return parallelogramm(v);
    case "trapez": return trapez(v);
    case "raute": return eckdreiecke(v.e, v.f, v.f / 2, { nom: "die Raute", akk: "die Raute", er: "sie" });
    case "drachen": return eckdreiecke(v.e, v.f, Math.min(v.m, v.f - 1), { nom: "der Drachen", akk: "den Drachen", er: "er" });
    default: return null;
  }
}

type Box = { minX: number; minY: number; width: number; height: number };

/** Umriss von allem, was zwischen t0 und t1 sichtbar wird. */
function sichtbar(H: Herleitung, t0: number, t1: number, n = 60): Box {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i <= n; i++) {
    const f = H.frame(t0 + ((t1 - t0) * i) / n);
    const pts = [
      ...f.pieces.filter(p => p.alpha > 0).flatMap(p => p.pts),
      ...f.lines.filter(l => l.alpha > 0).flatMap(l => [l.a, l.b]),
      ...f.labels.filter(l => l.alpha > 0).map(l => l.at),
    ];
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/** Alles, was im Lauf des Films sichtbar wird — gibt das Seitenverhältnis der Bühne vor. */
export const filmBounds = (H: Herleitung) => sichtbar(H, 0, total(H.steps), 120);

/**
 * Kamera: je Schritt der Ausschnitt, den er braucht. So füllt das Startbild
 * die Bühne, statt klein in der Ecke zu sitzen, nur weil später eine
 * gedrehte Kopie Platz braucht. Am Ende eines Schritts (wenn das Bild
 * steht) fährt die Kamera schon zum Ausschnitt des nächsten.
 */
export function kamera(H: Herleitung) {
  const at = starts(H.steps);
  const boxes = H.steps.map((s, i) => sichtbar(H, at[i], at[i] + s.dur, 40));
  return (t: number): Box => {
    const i = Math.max(0, at.findLastIndex(x => x <= t));
    const j = Math.min(i + 1, boxes.length - 1);
    const d = H.steps[i].dur;
    const p = ease(clamp01((t - at[i] - 0.7 * d) / (0.3 * d)));
    const a = boxes[i], b = boxes[j];
    const l = (x: number, y: number) => x + (y - x) * p;
    return { minX: l(a.minX, b.minX), minY: l(a.minY, b.minY), width: l(a.width, b.width), height: l(a.height, b.height) };
  };
}
