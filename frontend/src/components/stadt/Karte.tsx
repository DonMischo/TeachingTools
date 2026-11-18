"use client";
/**
 * Stadtplan als Canvas mit Verschieben (ziehen bzw. rechte Maustaste),
 * Zoom (Mausrad, Knöpfe) und Werkzeug-Ereignissen. Unten links steht,
 * was unter dem Mauszeiger liegt: Höhe, Neigung, Aue, Abstand zum Wasser.
 */
import type { GelaendeBilder } from "@/components/gelaende/leinwand";
import { useEffect, useRef, useState } from "react";
import { hoeheBei, inAue, istWasser, neigungBei, wasserAbstand, type Gelaende } from "@/lib/gelaende/gelaende";
import type { P } from "@/lib/stadt/geometrie";
import type { Haus } from "@/lib/stadt/haeuser";
import type { Stadt } from "@/lib/stadt/modell";
import { zeichneKarte, zuWelt, type Ansicht, type ZeichenOptionen } from "@/lib/stadt/zeichnen";

export interface KartenProps {
  g: Gelaende;
  bild: GelaendeBilder;
  stadt: Stadt;
  haeuser: Haus[];
  zonen?: boolean;
  vorschau?: ZeichenOptionen["vorschau"];
  marken?: ZeichenOptionen["marken"];
  /** Ausschnitt beim Start (Mitte und Radius in m) */
  fokus?: { x: number; y: number; r: number } | null;
  /** "klick": Klicks gehen ans Werkzeug, "ziehen": Rechteck aufziehen, sonst verschieben */
  werkzeug?: "klick" | "ziehen" | null;
  onKlick?: (p: P, info: { doppel: boolean; shift: boolean }) => void;
  onZiehen?: (a: P, b: P, fertig: boolean) => void;
  onBewegung?: (p: P | null, shift: boolean) => void;
  hoehe?: number;
  /** halbdurchsichtiges Bild über dem Gelände (z. B. Eignungskarte im Bau-Modus), deckt die ganze Karte */
  ueberlagerung?: CanvasImageSource | null;
}

