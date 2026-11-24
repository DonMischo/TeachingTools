/**
 * Spickzettel fürs Markieren & Bearbeiten — als Tabelle auf der Seite und als
 * PDF zum Ausdrucken (eine A4-Seite, Tastenkappen gezeichnet).
 *
 * »[[Strg]]« wird zur Tastenkappe. Pfeile zeichnet das PDF selbst: die
 * Standardschrift (Windows-1252) kennt ← → ↑ ↓ nicht.
 */
import { nurWindows1252 } from "@/lib/pdfText";

export type SpickGruppe = { titel: string; icon: string; zeilen: [string, string][] };

export const SPICKZETTEL: SpickGruppe[] = [
  {
    icon: "🖱️", titel: "Markieren mit der Maus",
    zeilen: [
      ["Doppelklick", "ein Wort"],
      ["Dreifachklick", "eine Zeile (in Word: ein Absatz)"],
      ["Ziehen mit gedrückter Taste", "beliebiges Stück"],
      ["Klick, dann [[Umschalt]] + Klick", "von der ersten bis zur zweiten Stelle"],
    ],
  },
  {
    icon: "⌨️", titel: "Markieren mit der Tastatur",
    zeilen: [
      ["[[Umschalt]] + [[←]] / [[→]]", "Buchstabe für Buchstabe"],
      ["[[Strg]] + [[Umschalt]] + [[←]] / [[→]]", "Wort für Wort"],
      ["[[Umschalt]] + [[Pos1]] / [[Ende]]", "bis zum Zeilenanfang / Zeilenende"],
      ["[[Umschalt]] + [[↑]] / [[↓]]", "Zeile für Zeile"],
      ["[[Strg]] + [[A]]", "alles"],
    ],
  },
  {
    icon: "↔️", titel: "Cursor bewegen",
    zeilen: [
      ["[[Pos1]] / [[Ende]]", "Anfang / Ende der Zeile"],
      ["[[Strg]] + [[←]] / [[→]]", "ein Wort zurück / weiter"],
      ["[[Strg]] + [[Pos1]] / [[Ende]]", "Anfang / Ende des ganzen Textes"],
    ],
  },
  {
    icon: "✂️", titel: "Bearbeiten",
    zeilen: [
      ["[[Strg]] + [[C]]", "kopieren"],
      ["[[Strg]] + [[X]]", "ausschneiden"],
      ["[[Strg]] + [[V]]", "einfügen"],
      ["[[Strg]] + [[Z]]", "rückgängig"],
      ["[[Entf]] / [[Rücktaste]]", "löschen rechts / links vom Cursor (oder die Markierung)"],
      ["markieren und tippen", "ersetzt das Markierte"],
    ],
  },
  {
    icon: "🔣", titel: "Sonderzeichen",
    zeilen: [
      ["[[Umschalt]] + Buchstabe", "Großbuchstabe (aus ä wird Ä)"],
      ["[[Feststelltaste]]", "alles groß — danach wieder aus!"],
      ["[[Umschalt]] + [[1]] … [[0]]", "! \" § $ % & / ( ) ="],
      ["[[AltGr]] + [[Q]] / [[E]]", "@ / €"],
      ["[[AltGr]] + [[2]] / [[3]]", "² / ³"],
      ["[[AltGr]] + [[7]] … [[0]]", "{ [ ] }"],
      ["[[AltGr]] + [[ß]] / [[+]] / [[<]]", "\\ / ~ / |"],
      ["[[Umschalt]] + [[^]]", "° (Grad)"],
    ],
  },
];

type Teil = { taste: boolean; text: string };

/** »[[Strg]] + [[C]]« → Kappen und Text dazwischen. */
export function teile(kombi: string): Teil[] {
  return kombi.split(/\[\[(.+?)\]\]/).map((text, i) => ({ taste: i % 2 === 1, text })).filter(t => t.text);
}

const PFEILE: Record<string, number> = { "←": 180, "→": 0, "↑": 270, "↓": 90 };

/** Baut das PDF (A4 hoch, zwei Spalten). */
export async function spickzettelPdf() {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const RAND = 14, LUECKE = 8, SPALTE = (210 - 2 * RAND - LUECKE) / 2, ZEILE = 7.4;
  const pdf = (s: string) => nurWindows1252(s);

  doc.setFont("helvetica", "bold").setFontSize(18).text(pdf("Spickzettel: Markieren & Bearbeiten"), RAND, 18);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100).text(pdf("TT - Teaching Tools · Mac: statt Strg die Taste cmd"), RAND, 24);
  doc.setTextColor(0);

  /** Eine Kappe zeichnen; liefert die Breite. */
  const kappe = (x: number, y: number, text: string): number => {
    const pfeil = PFEILE[text];
    doc.setFont("helvetica", "bold").setFontSize(8.5);
    const b = pfeil !== undefined ? 6 : Math.max(6, doc.getTextWidth(pdf(text)) + 3);
    doc.setDrawColor(37, 99, 235).setFillColor(239, 246, 255).setLineWidth(0.35);
    doc.roundedRect(x, y - 4, b, 5.4, 1, 1, "FD");
    if (pfeil !== undefined) {
      const mx = x + b / 2, my = y - 1.3, l = 1.8, rad = (pfeil * Math.PI) / 180;
      const dx = Math.cos(rad), dy = Math.sin(rad);
      doc.setDrawColor(15, 23, 42).setLineWidth(0.4);
      doc.line(mx - dx * l, my - dy * l, mx + dx * l, my + dy * l);
      const sx = mx + dx * l, sy = my + dy * l, k = 1.1;
      doc.setFillColor(15, 23, 42);
      doc.triangle(sx + dx * 0.4, sy + dy * 0.4, sx - dx * k - dy * k, sy - dy * k + dx * k, sx - dx * k + dy * k, sy - dy * k - dx * k, "F");
    } else {
      doc.setTextColor(15, 23, 42).text(pdf(text), x + b / 2, y, { align: "center" });
    }
    return b;
  };

  let spalte = 0, y = 34;
  const x0 = () => RAND + spalte * (SPALTE + LUECKE);
  for (const g of SPICKZETTEL) {
    const hoehe = 9 + g.zeilen.length * ZEILE * 1.35;
    if (y + hoehe > 285 && spalte === 0) { spalte = 1; y = 34; }
    const x = x0();
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(0).text(pdf(g.titel), x, y);
    doc.setDrawColor(200).setLineWidth(0.3).line(x, y + 1.5, x + SPALTE, y + 1.5);
    y += 8;
    for (const [kombi, was] of g.zeilen) {
      let cx = x;
      for (const t of teile(kombi)) {
        if (t.taste) cx += kappe(cx, y, t.text) + 1;
        else {
          doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60);
          doc.text(pdf(t.text), cx, y);
          cx += doc.getTextWidth(pdf(t.text)) + 1;
        }
      }
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(0);
      const links = x + SPALTE * 0.52;
      const zeilen: string[] = doc.splitTextToSize(pdf(was), SPALTE * 0.48);
      // Kombination zu lang für die linke Hälfte: Beschreibung in die nächste Zeile
      const unter = cx > links - 1;
      const ty = unter ? y + ZEILE * 0.8 : y;
      doc.text(zeilen, unter ? x + 4 : links, ty);
      y = ty + ZEILE * Math.max(1, zeilen.length * 0.7) + 1.5;
    }
    y += 5;
  }
  return doc;
}

export async function speichereSpickzettelPdf() {
  (await spickzettelPdf()).save("Spickzettel_Markieren.pdf");
}
