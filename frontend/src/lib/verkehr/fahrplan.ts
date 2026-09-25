/**
 * Uhrzeit, Tagesabschnitte und Fahrplan.
 *
 * Für die Linie 9 (Steinplatz, Fritz-Büchner-Straße, Eislebener Straße) gilt
 * der echte EVAG-Haltestellenfahrplan (`linie9.json`, ab 17.08.2026) mit
 * Schul- und Ferientagen, Samstag und Sonn-/Feiertag.
 *
 * Linien und Haltestellenfolgen stammen aus OpenStreetMap (`karte.linien`),
 * die Takte aus dem EVAG-Standardfahrplan (Stand 2025): Stadtbahn und Bus 9
 * montags bis freitags 6–18 Uhr alle 10 Minuten, sonst alle 20; Bus 35 etwa
 * stündlich mit Verstärkern in der Hauptverkehrszeit. Die Abfahrtszeiten
 * selbst sind nicht der echte Fahrplan, sondern nach Takt gerechnet — das
 * sagt die Anzeige auch so.
 */
import { KARTE, type Linie } from "./stadt";
import LINIE9 from "./linie9.json";
import type { P } from "./geometrie";

export type { Linie } from "./stadt";

/** Nur die Linien, die im Kartenausschnitt halten oder fahren (die Tram fährt am Rand vorbei). */
export function linienImViertel(): Linie[] {
  const namen = new Set(KARTE.punkte.filter((p) => p.art === "bushalt").map((p) => p.name));
  return (KARTE.linien ?? []).filter((l) =>
    l.art === "tram" || l.richtungen.some((r) => r.halte.some((h) => namen.has(h))));
}

export type Abschnitt = "nacht" | "frueh" | "rushMorgen" | "tag" | "rushAbend" | "abend";

export type Zeit = { wochentag: number; minute: number; datum: Date };

/**
 * Wie die Spieluhr zur echten steht: `versatz` Sekunden daneben, und ab
 * `anker` (gemeinsame Uhr) läuft sie `faktor`-mal so schnell (Zeitraffer).
 */
export type UhrStellung = { versatz: number; faktor: number; anker: number };
export const ECHTE_UHR: UhrStellung = { versatz: 0, faktor: 1, anker: 0 };
/** Schnellster Zeitraffer. */
export const FAKTOR_MAX = 10;

/** Spielsekunden zur gemeinsamen Uhr `t`. */
export const spielSekunden = (t: number, st: UhrStellung) => t + st.versatz + (t - st.anker) * (st.faktor - 1);

/** Anderes Tempo ab jetzt — die Uhr springt dabei nicht. */
export function mitFaktor(st: UhrStellung, t: number, faktor: number): UhrStellung {
  return { versatz: spielSekunden(t, st) - t, faktor: Math.max(1, Math.min(FAKTOR_MAX, faktor)), anker: t };
}

/** Uhr auf einen Versatz stellen, das Tempo bleibt. */
export const gestellt = (st: UhrStellung, t: number, versatz: number): UhrStellung => ({ versatz, faktor: st.faktor, anker: t });

/** Spielzeit aus der gemeinsamen Uhr (Sekunden), so wie die Lehrkraft sie gestellt hat. */
export function spielzeit(t: number, st: UhrStellung = ECHTE_UHR): Zeit {
  const datum = new Date(spielSekunden(t, st) * 1000);
  return { wochentag: datum.getDay(), minute: datum.getHours() * 60 + datum.getMinutes() + datum.getSeconds() / 60, datum };
}

export const werktag = (z: Zeit) => z.wochentag >= 1 && z.wochentag <= 5;

export function abschnitt(z: Zeit): Abschnitt {
  const m = z.minute;
  if (m < 5 * 60 || m >= 22 * 60) return "nacht";
  if (werktag(z) && m >= 6 * 60 + 30 && m < 8 * 60 + 30) return "rushMorgen";
  if (werktag(z) && m >= 15 * 60 && m < 18 * 60) return "rushAbend";
  if (m < 6 * 60 + 30) return "frueh";
  if (m >= 19 * 60) return "abend";
  return "tag";
}

export const ABSCHNITT_NAME: Record<Abschnitt, string> = {
  nacht: "Nacht", frueh: "Früh", rushMorgen: "Berufsverkehr", tag: "Tag", rushAbend: "Feierabendverkehr", abend: "Abend",
};

