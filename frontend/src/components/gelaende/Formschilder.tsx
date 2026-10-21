"use client";
/** Erkannte Formen als Schilder über einer quadratischen Draufsicht (Zellkoordinaten 0..n) */
import type { Marke } from "@/lib/gelaende/formen";

export default function Formschilder({ marken, n }: { marken: Marke[]; n: number }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {marken.map((m, i) => (
        <div key={i} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${(m.x / n) * 100}%`, top: `${(m.y / n) * 100}%` }}>
          <div className="pointer-events-auto whitespace-nowrap rounded border border-yellow-500 bg-yellow-100/95 px-1.5 py-0.5 text-[11px] font-bold text-yellow-950" title={m.erklaerung}>{m.text}</div>
          <div className="mx-auto h-2 w-0.5 bg-yellow-500" />
        </div>
      ))}
    </div>
  );
}
