/**
 * Das nachgebaute Windows 11 des Maus-Führerscheins — Daten ohne Bildschirm.
 *
 * Apps, Suche, Hintergründe, Akzentfarben und das »Aussehen« eines Kindes
 * (Teil 3). Bewusst keine echten Logos: die sind Marken und kaum frei
 * lizenziert. Jede App bekommt ein eigenes Symbol in ihrer typischen Farbe,
 * dazu steht immer der Name (siehe components/maus/windows/AppSymbol.tsx).
 */

export type AppId =
  | "papierkorb" | "dieserpc" | "explorer" | "einstellungen"
  | "edge" | "firefox" | "chrome" | "brave"
  | "word" | "writer" | "excel" | "calc" | "powerpoint" | "impress"
  | "reader" | "irfanview" | "inkscape" | "paint" | "gimp"
  | "vlc" | "editor" | "rechner" | "audacity" | "zip"
  | "thunderbird" | "geogebra" | "scratch" | "snipping";

export type AppArt = "system" | "browser" | "buero" | "bild" | "medien" | "werkzeug" | "lernen";

export type App = {
  id: AppId;
  name: string;
  farbe: string;
  art: AppArt;
  /** Wonach ein Kind in der Suche tippen könnte. */
  schlagworte: string[];
};

const app = (id: AppId, name: string, farbe: string, art: AppArt, schlagworte: string[]): App =>
  ({ id, name, farbe, art, schlagworte });

export const APPS: Record<AppId, App> = {
  papierkorb: app("papierkorb", "Papierkorb", "#94a3b8", "system", ["müll", "gelöscht", "löschen"]),
  dieserpc: app("dieserpc", "Dieser PC", "#3b82f6", "system", ["computer", "laufwerk", "festplatte"]),
  explorer: app("explorer", "Explorer", "#f2c94c", "system", ["dateien", "ordner", "datei-explorer"]),
  einstellungen: app("einstellungen", "Einstellungen", "#6b7280", "system", ["system", "optionen"]),
  edge: app("edge", "Edge", "#0c8ce9", "browser", ["internet", "browser", "surfen", "webseite"]),
  firefox: app("firefox", "Firefox", "#ff7139", "browser", ["internet", "browser", "surfen", "webseite"]),
  chrome: app("chrome", "Chrome", "#4285f4", "browser", ["internet", "browser", "surfen", "webseite", "google"]),
  brave: app("brave", "Brave", "#fb542b", "browser", ["internet", "browser", "surfen", "webseite"]),
  word: app("word", "Word", "#185abd", "buero", ["text", "brief", "schreiben", "dokument"]),
  writer: app("writer", "LibreOffice Writer", "#2a6fc9", "buero", ["text", "brief", "schreiben", "dokument"]),
  excel: app("excel", "Excel", "#107c41", "buero", ["tabelle", "rechnen", "noten", "zahlen"]),
  calc: app("calc", "LibreOffice Calc", "#1e9e4a", "buero", ["tabelle", "rechnen", "noten", "zahlen"]),
  powerpoint: app("powerpoint", "PowerPoint", "#c43e1c", "buero", ["präsentation", "folien", "referat", "vortrag"]),
  impress: app("impress", "LibreOffice Impress", "#d0652d", "buero", ["präsentation", "folien", "referat", "vortrag"]),
  reader: app("reader", "Adobe Reader", "#d7282a", "buero", ["pdf", "lesen", "arbeitsblatt"]),
  irfanview: app("irfanview", "IrfanView", "#c62828", "bild", ["foto", "bilder", "ansehen", "anzeigen"]),
  inkscape: app("inkscape", "Inkscape", "#222222", "bild", ["vektor", "logo", "zeichnen", "svg"]),
  paint: app("paint", "Paint", "#f59e0b", "bild", ["malen", "zeichnen", "bild"]),
  gimp: app("gimp", "GIMP", "#7a6a53", "bild", ["foto", "bearbeiten", "zuschneiden", "bild"]),
  vlc: app("vlc", "VLC", "#ff8800", "medien", ["video", "film", "musik", "abspielen"]),
  editor: app("editor", "Editor", "#3b82f6", "werkzeug", ["notiz", "text", "notepad", "txt"]),
  rechner: app("rechner", "Rechner", "#374151", "werkzeug", ["rechnen", "taschenrechner", "mathe"]),
  audacity: app("audacity", "Audacity", "#1d4ed8", "medien", ["ton", "aufnehmen", "audio", "podcast"]),
  zip: app("zip", "7-Zip", "#475569", "werkzeug", ["zip", "entpacken", "packen", "archiv"]),
  thunderbird: app("thunderbird", "Thunderbird", "#0a84ff", "werkzeug", ["mail", "e-mail", "post", "nachricht"]),
  geogebra: app("geogebra", "GeoGebra", "#6557d2", "lernen", ["mathe", "funktion", "geometrie", "graph"]),
  scratch: app("scratch", "Scratch", "#f9a825", "lernen", ["programmieren", "spiel", "code", "blöcke"]),
  snipping: app("snipping", "Snipping Tool", "#8b5cf6", "werkzeug", ["bildschirmfoto", "screenshot", "ausschnitt"]),
};

