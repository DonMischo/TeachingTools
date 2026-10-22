"use client";
/**
 * Stromkreise — Schaltungen bauen und zusehen, wie der Strom fließt.
 * Vorbild: der Circuit Simulator von Paul Falstad (circuitjs1, GPL-2.0);
 * Löser, Zeichnung und Bedienung sind neu geschrieben und auf Schulversuche
 * zugeschnitten.
 *
 * Aufbau: links die Bauteilkiste, in der Mitte die Zeichenfläche (rechnet und
 * zeichnet), rechts der Inspektor, darunter auf Wunsch das Oszilloskop.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Schaltung } from "@/lib/stromkreis/modell";
import { Simulation } from "@/lib/stromkreis/simulation";
import { drehe, loesche, setzeWert as setzeWertIn, type Auswahl } from "@/lib/stromkreis/editor";
import { hatWechsel } from "@/lib/stromkreis/lauf";
import { TEILE } from "@/lib/stromkreis/teile";
import { START } from "@/lib/stromkreis/beispiele";
import Zeichenflaeche, { type Anzeige, type Ansicht, type Effektiv, type OsziPuffer, type Werkzeug } from "./Zeichenflaeche";
import Palette from "./Palette";
import Inspektor, { type Stand } from "./Inspektor";
import Oszilloskop from "./Oszilloskop";

const TEMPI = [
  { wert: 1, label: "Echtzeit" },
  { wert: 0.2, label: "Zeitlupe ×5" },
  { wert: 0.02, label: "Zeitlupe ×50" },
  { wert: 0.002, label: "Zeitlupe ×500" },
] as const;

interface Verlauf { liste: Schaltung[]; pos: number }

/** `start`: Schaltung, mit der es losgeht (sonst Batterie, Schalter, Lämpchen). */
export default function Stromkreis({ action, start }: { action?: ReactNode; start?: Schaltung }) {
  const [verlauf, setVerlauf] = useState<Verlauf>({ liste: [start ?? START], pos: 0 });
  const schaltung = verlauf.liste[verlauf.pos];
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [werkzeug, setWerkzeug] = useState<Werkzeug>("auswahl");
  const [anzeige, setAnzeige] = useState<Anzeige>({ laufend: true, tempo: 1, elektronen: false, farbig: true });
  const [einpassen, setEinpassen] = useState(0);
  const [neustart, setNeustart] = useState(0);
  const [osziId, setOsziId] = useState<string | null>(null);
  const [stand, setStand] = useState<Stand>({});
  const [taktNr, setTaktNr] = useState(0);

  const sim = useRef<Simulation | null>(null);
  const ansicht = useRef<Ansicht>({ x: 40, y: 40, zoom: 1.5 });
  const oszi = useRef<OsziPuffer>({ id: null, punkte: [] });
  const mittel = useRef(new Map<string, Effektiv>());

  const aendern = useCallback((s: Schaltung) => {
    setVerlauf(v => {
      const liste = [...v.liste.slice(0, v.pos + 1), s].slice(-100);
      return { liste, pos: liste.length - 1 };
    });
  }, []);
  const rueckgaengig = () => setVerlauf(v => ({ ...v, pos: Math.max(0, v.pos - 1) }));
  const wiederholen = () => setVerlauf(v => ({ ...v, pos: Math.min(v.liste.length - 1, v.pos + 1) }));

  // Neue Simulation nur, wenn sich die Lage ändert — Werte drehen lässt den Kreis weiterlaufen.
  const geometrie = useMemo(
    () => JSON.stringify([schaltung.bauteile.map(t => [t.id, t.art, t.a, t.b]), schaltung.draehte]),
    [schaltung],
  );
  useEffect(() => {
    sim.current = new Simulation(schaltung);
    mittel.current.clear();
    oszi.current.punkte = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometrie, neustart]);
  useEffect(() => {
    const s = sim.current;
    if (!s) return;
    for (const t of schaltung.bauteile) {
      for (const [k, v] of Object.entries({ ...TEILE[t.art].werte, ...t.werte })) s.setzeWert(t.id, k, v);
    }
  }, [schaltung]);

  // Ausgewähltes, das es nicht mehr gibt (Rückgängig), abwählen
  const bauteil = auswahl?.art === "bauteil" ? schaltung.bauteile.find(t => t.id === auswahl.id) : undefined;
  const draht = auswahl?.art === "draht" ? schaltung.draehte.find(d => d.id === auswahl.id) : undefined;
  useEffect(() => {
    if (auswahl && !bauteil && !draht) setAuswahl(null);
  }, [auswahl, bauteil, draht]);
  useEffect(() => {
    if (osziId && !schaltung.bauteile.some(t => t.id === osziId)) setOsziId(null);
  }, [osziId, schaltung]);
  useEffect(() => { oszi.current = { id: osziId, punkte: [] }; }, [osziId]);

  const takt = () => {
    const s = sim.current;
    if (!s) return;
    setTaktNr(n => n + 1);
    if (bauteil) setStand({ messung: s.messung(bauteil.id), eff: mittel.current.get(bauteil.id) });
    else if (draht) setStand({ drahtStrom: s.drahtStrom(draht.id) });
    else setStand({});
  };

  const setzeWert = (id: string, name: string, wert: number) => aendern(setzeWertIn(schaltung, id, name, wert));
  const schalten = (id: string) => {
    const t = schaltung.bauteile.find(x => x.id === id);
    if (!t) return;
    const name = t.art === "umschalter" ? "stellung" : "geschlossen";
    const jetzt = t.werte[name] ?? TEILE[t.art].werte[name] ?? 0;
    setzeWert(id, name, jetzt >= 0.5 ? 0 : 1);
  };
  const loeschen = () => { if (auswahl) { aendern(loesche(schaltung, auswahl)); setAuswahl(null); } };
  const drehen = () => { if (auswahl) aendern(drehe(schaltung, auswahl)); };

  // Tastatur: Entf, R, Esc, Strg+Z/Y — nicht, während in ein Feld getippt wird
  const tasten = useRef({ loeschen, drehen, rueckgaengig, wiederholen });
  useEffect(() => { tasten.current = { loeschen, drehen, rueckgaengig, wiederholen }; });
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && ["INPUT", "SELECT", "TEXTAREA"].includes(ziel.tagName)) return;
      const t = tasten.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) t.wiederholen(); else t.rueckgaengig(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); t.wiederholen(); }
      else if (e.key === "Delete" || e.key === "Backspace") t.loeschen();
      else if (e.key === "r" || e.key === "R") t.drehen();
      else if (e.key === "Escape") { setWerkzeug("auswahl"); setAuswahl(null); }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

  const wechsel = hatWechsel(schaltung);
  const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">💡 Stromkreise</h1>
          <p className="text-muted text-sm mt-1">Schaltungen bauen und zusehen, wie der Strom fließt — mit Batterie, Lämpchen, Schaltern, Messgeräten, Kondensator, Spule und Trafo.</p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={() => setAnzeige(a => ({ ...a, laufend: !a.laufend }))}>
          {anzeige.laufend ? "⏸ Anhalten" : "▶ Weiter"}
        </button>
        <select className="input w-auto" value={anzeige.tempo} onChange={e => setAnzeige(a => ({ ...a, tempo: Number(e.target.value) }))} aria-label="Tempo">
          {TEMPI.map(t => <option key={t.wert} value={t.wert}>{t.label}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={() => setNeustart(n => n + 1)} title="Kondensatoren entladen, Motoren anhalten">⟲ Neu starten</button>
        <div className="inline-flex rounded-xl border border-line p-1 bg-surface">
          <button className={chip(!anzeige.elektronen)} onClick={() => setAnzeige(a => ({ ...a, elektronen: false }))} title="Punkte laufen von + nach −">Technische Stromrichtung</button>
          <button className={chip(anzeige.elektronen)} onClick={() => setAnzeige(a => ({ ...a, elektronen: true }))} title="Punkte laufen von − nach +">Elektronen</button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={anzeige.farbig} onChange={e => setAnzeige(a => ({ ...a, farbig: e.target.checked }))} />
          Spannung farbig
        </label>
        <div className="flex gap-1 ml-auto">
          <button className="btn btn-secondary" onClick={rueckgaengig} disabled={verlauf.pos === 0} title="Rückgängig (Strg+Z)">↶</button>
          <button className="btn btn-secondary" onClick={wiederholen} disabled={verlauf.pos >= verlauf.liste.length - 1} title="Wiederholen (Strg+Y)">↷</button>
          <button className="btn btn-secondary" onClick={() => setEinpassen(n => n + 1)} title="Ganze Schaltung zeigen">⤢</button>
          <button className="btn btn-danger" onClick={() => { aendern({ version: 1, bauteile: [], draehte: [] }); setAuswahl(null); }} title="Alles löschen">🗑</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)_280px]">
        <div className="order-2 lg:order-1"><Palette werkzeug={werkzeug} setWerkzeug={setWerkzeug} /></div>
        <div className="order-1 lg:order-2 flex flex-col gap-3 min-w-0">
          <Zeichenflaeche
            schaltung={schaltung} sim={sim} auswahl={auswahl} setAuswahl={setAuswahl}
            werkzeug={werkzeug} setWerkzeug={setWerkzeug} aendern={aendern} schalten={schalten}
            anzeige={anzeige} ansicht={ansicht} oszi={oszi} mittel={mittel} einpassen={einpassen} takt={takt}
          />
          <div className="text-xs text-muted">
            {anzeige.elektronen ? "Blaue Punkte: Elektronen, sie laufen vom Minus- zum Pluspol." : "Gelbe Punkte: technische Stromrichtung, von Plus nach Minus."}
            {anzeige.farbig && " Leitungen: grün = höheres Potenzial, rot = niedrigeres, grau = Minuspol der Quelle."}
            {wechsel && anzeige.tempo === 1 && " Bei 50 Hz ist das Hin und Her zu schnell fürs Auge — Zeitlupe ×50 zeigt es."}
          </div>
          {osziId && (
            <Oszilloskop
              puffer={oszi} stand={taktNr}
              name={TEILE[schaltung.bauteile.find(t => t.id === osziId)?.art ?? "widerstand"].name}
              schliessen={() => setOsziId(null)}
            />
          )}
        </div>
        <div className="order-3">
          <Inspektor
            key={auswahl?.id ?? "-"}
            bauteil={bauteil} draht={draht} stand={stand} wechsel={wechsel}
            setzeWert={setzeWert} schalten={schalten} drehen={drehen} loeschen={loeschen}
            reparieren={id => { sim.current?.repariere(id); }} oszi={setOsziId}
          />
        </div>
      </div>
      <p className="text-xs text-muted">
        Vorbild: <a className="underline" href="https://github.com/pfalstad/circuitjs1" target="_blank" rel="noreferrer">Circuit Simulator</a> von Paul Falstad (GPL-2.0) — neu geschrieben. Vereinfacht für die Schule: ideale Leitungen, Quellen mit Innenwiderstand, Trafo ohne Kernverluste.
      </p>
    </div>
  );
}
