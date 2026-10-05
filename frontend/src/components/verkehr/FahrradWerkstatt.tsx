"use client";
/**
 * Das Werkstatt-Spiel über fast die ganze Spielfläche: das Rad groß auf dem
 * Montageständer, rechts die Checkliste nach StVZO, unten das Werkzeug.
 * Erst jeden Punkt prüfen (Teil oder Listenzeile anklicken), dann mit dem
 * passenden Werkzeug reparieren. Zeit und Fehler geben am Ende Sterne.
 */
import { useEffect, useState } from "react";
import { MODELLE, WERKZEUGE, type Fahrrad, type TeilId, type Werkzeug } from "@/lib/verkehr/fahrrad";
import { benutze, CHECKLISTE, checkFertig, pruefeTeil, starteCheck, sterne, type Check } from "@/lib/verkehr/radcheck";
import { FahrradBild } from "./FahrradBild";

const WERKZEUG_LISTE = Object.keys(WERKZEUGE) as Werkzeug[];
const zeit = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function FahrradWerkstatt({ rad, onRad, onFertig, onNochmal, onZu }: {
  rad: Fahrrad; onRad: (r: Fahrrad) => void;
  /** Checkliste komplett, alles in Ordnung. */
  onFertig: (c: Check) => void;
  /** Ein neues Rad aus dem Keller holen und von vorn anfangen. */
  onNochmal: () => void;
  onZu: () => void;
}) {
  const [check, setCheck] = useState<Check>(() => starteCheck(rad, Date.now()));
  const [werkzeug, setWerkzeug] = useState<Werkzeug | null>(null);
  const [auswahl, setAuswahl] = useState<TeilId | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean | null }>({ text: "Schritt 1: Prüf jeden Punkt der Checkliste — klick ihn an, oder das Teil am Rad.", gut: null });
  const [ende, setEnde] = useState<number | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());

  // Neues Rad von außen (aus dem Keller): neu anfangen
  const [radVorher, setRadVorher] = useState(rad);
  if (rad !== radVorher && rad !== check.rad) {
    setRadVorher(rad);
    setCheck(starteCheck(rad, Date.now()));
    setEnde(null); setWerkzeug(null); setAuswahl(null);
    setMeldung({ text: "Ein neues Rad aus dem Keller — wieder von vorn prüfen.", gut: null });
  }

  useEffect(() => {
    if (ende) return;
    const i = setInterval(() => setJetzt(Date.now()), 500);
    return () => clearInterval(i);
  }, [ende]);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "Escape") onZu();
      const n = Number(e.key);
      if (n >= 1 && n <= WERKZEUG_LISTE.length) setWerkzeug((w) => (w === WERKZEUG_LISTE[n - 1] ? null : WERKZEUG_LISTE[n - 1]));
      if (e.key === "0") setWerkzeug(null);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onZu]);

  const uebernimm = (c: Check) => {
    setCheck(c);
    if (c.rad !== check.rad) onRad(c.rad);
    if (!ende && checkFertig(c)) { setEnde(Date.now()); onFertig(c); }
  };
  const pruefen = (t: TeilId) => {
    setAuswahl(t);
    const r = pruefeTeil(check, t);
    const z = r.c.rad.teile[t];
    uebernimm(r.c);
    setMeldung({ text: `🔍 ${r.text}`, gut: z === "ok" ? true : null });
  };
  const klick = (t: TeilId) => {
    if (ende) return;
    if (!werkzeug) { pruefen(t); return; }
    setAuswahl(t);
    const r = benutze(check, t, werkzeug);
    uebernimm(r.c);
    setMeldung({ text: r.text, gut: r.ok ? true : r.c.fehler > check.fehler ? false : null });
  };

  const geprueft = check.geprueft.length, inOrdnung = CHECKLISTE.filter((p) => check.geprueft.includes(p.teil) && check.rad.teile[p.teil] === "ok").length;
  const sekunden = ((ende ?? jetzt) - check.start) / 1000;
  const schritt = geprueft < CHECKLISTE.length ? 1 : inOrdnung < CHECKLISTE.length ? 2 : 3;

  return (
    <div className="absolute inset-1 z-40 flex flex-col overflow-hidden rounded-2xl bg-slate-900/97 text-white shadow-2xl ring-1 ring-white/15 sm:inset-3">
      {/* Kopf */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/10 px-4 py-2">
        <span className="text-base font-black">🔧 Fahrrad-Werkstatt</span>
        <span className="text-xs opacity-80">{MODELLE[check.rad.modell].icon} {MODELLE[check.rad.modell].name} verkehrssicher machen</span>
        <span className="ml-auto flex gap-3 text-xs font-bold tabular-nums">
          <span title="Zeit">⏱️ {zeit(sekunden)}</span>
          <span title="Fehler: falsches Werkzeug oder an heilen Teilen geschraubt" className={check.fehler ? "text-rose-300" : ""}>✖ {check.fehler}</span>
        </span>
        <button type="button" className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-bold hover:bg-slate-600" onClick={onZu}>schließen (Esc)</button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:flex-row">
        {/* Rad und Werkzeug */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex gap-1.5 text-[11px] font-bold">
            {["Prüfen", "Reparieren", "Fertig"].map((s, i) => (
              <span key={s} className={`rounded-full px-2.5 py-0.5 ${schritt === i + 1 ? "bg-sky-500 text-black" : schritt > i + 1 ? "bg-emerald-600/60" : "bg-slate-700"}`}>{i + 1}. {s}</span>
            ))}
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-xl bg-linear-to-b from-slate-100 to-slate-300 p-2"
            style={{ cursor: werkzeug ? "crosshair" : "zoom-in" }}>
            <div className="w-full max-w-[900px]">
              <FahrradBild rad={check.rad} auswahl={auswahl} onTeil={klick} breite="voll" geprueft={ende ? undefined : check.geprueft} />
            </div>
            {werkzeug && <div className="pointer-events-none absolute left-3 top-2 rounded-lg bg-slate-900/80 px-2 py-1 text-xs font-bold">{WERKZEUGE[werkzeug].icon} {WERKZEUGE[werkzeug].name} in der Hand</div>}
          </div>
          <div className={`min-h-10 rounded-lg px-3 py-2 text-sm font-bold ${meldung.gut === true ? "bg-emerald-700/40 text-emerald-100" : meldung.gut === false ? "bg-rose-700/40 text-rose-100" : "bg-slate-800 text-sky-200"}`}>
            {meldung.text}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setWerkzeug(null)}
              className={`rounded-xl px-3 py-2 text-left text-xs font-bold ${werkzeug === null ? "bg-sky-500 text-black" : "bg-slate-700 hover:bg-slate-600"}`}>
              <div className="text-lg leading-none">🔍</div>Prüfen <span className="opacity-60">0</span>
            </button>
            {WERKZEUG_LISTE.map((w, i) => (
              <button key={w} type="button" title={WERKZEUGE[w].text} onClick={() => setWerkzeug(werkzeug === w ? null : w)}
                className={`rounded-xl px-3 py-2 text-left text-xs font-bold ${werkzeug === w ? "bg-amber-400 text-black" : "bg-slate-700 hover:bg-slate-600"}`}>
                <div className="text-lg leading-none">{WERKZEUGE[w].icon}</div>{WERKZEUGE[w].name} <span className="opacity-60">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Checkliste */}
        <div className="flex w-full shrink-0 flex-col md:w-[340px]">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-black">📋 Checkliste</span>
            <span className="text-xs opacity-80">geprüft {geprueft}/{CHECKLISTE.length} · in Ordnung {inOrdnung}/{CHECKLISTE.length}</span>
          </div>
          <div className="mb-2 h-1.5 overflow-hidden rounded-sm bg-slate-700">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(inOrdnung / CHECKLISTE.length) * 100}%` }} />
          </div>
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto pr-1">
            {CHECKLISTE.map((p, i) => {
              const bekannt = check.geprueft.includes(p.teil), z = check.rad.teile[p.teil];
              const zeichen = !bekannt ? "⬜" : z === "ok" ? "✅" : z === "kaputt" ? "⚠️" : "❌";
              return (
                <li key={p.teil}>
                  <button type="button" onClick={() => !ende && pruefen(p.teil)} onMouseEnter={() => setAuswahl(p.teil)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2 py-1 text-left text-xs ${auswahl === p.teil ? "bg-slate-700" : "hover:bg-slate-800"} ${i === 9 ? "mt-2" : ""}`}>
                    <span className="text-sm leading-none">{zeichen}</span>
                    <span className="min-w-0">
                      <b>{p.name}</b>
                      <span className="block text-[10px] opacity-60">{bekannt ? p.regel : p.wie}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 text-[10px] opacity-60">Oben die Pflicht nach StVZO (§§ 64a, 65, 67), unten die Pflege. Tasten: 0 = prüfen, 1–5 = Werkzeug.</div>
        </div>
      </div>

      {/* Ergebnis */}
      {ende && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-5 text-center shadow-2xl ring-1 ring-emerald-400/50">
            <div className="text-4xl">{"⭐".repeat(sterne(check))}<span className="opacity-25">{"⭐".repeat(3 - sterne(check))}</span></div>
            <div className="mt-2 text-lg font-black">Verkehrssicher!</div>
            <div className="mt-1 text-sm opacity-90">
              {check.reparaturen ? `${check.reparaturen} Handgriffe` : "Alles war schon in Ordnung"} in {zeit(sekunden)}, {check.fehler === 0 ? "ohne Fehler" : `${check.fehler} Fehler`}.
            </div>
            <div className="mt-1 text-xs opacity-70">Klingel, zwei Bremsen, Licht und alle Rückstrahler sind dran — so darfst du auf die Straße.</div>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-black text-black hover:bg-emerald-400" onClick={onZu}>🚲 Losfahren</button>
              <button type="button" className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-bold hover:bg-slate-600" onClick={onNochmal}>🏚️ Noch ein Rad aus dem Keller</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
