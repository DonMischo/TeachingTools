"use client";
/**
 * Zahlenstrahl mit Lupe: ℕ als einzelne Punkte, ℤ dazu links, ℚ mit wählbarem
 * größtem Nenner (wird beim Hineinzoomen immer dichter), ℝ als lückenlose Linie
 * mit irrationalen Zahlen. Dazu √2 mit dem Zirkel aus der Quadratdiagonale.
 */
import { useMemo, useState } from "react";
import { FARBE, ZEICHEN, type Bereich } from "@/lib/zahlenbereiche";

const W = 900, H = 230, Y = 150;
const IRRATIONAL = [
  { name: "√2", w: Math.SQRT2 }, { name: "−√2", w: -Math.SQRT2 }, { name: "√3", w: Math.sqrt(3) }, { name: "√5", w: Math.sqrt(5) },
  { name: "φ", w: (1 + Math.sqrt(5)) / 2 }, { name: "e", w: Math.E }, { name: "π", w: Math.PI }, { name: "−π", w: -Math.PI },
];
const ggt = (a: number, b: number): number => (b === 0 ? Math.abs(a) : ggt(b, a % b));
const deutsch = (x: number, s = 4) => x.toLocaleString("de-DE", { maximumFractionDigits: s });

/** Bester Bruch für x mit Nenner bis n (für »√2 trifft keiner«). */
export function naeherung(x: number, maxNenner: number) {
  let best = { z: Math.round(x), n: 1, abstand: Math.abs(x - Math.round(x)) };
  for (let n = 2; n <= maxNenner; n++) {
    const z = Math.round(x * n), d = Math.abs(x - z / n);
    if (d < best.abstand - 1e-15) best = { z, n, abstand: d };
  }
  return best;
}