export const ALLE_APPS: App[] = Object.values(APPS);

/** Was auf einem frischen Schul-Desktop liegt. */
export const STANDARD_DESKTOP: AppId[] = ["papierkorb", "dieserpc", "firefox", "chrome", "brave", "word", "paint"];
/** In der Taskleiste angeheftet. */
export const STANDARD_TASKLEISTE: AppId[] = ["explorer", "edge", "firefox", "word", "einstellungen"];

// ── Suche ──────────────────────────────────────────────────────────────────

export type Treffer =
  | { art: "app"; id: AppId; name: string }
  | { art: "datei"; id: string; name: string; ort: string; app: AppId }
  | { art: "einstellung"; id: EinstellungId; name: string; bereich: string };

export type EinstellungId =
  | "hintergrund" | "farben" | "mauszeiger" | "textgroesse" | "taskleiste" | "sperrbildschirm" | "konto";

export const SUCH_DATEIEN: { id: string; name: string; ort: string; app: AppId; schlagworte: string[] }[] = [
  { id: "referat", name: "Referat Planeten.docx", ort: "Dokumente", app: "word", schlagworte: ["planeten", "referat"] },
  { id: "hausaufgabe", name: "Mathe Hausaufgabe.pdf", ort: "Downloads", app: "reader", schlagworte: ["mathe", "hausaufgabe"] },
  { id: "klassenfoto", name: "Klassenfoto.jpg", ort: "Bilder", app: "irfanview", schlagworte: ["foto", "klasse"] },
  { id: "schullied", name: "Schullied.mp3", ort: "Musik", app: "vlc", schlagworte: ["lied", "musik"] },
  { id: "einkauf", name: "Einkaufsliste.txt", ort: "Desktop", app: "editor", schlagworte: ["einkauf", "liste"] },
  { id: "noten", name: "Noten.xlsx", ort: "Dokumente", app: "excel", schlagworte: ["noten", "zeugnis"] },
];

