/**
 * Teil 4 des Maus-Führerscheins: das Handy — Android oder iPhone (iOS).
 *
 * Daten und Prüfungen ohne Bildschirm: die nachgebauten Einstellungen beider
 * Systeme (als Baum aus Bildschirmen), die Aufgaben zur Privatsphäre, die
 * Berechtigungs-Dialoge, die Apps im Store und die Risiko-Szenarien.
 *
 * Blick des Kindes: Was kann ich selbst tun? Jede Antwort wird erklärt —
 * falsch heißt nicht »dumm«, sondern »so wird es gefährlich, und deshalb«.
 * Menünamen folgen Android 14/15 (Pixel) und iOS 18 auf Deutsch; Hersteller
 * wie Samsung benennen einzelne Punkte etwas anders.
 */

export type HandySystem = "android" | "ios";

export const HANDY_NAME: Record<HandySystem, string> = { android: "Android", ios: "iPhone (iOS)" };

// ── Einstellungen als Baum ──────────────────────────────────────────────────

export type Wert = boolean | string;
export type Werte = Record<string, Wert>;

export type Zeile =
  | { art: "link"; text: string; unter?: string; icon?: string; ziel?: string }
  | { art: "schalter"; text: string; unter?: string; id: string }
  | { art: "wahl"; text: string; id: string; optionen: string[] }
  | { art: "knopf"; text: string; id: string; danach: string };

export type Bildschirm = { titel: string; zeilen: Zeile[] };

/** Ohne Ziel: ein Menüpunkt, der zur Übung nichts beiträgt (zeigt nur einen Hinweis). */
const link = (text: string, ziel?: string, icon?: string, unter?: string): Zeile => ({ art: "link", text, ziel, icon, unter });

