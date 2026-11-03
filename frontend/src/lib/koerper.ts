/**
 * Körper der Klassen 5–10: Formeln mit Rechenweg, Teilflächen (anklickbar),
 * besondere Linien (Höhe, Seitenhöhe, Mantellinie, Diagonalen) und das
 * Gerüst, aus dem 3D-Ansicht, Netz und Schrägbild entstehen. Reine Rechnung.
 *
 * Koordinaten wie in three.js: x nach rechts, y nach oben, z zum Betrachter.
 * Jeder Körper steht auf der Ebene y = 0 (die Kugel liegt darauf).
 */
import { runde, z } from "@/lib/prozent";

export type V3 = [number, number, number];

export type KoerperKey =
  | "wuerfel" | "quader" | "prisma3" | "prisma6" | "zylinder" | "pyramide4" | "pyramide_r"
  | "kegel" | "kugel" | "halbkugel" | "pstumpf" | "kstumpf";

export const KOERPER_REIHE: KoerperKey[] = [
  "wuerfel", "quader", "prisma3", "prisma6", "zylinder", "pyramide4", "pyramide_r", "kegel", "kugel", "halbkugel", "pstumpf", "kstumpf",
];

/** Regler: `unter` heißt »höchstens das Maß `unter` minus einen halben Zentimeter« (Stumpf: oben kleiner als unten). */
export type Feld = { key: string; label: string; min: number; max: number; start: number; unter?: string };
export type Masse = Record<string, number>;

/** Eine Größe mit Formel und eingesetztem Rechenweg. */
export type Groesse = { name: string; formel: string; rechnung: string; wert: number; einheit: string };
/** Eine anklickbare Teilfläche; `gruppe` sagt, ob sie zur Grund-, Deck- oder Mantelfläche gehört. */
export type Teil = { id: string; gruppe: "G" | "D" | "M"; name: string; form: string; formel: string; rechnung: string; wert: number };
/** Besondere Linie zum Zuschalten. `kante`: die Linie ist eine Kante, im Schrägbild steht dann nur die Beschriftung. */
export type Linie = { id: string; zeichen: string; name: string; formel: string; wert: number; von: V3; bis: V3; kante?: boolean };
export type Zaehlung = { e: number; f: number; k: number; polyeder: boolean; hinweis?: string };

export type Daten = {
  V: Groesse; O: Groesse; M: Groesse; G?: Groesse; D?: Groesse;
  teile: Teil[];
  linien: Linie[];
  zaehlung: Zaehlung;
};

export type Flaeche3 = { teil: string; idx: number[] };
export type Polyeder = { ecken: V3[]; namen: string[]; flaechen: Flaeche3[] };
/** Drehkörper: Mantel von Radius r1 (unten) nach r2 (oben), oder Kugel/Halbkugel mit r1. */
export type Rund = { art: "mantel" | "kugel" | "halbkugel"; r1: number; r2: number; h: number };

export type Koerper = {
  key: KoerperKey; name: string; icon: string; klasse: string;
  felder: Feld[];
  rechne: (m: Masse) => Daten;
  poly?: (m: Masse) => Polyeder;
  rund?: (m: Masse) => Rund;
};

/* ─────────────────────────────────────────────────────────── Vektoren ── */

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mal = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const kreuz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const laenge = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const einheit = (a: V3): V3 => mal(a, 1 / (laenge(a) || 1));
export const mitte = (pts: V3[]): V3 => mal(pts.reduce(add, [0, 0, 0] as V3), 1 / (pts.length || 1));

/** Normale eines ebenen Vielecks (Newell), Länge 1. */
export function normale(pts: V3[]): V3 {
  const n: V3 = [0, 0, 0];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    n[0] += (p[1] - q[1]) * (p[2] + q[2]);
    n[1] += (p[2] - q[2]) * (p[0] + q[0]);
    n[2] += (p[0] - q[0]) * (p[1] + q[1]);
  });
  return einheit(n);
}

/* ──────────────────────────────────────────────────────── Polyeder ── */

/** Dreht jede Fläche so, dass ihre Normale nach außen zeigt (der Körper ist konvex). */
function orientiere(p: Polyeder): Polyeder {
  const c = mitte(p.ecken);
  return {
    ...p,
    flaechen: p.flaechen.map(f => {
      const pts = f.idx.map(i => p.ecken[i]);
      return dot(normale(pts), sub(mitte(pts), c)) < 0 ? { ...f, idx: [...f.idx].reverse() } : f;
    }),
  };
}

/** Prisma: Grundfläche (x, z) auf y = 0, Deckfläche auf y = h. Seitenfläche i liegt an der Kante i → i+1. */
export function prismaAus(basis: [number, number][], h: number, namen = "ABCDEFGHIJKL"): Polyeder {
  const n = basis.length;
  const ecken: V3[] = [...basis.map(([x, zz]): V3 => [x, 0, zz]), ...basis.map(([x, zz]): V3 => [x, h, zz])];
  const flaechen: Flaeche3[] = [
    { teil: "G", idx: basis.map((_, i) => i) },
    { teil: "D", idx: basis.map((_, i) => n + i) },
    ...basis.map((_, i) => ({ teil: `M${i + 1}`, idx: [i, (i + 1) % n, n + (i + 1) % n, n + i] })),
  ];
  return orientiere({ ecken, namen: ecken.map((_, i) => namen[i] ?? ""), flaechen });
}

