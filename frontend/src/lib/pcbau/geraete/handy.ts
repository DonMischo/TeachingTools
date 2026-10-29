import type { Geraet, Teil } from "../typen";

/**
 * Smartphone — nur zum Erkennen, dafür Schicht für Schicht zerlegbar:
 * 0 Rückseite zu · 1 Rückseite ab · 2 Bleche ab · 3 Akku raus.
 * Teile ohne `ab` erscheinen ab Schicht 1 (unter der Glasrückseite).
 */
const TEILE: Teil[] = [
  {
    id: "rahmen", name: "Rahmen", kategorie: "gehaeuse", fest: true, nichtAbfragen: true, ab: 0,
    kurz: "hält alles zusammen", info: "Ein Aluminiumrahmen; vorne ist das Display eingeklebt.",
    rect: { x: 250, y: 15, w: 300, h: 570 }, zeichnung: "handy-rahmen",
  },
  {
    id: "platine", name: "Hauptplatine", kategorie: "platine", fest: true,
    kurz: "verbindet alle Chips — auf kleinstem Raum",
    info: "Die Platine ist nur so groß wie ein Keks, oft sogar doppelstöckig. Zehn und mehr Lagen Leiterbahnen liegen übereinander.",
    rect: { x: 265, y: 35, w: 270, h: 190 }, zeichnung: "handy-platine",
  },
  {
    id: "unterplatine", name: "Unterplatine", kategorie: "platine", fest: true,
    kurz: "kleine zweite Platine mit Ladebuchse und Mikrofon",
    info: "Die Ladebuchse geht am häufigsten kaputt. Deshalb sitzt sie auf einer eigenen kleinen Platine, die sich günstig tauschen lässt. Ein Flexkabel verbindet sie mit der Hauptplatine.",
    rect: { x: 262, y: 486, w: 276, h: 92 }, zeichnung: "handy-unterplatine",
  },
  {
    id: "graphit", name: "Graphitfolie", kategorie: "kuehlung", fest: true, ab: 3,
    kurz: "verteilt die Wärme über die ganze Fläche",
    info: "Unter dem Akku liegt eine dünne Graphitfolie auf der Rückseite des Displays. Sie leitet die Wärme des Chips in die Fläche, damit es keine heißen Stellen gibt. Lüfter haben Handys nicht.",
    rect: { x: 278, y: 248, w: 244, h: 232 }, zeichnung: "handy-graphit",
  },
  {
    id: "hauptflex", name: "Hauptflexkabel", kategorie: "anschluss", fest: true, ab: 3,
    kurz: "verbindet Haupt- und Unterplatine",
    info: "Ein biegsames Flachkabel, unter dem Akku versteckt. Durch es laufen Ladestrom, USB-Daten und die Signale von Mikrofon und Lautsprecher.",
    rect: { x: 498, y: 250, w: 18, h: 236 }, zeichnung: "handy-hauptflex",
  },
  {
    id: "antenne", name: "Antennen", kategorie: "funk", fest: true,
    kurz: "senden und empfangen Funk: Mobilfunk, WLAN, GPS",
    info: "Teile des Metallrahmens sind selbst die Antennen. Die schmalen Kunststoff-Fugen im Rahmen trennen sie voneinander.",
    rect: { x: 252, y: 17, w: 296, h: 14 }, zeichnung: "handy-antenne", schema: { x: 720, y: 230 },
  },
  {
    id: "kamera", name: "Hauptkamera", kategorie: "sinne", fest: true,
    kurz: "macht Fotos und Videos — drei Objektive",
    info: "Weitwinkel, Ultraweitwinkel und Tele. Die Bildsensoren sind nur wenige Millimeter groß; viel Bildqualität kommt aus der Berechnung im SoC.",
    rect: { x: 272, y: 42, w: 70, h: 64 }, zeichnung: "handy-kamera", schema: { x: 160, y: 60 },
  },
  {
    id: "frontkamera", name: "Frontkamera", kategorie: "sinne", fest: true,
    kurz: "für Selfies und die Gesichtserkennung",
    info: "Eine winzige Kamera, die durch ein Loch im Display schaut.",
    rect: { x: 490, y: 44, w: 36, h: 30 }, zeichnung: "handy-frontkamera", schema: { x: 160, y: 150 },
  },
  {
    id: "modem", name: "Modem (Mobilfunk)", kategorie: "funk", fest: true,
    kurz: "telefoniert und surft über 4G und 5G",
    info: "Er übersetzt Daten in Funksignale und zurück. Manche Handys haben ihn im SoC eingebaut, hier ist er ein eigener Chip.",
    rect: { x: 280, y: 128, w: 56, h: 36 }, zeichnung: "chip", schema: { x: 560, y: 230 },
  },
  {
    id: "sim", name: "SIM-Schacht", kategorie: "funk", fest: true,
    kurz: "hier steckt die SIM-Karte",
    info: "Die SIM-Karte zeigt dem Netz, wer telefoniert. Viele neue Handys nutzen stattdessen eine eSIM, die fest eingebaut ist.",
    rect: { x: 512, y: 140, w: 22, h: 70 }, zeichnung: "handy-sim", schema: { x: 720, y: 130 },
  },
  // ── unter dem Abschirmblech (ab Schicht 2) ──
  {
    id: "wlan", name: "WLAN-/Bluetooth-Chip", kategorie: "funk", fest: true, ab: 2,
    kurz: "funkt ins WLAN und zu Kopfhörern",
    info: "Ein eigener Funkchip für WLAN und Bluetooth. Er teilt sich die Antennen im Rahmen mit dem Modem.",
    rect: { x: 356, y: 48, w: 50, h: 36 }, zeichnung: "chip", schema: { x: 720, y: 320 },
  },
  {
    id: "codec", name: "Audio-Chip", kategorie: "sinne", fest: true, ab: 2,
    kurz: "wandelt Töne in Zahlen und zurück",
    info: "Der Audio-Codec macht aus dem Mikrofonsignal Zahlen für den SoC — und aus Zahlen wieder eine Spannung für den Lautsprecher.",
    rect: { x: 414, y: 50, w: 58, h: 30 }, zeichnung: "chip", schema: { x: 300, y: 370 },
  },
  {
    id: "soc", name: "SoC mit Arbeitsspeicher", kategorie: "rechnen", fest: true, ab: 2,
    kurz: "rechnet alles aus — Prozessor, Grafik und KI-Einheit in einem Chip",
    info: "Acht Kerne, Grafik, Bildverarbeitung für die Kamera und eine KI-Einheit in einem Chip. Der Arbeitsspeicher (12 GB) ist direkt obendrauf gestapelt.",
    rect: { x: 356, y: 96, w: 74, h: 66 }, zeichnung: "handy-soc", schema: { x: 400, y: 230 },
  },
  {
    id: "flash", name: "Flash-Speicher (UFS)", kategorie: "speicher", fest: true, ab: 2,
    kurz: "speichert Apps, Fotos und Nachrichten dauerhaft",
    info: "256 GB auf einem Chip. Das ist das »Speicher voll«, wenn zu viele Fotos drauf sind — nicht der Arbeitsspeicher.",
    rect: { x: 436, y: 98, w: 40, h: 58 }, zeichnung: "chip", schema: { x: 560, y: 90 },
  },
  {
    id: "gyro", name: "Bewegungssensor", kategorie: "sinne", fest: true, ab: 2,
    kurz: "merkt, wie das Handy gedreht und bewegt wird",
    info: "Beschleunigungssensor und Kreisel in einem winzigen Chip. Er dreht das Bild ins Querformat, zählt Schritte und steuert Spiele.",
    rect: { x: 356, y: 172, w: 30, h: 26 }, zeichnung: "chip", schema: { x: 560, y: 320 },
  },
  {
    id: "nfc", name: "NFC-Chip", kategorie: "funk", fest: true, ab: 2,
    kurz: "zum Bezahlen an der Kasse und für Tickets",
    info: "Nahfeld-Funk über wenige Zentimeter. Die Antenne dafür ist eine Spule — oft dieselbe wie zum kabellosen Laden.",
    rect: { x: 394, y: 172, w: 34, h: 26 }, zeichnung: "chip", schema: { x: 720, y: 40 },
  },
  {
    id: "pmic", name: "Strom-Chip (PMIC)", kategorie: "strom", fest: true, ab: 2,
    kurz: "lädt den Akku und verteilt den Strom",
    info: "Er steuert das Laden, schützt den Akku vor Überladung und erzeugt die vielen kleinen Spannungen für alle Chips.",
    rect: { x: 436, y: 164, w: 40, h: 48 }, zeichnung: "chip", schema: { x: 560, y: 400 },
  },
  {
    id: "akkustecker", name: "Akku-Stecker", kategorie: "strom", fest: true, ab: 2,
    kurz: "verbindet Akku und Platine — beim Reparieren zuerst lösen",
    info: "Ein flacher Druckstecker. Wer ein Handy repariert, trennt ihn als Erstes, damit nichts einen Kurzschluss bekommt.",
    rect: { x: 470, y: 226, w: 46, h: 20 }, zeichnung: "handy-flex",
  },
  {
    id: "display", name: "Display-Anschluss", kategorie: "grafik", fest: true, ab: 2,
    kurz: "verbindet die Platine mit dem Bildschirm vorne",
    info: "Ein Flachkabel bringt das Bildsignal zum Display und die Berührungen vom Touchscreen zurück.",
    rect: { x: 286, y: 226, w: 70, h: 20 }, zeichnung: "handy-flex", schema: { x: 160, y: 260 },
  },
  // ── Deckel der Schicht 1 ──
  {
    id: "blech", name: "Abschirmblech", kategorie: "funk", fest: true, weg: 2,
    kurz: "schirmt die Chips gegen Funkstörungen ab",
    info: "Ein Blechdeckel über den empfindlichen Chips: Er hält die Funkwellen der Antennen von den Rechenchips fern — und umgekehrt. Er ist aufgelötet; bei einer Reparatur bleibt er drauf.",
    rect: { x: 348, y: 40, w: 134, h: 180 }, zeichnung: "handy-blech",
  },
  {
    id: "halteblech", name: "Halteblech", kategorie: "gehaeuse", fest: true, weg: 2,
    kurz: "hält die Stecker fest — erst abschrauben",
    info: "Ein verschraubtes Blech drückt Akku- und Display-Stecker fest auf die Platine, damit sie beim Herunterfallen nicht abspringen. Für die Reparatur: winzige Schrauben lösen.",
    rect: { x: 280, y: 221, w: 242, h: 26 }, zeichnung: "handy-halteblech",
  },
  {
    id: "vibration", name: "Vibrationsmotor", kategorie: "sinne", fest: true,
    kurz: "lässt das Handy summen und klopfen",
    info: "Ein Linearmotor: Ein kleines Gewicht wird von Magneten hin- und hergeschoben. So entstehen feine Klopfer beim Tippen.",
    rect: { x: 276, y: 494, w: 74, h: 36 }, zeichnung: "handy-vibration", schema: { x: 130, y: 460 },
  },
  {
    id: "lautsprecher", name: "Lautsprecher", kategorie: "sinne", fest: true,
    kurz: "für Klingelton, Musik und Freisprechen",
    info: "Eine winzige Membran in einer Kammer. Die Kammer sorgt dafür, dass er trotz der Größe Bass hat.",
    rect: { x: 400, y: 494, w: 124, h: 52 }, zeichnung: "handy-lautsprecher", schema: { x: 160, y: 360 },
  },
  {
    id: "mikrofon", name: "Mikrofon", kategorie: "sinne", fest: true,
    kurz: "nimmt deine Stimme auf",
    info: "Ein MEMS-Mikrofon, kleiner als ein Reiskorn. Meist sind mehrere eingebaut, um Störgeräusche herauszurechnen.",
    rect: { x: 336, y: 544, w: 22, h: 22 }, zeichnung: "chip", schema: { x: 300, y: 460 },
  },
  {
    id: "usbc", name: "USB-C-Buchse", kategorie: "anschluss", fest: true,
    kurz: "zum Laden und für Daten",
    info: "Seit 2024 in der EU Pflicht für neue Handys. Über die Buchse kommen Strom und Daten.",
    rect: { x: 365, y: 552, w: 70, h: 26 }, zeichnung: "handy-usbc", schema: { x: 450, y: 470 },
  },
  {
    id: "akku", name: "Akku", kategorie: "strom", fest: true, weg: 3,
    kurz: "speichert die Energie für einen Tag",
    info: "Ein Lithium-Ionen-Akku mit 5000 mAh — das größte Teil im Handy. Er ist eingeklebt (Zuglaschen helfen beim Lösen); beschädigt kann er brennen.",
    rect: { x: 278, y: 248, w: 244, h: 232 }, zeichnung: "handy-akku", schema: { x: 720, y: 400 },
  },
  {
    id: "ladespule", name: "Ladespule (kabellos)", kategorie: "strom", fest: true, weg: 3,
    kurz: "lädt den Akku ohne Kabel auf der Ladeschale",
    info: "Eine flache Kupferspule. Die Ladeschale erzeugt ein wechselndes Magnetfeld, das in der Spule einen Strom hervorruft (Induktion). Sie dient oft auch als NFC-Antenne.",
    rect: { x: 345, y: 362, w: 110, h: 110 }, zeichnung: "handy-spule", schema: { x: 720, y: 480 },
  },
  {
    id: "rueckglas", name: "Rückseite aus Glas", kategorie: "gehaeuse", fest: true, ab: 0, weg: 1,
    kurz: "schützt — und lässt Funk und kabelloses Laden durch",
    info: "Glas statt Metall, weil Funkwellen und das Magnetfeld der Ladeschale hindurchmüssen. Sie ist eingeklebt: Zum Öffnen wird sie erwärmt und mit einem Saugnapf abgehoben.",
    rect: { x: 250, y: 15, w: 300, h: 570 }, zeichnung: "handy-rueckglas",
  },
];

