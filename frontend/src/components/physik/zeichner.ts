"use client";
/**
 * Geräte, die nicht als Kasten taugen.
 *
 * Die Werkbank zeichnet ein Gerät voreingestellt als abgerundetes Rechteck mit
 * Sinnbild — das reicht für Stativ, Massestück oder Lämpchen. Ein Pendel aber
 * *ist* seine Bewegung: Faden, Körper, Ruhelage. Solche Geräte bringen hier
 * ihre eigene Zeichnung mit; alle anderen bleiben beim Kasten.
 *
 * `koerperOrt` steht hier bei den Zeichnungen, weil Zeichnen und Anfassen
 * dieselbe Geometrie brauchen: Wer den Pendelkörper sehen kann, soll ihn auch
 * greifen können.
 *
 * Gezeichnet wird in Bildkoordinaten, umgerechnet ausschließlich über
 * `zumBild` — Meter treffen nirgendwo sonst auf Pixel.
 */
import { FEDER_RUHE, hangEnden, hangOrt, hebelArmOrt, koerperOrt, koerperRadius } from "@/lib/physik/geometrie";
import type { LaborZustand } from "@/lib/physik/rechenwerke";
import { zumBild } from "@/lib/physik/szene";
import { bauteilSpannung } from "@/lib/physik/stromkreis";
import type { Blick, Geraet } from "@/lib/physik/typen";

export type Zeichner = (
  ctx: CanvasRenderingContext2D,
  g: Geraet,
  zustand: LaborZustand,
  blick: Blick,
) => void;

