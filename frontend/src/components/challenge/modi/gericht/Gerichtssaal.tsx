"use client";
/** Gerichtssaal als Zeichnung: Richterpult mit Richter und Hammer, Zeugenstand, Geschworenenbank,
    vorn die Tische von Verteidigung (du) und Anklage. Stimmungen kommen von außen. */
import type { CSSProperties } from "react";

type Mund = "laecheln" | "neutral" | "o" | "wellig" | "boese";
type Person = { x: number; y: number; haut: string; haar: string; kleid: string; mund?: Mund; xAugen?: boolean; boeseBrauen?: boolean; s?: number };

const HOLZ = "#5a3820", HOLZ_HELL = "#7a4f2c", KANTE = "#8b5e34", GOLD = "#c9a227";
const ZENTRUM: CSSProperties = { transformBox: "fill-box", transformOrigin: "center bottom" };

function Figur({ x, y, haut, haar, kleid, mund = "neutral", xAugen, boeseBrauen, s = 1 }: Person) {
  const m = {
    laecheln: <path d="M-5 5 Q0 9 5 5" />, neutral: <path d="M-4 6 H4" />, o: <circle cx={0} cy={6} r={2.5} fill="#3b1f12" />,
    wellig: <path d="M-6 6 l3 -2 l3 2 l3 -2 l3 2" />, boese: <path d="M-5 8 Q0 3 5 8" />,
  }[mund];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-22 44 Q-22 16 0 16 Q22 16 22 44 Z" fill={kleid} />
      <circle r={14} fill={haut} />
      <path d="M-14 -2 Q-14 -16 0 -16 Q14 -16 14 -2 Q8 -9 0 -9 Q-8 -9 -14 -2 Z" fill={haar} />
      <g stroke="#3b1f12" strokeWidth={1.6} fill="none" strokeLinecap="round">
        {xAugen ? (
          <><path d="M-7 -3 l4 4 M-3 -3 l-4 4" /><path d="M3 -3 l4 4 M7 -3 l-4 4" /></>
        ) : (
          <><circle cx={-5} cy={-1} r={1.4} fill="#3b1f12" /><circle cx={5} cy={-1} r={1.4} fill="#3b1f12" /></>
        )}
        {boeseBrauen && <path d="M-9 -7 L-2 -4 M9 -7 L2 -4" />}
        {m}
      </g>
    </g>
  );
}

function Schild({ x, y, text, b = 96 }: { x: number; y: number; text: string; b?: number }) {
  return (
    <g>
      <rect x={x - b / 2} y={y} width={b} height={15} rx={2} fill={GOLD} stroke="#7a5a12" />
      <text x={x} y={y + 11} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#3b2a08" letterSpacing={1}>{text}</text>
    </g>
  );
}

/** Ein Tisch von vorn gesehen, mit Person dahinter (Rückansicht). */
function Tisch({ x, kleid, haar, text }: { x: number; kleid: string; haar: string; text: string }) {
  return (
    <g>
      <path d={`M${x - 26} 300 Q${x - 26} 262 ${x} 262 Q${x + 26} 262 ${x + 26} 300 Z`} fill={kleid} />
      <circle cx={x} cy={252} r={15} fill={haar} />
      <rect x={x - 90} y={282} width={180} height={12} fill={KANTE} />
      <rect x={x - 84} y={294} width={168} height={30} fill={HOLZ} />
      <rect x={x - 30} y={276} width={22} height={7} fill="#fff" stroke="#bbb" transform={`rotate(-8 ${x - 19} 279)`} />
      <Schild x={x} y={302} text={text} b={130} />
    </g>
  );
}

const JURY: Omit<Person, "mund">[] = [
  { x: 482, y: 118, haut: "#f1c27d", haar: "#4a3020", kleid: "#7b8f5a", s: 0.8 },
  { x: 526, y: 116, haut: "#8d5524", haar: "#1b1b1b", kleid: "#a14d4d", s: 0.8 },
  { x: 570, y: 118, haut: "#ffdbac", haar: "#d9b26a", kleid: "#4d6da1", s: 0.8 },
  { x: 462, y: 142, haut: "#c68642", haar: "#2b1a10", kleid: "#8a6aa8", s: 0.85 },
  { x: 508, y: 144, haut: "#ffdbac", haar: "#9b9b9b", kleid: "#c48a3a", s: 0.85 },
  { x: 554, y: 142, haut: "#e0ac69", haar: "#5c2e12", kleid: "#3f8a7a", s: 0.85 },
];

