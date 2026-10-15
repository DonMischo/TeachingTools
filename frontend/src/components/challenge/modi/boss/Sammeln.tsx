"use client";
/**
 * Sammelphase des Bosskampfs: eine Verlies-Karte (Markov-Regeln wie bei TaskCrawler) von oben.
 * Die Figur läuft durch die Gänge (Erkunden); Truhen öffnen sich beim Betreten,
 * Mini-Monster starten einen Klicker-Kampf. Jedes gibt 1–2 Fakten.
 */
import { useMemo, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { begehbar, weg } from "@/lib/gebaeude/plan";
import { baueBossKarte, type BossObjekt } from "@/lib/challenge/bossKarte";
import { useUeberspringen } from "@/lib/challenge/useUeberspringen";
import { Sprite } from "@/components/challenge/pixel/Sprite";
import Erkunden, { type ErkundObjekt } from "@/components/challenge/pixel/Erkunden";
import Fundkarte from "@/components/challenge/Fundkarte";
import Kampf from "./Kampf";

const OBJ = "/challenge/pixel/gfx/objects.png";
const TRUHE = { x: 148, y: 0, w: 22, h: 16 };
const TRUHE_AUF = { x: 181, y: 0, w: 20, h: 16 };
const LOG = "/challenge/pixel/gfx/log.png";
const MONSTER = { x: 0, y: 64, w: 32, h: 32 };

export default function Sammeln({ fakten, theme, seed, gefunden, setGefunden, weiter, ep = 0, etappe = 1, onEp }: {
  fakten: ChallengeFakt[]; theme: ThemeDef; seed: number; gefunden: string[]; setGefunden(f: (g: string[]) => string[]): void; weiter(): void; ep?: number; etappe?: number; onEp?(): void;
}) {
  const karte = useMemo(() => baueBossKarte(seed, fakten.length), [seed, fakten.length]);
  const { objekte } = karte;
  const erkundKarte = useMemo(() => ({
    R: karte.R, start: karte.start,
    begehbar: (p: [number, number]) => begehbar(karte.R, karte.st, p),
    weg: (von: [number, number], nach: [number, number]) => weg(karte.R, karte.st, von, nach),
  }), [karte]);
  const [fertig, setFertig] = useState<number[]>([]);
  const [zeige, setZeige] = useState<ChallengeFakt[]>([]);
  const [kampf, setKampf] = useState<BossObjekt | null>(null);
  const ueberspringen = useUeberspringen();

  const faktenVon = (o: BossObjekt) => o.faktIdx.map((i) => fakten[i]).filter(Boolean);
  const alle = fakten.length > 0 && fakten.every((f) => gefunden.includes(f.id));
  const nimm = (fs: ChallengeFakt[]) => setGefunden((g) => [...g, ...fs.map((f) => f.id).filter((id) => !g.includes(id))]);
  const blockiert = !!kampf || zeige.length > 0;

  const betreten = (id: ErkundObjekt["id"]) => {
    const o = objekte.find((x) => x.id === id);
    if (!o || fertig.includes(o.id)) return;
    if (o.art === "truhe") { setFertig((f) => [...f, o.id]); nimm(faktenVon(o)); setZeige(faktenVon(o)); } else setKampf(o);
  };
  const alleEinsammeln = () => { nimm(fakten); setFertig(objekte.map((o) => o.id)); setZeige([]); setKampf(null); weiter(); };

  const dinge: ErkundObjekt[] = objekte.flatMap((o): ErkundObjekt[] => {
    const auf = fertig.includes(o.id);
    if (o.art === "monster" && auf) return [];
    if (auf) return [{ id: o.id, x: o.x, y: o.y, render: () => <Sprite src={OBJ} frame={TRUHE_AUF} scale={1.5} label="Truhe (leer)" /> }];
    return [{
      id: o.id, x: o.x, y: o.y,
      label: o.art === "truhe" ? "Truhe öffnen" : "Mini-Monster herausfordern",
      render: () => o.art === "truhe" ? <Sprite src={OBJ} frame={TRUHE} scale={1.5} /> : <Sprite src={LOG} frame={MONSTER} scale={1.3} />,
    }];
  });

  return (
    <div className="flex flex-col gap-2">
      {kampf && <Kampf theme={theme} fakten={faktenVon(kampf)} ep={ep} stufe={etappe} zaehe={kampf.id % 3}
        onSieg={() => { setFertig((f) => [...f, kampf.id]); nimm(faktenVon(kampf)); onEp?.(); }} onEnde={() => setKampf(null)} onVerloren={() => setKampf(null)} />}
      <div hidden={!!kampf} className="flex flex-col gap-2">
        <p className="text-muted">Erkunde das Verlies: Pfeiltasten/WASD, die Knöpfe oder ein Ziel anklicken. Truhen öffnen sich beim Betreten, gegen Mini-Monster kämpfst du per Klick – sie schlagen zurück, also sei schnell. Gefunden: {gefunden.length}/{fakten.length}</p>
        <Erkunden karte={erkundKarte} theme={theme} objekte={dinge} onBetreten={betreten} pausiert={blockiert} label="Verlies" />
        <div className="flex flex-wrap items-center gap-2">
          {alle && <button className="btn-primary" onClick={weiter}>Zum Kampf</button>}
          {!alle && ueberspringen && <button className="btn-secondary" onClick={alleEinsammeln}>Alles einsammeln</button>}
        </div>
        {zeige.length > 0 && <Fundkarte fakt={zeige} onOk={() => setZeige([])} />}
      </div>
    </div>
  );
}
