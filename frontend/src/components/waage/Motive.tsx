"use client";
/**
 * Motive für den Zahlenmodus: statt Klötzchen liegen Alltagsdinge in der
 * Schale — Streichhölzer und Schachteln, Gummibärchen und Tüten, Murmeln und
 * Säckchen, Münzen und Geldbeutel. Das x ist immer der Behälter mit unbekanntem Inhalt, die 1 ein
 * einzelnes Stück. Minus ist eine Feder, die die Schale nach oben zieht.
 *
 * Jede Form zeichnet sich in ihr Kästchen (0,0)–(w,h); die Klötzchen selbst
 * zeichnet ZahlenModus.
 */
import { MINUS } from "@/lib/gleichung";

export const MOTIVE = [
  { id: "kloetze", icon: "🧱", label: "Klötzchen", x: "x-Kiste (unbekannt)", one: "1er-Gewicht" },
  { id: "hoelzer", icon: "🔥", label: "Streichhölzer", x: "Schachtel (x Hölzer)", one: "Streichholz" },
  { id: "gummi", icon: "🧸", label: "Gummibärchen", x: "Tüte (x Bärchen)", one: "Gummibärchen" },
  { id: "murmeln", icon: "🔮", label: "Murmeln", x: "Säckchen (x Murmeln)", one: "Murmel" },
  { id: "muenzen", icon: "🪙", label: "Münzen", x: "Geldbeutel (x Euro)", one: "1-€-Münze" },
] as const;

export type MotivId = (typeof MOTIVE)[number]["id"];

const SIZES: Record<Exclude<MotivId, "kloetze">, { x: [number, number]; n: [number, number]; tint: string }> = {
  hoelzer: { x: [58, 32], n: [44, 10], tint: "#b7874a" },
  gummi: { x: [44, 52], n: [22, 28], tint: "#ef4444" },
  murmeln: { x: [46, 50], n: [24, 24], tint: "#0284c7" },
  muenzen: { x: [52, 42], n: [28, 28], tint: "#d97706" },
};

/** Größe eines Teils; `null` ⇒ Klötzchen (die kennt ZahlenModus). */
export function motivSize(motiv: MotivId, kind: "x" | "n", neg: boolean): { w: number; h: number } | null {
  if (motiv === "kloetze") return null;
  if (neg) return kind === "x" ? { w: 32, h: 56 } : { w: 24, h: 44 };
  const [w, h] = SIZES[motiv][kind];
  return { w, h };
}

export const MOTIV_DEFS = (
  <>
    <radialGradient id="gwMarble" cx="0.35" cy="0.35" r="0.7">
      <stop offset="0" stopColor="#e0f2fe" />
      <stop offset="0.45" stopColor="#38bdf8" />
      <stop offset="1" stopColor="#075985" />
    </radialGradient>
    <radialGradient id="gwCoin" cx="0.38" cy="0.35" r="0.7">
      <stop offset="0" stopColor="#fef3c7" />
      <stop offset="0.55" stopColor="#fbbf24" />
      <stop offset="1" stopColor="#b45309" />
    </radialGradient>
  </>
);

const xText = (x: number, y: number, t: string, size = 16) => (
  <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight={800}
    fontStyle={t === "x" ? "italic" : "normal"} fill="#ffffff">{t}</text>
);

function Streichholz() {
  return (
    <g>
      <rect x={0} y={3} width={35} height={4} rx={1} fill="#f1d39b" stroke="#b7874a" strokeWidth={0.8} />
      <ellipse cx={37.5} cy={5} rx={6} ry={4.6} fill="#dc2626" stroke="#7f1d1d" strokeWidth={0.8} />
      <ellipse cx={36} cy={3.4} rx={2} ry={1.1} fill="#ffffff" opacity={0.5} />
    </g>
  );
}

