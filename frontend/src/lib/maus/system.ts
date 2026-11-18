/**
 * Welches Betriebssystem der Maus-Führerschein nachbildet — Windows 11,
 * Ubuntu (GNOME) oder macOS. Die Aufgaben bleiben dieselben; es wechseln
 * Begriffe, Tastenkürzel, App-Namen, Pfade und die Optik des Desktops.
 *
 * Alles hier ist Text und Daten ohne Bildschirm. Tastenkürzel stehen in der
 * Schreibweise von `mitTasten` (`[[Strg]]+[[C]]`), damit sie als Tastenkappen
 * erscheinen.
 *
 * Am Schulrechner läuft meist Windows. Wer dort macOS übt, drückt statt ⌘
 * die Strg-Taste — die Stufen nehmen deshalb immer beide an (ctrlKey ||
 * metaKey). `hinweisFremd` erklärt das dem Kind.
 */
import { APPS, type App, type AppId } from "./windows";

export type Betriebssystem = "windows" | "ubuntu" | "macos";

export const BETRIEBSSYSTEME: Betriebssystem[] = ["windows", "ubuntu", "macos"];

/** Benannte Kürzel — jede Stufe holt sich das passende statt »Strg« fest zu schreiben. */
export type Kuerzel =
  | "kopieren" | "ausschneiden" | "einfuegen" | "rueckgaengig" | "allesMarkieren" | "speichern"
  | "appWechsel" | "appSchliessen" | "fensterSchliessen" | "sperren" | "suche"
  | "bildschirmfotoBereich" | "bildschirmfotoGanz" | "umbenennen" | "loeschen"
  | "zeilenAnfang" | "zeilenEnde" | "entfernenRechts" | "desktopZeigen" | "mehrfachAuswahl";

export type SystemInfo = {
  id: Betriebssystem;
  name: string;
  icon: string;
  /** Die Befehlstaste: Strg bzw. ⌘ */
  strg: string;
  /** Die Taste mit dem System-Logo: ⊞, Super, ⌘ */
  logoTaste: string;
  dateimanager: string;
  einstellungen: string;
  /** Leiste mit den angehefteten Apps */
  leiste: string;
  /** Wo alle Apps stehen */
  start: string;
  suche: string;
  bildschirmfotoApp: string;
  /** Wohin ein Bildschirmfoto automatisch gespeichert wird */
  bildschirmfotoOrt: string;
  /** Benutzerordner als Pfad, z. B. C:\Benutzer\Mia */
  heimPfad: (benutzer: string) => string;
  /** Name des eigenen Ordners in der Seitenleiste */
  heimName: (benutzer: string) => string;
  /** »Dieser PC« / »Andere Orte« / Name der Festplatte */
  rechnerName: string;
  /** Der Ordner »Desktop« heißt bei Ubuntu und macOS »Schreibtisch« */
  desktopOrdner: string;
  /** Der Ordner »Videos« heißt bei macOS »Filme« */
  videoOrdner: string;
  usbName: string;
  /** Wie man den USB-Stick sicher abmeldet */
  usbAuswerfen: string;
  appStore: string;
  kuerzel: Record<Kuerzel, string>;
  /** Wie man einen Rechtsklick macht, wenn die Maus nur eine Taste hat */
  rechtsklickHinweis: string | null;
};

const TRENNER = String.fromCharCode(92);

