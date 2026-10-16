"use client";
/** Weiche Vektorfiguren für den Trankladen: Alchemist und vier Kundentypen, mit Stimmung (froh / neutral / unmutig). */
import { useId } from "react";

export type Stimmung = "froh" | "neutral" | "unmutig";
export const KUNDENARTEN = ["ritter", "haendler", "kind", "hexe"] as const;
export type Kundenart = (typeof KUNDENARTEN)[number] | "alchemist";

const LOOK: Record<Kundenart, { robe: string; robe2: string; haut: string; haar: string }> = {
  alchemist: { robe: "#6d4aa8", robe2: "#3f2a6e", haut: "#f1c9a5", haar: "#e9e4dc" },
  ritter: { robe: "#aab4c2", robe2: "#5d6878", haut: "#eebf99", haar: "#7a4a22" },
  haendler: { robe: "#c2873a", robe2: "#7a4b17", haut: "#e3b08a", haar: "#3b2a1c" },
  kind: { robe: "#4ba3a0", robe2: "#2a6664", haut: "#f5d0b0", haar: "#c9792b" },
  hexe: { robe: "#2f6b45", robe2: "#173a26", haut: "#c9dcae", haar: "#231a2e" },
};

function Mund({ s }: { s: Stimmung }) {
  const d = s === "froh" ? "M33 47 Q40 55 47 47" : s === "unmutig" ? "M34 52 Q40 46 46 52" : "M34 50 L46 50";
  return <path d={d} fill={s === "froh" ? "#7a2a2a" : "none"} stroke="#7a2a2a" strokeWidth="2" strokeLinecap="round" />;
}

export default function Figur({ art, stimmung = "neutral", etikett, className = "" }: {
  art: Kundenart; stimmung?: Stimmung; etikett?: string; className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { robe, robe2, haut, haar } = LOOK[art];
  const kind = art === "kind";
  const kopfY = kind ? 40 : 34;
  return (
    <svg viewBox="0 0 80 110" width={kind ? 64 : 72} height={kind ? 88 : 99} role={etikett ? "img" : undefined} aria-label={etikett} aria-hidden={etikett ? undefined : true}
      className={`alch-wippe overflow-visible ${className}`} style={{ animationDelay: `${(id.length * 137) % 900}ms` }}>
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={robe} /><stop offset="1" stopColor={robe2} /></linearGradient>
        <radialGradient id={`${id}h`} cx="0.4" cy="0.35" r="0.8"><stop offset="0" stopColor="#ffffff" stopOpacity="0.35" /><stop offset="1" stopColor={haut} stopOpacity="0" /></radialGradient>
        <filter id={`${id}s`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <ellipse cx="40" cy="106" rx="26" ry="4.5" fill="#000000" opacity="0.28" filter={`url(#${id}s)`} />
      {/* Körper */}
      <path d={kind ? "M18 104 Q18 66 40 64 Q62 66 62 104 Z" : "M12 104 Q12 58 40 56 Q68 58 68 104 Z"} fill={`url(#${id}r)`} />
      {art === "ritter" && <path d="M26 66 Q40 76 54 66 L54 84 Q40 92 26 84 Z" fill="#d9e0ea" opacity="0.75" />}
      {art === "haendler" && <path d="M30 60 L40 100 L50 60 Z" fill="#e9c46a" opacity="0.8" />}
      {art === "alchemist" && <path d="M40 58 L40 104" stroke="#e9c46a" strokeWidth="3" opacity="0.8" />}
      {/* Arme */}
      <ellipse cx={kind ? 22 : 17} cy="88" rx="6" ry="5" fill={haut} /><ellipse cx={kind ? 58 : 63} cy="88" rx="6" ry="5" fill={haut} />
      {/* Bart / Haare hinten */}
      {art === "alchemist" && <path d="M22 44 Q22 80 40 84 Q58 80 58 44 Z" fill={haar} />}
      {art === "hexe" && <path d="M22 40 Q16 74 26 80 L54 80 Q64 74 58 40 Z" fill={haar} />}
      {/* Kopf */}
      <circle cx="40" cy={kopfY + 8} r={kind ? 17 : 15} fill={haut} />
      <circle cx="40" cy={kopfY + 8} r={kind ? 17 : 15} fill={`url(#${id}h)`} />
      {art === "kind" && <path d="M23 38 Q24 20 40 22 Q56 20 57 38 Q48 30 40 33 Q32 30 23 38 Z" fill={haar} />}
      {art === "haendler" && <path d="M25 32 Q40 14 55 32 Q40 26 25 32 Z M22 33 H58" fill="#8e3b46" stroke="#8e3b46" strokeWidth="3" strokeLinecap="round" />}
      {art === "ritter" && <path d="M24 38 Q24 14 40 14 Q56 14 56 38 L50 38 Q50 26 40 26 Q30 26 30 38 Z" fill="#c4ccd8" />}
      {/* Gesicht */}
      <g transform={`translate(0 ${kopfY - 34})`}>
        <circle cx="34" cy="40" r="2.2" fill="#2a1f2e" /><circle cx="46" cy="40" r="2.2" fill="#2a1f2e" />
        <circle cx="34.7" cy="39.3" r="0.7" fill="#ffffff" /><circle cx="46.7" cy="39.3" r="0.7" fill="#ffffff" />
        {stimmung === "unmutig" && <path d="M30 35 L37 37 M50 35 L43 37" stroke="#2a1f2e" strokeWidth="1.6" strokeLinecap="round" />}
        {stimmung === "froh" && <><circle cx="30" cy="46" r="3" fill="#e57f7f" opacity="0.4" /><circle cx="50" cy="46" r="3" fill="#e57f7f" opacity="0.4" /></>}
        <Mund s={stimmung} />
      </g>
      {/* Hüte */}
      {art === "alchemist" && (<g>
        <path d="M20 28 Q40 22 60 28 Q40 32 20 28 Z" fill="#3f2a6e" />
        <path d="M27 28 Q30 4 44 -2 Q42 14 53 28 Z" fill={`url(#${id}r)`} />
        <circle cx="40" cy="22" r="2" fill="#f4d35e" /><circle cx="46" cy="12" r="1.4" fill="#f4d35e" />
      </g>)}
      {art === "hexe" && (<g>
        <ellipse cx="40" cy="27" rx="25" ry="5" fill="#231a2e" />
        <path d="M28 27 Q34 6 46 -2 Q44 14 52 27 Z" fill="#231a2e" />
        <rect x="30" y="20" width="22" height="4" fill="#b26ad8" />
      </g>)}
    </svg>
  );
}