function Schachtel({ t }: { t: string }) {
  return (
    <g>
      <rect x={4} y={0} width={24} height={8} rx={1.5} fill="#e9c48a" stroke="#a16207" strokeWidth={0.8} />
      {[9, 15, 21].map(x => <circle key={x} cx={x} cy={3.2} r={2.4} fill="#dc2626" />)}
      <rect x={0} y={5} width={58} height={27} rx={3} fill="#1d4ed8" stroke="#1e3a8a" strokeWidth={1} />
      <rect x={0} y={27} width={58} height={5} rx={2} fill="#7c2d12" />
      <rect x={9} y={9} width={40} height={16} rx={2} fill="#fef3c7" />
      <text x={29} y={17.5} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={800}
        fontStyle={t === "x" ? "italic" : "normal"} fill="#6d28d9">{t}</text>
    </g>
  );
}

const BAER_FARBEN = ["#ef4444", "#22c55e", "#facc15", "#f97316", "#f1f5f9", "#dc2626"];

function Gummibaer({ v }: { v: number }) {
  const c = BAER_FARBEN[v % BAER_FARBEN.length];
  return (
    <g fill={c} stroke="#00000040" strokeWidth={0.8} opacity={0.92}>
      <circle cx={6} cy={2.8} r={2.4} />
      <circle cx={16} cy={2.8} r={2.4} />
      <ellipse cx={4} cy={14} rx={2.6} ry={3.6} />
      <ellipse cx={18} cy={14} rx={2.6} ry={3.6} />
      <ellipse cx={6.5} cy={25} rx={3.2} ry={2.8} />
      <ellipse cx={15.5} cy={25} rx={3.2} ry={2.8} />
      <ellipse cx={11} cy={18} rx={7} ry={8} />
      <circle cx={11} cy={7} r={6} />
      <ellipse cx={8.5} cy={15} rx={2} ry={3} fill="#ffffff" stroke="none" opacity={0.35} />
    </g>
  );
}

function Tuete({ t }: { t: string }) {
  return (
    <g>
      <path d="M 4 10 L 40 10 L 38 50 Q 22 53 6 50 Z" fill="#ec4899" stroke="#9d174d" strokeWidth={1.2} />
      <path d="M 2 11 L 2 3 L 7 0 L 12 3 L 17 0 L 22 3 L 27 0 L 32 3 L 37 0 L 42 3 L 42 11 Z"
        fill="#f9a8d4" stroke="#9d174d" strokeWidth={1} />
      <path d="M 8 16 L 36 16" stroke="#ffffff" strokeWidth={1.4} opacity={0.5} />
      <circle cx={22} cy={33} r={10} fill="#facc15" stroke="#a16207" strokeWidth={1} />
      <text x={22} y={33.5} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={800}
        fontStyle={t === "x" ? "italic" : "normal"} fill="#7c2d12">{t}</text>
    </g>
  );
}

function Murmel() {
  return (
    <g>
      <circle cx={12} cy={12} r={11} fill="url(#gwMarble)" stroke="#0c4a6e" strokeWidth={1} />
      <path d="M 5 14 Q 10 6 17 10 Q 20 13 16 18" fill="none" stroke="#ffffff" strokeWidth={1.6} opacity={0.55} />
      <ellipse cx={8} cy={7} rx={3} ry={2} fill="#ffffff" opacity={0.75} />
    </g>
  );
}

function Saeckchen({ t }: { t: string }) {
  return (
    <g>
      <path d="M 12 16 Q 2 30 5 44 Q 8 50 23 50 Q 38 50 41 44 Q 44 30 34 16 Z"
        fill="#c08a4d" stroke="#7c4a1e" strokeWidth={1.2} />
      <path d="M 15 17 Q 23 21 31 17 L 29 9 Q 23 6 17 9 Z" fill="#b07a40" stroke="#7c4a1e" strokeWidth={1} />
      <path d="M 16 8 L 11 1 M 23 7 L 23 0 M 30 8 L 35 1" stroke="#7c4a1e" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M 14 15 Q 23 19 32 15" fill="none" stroke="#fde68a" strokeWidth={2} />
      {xText(23, 34, t, 18)}
    </g>
  );
}

