"use client";
/** Sammelphase der Alchemie: Kräutergarten als Heckenlabyrinth (Markov-Regeln); Kräuter, Pilze, Kristalle = je ein Fakt. */
import { useMemo, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { markovKarte } from "@/lib/challenge/markovKarte";
import { useUeberspringen } from "@/lib/challenge/useUeberspringen";
import Fundkarte from "@/components/challenge/Fundkarte";
import Erkunden, { type ErkundObjekt } from "@/components/challenge/pixel/Erkunden";

const ARTEN = ["🌿", "🍄", "💎", "🌼", "🔮"];
const NAMEN: Record<string, string> = { "🌿": "Kraut", "🍄": "Pilz", "💎": "Kristall", "🌼": "Blüte", "🔮": "Wurzelstein" };

/** Tageslicht je Etappe: Morgen, Mittag, Abend (nur Stimmung). */
const LICHT = ["rgba(255,200,120,.22)", "rgba(255,255,255,0)", "rgba(255,120,60,.25)", "rgba(40,50,120,.3)"];

export function zutatArt(i: number) { return ARTEN[i % ARTEN.length]; }

export default function Garten({ fakten, theme, seed, etappe, gefunden, setGefunden, weiter, onWegwerfen }: {
  fakten: ChallengeFakt[]; theme: ThemeDef; seed: number; etappe: number; gefunden: string[];
  setGefunden(f: (g: string[]) => string[]): void; weiter(): void; onWegwerfen?(id: string): void;
}) {
  const karte = useMemo(() => markovKarte(seed, fakten.length + 2, "labyrinth"), [seed, fakten.length]);
  const plaetze = useMemo(() => {
    const p = karte.orte.map((o) => [o.x, o.y] as [number, number]);
    for (let y = 1; y < karte.R && p.length < fakten.length; y += 2)
      for (let x = 1; x < karte.R && p.length < fakten.length; x += 2)
        if (karte.begehbar([x, y]) && !(x === karte.start[0] && y === karte.start[1]) && !p.some((q) => q[0] === x && q[1] === y)) p.push([x, y]);
    return p;
  }, [karte, fakten.length]);
  const [zeige, setZeige] = useState<{ fakt: ChallengeFakt; art: string } | null>(null);
  const ueberspringen = useUeberspringen();

  const alle = fakten.length > 0 && fakten.every((f) => gefunden.includes(f.id));
  const betreten = (id: ErkundObjekt["id"]) => {
    const i = fakten.findIndex((f) => f.id === id);
    if (i < 0 || gefunden.includes(fakten[i].id)) return;
    setGefunden((g) => (g.includes(fakten[i].id) ? g : [...g, fakten[i].id]));
    setZeige({ fakt: fakten[i], art: zutatArt(i) });
  };
  const dinge: ErkundObjekt[] = fakten.flatMap((f, i) => {
    const p = plaetze[i];
    if (!p || gefunden.includes(f.id)) return [];
    return [{ id: f.id, x: p[0], y: p[1], label: `${NAMEN[zutatArt(i)]} pflücken`, render: () => <span className="text-2xl leading-none" aria-hidden>{zutatArt(i)}</span> }];
  });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted">Im Heckenlabyrinth wachsen die Zutaten: Pfeiltasten/WASD, die Knöpfe oder ein Ziel anklicken. Gesammelt: {gefunden.length}/{fakten.length}</p>
      <div className="relative">
        <Erkunden karte={karte} theme={theme} objekte={dinge} onBetreten={betreten} pausiert={!!zeige} kachel="hecke" label="Kräutergarten" />
        <div className="absolute inset-0 pointer-events-none rounded-lg" style={{ background: LICHT[(etappe - 1 + 4) % 4] }} aria-hidden />
      </div>
      {zeige && <Fundkarte fakt={zeige.fakt} titel={`${zeige.art} ${NAMEN[zeige.art]} gepflückt!`} onOk={() => setZeige(null)} onWegwerfen={onWegwerfen && (() => { onWegwerfen(zeige.fakt.id); setZeige(null); })} />}
      <div className="flex flex-wrap gap-2">
        {alle && <button className="btn-primary" onClick={weiter}>In den Laden</button>}
        {!alle && ueberspringen && <button className="btn-secondary" onClick={() => { setGefunden(() => fakten.map((f) => f.id)); setZeige(null); weiter(); }}>Alles einsammeln</button>}
      </div>
    </div>
  );
}
