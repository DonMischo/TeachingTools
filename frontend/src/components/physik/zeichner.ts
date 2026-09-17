"use client";
/**
 * Geräte, die nicht als Kasten taugen.
 *
 * Die Werkbank zeichnet ein Gerät voreingestellt als abgerundetes Rechteck mit
 * Sinnbild — das reicht für Stativ, Massestück oder Lämpchen. Ein Pendel aber
 * *ist* seine Bewegung: Faden, Körper, Ruhelage. Solche Geräte bringen hier
 * ihre eigene Zeichnung mit; alle anderen bleiben beim Kasten.
 *
 * Gezeichnet wird in Bildkoordinaten, umgerechnet ausschließlich über
 * `zumBild` — Meter treffen nirgendwo sonst auf Pixel.
 */
import type { Schwinger } from "@/lib/physik/mechanik";
import { zumBild } from "@/lib/physik/szene";
import type { Blick, Geraet } from "@/lib/physik/typen";

export type Zeichner = (
  ctx: CanvasRenderingContext2D,
  g: Geraet,
  s: Schwinger | undefined,
  blick: Blick,
) => void;

/** Ein Pendelkörper wächst mit der Masse, aber nur langsam (dritte Wurzel). */
const koerperRadius = (masse: number) => 0.012 + 0.025 * Math.cbrt(Math.max(0.001, masse));

function aufhaengung(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

const fadenpendel: Zeichner = (ctx, g, s, blick) => {
  const laenge = g.werte.laenge ?? 1;
  const winkel = s?.q ?? g.werte.startwinkel ?? 0;
  const dreh = zumBild(g.pos, blick);
  const koerper = zumBild(
    { x: g.pos.x + laenge * Math.sin(winkel), y: g.pos.y - laenge * Math.cos(winkel) },
    blick,
  );

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
  ctx.strokeStyle = "rgba(2,6,23,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(koerper.x, koerper.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  aufhaengung(ctx, dreh.x, dreh.y);
};

const federpendel: Zeichner = (ctx, g, s, blick) => {
  // Ruhelänge der Feder, damit auch bei Auslenkung null etwas dasteht.
  const RUHE = 0.25;
  const auslenkung = s?.q ?? g.werte.startauslenkung ?? 0;
  const oben = zumBild(g.pos, blick);
  const unten = zumBild({ x: g.pos.x, y: g.pos.y - (RUHE + auslenkung) }, blick);

  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(148,163,184,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const ruhe = zumBild({ x: g.pos.x, y: g.pos.y - RUHE }, blick);
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
  ctx.strokeStyle = "rgba(2,6,23,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(unten.x - r, unten.y, r * 2, r * 1.6);
  ctx.fill();
  ctx.stroke();

  aufhaengung(ctx, oben.x, oben.y);
};

export const ZEICHNER: Record<string, Zeichner> = { fadenpendel, federpendel };