export const EINSTELLUNGEN: Record<HandySystem, Record<string, Bildschirm>> = {
  android: {
    start: {
      titel: "Einstellungen",
      zeilen: [
        link("Netzwerk & Internet", undefined, "📶", "WLAN, mobile Daten"),
        link("Verbundene Geräte", "verbunden", "🔗", "Bluetooth, Quick Share"),
        link("Apps", "apps", "🧩", "Zuletzt verwendete Apps, Standard-Apps"),
        link("Benachrichtigungen", "benachrichtigungen", "🔔", "Verlauf, Sperrbildschirm"),
        link("Akku", undefined, "🔋"),
        link("Töne & Vibration", undefined, "🔊"),
        link("Display", undefined, "☀️"),
        link("Sicherheit und Datenschutz", "sicherheit", "🔒", "Displaysperre, Berechtigungen"),
        link("Digital Wellbeing & Jugendschutz", undefined, "⏳", "Bildschirmzeit, Family Link"),
      ],
    },
    verbunden: {
      titel: "Verbundene Geräte",
      zeilen: [
        link("Neues Gerät koppeln", undefined, "➕"),
        { art: "wahl", text: "Quick Share – Wer darf dir etwas senden?", id: "teilen", optionen: ["Niemand", "Nur Kontakte", "Alle (10 Minuten)"] },
      ],
    },
    apps: {
      titel: "Apps",
      zeilen: [
        link("Blockwelt", "app-blockwelt", "🧱"),
        link("Chatty", "app-chatty", "💬"),
        link("Kamera", "app-kamera", "📷"),
        link("Wetter", undefined, "⛅"),
      ],
    },
    "app-blockwelt": { titel: "Blockwelt", zeilen: [link("Berechtigungen", "rechte-blockwelt", "🔐", "Mikrofon, Standort"), link("Speicher & Cache", undefined, "💾")] },
    "app-chatty": { titel: "Chatty", zeilen: [link("Berechtigungen", "rechte-chatty", "🔐", "Kamera, Mikrofon"), link("Benachrichtigungen", undefined, "🔔")] },
    "app-kamera": { titel: "Kamera", zeilen: [link("Berechtigungen", "rechte-kamera", "🔐", "Kamera, Standort"), link("Speicher & Cache", undefined, "💾")] },
    "rechte-blockwelt": {
      titel: "Berechtigungen – Blockwelt",
      zeilen: [
        { art: "wahl", text: "Mikrofon", id: "blockwelt-mikro", optionen: ["Bei Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"] },
        { art: "wahl", text: "Standort", id: "blockwelt-standort", optionen: ["Bei Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"] },
      ],
    },
    "rechte-chatty": {
      titel: "Berechtigungen – Chatty",
      zeilen: [
        { art: "wahl", text: "Kamera", id: "chatty-kamera", optionen: ["Bei Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"] },
        { art: "wahl", text: "Mikrofon", id: "chatty-mikro", optionen: ["Bei Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"] },
      ],
    },
    "rechte-kamera": {
      titel: "Berechtigungen – Kamera",
      zeilen: [
        { art: "wahl", text: "Kamera", id: "kamera-kamera", optionen: ["Bei Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"] },
        { art: "wahl", text: "Standort", id: "kamera-standort", optionen: ["Bei Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"] },
      ],
    },
    benachrichtigungen: {
      titel: "Benachrichtigungen",
      zeilen: [
        link("App-Benachrichtigungen", undefined, "📲"),
        { art: "schalter", text: "Vertrauliche Benachrichtigungen", unter: "Inhalte von Nachrichten auf dem Sperrbildschirm anzeigen", id: "sperr-inhalt" },
        { art: "schalter", text: "Benachrichtigungspunkt auf App-Symbol", id: "punkt" },
      ],
    },
    sicherheit: {
      titel: "Sicherheit und Datenschutz",
      zeilen: [
        { art: "wahl", text: "Displaysperre", id: "sperre", optionen: ["Keine", "Wischen", "Muster", "PIN", "Passwort"] },
        link("Datenschutz", "datenschutz", "🛡️", "Berechtigungen, Werbung"),
        link("Mein Gerät finden", undefined, "📍"),
      ],
    },
    datenschutz: {
      titel: "Datenschutz",
      zeilen: [
        link("Berechtigungsmanager", "manager", "🔐", "Welche App darf was?"),
        link("Werbung", "werbung", "📢"),
        { art: "schalter", text: "Zugriff auf Kamera", unter: "Für alle Apps", id: "kamera-global" },
        { art: "schalter", text: "Zugriff auf Mikrofon", unter: "Für alle Apps", id: "mikro-global" },
      ],
    },
    manager: {
      titel: "Berechtigungsmanager",
      zeilen: [link("Mikrofon", "manager-mikro", "🎙️"), link("Standort", "manager-standort", "📍"), link("Kamera", undefined, "📷")],
    },
    "manager-mikro": {
      titel: "Mikrofon",
      zeilen: [
        { art: "wahl", text: "Blockwelt", id: "blockwelt-mikro", optionen: ["Bei Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"] },
        { art: "wahl", text: "Chatty", id: "chatty-mikro", optionen: ["Bei Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"] },
      ],
    },
    "manager-standort": {
      titel: "Standort",
      zeilen: [
        { art: "wahl", text: "Blockwelt", id: "blockwelt-standort", optionen: ["Bei Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"] },
        { art: "wahl", text: "Kamera", id: "kamera-standort", optionen: ["Bei Nutzung der App zulassen", "Jedes Mal fragen", "Nicht zulassen"] },
      ],
    },
    werbung: {
      titel: "Werbung",
      zeilen: [
        { art: "knopf", text: "Werbe-ID löschen", id: "werbe-id", danach: "Werbe-ID gelöscht ✓" },
      ],
    },
  },
  ios: {
    start: {
      titel: "Einstellungen",
      zeilen: [
        link("WLAN", undefined, "📶"),
        link("Bluetooth", undefined, "🔵"),
        link("Mitteilungen", "mitteilungen", "🔔"),
        link("Bildschirmzeit", undefined, "⏳"),
        link("Allgemein", "allgemein", "⚙️"),
        link("Face ID & Code", "code", "🔒"),
        link("Datenschutz & Sicherheit", "datenschutz", "✋"),
        link("Apps", "apps", "🧩"),
      ],
    },
    mitteilungen: {
      titel: "Mitteilungen",
      zeilen: [
        { art: "wahl", text: "Vorschauen zeigen", id: "vorschau", optionen: ["Immer", "Wenn entsperrt", "Nie"] },
        link("Bildschirmfreigabe", undefined),
      ],
    },
    allgemein: {
      titel: "Allgemein",
      zeilen: [
        link("Info", undefined),
        link("Softwareupdate", undefined),
        { art: "wahl", text: "AirDrop", id: "teilen", optionen: ["Empfangen aus", "Nur für Kontakte", "Für alle für 10 Minuten"] },
        link("iPhone-Speicher", undefined),
      ],
    },
    code: {
      titel: "Face ID & Code",
      zeilen: [
        { art: "knopf", text: "Code aktivieren", id: "sperre", danach: "Code ist aktiviert ✓" },
        link("Code ändern", undefined),
      ],
    },
    datenschutz: {
      titel: "Datenschutz & Sicherheit",
      zeilen: [
        link("Ortungsdienste", "ortung", "📍"),
        link("Tracking", "tracking", "👣"),
        link("Mikrofon", "mikrofon", "🎙️"),
        link("Kamera", undefined, "📷"),
        link("Kontakte", undefined, "👥"),
      ],
    },
    ortung: {
      titel: "Ortungsdienste",
      zeilen: [
        { art: "wahl", text: "Blockwelt", id: "blockwelt-standort", optionen: ["Nie", "Nächstes Mal fragen", "Beim Verwenden der App"] },
        { art: "wahl", text: "Kamera", id: "kamera-standort", optionen: ["Nie", "Nächstes Mal fragen", "Beim Verwenden der App"] },
        { art: "wahl", text: "Wetter", id: "wetter-standort", optionen: ["Nie", "Nächstes Mal fragen", "Beim Verwenden der App"] },
      ],
    },
    tracking: {
      titel: "Tracking",
      zeilen: [
        { art: "schalter", text: "Apps erlauben, Tracking anzufordern", unter: "Apps dürfen fragen, ob sie dich über andere Apps und Websites hinweg verfolgen dürfen.", id: "tracking" },
      ],
    },
    mikrofon: {
      titel: "Mikrofon",
      zeilen: [
        { art: "schalter", text: "Blockwelt", id: "blockwelt-mikro" },
        { art: "schalter", text: "Chatty", id: "chatty-mikro" },
      ],
    },
    apps: {
      titel: "Apps",
      zeilen: [link("Blockwelt", "app-blockwelt", "🧱"), link("Chatty", "app-chatty", "💬"), link("Kamera", undefined, "📷")],
    },
    "app-blockwelt": {
      titel: "Blockwelt",
      zeilen: [
        { art: "schalter", text: "Mikrofon", id: "blockwelt-mikro" },
        { art: "wahl", text: "Standort", id: "blockwelt-standort", optionen: ["Nie", "Nächstes Mal fragen", "Beim Verwenden der App"] },
        { art: "schalter", text: "Mitteilungen", id: "blockwelt-mitteilungen" },
      ],
    },
    "app-chatty": {
      titel: "Chatty",
      zeilen: [
        { art: "schalter", text: "Kamera", id: "chatty-kamera" },
        { art: "schalter", text: "Mikrofon", id: "chatty-mikro" },
      ],
    },
  },
};

/** So stehen die Einstellungen am Anfang — etwas unsicher, damit es zu tun gibt. */
export const START_WERTE: Record<HandySystem, Werte> = {
  android: {
    teilen: "Alle (10 Minuten)", "blockwelt-mikro": "Bei Nutzung der App zulassen", "blockwelt-standort": "Bei Nutzung der App zulassen",
    "chatty-kamera": "Bei Nutzung der App zulassen", "chatty-mikro": "Bei Nutzung der App zulassen",
    "kamera-kamera": "Bei Nutzung der App zulassen", "kamera-standort": "Bei Nutzung der App zulassen",
    "sperr-inhalt": true, punkt: true, sperre: "Wischen", "werbe-id": false, "kamera-global": true, "mikro-global": true,
  },
  ios: {
    vorschau: "Immer", teilen: "Für alle für 10 Minuten", sperre: false,
    "blockwelt-standort": "Beim Verwenden der App", "kamera-standort": "Beim Verwenden der App", "wetter-standort": "Beim Verwenden der App",
    tracking: true, "blockwelt-mikro": true, "chatty-mikro": true, "chatty-kamera": true, "blockwelt-mitteilungen": true,
  },
};

