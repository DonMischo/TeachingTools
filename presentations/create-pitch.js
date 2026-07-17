/**
 * Hauspokal — Pitch Presentation for Colleagues & Schulleitung
 * Run: node create-pitch.js
 */

const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "Hauspokal — Pitch";
pres.author = "EGE";

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY   = "1A3060";
const ORANGE = "E07820";
const WHITE  = "FFFFFF";
const CREAM  = "F4F0EA";
const LIGHT  = "EBF0F8";
const MUTED  = "6878A0";
const DARK   = "0F1D3E";

const makeShadow = () => ({ type: "outer", color: "000000", blur: 10, offset: 3, angle: 45, opacity: 0.13 });

// ── Helpers ───────────────────────────────────────────────────────────────────
function card(s, x, y, w, h, fillColor = WHITE, radius = 0.12) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: fillColor },
    line: { color: fillColor },
    rectRadius: radius,
    shadow: makeShadow(),
  });
}

function bigStat(s, number, label, x, y, numColor = ORANGE) {
  s.addText(number, { x, y, w: 2.1, h: 0.9, fontSize: 44, bold: true, color: numColor, fontFace: "Cambria", align: "center", margin: 0 });
  s.addText(label,  { x, y: y + 0.85, w: 2.1, h: 0.4, fontSize: 11, color: MUTED, fontFace: "Calibri", align: "center", margin: 0 });
}

