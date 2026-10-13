"use client";
/** Normal-Modus: Fakten auf Challenges legen (Klick oder Ziehen) und angreifen. */
import { useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";

export default function Normal({ brett, lauf, zurKarte }: ModusProps) {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const challenge = brett.challenges.find((c) => c.id === aktiv);
  const offene = brett.challenges.filter((c) => !c.erledigt);

  const waehle = (c: string) => {
    setAktiv(c); setAblage([]); setTipp(false); setAntwort(null);
    lauf.waehle(c);
  };
  const legeAuf = (id: string) => {
    if (!challenge || ablage.includes(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };

  const angreifen = async () => {
    if (!challenge || !ablage.length || sende) return;
    setSende(true);
    try {
      const r = await lauf.antworte(challenge.id, ablage, tipp);
      setAktiv(null); setAblage([]); setTipp(false);
      setAntwort(r.etappe_geschafft || r.zurueck_zur_karte || r.fertig ? null : r);
    } catch {
      setAktiv(null); setAblage([]); // z. B. 409 (schon erledigt): das Brett ist schon neu geladen
    } finally {
      setSende(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Herzen leben={brett.leben} />
        <button className="btn-secondary" onClick={zurKarte}>Karte</button>
      </div>
      <Treffermeldung antwort={antwort} />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2">
        {offene.map((c) => (
          <button key={c.id} onClick={() => waehle(c.id)} aria-pressed={c.id === aktiv}
            className={`card p-3 text-left ${c.id === aktiv ? "border-accent" : ""}`}>
            <Inhalt x={c} />
          </button>
        ))}
      </div>

      {challenge && (
        <div className="card p-3 flex flex-col gap-2">
          <Ablage karten={ablage.map((id) => fakten.get(id)!)} onLege={legeAuf} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!ablage.length || sende} onClick={angreifen}>Angreifen</button>
            {challenge.tip && (tipp
              ? <span className="text-muted self-center">💡 {challenge.tip}</span>
              : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
        {brett.fakten.filter((f) => !ablage.includes(f.id)).map((f) => (
          <FaktKarte key={f.id} fakt={f} disabled={!challenge} onClick={() => legeAuf(f.id)} />
        ))}
      </div>
    </>
  );
}