/** Eine Aufgabe in den Einstellungen: was zu tun ist, wo es steht, wann es geschafft ist. */
export type EinstellAufgabe = {
  id: string;
  text: string;
  warum: string;
  /** Der Weg dorthin, z. B. »Einstellungen › Datenschutz & Sicherheit › Tracking«. */
  weg: string;
  /** Bildschirm-Ids von »start« bis zum Ziel — für die Vorführung. */
  pfad: string[];
  geschafft: (w: Werte) => boolean;
  /** Eine Wahl, die es schlechter macht — zählt als Fehlversuch, mit Erklärung. */
  schlecht?: (id: string, wert: Wert) => string | null;
};

export const PRIVAT_AUFGABEN: Record<HandySystem, EinstellAufgabe[]> = {
  android: [
    {
      id: "sperre",
      text: "Schütze dein Handy mit einer PIN.",
      warum: "Mit »Wischen« kann jeder dein Handy öffnen, der es in die Hand bekommt — auch deine Fotos und Chats.",
      weg: "Einstellungen › Sicherheit und Datenschutz › Displaysperre",
      pfad: ["start", "sicherheit"],
      geschafft: w => w.sperre === "PIN" || w.sperre === "Passwort" || w.sperre === "Muster",
      schlecht: (id, wert) => (id === "sperre" && (wert === "Keine" || wert === "Wischen") ? "Damit ist das Handy nicht geschützt — jeder kommt hinein." : null),
    },
    {
      id: "sperr-inhalt",
      text: "Verstecke den Inhalt von Nachrichten auf dem Sperrbildschirm.",
      warum: "Sonst kann jeder neben dir mitlesen, was dir geschrieben wird — auch wenn das Handy gesperrt ist.",
      weg: "Einstellungen › Benachrichtigungen › Vertrauliche Benachrichtigungen (aus)",
      pfad: ["start", "benachrichtigungen"],
      geschafft: w => w["sperr-inhalt"] === false,
    },
    {
      id: "foto-standort",
      text: "Die Kamera soll nicht mehr speichern, wo ein Foto gemacht wurde.",
      warum: "In jedem Foto kann sonst der Ort stehen — wer es bekommt, sieht vielleicht, wo du wohnst.",
      weg: "Einstellungen › Apps › Kamera › Berechtigungen › Standort › Nicht zulassen",
      pfad: ["start", "apps", "app-kamera", "rechte-kamera"],
      geschafft: w => w["kamera-standort"] === "Nicht zulassen",
    },
    {
      id: "teilen",
      text: "Fremde sollen dir über Quick Share nichts schicken können.",
      warum: "Mit »Alle« können dir Fremde in der Nähe Bilder schicken — auch gemeine oder unheimliche.",
      weg: "Einstellungen › Verbundene Geräte › Quick Share",
      pfad: ["start", "verbunden"],
      geschafft: w => w.teilen === "Niemand" || w.teilen === "Nur Kontakte",
      schlecht: (id, wert) => (id === "teilen" && wert === "Alle (10 Minuten)" ? "»Alle« heißt: auch Fremde in der Nähe." : null),
    },
    {
      id: "werbung",
      text: "Lösche deine Werbe-ID, damit Apps dich schwerer verfolgen können.",
      warum: "Über diese Nummer erkennen Werbefirmen dich in vielen Apps wieder und sammeln, was dich interessiert.",
      weg: "Einstellungen › Sicherheit und Datenschutz › Datenschutz › Werbung › Werbe-ID löschen",
      pfad: ["start", "sicherheit", "datenschutz", "werbung"],
      geschafft: w => w["werbe-id"] === true,
    },
  ],
  ios: [
    {
      id: "sperre",
      text: "Schütze dein iPhone mit einem Code.",
      warum: "Ohne Code kann jeder dein iPhone öffnen, der es in die Hand bekommt — auch deine Fotos und Chats.",
      weg: "Einstellungen › Face ID & Code › Code aktivieren",
      pfad: ["start", "code"],
      geschafft: w => w.sperre === true,
    },
    {
      id: "vorschau",
      text: "Nachrichten sollen auf dem Sperrbildschirm nur lesbar sein, wenn das iPhone entsperrt ist.",
      warum: "Sonst kann jeder neben dir mitlesen, was dir geschrieben wird — auch wenn das iPhone gesperrt ist.",
      weg: "Einstellungen › Mitteilungen › Vorschauen zeigen › Wenn entsperrt",
      pfad: ["start", "mitteilungen"],
      geschafft: w => w.vorschau === "Wenn entsperrt" || w.vorschau === "Nie",
    },
    {
      id: "foto-standort",
      text: "Die Kamera soll nicht mehr speichern, wo ein Foto gemacht wurde.",
      warum: "In jedem Foto kann sonst der Ort stehen — wer es bekommt, sieht vielleicht, wo du wohnst.",
      weg: "Einstellungen › Datenschutz & Sicherheit › Ortungsdienste › Kamera › Nie",
      pfad: ["start", "datenschutz", "ortung"],
      geschafft: w => w["kamera-standort"] === "Nie",
    },
    {
      id: "teilen",
      text: "Fremde sollen dir über AirDrop nichts schicken können.",
      warum: "Mit »Für alle« können dir Fremde in der Nähe Bilder schicken — auch gemeine oder unheimliche.",
      weg: "Einstellungen › Allgemein › AirDrop",
      pfad: ["start", "allgemein"],
      geschafft: w => w.teilen === "Empfangen aus" || w.teilen === "Nur für Kontakte",
      schlecht: (id, wert) => (id === "teilen" && wert === "Für alle für 10 Minuten" ? "»Für alle« heißt: auch Fremde in der Nähe." : null),
    },
    {
      id: "tracking",
      text: "Apps sollen gar nicht erst fragen dürfen, ob sie dich verfolgen.",
      warum: "»Tracking« heißt: Apps verfolgen, was du in anderen Apps und im Internet tust — für Werbung.",
      weg: "Einstellungen › Datenschutz & Sicherheit › Tracking (aus)",
      pfad: ["start", "datenschutz", "tracking"],
      geschafft: w => w.tracking === false,
    },
  ],
};