/** Pyramide mit Spitze S über dem Punkt (sx, sz). */
export function pyramideAus(basis: [number, number][], h: number, s: [number, number] = [0, 0]): Polyeder {
  const n = basis.length;
  const ecken: V3[] = [...basis.map(([x, zz]): V3 => [x, 0, zz]), [s[0], h, s[1]]];
  const flaechen: Flaeche3[] = [
    { teil: "G", idx: basis.map((_, i) => i) },
    ...basis.map((_, i) => ({ teil: `M${i + 1}`, idx: [i, (i + 1) % n, n] })),
  ];
  return orientiere({ ecken, namen: [..."ABCDEFGH".slice(0, n), "S"], flaechen });
}

/** Stumpf: Grundfläche unten, Deckfläche (gleich viele Ecken) auf y = h. */
export function stumpfAus(unten: [number, number][], oben: [number, number][], h: number): Polyeder {
  const n = unten.length;
  const ecken: V3[] = [...unten.map(([x, zz]): V3 => [x, 0, zz]), ...oben.map(([x, zz]): V3 => [x, h, zz])];
  const flaechen: Flaeche3[] = [
    { teil: "G", idx: unten.map((_, i) => i) },
    { teil: "D", idx: oben.map((_, i) => n + i) },
    ...unten.map((_, i) => ({ teil: `M${i + 1}`, idx: [i, (i + 1) % n, n + (i + 1) % n, n + i] })),
  ];
  return orientiere({ ecken, namen: ecken.map((_, i) => "ABCDEFGH"[i]), flaechen });
}

/** Liegendes Prisma: Querschnitt (z, y) wird entlang x um `l` gezogen (Zelt, Haus). Die Stirnflächen sind G und D. */
export function liegendesPrisma(quer: [number, number][], l: number, namen = "ABCDEFGHIJKL"): Polyeder {
  const n = quer.length;
  const ecken: V3[] = [...quer.map(([zz, y]): V3 => [-l / 2, y, zz]), ...quer.map(([zz, y]): V3 => [l / 2, y, zz])];
  const flaechen: Flaeche3[] = [
    { teil: "G", idx: quer.map((_, i) => i) },
    { teil: "D", idx: quer.map((_, i) => n + i) },
    ...quer.map((_, i) => ({ teil: `M${i + 1}`, idx: [i, (i + 1) % n, n + (i + 1) % n, n + i] })),
  ];
  return orientiere({ ecken, namen: ecken.map((_, i) => namen[i] ?? ""), flaechen });
}

/** Kanten mit den beiden angrenzenden Flächen. */
export function kantenVon(p: Polyeder): { a: number; b: number; flaechen: number[] }[] {
  const karte = new Map<string, { a: number; b: number; flaechen: number[] }>();
  p.flaechen.forEach((f, fi) => f.idx.forEach((a, i) => {
    const b = f.idx[(i + 1) % f.idx.length];
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    const e = karte.get(k) ?? { a: Math.min(a, b), b: Math.max(a, b), flaechen: [] };
    e.flaechen.push(fi);
    karte.set(k, e);
  }));
  return [...karte.values()];
}

export function zaehle(p: Polyeder): Zaehlung {
  return { e: p.ecken.length, f: p.flaechen.length, k: kantenVon(p).length, polyeder: true };
}

/* ──────────────────────────────────────────────────── Formatierung ── */

/** »=«, wenn die Zahl mit zwei Nachkommastellen genau ist, sonst »≈«. */
export const gl = (x: number, nk = 2) => (Math.abs(runde(x, nk) - x) < 1e-9 ? "=" : "≈");
/** »= 24 cm³« bzw. »≈ 141,37 cm³« */
export const ist = (x: number, e: string) => `${gl(x)} ${z(x)}${e ? " " + e : ""}`;
const π = Math.PI;

const gr = (name: string, formel: string, rechnung: string, wert: number, einheit: string): Groesse => ({ name, formel, rechnung, wert, einheit });
const teil = (id: string, gruppe: Teil["gruppe"], name: string, form: string, formel: string, rechnung: string, wert: number): Teil =>
  ({ id, gruppe, name, form, formel, rechnung, wert });
const lin = (id: string, zeichen: string, name: string, formel: string, wert: number, von: V3, bis: V3, kante = false): Linie =>
  ({ id, zeichen, name, formel, wert, von, bis, kante });

/** Summe der Mantelteile als Rechnung: »M = 12 + 8 + 12 + 8 = 40 cm²« */
function mantelSumme(teile: Teil[], formel: string): Groesse {
  const ms = teile.filter(t => t.gruppe === "M");
  const w = ms.reduce((s, t) => s + t.wert, 0);
  return gr("Mantelfläche", formel, `M = ${ms.map(t => z(t.wert)).join(" + ")} ${ist(w, "cm²")}`, w, "cm²");
}