export default function Karte(p: KartenProps) {
  const huelle = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [breite, setBreite] = useState(900);
  const H = p.hoehe ?? 600;
  const [ansicht, setAnsichtRoh] = useState<Ansicht>({ x0: 0, y0: 0, m: 0.2 });
  // nie über den Kartenrand hinaus; ist die Karte kleiner als das Bild, steht sie in der Mitte
  const klemme = (a: Ansicht): Ansicht => {
    const B = p.g.breite, w = breite / a.m, h = H / a.m;
    const x0 = w >= B ? (B - w) / 2 : Math.max(0, Math.min(B - w, a.x0));
    const y0 = h >= B ? (B - h) / 2 : Math.max(0, Math.min(B - h, a.y0));
    return { m: a.m, x0, y0 };
  };
  const setAnsicht = (f: Ansicht | ((a: Ansicht) => Ansicht)) => setAnsichtRoh(a => klemme(typeof f === "function" ? f(a) : f));
  const [info, setInfo] = useState<string>("");
  const zug = useRef<{ sx: number; sy: number; a: Ansicht; schieben: boolean; welt: P; bewegt: boolean } | null>(null);
  const letzterKlick = useRef(0);

  useEffect(() => {
    const el = huelle.current!;
    const ro = new ResizeObserver(() => setBreite(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ausschnitt anpassen, wenn Gelände oder Fokus wechseln
  const fokusKey = p.fokus ? `${Math.round(p.fokus.x)}|${Math.round(p.fokus.y)}|${Math.round(p.fokus.r)}` : "ganz";
  useEffect(() => {
    const f = p.fokus ?? { x: p.g.breite / 2, y: p.g.breite / 2, r: p.g.breite / 2 };
    const m = Math.min(breite, H) / (2 * f.r);
    setAnsicht({ m, x0: f.x - breite / 2 / m, y0: f.y - H / 2 / m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fokusKey, p.g, breite > 0]);

  useEffect(() => {
    const c = cv.current!;
    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    c.width = breite * dpr;
    c.height = H * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    zeichneKarte(ctx, breite, H, ansicht, p.g, p.stadt, { gelaende: p.bild.land, wasser: p.bild.wasser, haeuser: p.haeuser, zonen: p.zonen, vorschau: p.vorschau, marken: p.marken, ueberlagerung: p.ueberlagerung });
  }, [breite, H, ansicht, p.g, p.bild, p.stadt, p.haeuser, p.zonen, p.vorschau, p.marken, p.ueberlagerung]);

  const welt = (e: { clientX: number; clientY: number }): P => {
    const r = cv.current!.getBoundingClientRect();
    return zuWelt(ansicht, { x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const zoom = (f: number, um?: P) => {
    setAnsicht(a => {
      const m = Math.max(Math.min(breite, H) / p.g.breite, Math.min(6, a.m * f));
      const c = um ?? zuWelt(a, { x: breite / 2, y: H / 2 });
      const sx = (c.x - a.x0) * a.m, sy = (c.y - a.y0) * a.m;
      return { m, x0: c.x - sx / m, y0: c.y - sy / m };
    });
  };

  useEffect(() => {
    const c = cv.current!;
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const um = zuWelt(ansicht, { x: e.clientX - r.left, y: e.clientY - r.top });
      zoom(e.deltaY < 0 ? 1.18 : 1 / 1.18, um);
    };
    c.addEventListener("wheel", rad, { passive: false });
    return () => c.removeEventListener("wheel", rad);
  });

  const beschreibe = (q: P) => {
    const g = p.g;
    if (q.x < 0 || q.y < 0 || q.x > g.breite || q.y > g.breite) return "";
    if (istWasser(g, q.x, q.y)) return g.wasser[Math.floor(q.y / g.zelle) * g.n + Math.floor(q.x / g.zelle)] === 2 ? "🌊 Meer" : "💧 Fluss";
    const teile = [`⛰️ ${Math.round(hoeheBei(g, q.x, q.y))} m ü. NN`, `📐 ${neigungBei(g, q.x, q.y).toFixed(0)} % Neigung`];
    if (inAue(g, q.x, q.y)) teile.push("🌾 Aue (Hochwasser!)");
    if (g.wasser.some(w => w)) teile.push(`💧 ${Math.round(wasserAbstand(g, q.x, q.y))} m zum Wasser`);
    return teile.join(" · ");
  };

  return (
    <div ref={huelle} className="relative w-full select-none overflow-hidden rounded-xl border border-line" style={{ height: H }}>
      <canvas
        ref={cv}
        style={{ width: breite, height: H, touchAction: "none", cursor: p.werkzeug ? "crosshair" : "grab" }}
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => {
          try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetische Ereignisse */ }
          const schieben = e.button !== 0 || !p.werkzeug;
          zug.current = { sx: e.clientX, sy: e.clientY, a: ansicht, schieben, welt: welt(e), bewegt: false };
        }}
        onPointerMove={e => {
          const q = welt(e);
          setInfo(beschreibe(q));
          p.onBewegung?.(q, e.shiftKey);
          const z = zug.current;
          if (!z) return;
          if (Math.hypot(e.clientX - z.sx, e.clientY - z.sy) > 4) z.bewegt = true;
          if (z.schieben) setAnsicht({ ...z.a, x0: z.a.x0 - (e.clientX - z.sx) / z.a.m, y0: z.a.y0 - (e.clientY - z.sy) / z.a.m });
          else if (p.werkzeug === "ziehen" && z.bewegt) p.onZiehen?.(z.welt, q, false);
        }}
        onPointerUp={e => {
          const z = zug.current;
          zug.current = null;
          if (!z || z.schieben) return;
          const q = welt(e);
          if (p.werkzeug === "ziehen") { if (z.bewegt) p.onZiehen?.(z.welt, q, true); return; }
          if (z.bewegt) return;
          const jetzt = performance.now();
          const doppel = jetzt - letzterKlick.current < 320;
          letzterKlick.current = jetzt;
          p.onKlick?.(q, { doppel, shift: e.shiftKey });
        }}
        onPointerLeave={() => { setInfo(""); p.onBewegung?.(null, false); }}
      />
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button className="btn-secondary bg-surface/90 px-2 py-0.5" onClick={() => zoom(1.4)} aria-label="Vergrößern">＋</button>
        <button className="btn-secondary bg-surface/90 px-2 py-0.5" onClick={() => zoom(1 / 1.4)} aria-label="Verkleinern">－</button>
        <button className="btn-secondary bg-surface/90 px-2 py-0.5" aria-label="Ganze Karte" title="Ganze Karte"
          onClick={() => { const m = Math.min(breite, H) / p.g.breite; setAnsicht({ m, x0: p.g.breite / 2 - breite / 2 / m, y0: p.g.breite / 2 - H / 2 / m }); }}>⤢</button>
      </div>
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-white/80 px-1.5 text-xs font-bold text-neutral-700">N ↑</div>
      <Massstab m={ansicht.m} />
      {info && <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{info}</div>}
    </div>
  );
}

function Massstab({ m }: { m: number }) {
  const ziel = 110 / m;
  const stufen = [10, 20, 50, 100, 200, 500, 1000, 2000];
  const l = stufen.find(s => s >= ziel * 0.6) ?? 2000;
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-neutral-700">
      <div style={{ width: l * m, height: 4, borderLeft: "2px solid #333", borderRight: "2px solid #333", borderBottom: "2px solid #333" }} />
      {l >= 1000 ? `${l / 1000} km` : `${l} m`}
    </div>
  );
}
