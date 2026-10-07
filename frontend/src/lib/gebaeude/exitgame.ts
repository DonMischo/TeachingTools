/**
 * TaskCrawler → Gebäude: Jeder Abschnitt (alles bis einschließlich einer Tür)
 * wird ein Stockwerk. Erklärungen, Beispiele und Aufgaben werden Zimmer, in
 * Lesereihenfolge; die Tür wird das verschlossene Treppenhaus. Was nach der
 * letzten Tür kommt, ist das oberste Stockwerk mit dem Ausgang.
 */
import type { ExitGameSlide } from "@/lib/api";
import { istObjekt, type Objekt } from "./objekte";

export interface Abschnitt {
  /** Folien-Indizes der Zimmer, in Lesereihenfolge */
  raeume: number[];
  /** Folien-Index der Tür (Treppenhaus); null = freier Ausgang */
  tuer: number | null;
}

export function abschnitte(slides: ExitGameSlide[]): Abschnitt[] {
  const aus: Abschnitt[] = [];
  let raeume: number[] = [];
  slides.forEach((s, i) => {
    if (s.type === "door") {
      aus.push({ raeume, tuer: i });
      raeume = [];
    } else {
      raeume.push(i);
    }
  });
  // Folien nach der letzten Tür bilden das oberste Stockwerk; gibt es keine,
  // endet das Spiel hinter der letzten Tür.
  if (raeume.length || !aus.length) aus.push({ raeume, tuer: null });
  return aus;
}

/** Seed aus dem Sitzungscode: dieselbe Sitzung, dasselbe Haus. */
export function seedAus(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % 100000 + 1;
}

/** Welches Werkzeug zu welchem Objekt passt */
const OBJEKT_FUER_SIM: Record<string, Objekt> = {
  gleichungswaage: "waage", zeitstrahl: "kalender", funktionen: "tafel", vierecke: "tafel",
  rechenregeln: "abakus", abacus: "abakus", binaerrechner: "grossrechner", bildformate: "grafiktablett",
  ki: "kikern", regeln: "computer", maus: "computer", tippen: "computer", uebung: "pult",
  sonnensystem: "teleskop", erdaufbau: "globus", wilson: "globus", kueste: "globus", wfc: "computer",
  dla: "mikroskop", schichten: "computer", pse: "mikroskop", strukturformeln: "tafel",
};

/** Reihum je Folienart — damit nicht jedes Zimmer Tafel oder Schreibtisch ist */
const ABWECHSLUNG: Record<"explanation" | "example" | "task", Objekt[]> = {
  explanation: ["tafel", "radio", "zeitung", "fernseher", "buch", "schriftrolle", "tontafel", "laptop", "telefon", "kopfhoerer"],
  example: ["regal", "buch", "schriftrolle", "tablet", "filmprojektor", "zeitung"],
  task: ["pult", "kuckucksuhr", "mikroskop", "tresor", "laborbank", "computer", "globus", "telegraph", "telefon",
    "smartphone", "druckerpresse", "grafiktablett", "teleskop"],
};

/**
 * Objekt für eine Station: `station` aus dem JSON, sonst passend zum
 * Werkzeug bzw. zur Folienart, sonst reihum (fest je Folien-Id). Im Verlies
 * wartet in jedem Aufgabenzimmer ohne Werkzeug ein Monster.
 */
export function stationsObjekt(slide: ExitGameSlide, verlies = false): Objekt {
  if (istObjekt(slide.station)) return slide.station;
  const tasks = slide.tasks ?? (slide.task ? [slide.task] : []);
  const sim = tasks.find(t => t.sim)?.sim?.tool;
  if (sim && OBJEKT_FUER_SIM[sim]) return OBJEKT_FUER_SIM[sim];
  if (tasks.some(t => t.kind === "timeline")) return "kalender";
  const reihum = (liste: Objekt[]) => liste[seedAus(slide.id) % liste.length];
  if (slide.type === "explanation") return reihum(ABWECHSLUNG.explanation);
  if (slide.type === "example") return reihum(ABWECHSLUNG.example);
  if (verlies) return "monster";
  return reihum(ABWECHSLUNG.task);
}
