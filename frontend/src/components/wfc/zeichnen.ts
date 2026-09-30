/**
 * Zeichnen der Kacheln aus ihren Anschlüssen: Jede Seite mit Anschluss
 * bekommt ein Stück Rohr, Straße oder Fluss von der Mitte zum Rand. So passen
 * gedrehte Kacheln automatisch, ohne eigene Bilder.
 */
import type { Variante } from "@/lib/wfc/kacheln";

const RAND: [number, number][] = [[1, 0.5], [0.5, 1], [0, 0.5], [0.5, 0]]; // rechts, unten, links, oben

function strich(ctx: CanvasRenderingContext2D, x: number, y: number, g: number, d: number, breite: number, farbe: string) {
  ctx.strokeStyle = farbe;
  ctx.lineWidth = breite * g;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(x + g / 2, y + g / 2);
  ctx.lineTo(x + RAND[d][0] * g, y + RAND[d][1] * g);
  ctx.stroke();
}

function mittelpunkt(ctx: CanvasRenderingContext2D, x: number, y: number, g: number, r: number, farbe: string) {
  ctx.fillStyle = farbe;
  ctx.beginPath();
  ctx.arc(x + g / 2, y + g / 2, r * g, 0, Math.PI * 2);
  ctx.fill();
}

export function zeichneKachel(ctx: CanvasRenderingContext2D, satz: string, v: Variante, x: number, y: number, g: number) {
  if (satz === "landschaft") {
    const farben = ["#2563eb", "#fcd34d", "#65a30d"];
    const [nw, ne, se, sw] = v.kachel.ecken!;
    const h = g / 2;
    ctx.fillStyle = farben[nw]; ctx.fillRect(x, y, h, h);
    ctx.fillStyle = farben[ne]; ctx.fillRect(x + h, y, g - h, h);
    ctx.fillStyle = farben[se]; ctx.fillRect(x + h, y + h, g - h, g - h);
    ctx.fillStyle = farben[sw]; ctx.fillRect(x, y + h, h, g - h);
    return;
  }
  if (satz === "rohre") {
    ctx.fillStyle = "#111827";
    ctx.fillRect(x, y, g, g);
    const seiten = v.seiten.map(s => s === "1");
    seiten.forEach((an, d) => { if (an) strich(ctx, x, y, g, d, 0.32, "#38bdf8"); });
    const zahl = seiten.filter(Boolean).length;
    if (zahl) mittelpunkt(ctx, x, y, g, zahl === 1 ? 0.24 : 0.16, zahl === 1 ? "#0ea5e9" : "#38bdf8");
    return;
  }
  // Straßen & Flüsse
  ctx.fillStyle = "#65a30d";
  ctx.fillRect(x, y, g, g);
  v.seiten.forEach((s, d) => { if (s === "F") strich(ctx, x, y, g, d, 0.44, "#2563eb"); });
  if (v.seiten.includes("F") && !v.seiten.includes("S")) mittelpunkt(ctx, x, y, g, 0.22, "#2563eb");
  v.seiten.forEach((s, d) => { if (s === "S") strich(ctx, x, y, g, d, 0.34, "#78716c"); });
  if (v.seiten.includes("S")) mittelpunkt(ctx, x, y, g, 0.17, "#78716c");
  if (v.kachel.name === "bruecke") {
    // Geländer der Brücke
    const quer = v.seiten[0] === "S";
    ctx.fillStyle = "#92400e";
    if (quer) { ctx.fillRect(x + g * 0.2, y + g * 0.3, g * 0.6, g * 0.05); ctx.fillRect(x + g * 0.2, y + g * 0.65, g * 0.6, g * 0.05); }
    else { ctx.fillRect(x + g * 0.3, y + g * 0.2, g * 0.05, g * 0.6); ctx.fillRect(x + g * 0.65, y + g * 0.2, g * 0.05, g * 0.6); }
  }
}
