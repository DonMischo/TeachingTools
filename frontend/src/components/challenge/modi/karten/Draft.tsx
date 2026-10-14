"use client";
/** Deck bauen wie im Booster: fünf verdeckte Karten aufdecken, beliebig viele nehmen; Abgelehntes kommt noch einmal. */
import { useMemo, useState } from "react";
import type { ChallengeBrett } from "@/lib/api";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import Karte, { Rueckseite } from "./Karte";
import { hashText } from "@/lib/challenge/zufall";
import { draftNimm, draftStart } from "./logik";

export default function Draft({ brett, onFertig }: { brett: ChallengeBrett; onFertig(ids: string[]): void }) {
  const fakten = useMemo(() => new Map(brett.fakten.map((f) => [f.id, f])), [brett.fakten]);
  const seed = useMemo(() => hashText(`${brett.etappe}:${brett.fakten.map((f) => f.id).join(",")}`), [brett.etappe, brett.fakten]);
  const [d, setD] = useState(() => draftStart(brett.fakten.map((f) => f.id), seed));
  const [auf, setAuf] = useState(false);
  const [markiert, setMarkiert] = useState<string[]>([]);
  const ziel = Math.max(1, brett.fakten.length);
  const offen = auf || wenigerBewegung();

  const markiere = (id: string) => setMarkiert((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const nimm = () => {
    const neu = draftNimm(d, markiert, seed);
    setD(neu); setAuf(false); setMarkiert([]);
    if (neu.deck.length >= ziel || neu.angebot.length === 0) onFertig(neu.deck);
  };
  const fertig = () => onFertig([...d.deck, ...d.angebot.filter((x) => markiert.includes(x))]);

  return (
    <section aria-label="Deck bauen" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Booster {d.runde + 1}: Nimm, was du brauchst – Deck {d.deck.length + markiert.length} von {ziel}</h2>
        <div className="flex gap-2">
          {offen && <button className="btn-secondary" onClick={nimm}>{markiert.length ? `${markiert.length} nehmen` : "Keine nehmen"} – nächster Booster</button>}
          <button className="btn-primary" disabled={!d.deck.length && !markiert.length} onClick={fertig}>Fertig</button>
        </div>
      </div>
      <div key={d.runde} className="flex flex-wrap justify-center gap-3">
        {d.angebot.map((id) => offen ? (
          <div key={id} aria-pressed={markiert.includes(id)} className={`rounded-xl transition ${markiert.includes(id) ? "ring-4 ring-accent -translate-y-2" : ""}`}>
            <Karte fakt={fakten.get(id)!} onClick={() => markiere(id)} klasse="kt-zieh" />
          </div>
        ) : (
          <button key={id} type="button" aria-label="Karte aufdecken" onClick={() => setAuf(true)}><Rueckseite /></button>
        ))}
      </div>
      {!offen && <p className="text-muted text-center">Tippe auf eine verdeckte Karte, um den Booster aufzudecken.</p>}
      <p className="text-muted">Tippe Karten an, um sie zu markieren. Abgelehnte Karten kommen noch einmal in einem späteren Booster. Nicht jede Karte ist nützlich – wähle mit Bedacht.</p>
      {d.deck.length > 0 && (
        <div aria-label="Dein Deck bisher" className="flex flex-wrap gap-1">
          {d.deck.map((id) => <span key={id} className="card px-2 py-0.5 text-xs max-w-48 truncate" title={fakten.get(id)?.text}>{fakten.get(id)?.text}</span>)}
        </div>
      )}
    </section>
  );
}