export const HANDY: Geraet = {
  id: "handy",
  name: "Smartphone",
  icon: "📱",
  untertitel: "Schicht für Schicht zerlegen",
  bauen: false,
  buehne: "#14121c",
  teile: TEILE.map(t => ({ ab: 1, ...t })),
  schichten: [
    { name: "Rückseite zu", text: "So kennst du dein Handy: Glas, Kamera-Insel, Rahmen mit Tasten. Von innen ist nichts zu sehen." },
    { name: "Rückseite ab", text: "Die Glasrückseite ist abgehebelt (vorher mit Wärme den Kleber lösen). Akku, Platine und Kamera sind zu sehen — die Chips verstecken sich unter Blech." },
    { name: "Bleche ab", text: "Halteblech abgeschraubt, Akku-Stecker gelöst — und für den Blick hinein das Abschirmblech abgelötet. Jetzt siehst du die Chips." },
    { name: "Akku raus", text: "Akku und Ladespule sind herausgelöst. Darunter: Graphitfolie für die Wärme und das Flexkabel zur Unterplatine." },
  ],
  kabel: [],
  verbindungen: [
    { von: "soc", nach: "kamera", name: "MIPI-CSI", art: "daten" },
    { von: "soc", nach: "frontkamera", name: "MIPI-CSI", art: "daten" },
    { von: "soc", nach: "display", name: "MIPI-DSI", art: "daten" },
    { von: "soc", nach: "codec", name: "Audio", art: "daten" },
    { von: "codec", nach: "lautsprecher", name: "Ton", art: "daten" },
    { von: "codec", nach: "mikrofon", name: "Ton", art: "daten" },
    { von: "soc", nach: "vibration", name: "Steuerung", art: "daten" },
    { von: "soc", nach: "flash", name: "UFS", art: "daten" },
    { von: "soc", nach: "modem", name: "PCIe", art: "daten" },
    { von: "soc", nach: "wlan", name: "PCIe", art: "daten" },
    { von: "soc", nach: "gyro", name: "I²C", art: "daten" },
    { von: "soc", nach: "nfc", name: "I²C", art: "daten" },
    { von: "modem", nach: "antenne", name: "Funk", art: "daten" },
    { von: "wlan", nach: "antenne", name: "Funk", art: "daten" },
    { von: "modem", nach: "sim", name: "SIM", art: "daten" },
    { von: "usbc", nach: "soc", name: "USB", art: "daten" },
    { von: "usbc", nach: "pmic", name: "Laden", art: "strom" },
    { von: "ladespule", nach: "pmic", name: "Laden", art: "strom" },
    { von: "akku", nach: "pmic", name: "3,9 V", art: "strom" },
    { von: "pmic", nach: "soc", name: "≈ 1 V", art: "strom" },
  ],
  pruefungen: [],
  start: { titel: "", text: "", bildschirm: [] },
  kennzahlen: { jahr: 2025, takt: 3200, kerne: 8, ram: 12288, speicher: 256_000, watt: 45, notiz: "Oberklasse-Smartphone (Ladegerät 45 W)" },
};
