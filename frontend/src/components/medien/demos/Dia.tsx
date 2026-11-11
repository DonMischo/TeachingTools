"use client";
/**
 * Diaprojektor: Dias richtig einlegen. Die Linse dreht das Bild um 180°
 * (oben ↔ unten und links ↔ rechts). Wer das Dia so in der Hand hält, wie es
 * an der Wand stehen soll, muss es also auf den Kopf stellen — und darf es
 * nicht wenden, sonst ist die Schrift spiegelverkehrt.
 */
import { useEffect, useState } from "react";
import bilder from "@/lib/medien/demo-bilder.json";
import { rauschen, ton } from "./ton";
import { useErprobt } from "@/lib/medien/erprobt";

type Lage = { dreh: 0 | 90 | 180 | 270; gewendet: boolean };

const BILDER: { titel: string; id: string }[] = [
  { titel: "Dolomiten 1978", id: "dia_dolomiten" },
  { titel: "Nordsee 1981", id: "dia_dorum" },
  { titel: "Cornwall 1983", id: "dia_godrevy" },
];
const NACHWEISE = bilder as Record<string, { datei: string; titel: string; urheber: string; lizenz: string; quelle: string }>;

const RICHTIG: Lage = { dreh: 180, gewendet: false };
const zufallsLage = (): Lage => {
  const l: Lage = { dreh: ([0, 90, 270] as const)[Math.floor(Math.random() * 3)], gewendet: Math.random() < 0.5 };
  return l;
};
const form = (l: Lage) => `rotate(${l.dreh}deg) scaleX(${l.gewendet ? -1 : 1})`;

function Dia({ id, titel, lage, gross }: { id: string; titel: string; lage: Lage; gross?: boolean }) {
  return (
    <div className={gross ? "w-full" : "w-44"} style={{ transform: form(lage), transition: "transform .35s" }}>
      <div className={`relative rounded-sm ${gross ? "" : "p-2 bg-stone-100 shadow-md"}`}>
        {!gross && <span className="absolute left-1 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden />}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={NACHWEISE[id].datei} alt="" className="w-full block aspect-[3/2] object-cover" style={{ filter: "sepia(.35) saturate(1.3) contrast(.95)" }} draggable={false} />
          <span className="absolute left-2 bottom-1 font-bold italic text-white" style={{ fontFamily: "'Segoe Script','Bradley Hand','Comic Sans MS',cursive", fontSize: gross ? "1.4rem" : "0.8rem", textShadow: "0 1px 3px #000" }}>{titel}</span>
        </div>
      </div>
    </div>
  );
}

export function DiaDemo() {
  const [nr, setNr] = useState(0);
  const [lage, setLage] = useState<Lage>({ dreh: 90, gewendet: true });
  const [gezeigt, setGezeigt] = useState<Lage | null>(null);
  const [versuche, setVersuche] = useState(0);
  const [richtigeDias, setRichtigeDias] = useState(0);
  const erprobt = useErprobt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (richtigeDias >= 3) erprobt("dia"); }, [richtigeDias]);
  const b = BILDER[nr];
  const richtig = gezeigt !== null && gezeigt.dreh === RICHTIG.dreh && gezeigt.gewendet === RICHTIG.gewendet;
  const einlegen = () => {
    rauschen(0.08, 0, 0.12, { freq: 900 }); ton(160, 0.08, 0.05, "square", 0.06);
    setGezeigt(lage); setVersuche(v => v + 1);
    if (lage.dreh === RICHTIG.dreh && !lage.gewendet) setRichtigeDias(r => r + 1);
  };
  const naechstes = () => { setNr((nr + 1) % BILDER.length); setLage(zufallsLage()); setGezeigt(null); };
  // An der Wand: die Linse dreht alles noch einmal um 180°
  const wand: Lage | null = gezeigt && { dreh: (((gezeigt.dreh + 180) % 360) as Lage["dreh"]), gewendet: gezeigt.gewendet };
  const kommentar = !gezeigt ? null : richtig ? "Perfekt! Alle klatschen höflich. Nächstes Dia?"
    : wand!.dreh === 180 && !wand!.gewendet ? "Kopfstand! Alle verrenken den Hals."
      : wand!.dreh % 180 !== 0 ? "Liegt auf der Seite — alle legen den Kopf schief."
        : "Spiegelverkehrt! Die Schrift läuft rückwärts — das Dia ist gewendet.";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid sm:grid-cols-[auto_1fr] gap-4 items-center">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-muted">Das Dia in deiner Hand (du schaust zur Leinwand)</span>
          <div className="h-48 w-48 grid place-items-center"><Dia id={b.id} titel={b.titel} lage={lage} /></div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => { setLage(l => ({ ...l, dreh: (((l.dreh + 90) % 360) as Lage["dreh"]) })); setGezeigt(null); }}>↻ drehen</button>
            <button className="btn-secondary" onClick={() => { setLage(l => ({ ...l, gewendet: !l.gewendet })); setGezeigt(null); }}>⇋ wenden</button>
          </div>
          <button className="btn-primary" onClick={einlegen}>📽️ Einlegen — klack!</button>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">Leinwand im Wohnzimmer</span>
          <div className="rounded-lg p-3 aspect-[16/10] grid place-items-center overflow-hidden" style={{ background: wand ? "#f5f5f4" : "#1c1917", boxShadow: wand ? "0 0 40px rgba(253,224,71,.35) inset" : "none" }}>
            {/* Auf der Seite liegend ist das Bild hochkant — kleiner, damit es auf die Leinwand passt */}
            {wand ? <div className={wand.dreh % 180 ? "w-[45%]" : "w-3/4"}><Dia id={b.id} titel={b.titel} lage={wand} gross /></div> : <span className="text-stone-500 text-sm">Licht aus … gleich geht's los</span>}
          </div>
          {kommentar && <p className={`font-bold ${richtig ? "text-ok" : "text-bad"}`}>{kommentar}</p>}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {richtig && <button className="btn-primary" onClick={naechstes}>⏭️ Nächstes Dia</button>}
            <span className="text-muted">{versuche} Mal eingelegt, {richtigeDias} Dias richtig</span>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted">Fotos (Wikimedia Commons): {Object.entries(NACHWEISE).filter(([k]) => k.startsWith("dia_")).map(([, n]) => `${n.titel.replace(/[.]jpe?g$/i, "")} — ${n.urheber}, ${n.lizenz}`).join(" · ")}</p>
      <p className="text-xs text-muted">Die Linse stellt das Bild auf den Kopf und vertauscht links und rechts. Profi-Trick: Dia so halten, dass es richtig aussieht, dann auf den Kopf drehen (nicht wenden!) — und mit dem Daumen auf der Markierung in der Ecke ins Magazin stecken. Darum hatten viele Dias einen Punkt in der Ecke.</p>
    </div>
  );
}
