/**
 * Schrägbilder und Netze der Körper als `Skizze` (lib/geometrie/skizze.ts) —
 * für Übungen, Anwendungen, Word-Export und das Spiel.
 *
 * Ecken-Körper: Kavalierperspektive (Tiefe unter 45° auf die Hälfte
 * verkürzt), verdeckte Kanten gestrichelt. Runde Körper: wie an der Tafel —
 * Kreise werden zu liegenden Ellipsen, deren hintere Hälfte verdeckt ist.
 */
import { KOERPER, dot, kantenVon, normale, type KoerperKey, type Masse, type Polyeder, type Rund, type V3 } from "@/lib/koerper";
import { faltePolyeder, rolleRund } from "@/lib/koerper-netz";
import type { Flaeche, Pt, Skizze, Strecke, Zug } from "@/lib/geometrie/skizze";

/** Eine beschriftete Linie im Bild: »kante« = nur Beschriftung an einer Kante, »hilfe« orange gestrichelt, »gesucht« rot. */
export type Mass = { von: V3; bis: V3; text?: string; art: "kante" | "hilfe" | "gesucht" };

const Q = Math.SQRT1_2 / 2;
export const schraeg = ([x, y, z]: V3): Pt => ({ x: x - Q * z, y: -y + Q * z });
/** Richtung zum Betrachter: Flächen, deren Normale dahin zeigt, sind sichtbar. */
const BLICK: V3 = [Q, Q, 1];
const ELL = 0.35;
export const rundAnsicht = ([x, y, z]: V3): Pt => ({ x, y: -y + ELL * z });

function strecken(masse: Mass[], proj: (p: V3) => Pt): Strecke[] {
  return masse.map(m => ({ a: proj(m.von), b: proj(m.bis), text: m.text, art: m.art === "kante" ? "unsichtbar" : m.art }));
}

/** Kavalier-Schrägbild eines konvexen Polyeders. */
export function skizzePoly(p: Polyeder, masse: Mass[] = [], extra: Partial<Skizze> = {}): Skizze {
  const P = p.ecken.map(schraeg);
  const sichtbar = p.flaechen.map(f => dot(normale(f.idx.map(i => p.ecken[i])), BLICK) > 1e-6);
  const flaechen: Flaeche[] = p.flaechen.flatMap((f, i) => {
    if (!sichtbar[i]) return [];
    const n = normale(f.idx.map(j => p.ecken[j]));
    return [{ pts: f.idx.map(j => P[j]), deckkraft: n[1] > 0.5 ? 0.08 : n[2] > 0.5 ? 0.18 : 0.3 }];
  });
  const zuege: Zug[] = kantenVon(p)
    .filter(k => !k.flaechen.some(f => sichtbar[f]))
    .map(k => ({ pts: [P[k.a], P[k.b]], art: "verdeckt" }));
  return {
    ...extra,
    flaechen: [...flaechen, ...(extra.flaechen ?? [])],
    zuege: [...zuege, ...(extra.zuege ?? [])],
    strecken: [...strecken(masse, schraeg), ...(extra.strecken ?? [])],
    nichtMassstaeblich: true,
  };
}

/* ───────────────────────────────────────────────── runde Körper ── */

/** Ein Stück eines Drehkörpers: Mantel von Radius r0 (unten, y0) nach r1 (oben, y1) oder eine Kuppel über/unter y0. */
export type Segment =
  | { typ: "mantel"; r0: number; r1: number; y0: number; y1: number }
  | { typ: "kuppel"; r: number; y0: number; richtung: 1 | -1 };

const N = 36;
function ring(r: number, y: number, von: number, bis: number): Pt[] {
  return Array.from({ length: N + 1 }, (_, i) => {
    const w = von + (bis - von) * i / N;
    return rundAnsicht([r * Math.cos(w), y, r * Math.sin(w)]);
  });
}

/** Umriss rechts von unten nach oben als (r, y). */
function profil(segs: Segment[]): [number, number][] {
  const out: [number, number][] = [];
  for (const s of segs) {
    if (s.typ === "mantel") out.push([s.r0, s.y0], [s.r1, s.y1]);
    else for (let i = 0; i <= N / 2; i++) {
      const w = (s.richtung > 0 ? i : i - N / 2) / (N / 2) * Math.PI / 2;
      out.push([s.r * Math.cos(w), s.y0 + s.r * Math.sin(w)]);
    }
  }
  return out;
}

