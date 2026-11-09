"use client";
/** Normal-Modus: Fakten auf Challenges legen (Klick oder Ziehen) und antworten. Gelöste Fragen grün, zuletzt falsch beantwortete rot. */
import { useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import type { ModusProps } from "./typen";
import { krabbeln } from "@/lib/krabbler";
import { Ablage, FaktKarte, Frage, Herzen, Treffermeldung } from "./teile";

export default function Normal({ brett, lauf, zurKarte }: ModusProps) {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [antwort, setAntwort] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);
  const [falsch, setFalsch] = useState<string[]>([]);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const challenge = brett.challenges.find((c) => c.id === aktiv);

  const waehle = (c: string) => {
    setAktiv(c); setAblage([]); setTipp(false); setAntwort(null);
    lauf.waehle();
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
      if (!r.komplett) krabbeln();
      setFalsch((f) => (r.komplett ? f.filter((x) => x !== challenge.id) : [...f.filter((x) => x !== challenge.id), challenge.id]));
      setAktiv(null); setAblage([]); setTipp(false);
      setAntwort(r);
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

      <section aria-label="Fragen" className="rounded-xl border-2 border-line p-3 flex flex-col gap-2">
        <h2 className="font-bold">❓ Fragen ({brett.challenges.filter((c) => c.erledigt).length}/{brett.challenges.length} gelöst)</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2">
          {brett.challenges.map((c) => {
            const zustand = c.erledigt ? "geloest" : falsch.includes(c.id) ? "falsch" : null;
            return (
              <button key={c.id} onClick={() => waehle(c.id)} aria-pressed={c.id === aktiv} disabled={c.erledigt} data-zustand={zustand ?? undefined}
                className={`card p-3 text-left border-2 disabled:cursor-default ${c.id === aktiv ? "border-accent" : zustand === "geloest" ? "border-ok bg-ok/15" : zustand === "falsch" ? "border-bad bg-bad/15" : ""}`}>
                {zustand && <span className="sr-only">{zustand === "geloest" ? "Gelöst: " : "Falsch beantwortet: "}</span>}
                <span aria-hidden>{zustand === "geloest" ? "✅ " : zustand === "falsch" ? "❌ " : ""}</span>
                <Frage x={c} />
              </button>
            );
          })}
        </div>
      </section>

      {challenge && (
        <div className="card p-3 flex flex-col gap-2">
          <Ablage karten={ablage.map((id) => fakten.get(id)!)} onLege={legeAuf} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!ablage.length || sende} onClick={angreifen}>Antworten</button>
            {challenge.tip && (tipp
              ? <span className="text-muted self-center">💡 {challenge.tip}</span>
              : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
          </div>
        </div>
      )}

      <section aria-label="Fakten" className="rounded-xl border-2 border-dashed border-line p-3 flex flex-col gap-2">
        <h2 className="font-bold">🧩 Fakten{!challenge && <span className="font-normal text-muted"> – wähle erst eine Frage</span>}</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
          {brett.fakten.filter((f) => !ablage.includes(f.id)).map((f) => (
            <FaktKarte key={f.id} fakt={f} disabled={!challenge} onClick={() => legeAuf(f.id)} />
          ))}
        </div>
      </section>
    </>
  );
}
