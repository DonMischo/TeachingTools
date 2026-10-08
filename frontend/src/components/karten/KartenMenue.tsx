"use client";
/**
 * ☰-Menü oben links auf der Karte: Kartennetz (Equal Earth / Mercator / Globus) und Seitenformat.
 */
import { useState } from "react";
import { PROJEKTIONEN, type Projektion } from "@/lib/karten/projektion";
import { SEITEN, type Seite } from "@/lib/karten/seite";

export default function KartenMenue({ projektion, setProjektion, seite, setSeite }: {
  projektion: Projektion; setProjektion: (p: Projektion) => void;
  /** Ohne setSeite (Quiz, Üben) kein Seitenformat im Menü */
  seite?: Seite; setSeite?: (s: Seite) => void;
}) {
  const [offen, setOffen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1">
      <button onClick={() => setOffen((x) => !x)} aria-label="Kartenmenü" aria-expanded={offen}
        className="w-9 h-9 rounded-lg bg-white/95 border border-black/20 shadow-sm text-lg leading-none text-neutral-800">☰</button>
      {offen && (
        <div className="rounded-xl bg-white/95 border border-black/20 shadow-sm p-2 flex flex-col gap-1 text-sm text-neutral-800 w-60">
          <div role="radiogroup" aria-label="Kartennetz" className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-neutral-500">Kartennetz</span>
          {PROJEKTIONEN.map((p) => (
            <label key={p.id} className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="projektion" checked={projektion === p.id} onChange={() => { setProjektion(p.id); setOffen(false); }} className="mt-1" />
              <span><b>{p.name}</b><span className="block text-xs text-neutral-500">{p.text}</span></span>
            </label>
          ))}
          </div>
          {setSeite && (
            <div role="radiogroup" aria-label="Seitenformat" className="flex flex-col gap-1 pt-2 mt-1 border-t border-black/10">
              <span className="text-[10px] font-black uppercase tracking-wide text-neutral-500">Seitenformat (Export)</span>
              {SEITEN.map((s) => (
                <label key={s.id} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="seite" checked={(seite ?? "frei") === s.id} onChange={() => { setSeite(s.id); setOffen(false); }} className="mt-1" />
                  <span><b>{s.name}</b><span className="block text-xs text-neutral-500">{s.text}</span></span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
