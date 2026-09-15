/**
 * Ein Bild als PDF — ohne Bibliothek.
 *
 * Eine Seite A4 hochkant, das JPEG mittig mit Rand. PDF nimmt JPEG-Daten
 * unverändert auf (Filter DCTDecode), mehr braucht der Führerschein nicht.
 * Alle Zeichen der Struktur sind ASCII; die vier Binärzeichen im Kopf (sie
 * sagen Programmen »hier kommen Binärdaten«) entstehen aus Zeichencodes.
 */

const A4 = { w: 595.28, h: 841.89 };
const NL = "\n";

function bytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

// Rückgabe ausdrücklich über einem ArrayBuffer: sonst passt das Ergebnis für
// TypeScript nicht in `new Blob([...])` (Uint8Array<ArrayBufferLike>).
export function jpegAlsPdf(jpeg: Uint8Array, breitePx: number, hoehePx: number): Uint8Array<ArrayBuffer> {
  const rand = 24;
  const massstab = Math.min((A4.w - 2 * rand) / breitePx, (A4.h - 2 * rand) / hoehePx);
  const w = breitePx * massstab;
  const h = hoehePx * massstab;
  const x = (A4.w - w) / 2;
  const y = (A4.h - h) / 2;

  const teile: Uint8Array[] = [];
  const versatz: number[] = [];
  let laenge = 0;
  const schreibe = (b: Uint8Array) => { teile.push(b); laenge += b.length; };

  schreibe(bytes("%PDF-1.4" + NL + "%" + String.fromCharCode(0xe2, 0xe3, 0xcf, 0xd3) + NL));

  const objekt = (nr: number, kopf: string, strom?: Uint8Array) => {
    versatz[nr] = laenge;
    schreibe(bytes(`${nr} 0 obj${NL}${kopf}${NL}`));
    if (strom) {
      schreibe(bytes(`stream${NL}`));
      schreibe(strom);
      schreibe(bytes(`${NL}endstream${NL}`));
    }
    schreibe(bytes(`endobj${NL}`));
  };

  const inhalt = bytes(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Bild Do Q`);

  objekt(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objekt(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objekt(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << /Bild 4 0 R >> >> /Contents 5 0 R >>`);
  objekt(4, `<< /Type /XObject /Subtype /Image /Width ${breitePx} /Height ${hoehePx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
  objekt(5, `<< /Length ${inhalt.length} >>`, inhalt);

  const xref = laenge;
  // Jede Zeile der Tabelle ist genau 20 Bytes lang — samt Leerzeichen vor dem Zeilenende.
  let tabelle = `xref${NL}0 6${NL}0000000000 65535 f ${NL}`;
  for (let nr = 1; nr <= 5; nr++) tabelle += `${String(versatz[nr]).padStart(10, "0")} 00000 n ${NL}`;
  tabelle += `trailer${NL}<< /Size 6 /Root 1 0 R >>${NL}startxref${NL}${xref}${NL}%%EOF${NL}`;
  schreibe(bytes(tabelle));

  const pdf = new Uint8Array(laenge);
  let pos = 0;
  for (const t of teile) { pdf.set(t, pos); pos += t.length; }
  return pdf;
}

/** Zeichnet mit `zeichne` auf eine Leinwand und liefert das Ergebnis als PDF-Blob. */
export async function leinwandAlsPdf(leinwand: HTMLCanvasElement): Promise<Blob> {
  const jpeg: Blob | null = await new Promise(fertig => leinwand.toBlob(fertig, "image/jpeg", 0.92));
  if (!jpeg) throw new Error("Das Bild ließ sich nicht erzeugen.");
  const daten = new Uint8Array(await jpeg.arrayBuffer());
  return new Blob([jpegAlsPdf(daten, leinwand.width, leinwand.height)], { type: "application/pdf" });
}
