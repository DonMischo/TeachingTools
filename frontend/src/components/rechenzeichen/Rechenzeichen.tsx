"use client";
/**
 * Rechenzeichen — was bedeuten + − · : ² ³ √ < > ≤ ≥ ∫ und f′?
 *
 * Jedes Zeichen bekommt ein Bild zum Anfassen: Plus legt Äpfel dazu, Minus
 * nimmt welche weg, Mal legt Reihen, Geteilt verteilt auf Teller, ² ist ein
 * Quadrat aus Kästchen, ³ ein Würfel aus Würfelchen, √ sucht die Seite zum
 * Quadrat, < und > vergleichen, ≤ und ≥ markieren Zahlen auf dem Zahlenstrahl.
 * Für die Oberstufe: ∫ als Summe dünner Streifen, f′ als Steigung der Tangente.
 */
import { useState, type ReactNode } from "react";
import { AbspielKnopf, Dinge, Regler, Wuerfel, feld, useZaehler, wuerfelMass } from "@/components/groessen/bausteine";
import { Ableitung, Integral } from "./Analysis";

type Id = "plus" | "minus" | "mal" | "geteilt" | "quadrat" | "hoch3" | "wurzel" | "vergleich" | "zahlenstrahl" | "integral" | "ableitung";

const ZEICHEN: { id: Id; zeichen: string; name: string }[] = [
  { id: "plus", zeichen: "+", name: "plus" },
  { id: "minus", zeichen: "−", name: "minus" },
  { id: "mal", zeichen: "·", name: "mal" },
  { id: "geteilt", zeichen: ":", name: "geteilt" },
  { id: "quadrat", zeichen: "x²", name: "hoch zwei" },
  { id: "hoch3", zeichen: "x³", name: "hoch drei" },
  { id: "wurzel", zeichen: "√", name: "Wurzel" },
  { id: "vergleich", zeichen: "< >", name: "kleiner, größer" },
  { id: "zahlenstrahl", zeichen: "≤ ≥", name: "kleiner gleich" },
  { id: "integral", zeichen: "∫", name: "Integral" },
  { id: "ableitung", zeichen: "f′", name: "Ableitung" },
];

const APFEL = "🍎";