/** Die letzte Aufgabe der Berechtigungs-Stufe: ein Recht nachträglich wegnehmen. */
export const RECHT_ENTZIEHEN: Record<HandySystem, EinstellAufgabe> = {
  android: {
    id: "entziehen",
    text: "Das Spiel »Blockwelt« darf noch dein Mikrofon benutzen. Nimm ihm das in den Einstellungen weg.",
    warum: "Ein Spiel braucht kein Mikrofon. Was du einmal erlaubt hast, kannst du jederzeit zurücknehmen.",
    weg: "Einstellungen › Apps › Blockwelt › Berechtigungen › Mikrofon › Nicht zulassen",
    pfad: ["start", "apps", "app-blockwelt", "rechte-blockwelt"],
    geschafft: w => w["blockwelt-mikro"] === "Nicht zulassen",
  },
  ios: {
    id: "entziehen",
    text: "Das Spiel »Blockwelt« darf noch dein Mikrofon benutzen. Nimm ihm das in den Einstellungen weg.",
    warum: "Ein Spiel braucht kein Mikrofon. Was du einmal erlaubt hast, kannst du jederzeit zurücknehmen.",
    weg: "Einstellungen › Apps › Blockwelt › Mikrofon (aus) — oder Datenschutz & Sicherheit › Mikrofon",
    pfad: ["start", "apps", "app-blockwelt"],
    geschafft: w => w["blockwelt-mikro"] === false,
  },
};

/** Neuer Wert nach einem Tipp auf eine Zeile. */
export function setze(w: Werte, id: string, wert: Wert): Werte {
  return { ...w, [id]: wert };
}

// ── Berechtigungs-Dialoge ───────────────────────────────────────────────────

export type Urteil = "gut" | "ok" | "nochmal" | "schlecht";
export type Antwort = { text: string; urteil: Urteil; erklaerung: string };

export type Anfrage = {
  id: string;
  app: string;
  icon: string;
  lage: string;
  /** Die Frage im Dialog, wie das System sie stellt. */
  frage: string;
  /** Standort: Schalter »Genauer Standort« im Dialog. */
  genau?: boolean;
  antworten: Antwort[];
};

const gut = (text: string, erklaerung: string): Antwort => ({ text, urteil: "gut", erklaerung });
const ok = (text: string, erklaerung: string): Antwort => ({ text, urteil: "ok", erklaerung });
const nochmal = (text: string, erklaerung: string): Antwort => ({ text, urteil: "nochmal", erklaerung });
const schlecht = (text: string, erklaerung: string): Antwort => ({ text, urteil: "schlecht", erklaerung });