function Muenze({ t }: { t: string }) {
  return (
    <g>
      <circle cx={14} cy={14} r={13} fill="url(#gwCoin)" stroke="#92400e" strokeWidth={1} />
      <circle cx={14} cy={14} r={9.5} fill="none" stroke="#b45309" strokeWidth={1} />
      <text x={14} y={14.5} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800}
        fill="#78350f">{t}</text>
    </g>
  );
}

function Geldbeutel({ t }: { t: string }) {
  return (
    <g>
      <rect x={2} y={12} width={48} height={30} rx={9} fill="#9a3412" stroke="#431407" strokeWidth={1.2} />
      <path d="M 7 15 Q 26 3 45 15" fill="none" stroke="#fbbf24" strokeWidth={3} />
      <circle cx={22} cy={8} r={3.5} fill="#fbbf24" stroke="#92400e" strokeWidth={0.8} />
      <circle cx={30} cy={8} r={3.5} fill="#fbbf24" stroke="#92400e" strokeWidth={0.8} />
      {xText(26, 29, t, 18)}
    </g>
  );
}

/** Minus: eine Feder, unten an der Schale eingehakt, zieht nach oben. */
export function Feder({ w, h, text, color }: { w: number; h: number; text: string; color: string }) {
  const cx = w / 2;
  const top = 10;
  const bot = h - 5;
  const amp = Math.min(w * 0.36, 10);
  const turns = 7;
  let d = `M ${cx} ${h - 2} L ${cx} ${bot}`;
  for (let i = 1; i <= turns; i++) {
    const y = bot - ((bot - top) * i) / turns;
    d += ` L ${i === turns ? cx : cx + (i % 2 ? amp : -amp)} ${y}`;
  }
  d += ` L ${cx} 7`;
  const tw = Math.max(w - 2, text.length * 7.5 + 6);
  return (
    <g>
      <path d={d} fill="none" stroke="#64748b" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={cx} cy={h - 2} r={2.2} fill="#64748b" />
      <polygon points={`${cx},0 ${cx - 5},8 ${cx + 5},8`} fill={color} />
      <rect x={cx - tw / 2} y={h * 0.5 - 8} width={tw} height={16} rx={5} fill={color} stroke="#00000033" />
      <text x={cx} y={h * 0.5 + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800}
        fill="#ffffff">{text}</text>
    </g>
  );
}

/**
 * Ein Teil im gewählten Motiv. `label` ist gesetzt bei Bruchresten (0,5) und
 * bei zusammengefassten großen Mengen (25).
 */
export function MotivShape({ motiv, kind, neg, frac, label, w, h, v = 0 }: {
  motiv: Exclude<MotivId, "kloetze">;
  /** Laufende Nummer — Gummibärchen haben verschiedene Farben. */
  v?: number;
  kind: "x" | "n";
  neg: boolean;
  frac: number;
  label: string | null;
  w: number;
  h: number;
}) {
  const t = label ?? (kind === "x" ? "x" : "1");
  if (neg) return <Feder w={w} h={h} text={`${MINUS}${t}`} color={kind === "x" ? "#7c3aed" : "#e11d48"} />;

  if (label && frac === 1) {
    // Viele Stücke auf einmal: ein Stapel mit der Anzahl.
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={8}
          fill={kind === "x" ? "#7c3aed" : SIZES[motiv].tint} stroke="#00000033" />
        {xText(w / 2, h / 2 + 0.5, label, 15)}
      </g>
    );
  }

  const shape =
    motiv === "hoelzer" ? (kind === "x" ? <Schachtel t="x" /> : <Streichholz />)
      : motiv === "gummi" ? (kind === "x" ? <Tuete t="x" /> : <Gummibaer v={v} />)
      : motiv === "murmeln" ? (kind === "x" ? <Saeckchen t="x" /> : <Murmel />)
        : kind === "x" ? <Geldbeutel t="x" /> : <Muenze t="1" />;

  if (frac >= 1) return shape;
  // Bruchrest: nur der passende Teil des Stücks, der Rest blass.
  return (
    <g>
      <g opacity={0.22}>{shape}</g>
      <svg x={0} y={0} width={w * frac} height={h} overflow="hidden">{shape}</svg>
      <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800}
        fill="var(--text)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">{label}</text>
    </g>
  );
}
