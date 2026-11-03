"use client";
/**
 * f(x) = a · g(b · (x − c)) + d mit g = sin, cos, tan, cot, sec oder csc:
 * Funktion wählen, vier Regler, die Grundkurve gestrichelt daneben,
 * Polstellen gestrichelt. Dazu »Welle treffen«: eine Zielkurve nachstellen —
 * erst die richtige Funktion wählen, dann die Regler. Gewertet wird, wie weit
 * die Kurven im Schnitt auseinanderliegen.
 */
import { useState } from "react";
import { Regler } from "@/components/groessen/bausteine";
import { z } from "@/lib/prozent";

const W = 900, H = 340, L = 50, R = 20;
const X = (x: number) => L + (x / 720) * (W - L - R); // 0° … 720°
/** y-Achse je nach gewähltem Bereich ±ym */
const yAchse = (ym: number) => (y: number) => H / 2 - (y / ym) * (H / 2 - 16);
const BEREICHE = [2, 3.5, 6, 10] as const;
const teilung = (ym: number) => (ym <= 2 ? 0.5 : ym <= 3.5 ? 1 : ym <= 6 ? 2 : 2.5);
const RAD = Math.PI / 180;

const FUNKTIONEN = {
  sin: { farbe: "#ef4444", g: (w: number) => Math.sin(w * RAD), periode: 360 },
  cos: { farbe: "#3b82f6", g: (w: number) => Math.cos(w * RAD), periode: 360 },
  tan: { farbe: "#22c55e", g: (w: number) => Math.tan(w * RAD), periode: 180 },
  cot: { farbe: "#a855f7", g: (w: number) => Math.cos(w * RAD) / Math.sin(w * RAD), periode: 180 },
  sec: { farbe: "#06b6d4", g: (w: number) => 1 / Math.cos(w * RAD), periode: 360 },
  csc: { farbe: "#ec4899", g: (w: number) => 1 / Math.sin(w * RAD), periode: 360 },
} as const;
type Fkt = keyof typeof FUNKTIONEN;
const NAMEN = Object.keys(FUNKTIONEN) as Fkt[];
export const LANGNAME: Record<Fkt, string> = {
  sin: "Sinus", cos: "Kosinus", tan: "Tangens = sin : cos",
  cot: "Kotangens = cos : sin = 1 : tan", sec: "Sekans = 1 : cos", csc: "Kosekans = 1 : sin",
};

type P = { fn: Fkt; a: number; b: number; c: number; d: number };
const f = (p: P, x: number) => p.a * FUNKTIONEN[p.fn].g(p.b * (x - p.c)) + p.d;

/** Graph in Stücken: an Polstellen (und weit außerhalb) neu ansetzen. */
function pfad(p: P, ym: number) {
  const Y = yAchse(ym);
  let d = "", neu = true, vorher = 0;
  for (let i = 0; i <= 1440; i++) {
    const x = i / 2, v = f(p, x);
    if (!Number.isFinite(v) || Math.abs(v) > ym * 1.5) { neu = true; continue; }
    if (!neu && Math.abs(v - vorher) > ym) neu = true; // Sprung über eine Polstelle
    d += `${neu ? "M" : "L"} ${X(x).toFixed(1)} ${Y(v).toFixed(1)} `;
    neu = false; vorher = v;
  }
  return d;
}

/** Polstellen in 0° … 720°: wo der Nenner von tan/sec (cos) bzw. cot/csc (sin) null wird. */
function pole(p: P) {
  if (p.fn === "sin" || p.fn === "cos") return [];
  const start = p.fn === "tan" || p.fn === "sec" ? 90 : 0, xs: number[] = [];
  for (let k = -10; k <= 20; k++) {
    const x = p.c + (start + k * 180) / p.b;
    if (x > 0.5 && x < 719.5) xs.push(x);
  }
  return xs;
}

const GRUND = (fn: Fkt): P => ({ fn, a: 1, b: 1, c: 0, d: 0 });
const wahl = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

const ziel = (): P => ({
  fn: wahl(["sin", "sin", "cos", "cos", "tan", "cot", "sec", "csc"] as const),
  a: wahl([0.5, 1, 1.5, 2, 2.5, 3]) * (Math.random() < 0.2 ? -1 : 1),
  b: wahl([0.5, 1, 1.5, 2, 3]),
  c: Math.floor(Math.random() * 12) * 15,
  d: wahl([-1.5, -1, -0.5, 0, 0, 0.5, 1, 1.5]),
});
/** mittlere Abweichung der beiden Kurven, Werte bei ±3,5 gekappt (sonst zählen Polstellen unendlich) */
const abstand = (p: P, q: P) => {
  const kappe = (v: number) => (Number.isFinite(v) ? Math.max(-3.5, Math.min(3.5, v)) : 0);
  let s = 0;
  for (let i = 0; i <= 360; i++) s += Math.abs(kappe(f(p, i * 2)) - kappe(f(q, i * 2)));
  return s / 361;
};

