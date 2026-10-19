/** Geländebild als Canvas und Erosion in Häppchen (ohne den Browser einzufrieren) */
import { gelaendeFarben, type FarbOptionen } from "@/lib/gelaende/farbe";
import { aenderung, erosionSchritt, erosionsSchritte, erosionStart } from "@/lib/gelaende/erosion";
import { erzeuge, hoeheBei, type Gelaende } from "@/lib/gelaende/gelaende";

export function gelaendeLeinwand(g: Gelaende, o: FarbOptionen = {}): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = g.n;
  c.height = g.n;
  const ctx = c.getContext("2d")!;
  const bild = ctx.createImageData(g.n, g.n);
  bild.data.set(gelaendeFarben(g, o));
  ctx.putImageData(bild, 0, 0);
  return c;
}

/** Geländebild und nur sein Wasser (für die Stadtkarte: Wasser über den Vierteln) */
export interface GelaendeBilder { land: HTMLCanvasElement; wasser: HTMLCanvasElement }

/** nur die Wasserzellen des Bilds, Rest durchsichtig */
export function wasserLeinwand(g: Gelaende, bild: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = g.n; c.height = g.n;
  const ctx = c.getContext("2d")!;
  const d = bild.getContext("2d")!.getImageData(0, 0, g.n, g.n);
  for (let k = 0; k < g.n * g.n; k++) if (!g.wasser[k]) d.data[k * 4 + 3] = 0;
  ctx.putImageData(d, 0, 0);
  return c;
}

/**
 * Erosion im Hintergrund; ruft fortschritt(0..1) und am Ende fertig(g).
 * Gerechnet wird auf höchstens 256² (dasselbe Gelände, gröber) — die
 * Höhenänderung wird dann auf das feine Gitter übertragen.
 */
export function erodiereNebenbei(g: Gelaende, fortschritt: (f: number) => void, fertig: (g: Gelaende) => void): () => void {
  const grob = g.n > 256 ? erzeuge(g.wahl, 256, g.breite / 256) : g;
  const e = erosionStart(grob);
  const ziel = erosionsSchritte(grob.n);
  let aus = false;
  const lauf = () => {
    if (aus) return;
    const t = performance.now();
    while (e.schritte < ziel && performance.now() - t < 30) erosionSchritt(e);
    fortschritt(e.schritte / ziel);
    if (e.schritte < ziel) { setTimeout(lauf, 0); return; }
    const d = { ...grob, hoehe: aenderung(e) };
    const hoehe = new Float32Array(g.hoehe.length);
    const wasser = Uint8Array.from(g.wasser);
    for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
      const k = j * g.n + i;
      // Flussbett behalten, sonst würde der weiche Übergang es zuschütten
      hoehe[k] = g.wasser[k] === 1 ? g.hoehe[k] : g.hoehe[k] + hoeheBei(d, (i + 0.5) * g.zelle, (j + 0.5) * g.zelle);
      if (g.meer !== null) wasser[k] = hoehe[k] < g.meer ? 2 : wasser[k] === 2 ? 0 : wasser[k];
    }
    fertig({ ...g, hoehe, wasser });
  };
  setTimeout(lauf, 0);
  return () => { aus = true; };
}
