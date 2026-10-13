/**
 * Karten aus den Markov-Regeln des Regel-Labors (lib/gebaeude), für alle
 * Challenge-Modi: Verlies (Säle und Gänge), Haus (Zimmer an einem Flur) und
 * Labyrinth (das reine WBB=WAW-Labyrinth, jede Sackgasse ist ein Ort).
 * Gleicher Seed, gleiche Karte.
 */
import { abstaende, bauePlan, begehbar as istBegehbar, weg as kuerzesterWeg, type Punkt, type Stockwerk } from "@/lib/gebaeude/plan";

export type KartenArt = "verlies" | "haus" | "labyrinth";
export type Ort = { x: number; y: number; tuer: Punkt };

export type MarkovKarte = {
  R: number;
  boden: boolean[];
  start: Punkt;
  /** Säle/Zimmer/Sackgassen, nach Entfernung vom Start sortiert (nächster zuerst) */
  orte: Ort[];
  /** dasselbe als Stockwerk (für lib/gebaeude) */
  st: Stockwerk;
  begehbar(p: Punkt): boolean;
  /** kürzester Weg ohne Startfeld, mit Zielfeld; leer, wenn keiner */
  weg(von: Punkt, nach: Punkt): Punkt[];
  /** Felder vom Start; −1 = Wand oder unerreichbar */
  abstand(p: Punkt): number;
};

const NACHBARN: Punkt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function markovKarte(seed: number, anzahlOrte: number, art: KartenArt = "verlies"): MarkovKarte {
  const n = Math.max(1, anzahlOrte);
  const plan = bauePlan([n], art === "labyrinth" ? seed + 7919 : seed, art === "verlies" ? "verlies" : "haus");
  const R = plan.R;
  const st = plan.stockwerke[0];
  const d = abstaende(R, st, st.start);
  const abstand = ([x, y]: Punkt) => (x < 0 || y < 0 || x >= R || y >= R ? -1 : d[y * R + x]);
  let orte: Ort[] = st.raeume.map(r => ({ x: r.x, y: r.y, tuer: r.tuer }));
  if (art === "labyrinth") {
    orte = [];
    for (let y = 1; y < R; y += 2) {
      for (let x = 1; x < R; x += 2) {
        if (x === st.start[0] && y === st.start[1]) continue;
        const offen = NACHBARN.map(([dx, dy]) => [x + dx, y + dy] as Punkt).filter(q => istBegehbar(R, st, q));
        if (offen.length === 1) orte.push({ x, y, tuer: offen[0] });
      }
    }
    orte.sort((a, b) => abstand([a.x, a.y]) - abstand([b.x, b.y]));
  }
  return {
    R, boden: st.boden, start: st.start, orte, st,
    begehbar: p => istBegehbar(R, st, p),
    weg: (von, nach) => kuerzesterWeg(R, st, von, nach),
    abstand,
  };
}

/** Vom Start zum entferntesten begehbaren Feld (z. B. die Strecke im Turmverteidigungs-Modus). */
export function laengsterPfad(karte: MarkovKarte): Punkt[] {
  let fern = karte.start;
  let best = 0;
  for (let y = 0; y < karte.R; y++) {
    for (let x = 0; x < karte.R; x++) {
      const a = karte.abstand([x, y]);
      if (a > best) { best = a; fern = [x, y]; }
    }
  }
  return [karte.start, ...karte.weg(karte.start, fern)];
}

/** `n` Felder (Boden oder Wand) neben dem Pfad, gleichmäßig über seine Länge verteilt. */
export function bauplaetze(karte: MarkovKarte, pfad: Punkt[], n: number): Punkt[] {
  const auf = new Set(pfad.map(([x, y]) => y * karte.R + x));
  const gesehen = new Set<number>();
  const kandidaten: Punkt[] = [];
  for (const [x, y] of pfad) {
    for (const [dx, dy] of NACHBARN) {
      const p: Punkt = [x + dx, y + dy];
      const k = p[1] * karte.R + p[0];
      if (p[0] < 0 || p[1] < 0 || p[0] >= karte.R || p[1] >= karte.R || auf.has(k) || gesehen.has(k)) continue;
      gesehen.add(k);
      kandidaten.push(p);
    }
  }
  if (kandidaten.length <= n) return kandidaten;
  return Array.from({ length: n }, (_, i) => kandidaten[Math.floor(((i + 0.5) * kandidaten.length) / n)]);
}

export type Knoten = { id: number; schicht: number; x: number; y: number };
export type KnotenKarte = { knoten: Knoten[]; kanten: [number, number][]; schichten: number };

/**
 * Kleine Slay-the-Spire-Karte aus dem Labyrinth: Start, Kreuzungen und Sackgassen sind die Knoten,
 * die Gänge dazwischen die Kanten. Die Schicht ist die Tiefe im Baum (höchstens `etappen`);
 * jeder Knoten ist vom ersten (id 0, Schicht 0) aus erreichbar, Kanten führen eine Schicht weiter.
 */
export function knotenKarte(seed: number, etappen: number): KnotenKarte {
  const k = markovKarte(seed, Math.max(6, etappen * 4), "labyrinth");
  const offene = ([x, y]: Punkt) => NACHBARN.map(([dx, dy]) => [x + dx, y + dy] as Punkt).filter(q => k.begehbar(q));
  const istKnoten = (p: Punkt) => (p[0] === k.start[0] && p[1] === k.start[1]) || offene(p).length !== 2;
  const knoten: Knoten[] = [{ id: 0, schicht: 0, x: k.start[0], y: k.start[1] }];
  const kanten: [number, number][] = [];
  const nummer = new Map<number, number>([[k.start[1] * k.R + k.start[0], 0]]);
  const schlange: Punkt[] = [k.start];
  for (let i = 0; i < schlange.length; i++) {
    const von = schlange[i];
    const vid = nummer.get(von[1] * k.R + von[0])!;
    if (knoten[vid].schicht >= etappen - 1) continue;
    for (const erster of offene(von)) {
      let davor = von, p = erster;
      while (!istKnoten(p)) {
        const weiter = offene(p).find(q => q[0] !== davor[0] || q[1] !== davor[1]);
        if (!weiter) break;
        davor = p; p = weiter;
      }
      const key = p[1] * k.R + p[0];
      if (nummer.has(key)) continue; // zurück zum Elternknoten
      const id = knoten.length;
      nummer.set(key, id);
      knoten.push({ id, schicht: knoten[vid].schicht + 1, x: p[0], y: p[1] });
      kanten.push([vid, id]);
      schlange.push(p);
    }
  }
  return { knoten, kanten, schichten: Math.max(...knoten.map(n => n.schicht)) + 1 };
}