function term(p: P) {
  const a = p.a === 1 ? "" : p.a === -1 ? "−" : `${z(p.a, 2)} · `;
  const b = p.b === 1 ? "" : `${z(p.b, 2)} · `;
  const inner = p.c === 0 ? `${b}x` : `${b}(x − ${p.c}°)`;
  const d = p.d === 0 ? "" : p.d > 0 ? ` + ${z(p.d, 2)}` : ` − ${z(-p.d, 2)}`;
  return `f(x) = ${a}${p.fn}(${inner})${d}`;
}

function Erklaerung({ p }: { p: P }) {
  const periode = FUNKTIONEN[p.fn].periode / Math.abs(p.b);
  const unten = z(p.d - Math.abs(p.a), 1), oben = z(p.d + Math.abs(p.a), 1);
  const welle = p.fn === "sin" || p.fn === "cos";
  return (
    <p className="text-sm text-muted max-w-4xl">
      {welle
        ? <><strong>a</strong> streckt die Welle in die Höhe (Amplitude |a| = {z(Math.abs(p.a), 1)}; ein Minus spiegelt sie an der Mittellinie).{" "}</>
        : <><strong>a</strong> streckt den Graphen in y-Richtung (ein Minus spiegelt ihn) — eine Amplitude gibt es hier nicht, der Graph läuft an den Polstellen ins Unendliche.{" "}</>}
      <strong>b</strong> staucht ihn: Die Periode ist {FUNKTIONEN[p.fn].periode}° : b = {z(periode, 1)}°.{" "}
      <strong>c</strong> schiebt ihn nach rechts, <strong>d</strong> nach oben.{" "}
      {welle && <>Wertebereich: von {unten} bis {oben}. </>}
      {(p.fn === "tan" || p.fn === "cot") && <>Wertebereich: alle reellen Zahlen. </>}
      {(p.fn === "sec" || p.fn === "csc") && <>Wertebereich: bis {unten} und ab {oben} — dazwischen nie. </>}
      {p.fn === "sin" && <>Die cos-Kurve ist nur eine verschobene Sinuskurve: cos x = sin(x + 90°) — stell c = 270° ein.</>}
      {p.fn === "cos" && <>Die Sinuskurve ist eine verschobene cos-Kurve: sin x = cos(x − 90°) — stell c = 90° ein.</>}
      {p.fn === "tan" && <>tan x = sin x : cos x — Polstellen (gestrichelt), wo cos x = 0 ist: bei 90°, 270°, …</>}
      {p.fn === "cot" && <>cot x = cos x : sin x = 1 : tan x — Polstellen, wo sin x = 0 ist: bei 0°, 180°, 360°, …</>}
      {p.fn === "sec" && <>sec x = 1 : cos x — wo cos klein wird, wird sec groß; Polstellen bei 90°, 270°, …</>}
      {p.fn === "csc" && <>csc x = 1 : sin x — wo sin klein wird, wird csc groß; Polstellen bei 0°, 180°, …</>}
    </p>
  );
}

