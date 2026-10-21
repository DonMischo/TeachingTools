/**
 * TT - Teaching Tools — Pitch Presentation for Colleagues & Schulleitung
 * Screenshots come from ../screenshots/out (run screenshots/take-screenshots.js first).
 * Run: node create-pitch.js
 */

const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "TT - Teaching Tools — Pitch";
pres.author = "EGE";

const SHOTS = path.join(__dirname, "..", "screenshots", "out");

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY   = "1A3060";
const ORANGE = "E07820";
const WHITE  = "FFFFFF";
const CREAM  = "F4F0EA";
const LIGHT  = "EBF0F8";
const MUTED  = "6878A0";
const DARK   = "0F1D3E";
const TILE   = "1E3A7A";
const TILE_LINE = "2A4A8A";

const makeShadow = () => ({ type: "outer", color: "000000", blur: 10, offset: 3, angle: 45, opacity: 0.18 });

// ── Helpers ───────────────────────────────────────────────────────────────────
function shotPath(name) {
  const p = path.join(SHOTS, `${name}.png`);
  if (!fs.existsSync(p)) throw new Error(`Screenshot fehlt: ${p} — erst screenshots/take-screenshots.js laufen lassen`);
  return p;
}

// Desktop screenshot (16:9) with a thin frame and shadow; returns its height.
function screen(s, name, x, y, w, frame = "D5DCE8") {
  const h = w * 9 / 16;
  s.addShape(pres.shapes.RECTANGLE, { x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06, fill: { color: frame }, line: { color: frame }, shadow: makeShadow() });
  s.addImage({ path: shotPath(name), x, y, w, h });
  return h;
}

// Phone screenshot (390×844) in a dark rounded bezel; returns its width.
function phone(s, name, x, y, h) {
  const w = h * 390 / 844;
  const b = 0.07;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - b, y: y - b, w: w + 2 * b, h: h + 2 * b, fill: { color: "111827" }, line: { color: "111827" }, rectRadius: 0.18, shadow: makeShadow() });
  s.addImage({ path: shotPath(name), x, y, w, h });
  return w;
}

function caption(s, text, x, y, w, color = NAVY) {
  s.addText(text, { x, y, w, h: 0.28, fontSize: 10.5, bold: true, color, fontFace: "Calibri", align: "center", margin: 0 });
}

function card(s, x, y, w, h, fillColor = WHITE, radius = 0.12) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fillColor }, line: { color: fillColor }, rectRadius: radius, shadow: makeShadow() });
}

