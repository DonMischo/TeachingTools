"use client";
/**
 * Realistische Zeichnungen der Teile — jede in eigenen Koordinaten (0…w, 0…h).
 * Farbverläufe liegen einmal in <PcbDefs/> (IDs mit »pcb-«, damit nichts mit
 * anderen Simulationen der Offline-Datei kollidiert).
 */
import type { CSSProperties, ReactNode } from "react";

export function PcbDefs() {
  const lin = (id: string, a: string, b: string, vertikal = true) => (
    <linearGradient id={id} x1="0" y1="0" x2={vertikal ? "0" : "1"} y2={vertikal ? "1" : "0"}>
      <stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} />
    </linearGradient>
  );
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        {lin("pcb-metall", "#e4e8ee", "#9aa2ad")}
        {lin("pcb-metall-q", "#c9ced6", "#8e96a1", false)}
        {lin("pcb-dunkel", "#353a45", "#1b1e25")}
        {lin("pcb-board", "#262b33", "#171a1f")}
        {lin("pcb-gruen", "#2f8150", "#1d5b36")}
        {lin("pcb-pi", "#23935a", "#167043")}
        {lin("pcb-blau", "#24406b", "#152843")}
        {lin("pcb-gold", "#f7dc85", "#c39a35")}
        {lin("pcb-beige", "#ebe3cc", "#cbbf9f")}
        {lin("pcb-beige-innen", "#b9b6ad", "#8f8c84")}
        {lin("pcb-akku", "#3b3f4a", "#24272e")}
        {lin("pcb-rgb", "#22d3ee", "#a855f7", false)}
        <radialGradient id="pcb-nabe"><stop offset="0" stopColor="#4b5260" /><stop offset="1" stopColor="#1f232b" /></radialGradient>
        <radialGradient id="pcb-linse"><stop offset="0" stopColor="#5c7cfa" /><stop offset=".45" stopColor="#111827" /><stop offset="1" stopColor="#030712" /></radialGradient>
        <filter id="pcb-schatten" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity=".45" />
        </filter>
        <filter id="pcb-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id="pcb-lochblech" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="2" fill="#0b0d10" />
        </pattern>
        <pattern id="pcb-bahnen" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M0 10h14l6 6h20M0 30h8l8-8h24M26 0v6M10 40v-6" stroke="#ffffff" strokeOpacity=".06" fill="none" />
        </pattern>
      </defs>
    </svg>
  );
}

type Z = (w: number, h: number, an: boolean) => ReactNode;

const dreh = (an: boolean, s = 0.5): CSSProperties =>
  an ? { transformBox: "fill-box", transformOrigin: "center", animation: `spin ${s}s linear infinite` } : {};

