/**
 * Das nachgebaute Dateisystem: »Dieser PC«, Laufwerk C: und die üblichen
 * Windows-11-Ordner.
 *
 * Absichtlich flach: C:\Programme, C:\Windows und »Öffentlich« lassen sich
 * anklicken, zeigen aber nur eine Warnung — dort hat ein Kind nichts zu
 * suchen, und genau das soll es lernen. Tiefer geht es nur im eigenen
 * Benutzerordner C:\Benutzer\<Name>\…
 */
import type { AppId } from "./windows";

export type KnotenArt = "pc" | "laufwerk" | "ordner" | "datei";
export type OrdnerArt = "normal" | "desktop" | "dokumente" | "downloads" | "bilder" | "musik" | "videos" | "benutzer" | "system";

export type Knoten = {
  id: string;
  name: string;
  art: KnotenArt;
  eltern: string | null;
  ordnerArt?: OrdnerArt;
  app?: AppId;
  /** Statt des Inhalts erscheint diese Warnung (Systemordner). */
  gesperrt?: string;
  groesse?: string;
};

export type Dateisystem = Record<string, Knoten>;

/** Der Backslash — aus dem Zeichencode gebaut, nicht als Escape getippt. */
export const TRENNER = String.fromCharCode(92);

export const EIGENE_ORDNER: { id: string; name: string; art: OrdnerArt }[] = [
  { id: "desktop", name: "Desktop", art: "desktop" },
  { id: "downloads", name: "Downloads", art: "downloads" },
  { id: "dokumente", name: "Dokumente", art: "dokumente" },
  { id: "bilder", name: "Bilder", art: "bilder" },
  { id: "musik", name: "Musik", art: "musik" },
  { id: "videos", name: "Videos", art: "videos" },
];

export const WARNUNG_WINDOWS =
  "Achtung: Hier liegt Windows selbst. Wer hier etwas verändert, kann den Computer kaputt machen. Geh zurück zu deinen eigenen Ordnern.";
export const WARNUNG_PROGRAMME =
  "Hier sind die Programme installiert. Deine eigenen Dateien gehören nicht hierher — geh lieber zurück.";
export const WARNUNG_OEFFENTLICH =
  "Das ist der Ordner für alle Benutzer dieses Computers. Deine Sachen liegen in deinem eigenen Ordner.";

/** Der Windows-Benutzername: der Rufname aus dem Konto bzw. dem Gastnamen, ohne Leer- und Sonderzeichen. */
export function benutzernameAus(name: string | null | undefined): string {
  const erstes = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const sauber = erstes.replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 20);
  return sauber || "Schüler";
}

export function baueDateisystem(benutzer: string): Dateisystem {
  const fs: Dateisystem = {};
  const neu = (k: Knoten) => { fs[k.id] = k; };

  neu({ id: "pc", name: "Dieser PC", art: "pc", eltern: null });
  neu({ id: "c", name: "Lokaler Datenträger (C:)", art: "laufwerk", eltern: "pc" });
  neu({ id: "c-benutzer", name: "Benutzer", art: "ordner", eltern: "c", ordnerArt: "normal" });
  neu({ id: "c-programme", name: "Programme", art: "ordner", eltern: "c", ordnerArt: "system", gesperrt: WARNUNG_PROGRAMME });
  neu({ id: "c-programme86", name: "Programme (x86)", art: "ordner", eltern: "c", ordnerArt: "system", gesperrt: WARNUNG_PROGRAMME });
  neu({ id: "c-windows", name: "Windows", art: "ordner", eltern: "c", ordnerArt: "system", gesperrt: WARNUNG_WINDOWS });
  neu({ id: "c-oeffentlich", name: "Öffentlich", art: "ordner", eltern: "c-benutzer", ordnerArt: "system", gesperrt: WARNUNG_OEFFENTLICH });
  neu({ id: "benutzer", name: benutzernameAus(benutzer), art: "ordner", eltern: "c-benutzer", ordnerArt: "benutzer" });
  for (const o of EIGENE_ORDNER) neu({ id: o.id, name: o.name, art: "ordner", eltern: "benutzer", ordnerArt: o.art });

  const datei = (id: string, name: string, eltern: string, app: AppId, groesse: string) =>
    neu({ id, name, art: "datei", eltern, app, groesse });
  datei("f-referat", "Referat Planeten.docx", "dokumente", "word", "48 KB");
  datei("f-noten", "Noten.xlsx", "dokumente", "excel", "12 KB");
  datei("f-hausaufgabe", "Mathe Hausaufgabe.pdf", "downloads", "reader", "210 KB");
  datei("f-fotos", "Fotos.zip", "downloads", "zip", "3,4 MB");
  datei("f-klassenfoto", "Klassenfoto.jpg", "bilder", "irfanview", "2,1 MB");
  datei("f-urlaub", "Urlaub.jpg", "bilder", "irfanview", "1,8 MB");
  datei("f-schullied", "Schullied.mp3", "musik", "vlc", "4,2 MB");
  datei("f-klassenfahrt", "Klassenfahrt.mp4", "videos", "vlc", "86 MB");
  datei("f-einkauf", "Einkaufsliste.txt", "desktop", "editor", "1 KB");
  return fs;
}

