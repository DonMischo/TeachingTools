"use client";
/**
 * Zoom und Verschieben für die Küsten-Canvas.
 *
 *  - Mausrad zoomt um den Zeiger; weiter hinaus als die Grundansicht geht es nicht.
 *  - Ziehen verschiebt, aber nie aus der Grundansicht hinaus.
 *  - Lupe: Ein runder Vergrößerungskreis folgt dem Zeiger; ein Klick zoomt
 *    genau an diese Stelle (2,5-fach).
 *  - `setzen(null)` kehrt zur Grundansicht zurück.
 * Ein Ziehen löst keinen Klick aus.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Ausschnitt } from "./zeichnen";

const LUPE_FAKTOR = 2.5;
const LUPE_RADIUS = 70;

/** Ausschnitt in die Grundansicht einpassen: nicht größer, nicht hinaus */
function einpassen(a: Ausschnitt, b: Ausschnitt): Ausschnitt | null {
  const breite = a.x1 - a.x0, hoehe = a.z1 - a.z0;
  const bb = b.x1 - b.x0, bh = b.z1 - b.z0;
  if (breite >= bb * 0.999 || hoehe >= bh * 0.999) return null;
  const x0 = Math.min(Math.max(a.x0, b.x0), b.x1 - breite);
  const z0 = Math.min(Math.max(a.z0, b.z0), b.z1 - hoehe);
  return { x0, x1: x0 + breite, z0, z1: z0 + hoehe };
}

export function useZoom(canvas: RefObject<HTMLCanvasElement | null>, basis: () => Ausschnitt) {
  const [fenster, setFensterRoh] = useState<Ausschnitt | null>(null);
  const [lupe, setLupe] = useState(false);
  const aktuellRef = useRef<Ausschnitt | null>(null);
  aktuellRef.current = fenster;
  const basisRef = useRef(basis);
  basisRef.current = basis;
  const lupeRef = useRef(lupe);
  lupeRef.current = lupe;
  const gezogen = useRef(false);
  /** Zeigerposition in CSS-Pixeln auf der Canvas (für die Lupe) */
  const zeiger = useRef<{ x: number; y: number } | null>(null);

  const aktuell = () => aktuellRef.current ?? basisRef.current();
  const setzen = (a: Ausschnitt | null) => setFensterRoh(a ? einpassen(a, basisRef.current()) : null);

  /** Um einen Weltpunkt mit Faktor f zoomen (f < 1: hinein) */
  const umPunkt = (x: number, z: number, f: number) => {
    const a = aktuell();
    if ((a.x1 - a.x0) * f < 4) return;
    setzen({ x0: x - (x - a.x0) * f, x1: x + (a.x1 - x) * f, z0: z - (z - a.z0) * f, z1: z + (a.z1 - z) * f });
  };

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
      const p = welt(e, aktuell());
      umPunkt(p.x, p.z, e.deltaY > 0 ? 1.18 : 1 / 1.18);
    };
    let start: { x: number; y: number; a: Ausschnitt } | null = null;
    const runter = (e: PointerEvent) => { start = { x: e.clientX, y: e.clientY, a: aktuell() }; gezogen.current = false; };
    const bewegen = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      const drin = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      zeiger.current = drin ? { x: e.clientX - r.left, y: e.clientY - r.top } : null;
      if (!start || !(e.buttons & 1)) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!gezogen.current && Math.hypot(dx, dy) < 5) return;
      gezogen.current = true;
      const a = start.a;
      const mx = (dx / r.width) * (a.x1 - a.x0), mz = (dy / r.height) * (a.z1 - a.z0);
      setzen({ x0: a.x0 - mx, x1: a.x1 - mx, z0: a.z0 + mz, z1: a.z1 + mz });
    };
    const hoch = () => { start = null; };
    const raus = () => { zeiger.current = null; };
    c.addEventListener("wheel", rad, { passive: false });
    c.addEventListener("pointerdown", runter);
    c.addEventListener("pointerleave", raus);
    window.addEventListener("pointermove", bewegen);
    window.addEventListener("pointerup", hoch);
    return () => {
      c.removeEventListener("wheel", rad);
      c.removeEventListener("pointerdown", runter);
      c.removeEventListener("pointerleave", raus);
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", hoch);
    };
    // aktuell()/umPunkt lesen Refs — die Listener bleiben für die Lebenszeit stehen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas]);

  /** Ein Klick nach einem Ziehen zählt nicht */
  const klickZaehlt = () => {
    const g = gezogen.current;
    gezogen.current = false;
    return !g;
  };

  /**
   * Im Lupenmodus zoomt ein Klick an die Stelle der Lupe und ist damit
   * verbraucht (true). Sonst false — dann gilt der Klick den Begriffen.
   */
  const lupenKlick = (e: { clientX: number; clientY: number }) => {
    const c = canvas.current;
    if (!lupeRef.current || !c) return false;
    const r = c.getBoundingClientRect();
    const a = aktuell();
    const x = a.x0 + ((e.clientX - r.left) / r.width) * (a.x1 - a.x0);
    const z = a.z1 - ((e.clientY - r.top) / r.height) * (a.z1 - a.z0);
    // Die Stelle unter der Lupe wird zur Mitte des neuen Ausschnitts
    const breite = (a.x1 - a.x0) / LUPE_FAKTOR, hoehe = (a.z1 - a.z0) / LUPE_FAKTOR;
    if (breite < 4) return true;
    setzen({ x0: x - breite / 2, x1: x + breite / 2, z0: z - hoehe / 2, z1: z + hoehe / 2 });
    return true;
  };

  /** Den Vergrößerungskreis über die fertig gezeichnete Canvas legen */
  const lupeZeichnen = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => {
    const p = zeiger.current;
    if (!lupeRef.current || !p) return;
    const dpr = window.devicePixelRatio || 1;
    const q = LUPE_RADIUS / LUPE_FAKTOR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, LUPE_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, (p.x - q) * dpr, (p.y - q) * dpr, 2 * q * dpr, 2 * q * dpr, p.x - LUPE_RADIUS, p.y - LUPE_RADIUS, 2 * LUPE_RADIUS, 2 * LUPE_RADIUS);
    ctx.restore();
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(30,30,30,0.85)";
    ctx.beginPath(); ctx.arc(p.x, p.y, LUPE_RADIUS, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(p.x, p.y, LUPE_RADIUS - 3, 0, Math.PI * 2); ctx.stroke();
    // Griff
    ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(60,45,30,0.9)";
    const w = Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(w) * (LUPE_RADIUS + 2), p.y + Math.sin(w) * (LUPE_RADIUS + 2));
    ctx.lineTo(p.x + Math.cos(w) * (LUPE_RADIUS + 34), p.y + Math.sin(w) * (LUPE_RADIUS + 34));
    ctx.stroke();
    ctx.restore();
  };

  return { fenster, setzen, aktuell, klickZaehlt, lupe, setLupe, lupenKlick, lupeZeichnen, gezoomt: fenster !== null };
}

/** Zoomknöpfe unten links auf der Bühne */
export const ZOOM_KNOPF = "px-2 py-1 rounded-lg bg-black/55 text-white text-xs font-bold hover:bg-black/70";
export const ZOOM_KNOPF_AN = "px-2 py-1 rounded-lg bg-amber-400 text-black text-xs font-bold";