/** Ein Lüfter mit Rahmen; dreht sich, wenn der Rechner läuft. */
function Luefter({ cx, cy, r, an, rgb = false }: { cx: number; cy: number; r: number; an: boolean; rgb?: boolean }) {
  const blaetter = Array.from({ length: 7 }, (_, i) => i * (360 / 7));
  return (
    <g>
      <rect x={cx - r - 4} y={cy - r - 4} width={2 * r + 8} height={2 * r + 8} rx={6} fill="#14171c" stroke="#2a2f38" />
      <circle cx={cx} cy={cy} r={r} fill="#0b0d10" />
      {rgb && <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="url(#pcb-rgb)" strokeWidth={3} opacity={an ? 1 : .35} filter={an ? "url(#pcb-glow)" : undefined} />}
      <g style={dreh(an, 0.35)}>
        <circle cx={cx} cy={cy} r={r - 3} fill="none" />
        {blaetter.map(a => (
          <path key={a} transform={`rotate(${a} ${cx} ${cy})`}
            d={`M${cx} ${cy - r * .28} C ${cx + r * .35} ${cy - r * .5}, ${cx + r * .55} ${cy - r * .8}, ${cx + r * .15} ${cy - r * .93} C ${cx - r * .05} ${cy - r * .75}, ${cx - r * .1} ${cy - r * .45}, ${cx} ${cy - r * .28}Z`}
            fill="#2c313b" stroke="#3c4350" strokeWidth={.6} />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={r * .28} fill="url(#pcb-nabe)" />
    </g>
  );
}

function Chip({ x, y, w, h, text, farbe = "#16181d" }: { x: number; y: number; w: number; h: number; text?: string; farbe?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill={farbe} stroke="#000" strokeOpacity=".4" />
      <rect x={x + 1} y={y + 1} width={w - 2} height={h * .35} fill="#fff" opacity=".05" />
      {text && <text x={x + w / 2} y={y + h / 2 + 3} textAnchor="middle" fontSize={Math.min(9, w / (text.length * .62))} fill="#c8ccd4" fontFamily="monospace">{text}</text>}
    </g>
  );
}

/** Kühlrippen in einem Block. */
function Rippen({ x, y, w, h, n, farbe = "url(#pcb-metall)", quer = false }: { x: number; y: number; w: number; h: number; n: number; farbe?: string; quer?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill="#3a404a" />
      {Array.from({ length: n }, (_, i) => quer
        ? <rect key={i} x={x + 1} y={y + 1 + i * (h - 2) / n} width={w - 2} height={(h - 2) / n * .55} fill={farbe} />
        : <rect key={i} x={x + 1 + i * (w - 2) / n} y={y + 1} width={(w - 2) / n * .55} height={h - 2} fill={farbe} />)}
    </g>
  );
}

const Steckplatz = ({ x, y, w, h, farbe = "#0d0f12" }: { x: number; y: number; w: number; h: number; farbe?: string }) => (
  <g><rect x={x} y={y} width={w} height={h} rx={1} fill={farbe} stroke="#4b5260" strokeWidth={.6} />
    <line x1={x + w / 2} y1={y + 2} x2={x + w / 2} y2={y + h - 2} stroke="#000" strokeWidth={Math.min(w, h) * .3} opacity={w < h ? .6 : 0} />
    <line x1={x + 2} y1={y + h / 2} x2={x + w - 2} y2={y + h / 2} stroke="#000" strokeWidth={Math.min(w, h) * .3} opacity={w >= h ? .6 : 0} /></g>
);

const Text = ({ x, y, children, size = 9, farbe = "#cbd5e1", anchor = "middle", gewicht = 600 }: { x: number; y: number; children: ReactNode; size?: number; farbe?: string; anchor?: "start" | "middle" | "end"; gewicht?: number }) => (
  <text x={x} y={y} fontSize={size} fill={farbe} textAnchor={anchor} fontFamily="ui-sans-serif, system-ui" fontWeight={gewicht}>{children}</text>
);

// ── Moderner PC ──────────────────────────────────────────────────────────────

const pcGehaeuse: Z = (w, h, an) => (
  <g>
    <rect width={w} height={h} rx={18} fill="#0b0d11" />
    <rect x={6} y={6} width={w - 12} height={h - 12} rx={14} fill="url(#pcb-dunkel)" stroke="#3b414d" strokeWidth={2} />
    {/* Rückwand mit Ausschnitt hinter dem Mainboard */}
    <rect x={70} y={30} width={360} height={420} rx={6} fill="#20242c" />
    <rect x={150} y={110} width={160} height={140} rx={10} fill="#111318" />
    {/* Kabeldurchführungen */}
    {[90, 190, 290, 390].map(y => <rect key={y} x={418} y={y} width={18} height={60} rx={9} fill="#0a0b0e" stroke="#30353f" />)}
    <rect x={95} y={20} width={110} height={14} rx={7} fill="#0a0b0e" stroke="#30353f" />
    {/* Slotblenden hinten links */}
    {Array.from({ length: 7 }, (_, i) => <rect key={i} x={70} y={280 + i * 18} width={20} height={14} rx={1} fill="url(#pcb-metall-q)" opacity=".75" />)}
    {/* Hecklüfter */}
    <Luefter cx={42} cy={140} r={24} an={an} />
    {/* Laufwerkskäfig */}
    <rect x={500} y={440} width={180} height={128} rx={6} fill="#181b21" stroke="#3b414d" />
    {[452, 512].map(y => <rect key={y} x={508} y={y} width={164} height={8} rx={2} fill="#2a2f38" />)}
    {/* Front: Taster, USB */}
    <rect x={w - 14} y={30} width={6} height={160} rx={3} fill="#22262e" />
    <circle cx={w - 11} cy={46} r={4} fill={an ? "#38bdf8" : "#334155"} filter={an ? "url(#pcb-glow)" : undefined} />
    {/* Front-Panel-Kabelbündel hängt herunter */}
    <path d="M760 370 C 730 390, 690 395, 670 420" stroke="#1f2937" strokeWidth={5} fill="none" strokeLinecap="round" />
    <rect x={662} y={414} width={16} height={12} rx={2} fill="#111" stroke="#666" />
  </g>
);

const pcLuefter: Z = (w, _h, an) => (
  <g>{[60, 180, 300].map(cy => <Luefter key={cy} cx={w / 2} cy={cy} r={36} an={an} rgb />)}</g>
);

const pcMainboard: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={4} fill="url(#pcb-board)" />
    <rect width={w} height={h} rx={4} fill="url(#pcb-bahnen)" />
    {[[8, 8], [w - 12, 8], [8, h - 12], [w - 12, h - 12], [w / 2, h / 2 + 30]].map(([x, y], i) => <circle key={i} cx={x + 2} cy={y + 2} r={4} fill="url(#pcb-gold)" />)}
    {/* Sockel */}
    <rect x={83} y={53} width={74} height={74} rx={3} fill="#15171b" stroke="#6b7280" />
    <rect x={88} y={58} width={64} height={64} fill="#2a2015" />
    <rect x={88} y={58} width={64} height={64} fill="url(#pcb-gold)" opacity=".18" />
    <line x1={160} y1={60} x2={160} y2={125} stroke="#a3a8b0" strokeWidth={2} />
    {/* DIMM-Steckplätze */}
    {[200, 214, 228, 242].map((x, i) => <Steckplatz key={x} x={x} y={25} w={8} h={170} farbe={i % 2 ? "#23262c" : "#0d0f12"} />)}
    {/* PCIe */}
    <Steckplatz x={30} y={250} w={200} h={9} farbe="#1b1d22" />
    <rect x={30} y={250} width={200} height={9} fill="none" stroke="url(#pcb-metall)" strokeWidth={1.5} />
    <Steckplatz x={30} y={325} w={60} h={7} />
    {/* M.2 */}
    <rect x={50} y={194} width={110} height={18} rx={2} fill="#14161a" stroke="#3b414d" strokeDasharray="3 2" />
    <Text x={105} y={206} size={7} farbe="#6b7280">M.2</Text>
    {/* 24-Pin, EPS, Lüfter, SATA, Front-Panel */}
    <rect x={270} y={70} width={18} height={80} rx={2} fill="#e5e7eb" />
    {Array.from({ length: 12 }, (_, i) => <g key={i}><rect x={272} y={73 + i * 6.3} width={6} height={4.5} fill="#1f2937" /><rect x={280} y={73 + i * 6.3} width={6} height={4.5} fill="#1f2937" /></g>)}
    <rect x={5} y={6} width={26} height={13} rx={1.5} fill="#e5e7eb" />
    {Array.from({ length: 4 }, (_, i) => <g key={i}><rect x={7 + i * 6} y={7.5} width={4.5} height={4} fill="#1f2937" /><rect x={7 + i * 6} y={13} width={4.5} height={4} fill="#1f2937" /></g>)}
    <rect x={185} y={8} width={12} height={8} rx={1} fill="#e5e7eb" />
    {[328, 345].map(y => <rect key={y} x={280} y={y} width={18} height={14} rx={1.5} fill="#1e3a8a" stroke="#93c5fd" strokeWidth={.6} />)}
    <rect x={232} y={366} width={36} height={10} rx={1} fill="#111" stroke="#9ca3af" strokeWidth={.6} />
    <rect x={190} y={366} width={28} height={10} rx={1} fill="#1d4ed8" stroke="#9ca3af" strokeWidth={.6} />
    <Text x={250} y={362} size={6} farbe="#6b7280">F_PANEL</Text>
    <Text x={60} y={300} size={7} farbe="#4b5563" anchor="start" gewicht={800}>MAINBOARD · ATX</Text>
  </g>
);

const pcIo: Z = (w, h) => (
  <g>
    <rect width={w} height={h} rx={3} fill="url(#pcb-dunkel)" stroke="#4b5563" />
    <path d={`M4 6 L ${w - 4} 14 L ${w - 4} ${h - 6} L 4 ${h - 14}Z`} fill="#2c313a" opacity=".7" />
    <Text x={w / 2} y={h / 2} size={8} farbe="#94a3b8">I/O</Text>
  </g>
);

const pcVrm: Z = (w, h) => <Rippen x={0} y={0} w={w} h={h} n={18} farbe="url(#pcb-metall)" />;

const pcChipsatz: Z = (w, h) => (
  <g><rect width={w} height={h} rx={5} fill="url(#pcb-metall)" stroke="#6b7280" />
    <path d={`M8 ${h - 8} L ${w - 8} 8`} stroke="#fff" strokeOpacity=".5" strokeWidth={3} />
    <Text x={w / 2} y={h / 2 + 3} size={7} farbe="#374151" gewicht={800}>CHIPSATZ</Text></g>
);

const knopfzelle: Z = (w) => (
  <g><circle cx={w / 2} cy={w / 2} r={w / 2} fill="url(#pcb-metall)" stroke="#6b7280" />
    <circle cx={w / 2} cy={w / 2} r={w / 2 - 3} fill="none" stroke="#fff" strokeOpacity=".5" />
    <Text x={w / 2} y={w / 2 + 2.5} size={5.5} farbe="#374151">CR2032</Text></g>
);

const pcCpu: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={3} fill="#0f5132" />
    <rect x={7} y={7} width={w - 14} height={h - 14} rx={4} fill="url(#pcb-metall)" stroke="#8b939f" />
    <rect x={10} y={10} width={w - 20} height={(h - 20) * .4} rx={3} fill="#fff" opacity=".25" />
    <Text x={w / 2} y={h / 2 + 2} size={8} farbe="#334155" gewicht={800}>CPU</Text>
    <Text x={w / 2} y={h / 2 + 12} size={5.5} farbe="#475569">8 Kerne · 5,4 GHz</Text>
    <path d={`M3 ${h - 3} l7 0 l-7 -7z`} fill="url(#pcb-gold)" />
  </g>
);

const pcKuehler: Z = (w, h, an) => (
  <g filter="url(#pcb-schatten)">
    <Rippen x={4} y={0} w={w - 8} h={h} n={24} quer farbe="url(#pcb-metall-q)" />
    {[22, 42, 62, 82].map(x => <rect key={x} x={x + 6} y={-4} width={5} height={h + 8} rx={2.5} fill="#b87333" opacity=".9" />)}
    <Luefter cx={w / 2} cy={h / 2} r={42} an={an} rgb />
  </g>
);

const pcRam: Z = (w, h, an) => (
  <g>
    {[2, 30].map(x => (
      <g key={x} filter="url(#pcb-schatten)">
        <rect x={x} y={0} width={10} height={h} rx={1.5} fill="url(#pcb-dunkel)" stroke="#4b5563" />
        <rect x={x} y={0} width={10} height={6} rx={1.5} fill="url(#pcb-rgb)" opacity={an ? 1 : .3} filter={an ? "url(#pcb-glow)" : undefined} />
        <path d={`M${x + 2} 20 L ${x + 8} 26 L ${x + 2} 32 M${x + 2} 60 L ${x + 8} 66 L ${x + 2} 72`} stroke="#9ca3af" strokeWidth={.7} fill="none" />
        <text x={x + 6.5} y={h / 2 + 20} fontSize={7} fill="#cbd5e1" transform={`rotate(-90 ${x + 6.5} ${h / 2 + 20})`} fontWeight={700}>DDR5 16 GB</text>
      </g>
    ))}
  </g>
);

const pcM2: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={2} fill="#1b4332" />
    <rect x={w - 6} y={h / 2 - 3} width={4} height={6} rx={2} fill="#0b0d10" />
    {[0, 1, 2].map(i => <Chip key={i} x={6 + i * 30} y={3} w={i ? 24 : 18} h={h - 6} text={i ? "NAND" : "CTRL"} />)}
    {Array.from({ length: 8 }, (_, i) => <rect key={i} x={0} y={2 + i * 2} width={3} height={1.2} fill="url(#pcb-gold)" />)}
  </g>
);

