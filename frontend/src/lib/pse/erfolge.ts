/**
 * Fortschritt der PSE-Rallye: Punkte, Sterne und Erfolge.
 *
 * Gezählt wird über alle Runden hinweg; der Stand liegt im Browser
 * (localStorage), nicht auf dem Server — die Rallye soll auch ohne Konto
 * laufen. Jeder Erfolg liest nur Zahlen aus dem Stand, genau wie im
 * Sonnensystem.
 */
import { elementeIm, RUNDE, type Aufgabenart, type Bereich } from "./rallye";

export interface Stand {
  /** Punkte insgesamt, über alle Runden. */
  punkte: number;
  /** Sterne insgesamt (0–3 je Runde). */
  sterne: number;
  runden: number;
  /** Richtig beantwortete Aufgaben, nach Art. */
  richtig: Partial<Record<Aufgabenart, number>>;
  /** Aufgaben, die beim ersten Versuch saßen. */
  sofort: number;
  /** Längste Reihe ohne Fehlversuch, über Rundengrenzen hinweg. */
  serie: number;
  /** Die gerade laufende Reihe — sie reißt bei jedem Fehlversuch ab. */
  serieJetzt: number;
  /** Runden mit drei Sternen, je Bereich. */
  dreiSterne: Partial<Record<Bereich, number>>;
  /** Ordnungszahlen aller Elemente, die schon einmal richtig gefunden wurden. */
  gefunden: number[];
  /** Vergebene Erfolge. */
  erfolge: string[];
}

export const LEERER_STAND: Stand = {
  punkte: 0, sterne: 0, runden: 0, richtig: {}, sofort: 0, serie: 0, serieJetzt: 0,
  dreiSterne: {}, gefunden: [], erfolge: [],
};

export const SPEICHER = "hp_pse_rallye";

/**
 * Sterne einer Runde. Volle Punktzahl ist RUNDE × 3 — drei Sterne gibt es
 * erst, wenn fast alles auf Anhieb saß.
 */
export function sterneFuer(punkte: number, moeglich: number): number {
  const anteil = moeglich ? punkte / moeglich : 0;
  return anteil >= 0.9 ? 3 : anteil >= 0.7 ? 2 : anteil >= 0.5 ? 1 : 0;
}

export const PUNKTE_JE_RUNDE = RUNDE * 3;

export type Gruppe = "Einstieg" | "Treffsicher" | "Ordnung" | "Sammeln";

export interface Erfolg {
  id: string;
  gruppe: Gruppe;
  icon: string;
  name: string;
  text: string;
  ziel: number;
  wert: (s: Stand) => number;
}

const art = (s: Stand, a: Aufgabenart) => s.richtig[a] ?? 0;
const ALLE_HAUPTGRUPPEN = elementeIm("hauptgruppen").length;

