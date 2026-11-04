"use client";
/**
 * Sortierspiel: Karte antippen, dann Korb antippen (geht mit Maus, Finger und
 * Tastatur). »Prüfen« zeigt je Karte richtig/falsch mit Begründung. Bei
 * offenen Spielen gibt es nur einen Vorschlag zum Vergleichen.
 */
import { useState } from "react";
import { sortWertung, type Ablage, type SortSpiel } from "@/lib/kikompass/interaktiv";

export function Sortieren({ spiel, onFertig }: { spiel: SortSpiel; onFertig?: () => void }) {
  const [ablage, setAblage] = useState<Ablage>({});
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [geprueft, setGeprueft] = useState(false);
  const w = sortWertung(spiel, ablage);
  const offen = spiel.karten.filter(k => !ablage[k.id]);

  function ablegen(korb: string) {
    if (!gewaehlt || geprueft) return;
    setAblage(a => ({ ...a, [gewaehlt]: korb }));
    setGewaehlt(null);
  }

  function pruefen() {
    setGeprueft(true);
    onFertig?.();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">{spiel.titel}</p>
      <p className="text-sm text-muted">{spiel.anleitung}</p>
      {offen.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Karten">
          {offen.map(k => (
            <button key={k.id} onClick={() => setGewaehlt(gewaehlt === k.id ? null : k.id)}
              aria-pressed={gewaehlt === k.id}
              className={`card px-3 py-2 text-sm text-left ${gewaehlt === k.id ? "ring-2 ring-accent" : ""}`}>
              {k.text}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {spiel.koerbe.map(korb => {
          const drin = spiel.karten.filter(k => ablage[k.id] === korb.id);
          return (
            <div key={korb.id} className="card p-2 flex flex-col gap-1" style={{ borderTop: `4px solid ${korb.farbe ?? "var(--border)"}` }}>
              <button className={`btn-secondary text-sm ${gewaehlt ? "" : "opacity-70"}`} onClick={() => ablegen(korb.id)}
                disabled={!gewaehlt || geprueft} aria-label={`In »${korb.titel}« legen`}>
                {korb.titel}
              </button>
              {drin.map(k => {
                const ok = k.ziel === korb.id;
                return (
                  <div key={k.id} className="text-xs rounded p-1 bg-surface-hover">
                    <div className="flex items-start gap-1">
                      <span className="flex-1">{k.text}</span>
                      {!geprueft && (
                        <button className="text-muted" title="Zurücklegen" aria-label={`${k.text} zurücklegen`}
                          onClick={() => setAblage(a => { const n = { ...a }; delete n[k.id]; return n; })}>↩</button>
                      )}
                      {geprueft && !spiel.offen && <span>{ok ? "✅" : "❌"}</span>}
                    </div>
                    {geprueft && (!ok || spiel.offen) && (
                      <p className="text-muted mt-0.5">
                        {spiel.offen ? "Vorschlag" : "Gehört zu"}: {spiel.koerbe.find(x => x.id === k.ziel)?.titel}. {k.warum}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!geprueft ? (
          <button className="btn-primary" disabled={!w.fertig} onClick={pruefen}>
            {spiel.offen ? "Mit Vorschlag vergleichen" : "Prüfen"}
          </button>
        ) : (
          <>
            <span className="font-medium">
              {spiel.offen
                ? `${w.richtig} von ${w.gesamt} wie im Vorschlag. Wo seid ihr anderer Meinung, und warum?`
                : `${w.richtig} von ${w.gesamt} richtig${w.richtig === w.gesamt ? " – stark!" : ""}`}
            </span>
            <button className="btn-secondary" onClick={() => { setAblage({}); setGeprueft(false); }}>Nochmal</button>
          </>
        )}
      </div>
    </div>
  );
}