const pcGpu: Z = (w, h, an) => (
  <g filter="url(#pcb-schatten)">
    <rect x={0} y={4} width={w} height={h - 8} rx={6} fill="url(#pcb-dunkel)" stroke="#475569" />
    <rect x={0} y={4} width={w} height={8} rx={4} fill="#9ca3af" opacity=".35" />
    <rect x={8} y={h - 20} width={w - 60} height={6} rx={3} fill="url(#pcb-rgb)" opacity={an ? 1 : .3} filter={an ? "url(#pcb-glow)" : undefined} />
    {[70, 160, 250].map(x => <g key={x}><rect x={x - 32} y={14} width={64} height={h - 38} rx={4} fill="#14171c" />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={x - 30 + i * 7} y={16} width={4} height={h - 42} fill="#2c313a" />)}</g>)}
    <Text x={w - 30} y={h / 2 + 2} size={11} farbe="#e2e8f0" gewicht={900}>GPU</Text>
    <rect x={325} y={0} width={20} height={10} rx={2} fill="#e5e7eb" />
    <rect x={-10} y={0} width={14} height={h} rx={2} fill="url(#pcb-metall-q)" />
  </g>
);

const pcNetzteil: Z = (w, h, an) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={6} fill="url(#pcb-dunkel)" stroke="#4b5563" />
    <rect x={10} y={10} width={120} height={h - 20} rx={6} fill="url(#pcb-lochblech)" stroke="#2b3039" />
    <g opacity=".6" style={dreh(an, .5)}><circle cx={70} cy={h / 2} r={34} fill="none" stroke="#3b414d" strokeWidth={5} strokeDasharray="10 6" /></g>
    <rect x={140} y={14} width={64} height={32} rx={4} fill="#e5e7eb" />
    <Text x={172} y={28} size={9} farbe="#111827" gewicht={900}>750 W</Text>
    <Text x={172} y={40} size={6.5} farbe="#a16207" gewicht={800}>80 PLUS GOLD</Text>
    <rect x={w - 18} y={4} width={16} height={h - 8} rx={3} fill="#111318" />
    {[15, 32, 49, 66, 83].map(y => <rect key={y} x={w - 15} y={y - 5} width={10} height={10} rx={1.5} fill="#000" stroke="#6b7280" strokeWidth={.6} />)}
  </g>
);

