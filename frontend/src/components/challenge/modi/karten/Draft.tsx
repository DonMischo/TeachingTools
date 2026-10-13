"use client";
/** Deck bauen wie im Booster: drei verdeckte Karten aufdecken, eine wählen; Abgelehntes kommt später wieder. */
import { useMemo, useState } from "react";
import type { ChallengeBrett } from "@/lib/api";
import Karte, { Rueckseite } from "./Karte";
import { deckZiel, draftStart, draftWahl, hash } from "./logik";

const reduziert = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export default function Draft({ brett, bonus, onFertig }: { brett: ChallengeBrett; bonus: number; onFertig(ids: string[]): void }) {
  const fakten = useMemo(() => new Map(brett.fakten.map((f) => [f.id, f])), [brett.fakten]);
  const seed = useMemo(() => hash(`${brett.etappe}:${brett.fakten.map((f) => f.id).join(",")}`), [brett.etappe, brett.fakten]);
  const [d, setD] = useState(() => draftStart(brett.fakten.map((f) => f.id), seed));
  const [auf, setAuf] = useState(false);
  const ziel = deckZiel(brett.fakten.length, bonus);
  const offen = auf || reduziert();

  const waehle = (id: string) => {
    const neu = draftWahl(d, id, seed);
    setD(neu); setAuf(false);
    if (neu.deck.length >= ziel || neu.angebot.length === 0) onFertig(neu.deck);
  };

  return (
    <section aria-label="Deck bauen" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Booster {d.runde + 1}: Wähle 1 von {d.angebot.length} Karten – Deck {d.deck.length} von {ziel}</h2>
        <button className="btn-primary" disabled={!d.deck.length} onClick={() => onFertig(d.deck)}>Fertig</button>
      </div>
      <div key={d.runde} className="flex flex-wrap justify-center gap-3">
        {d.angebot.map((id) => offen ? (
          <Karte key={id} fakt={fakten.get(id)!} onClick={() => waehle(id)} klasse="kt-zieh" />
        ) : (
          <button key={id} type="button" aria-label="Karte aufdecken" onClick={() => setAuf(true)}><Rueckseite /></button>
        ))}
      </div>
      {!offen && <p className="text-muted text-center">Tippe auf eine verdeckte Karte, um den Booster aufzudecken.</p>}
      <p className="text-muted">Abgelehnte Karten kommen später in einem anderen Booster wieder. Nicht jede Karte ist nützlich – wähle mit Bedacht.</p>
      {d.deck.length > 0 && (
        <div aria-label="Dein Deck bisher" className="flex flex-wrap gap-1">
          {d.deck.map((id) => <span key={id} className="card px-2 py-0.5 text-xs max-w-48 truncate" title={fakten.get(id)?.text}>{fakten.get(id)?.text}</span>)}
        </div>
      )}
    </section>
  );
}
