"use client";
/** Zeichnungen des Glücksrads: Rad, Galgen, Showbühne. Farben als Hex (keine var() in SVG-Attributen). */
import type { ReactNode } from "react";
import { RAD, type Feld } from "@/lib/challenge/gluecksrad";

const SEG = 360 / RAD.length;
const punkt = (r: number, grad: number) => [r * Math.sin((grad * Math.PI) / 180), -r * Math.cos((grad * Math.PI) / 180)];
const FARBEN = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#e9c46a", "#9b5de5"];
const farbe = (f: Feld, i: number) => (f.art === "bankrott" ? "#111111" : f.art === "aussetzen" ? "#8d99ae" : FARBEN[i % FARBEN.length]);
const beschriftung = (f: Feld) => (f.art === "betrag" ? String(f.betrag) : f.art === "bankrott" ? "BANKROTT" : "AUSSETZEN");

/** Mittelpunktswinkel des Feldes i, im Uhrzeigersinn ab oben. */
export const feldMitte = (i: number) => (i + 0.5) * SEG;

export function Rad({ drehung, dauer }: { drehung: number; dauer: number }) {
  return (
    <svg viewBox="-115 -125 230 240" className="w-full max-w-xs mx-auto" role="img" aria-label="Glücksrad">
      <g style={{ transform: `rotate(${drehung}deg)`, transition: dauer ? `transform ${dauer}ms cubic-bezier(.12,.6,.1,1)` : "none", transformOrigin: "0 0" }}>
        {RAD.map((f, i) => {
          const [x1, y1] = punkt(100, i * SEG);
          const [x2, y2] = punkt(100, (i + 1) * SEG);
          return (
            <g key={i}>
              <path d={`M0 0 L${x1} ${y1} A100 100 0 0 1 ${x2} ${y2} Z`} fill={farbe(f, i)} stroke="#ffffff" strokeWidth="1.5" />
              <g transform={`rotate(${feldMitte(i)})`}>
                <text x="0" y="-62" textAnchor="middle" fontSize={f.art === "betrag" ? 12 : 8} fontWeight="800" fill="#ffffff"
                 >{beschriftung(f)}</text>
              </g>
            </g>
          );
        })}
        <circle r="14" fill="#ffd700" stroke="#ffffff" strokeWidth="3" />
      </g>
      <circle r="102" fill="none" stroke="#ffd700" strokeWidth="5" />
      <polygon points="-10,-122 10,-122 0,-98" fill="#ffffff" stroke="#111111" strokeWidth="2" />
    </svg>
  );
}

/** Galgen in 8 Stufen: Boden, Pfosten, Balken, Seil, Kopf, Körper, Arme, Beine. */
export function Galgen({ stufe }: { stufe: number }) {
  const s = "#3b2a1a";
  const m = "#222222";
  return (
    <svg viewBox="0 0 120 130" className="w-28 shrink-0" role="img" aria-label={`Galgen: ${stufe} von 8 Teilen`}>
      {stufe >= 1 && <line x1="10" y1="122" x2="80" y2="122" stroke={s} strokeWidth="6" strokeLinecap="round" />}
      {stufe >= 2 && <line x1="30" y1="122" x2="30" y2="10" stroke={s} strokeWidth="6" strokeLinecap="round" />}
      {stufe >= 3 && <line x1="27" y1="10" x2="85" y2="10" stroke={s} strokeWidth="6" strokeLinecap="round" />}
      {stufe >= 4 && <line x1="85" y1="10" x2="85" y2="28" stroke="#b08a4a" strokeWidth="3" />}
      {stufe >= 5 && <circle cx="85" cy="38" r="10" fill="none" stroke={m} strokeWidth="3" />}
      {stufe >= 6 && <line x1="85" y1="48" x2="85" y2="82" stroke={m} strokeWidth="3" strokeLinecap="round" />}
      {stufe >= 7 && <path d="M65 64 L85 54 L105 64" fill="none" stroke={m} strokeWidth="3" strokeLinecap="round" />}
      {stufe >= 8 && <path d="M68 108 L85 82 L102 108" fill="none" stroke={m} strokeWidth="3" strokeLinecap="round" />}
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
    @media (prefers-reduced-motion: reduce){.gl-licht{animation:none}.gl-kachel>span{transition:none}}
  `}</style>
);
