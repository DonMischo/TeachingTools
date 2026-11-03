/** Hilfen fürs Ziehen und Zeichnen in den Kreis-Blättern. */
import type { PointerEvent as RPointerEvent } from "react";

/** Zeigerposition in viewBox-Koordinaten des umgebenden SVG. */
export function svgPunkt(e: RPointerEvent<Element>) {
  const svg = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
  const ctm = svg?.getScreenCTM();
  if (!svg || !ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/** Bildschirmpunkt auf dem Kreis um (cx, cy) beim mathematischen Winkel `grad` (gegen den Uhrzeigersinn). */
export const auf = (cx: number, cy: number, r: number, grad: number) => ({
  x: cx + r * Math.cos(grad * Math.PI / 180),
  y: cy - r * Math.sin(grad * Math.PI / 180),
});

/** Winkel des Punkts (x, y) von (cx, cy) aus, mathematisch in Grad (0–360). */
export const winkelVon = (cx: number, cy: number, x: number, y: number) => (Math.atan2(cy - y, x - cx) * 180 / Math.PI + 360) % 360;