function Tafel({ children }: { children: ReactNode }) {
  return <p className="text-center text-2xl sm:text-3xl font-black tracking-tight">{children}</p>;
}
function Erklaerung({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted text-center max-w-3xl mx-auto">{children}</p>;
}
function Regelzeile({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-4 items-end">{children}</div>;
}

/* ───────────────────────────────────────────── + − · : ── */

function Plus() {
  const [a, setA] = useState(3), [b, setB] = useState(5);
  const fa = feld(a), fb = feld(b), fs = feld(a + b);
  const gap = 56, W = fa.w + fb.w + fs.w + 2 * gap + 80, H = Math.max(fa.h, fb.h, fs.h) + 20;
  const x2 = fa.w + gap, x3 = x2 + fb.w + gap + 40;
  return (
    <>
      <Regelzeile>
        <Regler label="erste Zahl" wert={a} setze={setA} min={0} max={10} />
        <Regler label="zweite Zahl" wert={b} setze={setB} min={0} max={10} />
      </Regelzeile>
      <svg viewBox={`-10 -10 ${W} ${H}`} className="w-full h-auto max-h-[40vh]">
        <Dinge n={a} emoji={APFEL} />
        <text x={fa.w + gap / 2} y={H / 2 - 10} textAnchor="middle" dominantBaseline="central" fontSize={48} fontWeight={900} fill="var(--text)">+</text>
        <Dinge n={b} emoji={APFEL} x={x2} blau={b} />
        <text x={x2 + fb.w + gap / 2 + 20} y={H / 2 - 10} textAnchor="middle" dominantBaseline="central" fontSize={48} fontWeight={900} fill="var(--text)">=</text>
        <Dinge n={a + b} emoji={APFEL} x={x3} blau={b} />
      </svg>
      <Tafel>{a} + {b} = {a + b}</Tafel>
      <Erklaerung>Plus heißt <strong>dazulegen</strong>: zwei Häufchen werden eins. Man zählt einfach alle zusammen — egal, welches Häufchen zuerst kommt: {a} + {b} = {b} + {a}.</Erklaerung>
    </>
  );
}

function Minus() {
  const [a, setA] = useState(8), [b, setB] = useState(3);
  const bb = Math.min(a, b);
  const fa = feld(a), fr = feld(a - bb);
  const gap = 70, W = fa.w + fr.w + gap + 20, H = Math.max(fa.h, fr.h) + 20;
  return (
    <>
      <Regelzeile>
        <Regler label="so viele sind da" wert={a} setze={n => { setA(n); setB(x => Math.min(x, n)); }} min={0} max={20} />
        <Regler label="so viele kommen weg" wert={bb} setze={setB} min={0} max={a} />
      </Regelzeile>
      <svg viewBox={`-10 -10 ${W} ${H}`} className="w-full h-auto max-h-[40vh]">
        <Dinge n={a} emoji={APFEL} weg={bb} />
        <text x={fa.w + gap / 2} y={H / 2 - 10} textAnchor="middle" dominantBaseline="central" fontSize={44} fontWeight={900} fill="var(--text)">→</text>
        <Dinge n={a - bb} emoji={APFEL} x={fa.w + gap} />
      </svg>
      <Tafel>{a} − {bb} = {a - bb}</Tafel>
      <Erklaerung>Minus heißt <strong>wegnehmen</strong>: von {a} Äpfeln werden {bb} gegessen (durchgestrichen). Was übrig bleibt, ist das Ergebnis. Anders als bei Plus darf man hier nicht tauschen.</Erklaerung>
    </>
  );
}

function Mal() {
  const [a, setA] = useState(3), [b, setB] = useState(4);
  const size = 40, pad = 10;
  const W = b * size + 2 * pad + 220, H = a * (size + 2 * pad + 8);
  return (
    <>
      <Regelzeile>
        <Regler label="so viele Reihen" wert={a} setze={setA} min={1} max={6} />
        <Regler label="so viele in jeder Reihe" wert={b} setze={setB} min={1} max={10} />
        <button className="btn" onClick={() => { setA(b > 6 ? 6 : b); setB(a); }}>🔄 Drehen (Reihen ↔ Spalten)</button>
      </Regelzeile>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[45vh]">
        {Array.from({ length: a }, (_, r) => {
          const y = r * (size + 2 * pad + 8);
          return (
            <g key={r}>
              <rect x={0} y={y} width={b * size + 2 * pad} height={size + 2 * pad} rx={12} fill="none" stroke="#a16207" strokeWidth={3} />
              <Dinge n={b} emoji={APFEL} x={pad} y={y + pad} spalten={b} />
              <text x={b * size + 2 * pad + 20} y={y + pad + size / 2} dominantBaseline="central" fontSize={22} fontWeight={800}
                fill="var(--text-muted)">{r + 1}. Reihe: {b * (r + 1)}</text>
            </g>
          );
        })}
      </svg>
      <Tafel>{a} · {b} = {Array.from({ length: a }, () => b).join(" + ")} = {a * b}</Tafel>
      <Erklaerung>Mal heißt <strong>mehrmals dasselbe</strong>: {a}-mal eine Reihe mit {b} Äpfeln. Statt {a}-mal {b} zu addieren, rechnet man {a} · {b}. Dreht man das Bild, werden aus Reihen Spalten — die Äpfel bleiben dieselben: {a} · {b} = {b} · {a}.</Erklaerung>
    </>
  );
}

function Geteilt() {
  const [n, setN] = useState(12), [k, setK] = useState(3);
  const [verteilt, setVerteilt, laeuft, start] = useZaehler(n, 450);
  const q = Math.floor(n / k), r = n % k;
  const size = 34, tw = Math.max(3, Math.ceil((q + 1) / 3)) * size + 20, th = 3 * size + 20;
  const pro = Array.from({ length: k }, (_, t) => Math.floor(verteilt / k) + (t < verteilt % k ? 1 : 0));
  const W = Math.max(k * (tw + 16), 400), H = th + 120;
  const rest = n - verteilt;
  return (
    <>
      <Regelzeile>
        <Regler label="so viele Äpfel" wert={n} setze={x => { setN(x); setVerteilt(0); }} min={1} max={30} />
        <Regler label="auf so viele Teller" wert={k} setze={x => { setK(x); setVerteilt(0); }} min={1} max={6} />
        <AbspielKnopf laeuft={laeuft} start={start} fertig={verteilt >= n} />
      </Regelzeile>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[45vh]">
        {/* noch nicht verteilt */}
        <Dinge n={Math.min(rest, 15)} emoji={APFEL} size={28} spalten={15} x={(W - Math.min(rest, 15) * 28) / 2} y={0} />
        {rest > 15 && <text x={W / 2} y={44} textAnchor="middle" fontSize={14} fill="var(--text-muted)">… und noch {rest - 15}</text>}
        {pro.map((m, t) => {
          const x = t * (tw + 16) + (W - k * (tw + 16) + 16) / 2;
          return (
            <g key={t}>
              <ellipse cx={x + tw / 2} cy={70 + th / 2} rx={tw / 2} ry={th / 2} fill="var(--surface-hover)" stroke="var(--border)" strokeWidth={3} />
              <Dinge n={m} emoji={APFEL} size={size} spalten={Math.max(3, Math.ceil((q + 1) / 3))} x={x + 10} y={70 + 10} />
              <text x={x + tw / 2} y={70 + th + 24} textAnchor="middle" fontSize={18} fontWeight={800} fill="var(--text)">{m}</text>
            </g>
          );
        })}
      </svg>
      <Tafel>{n} : {k} = {q}{r ? ` Rest ${r}` : ""}</Tafel>
      <Erklaerung>
        Geteilt heißt <strong>gerecht verteilen</strong>: reihum bekommt jeder Teller einen Apfel, bis keiner mehr für alle reicht.
        Jeder Teller hat dann {q}{r ? `, und ${r} ${r === 1 ? "Apfel bleibt" : "Äpfel bleiben"} übrig — der Rest` : " — es geht genau auf"}.
        Probe: {k} · {q}{r ? ` + ${r}` : ""} = {n}.
      </Erklaerung>
    </>
  );
}

/* ───────────────────────────────────────────── ² ³ √ ── */

function Quadrat() {
  const [n, setN] = useState(4);
  const [reihen, setReihen, laeuft, start] = useZaehler(n, 500);
  const s = 36, W = n * s + 80, H = n * s + 70;
  return (
    <>
      <Regelzeile>
        <Regler label="Seite n" wert={n} setze={x => { setN(x); setReihen(x); }} min={1} max={10} />
        <AbspielKnopf laeuft={laeuft} start={start} fertig={reihen >= n} />
      </Regelzeile>
      <svg viewBox={`-40 -10 ${W} ${H}`} className="w-full h-auto max-h-[50vh]">
        {Array.from({ length: n * n }, (_, i) => {
          const r = Math.floor(i / n), c = i % n;
          const voll = r < reihen;
          return <rect key={i} x={c * s} y={r * s} width={s - 3} height={s - 3} rx={4}
            fill="#22c55e" fillOpacity={voll ? 0.75 : 0.08} stroke="#22c55e" strokeWidth={1.5} />;
        })}
        <text x={(n * s) / 2} y={n * s + 26} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--text)">n = {n}</text>
        <text x={-14} y={(n * s) / 2} textAnchor="end" dominantBaseline="central" fontSize={22} fontWeight={800} fill="var(--text)">{n}</text>
      </svg>
      <Tafel>{n}² = {n} · {n} = {n * n}{reihen < n ? <span className="text-muted text-xl"> (gezählt: {reihen} · {n} = {reihen * n})</span> : null}</Tafel>
      <Erklaerung>
        Die kleine 2 heißt <strong>hoch zwei</strong> oder <strong>zum Quadrat</strong>: die Zahl mal sich selbst.
        Das Bild dazu ist ein Quadrat mit der Seite {n} — es besteht aus {n} Reihen mit je {n} Kästchen. Darum heißt die Fläche des Quadrats A = a².
      </Erklaerung>
    </>
  );
}

function Hoch3() {
  const [n, setN] = useState(3);
  const [schichten, setSchichten, laeuft, start] = useZaehler(n, 700);
  const s = n > 4 ? 26 : 38;
  const m = wuerfelMass(n, s);
  return (
    <>
      <Regelzeile>
        <Regler label="Kante n" wert={n} setze={x => { setN(x); setSchichten(x); }} min={1} max={6} />
        <Regler label="Schichten" wert={schichten} setze={setSchichten} min={0} max={n} />
        <AbspielKnopf laeuft={laeuft} start={start} fertig={schichten >= n} />
      </Regelzeile>
      <svg viewBox={`-20 -20 ${m.w + 40} ${m.h + 40}`} className="w-full h-auto max-h-[50vh]">
        <Wuerfel n={n} hoch={schichten} s={s} ox={m.ox} oy={m.oy} farbe="#8b5cf6" rahmen />
      </svg>
      <Tafel>{n}³ = {n} · {n} · {n} = {n ** 3}{schichten < n ? <span className="text-muted text-xl"> (bisher {schichten} {schichten === 1 ? "Schicht" : "Schichten"} · {n * n} = {schichten * n * n})</span> : null}</Tafel>
      <Erklaerung>
        Die kleine 3 heißt <strong>hoch drei</strong>: dreimal dieselbe Zahl malnehmen. Das Bild dazu ist ein Würfel mit der Kante {n}:
        jede Schicht ist ein Quadrat aus {n} · {n} = {n * n} Würfelchen, und es gibt {n} Schichten. Darum ist das Volumen des Würfels V = a³.
      </Erklaerung>
    </>
  );
}

function Wurzel() {
  const [A, setA] = useState(20);
  const w = Math.sqrt(A), s0 = Math.floor(w), rest = A - s0 * s0;
  const s = 30, N = Math.ceil(w) + 1, W = N * s + 60, H = N * s + 60;
  // Die übrigen Kästchen legen wir als angefangene Spalte rechts und Reihe unten an.
  const extra: { x: number; y: number }[] = [];
  for (let i = 0; i < rest; i++) {
    if (i < s0 + 1) extra.push(i <= s0 - 1 ? { x: s0, y: i } : { x: s0, y: s0 });
    else extra.push({ x: i - s0 - 1, y: s0 });
  }
  return (
    <>
      <Regelzeile>
        <Regler label="Fläche (Kästchen)" wert={A} setze={setA} min={1} max={100} breit />
      </Regelzeile>
      <svg viewBox={`-30 -10 ${W} ${H}`} className="w-full h-auto max-h-[50vh]">
        {Array.from({ length: s0 * s0 }, (_, i) => (
          <rect key={i} x={(i % s0) * s} y={Math.floor(i / s0) * s} width={s - 3} height={s - 3} rx={3} fill="#0ea5e9" fillOpacity={0.7} />
        ))}
        {extra.map((p, i) => (
          <rect key={`e${i}`} x={p.x * s} y={p.y * s} width={s - 3} height={s - 3} rx={3} fill="#f59e0b" fillOpacity={0.7} />
        ))}
        {/* Das echte Quadrat mit genau A Kästchen Fläche */}
        <rect x={0} y={0} width={w * s - 3} height={w * s - 3} fill="none" stroke="var(--text)" strokeWidth={3} strokeDasharray={rest ? "8 5" : undefined} />
        <text x={(w * s) / 2} y={w * s + 24} textAnchor="middle" fontSize={20} fontWeight={800} fill="var(--text)">
          {rest ? `≈ ${w.toFixed(2).replace(".", ",")}` : s0}
        </text>
      </svg>
      <Tafel>√{A} {rest ? `≈ ${w.toFixed(2).replace(".", ",")}` : `= ${s0}`}</Tafel>
      <Erklaerung>
        Die Wurzel fragt rückwärts: <strong>welche Seite hat ein Quadrat mit {A} Kästchen?</strong>{" "}
        {rest
          ? <>Mit {A} Kästchen gelingt kein ganzes Quadrat: {s0} · {s0} = {s0 * s0} ist zu wenig, {s0 + 1} · {s0 + 1} = {(s0 + 1) ** 2} zu viel. Die Seite liegt also zwischen {s0} und {s0 + 1} (gestrichelt).</>
          : <>Genau {s0} · {s0} = {A} — die Wurzel ist {s0}. Wurzel ziehen macht das Hoch-zwei rückgängig.</>}
      </Erklaerung>
    </>
  );
}

/* ───────────────────────────────────────────── < > ≤ ≥ ── */

const ZSW = 900, ZS0 = 40;
const zx = (v: number) => ZS0 + (v / 20) * (ZSW - 2 * ZS0);

function Strahl({ children }: { children?: ReactNode }) {
  return (
    <>
      <line x1={ZS0 - 15} y1={60} x2={ZSW - ZS0 + 25} y2={60} stroke="var(--text-muted)" strokeWidth={3} />
      <path d={`M ${ZSW - ZS0 + 25} 52 L ${ZSW - ZS0 + 38} 60 L ${ZSW - ZS0 + 25} 68 z`} fill="var(--text-muted)" />
      {Array.from({ length: 21 }, (_, i) => (
        <g key={i}>
          <line x1={zx(i)} y1={i % 5 ? 53 : 48} x2={zx(i)} y2={i % 5 ? 67 : 72} stroke="var(--text-muted)" strokeWidth={2} />
          <text x={zx(i)} y={92} textAnchor="middle" fontSize={16} fontWeight={i % 5 ? 500 : 800} fill="var(--text)">{i}</text>
        </g>
      ))}
      {children}
    </>
  );
}

function Vergleich() {
  const [a, setA] = useState(4), [b, setB] = useState(9);
  const z = a < b ? "<" : a > b ? ">" : "=";
  const sh = 14, H = 120 + 20 * sh;
  return (
    <>
      <Regelzeile>
        <Regler label="linke Zahl" wert={a} setze={setA} min={0} max={20} />
        <Regler label="rechte Zahl" wert={b} setze={setB} min={0} max={20} />
      </Regelzeile>
      <div className="grid sm:grid-cols-[1fr_auto_1fr] items-end gap-4">
        <svg viewBox={`0 0 200 ${H}`} className="w-full h-auto max-h-[38vh]">
          <rect x={60} y={H - 20 - a * sh} width={80} height={a * sh} rx={6} fill="#f97316" />
          <text x={100} y={H - 2} textAnchor="middle" fontSize={22} fontWeight={900} fill="var(--text)">{a}</text>
        </svg>
        <div className="text-8xl font-black text-center leading-none" style={{ color: z === "=" ? "#22c55e" : "#38bdf8" }}>{z}</div>
        <svg viewBox={`0 0 200 ${H}`} className="w-full h-auto max-h-[38vh]">
          <rect x={60} y={H - 20 - b * sh} width={80} height={b * sh} rx={6} fill="#3b82f6" />
          <text x={100} y={H - 2} textAnchor="middle" fontSize={22} fontWeight={900} fill="var(--text)">{b}</text>
        </svg>
      </div>
      <svg viewBox={`0 0 ${ZSW} 110`} className="w-full h-auto">
        <Strahl>
          <circle cx={zx(a)} cy={60} r={11} fill="#f97316" />
          <circle cx={zx(b)} cy={60} r={a === b ? 6 : 11} fill="#3b82f6" />
        </Strahl>
      </svg>
      <Tafel>{a} {z} {b}</Tafel>
      <Erklaerung>
        <strong>{"<"} heißt »kleiner als«, {">"} heißt »größer als«.</strong> Die offene Seite zeigt immer zur größeren Zahl, die Spitze zur kleineren — wie ein Krokodil, das die größere Zahl fressen will.
        Auf dem Zahlenstrahl steht die kleinere Zahl weiter links.
      </Erklaerung>
    </>
  );
}

function Zahlenstrahl({ anfang }: { anfang: "≤" | "≥" }) {
  const [rel, setRel] = useState<"<" | "≤" | ">" | "≥">(anfang);
  const [g, setG] = useState(7);
  const passt = (x: number) => (rel === "<" ? x < g : rel === "≤" ? x <= g : rel === ">" ? x > g : x >= g);
  const mit = rel === "≤" || rel === "≥";
  const links = rel === "<" || rel === "≤";
  const loesung = Array.from({ length: 21 }, (_, i) => i).filter(passt);
  return (
    <>
      <Regelzeile>
        <div className="inline-flex rounded-xl border border-line p-1 bg-surface">
          {(["<", "≤", ">", "≥"] as const).map(r => (
            <button key={r} onClick={() => setRel(r)}
              className={`px-4 py-1 rounded-lg text-2xl font-black ${rel === r ? "bg-accent text-accent-fg" : "text-muted"}`}>{r}</button>
          ))}
        </div>
        <Regler label="Grenze" wert={g} setze={setG} min={0} max={20} breit />
      </Regelzeile>
      <svg viewBox={`0 0 ${ZSW} 110`} className="w-full h-auto">
        <Strahl>
          {/* Bereich als Balken: offener Rand bei < und >, voller bei ≤ und ≥ */}
          <line x1={zx(g)} y1={30} x2={links ? zx(0) - 15 : zx(20) + 25} y2={30} stroke="#22c55e" strokeWidth={6} strokeLinecap="round" />
          <circle cx={zx(g)} cy={30} r={9} fill={mit ? "#22c55e" : "var(--surface)"} stroke="#22c55e" strokeWidth={4} />
          {loesung.map(x => <circle key={x} cx={zx(x)} cy={60} r={8} fill="#22c55e" />)}
          {!mit && <circle cx={zx(g)} cy={60} r={8} fill="var(--surface)" stroke="#ef4444" strokeWidth={3} />}
        </Strahl>
      </svg>
      <Tafel>x {rel} {g}</Tafel>
      <Erklaerung>
        {rel === "<" && <>»x ist <strong>kleiner als</strong> {g}«: alle Zahlen links von {g}. Die {g} selbst gehört <strong>nicht</strong> dazu — darum der offene Kreis.</>}
        {rel === "≤" && <>»x ist <strong>kleiner oder gleich</strong> {g}«: alle Zahlen links von {g} — <strong>und</strong> die {g} selbst. Der Strich unter dem {"<"} ist ein halbes Gleichheitszeichen; darum der volle Kreis.</>}
        {rel === ">" && <>»x ist <strong>größer als</strong> {g}«: alle Zahlen rechts von {g}. Die {g} selbst gehört <strong>nicht</strong> dazu — darum der offene Kreis.</>}
        {rel === "≥" && <>»x ist <strong>größer oder gleich</strong> {g}«: alle Zahlen rechts von {g} — <strong>und</strong> die {g} selbst. Der Strich unter dem {">"} ist ein halbes Gleichheitszeichen; darum der volle Kreis.</>}
        {" "}Natürliche Zahlen bis 20, die passen: {loesung.length ? loesung.join(", ") : "keine"}.
      </Erklaerung>
    </>
  );
}

/* ───────────────────────────────────────────── Werkzeug ── */

export default function Rechenzeichen({ action }: { action?: ReactNode }) {
  const [id, setId] = useState<Id>("plus");
  const z = ZEICHEN.find(x => x.id === id)!;
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">➗ Rechenzeichen</h1>
          <p className="text-muted text-sm mt-1">
            Was bedeutet eigentlich + − · : ² ³ √ &lt; &gt; ≤ ≥ — und für später ∫ und f′? Zu jedem Zeichen ein Bild zum Anfassen.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ZEICHEN.map(x => (
          <button key={x.id} onClick={() => setId(x.id)} title={x.name}
            className={`min-w-14 px-3 py-1.5 rounded-xl border text-2xl font-black transition-colors ${
              id === x.id ? "border-accent bg-accent text-accent-fg" : "border-line hover:border-accent"
            }`}>
            {x.zeichen}
          </button>
        ))}
      </div>

      <div className="card p-4 sm:p-6 flex flex-col gap-4" key={id}>
        <div className="text-xs font-bold uppercase tracking-wide text-muted">{z.zeichen} — {z.name}</div>
        {id === "plus" && <Plus />}
        {id === "minus" && <Minus />}
        {id === "mal" && <Mal />}
        {id === "geteilt" && <Geteilt />}
        {id === "quadrat" && <Quadrat />}
        {id === "hoch3" && <Hoch3 />}
        {id === "wurzel" && <Wurzel />}
        {id === "vergleich" && <Vergleich />}
        {id === "zahlenstrahl" && <Zahlenstrahl anfang="≤" />}
        {id === "integral" && <Integral />}
        {id === "ableitung" && <Ableitung />}
      </div>
    </div>
  );
}
