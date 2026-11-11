"use client";
/**
 * Rohrpost-Zentrale: Weichen stellen, Büchse mit Druckluft losschicken.
 * Netz als Baum: Zentrale → Weiche 1 → (Weiche 2 | Weiche 3) → … → Postämter.
 */
import { useEffect, useRef, useState } from "react";
import { rauschen, ton } from "./ton";
import { useErprobt } from "@/lib/medien/erprobt";

type Pt = { x: number; y: number };
export type Amt = "alex" | "potsdamer" | "zoo" | "moabit" | "kreuzberg";

const ZENTRALE: Pt = { x: 34, y: 180 };
/** Weichen: Position und Ziel bei »oben« (true) bzw. »unten« (false) — Weiche (Zahl) oder Amt */
const WEICHEN: { pos: Pt; oben: number | Amt; unten: number | Amt }[] = [
  { pos: { x: 120, y: 180 }, oben: 1, unten: 2 },
  { pos: { x: 230, y: 112 }, oben: 3, unten: "moabit" },
  { pos: { x: 230, y: 250 }, oben: "zoo", unten: "kreuzberg" },
  { pos: { x: 350, y: 62 }, oben: "alex", unten: "potsdamer" },
];
const AEMTER: Record<Amt, { name: string; pos: Pt }> = {
  alex: { name: "Alexanderplatz", pos: { x: 540, y: 30 } },
  potsdamer: { name: "Potsdamer Platz", pos: { x: 540, y: 94 } },
  moabit: { name: "Moabit", pos: { x: 540, y: 158 } },
  zoo: { name: "Zoo", pos: { x: 540, y: 222 } },
  kreuzberg: { name: "Kreuzberg", pos: { x: 540, y: 300 } },
};
const AMT_IDS = Object.keys(AEMTER) as Amt[];
const ANZAHL = 5;

const posVon = (z: number | Amt): Pt => (typeof z === "number" ? WEICHEN[z].pos : AEMTER[z].pos);

/** Weg der Büchse (Eckpunkte) und Zielamt für eine Weichenstellung (true = oben) */
export function weg(weichen: boolean[]): { punkte: Pt[]; ziel: Amt } {
  const punkte: Pt[] = [ZENTRALE];
  let k: number | Amt = 0;
  while (typeof k === "number") {
    punkte.push(WEICHEN[k].pos);
    k = weichen[k] ? WEICHEN[k].oben : WEICHEN[k].unten;
  }
  punkte.push(AEMTER[k].pos);
  return { punkte, ziel: k };
}
export const ziel = (weichen: boolean[]): Amt => weg(weichen).ziel;

const LOB = [
  "Büchse sauber angekommen! Der Beamte winkt mit dem Hut.",
  "Volltreffer! Das Postfräulein klatscht in die Hände.",
  "Zack, richtig! Die Druckluft ist stolz auf dich.",
  "Perfekt zugestellt, noch bevor der Kaffee kalt wurde.",
];
const DINGE = [
  "einen Liebesbrief",
  "eine Geburtstagseinladung",
  "eine Mahnung vom Finanzamt",
  "ein Rezept für Streuselkuchen",
];
const meckern = (falsch: Amt, soll: Amt) => {
  const ding = DINGE[(falsch.length + soll.length) % DINGE.length];
  return `${AEMTER[falsch].name} hat jetzt ${ding}, was nach ${AEMTER[soll].name} sollte. Das gibt Ärger!`;
};

const laenge = (p: Pt[]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - p[i].x, q.y - p[i].y), 0);
const punktBei = (p: Pt[], d: number): Pt => {
  for (let i = 1; i < p.length; i++) {
    const l = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    if (d <= l) {
      const t = l ? d / l : 0;
      return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * t, y: p[i - 1].y + (p[i].y - p[i - 1].y) * t };
    }
    d -= l;
  }
  return p[p.length - 1];
};

const zufallsAmt = (): Amt => AMT_IDS[Math.floor(Math.random() * AMT_IDS.length)];

