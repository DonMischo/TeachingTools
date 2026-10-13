"use client";
/** Holzsuche: Wald-Labyrinth (Markov-Regeln) von oben; in den Sackgassen liegen Bretter, jedes Brett trägt Fakten. */
import { useEffect, useMemo, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { markovKarte } from "@/lib/challenge/markovKarte";
import Erkunden, { type ErkundObjekt } from "../../pixel/Erkunden";
import { PixelMatrix } from "../../pixel/Matrix";
import { Inhalt } from "../teile";

const BRETT = ["..........", "bbbbbbbbbb", "bddbbddbbb", "dddddddddd", ".........."];
const BRETT_F = { b: "#c28a4a", d: "#8a5a2b" };
const reduziert = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export default function Holz({ fakten, theme, seed, gefunden, setGefunden, weiter }: {
  fakten: ChallengeFakt[]; theme: ThemeDef; seed: number; gefunden: string[];
  setGefunden(f: (g: string[]) => string[]): void; weiter(): void;
}) {
  const karte = useMemo(() => markovKarte(seed, Math.max(6, fakten.length), "labyrinth"), [seed, fakten.length]);
  const m = Math.max(1, Math.min(karte.orte.length, fakten.length));
  const orte = karte.orte.slice(0, m);
  const [geholt, setGeholt] = useState<number[]>([]);
  const [zeige, setZeige] = useState<ChallengeFakt[]>([]);
  const [ueberspringen, setUeberspringen] = useState(reduziert);

  useEffect(() => {
    const t = setTimeout(() => setUeberspringen(true), 20000);
    return () => clearTimeout(t);
  }, []);

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
    .map((o, i) => ({ id: i, x: o.x, y: o.y, label: "Brett aufheben", render: () => <PixelMatrix bild={BRETT} palette={BRETT_F} scale={2} /> }))
    .filter((o) => !geholt.includes(o.id));
  const alleEinsammeln = () => { nimm(fakten); setGeholt(orte.map((_, i) => i)); setZeige([]); weiter(); };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted">Suche im Wald nach Brettern: Pfeiltasten/WASD, die Knöpfe oder ein Brett anklicken. Gefunden: {gefunden.length}/{fakten.length}</p>
      <Erkunden karte={karte} theme={theme} objekte={dinge} onBetreten={betreten} pausiert={zeige.length > 0} kachel="wald" label="Wald" />
      <div className="flex flex-wrap gap-2">
        {alle && <button className="btn-primary" onClick={weiter}>Zur Schlucht</button>}
        {!alle && ueberspringen && <button className="btn-secondary" onClick={alleEinsammeln}>Alles einsammeln</button>}
      </div>
      {zeige.length > 0 && (
        <div className="card p-3 flex flex-col gap-2" role="status">
          <strong>Gefunden!</strong>
          {zeige.map((f) => <div key={f.id}><Inhalt x={f} />{f.info && <p className="text-muted text-sm">{f.info.text}</p>}</div>)}
          <button className="btn-secondary self-start" autoFocus onClick={() => setZeige([])}>OK</button>
        </div>
      )}
    </div>
  );
}
