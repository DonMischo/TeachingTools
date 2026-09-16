/**
 * Der Kodex als PDF: jeder Himmelskörper mit Foto, Zahlen und Besonderheiten,
 * die Monde unter ihrem Planeten, am Ende die Bildnachweise.
 *
 * jsPDF wird erst beim Klick geladen. Die eingebaute Schrift (Helvetica) kann
 * nur Windows-1252 — Hochzahlen, Minuszeichen und Emoji werden deshalb vorher
 * in darstellbare Zeichen übersetzt (`fuerPdf`).
 */
import { KOERPER, type Koerper } from "@/lib/sonnensystem/daten";
import { foto } from "@/lib/sonnensystem/bilder";
import { KODEX_GRUPPEN, artZeile, datenZeilen } from "@/lib/sonnensystem/kodex";

const HOCH: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
/** Geschützte und schmale Leerzeichen, als Zeichencodes. */
const LEERZEICHEN = [0xa0, 0x202f, 0x2009];
const WINDOWS_1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Übersetzt Text in Zeichen, die die PDF-Standardschrift kennt. */
export function fuerPdf(text: string): string {
  const ersetzt = text
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, m => `^${[...m].map(c => HOCH[c]).join("")}`)
    .replace(/[−‒]/g, "-")
    .replace(/≈/g, "ca. ")
    .replace(/→/g, "->");
  // Zeichen per Code prüfen statt per Regex-Bereich: getippte Escapes landen hier sonst als echte Steuerzeichen.
  return [...ersetzt]
    .map(c => (LEERZEICHEN.includes(c.charCodeAt(0)) ? " " : c))
    .filter(c => c.charCodeAt(0) <= 0xff || WINDOWS_1252_EXTRA.includes(c))
    .join("")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** Lädt ein Foto und schneidet die Planetenscheibe quadratisch aus — als JPEG für das PDF. */
async function bildDaten(k: Koerper, kante = 420): Promise<string | null> {
  const n = foto(k.id);
  if (!n) return null;
  const img = new Image();
  img.src = n.datei;
  try { await img.decode(); } catch { return null; }
  const c = document.createElement("canvas");
  c.width = c.height = kante;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#000";
  g.fillRect(0, 0, kante, kante);
  const s = n.scheibe;
  // Etwas Rand um die Scheibe; Saturn samt Ringen.
  const d = s ? Math.min(img.naturalWidth, (s.d * (k.id === "saturn" ? 2.5 : 1.12)) * img.naturalWidth) : Math.min(img.naturalWidth, img.naturalHeight);
  const cx = s ? s.x * img.naturalWidth : img.naturalWidth / 2;
  const cy = s ? s.y * img.naturalHeight : img.naturalHeight / 2;
  g.drawImage(img, cx - d / 2, cy - d / 2, d, d, 0, 0, kante, kante);
  return c.toDataURL("image/jpeg", 0.86);
}