const pcHdd: Z = (w, h, an) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={5} fill="url(#pcb-metall)" stroke="#6b7280" />
    <rect x={12} y={10} width={w - 24} height={h - 20} rx={4} fill="#e5e7eb" />
    <circle cx={w * .62} cy={h / 2} r={34} fill="none" stroke="#cbd5e1" strokeWidth={6} />
    <g style={dreh(an, .3)}><path d={`M${w * .62 - 30} ${h / 2} a30 30 0 0 1 60 0`} fill="none" stroke="#94a3b8" strokeWidth={1} /></g>
    <Text x={34} y={26} size={8} farbe="#111827" anchor="start" gewicht={900}>4 TB</Text>
    <Text x={34} y={37} size={6} farbe="#4b5563" anchor="start">7200 U/min · SATA</Text>
    <rect x={0} y={16} width={10} height={18} rx={1.5} fill="#111" />
    <rect x={0} y={48} width={10} height={24} rx={1.5} fill="#111" />
  </g>
);

// ── 386er ────────────────────────────────────────────────────────────────────

const g386Gehaeuse: Z = (w, h, an) => (
  <g>
    <rect width={w} height={h} rx={10} fill="url(#pcb-beige)" />
    <rect x={10} y={10} width={w - 20} height={h - 72} rx={4} fill="url(#pcb-beige-innen)" />
    <rect x={10} y={10} width={w - 20} height={h - 72} rx={4} fill="url(#pcb-bahnen)" opacity=".5" />
    {/* Laufwerksschacht */}
    <rect x={398} y={278} width={362} height={238} rx={3} fill="#9b978d" stroke="#7d7a72" />
    {/* Front */}
    <rect x={0} y={h - 58} width={w} height={58} rx={8} fill="url(#pcb-beige)" stroke="#b2a888" />
    <line x1={10} y1={h - 56} x2={w - 10} y2={h - 56} stroke="#fff" strokeOpacity=".5" />
    <rect x={580} y={h - 42} width={152} height={16} rx={3} fill="#c9bf9f" />
    <rect x={605} y={h - 37} width={100} height={5} rx={2} fill="#2d2a24" />
    <rect x={715} y={h - 36} width={10} height={4} fill="#4b4636" />
    {/* Lautsprecher */}
    <circle cx={70} cy={490} r={22} fill="#5d5a52" stroke="#3e3c36" strokeWidth={3} />
    <circle cx={70} cy={490} r={12} fill="#2f2d29" />
    <Text x={70} y={524} size={7} farbe="#3e3c36">Lautsprecher</Text>
    {/* Netzschalter an der Seite */}
    <rect x={w - 12} y={100} width={12} height={40} rx={2} fill="#c0392b" />
    <Text x={w - 30} y={h - 8} size={7} farbe="#6b6553" anchor="end">{an ? "● POWER" : "○ POWER"}</Text>
  </g>
);

const g386Front: Z = (w, h, an) => (
  <g>
    <rect width={w} height={h} rx={4} fill="#d7cfb6" stroke="#b2a888" />
    <rect x={8} y={8} width={70} height={24} rx={3} fill="#1a0b0b" />
    <text x={43} y={27} textAnchor="middle" fontFamily="monospace" fontSize={20} fontWeight={900} fill={an ? "#ef4444" : "#3b1111"} filter={an ? "url(#pcb-glow)" : undefined}>{an ? "33" : "88"}</text>
    <rect x={90} y={10} width={40} height={20} rx={3} fill="#bfb597" stroke="#8d8466" />
    <Text x={110} y={23} size={7} farbe="#3e3c36" gewicht={800}>TURBO</Text>
    <circle cx={150} cy={14} r={3.5} fill={an ? "#22c55e" : "#14532d"} />
    <circle cx={150} cy={27} r={3.5} fill={an ? "#f59e0b" : "#713f12"} />
    <circle cx={200} cy={20} r={10} fill="url(#pcb-metall)" stroke="#6b7280" />
    <rect x={198} y={13} width={4} height={14} rx={1} fill="#374151" />
  </g>
);

const g386Mainboard: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={2} fill="url(#pcb-gruen)" />
    <rect width={w} height={h} fill="url(#pcb-bahnen)" />
    {/* ISA-Steckplätze */}
    {[30, 60, 90, 120, 150, 180].map((x, i) => <Steckplatz key={x} x={x} y={20} w={i < 4 ? 10 : 8} h={i < 4 ? 230 : 140} farbe="#141414" />)}
    {/* Chips verteilt */}
    {[[110, 280], [140, 280], [110, 305], [140, 305], [200, 110], [230, 110], [260, 110], [200, 140]].map(([x, y], i) =>
      <Chip key={i} x={x} y={y} w={22} h={12} />)}
    {/* Sockel für CPU und FPU */}
    <rect x={206} y={271} width={68} height={68} rx={2} fill="#efe9d8" opacity=".9" />
    <rect x={279} y={282} width={44} height={44} rx={2} fill="#efe9d8" opacity=".9" />
    {Array.from({ length: 6 }, (_, i) => <circle key={i} cx={287 + (i % 3) * 14} cy={290 + Math.floor(i / 3) * 28} r={1.2} fill="#888" />)}
    {/* SIMM-Sockel */}
    {[345, 359, 373, 387].map(y => <rect key={y} x={18} y={y} width={174} height={9} rx={1} fill="#efe9d8" stroke="#a8a08a" strokeWidth={.6} />)}
    <Text x={105} y={340} size={6} farbe="#d1fae5" gewicht={700}>BANK 0 · 4 × SIMM</Text>
    {/* P8/P9 */}
    <rect x={230} y={22} width={70} height={12} rx={1} fill="#f5f5f4" />
    {Array.from({ length: 12 }, (_, i) => <rect key={i} x={232 + i * 5.6} y={25} width={4} height={6} fill="#57534e" />)}
    <Text x={265} y={45} size={6} farbe="#d1fae5">P8 · P9</Text>
    {/* Header vorne */}
    {[50, 100].map(x => <rect key={x} x={x - 8} y={404} width={16} height={6} fill="#111" />)}
    <Text x={50} y={400} size={5.5} farbe="#d1fae5">SPK</Text>
    <Text x={100} y={400} size={5.5} farbe="#d1fae5">TURBO</Text>
    <Text x={310} y={180} size={7} farbe="#a7f3d0" anchor="end" gewicht={800}>BABY-AT 386</Text>
  </g>
);