/** Inhalt eines Ordners: Ordner vor Dateien, alphabetisch. »Dieser PC« zeigt die eigenen Ordner und C:. */
export function kinder(fs: Dateisystem, id: string): Knoten[] {
  if (id === "pc") return [...EIGENE_ORDNER.map(o => fs[o.id]), fs.c].filter(Boolean);
  const k = fs[id];
  if (!k || k.gesperrt) return [];
  return Object.values(fs)
    .filter(x => x.eltern === id)
    .sort((a, b) => Number(a.art === "datei") - Number(b.art === "datei") || a.name.localeCompare(b.name, "de"));
}

/** Von »Dieser PC« bis zum Knoten. */
export function pfad(fs: Dateisystem, id: string): Knoten[] {
  const kette: Knoten[] = [];
  let k: Knoten | undefined = fs[id];
  while (k) {
    kette.unshift(k);
    k = k.eltern ? fs[k.eltern] : undefined;
  }
  return kette;
}

/** C:\Benutzer\Mia\Dokumente */
export function pfadText(fs: Dateisystem, id: string): string {
  const teile = pfad(fs, id).filter(k => k.art !== "pc");
  if (teile.length === 0) return "Dieser PC";
  return teile.map(k => (k.art === "laufwerk" ? "C:" : k.name)).join(TRENNER);
}

/** Gespeichert werden darf nur im eigenen Benutzerordner. */
export function darfSpeichern(fs: Dateisystem, ordnerId: string): boolean {
  const k = fs[ordnerId];
  return !!k && k.art === "ordner" && !k.gesperrt && pfad(fs, ordnerId).some(x => x.id === "benutzer");
}

export const VERBOTENE_ZEICHEN = '/:*?"<>|' + TRENNER;

export function mitEndung(name: string, endung: string): string {
  const n = name.trim();
  return n.toLowerCase().endsWith(endung.toLowerCase()) ? n : n + endung;
}

/** Warum dieser Name nicht geht — oder null. */
export function namensFehler(fs: Dateisystem, ordnerId: string, name: string): string | null {
  const n = name.trim();
  if (!n || n.startsWith(".")) return "Gib der Datei einen Namen.";
  if ([...n].some(c => VERBOTENE_ZEICHEN.includes(c))) {
    return `Diese Zeichen gehen nicht in Dateinamen: ${[...VERBOTENE_ZEICHEN].join(" ")}`;
  }
  if (kinder(fs, ordnerId).some(k => k.name.toLowerCase() === n.toLowerCase())) {
    return "Eine Datei mit diesem Namen gibt es hier schon — nimm einen anderen.";
  }
  return null;
}

export function neueDatei(
  fs: Dateisystem, ordnerId: string, name: string, app: AppId, groesse = "1 KB",
): { fs: Dateisystem; id: string } {
  let nr = 1;
  while (fs[`neu-${nr}`]) nr += 1;
  const id = `neu-${nr}`;
  return { fs: { ...fs, [id]: { id, name: name.trim(), art: "datei", eltern: ordnerId, app, groesse } }, id };
}