export const istRush = (z: Zeit) => { const a = abschnitt(z); return a === "rushMorgen" || a === "rushAbend"; };

/** Wie viele Autos im Verhältnis zum normalen Tag. */
export function verkehrsFaktor(z: Zeit): number {
  const f = { nacht: 0.2, frueh: 0.6, rushMorgen: 1.8, tag: 1, rushAbend: 1.7, abend: 0.6 }[abschnitt(z)];
  return werktag(z) ? f : f * 0.6;
}

/**
 * Helligkeit 0 (Nacht) bis 1 (Tag) mit Dämmerung. Sonnenauf- und -untergang
 * für Erfurt grob je Monat (MEZ/MESZ wie auf der Uhr).
 */
const SONNE: [number, number][] = [
  [8.2, 16.4], [7.6, 17.3], [6.7, 18.2], [6.6, 20.0], [5.7, 20.8], [5.0, 21.4],
  [5.3, 21.3], [6.0, 20.6], [6.9, 19.5], [7.7, 18.4], [7.5, 16.6], [8.2, 16.1],
];
export function helligkeit(z: Zeit): number {
  const [auf, unter] = SONNE[z.datum.getMonth()];
  const h = z.minute / 60;
  const d = 0.6; // Dämmerung in Stunden
  if (h < auf - d || h > unter + d) return 0;
  if (h < auf + d) return (h - (auf - d)) / (2 * d);
  if (h > unter - d) return ((unter + d) - h) / (2 * d);
  return 1;
}

export type Tagesart = "moDoSchule" | "frSchule" | "moDoFerien" | "frFerien" | "sa" | "so";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Welche Spalte des EVAG-Fahrplans gilt an diesem Tag? */
export function tagesart(datum: Date): Tagesart {
  const tag = iso(datum), wt = datum.getDay();
  if (wt === 0 || LINIE9.feiertage.includes(tag)) return "so";
  if (wt === 6) return "sa";
  const ferien = LINIE9.ferien.some(([von, bis]) => tag >= von && tag <= bis);
  const freitag = wt === 5 || LINIE9.wieFreitag.includes(tag);
  return freitag ? (ferien ? "frFerien" : "frSchule") : ferien ? "moDoFerien" : "moDoSchule";
}

type Stundenplan = Record<string, number[]>;
const HALTE9 = LINIE9.halte as Record<string, Record<string, Partial<Record<Tagesart, Stundenplan>>>>;

/** Echte Abfahrtsminuten (Minute des Tages) der Linie 9 an einem Halt in einer Richtung, oder null ohne Fahrplan. */
function echteAbfahrten9(halt: string, richtung: string, datum: Date): number[] | null {
  const plan = HALTE9[halt]?.[richtung]?.[tagesart(datum)];
  if (!plan) return null;
  const aus: number[] = [];
  for (const [stunde, minuten] of Object.entries(plan)) {
    // Die Stunde 0 gehört zum Ende des Betriebstags.
    const h = Number(stunde) === 0 ? 24 : Number(stunde);
    for (const m of minuten) aus.push(h * 60 + m);
  }
  return aus.sort((a, b) => a - b);
}

/** Takt einer Linie in Minuten zu dieser Zeit; null = fährt nicht. */
export function takt(l: Pick<Linie, "art" | "nr">, z: Zeit): number | null {
  const m = z.minute, wt = werktag(z), sa = z.wochentag === 6;
  if (l.nr === "9" && l.art === "bus") {
    // Aus dem echten Fahrplan: Fahrten dieser Stunde an der Fritz-Büchner-Straße.
    const ab = echteAbfahrten9("Fritz-Büchner-Straße", "Nordbahnhof", z.datum);
    if (ab) {
      const n = ab.filter((x) => x >= Math.floor(m / 60) * 60 && x < Math.floor(m / 60) * 60 + 60).length;
      return n ? Math.round(60 / n) : null;
    }
  }
  if (l.art === "tram" || l.nr === "9") {
    if (wt && m >= 6 * 60 && m < 18 * 60) return 10;
    if (m >= 5 * 60 && m < 23 * 60) return 20;
    return null;
  }
  if (l.nr === "35") {
    if (!wt && !sa) return null;
    if (wt && (m >= 6 * 60 && m < 8 * 60 || m >= 13 * 60 && m < 15 * 60 + 30)) return 30;
    if (m >= 5 * 60 + 30 && m < 19 * 60) return 60;
    return null;
  }
  if (m >= 5 * 60 && m < 21 * 60) return 60;
  return null;
}

