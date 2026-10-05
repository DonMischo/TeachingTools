/**
 * Stufe »Welche App?« — reine Helfer ohne Bildschirm.
 *
 * Runde 1: zu einer Aufgabe die passende App finden (APP_AUFGABEN).
 * Runde 2: zu einer Datei die passende App finden (DATEITYPEN).
 */
import { ALLE_APPS, APP_AUFGABEN, DATEITYPEN, type AppId, type Dateityp, type AppAufgabe } from "./windows";

/** Alle Apps außer den System-Kacheln — die trägt man nicht auf sie. */
export const AUSWAHL_APPS: AppId[] = ALLE_APPS.filter(a => a.art !== "system").map(a => a.id);

/** Zieht `n` Einträge aus `liste` in zufälliger, aber für die Runde fester Reihenfolge. */
export function ziehKarten<T>(liste: T[], n: number, zufall: () => number = Math.random): T[] {
  const kopie = liste.slice();
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie.slice(0, Math.min(n, kopie.length));
}

/** Weitere Apps, die ebenfalls richtig gewesen wären — ohne die gerade gewählte. */
export function alternativen(aufgabe: { richtig: AppId[] }, gewaehlt: AppId): AppId[] {
  return aufgabe.richtig.filter(id => id !== gewaehlt);
}

export type AppKarte = { art: "aufgabe"; aufgabe: AppAufgabe } | { art: "datei"; datei: Dateityp };

export function kartenText(karte: AppKarte): string {
  return karte.art === "aufgabe" ? karte.aufgabe.text : karte.datei.beispiel;
}

export function kartenRichtig(karte: AppKarte): AppId[] {
  return karte.art === "aufgabe" ? karte.aufgabe.richtig : karte.datei.richtig;
}

export { APP_AUFGABEN, DATEITYPEN };

// ── Dateitypen: die Runde vor den Apps ─────────────────────────────────

export type DateiArtId = "text" | "bild" | "musik" | "video" | "tabelle" | "praesentation" | "pdf" | "archiv";

/** Was für eine Datei ist das? Die Endung hinter dem Punkt verrät es. */
export const DATEI_ARTEN: { id: DateiArtId; name: string; icon: string; endungen: string[]; erklaerung: string }[] = [
  { id: "text", name: "Text", icon: "📝", endungen: [".txt", ".docx", ".odt"], erklaerung: "Geschriebenes: Aufsatz, Brief, Notiz." },
  { id: "bild", name: "Bild", icon: "🖼️", endungen: [".jpg", ".png", ".svg"], erklaerung: "Fotos, Zeichnungen, Bildschirmfotos." },
  { id: "musik", name: "Musik & Ton", icon: "🎵", endungen: [".mp3", ".wav"], erklaerung: "Lieder, Hörspiele, Aufnahmen." },
  { id: "video", name: "Video", icon: "🎬", endungen: [".mp4"], erklaerung: "Filme und Handyvideos." },
  { id: "tabelle", name: "Tabelle", icon: "📊", endungen: [".xlsx", ".ods"], erklaerung: "Zahlen in Zeilen und Spalten, z. B. Noten." },
  { id: "praesentation", name: "Präsentation", icon: "📽️", endungen: [".pptx", ".odp"], erklaerung: "Folien für ein Referat." },
  { id: "pdf", name: "PDF", icon: "📕", endungen: [".pdf"], erklaerung: "Fertige Blätter zum Lesen und Drucken." },
  { id: "archiv", name: "Archiv", icon: "🗜️", endungen: [".zip"], erklaerung: "Viele Dateien in ein Päckchen gepackt." },
];

/** Dateinamen für die Sortier-Runde — jede Art mindestens einmal. */
export const DATEI_BEISPIELE: string[] = [
  "Ferienfoto.jpg", "Einkaufsliste.txt", "Schullied.mp3", "Klassenfahrt.mp4", "Noten.xlsx",
  "Referat.pptx", "Arbeitsblatt.pdf", "Fotos.zip", "Aufsatz.docx", "Logo.png", "Hörspiel.wav", "Brief.odt",
];

/** »Urlaub.JPG« → ».jpg« */
export function endungVon(dateiname: string): string {
  const punkt = dateiname.lastIndexOf(".");
  return punkt > 0 ? dateiname.slice(punkt).toLowerCase() : "";
}

export function artVon(dateiname: string): DateiArtId | null {
  const endung = endungVon(dateiname);
  return DATEI_ARTEN.find(a => a.endungen.includes(endung))?.id ?? null;
}

// ── Kurzinfo je App (Hover über der Kachel) ────────────────────────────

/** Was die App macht und welche Dateien zu ihr passen. */
export const APP_INFO: Partial<Record<AppId, { was: string; endungen: string[] }>> = {
  edge: { was: "Browser von Windows: Internetseiten ansehen.", endungen: [".pdf", ".html"] },
  firefox: { was: "Browser: Internetseiten ansehen.", endungen: [".pdf", ".html"] },
  chrome: { was: "Browser von Google: Internetseiten ansehen.", endungen: [".pdf", ".html"] },
  brave: { was: "Browser, der Werbung und Verfolgung blockiert.", endungen: [".pdf", ".html"] },
  word: { was: "Texte schreiben und gestalten: Aufsatz, Brief, Plakat.", endungen: [".docx", ".odt"] },
  writer: { was: "Texte schreiben — kostenlos, wie Word.", endungen: [".odt", ".docx"] },
  excel: { was: "Tabellen mit Zahlen, die sich selbst ausrechnen.", endungen: [".xlsx", ".ods"] },
  calc: { was: "Tabellen rechnen — kostenlos, wie Excel.", endungen: [".ods", ".xlsx"] },
  powerpoint: { was: "Folien für ein Referat oder einen Vortrag.", endungen: [".pptx", ".odp"] },
  impress: { was: "Folien für Referate — kostenlos, wie PowerPoint.", endungen: [".odp", ".pptx"] },
  reader: { was: "PDF-Dateien lesen und drucken.", endungen: [".pdf"] },
  irfanview: { was: "Bilder schnell ansehen, drehen und verkleinern.", endungen: [".jpg", ".png"] },
  inkscape: { was: "Logos und Grafiken zeichnen, die beim Vergrößern scharf bleiben.", endungen: [".svg"] },
  paint: { was: "Einfach malen und Bilder ein wenig ändern.", endungen: [".png", ".jpg"] },
  gimp: { was: "Fotos bearbeiten: zuschneiden, aufhellen, retuschieren.", endungen: [".jpg", ".png"] },
  vlc: { was: "Spielt fast jedes Video und jede Musik ab.", endungen: [".mp4", ".mp3", ".wav"] },
  editor: { was: "Ganz einfacher Text ohne Schriftarten und Farben.", endungen: [".txt"] },
  rechner: { was: "Der Taschenrechner von Windows.", endungen: [] },
  audacity: { was: "Ton aufnehmen und schneiden, z. B. ein Hörspiel.", endungen: [".mp3", ".wav"] },
  zip: { was: "Dateien packen und entpacken.", endungen: [".zip", ".7z"] },
  thunderbird: { was: "E-Mails schreiben und lesen.", endungen: [".eml"] },
  geogebra: { was: "Mathe: Funktionen zeichnen und Geometrie konstruieren.", endungen: [".ggb"] },
  scratch: { was: "Mit Blöcken programmieren: Spiele und Geschichten.", endungen: [".sb3"] },
  snipping: { was: "Bildschirmfotos machen und markieren.", endungen: [".png", ".jpg"] },
};