function oberflaeche(formel: string, G: Groesse | undefined, D: Groesse | undefined, M: Groesse): Groesse {
  const w = (G?.wert ?? 0) + (D?.wert ?? 0) + M.wert;
  const teile = [G && z(G.wert), D && z(D.wert), z(M.wert)].filter(Boolean).join(" + ");
  return gr("Oberfläche", formel, `O = ${teile} ${ist(w, "cm²")}`, w, "cm²");
}

const rechteckBasis = (a: number, b: number): [number, number][] => [[-a / 2, b / 2], [a / 2, b / 2], [a / 2, -b / 2], [-a / 2, -b / 2]];
const SECHSECK_WINKEL = [120, 60, 0, -60, -120, 180];
const sechseck = (a: number): [number, number][] => SECHSECK_WINKEL.map(w => [a * Math.cos(w * π / 180), a * Math.sin(w * π / 180)]);
const mittel = (a: V3, b: V3): V3 => mal(add(a, b), 0.5);

const L = (k: string, label: string, min: number, max: number, start: number, unter?: string): Feld => ({ key: k, label, min, max, start, unter });

/** Maße nach den Reglern begrenzt (Stumpf: oben kleiner als unten). */
export function masseIn(k: { felder: Feld[] }, m: Masse): Masse {
  const out: Masse = {};
  for (const f of k.felder) {
    const max = f.unter ? Math.min(f.max, (out[f.unter] ?? m[f.unter] ?? f.max) - 0.5) : f.max;
    out[f.key] = Math.min(max, Math.max(f.min, m[f.key] ?? f.start));
  }
  return out;
}

export const startMasse = (k: { felder: Feld[] }): Masse => masseIn(k, {});

/* ────────────────────────────────────────────────────────── Körper ── */

const quaderDaten = (a: number, b: number, c: number, wuerfel: boolean): Daten => {
  const p = prismaAus(rechteckBasis(a, b), c);
  const E = p.ecken;
  const ab = wuerfel ? "a · a" : "a · b", ac = wuerfel ? "a · a" : "a · c", bc = wuerfel ? "a · a" : "b · c";
  const sq = wuerfel ? "Quadrat" : "Rechteck";
  const r = (x: number, y: number) => `${z(x)} · ${z(y)} ${ist(x * y, "cm²")}`;
  const Gw = a * b;
  const G = gr("Grundfläche", `G = ${ab}`, `G = ${r(a, b)}`, Gw, "cm²");
  const D = gr("Deckfläche", `D = ${ab}`, `D = ${r(a, b)}`, Gw, "cm²");
  const teile = [
    teil("G", "G", "Grundfläche", sq, `G = ${ab}`, G.rechnung, Gw),
    teil("D", "D", "Deckfläche", sq, `D = ${ab}`, D.rechnung, Gw),
    teil("M1", "M", "Vorderseite", sq, `A = ${ac}`, `A = ${r(a, c)}`, a * c),
    teil("M2", "M", "rechte Seitenfläche", sq, `A = ${bc}`, `A = ${r(b, c)}`, b * c),
    teil("M3", "M", "Rückseite", sq, `A = ${ac}`, `A = ${r(a, c)}`, a * c),
    teil("M4", "M", "linke Seitenfläche", sq, `A = ${bc}`, `A = ${r(b, c)}`, b * c),
  ];
  const df = Math.hypot(a, b), d = Math.hypot(a, b, c);
  const V = a * b * c;
  return {
    V: wuerfel
      ? gr("Volumen", "V = a³", `V = ${z(a)}³ ${ist(V, "cm³")}`, V, "cm³")
      : gr("Volumen", "V = a · b · c", `V = ${z(a)} · ${z(b)} · ${z(c)} ${ist(V, "cm³")}`, V, "cm³"),
    O: wuerfel
      ? gr("Oberfläche", "O = 6 · a²", `O = 6 · ${z(a)}² ${ist(6 * a * a, "cm²")}`, 6 * a * a, "cm²")
      : gr("Oberfläche", "O = 2 · (a · b + a · c + b · c)", `O = 2 · (${z(a * b)} + ${z(a * c)} + ${z(b * c)}) ${ist(2 * (a * b + a * c + b * c), "cm²")}`, 2 * (a * b + a * c + b * c), "cm²"),
    M: wuerfel
      ? gr("Mantelfläche", "M = 4 · a²", `M = 4 · ${z(a)}² ${ist(4 * a * a, "cm²")}`, 4 * a * a, "cm²")
      : gr("Mantelfläche", "M = 2 · (a + b) · c", `M = 2 · (${z(a)} + ${z(b)}) · ${z(c)} ${ist(2 * (a + b) * c, "cm²")}`, 2 * (a + b) * c, "cm²"),
    G, D, teile,
    linien: [
      lin("a", "a", "Kante a (Länge)", "", a, E[0], E[1], true),
      ...(wuerfel ? [] : [
        lin("b", "b", "Kante b (Breite)", "", b, E[1], E[2], true),
        lin("c", "c", "Kante c (Höhe)", "", c, E[1], E[5], true),
      ]),
      lin("df", "d_f", "Flächendiagonale", wuerfel ? "d_f = a · √2" : "d_f = √(a² + b²)", df, E[0], E[2]),
      lin("d", "d", "Raumdiagonale", wuerfel ? "d = a · √3" : "d = √(a² + b² + c²)", d, E[0], E[6]),
    ],
    zaehlung: zaehle(p),
  };
};