const g386Bios: Z = (w, h) => (
  <g>{[0, 26].map(x => <g key={x}><Chip x={x} y={0} w={24} h={h} />
    <rect x={x + 3} y={h / 2 - 9} width={18} height={18} rx={2} fill="#f8fafc" />
    <Text x={x + 12} y={h / 2 + 2.5} size={5} farbe="#111827" gewicht={800}>BIOS</Text></g>)}</g>
);

const g386Akku: Z = (w, h) => (
  <g><rect width={w} height={h} rx={w / 2 - 4} fill="#2563eb" stroke="#1e3a8a" />
    <rect x={3} y={4} width={w - 6} height={h * .3} rx={6} fill="#fff" opacity=".25" />
    <Text x={w / 2} y={h / 2 + 3} size={6.5} farbe="#fff" gewicht={800}>3,6 V</Text></g>
);

const g386Chipsatz: Z = (w, h) => (
  <g>{[0, 1, 2].map(i => <Chip key={i} x={i * 31} y={i === 1 ? 0 : 14} w={28} h={28} text="CHIP" />)}</g>
);

const g386Din: Z = (w, h) => (
  <g><rect width={w} height={h} rx={3} fill="#1c1c1c" /><circle cx={w / 2} cy={h / 2} r={8} fill="#000" stroke="#aaa" />
    {[0, 1, 2, 3, 4].map(i => <circle key={i} cx={w / 2 + 5 * Math.cos(Math.PI * (i / 4))} cy={h / 2 + 5 * Math.sin(Math.PI * (i / 4)) - 1} r={.9} fill="#ddd" />)}</g>
);

const g386Cpu: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={3} fill="#a8a29e" stroke="#57534e" />
    <rect x={10} y={10} width={w - 20} height={h - 20} rx={2} fill="url(#pcb-gold)" />
    <Text x={w / 2} y={h / 2 - 1} size={8} farbe="#3f2d00" gewicht={900}>386DX</Text>
    <Text x={w / 2} y={h / 2 + 9} size={6} farbe="#3f2d00">33 MHz</Text>
  </g>
);

const g386Fpu: Z = (w, h) => (
  <g filter="url(#pcb-schatten)"><rect width={w} height={h} rx={2} fill="#292524" />
    <Text x={w / 2} y={h / 2 + 1} size={7} farbe="#e7e5e4" gewicht={800}>387</Text>
    <Text x={w / 2} y={h / 2 + 9} size={4.5} farbe="#a8a29e">FPU</Text></g>
);

const g386Simm: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={1} fill="#166534" />
    {Array.from({ length: 8 }, (_, i) => <rect key={i} x={8 + i * 20} y={1.5} width={14} height={h - 3} rx={.5} fill="#111" />)}
  </g>
);

/** Steckkarte von oben: schmale Platine mit Chips, Slotblech an der Rückseite. */
const isaKarte = (text: string, farbe: string): Z => (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect x={0} y={0} width={w} height={14} rx={1} fill="url(#pcb-metall-q)" />
    <rect x={3} y={14} width={w - 6} height={h - 14} rx={2} fill={farbe} />
    {Array.from({ length: Math.floor((h - 40) / 34) }, (_, i) => <Chip key={i} x={6} y={30 + i * 34} w={w - 12} h={24} />)}
    <text x={w / 2 + 3} y={h - 10} fontSize={8} fill="#d1fae5" fontWeight={800} transform={`rotate(-90 ${w / 2 + 3} ${h - 10})`}>{text}</text>
  </g>
);

const g386Netzteil: Z = (w, h, an) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={4} fill="url(#pcb-metall)" stroke="#6b7280" />
    <circle cx={w / 2} cy={70} r={52} fill="#2b2b2b" />
    <g style={dreh(an, .4)}>{[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx={w / 2} cy={44} rx={10} ry={24} transform={`rotate(${a} ${w / 2} 70)`} fill="#4b4b4b" />)}</g>
    {Array.from({ length: 6 }, (_, i) => <circle key={i} cx={w / 2} cy={70} r={14 + i * 8} fill="none" stroke="#9ca3af" strokeWidth={1.4} />)}
    <rect x={30} y={135} width={150} height={40} rx={3} fill="#fafaf9" />
    <Text x={105} y={152} size={9} farbe="#111827" gewicht={900}>AT POWER SUPPLY</Text>
    <Text x={105} y={166} size={7} farbe="#57534e">200 W · 230 V~</Text>
    {[10, 40, 70].map(x => <rect key={x} x={x - 6} y={h - 14} width={12} height={14} fill="#1c1917" />)}
  </g>
);

const g386Hdd: Z = (w, h, an) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={3} fill="url(#pcb-metall)" stroke="#6b7280" />
    <rect x={14} y={30} width={w - 28} height={h - 50} rx={4} fill="#d6d3d1" />
    <rect x={22} y={44} width={w - 44} height={70} rx={2} fill="#fafaf9" />
    <Text x={w / 2} y={62} size={10} farbe="#111827" gewicht={900}>40 MB</Text>
    <Text x={w / 2} y={76} size={7} farbe="#57534e">IDE · 3600 U/min</Text>
    <Text x={w / 2} y={90} size={6} farbe="#57534e">Zylinder 980 · Köpfe 5</Text>
    <Text x={w / 2} y={104} size={6} farbe="#b91c1c" gewicht={800}>NICHT ÖFFNEN</Text>
    <g style={dreh(an, .5)}><circle cx={w / 2} cy={160} r={26} fill="none" stroke="#a8a29e" strokeWidth={2} strokeDasharray="8 5" /></g>
    <rect x={20} y={0} width={60} height={10} rx={1} fill="#1c1917" />
    <rect x={88} y={0} width={14} height={10} fill="#0f172a" />
    <rect x={118} y={0} width={24} height={10} rx={1} fill="#f5f5f4" stroke="#78716c" />
    <rect x={w / 2 - 20} y={h - 8} width={40} height={8} fill="#1c1917" />
    <circle cx={w - 16} cy={h - 4} r={3} fill={an ? "#ef4444" : "#450a0a"} />
  </g>
);

