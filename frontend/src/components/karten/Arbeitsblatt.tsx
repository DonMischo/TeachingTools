"use client";
/**
 * Die Tabelle zur Karte: je nummerierter Ebene die Marken mit Platz zum
 * Ausfüllen — oder, mit »Lösung zeigen«, die Namen.
 */
import { useState } from "react";
import type { FeatureCollection } from "geojson";
import type { Katalog } from "@/lib/karten/stil";
import type { SatzInhalt } from "@/lib/karten/satz";

export default function Arbeitsblatt({ katalog, inhalt, nummern, daten, titel }: {
  katalog: Katalog;
  inhalt: SatzInhalt;
  nummern: Record<string, Record<string, string>>;
  daten: Record<string, FeatureCollection | undefined>;
  titel: string;
}) {
  const [loesung, setLoesung] = useState(false);
  const gruppen = katalog.ebenen.filter((e) => nummern[e.id] && inhalt.ebenen.includes(e.id));
  if (!gruppen.length) return null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3" aria-label="Arbeitsblatt">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-black text-base">📝 {titel} — Tabelle</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={loesung} onChange={() => setLoesung((l) => !l)} /> Lösung zeigen
        </label>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-4">
        {gruppen.map((e) => {
          const namen = new Map((daten[e.id]?.features ?? []).map((f) => [String(f.properties?.id), String(f.properties?.name ?? "")]));
          return (
            <table key={e.id} className="text-sm w-full border-collapse">
              <thead>
                <tr><th colSpan={2} className="text-left font-black pb-1 border-b border-[var(--border)]">{e.name}</th></tr>
              </thead>
              <tbody>
                {inhalt.auswahl[e.id].objekte.map((id) => (
                  <tr key={id} className="border-b border-[var(--border)]">
                    <td className="w-10 py-1.5 font-black text-[var(--red)]">{nummern[e.id][id]}</td>
                    <td className="py-1.5">{loesung ? namen.get(id) ?? "…" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </div>
    </section>
  );
}
