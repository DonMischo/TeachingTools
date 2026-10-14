"use client";
/** Feste Bühne 448×256 (14×8 Kacheln, Maßstab 2) aus dem Theme-Kachelfeld; mit `wand` sind die obersten zwei Zeilen Wand. */
import type { ReactNode } from "react";
import type { ThemeDef } from "@/lib/challenge/themes";
import { bodenKachel } from "@/lib/challenge/themes";
import { Kachelfeld } from "./Sprite";
import { Passend } from "./Passend";

const SPALTEN = 14;
const ZEILEN = 8;

export function Buehne({ bg, farbe, wand, children, label, className }: {
  bg: ThemeDef["hintergrund"]; farbe: string; wand?: boolean; children?: ReactNode; label: string; className?: string;
}) {
  const karte = bg
    ? Array.from({ length: ZEILEN }, (_, y) => Array.from({ length: SPALTEN }, (_, x) => (wand && y < 2 ? bg.muster.wand[0] : bodenKachel(bg.muster.boden, x, y))))
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
