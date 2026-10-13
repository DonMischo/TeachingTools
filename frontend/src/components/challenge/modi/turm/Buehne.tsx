"use client";
/** Gemeinsame Bühne (Kachelfeld aus dem Theme) und Sammelphase für Turm, Detektiv; Bühne und Reduced-Motion-Hilfe auch für Gericht. */
import { useEffect, useState, type ReactNode } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { Kachelfeld } from "@/components/challenge/pixel/Sprite";
import { Inhalt } from "../teile";
import { bodenKachel } from "@/lib/challenge/themes";
import { Passend } from "@/components/challenge/pixel/Passend";

export const wenigerBewegung = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Hg = ThemeDef["hintergrund"];
const SPALTEN = 14;
const ZEILEN = 8;

/** Feste Bühne 448×256 (14×8 Kacheln, Maßstab 2); mit `wand` sind die obersten zwei Zeilen Wand. */
export function Buehne({ bg, farbe, wand, children, label }: { bg: Hg; farbe: string; wand?: boolean; children?: ReactNode; label: string }) {
  const karte = bg
    ? Array.from({ length: ZEILEN }, (_, y) => Array.from({ length: SPALTEN }, (_, x) =>
        wand && y < 2 ? bg.muster.wand[0] : bodenKachel(bg.muster.boden, x, y)))
    : null;
  return (
    <div className="rounded-lg" role="group" aria-label={label}>
      <Passend breite={SPALTEN * 32} hoehe={ZEILEN * 32}>
      <div className="relative mx-auto overflow-hidden" style={{ width: SPALTEN * 32, height: ZEILEN * 32, background: farbe }}>
        {bg && karte && <Kachelfeld src={bg.src} tile={bg.tile} cols={bg.cols} scale={2} karte={karte} />}
        {children}
      </div>
      </Passend>
    </div>
  );
}

/** Animationen der drei Spielarten (bei reduzierter Bewegung aus). */
export function ModusStil() {
  return (
    <style>{`
      @keyframes ch-wackel{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
      @keyframes ch-boom{0%{transform:scale(1);opacity:1}60%{transform:scale(1.8);opacity:.8}100%{transform:scale(2.4);opacity:0}}
      @keyframes ch-taumel{0%,100%{transform:rotate(0)}30%{transform:rotate(-14deg)}70%{transform:rotate(14deg)}}
      @keyframes ch-bruch{0%{transform:translateY(0);opacity:1}100%{transform:translateY(24px) scaleY(.3);opacity:.2}}
      @keyframes ch-stempel{0%{transform:scale(3) rotate(-14deg);opacity:0}100%{transform:scale(1) rotate(-14deg);opacity:1}}
      .ch-wackel{animation:ch-wackel .5s 2}.ch-boom{animation:ch-boom .9s forwards}.ch-taumel{animation:ch-taumel .6s 2}
      .ch-bruch{animation:ch-bruch .9s forwards}.ch-stempel{animation:ch-stempel .4s forwards}
      @media (prefers-reduced-motion: reduce){.ch-wackel,.ch-boom,.ch-taumel,.ch-bruch,.ch-stempel{animation:none!important}}
    `}</style>
  );
}

export type Ort = { emoji: string; name: string };

/** Sammelphase: je Fakt eine Fundstelle auf der Bühne; »Alles einsammeln« nach 20 s (sofort bei reduzierter Bewegung). */
export default function Sammeln({ fakten, gefunden, onFinde, onAlle, onWeiter, bg, farbe, wand, orte, verb }: {
  fakten: ChallengeFakt[]; gefunden: string[]; onFinde(id: string): void; onAlle(): void; onWeiter(): void;
  bg: Hg; farbe: string; wand?: boolean; orte: Ort[]; verb: string;
}) {
  const [offen, setOffen] = useState<ChallengeFakt | null>(null);
  const [skip, setSkip] = useState(wenigerBewegung());
  useEffect(() => {
    if (skip) return;
    const t = setTimeout(() => setSkip(true), 20000);
    return () => clearTimeout(t);
  }, [skip]);
  const alle = fakten.every((f) => gefunden.includes(f.id));
  const zeilen = Math.max(1, Math.ceil(fakten.length / 6));
  return (
    <div className="flex flex-col gap-3">
      <Buehne bg={bg} farbe={farbe} wand={wand} label="Fundstellen">
        {fakten.map((f, i) => {
          const ort = orte[i % orte.length];
          const da = gefunden.includes(f.id);
          return (
            <button key={f.id} disabled={da} aria-label={`${ort.name} ${verb}`} title={`${ort.name} ${verb}`}
              onClick={() => { onFinde(f.id); setOffen(f); }}
              className="absolute text-3xl leading-none rounded focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
              style={{ left: `${4 + (i % 6) * 15.5 + ((i * 37) % 5)}%`, top: `${24 + Math.floor(i / 6) * (68 / zeilen) + ((i * 53) % 4)}%` }}>
              {da ? "✓" : ort.emoji}
            </button>
          );
        })}
      </Buehne>
      {offen && (
        <div className="card p-3" role="status"><b>Gefunden:</b> <Inhalt x={offen} />{offen.info && <p className="text-muted mt-1">{offen.info.text}</p>}</div>
      )}
      <p className="text-muted">{gefunden.length} von {fakten.length} gefunden</p>
      <div className="flex flex-wrap gap-2">
        {!alle && skip && <button className="btn-secondary" onClick={() => { onAlle(); setOffen(null); }}>Alles einsammeln</button>}
        {alle && <button className="btn-primary" onClick={onWeiter}>Weiter</button>}
      </div>
    </div>
  );
}
