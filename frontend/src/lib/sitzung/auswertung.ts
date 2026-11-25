/**
 * Auswertung einer Sitzung: Kennzahlen, schwerste Aufgaben und eine Tabelle je
 * Person — einmal berechnet, gleich für Anzeige, CSV, PDF und DOCX.
 * Eingabe sind die Zeilen der Übersicht (oder eines Adapters, z. B. TaskCrawler)
 * und die SitzungAnsicht des Werkzeugs.
 */
import type { SitzungZeile } from "@/lib/api";
import { fortschrittVon, zelle, type SitzungAnsicht } from "./typen";

export interface Kennzahlen {
  teilnehmende: number;
  fertig: number;
  /** Ø-Fortschritt 0–1, wenn das Werkzeug einen kennt */
  fortschritt: number | null;
  /** Ø-Minuten zwischen Beitritt und letzter Meldung */
  minuten: number | null;
}

export interface AufgabenQuote { id: string; titel: string; geschafft: number; quote: number }

export interface Auswertung {
  kennzahlen: Kennzahlen;
  schwerste: AufgabenQuote[];
  kopf: string[];
  tabelle: string[][];
}

const prozent = (x: number) => `${Math.round(x * 100)} %`;

export function auswerten(zeilen: SitzungZeile[], ansicht?: SitzungAnsicht): Auswertung {
  const n = zeilen.length;
  const fort = zeilen.map(z => fortschrittVon(ansicht, z.daten)).filter((x): x is number => x != null);
  const dauer = zeilen.map(z => (new Date(z.aktualisiert_am).getTime() - new Date(z.beigetreten_am).getTime()) / 60000)
    .filter(m => Number.isFinite(m) && m >= 0);
  const kennzahlen: Kennzahlen = {
    teilnehmende: n,
    fertig: zeilen.filter(z => z.fertig_am).length,
    fortschritt: fort.length ? fort.reduce((a, b) => a + b, 0) / fort.length : null,
    minuten: dauer.length ? Math.round(dauer.reduce((a, b) => a + b, 0) / dauer.length) : null,
  };

  const schwerste = n && ansicht?.aufgaben && ansicht.geschafft
    ? ansicht.aufgaben.map(a => {
      const geschafft = zeilen.filter(z => ansicht.geschafft!(z.daten, a.id)).length;
      return { id: a.id, titel: a.titel, geschafft, quote: geschafft / n };
    }).sort((a, b) => a.quote - b.quote).slice(0, 5)
    : [];

  const spalten = ansicht?.spalten ?? [];
  const mitFortschritt = fort.length > 0;
  const kopf = ["Name", "Klasse", ...(mitFortschritt ? ["Fortschritt"] : []), ...spalten.map(s => s.titel), "Gerade", "Fertig"];
  const tabelle = zeilen.map(z => {
    const f = fortschrittVon(ansicht, z.daten);
    return [
      z.gast ? `${z.name} (Gast)` : z.name,
      z.klasse ?? "",
      ...(mitFortschritt ? [f == null ? "" : prozent(f)] : []),
      ...spalten.map(s => zelle(s, z.daten)),
      z.aktuell ?? "",
      z.fertig_am ? "ja" : "",
    ];
  });
  return { kennzahlen, schwerste, kopf, tabelle };
}

export function kennzahlenText(k: Kennzahlen): string[] {
  return [
    `${k.teilnehmende} Teilnehmende, davon ${k.fertig} fertig`,
    ...(k.fortschritt != null ? [`Ø Fortschritt ${prozent(k.fortschritt)}`] : []),
    ...(k.minuten != null ? [`Ø ${k.minuten} Min. dabei`] : []),
  ];
}

const dateiname = (titel: string, endung: string) =>
  `${titel.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "") || "auswertung"}_${new Date().toISOString().slice(0, 10)}.${endung}`;

