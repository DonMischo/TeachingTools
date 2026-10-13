"use client";
/** Detektiv (nach Ace Attorney Investigations): Tatort-Haus erkunden, Notizbuch, Verhöre, Pinnwand der Deduktion. */
import { useState } from "react";
import type { ChallengeAntwort, ChallengeAufgabe } from "@/lib/api";
import Bestenliste from "@/components/challenge/Bestenliste";
import type { ModusProps } from "./typen";
import { FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import Tatort from "./detektiv/Tatort";
import { DetektivStil, Portrait, VERDAECHTIGE, skizzeVon, useSpielwert } from "./detektiv/hilfen";

type Geloest = { id: string; text: string; belege: string[] };

export default function Detektiv({ brett, theme, lauf, zurKarte }: ModusProps) {
  const [gefunden, setGefunden] = useState<string[]>([]);
  const [verhoer, setVerhoer] = useState(false);
  const [aktiv, setAktiv] = useState<ChallengeAufgabe | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [ergebnis, setErgebnis] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);
  const [geloest, setGeloest] = useState<Geloest[]>([]);

  useSpielwert(lauf, "detektiv", brett.etappe, gefunden.length, brett.fakten.length);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const offene = brett.challenges.filter((c) => !c.erledigt);
  const verdaechtig = (c: ChallengeAufgabe) => VERDAECHTIGE[Math.max(0, brett.challenges.findIndex((x) => x.id === c.id)) % VERDAECHTIGE.length];
  const notizbuch = brett.fakten.filter((f) => gefunden.includes(f.id) && !ablage.includes(f.id));

  const waehle = (c: ChallengeAufgabe) => { setAktiv(c); setAblage([]); setTipp(false); setErgebnis(null); lauf.waehle(c.id); };
  const schliesse = () => { setAktiv(null); setAblage([]); setTipp(false); setErgebnis(null); };
  const lege = (id: string) => {
    if (!aktiv || ergebnis || ablage.includes(id) || !gefunden.includes(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };
  const vorlegen = async () => {
    if (!aktiv || !ablage.length || sende) return;
    setSende(true);
    try {
      const r = await lauf.antworte(aktiv.id, ablage, tipp);
      setErgebnis(r);
      if (r.komplett) setGeloest((g) => [...g, { id: aktiv.id, text: aktiv.text, belege: ablage }]);
    } catch { schliesse(); }
    finally { setSende(false); }
  };

  const kopf = (
    <div className="flex items-center justify-between">
      <Herzen leben={brett.leben} />
      <button className="btn-secondary" onClick={zurKarte}>Karte</button>
    </div>
  );

  if (!verhoer) {
    return (
      <>
        {kopf}
        <DetektivStil />
        <h2 className="font-bold">🔍 Tatort durchsuchen</h2>
        <Tatort fakten={brett.fakten} theme={theme} seed={brett.etappe * 1009 + brett.stufe * 31 + brett.fakten.length}
          gefunden={gefunden} setGefunden={setGefunden} weiter={() => setVerhoer(true)} />
      </>
    );
  }

  const n = ablage.length;
  const daneben = !!ergebnis && !ergebnis.komplett;
  const gestempelt = offene.length === 0 && geloest.length > 0;
  return (
    <>
      {kopf}
      <DetektivStil />
      <h2 className="font-bold">🕵️ Verhöre</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-2">
        {offene.map((c) => {
          const v = verdaechtig(c);
          return (
            <button key={c.id} onClick={() => waehle(c)} aria-pressed={c.id === aktiv?.id}
              className={`card p-2 flex gap-2 items-start text-left ${c.id === aktiv?.id ? "ring-2 ring-accent" : ""}`}>
              <Portrait npc={v.npc} scale={2} />
              <span><strong className="block text-sm text-muted">{v.name}</strong>»<Inhalt x={c} />«</span>
            </button>
          );
        })}
      </div>

      {aktiv && (
        <div className="card p-3 flex flex-col gap-3" role="group" aria-label="Verhör">
          <div className="flex gap-3 items-end">
            <div className="relative shrink-0">
              <Portrait npc={verdaechtig(aktiv).npc} scale={4} label={verdaechtig(aktiv).name} className={daneben ? "dt-kopf" : ""} />
              {daneben && <span className="absolute -top-1 right-0 text-xl dt-tropf" aria-hidden>💧</span>}
              {ergebnis?.komplett && <span className="absolute -top-1 right-0 text-xl" aria-hidden>😰</span>}
            </div>
            <div className="relative bg-white text-black rounded-xl p-3 shadow">
              <strong className="block text-sm">{verdaechtig(aktiv).name} sagt:</strong>»<Inhalt x={aktiv} />«
            </div>
          </div>
          {ergebnis ? (
            <>
              <Treffermeldung antwort={ergebnis} />
              <p className="text-muted" aria-live="polite">
                {ergebnis.komplett ? "Der Verdächtige stockt – die Aussage fällt in sich zusammen." : daneben ? "Der Verdächtige schüttelt den Kopf: »So war das nicht!«" : ""}
              </p>
              <button className="btn-primary self-start" onClick={schliesse}>Weiter</button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 min-h-12 rounded-lg border-2 border-dashed border-line p-2" aria-label="Vorgelegte Beweise">
                {ablage.map((id) => (
                  <button key={id} onClick={() => setAblage(ablage.filter((x) => x !== id))} title="Zurücknehmen" className="card px-2 py-1 text-left">
                    <Inhalt x={fakten.get(id)!} />
                  </button>
                ))}
                {n === 0 && <span className="text-muted">Lege Beweise aus dem Notizbuch vor.</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!n || sende} onClick={vorlegen}>Beweis vorlegen</button>
                {aktiv.tip && (tipp ? <span className="self-center text-muted">💡 {aktiv.tip}</span>
                  : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
                <button className="btn-secondary" onClick={schliesse}>Abbrechen</button>
              </div>
            </>
          )}
        </div>
      )}

      <h2 className="font-bold">📓 Notizbuch</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
        {notizbuch.map((f) => (
          <div key={f.id} className="flex flex-col gap-1">
            <span className="text-2xl self-start border border-dashed border-line rounded-md px-2 -rotate-2" aria-hidden title="Skizze">{skizzeVon(f.id)}</span>
            <FaktKarte fakt={f} disabled={!aktiv || !!ergebnis} onClick={() => lege(f.id)} />
          </div>
        ))}
      </div>

      {geloest.length > 0 && (
        <>
          <h2 className="font-bold">📌 Pinnwand der Deduktion</h2>
          <div className="relative rounded-lg p-3 flex flex-col gap-4" style={{ background: "#b98b5a" }} role="group" aria-label="Pinnwand">
            {geloest.map((g) => (
              <div key={g.id} className="flex flex-col">
                <div className="bg-yellow-100 text-black p-2 shadow-md rounded-sm border-t-4 border-red-600 self-center max-w-full">»{g.text}«</div>
                <svg className="w-full h-8" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
                  {g.belege.map((_, i) => (
                    <line key={i} x1="50" y1="0" x2={((i + 0.5) / g.belege.length) * 100} y2="32" stroke="#d11" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  ))}
                </svg>
                <div className="flex flex-wrap gap-2 justify-around">
                  {g.belege.map((id) => (
                    <div key={id} className="bg-white text-black p-2 rounded-sm shadow text-left text-sm"><Inhalt x={fakten.get(id) ?? { text: id, image: null, formula: null }} /></div>
                  ))}
                </div>
              </div>
            ))}
            {gestempelt && (
              <div className="flex flex-col items-center gap-2" role="status">
                <span className="dt-stempel border-4 border-green-700 text-green-700 bg-white/60 font-black text-3xl px-3 rounded">FALL GELÖST!</span>
                <p className="bg-white text-black rounded p-2 text-sm"><strong>Tathergang:</strong> {geloest.map((g) => g.text).join(" – ")}</p>
              </div>
            )}
          </div>
        </>
      )}
      {lauf.hatBestenliste && (
        <details className="card p-3"><summary className="font-bold cursor-pointer">🏆 Bestenliste (Hinweise)</summary>
          <Bestenliste laden={lauf.bestenliste} spiel="detektiv" /></details>
      )}
    </>
  );
}
