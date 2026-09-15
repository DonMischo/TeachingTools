"use client";
/**
 * Bilder von Weltraumteleskopen und Raumsonden, mit Erklärung und Nachweis.
 * Wo zwei Aufnahmen dasselbe zeigen (Hubble und Webb), gibt es den Vergleich
 * nebeneinander. Ganz unten: alle Bildnachweise der Simulation.
 */
import { useEffect, useState } from "react";
import { GALERIE, type GalerieEintrag } from "@/lib/sonnensystem/galerie";
import { ALLE_NACHWEISE, galerieBild } from "@/lib/sonnensystem/bilder";
import { KOERPER_NACH_ID } from "@/lib/sonnensystem/daten";
import { Nachweis } from "./Steckbrief";

export function Galerie({ offen, onOeffne, onWaehle }: {
  offen: string | null;
  onOeffne: (id: string | null) => void;
  onWaehle: (id: string) => void;
}) {
  const [nachweise, setNachweise] = useState(false);
  const index = GALERIE.findIndex(g => g.id === offen);
  const eintrag = index >= 0 ? GALERIE[index] : null;

  useEffect(() => {
    if (!eintrag) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOeffne(null);
      if (e.key === "ArrowRight") onOeffne(GALERIE[(index + 1) % GALERIE.length].id);
      if (e.key === "ArrowLeft") onOeffne(GALERIE[(index - 1 + GALERIE.length) % GALERIE.length].id);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [eintrag, index, onOeffne]);

  return (
    <div className="h-full overflow-y-auto p-4 text-slate-100">
      <p className="text-sm text-slate-300 max-w-2xl">
        So sehen Teleskope und Raumsonden unser Sonnensystem — und was dahinter liegt. Die Reihenfolge ist eine Reise:
        vom Erdaufgang hinaus zu Jupiter und Saturn, bis zum tiefsten Blick ins All.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        {GALERIE.map(g => (
          <button key={g.id} onClick={() => onOeffne(g.id)} className="group text-left rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-sky-300/50">
            <div className="aspect-[4/3] bg-black overflow-hidden">
              <img src={galerieBild(g.id)?.datei} alt={g.titel} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="px-3 py-2">
              <div className="font-bold text-sm">{g.titel}</div>
              <div className="text-[11px] text-slate-400">{g.von} · {g.jahr}</div>
            </div>
          </button>
        ))}
      </div>

      <button onClick={() => setNachweise(n => !n)} className="mt-6 text-xs text-slate-400 underline">
        {nachweise ? "Bildnachweise ausblenden" : `Alle ${Object.keys(ALLE_NACHWEISE).length} Bildnachweise zeigen`}
      </button>
      {nachweise && (
        <ul className="mt-2 text-[11px] text-slate-400 leading-relaxed columns-1 md:columns-2 gap-6">
          <li className="mb-2 break-inside-avoid text-slate-300">
            Planetentexturen: Solar System Scope (CC BY 4.0). Mondkarten: NASA, JPL, USGS, Lunar and Planetary Institute.
            Alle Bilder über Wikimedia Commons; verkleinert und teils zugeschnitten.
          </li>
          {Object.entries(ALLE_NACHWEISE).map(([schluessel, b]) => (
            <li key={schluessel} className="break-inside-avoid">
              <span className="text-slate-300">{schluessel.replace("/", ": ")}</span> — {b.urheber} ·{" "}
              <a href={b.seite} target="_blank" rel="noreferrer" className="underline">{b.lizenz}</a>
            </li>
          ))}
        </ul>
      )}

      {eintrag && <Grossansicht eintrag={eintrag} onOeffne={onOeffne} onWaehle={onWaehle} index={index} />}
    </div>
  );
}

function Grossansicht({ eintrag, index, onOeffne, onWaehle }: {
  eintrag: GalerieEintrag;
  index: number;
  onOeffne: (id: string | null) => void;
  onWaehle: (id: string) => void;
}) {
  const [vergleich, setVergleich] = useState(false);
  const paar = eintrag.paar ? GALERIE.find(g => g.id === eintrag.paar) : undefined;
  const bilder = vergleich && paar ? [eintrag, paar] : [eintrag];
  const koerper = eintrag.koerper ? KOERPER_NACH_ID[eintrag.koerper] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex flex-col" role="dialog" aria-label={eintrag.titel}>
      <div className="flex items-center justify-between px-4 py-2 text-slate-200">
        <span className="text-xs text-slate-400">{index + 1} / {GALERIE.length}</span>
        <div className="flex gap-2">
          <button onClick={() => onOeffne(GALERIE[(index - 1 + GALERIE.length) % GALERIE.length].id)} className="w-10 h-10 rounded-lg hover:bg-white/10" aria-label="Vorheriges Bild">←</button>
          <button onClick={() => onOeffne(GALERIE[(index + 1) % GALERIE.length].id)} className="w-10 h-10 rounded-lg hover:bg-white/10" aria-label="Nächstes Bild">→</button>
          <button onClick={() => onOeffne(null)} className="w-10 h-10 rounded-lg hover:bg-white/10" aria-label="Schließen">✕</button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex gap-2 px-4">
        {bilder.map(b => {
          const nachweis = galerieBild(b.id)!;
          return (
            <figure key={b.id} className="flex-1 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <img src={nachweis.datei} alt={b.titel} className="max-w-full max-h-full object-contain" />
              </div>
              {bilder.length > 1 && <div className="text-center text-xs text-slate-300 mt-1">{b.von} · {b.jahr}</div>}
            </figure>
          );
        })}
      </div>
      <div className="px-4 py-3 max-w-3xl mx-auto w-full text-slate-100">
        <h3 className="text-lg font-black">{eintrag.titel}</h3>
        <div className="text-xs text-sky-300">{eintrag.von} · {eintrag.jahr}</div>
        <p className="text-sm text-slate-300 mt-1 leading-relaxed">{eintrag.text}</p>
        <div className="flex flex-wrap gap-3 mt-2 items-center">
          {paar && (
            <button onClick={() => setVergleich(v => !v)} className="text-xs rounded-lg border border-white/20 px-2 py-1 hover:bg-white/10">
              {vergleich ? "Nur dieses Bild" : `⇆ Vergleichen mit ${paar.von}`}
            </button>
          )}
          {koerper && (
            <button onClick={() => { onOeffne(null); onWaehle(koerper.id); }} className="text-xs rounded-lg border border-white/20 px-2 py-1 hover:bg-white/10">
              📖 Steckbrief {koerper.name}
            </button>
          )}
        </div>
        <Nachweis bild={galerieBild(eintrag.id)!} />
      </div>
    </div>
  );
}
