"use client";
/**
 * Rechnen wie in der Grundschule: Dinge in die Schalen legen, zusammenzählen,
 * wegnehmen und vergleichen. 3 Äpfel + 5 Äpfel = 8 Äpfel.
 *
 * Im Drehpunkt steht das Vergleichszeichen: die Waage neigt sich zur
 * schwereren Seite, und das Krokodilmaul < bzw. > öffnet sich zur größeren
 * Zahl hin. Drei Spielarten:
 *   frei     beide Seiten selbst einstellen
 *   füllen   links steht eine Rechnung, rechts so viele hinlegen, bis die Waage gerade ist
 *   zeichen  die Waage wird festgehalten — erst das Zeichen raten, dann loslassen
 */
import { useState } from "react";
import { Balance, Konfetti, Piece, GAP, PAN_INNER, STACK_MAX_H, tiltFor, type PanContent } from "./Balance";

export const DINGE = [
  { id: "apfel", emoji: "🍎", eins: "Apfel", viele: "Äpfel" },
  { id: "birne", emoji: "🍐", eins: "Birne", viele: "Birnen" },
  { id: "erdbeere", emoji: "🍓", eins: "Erdbeere", viele: "Erdbeeren" },
  { id: "stern", emoji: "⭐", eins: "Stern", viele: "Sterne" },
  { id: "ball", emoji: "⚽", eins: "Ball", viele: "Bälle" },
  { id: "auto", emoji: "🚗", eins: "Auto", viele: "Autos" },
  { id: "fisch", emoji: "🐟", eins: "Fisch", viele: "Fische" },
  { id: "keks", emoji: "🍪", eins: "Keks", viele: "Kekse" },
] as const;

type Op = "+" | "−" | "";
export type Seite = { a: number; op: Op; b: number };
type Art = "frei" | "fuellen" | "zeichen";

const MAX = 20;
const SIZE = 46;

export const wert = (s: Seite) => (s.op === "+" ? s.a + s.b : s.op === "−" ? s.a - s.b : s.a);
export const vergleich = (l: number, r: number) => (l < r ? "<" : l > r ? ">" : "=");
const term = (s: Seite) => (s.op ? `${s.a} ${s.op} ${s.b}` : `${s.a}`);
const zufall = (n: number) => Math.floor(Math.random() * n);

/** Eine Rechnung für links: Plus oder Minus, Minus nie unter null. */
function rechnung(): Seite {
  const op: Op = zufall(2) ? "+" : "−";
  const a = 1 + zufall(9), b = 1 + zufall(op === "−" ? a : 9);
  return { a, op, b };
}

type Teil = { id: string; tx: number; ty: number; weg: boolean; zwei: boolean };

/**
 * Wie im Zwanzigerfeld: Fünferreihen von unten nach oben. Beim Plus liegen
 * die zwei Häufchen nebeneinander, damit man beide noch einzeln sieht.
 */
function schale(s: Seite, seite: string, emoji: string, label: string): PanContent {
  const haufen = s.op === "+" ? [s.a, s.b] : [s.a];
  const teile: Teil[] = [];
  const zelle = SIZE + GAP / 2;
  const breiten = haufen.map(n => Math.min(5, Math.max(1, n)) * zelle);
  const w = breiten.reduce((x, y) => x + y, 0) + (haufen.length - 1) * 3 * GAP;
  const h = Math.max(1, ...haufen.map(n => Math.ceil(n / 5))) * zelle;
  let x0 = -w / 2;
  haufen.forEach((n, k) => {
    for (let i = 0; i < n; i++) {
      teile.push({
        id: `${seite}${k}-${i}`,
        tx: x0 + (i % 5) * zelle,
        ty: -(Math.floor(i / 5) + 1) * zelle,
        // Minus: die letzten b sind weggenommen (durchgestrichen, wiegen nichts).
        weg: s.op === "−" && i >= s.a - s.b,
        zwei: k === 1,
      });
    }
    x0 += breiten[k] + 3 * GAP;
  });
  const scale = Math.min(1, PAN_INNER / w, STACK_MAX_H / h);
  const n = teile.length;
  return {
    scale,
    label,
    empty: n === 0,
    node: teile.map(t => (
      <Piece key={t.id} tx={t.tx} ty={t.ty}>
        {t.zwei && <rect width={SIZE} height={SIZE} rx={12} fill="#38bdf8" opacity={0.22} />}
        <text x={SIZE / 2} y={SIZE / 2 + 2} textAnchor="middle" dominantBaseline="central" fontSize={36}
          opacity={t.weg ? 0.3 : 1}>{emoji}</text>
        {t.weg && (
          <g stroke="#e11d48" strokeWidth={5} strokeLinecap="round">
            <line x1={8} y1={8} x2={SIZE - 8} y2={SIZE - 8} />
            <line x1={SIZE - 8} y1={8} x2={8} y2={SIZE - 8} />
          </g>
        )}
      </Piece>
    )),
  };
}

