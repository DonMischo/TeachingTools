/**
 * Maßstabsleiste wie im Atlas: abwechselnd schwarze und weiße Felder, darunter
 * 0 · Mitte · Ende mit Einheit. Gezeichnet auf ein Canvas — so steht sie in der
 * Karte und auch im exportierten Bild (Arbeitsblatt).
 */

export type Massstab = { felder: number; feldPx: number; feldWert: number; einheit: "km" | "m" };

/** Erdumfang am Äquator in m; MapLibre rechnet mit 512er-Kacheln */
const UMFANG = 40075016.686;

/** Meter je Bildschirmpixel in Web-Mercator an einer Breite. */
export const meterJePixel = (zoom: number, breite: number) => (UMFANG * Math.cos((breite * Math.PI) / 180)) / (512 * 2 ** zoom);

/** Runde Feldlänge (1, 2, 5 × 10ⁿ), sodass vier Felder höchstens `maxPx` breit sind. */
export function massstab(mProPx: number, maxPx = 180): Massstab {
  const felder = 4;
  const roh = (mProPx * maxPx) / felder;
  const zehner = 10 ** Math.floor(Math.log10(roh));
  const stufe = [5, 2, 1].map((f) => f * zehner).find((w) => w <= roh) ?? zehner;
  const km = stufe >= 1000;
  return { felder, feldPx: stufe / mProPx, feldWert: km ? stufe / 1000 : stufe, einheit: km ? "km" : "m" };
}

const zahl = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

/**
 * Zeichnet die Leiste mit der linken unteren Ecke bei (x, y) — in CSS-Pixeln,
 * `s` skaliert alles (Gerätepixel beim Export).
 */
export function zeichneMassstab(g: CanvasRenderingContext2D, m: Massstab, x: number, y: number, s = 1) {
  const hoehe = 6 * s, breite = m.feldPx * m.felder * s, rand = 6 * s;
  g.save();
  g.font = `${11 * s}px "Noto Sans", Arial, sans-serif`;
  const ende = `${zahl(m.feldWert * m.felder)} ${m.einheit}`;
  const rechts = g.measureText(ende).width / 2;
  // Heller Grund, damit die Leiste auf jeder Karte lesbar bleibt
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.fillRect(x - rand, y - hoehe - 20 * s - rand, breite + 2 * rand + rechts, hoehe + 20 * s + 2 * rand);
  const oben = y - hoehe - 16 * s;
  for (let i = 0; i < m.felder; i++) {
    g.fillStyle = i % 2 ? "#ffffff" : "#000000";
    g.fillRect(x + i * m.feldPx * s, oben, m.feldPx * s, hoehe);
  }
  g.strokeStyle = "#000000"; g.lineWidth = 1 * s;
  g.strokeRect(x, oben, breite, hoehe);
  g.fillStyle = "#000000"; g.textAlign = "center"; g.textBaseline = "top";
  const unter = oben + hoehe + 3 * s;
  g.fillText("0", x, unter);
  g.fillText(zahl(m.feldWert * (m.felder / 2)), x + breite / 2, unter);
  g.fillText(ende, x + breite, unter);
  g.restore();
}
