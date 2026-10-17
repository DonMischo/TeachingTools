"use client";
/** Zeichnungen des Glücksrads: Galgen, Showbühne, Moderator. Farben als Hex (keine var() in SVG-Attributen). */
import type { ReactNode } from "react";
import { GALGEN_MAX } from "@/lib/challenge/gluecksrad";

/** Galgen in 6 Stufen (zwei je verlorenem Leben): Gerüst, Seil, Kopf, Körper, Arme, Beine – groß und hell auf der dunklen Bühne. */
export function Galgen({ stufe }: { stufe: number }) {
  const holz = "#e9c46a";
  const figur = "#ffffff";
  const neu = (n: number) => (n === stufe ? "gl-neu" : undefined);
  const voll = stufe >= GALGEN_MAX;
  return (
    <svg viewBox="0 0 120 140" className={`w-36 sm:w-48 shrink-0 ${voll ? "gl-wackel" : ""}`} role="img" aria-label={`Galgen: ${stufe} von ${GALGEN_MAX} Teilen`}>
      <rect x="0" y="0" width="120" height="140" rx="10" fill="#0d0a2b" opacity="0.6" />
      <g stroke={holz} strokeWidth="7" strokeLinecap="round" opacity={stufe >= 1 ? 1 : 0.12} className={neu(1)}>
        <line x1="12" y1="130" x2="88" y2="130" /><line x1="32" y1="130" x2="32" y2="12" /><line x1="29" y1="12" x2="88" y2="12" />
        <line x1="32" y1="34" x2="52" y2="12" strokeWidth="5" />
      </g>
      {stufe >= 2 && <line x1="88" y1="12" x2="88" y2="32" stroke="#c99a5b" strokeWidth="4" className={neu(2)} />}
      {stufe >= 3 && <g className={neu(3)}>
        <circle cx="88" cy="44" r="12" fill="none" stroke={figur} strokeWidth="4.5" />
        {voll ? <g stroke="#e63946" strokeWidth="2.5"><path d="M81 39 l5 5 M86 39 l-5 5 M90 39 l5 5 M95 39 l-5 5" /><path d="M82 51 q6 -4 12 0" fill="none" /></g>
          : <g fill={figur}><circle cx="84" cy="42" r="1.6" /><circle cx="92" cy="42" r="1.6" /></g>}
      </g>}
      {stufe >= 4 && <line x1="88" y1="56" x2="88" y2="94" stroke={figur} strokeWidth="4.5" strokeLinecap="round" className={neu(4)} />}
      {stufe >= 5 && <path d="M68 74 L88 62 L108 74" fill="none" stroke={figur} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className={neu(5)} />}
      {stufe >= 6 && <path d="M72 122 L88 94 L104 122" fill="none" stroke={figur} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className={neu(6)} />}
    </svg>
  );
}

/** Showbühne: Lichterkette und Moderationspult. */
export function Buehne({ children }: { children: ReactNode }) {
  return (
    <div className="gl-buehne rounded-xl p-3 flex flex-col gap-3">
      <div className="flex justify-around" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => <span key={i} className="gl-licht" style={{ animationDelay: `${(i % 4) * 0.25}s` }} />)}
      </div>
      {children}
    </div>
  );
}

export function Moderator() {
  return (
    <svg viewBox="0 0 90 90" className="w-20 shrink-0" role="img" aria-label="Moderator am Pult">
      <circle cx="45" cy="22" r="13" fill="#f2c9a0" />
      <path d="M32 18 Q45 2 58 18 Q45 10 32 18Z" fill="#3b2a1a" />
      <rect x="27" y="35" width="36" height="30" rx="8" fill="#1d3557" />
      <polygon points="45,35 40,48 50,48" fill="#ffffff" />
      <rect x="10" y="58" width="70" height="30" rx="4" fill="#7b2d26" stroke="#ffd700" strokeWidth="2" />
      <text x="45" y="78" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ffd700">GLÜCK</text>
    </svg>
  );
}

export const GluecksradStil = () => (
  <style>{`
    .gl-buehne{background:linear-gradient(#1b1464,#3a1c71);color:#fff}
    .gl-licht{width:10px;height:10px;border-radius:9999px;background:#ffe14a;box-shadow:0 0 8px #ffe14a;animation:gl-blink 1s infinite alternate}
    @keyframes gl-blink{from{opacity:.35}to{opacity:1}}
    .gl-wort{display:flex;gap:4px;flex-wrap:nowrap}
    .gl-kachel{width:2rem;height:2.6rem;perspective:200px;position:relative}
    .gl-kachel>span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:4px;font-weight:800;font-size:1.25rem;backface-visibility:hidden;transition:transform .5s}
    .gl-vorn{background:#f8f8f0;color:#111;transform:rotateY(180deg)}
    .gl-hinten{background:#0b8a4a;border:2px solid #fff;transform:rotateY(0)}
    .gl-kachel[data-offen="false"]>.gl-vorn{transform:rotateY(180deg)}
    .gl-kachel[data-offen="true"]>.gl-vorn{transform:rotateY(0)}
    .gl-kachel[data-offen="true"]>.gl-hinten{transform:rotateY(-180deg)}
    .gl-sonder{width:1.2rem;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.25rem;color:#fff}
    .gl-neu{animation:gl-pop .6s ease-out;transform-box:fill-box;transform-origin:center}
    @keyframes gl-pop{0%{opacity:0;transform:scale(1.6)}60%{opacity:1;stroke:#e63946}100%{transform:scale(1)}}
    .gl-wackel{animation:gl-wackel .5s 2}
    @keyframes gl-wackel{0%,100%{transform:rotate(0)}25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}
    @media (prefers-reduced-motion: reduce){.gl-licht,.gl-neu,.gl-wackel{animation:none}.gl-kachel>span{transition:none}}
  `}</style>
);
