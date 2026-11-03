"use client";
/**
 * f(x) = a · sin(b · (x − c)) + d: vier Regler, die Grundkurve gestrichelt
 * daneben. Dazu »Welle treffen«: eine Zielwelle nachstellen, gewertet wird,
 * wie weit die Kurven im Schnitt auseinanderliegen.
 */
import { useState } from "react";
import { Regler } from "@/components/groessen/bausteine";
import { z } from "@/lib/prozent";

const W = 900, H = 340, L = 50, R = 20, YM = 3.5;
const X = (x: number) => L + (x / 720) * (W - L - R); // 0° … 720°
const Y = (y: number) => H / 2 - (y / YM) * (H / 2 - 16);
type P = { a: number; b: number; c: number; d: number };
const f = (p: P, x: number) => p.a * Math.sin((p.b * (x - p.c) * Math.PI) / 180) + p.d;
const pfad = (p: P) => Array.from({ length: 361 }, (_, i) => `${i ? "L" : "M"} ${X(i * 2).toFixed(1)} ${Y(f(p, i * 2)).toFixed(1)}`).join(" ");
const GRUND: P = { a: 1, b: 1, c: 0, d: 0 };

const ziel = (): P => ({
  a: [0.5, 1, 1.5, 2, 2.5, 3][Math.floor(Math.random() * 6)] * (Math.random() < 0.2 ? -1 : 1),
  b: [0.5, 1, 1.5, 2, 3][Math.floor(Math.random() * 5)],
  c: Math.floor(Math.random() * 12) * 15,
  d: [-1.5, -1, -0.5, 0, 0, 0.5, 1, 1.5][Math.floor(Math.random() * 8)],
});
/** mittlere Abweichung der beiden Kurven über das ganze Bild */
const abstand = (p: P, q: P) => {
  let s = 0;
  for (let i = 0; i <= 360; i++) s += Math.abs(f(p, i * 2) - f(q, i * 2));
  return s / 361;
};

function term(p: P) {
  const a = p.a === 1 ? "" : p.a === -1 ? "−" : `${z(p.a, 2)} · `;
  const b = p.b === 1 ? "" : `${z(p.b, 2)} · `;
  const inner = p.c === 0 ? `${b}x` : `${b}(x − ${p.c}°)`;
  const d = p.d === 0 ? "" : p.d > 0 ? ` + ${z(p.d, 2)}` : ` − ${z(-p.d, 2)}`;
  return `f(x) = ${a}sin(${inner})${d}`;
}

