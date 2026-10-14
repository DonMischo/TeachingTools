"use client";
/** Kleinkram des Detektiv-Modus: Stil, Skizzen, Verdächtige. */
import { hashText } from "@/lib/challenge/zufall";

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
  return SKIZZEN[hashText(id) % SKIZZEN.length];
}

export const VERDAECHTIGE = [
  { npc: "townsfolk_m", name: "Herr Brandt" }, { npc: "townsfolk_f", name: "Frau Keller" }, { npc: "merchant", name: "Händler Voss" },
  { npc: "mage", name: "Magister Lenz" }, { npc: "alchemist", name: "Dr. Siedler" }, { npc: "king", name: "Baron Falk" },
];
