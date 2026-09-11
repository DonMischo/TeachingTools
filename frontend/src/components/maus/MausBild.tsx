"use client";
/**
 * Die Maus als Bild — mit Ohren, Gesicht und Kabel als Schwanz.
 *
 * Die gedrückte Taste leuchtet: kurz für einen Klick, zweimal für den
 * Doppelklick, dauerhaft beim Ziehen. So sieht ein Kind in der Vorführung,
 * *welche* Taste gemeint ist, bevor es sie selbst sucht.
 */
export type MausTaste = "links" | "rechts" | "doppel" | "halten" | null;

const KOERPER = "M50 24 C24 24 16 46 16 70 L16 100 C16 124 31 136 50 136 C69 136 84 124 84 100 L84 70 C84 46 76 24 50 24 Z";
const LINKS = "M50 24 C24 24 16 46 16 64 L49 64 L49 24 Z";
const RECHTS = "M50 24 C76 24 84 46 84 64 L51 64 L51 24 Z";

export function MausBild({ taste = null, groesse = 72 }: { taste?: MausTaste; groesse?: number }) {
  const linksAn = taste === "links" || taste === "doppel" || taste === "halten";
  const animation = taste === "doppel" ? "maus-doppel" : taste === "halten" ? "" : "maus-druck";
  return (
    <svg
      viewBox="0 0 100 140"
      width={groesse}
      height={(groesse * 140) / 100}
      role="img"
      aria-label={
        taste === "rechts" ? "Maus: rechte Taste" :
        taste === "doppel" ? "Maus: linke Taste zweimal" :
        taste === "halten" ? "Maus: linke Taste festhalten" :
        taste === "links" ? "Maus: linke Taste" : "Maus"
      }
      data-taste={taste ?? undefined}
    >
      {/* Kabel als Schwanz */}
      <path d="M50 24 C50 10 60 4 70 8 S86 22 94 8" fill="none" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" />
      {/* Ohren */}
      <circle cx="22" cy="34" r="13" fill="#d1d5db" stroke="#6b7280" strokeWidth="2" />
      <circle cx="22" cy="34" r="7" fill="#fbcfe8" />
      <circle cx="78" cy="34" r="13" fill="#d1d5db" stroke="#6b7280" strokeWidth="2" />
      <circle cx="78" cy="34" r="7" fill="#fbcfe8" />
      {/* Körper */}
      <path d={KOERPER} fill="#f3f4f6" stroke="#6b7280" strokeWidth="2.5" />
      {/* Tasten */}
      {/* var() wirkt nur im style, nicht im fill-Attribut. */}
      <path d={LINKS} style={{ fill: linksAn ? "var(--accent, #3b82f6)" : "#e5e7eb" }} className={linksAn ? animation : ""} />
      <path d={RECHTS} style={{ fill: taste === "rechts" ? "var(--accent, #3b82f6)" : "#e5e7eb" }} className={taste === "rechts" ? "maus-druck" : ""} />
      <line x1="50" y1="24" x2="50" y2="64" stroke="#6b7280" strokeWidth="2" />
      <line x1="16" y1="64" x2="84" y2="64" stroke="#6b7280" strokeWidth="2" />
      <rect x="45.5" y="34" width="9" height="18" rx="4.5" fill="#9ca3af" />
      {/* Gesicht */}
      <circle cx="38" cy="88" r="4.5" fill="#374151" />
      <circle cx="62" cy="88" r="4.5" fill="#374151" />
      <circle cx="39.5" cy="86.5" r="1.4" fill="#fff" />
      <circle cx="63.5" cy="86.5" r="1.4" fill="#fff" />
      <ellipse cx="29" cy="101" rx="6" ry="3.5" fill="#fbcfe8" />
      <ellipse cx="71" cy="101" rx="6" ry="3.5" fill="#fbcfe8" />
      <path d="M44 100 Q50 107 56 100" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Die Animationen des ganzen Werkzeugs an einer Stelle. */
export function MausStile() {
  return (
    <style>{`
      @keyframes maus-druck { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
      @keyframes maus-doppel { 0%,20%,40%,100% { opacity: 1 } 10%,30% { opacity: .2 } }
      @keyframes maus-blinken { 0%,100% { box-shadow: 0 0 0 0 var(--accent); transform: scale(1) } 50% { box-shadow: 0 0 0 8px transparent; transform: scale(1.08) } }
      @keyframes maus-welle { from { transform: translate(-50%,-50%) scale(.2); opacity: .9 } to { transform: translate(-50%,-50%) scale(1.6); opacity: 0 } }
      @keyframes maus-wackeln { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) } }
      .maus-druck { animation: maus-druck .7s ease-in-out infinite; }
      .maus-doppel { animation: maus-doppel 1.2s ease-in-out infinite; }
      .maus-blinken { animation: maus-blinken .8s ease-in-out infinite; }
      .maus-wackeln { animation: maus-wackeln .3s ease-in-out 2; }
      @keyframes maus-aufleuchten { from { background: color-mix(in srgb, var(--accent) 35%, transparent) } to { background: transparent } }
      .maus-aufleuchten { animation: maus-aufleuchten 1.2s ease-out 1; }
      @media (prefers-reduced-motion: reduce) {
        .maus-druck, .maus-doppel, .maus-blinken, .maus-wackeln { animation-duration: 2s; }
      }
    `}</style>
  );
}
