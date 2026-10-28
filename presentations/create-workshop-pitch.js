/**
 * TT - Teaching Tools — Workshop-Pitch (KI und digitale Bildung, schulübergreifend)
 * Ziel: TT als offenen, erweiterbaren Baukasten zeigen und Mitstreiter·innen gewinnen.
 * Screenshots kommen aus ../screenshots/out (erst screenshots/take-screenshots.js laufen lassen;
 * Baumleben: ONLY=sim-baum). QR-Codes: qr-demo.png und qr-handout.png in diesem Ordner.
 * Run: node create-workshop-pitch.js
 */

const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "TT - Teaching Tools — Workshop";
pres.author = "EGE";

const SHOTS = path.join(__dirname, "..", "screenshots", "out");

// Links zu den Begleitseiten (Artifacts); vor dem Workshop auf »öffentlich« teilen.
const DEMO_URL = "claude.ai/artifact/6jAYzGS5xUQ8UjbXxFpm9b";
const HANDOUT_URL = "claude.ai/artifact/45iY9BVaE1CfivcxnUoBfq";

// ── Design tokens (wie create-pitch.js) ───────────────────────────────────────
const NAVY   = "1A3060";
const ORANGE = "E07820";
const WHITE  = "FFFFFF";
const CREAM  = "F4F0EA";
const LIGHT  = "EBF0F8";
const MUTED  = "6878A0";
const DARK   = "0F1D3E";
const TILE   = "1E3A7A";
const TILE_LINE = "2A4A8A";
const PEACH  = "FBEEE1";
const MINT   = "E6F3EC";

const makeShadow = () => ({ type: "outer", color: "000000", blur: 10, offset: 3, angle: 45, opacity: 0.18 });

// ── Helpers ───────────────────────────────────────────────────────────────────
function shotPath(name) {
  const p = path.join(SHOTS, `${name}.png`);
  if (!fs.existsSync(p)) throw new Error(`Screenshot fehlt: ${p} — erst screenshots/take-screenshots.js laufen lassen`);
  return p;
}
const hasShot = name => fs.existsSync(path.join(SHOTS, `${name}.png`));

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

function sectionTag(s, text, x = 0.55, y = 0.38, w = 2.2) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.32, fill: { color: ORANGE }, line: { color: ORANGE }, rectRadius: 0.08 });
  s.addText(text, { x, y, w, h: 0.32, fontSize: 9, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
}

function title(s, text, color = NAVY, size = 32) {
  s.addText(text, { x: 0.5, y: 0.78, w: 9, h: 0.65, fontSize: size, bold: true, color, fontFace: "Cambria", margin: 0 });
}

function sub(s, text, color = MUTED, y = 1.45) {
  s.addText(text, { x: 0.5, y, w: 9, h: 0.5, fontSize: 12.5, color, fontFace: "Calibri", margin: 0 });
}

function bullets(s, items, x, y, w, color = NAVY, step = 0.42, size = 12) {
  items.forEach((t, i) => s.addText(t, { x, y: y + i * step, w, h: step - 0.04, fontSize: size, color, fontFace: "Calibri", valign: "top", margin: 0 }));
}

function banner(s, text, y = 5.05) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y, w: 9, h: 0.44, fill: { color: ORANGE }, line: { color: ORANGE }, rectRadius: 0.1 });
  s.addText(text, { x: 0.5, y, w: 9, h: 0.44, fontSize: 13, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
}

function qr(s, file, x, y, size, label, color = CREAM) {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) return;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.08, y: y - 0.08, w: size + 0.16, h: size + 0.16, fill: { color: WHITE }, line: { color: WHITE }, rectRadius: 0.08 });
  s.addImage({ path: p, x, y, w: size, h: size });
  if (label) s.addText(label, { x: x - 0.4, y: y + size + 0.12, w: size + 0.8, h: 0.3, fontSize: 10, bold: true, color, fontFace: "Calibri", align: "center", margin: 0 });
}