/** Schrägbild eines Stapels runder Teile (Zylinder, Kegel, Kugel, Silo, Turm, Eistüte …). */
export function skizzeStapel(segs: Segment[], masse: Mass[] = [], extra: Partial<Skizze> = {}): Skizze {
  const pr = profil(segs);
  const unten = pr[0], oben = pr[pr.length - 1];
  const umriss: Pt[] = [
    ...pr.map(([r, y]) => rundAnsicht([r, y, 0])),
    ...(oben[0] > 1e-9 ? ring(oben[0], oben[1], 0, -Math.PI) : []),
    ...[...pr].reverse().map(([r, y]) => rundAnsicht([-r, y, 0])),
    ...(unten[0] > 1e-9 ? ring(unten[0], unten[1], Math.PI, 0) : []),
  ];
  const zuege: Zug[] = [];
  if (unten[0] > 1e-9) zuege.push({ pts: ring(unten[0], unten[1], 0, -Math.PI), art: "verdeckt" });
  // Fugen zwischen zwei Teilen: vorne sichtbar, hinten verdeckt.
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    const r = s.typ === "mantel" ? s.r1 : s.richtung < 0 ? s.r : 0;
    const y = s.typ === "mantel" ? s.y1 : s.y0;
    if (r > 1e-9) zuege.push({ pts: ring(r, y, 0, Math.PI), art: "sichtbar" }, { pts: ring(r, y, 0, -Math.PI), art: "verdeckt" });
  }
  if (oben[0] > 1e-9) zuege.push({ pts: ring(oben[0], oben[1], 0, Math.PI), art: "sichtbar" });
  return {
    ...extra,
    flaechen: [{ pts: umriss, deckkraft: 0.16 }, ...(extra.flaechen ?? [])],
    zuege: [...zuege, ...(extra.zuege ?? [])],
    strecken: [...strecken(masse, rundAnsicht), ...(extra.strecken ?? [])],
    nichtMassstaeblich: true,
  };
}

export function segmenteVon(r: Rund): Segment[] {
  if (r.art === "kugel") return [{ typ: "kuppel", r: r.r1, y0: r.r1, richtung: -1 }, { typ: "kuppel", r: r.r1, y0: r.r1, richtung: 1 }];
  if (r.art === "halbkugel") return [{ typ: "kuppel", r: r.r1, y0: 0, richtung: 1 }];
  return [{ typ: "mantel", r0: r.r1, r1: r.r2, y0: 0, y1: r.h }];
}

/**
 * Schrägbild eines Körpers aus dem Labor. `texte` beschriftet seine Linien
 * (Schlüssel wie in `rechne().linien`, z. B. a, h, r, s); ein »?« im Text
 * macht die Linie rot (gesucht).
 */
export function skizzeKoerper(key: KoerperKey, m: Masse, texte: Partial<Record<string, string>> = {}): Skizze {
  const k = KOERPER[key];
  const masse: Mass[] = k.rechne(m).linien.flatMap(l => {
    const t = texte[l.id];
    if (t === undefined) return [];
    return [{ von: l.von, bis: l.bis, text: t, art: t.includes("?") ? "gesucht" : l.kante ? "kante" : "hilfe" } as Mass];
  });
  return k.poly ? skizzePoly(k.poly(m), masse) : skizzeStapel(segmenteVon(k.rund!(m)), masse);
}

/* ─────────────────────────────────────────────────────────── Netz ── */

export const TEILFARBE = { G: "#3b82f6", D: "#10b981", M: "#f59e0b" } as const;
const farbeVon = (teil: string) => TEILFARBE[(teil[0] as "G" | "D" | "M")] ?? TEILFARBE.M;

/** Flach ausgelegtes Netz, oder null (Kugel und Halbkugel lassen sich nicht abwickeln). */
export function skizzeNetz(key: KoerperKey, m: Masse): Skizze | null {
  const k = KOERPER[key];
  if (k.poly) {
    return { flaechen: faltePolyeder(k.poly(m), 0).map(f => ({ pts: f.pts.map(([x, , z]) => ({ x, y: z })), farbe: farbeVon(f.teil), deckkraft: 0.22 })) };
  }
  const r = k.rund!(m);
  if (r.art !== "mantel") return null;
  const n = rolleRund(r, 0);
  const { o, x, y } = n.ebene;
  const flach = (p: V3): Pt => {
    const v: V3 = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
    return { x: dot(v, x), y: dot(v, y) };
  };
  return {
    flaechen: [
      { pts: [...n.mantel[0], ...[...n.mantel[1]].reverse()].map(flach), farbe: TEILFARBE.M, deckkraft: 0.22 },
      ...n.kreise.map(c => ({ pts: c.pts.map(flach), farbe: farbeVon(c.teil), deckkraft: 0.22 })),
    ],
  };
}