const prisma3Daten = (g: number, hg: number, h: number): Daten => {
  const p = prisma3Poly(g, hg, h);
  const E = p.ecken;
  const Gw = g * hg / 2, b = Math.hypot(g / 2, hg), u = g + 2 * b;
  const G = gr("Grundfläche", "G = ½ · g · h_g", `G = ½ · ${z(g)} · ${z(hg)} ${ist(Gw, "cm²")}`, Gw, "cm²");
  const D = gr("Deckfläche", "D = G", `D ${ist(Gw, "cm²")}`, Gw, "cm²");
  const bTxt = `b = √((g : 2)² + h_g²) ${ist(b, "cm")}`;
  const teile = [
    teil("G", "G", "Grundfläche", "Dreieck", G.formel, G.rechnung, Gw),
    teil("D", "D", "Deckfläche", "Dreieck", "D = ½ · g · h_g", G.rechnung.replace("G =", "D ="), Gw),
    teil("M1", "M", "Seitenfläche vorne", "Rechteck", "A = g · h", `A = ${z(g)} · ${z(h)} ${ist(g * h, "cm²")}`, g * h),
    teil("M2", "M", "Seitenfläche rechts", "Rechteck", "A = b · h", `${bTxt}; A = ${z(b)} · ${z(h)} ${ist(b * h, "cm²")}`, b * h),
    teil("M3", "M", "Seitenfläche links", "Rechteck", "A = b · h", `${bTxt}; A = ${z(b)} · ${z(h)} ${ist(b * h, "cm²")}`, b * h),
  ];
  const M = gr("Mantelfläche", "M = u · h", `u = ${z(g)} + 2 · ${z(b)} ${ist(u, "cm")}; M = ${z(u)} · ${z(h)} ${ist(u * h, "cm²")}`, u * h, "cm²");
  return {
    V: gr("Volumen", "V = G · h", `V = ${z(Gw)} · ${z(h)} ${ist(Gw * h, "cm³")}`, Gw * h, "cm³"),
    O: oberflaeche("O = 2 · G + M", G, D, M),
    M, G, D, teile,
    linien: [
      lin("g", "g", "Grundseite g", "", g, E[0], E[1], true),
      lin("b", "b", "Seite b", "b = √((g : 2)² + h_g²)", b, E[1], E[2], true),
      lin("hg", "h_g", "Höhe des Dreiecks", "", hg, mittel(E[0], E[1]), E[2]),
      lin("h", "h", "Körperhöhe h", "", h, E[1], E[4], true),
    ],
    zaehlung: zaehle(p),
  };
};
const prisma3Poly = (g: number, hg: number, h: number) => prismaAus([[-g / 2, hg / 2], [g / 2, hg / 2], [0, -hg / 2]], h);

const prisma6Daten = (a: number, h: number): Daten => {
  const p = prismaAus(sechseck(a), h);
  const E = p.ecken;
  const Gw = 3 * Math.sqrt(3) / 2 * a * a;
  const G = gr("Grundfläche", "G = 6 · a² · √3 : 4", `G = 6 · ${z(a)}² · √3 : 4 ${ist(Gw, "cm²")}`, Gw, "cm²");
  const D = gr("Deckfläche", "D = G", `D ${ist(Gw, "cm²")}`, Gw, "cm²");
  const teile = [
    teil("G", "G", "Grundfläche", "regelmäßiges Sechseck (6 gleichseitige Dreiecke)", G.formel, G.rechnung, Gw),
    teil("D", "D", "Deckfläche", "regelmäßiges Sechseck", "D = 6 · a² · √3 : 4", G.rechnung.replace("G =", "D ="), Gw),
    ...[1, 2, 3, 4, 5, 6].map(i => teil(`M${i}`, "M", `Seitenfläche ${i}`, "Rechteck", "A = a · h", `A = ${z(a)} · ${z(h)} ${ist(a * h, "cm²")}`, a * h)),
  ];
  const M = gr("Mantelfläche", "M = 6 · a · h", `M = 6 · ${z(a)} · ${z(h)} ${ist(6 * a * h, "cm²")}`, 6 * a * h, "cm²");
  const d = Math.hypot(2 * a, h);
  return {
    V: gr("Volumen", "V = G · h", `V = ${z(Gw)} · ${z(h)} ${ist(Gw * h, "cm³")}`, Gw * h, "cm³"),
    O: oberflaeche("O = 2 · G + M", G, D, M),
    M, G, D, teile,
    linien: [
      lin("a", "a", "Grundkante a", "", a, E[0], E[1], true),
      lin("h", "h", "Körperhöhe h", "", h, E[1], E[7], true),
      lin("d", "d", "längste Raumdiagonale", "d = √((2 · a)² + h²)", d, E[0], E[9]),
    ],
    zaehlung: zaehle(p),
  };
};