function bigStat(s, number, label, x, y, w = 1.8) {
  s.addText(number, { x, y, w, h: 0.7, fontSize: 36, bold: true, color: ORANGE, fontFace: "Cambria", align: "center", margin: 0 });
  s.addText(label,  { x, y: y + 0.68, w, h: 0.45, fontSize: 10.5, color: CREAM, fontFace: "Calibri", align: "center", margin: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 — Titel
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  s.addShape(pres.shapes.OVAL, { x: 6.6, y: -1.2, w: 4.6, h: 4.6, fill: { color: NAVY, transparency: 20 }, line: { color: NAVY, transparency: 20 } });
  s.addShape(pres.shapes.OVAL, { x: -0.8, y: 4.2, w: 2.4, h: 2.4, fill: { color: ORANGE, transparency: 70 }, line: { color: ORANGE, transparency: 70 } });

  s.addText("TT", { x: 0.5, y: 1.0, w: 4.6, h: 1.1, fontSize: 72, bold: true, color: WHITE, fontFace: "Cambria", margin: 0 });
  s.addText("Teaching Tools", { x: 0.5, y: 2.05, w: 4.6, h: 0.6, fontSize: 30, bold: true, color: ORANGE, fontFace: "Cambria", margin: 0 });
  s.addText("Ein offener Baukasten für Lernspiele, Simulationen und Unterrichtswerkzeuge. Selbst gehostet, erweiterbar, gebaut aus dem Schulalltag.", {
    x: 0.5, y: 2.8, w: 4.5, h: 1.0, fontSize: 14, color: CREAM, fontFace: "Calibri", italic: true, margin: 0,
  });
  s.addText("Workshop KI und digitale Bildung", { x: 0.5, y: 4.85, w: 5, h: 0.35, fontSize: 10, color: MUTED, fontFace: "Calibri", margin: 0 });

  screen(s, "13-simulationen", 5.25, 1.25, 4.4, TILE_LINE);
  phone(s, "104-bingo-live-student-playing", 8.55, 2.75, 2.45);
  s.addNotes("Kurz vorstellen: Lehrkraft, kein Softwarehaus. TT ist aus einem Häuserwettbewerb an einer Schule entstanden und inzwischen eine Plattform mit über 50 Werkzeugen. Heute geht es darum, was man daraus gemeinsam machen kann.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — Ausgangslage
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "AUSGANGSLAGE");
  title(s, "Gute Ideen, kein gemeinsames Zuhause");

  const items = [
    { icon: "🧩", title: "Insellösungen", body: "Quiz hier, Simulation dort, Abstimmung woanders. Jedes Tool mit eigenem Konto, oft außerhalb des EU-Datenschutzes." },
    { icon: "🤖", title: "KI erzeugt Material", body: "Arbeitsblätter und Quizfragen entstehen in Minuten. Aber wohin damit, damit Lernende wirklich damit spielen?" },
    { icon: "🔒", title: "Geschlossene Systeme", body: "Was fehlt, kann man nicht ergänzen. Inhalte stecken in Formaten, die man nicht teilen oder mitnehmen kann." },
  ];
  items.forEach((c, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.7, 2.85, 3.2, LIGHT);
    s.addText(c.icon, { x, y: 1.95, w: 2.85, h: 0.7, fontSize: 36, align: "center", margin: 0 });
    s.addText(c.title, { x: x + 0.15, y: 2.77, w: 2.55, h: 0.5, fontSize: 14, bold: true, color: NAVY, fontFace: "Calibri", align: "center", margin: 0 });
    s.addText(c.body, { x: x + 0.2, y: 3.35, w: 2.45, h: 1.4, fontSize: 11, color: MUTED, fontFace: "Calibri", margin: 0 });
  });
  banner(s, "TT: ein Gerüst, in das neue Spiele, Simulationen und Inhalte einfach hineinpassen.");
  s.addNotes("Die Runde kennt die Schmerzpunkte. Wichtig ist der mittlere Punkt: KI macht Material billig, aber nicht spielbar. Genau da setzt der Baukasten an.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — Prinzip: Baukasten in Schichten
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "DAS PRINZIP");
  title(s, "Bausteine, Rahmen, Inhalte");

  const layers = [
    { fill: PEACH, tag: "INHALTE", head: "JSON-Dateien, per Formular oder KI-Vorlage", tags: "Zeitleisten · Fakten + Behauptungen · Kartensätze · Folien + Aufgaben · Lückentexte" },
    { fill: LIGHT, tag: "RAHMEN", head: "Spielformen, die Inhalte und Simulationen aufnehmen", tags: "Caputh · TaskCrawler · Challenge (10 Spielarten) · Zeitstrahl · Karten-Quiz · Bingo" },
    { fill: MINT, tag: "BAUSTEINE", head: "Simulationen, allein oder als Station im Spiel", tags: "Gleichungswaage · Maus-Führerschein · KI-Werkstatt · Sonnensystem · Baumleben · … 35" },
  ];
  layers.forEach((l, i) => {
    const y = 1.6 + i * 1.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y, w: 9, h: 0.85, fill: { color: l.fill }, line: { color: "D5DCE8" }, rectRadius: 0.1 });
    s.addText(l.tag, { x: 0.7, y: y + 0.12, w: 1.6, h: 0.3, fontSize: 10, bold: true, color: ORANGE, fontFace: "Consolas", margin: 0 });
    s.addText(l.head, { x: 2.3, y: y + 0.1, w: 7.0, h: 0.32, fontSize: 13, bold: true, color: NAVY, fontFace: "Calibri", margin: 0 });
    s.addText(l.tags, { x: 2.3, y: y + 0.45, w: 7.0, h: 0.3, fontSize: 10.5, color: MUTED, fontFace: "Calibri", margin: 0 });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 4.62, w: 9, h: 0.5, fill: { color: NAVY }, line: { color: NAVY }, rectRadius: 0.1 });
  s.addText("PLATTFORM   Ein Code für alles · QR + Gastzugang · Häuser + Punkte · Erfolge · Rechte je Werkzeug · Klassen, Kurse, A/B", {
    x: 0.7, y: 4.62, w: 8.6, h: 0.5, fontSize: 10.5, bold: true, color: CREAM, fontFace: "Calibri", valign: "middle", margin: 0,
  });
  s.addNotes("Das ist die Kernbotschaft. Jede Schicht wächst unabhängig: Wer eine neue Simulation baut, bekommt Codes, Rechte und Punkte geschenkt, und kann sie als Station im TaskCrawler anbieten. Wer Inhalte baut, braucht gar keinen Code.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — Technik in Kürze
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  sectionTag(s, "TECHNIK IN KÜRZE");
  title(s, "Ein Server, drei Container, null Cloud", WHITE, 30);

  bigStat(s, "3", "Container: PostgreSQL 17, FastAPI, Next.js 16", 0.4, 1.65, 2.1);
  bigStat(s, "1", "Installationsskript für Windows und Linux", 2.7, 1.65, 2.1);
  bigStat(s, "0", "Anfragen an fremde Server, auch Karten und Schriften lokal", 5.0, 1.65, 2.1);
  bigStat(s, "0", "Apps oder Konten für Schülerinnen und Schüler", 7.3, 1.65, 2.1);

  card(s, 0.5, 3.15, 4.4, 1.85, TILE);
  s.addText("Was man braucht", { x: 0.7, y: 3.25, w: 4, h: 0.35, fontSize: 13, bold: true, color: ORANGE, fontFace: "Calibri", margin: 0 });
  bullets(s, ["• Rechner mit Docker: Schulserver, Mini-PC oder VM", "• Jeder aktuelle Browser, auch Handy und Tablet", "• Optional: 3D-Simulationen brauchen WebGL"], 0.7, 3.65, 4.1, CREAM, 0.42, 11.5);
  card(s, 5.1, 3.15, 4.4, 1.85, TILE);
  s.addText("Datenschutz eingebaut", { x: 5.3, y: 3.25, w: 4, h: 0.35, fontSize: 13, bold: true, color: ORANGE, fontFace: "Calibri", margin: 0 });
  bullets(s, ["• Keine KI in der App, nur Vorlagen für externe KI", "• Gäste per befristetem Code, Namen nur »Vorname N.«", "• Spielsitzungen gelöscht zum Schuljahreswechsel", "• 2FA, Audit-Log wird zehn Jahre aufbewahrt"], 5.3, 3.65, 4.1, CREAM, 0.33, 11.5);
  s.addNotes("Bewusst kurz halten. Für Technikinteressierte: Python/FastAPI und React/Next.js, WebSockets für Live-Spiele, three.js für 3D. Alles läuft im Schulnetz, auch die Karten (MapLibre mit amtlichen Daten).");
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — Mitmachen per Code
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  sectionTag(s, "LIVE IM UNTERRICHT");
  title(s, "Code an die Tafel, alle spielen mit", WHITE, 30);

  screen(s, "105-bingo-live-host-called", 0.5, 1.9, 4.7, TILE_LINE);
  caption(s, "Lehrkraft steuert am Beamer und sieht jeden Treffer", 0.5, 4.8, 4.7, CREAM);
  const ph = 2.7;
  let x = 5.6;
  [["01-play-hub-mobile", "1. Code eingeben"], ["102-bingo-live-student-waiting", "2. Name + Avatar"], ["106-bingo-live-student-called", "3. Mitspielen"]].forEach(([name, label]) => {
    const w = phone(s, name, x, 1.85, ph);
    caption(s, label, x - 0.1, 4.8, w + 0.2, CREAM);
    x += w + 0.25;
  });
  s.addNotes("Ein Code für alle Werkzeuge unter /play. Gäste ohne Konto kommen nur hinein, wenn die Lehrkraft das für diese Sitzung freischaltet, und der Zugang schließt sich von selbst.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 — Caputh
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "RAHMEN · CAPUTH");
  title(s, "Caputh: das Live-Quiz, das mehr kann");
  bullets(s, [
    "🎮  Klassisch, TÜ, Test, Aufgabe, Wettbewerb, Team-Modus",
    "🧭  Fragetypen bis Zeitstrahl, Karte, Sortieren, Einheiten umrechnen",
    "🖼  Bilder in Fragen, Lückentexte eingebettet",
    "🏆  Ergebnis fließt als Punkte ins Haus der Klasse",
    "📋  Vorlage mit KI-Anleitung, Formular-Editor",
  ], 0.5, 1.7, 4.0, NAVY, 0.55, 12.5);
  screen(s, "31-caputh", 4.75, 1.65, 4.85);
  s.addNotes("Caputh ist nach dem Ort benannt, an dem die erste Version entstand. Wichtig für dieses Publikum: Ein Zeitstrahl oder eine Karte ist hier einfach ein weiterer Fragetyp.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — TaskCrawler
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  sectionTag(s, "RAHMEN · TASKCRAWLER");
  title(s, "TaskCrawler: Lernstoff als begehbares Gebäude", WHITE, 28);
  screen(s, "32-taskcrawler", 0.5, 1.65, 4.85, TILE_LINE);
  bullets(s, [
    "Folie = Zimmer, Abschnitt = Stockwerk, Tür = Code aus den Aufgaben",
    "17 Baustile, 3D-Avatare, Bosskampf als Challenge",
    "Schwierigkeit passt sich an: mehr Tipps, mehr Zeit, leichtere Aufgaben",
    "Lehrkraft sieht den Fortschritt live",
    "Merksätze am Ende als PDF zur Ergebnissicherung",
  ], 5.6, 1.7, 4.0, CREAM, 0.6, 12);
  s.addNotes("Beispiel Zeitreise der Medien: sechs Epochen, jedes Stockwerk im Stil seiner Zeit, von der Steinzeithöhle bis zur Raumstation. Freiwillige Weltreise-Aufgaben am Globus (Inka, Maya, Kenia). Am Ende der Deepfake-Drache.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — Sims als Stationen
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "ERWEITERBAR");
  title(s, "Simulationen als Station im TaskCrawler");
  sub(s, "Eine Aufgabe im TaskCrawler öffnet eine Simulation mit fester Vorgabe. Die Antwort prüft weiterhin der Server.");

  card(s, 0.5, 2.1, 4.4, 1.15, LIGHT);
  s.addText('"sim": {\n  "tool": "gleichungswaage",\n  "config": { "gleichung": "3x + 4 = 19" }\n}', {
    x: 0.7, y: 2.2, w: 4.1, h: 0.95, fontSize: 10, color: NAVY, fontFace: "Consolas", valign: "middle", margin: 0,
  });
  bullets(s, [
    "🔗  23 Simulationen als Station im TaskCrawler",
    "🗺  Zeitstrahl und Karte als Fragetyp in Caputh",
    "🐉  Challenge-Minispiele als Zwischen- und Endboss",
    "🤖  KI-Werkstatt direkt in der Medien-Zeitreise",
  ], 0.5, 3.45, 4.4, NAVY, 0.4, 12);

  screen(s, "36-zeitstrahl", 5.15, 2.05, 2.15);
  caption(s, "Zeitstrahl", 5.15, 3.3, 2.15);
  screen(s, "66-sim-gleichungswaage", 7.45, 2.05, 2.15);
  caption(s, "Gleichungswaage", 7.45, 3.3, 2.15);
  screen(s, "34-karten", 5.15, 3.75, 2.15);
  caption(s, "Karten", 5.15, 5.0, 2.15);
  screen(s, "59-sim-ki", 7.45, 3.75, 2.15);
  caption(s, "KI-Werkstatt", 7.45, 5.0, 2.15);
  s.addNotes("Das ist der Punkt, der TT von Einzeltools unterscheidet: Eine Simulation lässt sich als Station in den TaskCrawler hängen. Jede bringt dabei ihr eigenes Vorgabe-Format mit (bei der Waage die Gleichung, bei der Karte die Region); 23 sind schon angebunden. Beispiel: In der Medien-Zeitreise öffnen zwei Aufgaben die KI-Werkstatt, Reiter Sprache und Bilder.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — KI-Workflow
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  sectionTag(s, "KI ALS WERKZEUG");
  title(s, "Vorlage rein, Spiel raus", WHITE, 30);
  sub(s, "In TT steckt keine KI. Aber jede Vorlage enthält die Anleitung für eine KI gleich mit.", CREAM);

  const steps = [
    ["1", "Vorlage holen", "JSON mit Format, Regeln und Beispiel"],
    ["2", "KI füllen lassen", "Chatbot nach Wahl oder lokales Modell, mit Thema und Klassenstufe"],
    ["3", "Prüfen", "Fakten checken, im Formular-Editor nacharbeiten"],
    ["4", "Hochladen", "Server prüft das Format, das Spiel ist sofort startklar"],
  ];
  steps.forEach(([n, h, b], i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 2.15, 2.1, 2.5, TILE);
    s.addText(n, { x: x + 0.15, y: 2.25, w: 1, h: 0.7, fontSize: 36, bold: true, color: ORANGE, fontFace: "Cambria", margin: 0 });
    s.addText(h, { x: x + 0.15, y: 2.95, w: 1.85, h: 0.4, fontSize: 13.5, bold: true, color: WHITE, fontFace: "Calibri", margin: 0 });
    s.addText(b, { x: x + 0.15, y: 3.4, w: 1.85, h: 1.15, fontSize: 11, color: CREAM, fontFace: "Calibri", valign: "top", margin: 0 });
    if (i < 3) s.addText("→", { x: x + 2.08, y: 3.1, w: 0.24, h: 0.4, fontSize: 16, bold: true, color: ORANGE, align: "center", margin: 0 });
  });
  banner(s, "Vorlagen für TaskCrawler, Caputh, Zeitstrahl, Lückentext, Bingo, Karten, Umfrage, Stundenplaner");
  s.addNotes("Live zeigen, wenn Zeit ist: Zeitstrahl-Vorlage herunterladen, mit Thema in einen Chatbot geben, Ergebnis hochladen. Das dauert drei Minuten. Die Begleitseite hat einen Knopf, der den Prompt kopiert. Wichtig: Jedes Werkzeug hat sein eigenes JSON-Format, die Vorlage bringt es mit.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — Live-Demo: Zeitreise der Medien
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  sectionTag(s, "JETZT AUSPROBIEREN");
  title(s, "Zeitreise der Medien", WHITE, 32);
  sub(s, "Ein Thema, drei Vorlagen. Am Handy öffnen und mitspielen.", CREAM);
  bullets(s, [
    "🕰  Zeitstrahl mit 56 Ereignissen in vier Spuren, von der Höhlenmalerei bis zur KI",
    "🔀  Einsortieren: Ereignisse auf den Zeitstrahl ziehen",
    "🏛  TaskCrawler: sechs Stockwerke, Codeschnipsel, Tür für Tür",
    "⚖  Endgegner im Gerichtssaal: Behauptungen mit Beweisen widerlegen",
    "🔧  Hinter den Kulissen: die JSON-Vorlage und der KI-Prompt",
  ], 0.5, 2.15, 6.0, CREAM, 0.5, 12.5);
  qr(s, "qr-demo.png", 7.25, 1.9, 2.0, DEMO_URL);
  s.addNotes("Alle scannen lassen, fünf Minuten spielen lassen. Danach die Frage: Welches Thema würdet ihr so bauen? Das ist der Übergang zum Mitmachen.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 11 — Beispiele aus dem Baukasten
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "BAUSTEINE");
  title(s, "Vier Beispiele aus 35 Simulationen", NAVY, 30);
  const baum = hasShot("79-sim-baum") ? "79-sim-baum" : "51-sim-erdaufbau";
  const items = [
    ["73-sim-maus", "Maus-Führerschein", "PC-Grundkurs auf nachgebautem Windows. Sterne, Prüfung, Urkunde, Hauspunkte."],
    ["34-karten", "Karten", "Atlas aus amtlichen Daten: Strömungen, Wind, Bodenschätze. Quiz per Code."],
    ["66-sim-gleichungswaage", "Gleichungswaage", "Äquivalenzumformung zum Anfassen, von Äpfeln bis Reaktionsgleichungen."],
    [baum, baum === "79-sim-baum" ? "Baumleben" : "Aufbau der Erde", baum === "79-sim-baum" ? "Vom Samen zum Humus, Stoffströme, Bestimmen und das Spiel »Sei ein Baum«." : "Erdkern bis Kruste in 3D, Erdbebenwellen, Konvektion."],
  ];
  items.forEach(([name, h, b], i) => {
    const x = 0.5 + (i % 2) * 4.6, y = 1.6 + Math.floor(i / 2) * 1.85;
    screen(s, name, x, y, 2.4);
    s.addText(h, { x: x + 2.55, y: y + 0.05, w: 1.9, h: 0.35, fontSize: 14, bold: true, color: NAVY, fontFace: "Cambria", margin: 0 });
    s.addText(b, { x: x + 2.55, y: y + 0.42, w: 1.9, h: 1.0, fontSize: 10.5, color: MUTED, fontFace: "Calibri", valign: "top", margin: 0 });
  });
  s.addNotes("Maus-Führerschein: Viele Fünftklässler können Handy, aber keinen PC. Karten: Statt Schulbuchkarte ein Atlas mit echten, aktuellen Daten. Gleichungswaage: Algebra wird zum Gleichgewicht. Baumleben: Biologie mit echten Wachstumsmodellen.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 — Nutzen für Bildung
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  sectionTag(s, "FÜR DEN UNTERRICHT");
  title(s, "Was Lernende davon haben", WHITE);
  const benefits = [
    { icon: "🎯", title: "Spielen mit Sinn", body: "Häuser, Erfolge, Bosskämpfe. Spiel- und Wissenswertung getrennt." },
    { icon: "🌍", title: "Nah an ihrer Welt", body: "Echter Atlas, echtes Windows, Leben in Erfurt, Deepfakes erkennen." },
    { icon: "🪜", title: "Jeder auf seinem Niveau", body: "Schwierigkeit passt sich an, Texte in drei Lesestufen." },
    { icon: "🔬", title: "Unsichtbares sichtbar", body: "Vom Erdkern bis zum Netzwerkpaket, zum Verändern statt Ansehen." },
    { icon: "🤝", title: "Gemeinschaft", body: "Klassen sammeln für ihr Haus, über Jahrgänge hinweg." },
    { icon: "⏰", title: "Zeit für Lehrkräfte", body: "Code an die Tafel, Vorlagen teilen, Auswertung als CSV." },
  ];
  benefits.forEach((b, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05, y = 1.65 + row * 1.75;
    card(s, x, y, 2.85, 1.55, TILE);
    s.addText(b.icon, { x: x + 0.15, y: y + 0.15, w: 0.5, h: 0.5, fontSize: 22, margin: 0 });
    s.addText(b.title, { x: x + 0.7, y: y + 0.18, w: 2.05, h: 0.42, fontSize: 13, bold: true, color: ORANGE, fontFace: "Calibri", margin: 0 });
    s.addText(b.body, { x: x + 0.15, y: y + 0.72, w: 2.6, h: 0.75, fontSize: 11, color: CREAM, fontFace: "Calibri", valign: "top", margin: 0 });
  });
  s.addNotes("Gamification ist kein Selbstzweck: Die Challenge trennt Spielpunkte von der Wissenswertung, 100 % gibt es nur ohne Fehler im ersten Anlauf. Lebensnähe ist das stärkste Argument für dieses Publikum.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 13 — Offen, selbst gehostet, erweiterbar
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionTag(s, "OFFEN");
  title(s, "Offen, selbst gehostet, erweiterbar");
  const cols = [
    { h: "Offen", fill: PEACH, body: ["Code: Apache-2.0, Inhalte: CC BY 4.0", "Offene Datenformate (JSON)", "Inhalte teilbar zwischen Schulen"] },
    { h: "Selbst gehostet", fill: LIGHT, body: ["Daten bleiben in der Schule", "Kein Abo, kein Anbieterwechsel", "Läuft auch ohne Internet im Schulnetz"] },
    { h: "Erweiterbar", fill: MINT, body: ["Neue Simulation = Komponente + Katalogeintrag", "Codes, Rechte, Punkte kommen automatisch", "Jede Simulation wird Station in Spielen"] },
  ];
  cols.forEach((c, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.65, 2.85, 3.2, c.fill);
    s.addText(c.h, { x: x + 0.2, y: 1.8, w: 2.45, h: 0.45, fontSize: 17, bold: true, color: NAVY, fontFace: "Cambria", margin: 0 });
    bullets(s, c.body.map(t => "• " + t), x + 0.2, 2.4, 2.5, NAVY, 0.72, 12);
  });
  banner(s, "Was eine Schule baut, können alle anderen nutzen.");
  s.addNotes("Lizenz: Apache-2.0 für den Code, CC BY 4.0 für eigene Inhalte. Eigene Simulationen dürfen privat bleiben, Pflicht ist nur die NOTICE-Datei mit dem Hinweis auf das Original-Repo. Fremdes Material (Fotos, Schriften, Kartendaten) behält seine eigene Lizenz, alle Nachweise stehen unter /admin/quellen. Vor dem Workshop noch das Repo öffentlich schalten.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 14 — Mitmachen
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  sectionTag(s, "MITMACHEN");
  title(s, "Wer baut mit?", WHITE);
  const roles = [
    ["🧑‍🏫", "Testen", "In einer echten Stunde ausprobieren, Pilotschulen willkommen"],
    ["📚", "Inhalte bauen", "Zeitleisten, Quizze, TaskCrawler für euer Fach, ohne Code"],
    ["💻", "Entwickeln", "Neue Simulationen, Barrierefreiheit, Übersetzungen, Tests"],
    ["🏢", "Betreiben", "Medienzentren und Schulträger: eine Instanz für viele Schulen"],
    ["🎓", "Forschen", "Wirkung untersuchen, in Seminaren und im Referendariat nutzen"],
    ["📣", "Weitersagen", "Wo sollte TT gezeigt werden? Fachtage, Netzwerke, Wettbewerbe"],
  ];
  roles.forEach(([icon, h, b], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05, y = 1.6 + row * 1.6;
    card(s, x, y, 2.85, 1.4, TILE);
    s.addText(icon + "  " + h, { x: x + 0.15, y: y + 0.12, w: 2.6, h: 0.4, fontSize: 14, bold: true, color: ORANGE, fontFace: "Calibri", margin: 0 });
    s.addText(b, { x: x + 0.15, y: y + 0.58, w: 2.6, h: 0.75, fontSize: 11, color: CREAM, fontFace: "Calibri", valign: "top", margin: 0 });
  });
  banner(s, "Heute: Name und Interesse auf die Pinnwand. Ab morgen: gemeinsam bauen.", 4.95);
  s.addNotes("Konkret fragen: Wer testet bis zu den Winterferien eine Einheit? Wer baut einen Datensatz für sein Fach? Namen und Kontakt direkt aufschreiben, zum Beispiel auf einer TT-Fragmente-Pinnwand per QR.");
}

// ═══════════════════════════════════════════════════════════════════════════
// 15 — Danke / Fragen
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  s.addShape(pres.shapes.OVAL, { x: 6.5, y: -0.5, w: 4.5, h: 4.5, fill: { color: NAVY, transparency: 30 }, line: { color: NAVY, transparency: 30 } });
  s.addShape(pres.shapes.OVAL, { x: -0.5, y: 3.5, w: 3.0, h: 3.0, fill: { color: ORANGE, transparency: 70 }, line: { color: ORANGE, transparency: 70 } });

  s.addText("Fragen, Ideen, Mitmachen?", { x: 0.5, y: 0.7, w: 9, h: 0.75, fontSize: 30, bold: true, color: WHITE, fontFace: "Cambria", align: "center", margin: 0 });
  s.addText("Alles zum Nachlesen, alle Funktionen und wie ihr einsteigt:", { x: 0.5, y: 1.45, w: 9, h: 0.4, fontSize: 14, color: CREAM, fontFace: "Calibri", italic: true, align: "center", margin: 0 });
  qr(s, "qr-handout.png", 2.3, 2.15, 2.0, "Begleitseite");
  qr(s, "qr-demo.png", 5.7, 2.15, 2.0, "Zeitreise der Medien");
  s.addText("Kontakt: donflauschelot@gmail.com   ·   Code: github.com/DonMischo/TeachingTools", { x: 0.5, y: 4.95, w: 9, h: 0.35, fontSize: 11, color: MUTED, fontFace: "Calibri", align: "center", margin: 0 });
  s.addNotes("Häufige Einwände: Datenschutz (eigener Server, keine Anfragen nach außen), Aufwand (Installationsskript, Code an die Tafel), Nachhaltigkeit (genau deshalb suchen wir Mitstreiter und einen Träger).");
}

// ── Write file ────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: path.join(__dirname, "TT-Workshop-Pitch.pptx") }).then(() => {
  console.log("✅  TT-Workshop-Pitch.pptx created");
}).catch(console.error);
