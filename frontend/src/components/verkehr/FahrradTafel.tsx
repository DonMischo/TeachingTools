"use client";
/**
 * Fahrrad-Tafel: Modell und Farbe wählen, Alter (für die Gehweg-Regel),
 * Schloss, und die Werkstatt — Werkzeug wählen, auf das Teil klicken. Dazu
 * die Prüfung nach StVZO mit Paragraf und Bußgeld.
 */
import { useState } from "react";
import {
  gebrauchtesRad, MODELLE, neuesRad, PFLEGE, PFLICHT, pruefe, repariere, SCHLOESSER, WERKZEUGE,
  type Fahrrad, type Modell, type Schloss, type TeilId, type Werkzeug,
} from "@/lib/verkehr/fahrrad";
import { ausHex, hexFarbe } from "@/lib/verkehr/aussehen";
import { FahrradBild } from "./FahrradBild";

const knopf = (an: boolean) => `rounded-lg px-2 py-1 text-[11px] font-bold ${an ? "bg-sky-500 text-black" : "bg-slate-700 hover:bg-slate-600"}`;
const NAME: Record<TeilId, string> = Object.fromEntries([...PFLICHT.map((p) => [p.teil, p.name]), ...PFLEGE.map((p) => [p.teil, p.name])]) as Record<TeilId, string>;

