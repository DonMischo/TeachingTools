"use client";
/** Kleinkram des Gericht-Modus: Stil, Gerichtssaal-Bühne, Spielwert-Meldung. */
import { useEffect, useRef, type ReactNode } from "react";
import type { ThemeDef } from "@/lib/challenge/themes";
import { bodenKachel } from "@/lib/challenge/themes";
import type { ChallengeLauf } from "@/lib/challenge/useChallengeLauf";
import { Kachelfeld } from "@/components/challenge/pixel/Sprite";
import { Passend } from "@/components/challenge/pixel/Passend";

export const wenigerBewegung = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && !!window.matchMedia("(prefers-reduced-motion: reduce)")?.matches;

export function GerichtStil() {
  return (
    <style>{`
      @keyframes gr-schuettel{0%,100%{transform:translate(0,0)}15%{transform:translate(-9px,4px)}30%{transform:translate(8px,-5px)}45%{transform:translate(-7px,-3px)}60%{transform:translate(6px,5px)}80%{transform:translate(-3px,2px)}}
      @keyframes gr-burst{0%{transform:scale(.2) rotate(-12deg);opacity:0}30%{transform:scale(1.25) rotate(-6deg);opacity:1}100%{transform:scale(1) rotate(-6deg);opacity:1}}
      @keyframes gr-hammer{0%,100%{transform:rotate(-40deg)}50%{transform:rotate(25deg) translateY(6px)}}
      @keyframes gr-zittern{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
      @keyframes gr-tropf{0%{transform:translateY(0);opacity:1}100%{transform:translateY(20px);opacity:0}}
      .gr-schuettel{animation:gr-schuettel .55s 1}.gr-burst{animation:gr-burst .35s forwards}.gr-hammer{animation:gr-hammer .4s 3}
      .gr-zittern{animation:gr-zittern .15s infinite}.gr-tropf{animation:gr-tropf 1s infinite}
      @media (prefers-reduced-motion: reduce){.gr-schuettel,.gr-burst,.gr-hammer,.gr-zittern,.gr-tropf{animation:none!important}}
    `}</style>
  );
}

type Hg = ThemeDef["hintergrund"];
const SPALTEN = 14;
const ZEILEN = 8;

/** Gerichtssaal-Bühne 448×256 (14×8 Kacheln, Maßstab 2), oben zwei Zeilen Wand. */
export function Saal({ bg, farbe, children, label, className }: { bg: Hg; farbe: string; children?: ReactNode; label: string; className?: string }) {
  const karte = bg
    ? Array.from({ length: ZEILEN }, (_, y) => Array.from({ length: SPALTEN }, (_, x) => (y < 2 ? bg.muster.wand[0] : bodenKachel(bg.muster.boden, x, y))))
    : null;
  return (
    <div className={`rounded-lg ${className ?? ""}`} role="group" aria-label={label}>
      <Passend breite={SPALTEN * 32} hoehe={ZEILEN * 32}>
        <div className="relative mx-auto overflow-hidden" style={{ width: SPALTEN * 32, height: ZEILEN * 32, background: farbe }}>
          {bg && karte && <Kachelfeld src={bg.src} tile={bg.tile} cols={bg.cols} scale={2} karte={karte} />}
          {children}
        </div>
      </Passend>
    </div>
  );
}

/** Meldet den Spielwert gedrosselt und beim Abbau. */
export function useSpielwert(lauf: ChallengeLauf, spiel: string, etappe: number, wert: number, max: number) {
  const neu = useRef({ lauf, spiel, etappe, wert, max });
  neu.current = { lauf, spiel, etappe, wert, max };
  const gesendet = useRef(0);
  const sende = () => {
    const n = neu.current;
    if (n.wert === gesendet.current) return;
    gesendet.current = n.wert;
    void n.lauf.spielwert?.(n.spiel, n.etappe, n.wert, n.max);
  };
  useEffect(() => {
    if (wert === 0) return;
    const t = setTimeout(sende, 1500);
    return () => clearTimeout(t);
  }, [wert]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => sende, []); // eslint-disable-line react-hooks/exhaustive-deps
}
