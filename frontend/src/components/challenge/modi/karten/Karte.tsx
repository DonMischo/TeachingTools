"use client";
/** Eine Spielkarte: Rahmen nach Seltenheit (zufällig aus der ID), Icon, Inhalt des Fakts. */
import type { ChallengeFakt } from "@/lib/api";
import { Inhalt } from "../teile";
import { icon, seltenheit } from "./logik";

const RAHMEN = {
  gewoehnlich: "border-line",
  selten: "border-accent",
  episch: "border-warn shadow-lg",
} as const;

export const KARTEN_CSS = `
.kt-fach{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:0.5rem;padding:1.5rem 0.5rem 0.5rem;min-height:11rem}
.kt-fach>*{transition:transform .18s ease;transform-origin:50% 120%}
.kt-fach>*:hover,.kt-fach>*:focus-within{transform:translateY(-1.25rem) rotate(0deg)!important;z-index:5}
.kt-zieh{animation:kt-zieh .35s ease-out both}
@keyframes kt-zieh{from{opacity:0;transform:translate(-6rem,-2rem) scale(.7)}to{opacity:1}}
.kt-zahl{animation:kt-zahl .9s ease-out both}
@keyframes kt-zahl{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-2.5rem)}}
.kt-wackel{animation:kt-wackel .4s}
@keyframes kt-wackel{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.kt-schlag{animation:kt-schlag .5s}
@keyframes kt-schlag{30%{filter:brightness(2);transform:scale(1.08)}}
@media (prefers-reduced-motion: reduce){.kt-zieh,.kt-zahl,.kt-wackel,.kt-schlag{animation:none!important}.kt-fach>*{transition:none!important}}
`;

export default function Karte({ fakt, onClick, disabled, gewaehlt, drehung = 0, klasse = "" }: {
  fakt: ChallengeFakt; onClick?: () => void; disabled?: boolean; gewaehlt?: boolean; drehung?: number; klasse?: string;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={gewaehlt}
      draggable={!disabled} onDragStart={(e) => e.dataTransfer.setData("text/plain", fakt.id)}
      style={{ transform: `rotate(${drehung}deg)` }}
      className={`card relative w-40 min-h-36 shrink-0 p-2 pt-5 text-left text-sm border-2 bg-surface disabled:opacity-60 ${RAHMEN[seltenheit(fakt.id)]} ${gewaehlt ? "ring-2 ring-accent" : ""} ${klasse}`}>
      <span aria-hidden className="absolute -top-3 left-2 rounded-full bg-surface border border-line px-1.5 text-base">{icon(fakt.id)}</span>
      <span aria-hidden className="absolute top-1 right-1.5 text-xs font-bold text-muted">1⚡</span>
      <Inhalt x={fakt} />
    </button>
  );
}

export function Rueckseite() {
  return (
    <div aria-hidden className="card w-40 min-h-36 flex items-center justify-center text-4xl border-2 border-accent bg-accent/20">❓</div>
  );
}