export const ANFRAGEN: Record<HandySystem, Anfrage[]> = {
  android: [
    {
      id: "taschenlampe", app: "Super Taschenlampe", icon: "🔦", lage: "Du hast eine Taschenlampen-App installiert und öffnest sie.",
      frage: "»Super Taschenlampe« Zugriff auf deine Kontakte erlauben?",
      antworten: [
        schlecht("Zulassen", "Eine Taschenlampe braucht keine Kontakte! So eine App will oft nur Daten sammeln — die Namen und Nummern deiner Freunde."),
        gut("Nicht zulassen", "Richtig! Leuchten geht auch ohne Kontakte. Wenn eine App mehr will, als sie braucht: ablehnen."),
      ],
    },
    {
      id: "videoanruf", app: "Chatty", icon: "💬", lage: "Du willst deine Oma per Video anrufen.",
      frage: "»Chatty« erlauben, Bilder und Videos aufzunehmen?",
      antworten: [
        gut("Bei Nutzung der App", "Passt: Die Kamera ist nur an, während du Chatty benutzt — für den Videoanruf genau richtig."),
        gut("Nur dieses Mal", "Auch gut: Beim nächsten Mal fragt das Handy wieder."),
        nochmal("Nicht zulassen", "Dann sieht Oma dich nicht. Für einen Videoanruf braucht die App die Kamera — wähle etwas, das nur gilt, solange du die App benutzt."),
      ],
    },
    {
      id: "wetter", app: "Wetter", icon: "⛅", lage: "Die Wetter-App möchte wissen, wo du bist.", genau: true,
      frage: "»Wetter« Zugriff auf den Standort dieses Geräts erlauben?",
      antworten: [
        gut("Bei Nutzung der App", "Fürs Wetter reicht der ungefähre Standort — der Ort, nicht die Straße."),
        gut("Nur dieses Mal", "Gut — und fürs Wetter reicht der ungefähre Standort."),
        ok("Nicht zulassen", "Geht auch: Dann tippst du deine Stadt selbst ein."),
      ],
    },
    {
      id: "puzzle", app: "Puzzle Pop", icon: "🧩", lage: "Du startest ein Puzzle-Spiel.",
      frage: "»Puzzle Pop« erlauben, Audio aufzunehmen?",
      antworten: [
        schlecht("Bei Nutzung der App", "Wozu braucht ein Puzzle dein Mikrofon? Dann könnte es mithören, was du sagst."),
        schlecht("Nur dieses Mal", "Auch einmal ist zu viel: Ein Puzzle braucht kein Mikrofon."),
        gut("Nicht zulassen", "Genau! Das Spiel funktioniert auch so."),
      ],
    },
    {
      id: "collage", app: "Foto-Collage", icon: "🖼️", lage: "Du willst aus drei Urlaubsfotos eine Collage machen.",
      frage: "»Foto-Collage« Zugriff auf Fotos und Videos auf diesem Gerät erlauben?",
      antworten: [
        gut("Fotos und Videos auswählen", "Super: Die App sieht nur die drei Fotos, die du aussuchst."),
        ok("Alle zulassen", "Klappt — aber dann sieht die App ALLE deine Fotos. »Auswählen« ist sicherer."),
        nochmal("Nicht zulassen", "Ohne Fotos keine Collage. Gib der App nur die Bilder, die sie braucht."),
      ],
    },
    {
      id: "spielernaehe", app: "Blockwelt", icon: "🧱", lage: "Das Spiel möchte dir »Spieler in deiner Nähe« zeigen.", genau: true,
      frage: "»Blockwelt« Zugriff auf den Standort dieses Geräts erlauben?",
      antworten: [
        schlecht("Bei Nutzung der App", "Dann sehen fremde Mitspieler vielleicht, wo du bist. Dein Standort geht Fremde nichts an."),
        schlecht("Nur dieses Mal", "Auch einmal reicht, damit Fremde sehen, wo du gerade bist."),
        gut("Nicht zulassen", "Richtig! Spielen geht auch ohne Standort — und Fremde erfahren nicht, wo du wohnst."),
      ],
    },
    {
      id: "mitteilungen", app: "Chatty", icon: "💬", lage: "Chatty möchte dir Bescheid geben, wenn eine Nachricht kommt.",
      frage: "»Chatty« erlauben, dir Benachrichtigungen zu senden?",
      antworten: [
        ok("Zulassen", "Kann man machen. Im Teil »Privatsphäre« lernst du, wie Nachrichten auf dem Sperrbildschirm unlesbar bleiben."),
        ok("Nicht zulassen", "Auch in Ordnung — dann schaust du selbst nach, wenn du Zeit hast. Weniger Gepiepe!"),
      ],
    },
  ],
  ios: [
    {
      id: "taschenlampe", app: "Super Taschenlampe", icon: "🔦", lage: "Du hast eine Taschenlampen-App geladen und öffnest sie.",
      frage: "»Super Taschenlampe« möchte auf deine Kontakte zugreifen.",
      antworten: [
        schlecht("Vollen Zugriff erlauben", "Eine Taschenlampe braucht keine Kontakte! So eine App will oft nur Daten sammeln — die Namen und Nummern deiner Freunde."),
        schlecht("Kontakte auswählen …", "Auch ausgewählte Kontakte braucht eine Taschenlampe nicht."),
        gut("Nicht erlauben", "Richtig! Leuchten geht auch ohne Kontakte. Wenn eine App mehr will, als sie braucht: ablehnen."),
      ],
    },
    {
      id: "videoanruf", app: "Chatty", icon: "💬", lage: "Du willst deine Oma per Video anrufen.",
      frage: "»Chatty« möchte auf die Kamera zugreifen.",
      antworten: [
        nochmal("Nicht erlauben", "Dann sieht Oma dich nicht. Für einen Videoanruf braucht die App die Kamera."),
        gut("Erlauben", "Passt: Für den Videoanruf braucht Chatty die Kamera. Du kannst das später in den Einstellungen wieder ausschalten."),
      ],
    },
    {
      id: "wetter", app: "Wetter", icon: "⛅", lage: "Die Wetter-App möchte wissen, wo du bist.", genau: true,
      frage: "»Wetter« erlauben, deinen Standort zu verwenden?",
      antworten: [
        gut("Einmal erlauben", "Gut — und fürs Wetter reicht der ungefähre Standort."),
        gut("Beim Verwenden der App erlauben", "Fürs Wetter reicht der ungefähre Standort — der Ort, nicht die Straße."),
        ok("Nicht erlauben", "Geht auch: Dann tippst du deine Stadt selbst ein."),
      ],
    },
    {
      id: "puzzle", app: "Puzzle Pop", icon: "🧩", lage: "Du startest ein Puzzle-Spiel.",
      frage: "»Puzzle Pop« möchte auf das Mikrofon zugreifen.",
      antworten: [
        gut("Nicht erlauben", "Genau! Das Spiel funktioniert auch so."),
        schlecht("Erlauben", "Wozu braucht ein Puzzle dein Mikrofon? Dann könnte es mithören, was du sagst."),
      ],
    },
    {
      id: "collage", app: "Foto-Collage", icon: "🖼️", lage: "Du willst aus drei Urlaubsfotos eine Collage machen.",
      frage: "»Foto-Collage« möchte auf deine Fotos zugreifen.",
      antworten: [
        gut("Eingeschränkten Zugriff erlauben", "Super: Die App sieht nur die drei Fotos, die du aussuchst."),
        ok("Vollen Zugriff erlauben", "Klappt — aber dann sieht die App ALLE deine Fotos. »Eingeschränkt« ist sicherer."),
        nochmal("Nicht erlauben", "Ohne Fotos keine Collage. Gib der App nur die Bilder, die sie braucht."),
      ],
    },
    {
      id: "tracking", app: "Blockwelt", icon: "🧱", lage: "Das Spiel startet zum ersten Mal.",
      frage: "Erlauben, dass »Blockwelt« deine Aktivitäten in Apps und auf Websites anderer Unternehmen verfolgt?",
      antworten: [
        gut("App bitten, kein Tracking durchzuführen", "Richtig! Sonst sammelt das Spiel, was du anderswo tust — für Werbung, die genau auf dich zielt."),
        schlecht("Erlauben", "Dann darf das Spiel verfolgen, was du in anderen Apps und im Internet machst. Das braucht es nicht."),
      ],
    },
    {
      id: "mitteilungen", app: "Chatty", icon: "💬", lage: "Chatty möchte dir Bescheid geben, wenn eine Nachricht kommt.",
      frage: "»Chatty« möchte dir Mitteilungen senden.",
      antworten: [
        ok("Nicht erlauben", "Auch in Ordnung — dann schaust du selbst nach, wenn du Zeit hast. Weniger Gepiepe!"),
        ok("Erlauben", "Kann man machen. Im Teil »Privatsphäre« lernst du, wie Nachrichten auf dem Sperrbildschirm unlesbar bleiben."),
      ],
    },
  ],
};

/**
 * Standort-Dialoge haben einen Schalter »Genau«. Wer ihn anlässt und erlaubt,
 * bekommt einen Hinweis statt »gut« — gelöst ist es trotzdem (»ok«).
 */
export function urteilFuer(anfrage: Anfrage, antwort: Antwort, genau: boolean): { urteil: Urteil; erklaerung: string } {
  if (anfrage.genau && genau && antwort.urteil === "gut") {
    return { urteil: "ok", erklaerung: `${antwort.erklaerung} Tipp: Schalte »Genau« aus — dann kennt die App nur die Gegend.` };
  }
  return { urteil: antwort.urteil, erklaerung: antwort.erklaerung };
}

/** Geht es danach weiter? »nochmal« zählt nicht als Fehler, hält aber an. */
export function geloest(urteil: Urteil): boolean {
  return urteil === "gut" || urteil === "ok";
}