/** Baut das PDF und gibt es zurück — getrennt vom Speichern, damit es prüfbar ist. */
export async function baueKodexPdf(onFortschritt?: (anteil: number) => void) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const B = 210, H = 297, RAND = 18, BREITE = B - 2 * RAND;
  let y = RAND;

  const schrift = (groesse: number, stil: "normal" | "bold" = "normal", farbe = 30) => {
    doc.setFont("helvetica", stil);
    doc.setFontSize(groesse);
    doc.setTextColor(farbe);
  };
  const platz = (hoehe: number) => { if (y + hoehe > H - RAND) { doc.addPage(); y = RAND; } };
  const absatz = (text: string, x: number, breite: number, groesse = 10, zeile = 4.6) => {
    schrift(groesse);
    for (const z of doc.splitTextToSize(fuerPdf(text), breite) as string[]) {
      platz(zeile);
      doc.text(z, x, y);
      y += zeile;
    }
  };
  const tabelle = (zeilen: [string, string][], x: number, breite: number, groesse = 9.5) => {
    const spalte = 42;
    for (const [name, wert] of zeilen) {
      schrift(groesse);
      const teile = doc.splitTextToSize(fuerPdf(wert), breite - spalte) as string[];
      platz(teile.length * 4.4 + 1);
      schrift(groesse, "bold", 90);
      doc.text(fuerPdf(name), x, y);
      schrift(groesse, "normal", 30);
      teile.forEach((t, i) => doc.text(t, x + spalte, y + i * 4.4));
      y += teile.length * 4.4 + 1;
    }
  };
  const fakten = (liste: string[], x: number, breite: number) => {
    for (const f of liste) {
      schrift(9.5);
      const teile = doc.splitTextToSize(fuerPdf(f), breite - 5) as string[];
      platz(teile.length * 4.4 + 1.5);
      doc.text("•", x, y);
      teile.forEach((t, i) => doc.text(t, x + 4, y + i * 4.4));
      y += teile.length * 4.4 + 1.5;
    }
  };

  // ── Titelseite ──
  doc.setFillColor(8, 12, 28);
  doc.rect(0, 0, B, H, "F");
  schrift(30, "bold", 255);
  doc.text("Kodex des Sonnensystems", RAND, 70);
  schrift(13, "normal", 200);
  doc.text(fuerPdf("Sonne, Planeten, Zwergplaneten und ihre wichtigsten Monde —"), RAND, 82);
  doc.text(fuerPdf("mit Fotos, Zahlen und Besonderheiten."), RAND, 89);
  schrift(10, "normal", 160);
  doc.text(fuerPdf(`Stand: ${new Date().toLocaleDateString("de-DE")} · Simulation »Sonnensystem«`), RAND, 102);
  y = 125;
  schrift(11, "bold", 230);
  doc.text("Inhalt", RAND, y);
  y += 7;
  for (const g of KODEX_GRUPPEN) {
    schrift(10, "normal", 200);
    const monde = g.monde.length ? `  —  ${g.monde.map(m => m.name).join(", ")}` : "";
    const zeilen = doc.splitTextToSize(fuerPdf(`${g.haupt.name}${monde}`), BREITE) as string[];
    zeilen.forEach(z => { doc.text(z, RAND, y); y += 5; });
  }

  // ── Je Hauptkörper eine neue Seite, die Monde folgen darunter ──
  let fertig = 0;
  for (const g of KODEX_GRUPPEN) {
    doc.addPage();
    y = RAND;
    const k = g.haupt;
    const bild = await bildDaten(k);
    const bildKante = 58;
    if (bild) doc.addImage(bild, "JPEG", B - RAND - bildKante, y, bildKante, bildKante);
    schrift(9, "bold", 110);
    doc.text(fuerPdf(artZeile(k)).toUpperCase(), RAND, y + 4);
    schrift(24, "bold", 20);
    doc.text(fuerPdf(k.name), RAND, y + 14);
    y += 22;
    const textBreite = BREITE - bildKante - 6;
    tabelle(datenZeilen(k), RAND, textBreite);
    y = Math.max(y, RAND + bildKante + 4) + 3;
    absatz(k.intro, RAND, BREITE, 10.5, 5);
    y += 2;
    platz(8);
    schrift(11, "bold", 40);
    doc.text("Erstaunlich", RAND, y);
    y += 5.5;
    fakten(k.fakten, RAND, BREITE);
    onFortschritt?.(++fertig / KOERPER.length);

    if (g.monde.length) {
      y += 3;
      platz(12);
      schrift(13, "bold", 40);
      doc.text(fuerPdf(`Monde von ${k.name}`), RAND, y);
      y += 3;
      doc.setDrawColor(200);
      doc.line(RAND, y, B - RAND, y);
      y += 6;
      for (const m of g.monde) {
        const mondBild = await bildDaten(m, 260);
        const kante = 30;
        platz(kante + 6);
        const oben = y;
        if (mondBild) doc.addImage(mondBild, "JPEG", RAND, y - 3, kante, kante);
        const x = RAND + kante + 5;
        const breite = BREITE - kante - 5;
        schrift(13, "bold", 20);
        doc.text(fuerPdf(m.name), x, y + 2);
        y += 7;
        tabelle(datenZeilen(m, true), x, breite, 9);
        absatz(m.intro, x, breite, 9.5, 4.4);
        fakten(m.fakten, x, breite);
        y = Math.max(y, oben + kante) + 5;
        onFortschritt?.(++fertig / KOERPER.length);
      }
    }
  }

  // ── Bildnachweise ──
  doc.addPage();
  y = RAND;
  schrift(16, "bold", 20);
  doc.text("Bildnachweise", RAND, y);
  y += 8;
  absatz("Alle Fotos über Wikimedia Commons, verkleinert und zugeschnitten. Die Lizenz steht jeweils dabei; die Originale sind unter dem angegebenen Dateinamen auf commons.wikimedia.org zu finden.", RAND, BREITE, 9, 4.2);
  y += 2;
  for (const k of KOERPER) {
    const n = foto(k.id);
    if (!n) continue;
    absatz(`${k.name}: ${n.urheber} — ${n.lizenz} — Datei: ${n.titel}`, RAND, BREITE, 8.5, 4);
    y += 1;
  }

  // Seitenzahlen, außer auf der Titelseite.
  const seiten = doc.getNumberOfPages();
  for (let s = 2; s <= seiten; s++) {
    doc.setPage(s);
    schrift(8, "normal", 140);
    doc.text(`Kodex des Sonnensystems · Seite ${s} von ${seiten}`, B / 2, H - 8, { align: "center" });
  }

  return doc;
}

export async function kodexAlsPdf(onFortschritt?: (anteil: number) => void): Promise<void> {
  const doc = await baueKodexPdf(onFortschritt);
  doc.save("Kodex-Sonnensystem.pdf");
}
