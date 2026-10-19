/**
 * Erfolge im Flugmodus: fürs Erforschen, für Aufträge, für weite Reisen,
 * fürs Fliegen selbst — und für die Missgeschicke unterwegs.
 *
 * Jeder Erfolg liest nur Zahlen aus dem gespeicherten Fortschritt; neue
 * Erfolge erkennt `neueErfolge` durch Vergleich mit den schon vergebenen.
 */
import { KM_JE_AE, KOERPER, NATUERLICH, SATELLITEN } from "./daten";
import { AUFTRAEGE } from "./auftraege";
import { ORTE, orteVon } from "./orte";

export interface Statistik {
  /** Sekunden aktiver Flug */
  flugzeit: number;
  /** zurückgelegte Strecke in echten Kilometern */
  strecke: number;
  overdrives: number;
  /** Sekunden mit Höchsttempo im Pulsantrieb, ohne Overdrive */
  vollgas: number;
  /** höchstes erreichtes Vielfaches der Lichtgeschwindigkeit */
  hoechstC: number;
  /** Sekunden in einer Umlaufbahn */
  orbitzeit: number;
  umrundungen: number;
  umrundet: string[];
  verglueht: number;
  abstuerze: number;
  abgestuerztAuf: string[];
  /** Zusammenstöße mit dem Schiff eines Mitspielers (Live-Raum) */
  zusammenstoesse: number;
}

export const LEERE_STATISTIK: Statistik = {
  flugzeit: 0, strecke: 0, overdrives: 0, vollgas: 0, hoechstC: 0,
  orbitzeit: 0, umrundungen: 0, umrundet: [], verglueht: 0, abstuerze: 0, abgestuerztAuf: [], zusammenstoesse: 0,
};

export interface ErfolgsDaten {
  erforscht: readonly string[];
  erledigt: readonly string[];
  statistik: Statistik;
}

export type Gruppe = "Erforschen" | "Raumfahrt" | "Aufträge" | "Reisen" | "Pilot" | "Missgeschicke";

export interface Erfolg {
  id: string;
  gruppe: Gruppe;
  icon: string;
  name: string;
  text: string;
  ziel: number;
  wert: (d: ErfolgsDaten) => number;
  /** Anzeige des Fortschritts, z. B. Minuten statt Sekunden */
  einheit?: (wert: number) => string;
}

const PLANETEN = KOERPER.filter(k => k.art === "planet").map(k => k.id);
const MONDE = KOERPER.filter(k => k.art === "mond").map(k => k.id);
const HIMMELSKOERPER = NATUERLICH.map(k => k.id);
const RAUMFAHRZEUGE = SATELLITEN.map(k => k.id);
const ORT_IDS = ORTE.map(o => o.id);
const ERD_ORTE = orteVon("erde").map(o => o.id);
const GALILEI = ["io", "europa", "ganymed", "kallisto"];
const zaehle = (liste: readonly string[], aus: readonly string[]) => aus.filter(id => liste.includes(id)).length;
const stufe = (n: 1 | 2 | 3) => AUFTRAEGE.filter(a => a.stufe === n).map(a => a.id);
const minuten = (s: number) => `${Math.floor(s / 60)} min`;
const ae = (km: number) => `${(km / KM_JE_AE).toLocaleString("de-DE", { maximumFractionDigits: 1 })} AE`;

