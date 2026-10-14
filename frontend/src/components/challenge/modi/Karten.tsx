"use client";
/** Kartenspiel (Deckbuilder): Booster-Draft für das Deck, dann Kampf mit Nachziehstapel, Hand, Ablage und Energie. */
import { useState } from "react";
import type { ModusProps } from "./typen";
import { Herzen } from "./teile";
import Draft from "./karten/Draft";
import Etappenkarte, { wegInfo } from "./karten/Etappenkarte";
import Kampf from "./karten/Kampf";
import { KARTEN_CSS } from "./karten/Karte";
import { ENERGIE, hash } from "./karten/logik";

export default function Karten({ brett, theme, lauf, zurKarte }: ModusProps) {
  const seed = hash(`${brett.etappe}:${brett.stufe}:${brett.fakten.length}`);
  const etappen = Math.max(brett.etappen.length, brett.etappe, 3);
  const info = wegInfo(seed, etappen, brett.etappe);
  const [lager, setLager] = useState(false);
  const lagerKnopf = info.lager ? <button className="btn-secondary" onClick={() => setLager(!lager)}>🔥 Wissen nachlesen</button> : null;

  const fertig = async (ids: string[]) => { try { await lauf.deckSetzen(ids); } catch { /* Brett bleibt wie es ist */ } };

  return (
    <>
      <style>{KARTEN_CSS}</style>
      <Etappenkarte seed={seed} etappen={etappen} etappe={brett.etappe} />
      {lager && (
        <div className="card p-3 flex flex-col gap-1" aria-label="Wissen nachlesen">
          <b>🔥 Am Lagerfeuer liest du in deinen Notizen:</b>
          {brett.fakten.map((f) => <div key={f.id} className="text-sm">• {f.text}{f.info ? ` – ${f.info.text}` : ""}</div>)}
        </div>
      )}
      {!brett.deck ? (
        <>
          <div className="flex items-center justify-between">
            <Herzen leben={brett.leben} />
            <div className="flex items-center gap-2">{lagerKnopf}<button className="btn-secondary" onClick={zurKarte}>Karte</button></div>
          </div>
          <Draft brett={brett} onFertig={fertig} />
        </>
      ) : (
        <Kampf brett={brett} theme={theme} lauf={lauf} zurKarte={zurKarte} seed={seed} lagerKnopf={lagerKnopf} energie={ENERGIE + info.truhen} />
      )}
    </>
  );
}
