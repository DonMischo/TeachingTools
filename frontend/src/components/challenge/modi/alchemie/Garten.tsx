"use client";
/** Sammelphase der Alchemieküche: Zutaten (Fakten) im Garten pflücken, jeder Busch gibt eine. */
import { useEffect, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { Kachelfeld, Sprite } from "@/components/challenge/pixel/Sprite";
import { Inhalt } from "../teile";
import { bodenKachel } from "@/lib/challenge/themes";
import { Passend } from "@/components/challenge/pixel/Passend";

const OBJ = "/challenge/pixel/gfx/objects.png";
const BUSCH = { x: 128, y: 192, w: 32, h: 32 };
const STUMPF = { x: 0, y: 160, w: 32, h: 32 };
const SPALTEN = 4, T = 48;

const reduziert = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export default function Garten({ fakten, theme, gefunden, setGefunden, weiter }: {
  fakten: ChallengeFakt[]; theme: ThemeDef; gefunden: string[]; setGefunden(f: (g: string[]) => string[]): void; weiter(): void;
}) {
  const [zeige, setZeige] = useState<ChallengeFakt | null>(null);
  const [ueberspringen, setUeberspringen] = useState(reduziert);
  useEffect(() => {
    const t = setTimeout(() => setUeberspringen(true), 20000);
    return () => clearTimeout(t);
  }, []);

  const alle = fakten.length > 0 && fakten.every((f) => gefunden.includes(f.id));
  const pfluecke = (f: ChallengeFakt) => {
    setGefunden((g) => (g.includes(f.id) ? g : [...g, f.id]));
    setZeige(f);
  };
  const h = theme.hintergrund;
  const zeilen = Math.ceil(fakten.length / SPALTEN) + 1;
  const karte = Array.from({ length: zeilen }, (_, y) => Array.from({ length: SPALTEN + 1 }, (_, x) => (h ? bodenKachel(h.muster.boden, x, y) : 0)));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted">Im Garten wachsen die Zutaten: Büsche anklicken zum Pflücken. Gepflückt: {gefunden.length}/{fakten.length}</p>
      <Passend breite={(SPALTEN + 1) * T} hoehe={zeilen * T}>
        <div className="relative rounded-lg overflow-hidden" style={{ width: (SPALTEN + 1) * T, height: zeilen * T, background: h ? undefined : theme.farben.boden === "transparent" ? "#4aa55a" : theme.farben.boden }}>
          {h && <Kachelfeld src={h.src} tile={h.tile} cols={h.cols} karte={karte} scale={T / h.tile} />}
          {fakten.map((f, i) => {
            const weg = gefunden.includes(f.id);
            return (
              <button key={f.id} disabled={weg} aria-label={weg ? "Busch (gepflückt)" : "Busch pflücken"} onClick={() => pfluecke(f)}
                style={{ left: (i % SPALTEN) * T + 8, top: Math.floor(i / SPALTEN) * T + 8, width: T, height: T }}
                className="absolute flex items-center justify-center focus-visible:outline-2 focus-visible:outline-accent">
                <Sprite src={OBJ} frame={weg ? STUMPF : BUSCH} scale={1.4} />
              </button>
            );
          })}
        </div>
      </Passend>
      {zeige && (
        <div className="card p-3 flex flex-col gap-2" role="status">
          <strong>Gepflückt!</strong>
          <div><Inhalt x={zeige} />{zeige.info && <p className="text-muted text-sm">{zeige.info.text}</p>}</div>
          <button className="btn-secondary self-start" onClick={() => setZeige(null)}>OK</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {alle && <button className="btn-primary" onClick={weiter}>In die Küche</button>}
        {!alle && ueberspringen && <button className="btn-secondary" onClick={() => { setGefunden(() => fakten.map((f) => f.id)); setZeige(null); weiter(); }}>Alles einsammeln</button>}
      </div>
    </div>
  );
}
