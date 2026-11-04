"use client";
/** Zwei Texte zum selben Thema: Welcher klingt nach KI? Danach die typischen Merkmale. */
import { useState } from "react";
import { TEXTPAARE } from "@/lib/kikompass/interaktiv";

export function EchtOderKiText({ onFertig }: { onFertig?: () => void }) {
  const [nr, setNr] = useState(0);
  const [tipp, setTipp] = useState<"a" | "b" | null>(null);
  const [punkte, setPunkte] = useState(0);
  const paar = TEXTPAARE[nr];
  const fertig = nr >= TEXTPAARE.length;

  function waehlen(x: "a" | "b") {
    if (tipp) return;
    setTipp(x);
    if (x === paar.ki) setPunkte(p => p + 1);
    if (nr === TEXTPAARE.length - 1) onFertig?.();
  }

  if (fertig) {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-semibold">Echt oder KI? Ergebnis: {punkte} von {TEXTPAARE.length}</p>
        <p className="text-sm">Typische Hinweise auf KI-Texte: allgemein statt konkret, keine echten Erlebnisse, sehr glatt, »Insgesamt …«-Schluss.
          Aber Vorsicht: Solche Hinweise sind keine Beweise. Auch Menschen schreiben so, und KI kann auch anders.</p>
        <button className="btn-secondary self-start" onClick={() => { setNr(0); setTipp(null); setPunkte(0); }}>Nochmal</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">Echt oder KI? ({nr + 1}/{TEXTPAARE.length}) · Thema: {paar.thema}</p>
      <p className="text-sm text-muted">Welcher Text klingt eher nach einem Chatbot? Beide wurden für diese Übung geschrieben.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {(["a", "b"] as const).map(x => {
          const istKi = paar.ki === x;
          const rand = tipp ? (istKi ? "ring-2 ring-accent" : "") : "";
          return (
            <button key={x} onClick={() => waehlen(x)} disabled={!!tipp} className={`card p-3 text-left text-sm ${rand}`}>
              <span className="text-xs text-muted">Text {x.toUpperCase()}{tipp && (istKi ? " · 🤖 KI-Stil" : " · ✍️ Mensch")}</span>
              <p className="mt-1">{x === "a" ? paar.a : paar.b}</p>
            </button>
          );
        })}
      </div>
      {tipp && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{tipp === paar.ki ? "Richtig erkannt!" : "Diesmal nicht."} Woran man es merkt:</p>
          <ul className="list-disc pl-5">{paar.merkmale.map(m => <li key={m}>{m}</li>)}</ul>
          <button className="btn-primary self-start mt-1" onClick={() => { setNr(n => n + 1); setTipp(null); }}>
            {nr === TEXTPAARE.length - 1 ? "Ergebnis" : "Nächstes Paar"}
          </button>
        </div>
      )}
    </div>
  );
}