export function FahrradTafel({ rad, onRad, alter, onAlter, onZu, onRepariert }: {
  rad: Fahrrad | null; onRad: (r: Fahrrad) => void;
  alter: number; onAlter: (a: number) => void;
  onZu: () => void;
  /** Etwas repariert: für Punkte und Aufträge. */
  onRepariert?: (teil: TeilId, neu: Fahrrad) => void;
}) {
  const [werkzeug, setWerkzeug] = useState<Werkzeug | null>(null);
  const [auswahl, setAuswahl] = useState<TeilId | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const check = rad ? pruefe(rad) : null;

  const klick = (t: TeilId) => {
    if (!rad) return;
    setAuswahl(t);
    if (!werkzeug) { setMeldung(`${NAME[t]}: ${rad.teile[t] === "ok" ? "in Ordnung" : rad.teile[t] === "kaputt" ? "kaputt/verschlissen" : "fehlt"} — wähle ein Werkzeug.`); return; }
    const neu = repariere(rad, t, werkzeug);
    if (!neu) { setMeldung(`${WERKZEUGE[werkzeug].name} hilft hier nicht.`); return; }
    onRad(neu);
    onRepariert?.(t, neu);
    setMeldung(`${WERKZEUGE[werkzeug].icon} ${NAME[t]}: ${neu.teile[t] === "ok" ? "erledigt!" : "geflickt — jetzt noch aufpumpen."}`);
  };

  return (
    <div className="absolute left-2 top-14 z-30 max-h-[calc(100%-4rem)] w-[340px] overflow-auto rounded-xl bg-slate-900/94 px-4 py-3 text-xs text-white shadow-xl ring-1 ring-white/15 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-black">🚲 Fahrrad</span>
        <button type="button" className="underline opacity-80" onClick={onZu}>schließen</button>
      </div>

      <div className="font-bold">Modell</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {(Object.keys(MODELLE) as Modell[]).map((m) => (
          <button key={m} type="button" className={knopf(rad?.modell === m)} title={MODELLE[m].text}
            onClick={() => { onRad({ ...neuesRad(m, rad?.farbe), schloss: rad?.schloss ?? "keins" }); setMeldung(MODELLE[m].text); }}>
            {MODELLE[m].icon} {MODELLE[m].name}
          </button>
        ))}
      </div>
      {rad && (
        <div className="mt-1.5 flex items-center gap-2">
          <input type="color" value={hexFarbe(rad.farbe)} aria-label="Rahmenfarbe" onChange={(e) => onRad({ ...rad, farbe: ausHex(e.target.value) })}
            className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
          <span className="opacity-70">Rahmenfarbe</span>
          <button type="button" className="ml-auto underline opacity-80" title="Ein gebrauchtes Rad mit ein paar Macken"
            onClick={() => { onRad({ ...gebrauchtesRad(rad.modell, Math.random, rad.farbe), schloss: rad.schloss }); setMeldung("Aus dem Keller geholt — mal sehen, was alles kaputt ist."); }}>
            🏚️ Rad aus dem Keller
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span className="font-bold">Dein Alter:</span>
        <select value={alter} onChange={(e) => onAlter(Number(e.target.value))} className="rounded bg-slate-800 px-2 py-0.5">
          {Array.from({ length: 12 }, (_, i) => i + 6).map((a) => <option key={a} value={a}>{a} Jahre</option>)}
        </select>
        <span className="opacity-70">{alter < 8 ? "Gehweg ist Pflicht" : alter <= 10 ? "Gehweg erlaubt" : "Radweg oder Fahrbahn"}</span>
      </div>

      {rad && (
        <>
          <div className="mt-3 font-bold">Werkstatt</div>
          <div className="mt-1 rounded-lg bg-white p-1"><FahrradBild rad={rad} auswahl={auswahl} onTeil={klick} breite={300} /></div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(Object.keys(WERKZEUGE) as Werkzeug[]).map((w) => (
              <button key={w} type="button" className={knopf(werkzeug === w)} title={WERKZEUGE[w].text} onClick={() => setWerkzeug(werkzeug === w ? null : w)}>
                {WERKZEUGE[w].icon} {WERKZEUGE[w].name}
              </button>
            ))}
          </div>
          <div className="mt-1 opacity-70">{werkzeug ? `${WERKZEUGE[werkzeug].text} Klick auf das Teil.` : "Klick auf ein Teil, um es anzusehen — oder wähle ein Werkzeug."}</div>
          {meldung && <div className="mt-1 font-bold text-sky-300">{meldung}</div>}

          <div className="mt-3 font-bold">Schloss</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(Object.keys(SCHLOESSER) as Schloss[]).map((s) => (
              <button key={s} type="button" className={knopf(rad.schloss === s)} title={SCHLOESSER[s].text} onClick={() => onRad({ ...rad, schloss: s })}>
                {SCHLOESSER[s].icon} {SCHLOESSER[s].name}
              </button>
            ))}
          </div>

          <div className="mt-3 font-bold">Verkehrssicher nach StVZO?</div>
          {check!.verkehrssicher
            ? <div className="mt-1 rounded bg-emerald-600/30 px-2 py-1 font-bold text-emerald-200">✅ Alles dran und in Ordnung — ab auf die Straße!</div>
            : (
              <ul className="mt-1 flex flex-col gap-0.5">
                {check!.maengel.map((m) => (
                  <li key={m.teil} className="flex items-start gap-1.5">
                    <span>{m.zustand === "fehlt" ? "❌" : "⚠️"}</span>
                    <span><b>{m.name}</b> {m.zustand === "fehlt" ? "fehlt" : "kaputt"} — {m.regel}. Bußgeld für Erwachsene: {m.bussgeld} €{m.nurDunkel ? " (nachts ohne Licht mehr)" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          {!check!.fahrbar && <div className="mt-1 font-bold text-rose-300">🛞 Ein Reifen ist platt — flicken und aufpumpen, sonst geht gar nichts.</div>}
          {PFLEGE.some((p) => rad.teile[p.teil] === "kaputt") && <div className="mt-1 text-amber-200">Schlappe Reifen oder eine trockene Kette machen dich langsamer.</div>}
          <div className="mt-2 text-[10px] opacity-60">Helm ist in Deutschland keine Pflicht — schützt aber. Unter 8 Jahren muss man auf dem Gehweg fahren, bis 10 darf man (StVO § 2 Abs. 5).</div>
        </>
      )}
    </div>
  );
}