const pyramideDaten = (a: number, b: number, h: number, quadrat: boolean): Daten => {
  const p = pyramideAus(rechteckBasis(a, b), h);
  const E = p.ecken, S = E[4];
  const ha = Math.hypot(h, b / 2), hb = Math.hypot(h, a / 2);
  const s = Math.hypot(h, Math.hypot(a, b) / 2);
  const Gw = a * b;
  const G = gr("Grundfläche", quadrat ? "G = a²" : "G = a · b", quadrat ? `G = ${z(a)}² ${ist(Gw, "cm²")}` : `G = ${z(a)} · ${z(b)} ${ist(Gw, "cm²")}`, Gw, "cm²");
  const hsA = quadrat ? "h_s" : "h_a", hsB = quadrat ? "h_s" : "h_b";
  const dreieck = (seite: string, x: number, hs: string, hw: number) =>
    `${hs} = √(h² + (${quadrat ? "a" : seite === "a" ? "b" : "a"} : 2)²) ${ist(hw, "cm")}; A = ½ · ${z(x)} · ${z(hw)} ${ist(x * hw / 2, "cm²")}`;
  const teile = [
    teil("G", "G", "Grundfläche", quadrat ? "Quadrat" : "Rechteck", G.formel, G.rechnung, Gw),
    teil("M1", "M", "Seitenfläche vorne", "Dreieck", `A = ½ · a · ${hsA}`, dreieck("a", a, hsA, ha), a * ha / 2),
    teil("M2", "M", "Seitenfläche rechts", "Dreieck", `A = ½ · ${quadrat ? "a" : "b"} · ${hsB}`, dreieck("b", b, hsB, hb), b * hb / 2),
    teil("M3", "M", "Seitenfläche hinten", "Dreieck", `A = ½ · a · ${hsA}`, dreieck("a", a, hsA, ha), a * ha / 2),
    teil("M4", "M", "Seitenfläche links", "Dreieck", `A = ½ · ${quadrat ? "a" : "b"} · ${hsB}`, dreieck("b", b, hsB, hb), b * hb / 2),
  ];
  const M = quadrat
    ? gr("Mantelfläche", "M = 4 · ½ · a · h_s = 2 · a · h_s", `h_s = √(h² + (a : 2)²) ${ist(ha, "cm")}; M = 2 · ${z(a)} · ${z(ha)} ${ist(2 * a * ha, "cm²")}`, 2 * a * ha, "cm²")
    : mantelSumme(teile, "M = a · h_a + b · h_b");
  const V = Gw * h / 3;
  const mAB = mittel(E[0], E[1]), mBC = mittel(E[1], E[2]);
  return {
    V: gr("Volumen", "V = ⅓ · G · h", `V = ⅓ · ${z(Gw)} · ${z(h)} ${ist(V, "cm³")}`, V, "cm³"),
    O: oberflaeche("O = G + M", G, undefined, M),
    M, G, teile,
    linien: [
      lin("a", "a", "Grundkante a", "", a, E[0], E[1], true),
      ...(quadrat ? [] : [lin("b", "b", "Grundkante b", "", b, E[1], E[2], true)]),
      lin("h", "h", "Körperhöhe h", "", h, [0, 0, 0], S),
      quadrat
        ? lin("hs", "h_s", "Seitenhöhe h_s", "h_s = √(h² + (a : 2)²)", ha, mAB, S)
        : lin("ha", "h_a", "Seitenhöhe h_a (zu a)", "h_a = √(h² + (b : 2)²)", ha, mAB, S),
      ...(quadrat ? [] : [lin("hb", "h_b", "Seitenhöhe h_b (zu b)", "h_b = √(h² + (a : 2)²)", hb, mBC, S)]),
      lin("s", "s", "Seitenkante s", quadrat ? "s = √(h² + (a · √2 : 2)²)" : "s = √(h² + (d : 2)²)", s, E[2], S, true),
      lin("d", "d", "Diagonale der Grundfläche", quadrat ? "d = a · √2" : "d = √(a² + b²)", Math.hypot(a, b), E[0], E[2]),
    ],
    zaehlung: zaehle(p),
  };
};

