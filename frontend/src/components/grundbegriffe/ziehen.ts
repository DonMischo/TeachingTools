/**
 * Ziehen in einem SVG: Zeigerposition in viewBox-Koordinaten. Pointer
 * Capture hält das Ziehen fest, auch wenn der Finger das Bauteil verlässt.
 */
import { useRef, type PointerEvent as RPointerEvent } from "react";

export function imSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const m = svg.getScreenCTM?.();
  if (!m) {
    // Ohne Layout (Tests): über die Bounding-Box rechnen
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: vb.x + (clientX - r.left) * (vb.width / (r.width || 1)), y: vb.y + (clientY - r.top) * (vb.height / (r.height || 1)) };
  }
  const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

/**
 * Liefert Handler fürs SVG: `start(name)` an einen Griff hängen, `bewege`
 * bekommt den Namen und die Position, solange gezogen wird.
 */
export function useZiehen<N extends string>(bewege: (name: N, p: { x: number; y: number }) => void) {
  const svg = useRef<SVGSVGElement>(null);
  const aktiv = useRef<N | null>(null);
  const start = (name: N) => (e: RPointerEvent) => {
    aktiv.current = name;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    e.preventDefault();
    if (svg.current) bewege(name, imSvg(svg.current, e.clientX, e.clientY));
  };
  const props = {
    ref: svg,
    onPointerMove: (e: RPointerEvent) => { if (aktiv.current && svg.current) bewege(aktiv.current, imSvg(svg.current, e.clientX, e.clientY)); },
    onPointerUp: () => { aktiv.current = null; },
    onPointerCancel: () => { aktiv.current = null; },
    style: { touchAction: "none" as const },
  };
  return { svg, start, props };
}