const g386Fdd: Z = (w, h, an) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={3} fill="url(#pcb-metall)" stroke="#6b7280" />
    <rect x={14} y={24} width={w - 28} height={h - 60} rx={4} fill="#3f3f46" />
    <g style={dreh(an, .8)}><circle cx={w / 2} cy={110} r={22} fill="#18181b" stroke="#71717a" /></g>
    <rect x={w / 2 - 5} y={105} width={10} height={10} fill="#a1a1aa" />
    <rect x={14} y={h - 34} width={w - 28} height={30} rx={2} fill="#d6d3d1" />
    <rect x={30} y={h - 24} width={92} height={6} rx={2} fill="#1c1917" />
    <rect x={128} y={h - 22} width={10} height={6} rx={1} fill="#a8a29e" />
    <Text x={w / 2} y={h - 40} size={7} farbe="#d4d4d8">1,44 MB</Text>
    <rect x={25} y={0} width={44} height={9} rx={1} fill="#1c1917" />
    <rect x={115} y={0} width={20} height={9} rx={1} fill="#f5f5f4" stroke="#78716c" />
  </g>
);

// ── Raspberry Pi ─────────────────────────────────────────────────────────────

const piPlatine: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={18} fill="url(#pcb-pi)" />
    <rect width={w} height={h} rx={18} fill="url(#pcb-bahnen)" />
    {[[20, 20], [w - 140, 20], [20, h - 20], [w - 140, h - 20]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r={12} fill="url(#pcb-gold)" /><circle cx={x} cy={y} r={7} fill="#0b0d10" /></g>)}
    <Text x={330} y={70} size={14} farbe="#d1fae5" gewicht={900}>Raspberry Pi 5</Text>
    <Text x={330} y={86} size={8} farbe="#a7f3d0">© 2023</Text>
    {Array.from({ length: 10 }, (_, i) => <rect key={i} x={260 + (i % 5) * 12} y={220 + Math.floor(i / 5) * 10} width={6} height={4} fill="#d6d3d1" />)}
  </g>
);

const piSoc: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={4} fill="url(#pcb-metall)" stroke="#6b7280" />
    <rect x={4} y={4} width={w - 8} height={h * .35} rx={3} fill="#fff" opacity=".3" />
    <Text x={w / 2} y={h / 2 + 2} size={9} farbe="#334155" gewicht={900}>BCM2712</Text>
    <Text x={w / 2} y={h / 2 + 13} size={6} farbe="#475569">4 × 2,4 GHz</Text>
  </g>
);

const chip: Z = (w, h) => (
  <g><Chip x={0} y={0} w={w} h={h} />
    <circle cx={5} cy={5} r={1.6} fill="#475569" /></g>
);

const abschirmung: Z = (w, h) => (
  <g filter="url(#pcb-schatten)"><rect width={w} height={h} rx={3} fill="url(#pcb-metall)" stroke="#6b7280" />
    {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={10 + (i % 6) * 14} cy={h / 2 - 8 + Math.floor(i / 6) * 16} r={1.5} fill="#6b7280" />)}</g>
);

const piGpio: Z = (w, h) => (
  <g><rect width={w} height={h} rx={2} fill="#111" />
    {Array.from({ length: 40 }, (_, i) => <rect key={i} x={5 + (i % 20) * 15} y={i < 20 ? 6 : 18} width={6} height={6} fill="url(#pcb-gold)" />)}</g>
);

const piUsb: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    {[0, 105].map((y, i) => <g key={y}>
      <rect x={0} y={y} width={w} height={90} rx={3} fill="url(#pcb-metall)" stroke="#6b7280" />
      {[18, 58].map(dy => <g key={dy}><rect x={w - 50} y={y + dy - 9} width={48} height={18} rx={2} fill="#0b0d10" />
        <rect x={w - 46} y={y + dy - 3} width={40} height={7} fill={i ? "#2563eb" : "#1f2937"} /></g>)}
    </g>)}
  </g>
);

const piEth: Z = (w, h, an) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={3} fill="url(#pcb-metall)" stroke="#6b7280" />
    <rect x={w - 60} y={20} width={58} height={56} rx={2} fill="#0b0d10" />
    <rect x={w - 50} y={30} width={40} height={14} fill="#1f2937" />
    <rect x={w - 16} y={68} width={8} height={5} fill={an ? "#22c55e" : "#14532d"} />
    <rect x={w - 56} y={68} width={8} height={5} fill={an ? "#f59e0b" : "#713f12"} />
  </g>
);

const piUsbc: Z = (w, h) => (
  <g><rect width={w} height={h} rx={3} fill="url(#pcb-metall)" stroke="#6b7280" />
    <rect x={8} y={h - 9} width={w - 16} height={7} rx={3.5} fill="#0b0d10" /></g>
);

const piHdmi: Z = (w, h) => (
  <g>{[6, 87].map(x => <g key={x}><rect x={x} y={0} width={42} height={h} rx={3} fill="url(#pcb-metall)" stroke="#6b7280" />
    <path d={`M${x + 8} ${h - 3} h26 l-3 -6 h-20z`} fill="#0b0d10" />
    <Text x={x + 21} y={10} size={6} farbe="#374151">{x < 50 ? "HDMI0" : "HDMI1"}</Text></g>)}</g>
);

const piFlex: Z = (w, h) => (
  <g>{[0, w / 2 + 5].map(x => <g key={x}><rect x={x} y={0} width={w / 2 - 5} height={h} rx={2} fill="#f5f5f4" stroke="#a8a29e" />
    <rect x={x + 3} y={h / 2 - 2} width={w / 2 - 11} height={4} fill="#1c1917" /></g>)}</g>
);

const piFlexHoch: Z = (w, h) => (
  <g><rect width={w} height={h} rx={2} fill="#f5f5f4" stroke="#a8a29e" /><rect x={w / 2 - 2} y={4} width={4} height={h - 8} fill="#1c1917" /></g>
);