export default function Sinusfunktion() {
  const [p, setP] = useState<P>({ fn: "sin", a: 2, b: 1, c: 0, d: 0 });
  const [spiel, setSpiel] = useState<P | null>(null);
  const [runden, setRunden] = useState<{ punkte: number }[]>([]);
  const [geprueft, setGeprueft] = useState<number | null>(null);
  const [ym, setYm] = useState(3.5);
  const Y = yAchse(ym), YM = ym;
  // tan & Co. laufen ins Unendliche — beim Umschalten weiter herauszoomen
  const waehle = (fn: Fkt) => {
    setP({ ...p, fn }); setGeprueft(null);
    if (fn !== "sin" && fn !== "cos" && ym < 6) setYm(6);
    if ((fn === "sin" || fn === "cos") && ym > 3.5) setYm(3.5);
  };
  const setze = (k: "a" | "b" | "c" | "d") => (v: number) => { setP({ ...p, [k]: v }); setGeprueft(null); };

  const neuesZiel = () => { setSpiel(ziel()); setP(GRUND("sin")); setGeprueft(null); };
  const pruefen = () => {
    if (!spiel) return;
    const d = abstand(p, spiel), punkte = Math.max(0, Math.round(100 - d * 80));
    setGeprueft(punkte);
    setRunden(r => [...r, { punkte }]);
  };
  const periode = FUNKTIONEN[p.fn].periode / Math.abs(p.b);
  const farbe = FUNKTIONEN[p.fn].farbe;

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button className={`chip ${!spiel ? "chip-on" : ""}`} onClick={() => { setSpiel(null); setGeprueft(null); }}>🔍 Ausprobieren</button>
        <button className={`chip ${spiel ? "chip-on" : ""}`} onClick={neuesZiel}>🎯 Welle treffen</button>
        {spiel && runden.length > 0 && (
          <span className="text-sm text-muted">{runden.length} Wellen · {runden.reduce((s, r) => s + r.punkte, 0)} Punkte · Schnitt {Math.round(runden.reduce((s, r) => s + r.punkte, 0) / runden.length)}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Funktion">
        {NAMEN.map(k => (
          <button key={k} type="button" aria-pressed={p.fn === k} onClick={() => waehle(k)} title={LANGNAME[k]}
            className="rounded-lg border-2 px-3 py-1 font-black"
            style={{ borderColor: FUNKTIONEN[k].farbe, color: p.fn === k ? "#fff" : FUNKTIONEN[k].farbe, background: p.fn === k ? FUNKTIONEN[k].farbe : "transparent" }}>
            {k}
          </button>
        ))}
        <span className="flex-1" />
        <span className="flex items-center gap-1.5 text-sm">
          <span className="text-muted">y-Bereich ±</span>
          {BEREICHE.map(b => (
            <button key={b} type="button" className={`chip ${ym === b ? "chip-on" : ""}`} aria-pressed={ym === b} onClick={() => setYm(b)}>{z(b, 1)}</button>
          ))}
        </span>
      </div>
      <p className="text-xl sm:text-2xl font-black text-center">{term(p)}</p>
      <div className="flex flex-wrap gap-4">
        <Regler label="a (Streckung in y-Richtung)" wert={p.a} setze={setze("a")} min={-3} max={3} step={0.5} breit />
        <Regler label="b (Frequenz)" wert={p.b} setze={setze("b")} min={0.5} max={4} step={0.5} breit />
        <Regler label="c (Verschiebung nach rechts, °)" wert={p.c} setze={setze("c")} min={0} max={360} step={15} breit />
        <Regler label="d (Verschiebung nach oben)" wert={p.d} setze={setze("d")} min={-2} max={2} step={0.5} breit />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[calc(100vh-8rem)]" role="img" aria-label="Graph der Funktion">
        <defs><clipPath id="sf-bild"><rect x={L} y={0} width={W - L - R} height={H} /></clipPath></defs>
        {Array.from({ length: 2 * Math.floor(ym / teilung(ym)) + 1 }, (_, i) => (i - Math.floor(ym / teilung(ym))) * teilung(ym)).filter(v => v !== 0).map(v => (
          <g key={v}>
            <line x1={L} y1={Y(v)} x2={W - R} y2={Y(v)} stroke="var(--border)" strokeOpacity={0.5} />
            <text x={L - 8} y={Y(v)} textAnchor="end" dominantBaseline="central" fontSize={12} fill="var(--text-muted)">{z(v, 1)}</text>
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
        <g clipPath="url(#sf-bild)">
          {spiel
            ? <path d={pfad(spiel, ym)} fill="none" stroke="#f59e0b" strokeWidth={10} strokeOpacity={0.35} strokeLinecap="round" />
            : <path d={pfad(GRUND(p.fn), ym)} fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="6 5" />}
          {!spiel && pole(p).map(x => <line key={x} x1={X(x)} y1={Y(YM)} x2={X(x)} y2={Y(-YM)} stroke={farbe} strokeOpacity={0.5} strokeDasharray="8 5" />)}
          {!spiel && p.d !== 0 && <line x1={L} y1={Y(p.d)} x2={W - R} y2={Y(p.d)} stroke="#a855f7" strokeDasharray="4 4" />}
          <path d={pfad(p, ym)} fill="none" stroke={farbe} strokeWidth={3} />
        </g>
        {!spiel && p.c + periode <= 720 && (
          <g>
            <line x1={X(p.c)} y1={Y(-YM * 0.92)} x2={X(p.c + periode)} y2={Y(-YM * 0.92)} stroke="#3b82f6" strokeWidth={2} />
            <text x={X(p.c + periode / 2)} y={Y(-YM * 0.92) - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="#3b82f6">Periode {z(periode, 1)}°</text>
          </g>
        )}
      </svg>
      {spiel ? (
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm">Wähle die passende Funktion und stelle die Kurve so ein, dass sie auf der breiten orangen Kurve liegt.</span>
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
      ) : <Erklaerung p={p} />}
    </div>
  );
}
