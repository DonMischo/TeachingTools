"use client";
/**
 * Das Gespräch mit der Polizei: Beamter mit Laune, Sprechblase, drei
 * Antworten (auch mit 1–3), oben die Leiter der Stufen bis zur Wache.
 */
import { useEffect } from "react";
import { STUFEN, type Antwort, type Gespraech } from "@/lib/verkehr/polizei";

export function PolizeiDialog({ g, onAntwort, onFertig }: { g: Gespraech; onAntwort: (a: Antwort) => void; onFertig: () => void }) {
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const i = ["Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3"].indexOf(e.code) % 3;
      if (!g.ende && i >= 0 && g.antworten[i]) { e.preventDefault(); e.stopImmediatePropagation(); onAntwort(g.antworten[i]); }
      if (g.ende && (e.code === "Enter" || e.code === "Space")) { e.preventDefault(); onFertig(); }
    };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, [g, onAntwort, onFertig]);

  const nett = g.beamter.laune === "nett";
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-label="Gespräch mit der Polizei">
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 text-slate-900 shadow-2xl ring-4 ring-sky-800">
        {/* Stufenleiter */}
        <div className="mb-3 flex items-center gap-1">
          {STUFEN.map((s, i) => (
            <div key={s.name} className={`flex flex-1 flex-col items-center rounded-lg px-1 py-1 text-[10px] font-bold ${i === g.stufe ? (i === 3 ? "bg-red-600 text-white" : "bg-amber-400") : i < g.stufe ? "bg-amber-100" : "bg-slate-100 opacity-60"}`}>
              <span className="text-base">{s.icon}</span>{s.name}
            </div>
          ))}
        </div>
        {/* Beamter mit Sprechblase */}
        <div className="flex items-start gap-3">
          <div className="flex shrink-0 flex-col items-center">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full text-4xl ${nett ? "bg-sky-100" : "bg-slate-300"}`}>{g.beamter.bild}</div>
            <span className="mt-1 text-lg" title={nett ? "freundlich" : "grummelig"}>{nett ? "🙂" : "😠"}</span>
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-black uppercase tracking-wide text-sky-800">{g.beamter.name}</div>
            <div className="mt-1 rounded-2xl bg-sky-50 px-3 py-2 text-sm font-semibold leading-snug ring-1 ring-sky-200">{g.sagt}</div>
          </div>
        </div>
        {/* Antworten oder Ende */}
        {!g.ende ? (
          <div className="mt-3 flex flex-col gap-1.5">
            {g.antworten.map((a, i) => (
              <button key={a.text} type="button" onClick={() => onAntwort(a)}
                className="flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2 text-left text-sm hover:bg-sky-100">
                <span className="rounded bg-slate-700 px-1.5 text-xs font-black text-white">{i + 1}</span>{a.text}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            {g.ende.stufe === 3 && (
              <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200">
                🚓 Mit auf die Wache · 📞 Eltern werden angerufen · 💶 Bußgeld (zahlen die Eltern)
              </div>
            )}
            <button type="button" onClick={onFertig} className="w-full rounded-xl bg-sky-800 px-3 py-2 font-bold text-white">
              {g.ende.punkte >= 0 ? `Weiter (+${g.ende.punkte} Punkte)` : `Weiter (${g.ende.punkte} Punkte)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
