/**
 * Nahverkehr (ÖPNV): Linien und Haltestellen je Epoche, und wie gut die
 * Häuser angebunden sind. Faustregel der Verkehrsplanung: Wer höchstens
 * 400 m (Bus/Tram) bzw. 800 m (S-/U-Bahn) zur Haltestelle hat, gilt als
 * erschlossen.
 *   ab 1880  Straßenbahn auf den Hauptstraßen (erst Pferd, dann elektrisch)
 *   ab 1950  Amerika baut die Straßenbahn ab, Busse fahren zu den Vororten
 *   ab 1970  große Städte: S-Bahn auf der Eisenbahn, U-Bahn ins Zentrum
 */
import type { Gelaende } from "@/lib/gelaende/gelaende";
import { abstand, laenge, punktBei, schwerpunkt, stueckeIn, zurLinie, type P } from "./geometrie";
import type { Haus } from "./haeuser";
import { OEPNV, type Stadt, type Stil, type StrassenArt, type ZonenTyp } from "./modell";
import { glaetten, weg } from "./wege";

/** Jahreszahl aus der Beschriftung einer Epoche (»um 1870«, »2. Jh. n. Chr.«, »heute«) */
export function jahrVon(jahr: string): number {
  if (/heute/i.test(jahr)) return 2025;
  const jh = jahr.match(/(\d+)\.\s*Jh/);
  const v = /v\.\s*Chr/.test(jahr) ? -1 : 1;
  if (jh) return v * (Number(jh[1]) * 100 - 50);
  const n = jahr.match(/\d+/);
  return n ? v * Number(n[0]) : 2025;
}

/** Reichweite zu Fuß je Linienart in Metern */
export const REICHWEITE: Partial<Record<StrassenArt, number>> = { tram: 400, bus: 400, sbahn: 800, ubahn: 600 };

const WOHNEN: ZonenTyp[] = ["grosssiedlung", "einfamilienhaus", "pendler", "platte", "vorort", "arbeiter", "kolonie", "hafencity", "konversion", "gruenderzeit", "tradition", "sozialbau", "marginal", "uni", "campus"];
const AMERIKA: Stil[] = ["amerikanisch", "tech"];

/** Mitte und Radius der bebauten Stadt */
function ausdehnung(s: Stadt): { c: P; r: number } {
  const punkte = s.zonen.filter(z => z.typ !== "obstplantage" && z.typ !== "halde" && z.typ !== "glacis").flatMap(z => z.poly);
  const kern = s.bauten.filter(b => b.typ !== "haltestelle" && b.typ !== "umsteige");
  const c = schwerpunkt(kern.length ? kern : punkte);
  const r = punkte.reduce((m, p) => Math.max(m, abstand(p, c)), 0);
  return { c, r };
}

const kreis = (c: P, r: number): P[] => Array.from({ length: 32 }, (_, i) => ({ x: c.x + Math.cos((i / 32) * Math.PI * 2) * r, y: c.y + Math.sin((i / 32) * Math.PI * 2) * r }));

/** Haltestellen entlang einer Linie im Abstand d */
function halte(s: Stadt, l: P[], d: number) {
  const L = laenge(l);
  for (let t = d / 3; t < L; t += d) {
    const { p } = punktBei(l, t);
    if (s.bauten.some(b => (b.typ === "haltestelle" || b.typ === "umsteige") && abstand(b, p) < d * 0.4)) {
      // andere Linie in der Nähe: Umsteigeknoten
      const nah = s.bauten.find(b => b.typ === "haltestelle" && abstand(b, p) < 80);
      if (nah) nah.typ = "umsteige";
      continue;
    }
    s.bauten.push({ typ: "haltestelle", x: p.x, y: p.y });
  }
}

function linie(s: Stadt, art: StrassenArt, punkte: P[], name: string, abst: number) {
  if (punkte.length < 2 || laenge(punkte) < 300) return false;
  s.strassen.push({ art, name, punkte });
  halte(s, punkte, abst);
  return true;
}

/** Hauptstraßen, im Stadtgebiet abgeschnitten, längste zuerst */
function hauptlinien(s: Stadt, c: P, r: number): P[][] {
  const gebiet = kreis(c, r);
  return s.strassen
    .filter(st => st.art === "haupt" || st.art === "ring" || st.art === "fernstrasse")
    .flatMap(st => stueckeIn(st.punkte, gebiet))
    .filter(l => l.length > 1 && zurLinie(c, l).d < r * 0.5)
    .sort((a, b) => laenge(b) - laenge(a));
}