const pstumpfDaten = (a: number, a2: number, h: number): Daten => {
  const p = stumpfAus(rechteckBasis(a, a), rechteckBasis(a2, a2), h);
  const E = p.ecken;
  const hs = Math.hypot(h, (a - a2) / 2);
  const Gw = a * a, Dw = a2 * a2;
  const G = gr("Grundfläche", "G = a²", `G = ${z(a)}² ${ist(Gw, "cm²")}`, Gw, "cm²");
  const D = gr("Deckfläche", "D = a₂²", `D = ${z(a2)}² ${ist(Dw, "cm²")}`, Dw, "cm²");
  const tz = (a + a2) / 2 * hs;
  const tr = `h_s = √(h² + ((a − a₂) : 2)²) ${ist(hs, "cm")}; A = (${z(a)} + ${z(a2)}) : 2 · ${z(hs)} ${ist(tz, "cm²")}`;
  const teile = [
    teil("G", "G", "Grundfläche", "Quadrat", G.formel, G.rechnung, Gw),
    teil("D", "D", "Deckfläche", "Quadrat", D.formel, D.rechnung, Dw),
    ...["vorne", "rechts", "hinten", "links"].map((w, i) => teil(`M${i + 1}`, "M", `Seitenfläche ${w}`, "Trapez", "A = (a + a₂) : 2 · h_s", tr, tz)),
  ];
  const M = gr("Mantelfläche", "M = 4 · (a + a₂) : 2 · h_s", `M = 4 · ${z(tz)} ${ist(4 * tz, "cm²")}`, 4 * tz, "cm²");
  const V = h / 3 * (Gw + Math.sqrt(Gw * Dw) + Dw);
  return {
    V: gr("Volumen", "V = ⅓ · h · (G + √(G · D) + D)", `V = ⅓ · ${z(h)} · (${z(Gw)} + √(${z(Gw)} · ${z(Dw)}) + ${z(Dw)}) ${ist(V, "cm³")}`, V, "cm³"),
    O: oberflaeche("O = G + D + M", G, D, M),
    M, G, D, teile,
    linien: [
      lin("a", "a", "Grundkante a", "", a, E[0], E[1], true),
      lin("a2", "a₂", "Deckkante a₂", "", a2, E[4], E[5], true),
      lin("h", "h", "Körperhöhe h", "", h, [0, 0, 0], [0, h, 0]),
      lin("hs", "h_s", "Seitenhöhe h_s", "h_s = √(h² + ((a − a₂) : 2)²)", hs, mittel(E[0], E[1]), mittel(E[4], E[5])),
    ],
    zaehlung: zaehle(p),
  };
};

/** Zylinder, Kegel und Kegelstumpf: ein Mantel von r1 unten nach r2 oben. */
const mantelDaten = (art: "zylinder" | "kegel" | "kstumpf", r1: number, r2: number, h: number): Daten => {
  const s = Math.hypot(h, r1 - r2);
  const Gw = π * r1 * r1, Dw = π * r2 * r2;
  const rG = art === "kstumpf" ? "r₁" : "r";
  const G = gr("Grundfläche", `G = π · ${rG}²`, `G = π · ${z(r1)}² ${ist(Gw, "cm²")}`, Gw, "cm²");
  const D = art === "kegel" ? undefined
    : art === "zylinder" ? gr("Deckfläche", "D = π · r²", `D = π · ${z(r2)}² ${ist(Dw, "cm²")}`, Dw, "cm²")
    : gr("Deckfläche", "D = π · r₂²", `D = π · ${z(r2)}² ${ist(Dw, "cm²")}`, Dw, "cm²");
  let M: Groesse, V: Groesse;
  if (art === "zylinder") {
    M = gr("Mantelfläche", "M = 2 · π · r · h", `M = 2 · π · ${z(r1)} · ${z(h)} ${ist(2 * π * r1 * h, "cm²")}`, 2 * π * r1 * h, "cm²");
    V = gr("Volumen", "V = π · r² · h", `V = π · ${z(r1)}² · ${z(h)} ${ist(Gw * h, "cm³")}`, Gw * h, "cm³");
  } else if (art === "kegel") {
    M = gr("Mantelfläche", "M = π · r · s", `s = √(r² + h²) ${ist(s, "cm")}; M = π · ${z(r1)} · ${z(s)} ${ist(π * r1 * s, "cm²")}`, π * r1 * s, "cm²");
    V = gr("Volumen", "V = ⅓ · π · r² · h", `V = ⅓ · π · ${z(r1)}² · ${z(h)} ${ist(Gw * h / 3, "cm³")}`, Gw * h / 3, "cm³");
  } else {
    const mw = π * s * (r1 + r2), vw = π * h / 3 * (r1 * r1 + r1 * r2 + r2 * r2);
    M = gr("Mantelfläche", "M = π · s · (r₁ + r₂)", `s = √(h² + (r₁ − r₂)²) ${ist(s, "cm")}; M = π · ${z(s)} · (${z(r1)} + ${z(r2)}) ${ist(mw, "cm²")}`, mw, "cm²");
    V = gr("Volumen", "V = ⅓ · π · h · (r₁² + r₁ · r₂ + r₂²)", `V = ⅓ · π · ${z(h)} · (${z(r1)}² + ${z(r1)} · ${z(r2)} + ${z(r2)}²) ${ist(vw, "cm³")}`, vw, "cm³");
  }
  const formM = art === "zylinder" ? "Rechteck (abgerollt: 2 · π · r breit, h hoch)" : art === "kegel" ? "Kreisausschnitt mit Radius s" : "Ausschnitt eines Kreisrings";
  const teile = [
    teil("G", "G", "Grundfläche", "Kreis", G.formel, G.rechnung, Gw),
    ...(D ? [teil("D", "D", "Deckfläche", "Kreis", D.formel, D.rechnung, Dw)] : []),
    teil("M", "M", "Mantelfläche", formM, M.formel, M.rechnung, M.wert),
  ];
  const linien: Linie[] = [
    lin(art === "kstumpf" ? "r1" : "r", rG, art === "kstumpf" ? "Radius unten r₁" : "Radius r", "", r1, [0, 0, 0], [r1, 0, 0]),
    ...(art === "kstumpf" ? [lin("r2", "r₂", "Radius oben r₂", "", r2, [0, h, 0], [r2, h, 0])] : []),
    ...(art === "zylinder" ? [lin("d", "d", "Durchmesser d", "d = 2 · r", 2 * r1, [-r1 * 0.7071, 0, -r1 * 0.7071], [r1 * 0.7071, 0, r1 * 0.7071])] : []),
    lin("h", "h", "Körperhöhe h", "", h, [0, 0, 0], [0, h, 0]),
    ...(art === "zylinder" ? [] : [lin("s", "s", "Mantellinie s", art === "kegel" ? "s = √(r² + h²)" : "s = √(h² + (r₁ − r₂)²)", s, [r1, 0, 0], [r2, h, 0], true)]),
  ];
  const zaehlung: Zaehlung = art === "kegel"
    ? { e: 0, f: 2, k: 1, polyeder: false, hinweis: "Die Spitze zählt nicht als Ecke: Dort treffen keine Kanten zusammen." }
    : { e: 0, f: 3, k: 2, polyeder: false, hinweis: "Die Kanten sind Kreislinien. Für gekrümmte Körper gilt der Eulersche Polyedersatz nicht." };
  return { V, O: oberflaeche(D ? "O = G + D + M" : "O = G + M", G, D, M), M, G, D, teile, linien, zaehlung };
};

