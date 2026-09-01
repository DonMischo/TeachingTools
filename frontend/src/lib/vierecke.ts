/**
 * Die sechs Vierecke der Klasse 5: Maße, Formeln, Eigenschaften, Umriss.
 *
 * Reine Rechnung, kein React — damit die Formeln prüfbar sind, ohne die
 * Oberfläche zu starten. Die Umrisse kommen in Einheiten (nicht Pixeln); die
 * Komponente skaliert sie in ihr SVG.
 *
 * Zusammengeführt aus zwei Werkzeugen des Mathetool-Ordners: dem
 * Vierecke-Smartboard-Tool (Formen, Formeln, Eigenschaften) und dem GeoTool
 * »Umfang & Fläche« (Einheiten auslegen). Vom GeoTool existierte nur noch das
 * gebaute Bundle, sein Verhalten ist deshalb nachgebaut, nicht übernommen.
 */

export type ShapeKey = "quadrat" | "rechteck" | "parallelogramm" | "trapez" | "raute" | "drachen";

export type Pt = { x: number; y: number };

export type Field = {
  key: string;
  /** Beschriftung im Schieberegler, z. B. »Seite a«. */
  label: string;
  min: number;
  max: number;
  def: number;
};

/** Belegung der Maße, z. B. `{ a: 5, b: 3 }`. */
export type Vals = Record<string, number>;

export type Shape = {
  key: ShapeKey;
  title: string;
  icon: string;
  formulaU: string;
  formulaA: string;
  fields: Field[];
  properties: string[];
  /** Eckpunkte A, B, C, D im Einheitsraster (y zeigt nach unten wie im SVG). */
  poly: (v: Vals) => Pt[];
  perimeter: (v: Vals) => number;
  area: (v: Vals) => number;
  /** Rechenweg mit eingesetzten Zahlen, z. B. »4 · 5 cm = 20 cm«. */
  stepsU: (v: Vals) => string;
  stepsA: (v: Vals) => string;
  /**
   * Nur Quadrat und Rechteck lassen sich lückenlos in Einheitsquadrate
   * zerlegen — die Zaun- und Flächenaufgabe gibt es deshalb nur für sie.
   */
  gridable?: boolean;
};

/** Kurz und ohne Nullen am Ende: 20, 4.5, 7.07. */
export function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

const hyp = (x: number, y: number) => Math.sqrt(x * x + y * y);

