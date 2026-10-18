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
      .dt-noir{position:relative;overflow:hidden;background:radial-gradient(ellipse at 30% 0%,#3a3128,#16130f 70%);color:#eadfc8}
      .dt-noir .text-muted{color:#cbbf9f}
      .dt-schreib{font-family:"Courier New",Courier,monospace;letter-spacing:.02em}
      .dt-regen{position:absolute;inset:-40px 0 0 0;pointer-events:none;opacity:.18;background:repeating-linear-gradient(105deg,transparent 0 14px,#c8d6e5 14px 15px);animation:dt-regen .6s linear infinite}
      @keyframes dt-regen{to{transform:translateY(40px)}}
      .dt-akte{background:#e8dcbf;color:#2b2116;box-shadow:0 6px 14px rgba(0,0,0,.5);border-left:10px solid #b59a64}
      .dt-foto{background:#fbf8f0;color:#2b2116;box-shadow:0 3px 6px rgba(0,0,0,.45);filter:sepia(.45) contrast(1.05)}
      .dt-stempel-fest{opacity:.75}
      .dt-kork{background:#a9764a radial-gradient(#8a5c36 1px,transparent 1.5px) 0 0/9px 9px;box-shadow:inset 0 0 22px rgba(0,0,0,.55);border:10px solid #5b3a22}
      .dt-karte{background:#f4ecd8;color:#2b2116;box-shadow:0 5px 10px rgba(0,0,0,.45);transition:transform .2s}
      .dt-aktiv{transform:rotate(0) scale(1.03);box-shadow:0 0 0 3px #c1121f,0 8px 16px rgba(0,0,0,.5);z-index:1}
      .dt-nadel{position:absolute;left:50%;top:-6px;width:14px;height:14px;margin-left:-7px;border-radius:9999px;background:radial-gradient(circle at 35% 35%,#ff6b6b,#a4161a);box-shadow:0 2px 3px rgba(0,0,0,.5)}
      .dt-zettel{background:#fff3a8;color:#2b2116;box-shadow:0 2px 4px rgba(0,0,0,.4)}
      @media (prefers-reduced-motion: reduce){.dt-blink,.dt-kopf,.dt-tropf,.dt-stempel,.dt-regen{animation:none!important}.dt-karte{transition:none}}
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