// ── App-Store ───────────────────────────────────────────────────────────────

export type StoreApp = {
  id: string;
  name: string;
  icon: string;
  farbe: string;
  entwickler: string;
  sterne: number;
  bewertungen: string;
  downloads: string;
  /** Android: USK-Freigabe; iOS: Altersstufe */
  usk: string;
  ios: string;
  werbung: boolean;
  kaeufe: boolean;
  daten: string[];
  /** Warum gerade diese App passt — oder nicht. */
  urteil: { passt: boolean; gruende: string[] };
};

export const STORE_SUCHE = "malen";

export const STORE_APPS: StoreApp[] = [
  {
    id: "zombie", name: "Zombie Paint Shooter", icon: "🧟", farbe: "#4b5563", entwickler: "Dark Games Ltd.",
    sterne: 4.3, bewertungen: "58.000", downloads: "5 Mio.+", usk: "USK ab 18", ios: "18+", werbung: true, kaeufe: true,
    daten: ["Standort", "Geräte-ID", "Käufe"],
    urteil: { passt: false, gruende: ["Erst ab 18 Jahren — nichts für dich.", "Mit Werbung und In-App-Käufen."] },
  },
  {
    id: "fake", name: "MaIblock Kids PRO", icon: "🎨", farbe: "#e11d48", entwickler: "free apps 2024",
    sterne: 4.9, bewertungen: "37", downloads: "1.000+", usk: "USK ab 0", ios: "4+", werbung: true, kaeufe: true,
    daten: ["Kontakte", "Standort", "Fotos", "Geräte-ID"],
    urteil: {
      passt: false,
      gruende: [
        "Der Name ist abgeschaut: »MaIblock« mit großem I statt l.",
        "Unbekannter Entwickler, kaum Bewertungen — aber fast perfekte Sterne. Das ist verdächtig.",
        "Will Kontakte, Standort und Fotos — für eine Mal-App viel zu viel.",
      ],
    },
  },
  {
    id: "malblock", name: "Malblock Kids", icon: "🖌️", farbe: "#2563eb", entwickler: "Kreativ Studio GmbH",
    sterne: 4.6, bewertungen: "12.400", downloads: "1 Mio.+", usk: "USK ab 0", ios: "4+", werbung: false, kaeufe: false,
    daten: ["Keine Daten werden an Dritte weitergegeben"],
    urteil: {
      passt: true,
      gruende: ["Bekannter Entwickler und viele Bewertungen.", "Freigegeben ab 0 bzw. 4+, ohne Werbung und ohne In-App-Käufe.", "Sammelt kaum Daten."],
    },
  },
];

export const STORE_NAME: Record<HandySystem, string> = { android: "Play Store", ios: "App Store" };

export function storeTreffer(suche: string): StoreApp[] {
  const s = suche.trim().toLowerCase();
  if (s.length < 3) return [];
  return "malen malblock zeichnen paint kunst bild".includes(s) || s.includes("mal") ? STORE_APPS : [];
}

// ── Risiken erkennen ────────────────────────────────────────────────────────

export type Szenario = {
  id: string;
  app: string;
  icon: string;
  absender: string;
  nachricht: string;
  frage: string;
  optionen: { text: string; gut: boolean; erklaerung: string }[];
  /** Fachwort zum Nachlesen */
  stichwort: string;
};

