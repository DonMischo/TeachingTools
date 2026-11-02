/**
 * Kampfregeln von »Elemon«: rein und deterministisch. Eine Runde bekommt die
 * Züge beider Seiten und einen Startwert für den Zufall — so rechnen bei einem
 * Duell beide Handys exakt dasselbe aus, der Server reicht nur die Züge weiter.
 */
import { ART, ATTACKEN, lernliste, wirkung, type ElementId } from "./daten";

export interface Elemon {
  art: string;
  stufe: number;
  xp: number;
  kp: number;
  attacken: string[];
}

export type SeiteId = "a" | "b";
export interface Seite { name: string; team: Elemon[]; aktiv: number }

export type Zug =
  | { art: "angriff"; nr: number }
  | { art: "wechsel"; nr: number }
  | { art: "trank" }
  | { art: "kaefig"; gold?: boolean }
  | { art: "flucht" }
  | { art: "aufgeben" };

export type Ereignis =
  | { typ: "angriff"; seite: SeiteId; attacke: string; schaden: number; faktor: number; verfehlt?: boolean; kritisch?: boolean }
  | { typ: "heilung"; seite: SeiteId; attacke: string; menge: number }
  | { typ: "ko"; seite: SeiteId; nr: number }
  | { typ: "wechsel"; seite: SeiteId; nr: number }
  | { typ: "trank"; seite: SeiteId; menge: number }
  | { typ: "kaefig"; wackeln: number; gefangen: boolean }
  | { typ: "flucht"; ok: boolean }
  | { typ: "aufgabe"; seite: SeiteId }
  | { typ: "ende"; sieger: SeiteId; gefangen?: boolean; geflohen?: boolean };

export interface Kampf {
  a: Seite;
  b: Seite;
  /** wilder Kampf: Käfig und Flucht erlaubt */
  wild: boolean;
  seed: number;
  runde: number;
  ende?: { sieger: SeiteId; gefangen?: boolean; geflohen?: boolean };
}

// --- Zufall --------------------------------------------------------------