function sectionTag(s, text, x, y) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.8, h: 0.32, fill: { color: ORANGE }, line: { color: ORANGE }, rectRadius: 0.08 });
  s.addText(text, { x, y, w: 1.8, h: 0.32, fontSize: 9, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
}

function title(s, text, color = NAVY, size = 34) {
  s.addText(text, { x: 0.5, y: 0.78, w: 9, h: 0.65, fontSize: size, bold: true, color, fontFace: "Cambria", margin: 0 });
}

function bigStat(s, number, label, x, y, w = 2.1) {
  s.addText(number, { x, y, w, h: 0.75, fontSize: 40, bold: true, color: ORANGE, fontFace: "Cambria", align: "center", margin: 0 });
  s.addText(label,  { x, y: y + 0.72, w, h: 0.35, fontSize: 11, color: CREAM, fontFace: "Calibri", align: "center", margin: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  s.addShape(pres.shapes.OVAL, { x: 6.6, y: -1.2, w: 4.6, h: 4.6, fill: { color: NAVY, transparency: 20 }, line: { color: NAVY, transparency: 20 } });
  s.addShape(pres.shapes.OVAL, { x: -0.8, y: 4.2, w: 2.4, h: 2.4, fill: { color: ORANGE, transparency: 70 }, line: { color: ORANGE, transparency: 70 } });

  s.addImage({ path: path.join(__dirname, "EGE_logo_white.png"), x: 0.5, y: 0.4, w: 0.95, h: 0.9 });

  s.addText("TT", { x: 0.5, y: 1.55, w: 4.6, h: 1.1, fontSize: 72, bold: true, color: WHITE, fontFace: "Cambria", margin: 0 });
  s.addText("Teaching Tools", { x: 0.5, y: 2.6, w: 4.6, h: 0.6, fontSize: 30, bold: true, color: ORANGE, fontFace: "Cambria", margin: 0 });
  s.addText("Hauspokal, Lernspiele, Simulationen und Unterrichtswerkzeuge — eine Plattform auf unserem eigenen Schulserver.", {
    x: 0.5, y: 3.3, w: 4.4, h: 0.9, fontSize: 14, color: CREAM, fontFace: "Calibri", italic: true, margin: 0,
  });
  s.addText("Für Lehrkräfte · Für Schülerinnen und Schüler · Für die ganze Schule", {
    x: 0.5, y: 4.85, w: 5, h: 0.35, fontSize: 10, color: MUTED, fontFace: "Calibri", margin: 0,
  });

  screen(s, "13-simulationen", 5.25, 1.25, 4.4, TILE_LINE);
  phone(s, "104-bingo-live-student-playing", 8.55, 2.75, 2.45);

  s.addNotes("Begrüßung. TT – Teaching Tools ist aus dem Hauspokal entstanden: Aus dem Punktesystem für die Häuser ist eine Plattform für den ganzen Unterricht geworden.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Die Herausforderung
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "AUSGANGSLAGE", 0.55, 0.38);
  title(s, "Was uns beschäftigt");

  const challenges = [
    { icon: "😐", title: "Fehlende Motivation", body: "Schülerinnen und Schüler engagieren sich wenig über den Pflichtstoff hinaus. Motivation braucht Rahmen und Anreize." },
    { icon: "👥", title: "Wenig Wir-Gefühl",   body: "Klassen und Jahrgänge erleben sich kaum als Gemeinschaft. Zusammenhalt entsteht nicht von selbst." },
    { icon: "🧩", title: "Verstreute Werkzeuge", body: "Quiz, Abstimmung, Simulation, Timer: jedes Tool bei einem anderen Anbieter, mit eigenem Konto — oft außerhalb des EU-Datenschutzes." },
  ];
  challenges.forEach((c, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.7, 2.85, 3.2, LIGHT);
    s.addText(c.icon, { x, y: 1.95, w: 2.85, h: 0.7, fontSize: 36, align: "center", margin: 0 });
    s.addText(c.title, { x: x + 0.15, y: 2.77, w: 2.55, h: 0.5, fontSize: 14, bold: true, color: NAVY, fontFace: "Calibri", align: "center", margin: 0 });
    s.addText(c.body, { x: x + 0.2, y: 3.35, w: 2.45, h: 1.4, fontSize: 11, color: MUTED, fontFace: "Calibri", margin: 0 });
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 5.05, w: 9, h: 0.44, fill: { color: ORANGE }, line: { color: ORANGE }, rectRadius: 0.1 });
  s.addText("TT bündelt das alles — in einer Plattform, auf unserem eigenen Server.", {
    x: 0.5, y: 5.05, w: 9, h: 0.44, fontSize: 13, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle", margin: 0,
  });
  s.addNotes("Die bekannten Schmerzpunkte ansprechen. Kolleginnen und Kollegen kennen sie aus dem Alltag.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Was ist TT?
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  sectionTag(s, "DIE LÖSUNG", 0.55, 0.38);
  title(s, "Was ist TT?", WHITE);

  s.addText(
    "Eine schulinterne Webplattform: Klassen sammeln Punkte für ihr Haus, Lehrkräfte starten Lernspiele, " +
    "Simulationen und Werkzeuge mit einem Klick. Schülerinnen und Schüler machen per Code oder QR am eigenen Gerät mit — ohne App.",
    { x: 0.5, y: 1.5, w: 9, h: 0.8, fontSize: 13, color: CREAM, fontFace: "Calibri", margin: 0 }
  );

  bigStat(s, "28", "Simulationen",              0.4, 2.4);
  bigStat(s, "7",  "Aktivitäten mit Live-Modus", 2.7, 2.4);
  bigStat(s, "413", "Methoden im Kompendium",   5.0, 2.4);
  bigStat(s, "0",  "App-Downloads nötig",       7.3, 2.4);

  const areas = [
    ["🏆", "Hauspokal"], ["🎲", "Aktivitäten"], ["🔬", "Simulationen"],
    ["🧰", "Werkzeuge"], ["🏫", "Schulorganisation"], ["📱", "Mitmachen per Code"],
  ];
  areas.forEach(([icon, label], i) => {
    const x = 0.5 + i * 1.53;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.0, w: 1.4, h: 1.05, fill: { color: TILE }, line: { color: TILE_LINE }, rectRadius: 0.1 });
    s.addText(icon, { x, y: 4.08, w: 1.4, h: 0.5, fontSize: 22, align: "center", margin: 0 });
    s.addText(label, { x: x + 0.05, y: 4.6, w: 1.3, h: 0.35, fontSize: 10, bold: true, color: WHITE, fontFace: "Calibri", align: "center", margin: 0 });
  });
  s.addNotes("Überblick in Zahlen. Die sechs Bereiche schauen wir uns gleich mit echten Bildschirmfotos an.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Hauspokal
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "HAUSPOKAL", 0.55, 0.38);
  title(s, "Häuser schaffen Identität");

  s.addText("Jede Klasse gehört einem Haus an.", { x: 0.5, y: 1.6, w: 3.9, h: 0.4, fontSize: 14, bold: true, color: NAVY, fontFace: "Calibri", margin: 0 });
  s.addText("Lehrkräfte vergeben Punkte für Beteiligung, Verhalten und Wettbewerbe. Die Klassen sammeln für ihr Haus — über Jahrgänge hinweg.", {
    x: 0.5, y: 2.05, w: 3.9, h: 0.95, fontSize: 12, color: MUTED, fontFace: "Calibri", margin: 0,
  });
  [
    "⭐  Punkte in Sekunden vergeben, mit Leitfaden",
    "🎲  Lernspiele bringen automatisch Punkte",
    "📊  Live-Stand auf der Startseite und am Beamer",
    "🏅  Kurse, WPF und A/B-Gruppen zählen mit",
  ].forEach((p, i) => {
    s.addText(p, { x: 0.5, y: 3.15 + i * 0.45, w: 3.9, h: 0.38, fontSize: 12, color: NAVY, fontFace: "Calibri", margin: 0 });
  });

  screen(s, "20-haeuser", 4.7, 1.55, 4.9);
  s.addNotes("Das Hausprinzip ist der Ursprung von TT. Punkte aus Caputh, Bingo, TaskCrawler und Challenge fließen automatisch ein.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Mitmachen per Code (live)
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  sectionTag(s, "LIVE IM UNTERRICHT", 0.55, 0.38);
  title(s, "Code an die Tafel — alle spielen mit", WHITE, 30);

  screen(s, "105-bingo-live-host-called", 0.5, 1.9, 4.7, TILE_LINE);
  caption(s, "Lehrkraft: steuert am Beamer, sieht jeden Treffer", 0.5, 4.8, 4.7, CREAM);

  const ph = 2.7;
  let x = 5.6;
  [["01-play-hub-mobile", "1. Code eingeben"], ["102-bingo-live-student-waiting", "2. Name + Avatar"], ["106-bingo-live-student-called", "3. Mitspielen"]].forEach(([name, label]) => {
    const w = phone(s, name, x, 1.85, ph);
    caption(s, label, x - 0.1, 4.8, w + 0.2, CREAM);
    x += w + 0.25;
  });
  s.addNotes("Der Playhub findet zu jedem Code das richtige Spiel. Gäste ohne Konto kommen nur hinein, wenn die Lehrkraft das für diese Sitzung freischaltet — und der Zugang schließt sich von selbst wieder.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Aktivitäten
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "AKTIVITÄTEN", 0.55, 0.38);
  title(s, "Lernspiele für jedes Fach");
  s.addText("Caputh-Quiz, Bingo, TaskCrawler, Challenge, Kartenquiz, Lückentext, Zeitstrahl — einmal erstellt, immer wieder gestartet, mit Vorlagen für Kolleginnen und Kollegen.", {
    x: 0.5, y: 1.45, w: 9, h: 0.5, fontSize: 12, color: MUTED, fontFace: "Calibri", margin: 0,
  });

  const items = [
    ["31-caputh", "Caputh-Quiz"], ["32-taskcrawler", "TaskCrawler"],
    ["34-karten", "Kartenquiz"], ["36-zeitstrahl", "Zeitstrahl"],
  ];
  items.forEach(([name, label], i) => {
    const w = 4.2, x = 0.6 + (i % 2) * 4.6, y = 2.15 + Math.floor(i / 2) * 1.7;
    screen(s, name, x, y, 2.5);
    s.addText(label, { x: x + 2.65, y: y + 0.45, w: w - 2.65, h: 0.4, fontSize: 15, bold: true, color: NAVY, fontFace: "Cambria", margin: 0 });
  });
  s.addNotes("Live-Demo vorbereiten: ein Bingo oder Quiz starten und die Kolleginnen und Kollegen am Handy mitspielen lassen.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Simulationen (Naturwissenschaften & Mathe)
// ═══════════════════════════════════════════════════════════════════════════
function simGrid(s, sims) {
  sims.forEach(([name, label, fach], i) => {
    const w = 2.85, x = 0.5 + (i % 3) * 3.07, y = 1.55 + Math.floor(i / 3) * 1.98;
    const h = screen(s, name, x, y, w, TILE_LINE);
    s.addText([
      { text: label, options: { bold: true, color: WHITE } },
      { text: "  " + fach, options: { color: ORANGE } },
    ], { x, y: y + h + 0.06, w, h: 0.28, fontSize: 10.5, fontFace: "Calibri", margin: 0 });
  });
}
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  sectionTag(s, "SIMULATIONEN", 0.55, 0.38);
  title(s, "28 Simulationen zum Ausprobieren", WHITE, 30);
  simGrid(s, [
    ["50-sim-sonnensystem", "Sonnensystem", "Astronomie"],
    ["51-sim-erdaufbau",    "Aufbau der Erde", "Geografie"],
    ["62-sim-pse",          "Periodensystem", "Chemie"],
    ["66-sim-gleichungswaage", "Gleichungswaage", "Mathematik"],
    ["53-sim-kueste",       "Küstendynamik", "Geografie"],
    ["70-sim-dla",          "Fraktales Wachstum", "Physik"],
  ]);
  s.addNotes("Alle Simulationen laufen im Browser, auch 3D. Lehrkräfte können sie als Live-Sitzung starten — die Klasse arbeitet mit, Fortschritte sind sichtbar.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Simulationen (Gesellschaft & Informatik)
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  sectionTag(s, "SIMULATIONEN", 0.55, 0.38);
  title(s, "… von Wirtschaft bis Informatik", WHITE, 30);
  simGrid(s, [
    ["57-sim-leben",     "Rock your Life", "Wirtschaft & Recht"],
    ["56-sim-verkehr",   "Verkehrssimulation", "Verkehrserziehung"],
    ["55-sim-stadt",     "Stadtentwicklung", "Geografie"],
    ["59-sim-ki",        "KI-Werkstatt", "Informatik"],
    ["61-sim-schichten", "Schichtenmodell", "Informatik"],
    ["60-sim-algo",      "Algorithmen-Werkstatt", "Informatik"],
  ]);
  s.addNotes("Dazu kommen Grundlagen-Trainer wie Maus-Führerschein und 10-Finger-Tippen für die unteren Klassen.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Werkzeuge
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "WERKZEUGE", 0.55, 0.38);
  title(s, "Werkzeuge für jeden Moment der Stunde", NAVY, 30);

  const tools = [
    ["40-barometer",   "Umfrage & Barometer", "Live-Meinungsbild, anonym, mit Diagrammen"],
    ["41-exit-ticket", "Exit-Ticket",         "Schnelles Feedback am Stundenende"],
    ["24-classroom",   "Classroom Screen",    "Uhr, Timer, Stoppuhr, Ampel am Beamer"],
    ["45-kompendium",  "Methoden-Kompendium", "413 Unterrichtsmethoden, mit Quellen"],
  ];
  tools.forEach(([name, label, desc], i) => {
    const x = 0.6 + (i % 2) * 4.6, y = 1.6 + Math.floor(i / 2) * 1.85;
    screen(s, name, x, y, 2.6);
    s.addText(label, { x: x + 2.75, y: y + 0.3, w: 1.65, h: 0.55, fontSize: 13, bold: true, color: NAVY, fontFace: "Cambria", margin: 0 });
    s.addText(desc,  { x: x + 2.75, y: y + 0.85, w: 1.65, h: 0.6, fontSize: 10, color: MUTED, fontFace: "Calibri", margin: 0 });
  });
  s.addNotes("Diese Werkzeuge funktionieren unabhängig vom Hauspokal — auch wer nicht am Wettbewerb teilnimmt, kann sie nutzen. Dazu: Schreibraum, Fragmente-Pinnwände, Auktion, Wettkämpfe.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Schulorganisation
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  sectionTag(s, "SCHULORGANISATION", 0.55, 0.38);
  title(s, "Auch die Organisation läuft mit", WHITE, 30);

  [
    ["21-klassen",       "Klassenverwaltung"],
    ["22-kalender",      "Schulkalender"],
    ["23-stundenplaner", "Stundenplaner"],
    ["44-sportfest",     "Sportfest"],
  ].forEach(([name, label], i) => {
    const x = 0.6 + (i % 2) * 4.6, y = 1.55 + Math.floor(i / 2) * 1.98;
    const h = screen(s, name, x, y, 2.75, TILE_LINE);
    s.addText(label, { x: x + 2.9, y: y + h / 2 - 0.2, w: 1.7, h: 0.4, fontSize: 12, bold: true, color: WHITE, fontFace: "Cambria", margin: 0 });
  });
  s.addNotes("Klassenleitungen pflegen ihre Klassen selbst, der Kalender ersetzt Listen, das Sportfest wird komplett digital ausgewertet.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 11 — Einfach & Datenschutz
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "DATENSCHUTZ & UX", 0.55, 0.38);
  title(s, "Einfach. Sicher. Unserer.");

  s.addText("Einfach für alle", { x: 0.5, y: 1.6, w: 4.3, h: 0.44, fontSize: 16, bold: true, color: NAVY, fontFace: "Calibri", margin: 0 });
  [
    ["📱", "Mitmachen per Code oder QR — ohne App"],
    ["🖱", "Lehrkräfte brauchen nur einen Browser"],
    ["⚡", "Spiele starten in unter 30 Sekunden"],
    ["🎨", "Hell/Dunkel und Schulfarben einstellbar"],
    ["🌍", "Läuft auf Smartphone, Tablet und PC"],
  ].forEach(([icon, text], i) => {
    s.addShape(pres.shapes.OVAL, { x: 0.5, y: 2.17 + i * 0.54, w: 0.35, h: 0.35, fill: { color: ORANGE }, line: { color: ORANGE } });
    s.addText(icon, { x: 0.5, y: 2.17 + i * 0.54, w: 0.35, h: 0.35, fontSize: 13, align: "center", valign: "middle", margin: 0 });
    s.addText(text, { x: 0.98, y: 2.19 + i * 0.54, w: 3.8, h: 0.35, fontSize: 11.5, color: MUTED, fontFace: "Calibri", valign: "middle", margin: 0 });
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.3, y: 1.55, w: 4.2, h: 3.8, fill: { color: NAVY }, line: { color: NAVY }, rectRadius: 0.14, shadow: makeShadow() });
  s.addText("🔒 Datenschutz", { x: 5.5, y: 1.72, w: 3.8, h: 0.48, fontSize: 16, bold: true, color: WHITE, fontFace: "Cambria", align: "center", margin: 0 });
  [
    "Läuft auf unserem eigenen Schulserver",
    "Keine Daten bei Google, Meta oder US-Anbietern",
    "Schülernamen öffentlich nur als »Vorname N.«",
    "Gastzugang nur auf Freigabe, schließt von selbst",
    "Zwei-Faktor-Schutz für sensible Lehrkraft-Daten",
    "Spielsitzungen werden zum Schuljahresende gelöscht",
    "Keine KI in der App — Schülerdaten bleiben hier",
  ].forEach((text, i) => {
    s.addText("✅  " + text, { x: 5.5, y: 2.32 + i * 0.42, w: 3.85, h: 0.38, fontSize: 10.5, color: CREAM, fontFace: "Calibri", margin: 0 });
  });
  s.addNotes("Datenschutz ist ein häufiges Gegenargument — hier proaktiv ansprechen. Wir haben die Kontrolle, nicht ein externer Anbieter.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 12 — Vorteile im Überblick
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  sectionTag(s, "ZUSAMMENFASSUNG", 0.55, 0.38);
  title(s, "Was TT für uns leistet", WHITE);

  [
    { icon: "🤝", title: "Zusammenhalt",  body: "Häuser verbinden Jahrgänge. Gemeinsame Ziele schaffen echtes Gemeinschaftsgefühl." },
    { icon: "🔥", title: "Motivation",    body: "Spielelemente wecken Neugier und Ehrgeiz — auch bei sonst stillen Schülerinnen und Schülern." },
    { icon: "🔬", title: "Anschaulichkeit", body: "Simulationen machen Unsichtbares sichtbar: vom Erdkern bis zum Netzwerkpaket." },
    { icon: "⏰", title: "Zeitersparnis", body: "Abstimmung, Feedback und Spiele in Sekunden gestartet; Vorlagen teilen statt neu bauen." },
    { icon: "🌍", title: "Für alle Fächer", body: "Von Mathe über Geografie bis Informatik und Sport — jede Klasse, jede Unterrichtsform." },
    { icon: "🛡", title: "Sicherheit",    body: "Datenschutz eingebaut, schulintern, keine externen Abhängigkeiten." },
  ].forEach((b, i) => {
    const x = 0.48 + (i % 3) * 3.07, y = 1.7 + Math.floor(i / 3) * 1.8;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.85, h: 1.55, fill: { color: TILE }, line: { color: "253D7A" }, rectRadius: 0.12 });
    s.addText(b.icon + "  " + b.title, { x: x + 0.18, y: y + 0.14, w: 2.5, h: 0.4, fontSize: 14, bold: true, color: ORANGE, fontFace: "Calibri", margin: 0 });
    s.addText(b.body, { x: x + 0.18, y: y + 0.58, w: 2.5, h: 0.85, fontSize: 10.5, color: CREAM, fontFace: "Calibri", margin: 0 });
  });
  s.addNotes("Diese Folie als Zusammenfassung zeigen, bevor es zu den nächsten Schritten geht.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 13 — Nächste Schritte
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "JETZT STARTEN", 0.55, 0.38);
  title(s, "Bereit für den ganzen Schulalltag");

  s.addText("TT ist fertig und läuft. Alle interessierten Lehrkräfte können es ab sofort nutzen — keine Installation, kein Warten.", {
    x: 0.5, y: 1.5, w: 5.2, h: 0.75, fontSize: 13, color: MUTED, fontFace: "Calibri", margin: 0,
  });
  [
    "Einloggen — Zugang auf Anfrage sofort verfügbar",
    "Spiele, Simulationen und Werkzeuge im nächsten Unterricht einsetzen",
    "Häuser & Punkte schulweit nutzen, sobald das Kollegium startet",
    "Kein Vorwissen nötig — 5 Minuten reichen zum Einstieg",
  ].forEach((text, i) => {
    const y = 2.4 + i * 0.6;
    s.addShape(pres.shapes.OVAL, { x: 0.5, y, w: 0.42, h: 0.42, fill: { color: ORANGE }, line: { color: ORANGE } });
    s.addText("✓", { x: 0.5, y, w: 0.42, h: 0.42, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
    s.addText(text, { x: 1.05, y, w: 4.7, h: 0.42, fontSize: 12, color: NAVY, fontFace: "Calibri", valign: "middle", margin: 0 });
  });

  phone(s, "91-mobile-simulationen", 6.6, 1.65, 3.1);
  phone(s, "92-mobile-aktivitaeten", 8.25, 1.9, 2.85);

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 5.0, w: 9, h: 0.44, fill: { color: ORANGE }, line: { color: ORANGE }, rectRadius: 0.1 });
  s.addText("Wer möchte loslegen? — Einfach melden, der Zugang ist sofort da.", {
    x: 0.5, y: 5.0, w: 9, h: 0.44, fontSize: 13.5, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle", margin: 0,
  });
  s.addNotes("Keine Pilotphase, kein Rollout-Plan — einfach starten. Wer Interesse hat, bekommt sofort Zugang.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 14 — Danke / Fragen
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  s.addShape(pres.shapes.OVAL, { x: 6.5, y: -0.5, w: 4.5, h: 4.5, fill: { color: NAVY, transparency: 30 }, line: { color: NAVY, transparency: 30 } });
  s.addShape(pres.shapes.OVAL, { x: -0.5, y: 3.5, w: 3.0, h: 3.0, fill: { color: ORANGE, transparency: 70 }, line: { color: ORANGE, transparency: 70 } });

  s.addText("🏆", { x: 3.5, y: 0.55, w: 3, h: 1.3, fontSize: 72, align: "center", margin: 0 });
  s.addText("Danke für Ihre Aufmerksamkeit!", { x: 0.8, y: 1.95, w: 8.4, h: 0.75, fontSize: 30, bold: true, color: WHITE, fontFace: "Cambria", align: "center", margin: 0 });
  s.addText("Fragen & Diskussion", { x: 0.8, y: 2.78, w: 8.4, h: 0.5, fontSize: 18, color: ORANGE, fontFace: "Calibri", italic: true, align: "center", margin: 0 });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.8, y: 3.45, w: 4.4, h: 1.5, fill: { color: TILE }, line: { color: TILE_LINE }, rectRadius: 0.12 });
  s.addText("Zugang & Fragen:", { x: 3.0, y: 3.6, w: 4.0, h: 0.36, fontSize: 11, color: CREAM, fontFace: "Calibri", align: "center", margin: 0 });
  s.addText("🌐  hauspokal.ege-potsdam.de", { x: 3.0, y: 4.0, w: 4.0, h: 0.32, fontSize: 12, bold: true, color: ORANGE, fontFace: "Calibri", align: "center", margin: 0 });
  s.addText("Mitspielen ohne Konto: Code eingeben unter /play", { x: 3.0, y: 4.35, w: 4.0, h: 0.36, fontSize: 10, color: CREAM, fontFace: "Calibri", align: "center", margin: 0 });

  s.addNotes("Zeit für Fragen lassen. Häufige Einwände: Zeitaufwand (minimal), Technik (läuft im Schul-WLAN), Datenschutz (eingebaut).");
}

// ── Write file ────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: path.join(__dirname, "TT-Pitch.pptx") }).then(() => {
  console.log("✅  TT-Pitch.pptx created");
}).catch(console.error);