export const SZENARIEN: Szenario[] = [
  {
    id: "fremder", app: "Spiele-Chat", icon: "🎮", absender: "Luna_2011 (unbekannt)",
    nachricht: "Hey, du spielst echt gut! 😊 Wie alt bist du? Schick mir ein Foto von dir, dann schenk ich dir 500 Coins!",
    frage: "Was machst du?",
    stichwort: "Cybergrooming",
    optionen: [
      { text: "Ein Foto schicken — 500 Coins sind super!", gut: false, erklaerung: "Fremde, die Geschenke gegen Fotos anbieten, wollen oft etwas Schlimmes. Hinter »Luna_2011« kann ein Erwachsener stecken." },
      { text: "Nur mein Alter verraten, das ist ja harmlos.", gut: false, erklaerung: "Alter, Schule, Wohnort — all das hilft Fremden, dich kennenzulernen und zu manipulieren. Auch »kleine« Infos nicht verraten." },
      { text: "Nicht antworten, blockieren, melden — und einem Erwachsenen davon erzählen.", gut: true, erklaerung: "Genau! Du hast nichts falsch gemacht. Blockieren schützt dich, Melden schützt andere, und Erwachsene können helfen." },
    ],
  },
  {
    id: "kettenbrief", app: "Klassenchat", icon: "💬", absender: "Ben",
    nachricht: "⚠️ Schick das an 10 Leute, sonst kommt heute Nacht die Horror-Puppe zu dir!!! Ist echt passiert!!!",
    frage: "Was machst du?",
    stichwort: "Kettenbrief",
    optionen: [
      { text: "Schnell an 10 Leute weiterschicken, sicher ist sicher.", gut: false, erklaerung: "Kettenbriefe sind erfunden — es passiert nichts. Wer weiterschickt, macht nur anderen Angst." },
      { text: "Nicht weiterschicken und löschen. Wenn ich Angst habe, erzähle ich es jemandem.", gut: true, erklaerung: "Richtig! Kettenbriefe sind ausgedacht. Und Angst ist okay — reden hilft." },
      { text: "Ben eine wütende Nachricht schreiben.", gut: false, erklaerung: "Ben hat sich vermutlich selbst erschreckt. Sag ihm lieber ruhig, dass Kettenbriefe Quatsch sind." },
    ],
  },
  {
    id: "paket", app: "SMS", icon: "✉️", absender: "+49 1577 0000000",
    nachricht: "Ihr Paket konnte nicht zugestellt werden. Bestätigen Sie Ihre Adresse: http://pakt-zustellung.xyz",
    frage: "Was machst du?",
    stichwort: "Smishing (Betrug per SMS)",
    optionen: [
      { text: "Auf den Link tippen und nachsehen, was es ist.", gut: false, erklaerung: "Solche Links führen auf Betrugsseiten oder laden Schadprogramme. Die Adresse sieht nur fast echt aus." },
      { text: "Nicht tippen, die SMS löschen und meinen Eltern zeigen.", gut: true, erklaerung: "Genau! Paketdienste schicken keine solchen Links. Im Zweifel fragt ihr direkt beim Paketdienst nach." },
      { text: "Zurückschreiben und fragen, welches Paket.", gut: false, erklaerung: "Dann wissen die Betrüger, dass deine Nummer echt ist — und schicken mehr." },
    ],
  },
  {
    id: "gewinn", app: "Browser", icon: "🎁", absender: "Pop-up",
    nachricht: "🎉 GLÜCKWUNSCH! Du bist der 1.000.000. Besucher und hast ein Handy gewonnen! Gib jetzt Name, Adresse und Handynummer ein!",
    frage: "Was machst du?",
    stichwort: "Fake-Gewinnspiel",
    optionen: [
      { text: "Schnell alles eintragen, bevor jemand anderes gewinnt.", gut: false, erklaerung: "Es gibt keinen Gewinn. Deine Daten werden verkauft oder für Abo-Fallen benutzt." },
      { text: "Das Fenster schließen und nichts eintragen.", gut: true, erklaerung: "Richtig! Echte Gewinne musst du nicht »schnell« abholen. Persönliche Daten gibst du nie in solche Fenster ein." },
      { text: "Nur den Vornamen eintragen.", gut: false, erklaerung: "Auch ein bisschen ist schon zu viel. Schließ das Fenster einfach." },
    ],
  },
  {
    id: "lootbox", app: "Blockwelt", icon: "💎", absender: "Angebot im Spiel",
    nachricht: "NUR HEUTE! 🔥 Mega-Glücksbox mit Chance auf das goldene Schwert — nur 4,99 €!",
    frage: "Was machst du?",
    stichwort: "In-App-Kauf / Lootbox",
    optionen: [
      { text: "Kaufen — vielleicht ist das Schwert drin!", gut: false, erklaerung: "Glücksboxen funktionieren wie ein Glücksspiel: meist ist nicht drin, was du willst. Und es kostet echtes Geld." },
      { text: "Nicht kaufen. Wenn ich etwas kaufen will, frage ich vorher meine Eltern.", gut: true, erklaerung: "Genau! »Nur heute« soll dich nur hetzen. Eltern können Käufe so einstellen, dass immer erst gefragt wird." },
      { text: "Mit Papas Handy kaufen, da ist die Karte schon drin.", gut: false, erklaerung: "Das ist Geld deiner Eltern — ohne zu fragen geht das nicht. Und es kann sehr teuer werden." },
    ],
  },
  {
    id: "mobbing", app: "Klassenchat", icon: "😢", absender: "Gruppe »7b Chillen«",
    nachricht: "Jonas: Guckt mal, wie peinlich Mia beim Sport aussieht 😂😂 [Foto] — Lea: 😂 — Tom: 😂😂",
    frage: "Was machst du?",
    stichwort: "Cybermobbing",
    optionen: [
      { text: "Mitlachen, sonst bin ich der Nächste.", gut: false, erklaerung: "Jedes Lachen macht es für Mia schlimmer. Mitmachen ist auch Mobbing." },
      { text: "Das Foto an Freunde weiterschicken.", gut: false, erklaerung: "Weiterschicken verbreitet das Foto noch mehr — und Fotos von anderen ohne Erlaubnis zu verbreiten ist sogar verboten (Recht am eigenen Bild)." },
      { text: "Nicht mitlachen, einen Screenshot als Beweis machen und es einer Lehrkraft oder meinen Eltern zeigen.", gut: true, erklaerung: "Richtig! Der Screenshot hilft Erwachsenen, etwas zu tun. Du kannst auch Mia schreiben, dass du zu ihr hältst." },
    ],
  },
  {
    id: "passwort", app: "Nachricht", icon: "🔑", absender: "Max (bester Freund)",
    nachricht: "Gib mir mal kurz dein Passwort für Blockwelt, ich will nur was ausprobieren. Ich verrat es keinem, versprochen!",
    frage: "Was machst du?",
    stichwort: "Passwörter",
    optionen: [
      { text: "Klar, Max ist mein bester Freund.", gut: false, erklaerung: "Auch beste Freunde streiten mal. Mit deinem Passwort kann jemand in deinem Namen schreiben oder dein Konto löschen." },
      { text: "Nein — mein Passwort bleibt geheim. Nur meine Eltern dürfen es kennen.", gut: true, erklaerung: "Genau! Passwörter sind wie eine Zahnbürste: nur für dich (und für deine Eltern zur Sicherheit)." },
    ],
  },
  {
    id: "erpressung", app: "Nachricht", icon: "😨", absender: "unbekannt",
    nachricht: "Ich habe ein Foto von dir. Wenn du mir nicht 20 € in Guthabenkarten schickst, zeige ich es deiner ganzen Schule.",
    frage: "Was machst du?",
    stichwort: "Erpressung",
    optionen: [
      { text: "Schnell bezahlen, damit es keiner sieht.", gut: false, erklaerung: "Wer einmal zahlt, wird meistens weiter erpresst. Bezahlen hilft nicht." },
      { text: "Nicht antworten, nichts bezahlen, Screenshot machen und sofort einem Erwachsenen Bescheid sagen.", gut: true, erklaerung: "Richtig — und du bist nicht schuld! Erwachsene und die Polizei können helfen. Reden kannst du auch mit der Nummer gegen Kummer: 116 111 — kostenlos und anonym." },
      { text: "Niemandem davon erzählen, weil es so peinlich ist.", gut: false, erklaerung: "Genau damit rechnen Erpresser. Es ist nicht peinlich, Hilfe zu holen — es ist mutig." },
    ],
  },
  {
    id: "profil", app: "Video-App", icon: "📹", absender: "Dein Profil",
    nachricht: "Du willst ein Tanzvideo hochladen. Dein Profil ist öffentlich, im Video sieht man dein Schul-T-Shirt und das Straßenschild vor deinem Haus.",
    frage: "Was machst du?",
    stichwort: "Privatsphäre im Profil",
    optionen: [
      { text: "Hochladen — je mehr Leute es sehen, desto besser.", gut: false, erklaerung: "Öffentlich heißt: ALLE können es sehen, auch Fremde. Schule und Straße verraten, wo man dich findet." },
      { text: "Profil auf privat stellen und ein Video ohne Schule und Straßenschild drehen.", gut: true, erklaerung: "Super! Dann sehen es nur Leute, die du kennst — und niemand erfährt, wo du wohnst oder zur Schule gehst." },
      { text: "Hochladen und später wieder löschen.", gut: false, erklaerung: "Was einmal im Internet war, kann jemand längst gespeichert haben. Erst überlegen, dann posten." },
    ],
  },
  {
    id: "nachts", app: "Klassenchat", icon: "🌙", absender: "99+ neue Nachrichten",
    nachricht: "Es ist 23 Uhr. Dein Handy piept ständig, weil im Klassenchat noch alle schreiben. Morgen ist Schule.",
    frage: "Was machst du?",
    stichwort: "Bildschirmzeit",
    optionen: [
      { text: "Wach bleiben und alles lesen, sonst verpasse ich was.", gut: false, erklaerung: "Schlaf ist wichtig für Kopf und Laune. Was nachts im Chat steht, kannst du morgen in einer Minute nachlesen." },
      { text: "»Nicht stören« einschalten und das Handy außerhalb vom Bett ablegen.", gut: true, erklaerung: "Genau! Bei »Nicht stören« (bzw. Fokus) piept nichts mehr. Viele legen das Handy nachts in die Küche." },
    ],
  },
];