export const ERFOLGE: Erfolg[] = [
  // ── Erforschen ──
  { id: "erster-scan", gruppe: "Erforschen", icon: "📡", name: "Erster Kontakt", text: "Scanne deinen ersten Himmelskörper.", ziel: 1, wert: d => d.erforscht.length },
  { id: "planeten", gruppe: "Erforschen", icon: "🪐", name: "Planetenkunde", text: "Scanne alle acht Planeten.", ziel: PLANETEN.length, wert: d => zaehle(d.erforscht, PLANETEN) },
  { id: "galilei", gruppe: "Erforschen", icon: "🔭", name: "Galileis Monde", text: "Scanne Io, Europa, Ganymed und Kallisto — die Monde, die Galilei 1610 entdeckte.", ziel: 4, wert: d => zaehle(d.erforscht, GALILEI) },
  { id: "monde-5", gruppe: "Erforschen", icon: "🌙", name: "Mondsüchtig", text: "Scanne fünf Monde.", ziel: 5, wert: d => zaehle(d.erforscht, MONDE) },
  { id: "monde-alle", gruppe: "Erforschen", icon: "🌕", name: "Mondsammlung", text: `Scanne alle ${MONDE.length} Monde.`, ziel: MONDE.length, wert: d => zaehle(d.erforscht, MONDE) },
  { id: "zwerge", gruppe: "Erforschen", icon: "🪨", name: "Kleine Welten", text: "Scanne die Zwergplaneten Ceres und Pluto.", ziel: 2, wert: d => zaehle(d.erforscht, ["ceres", "pluto"]) },
  { id: "alles", gruppe: "Erforschen", icon: "🗺️", name: "Kartograf des Sonnensystems", text: `Scanne alle ${HIMMELSKOERPER.length} Himmelskörper.`, ziel: HIMMELSKOERPER.length, wert: d => zaehle(d.erforscht, HIMMELSKOERPER) },

  // ── Raumfahrt ──
  { id: "satellit-1", gruppe: "Raumfahrt", icon: "🛰", name: "Auf Empfang", text: "Scanne dein erstes Raumfahrzeug in der Erdumlaufbahn.", ziel: 1, wert: d => zaehle(d.erforscht, RAUMFAHRZEUGE) },
  { id: "satellit-alle", gruppe: "Raumfahrt", icon: "📶", name: "Verkehr über der Erde", text: `Scanne alle ${RAUMFAHRZEUGE.length} Raumfahrzeuge — von der ISS bis zur geostationären Bahn.`, ziel: RAUMFAHRZEUGE.length, wert: d => zaehle(d.erforscht, RAUMFAHRZEUGE) },
  { id: "orte-erde", gruppe: "Raumfahrt", icon: "⚖️", name: "Fünf stille Punkte", text: "Erkunde alle fünf Lagrangepunkte von Sonne und Erde.", ziel: ERD_ORTE.length, wert: d => zaehle(d.erforscht, ERD_ORTE) },
  { id: "orte-alle", gruppe: "Raumfahrt", icon: "🧲", name: "Wo nichts zu sehen ist", text: `Erkunde alle ${ORT_IDS.length} Lagrangepunkte, auch die Trojanerlager bei Jupiter.`, ziel: ORT_IDS.length, wert: d => zaehle(d.erforscht, ORT_IDS) },

  // ── Aufträge ──
  { id: "auftrag-1", gruppe: "Aufträge", icon: "🛰️", name: "Auf Mission", text: "Löse deinen ersten Forschungsauftrag.", ziel: 1, wert: d => d.erledigt.length },
  { id: "grundwissen", gruppe: "Aufträge", icon: "📘", name: "Grundlagen sitzen", text: "Löse alle Aufträge der Stufe Grundwissen.", ziel: stufe(1).length, wert: d => zaehle(d.erledigt, stufe(1)) },
  { id: "auftrag-12", gruppe: "Aufträge", icon: "🧠", name: "Wissensdurst", text: "Löse zwölf Forschungsaufträge.", ziel: 12, wert: d => d.erledigt.length },
  { id: "profi", gruppe: "Aufträge", icon: "🎓", name: "Profi-Wissen", text: "Löse alle Aufträge der Stufe Profi.", ziel: stufe(3).length, wert: d => zaehle(d.erledigt, stufe(3)) },
  { id: "auftrag-alle", gruppe: "Aufträge", icon: "🏆", name: "Alle Rätsel gelöst", text: `Löse alle ${AUFTRAEGE.length} Forschungsaufträge.`, ziel: AUFTRAEGE.length, wert: d => d.erledigt.length },

  // ── Reisen ──
  { id: "strecke-1", gruppe: "Reisen", icon: "📏", name: "Eine Astronomische Einheit", text: "Fliege so weit wie von der Sonne zur Erde: 150 Mio. km.", ziel: KM_JE_AE, wert: d => d.statistik.strecke, einheit: ae },
  { id: "strecke-30", gruppe: "Reisen", icon: "🧭", name: "Bis zum Rand", text: "Fliege 30 AE — so weit ist Neptun von der Sonne entfernt.", ziel: 30 * KM_JE_AE, wert: d => d.statistik.strecke, einheit: ae },
  { id: "strecke-200", gruppe: "Reisen", icon: "🌌", name: "Weltraumwanderer", text: "Fliege insgesamt 200 AE.", ziel: 200 * KM_JE_AE, wert: d => d.statistik.strecke, einheit: ae },
  { id: "flugzeit-10", gruppe: "Reisen", icon: "⏱️", name: "Zehn Minuten im Cockpit", text: "Fliege zehn Minuten.", ziel: 600, wert: d => d.statistik.flugzeit, einheit: minuten },
  { id: "flugzeit-60", gruppe: "Reisen", icon: "🕐", name: "Dauerflieger", text: "Fliege insgesamt zwanzig Minuten.", ziel: 1200, wert: d => d.statistik.flugzeit, einheit: minuten },

  // ── Pilot ──
  { id: "hundertfach", gruppe: "Pilot", icon: "⚡", name: "Hundertfach", text: "Erreiche im Pulsantrieb die 100-fache Lichtgeschwindigkeit.", ziel: 99, wert: d => d.statistik.hoechstC },
  { id: "overdrive-1", gruppe: "Pilot", icon: "💥", name: "Overdrive!", text: "Zünde zum ersten Mal den Overdrive.", ziel: 1, wert: d => d.statistik.overdrives },
  { id: "tausendfach", gruppe: "Pilot", icon: "🚀", name: "Tausendfach", text: "Erreiche im Overdrive die 1000-fache Lichtgeschwindigkeit.", ziel: 990, wert: d => d.statistik.hoechstC },
  { id: "overdrive-25", gruppe: "Pilot", icon: "🔥", name: "Overdrive-Routine", text: "Zünde den Overdrive zehnmal.", ziel: 10, wert: d => d.statistik.overdrives },
  { id: "vollgas-1", gruppe: "Pilot", icon: "🏎️", name: "Vollgas", text: "Fliege eine Minute mit Höchsttempo — ohne Overdrive.", ziel: 60, wert: d => d.statistik.vollgas, einheit: minuten },
  { id: "vollgas-10", gruppe: "Pilot", icon: "🦶", name: "Bleifuß", text: "Fliege insgesamt fünf Minuten mit Höchsttempo — ohne Overdrive.", ziel: 300, wert: d => d.statistik.vollgas, einheit: minuten },
  { id: "orbit-1", gruppe: "Pilot", icon: "🔄", name: "Einmal rundherum", text: "Umkreise einen Himmelskörper einmal ganz.", ziel: 1, wert: d => d.statistik.umrundungen },
  { id: "orbit-5", gruppe: "Pilot", icon: "🌀", name: "Orbit-Tourist", text: "Umkreise fünf verschiedene Himmelskörper.", ziel: 5, wert: d => d.statistik.umrundet.length },
  { id: "orbitzeit", gruppe: "Pilot", icon: "🛸", name: "Im Orbit zu Hause", text: "Verbringe fünf Minuten in Umlaufbahnen.", ziel: 300, wert: d => d.statistik.orbitzeit, einheit: minuten },

  // ── Missgeschicke ──
  { id: "ikarus", gruppe: "Missgeschicke", icon: "☀️", name: "Ikarus", text: "Komm der Sonne zu nah und verglühe.", ziel: 1, wert: d => d.statistik.verglueht },
  { id: "bruchlandung", gruppe: "Missgeschicke", icon: "💢", name: "Bruchlandung", text: "Schlag zu schnell auf einem Himmelskörper auf.", ziel: 1, wert: d => d.statistik.abstuerze },
  { id: "crashtest", gruppe: "Missgeschicke", icon: "🧯", name: "Crashtest-Tournee", text: "Stürze auf fünf verschiedenen Himmelskörpern ab.", ziel: 5, wert: d => d.statistik.abgestuerztAuf.length },
  { id: "pechvogel", gruppe: "Missgeschicke", icon: "🐦", name: "Pechvogel", text: "Stürze fünfmal ab.", ziel: 5, wert: d => d.statistik.abstuerze },
  { id: "blechschaden", gruppe: "Missgeschicke", icon: "💥", name: "Blechschaden", text: "Stoß im gemeinsamen Flug mit dem Raumschiff eines Mitspielers zusammen.", ziel: 1, wert: d => d.statistik.zusammenstoesse },
];

export const erreicht = (e: Erfolg, d: ErfolgsDaten) => e.wert(d) >= e.ziel;

/** Erfolge, die jetzt erreicht sind, aber noch nicht in `bekannt` stehen. */
export function neueErfolge(d: ErfolgsDaten, bekannt: readonly string[]): Erfolg[] {
  return ERFOLGE.filter(e => !bekannt.includes(e.id) && erreicht(e, d));
}