function aufhaengung(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** Der Körper bekommt einen hellen Rand, solange der Zeiger auf ihm liegt. */
function koerperRand(ctx: CanvasRenderingContext2D, angefasst: boolean) {
  ctx.strokeStyle = angefasst ? "#f8fafc" : "rgba(2,6,23,0.6)";
  ctx.lineWidth = angefasst ? 3 : 2;
}

const fadenpendel: Zeichner = (ctx, g, zustand, blick) => {
  const s = zustand.mechanik[g.id];
  const laenge = g.werte.laenge ?? 1;
  const dreh = zumBild(g.pos, blick);
  const ort = koerperOrt(g, s)!;
  const koerper = zumBild(ort, blick);

  // Ruhelage gestrichelt: ohne sie sieht man dem Bild den Ausschlag nicht an.
  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(148,163,184,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(dreh.x, dreh.y);
  ctx.lineTo(dreh.x, dreh.y + laenge * blick.skala);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(226,232,240,0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(dreh.x, dreh.y);
  ctx.lineTo(koerper.x, koerper.y);
  ctx.stroke();

  const r = Math.max(4, koerperRadius(g.werte.masse ?? 0.2) * blick.skala);
  ctx.fillStyle = "#38bdf8";
  koerperRand(ctx, false);
  ctx.beginPath();
  ctx.arc(koerper.x, koerper.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  aufhaengung(ctx, dreh.x, dreh.y);
};

const federpendel: Zeichner = (ctx, g, zustand, blick) => {
  const s = zustand.mechanik[g.id];
  const oben = zumBild(g.pos, blick);
  const ort = koerperOrt(g, s)!;
  const unten = zumBild(ort, blick);

  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(148,163,184,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const ruhe = zumBild({ x: g.pos.x, y: g.pos.y - FEDER_RUHE }, blick);
  ctx.moveTo(oben.x - 14, ruhe.y);
  ctx.lineTo(oben.x + 14, ruhe.y);
  ctx.stroke();
  ctx.restore();

  // Die Feder als Zickzack — je weiter gedehnt, desto flacher die Windungen.
  const windungen = 9;
  const breite = Math.max(4, 0.022 * blick.skala);
  ctx.strokeStyle = "rgba(226,232,240,0.85)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(oben.x, oben.y);
  for (let i = 1; i <= windungen; i++) {
    const anteil = i / (windungen + 1);
    ctx.lineTo(oben.x + (i % 2 ? breite : -breite), oben.y + (unten.y - oben.y) * anteil);
  }
  ctx.lineTo(unten.x, unten.y);
  ctx.stroke();

  const r = Math.max(5, koerperRadius(g.werte.masse ?? 0.2) * blick.skala);
  ctx.fillStyle = "#a78bfa";
  koerperRand(ctx, false);
  ctx.beginPath();
  ctx.rect(unten.x - r, unten.y - r * 0.8, r * 2, r * 1.6);
  ctx.fill();
  ctx.stroke();

  aufhaengung(ctx, oben.x, oben.y);
};

const hebel: Zeichner = (ctx, g, zustand, blick) => {
  const s = zustand.mechanik[g.id];
  const q = s?.q ?? g.werte.startneigung ?? 0;
  const links = zumBild(hebelArmOrt(g, "links", q), blick);
  const rechts = zumBild(hebelArmOrt(g, "rechts", q), blick);
  const achse = zumBild(g.pos, blick);

  // Der Balken.
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = Math.max(4, 0.025 * blick.skala);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(links.x, links.y);
  ctx.lineTo(rechts.x, rechts.y);
  ctx.stroke();
  ctx.lineCap = "butt";

  // Das Lager als Dreieck — der Drehpunkt, um den es hier geht.
  const hoehe = Math.max(8, 0.07 * blick.skala);
  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.moveTo(achse.x, achse.y);
  ctx.lineTo(achse.x - hoehe * 0.6, achse.y + hoehe);
  ctx.lineTo(achse.x + hoehe * 0.6, achse.y + hoehe);
  ctx.closePath();
  ctx.fill();

  // Waagerechte Bezugslinie: daran sieht man, ob er im Gleichgewicht ist.
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = "rgba(148,163,184,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(achse.x - Math.abs(links.x - achse.x) - 6, achse.y);
  ctx.lineTo(achse.x + Math.abs(rechts.x - achse.x) + 6, achse.y);
  ctx.stroke();
  ctx.restore();
};

const flaschenzug: Zeichner = (ctx, g, _zustand, blick) => {
  const n = Math.max(1, Math.round(g.werte.rollen ?? 1));
  const mitte = zumBild(g.pos, blick);
  const b = 0.12 * blick.skala;
  const h = 0.16 * blick.skala;

  // Die Seile zwischen fester und loser Rolle — so viele, wie tragen.
  ctx.strokeStyle = "rgba(226,232,240,0.7)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < n; i++) {
    const x = mitte.x - b / 2 + ((i + 0.5) * b) / n;
    ctx.beginPath();
    ctx.moveTo(x, mitte.y - h / 2);
    ctx.lineTo(x, mitte.y + h / 2);
    ctx.stroke();
  }

  // Feste Rolle oben, lose Rolle unten.
  ctx.fillStyle = "#94a3b8";
  ctx.strokeStyle = "rgba(2,6,23,0.6)";
  ctx.lineWidth = 2;
  for (const y of [mitte.y - h / 2, mitte.y + h / 2]) {
    ctx.beginPath();
    ctx.ellipse(mitte.x, y, b / 2, Math.max(3, b / 6), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(226,232,240,0.9)";
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n) + "x", mitte.x, mitte.y);
};

const schiefeebene: Zeichner = (ctx, g, zustand, blick) => {
  const s = zustand.mechanik[g.id];
  const { oben, unten } = hangEnden(g);
  const o = zumBild(oben, blick);
  const u = zumBild(unten, blick);
  const fuss = zumBild({ x: oben.x, y: unten.y }, blick);

  // Das Keil-Dreieck.
  ctx.fillStyle = "rgba(148,163,184,0.16)";
  ctx.strokeStyle = "rgba(148,163,184,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(o.x, o.y);
  ctx.lineTo(u.x, u.y);
  ctx.lineTo(fuss.x, fuss.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Die Kiste, mitgeneigt.
  const weg = s?.q ?? g.werte.startweg ?? 0;
  const kiste = zumBild(hangOrt(g, weg), blick);
  const r = Math.max(6, koerperRadius(g.werte.masse ?? 0.5) * blick.skala);
  ctx.save();
  ctx.translate(kiste.x, kiste.y);
  ctx.rotate(g.werte.winkel ?? 0);
  ctx.fillStyle = "#f59e0b";
  ctx.strokeStyle = "rgba(2,6,23,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-r, -2 * r, 2 * r, 2 * r);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

/**
 * Das Lämpchen — hell nach Leistung.
 *
 * Die eigentliche Frage jedes Stromkreis-Versuchs ist »leuchtet sie?«.
 * Deshalb ist die Helligkeit keine Spielerei: erst sie macht aus der Rechnung
 * einen Versuch, den man im Klassenraum sehen kann. Skaliert wird mit der
 * Wurzel, weil das Auge Helligkeit nicht linear wahrnimmt.
 */
const lampe: Zeichner = (ctx, g, zustand, blick) => {
  const kreis = zustand.kreis;
  let leistung = 0;
  if (kreis) {
    const strom = kreis.strom.get(g.id) ?? 0;
    leistung = Math.abs(bauteilSpannung(kreis, g) * strom);
  }
  // Ein halbes Watt reicht einem Schullämpchen zum hellen Leuchten.
  const helligkeit = Math.min(1, Math.sqrt(leistung / 0.5));

  const mitte = zumBild(g.pos, blick);
  const r = Math.max(6, 0.05 * blick.skala);

  if (helligkeit > 0.01) {
    const schein = ctx.createRadialGradient(mitte.x, mitte.y, 0, mitte.x, mitte.y, r * 3);
    schein.addColorStop(0, `rgba(253,224,71,${0.75 * helligkeit})`);
    schein.addColorStop(1, "rgba(253,224,71,0)");
    ctx.fillStyle = schein;
    ctx.beginPath();
    ctx.arc(mitte.x, mitte.y, r * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = helligkeit > 0.01
    ? `rgb(${180 + 75 * helligkeit}, ${160 + 80 * helligkeit}, ${60 + 40 * helligkeit})`
    : "rgba(148,163,184,0.35)";
  ctx.strokeStyle = "rgba(2,6,23,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mitte.x, mitte.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Der Glühfaden als Zickzack, wie im Schaltbild.
  ctx.strokeStyle = helligkeit > 0.01 ? "rgba(120,53,15,0.9)" : "rgba(148,163,184,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const x = mitte.x - r * 0.55 + (i * r * 1.1) / 6;
    const y = mitte.y + (i % 2 ? -r * 0.3 : r * 0.3);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
};

export const ZEICHNER: Record<string, Zeichner> = { fadenpendel, federpendel, hebel, flaschenzug, schiefeebene, lampe };

/** Welcher Startwert eines Geräts sich durch Ziehen am Körper ergibt. */
export const START_WERT: Record<string, string> = {
  fadenpendel: "startwinkel",
  federpendel: "startauslenkung",
  schiefeebene: "startweg",
};