/** mulberry32: kleiner, überall gleicher Zufallsgenerator */
export function zufall(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Werte ---------------------------------------------------------------

export const maxKp = (e: Elemon) => Math.floor((ART[e.art].kp * 2 * e.stufe) / 100) + e.stufe + 10;
export const wert = (e: Elemon, w: "ang" | "ver" | "tempo") => Math.floor((ART[e.art][w] * 2 * e.stufe) / 100) + 5;
/** XP bis zur nächsten Stufe */
export const xpBis = (stufe: number) => 10 * stufe;

/** Neues Elemon mit den Attacken, die es bis zu dieser Stufe gelernt hätte (die letzten vier) */
export function neuesElemon(art: string, stufe: number): Elemon {
  const attacken = lernliste(ART[art]).filter(([s]) => s <= stufe).map(([, id]) => id).slice(-4);
  const e: Elemon = { art, stufe, xp: 0, kp: 0, attacken };
  e.kp = maxKp(e);
  return e;
}

export const lebt = (e: Elemon) => e.kp > 0;
export const aktivVon = (s: Seite) => s.team[s.aktiv];

export function neuerKampf(a: Seite, b: Seite, wild: boolean, seed: number): Kampf {
  return { a: structuredClone(a), b: structuredClone(b), wild, seed, runde: 0 };
}

/** Schaden einer Attacke (ohne Treffer- und Kritisch-Wurf) */
export function schaden(taeter: Elemon, opfer: Elemon, attacke: string, wurf: number, kritisch: boolean) {
  const at = ATTACKEN[attacke];
  const faktor = wirkung(at.element, ART[opfer.art].elemente);
  if (faktor === 0) return { schaden: 0, faktor };
  const stab = at.element && ART[taeter.art].elemente.includes(at.element) ? 1.5 : 1;
  const grund = ((2 * taeter.stufe / 5 + 2) * at.staerke * wert(taeter, "ang") / wert(opfer, "ver")) / 50 + 2;
  const s = Math.floor(grund * stab * faktor * (0.85 + wurf * 0.15) * (kritisch ? 1.5 : 1));
  return { schaden: Math.max(1, s), faktor };
}

/** Was die KI (wilde Elemon, Trainer) zieht: die Attacke mit dem meisten erwarteten Schaden, geschwächt heilt sie */
export function kiZug(k: Kampf, seite: SeiteId = "b"): Zug {
  const ich = aktivVon(k[seite]), gegner = aktivVon(k[seite === "a" ? "b" : "a"]);
  let best = 0, bestWert = -1;
  ich.attacken.forEach((id, nr) => {
    const at = ATTACKEN[id];
    const w = at.heilt ? (ich.kp < maxKp(ich) * 0.4 ? 999 : -1) : schaden(ich, gegner, id, 0.5, false).schaden * at.genau / 100;
    if (w > bestWert) { best = nr; bestWert = w; }
  });
  return { art: "angriff", nr: best };
}

/**
 * Wie wahrscheinlich der Käfig hält: Fangrate der Art, angeschlagene Elemon
 * leichter, Goldkäfig doppelt — und junge Elemon (niedrige Stufe) deutlich
 * leichter, damit der Anfang nicht frustriert. Seltene bleiben schwer.
 */
export function fangChance(wild: Elemon, gold = false): number {
  const anteil = wild.kp / maxKp(wild);
  const stufenBonus = Math.max(0, 12 - wild.stufe) * 0.04;
  return Math.min(0.98, ART[wild.art].fang * (1 - 0.5 * anteil) * (gold ? 2 : 1) + stufenBonus + 0.05);
}

// --- Runde ---------------------------------------------------------------

const andere = (s: SeiteId): SeiteId => (s === "a" ? "b" : "a");
const TRANK = 25;

/** Spielt eine Runde; gibt den neuen Kampf und die Ereignisse fürs Abspielen zurück. */
export function runde(alt: Kampf, zugA: Zug, zugB: Zug): { kampf: Kampf; ereignisse: Ereignis[] } {
  const k = structuredClone(alt);
  const ev: Ereignis[] = [];
  if (k.ende) return { kampf: k, ereignisse: ev };
  const r = zufall(k.seed * 31 + k.runde * 7919 + 1);
  k.runde++;
  const zuege: Record<SeiteId, Zug> = { a: zugA, b: zugB };
  const ende = (sieger: SeiteId, mehr: { gefangen?: boolean; geflohen?: boolean } = {}) => {
    k.ende = { sieger, ...mehr };
    ev.push({ typ: "ende", sieger, ...mehr });
  };

  // 1. Aufgeben, Flucht, Wechsel, Trank und Käfig kommen vor jedem Angriff
  for (const s of ["a", "b"] as SeiteId[]) {
    const z = zuege[s];
    if (z.art === "aufgeben") { ev.push({ typ: "aufgabe", seite: s }); ende(andere(s)); return { kampf: k, ereignisse: ev }; }
  }
  for (const s of ["a", "b"] as SeiteId[]) {
    const z = zuege[s], seite = k[s];
    if (z.art === "wechsel" && z.nr !== seite.aktiv && seite.team[z.nr] && lebt(seite.team[z.nr])) {
      seite.aktiv = z.nr;
      ev.push({ typ: "wechsel", seite: s, nr: z.nr });
    }
    if (z.art === "trank") {
      const e = aktivVon(seite), vorher = e.kp;
      e.kp = Math.min(maxKp(e), e.kp + TRANK);
      ev.push({ typ: "trank", seite: s, menge: e.kp - vorher });
    }
  }
  const za = zuege.a;
  if (k.wild && za.art === "flucht") {
    const ok = r() < 0.5 + (wert(aktivVon(k.a), "tempo") - wert(aktivVon(k.b), "tempo")) / 100;
    ev.push({ typ: "flucht", ok });
    if (ok) { ende("b", { geflohen: true }); return { kampf: k, ereignisse: ev }; }
  }
  if (k.wild && za.art === "kaefig") {
    const chance = fangChance(aktivVon(k.b), !!za.gold);
    // drei Wackler: jeder hält mit chance^(1/3); alle drei = gefangen
    let wackeln = 0;
    while (wackeln < 3 && r() < Math.cbrt(chance)) wackeln++;
    const gefangen = wackeln === 3;
    ev.push({ typ: "kaefig", wackeln, gefangen });
    if (gefangen) { ende("a", { gefangen: true }); return { kampf: k, ereignisse: ev }; }
  }

  // 2. Angriffe nach Tempo; bei Gleichstand entscheidet der Zufall
  const tempoA = wert(aktivVon(k.a), "tempo"), tempoB = wert(aktivVon(k.b), "tempo");
  const reihe: SeiteId[] = tempoA > tempoB || (tempoA === tempoB && r() < 0.5) ? ["a", "b"] : ["b", "a"];
  // Wer in dieser Runde erst eingewechselt wurde (nach einem K.o.), greift nicht mehr an: der K.o. beendet die Runde
  const frisch = new Set<SeiteId>();
  for (const s of reihe) {
    const z = zuege[s];
    if (z.art !== "angriff" || k.ende || frisch.has(s)) continue;
    const taeter = aktivVon(k[s]), opferSeite = k[andere(s)], opfer = aktivVon(opferSeite);
    if (!lebt(taeter)) continue;
    const id = taeter.attacken[z.nr] ?? taeter.attacken[0];
    const at = ATTACKEN[id];
    const trifft = r() * 100 < at.genau;
    if (at.heilt) {
      const menge = trifft ? Math.min(maxKp(taeter) - taeter.kp, Math.ceil(maxKp(taeter) * at.heilt)) : 0;
      taeter.kp += menge;
      ev.push({ typ: "heilung", seite: s, attacke: id, menge });
      continue;
    }
    if (!trifft) { ev.push({ typ: "angriff", seite: s, attacke: id, schaden: 0, faktor: 1, verfehlt: true }); continue; }
    const kritisch = r() < 1 / 16;
    const { schaden: sch, faktor } = schaden(taeter, opfer, id, r(), kritisch);
    opfer.kp = Math.max(0, opfer.kp - sch);
    ev.push({ typ: "angriff", seite: s, attacke: id, schaden: sch, faktor, kritisch: kritisch || undefined });
    if (!lebt(opfer)) {
      ev.push({ typ: "ko", seite: andere(s), nr: opferSeite.aktiv });
      // Das nächste fitte Elemon springt von selbst ein — so braucht ein Duell keinen Extra-Zug
      const naechstes = opferSeite.team.findIndex(lebt);
      if (naechstes < 0) ende(s);
      else { opferSeite.aktiv = naechstes; frisch.add(andere(s)); ev.push({ typ: "wechsel", seite: andere(s), nr: naechstes }); }
    }
  }
  return { kampf: k, ereignisse: ev };
}

// --- Erfahrung -----------------------------------------------------------

export interface Aufstieg { nr: number; stufe: number; gelernt: string[]; vergessen: string[] }

/** XP für alle, die noch stehen; liefert neue Stufen und gelernte Attacken */
export function erfahrung(team: Elemon[], besiegt: Elemon[]): { team: Elemon[]; aufstiege: Aufstieg[]; xp: number } {
  const xp = besiegt.reduce((summe, e) => summe + 5 + e.stufe * 6, 0);
  const neu = structuredClone(team);
  const aufstiege: Aufstieg[] = [];
  neu.forEach((e, nr) => {
    if (!lebt(e)) return;
    e.xp += xp;
    const auf: Aufstieg = { nr, stufe: e.stufe, gelernt: [], vergessen: [] };
    while (e.stufe < 50 && e.xp >= xpBis(e.stufe)) {
      e.xp -= xpBis(e.stufe);
      const plus = maxKp({ ...e, stufe: e.stufe + 1 }) - maxKp(e);
      e.stufe++;
      e.kp += plus;
      for (const [s, id] of lernliste(ART[e.art])) {
        if (s !== e.stufe || e.attacken.includes(id)) continue;
        // Volle Liste: die schwächste vergessen (Rempler zuerst)
        if (e.attacken.length >= 4) {
          const weg = [...e.attacken].sort((x, y) => (ATTACKEN[x].staerke || 60) - (ATTACKEN[y].staerke || 60))[0];
          e.attacken = e.attacken.filter(x => x !== weg);
          auf.vergessen.push(weg);
        }
        e.attacken.push(id);
        auf.gelernt.push(id);
      }
    }
    if (e.stufe > auf.stufe) aufstiege.push({ ...auf, stufe: e.stufe });
  });
  return { team: neu, aufstiege, xp };
}

export const heile = (team: Elemon[]) => team.map(e => ({ ...e, kp: maxKp(e) }));

export const elementeVon = (e: Elemon): ElementId[] => ART[e.art].elemente;
