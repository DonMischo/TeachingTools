"use client";
/** Tatort-Haus (Markov-Regeln, Art »haus«): Zimmer begehen, Fundstellen mit der Lupe untersuchen; jeder Fund wandert ins Notizbuch. */
import { useEffect, useMemo, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { markovKarte } from "@/lib/challenge/markovKarte";
import Erkunden, { type ErkundObjekt } from "@/components/challenge/pixel/Erkunden";
import { Inhalt } from "../teile";
import { skizzeVon, wenigerBewegung } from "./hilfen";

export default function Tatort({ fakten, theme, seed, gefunden, setGefunden, weiter }: {
  fakten: ChallengeFakt[]; theme: ThemeDef; seed: number; gefunden: string[]; setGefunden(f: (g: string[]) => string[]): void; weiter(): void;
}) {
  const karte = useMemo(() => markovKarte(seed, Math.max(1, fakten.length), "haus"), [seed, fakten.length]);
  // eine Fundstelle je Fakt: erst in den Zimmern, bei Bedarf auf weiteren Bodenfeldern
  const stellen = useMemo(() => {
    const s: [number, number][] = karte.orte.slice(0, fakten.length).map((o) => [o.x, o.y]);
    const belegt = new Set(s.map(([x, y]) => `${x},${y}`));
    belegt.add(karte.start.join(","));
    for (let y = 0; y < karte.R && s.length < fakten.length; y++) {
      for (let x = 0; x < karte.R && s.length < fakten.length; x++) {
        if (karte.begehbar([x, y]) && !belegt.has(`${x},${y}`)) { s.push([x, y]); belegt.add(`${x},${y}`); }
      }
    }
    return s;
  }, [karte, fakten.length]);
  const [zeige, setZeige] = useState<ChallengeFakt | null>(null);
  const [skip, setSkip] = useState(wenigerBewegung());
  useEffect(() => {
    if (skip) return;
    const t = setTimeout(() => setSkip(true), 20000);
    return () => clearTimeout(t);
  }, [skip]);

  const alle = fakten.length > 0 && fakten.every((f) => gefunden.includes(f.id));
  const objekte: ErkundObjekt[] = fakten.slice(0, stellen.length).map((f, i) => {
    const da = gefunden.includes(f.id);
    return {
      id: f.id, x: stellen[i][0], y: stellen[i][1],
      label: da ? undefined : `Fundstelle ${i + 1} untersuchen`,
      render: () => da
        ? <span className="text-xl" aria-hidden>📄</span>
        : <span className="text-2xl dt-blink" aria-hidden>🔍</span>,
    };
  });
  const betreten = (id: ErkundObjekt["id"]) => {
    const f = fakten.find((x) => x.id === id);
    if (!f || gefunden.includes(f.id)) return;
    setGefunden((g) => (g.includes(f.id) ? g : [...g, f.id]));
    setZeige(f);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted">
        Durchsuche das Haus: Pfeiltasten/WASD, die Knöpfe oder eine blinkende Lupe anklicken. Hinweise im Notizbuch: {gefunden.length}/{fakten.length}
      </p>
      <Erkunden karte={karte} theme={theme} objekte={objekte} onBetreten={betreten} pausiert={!!zeige} kachel="haus" label="Tatort" />
      <div className="flex flex-wrap items-center gap-2">
        {alle && <button className="btn-primary" onClick={weiter}>Zum Verhör</button>}
        {!alle && skip && (
          <button className="btn-secondary" onClick={() => setGefunden((g) => [...g, ...fakten.map((f) => f.id).filter((id) => !g.includes(id))])}>
            Alles einsammeln
          </button>
        )}
      </div>
      {zeige && (
        <div className="card p-3 flex flex-col gap-2" role="status">
          <strong>🔍 Hinweis gefunden!</strong>
          <div className="flex gap-3 items-start">
            <span className="text-3xl border-2 border-dashed border-line rounded-lg p-2 -rotate-3" aria-hidden>{skizzeVon(zeige.id)}</span>
            <div><Inhalt x={zeige} />{zeige.info && <p className="text-muted text-sm mt-1">{zeige.info.text}</p>}</div>
          </div>
          <button className="btn-secondary self-start" autoFocus onClick={() => setZeige(null)}>Ins Notizbuch</button>
        </div>
      )}
    </div>
  );
}
