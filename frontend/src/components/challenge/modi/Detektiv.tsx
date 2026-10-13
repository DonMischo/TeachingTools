"use client";
/** Detektivbrett: Tatort durchsuchen (Beweise in die Akte), dann Beweise per Faden an Aussagen heften. */
import { useState } from "react";
import type { ChallengeAntwort, ChallengeAufgabe } from "@/lib/api";
import { themeVon } from "@/lib/challenge/themes";
import type { ModusProps } from "./typen";
import { FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import Sammeln, { ModusStil, type Ort } from "./turm/Buehne";

const ORTE: Ort[] = [
  { emoji: "🗄️", name: "Schrank" }, { emoji: "🟥", name: "Teppich" }, { emoji: "📦", name: "Kiste" }, { emoji: "📚", name: "Bücherregal" },
  { emoji: "🗑️", name: "Papierkorb" }, { emoji: "🧥", name: "Mantel" }, { emoji: "🏺", name: "Vase" }, { emoji: "🛏️", name: "Bett" },
];

export default function Detektiv({ brett, lauf, zurKarte }: ModusProps) {
  const raum = themeVon("antike");
  const [gefunden, setGefunden] = useState<string[]>([]);
  const [wand, setWand] = useState(false);
  const [aktiv, setAktiv] = useState<ChallengeAufgabe | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [ergebnis, setErgebnis] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);

  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const offene = brett.challenges.filter((c) => !c.erledigt);
  const akte = brett.fakten.filter((f) => gefunden.includes(f.id) && !ablage.includes(f.id));

  const waehle = (c: ChallengeAufgabe) => { setAktiv(c); setAblage([]); setTipp(false); setErgebnis(null); lauf.waehle(c.id); };
  const schliesse = () => { setAktiv(null); setAblage([]); setTipp(false); setErgebnis(null); };
  const hefte = (id: string) => {
    if (!aktiv || ablage.includes(id) || !gefunden.includes(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };
  const beweisen = async () => {
    if (!aktiv || !ablage.length || sende) return;
    setSende(true);
    try { setErgebnis(await lauf.antworte(aktiv.id, ablage, tipp)); }
    catch { schliesse(); }
    finally { setSende(false); }
  };

  const kopf = (
    <div className="flex items-center justify-between">
      <Herzen leben={brett.leben} />
      <button className="btn-secondary" onClick={zurKarte}>Karte</button>
    </div>
  );

  if (!wand) {
    return (
      <>
        {kopf}
        <ModusStil />
        <h2 className="font-bold">🔍 Tatort durchsuchen</h2>
        <Sammeln fakten={brett.fakten} gefunden={gefunden} orte={ORTE} verb="durchsuchen" bg={raum.hintergrund} farbe={raum.farben.boden} wand
          onFinde={(id) => setGefunden((g) => (g.includes(id) ? g : [...g, id]))}
          onAlle={() => setGefunden(brett.fakten.map((f) => f.id))} onWeiter={() => setWand(true)} />
      </>
    );
  }

  const n = ablage.length;
  return (
    <>
      {kopf}
      <ModusStil />
      <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: "#b98b5a" }} aria-label="Pinnwand" role="group">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-3">
          {offene.map((c) => (
            <div key={c.id} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (aktiv?.id === c.id) hefte(id); }}>
              <button onClick={() => waehle(c)} aria-pressed={c.id === aktiv?.id}
                className={`w-full bg-yellow-100 text-black p-3 text-left shadow-md rounded-sm border-t-4 border-red-600 ${c.id === aktiv?.id ? "ring-2 ring-accent" : ""}`}>
                <Inhalt x={c} />
              </button>
            </div>
          ))}
        </div>

        {aktiv && (
          <div className="flex flex-col gap-2" aria-label="Beweisfäden">
            <div className="relative bg-yellow-100 text-black p-3 shadow-md rounded-sm border-t-4 border-red-600">
              <Inhalt x={aktiv} />
              {ergebnis?.komplett && (
                <span className="ch-an ch-stempel absolute right-3 top-1/2 -translate-y-1/2 border-4 border-green-700 text-green-700 font-black text-xl px-2 rounded">BEWIESEN</span>
              )}
            </div>
            {n > 0 && (
              <svg className="w-full h-10" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
                {ablage.map((id, i) => (
                  <line key={id} x1="50" y1="0" x2={((i + 0.5) / n) * 100} y2="40" stroke="#d11" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
            )}
            <div className="flex flex-wrap gap-2 min-h-12" aria-label="Angeheftete Beweise">
              {ablage.map((id) => (
                <button key={id} disabled={!!ergebnis} onClick={() => setAblage(ablage.filter((x) => x !== id))} title="Abnehmen"
                  className="bg-white text-black p-2 rounded-sm shadow text-left"><Inhalt x={fakten.get(id)!} /></button>
              ))}
              {n === 0 && <span className="text-black/70">Hefte Beweise aus der Akte an.</span>}
            </div>
            {ergebnis ? (
              <>
                <Treffermeldung antwort={ergebnis} />
                <button className="btn-primary self-start" onClick={schliesse}>Weiter</button>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!n || sende} onClick={beweisen}>Beweisen</button>
                {aktiv.tip && (tipp ? <span className="self-center text-black">💡 {aktiv.tip}</span>
                  : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
                <button className="btn-secondary" onClick={schliesse}>Abbrechen</button>
              </div>
            )}
          </div>
        )}
      </div>

      <h2 className="font-bold">🗂️ Akte</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
        {akte.map((f) => <FaktKarte key={f.id} fakt={f} disabled={!aktiv || !!ergebnis} onClick={() => hefte(f.id)} />)}
      </div>
    </>
  );
}