const piSdslot: Z = (w, h) => (
  <g><rect width={w} height={h} rx={2} fill="url(#pcb-metall)" stroke="#6b7280" /><rect x={2} y={10} width={6} height={h - 20} fill="#0b0d10" /></g>
);

const piSdkarte: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <path d={`M0 4 q0 -4 4 -4 h${w - 14} l10 10 v${h - 14} q0 4 -4 4 h-${w - 4} q-4 0 -4 -4z`} fill="#1f2937" stroke="#4b5563" />
    <rect x={4} y={6} width={w - 18} height={h - 12} rx={2} fill="#dc2626" />
    <Text x={(w - 14) / 2 + 4} y={h / 2 + 3} size={8} farbe="#fff" gewicht={900}>64 GB</Text>
  </g>
);

const piFanheader: Z = (w, h) => <g><rect width={w} height={h} rx={1} fill="#f5f5f4" stroke="#a8a29e" /><rect x={3} y={3} width={w - 6} height={h - 6} fill="#1c1917" /></g>;
const piKnopf: Z = (w, h) => <g><rect width={w} height={h} rx={2} fill="#d6d3d1" /><rect x={3} y={4} width={w - 6} height={h - 8} rx={2} fill="#1f2937" /></g>;

const piKuehler: Z = (w, h, an) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={8} fill="#2b2f37" />
    <Rippen x={8} y={8} w={w - 110} h={h - 16} n={14} farbe="url(#pcb-metall)" />
    <Luefter cx={w - 52} cy={h / 2} r={38} an={an} />
    <path d={`M${w - 14} 18 q8 -10 0 -10`} stroke="#ef4444" strokeWidth={2} fill="none" />
  </g>
);

const piMonitor: Z = (w, h, an) => (
  <g>
    <rect width={w} height={h - 14} rx={6} fill="#111318" stroke="#3b414d" />
    <rect x={8} y={8} width={w - 16} height={h - 30} rx={2} fill={an ? "url(#pcb-blau)" : "#05070a"} />
    {an && <><rect x={8} y={8} width={w - 16} height={10} fill="#0f172a" opacity=".8" /><circle cx={100} cy={60} r={14} fill="#c51a4a" opacity=".85" /></>}
    <rect x={w / 2 - 10} y={h - 14} width={20} height={8} fill="#1f2328" />
    <rect x={w / 2 - 30} y={h - 6} width={60} height={6} rx={3} fill="#1f2328" />
  </g>
);

const piNetzteil: Z = (w, h) => (
  <g filter="url(#pcb-schatten)"><rect width={w} height={h} rx={10} fill="#f8fafc" stroke="#cbd5e1" />
    <circle cx={30} cy={h / 2} r={14} fill="#e2e8f0" /><rect x={22} y={h / 2 - 6} width={4} height={12} fill="#475569" /><rect x={34} y={h / 2 - 6} width={4} height={12} fill="#475569" />
    <Text x={74} y={h / 2 - 2} size={9} farbe="#c51a4a" gewicht={900}>27 W</Text>
    <Text x={74} y={h / 2 + 10} size={6} farbe="#64748b">5,1 V ⎓ 5 A</Text></g>
);

const piTastatur: Z = (w, h) => (
  <g filter="url(#pcb-schatten)"><rect width={w} height={h} rx={8} fill="#f8fafc" stroke="#cbd5e1" />
    {Array.from({ length: 4 }, (_, r) => Array.from({ length: 14 }, (_, c) => (
      <rect key={`${r}-${c}`} x={12 + c * 20 + (r % 2) * 6} y={10 + r * 15} width={16} height={12} rx={2} fill="#c51a4a" opacity={.12 + ((r * 14 + c) % 5) * .02} stroke="#e2e8f0" />
    )))}
  </g>
);

const piRouter: Z = (w, h, an) => (
  <g filter="url(#pcb-schatten)"><rect y={10} width={w} height={h - 10} rx={8} fill="#1f2937" stroke="#374151" />
    {[20, 86].map(x => <rect key={x} x={x} y={0} width={4} height={18} rx={2} fill="#374151" />)}
    {[0, 1, 2, 3].map(i => <circle key={i} cx={22 + i * 20} cy={h - 18} r={3} fill={an ? "#22c55e" : "#14532d"} />)}
    <Text x={w / 2} y={36} size={8} farbe="#9ca3af" gewicht={800}>ROUTER</Text></g>
);

// ── Smartphone ───────────────────────────────────────────────────────────────

const handyRahmen: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={38} fill="url(#pcb-metall-q)" />
    <rect x={6} y={6} width={w - 12} height={h - 12} rx={33} fill="#1a1c22" />
    {[70, h - 70].map(y => [0, w - 6].map(x => <rect key={`${x}-${y}`} x={x} y={y} width={6} height={4} fill="#2b2f37" />))}
    {[160, 210].map(y => <rect key={y} x={w} y={y} width={4} height={34} rx={2} fill="#9aa2ad" />)}
    <rect x={-4} y={130} width={4} height={50} rx={2} fill="#9aa2ad" />
  </g>
);

const handyAntenne: Z = (w, h) => (
  <g opacity=".85"><rect x={30} y={2} width={w - 60} height={h - 4} rx={4} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="20 6" /></g>
);

const handyPlatine: Z = (w, h) => (
  <g>
    <path d={`M0 12 q0 -12 12 -12 h${w - 24} q12 0 12 12 v${h - 24} q0 12 -12 12 h-${w - 24} q-12 0 -12 -12z`} fill="url(#pcb-blau)" />
    <rect width={w} height={h} rx={12} fill="url(#pcb-bahnen)" />
    <rect x={56} y={68} width={160} height={120} rx={4} fill="none" stroke="#94a3b8" strokeOpacity=".5" strokeDasharray="4 3" />
    {Array.from({ length: 14 }, (_, i) => <rect key={i} x={90 + (i % 7) * 18} y={i < 7 ? 8 : 24} width={8} height={5} fill="#cbd5e1" opacity=".5" />)}
  </g>
);

