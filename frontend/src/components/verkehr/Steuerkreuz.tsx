"use client";
/**
 * Steuerung für Handy und Tablet: links ein Stick (weit ausgelenkt = rennen),
 * rechts Knöpfe für Umschauen, Aktion (E), Warnweste und die Gesten.
 * Schreibt in denselben Kanal, den das Spielfeld jedes Bild liest.
 */
import { useRef, useState, type PointerEvent } from "react";
import { GESTEN } from "@/lib/verkehr/gesten";

export type Steuerkanal = {
  stick: { x: number; y: number };
  /** Vom Spielfeld gesetzt: löst eine Taste aus wie ein Tastendruck. */
  taste?: (code: string) => void;
};

const STICK = 56;

export function Steuerkreuz({ kanal, beleidigungen }: { kanal: React.MutableRefObject<Steuerkanal>; beleidigungen: boolean }) {
  const [knauf, setKnauf] = useState({ x: 0, y: 0 });
  const mitte = useRef<{ x: number; y: number; id: number } | null>(null);
  const [gesten, setGesten] = useState(false);

  const setze = (x: number, y: number) => {
    const l = Math.hypot(x, y), max = STICK;
    const f = l > max ? max / l : 1;
    setKnauf({ x: x * f, y: y * f });
    kanal.current.stick = { x: (x * f) / max, y: (y * f) / max };
  };
  const runter = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mitte.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setze(e.clientX - mitte.current.x, e.clientY - mitte.current.y);
  };
  const zieh = (e: PointerEvent<HTMLDivElement>) => {
    if (!mitte.current || e.pointerId !== mitte.current.id) return;
    setze(e.clientX - mitte.current.x, e.clientY - mitte.current.y);
  };
  const los = () => { mitte.current = null; setze(0, 0); };
  const druecke = (code: string) => () => kanal.current.taste?.(code);

  const rund = "flex items-center justify-center rounded-full border-2 border-white/60 bg-black/45 text-white shadow-lg backdrop-blur-sm active:scale-95 select-none touch-none";

  return (
    <>
      <div
        className="absolute bottom-5 left-5 z-10 h-36 w-36 rounded-full border-2 border-white/50 bg-black/30 backdrop-blur-sm touch-none select-none"
        onPointerDown={runter} onPointerMove={zieh} onPointerUp={los} onPointerCancel={los}
        aria-label="Stick zum Laufen"
      >
        <div className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-white/80 shadow"
          style={{ transform: `translate(calc(-50% + ${knauf.x}px), calc(-50% + ${knauf.y}px))` }} />
      </div>
      <div className="absolute bottom-5 right-5 z-10 grid grid-cols-2 gap-3">
        <button type="button" className={`${rund} h-16 w-16 text-2xl`} onPointerDown={druecke("Space")} aria-label="Umschauen">👀</button>
        <button type="button" className={`${rund} h-16 w-16 text-lg font-black`} onPointerDown={druecke("KeyE")} aria-label="Aktion">E</button>
        <button type="button" className={`${rund} h-14 w-14 text-2xl`} onPointerDown={druecke("KeyV")} aria-label="Warnweste">🦺</button>
        <button type="button" className={`${rund} h-14 w-14 text-2xl`} onPointerDown={() => setGesten((g) => !g)} aria-label="Gesten">😊</button>
        <button type="button" className={`${rund} col-span-2 h-12 w-full text-2xl`} onPointerDown={druecke("KeyL")} aria-label="LTB fragen">🐧</button>
      </div>
      {gesten && (
        <div className="absolute bottom-60 right-5 z-10 flex gap-2">
          {GESTEN.filter((g) => beleidigungen || !g.beleidigung).map((g) => (
            <button key={g.id} type="button" className={`${rund} h-12 w-12 text-2xl`} aria-label={g.name}
              onPointerDown={() => { kanal.current.taste?.(`Digit${g.taste}`); setGesten(false); }}>
              {g.emoji}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