export const SYSTEME: Record<Betriebssystem, SystemInfo> = {
  windows: {
    id: "windows",
    name: "Windows 11",
    icon: "🪟",
    strg: "Strg",
    logoTaste: "⊞",
    dateimanager: "Explorer",
    einstellungen: "Einstellungen",
    leiste: "Taskleiste",
    start: "Start",
    suche: "Suche",
    bildschirmfotoApp: "Snipping Tool",
    bildschirmfotoOrt: `Bilder ${TRENNER} Screenshots`,
    heimPfad: b => ["C:", "Benutzer", b].join(TRENNER),
    heimName: b => b,
    rechnerName: "Dieser PC",
    desktopOrdner: "Desktop",
    videoOrdner: "Videos",
    usbName: "USB-Stick (D:)",
    usbAuswerfen: "Rechtsklick auf den Stick → »Auswerfen«",
    appStore: "Microsoft Store",
    kuerzel: {
      kopieren: "[[Strg]]+[[C]]",
      ausschneiden: "[[Strg]]+[[X]]",
      einfuegen: "[[Strg]]+[[V]]",
      rueckgaengig: "[[Strg]]+[[Z]]",
      allesMarkieren: "[[Strg]]+[[A]]",
      speichern: "[[Strg]]+[[S]]",
      appWechsel: "[[Alt]]+[[Tab]]",
      appSchliessen: "[[Alt]]+[[F4]]",
      fensterSchliessen: "[[Alt]]+[[F4]]",
      sperren: "[[⊞]]+[[L]]",
      suche: "[[⊞]]",
      bildschirmfotoBereich: "[[⊞]]+[[Umschalt]]+[[S]]",
      bildschirmfotoGanz: "[[Druck]]",
      umbenennen: "[[F2]]",
      loeschen: "[[Entf]]",
      zeilenAnfang: "[[Pos1]]",
      zeilenEnde: "[[Ende]]",
      entfernenRechts: "[[Entf]]",
      desktopZeigen: "[[⊞]]+[[D]]",
      mehrfachAuswahl: "[[Strg]]",
    },
    rechtsklickHinweis: null,
  },
  ubuntu: {
    id: "ubuntu",
    name: "Ubuntu",
    icon: "🐧",
    strg: "Strg",
    logoTaste: "Super",
    dateimanager: "Dateien",
    einstellungen: "Einstellungen",
    leiste: "Dock",
    start: "Anwendungen anzeigen",
    suche: "Aktivitäten",
    bildschirmfotoApp: "Bildschirmfoto",
    bildschirmfotoOrt: "Bilder / Bildschirmfotos",
    heimPfad: b => `/home/${b.toLowerCase()}`,
    heimName: () => "Persönlicher Ordner",
    rechnerName: "Andere Orte",
    desktopOrdner: "Schreibtisch",
    videoOrdner: "Videos",
    usbName: "USB-Stick",
    usbAuswerfen: "in »Dateien« auf ⏏ neben dem Stick klicken",
    appStore: "App-Zentrum",
    kuerzel: {
      kopieren: "[[Strg]]+[[C]]",
      ausschneiden: "[[Strg]]+[[X]]",
      einfuegen: "[[Strg]]+[[V]]",
      rueckgaengig: "[[Strg]]+[[Z]]",
      allesMarkieren: "[[Strg]]+[[A]]",
      speichern: "[[Strg]]+[[S]]",
      appWechsel: "[[Alt]]+[[Tab]]",
      appSchliessen: "[[Strg]]+[[Q]]",
      fensterSchliessen: "[[Strg]]+[[W]]",
      sperren: "[[Super]]+[[L]]",
      suche: "[[Super]]",
      bildschirmfotoBereich: "[[Druck]]",
      bildschirmfotoGanz: "[[Umschalt]]+[[Druck]]",
      umbenennen: "[[F2]]",
      loeschen: "[[Entf]]",
      zeilenAnfang: "[[Pos1]]",
      zeilenEnde: "[[Ende]]",
      entfernenRechts: "[[Entf]]",
      desktopZeigen: "[[Super]]+[[D]]",
      mehrfachAuswahl: "[[Strg]]",
    },
    rechtsklickHinweis: null,
  },
  macos: {
    id: "macos",
    name: "macOS",
    icon: "🍏",
    strg: "⌘",
    logoTaste: "⌘",
    dateimanager: "Finder",
    einstellungen: "Systemeinstellungen",
    leiste: "Dock",
    start: "Launchpad",
    suche: "Spotlight",
    bildschirmfotoApp: "Bildschirmfoto",
    bildschirmfotoOrt: "Schreibtisch",
    heimPfad: b => `/Benutzer/${b.toLowerCase()}`,
    heimName: b => b.toLowerCase(),
    rechnerName: "Macintosh HD",
    desktopOrdner: "Schreibtisch",
    videoOrdner: "Filme",
    usbName: "USB-Stick",
    usbAuswerfen: "im Finder auf ⏏ neben dem Stick klicken",
    appStore: "App Store",
    kuerzel: {
      kopieren: "[[⌘]]+[[C]]",
      ausschneiden: "[[⌘]]+[[X]]",
      einfuegen: "[[⌘]]+[[V]]",
      rueckgaengig: "[[⌘]]+[[Z]]",
      allesMarkieren: "[[⌘]]+[[A]]",
      speichern: "[[⌘]]+[[S]]",
      appWechsel: "[[⌘]]+[[Tab]]",
      appSchliessen: "[[⌘]]+[[Q]]",
      fensterSchliessen: "[[⌘]]+[[W]]",
      sperren: "[[⌃]]+[[⌘]]+[[Q]]",
      suche: "[[⌘]]+[[Leertaste]]",
      bildschirmfotoBereich: "[[⌘]]+[[⇧]]+[[4]]",
      bildschirmfotoGanz: "[[⌘]]+[[⇧]]+[[3]]",
      umbenennen: "[[Enter]]",
      loeschen: "[[⌘]]+[[⌫]]",
      zeilenAnfang: "[[⌘]]+[[←]]",
      zeilenEnde: "[[⌘]]+[[→]]",
      entfernenRechts: "[[fn]]+[[⌫]]",
      desktopZeigen: "[[⌘]]+[[F3]]",
      mehrfachAuswahl: "[[⌘]]",
    },
    rechtsklickHinweis: "Ohne rechte Maustaste: [[⌃]] gedrückt halten und klicken — oder mit zwei Fingern aufs Trackpad tippen.",
  },
};

