"use client";
/**
 * ∫ und f′ zum Anschauen: das Integral als Summe dünner Streifen unter dem
 * Graphen, die Ableitung als Steigung der Tangente — und die Sekante, die
 * sich ihr nähert, wenn h klein wird.
 */
import { useState } from "react";
import { Regler } from "@/components/groessen/bausteine";

export type Fn = { id: string; name: string; f: (x: number) => number; F: (x: number) => number; d: (x: number) => number };

/** Alle bleiben auf [0, 6] über der x-Achse — das Integral ist dann Fläche. */
export const FUNKTIONEN: Fn[] = [
  { id: "gerade", name: "f(x) = ½x + 1", f: x => 0.5 * x + 1, F: x => 0.25 * x * x + x, d: () => 0.5 },
  { id: "parabel", name: "f(x) = ¼x²", f: x => x * x / 4, F: x => x ** 3 / 12, d: x => x / 2 },
  { id: "welle", name: "f(x) = sin(x) + 1,5", f: x => Math.sin(x) + 1.5, F: x => -Math.cos(x) + 1.5 * x, d: x => Math.cos(x) },
  {
    id: "huegel", name: "f(x) = 0,1x³ − 0,9x² + 2x + 1",
    f: x => 0.1 * x ** 3 - 0.9 * x * x + 2 * x + 1,
    F: x => 0.025 * x ** 4 - 0.3 * x ** 3 + x * x + x,
    d: x => 0.3 * x * x - 1.8 * x + 2,
  },
];

const W = 700, H = 400, L = 50, R = 20, T = 20, B = 40, XMAX = 6;
const komma = (x: number, n = 2) => x.toFixed(n).replace(".", ",").replace("-", "−");

function useAchsen(fn: Fn) {
  let ymax = 0;
  for (let i = 0; i <= 120; i++) ymax = Math.max(ymax, fn.f((XMAX * i) / 120));
  ymax = Math.ceil(ymax + 0.5);
  const X = (x: number) => L + (x / XMAX) * (W - L - R);
  const Y = (y: number) => H - B - (y / ymax) * (H - T - B);
  const pfad = Array.from({ length: 241 }, (_, i) => {
    const x = (XMAX * i) / 240;
    return `${i ? "L" : "M"} ${X(x)} ${Y(fn.f(x))}`;
  }).join(" ");
  return { X, Y, ymax, pfad };
}

function Achsen({ X, Y, ymax }: { X: (x: number) => number; Y: (y: number) => number; ymax: number }) {
  return (
    <g>
      {Array.from({ length: XMAX + 1 }, (_, i) => (
        <g key={`x${i}`}>
          <line x1={X(i)} y1={Y(0)} x2={X(i)} y2={Y(ymax)} stroke="var(--border)" strokeOpacity={0.5} />
          <text x={X(i)} y={Y(0) + 22} textAnchor="middle" fontSize={14} fill="var(--text-muted)">{i}</text>
        </g>
      ))}
      {Array.from({ length: ymax + 1 }, (_, i) => (
        <g key={`y${i}`}>
          <line x1={X(0)} y1={Y(i)} x2={X(XMAX)} y2={Y(i)} stroke="var(--border)" strokeOpacity={0.5} />
          <text x={X(0) - 10} y={Y(i)} textAnchor="end" dominantBaseline="central" fontSize={14} fill="var(--text-muted)">{i}</text>
        </g>
      ))}
      <line x1={X(0)} y1={Y(0)} x2={X(XMAX)} y2={Y(0)} stroke="var(--text-muted)" strokeWidth={2} />
      <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(ymax)} stroke="var(--text-muted)" strokeWidth={2} />
    </g>
  );
}

function FnWahl({ fn, setFn }: { fn: Fn; setFn: (f: Fn) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FUNKTIONEN.map(f => (
        <button key={f.id} onClick={() => setFn(f)} className={`chip ${fn.id === f.id ? "chip-on" : ""}`}>{f.name}</button>
      ))}
    </div>
  );
}

