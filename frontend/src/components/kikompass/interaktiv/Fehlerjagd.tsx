"use client";
/** Fehlerjagd: verdächtige Sätze in einer Chatbot-Antwort markieren, dann mit der Faktenkarte auflösen. */
import { useState } from "react";
import { FEHLERJAGD, jagdWertung } from "@/lib/kikompass/interaktiv";

export function Fehlerjagd({ onFertig }: { onFertig?: () => void }) {
  const [markiert, setMarkiert] = useState<Set<number>>(new Set());
  const [karte, setKarte] = useState(false);
  const [aufgeloest, setAufgeloest] = useState(false);
  const w = jagdWertung(markiert);

  function umschalten(i: number) {
    if (aufgeloest) return;
    setMarkiert(alt => { const n = new Set(alt); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">Fehlerjagd</p>
      <p className="text-sm text-muted">
        Jemand hat einen Chatbot gefragt: »{FEHLERJAGD.frage}« In der Antwort stecken mehrere Fehler. Tippe die Sätze an,
        die dir verdächtig vorkommen. Erst raten, dann die Faktenkarte aufdecken und prüfen.
      </p>
      <div className="card p-3 flex flex-col gap-1">
        <p className="text-xs text-muted">🤖 Antwort (für die Übung nachgestellt)</p>
        <p className="leading-7">
          {FEHLERJAGD.stuecke.map((s, i) => {
            const an = markiert.has(i);
            let stil = an ? "bg-amber-200 dark:bg-amber-800" : "hover:bg-surface-hover";
            if (aufgeloest) stil = s.fehler ? (an ? "bg-green-200 dark:bg-green-900" : "bg-red-200 dark:bg-red-900") : an ? "bg-amber-200 dark:bg-amber-800 line-through" : "";
            return (
              <button key={i} onClick={() => umschalten(i)} aria-pressed={an} className={`rounded text-left ${stil}`}>{s.text}</button>
            );
          })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => setKarte(k => !k)}>🗂️ Faktenkarte {karte ? "zudecken" : "aufdecken"}</button>
        {!aufgeloest
          ? <button className="btn-primary" disabled={markiert.size === 0} onClick={() => { setAufgeloest(true); onFertig?.(); }}>Auflösen</button>
          : <button className="btn-secondary" onClick={() => { setMarkiert(new Set()); setAufgeloest(false); }}>Nochmal</button>}
      </div>
      {karte && (
        <ul className="card p-3 text-sm list-disc pl-6">
          {FEHLERJAGD.faktenkarte.map(f => <li key={f}>{f}</li>)}
          <li className="list-none -ml-4 text-xs text-muted mt-1">Zum Nachprüfen: Lexikon, Schulbuch oder die Seite der Stadt Erfurt.</li>
        </ul>
      )}
      {aufgeloest && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">
            {w.gefunden} von {w.fehler} Fehlern gefunden{w.falschAlarm ? `, ${w.falschAlarm}× Fehlalarm (das stimmte)` : ""}.
          </p>
          <ul className="list-disc pl-5">
            {FEHLERJAGD.stuecke.filter(s => s.fehler).map(s => <li key={s.text}><s>{s.text.trim()}</s> → {s.fehler}</li>)}
          </ul>
          <p className="text-muted">Merke: Die falschen Sätze klangen genauso sicher wie die richtigen.</p>
        </div>
      )}
    </div>
  );
}
