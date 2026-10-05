"use client";
/**
 * ☰-Menü oben links auf der Karte: Kartennetz wählen (Equal Earth / Mercator).
 */
import { useState } from "react";
import { PROJEKTIONEN, type Projektion } from "@/lib/karten/projektion";

export default function KartenMenue({ projektion, setProjektion }: { projektion: Projektion; setProjektion: (p: Projektion) => void }) {
  const [offen, setOffen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1">
      <button onClick={() => setOffen((x) => !x)} aria-label="Kartenmenü" aria-expanded={offen}
        className="w-9 h-9 rounded-lg bg-white/95 border border-black/20 shadow-sm text-lg leading-none text-neutral-800">☰</button>
      {offen && (
        <div role="radiogroup" aria-label="Kartennetz" className="rounded-xl bg-white/95 border border-black/20 shadow-sm p-2 flex flex-col gap-1 text-sm text-neutral-800 w-60">
          <span className="text-[10px] font-black uppercase tracking-wide text-neutral-500">Kartennetz</span>
          {PROJEKTIONEN.map((p) => (
            <label key={p.id} className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="projektion" checked={projektion === p.id} onChange={() => { setProjektion(p.id); setOffen(false); }} className="mt-1" />
              <span><b>{p.name}</b><span className="block text-xs text-neutral-500">{p.text}</span></span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