/** Wohngebiete außerhalb des Kerns, weiteste zuerst */
function aussenGebiete(s: Stadt, c: P, rKern: number): P[] {
  return s.zonen.filter(z => WOHNEN.includes(z.typ)).map(z => schwerpunkt(z.poly)).filter(p => abstand(p, c) > rKern).sort((a, b) => abstand(b, c) - abstand(a, c));
}

/**
 * Legt den Nahverkehr der Epoche an (verändert s) und gibt Stichpunkte für
 * »Neu in dieser Epoche« zurück. Alte Linien werden vorher entfernt, damit
 * jede Epoche ihr eigenes Netz zeigt.
 */
export function nahverkehr(g: Gelaende, s: Stadt, jahr: number, stil: Stil): string[] {
  s.strassen = s.strassen.filter(st => !OEPNV.includes(st.art));
  s.bauten = s.bauten.filter(b => b.typ !== "haltestelle" && b.typ !== "umsteige");
  if (jahr < 1880) return [];
  const { c, r } = ausdehnung(s);
  if (r < 450) return [];
  const neu: string[] = [];
  const amerika = AMERIKA.includes(stil);
  const kosten = { steigung: 0.8, wasser: 12, raster: 24 };

  // Straßenbahn: bis 1950 überall, danach nicht mehr in Amerika (bis zur Stadtbahn heute)
  const tramZeit = jahr < 1950 || !amerika || jahr >= 2000;
  if (tramZeit) {
    let n = 0;
    for (const l of hauptlinien(s, c, r * 0.8)) {
      if (n >= (r > 1200 ? 3 : 2)) break;
      if (s.strassen.some(st => st.art === "tram" && zurLinie(punktBei(l, laenge(l) / 2).p, st.punkte).d < 120)) continue;
      if (linie(s, "tram", l, amerika && jahr >= 2000 ? "Stadtbahn (Light Rail)" : `Straßenbahn ${n + 1}`, 450)) n++;
    }
    if (n) neu.push(amerika && jahr >= 2000 ? "Stadtbahn kehrt zurück" : jahr < 1950 ? "Straßenbahn auf den Hauptstraßen" : "Straßenbahn fährt weiter");
  } else neu.push("Straßenbahn abgebaut — Busse und Autos");

  // Busse zu den Wohngebieten draußen
  if (jahr >= 1950) {
    let n = 0;
    for (const ziel of aussenGebiete(s, c, r * 0.35)) {
      if (n >= 3) break;
      if (s.bauten.some(b => b.typ === "haltestelle" && abstand(b, ziel) < 300)) continue;
      const l = glaetten(weg(g, c, ziel, kosten), 2);
      if (linie(s, "bus", l, `Bus ${n + 1}`, 450)) n++;
    }
    if (n) neu.push("Buslinien zu den neuen Wohngebieten");
  }

  // Schnellbahnen in großen Städten
  if (jahr >= 1970 && r > 1100) {
    const bahn = s.strassen.find(st => st.art === "bahn");
    if (bahn) {
      const teil = stueckeIn(bahn.punkte, kreis(c, r * 1.1)).sort((a, b) => laenge(b) - laenge(a))[0];
      if (teil && linie(s, "sbahn", teil, "S-Bahn", 900)) neu.push("S-Bahn auf der Eisenbahnstrecke");
    }
    const groesse = s.zonen.filter(z => WOHNEN.includes(z.typ)).length;
    if (!amerika && groesse >= 4 && (stil === "hafen" || stil === "industrie" || stil === "europaeisch" || stil === "lateinamerika")) {
      const ziel = aussenGebiete(s, c, r * 0.3)[0];
      if (ziel) {
        const l = [c, ziel];
        if (linie(s, "ubahn", l, "U-Bahn", 700)) neu.push("U-Bahn unter dem Zentrum");
      }
    }
  }
  return neu;
}

/** Wie viele Häuser haben eine Haltestelle in Fußnähe? */
export function erschliessung(s: Stadt, hs: Haus[]): { anteil: number; mit: number; alle: number } {
  const halt: { p: P; r: number }[] = [];
  for (const st of s.strassen) {
    const r = REICHWEITE[st.art];
    if (!r) continue;
    for (const b of s.bauten) if ((b.typ === "haltestelle" || b.typ === "umsteige") && zurLinie(b, st.punkte).d < 30) halt.push({ p: b, r });
  }
  const wohn = hs.filter(h => WOHNEN.includes(h.zone) || ["altstadt", "kontor", "medina", "kolonial", "kleinstadt", "cbd", "insulae", "vorstadt", "bergstadt", "residenz", "festung", "dorf", "ville"].includes(h.zone));
  const mit = wohn.filter(h => halt.some(x => abstand(x.p, h.c) <= x.r)).length;
  return { anteil: wohn.length ? mit / wohn.length : 0, mit, alle: wohn.length };
}