export default function Zahlenstrahl() {
  const [an, setAn] = useState<Record<Bereich, boolean>>({ N: true, Z: true, Q: false, R: false });
  const [nenner, setNenner] = useState(4);
  const [zoom, setZoom] = useState(0); // 0 … 6: Spanne 12 → 12/2^zoom
  const [mitte, setMitte] = useState(0);
  const [zirkel, setZirkel] = useState(false);
  const spanne = 12 / 2 ** zoom;
  const a = mitte - spanne / 2, b = mitte + spanne / 2;
  const px = (x: number) => ((x - a) / (b - a)) * W;

  const brueche = useMemo(() => {
    if (!an.Q) return [];
    const aus: { x: number; z: number; n: number }[] = [];
    for (let n = 2; n <= nenner && aus.length < 2500; n++)
      for (let z = Math.ceil(a * n); z <= Math.floor(b * n) && aus.length < 2500; z++)
        if (z % n !== 0 && ggt(z, n) === 1) aus.push({ x: z / n, z, n });
    return aus;
  }, [an.Q, nenner, a, b]);

  const ganze = [];
  for (let k = Math.ceil(a); k <= Math.floor(b); k++) if (k >= 0 ? an.N || an.Z : an.Z) ganze.push(k);
  const schritt = spanne <= 1.5 ? 0.1 : spanne <= 3 ? 0.5 : 1;
  const striche = [];
  for (let k = Math.ceil(a / schritt); k <= Math.floor(b / schritt); k++) striche.push(+(k * schritt).toFixed(6));
  const n2 = naeherung(Math.SQRT2, nenner);

  const schalter = (k: Bereich) => (
    <button key={k} type="button" aria-pressed={an[k]} onClick={() => setAn(v => ({ ...v, [k]: !v[k] }))}
      className={`chip ${an[k] ? "chip-on" : ""}`} style={an[k] ? { borderColor: FARBE[k], color: FARBE[k] } : undefined}>
      {ZEICHEN[k]} zeigen
    </button>
  );

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["N", "Z", "Q", "R"] as Bereich[]).map(schalter)}
        <button type="button" className={`chip ${zirkel ? "chip-on" : ""}`} aria-pressed={zirkel} onClick={() => setZirkel(z => !z)}>📐 √2 mit dem Zirkel</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img" aria-label="Zahlenstrahl">
        {/* ℝ: lückenlose Linie */}
        <line x1={0} y1={Y} x2={W} y2={Y} stroke={an.R ? FARBE.R : "var(--color-muted)"} strokeWidth={an.R ? 6 : 2} strokeLinecap="round" />
        {striche.map(s => (
          <g key={`s${s}`}>
            <line x1={px(s)} y1={Y - 6} x2={px(s)} y2={Y + 6} stroke="var(--color-muted)" />
            <text x={px(s)} y={Y + 26} fontSize={14} textAnchor="middle" fill="var(--color-muted)">{deutsch(s, 2)}</text>
          </g>
        ))}
        {brueche.map(q => (
          <g key={`q${q.z}/${q.n}`}>
            <line x1={px(q.x)} y1={Y - 4 - 30 / q.n} x2={px(q.x)} y2={Y} stroke={FARBE.Q} strokeWidth={brueche.length > 400 ? 1 : 2} />
            {brueche.length <= 40 && (
              <text x={px(q.x)} y={Y - 12 - 30 / q.n} fontSize={11} textAnchor="middle" fill={FARBE.Q}>{q.z}/{q.n}</text>
            )}
          </g>
        ))}
        {ganze.map(k => (
          <g key={`g${k}`}>
            <circle cx={px(k)} cy={Y} r={7} fill={k >= 0 && an.N ? FARBE.N : FARBE.Z} />
            <text x={px(k)} y={Y + 48} fontSize={16} fontWeight={800} textAnchor="middle" fill={k >= 0 && an.N ? FARBE.N : FARBE.Z}>{k < 0 ? `−${-k}` : k}</text>
          </g>
        ))}
        {an.R && IRRATIONAL.filter(i => i.w > a && i.w < b).map(i => (
          <g key={i.name}>
            <polygon points={`${px(i.w)},${Y - 9} ${px(i.w) - 7},${Y - 22} ${px(i.w) + 7},${Y - 22}`} fill={FARBE.R} />
            <text x={px(i.w)} y={Y - 28} fontSize={15} fontWeight={800} textAnchor="middle" fill={FARBE.R}>{i.name}</text>
          </g>
        ))}
        {zirkel && px(0) > -50 && px(1.5) < W + 50 && (() => {
          const e = px(1) - px(0);
          return (
            <g>
              <rect x={px(0)} y={Y - e} width={e} height={e} fill="none" stroke="var(--color-fg)" strokeWidth={1.5} />
              <line x1={px(0)} y1={Y} x2={px(1)} y2={Y - e} stroke={FARBE.R} strokeWidth={2.5} />
              <path d={`M ${px(1)} ${Y - e} A ${e * Math.SQRT2} ${e * Math.SQRT2} 0 0 1 ${px(Math.SQRT2)} ${Y}`} fill="none" stroke={FARBE.R} strokeDasharray="5 4" strokeWidth={2} />
            </g>
          );
        })()}
      </svg>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-muted">Lupe ({deutsch(spanne, 3)} Einheiten breit)
          <input type="range" min={0} max={6} value={zoom} onChange={e => setZoom(Number(e.target.value))} aria-label="Lupe" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">Mitte: {deutsch(mitte, 3)}
          <input type="range" min={-4} max={4} step={0.05} value={mitte} onChange={e => setMitte(Number(e.target.value))} aria-label="Mitte" />
        </label>
        <button className="btn-secondary" onClick={() => { setMitte(1.41); setZoom(5); setAn(v => ({ ...v, Q: true, R: true })); }}>🔍 Zu √2</button>
        {an.Q && (
          <label className="flex flex-col gap-1 text-xs text-muted">Brüche mit Nenner bis {nenner}
            <input type="range" min={2} max={60} value={nenner} onChange={e => setNenner(Number(e.target.value))} aria-label="Größter Nenner" />
          </label>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <p><b style={{ color: FARBE.N }}>ℕ</b> und <b style={{ color: FARBE.Z }}>ℤ</b> sind einzelne Punkte — dazwischen ist Platz. <b style={{ color: FARBE.Q }}>ℚ</b> wird mit größeren Nennern immer dichter: Zwischen zwei Brüchen liegt immer noch einer (ihr Mittelwert).</p>
        <p>Und doch: <b style={{ color: FARBE.R }}>√2</b> trifft kein Bruch. Mit Nenner bis {nenner} ist {n2.z}/{n2.n} am nächsten dran — Abstand {n2.abstand.toExponential(1).replace(".", ",")}. Größere Nenner kommen näher, treffen aber nie. Erst <b style={{ color: FARBE.R }}>ℝ</b> schließt diese Lücken.</p>
      </div>
    </div>
  );
}
