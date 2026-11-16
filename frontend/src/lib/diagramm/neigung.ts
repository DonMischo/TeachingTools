/**
 * Leichte 3D-Neigung der Diagrammfläche: Die Bühne kippt der Maus ein paar Grad
 * entgegen und federt nach (Feder statt fester Übergang, das macht es »flüssig«).
 * Geschrieben wird nur in CSS-Variablen (--nx, --ny = −1…1), kein React-Render je Bild.
 * Ein Klick bleibt ein Klick: Das SVG bleibt echtes DOM, nur per CSS gekippt.
 */
import { useEffect, type RefObject } from "react";

const STEIF = 0.06;   // Zug zur Mausposition
const DAEMPF = 0.82;  // Restschwung pro Bild — < 1, sonst schwingt es ewig

export function useNeigung(flaeche: RefObject<HTMLElement | null>, an: boolean) {
  useEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    if (!an || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.removeProperty("--nx");
      el.style.removeProperty("--ny");
      return;
    }
    let zx = 0, zy = 0, x = 0, y = 0, vx = 0, vy = 0, bild = 0;
    const schritt = () => {
      vx = (vx + (zx - x) * STEIF) * DAEMPF;
      vy = (vy + (zy - y) * STEIF) * DAEMPF;
      x += vx; y += vy;
      el.style.setProperty("--nx", x.toFixed(4));
      el.style.setProperty("--ny", y.toFixed(4));
      const ruhig = Math.abs(zx - x) + Math.abs(zy - y) + Math.abs(vx) + Math.abs(vy) < 1e-4;
      bild = ruhig ? 0 : requestAnimationFrame(schritt);
    };
    const los = () => { if (!bild) bild = requestAnimationFrame(schritt); };
    const bewegt = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      zx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      zy = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      los();
    };
    const weg = () => { zx = 0; zy = 0; los(); };
    el.addEventListener("pointermove", bewegt);
    el.addEventListener("pointerleave", weg);
    return () => {
      cancelAnimationFrame(bild);
      el.removeEventListener("pointermove", bewegt);
      el.removeEventListener("pointerleave", weg);
      el.style.removeProperty("--nx");
      el.style.removeProperty("--ny");
    };
  }, [flaeche, an]);
}