/** Auf welchem echten System läuft der Browser? null = unklar (z. B. Chromebook, Tablet). */
export function echtesSystem(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): Betriebssystem | null {
  if (/Android|iPhone|iPad|CrOS/.test(ua)) return null;
  if (/Macintosh|Mac OS X/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux|X11/.test(ua)) return "ubuntu";
  return null;
}

/**
 * Was ein Kind wissen muss, wenn das geübte System nicht das echte ist —
 * oder null, wenn es passt. Kürzel mit der Logo-Taste fängt das echte
 * System oft selbst ab; dann hilft der Klick.
 */
export function hinweisFremd(geuebt: Betriebssystem, echt: Betriebssystem | null): string | null {
  if (geuebt === echt) return null;
  if (geuebt === "macos" && echt !== null) {
    return "Du übst macOS an einem anderen Computer: Wo [[⌘]] steht, drückst du hier [[Strg]]. Am echten Mac nimmst du [[⌘]].";
  }
  if (geuebt === "macos") return "Am echten Mac drückst du [[⌘]] statt [[Strg]]. Hier geht auch [[Strg]].";
  if (geuebt === "ubuntu") {
    return "Die Super-Taste ist die Taste mit dem Logo (auf Windows-Tastaturen [[⊞]]). Fängt dein Computer ein Kürzel selbst ab, klick einfach.";
  }
  if (echt === "macos") return "Du übst Windows am Mac: Wo [[Strg]] steht, geht hier auch [[⌘]].";
  return null;
}

// ── Apps je System ──────────────────────────────────────────────────────────

type AppAenderung = { name?: string; farbe?: string };