/** CSV mit `;` und BOM — so öffnet Excel Umlaute und Spalten richtig. */
export function alsCsv(a: Auswertung): string {
  const feld = (t: string) => (/[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  return String.fromCharCode(0xfeff) + [a.kopf, ...a.tabelle].map(z => z.map(feld).join(";")).join("\r\n");
}

async function laden(blob: Blob, name: string) {
  const { herunterladen } = await import("@/lib/docx");
  herunterladen(blob, name);
}

export async function csvHerunterladen(titel: string, a: Auswertung) {
  await laden(new Blob([alsCsv(a)], { type: "text/csv;charset=utf-8" }), dateiname(titel, "csv"));
}

export async function docxHerunterladen(titel: string, a: Auswertung) {
  const { baueDocx } = await import("@/lib/docx");
  const blob = await baueDocx([
    { art: "titel", text: `Auswertung: ${titel}` },
    { art: "text", text: new Date().toLocaleString("de-DE"), grau: true, klein: true },
    ...kennzahlenText(a.kennzahlen).map(t => ({ art: "text" as const, text: t })),
    ...(a.schwerste.length ? [
      { art: "ueberschrift" as const, text: "Am schwersten" },
      { art: "tabelle" as const, kopf: ["Aufgabe", "geschafft"], zeilen: a.schwerste.map(s => [s.titel, `${s.geschafft} (${prozent(s.quote)})`]) },
    ] : []),
    { art: "ueberschrift", text: "Je Person" },
    { art: "tabelle", kopf: a.kopf, zeilen: a.tabelle },
  ]);
  await laden(blob, dateiname(titel, "docx"));
}

export async function pdfHerunterladen(titel: string, a: Auswertung) {
  const { jsPDF } = await import("jspdf");
  const { nurWindows1252 } = await import("@/lib/pdfText");
  const t = (s: string) => nurWindows1252(s);
  const quer = a.kopf.length > 6;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: quer ? "landscape" : "portrait" });
  const breite = doc.internal.pageSize.getWidth(), hoehe = doc.internal.pageSize.getHeight(), rand = 14;
  let y = rand + 4;
  doc.setFont("helvetica", "bold").setFontSize(16).text(t(`Auswertung: ${titel}`), rand, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110).text(t(new Date().toLocaleString("de-DE")), rand, y);
  doc.setTextColor(0).setFontSize(11);
  y += 8;
  for (const zeile of kennzahlenText(a.kennzahlen)) { doc.text(t(zeile), rand, y); y += 5.5; }
  if (a.schwerste.length) {
    y += 3;
    doc.setFont("helvetica", "bold").text(t("Am schwersten"), rand, y);
    doc.setFont("helvetica", "normal");
    y += 5.5;
    for (const s of a.schwerste) { doc.text(t(`${s.titel}: ${s.geschafft} geschafft (${prozent(s.quote)})`), rand + 2, y); y += 5; }
  }
  // Tabelle: gleich breite Spalten, Name doppelt so breit
  y += 5;
  const gewichte = a.kopf.map((_, i) => (i === 0 ? 2 : 1));
  const einheit = (breite - 2 * rand) / gewichte.reduce((x, g) => x + g, 0);
  const xs = gewichte.reduce<number[]>((acc, g, i) => [...acc, (acc[i] ?? rand) + g * einheit], [rand]);
  const zeile = (werte: string[], fett: boolean) => {
    if (y > hoehe - rand) { doc.addPage(); y = rand + 4; }
    doc.setFont("helvetica", fett ? "bold" : "normal").setFontSize(8.5);
    werte.forEach((w, i) => {
      const platz = gewichte[i] * einheit - 1.5;
      doc.text(doc.splitTextToSize(t(w), platz)[0] ?? "", xs[i], y);
    });
    doc.setDrawColor(210).line(rand, y + 1.5, breite - rand, y + 1.5);
    y += 6;
  };
  zeile(a.kopf, true);
  for (const z of a.tabelle) zeile(z, false);
  await laden(doc.output("blob"), dateiname(titel, "pdf"));
}
