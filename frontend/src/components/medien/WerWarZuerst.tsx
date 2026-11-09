"use client";
/** Spiel »Wer war zuerst?«: fünf Medien in die richtige Reihenfolge bringen. */
import { useState } from "react";
import { epoche, medium, type Medium } from "@/lib/medien/medien";
import { richtigPlatziert, sortierRunde } from "@/lib/medien/spiele";
import type { Aenderung } from "@/lib/medien/fortschritt";

const ANZAHL = 5;
/** Überraschungen, die oft falsch geraten werden */
const UEBERRASCHUNG: Record<string, string> = {
  fax: "Das Fax ist älter als das Telefon!",
  bildtelefon: "Das Bildtelefon gab es schon 1936!",
  email: "E-Mail ist älter als das World Wide Web.",
  telharmonium: "Musik-Streaming per Telefonleitung — schon 1906.",
};

export default function WerWarZuerst({ rekord, aendere }: { rekord: number; aendere: (a: Aenderung) => void }) {
  const [liste, setListe] = useState<Medium[]>(() => sortierRunde(ANZAHL));
  const [geprueft, setGeprueft] = useState<boolean[] | null>(null);
  const [serie, setSerie] = useState(0);

  const tausche = (i: number, j: number) => {
    if (geprueft || j < 0 || j >= liste.length) return;
    setListe(l => { const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  };
  const pruefe = () => {
    const r = richtigPlatziert(liste.map(m => m.id));
    setGeprueft(r);
    const alle = r.every(Boolean);
    const neu = alle ? serie + 1 : 0;
    setSerie(neu);
    if (neu > rekord) aendere(f => ({ ...f, sortieren: Math.max(f.sortieren, neu) }));
  };
  const neueRunde = () => { setListe(sortierRunde(ANZAHL)); setGeprueft(null); };
  const ueberraschung = geprueft ? liste.map(m => UEBERRASCHUNG[m.id]).find(Boolean) : undefined;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between text-sm">
        <p>Bring die Medien in die richtige Reihenfolge: <b>oben das älteste</b>.</p>
        <span className="font-black whitespace-nowrap">🔥 Serie {serie} {rekord > 0 && <span className="text-muted font-normal">· Rekord {Math.max(rekord, serie)}</span>}</span>
      </div>
      <ol className="flex flex-col gap-2">
        {liste.map((m, i) => {
          const ok = geprueft?.[i];
          return (
            <li key={m.id} className={`flex items-center gap-3 rounded-xl border-2 p-3 bg-surface transition-colors ${geprueft ? (ok ? "border-ok" : "border-bad") : "border-line"}`}>
              <span className="text-xs font-black w-5 text-muted">{i + 1}.</span>
              <span className="text-3xl" aria-hidden>{medium(m.id)!.icon}</span>
              <div className="flex-1">
                <div className="font-black">{m.name}</div>
                {geprueft && <div className="text-xs font-bold" style={{ color: epoche(m.epoche).farbe }}>{m.jahrText} {ok ? "✓" : "✗"}</div>}
              </div>
              {!geprueft && (
                <div className="flex flex-col gap-1">
                  <button className="btn-secondary px-2 py-0 leading-tight" onClick={() => tausche(i, i - 1)} disabled={i === 0} aria-label={`${m.name} nach oben`}>▲</button>
                  <button className="btn-secondary px-2 py-0 leading-tight" onClick={() => tausche(i, i + 1)} disabled={i === liste.length - 1} aria-label={`${m.name} nach unten`}>▼</button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!geprueft ? <button className="btn-primary self-start" onClick={pruefe}>Prüfen</button> : (
        <div className="flex flex-col gap-2">
          <p className="font-bold">{geprueft.every(Boolean) ? "🎉 Alles richtig! Du bist eine wandelnde Zeitmaschine." : `${geprueft.filter(Boolean).length} von ${ANZAHL} an der richtigen Stelle. Die richtige Reihenfolge steht an den Jahreszahlen.`}</p>
          {ueberraschung && <p className="text-sm">🤯 {ueberraschung}</p>}
          <button className="btn-primary self-start" onClick={neueRunde}>Neue Runde</button>
        </div>
      )}
      <p className="text-xs text-muted">Hinweis: Viele Medien wurden lange vor ihrem Durchbruch erfunden. Es zählt das Jahr der Zeitreise-Station.</p>
    </div>
  );
}
