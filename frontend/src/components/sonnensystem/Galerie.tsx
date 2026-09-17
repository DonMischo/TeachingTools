"use client";
/**
 * Bilder von Weltraumteleskopen, Raumsonden, Rovern und Astronauten, dazu die
 * Porträts aller Himmelskörper — mit Erklärung und Nachweis.
 *
 * Ein Bild ist freigeschaltet, sobald der passende Körper im Flug gescannt
 * wurde; gesperrte Karten sagen, wohin man fliegen muss. Lehrkräfte können
 * alles auf einmal zeigen. Der Filter nach Himmelskörper zeigt bei einem
 * Planeten auch die Bilder seiner Monde. Ganz unten: alle Bildnachweise.
 */
import { useEffect, useMemo, useState } from "react";
import { GALERIE, benoetigt, bildFuer, freigeschaltet, zeigt, zielName, type GalerieEintrag } from "@/lib/sonnensystem/galerie";
import { ALLE_NACHWEISE } from "@/lib/sonnensystem/bilder";
import { HAUPTKOERPER, KOERPER_NACH_ID, mondeVon, satellitenVon } from "@/lib/sonnensystem/daten";
import { Nachweis } from "./Steckbrief";

export function Galerie({ offen, onOeffne, onWaehle, erforscht, alleZeigen, onAlleZeigen }: {
  offen: string | null;
  onOeffne: (id: string | null) => void;
  onWaehle: (id: string) => void;
  erforscht: readonly string[];
  alleZeigen: boolean;
  /** Nur für Lehrkräfte: der Schalter, der alles freigibt */
  onAlleZeigen?: (an: boolean) => void;
}) {
  const [nachweise, setNachweise] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [portraets, setPortraets] = useState(true);

  const offenFuer = (e: GalerieEintrag) => alleZeigen || freigeschaltet(e, erforscht);
  const liste = GALERIE.filter(e => zeigt(e, filter) && (portraets || !e.portraet));
  const frei = liste.filter(offenFuer);
  const gesamtFrei = GALERIE.filter(offenFuer).length;
  const index = frei.findIndex(g => g.id === offen);
  const eintrag = index >= 0 ? frei[index] : null;
  const weiter = (schritt: number) => onOeffne(frei[(index + schritt + frei.length) % frei.length].id);

  useEffect(() => {
    if (!eintrag) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOeffne(null);
      if (e.key === "ArrowRight") weiter(1);
      if (e.key === "ArrowLeft") weiter(-1);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  });

  const filterOptionen = useMemo(
    () => HAUPTKOERPER.map(p => ({ planet: p, kinder: [...mondeVon(p.id), ...satellitenVon(p.id)] })),
    [],
  );

  return (
    <div className="h-full overflow-y-auto overscroll-contain p-4 text-slate-100">
      <p className="text-sm text-slate-300 max-w-3xl">
        So sehen Teleskope, Raumsonden, Rover und Astronauten unser Sonnensystem — und was dahinter liegt.
        Jedes Bild wird freigeschaltet, sobald du im Flugmodus den passenden Himmelskörper scannst.
      </p>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label className="flex items-center gap-2 text-xs text-slate-300">
          Zeige
          <select
            value={filter ?? ""}
            onChange={e => setFilter(e.target.value || null)}
            className="rounded-lg bg-black/50 border border-white/15 px-2 py-1.5 text-sm font-bold [color-scheme:dark]"
            aria-label="Nach Himmelskörper filtern"
          >
            <option value="">alle Himmelskörper</option>
            {filterOptionen.map(({ planet, kinder }) => (
              <optgroup key={planet.id} label={planet.name}>
                <option value={planet.id}>{planet.name}{kinder.length ? " und alles drum herum" : ""}</option>
                {kinder.map(m => <option key={m.id} value={m.id}>└ {m.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input type="checkbox" checked={portraets} onChange={e => setPortraets(e.target.checked)} className="accent-sky-400" />
          Porträts
        </label>
        <span className="text-xs text-slate-400">🔓 {gesamtFrei} von {GALERIE.length} Bildern freigeschaltet</span>
        {onAlleZeigen && (
          <label className="flex items-center gap-1.5 text-xs text-amber-200 ml-auto">
            <input type="checkbox" checked={alleZeigen} onChange={e => onAlleZeigen(e.target.checked)} className="accent-amber-300" />
            Alle zeigen (Lehrkraft)
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
        {liste.map(g => {
          const bild = bildFuer(g);
          if (!offenFuer(g)) {
            const fehlt = benoetigt(g).filter(id => !erforscht.includes(id)).map(zielName);
            return (
              <div key={g.id} className="rounded-xl overflow-hidden border border-dashed border-white/15 bg-white/[0.03]">
                <div className="aspect-[4/3] relative overflow-hidden bg-black">
                  {bild && <img src={bild.datei} alt="" loading="lazy" className="w-full h-full object-cover blur-xl opacity-25 scale-110" />}
                  <div className="absolute inset-0 flex items-center justify-center text-3xl">🔒</div>
                </div>
                <div className="px-3 py-2">
                  <div className="font-bold text-sm text-slate-400">{g.portraet ? g.titel : "Unbekanntes Bild"}</div>
                  <div className="text-[11px] text-slate-500">Scanne {fehlt.join(", ")}</div>
                </div>
              </div>
            );
          }
          return (
            <button key={g.id} onClick={() => onOeffne(g.id)} className="group text-left rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-sky-300/50">
              <div className="aspect-[4/3] bg-black overflow-hidden">
                <img src={bild?.datei} alt={g.titel} loading="lazy"
                  className={`w-full h-full ${g.portraet ? "object-contain" : "object-cover"} group-hover:scale-105 transition-transform duration-500`} />
              </div>
              <div className="px-3 py-2">
                <div className="font-bold text-sm">{g.portraet ? `Porträt: ${g.titel}` : g.titel}</div>
                <div className="text-[11px] text-slate-400 truncate">{g.von}{g.jahr ? ` · ${g.jahr}` : ""}</div>
              </div>
            </button>
          );
        })}
      </div>
      {liste.length === 0 && <p className="text-sm text-slate-400 mt-4">Zu diesem Himmelskörper gibt es hier keine Bilder.</p>}

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

      {eintrag && (
        <Grossansicht
          eintrag={eintrag} index={index} anzahl={frei.length}
          paarFrei={!!eintrag.paar && offenFuer(GALERIE.find(g => g.id === eintrag.paar)!)}
          onWeiter={weiter} onOeffne={onOeffne} onWaehle={onWaehle}
        />
      )}
    </div>
  );
}

function Grossansicht({ eintrag, index, anzahl, paarFrei, onWeiter, onOeffne, onWaehle }: {
  eintrag: GalerieEintrag;
  index: number;
  anzahl: number;
  paarFrei: boolean;
  onWeiter: (schritt: number) => void;
  onOeffne: (id: string | null) => void;
  onWaehle: (id: string) => void;
}) {
  const [vergleich, setVergleich] = useState(false);
  const paar = eintrag.paar && paarFrei ? GALERIE.find(g => g.id === eintrag.paar) : undefined;
  const bilder = vergleich && paar ? [eintrag, paar] : [eintrag];
  const koerper = eintrag.koerper ? KOERPER_NACH_ID[eintrag.koerper] : null;
  const nachweis = bildFuer(eintrag);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex flex-col" role="dialog" aria-label={eintrag.titel}>
      <div className="flex items-center justify-between px-4 py-2 text-slate-200">
        <span className="text-xs text-slate-400">{index + 1} / {anzahl}</span>
        <div className="flex gap-2">
          <button onClick={() => onWeiter(-1)} className="w-10 h-10 rounded-lg hover:bg-white/10" aria-label="Vorheriges Bild">←</button>
          <button onClick={() => onWeiter(1)} className="w-10 h-10 rounded-lg hover:bg-white/10" aria-label="Nächstes Bild">→</button>
          <button onClick={() => onOeffne(null)} className="w-10 h-10 rounded-lg hover:bg-white/10" aria-label="Schließen">✕</button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex gap-2 px-4">
        {bilder.map(b => (
          <figure key={b.id} className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <img src={bildFuer(b)?.datei} alt={b.titel} className="max-w-full max-h-full object-contain" />
            </div>
            {bilder.length > 1 && <div className="text-center text-xs text-slate-300 mt-1">{b.von}{b.jahr ? ` · ${b.jahr}` : ""}</div>}
          </figure>
        ))}
      </div>
      <div className="px-4 py-3 max-w-3xl mx-auto w-full text-slate-100">
        <h3 className="text-lg font-black">{eintrag.portraet ? `Porträt: ${eintrag.titel}` : eintrag.titel}</h3>
        <div className="text-xs text-sky-300">{eintrag.von}{eintrag.jahr ? ` · ${eintrag.jahr}` : ""}</div>
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
        {nachweis && <Nachweis bild={nachweis} />}
      </div>
    </div>
  );
}
