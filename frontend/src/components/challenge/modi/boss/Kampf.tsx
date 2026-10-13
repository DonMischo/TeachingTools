"use client";
/** Klicker-Kampf gegen ein Mini-Monster: 5 Treffer, kein Verlieren, keine Wertung. Der Besiegte lässt seine Fakten fallen. */
import { useEffect, useRef, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { Sprite, type Frame } from "@/components/challenge/pixel/Sprite";
import { Inhalt } from "../teile";
import { Szene, type Anim, type Zahl } from "./Szene";
import { EP_SIEG, epBalken, levelVon } from "@/lib/challenge/bossKarte";

const LOG = "/challenge/pixel/gfx/log.png";
const IDLE: Frame[] = Array.from({ length: 4 }, (_, i) => ({ x: i * 32, y: 64, w: 32, h: 32 }));
const LAUF = { frames: IDLE, fps: 4 };
export const SCHLAEGE = 5;

export default function Kampf({ theme, fakten, ep = 0, onSieg, onEnde }: { theme: ThemeDef; fakten: ChallengeFakt[]; ep?: number; onSieg(): void; onEnde(): void }) {
  const ep0 = useRef(ep);
  const [hp, setHp] = useState(SCHLAEGE);
  const [n, setN] = useState(0);
  const [held, setHeld] = useState<Anim>(null);
  const [gegner, setGegner] = useState<Anim>(null);
  const [zahlen, setZahlen] = useState<Zahl[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nachher = (f: () => void, ms: number) => { timer.current.push(setTimeout(f, ms)); };
  useEffect(() => () => timer.current.forEach(clearTimeout), []);

  const sieg = hp <= 0;
  const angreifen = () => {
    if (sieg) return;
    const k = n + 1, rest = hp - 1;
    setN(k); setHp(rest);
    setHeld({ art: "lunge", n: k });
    setGegner({ art: rest <= 0 ? "weg" : "treffer", n: k });
    const z: Zahl = { id: k, wert: 3 + ((k * 7) % 5) };
    setZahlen((l) => [...l, z]);
    nachher(() => setZahlen((l) => l.filter((x) => x.id !== z.id)), 900);
    if (rest <= 0) onSieg();
    else if (k % 3 === 0) nachher(() => setGegner({ art: "lunge", n: 100 + k }), 450); // harmloser Konter
  };

  // Leertaste/Enter greifen auch an, wenn der Knopf den Fokus nicht hat
  const angriffRef = useRef(angreifen);
  angriffRef.current = angreifen;
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.key !== " " && e.key !== "Enter") || (e.target as HTMLElement)?.closest?.("button,input,textarea,select,a")) return;
      e.preventDefault(); angriffRef.current();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  const aufstieg = levelVon(ep0.current + EP_SIEG) > levelVon(ep0.current);
  const bal = epBalken(ep);
  const sp = theme.spieler;
  const rf = sp.laufen.rechts[0];
  const text = sieg ? "Der Holzklotz ist besiegt!" : n === 0 ? "Was tust du?" : `Du triffst den Holzklotz! Noch ${hp} von ${SCHLAEGE}.`;
  const himmel = theme.farben.himmel === "transparent" ? undefined : theme.farben.himmel;
  const boden = theme.farben.boden === "transparent" ? undefined : theme.farben.boden;

  return (
    <Szene introText="Ein wilder Holzklotz erscheint!" himmel={himmel} boden={boden}
      held={<Sprite src={sp.src} frame={rf} scale={rf.h >= 32 ? 4 : 7} label="Held" />}
      gegner={<Sprite src={LOG} frame={IDLE[0]} animation={LAUF} scale={3.5} label="Holzklotz" />}
      heldName={`Held Lv. ${bal.level}`} heldEp={{ wert: bal.wert, max: bal.max }} gegnerName="Holzklotz" hp={hp} hpMax={SCHLAEGE}
      heldAnim={held} gegnerAnim={gegner} zahlen={zahlen} onGegnerClick={angreifen}>
      <p className="font-bold">{text}</p>
      {sieg ? (
        <>
          <p className="font-bold">Du erhältst {EP_SIEG} EP!</p>
          {aufstieg && <p className="font-bold text-good" role="status">♪ Ta-ta-ta-taaa! Der Held steigt auf Level {levelVon(ep0.current + EP_SIEG)} auf!</p>}
          <p className="text-good font-bold">Er lässt {fakten.length > 1 ? "Fakten" : "einen Fakt"} fallen!</p>
          {fakten.map((f) => (
            <div key={f.id}><Inhalt x={f} />{f.info && <p className="text-muted text-sm">{f.info.text}</p>}</div>
          ))}
          <button className="btn-secondary self-start" autoFocus onClick={onEnde}>Weiter</button>
        </>
      ) : (
        <button className="btn-primary self-start" autoFocus onClick={angreifen}>Angreifen</button>
      )}
    </Szene>
  );
}