const handySoc: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={3} fill="url(#pcb-metall)" stroke="#6b7280" />
    <rect x={6} y={6} width={w - 12} height={h - 12} rx={2} fill="#111827" />
    <Text x={w / 2} y={h / 2 - 1} size={8} farbe="#e2e8f0" gewicht={900}>SoC</Text>
    <Text x={w / 2} y={h / 2 + 10} size={5.5} farbe="#94a3b8">+ 12 GB RAM</Text>
  </g>
);

const handyKamera: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={10} fill="#1f2937" stroke="#4b5563" />
    {[[20, 18, 13], [50, 18, 11], [20, 46, 11]].map(([x, y, r], i) => <g key={i}><circle cx={x} cy={y} r={r} fill="#0b0d10" stroke="#6b7280" /><circle cx={x} cy={y} r={r - 3} fill="url(#pcb-linse)" /></g>)}
    <circle cx={50} cy={46} r={5} fill="#fde68a" opacity=".85" />
  </g>
);

const handyFrontkamera: Z = (w, h) => (
  <g><rect width={w} height={h} rx={6} fill="#1f2937" /><circle cx={w / 2} cy={h / 2} r={9} fill="url(#pcb-linse)" stroke="#6b7280" /></g>
);

const handySim: Z = (w, h) => (
  <g><rect width={w} height={h} rx={3} fill="url(#pcb-metall)" stroke="#6b7280" /><rect x={4} y={10} width={w - 8} height={h - 20} rx={2} fill="url(#pcb-gold)" /></g>
);

const handyAkku: Z = (w, h) => (
  <g filter="url(#pcb-schatten)">
    <rect width={w} height={h} rx={10} fill="url(#pcb-akku)" stroke="#4b5563" />
    <rect x={20} y={30} width={w - 40} height={80} rx={6} fill="#f8fafc" opacity=".92" />
    <Text x={w / 2} y={58} size={13} farbe="#111827" gewicht={900}>Li-Ion 5000 mAh</Text>
    <Text x={w / 2} y={76} size={8} farbe="#475569">3,87 V · 19,4 Wh</Text>
    <Text x={w / 2} y={94} size={7} farbe="#b91c1c" gewicht={800}>⚠ Nicht durchstechen · nicht erhitzen</Text>
    <path d={`M${w / 2 - 14} 150 h22 v-8 l12 14 l-12 14 v-8 h-22z`} fill="#22c55e" opacity=".55" />
    {[24, w - 30].map(x => <rect key={x} x={x} y={h - 20} width={6} height={12} rx={3} fill="#4b5563" />)}
  </g>
);

const handyFlex: Z = (w, h) => (
  <g><rect width={w} height={h} rx={3} fill="#c2410c" opacity=".85" /><rect x={w / 2 - 12} y={3} width={24} height={h - 6} rx={2} fill="url(#pcb-metall)" /></g>
);

const handyVibration: Z = (w, h) => (
  <g filter="url(#pcb-schatten)"><rect width={w} height={h} rx={6} fill="url(#pcb-metall)" stroke="#6b7280" />
    <rect x={10} y={h / 2 - 5} width={w - 20} height={10} rx={5} fill="#475569" /></g>
);

const handyLautsprecher: Z = (w, h) => (
  <g filter="url(#pcb-schatten)"><rect width={w} height={h} rx={8} fill="#1f2937" stroke="#4b5563" />
    {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={14 + (i % 9) * 12} cy={h / 2 - 7 + Math.floor(i / 9) * 14} r={2.5} fill="#0b0d10" />)}</g>
);

const handyUsbc: Z = (w, h) => (
  <g><rect width={w} height={h} rx={6} fill="url(#pcb-metall)" stroke="#6b7280" /><rect x={10} y={h / 2 - 4} width={w - 20} height={8} rx={4} fill="#0b0d10" /></g>
);

export const ZEICHNUNGEN: Record<string, Z> = {
  "pc-gehaeuse": pcGehaeuse, "pc-luefter": pcLuefter, "pc-mainboard": pcMainboard, "pc-io": pcIo, "pc-vrm": pcVrm,
  "pc-chipsatz": pcChipsatz, knopfzelle, "pc-cpu": pcCpu, "pc-kuehler": pcKuehler, "pc-ram": pcRam, "pc-m2": pcM2,
  "pc-gpu": pcGpu, "pc-netzteil": pcNetzteil, "pc-hdd": pcHdd,
  "386-gehaeuse": g386Gehaeuse, "386-front": g386Front, "386-mainboard": g386Mainboard, "386-bios": g386Bios,
  "386-akku": g386Akku, "386-chipsatz": g386Chipsatz, "386-din": g386Din, "386-cpu": g386Cpu, "386-fpu": g386Fpu,
  "386-simm": g386Simm, "386-vga": isaKarte("VGA", "#14532d"), "386-io": isaKarte("MULTI-I/O", "#1e3a5f"),
  "386-netzteil": g386Netzteil, "386-hdd": g386Hdd, "386-fdd": g386Fdd,
  "pi-platine": piPlatine, "pi-soc": piSoc, chip, abschirmung, "pi-gpio": piGpio, "pi-usb": piUsb, "pi-eth": piEth,
  "pi-usbc": piUsbc, "pi-hdmi": piHdmi, "pi-flex": piFlex, "pi-flex-hoch": piFlexHoch, "pi-sdslot": piSdslot,
  "pi-sdkarte": piSdkarte, "pi-fanheader": piFanheader, "pi-knopf": piKnopf, "pi-kuehler": piKuehler,
  "pi-monitor": piMonitor, "pi-netzteil": piNetzteil, "pi-tastatur": piTastatur, "pi-router": piRouter,
  "handy-rahmen": handyRahmen, "handy-antenne": handyAntenne, "handy-platine": handyPlatine, "handy-soc": handySoc,
  "handy-kamera": handyKamera, "handy-frontkamera": handyFrontkamera, "handy-sim": handySim, "handy-akku": handyAkku,
  "handy-flex": handyFlex, "handy-vibration": handyVibration, "handy-lautsprecher": handyLautsprecher, "handy-usbc": handyUsbc,
};

export function Zeichnung({ name, w, h, an = false }: { name: string; w: number; h: number; an?: boolean }) {
  const z = ZEICHNUNGEN[name];
  return z ? <>{z(w, h, an)}</> : <rect width={w} height={h} rx={4} fill="#475569" />;
}