/** Wo Kinder und Jugendliche Hilfe bekommen — ohne Werbung, ohne Anmeldung. */
export const HILFE: { name: string; text: string }[] = [
  { name: "Eltern, Lehrkräfte, Vertrauenslehrkraft", text: "Die erste Adresse — sie können mit dir zusammen etwas tun." },
  { name: "Nummer gegen Kummer: 116 111", text: "Kostenlos und anonym, montags bis samstags 14–20 Uhr." },
  { name: "juuuport.de", text: "Jugendliche beraten Jugendliche bei Problemen im Netz." },
  { name: "Melden-Knopf in der App", text: "Fast jede App hat ihn — so werden gemeine Konten gesperrt." },
];

// ── Handy bedienen ──────────────────────────────────────────────────────────

export type BedienAufgabe = { id: string; kurz: string; text: Record<HandySystem, string>; tipp: Record<HandySystem, string> };

export const BEDIEN_AUFGABEN: BedienAufgabe[] = [
  {
    id: "schnell", kurz: "Schnelleinstellungen öffnen",
    text: {
      android: "Öffne die Schnelleinstellungen: wisch vom oberen Rand nach unten.",
      ios: "Öffne das Kontrollzentrum: wisch von der rechten oberen Ecke nach unten.",
    },
    tipp: {
      android: "Mit der Maus: oben auf dem Bildschirm drücken, festhalten und nach unten ziehen.",
      ios: "Mit der Maus: oben rechts (bei Akku und WLAN) drücken, festhalten und nach unten ziehen.",
    },
  },
  {
    id: "nichtstoeren", kurz: "»Nicht stören« einschalten",
    text: { android: "Schalte »Nicht stören« ein — dann piept das Handy nicht mehr.", ios: "Schalte den Fokus »Nicht stören« ein — dann piept das iPhone nicht mehr." },
    tipp: { android: "Tippe auf die Kachel mit dem Mond-Symbol ⛔.", ios: "Tippe auf »Fokus« mit dem Mond 🌙." },
  },
  {
    id: "bluetooth", kurz: "Bluetooth ausschalten",
    text: { android: "Schalte Bluetooth aus — wenn du es nicht brauchst, spart das Akku.", ios: "Schalte Bluetooth aus — wenn du es nicht brauchst, spart das Akku." },
    tipp: { android: "Tippe auf die Kachel »Bluetooth«.", ios: "Tippe auf das blaue Bluetooth-Symbol." },
  },
  {
    id: "home", kurz: "Zurück zum Startbildschirm",
    text: { android: "Geh zurück zum Startbildschirm: wisch vom unteren Rand nach oben.", ios: "Geh zurück zum Home-Bildschirm: wisch vom unteren Rand nach oben." },
    tipp: { android: "Mit der Maus: unten am Strich drücken und nach oben ziehen.", ios: "Mit der Maus: unten am Strich drücken und nach oben ziehen." },
  },
  {
    id: "screenshot", kurz: "Bildschirmfoto machen",
    text: {
      android: "Mach ein Bildschirmfoto: drück die Ein/Aus-Taste und »Leiser« gleichzeitig.",
      ios: "Mach ein Bildschirmfoto: drück die Seitentaste und »Lauter« gleichzeitig.",
    },
    tipp: {
      android: "Mit der Maus geht »gleichzeitig« nicht — klick die beiden Tasten am Rand kurz nacheinander.",
      ios: "Mit der Maus geht »gleichzeitig« nicht — klick die beiden Tasten am Rand kurz nacheinander.",
    },
  },
  {
    id: "sperren", kurz: "Handy sperren",
    text: { android: "Sperre das Handy: drück kurz die Ein/Aus-Taste.", ios: "Sperre das iPhone: drück kurz die Seitentaste." },
    tipp: { android: "Die Ein/Aus-Taste ist rechts am Rand.", ios: "Die Seitentaste ist rechts am Rand." },
  },
];

/** Zwei Tasten »gleichzeitig«: mit der Maus reicht kurz nacheinander. */
export const GLEICHZEITIG_MS = 1500;

/** Ein Wisch: genug Weg in die richtige Richtung, Start in der richtigen Zone (Anteile 0–1 der Bildschirmhöhe/-breite). */
export function istWisch(
  start: { x: number; y: number }, ende: { x: number; y: number }, richtung: "runter" | "hoch",
  zone: { oben?: number; unten?: number; rechts?: number },
): boolean {
  const weg = ende.y - start.y;
  if (zone.oben !== undefined && start.y > zone.oben) return false;
  if (zone.unten !== undefined && start.y < 1 - zone.unten) return false;
  if (zone.rechts !== undefined && start.x < 1 - zone.rechts) return false;
  return richtung === "runter" ? weg >= 0.15 : weg <= -0.15;
}