/** Summe der Streifen (Mittelpunkt-Regel): so nah kommt man mit n Streifen heran. */
export function streifenSumme(fn: Fn, a: number, b: number, n: number) {
  const dx = (b - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += fn.f(a + (i + 0.5) * dx) * dx;
  return s;
}

export function Integral() {
  const [fn, setFn] = useState(FUNKTIONEN[1]);
  const [a, setA] = useState(1), [b, setB] = useState(5), [n, setN] = useState(4);
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const { X, Y, ymax, pfad } = useAchsen(fn);
  const dx = (hi - lo) / n;
  const summe = streifenSumme(fn, lo, hi, n);
  const genau = fn.F(hi) - fn.F(lo);
  const flaeche = `M ${X(lo)} ${Y(0)} ` + Array.from({ length: 101 }, (_, i) => {
    const x = lo + ((hi - lo) * i) / 100;
    return `L ${X(x)} ${Y(fn.f(x))}`;
  }).join(" ") + ` L ${X(hi)} ${Y(0)} z`;
  return (
    <>
      <FnWahl fn={fn} setFn={setFn} />
      <div className="flex flex-wrap gap-4">
        <Regler label="von a" wert={a} setze={setA} min={0} max={6} step={0.5} />
        <Regler label="bis b" wert={b} setze={setB} min={0} max={6} step={0.5} />
        <Regler label="Streifen n" wert={n} setze={setN} min={1} max={80} breit />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[50vh]">
        <Achsen X={X} Y={Y} ymax={ymax} />
        <path d={flaeche} fill="#22c55e" fillOpacity={0.18} />
        {Array.from({ length: n }, (_, i) => {
          const x0 = lo + i * dx, h = fn.f(x0 + dx / 2);
          return <rect key={i} x={X(x0)} y={Y(h)} width={X(x0 + dx) - X(x0)} height={Y(0) - Y(h)}
            fill="#f59e0b" fillOpacity={0.45} stroke="#f59e0b" strokeWidth={n > 40 ? 0.5 : 1.5} />;
        })}
        <path d={pfad} fill="none" stroke="var(--accent)" strokeWidth={3.5} />
        <text x={X(lo)} y={Y(0) + 22} textAnchor="middle" fontSize={16} fontWeight={900} fill="#22c55e">a</text>
        <text x={X(hi)} y={Y(0) + 22} textAnchor="middle" fontSize={16} fontWeight={900} fill="#22c55e">b</text>
      </svg>
      <p className="text-center text-xl sm:text-2xl font-black">
        {n} Streifen: <span style={{ color: "#f59e0b" }}>{komma(summe, 3)}</span>
        <span className="text-muted mx-3">→</span>
        ∫<sub>{String(lo).replace(".", ",")}</sub><sup>{String(hi).replace(".", ",")}</sup> f(x) dx = <span style={{ color: "#22c55e" }}>{komma(genau, 3)}</span>
      </p>
      <p className="text-sm text-muted text-center max-w-3xl mx-auto">
        Das <strong>∫</strong> ist ein langgezogenes S — wie <strong>Summe</strong>. Man zerlegt die Fläche unter dem Graphen in schmale Streifen
        (jeder ist ein Rechteck: Breite dx mal Höhe f(x)) und zählt alle zusammen. Je mehr Streifen, desto genauer — im Grenzfall unendlich vieler,
        unendlich dünner Streifen ist es genau die Fläche zwischen a und b. Schieb n hoch und sieh zu, wie die Streifensumme auf {komma(genau, 3)} zuläuft.
      </p>
    </>
  );
}

export function Ableitung() {
  const [fn, setFn] = useState(FUNKTIONEN[3]);
  const [x0, setX0] = useState(0.8), [h, setH] = useState(1.5), [spur, setSpur] = useState(false);
  const { X, Y, ymax, pfad } = useAchsen(fn);
  const y0 = fn.f(x0), m = fn.d(x0);
  const x1 = Math.min(XMAX, x0 + h), ms = (fn.f(x1) - y0) / (x1 - x0 || 1);
  const gerade = (mm: number) => {
    const xa = 0, xb = XMAX;
    return { x1: X(xa), y1: Y(y0 + mm * (xa - x0)), x2: X(xb), y2: Y(y0 + mm * (xb - x0)) };
  };
  // f′ als eigener Graph, verschoben auf die Mittellinie, wenn er unter null geht
  const dmin = Math.min(0, ...Array.from({ length: 61 }, (_, i) => fn.d(i / 10)));
  const spurPfad = Array.from({ length: 121 }, (_, i) => {
    const x = (XMAX * i) / 120;
    if (x > x0) return "";
    return `${i ? "L" : "M"} ${X(x)} ${Y(fn.d(x) - dmin)}`;
  }).join(" ");
  return (
    <>
      <FnWahl fn={fn} setFn={setFn} />
      <div className="flex flex-wrap gap-4 items-end">
        <Regler label="Stelle x" wert={x0} setze={setX0} min={0} max={6} step={0.1} breit />
        <Regler label="Abstand h der Sekante" wert={h} setze={setH} min={0.1} max={3} step={0.1} breit />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={spur} onChange={e => setSpur(e.target.checked)} className="accent-accent" />
          Ableitungsgraph mitzeichnen
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[50vh]">
        <defs><clipPath id="abl-clip"><rect x={L} y={T} width={W - L - R} height={H - T - B} /></clipPath></defs>
        <Achsen X={X} Y={Y} ymax={ymax} />
        <g clipPath="url(#abl-clip)">
          <path d={pfad} fill="none" stroke="var(--accent)" strokeWidth={3.5} />
          <line {...gerade(ms)} stroke="#a855f7" strokeWidth={2} strokeDasharray="7 5" />
          <line {...gerade(m)} stroke="#ef4444" strokeWidth={3} />
          {/* Steigungsdreieck: 1 nach rechts, m nach oben */}
          <path d={`M ${X(x0)} ${Y(y0)} L ${X(x0 + 1)} ${Y(y0)} L ${X(x0 + 1)} ${Y(y0 + m)}`} fill="none" stroke="#ef4444" strokeWidth={2} />
          {spur && <path d={spurPfad} fill="none" stroke="#06b6d4" strokeWidth={3} />}
        </g>
        <text x={X(x0 + 0.5)} y={Y(y0) + (m >= 0 ? 18 : -8)} textAnchor="middle" fontSize={14} fontWeight={800} fill="#ef4444">1</text>
        <text x={X(x0 + 1) + 8} y={Y(y0 + m / 2)} dominantBaseline="central" fontSize={14} fontWeight={800} fill="#ef4444">{komma(m)}</text>
        <circle cx={X(x0)} cy={Y(y0)} r={7} fill="#ef4444" />
        <circle cx={X(x1)} cy={Y(fn.f(x1))} r={6} fill="#a855f7" />
      </svg>
      <p className="text-center text-xl sm:text-2xl font-black">
        <span style={{ color: "#a855f7" }}>Sekante: {komma(ms)}</span>
        <span className="text-muted mx-3">→</span>
        <span style={{ color: "#ef4444" }}>f′({komma(x0, 1)}) = {komma(m)}</span>
      </p>
      <p className="text-sm text-muted text-center max-w-3xl mx-auto">
        Die <strong>Ableitung f′(x)</strong> sagt, <strong>wie steil</strong> der Graph an der Stelle x ist: geht man 1 nach rechts an der Tangente (rot),
        geht es um f′(x) nach oben (positiv) oder unten (negativ). Die Sekante (lila) durch zwei Punkte im Abstand h ist eine Schätzung —
        wird h immer kleiner, wird aus ihr die Tangente. Wo f′ = 0 ist, ist der Graph oben oder unten flach.
        {spur && " Türkis: die Werte von f′ selbst als Graph (um " + komma(-dmin, 1) + " nach oben verschoben, damit er ins Bild passt)."}
      </p>
    </>
  );
}