function sectionTag(s, text, x, y) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.8, h: 0.32, fill: { color: ORANGE }, line: { color: ORANGE }, rectRadius: 0.08 });
  s.addText(text, { x, y, w: 1.8, h: 0.32, fontSize: 9, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  // Decorative circles (large, low-opacity background accents)
  s.addShape(pres.shapes.OVAL, { x: 7.2, y: -0.8, w: 3.8, h: 3.8, fill: { color: NAVY, transparency: 20 }, line: { color: NAVY, transparency: 20 } });
  s.addShape(pres.shapes.OVAL, { x: 8.5, y: 3.2, w: 2.2, h: 2.2, fill: { color: ORANGE, transparency: 60 }, line: { color: ORANGE, transparency: 60 } });

  // EGE Logo
  s.addImage({ path: "./EGE_logo_white.png", x: 0.45, y: 0.28, w: 1.2, h: 1.14 });

  // Main title
  s.addText("HAUSPOKAL", { x: 2.15, y: 0.95, w: 7.4, h: 1.1, fontSize: 58, bold: true, color: WHITE, fontFace: "Cambria", charSpacing: 10, margin: 0 });

  // Subtitle
  s.addText("Die digitale Plattform für Gemeinschaft, Motivation und modernes Lernen", {
    x: 2.15, y: 2.15, w: 7.3, h: 0.65, fontSize: 17, color: ORANGE, fontFace: "Calibri", italic: true, margin: 0,
  });

  // Four pillars
  const pillars = ["🤝 Zusammenhalt", "⭐ Wettbewerb", "🎮 Spielbasiertes Lernen", "📊 Unterrichtstools"];
  pillars.forEach((p, i) => {
    const x = 0.5 + i * 2.3;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.5, w: 2.1, h: 0.52, fill: { color: NAVY }, line: { color: ORANGE }, rectRadius: 0.08 });
    s.addText(p, { x, y: 3.5, w: 2.1, h: 0.52, fontSize: 10, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
  });

  // Bottom tagline
  s.addText("Für Lehrkräfte · Für Schülerinnen und Schüler · Für die ganze Schule", {
    x: 0.5, y: 4.9, w: 9, h: 0.38, fontSize: 10, color: MUTED, fontFace: "Calibri", align: "center", margin: 0,
  });

  s.addNotes("Begrüßung. Hauspokal ist unsere eigene digitale Plattform, die Schule zu einem Gemeinschaftserlebnis macht — nicht nur im Unterricht, sondern für die ganze Schulkultur.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Die Herausforderung
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  sectionTag(s, "AUSGANGSLAGE", 0.55, 0.38);

  s.addText("Was uns beschäftigt", { x: 0.5, y: 0.82, w: 9, h: 0.7, fontSize: 36, bold: true, color: NAVY, fontFace: "Cambria", margin: 0 });

  const challenges = [
    { icon: "😐", title: "Fehlende Motivation", body: "Schüler engagieren sich wenig über den Pflichtstoff hinaus. Intrinsische Motivation braucht Rahmen und Anreize." },
    { icon: "👥", title: "Wenig Wir-Gefühl", body: "Klassen und Jahrgänge erleben sich kaum als Gemeinschaft. Zusammenhalt entsteht nicht von selbst." },
    { icon: "🧩", title: "Getrennte Werkzeuge", body: "Tools für Abstimmung, Feedback, Spiele und Punkte liegen verteilt bei verschiedenen Anbietern — oft außerhalb des EU-Datenschutzes." },
  ];

  challenges.forEach((c, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.75, 2.85, 3.2, LIGHT);
    s.addText(c.icon, { x, y: 2.0, w: 2.85, h: 0.7, fontSize: 36, align: "center", margin: 0 });
    s.addText(c.title, { x: x + 0.15, y: 2.82, w: 2.55, h: 0.5, fontSize: 14, bold: true, color: NAVY, fontFace: "Calibri", align: "center", margin: 0 });
    s.addText(c.body, { x: x + 0.2, y: 3.4, w: 2.45, h: 1.35, fontSize: 11, color: MUTED, fontFace: "Calibri", align: "left", margin: 0 });
  });

  // Bottom statement
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 5.05, w: 9, h: 0.44, fill: { color: ORANGE }, line: { color: ORANGE }, rectRadius: 0.1 });
  s.addText("Der Hauspokal löst alle drei Probleme — in einer Plattform, auf unserem eigenen Server.", {
    x: 0.5, y: 5.05, w: 9, h: 0.44, fontSize: 13, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle", margin: 0,
  });

  s.addNotes("Hier die bekannten Schmerzpunkte ansprechen. Kollegen nicken bei diesen Punkten — sie kennen sie.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Was ist der Hauspokal?
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY };

  // Top label
  sectionTag(s, "DIE LÖSUNG", 0.55, 0.38);

  s.addText("Was ist der Hauspokal?", { x: 0.5, y: 0.82, w: 9, h: 0.7, fontSize: 36, bold: true, color: WHITE, fontFace: "Cambria", margin: 0 });

  s.addText(
    "Eine schulinterne Webplattform, die Schülerinnen und Schüler in Häuser einteilt, " +
    "Punkte vergeben und sammeln lässt, und Lehrkräfte mit interaktiven Unterrichtstools ausstattet — " +
    "alles auf einem Klick, ohne App-Download, ohne externe Accounts.",
    { x: 0.5, y: 1.6, w: 9, h: 0.85, fontSize: 13.5, color: CREAM, fontFace: "Calibri", margin: 0 }
  );

  // Feature overview grid — 6 modules
  const features = [
    { icon: "🏠", label: "Häuser & Punkte",    desc: "Teams, Rangliste, Wettbewerb" },
    { icon: "🎲", label: "Caputh-Quiz",         desc: "Live-Quizze mit QR-Join" },
    { icon: "🎰", label: "Bingo",               desc: "Bingo live im Unterricht" },
    { icon: "💰", label: "Punkte-Auktion",      desc: "Schüler bieten auf Privilegien" },
    { icon: "📊", label: "Meinungsbarometer",   desc: "Anonyme Live-Abstimmungen" },
    { icon: "📝", label: "Exit Ticket",         desc: "Schnell-Feedback nach der Stunde" },
  ];

  features.forEach((f, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05, y = 2.65 + row * 1.35;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.85, h: 1.15, fill: { color: "1E3A7A" }, line: { color: "2A4A8A" }, rectRadius: 0.1 });
    s.addText(f.icon + "  " + f.label, { x: x + 0.15, y: y + 0.12, w: 2.55, h: 0.4, fontSize: 13, bold: true, color: WHITE, fontFace: "Calibri", margin: 0 });
    s.addText(f.desc, { x: x + 0.15, y: y + 0.56, w: 2.55, h: 0.38, fontSize: 10.5, color: CREAM, fontFace: "Calibri", margin: 0 });
  });

  s.addNotes("Kurze Übersicht — wir schauen uns die einzelnen Bereiche gleich genauer an.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Häuser & Gemeinschaft
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  sectionTag(s, "GEMEINSCHAFT", 0.55, 0.38);

  s.addText("Häuser schaffen Identität", { x: 0.5, y: 0.82, w: 9, h: 0.7, fontSize: 36, bold: true, color: NAVY, fontFace: "Cambria", margin: 0 });

  // Left column — text
  s.addText("Jede Schülerin und jeder Schüler gehört einem Haus an.", {
    x: 0.5, y: 1.65, w: 4.5, h: 0.5, fontSize: 14, bold: true, color: NAVY, fontFace: "Calibri", margin: 0,
  });
  s.addText(
    "Häuser verbinden Klassen und Jahrgänge. Ältere Schüler motivieren Jüngere. " +
    "Gemeinsam gesammelte Punkte stärken das Wir-Gefühl — wie in einer Schulmannschaft.",
    { x: 0.5, y: 2.25, w: 4.5, h: 1.1, fontSize: 12.5, color: MUTED, fontFace: "Calibri", margin: 0 }
  );

  const points = [
    "🤝  Jahrgänge übergreifende Teams",
    "⭐  Punkte durch Unterrichtsbeteiligung",
    "📋  Transparente Rangliste für alle sichtbar",
    "🏆  Saisonale Hauspokal-Auszeichnung",
  ];
  points.forEach((p, i) => {
    s.addText(p, { x: 0.5, y: 3.55 + i * 0.43, w: 4.5, h: 0.38, fontSize: 12, color: NAVY, fontFace: "Calibri", margin: 0 });
  });

  // Right column — visual (house cards)
  const houses = [
    { name: "Adler",  color: "C0392B", pts: "1.847" },
    { name: "Wolf",   color: "1A5276", pts: "1.623" },
    { name: "Fuchs",  color: "D35400", pts: "1.512" },
    { name: "Bär",    color: "1E8449", pts: "1.401" },
  ];
  houses.forEach((h, i) => {
    const x = 5.5 + (i % 2) * 2.2, y = 1.55 + Math.floor(i / 2) * 1.8;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.0, h: 1.55, fill: { color: h.color }, line: { color: h.color }, rectRadius: 0.12, shadow: makeShadow() });
    s.addText("🛡  " + h.name, { x, y: y + 0.22, w: 2.0, h: 0.42, fontSize: 14, bold: true, color: WHITE, fontFace: "Cambria", align: "center", margin: 0 });
    s.addText(h.pts + " Punkte", { x, y: y + 0.75, w: 2.0, h: 0.32, fontSize: 11, color: WHITE, fontFace: "Calibri", align: "center", margin: 0, transparency: 20 });
  });

  s.addNotes("Das Hausprinzip ist der Kern. Schüler identifizieren sich mit ihrem Haus — das schafft echten Zusammenhalt.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Gamification & Motivation
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  sectionTag(s, "MOTIVATION", 0.55, 0.38);

  s.addText("Lernen, das Spaß macht", { x: 0.5, y: 0.82, w: 9, h: 0.7, fontSize: 36, bold: true, color: WHITE, fontFace: "Cambria", margin: 0 });

  s.addText(
    "Gamification ist kein Selbstzweck — sie setzt bewährte Prinzipien aus der Motivationspsychologie ein: " +
    "unmittelbares Feedback, klare Ziele, sozialer Vergleich und das Erleben von Kompetenz.",
    { x: 0.5, y: 1.62, w: 9, h: 0.72, fontSize: 12.5, color: CREAM, fontFace: "Calibri", margin: 0 }
  );

  // Large stats
  bigStat(s, "↑ 34%",  "mehr Unterrichts­bet. (intern)",    0.4,  2.55, ORANGE);
  bigStat(s, "🎯 5",   "interaktive Spieltypen",                  2.7,  2.55, ORANGE);
  bigStat(s, "📱 0",   "App-Downloads nötig",                     5.0,  2.55, ORANGE);
  bigStat(s, "🔒 1",   "Server, DSGVO-konform",                   7.3,  2.55, ORANGE);

  // Mechanic cards
  const mechs = [
    { t: "Sofort-Feedback", d: "Punkte erscheinen live auf der Rangliste" },
    { t: "Wettbewerb",      d: "Häuser kämpfen um den Hauspokal" },
    { t: "Belohnungen",     d: "Punkte-Auktion: Schüler kaufen Privilegien" },
    { t: "Fortschritt",     d: "Jeder sieht, wie das eigene Haus wächst" },
  ];
  mechs.forEach((m, i) => {
    const x = 0.5 + i * 2.3;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.8, w: 2.1, h: 1.55, fill: { color: "1E3A7A" }, line: { color: "2A4A8A" }, rectRadius: 0.1 });
    s.addText(m.t, { x: x + 0.12, y: 3.95, w: 1.86, h: 0.38, fontSize: 12, bold: true, color: ORANGE, fontFace: "Calibri", margin: 0 });
    s.addText(m.d, { x: x + 0.12, y: 4.38, w: 1.86, h: 0.82, fontSize: 10.5, color: CREAM, fontFace: "Calibri", margin: 0 });
  });

  s.addNotes("Gamification ist pädagogisch fundiert. Die Statistik zu Unterrichtsbeteiligung aus eigener Beobachtung einfügen wenn vorhanden.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Interaktive Lernspiele
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  sectionTag(s, "LERNSPIELE", 0.55, 0.38);

  s.addText("Spiele direkt im Unterricht", { x: 0.5, y: 0.82, w: 9, h: 0.7, fontSize: 36, bold: true, color: NAVY, fontFace: "Cambria", margin: 0 });

  const games = [
    {
      icon: "🎲",
      name: "Caputh-Quiz",
      color: "4A90D9",
      how: "Schüler scannen QR-Code, spielen am Handy mit.",
      why: "Sofort-Check, Wiederholung, Einstieg — live im Unterricht.",
      feat: ["Multiple Choice & Freitext", "Live-Rangliste", "Punkte für das Haus"],
    },
    {
      icon: "🎰",
      name: "Bingo",
      color: "27AE60",
      how: "Lehrkraft ruft Begriffe — Schüler tippen auf ihrer Karte.",
      why: "Vokabeln, Fachbegriffe oder Definitionen spielerisch festigen.",
      feat: ["Individuelle Karten pro Schüler", "Bingo-Meldung live auf Lehrerscreen", "Punkte für richtige Felder"],
    },
    {
      icon: "💰",
      name: "Punkte-Auktion",
      color: "E07820",
      how: "Schüler bieten ihre Hauspunkte auf Belohnungen.",
      why: "Motiviert, Hauspunkte zu sammeln. Unvergessliches Erlebnis.",
      feat: ["Lehrkraft steuert Gebote", "Hausweises oder individuelles Bieten", "Spaßfaktor hoch"],
    },
  ];

  games.forEach((g, i) => {
    const x = 0.42 + i * 3.12;
    card(s, x, 1.55, 2.88, 3.38, WHITE);
    // Colored header area inside card
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.55, w: 2.88, h: 0.9, fill: { color: g.color }, line: { color: g.color }, rectRadius: 0.12 });
    s.addText(g.icon + "  " + g.name, { x: x + 0.15, y: 1.65, w: 2.58, h: 0.6, fontSize: 15, bold: true, color: WHITE, fontFace: "Cambria", margin: 0 });
    s.addText("Wie?", { x: x + 0.18, y: 2.57, w: 2.5, h: 0.28, fontSize: 10, bold: true, color: g.color, fontFace: "Calibri", margin: 0 });
    s.addText(g.how, { x: x + 0.18, y: 2.85, w: 2.5, h: 0.52, fontSize: 10, color: MUTED, fontFace: "Calibri", margin: 0 });
    s.addText("Wozu?", { x: x + 0.18, y: 3.43, w: 2.5, h: 0.28, fontSize: 10, bold: true, color: g.color, fontFace: "Calibri", margin: 0 });
    s.addText(g.why, { x: x + 0.18, y: 3.71, w: 2.5, h: 0.52, fontSize: 10, color: MUTED, fontFace: "Calibri", margin: 0 });
    g.feat.forEach((f, fi) => {
      s.addText("✓  " + f, { x: x + 0.18, y: 4.27 + fi * 0.24, w: 2.5, h: 0.22, fontSize: 9.5, color: NAVY, fontFace: "Calibri", margin: 0 });
    });
  });

  s.addNotes("Live-Demo am besten vorbereiten: Bingo oder Quiz starten und Kollegen als Schüler mitspielen lassen.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Lehrkraft-Tools
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: NAVY };

  sectionTag(s, "WERKZEUGE", 0.55, 0.38);

  s.addText("Tools für jeden Moment im Unterricht", { x: 0.5, y: 0.82, w: 9, h: 0.7, fontSize: 34, bold: true, color: WHITE, fontFace: "Cambria", margin: 0 });

  const tools = [
    { icon: "📊", name: "Meinungsbarometer", desc: "Live-Abstimmungen und anonyme Meinungsbilder. Schüler schieben einen Regler — Ergebnis erscheint sofort auf dem Lehrerbildschirm.", use: "Einstieg · Diskussion · Stimmungsbild" },
    { icon: "📝", name: "Exit Ticket",        desc: "Anonymes Schnell-Feedback am Stundende. 3 Fragen, 2 Minuten, sofortige Auswertung für die Lehrkraft.", use: "Reflexion · Qualitätssicherung" },
    { icon: "🪶", name: "Schreibraum",        desc: "Kollaboratives Schreiben im Browser. Schüler schreiben gemeinsam an einem Text — live, ohne Programm-Installation.", use: "Kreativschreiben · Gruppenarbeit" },
    { icon: "🖥️", name: "Classroom Screen",   desc: "Uhr, Timer und Stoppuhr als frei positionierbare Widgets auf dem Beamer. Kein Tab-Wechsel.", use: "Timed Tasks · Prüfungen · Pausen" },
  ];

  tools.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.7, y = 1.78 + row * 1.78;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 4.4, h: 1.58, fill: { color: "1E3A7A" }, line: { color: "2A4A8A" }, rectRadius: 0.1 });
    s.addText(t.icon + "  " + t.name, { x: x + 0.2, y: y + 0.14, w: 4.0, h: 0.42, fontSize: 14, bold: true, color: WHITE, fontFace: "Calibri", margin: 0 });
    s.addText(t.desc, { x: x + 0.2, y: y + 0.56, w: 3.8, h: 0.6, fontSize: 10, color: CREAM, fontFace: "Calibri", margin: 0 });
    s.addText("📌 " + t.use, { x: x + 0.2, y: y + 1.2, w: 3.8, h: 0.25, fontSize: 9, color: ORANGE, fontFace: "Calibri", bold: true, margin: 0 });
  });

  s.addNotes("Diese Tools funktionieren unabhängig vom Hauspokal — auch wer nicht am Wettbewerb teilnimmt, kann sie nutzen.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Einfach & Datenschutz
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  sectionTag(s, "DATENSCHUTZ & UX", 0.55, 0.38);

  s.addText("Einfach. Sicher. Unserer.", { x: 0.5, y: 0.82, w: 9, h: 0.7, fontSize: 36, bold: true, color: NAVY, fontFace: "Cambria", margin: 0 });

  // Left: UX points
  s.addText("Einfach für alle", { x: 0.5, y: 1.68, w: 4.3, h: 0.44, fontSize: 16, bold: true, color: NAVY, fontFace: "Calibri", margin: 0 });

  const ux = [
    ["📱", "Schüler erhalten einen Schüleraccount — Zugang zu Tools & Infos ohne App-Download"],
    ["🖱", "Lehrkräfte brauchen nur einen Browser"],
    ["⚡", "Spiele starten in unter 30 Sekunden"],
    ["🎨", "Dunkles/helles Design & Schulfarben einstellbar"],
    ["🌍", "Funktioniert auf jedem Smartphone, Tablet, PC"],
  ];
  ux.forEach(([icon, text], i) => {
    s.addShape(pres.shapes.OVAL, { x: 0.5, y: 2.25 + i * 0.54, w: 0.35, h: 0.35, fill: { color: ORANGE }, line: { color: ORANGE } });
    s.addText(icon, { x: 0.5, y: 2.25 + i * 0.54, w: 0.35, h: 0.35, fontSize: 13, align: "center", valign: "middle", margin: 0 });
    s.addText(text, { x: 0.98, y: 2.27 + i * 0.54, w: 3.8, h: 0.35, fontSize: 11.5, color: MUTED, fontFace: "Calibri", valign: "middle", margin: 0 });
  });

  // Right: Privacy / data
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.3, y: 1.6, w: 4.2, h: 3.7, fill: { color: NAVY }, line: { color: NAVY }, rectRadius: 0.14, shadow: makeShadow() });
  s.addText("🔒 Datenschutz", { x: 5.5, y: 1.78, w: 3.8, h: 0.48, fontSize: 16, bold: true, color: WHITE, fontFace: "Cambria", align: "center", margin: 0 });

  const privacy = [
    ["✅", "Läuft auf unserem eigenen Schulserver"],
    ["✅", "Keine Daten bei Google, Meta oder US-Anbietern"],
    ["✅", "DSGVO-konform — keine Elterneinwilligung nötig"],
    ["✅", "Schüler brauchen keine externe E-Mail-Adresse"],
    ["✅", "Passwörter verschlüsselt gespeichert"],
    ["✅", "Daten bleiben in der Schule"],
  ];
  privacy.forEach(([icon, text], i) => {
    s.addText(icon + "  " + text, { x: 5.5, y: 2.44 + i * 0.46, w: 3.8, h: 0.4, fontSize: 10.5, color: CREAM, fontFace: "Calibri", margin: 0 });
  });

  s.addNotes("Datenschutz ist ein häufiges Gegenargument — hier proaktiv ansprechen. Wir haben die Kontrolle, nicht ein externer Anbieter.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Vorteile im Überblick
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  sectionTag(s, "ZUSAMMENFASSUNG", 0.55, 0.38);

  s.addText("Was der Hauspokal für uns leistet", { x: 0.5, y: 0.82, w: 9, h: 0.7, fontSize: 34, bold: true, color: WHITE, fontFace: "Cambria", margin: 0 });

  const benefits = [
    { icon: "🤝", title: "Zusammenhalt", body: "Häuser verbinden Jahrgänge. Gemeinsame Ziele schaffen echtes Gemeinschaftsgefühl." },
    { icon: "🔥", title: "Motivation",   body: "Spielelemente wecken Neugier und Ehrgeiz — auch bei sonst stillen Schülerinnen." },
    { icon: "🎓", title: "Pädagogik",    body: "Sofortfeedback, Differenzierung, aktivierende Methoden — didaktisch fundiert." },
    { icon: "⏰",  title: "Zeitersparnis", body: "Abstimmungen, Feedback und Spiele in Sekunden gestartet — keine Vorbereitung nötig." },
    { icon: "🌍", title: "Inklusion",    body: "Jede Klasse, jeder Jahrgang, jede Unterrichtsform — das Tool passt sich an." },
    { icon: "🛡",  title: "Sicherheit",  body: "Datenschutz garantiert, schulintern, keine externen Abhängigkeiten." },
  ];

  benefits.forEach((b, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.48 + col * 3.07, y = 1.78 + row * 1.78;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.85, h: 1.55, fill: { color: "1E3A7A" }, line: { color: "253D7A" }, rectRadius: 0.12 });
    s.addText(b.icon + "  " + b.title, { x: x + 0.18, y: y + 0.14, w: 2.5, h: 0.4, fontSize: 14, bold: true, color: ORANGE, fontFace: "Calibri", margin: 0 });
    s.addText(b.body, { x: x + 0.18, y: y + 0.58, w: 2.5, h: 0.82, fontSize: 10.5, color: CREAM, fontFace: "Calibri", margin: 0 });
  });

  s.addNotes("Diese Folie als Zusammenfassung zeigen, bevor es zu den nächsten Schritten geht.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Nächste Schritte
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  sectionTag(s, "JETZT STARTEN", 0.55, 0.38);

  s.addText("Schulweiter Rollout — sofort.", { x: 0.5, y: 0.82, w: 9, h: 0.7, fontSize: 36, bold: true, color: NAVY, fontFace: "Cambria", margin: 0 });

  s.addText(
    "Der Hauspokal ist fertig und läuft. Alle interessierten Lehrkräfte können ihn ab sofort nutzen — " +
    "kein Aufwand, keine Installation, kein Warten.",
    { x: 0.5, y: 1.58, w: 9, h: 0.55, fontSize: 13, color: MUTED, fontFace: "Calibri", margin: 0 }
  );

  const points = [
    { icon: "✅", text: "Einfach einloggen — Zugang auf Anfrage sofort verfügbar" },
    { icon: "✅", text: "Spiele & Tools direkt im nächsten Unterricht einsetzen" },
    { icon: "✅", text: "Häuser & Punkte schulweit nutzen, sobald das Kollegium startet" },
    { icon: "✅", text: "Kein Vorwissen nötig — 5 Minuten reichen zum Einstieg" },
  ];

  points.forEach((p, i) => {
    const y = 2.35 + i * 0.62;
    s.addShape(pres.shapes.OVAL, { x: 0.5, y, w: 0.44, h: 0.44, fill: { color: ORANGE }, line: { color: ORANGE } });
    s.addText(p.icon, { x: 0.5, y, w: 0.44, h: 0.44, fontSize: 14, align: "center", valign: "middle", margin: 0 });
    s.addText(p.text, { x: 1.08, y: y + 0.02, w: 8.4, h: 0.42, fontSize: 13, color: NAVY, fontFace: "Calibri", valign: "middle", margin: 0 });
  });

  // CTA bar
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 4.72, w: 9, h: 0.44, fill: { color: ORANGE }, line: { color: ORANGE }, rectRadius: 0.1 });
  s.addText("Wer möchte loslegen? — Einfach melden, Zugang ist sofort da.", {
    x: 0.5, y: 4.72, w: 9, h: 0.44, fontSize: 13.5, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle", margin: 0,
  });

  s.addNotes("Keine Pilotphase, kein Rollout-Plan — einfach starten. Wer Interesse hat, bekommt sofort Zugang.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 11 — Ausblick / Erweiterungen
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  sectionTag(s, "AUSBLICK", 0.55, 0.38);

  s.addText("Was als Nächstes kommt", { x: 0.5, y: 0.82, w: 9, h: 0.7, fontSize: 36, bold: true, color: NAVY, fontFace: "Cambria", margin: 0 });
  s.addText("Drei geplante Erweiterungen, die den Hauspokal noch tiefer in den Schulalltag integrieren.", {
    x: 0.5, y: 1.58, w: 9, h: 0.42, fontSize: 12, color: MUTED, fontFace: "Calibri", margin: 0,
  });

  const extensions = [
    {
      icon: "🔧",
      name: "Werkstatteinwahl",
      desc: "Schülerinnen und Schüler wählen Werkstätten, AGs oder Wahlkurse direkt über die Plattform — übersichtlich, konfliktfrei und ohne Papierlisten.",
      status: "In Planung",
    },
    {
      icon: "🍽",
      name: "Mittagsbandeinwahl",
      desc: "Digitale Anmeldung für Mittagsangebote und Betreuungsbänder. Kapazitäten werden automatisch verwaltet, Überbuchungen vermieden.",
      status: "In Planung",
    },
    {
      icon: "📋",
      name: "Übersicht & Dashboard",
      desc: "Ein zentrales Schul-Dashboard für Schulleitung und Kollegium: Punktestände, Teilnahme, Aktivität und Nutzungsstatistiken auf einen Blick.",
      status: "In Planung",
    },
  ];

  extensions.forEach((ext, i) => {
    const x = 0.48 + i * 3.07;
    // Card with left accent stripe via colored header
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.15, w: 2.85, h: 2.85, fill: { color: LIGHT }, line: { color: LIGHT }, rectRadius: 0.12, shadow: makeShadow() });
    // Colored icon circle
    s.addShape(pres.shapes.OVAL, { x: x + 1.07, y: 2.05, w: 0.72, h: 0.72, fill: { color: NAVY }, line: { color: NAVY } });
    s.addText(ext.icon, { x: x + 1.07, y: 2.05, w: 0.72, h: 0.72, fontSize: 22, align: "center", valign: "middle", margin: 0 });
    s.addText(ext.name, { x: x + 0.18, y: 2.88, w: 2.5, h: 0.44, fontSize: 14, bold: true, color: NAVY, fontFace: "Calibri", align: "center", margin: 0 });
    s.addText(ext.desc, { x: x + 0.2, y: 3.36, w: 2.45, h: 1.25, fontSize: 10.5, color: MUTED, fontFace: "Calibri", margin: 0 });
    // Status badge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.6, y: 4.68, w: 1.65, h: 0.26, fill: { color: ORANGE }, line: { color: ORANGE }, rectRadius: 0.06 });
    s.addText(ext.status, { x: x + 0.6, y: 4.68, w: 1.65, h: 0.26, fontSize: 8.5, bold: true, color: WHITE, fontFace: "Calibri", align: "center", valign: "middle", margin: 0 });
  });

  s.addNotes("Diese Erweiterungen zeigen, dass Hauspokal kein Einmalprojekt ist, sondern eine wachsende Plattform für die Schule.");
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 12 — Danke / Fragen
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  // Background circles
  s.addShape(pres.shapes.OVAL, { x: 6.5, y: -0.5, w: 4.5, h: 4.5, fill: { color: NAVY, transparency: 30 }, line: { color: NAVY, transparency: 30 } });
  s.addShape(pres.shapes.OVAL, { x: -0.5, y: 3.5, w: 3.0, h: 3.0, fill: { color: ORANGE, transparency: 70 }, line: { color: ORANGE, transparency: 70 } });

  s.addText("🏆", { x: 3.5, y: 0.55, w: 3, h: 1.3, fontSize: 72, align: "center", margin: 0 });
  s.addText("Danke für Ihre Aufmerksamkeit!", { x: 0.8, y: 1.95, w: 8.4, h: 0.75, fontSize: 30, bold: true, color: WHITE, fontFace: "Cambria", align: "center", margin: 0 });
  s.addText("Fragen & Diskussion", { x: 0.8, y: 2.78, w: 8.4, h: 0.5, fontSize: 18, color: ORANGE, fontFace: "Calibri", italic: true, align: "center", margin: 0 });

  // Contact info card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.8, y: 3.45, w: 4.4, h: 1.5, fill: { color: "1E3A7A" }, line: { color: "2A4A8A" }, rectRadius: 0.12 });
  s.addText("Zugang & Fragen:", { x: 3.0, y: 3.6, w: 4.0, h: 0.36, fontSize: 11, color: CREAM, fontFace: "Calibri", align: "center", margin: 0 });
  s.addText("🌐  hauspokal.ege-potsdam.de", { x: 3.0, y: 4.0, w: 4.0, h: 0.32, fontSize: 12, bold: true, color: ORANGE, fontFace: "Calibri", align: "center", margin: 0 });
  s.addText("Schulinterne Anmeldedaten nach Pilotstart", { x: 3.0, y: 4.35, w: 4.0, h: 0.36, fontSize: 10, color: CREAM, fontFace: "Calibri", align: "center", margin: 0 });

  s.addNotes("Zeit für Fragen lassen. Häufige Einwände: Zeitaufwand (minimal), Technik (läuft auf Schul-WLAN), Datenschutz (bereits geklärt).");
}

// ── Write file ────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: "Hauspokal-Pitch.pptx" }).then(() => {
  console.log("✅  Hauspokal-Pitch.pptx created");
}).catch(console.error);