const kugelDaten = (r: number, halb: boolean): Daten => {
  if (!halb) {
    const O = 4 * π * r * r, V = 4 / 3 * π * r ** 3;
    const M = gr("Kugelfläche", "O = 4 · π · r²", `O = 4 · π · ${z(r)}² ${ist(O, "cm²")}`, O, "cm²");
    return {
      V: gr("Volumen", "V = ⁴⁄₃ · π · r³", `V = 4 : 3 · π · ${z(r)}³ ${ist(V, "cm³")}`, V, "cm³"),
      O: { ...M, name: "Oberfläche" }, M,
      teile: [teil("M", "M", "Kugelfläche", "gekrümmt, lässt sich nicht abwickeln", M.formel, M.rechnung, O)],
      linien: [
        lin("r", "r", "Radius r", "", r, [0, r, 0], [r, r, 0]),
        lin("d", "d", "Durchmesser d", "d = 2 · r", 2 * r, [0, 0, 0], [0, 2 * r, 0]),
      ],
      zaehlung: { e: 0, f: 1, k: 0, polyeder: false, hinweis: "Die Kugel hat eine einzige gekrümmte Fläche, keine Kante und keine Ecke." },
    };
  }
  const Gw = π * r * r, Mw = 2 * π * r * r, V = 2 / 3 * π * r ** 3;
  const G = gr("Grundfläche", "G = π · r²", `G = π · ${z(r)}² ${ist(Gw, "cm²")}`, Gw, "cm²");
  const M = gr("gekrümmte Fläche", "M = 2 · π · r²", `M = 2 · π · ${z(r)}² ${ist(Mw, "cm²")}`, Mw, "cm²");
  return {
    V: gr("Volumen", "V = ⅔ · π · r³", `V = 2 : 3 · π · ${z(r)}³ ${ist(V, "cm³")}`, V, "cm³"),
    O: gr("Oberfläche", "O = 3 · π · r²", `O = ${z(Gw)} + ${z(Mw)} ${ist(Gw + Mw, "cm²")}`, Gw + Mw, "cm²"),
    M, G,
    teile: [
      teil("G", "G", "Grundfläche", "Kreis", G.formel, G.rechnung, Gw),
      teil("M", "M", "gekrümmte Fläche", "halbe Kugelfläche", M.formel, M.rechnung, Mw),
    ],
    linien: [
      lin("r", "r", "Radius r", "", r, [0, 0, 0], [r, 0, 0]),
      lin("h", "h", "Höhe h = r", "h = r", r, [0, 0, 0], [0, r, 0]),
    ],
    zaehlung: { e: 0, f: 2, k: 1, polyeder: false, hinweis: "Eine ebene und eine gekrümmte Fläche, getrennt von einer kreisförmigen Kante." },
  };
};

