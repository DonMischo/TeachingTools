"use client";
/** Ausschnitt aus einem Pixel-Sheet (scharf skaliert); mit `animation` läuft eine Bildfolge. */
import { useEffect, useState } from "react";

export type Frame = { x: number; y: number; w: number; h: number };

export function Sprite({ src, frame, scale = 3, animation, className, label }: {
  src: string; frame: Frame; scale?: number; animation?: { frames: Frame[]; fps: number }; className?: string; label?: string;
}) {
  const [i, setI] = useState(0);
  // Am Inhalt festgemacht, nicht am Objekt: ein neu gebautes {frames, fps} je Render setzte sonst den Takt
  // bei jedem Schritt zurück, und ein neuer Lauf begann mitten im Zyklus. Jede neue Bildfolge startet bei Bild 0.
  const takt = animation && animation.frames.length > 1 ? `${animation.fps}:${animation.frames.map((b) => `${b.x},${b.y}`).join(";")}` : "";
  const fps = animation?.fps ?? 0;
  useEffect(() => {
    setI(0);
    if (!takt) return;
    const t = setInterval(() => setI((n) => n + 1), 1000 / fps);
    return () => clearInterval(t);
  }, [takt]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = animation ? animation.frames[i % animation.frames.length] : frame;
  return (
    <span className={`inline-block overflow-hidden shrink-0 ${className ?? ""}`} style={{ width: f.w * scale, height: f.h * scale }}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <img src={src} alt="" draggable={false}
        style={{ imageRendering: "pixelated", maxWidth: "none", transformOrigin: "0 0", transform: `scale(${scale}) translate(${-f.x}px, ${-f.y}px)` }} />
    </span>
  );
}

/** Kachelraster aus einem Tileset; `karte[zeile][spalte]` = Kachel-id (zeilenweise im Sheet, `cols` Spalten). */
export function Kachelfeld({ src, tile = 16, cols, karte, scale = 3 }: {
  src: string; tile?: number; cols: number; karte: number[][]; scale?: number;
}) {
  return (
    <div aria-hidden className="leading-[0]">
      {karte.map((zeile, y) => (
        <div key={y} className="flex">
          {zeile.map((id, x) => (
            <Sprite key={x} src={src} scale={scale} frame={{ x: (id % cols) * tile, y: Math.floor(id / cols) * tile, w: tile, h: tile }} />
          ))}
        </div>
      ))}
    </div>
  );
}