export const ERFOLGE: Erfolg[] = [
  // ── Einstieg ──
  { id: "erste-runde", gruppe: "Einstieg", icon: "🎒", name: "Erste Rallye", text: "Spiel eine Runde zu Ende.", ziel: 1, wert: s => s.runden },
  { id: "funf-runden", gruppe: "Einstieg", icon: "🧭", name: "Auf Tour", text: "Spiel fünf Runden.", ziel: 5, wert: s => s.runden },
  { id: "hundert", gruppe: "Einstieg", icon: "💯", name: "Hundert Punkte", text: "Sammle 100 Punkte.", ziel: 100, wert: s => s.punkte },
  { id: "fuenfhundert", gruppe: "Einstieg", icon: "🏅", name: "Fünfhundert Punkte", text: "Sammle 500 Punkte.", ziel: 500, wert: s => s.punkte },

  // ── Treffsicher ──
  { id: "serie-5", gruppe: "Treffsicher", icon: "🎯", name: "Fünf am Stück", text: "Finde fünf Elemente hintereinander beim ersten Versuch.", ziel: 5, wert: s => s.serie },
  { id: "serie-15", gruppe: "Treffsicher", icon: "🔥", name: "Lauf", text: "Finde fünfzehn Elemente hintereinander beim ersten Versuch.", ziel: 15, wert: s => s.serie },
  { id: "sofort-50", gruppe: "Treffsicher", icon: "⚡", name: "Blick fürs Feld", text: "Triff fünfzig Mal auf Anhieb.", ziel: 50, wert: s => s.sofort },
  { id: "runde-perfekt", gruppe: "Treffsicher", icon: "⭐", name: "Glanzrunde", text: "Hol in einer Runde drei Sterne.", ziel: 1, wert: s => Object.values(s.dreiSterne).reduce((a, b) => a + (b ?? 0), 0) },
  { id: "sterne-20", gruppe: "Treffsicher", icon: "🌟", name: "Sternensammlung", text: "Sammle zwanzig Sterne.", ziel: 20, wert: s => s.sterne },

  // ── Ordnung: die Aufgabenarten ──
  { id: "art-ordnungszahl", gruppe: "Ordnung", icon: "🔢", name: "Ordnungszahlen sitzen", text: "Beantworte fünfzehn Fragen nach der Ordnungszahl richtig.", ziel: 15, wert: s => art(s, "ordnungszahl") },
  { id: "art-masse", gruppe: "Ordnung", icon: "⚖️", name: "Gewichtheber", text: "Beantworte fünfzehn Fragen nach der Atommasse richtig.", ziel: 15, wert: s => art(s, "masse") },
  { id: "art-symbol", gruppe: "Ordnung", icon: "🔤", name: "Symbolkunde", text: "Beantworte fünfzehn Fragen nach dem Symbol richtig.", ziel: 15, wert: s => art(s, "symbol") },
  { id: "art-gruppenname", gruppe: "Ordnung", icon: "👪", name: "Familienbande", text: "Finde fünfzehn Mal ein Element der genannten Hauptgruppe.", ziel: 15, wert: s => art(s, "gruppenname") },
  { id: "art-kreuzung", gruppe: "Ordnung", icon: "✛", name: "Zeile mal Spalte", text: "Finde fünfzehn Elemente über Periode und Hauptgruppe.", ziel: 15, wert: s => art(s, "gruppePeriode") },
  { id: "alle-arten", gruppe: "Ordnung", icon: "🧩", name: "Alles gefragt", text: "Beantworte jede der sechs Fragearten mindestens dreimal richtig.", ziel: 6,
    wert: s => (["ordnungszahl", "masse", "name", "symbol", "gruppenname", "gruppePeriode"] as Aufgabenart[])
      .filter(a => art(s, a) >= 3).length },

  // ── Sammeln: welche Elemente schon gefunden wurden ──
  { id: "sammler-20", gruppe: "Sammeln", icon: "🧪", name: "Die ersten zwanzig", text: "Finde alle Elemente von Wasserstoff bis Calcium.", ziel: 20, wert: s => s.gefunden.filter(z => z <= 20).length },
  { id: "sammler-hauptgruppen", gruppe: "Sammeln", icon: "🗂️", name: "Alle Hauptgruppen", text: `Finde alle ${ALLE_HAUPTGRUPPEN} Hauptgruppenelemente.`, ziel: ALLE_HAUPTGRUPPEN,
    wert: s => s.gefunden.filter(z => elementeIm("hauptgruppen").some(e => e.z === z)).length },
  { id: "sammler-50", gruppe: "Sammeln", icon: "📚", name: "Halbes Periodensystem", text: "Finde fünfzig verschiedene Elemente.", ziel: 50, wert: s => s.gefunden.length },
  { id: "sammler-alle", gruppe: "Sammeln", icon: "🏆", name: "Vollständig", text: "Finde alle 118 Elemente.", ziel: 118, wert: s => s.gefunden.length },
];

export const erreicht = (e: Erfolg, s: Stand): boolean => e.wert(s) >= e.ziel;

/** Erfolge, die jetzt erreicht sind, aber noch nicht vergeben wurden. */
export function neueErfolge(s: Stand): Erfolg[] {
  return ERFOLGE.filter(e => !s.erfolge.includes(e.id) && erreicht(e, s));
}

/** Verrechnet eine beantwortete Aufgabe im Stand. */
export function nachAntwort(
  s: Stand, a: Aufgabenart, z: number, punkte: number, sofort: boolean,
): Stand {
  const serieJetzt = sofort ? s.serieJetzt + 1 : 0;
  return {
    ...s,
    punkte: s.punkte + punkte,
    richtig: { ...s.richtig, [a]: art(s, a) + 1 },
    sofort: s.sofort + (sofort ? 1 : 0),
    serieJetzt,
    // Die längste Serie bleibt stehen, auch wenn die laufende abreißt.
    serie: Math.max(s.serie, serieJetzt),
    gefunden: s.gefunden.includes(z) ? s.gefunden : [...s.gefunden, z],
  };
}

/** Verrechnet das Ende einer Runde. */
export function nachRunde(s: Stand, bereich: Bereich, sterne: number): Stand {
  return {
    ...s,
    runden: s.runden + 1,
    sterne: s.sterne + sterne,
    dreiSterne: sterne === 3
      ? { ...s.dreiSterne, [bereich]: (s.dreiSterne[bereich] ?? 0) + 1 }
      : s.dreiSterne,
  };
}

/** Liest den Stand aus dem Browser; bei Unsinn im Speicher ein leerer Stand. */
export function ladeStand(): Stand {
  try {
    const roh = localStorage.getItem(SPEICHER);
    if (!roh) return LEERER_STAND;
    const d = JSON.parse(roh) as Partial<Stand>;
    return { ...LEERER_STAND, ...d, richtig: d.richtig ?? {}, gefunden: d.gefunden ?? [], erfolge: d.erfolge ?? [] };
  } catch {
    return LEERER_STAND;
  }
}

export function speichereStand(s: Stand): void {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(s));
  } catch {
    // Privates Fenster oder voller Speicher — dann zählt eben nur diese Sitzung.
  }
}
