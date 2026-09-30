/**
 * Ergebnissicherung eines TaskCrawlers als PDF: die Merksätze aller Aufgaben
 * (Feld "ergebnissicherung" an den Folien), je Abschnitt gruppiert, als
 * gestaltete Karten. Der Server liefert sie erst mit /finish.
 *
 * jsPDF wird erst beim Klick geladen. Die eingebaute Schrift kennt nur
 * Windows-1252 — Formeln ($…$) werden deshalb in lesbaren Klartext übersetzt
 * (`klartext`), statt sie als Bild zu setzen: so bleibt der Text scharf und kopierbar.
 */
import { nurWindows1252 } from "@/lib/pdfText";

export interface SicherungsEintrag { titel: string; text: string }
export interface SicherungsAbschnitt { abschnitt: number; titel: string; eintraege: SicherungsEintrag[] }

export interface ErgebnisDaten {
  titel: string;
  abschnitte: SicherungsAbschnitt[];
  name?: string;
  datum?: Date;
  /** Akzentfarbe des Spiels, z. B. "#d97706" */
  akzent?: string;
}

const GRIECHISCH: Record<string, string> = {
  alpha: "alpha", beta: "beta", gamma: "gamma", delta: "delta", pi: "pi", rho: "rho", sigma: "sigma",
  lambda: "lambda", mu: "µ", omega: "omega", phi: "phi", theta: "theta", Delta: "Delta",
};
const ZEICHEN: Record<string, string> = {
  cdot: "·", times: "×", div: ":", pm: "±", le: "<=", leq: "<=", ge: ">=", geq: ">=", neq: "!=", ne: "!=",
  approx: "ca.", to: "->", rightarrow: "->", Rightarrow: "=>", Leftrightarrow: "<=>", infty: "unendlich",
  degree: "°", circ: "°", ldots: "…", dots: "…", quad: " ", qquad: "  ",
};
const HOCH: Record<string, string> = { "1": "¹", "2": "²", "3": "³" };

/** Eine Formel (Inhalt zwischen $…$) als lesbarer Text */
export function formelText(f: string): string {
  let s = f;
  // Befehle mit Inhalt, von innen nach außen
  for (let i = 0; i < 8; i++) {
    const vorher = s;
    s = s
      .replace(/\\(?:text|mathrm|mathbf|textbf|operatorname)\{([^{}]*)\}/g, "$1")
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, z: string, n: string) => {
        const k = (t: string) => (/^[\w.,²³¹°]+$/.test(t.trim()) ? t.trim() : `(${t.trim()})`);
        return `${k(z)}/${k(n)}`;
      })
      .replace(/\\sqrt\{([^{}]*)\}/g, "Wurzel($1)")
      .replace(/\^\{([^{}]*)\}/g, (_, e: string) => (HOCH[e.trim()] ?? `^(${e.trim()})`))
      .replace(/_\{([^{}]*)\}/g, "_$1");
    if (s === vorher) break;
  }
  s = s
    .replace(/\^([123])(?![0-9])/g, (_, e: string) => HOCH[e])
    .replace(/\\left|\\right/g, "")
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\\%/g, "%")
    .replace(/\\([A-Za-z]+)/g, (_, w: string) => ZEICHEN[w] ?? GRIECHISCH[w] ?? w)
    .replace(/[{}]/g, "")
    .replace(/\s*([=<>+])\s*/g, " $1 ")
    .replace(/ {2,}/g, " ");
  return s.trim();
}

/** Text mit $Formeln$ und **fett** als Klartext für das PDF */
export function klartext(text: string): string {
  const mitFormeln = text.replace(/\$\$([^$]+)\$\$|\$([^$]+)\$/g, (_, a?: string, b?: string) => formelText(a ?? b ?? ""));
  return nurWindows1252(mitFormeln.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/[−‒]/g, "-").replace(/≈/g, "ca.").replace(/→/g, "->"));
}

function farbe(hex: string | undefined): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? "");
  const h = m ? parseInt(m[1], 16) : 0xd97706;
  return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
}