function streu(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

export type Abfahrt = { linie: string; art: "bus" | "tram"; ziel: string; inMinuten: number; /** aus dem echten Fahrplan */ echt?: boolean };

/**
 * Die nächsten Abfahrten an einer Haltestelle (nach Name). Je Linie und
 * Richtung ein fester, aus dem Namen gestreuter Versatz im Takt.
 */
/**
 * Die nächsten Abfahrten einer Linie in eine Richtung an einem Halt, als
 * Minute des Tages (genau, nicht gerundet). Linie 9 nach echtem Fahrplan;
 * sonst im Takt — die Phase hängt an Linie und Richtung, je Halt zwei Minuten
 * weiter, damit ein Bus von Halt zu Halt zusammenpasst.
 */
export function abfahrtMinuten(l: Linie, haltName: string, ziel: string, z: Zeit, anzahl = 4): number[] {
  if (l.nr === "9" && HALTE9[haltName]?.[ziel]) {
    return (echteAbfahrten9(haltName, ziel, z.datum) ?? []).filter((x) => x >= z.minute - 0.5).slice(0, anzahl);
  }
  const r = l.richtungen.find((x) => x.ziel === ziel);
  const nr = r ? r.halte.indexOf(haltName) : -1;
  const phase = Math.floor(streu(`${l.nr}|${ziel}`) * 60) + Math.max(0, nr) * 2;
  const aus: number[] = [];
  // Suche bis 3 Stunden voraus — der Takt kann sich unterwegs ändern.
  for (let m = Math.floor(z.minute); m < z.minute + 180 && aus.length < anzahl; m++) {
    const k = takt(l, { ...z, minute: m });
    if (k !== null && (((m - phase) % k) + k) % k === 0 && m >= z.minute - 0.5) aus.push(m);
  }
  return aus;
}

/**
 * Abfahrtstafel: die nächsten Abfahrten an einem Halt. `nur`: welche
 * Richtungen hier halten (»Linie|Ziel«) — ein Bussteig bedient nur eine Richtung.
 */
export function abfahrten(haltName: string, z: Zeit, linien: Linie[], anzahl = 4, tram = false, nur?: Set<string>): Abfahrt[] {
  const aus: Abfahrt[] = [];
  for (const l of linien) {
    if (tram !== (l.art === "tram")) continue;
    const echt = l.nr === "9" && !!HALTE9[haltName];
    const ziele = echt ? Object.keys(HALTE9[haltName]) : l.richtungen.filter((r) => tram || r.halte.includes(haltName)).map((r) => r.ziel);
    for (const ziel of ziele) {
      if (nur && !nur.has(`${l.nr}|${ziel}`)) continue;
      for (const x of abfahrtMinuten(l, haltName, ziel, z, anzahl))
        aus.push({ linie: l.nr, art: l.art, ziel, inMinuten: Math.max(0, Math.round(x - z.minute)), ...(echt ? { echt: true } : {}) });
    }
  }
  return aus.sort((a, b) => a.inMinuten - b.inMinuten).slice(0, anzahl);
}

/**
 * Welche Richtungen an diesem Bussteig halten (»Linie|Ziel«), aus den Steigen
 * der OSM-Routen. `undefined`, wenn es dazu keine Daten gibt (dann alle).
 */
export function richtungenAmSteig(halt: { name: string; p: P }, linien: Linie[]): Set<string> | undefined {
  const aus = new Set<string>();
  let daten = false;
  for (const l of linien) for (const r of l.richtungen) {
    if (!r.steige?.length) continue;
    if (r.steige.some((st) => st.name === halt.name)) daten = true;
    if (r.steige.some((st) => st.name === halt.name && Math.hypot(st.p[0] - halt.p[0], st.p[1] - halt.p[1]) < 15)) aus.add(`${l.nr}|${r.ziel}`);
  }
  return daten ? aus : undefined;
}

export function uhrText(z: Zeit): string {
  const h = Math.floor(z.minute / 60), m = Math.floor(z.minute % 60);
  const tage = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return `${tage[z.wochentag]} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
