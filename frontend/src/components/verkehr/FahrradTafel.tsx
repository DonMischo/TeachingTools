"use client";
/**
 * Fahrrad-Tafel: Modell und Farbe wählen, Alter (für die Gehweg-Regel),
 * Schloss und die Mängel nach StVZO mit Paragraf und Bußgeld. Repariert wird
 * im Werkstatt-Spiel (FahrradWerkstatt).
 */
import { useState } from "react";
import {
  gebrauchtesRad, MODELLE, neuesRad, PFLEGE, pruefe, SCHLOESSER,
  type Fahrrad, type Modell, type Schloss,
} from "@/lib/verkehr/fahrrad";
import { ausHex, hexFarbe } from "@/lib/verkehr/aussehen";
import { FahrradBild } from "./FahrradBild";

const knopf = (an: boolean) => `rounded-lg px-2 py-1 text-[11px] font-bold ${an ? "bg-sky-500 text-black" : "bg-slate-700 hover:bg-slate-600"}`;

export function FahrradTafel({ rad, onRad, alter, onAlter, onZu, onWerkstatt }: {
  rad: Fahrrad | null; onRad: (r: Fahrrad) => void;
  alter: number; onAlter: (a: number) => void;
  onZu: () => void;
  /** Das Werkstatt-Spiel öffnen (mit dem Rad, das gerade gesetzt ist). */
  onWerkstatt: () => void;
}) {
  const [meldung, setMeldung] = useState<string | null>(null);
  const check = rad ? pruefe(rad) : null;

  return (
    <div className="absolute left-2 top-14 z-30 max-h-[calc(100%-4rem)] w-[340px] overflow-auto rounded-xl bg-slate-900/94 px-4 py-3 text-xs text-white shadow-xl ring-1 ring-white/15 backdrop-blur-sm">
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
            className="h-7 w-10 cursor-pointer rounded-sm border-0 bg-transparent p-0" />
          <span className="opacity-70">Rahmenfarbe</span>
          <button type="button" className="ml-auto underline opacity-80" title="Ein gebrauchtes Rad mit ein paar Macken"
            onClick={() => { onRad({ ...gebrauchtesRad(rad.modell, Math.random, rad.farbe), schloss: rad.schloss }); onWerkstatt(); }}>
            🏚️ Rad aus dem Keller
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span className="font-bold">Dein Alter:</span>
        <select value={alter} onChange={(e) => onAlter(Number(e.target.value))} className="rounded-sm bg-slate-800 px-2 py-0.5">
          {Array.from({ length: 12 }, (_, i) => i + 6).map((a) => <option key={a} value={a}>{a} Jahre</option>)}
        </select>
        <span className="opacity-70">{alter < 8 ? "Gehweg ist Pflicht" : alter <= 10 ? "Gehweg erlaubt" : "Radweg oder Fahrbahn"}</span>
      </div>

      {rad && (
        <>
          <div className="mt-3 rounded-lg bg-white p-1"><FahrradBild rad={rad} breite={300} /></div>
          {meldung && <div className="mt-1 font-bold text-sky-300">{meldung}</div>}
          <button type="button" onClick={onWerkstatt}
            className="mt-2 w-full rounded-lg bg-amber-400 px-3 py-2 text-sm font-black text-black hover:bg-amber-300">
            🔧 Ab in die Werkstatt — Checkliste abarbeiten
          </button>

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
            ? <div className="mt-1 rounded-sm bg-emerald-600/30 px-2 py-1 font-bold text-emerald-200">✅ Alles dran und in Ordnung — ab auf die Straße!</div>
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