export const EINSTELLUNGEN: { id: EinstellungId; name: string; bereich: string; schlagworte: string[] }[] = [
  { id: "hintergrund", name: "Hintergrund", bereich: "Personalisierung", schlagworte: ["hintergrundbild", "desktop", "bild"] },
  { id: "farben", name: "Farben", bereich: "Personalisierung", schlagworte: ["dunkel", "hell", "modus", "akzent", "farbe"] },
  { id: "taskleiste", name: "Taskleiste", bereich: "Personalisierung", schlagworte: ["start", "anheften", "links", "mitte"] },
  { id: "sperrbildschirm", name: "Sperrbildschirm", bereich: "Personalisierung", schlagworte: ["sperren", "sperrbild"] },
  { id: "mauszeiger", name: "Mauszeiger", bereich: "Barrierefreiheit", schlagworte: ["zeiger", "maus", "cursor", "größe"] },
  { id: "textgroesse", name: "Textgröße", bereich: "Barrierefreiheit", schlagworte: ["schrift", "text", "größer", "lesen"] },
  { id: "konto", name: "Profilbild", bereich: "Konten", schlagworte: ["konto", "profil", "benutzer", "bild"] },
];

/** Kleinschreibung, ohne Akzente — »Größe« findet auch »grosse« nicht, aber »große« und »GROSSE«? Nein: nur Akzente fallen weg. */
export function normalisieren(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function bewertung(anfrage: string, name: string, schlagworte: string[]): number {
  const n = normalisieren(name);
  if (n.startsWith(anfrage)) return 4;
  if (n.split(/[\s.-]+/).some(w => w.startsWith(anfrage))) return 3;
  if (schlagworte.some(w => normalisieren(w).startsWith(anfrage))) return 2;
  if (n.includes(anfrage)) return 1;
  return 0;
}

const RANG: Record<Treffer["art"], number> = { app: 0, einstellung: 1, datei: 2 };

/** Wie die Windows-Suche: Apps zuerst, dann Einstellungen, dann Dateien; höchstens acht. */
export function suche(text: string): Treffer[] {
  const anfrage = normalisieren(text);
  if (!anfrage) return [];
  const kandidaten: { treffer: Treffer; wert: number }[] = [
    ...ALLE_APPS.map(a => ({ treffer: { art: "app", id: a.id, name: a.name } as Treffer, wert: bewertung(anfrage, a.name, a.schlagworte) })),
    ...EINSTELLUNGEN.map(e => ({ treffer: { art: "einstellung", id: e.id, name: e.name, bereich: e.bereich } as Treffer, wert: bewertung(anfrage, e.name, e.schlagworte) })),
    ...SUCH_DATEIEN.map(d => ({ treffer: { art: "datei", id: d.id, name: d.name, ort: d.ort, app: d.app } as Treffer, wert: bewertung(anfrage, d.name, d.schlagworte) })),
  ];
  return kandidaten
    .filter(k => k.wert > 0)
    .sort((a, b) => b.wert - a.wert || RANG[a.treffer.art] - RANG[b.treffer.art] || a.treffer.name.localeCompare(b.treffer.name, "de"))
    .slice(0, 8)
    .map(k => k.treffer);
}

// ── Aussehen ───────────────────────────────────────────────────────────────

export type Hintergrund = { id: string; name: string; css: string };

/** Eigene Verläufe statt Bilddateien — nichts zu laden, nichts zu lizenzieren. */
export const HINTERGRUENDE: Hintergrund[] = [
  { id: "bluete", name: "Blüte", css: "radial-gradient(ellipse at 62% 58%, #9cc9ff 0%, #3b7ddd 22%, #1446a6 48%, #0a2463 78%, #061a45 100%)" },
  { id: "himmel", name: "Himmel", css: "linear-gradient(135deg, #6ea8e0 0%, #8fd3c0 100%)" },
  { id: "sonnenuntergang", name: "Sonnenuntergang", css: "linear-gradient(160deg, #ffb36b 0%, #ff6f91 45%, #6a4c93 100%)" },
  { id: "wald", name: "Wald", css: "linear-gradient(180deg, #a8e6cf 0%, #4caf7d 55%, #1f6f4a 100%)" },
  { id: "nacht", name: "Sternennacht", css: "radial-gradient(circle at 25% 20%, #3a4a8a 0%, #141a3a 55%, #070a1a 100%)" },
  { id: "bonbon", name: "Bonbon", css: "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)" },
];

export const AKZENTE: { id: string; name: string; farbe: string }[] = [
  { id: "blau", name: "Blau", farbe: "#0078d7" },
  { id: "gruen", name: "Grün", farbe: "#107c10" },
  { id: "rot", name: "Rot", farbe: "#e81123" },
  { id: "lila", name: "Lila", farbe: "#8764b8" },
  { id: "orange", name: "Orange", farbe: "#ff8c00" },
  { id: "pink", name: "Pink", farbe: "#e3008c" },
];

/** Echtes »Invertiert« kann ein Browser-Zeiger nicht — dafür Neongelb wie die Windows-Vorschlagsfarbe. */
export type ZeigerFarbe = "weiss" | "schwarz" | "gelb" | "bunt";

export type Aussehen = {
  hintergrund: string;
  dunkel: boolean;
  akzent: string;
  /** 1 = normal … 5 = sehr groß */
  zeigerGroesse: number;
  zeigerFarbe: ZeigerFarbe;
  /** Prozent: 100 … 200 */
  textGroesse: number;
  ausrichtung: "mitte" | "links";
  taskleiste: AppId[];
  desktop: AppId[];
  /** Avatar-Id des Kindes, null = Standardbild */
  profilTier: string | null;
  sperrBild: string;
  begruessung: string;
};

export const STANDARD_AUSSEHEN: Aussehen = {
  hintergrund: "bluete",
  dunkel: false,
  akzent: "blau",
  zeigerGroesse: 1,
  zeigerFarbe: "weiss",
  textGroesse: 100,
  ausrichtung: "mitte",
  taskleiste: STANDARD_TASKLEISTE,
  desktop: STANDARD_DESKTOP,
  profilTier: null,
  sperrBild: "himmel",
  begruessung: "",
};

export function hintergrundCss(id: string): string {
  return (HINTERGRUENDE.find(h => h.id === id) ?? HINTERGRUENDE[0]).css;
}

export function akzentFarbe(id: string): string {
  return (AKZENTE.find(a => a.id === id) ?? AKZENTE[0]).farbe;
}

/** Gespeichertes Aussehen einlesen — unbekannte oder fehlende Felder fallen auf den Standard zurück. */
export function aussehenAus(roh: unknown): Aussehen {
  if (!roh || typeof roh !== "object") return STANDARD_AUSSEHEN;
  const r = roh as Partial<Aussehen>;
  const appListe = (l: unknown, standard: AppId[]) =>
    Array.isArray(l) ? l.filter((x): x is AppId => typeof x === "string" && x in APPS) : standard;
  return {
    hintergrund: HINTERGRUENDE.some(h => h.id === r.hintergrund) ? r.hintergrund! : STANDARD_AUSSEHEN.hintergrund,
    dunkel: r.dunkel === true,
    akzent: AKZENTE.some(a => a.id === r.akzent) ? r.akzent! : STANDARD_AUSSEHEN.akzent,
    zeigerGroesse: typeof r.zeigerGroesse === "number" ? Math.min(5, Math.max(1, Math.round(r.zeigerGroesse))) : 1,
    zeigerFarbe: (["weiss", "schwarz", "gelb", "bunt"] as const).includes(r.zeigerFarbe as ZeigerFarbe) ? r.zeigerFarbe! : "weiss",
    textGroesse: typeof r.textGroesse === "number" ? Math.min(200, Math.max(100, Math.round(r.textGroesse))) : 100,
    ausrichtung: r.ausrichtung === "links" ? "links" : "mitte",
    taskleiste: appListe(r.taskleiste, STANDARD_TASKLEISTE),
    desktop: appListe(r.desktop, STANDARD_DESKTOP),
    profilTier: typeof r.profilTier === "string" ? r.profilTier : null,
    sperrBild: HINTERGRUENDE.some(h => h.id === r.sperrBild) ? r.sperrBild! : STANDARD_AUSSEHEN.sperrBild,
    begruessung: typeof r.begruessung === "string" ? r.begruessung.slice(0, 40) : "",
  };
}

// ── Welche App wofür? ──────────────────────────────────────────────────────

export type AppAufgabe = { text: string; richtig: AppId[] };

/** Mehrere Antworten dürfen stimmen — einen Brief schreibt man mit Word *oder* Writer. */
export const APP_AUFGABEN: AppAufgabe[] = [
  { text: "Ein PDF-Arbeitsblatt lesen", richtig: ["reader", "edge", "firefox", "chrome", "brave"] },
  { text: "Ein Foto schnell ansehen", richtig: ["irfanview"] },
  { text: "Ein Bild malen", richtig: ["paint"] },
  { text: "Ein Foto zuschneiden und heller machen", richtig: ["gimp", "irfanview"] },
  { text: "Ein Logo zeichnen, das beim Vergrößern scharf bleibt", richtig: ["inkscape"] },
  { text: "Einen Brief schreiben", richtig: ["word", "writer"] },
  { text: "Eine Präsentation für ein Referat bauen", richtig: ["powerpoint", "impress"] },
  { text: "Eine Tabelle mit Noten ausrechnen", richtig: ["excel", "calc"] },
  { text: "Im Internet etwas nachschlagen", richtig: ["edge", "firefox", "chrome", "brave"] },
  { text: "Ein Video abspielen", richtig: ["vlc"] },
  { text: "Eine ZIP-Datei entpacken", richtig: ["zip", "explorer"] },
  { text: "Eine Tonaufnahme machen und schneiden", richtig: ["audacity"] },
  { text: "Eine E-Mail schreiben", richtig: ["thunderbird"] },
  { text: "Eine Funktion in Mathe zeichnen", richtig: ["geogebra"] },
  { text: "Ein kleines Spiel programmieren", richtig: ["scratch"] },
  { text: "Schnell etwas ausrechnen", richtig: ["rechner"] },
  { text: "Eine Notiz ohne Formatierung aufschreiben", richtig: ["editor"] },
  { text: "Ein Bildschirmfoto machen", richtig: ["snipping"] },
];

export type Dateityp = { endung: string; beispiel: string; richtig: AppId[] };

export const DATEITYPEN: Dateityp[] = [
  { endung: ".pdf", beispiel: "Arbeitsblatt.pdf", richtig: ["reader", "edge", "firefox", "chrome", "brave"] },
  { endung: ".jpg", beispiel: "Urlaub.jpg", richtig: ["irfanview", "paint", "gimp"] },
  { endung: ".svg", beispiel: "Logo.svg", richtig: ["inkscape"] },
  { endung: ".docx", beispiel: "Aufsatz.docx", richtig: ["word", "writer"] },
  { endung: ".odt", beispiel: "Brief.odt", richtig: ["writer", "word"] },
  { endung: ".pptx", beispiel: "Referat.pptx", richtig: ["powerpoint", "impress"] },
  { endung: ".xlsx", beispiel: "Noten.xlsx", richtig: ["excel", "calc"] },
  { endung: ".mp4", beispiel: "Klassenfahrt.mp4", richtig: ["vlc"] },
  { endung: ".mp3", beispiel: "Schullied.mp3", richtig: ["vlc", "audacity"] },
  { endung: ".zip", beispiel: "Fotos.zip", richtig: ["zip", "explorer"] },
  { endung: ".txt", beispiel: "Notiz.txt", richtig: ["editor"] },
  { endung: ".ggb", beispiel: "Parabel.ggb", richtig: ["geogebra"] },
  { endung: ".sb3", beispiel: "Spiel.sb3", richtig: ["scratch"] },
];

export function istRichtig(aufgabe: { richtig: AppId[] }, gewaehlt: AppId): boolean {
  return aufgabe.richtig.includes(gewaehlt);
}