export function RohrpostDemo() {
  const erprobt = useErprobt();
  const [weichen, setWeichen] = useState<boolean[]>([true, true, true, true]);
  const [runde, setRunde] = useState(0);
  const [soll, setSoll] = useState<Amt>(zufallsAmt);
  const [phase, setPhase] = useState<"wahl" | "flug" | "ankunft" | "fertig">("wahl");
  const [richtig, setRichtig] = useState(0);
  const [punkte, setPunkte] = useState(0);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [kapsel, setKapsel] = useState<Pt>(ZENTRALE);
  const [sek, setSek] = useState(0);
  const start = useRef(Date.now());
  const raf = useRef(0);

  useEffect(() => {
    if (phase === "fertig") return;
    const id = setInterval(() => setSek(Math.floor((Date.now() - start.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const umlegen = (i: number) => {
    if (phase !== "wahl") return;
    ton(520, 0.05, 0, "square", 0.06);
    setWeichen(w => w.map((v, j) => (j === i ? !v : v)));
  };

  const los = () => {
    if (phase !== "wahl") return;
    const { punkte: pp, ziel: z } = weg(weichen);
    const gesamt = laenge(pp);
    setPhase("flug");
    rauschen(Math.min(2.2, gesamt / 260), 0, 0.12, { freq: 900, q: 0.8 });
    const t0 = performance.now();
    const schritt = (jetzt: number) => {
      const d = ((jetzt - t0) / 1000) * 260;
      if (d >= gesamt) {
        setKapsel(pp[pp.length - 1]);
        const ok = z === soll;
        ton(ok ? 880 : 200, 0.25, 0, ok ? "triangle" : "sawtooth", 0.1);
        if (ok) {
          setRichtig(r => {
            if (r + 1 >= 3) erprobt("rohrpost");
            return r + 1;
          });
          setPunkte(p => p + 100);
          setMeldung({ ok, text: LOB[runde % LOB.length] });
        } else {
          setMeldung({ ok, text: meckern(z, soll) });
        }
        setPhase("ankunft");
        return;
      }
      setKapsel(punktBei(pp, d));
      raf.current = requestAnimationFrame(schritt);
    };
    raf.current = requestAnimationFrame(schritt);
  };

  const weiter = () => {
    if (runde + 1 >= ANZAHL) {
      setPhase("fertig");
      return;
    }
    setRunde(r => r + 1);
    setSoll(zufallsAmt());
    setKapsel(ZENTRALE);
    setMeldung(null);
    setPhase("wahl");
  };

  const neu = () => {
    cancelAnimationFrame(raf.current);
    setRunde(0);
    setSoll(zufallsAmt());
    setRichtig(0);
    setPunkte(0);
    setKapsel(ZENTRALE);
    setMeldung(null);
    setWeichen([true, true, true, true]);
    start.current = Date.now();
    setSek(0);
    setPhase("wahl");
  };

  const kante = (a: Pt, b: Pt, an: boolean, k: string) => (
    <line
      key={k}
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={an ? "#f59e0b" : "#94a3b8"}
      strokeWidth={an ? 7 : 4}
      strokeLinecap="round"
      opacity={an ? 1 : 0.55}
      strokeDasharray={an ? undefined : "2 7"}
    />
  );

  return (
    <div className="card space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="chip chip-on">Büchse {Math.min(runde + 1, ANZAHL)} / {ANZAHL}</span>
        <span>Punkte: <b>{punkte}</b></span>
        <span className="text-muted">Zeit: {sek} s</span>
      </div>

      <div className="rounded border border-line bg-surface p-2 text-sm">
        📨 <b>Adresse auf der Büchse:</b> »Postamt {AEMTER[soll].name}« — stell die Weichen (anklicken) und drück dann auf Druckluft.
      </div>

      <svg viewBox="0 0 640 330" className="w-full rounded bg-surface-hover" role="group" aria-label="Rohrpost-Netz mit vier Weichen und fünf Postämtern">
        {kante(ZENTRALE, WEICHEN[0].pos, true, "wurzel")}
        {WEICHEN.map((w, i) => [
          kante(w.pos, posVon(w.oben), weichen[i], `o${i}`),
          kante(w.pos, posVon(w.unten), !weichen[i], `u${i}`),
        ])}
        <g>
          <rect x={4} y={150} width={60} height={60} rx={8} fill="#475569" />
          <text x={34} y={176} textAnchor="middle" fontSize="10" fill="#fff">Haupt-</text>
          <text x={34} y={190} textAnchor="middle" fontSize="10" fill="#fff">telegrafen-</text>
          <text x={34} y={204} textAnchor="middle" fontSize="10" fill="#fff">amt</text>
        </g>
        {AMT_IDS.map(id => {
          const a = AEMTER[id];
          const gesucht = id === soll;
          return (
            <g key={id}>
              <rect x={a.pos.x} y={a.pos.y - 18} width={96} height={36} rx={6} fill={gesucht ? "#16a34a" : "#64748b"} stroke={gesucht ? "#bbf7d0" : "none"} strokeWidth={3} />
              <text x={a.pos.x + 48} y={a.pos.y - 3} textAnchor="middle" fontSize="9" fill="#fff">Postamt</text>
              <text x={a.pos.x + 48} y={a.pos.y + 11} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fff">{a.name}</text>
            </g>
          );
        })}
        {WEICHEN.map((w, i) => (
          <g
            key={i}
            role="button"
            tabIndex={0}
            aria-label={`Weiche ${i + 1}, steht nach ${weichen[i] ? "oben" : "unten"}`}
            style={{ cursor: phase === "wahl" ? "pointer" : "default" }}
            onClick={() => umlegen(i)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                umlegen(i);
              }
            }}
          >
            <circle cx={w.pos.x} cy={w.pos.y} r={17} fill="#1e293b" stroke="#fbbf24" strokeWidth={3} />
            <text x={w.pos.x} y={w.pos.y + 4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fff">{weichen[i] ? "▲" : "▼"}</text>
            <text x={w.pos.x} y={w.pos.y + 32} textAnchor="middle" fontSize="9" fill="#64748b">Weiche {i + 1}</text>
          </g>
        ))}
        <g transform={`translate(${kapsel.x} ${kapsel.y})`}>
          <rect x={-11} y={-6} width={22} height={12} rx={6} fill="#dc2626" stroke="#fff" strokeWidth={2} />
          <circle cx={-3} cy={0} r={2} fill="#fff" />
        </g>
      </svg>

      {meldung && (
        <p className={`text-sm font-medium ${meldung.ok ? "text-ok" : "text-bad"}`} aria-live="polite">{meldung.text}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {phase === "wahl" && <button type="button" className="btn-primary" onClick={los}>💨 Druckluft!</button>}
        {phase === "flug" && <button type="button" className="btn-secondary" disabled>Büchse fliegt …</button>}
        {phase === "ankunft" && (
          <button type="button" className="btn-primary" onClick={weiter}>{runde + 1 >= ANZAHL ? "Zum Ergebnis" : "Nächste Büchse"}</button>
        )}
        <button type="button" className="btn-secondary" onClick={neu}>Neues Spiel</button>
      </div>

      {phase === "fertig" && (
        <div className="rounded border border-line bg-surface p-2 text-sm" aria-live="polite">
          <b>Feierabend in der Zentrale!</b> {richtig} von {ANZAHL} Büchsen richtig, {punkte} Punkte in {sek} s.
          {richtig >= 3 ? " Rohrpostmeister!" : " Für den Meistertitel brauchst du drei richtige."}
        </div>
      )}

      <p className="text-xs text-muted">
        In Berlin sausten die Büchsen mit etwa 30–40 km/h durch rund 400 km Rohre — bis 1976. Schneller als ein Bote, und kein Brief musste im Regen warten.
      </p>
    </div>
  );
}