export const KOERPER: Record<KoerperKey, Koerper> = {
  wuerfel: {
    key: "wuerfel", name: "Würfel", icon: "🎲", klasse: "5",
    felder: [L("a", "Kante a", 1, 10, 4)],
    rechne: m => quaderDaten(m.a, m.a, m.a, true),
    poly: m => prismaAus(rechteckBasis(m.a, m.a), m.a),
  },
  quader: {
    key: "quader", name: "Quader", icon: "📦", klasse: "5",
    felder: [L("a", "Länge a", 1, 12, 6), L("b", "Breite b", 1, 12, 4), L("c", "Höhe c", 1, 12, 3)],
    rechne: m => quaderDaten(m.a, m.b, m.c, false),
    poly: m => prismaAus(rechteckBasis(m.a, m.b), m.c),
  },
  prisma3: {
    key: "prisma3", name: "Dreiseitiges Prisma", icon: "🔺", klasse: "7",
    felder: [L("g", "Grundseite g", 1, 10, 5), L("hg", "Dreieckshöhe h_g", 1, 10, 4), L("h", "Körperhöhe h", 1, 12, 7)],
    rechne: m => prisma3Daten(m.g, m.hg, m.h),
    poly: m => prisma3Poly(m.g, m.hg, m.h),
  },
  prisma6: {
    key: "prisma6", name: "Sechsseitiges Prisma", icon: "⬡", klasse: "7",
    felder: [L("a", "Grundkante a", 1, 6, 3), L("h", "Körperhöhe h", 1, 12, 6)],
    rechne: m => prisma6Daten(m.a, m.h),
    poly: m => prismaAus(sechseck(m.a), m.h),
  },
  zylinder: {
    key: "zylinder", name: "Zylinder", icon: "🥫", klasse: "8",
    felder: [L("r", "Radius r", 0.5, 6, 3), L("h", "Höhe h", 1, 12, 7)],
    rechne: m => mantelDaten("zylinder", m.r, m.r, m.h),
    rund: m => ({ art: "mantel", r1: m.r, r2: m.r, h: m.h }),
  },
  pyramide4: {
    key: "pyramide4", name: "Quadratische Pyramide", icon: "🔼", klasse: "9",
    felder: [L("a", "Grundkante a", 1, 10, 6), L("h", "Körperhöhe h", 1, 12, 6)],
    rechne: m => pyramideDaten(m.a, m.a, m.h, true),
    poly: m => pyramideAus(rechteckBasis(m.a, m.a), m.h),
  },
  pyramide_r: {
    key: "pyramide_r", name: "Rechteckige Pyramide", icon: "⛺", klasse: "9",
    felder: [L("a", "Grundkante a", 1, 12, 8), L("b", "Grundkante b", 1, 12, 5), L("h", "Körperhöhe h", 1, 12, 6)],
    rechne: m => pyramideDaten(m.a, m.b, m.h, false),
    poly: m => pyramideAus(rechteckBasis(m.a, m.b), m.h),
  },
  kegel: {
    key: "kegel", name: "Kegel", icon: "🍦", klasse: "9",
    felder: [L("r", "Radius r", 0.5, 6, 3), L("h", "Höhe h", 1, 12, 7)],
    rechne: m => mantelDaten("kegel", m.r, 0, m.h),
    rund: m => ({ art: "mantel", r1: m.r, r2: 0, h: m.h }),
  },
  kugel: {
    key: "kugel", name: "Kugel", icon: "⚽", klasse: "10",
    felder: [L("r", "Radius r", 0.5, 6, 3)],
    rechne: m => kugelDaten(m.r, false),
    rund: m => ({ art: "kugel", r1: m.r, r2: m.r, h: 2 * m.r }),
  },
  halbkugel: {
    key: "halbkugel", name: "Halbkugel", icon: "🥣", klasse: "10",
    felder: [L("r", "Radius r", 0.5, 6, 3)],
    rechne: m => kugelDaten(m.r, true),
    rund: m => ({ art: "halbkugel", r1: m.r, r2: 0, h: m.r }),
  },
  pstumpf: {
    key: "pstumpf", name: "Pyramidenstumpf", icon: "🏯", klasse: "10",
    felder: [L("a", "Grundkante a", 2, 10, 7), L("a2", "Deckkante a₂", 0.5, 9.5, 3, "a"), L("h", "Körperhöhe h", 1, 12, 5)],
    rechne: m => pstumpfDaten(m.a, m.a2, m.h),
    poly: m => stumpfAus(rechteckBasis(m.a, m.a), rechteckBasis(m.a2, m.a2), m.h),
  },
  kstumpf: {
    key: "kstumpf", name: "Kegelstumpf", icon: "🪣", klasse: "10",
    felder: [L("r1", "Radius unten r₁", 1, 6, 4), L("r2", "Radius oben r₂", 0.5, 5.5, 2, "r1"), L("h", "Höhe h", 1, 12, 5)],
    rechne: m => mantelDaten("kstumpf", m.r1, m.r2, m.h),
    rund: m => ({ art: "mantel", r1: m.r1, r2: m.r2, h: m.h }),
  },
};

/** Euler: e + f − k als Rechnung. */
export function euler(zl: Zaehlung): string {
  return `e + f − k = ${zl.e} + ${zl.f} − ${zl.k} = ${zl.e + zl.f - zl.k}`;
}
