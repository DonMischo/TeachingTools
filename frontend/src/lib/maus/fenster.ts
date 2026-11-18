/**
 * Stufe »Fenster bedienen« — reine Logik ohne DOM.
 *
 * Der Mock-Bildschirm ist ein virtuelles Raster von DESKTOP.w × DESKTOP.h
 * »logischen« Pixeln. Die Komponente rechnet echte Zeigerkoordinaten über den
 * Skalierungsfaktor (Breite des echten Elements ÷ DESKTOP.w) in dieses
 * Raster um — genau wie StufeZiehen es mit dem SVG-viewBox tut.
 */

export type FensterModus = "normal" | "maximiert" | "minimiert" | "geschlossen";

export type Rechteck = { x: number; y: number; w: number; h: number };

export type FensterZustand = { modus: FensterModus; pos: Rechteck };

/** Größe des virtuellen Bildschirms (16:9). */
export const DESKTOP = { w: 900, h: 506 };
export const TASKLEISTE_HOEHE = 48;

export const MINDEST_BREITE = 220;
export const MINDEST_HOEHE = 150;

export const START_FENSTER: Rechteck = { x: 260, y: 50, w: 380, h: 260 };

/** Ab hier gilt eine Größenänderung als geschafft. */
export const ZIEL_GROESSE = { w: 600, h: 380 };

/** Zielzone fürs Verschieben (linke obere Ecke). */
export const ZIEL_POSITION = { x: 480, y: 160 };

/** So groß darf die Abweichung beim Verschieben noch sein (in logischen Pixeln). */
export const TOLERANZ_VERSCHIEBEN = 26;

/** Mindestzeit, die ein Fenster den Fokus verlieren muss, damit Alt+Tab zählt. */
export const ALT_TAB_MINDEST_MS = 500;

/** Windows: der ganze Bildschirm ohne Taskleiste. Ubuntu/macOS siehe `arbeitsflaeche` in system.ts. */
export const WINDOWS_FLAECHE: Rechteck = { x: 0, y: 0, w: DESKTOP.w, h: DESKTOP.h - TASKLEISTE_HOEHE };

/** Hält ein Rechteck innerhalb der Fensterfläche (Bildschirm ohne Taskleiste, Dock, Menüleiste). */
export function klemmePosition(pos: Rechteck, hilfe = false, flaeche: Rechteck = WINDOWS_FLAECHE): Rechteck {
  const w = Math.min(pos.w, flaeche.w);
  const h = Math.min(pos.h, flaeche.h);
  const x = Math.max(flaeche.x, Math.min(pos.x, flaeche.x + flaeche.w - w));
  const y = Math.max(flaeche.y, Math.min(pos.y, flaeche.y + flaeche.h - h));
  return { x, y, w, h };
}

/** Verschiebt die Titelleiste um (dx, dy) — Größe bleibt gleich. */
export function verschieben(pos: Rechteck, dx: number, dy: number, hilfe = false, flaeche: Rechteck = WINDOWS_FLAECHE): Rechteck {
  return klemmePosition({ ...pos, x: pos.x + dx, y: pos.y + dy }, hilfe, flaeche);
}

/** Zieht an der unteren rechten Ecke — Position (oben links) bleibt gleich. */
export function groesseAendern(pos: Rechteck, dx: number, dy: number, hilfe = false, flaeche: Rechteck = WINDOWS_FLAECHE): Rechteck {
  const w = Math.max(MINDEST_BREITE, Math.min(pos.w + dx, flaeche.x + flaeche.w - pos.x));
  const h = Math.max(MINDEST_HOEHE, Math.min(pos.h + dy, flaeche.y + flaeche.h - pos.y));
  return { ...pos, w, h };
}

/** Liegt die Fensterecke nah genug an der Zielposition (großzügiger im Hilfsmodus)? */
export function amZiel(pos: Rechteck, ziel: { x: number; y: number }, hilfe = false): boolean {
  const toleranz = hilfe ? TOLERANZ_VERSCHIEBEN * 1.5 : TOLERANZ_VERSCHIEBEN;
  return Math.abs(pos.x - ziel.x) <= toleranz && Math.abs(pos.y - ziel.y) <= toleranz;
}

/** Ist das Fenster mindestens so groß wie verlangt? */
export function groesseErreicht(pos: Rechteck, ziel: { w: number; h: number } = ZIEL_GROESSE): boolean {
  return pos.w >= ziel.w && pos.h >= ziel.h;
}

/**
 * Der gestrichelte Zielrahmen fürs Größe-ändern: von der aktuellen Ecke
 * (oben links) aus ZIEL_GROESSE groß, aber nie über den Bildschirmrand
 * hinaus — sonst liefe der Rahmen bei einem Fenster nah am Rand einfach ab.
 */
export function zielRahmen(pos: Rechteck, ziel: { w: number; h: number } = ZIEL_GROESSE, flaeche: Rechteck = WINDOWS_FLAECHE): Rechteck {
  const w = Math.min(ziel.w, flaeche.x + flaeche.w - pos.x);
  const h = Math.min(ziel.h, flaeche.y + flaeche.h - pos.y);
  return { x: pos.x, y: pos.y, w, h };
}

/** Alt+Tab gilt erst als geschafft, wer lange genug weg war — kein versehentliches Antippen. */
export function altTabGeschafft(wegMs: number, mindestMs = ALT_TAB_MINDEST_MS): boolean {
  return wegMs >= mindestMs;
}

export function maximieren(z: FensterZustand): FensterZustand {
  return { ...z, modus: "maximiert" };
}

export function wiederherstellen(z: FensterZustand): FensterZustand {
  return { ...z, modus: "normal" };
}

export function minimieren(z: FensterZustand): FensterZustand {
  return { ...z, modus: "minimiert" };
}

export function zurueckholen(z: FensterZustand): FensterZustand {
  return { ...z, modus: "normal" };
}

export function schliessen(z: FensterZustand): FensterZustand {
  return { ...z, modus: "geschlossen" };
}
