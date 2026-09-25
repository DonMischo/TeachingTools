/**
 * Uhrzeit, Tagesabschnitte und Fahrplan.
 *
 * Linien und Haltestellenfolgen stammen aus OpenStreetMap (`karte.linien`),
 * die Takte aus dem EVAG-Standardfahrplan (Stand 2025): Stadtbahn und Bus 9
 * montags bis freitags 6–18 Uhr alle 10 Minuten, sonst alle 20; Bus 35 etwa
 * stündlich mit Verstärkern in der Hauptverkehrszeit. Die Abfahrtszeiten
 * selbst sind nicht der echte Fahrplan, sondern nach Takt gerechnet — das
 * sagt die Anzeige auch so.
 */
import { KARTE, type Linie } from "./stadt";

export type { Linie } from "./stadt";

/** Nur die Linien, die im Kartenausschnitt halten oder fahren (die Tram fährt am Rand vorbei). */
export function linienImViertel(): Linie[] {
  const namen = new Set(KARTE.punkte.filter((p) => p.art === "bushalt").map((p) => p.name));
  return (KARTE.linien ?? []).filter((l) =>
    l.art === "tram" || l.richtungen.some((r) => r.halte.some((h) => namen.has(h))));
}

export type Abschnitt = "nacht" | "frueh" | "rushMorgen" | "tag" | "rushAbend" | "abend";

export type Zeit = { wochentag: number; minute: number; datum: Date };

/** Spielzeit aus der gemeinsamen Uhr (Sekunden) plus einem Versatz, den die Lehrkraft stellt. */
export function spielzeit(t: number, versatz = 0): Zeit {
  const datum = new Date((t + versatz) * 1000);
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

/** Takt einer Linie in Minuten zu dieser Zeit; null = fährt nicht. */
export function takt(l: Pick<Linie, "art" | "nr">, z: Zeit): number | null {
  const m = z.minute, wt = werktag(z), sa = z.wochentag === 6;
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

export type Abfahrt = { linie: string; art: "bus" | "tram"; ziel: string; inMinuten: number };

/**
 * Die nächsten Abfahrten an einer Haltestelle (nach Name). Je Linie und
 * Richtung ein fester, aus dem Namen gestreuter Versatz im Takt.
 */
export function abfahrten(haltName: string, z: Zeit, linien: Linie[], anzahl = 4, tram = false): Abfahrt[] {
  const aus: Abfahrt[] = [];
  for (const l of linien) {
    if (tram !== (l.art === "tram")) continue;
    for (const r of l.richtungen) {
      if (!tram && !r.halte.includes(haltName)) continue;
      // Suche bis 3 Stunden voraus — der Takt kann sich unterwegs ändern.
      let m = Math.floor(z.minute), n = 0;
      const phase = Math.floor(streu(`${l.nr}|${r.ziel}|${haltName}`) * 60);
      while (m < z.minute + 180 && n < anzahl) {
        const zt = { ...z, minute: m };
        const k = takt(l, zt);
        if (k !== null && (((m - phase) % k) + k) % k === 0 && m >= z.minute) {
          aus.push({ linie: l.nr, art: l.art, ziel: r.ziel, inMinuten: Math.round(m - z.minute) });
          n++;
        }
        m++;
      }
    }
  }
  return aus.sort((a, b) => a.inMinuten - b.inMinuten).slice(0, anzahl);
}

export function uhrText(z: Zeit): string {
  const h = Math.floor(z.minute / 60), m = Math.floor(z.minute % 60);
  const tage = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return `${tage[z.wochentag]} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
