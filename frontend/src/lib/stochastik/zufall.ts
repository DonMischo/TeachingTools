/**
 * Zufallsexperimente: Würfel, Münze, Glücksrad, Urne (mit oder ohne
 * Zurücklegen). Ein Experiment kennt je Stufe seine Ausgänge samt exakter
 * Wahrscheinlichkeit; daraus entstehen Baumdiagramm, Simulation und
 * Pfadregeln. Ohne Zurücklegen hängt die nächste Stufe davon ab, was schon
 * gezogen wurde – deshalb bekommt `ausgaenge` die bisherigen Ergebnisse.
 */
import { bruch, mal, summe, wert, type Bruch, type Zufall } from "./zahlen";

export const FARBEN = {
  rot: "#ef4444", blau: "#3b82f6", gruen: "#22c55e", gelb: "#eab308",
  lila: "#a855f7", orange: "#f97316", tuerkis: "#14b8a6", pink: "#ec4899",
} as const;
export type FarbName = keyof typeof FARBEN;
export const FARB_LABEL: Record<FarbName, string> = {
  rot: "rot", blau: "blau", gruen: "grün", gelb: "gelb", lila: "lila", orange: "orange", tuerkis: "türkis", pink: "pink",
};
/** Reihum für Datenreihen und Kategorien. */
export const REIHE = ["#3b82f6", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#14b8a6", "#eab308", "#ec4899", "#64748b", "#84cc16"];

export type Experiment =
  | { art: "wuerfel"; seiten: number }
  | { art: "muenze" }
  | { art: "rad"; felder: { label: string; farbe: FarbName; anteil: number }[] }
  | { art: "urne"; kugeln: Partial<Record<FarbName, number>>; zuruecklegen: boolean };

export interface Ausgang { id: string; label: string; farbe: string; p: Bruch }

const MUENZE: Ausgang[] = [
  { id: "K", label: "Kopf", farbe: "#eab308", p: bruch(1, 2) },
  { id: "Z", label: "Zahl", farbe: "#64748b", p: bruch(1, 2) },
];

export function ausgaenge(e: Experiment, bisher: readonly string[] = []): Ausgang[] {
  switch (e.art) {
    case "wuerfel":
      return Array.from({ length: e.seiten }, (_, i) => ({ id: String(i + 1), label: String(i + 1), farbe: REIHE[i % REIHE.length], p: bruch(1, e.seiten) }));
    case "muenze":
      return MUENZE;
    case "rad": {
      const ges = e.felder.reduce((a, f) => a + f.anteil, 0);
      // gleich benannte Felder zusammenfassen: zwei rote Felder sind ein Ausgang »rot«
      const z = new Map<string, { f: (typeof e.felder)[number]; n: number }>();
      for (const f of e.felder) {
        const alt = z.get(f.label);
        z.set(f.label, { f, n: (alt?.n ?? 0) + f.anteil });
      }
      return [...z.values()].map(({ f, n }) => ({ id: f.label, label: f.label, farbe: FARBEN[f.farbe], p: bruch(n, ges) }));
    }
    case "urne": {
      const rest: Partial<Record<FarbName, number>> = { ...e.kugeln };
      if (!e.zuruecklegen) for (const b of bisher) rest[b as FarbName] = (rest[b as FarbName] ?? 0) - 1;
      const ges = Object.values(rest).reduce((a, n) => a + Math.max(0, n ?? 0), 0);
      if (ges <= 0) return [];
      return (Object.keys(rest) as FarbName[])
        .filter(k => (rest[k] ?? 0) > 0)
        .map(k => ({ id: k, label: FARB_LABEL[k], farbe: FARBEN[k], p: bruch(rest[k]!, ges) }));
    }
  }
}

export function experimentName(e: Experiment): string {
  if (e.art === "wuerfel") return e.seiten === 6 ? "Würfel" : `${e.seiten}er-Würfel`;
  if (e.art === "muenze") return "Münze";
  if (e.art === "rad") return "Glücksrad";
  return e.zuruecklegen ? "Urne mit Zurücklegen" : "Urne ohne Zurücklegen";
}

/** Ein Ausgang nach seinen Wahrscheinlichkeiten. */
export function ziehe(e: Experiment, bisher: readonly string[], r: Zufall): string {
  const a = ausgaenge(e, bisher);
  let x = r();
  for (const o of a) {
    x -= wert(o.p);
    if (x < 0) return o.id;
  }
  return a[a.length - 1].id;
}

/** `n` Durchführungen mit je `stufen` Stufen. */
export function simuliere(e: Experiment, stufen: number, n: number, r: Zufall): string[][] {
  const aus: string[][] = [];
  for (let i = 0; i < n; i++) {
    const lauf: string[] = [];
    for (let s = 0; s < stufen; s++) lauf.push(ziehe(e, lauf, r));
    aus.push(lauf);
  }
  return aus;
}

// ── Baumdiagramm ──────────────────────────────────────────────────────────

export interface Knoten {
  pfad: string[];
  /** Wahrscheinlichkeit am Ast, der zu diesem Knoten führt. */
  p: Bruch;
  /** Produkt entlang des Pfades (1. Pfadregel). */
  pPfad: Bruch;
  ausgang?: Ausgang;
  kinder: Knoten[];
}

export function baum(e: Experiment, stufen: number): Knoten {
  const bau = (pfad: string[], p: Bruch, pPfad: Bruch, ausgang?: Ausgang): Knoten => ({
    pfad, p, pPfad, ausgang,
    kinder: pfad.length >= stufen ? [] : ausgaenge(e, pfad).map(o => bau([...pfad, o.id], o.p, mal(pPfad, o.p), o)),
  });
  return bau([], bruch(1), bruch(1));
}

export function blaetter(k: Knoten): Knoten[] {
  return k.kinder.length ? k.kinder.flatMap(blaetter) : [k];
}

/** 2. Pfadregel: Summe der Pfade, die zum Ereignis gehören. */
export function pEreignis(wurzel: Knoten, gehoert: (pfad: string[]) => boolean): Bruch {
  return summe(blaetter(wurzel).filter(b => gehoert(b.pfad)).map(b => b.pPfad));
}

// ── Gesetz der großen Zahlen ─────────────────────────────────────────────

/** Relative Häufigkeit eines Ereignisses nach 1, 2, … n Versuchen (höchstens `punkte` Stützstellen). */
export function verlauf(treffer: readonly boolean[], punkte = 200): { n: number; h: number }[] {
  const aus: { n: number; h: number }[] = [];
  let t = 0;
  const schritt = Math.max(1, Math.floor(treffer.length / punkte));
  treffer.forEach((x, i) => {
    if (x) t++;
    const n = i + 1;
    if (n % schritt === 0 || n === treffer.length || n <= 10) aus.push({ n, h: t / n });
  });
  return aus;
}