/** Baut das PDF (ohne zu speichern — so ist es prüfbar) */
export async function baueErgebnisPdf(d: ErgebnisDaten) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const B = 210, H = 297, RAND = 18, BREITE = B - 2 * RAND, FUSS = 14;
  const akzent = farbe(d.akzent);
  const hell = akzent.map(c => Math.round(c + (255 - c) * 0.9)) as [number, number, number];
  let y = RAND;

  const schrift = (groesse: number, stil: "normal" | "bold" | "italic" = "normal", rgb: [number, number, number] = [30, 30, 30]) => {
    doc.setFont("helvetica", stil);
    doc.setFontSize(groesse);
    doc.setTextColor(...rgb);
  };
  const neueSeite = () => { doc.addPage(); y = RAND; };
  const platz = (hoehe: number) => { if (y + hoehe > H - RAND - FUSS) neueSeite(); };

  // ── Kopf ──
  doc.setFillColor(...akzent);
  doc.rect(0, 0, B, 38, "F");
  schrift(22, "bold", [255, 255, 255]);
  doc.text("Ergebnissicherung", RAND, 17);
  schrift(12, "normal", [255, 255, 255]);
  const titelZeilen = doc.splitTextToSize(klartext(d.titel || "TaskCrawler"), BREITE - 55) as string[];
  doc.text(titelZeilen.slice(0, 2), RAND, 25);
  schrift(9.5, "normal", [255, 255, 255]);
  const datum = (d.datum ?? new Date()).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.text([d.name ? klartext(d.name) : "", datum].filter(Boolean), B - RAND, 17, { align: "right" });
  y = 50;
  schrift(10, "italic", [90, 90, 90]);
  doc.text("Das solltest du dir aus diesem TaskCrawler merken.", RAND, y);
  y += 9;

  let nr = 0;
  for (const ab of d.abschnitte) {
    // ── Abschnitt ──
    platz(20);
    schrift(13, "bold", akzent);
    doc.text(`Abschnitt ${ab.abschnitt}`, RAND, y);
    if (ab.titel) {
      const breiteAb = doc.getTextWidth(`Abschnitt ${ab.abschnitt}`);
      schrift(10.5, "normal", [110, 110, 110]);
      doc.text(doc.splitTextToSize(`·  ${klartext(ab.titel)}`, BREITE - breiteAb - 4)[0] as string, RAND + breiteAb + 3, y);
    }
    y += 2.5;
    doc.setDrawColor(...akzent);
    doc.setLineWidth(0.4);
    doc.line(RAND, y, B - RAND, y);
    y += 6;

    // ── Karten ──
    for (const e of ab.eintraege) {
      nr += 1;
      const innen = BREITE - 16;
      schrift(10.5);
      const zeilen: { text: string; einzug: number; fett?: boolean }[] = [];
      if (e.titel) {
        schrift(11, "bold");
        for (const z of doc.splitTextToSize(klartext(e.titel), innen) as string[]) zeilen.push({ text: z, einzug: 0, fett: true });
        schrift(10.5);
      }
      for (const absatz of e.text.split(/\n/)) {
        const aufzaehlung = /^\s*[-*•]\s+/.test(absatz);
        const roh = klartext(absatz.replace(/^\s*[-*•]\s+/, ""));
        if (!roh) { zeilen.push({ text: "", einzug: 0 }); continue; }
        const teile = doc.splitTextToSize(roh, innen - (aufzaehlung ? 5 : 0)) as string[];
        teile.forEach((z, k) => zeilen.push({ text: (aufzaehlung && k === 0 ? "•  " : "") + z, einzug: aufzaehlung && k > 0 ? 3.6 : 0 }));
      }
      const ZEILE = 5.2, POLSTER = 4.5;
      const hoehe = zeilen.length * ZEILE + 2 * POLSTER - 1.5;
      platz(Math.min(hoehe, 60));
      // Karte: heller Grund, Akzentleiste, Nummer
      const oben = y;
      const sichtbar = Math.min(hoehe, H - RAND - FUSS - oben);
      doc.setFillColor(...hell);
      doc.roundedRect(RAND, oben, BREITE, sichtbar, 2.5, 2.5, "F");
      doc.setFillColor(...akzent);
      doc.rect(RAND, oben, 1.6, sichtbar, "F");
      doc.circle(RAND + 7.5, oben + POLSTER + 2.2, 3.2, "F");
      schrift(9, "bold", [255, 255, 255]);
      doc.text(String(nr), RAND + 7.5, oben + POLSTER + 3.4, { align: "center" });
      y = oben + POLSTER + 3.6;
      for (const z of zeilen) {
        if (y > H - RAND - FUSS - 2) {
          neueSeite();
          doc.setFillColor(...hell);
          doc.rect(RAND, y - 4, BREITE, 6 + ZEILE, "F");
        }
        schrift(z.fett ? 11 : 10.5, z.fett ? "bold" : "normal", z.fett ? [20, 20, 20] : [45, 45, 45]);
        doc.text(z.text, RAND + 13 + z.einzug, y);
        y += ZEILE;
      }
      y += POLSTER + 3;
    }
    y += 3;
  }

  // ── Fuß auf jeder Seite ──
  const seiten = doc.getNumberOfPages();
  for (let s = 1; s <= seiten; s++) {
    doc.setPage(s);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(RAND, H - 13, B - RAND, H - 13);
    schrift(8.5, "normal", [130, 130, 130]);
    doc.text(`TaskCrawler · ${klartext(d.titel || "")}`.slice(0, 90), RAND, H - 8);
    doc.text(`Seite ${s} von ${seiten}`, B - RAND, H - 8, { align: "right" });
  }
  return doc;
}

export async function speichereErgebnisPdf(d: ErgebnisDaten) {
  const doc = await baueErgebnisPdf(d);
  const name = (d.titel || "TaskCrawler").normalize("NFKD").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
  doc.save(`Ergebnissicherung_${name || "TaskCrawler"}.pdf`);
}