export function Gerichtssaal({ zeuge, richterBoese, hammer, jury }: {
  /** 0 selbstsicher · 1 schwitzt · 2 zittert · 3 bricht zusammen */
  zeuge: 0 | 1 | 2 | 3;
  richterBoese: boolean;
  hammer: boolean;
  jury: "ruhig" | "staunen" | "kopfschuetteln";
}) {
  const zeugenMund: Mund = (["laecheln", "neutral", "wellig", "o"] as const)[zeuge];
  return (
    <svg viewBox="0 -26 640 356" className="w-full h-auto block rounded-lg border-2 border-line" role="img"
      aria-label="Gerichtssaal: Richter am Pult, Zeuge im Zeugenstand, Geschworene auf ihrer Bank, vorn Verteidigung und Anklage">
      {/* Wand, Täfelung, Säulen */}
      <rect y={-26} width={640} height={236} fill="#8b6542" />
      <rect y={120} width={640} height={90} fill={HOLZ_HELL} />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={8 + i * 64} y={130} width={52} height={70} fill="none" stroke={HOLZ} strokeWidth={2} />)}
      {[150, 490].map((x) => <rect key={x} x={x} y={-26} width={18} height={236} fill={KANTE} stroke={HOLZ} />)}
      {/* Wappen mit Waage */}
      <g transform="translate(320 4)">
        <circle r={27} fill={GOLD} stroke="#7a5a12" strokeWidth={3} />
        <g stroke="#3b2a08" strokeWidth={2} fill="none">
          <path d="M0 -16 V14 M-14 -8 H14 M-8 14 H8" />
          <path d="M-14 -8 L-19 4 M-14 -8 L-9 4 M14 -8 L9 4 M14 -8 L19 4" />
          <path d="M-20 4 Q-14 10 -8 4 M8 4 Q14 10 20 4" />
        </g>
      </g>
      {/* Boden */}
      <rect y={210} width={640} height={120} fill="#a0703f" />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i * 60 - 40} 330 L${i * 60 + 20} 210`} stroke="#8a5d33" strokeWidth={2} />)}

      {/* Richter hinter dem Pult */}
      <g className={richterBoese ? "gr-zittern" : undefined}>
        <path d="M282 112 Q282 78 320 78 Q358 78 358 112 Z" fill="#1f1f2e" />
        <path d="M312 80 L320 98 L328 80 Z" fill="#fff" />
        <g transform="translate(320 60)">
          <ellipse cx={-14} cy={4} rx={6} ry={10} fill="#e5e5e5" /><ellipse cx={14} cy={4} rx={6} ry={10} fill="#e5e5e5" />
        </g>
        <Figur x={320} y={60} haut="#f1c27d" haar="#e5e5e5" kleid="transparent" mund={richterBoese ? "boese" : "neutral"} boeseBrauen={richterBoese} s={1.05} />
      </g>
      <rect x={206} y={104} width={228} height={11} fill={KANTE} />
      <rect x={216} y={115} width={208} height={95} fill={HOLZ} />
      {[232, 330].map((x) => <rect key={x} x={x} y={126} width={78} height={70} fill="none" stroke={HOLZ_HELL} strokeWidth={3} />)}
      <Schild x={320} y={180} text="RICHTER" />
      {/* Hammer und Klangblock */}
      <rect x={364} y={99} width={22} height={6} rx={2} fill="#3b2412" />
      <g className={hammer ? "gr-hammer" : undefined} style={{ transformBox: "view-box", transformOrigin: "350px 100px", transform: hammer ? undefined : "rotate(-40deg)" }}>
        <path d="M350 100 L378 92" stroke="#3b2412" strokeWidth={4} strokeLinecap="round" />
        <rect x={372} y={82} width={12} height={22} rx={3} fill="#4a2d18" transform="rotate(-16 378 93)" />
      </g>
      {hammer && <text x={398} y={92} fontSize={18} fontWeight={900} fill="#fff" stroke="#3b1f12" strokeWidth={1}>TOCK!</text>}

      {/* Zeugenstand */}
      <g className={zeuge === 2 ? "gr-zittern" : undefined}>
        <g style={{ ...ZENTRUM, transform: zeuge === 3 ? "rotate(-14deg)" : undefined, transition: "transform .4s" }}>
          <Figur x={104} y={122} haut="#ffdbac" haar="#6b3e1f" kleid="#6c7a3a" mund={zeugenMund} xAugen={zeuge === 3} />
        </g>
        {zeuge === 1 && <path className="gr-tropf" d="M122 104 q4 7 0 10 q-4 -3 0 -10 Z" fill="#7ec8f0" />}
        {zeuge >= 2 && <path d="M86 104 q-4 7 0 10 q4 -3 0 -10 Z M124 100 q4 7 0 10 q-4 -3 0 -10 Z" fill="#7ec8f0" />}
      </g>
      <rect x={42} y={152} width={124} height={8} fill={KANTE} />
      <rect x={48} y={160} width={112} height={56} fill={HOLZ} />
      <rect x={58} y={168} width={92} height={40} fill="none" stroke={HOLZ_HELL} strokeWidth={3} />
      <Schild x={104} y={218} text="ZEUGENSTAND" b={104} />

      {/* Geschworenenbank */}
      {JURY.map((p, i) => {
        const mund: Mund = jury === "staunen" ? "o" : jury === "kopfschuetteln" ? "boese" : i % 2 ? "neutral" : "laecheln";
        return (
          <g key={i} className={jury === "kopfschuetteln" ? "gr-kopf" : undefined} style={{ ...ZENTRUM, animationDelay: `${i * 0.08}s` }}>
            <Figur {...p} mund={mund} />
            {jury === "staunen" && <text x={p.x + 10} y={p.y - 16} fontSize={14} fontWeight={900} fill="#fff" stroke="#3b1f12" strokeWidth={0.8}>!</text>}
          </g>
        );
      })}
      <rect x={436} y={160} width={186} height={8} fill={KANTE} />
      <rect x={442} y={168} width={174} height={48} fill={HOLZ} />
      {[452, 534].map((x) => <rect key={x} x={x} y={174} width={72} height={36} fill="none" stroke={HOLZ_HELL} strokeWidth={3} />)}
      <Schild x={529} y={218} text="GESCHWORENE" b={110} />

      {/* Vorn: Verteidigung (du) und Anklage */}
      <Tisch x={150} kleid="#2f5fa8" haar="#3b2412" text="VERTEIDIGUNG · DU" />
      <Tisch x={490} kleid="#9c2b2b" haar="#1b1b1b" text="ANKLAGE" />
    </svg>
  );
}
