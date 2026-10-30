"use client";
/**
 * Teilen-Knopf für Spielergebnisse: Teilen-Symbol, dann optional ein Spruch
 * aus einer festen Liste (kein Freitext). Eigener Beitrag, mit Code auch im Klassen-Feed.
 */
import { useState } from "react";
import { api } from "@/lib/api";
import { NAME_MUSTER, SPRUECHE } from "@/lib/klikk/klasse";
import { spielTeilen } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";
import type { Online } from "./spiele/SpieleApp";

export default function TeilenKnopf({ s, setze, online, spiel, punkte, tipp }: {
  s: Stand; setze: (f: (s: Stand) => Stand) => void; online?: Online; spiel: string; punkte: number; tipp?: string;
}) {
  const [offen, setOffen] = useState(false);
  const [geteilt, setGeteilt] = useState<string | null>(null);

  const teilen = (spruch?: string) => {
    setOffen(false);
    setGeteilt(spruch ? SPRUECHE[spruch] : "");
    setze(st => spielTeilen(st, spiel, punkte, tipp, spruch ? SPRUECHE[spruch] : undefined));
    if (online?.zugang && NAME_MUSTER.test(s.name)) {
      api.klikk.posten(online.zugang, { name: s.name, art: "spiel", tag: s.tag, spiel, punkte, hygiene: s.hygiene, spruch }).catch(() => {});
    }
  };

  if (geteilt !== null) return <span className="text-xs text-muted self-start">✅ Geteilt{geteilt ? `: »${geteilt}«` : ""}</span>;
  return (
    <div className="relative self-start">
      <button aria-label="Teilen" title="Teilen" onClick={() => setOffen(v => !v)}
        className="w-10 h-10 rounded-full bg-accent text-accent-fg grid place-items-center shadow">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
      </button>
      {offen && (
        <div className="absolute z-30 bottom-12 left-0 w-64 card p-2 shadow-xl flex flex-col gap-1">
          <div className="text-xs font-bold text-muted px-1">Mit Spruch teilen</div>
          <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
            {Object.entries(SPRUECHE).map(([id, text]) => (
              <button key={id} onClick={() => teilen(id)} className="rounded-full border border-line px-2 py-0.5 text-xs hover:bg-surface-hover">{text}</button>
            ))}
          </div>
          <button onClick={() => teilen()} className="text-xs underline text-muted self-start px-1">Ohne Spruch teilen</button>
        </div>
      )}
    </div>
  );
}
