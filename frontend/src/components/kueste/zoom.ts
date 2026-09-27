"use client";
/**
 * Zoom und Verschieben für die Küsten-Canvas: Mausrad zoomt um den Zeiger,
 * Ziehen verschiebt, `setzen` springt zu einem Ausschnitt (z. B. an die
 * Wasserlinie), `null` kehrt zur Grundansicht zurück. Ein Ziehen löst
 * keinen Klick aus.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Ausschnitt } from "./zeichnen";

export function useZoom(canvas: RefObject<HTMLCanvasElement | null>, basis: () => Ausschnitt) {
  const [fenster, setFenster] = useState<Ausschnitt | null>(null);
  const aktuellRef = useRef<Ausschnitt | null>(null);
  aktuellRef.current = fenster;
  const basisRef = useRef(basis);
  basisRef.current = basis;
  const gezogen = useRef(false);

  const aktuell = () => aktuellRef.current ?? basisRef.current();

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const welt = (e: { clientX: number; clientY: number }, a: Ausschnitt) => {
      const r = c.getBoundingClientRect();
      return {
        x: a.x0 + ((e.clientX - r.left) / r.width) * (a.x1 - a.x0),
        z: a.z1 - ((e.clientY - r.top) / r.height) * (a.z1 - a.z0),
      };
    };
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      const a = aktuell();
      const b = basisRef.current();
      const f = e.deltaY > 0 ? 1.18 : 1 / 1.18;
      const p = welt(e, a);
      const breite = (a.x1 - a.x0) * f;
      if (breite < 5 || breite > (b.x1 - b.x0) * 1.3) return;
      setFenster({
        x0: p.x - (p.x - a.x0) * f, x1: p.x + (a.x1 - p.x) * f,
        z0: p.z - (p.z - a.z0) * f, z1: p.z + (a.z1 - p.z) * f,
      });
    };
    let start: { x: number; y: number; a: Ausschnitt } | null = null;
    const runter = (e: PointerEvent) => { start = { x: e.clientX, y: e.clientY, a: aktuell() }; gezogen.current = false; };
    const bewegen = (e: PointerEvent) => {
      if (!start || !(e.buttons & 1)) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!gezogen.current && Math.hypot(dx, dy) < 5) return;
      gezogen.current = true;
      const r = c.getBoundingClientRect();
      const a = start.a;
      const mx = (dx / r.width) * (a.x1 - a.x0), mz = (dy / r.height) * (a.z1 - a.z0);
      setFenster({ x0: a.x0 - mx, x1: a.x1 - mx, z0: a.z0 + mz, z1: a.z1 + mz });
    };
    const hoch = () => { start = null; };
    c.addEventListener("wheel", rad, { passive: false });
    c.addEventListener("pointerdown", runter);
    window.addEventListener("pointermove", bewegen);
    window.addEventListener("pointerup", hoch);
    return () => {
      c.removeEventListener("wheel", rad);
      c.removeEventListener("pointerdown", runter);
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", hoch);
    };
    // aktuell() liest Refs — der Listener bleibt für die Lebenszeit stehen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas]);

  /** Ein Klick nach einem Ziehen zählt nicht */
  const klickZaehlt = () => {
    const g = gezogen.current;
    gezogen.current = false;
    return !g;
  };

  return { fenster, setzen: setFenster, aktuell, klickZaehlt };
}

/** Zoomknöpfe unten rechts auf der Bühne */
export const ZOOM_KNOPF = "px-2 py-1 rounded-lg bg-black/55 text-white text-xs font-bold hover:bg-black/70";
