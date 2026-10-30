"use client";
/**
 * Lichtschalter (»Lights Out«): Ein Klick schaltet das Feld und seine vier
 * Nachbarn um. Ziel: alle Lichter aus. Die Rätsel entstehen aus dem gelösten
 * Brett durch zufällige Klicks — also immer lösbar. Pro Level mehr Klicks;
 * Punkte: 100 je Level plus Bonus für wenige Züge.
 */
import { useState } from "react";

const N = 5;

function umschalten(brett: boolean[], i: number) {
  const neu = [...brett];
  const r = Math.floor(i / N), c = i % N;
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) neu[rr * N + cc] = !neu[rr * N + cc];
  }
  return neu;
}

export function raetsel(level: number, zufall = Math.random) {
  for (;;) {
    let b = Array<boolean>(N * N).fill(false);
    const klicks = new Set<number>();
    while (klicks.size < Math.min(3 + level, 14)) klicks.add(Math.floor(zufall() * N * N));
    for (const k of klicks) b = umschalten(b, k);
    // Manche Klickfolgen heben sich auf 5×5 gegenseitig auf — dann neu würfeln
    if (b.some(Boolean)) return { brett: b, optimal: klicks.size };
  }
}

export default function Logik({ onEnde }: { onEnde: (punkte: number) => void }) {
  const [level, setLevel] = useState(1);
  const [stand, setStand] = useState(() => raetsel(1));
  const [zuege, setZuege] = useState(0);
  const [punkte, setPunkte] = useState(0);
  const [fertig, setFertig] = useState(false);

  const klick = (i: number) => {
    if (fertig) return;
    const neu = umschalten(stand.brett, i);
    setStand({ ...stand, brett: neu });
    setZuege(z => z + 1);
    if (neu.every(x => !x)) setFertig(true);
  };
  const weiter = () => {
    const p = punkte + 100 + Math.max(0, (stand.optimal * 2 - zuege - 1) * 10);
    setPunkte(p);
    onEnde(p);
    setLevel(level + 1);
    setStand(raetsel(level + 1));
    setZuege(0);
    setFertig(false);
  };

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="flex justify-between w-full text-sm font-bold"><span>💡 Level {level}</span><span>Züge {zuege}</span><span>⭐ {punkte}</span></div>
      <div className="grid grid-cols-5 gap-1.5 w-full">
        {stand.brett.map((an, i) => (
          <button key={i} onClick={() => klick(i)} aria-label={an ? "Licht an" : "Licht aus"}
            className={`aspect-square rounded-lg transition-colors ${an ? "bg-yellow-300 shadow-[0_0_12px_#fde047]" : "bg-slate-700"}`} />
        ))}
      </div>
      <p className="text-xs text-muted text-center">Ein Klick schaltet das Feld und seine Nachbarn um. Mach alle Lichter aus!</p>
      {fertig && <button className="btn-primary" onClick={weiter}>✅ Geschafft – nächstes Level</button>}
      <button className="text-xs text-muted underline" onClick={() => { setStand(raetsel(level)); setZuege(0); setFertig(false); }}>Neu mischen</button>
    </div>
  );
}
