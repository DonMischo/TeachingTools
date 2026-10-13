"use client";
/** Kleinkram des Detektiv-Modus: Stil, Skizzen, Verdächtige, Spielwert-Meldung. */
import { useEffect, useRef, useState } from "react";
import type { ChallengeLauf } from "@/lib/challenge/useChallengeLauf";

export const wenigerBewegung = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && !!window.matchMedia("(prefers-reduced-motion: reduce)")?.matches;

export function DetektivStil() {
  return (
    <style>{`
      @keyframes dt-blink{0%,100%{transform:scale(1);filter:drop-shadow(0 0 0 #ffe27a)}50%{transform:scale(1.25);filter:drop-shadow(0 0 6px #ffe27a)}}
      @keyframes dt-kopf{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}60%{transform:translateX(7px)}}
      @keyframes dt-tropf{0%{transform:translateY(0);opacity:1}100%{transform:translateY(22px);opacity:0}}
      @keyframes dt-stempel{0%{transform:scale(3.2) rotate(-16deg);opacity:0}100%{transform:scale(1) rotate(-12deg);opacity:1}}
      .dt-blink{animation:dt-blink 1.2s infinite}.dt-kopf{animation:dt-kopf .6s 2}.dt-tropf{animation:dt-tropf .9s infinite}.dt-stempel{animation:dt-stempel .45s forwards}
      @media (prefers-reduced-motion: reduce){.dt-blink,.dt-kopf,.dt-tropf,.dt-stempel{animation:none!important}}
    `}</style>
  );
}

const SKIZZEN = ["🔑", "🧤", "👣", "🧪", "📜", "🕯️", "🪞", "🧵", "✂️", "🔦", "🧩", "🗝️"];
/** Zufällige (von der Fakt-id abhängige) Skizze fürs Notizbuch; verrät nichts über die Lösung. */
export function skizzeVon(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SKIZZEN[h % SKIZZEN.length];
}

export const VERDAECHTIGE = [
  { npc: "townsfolk_m", name: "Herr Brandt" }, { npc: "townsfolk_f", name: "Frau Keller" }, { npc: "merchant", name: "Händler Voss" },
  { npc: "mage", name: "Magister Lenz" }, { npc: "alchemist", name: "Dr. Siedler" }, { npc: "king", name: "Baron Falk" },
];

/** Porträt aus den NPC-Einzelbildern (idle_1..4); wippt, solange der Tab sichtbar ist. */
export function Portrait({ npc, scale = 3, className, label }: { npc: string; scale?: number; className?: string; label?: string }) {
  const [i, setI] = useState(1);
  useEffect(() => {
    if (wenigerBewegung()) return;
    const t = setInterval(() => { if (!document.hidden) setI((n) => (n % 4) + 1); }, 300);
    return () => clearInterval(t);
  }, []);
  return (
    <img src={`/challenge/pixel/npcs/${npc}_idle_${i}.png`} alt={label ?? ""} draggable={false} className={className}
      style={{ width: 32 * scale, height: 32 * scale, imageRendering: "pixelated", maxWidth: "none" }} />
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