function Zahl({ wert, setze, min = 0, max = MAX, label }: {
  wert: number; setze: (n: number) => void; min?: number; max?: number; label: string;
}) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <button className="btn px-3" onClick={() => setze(Math.max(min, wert - 1))} disabled={wert <= min}
        aria-label={`${label} kleiner`}>−</button>
      <span className="w-10 text-center text-2xl font-black tabular-nums">{wert}</span>
      <button className="btn px-3" onClick={() => setze(Math.min(max, wert + 1))} disabled={wert >= max}
        aria-label={`${label} größer`}>+</button>
    </div>
  );
}

function SeitenEditor({ s, setze, titel }: { s: Seite; setze: (s: Seite) => void; titel: string }) {
  // Minus nie unter null: b höchstens a.
  const neu = (x: Partial<Seite>) => {
    const n = { ...s, ...x };
    if (n.op === "−") n.b = Math.min(n.b, n.a);
    setze(n);
  };
  return (
    <div className="card p-3 flex flex-col gap-2 items-center">
      <div className="text-xs uppercase tracking-widest text-muted">{titel}</div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Zahl wert={s.a} setze={a => neu({ a })} label={`${titel}: erste Zahl`} />
        <div className="inline-flex rounded-lg border border-line p-0.5">
          {(["+", "−", ""] as const).map(o => (
            <button key={o || "x"} onClick={() => neu({ op: o, b: o && !s.op ? 1 : s.b })}
              className={`px-2.5 py-1 rounded-md text-lg font-black ${s.op === o ? "bg-accent text-accent-fg" : "text-muted"}`}
              title={o ? undefined : "nur eine Zahl"}>
              {o || "∅"}
            </button>
          ))}
        </div>
        {s.op && <Zahl wert={s.b} setze={b => neu({ b })} max={s.op === "−" ? s.a : MAX} label={`${titel}: zweite Zahl`} />}
      </div>
    </div>
  );
}

