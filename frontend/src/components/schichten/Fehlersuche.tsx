"use client";
/**
 * Fehlersuche: Symptom lesen, Werkzeuge ausführen, Schicht tippen.
 * Im TCP/IP-Modell zählt die richtige Gruppe.
 */
import { useMemo, useState } from "react";
import { FAELLE } from "@/lib/schichten/fehler";
import { SCHICHTEN, schicht, type SchichtNr } from "@/lib/schichten/kapselung";
import type { Modell } from "./Bausteine";

function gemischt(seed: number): number[] {
  const r = FAELLE.map((_, i) => i);
  let s = seed;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export default function Fehlersuche({ modell }: { modell: Modell }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const reihe = useMemo(() => gemischt(seed), [seed]);
  const [pos, setPos] = useState(0);
  const [benutzt, setBenutzt] = useState<number[]>([]);
  const [tipp, setTipp] = useState<SchichtNr | null>(null);
  const [punkte, setPunkte] = useState({ richtig: 0, versuche: 0 });
  const fall = FAELLE[reihe[pos]];
  const gruppe = (nr: SchichtNr) => (modell === "osi" ? String(nr) : schicht(nr).tcpip);
  const richtig = tipp !== null && gruppe(tipp) === gruppe(fall.loesung);
  const fertig = pos >= FAELLE.length - 1 && tipp !== null;

  const antworten = (nr: SchichtNr) => {
    if (tipp !== null) return;
    setTipp(nr);
    setPunkte(p => ({ richtig: p.richtig + (gruppe(nr) === gruppe(fall.loesung) ? 1 : 0), versuche: p.versuche + 1 }));
  };
  const weiter = () => {
    setTipp(null);
    setBenutzt([]);
    if (pos + 1 < FAELLE.length) setPos(pos + 1);
    else { setPos(0); setSeed(s => s + 1); setPunkte({ richtig: 0, versuche: 0 }); }
  };

  const knoepfe = modell === "osi"
    ? SCHICHTEN.map(s => ({ nr: s.nr, label: `${s.nr} ${s.name}`, farbe: s.farbe }))
    : SCHICHTEN.filter((s, i) => SCHICHTEN.findIndex(x => x.tcpip === s.tcpip) === i).map(s => ({ nr: s.nr, label: s.tcpip, farbe: s.farbe }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
      <div className="flex flex-col gap-4">
        <div className="card p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-black">🔧 Fall {pos + 1} von {FAELLE.length}: {fall.titel}</h3>
            <span className="text-sm tabular-nums text-muted">{punkte.richtig} / {punkte.versuche} richtig</span>
          </div>
          <p className="leading-relaxed">{fall.symptom}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label">Werkzeuge — ausprobieren:</span>
          <div className="flex flex-wrap gap-2">
            {fall.werkzeuge.map((w, i) => (
              <button key={w.befehl} className={`btn ${benutzt.includes(i) ? "btn-secondary" : "btn-primary"} font-mono text-xs`}
                onClick={() => setBenutzt(b => (b.includes(i) ? b : [...b, i]))}>&gt; {w.befehl}</button>
            ))}
          </div>
          {benutzt.map(i => (
            <pre key={i} className="font-mono text-xs bg-[#0c0c0c] text-[#cccccc] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              <span className="text-[#6a9955]">C:\Users\Lena&gt; {fall.werkzeuge[i].befehl}</span>{"\n"}{fall.werkzeuge[i].ausgabe}
            </pre>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span className="label">In welcher Schicht steckt der Fehler?</span>
          <div className="flex flex-wrap gap-2">
            {knoepfe.map(k => {
              const gewaehlt = tipp !== null && gruppe(tipp) === gruppe(k.nr);
              const loesung = tipp !== null && gruppe(fall.loesung) === gruppe(k.nr);
              return (
                <button key={k.nr} onClick={() => antworten(k.nr)} disabled={tipp !== null}
                  className={`rounded-lg px-3 py-2 text-sm font-bold text-white transition ${tipp !== null && !gewaehlt && !loesung ? "opacity-30" : ""} ${loesung ? "ring-4 ring-ok" : gewaehlt ? "ring-4 ring-bad" : ""}`}
                  style={{ background: k.farbe }}>
                  {k.label}
                </button>
              );
            })}
          </div>
        </div>
        {tipp !== null && (
          <div className={`card p-4 flex flex-col gap-2 border-2 ${richtig ? "border-ok" : "border-bad"}`}>
            <b>{richtig ? "✅ Richtig!" : `❌ Nicht ganz — es ist ${modell === "osi" ? `Schicht ${fall.loesung} (${schicht(fall.loesung).name})` : schicht(fall.loesung).tcpip}.`}</b>
            <p className="text-sm leading-relaxed">{fall.erkl}</p>
            <button className="btn btn-primary self-start" onClick={weiter}>{fertig ? "🔁 Neue Runde" : "Nächster Fall ▶"}</button>
          </div>
        )}
      </div>
      <div className="card p-4 text-sm flex flex-col gap-2">
        <h3 className="font-bold">So geht man vor</h3>
        <p>Von unten nach oben prüfen — jede Schicht braucht die darunter:</p>
        <ul className="list-disc pl-5 space-y-1 text-muted">
          <li><b className="text-fg">kein Signal</b> → Schicht 1</li>
          <li><b className="text-fg">Router nicht erreichbar</b> im eigenen Netz → Schicht 2 (oder 1)</li>
          <li><b className="text-fg">fremdes Netz nicht erreichbar</b>, Weg verloren → Schicht 3</li>
          <li><b className="text-fg">Stücke fehlen</b>, Port zu → Schicht 4</li>
          <li><b className="text-fg">Gespräch beendet</b> → Schicht 5</li>
          <li><b className="text-fg">verschlüsselt/codiert falsch</b> → Schicht 6</li>
          <li><b className="text-fg">Name, Anfrage, App</b> → Schicht 7</li>
        </ul>
        <p className="text-xs text-muted">ping antwortet? Dann sind 1–3 in Ordnung. Test-NetConnection klappt? Dann auch 4.</p>
      </div>
    </div>
  );
}
