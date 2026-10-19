/** Geländebild als Canvas und Erosion in Häppchen (ohne den Browser einzufrieren) */
import { gelaendeFarben, type FarbOptionen } from "@/lib/gelaende/farbe";
import { aufGelaende, erosionSchritt, erosionsSchritte, erosionStart } from "@/lib/gelaende/erosion";
import type { Gelaende } from "@/lib/gelaende/gelaende";

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

/** ganze Erosion im Hintergrund; ruft fortschritt(0..1) und am Ende fertig(g) */
export function erodiereNebenbei(g: Gelaende, fortschritt: (f: number) => void, fertig: (g: Gelaende) => void): () => void {
  const e = erosionStart(g);
  const ziel = erosionsSchritte(g.n);
  let aus = false;
  const lauf = () => {
    if (aus) return;
    const t = performance.now();
    while (e.schritte < ziel && performance.now() - t < 30) erosionSchritt(e);
    fortschritt(e.schritte / ziel);
    if (e.schritte < ziel) setTimeout(lauf, 0);
    else fertig(aufGelaende(e, g));
  };
  setTimeout(lauf, 0);
  return () => { aus = true; };
}
