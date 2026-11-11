"use client";
/**
 * Diaprojektor: Dias richtig einlegen. Die Linse dreht das Bild um 180°
 * (oben ↔ unten und links ↔ rechts). Wer das Dia so in der Hand hält, wie es
 * an der Wand stehen soll, muss es also auf den Kopf stellen — und darf es
 * nicht wenden, sonst ist die Schrift spiegelverkehrt.
 */
import { useEffect, useState, type ReactNode } from "react";
import { rauschen, ton } from "./ton";
import { useErprobt } from "@/lib/medien/erprobt";

type Lage = { dreh: 0 | 90 | 180 | 270; gewendet: boolean };

const BILDER: { titel: string; motiv: ReactNode }[] = [
  {
    titel: "Gardasee 1978",
    motiv: (
      <>
        <rect width="160" height="110" fill="#7dd3fc" />
        <circle cx="128" cy="24" r="12" fill="#fde047" />
        <path d="M 0 70 L 40 30 L 70 62 L 100 22 L 160 74 L 160 110 L 0 110 Z" fill="#64748b" />
        <path d="M 30 42 L 40 30 L 50 40 Z M 92 31 L 100 22 L 108 30 Z" fill="#f8fafc" />
        <rect y="78" width="160" height="32" fill="#0369a1" />
        <text x="8" y="102" fontSize="13" fontWeight="bold" fill="#fff">Gardasee 1978</text>
      </>
    ),
  },
  {
    titel: "Oma mit Eis",
    motiv: (
      <>
        <rect width="160" height="110" fill="#fef3c7" />
        <circle cx="62" cy="38" r="16" fill="#fcd9b6" />
        <path d="M 46 30 Q 62 8 78 30" fill="#d1d5db" />
        <rect x="44" y="54" width="36" height="46" rx="8" fill="#be185d" />
        <path d="M 96 44 L 104 74 L 112 44 Z" fill="#d97706" />
        <circle cx="104" cy="40" r="9" fill="#f9a8d4" />
        <text x="8" y="104" fontSize="12" fontWeight="bold" fill="#78350f">Oma, Rimini</text>
      </>
    ),
  },
  {
    titel: "Klassenfahrt",
    motiv: (
      <>
        <rect width="160" height="110" fill="#bbf7d0" />
        <rect x="18" y="40" width="96" height="42" rx="8" fill="#facc15" />
        {[30, 52, 74, 96].map(x => <rect key={x} x={x - 8} y="48" width="16" height="14" rx="2" fill="#e0f2fe" />)}
        <circle cx="38" cy="84" r="8" fill="#1f2937" /><circle cx="96" cy="84" r="8" fill="#1f2937" />
        <path d="M 128 82 L 140 30 L 152 82 Z" fill="#15803d" />
        <text x="8" y="22" fontSize="12" fontWeight="bold" fill="#14532d">KLASSE 8b → HARZ</text>
      </>
    ),
  },
];

const RICHTIG: Lage = { dreh: 180, gewendet: false };
const zufallsLage = (): Lage => {
  const l: Lage = { dreh: ([0, 90, 270] as const)[Math.floor(Math.random() * 3)], gewendet: Math.random() < 0.5 };
  return l;
};
const form = (l: Lage) => `rotate(${l.dreh}deg) scaleX(${l.gewendet ? -1 : 1})`;

function Dia({ motiv, lage, gross }: { motiv: ReactNode; lage: Lage; gross?: boolean }) {
  return (
    <div className={gross ? "w-full" : "w-44"} style={{ transform: form(lage), transition: "transform .35s" }}>
      <div className={`rounded ${gross ? "" : "p-2 bg-stone-100 shadow-md"}`}>
        <svg viewBox="0 0 160 110" className="w-full block" aria-hidden>{motiv}</svg>
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
          <div className="h-48 w-48 grid place-items-center"><Dia motiv={b.motiv} lage={lage} /></div>
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
            {wand ? <div className={wand.dreh % 180 ? "w-[45%]" : "w-3/4"}><Dia motiv={b.motiv} lage={wand} gross /></div> : <span className="text-stone-500 text-sm">Licht aus … gleich geht's los</span>}
          </div>
          {kommentar && <p className={`font-bold ${richtig ? "text-ok" : "text-bad"}`}>{kommentar}</p>}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {richtig && <button className="btn-primary" onClick={naechstes}>⏭️ Nächstes Dia</button>}
            <span className="text-muted">{versuche} Mal eingelegt, {richtigeDias} Dias richtig</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted">Die Linse stellt das Bild auf den Kopf und vertauscht links und rechts. Profi-Trick: Dia so halten, dass es richtig aussieht, dann auf den Kopf drehen (nicht wenden!) — und mit dem Daumen auf der Markierung in der Ecke ins Magazin stecken. Darum hatten viele Dias einen Punkt in der Ecke.</p>
    </div>
  );
}
