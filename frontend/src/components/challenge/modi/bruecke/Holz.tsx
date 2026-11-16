"use client";
/** Materialsuche: Wald-Labyrinth (Markov-Regeln) von oben; in den Sackgassen liegt Baumaterial (Holz, Stein, Stahl, Seile), jedes Teil trägt Fakten. */
import { useMemo, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { markovKarte } from "@/lib/challenge/markovKarte";
import { useUeberspringen } from "@/lib/challenge/useUeberspringen";
import Fundkarte from "../../Fundkarte";
import Erkunden, { type ErkundObjekt } from "../../pixel/Erkunden";
import { PixelMatrix } from "../../pixel/Matrix";
import { materialVon, MATERIALIEN } from "@/lib/challenge/brueckeSpiel";

const BRETT = ["..........", "bbbbbbbbbb", "bddbbddbbb", "dddddddddd", ".........."];
const BRETT_F = { b: "#c28a4a", d: "#8a5a2b" };

export default function Holz({ fakten, theme, seed, gefunden, setGefunden, weiter, onWegwerfen }: {
  fakten: ChallengeFakt[]; theme: ThemeDef; seed: number; gefunden: string[];
  setGefunden(f: (g: string[]) => string[]): void; weiter(): void; onWegwerfen?(id: string): void;
}) {
  const karte = useMemo(() => markovKarte(seed, Math.max(6, fakten.length), "labyrinth"), [seed, fakten.length]);
  const m = Math.max(1, Math.min(karte.orte.length, fakten.length));
  const orte = karte.orte.slice(0, m);
  const [geholt, setGeholt] = useState<number[]>([]);
  const [zeige, setZeige] = useState<ChallengeFakt[]>([]);
  const ueberspringen = useUeberspringen();

  const faktenVon = (i: number) => fakten.filter((_, j) => j % m === i);
  const nimm = (fs: ChallengeFakt[]) => setGefunden((g) => [...g, ...fs.map((f) => f.id).filter((id) => !g.includes(id))]);
  const alle = fakten.length > 0 && fakten.every((f) => gefunden.includes(f.id));

  const betreten = (id: ErkundObjekt["id"]) => {
    const i = Number(id);
    if (geholt.includes(i)) return;
    setGeholt((g) => [...g, i]);
    nimm(faktenVon(i));
    setZeige(faktenVon(i));
  };
  const dinge: ErkundObjekt[] = orte
    .map((o, i) => {
      const f = faktenVon(i)[0];
      const m = f ? materialVon(f.id) : "holz";
      return { id: i, x: o.x, y: o.y, label: `${MATERIALIEN[m].name} aufheben`,
        render: () => m === "holz" ? <PixelMatrix bild={BRETT} palette={BRETT_F} scale={2} /> : <span className="text-xl" aria-hidden>{MATERIALIEN[m].icon}</span> };
    })
    .filter((o) => !geholt.includes(o.id));
  const alleEinsammeln = () => { nimm(fakten); setGeholt(orte.map((_, i) => i)); setZeige([]); weiter(); };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted">Suche im Wald nach Baumaterial: Pfeiltasten/WASD, Enter zum Aufheben, die Knöpfe oder ein Teil anklicken. Gefunden: {gefunden.length}/{fakten.length}</p>
      <Erkunden karte={karte} theme={theme} objekte={dinge} onBetreten={betreten} pausiert={zeige.length > 0} kachel="wald" label="Wald" />
      <div className="flex flex-wrap gap-2">
        {alle && <button className="btn-primary" onClick={weiter}>Zur Schlucht</button>}
        {!alle && ueberspringen && <button className="btn-secondary" onClick={alleEinsammeln}>Alles einsammeln</button>}
      </div>
      {zeige.length > 0 && <Fundkarte fakt={zeige} onOk={() => setZeige([])} onWegwerfen={onWegwerfen && (() => { zeige.forEach((f) => onWegwerfen(f.id)); setZeige([]); })} />}
    </div>
  );
}
