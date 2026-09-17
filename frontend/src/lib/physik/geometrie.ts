/**
 * Wo die beweglichen Teile eines Geräts gerade sind.
 *
 * Die meisten Anschlüsse sitzen fest am Gerät und drehen sich höchstens mit
 * ihm. Bei einem Pendel ist das anders: der Körper wandert, und mit ihm der
 * Punkt, an dem man etwas anhängen kann. Beides — Zeichnen und Anfassen und
 * das Auffinden von Anschlüssen — muss dieselbe Geometrie benutzen, sonst
 * hängt ein Massestück sichtbar neben dem Körper.
 *
 * Deshalb steht die Geometrie hier in der Bibliothek und nicht bei den
 * Zeichenroutinen: die Rechenwerke brauchen sie genauso.
 */
import type { Geraet, Punkt } from "./typen";

/** Ruhelänge der Feder — die Länge, um die herum sie schwingt. */
export const FEDER_RUHE = 0.25;

/** Ein Pendelkörper wächst mit der Masse, aber nur langsam (dritte Wurzel). */
export const koerperRadius = (masse: number) => 0.012 + 0.025 * Math.cbrt(Math.max(0.001, masse));

/**
 * Wo der schwingende Körper gerade ist — in Weltkoordinaten.
 *
 * Ohne laufenden Zustand steht er an seiner Startauslenkung; so sieht man
 * schon beim Einstellen, wo er losgelassen wird.
 */
export function koerperOrt(g: Geraet, s: { q: number } | undefined): Punkt | null {
  if (g.typ === "fadenpendel") {
    const laenge = g.werte.laenge ?? 1;
    const winkel = s?.q ?? g.werte.startwinkel ?? 0;
    return { x: g.pos.x + laenge * Math.sin(winkel), y: g.pos.y - laenge * Math.cos(winkel) };
  }
  if (g.typ === "federpendel") {
    const auslenkung = s?.q ?? g.werte.startauslenkung ?? 0;
    return { x: g.pos.x, y: g.pos.y - (FEDER_RUHE + auslenkung) };
  }
  return null;
}

/**
 * Der Startwert, der sich ergibt, wenn man den Körper an diesen Weltpunkt
 * zieht. Beim Fadenpendel der Winkel, beim Federpendel die Auslenkung.
 */
export function startWertAus(g: Geraet, welt: Punkt): number | null {
  if (g.typ === "fadenpendel") return Math.atan2(welt.x - g.pos.x, g.pos.y - welt.y);
  if (g.typ === "federpendel") return g.pos.y - FEDER_RUHE - welt.y;
  return null;
}

/**
 * Anschlüsse, die mit dem beweglichen Teil mitwandern — oder null, wenn der
 * Anschluss fest am Gerät sitzt und die übliche Rechnung gilt.
 */
export function beweglicherPortOrt(
  g: Geraet,
  portId: string,
  s: { q: number } | undefined,
): Punkt | null {
  if (portId === "koerper") return koerperOrt(g, s);
  return null;
}