/** Andere Namen derselben Art von App — das Symbol bleibt. */
const UMBENANNT: Record<Betriebssystem, Partial<Record<AppId, AppAenderung>>> = {
  windows: {},
  ubuntu: {
    explorer: { name: "Dateien", farbe: "#e2a33a" },
    dieserpc: { name: "Persönlicher Ordner", farbe: "#e2a33a" },
    reader: { name: "Dokumentenbetrachter", farbe: "#c0392b" },
    irfanview: { name: "Bildbetrachter", farbe: "#3584e4" },
    paint: { name: "Drawing", farbe: "#f59e0b" },
    editor: { name: "Texteditor", farbe: "#3584e4" },
    zip: { name: "Archivverwaltung", farbe: "#8f6b32" },
    snipping: { name: "Bildschirmfoto", farbe: "#8b5cf6" },
  },
  macos: {
    explorer: { name: "Finder", farbe: "#1e90ff" },
    dieserpc: { name: "Macintosh HD", farbe: "#9ca3af" },
    einstellungen: { name: "Systemeinstellungen" },
    edge: { name: "Safari", farbe: "#1a9bf0" },
    reader: { name: "Vorschau", farbe: "#4a90d9" },
    paint: { name: "Freeform", farbe: "#f59e0b" },
    editor: { name: "TextEdit", farbe: "#6b7280" },
    zip: { name: "Archivierungsprogramm", farbe: "#8f6b32" },
    snipping: { name: "Bildschirmfoto", farbe: "#8b5cf6" },
  },
};

/** Apps, die es dort nicht gibt — und was an ihre Stelle tritt (null = nichts). */
const ERSETZT: Record<Betriebssystem, Partial<Record<AppId, AppId | null>>> = {
  windows: {},
  ubuntu: { edge: null, word: "writer", excel: "calc", powerpoint: "impress" },
  macos: { irfanview: "reader" },
};

/** Die Apps dieses Systems mit ihren dortigen Namen. Fehlende Apps fehlen auch im Ergebnis. */
export function appsFuer(system: Betriebssystem): Partial<Record<AppId, App>> {
  const aus: Partial<Record<AppId, App>> = {};
  for (const a of Object.values(APPS)) {
    if (a.id in ERSETZT[system]) continue;
    aus[a.id] = { ...a, ...UMBENANNT[system][a.id] };
  }
  return aus;
}

/** Name einer App auf diesem System (für ersetzte Apps der Name des Ersatzes). */
export function appName(id: AppId, system: Betriebssystem): string {
  const eigen = ersatz(id, system);
  return eigen ? (UMBENANNT[system][eigen]?.name ?? APPS[eigen].name) : APPS[id].name;
}

/** Welche App auf diesem System an die Stelle von `id` tritt — null, wenn es keine gibt. */
export function ersatz(id: AppId, system: Betriebssystem): AppId | null {
  return id in ERSETZT[system] ? (ERSETZT[system][id] ?? null) : id;
}

/** Liste von Apps auf dieses System übertragen: ersetzen, Fehlende weglassen, Doppelte streichen. */
export function fuerSystem(ids: readonly AppId[], system: Betriebssystem): AppId[] {
  const aus: AppId[] = [];
  for (const id of ids) {
    const e = ersatz(id, system);
    if (e && !aus.includes(e)) aus.push(e);
  }
  return aus;
}

// ── Fensterfläche ───────────────────────────────────────────────────────────

/**
 * Wo Fenster liegen dürfen — der Bildschirm (900 × 506, siehe fenster.ts)
 * ohne Taskleiste, Dock und Menüleiste. `alternativ` ist die zweite Lage der
 * Leiste aus dem Aussehen (»ausrichtung«): Windows links statt mittig — die
 * Fläche bleibt —, Ubuntu Dock unten statt links, macOS Dock links statt unten.
 */
export const OBERE_LEISTE: Record<Betriebssystem, number> = { windows: 0, ubuntu: 28, macos: 25 };
export const DOCK_BREITE = 60;

export function arbeitsflaeche(system: Betriebssystem, alternativ = false): { x: number; y: number; w: number; h: number } {
  const W = 900, H = 506;
  if (system === "windows") return { x: 0, y: 0, w: W, h: H - 48 };
  const oben = OBERE_LEISTE[system];
  const seitlich = system === "ubuntu" ? !alternativ : alternativ;
  return seitlich
    ? { x: DOCK_BREITE, y: oben, w: W - DOCK_BREITE, h: H - oben }
    : { x: 0, y: oben, w: W, h: H - oben - DOCK_BREITE - 4 };
}
