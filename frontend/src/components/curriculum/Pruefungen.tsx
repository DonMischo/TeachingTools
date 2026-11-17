"use client";
/**
 * Tests und Klassenarbeiten einer Unterrichtseinheit: erst nur ein Name, später
 * mit einer Fragmente-Karte bzw. einem Clipping (oder Link) verknüpft.
 */
import { useState } from "react";
import { Verknuepfungen } from "./Verknuepfungen";
import type { Pruefung } from "@/lib/curriculum/modell";

const neueId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function NameFeld({ start, onFertig, platzhalter }: { start: string; onFertig: (name: string | null) => void; platzhalter?: string }) {
  return (
    <input autoFocus defaultValue={start} placeholder={platzhalter} aria-label="Name"
      className="input py-0.5 px-1.5 text-xs min-w-0 flex-1"
      onKeyDown={e => {
        if (e.key === "Enter") onFertig(e.currentTarget.value.trim() || null);
        if (e.key === "Escape") { e.stopPropagation(); onFertig(null); }
      }}
      onBlur={e => onFertig(e.currentTarget.value.trim() || null)} />
  );
}

export function Pruefungen({ liste, onChange, klasse }: {
  liste: Pruefung[];
  /** fehlt → nur ansehen und öffnen */
  onChange?: (liste: Pruefung[]) => void;
  klasse?: number;
}) {
  const [neu, setNeu] = useState(false);
  const [umbenennen, setUmbenennen] = useState<string | null>(null);
  const aendern = (id: string, teil: Partial<Pruefung>) => onChange?.(liste.map(p => (p.id === id ? { ...p, ...teil } : p)));

  return (
    <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
      {liste.map(p => (
        <div key={p.id} className="flex flex-wrap items-center gap-1 rounded border border-line bg-page px-1.5 py-1 text-xs">
          <span aria-hidden>📝</span>
          {umbenennen === p.id
            ? <NameFeld start={p.name} onFertig={name => { setUmbenennen(null); if (name && name !== p.name) aendern(p.id, { name }); }} />
            : <button className="font-medium text-left flex-1 min-w-0" disabled={!onChange}
                title={onChange ? "Umbenennen" : undefined} onClick={() => setUmbenennen(p.id)}>{p.name}</button>}
          <Verknuepfungen links={p.link ? [p.link] : []} klasse={klasse} klein max={1} typen={["fragmente", "link"]}
            plus="🔗 verknüpfen" onChange={onChange && (l => aendern(p.id, { link: l[0] ?? null }))} />
          {onChange && (
            <button className="text-muted hover:text-bad" title="Entfernen" aria-label={`${p.name} entfernen`}
              onClick={() => { if (confirm(`»${p.name}« entfernen?`)) onChange(liste.filter(x => x.id !== p.id)); }}>✕</button>
          )}
        </div>
      ))}
      {onChange && (neu
        ? <NameFeld platzhalter="z. B. Klassenarbeit Brüche" start=""
            onFertig={name => { setNeu(false); if (name) onChange([...liste, { id: neueId(), name, link: null }]); }} />
        : <button className="self-start rounded-full border border-dashed border-line text-muted hover:text-accent hover:border-accent text-[11px] px-1.5"
            onClick={() => setNeu(true)}>+ Test / Klassenarbeit</button>)}
    </div>
  );
}