export const SHAPES: Record<ShapeKey, Shape> = {
  quadrat: {
    key: "quadrat",
    title: "Quadrat",
    icon: "◻️",
    formulaU: "u = 4 · a",
    formulaA: "A = a · a",
    fields: [{ key: "a", label: "Seite a", min: 1, max: 10, def: 5 }],
    properties: [
      "Alle vier Seiten sind gleich lang.",
      "Alle vier Winkel sind rechte Winkel (90°).",
      "Die Diagonalen sind gleich lang und halbieren sich im rechten Winkel.",
      "Ein Quadrat ist ein besonderes Rechteck und eine besondere Raute.",
    ],
    poly: ({ a }) => [
      { x: 0, y: 0 }, { x: a, y: 0 }, { x: a, y: a }, { x: 0, y: a },
    ],
    perimeter: ({ a }) => 4 * a,
    area: ({ a }) => a * a,
    stepsU: ({ a }) => `u = 4 · ${fmt(a)} = ${fmt(4 * a)}`,
    stepsA: ({ a }) => `A = ${fmt(a)} · ${fmt(a)} = ${fmt(a * a)}`,
    gridable: true,
  },

  rechteck: {
    key: "rechteck",
    title: "Rechteck",
    icon: "▭",
    formulaU: "u = 2 · (a + b)",
    formulaA: "A = a · b",
    fields: [
      { key: "a", label: "Seite a", min: 1, max: 12, def: 6 },
      { key: "b", label: "Seite b", min: 1, max: 10, def: 4 },
    ],
    properties: [
      "Gegenüberliegende Seiten sind gleich lang und parallel.",
      "Alle vier Winkel sind rechte Winkel (90°).",
      "Die Diagonalen sind gleich lang und halbieren sich.",
      "Ein Rechteck mit vier gleich langen Seiten ist ein Quadrat.",
    ],
    poly: ({ a, b }) => [
      { x: 0, y: 0 }, { x: a, y: 0 }, { x: a, y: b }, { x: 0, y: b },
    ],
    perimeter: ({ a, b }) => 2 * (a + b),
    area: ({ a, b }) => a * b,
    stepsU: ({ a, b }) => `u = 2 · (${fmt(a)} + ${fmt(b)}) = 2 · ${fmt(a + b)} = ${fmt(2 * (a + b))}`,
    stepsA: ({ a, b }) => `A = ${fmt(a)} · ${fmt(b)} = ${fmt(a * b)}`,
    gridable: true,
  },

  parallelogramm: {
    key: "parallelogramm",
    title: "Parallelogramm",
    icon: "▰",
    formulaU: "u = 2 · (a + b)",
    formulaA: "A = a · h",
    fields: [
      { key: "a", label: "Seite a", min: 2, max: 12, def: 7 },
      { key: "b", label: "Seite b", min: 1, max: 8, def: 4 },
      { key: "h", label: "Höhe h", min: 1, max: 8, def: 3 },
    ],
    properties: [
      "Gegenüberliegende Seiten sind gleich lang und parallel.",
      "Gegenüberliegende Winkel sind gleich groß.",
      "Die Diagonalen halbieren sich gegenseitig.",
      "Die Höhe h steht senkrecht auf der Seite a — nicht zu verwechseln mit der Seite b.",
    ],
    // Die Höhe darf nicht länger als die Seite b sein, sonst gibt es das
    // Parallelogramm nicht. Der Versatz folgt aus b und h.
    poly: ({ a, b, h }) => {
      const hh = Math.min(h, b);
      const dx = Math.sqrt(Math.max(0, b * b - hh * hh));
      return [
        { x: dx, y: 0 }, { x: dx + a, y: 0 }, { x: a, y: hh }, { x: 0, y: hh },
      ];
    },
    perimeter: ({ a, b }) => 2 * (a + b),
    area: ({ a, b, h }) => a * Math.min(h, b),
    stepsU: ({ a, b }) => `u = 2 · (${fmt(a)} + ${fmt(b)}) = ${fmt(2 * (a + b))}`,
    stepsA: ({ a, b, h }) => {
      const hh = Math.min(h, b);
      return `A = ${fmt(a)} · ${fmt(hh)} = ${fmt(a * hh)}`;
    },
  },

  trapez: {
    key: "trapez",
    title: "Trapez",
    icon: "⏢",
    formulaU: "u = a + c + 2 · d",
    formulaA: "A = ((a + c) : 2) · h",
    fields: [
      { key: "a", label: "Seite a (unten)", min: 3, max: 12, def: 8 },
      { key: "c", label: "Seite c (oben)", min: 1, max: 10, def: 4 },
      { key: "h", label: "Höhe h", min: 1, max: 8, def: 3 },
    ],
    properties: [
      "Mindestens zwei Seiten sind parallel — hier a und c.",
      "Die Höhe h ist der senkrechte Abstand der beiden parallelen Seiten.",
      "Hier sind die Schenkel gleich lang: ein gleichschenkliges Trapez.",
      "Im gleichschenkligen Trapez sind die Diagonalen gleich lang.",
    ],
    poly: ({ a, c, h }) => {
      const off = (a - c) / 2;
      return [
        { x: 0, y: h }, { x: a, y: h }, { x: off + c, y: 0 }, { x: off, y: 0 },
      ];
    },
    perimeter: ({ a, c, h }) => a + c + 2 * hyp((a - c) / 2, h),
    area: ({ a, c, h }) => ((a + c) / 2) * h,
    stepsU: ({ a, c, h }) => {
      const d = hyp((a - c) / 2, h);
      return `d = ${fmt(d)} → u = ${fmt(a)} + ${fmt(c)} + 2 · ${fmt(d)} = ${fmt(a + c + 2 * d)}`;
    },
    stepsA: ({ a, c, h }) =>
      `A = ((${fmt(a)} + ${fmt(c)}) : 2) · ${fmt(h)} = ${fmt((a + c) / 2)} · ${fmt(h)} = ${fmt(((a + c) / 2) * h)}`,
  },

  raute: {
    key: "raute",
    title: "Raute",
    icon: "◆",
    formulaU: "u = 4 · a",
    formulaA: "A = (e · f) : 2",
    fields: [
      { key: "e", label: "Diagonale e", min: 2, max: 12, def: 8 },
      { key: "f", label: "Diagonale f", min: 2, max: 10, def: 6 },
    ],
    properties: [
      "Alle vier Seiten sind gleich lang.",
      "Gegenüberliegende Seiten sind parallel — die Raute ist ein Parallelogramm.",
      "Die Diagonalen halbieren sich gegenseitig im rechten Winkel.",
      "Die Diagonalen sind die Symmetrieachsen.",
    ],
    poly: ({ e, f }) => [
      { x: e / 2, y: 0 }, { x: e, y: f / 2 }, { x: e / 2, y: f }, { x: 0, y: f / 2 },
    ],
    perimeter: ({ e, f }) => 4 * hyp(e / 2, f / 2),
    area: ({ e, f }) => (e * f) / 2,
    stepsU: ({ e, f }) => {
      const a = hyp(e / 2, f / 2);
      return `a = ${fmt(a)} → u = 4 · ${fmt(a)} = ${fmt(4 * a)}`;
    },
    stepsA: ({ e, f }) => `A = (${fmt(e)} · ${fmt(f)}) : 2 = ${fmt((e * f) / 2)}`,
  },

  drachen: {
    key: "drachen",
    title: "Drachen",
    icon: "🪁",
    formulaU: "u = 2 · (s + t)",
    formulaA: "A = (e · f) : 2",
    fields: [
      { key: "e", label: "Diagonale e (quer)", min: 2, max: 12, def: 6 },
      { key: "f", label: "Diagonale f (längs)", min: 3, max: 12, def: 9 },
      { key: "m", label: "Querdiagonale bei", min: 1, max: 8, def: 3 },
    ],
    properties: [
      "Zwei Paare benachbarter Seiten sind gleich lang.",
      "Die Diagonalen schneiden sich im rechten Winkel.",
      "Die längere Diagonale ist die Symmetrieachse und halbiert die kürzere.",
      "Eine Raute ist ein besonderer Drachen: dort sind alle vier Seiten gleich lang.",
    ],
    // m sagt, wie weit unterhalb der Spitze die Querdiagonale liegt; sie muss
    // innerhalb der Laengsdiagonale bleiben.
    poly: ({ e, f, m }) => {
      const mm = Math.min(m, f - 1);
      return [
        { x: e / 2, y: 0 }, { x: e, y: mm }, { x: e / 2, y: f }, { x: 0, y: mm },
      ];
    },
    perimeter: ({ e, f, m }) => {
      const mm = Math.min(m, f - 1);
      return 2 * (hyp(e / 2, mm) + hyp(e / 2, f - mm));
    },
    area: ({ e, f }) => (e * f) / 2,
    stepsU: ({ e, f, m }) => {
      const mm = Math.min(m, f - 1);
      const s = hyp(e / 2, mm), t = hyp(e / 2, f - mm);
      return `s = ${fmt(s)}, t = ${fmt(t)} → u = 2 · (${fmt(s)} + ${fmt(t)}) = ${fmt(2 * (s + t))}`;
    },
    stepsA: ({ e, f }) => `A = (${fmt(e)} · ${fmt(f)}) : 2 = ${fmt((e * f) / 2)}`,
  },
};

export const SHAPE_ORDER: ShapeKey[] = [
  "quadrat", "rechteck", "parallelogramm", "trapez", "raute", "drachen",
];

/** Startwerte einer Form, z. B. `{ a: 5 }`. */
export function defaults(shape: Shape): Vals {
  return Object.fromEntries(shape.fields.map(f => [f.key, f.def]));
}

/** Umschließendes Rechteck des Umrisses — für die Skalierung ins SVG. */
export function bounds(points: Pt[]) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}
