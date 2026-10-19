"use client";
/**
 * Flug über Höhen- und Farbbild im Stil von »Voxel Space« (s. lib/gelaende/voxel.ts).
 * Tasten: W/S oder ↑/↓ vor/zurück, A/D oder ←/→ drehen, Q/E hoch/runter,
 * Maus ziehen dreht und neigt. »Rundflug« kreist um die Mitte.
 */
import { useEffect, useRef, useState } from "react";
import { bodenHoehe, voxelBild, type Kamera, type VoxelKarte } from "@/lib/gelaende/voxel";

const W = 800, H = 450;

export default function VoxelFlug({ karte, mitte }: { karte: VoxelKarte; mitte?: { x: number; y: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const c0 = mitte ?? { x: karte.n / 2, y: karte.n / 2 };
  const kam = useRef<Kamera>({ x: c0.x, y: c0.y + karte.n * 0.32, winkel: 0, hoehe: 0, horizont: 0.3, weite: karte.n * 0.9 });
  const tasten = useRef(new Set<string>());
  const [rund, setRund] = useState(true);
  const rundRef = useRef(rund);
  rundRef.current = rund;
  const ziehen = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    kam.current = { ...kam.current, x: c0.x, y: c0.y + karte.n * 0.32, winkel: 0 };
    kam.current.hoehe = bodenHoehe(karte, kam.current.x, kam.current.y) + karte.n * 0.12;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [karte]);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const bild = ctx.createImageData(W, H);
    let t0 = performance.now(), raf = 0, phase = 0;
    const schleife = (t: number) => {
      const dt = Math.min(0.05, (t - t0) / 1000);
      t0 = t;
      const k = kam.current, ts = tasten.current;
      const v = karte.n * 0.18 * dt;
      if (rundRef.current) {
        phase += dt * 0.12;
        const r = karte.n * 0.3;
        k.x = c0.x - Math.sin(phase) * r;
        k.y = c0.y + Math.cos(phase) * r;
        k.winkel = phase;
        const boden = bodenHoehe(karte, k.x, k.y);
        k.hoehe += (Math.max(boden + karte.n * 0.06, karte.n * 0.12 + boden * 0.4) - k.hoehe) * dt;
      } else {
        const fx = Math.sin(k.winkel), fy = -Math.cos(k.winkel);
        if (ts.has("w") || ts.has("arrowup")) { k.x += fx * v; k.y += fy * v; }
        if (ts.has("s") || ts.has("arrowdown")) { k.x -= fx * v; k.y -= fy * v; }
        if (ts.has("a") || ts.has("arrowleft")) k.winkel -= 1.2 * dt;
        if (ts.has("d") || ts.has("arrowright")) k.winkel += 1.2 * dt;
        if (ts.has("e") || ts.has("pageup")) k.hoehe += v;
        if (ts.has("q") || ts.has("pagedown")) k.hoehe -= v;
        k.x = Math.max(0, Math.min(karte.n - 1, k.x));
        k.y = Math.max(0, Math.min(karte.n - 1, k.y));
        k.hoehe = Math.max(bodenHoehe(karte, k.x, k.y) + 6, Math.min(karte.n * 0.6, k.hoehe));
      }
      voxelBild(karte, k, bild);
      ctx.putImageData(bild, 0, 0);
      raf = requestAnimationFrame(schleife);
    };
    raf = requestAnimationFrame(schleife);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [karte]);

  const taste = (k: string, an: boolean) => {
    if (an) { tasten.current.add(k); setRund(false); } else tasten.current.delete(k);
  };
  const knopf = (k: string, label: string) => (
    <button className="btn-secondary px-2.5 py-1 bg-surface/90" onPointerDown={() => taste(k, true)} onPointerUp={() => taste(k, false)} onPointerLeave={() => taste(k, false)}>{label}</button>
  );

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-line bg-black">
      <canvas
        ref={ref} width={W} height={H} tabIndex={0} aria-label="3D-Flug über die Karte"
        className="block h-auto w-full cursor-grab outline-none"
        onKeyDown={e => { const k = e.key.toLowerCase(); if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "pageup", "pagedown"].includes(k)) { e.preventDefault(); taste(k, true); } }}
        onKeyUp={e => taste(e.key.toLowerCase(), false)}
        onBlur={() => tasten.current.clear()}
        onPointerDown={e => { ziehen.current = { x: e.clientX, y: e.clientY }; setRund(false); (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={e => {
          if (!ziehen.current) return;
          const k = kam.current;
          k.winkel += (e.clientX - ziehen.current.x) * 0.006;
          k.horizont = Math.max(-0.4, Math.min(1, k.horizont + (e.clientY - ziehen.current.y) * 0.002));
          ziehen.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => { ziehen.current = null; }}
      />
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 text-sm">
        {knopf("w", "⬆️")}{knopf("s", "⬇️")}{knopf("a", "↺")}{knopf("d", "↻")}{knopf("e", "🔼")}{knopf("q", "🔽")}
        <button className={`btn-secondary px-2.5 py-1 ${rund ? "bg-accent text-accent-fg" : "bg-surface/90"}`} onClick={() => setRund(r => !r)}>🔄 Rundflug</button>
      </div>
      <p className="absolute right-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">W/A/S/D fliegen · Q/E Höhe · Maus ziehen schaut</p>
    </div>
  );
}
