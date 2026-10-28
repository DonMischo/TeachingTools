"use client";
/**
 * Übungsaufgaben: Sachaufgaben nach Art und Stufe würfeln, Ergebnis eintippen,
 * prüfen, Lösungsweg aufklappen. Gezählt wird je Aufgabe nur der erste Versuch.
 * Dazu ein Blatt mit zehn Aufgaben zum Ausdrucken, Lösungen hinten.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AUFGABEN_ARTEN, erzeugeAufgabe, pruefe, type Aufgabe, type AufgabenArt, type Stufe } from "@/lib/prozent";
import { LEER, zaehle } from "./ui";

const STUFEN = [
  { id: 1, label: "⭐ leicht" },
  { id: 2, label: "⭐⭐ mittel" },
  { id: 3, label: "⭐⭐⭐ schwer" },
] as const;

const wuerfle = (arten: AufgabenArt[], stufe: Stufe) => erzeugeAufgabe(arten[Math.floor(Math.random() * arten.length)], stufe);

export default function Ueben() {
  const [arten, setArten] = useState<AufgabenArt[]>(["prozentwert", "grundwert", "prozentsatz"]);
  const [stufe, setStufe] = useState<Stufe>(1);
  // erst nach dem Laden würfeln — sonst passt das Server-HTML nicht zum Browser
  const [aufgabe, setAufgabe] = useState<Aufgabe | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [urteil, setUrteil] = useState<boolean | null>(null);
  const [gezaehlt, setGezaehlt] = useState(false);
  const [weg, setWeg] = useState(false);
  const [punkte, setPunkte] = useState(LEER);
  const [blatt, setBlatt] = useState<Aufgabe[] | null>(null);

  const neu = (a = arten, s = stufe) => {
    setAufgabe(wuerfle(a, s)); setEingabe(""); setUrteil(null); setGezaehlt(false); setWeg(false);
  };
  useEffect(() => { neu(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const umschalten = (id: AufgabenArt) => {
    const naechste = arten.includes(id) ? arten.filter(a => a !== id) : [...arten, id];
    if (!naechste.length) return;
    setArten(naechste); neu(naechste, stufe);
  };

  const pruefen = () => {
    if (!aufgabe) return;
    const r = pruefe(aufgabe, eingabe);
    if (r === null) { setUrteil(null); return; }
    setUrteil(r);
    if (!gezaehlt && !weg) { setPunkte(p => zaehle(p, r)); setGezaehlt(true); }
  };

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Aufgabenarten">
          {AUFGABEN_ARTEN.map(a => (
            <button key={a.id} className={`chip ${arten.includes(a.id) ? "chip-on" : ""}`} aria-pressed={arten.includes(a.id)}
              onClick={() => umschalten(a.id)}>{a.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {STUFEN.map(s => (
            <button key={s.id} className={`chip ${stufe === s.id ? "chip-on" : ""}`} aria-pressed={stufe === s.id}
              onClick={() => { setStufe(s.id); neu(arten, s.id); }}>{s.label}</button>
          ))}
          <span className="flex-1" />
          <button className="btn" onClick={() => setBlatt(Array.from({ length: 10 }, () => wuerfle(arten, stufe)))}>🖨️ Blatt mit 10 Aufgaben</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {punkte.gesamt ? (
          <>
            <span aria-label="Punktestand" className="font-black">✔ {punkte.richtig} von {punkte.gesamt} richtig</span>
            <span className="text-muted">· Serie {punkte.serie}{punkte.beste > punkte.serie && ` (beste ${punkte.beste})`}</span>
            <button className="btn text-xs" onClick={() => setPunkte(LEER)}>↺ Zähler</button>
          </>
        ) : <span className="text-muted text-xs">Erst selbst rechnen, dann prüfen — der erste Versuch zählt.</span>}
      </div>

      {aufgabe && (
        <div className="rounded-xl border border-line p-4 bg-page flex flex-col gap-3">
          <p className="text-lg font-bold" data-testid="aufgabe">{aufgabe.text}</p>
          <form className="flex flex-wrap gap-2 items-center" onSubmit={e => { e.preventDefault(); pruefen(); }}>
            <input className="input w-40" inputMode="decimal" aria-label="Deine Antwort" value={eingabe}
              onChange={e => { setEingabe(e.target.value); setUrteil(null); }} placeholder="Antwort" />
            {aufgabe.einheit && <span className="font-bold">{aufgabe.einheit}</span>}
            <button type="submit" className="btn-primary">Prüfen</button>
            <button type="button" className="btn" onClick={() => setWeg(w => !w)}>{weg ? "Lösungsweg zu" : "💡 Lösungsweg"}</button>
            <button type="button" className="btn" onClick={() => neu()}>🎲 Nächste</button>
          </form>
          {urteil === true && <p className="text-ok font-black">✔ Richtig!</p>}
          {urteil === false && <p className="text-bad font-black">✘ Noch nicht. Schau, was der Grundwert ist, und rechne nach — oder öffne den Lösungsweg.</p>}
          {eingabe && urteil === null && gezaehlt === false && <p className="text-xs text-muted">Bei Geld auf Cent runden, Komma oder Punkt sind beide erlaubt.</p>}
          {weg && (
            <ol className="list-decimal pl-6 text-sm flex flex-col gap-0.5 font-mono">
              {aufgabe.weg.map((w, i) => <li key={i}>{w}</li>)}
            </ol>
          )}
        </div>
      )}

      {blatt && createPortal(
        <div className="prozent-druck fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-auto p-4 print:static print:bg-transparent print:p-0" onClick={() => setBlatt(null)}>
          <div className="bg-white text-black rounded-xl p-8 max-w-3xl w-full print:rounded-none print:p-0" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center print:hidden mb-4">
              <button className="btn-primary" onClick={() => window.print()}>🖨️ Drucken</button>
              <button className="btn" onClick={() => setBlatt(Array.from({ length: 10 }, () => wuerfle(arten, stufe)))}>🎲 Neu würfeln</button>
              <button className="btn" onClick={() => setBlatt(null)}>✕ Schließen</button>
            </div>
            <h2 className="text-xl font-black">Prozent- und Zinsrechnung — Übungsblatt</h2>
            <p className="text-sm mb-4">Name: ______________________ Datum: ____________</p>
            <ol className="list-decimal pl-6 flex flex-col gap-6">
              {blatt.map((a, i) => <li key={i}><p>{a.text}</p><p className="mt-4">Antwort: ____________________</p></li>)}
            </ol>
            <div className="mt-10 pt-4 border-t border-black/30 break-before-page">
              <h3 className="font-black">Lösungen</h3>
              <ol className="list-decimal pl-6 text-sm flex flex-col gap-2 mt-2">
                {blatt.map((a, i) => <li key={i}>{a.weg[a.weg.length - 1]}</li>)}
              </ol>
            </div>
          </div>
          {/* beim Drucken nur das Blatt, nicht die Seite dahinter */}
          <style>{"@media print { body > *:not(.prozent-druck) { display: none !important; } }"}</style>
        </div>,
        document.body,
      )}
    </div>
  );
}