export default function RechnenModus() {
  const [ding, setDing] = useState<(typeof DINGE)[number]>(DINGE[0]);
  const [art, setArt] = useState<Art>("frei");
  const [links, setLinks] = useState<Seite>({ a: 3, op: "+", b: 5 });
  const [rechts, setRechts] = useState<Seite>({ a: 8, op: "", b: 0 });
  const [tipp, setTipp] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);

  const L = wert(links), R = wert(rechts);
  const zeichen = vergleich(L, R);
  const verdeckt = art === "zeichen" && tipp === null;
  const geschafft = (art === "fuellen" && zeichen === "=") || (art === "zeichen" && tipp === zeichen);

  function neueAufgabe(a: Art = art) {
    const l = rechnung();
    setLinks(l);
    setTipp(null);
    setRunde(n => n + 1);
    if (a === "fuellen") setRechts({ a: 0, op: "", b: 0 });
    else {
      // Rund ein Drittel der Aufgaben geht genau auf.
      const r = zufall(3) === 0 ? wert(l) : Math.max(0, wert(l) + (zufall(2) ? 1 : -1) * (1 + zufall(3)));
      setRechts({ a: r, op: "", b: 0 });
    }
  }

  function waehleArt(a: Art) {
    setArt(a);
    if (a === "frei") setTipp(null);
    else neueAufgabe(a);
  }

  const mitWert = (s: Seite, w: number) => (s.op && !verdeckt && art !== "fuellen" ? `${term(s)} = ${w}` : term(s));
  const left = schale(links, "L", ding.emoji, mitWert(links, L));
  const right = schale(rechts, "R", ding.emoji, mitWert(rechts, R));

  const name = (n: number) => (n === 1 ? ding.eins : ding.viele);
  const satz = (s: Seite) => s.op
    ? `${s.a} ${name(s.a)} ${s.op} ${s.b} ${name(s.b)}`
    : `${s.a} ${name(s.a)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-line p-1 bg-surface">
          {([["frei", "🧺 Frei legen"], ["fuellen", "⚖️ Gerade machen"], ["zeichen", "🐊 Welches Zeichen?"]] as const).map(([id, t]) => (
            <button key={id} onClick={() => waehleArt(id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${art === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {DINGE.map(d => (
            <button key={d.id} onClick={() => setDing(d)} title={d.viele}
              className={`chip text-xl ${ding.id === d.id ? "chip-on" : ""}`}>{d.emoji}</button>
          ))}
        </div>
      </div>

      <div className="card p-4 relative overflow-hidden">
        {geschafft && <Konfetti seed={runde} />}
        <Balance
          tilt={verdeckt ? 0 : tiltFor(L, R)}
          zeichen={verdeckt ? "?" : zeichen}
          ariaLabel={`Waage: ${term(links)} ${verdeckt ? "?" : zeichen} ${term(rechts)}`}
          left={left} right={right}
        />
        <p className="text-center text-xl sm:text-2xl font-black mt-2">
          {satz(links)} <span className="text-sky-400 mx-1">{verdeckt ? "?" : zeichen}</span> {satz(rechts)}
        </p>
        {!verdeckt && zeichen !== "=" && (
          <p className="text-center text-sm text-muted mt-1">
            {zeichen === "<" ? "Links ist weniger als rechts" : "Links ist mehr als rechts"} — das Krokodilmaul frisst immer die größere Zahl, und die Waage sinkt auf ihrer Seite.
          </p>
        )}
      </div>

      {art === "frei" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <SeitenEditor s={links} setze={setLinks} titel="Linke Schale" />
          <SeitenEditor s={rechts} setze={setRechts} titel="Rechte Schale" />
        </div>
      )}

      {art === "fuellen" && (
        <div className="card p-4 flex flex-wrap items-center justify-center gap-4">
          <span className="text-sm">Leg rechts so viele {ding.viele} hin, bis die Waage gerade ist:</span>
          <Zahl wert={rechts.a} setze={a => setRechts({ a, op: "", b: 0 })} label="Rechte Schale" />
          {geschafft
            ? <span className="text-ok font-black">Richtig! {term(links)} = {R}</span>
            : <span className="text-muted text-sm">{zeichen === "<" ? "Zu viele — die rechte Seite ist schwerer." : "Noch zu wenig."}</span>}
          <button className="btn-primary" onClick={() => neueAufgabe()}>🎲 Neue Aufgabe</button>
        </div>
      )}

      {art === "zeichen" && (
        <div className="card p-4 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm">Die Waage wird noch festgehalten. Was gehört in die Mitte?</span>
          {(["<", "=", ">"] as const).map(z => (
            <button key={z} onClick={() => setTipp(z)} disabled={tipp !== null}
              className={`btn text-3xl font-black w-16 ${tipp === z ? (z === zeichen ? "border-ok text-ok" : "border-bad text-bad") : ""}`}>
              {z}
            </button>
          ))}
          {tipp !== null && (
            <span className={`font-black ${tipp === zeichen ? "text-ok" : "text-bad"}`}>
              {tipp === zeichen ? "Richtig!" : `Nicht ganz — es ist ${L} ${zeichen} ${R}.`}
            </span>
          )}
          <button className="btn-primary" onClick={() => neueAufgabe()}>🎲 Neue Aufgabe</button>
        </div>
      )}
    </div>
  );
}