export default function Sinusfunktion() {
  const [p, setP] = useState<P>({ a: 2, b: 1, c: 0, d: 0 });
  const [spiel, setSpiel] = useState<P | null>(null);
  const [runden, setRunden] = useState<{ punkte: number }[]>([]);
  const [geprueft, setGeprueft] = useState<number | null>(null);
  const setze = (k: keyof P) => (v: number) => { setP({ ...p, [k]: v }); setGeprueft(null); };

  const neuesZiel = () => { setSpiel(ziel()); setP({ ...GRUND }); setGeprueft(null); };
  const pruefen = () => {
    if (!spiel) return;
    const d = abstand(p, spiel), punkte = Math.max(0, Math.round(100 - d * 80));
    setGeprueft(punkte);
    setRunden(r => [...r, { punkte }]);
  };
  const periode = 360 / Math.abs(p.b);

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button className={`chip ${!spiel ? "chip-on" : ""}`} onClick={() => { setSpiel(null); setGeprueft(null); }}>🔍 Ausprobieren</button>
        <button className={`chip ${spiel ? "chip-on" : ""}`} onClick={neuesZiel}>🎯 Welle treffen</button>
        {spiel && runden.length > 0 && (
          <span className="text-sm text-muted">{runden.length} Wellen · {runden.reduce((s, r) => s + r.punkte, 0)} Punkte · Schnitt {Math.round(runden.reduce((s, r) => s + r.punkte, 0) / runden.length)}</span>
        )}
      </div>
      <p className="text-xl sm:text-2xl font-black text-center">{term(p)}</p>
      <div className="flex flex-wrap gap-4">
        <Regler label="a (Amplitude, Streckung)" wert={p.a} setze={setze("a")} min={-3} max={3} step={0.5} breit />
        <Regler label="b (Frequenz)" wert={p.b} setze={setze("b")} min={0.5} max={4} step={0.5} breit />
        <Regler label="c (Verschiebung nach rechts, °)" wert={p.c} setze={setze("c")} min={0} max={360} step={15} breit />
        <Regler label="d (Verschiebung nach oben)" wert={p.d} setze={setze("d")} min={-2} max={2} step={0.5} breit />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[calc(100vh-8rem)]" role="img" aria-label="Graph der Sinusfunktion">
        {[-3, -2, -1, 1, 2, 3].map(v => (
          <g key={v}>
            <line x1={L} y1={Y(v)} x2={W - R} y2={Y(v)} stroke="var(--border)" strokeOpacity={0.5} />
            <text x={L - 8} y={Y(v)} textAnchor="end" dominantBaseline="central" fontSize={12} fill="var(--text-muted)">{v}</text>
          </g>
        ))}
        {[90, 180, 270, 360, 450, 540, 630, 720].map(w => (
          <g key={w}>
            <line x1={X(w)} y1={Y(YM)} x2={X(w)} y2={Y(-YM)} stroke="var(--border)" strokeOpacity={0.5} />
            <text x={X(w)} y={Y(0) + 16} textAnchor="middle" fontSize={12} fill="var(--text-muted)">{w}°</text>
          </g>
        ))}
        <line x1={L} y1={Y(0)} x2={W - R} y2={Y(0)} stroke="var(--text-muted)" strokeWidth={1.5} />
        <line x1={L} y1={Y(YM)} x2={L} y2={Y(-YM)} stroke="var(--text-muted)" strokeWidth={1.5} />
        {spiel
          ? <path d={pfad(spiel)} fill="none" stroke="#f59e0b" strokeWidth={10} strokeOpacity={0.35} strokeLinecap="round" />
          : <path d={pfad(GRUND)} fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="6 5" />}
        {!spiel && p.d !== 0 && <line x1={L} y1={Y(p.d)} x2={W - R} y2={Y(p.d)} stroke="#a855f7" strokeDasharray="4 4" />}
        <path d={pfad(p)} fill="none" stroke="#ef4444" strokeWidth={3} />
        {!spiel && Math.abs(p.b) > 0 && p.c + periode <= 720 && (
          <g>
            <line x1={X(p.c)} y1={Y(-YM + 0.3)} x2={X(p.c + periode)} y2={Y(-YM + 0.3)} stroke="#3b82f6" strokeWidth={2} />
            <text x={X(p.c + periode / 2)} y={Y(-YM + 0.3) - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="#3b82f6">Periode {z(periode, 1)}°</text>
          </g>
        )}
      </svg>
      {spiel ? (
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm">Stelle die rote Kurve so ein, dass sie auf der breiten orangen Welle liegt.</span>
          <button className="btn btn-primary" onClick={pruefen} disabled={geprueft !== null}>✔ Prüfen</button>
          {geprueft !== null && (
            <>
              <span className={`font-black ${geprueft >= 90 ? "text-ok" : geprueft >= 50 ? "" : "text-bad"}`}>
                {geprueft === 100 ? "Volltreffer! 100 Punkte" : `${geprueft} Punkte`}
              </span>
              <span className="text-sm text-muted">Gesucht war {term(spiel)}{spiel.b !== 1 || spiel.c ? " (es gibt manchmal mehrere richtige Terme)" : ""}.</span>
              <button className="btn" onClick={neuesZiel}>Nächste Welle →</button>
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted max-w-4xl">
          <strong>a</strong> streckt die Welle in die Höhe (Amplitude |a| = {z(Math.abs(p.a), 1)}; ein Minus spiegelt sie an der Mittellinie).{" "}
          <strong>b</strong> staucht sie: Die Periode ist 360° : b = {z(periode, 1)}°.{" "}
          <strong>c</strong> schiebt sie nach rechts, <strong>d</strong> nach oben — die Mittellinie liegt bei y = {z(p.d, 1)}.
          Wertebereich: von {z(p.d - Math.abs(p.a), 1)} bis {z(p.d + Math.abs(p.a), 1)}.
          Die cos-Kurve ist übrigens nur eine verschobene Sinuskurve: cos x = sin(x + 90°) — stell c = 270° ein.
        </p>
      )}
    </div>
  );
}
