"use client";
/** Der Nachmittag neben dem Handy: Uhr, Schule am Morgen, Hausaufgaben, Freunde, Bett. */
import { useEffect, useState } from "react";
import { TAGE } from "@/lib/klikk/geschichte";
import { AUFGABEN, MITTERNACHT, START_UHR, aufgabe, loeseAufgabe, nacht, nachtPush, schlafen, zeit } from "@/lib/klikk/motor";
import { AktivitaetAnsicht, FreizeitKarte } from "./Freizeit";
import { HygieneMeter } from "./Morgen";
import type { Stand } from "@/lib/klikk/typen";

type Setze = (f: (s: Stand) => Stand) => void;

export default function Tag({ s, setze }: { s: Stand; setze: Setze }) {
  const [eingabe, setEingabe] = useState("");
  // Falsche Antwort auf die Lesefrage: die ganze Simulation ist 10 Sekunden gesperrt
  const [sperre, setSperre] = useState(0);
  useEffect(() => {
    if (sperre <= 0) return;
    const t = setTimeout(() => setSperre(x => x - 1), 1000);
    return () => clearTimeout(t);
  }, [sperre]);
  const fertig = !!s.hausaufgaben[s.tag];
  const a = aufgabe(s);
  const anteil = (s.uhr - START_UHR) / (MITTERNACHT - START_UHR);

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-black text-lg">{TAGE[s.tag]}</h2>
          <span className="text-3xl font-black tabular-nums">{zeit(s.uhr)}</span>
        </div>
        <div className="h-2 rounded-full bg-surface-hover mt-2 overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, anteil * 100)}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted mt-1"><span>14:00</span><span>🍝 19:00</span><span>24:00</span></div>
      </div>

      <div className="card p-3"><HygieneMeter wert={s.hygiene} /></div>
      {s.morgen.length > 0 && (
        <div className="card p-4 text-sm">
          <h3 className="font-bold mb-1">🏫 Heute in der Schule</h3>
          {s.morgen.map((m, i) => <p key={i} className="mt-1">{m}</p>)}
        </div>
      )}

      {s.flags.klassenuhr && s.uhr < START_UHR && s.tag <= 4 ? (
        <div className="card p-4 text-sm">
          <h3 className="font-bold">🏫 Schule bis 14 Uhr</h3>
          <p className="text-muted mt-1">Mathe, Deutsch, Bio, Sport. Das Handy liegt im Spind. Die Zeit läuft für alle gleich.</p>
        </div>
      ) : s.aktivitaet ? <AktivitaetAnsicht s={s} setze={setze} /> : (
        <>
      {s.tag <= 4 && (
      <div className="card p-4">
        <h3 className="font-bold">📓 Hausaufgaben Mathe + Geschichte</h3>
        {sperre > 0 && (
          <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-6" role="alertdialog" aria-label="Falsche Antwort">
            <div className="card p-5 max-w-sm text-center flex flex-col gap-2">
              <div className="text-4xl">📖❌</div>
              <b>Das stand so nicht im Text.</b>
              <p className="text-sm">Lies die Seite nochmal in Ruhe. Weiter geht es in {sperre} s.</p>
            </div>
          </div>
        )}
        {fertig ? <p className="text-sm text-ok mt-1">✅ Erledigt.</p> : (
          <>
            <div className="flex gap-1 mt-2">
              {Array.from({ length: AUFGABEN }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < s.hausaufgabenStand ? "bg-ok" : "bg-surface-hover"}`} />)}
            </div>
            {s.flags.haPause && <p className="text-xs text-muted mt-2">Du warst am Handy. Wo warst du gerade …?</p>}
            {a.art === "lesen" ? (
              <div className="mt-2 flex flex-col gap-2">
                <div className="text-xs font-bold">📖 {a.lesetext.fach}, {a.lesetext.seite}: {a.lesetext.titel}</div>
                <div className="text-sm whitespace-pre-line rounded-lg bg-surface-hover p-3 max-h-64 overflow-y-auto leading-relaxed">{a.lesetext.text}</div>
                <div className="text-sm font-bold">{a.lesetext.frage}</div>
                <div className="flex flex-col gap-1">
                  {a.reihenfolge.map(k => (
                    <button key={k} className="btn-secondary text-left text-xs" disabled={sperre > 0}
                      onClick={() => { if (k !== a.loesung) setSperre(10); setze(st => loeseAufgabe(st, k)); }}>{a.lesetext.antworten[k]}</button>
                  ))}
                </div>
                <p className="text-[11px] text-muted">Lesen und Antworten dauert etwa 15 Minuten. Falsch heißt: nochmal lesen.</p>
              </div>
            ) : (
            <form className="flex gap-2 mt-2 items-center" onSubmit={e => {
              e.preventDefault();
              const n = Number(eingabe);
              if (eingabe.trim() && Number.isFinite(n)) setze(st => loeseAufgabe(st, n));
              setEingabe("");
            }}>
              <span className="font-bold tabular-nums">{a.text} =</span>
              <input className="input w-20" inputMode="numeric" value={eingabe} onChange={e => setEingabe(e.target.value)} aria-label="Ergebnis" />
              <button className="btn-secondary text-sm">✓</button>
            </form>
            )}
            {a.art === "rechnen" && <p className="text-[11px] text-muted mt-1">Jede Aufgabe kostet etwa 9 Minuten. Zum Schluss kommt eine Seite im Geschichtsbuch.</p>}
          </>
        )}
      </div>

      )}
          <FreizeitKarte s={s} setze={setze} />
        </>
      )}

      <button className="btn-secondary text-sm" onClick={() => setze(schlafen)}>
        🛏️ Schlafen gehen <span className="block text-[10px] text-muted">Wecker: {zeit(s.weckzeit)}</span>
      </button>
    </div>
  );
}

/** 23:40, das Handy auf dem Nachttisch leuchtet auf. */
export function Nacht({ s, setze }: { s: Stand; setze: Setze }) {
  const p = nachtPush(s);
  return (
    <div className="max-w-md mx-auto w-full rounded-3xl bg-neutral-950 text-neutral-100 p-6 flex flex-col gap-4 items-center text-center">
      <div className="text-xs text-neutral-400">{TAGE[s.tag]} · im Bett</div>
      <div className="text-6xl font-thin">23:40</div>
      <div className="w-full rounded-2xl bg-neutral-800 p-3 text-left">
        <div className="text-xs font-bold">{p.titel}</div>
        <div className="text-sm">{p.text}</div>
      </div>
      <p className="text-sm text-neutral-400">Das Handy leuchtet auf dem Nachttisch.</p>
      <div className="grid grid-cols-2 gap-2 w-full">
        <button className="rounded-xl bg-neutral-800 py-3 font-bold" onClick={() => setze(st => nacht(st, false))}>🌙 Liegen lassen</button>
        <button className="rounded-xl bg-indigo-600 py-3 font-bold" onClick={() => setze(st => nacht(st, true))}>📱 Kurz nachsehen</button>
      </div>
    </div>
  );
}
