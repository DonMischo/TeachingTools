"use client";
/** Spannung und Strom eines Bauteils über der Zeit, je mit eigenem Maßstab. */
import { useEffect, useRef, type RefObject } from "react";
import { formatiere } from "@/lib/stromkreis/format";
import { farbenAus, type OsziPuffer } from "./Zeichenflaeche";

const U_FARBE = "#facc15", I_FARBE = "#60a5fa";

export default function Oszilloskop({ puffer, name, stand, schliessen }: {
  puffer: RefObject<OsziPuffer>; name: string; stand: number; schliessen: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const b = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(b * dpr)) { c.width = Math.round(b * dpr); c.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const f = farbenAus(c);
    ctx.fillStyle = f.grund; ctx.fillRect(0, 0, b, h);
    ctx.strokeStyle = f.raster; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(b, h / 2); ctx.stroke();

    const p = puffer.current.punkte;
    if (p.length < 2) return;
    const t0 = p[0].t, t1 = p[p.length - 1].t;
    const umax = Math.max(1e-9, ...p.map(q => Math.abs(q.u)));
    const imax = Math.max(1e-12, ...p.map(q => Math.abs(q.i)));
    const kurve = (wert: (q: (typeof p)[number]) => number, max: number, farbe: string) => {
      ctx.strokeStyle = farbe; ctx.lineWidth = 2; ctx.beginPath();
      p.forEach((q, k) => {
        const x = ((q.t - t0) / Math.max(1e-12, t1 - t0)) * b;
        const y = h / 2 - (wert(q) / max) * (h / 2 - 8);
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    };
    kurve(q => q.u, umax, U_FARBE);
    kurve(q => q.i, imax, I_FARBE);
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillStyle = U_FARBE; ctx.fillText(`U max ${formatiere(umax, "V")}`, 8, 16);
    ctx.fillStyle = I_FARBE; ctx.fillText(`I max ${formatiere(imax, "A")}`, 8, 32);
    ctx.fillStyle = f.text; ctx.textAlign = "right";
    ctx.fillText(`${formatiere(t1 - t0, "s")} Zeitfenster`, b - 8, h - 8);
    ctx.textAlign = "left";
  }, [puffer, stand]);

  return (
    <div className="card p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold">📈 Oszilloskop — {name}</div>
        <button className="btn btn-secondary text-xs px-2 py-1" onClick={schliessen}>Schließen</button>
      </div>
      <canvas ref={ref} className="w-full h-40 rounded-lg" aria-label={`Verlauf von Spannung und Strom an ${name}`} />
      <div className="text-xs text-muted">
        <span style={{ color: U_FARBE }}>■</span> Spannung · <span style={{ color: I_FARBE }}>■</span> Strom — jede Kurve mit eigenem Maßstab.
      </div>
    </div>
  );
}
