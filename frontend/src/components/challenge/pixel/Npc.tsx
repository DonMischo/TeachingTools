"use client";
/** Pixel-Figur aus den NPC-Einzelbildern (idle_1..4, 32×32 px): wippt, solange der Tab sichtbar ist; bei reduzierter Bewegung steht sie still. */
import { useEffect, useState } from "react";
import { wenigerBewegung } from "@/lib/challenge/bewegung";

export default function Npc({ name, scale = 4, label, className }: { name: string; scale?: number; label?: string; className?: string }) {
  const [i, setI] = useState(1);
  useEffect(() => {
    if (wenigerBewegung()) return;
    const t = setInterval(() => { if (!document.hidden) setI((n) => (n % 4) + 1); }, 250);
    return () => clearInterval(t);
  }, []);
  return (
    <img src={`/challenge/pixel/npcs/${name}_idle_${i}.png`} alt={label ?? ""} draggable={false} className={className}
      style={{ width: 32 * scale, height: 32 * scale, imageRendering: "pixelated", maxWidth: "none" }} />
  );
}
