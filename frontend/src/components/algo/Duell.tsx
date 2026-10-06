"use client";
/**
 * Duell zu zweit (Aufgabe 5 des Arbeitsblatts): Abwechselnd zieht die Figur
 * (Pfeiltasten + Enter) und der Gegner (W A S D, Leertaste = stehen bleiben).
 * Die Figur gewinnt, wenn sie alles eingesammelt hat; der Gegner, wenn er sie
 * erwischt oder 30 Runden um sind. Jeder Zug landet im Protokoll — so wird aus
 * dem Spiel wieder eine Schrittfolge.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { DX, DY, PFEIL, type Richtung, type Zustand } from "@/lib/algo/spiel";
import type { Thema } from "@/lib/algo/themen";
import Spielfeld from "./Spielfeld";

const KARTE = {
  zeilen: ["#########", "#a..#..a#", "#.#.#.#.#", "#...b...#", "#.#.#.#.#", "#>..#...#", "#########"],
};
const GEGNER_START: [number, number] = [7, 5];
const MAX_RUNDEN = 30;

const FIGUR_TASTE: Record<string, Richtung> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
const GEGNER_TASTE: Record<string, Richtung> = { w: 0, d: 1, s: 2, a: 3 };

interface Stand {
  fig: { x: number; y: number; r: Richtung };
  geg: [number, number];
  genommen: string[];
  dran: "figur" | "gegner";
  protokoll: { figur: string; gegner?: string }[];
  ende: null | "figur" | "gegner";
}

const START: Stand = { fig: { x: 1, y: 5, r: 1 }, geg: GEGNER_START, genommen: [], dran: "figur", protokoll: [], ende: null };
const offen = (x: number, y: number) => (KARTE.zeilen[y]?.[x] ?? "#") !== "#";
const DINGE = KARTE.zeilen.flatMap((z, y) => [...z].map((c, x) => (c === "a" || c === "b" ? `${x},${y}` : null))).filter(Boolean) as string[];

export default function Duell({ thema }: { thema: Thema }) {
  const [s, setS] = useState<Stand>(START);
  const huelle = useRef<HTMLDivElement>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const figurZug = useCallback((t: "geh" | "nimm", r?: Richtung) => {
    const neu = ((alt: Stand): Stand => {
      if (alt.ende || alt.dran !== "figur") return alt;
      let { x, y } = alt.fig;
      let genommen = alt.genommen;
      let notiz: string;
      if (t === "geh") {
        const nx = x + DX[r!], ny = y + DY[r!];
        if (!offen(nx, ny)) { setMeldung("Da ist eine Wand — nicht ausführbar."); return alt; }
        x = nx; y = ny; notiz = PFEIL[r!];
      } else {
        const k = `${x},${y}`;
        if (!DINGE.includes(k) || genommen.includes(k)) { setMeldung("Hier liegt nichts."); return alt; }
        genommen = [...genommen, k]; notiz = "✋";
      }
      setMeldung(null);
      const fig = { x, y, r: t === "geh" ? r! : alt.fig.r };
      const protokoll = [...alt.protokoll, { figur: notiz }];
      if (x === alt.geg[0] && y === alt.geg[1]) return { ...alt, fig, protokoll, ende: "gegner" };
      if (genommen.length === DINGE.length) return { ...alt, fig, genommen, protokoll, ende: "figur" };
      return { ...alt, fig, genommen, protokoll, dran: "gegner" };
    })(s);
    if (neu !== s) setS(neu);
  }, [s]);

  const gegnerZug = useCallback((r: Richtung | null) => {
    const neu = ((alt: Stand): Stand => {
      if (alt.ende || alt.dran !== "gegner") return alt;
      let [x, y] = alt.geg;
      if (r !== null) {
        const nx = x + DX[r], ny = y + DY[r];
        if (!offen(nx, ny)) { setMeldung("Der Gegner kann nicht durch Wände."); return alt; }
        x = nx; y = ny;
      }
      setMeldung(null);
      const protokoll = alt.protokoll.map((p, i) => (i === alt.protokoll.length - 1 ? { ...p, gegner: r === null ? "·" : PFEIL[r] } : p));
      const erwischt = x === alt.fig.x && y === alt.fig.y;
      const ende = erwischt || protokoll.length >= MAX_RUNDEN ? "gegner" : null;
      return { ...alt, geg: [x, y], protokoll, dran: "figur", ende };
    })(s);
    if (neu !== s) setS(neu);
  }, [s]);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && /INPUT|TEXTAREA|SELECT/.test(ziel.tagName)) return;
      // Nur, solange das Spiel sichtbar ist (verborgene Reiter bleiben eingehängt).
      if (!huelle.current?.offsetParent) return;
      if (e.key in FIGUR_TASTE) { e.preventDefault(); figurZug("geh", FIGUR_TASTE[e.key]); }
      else if (e.key === "Enter") { e.preventDefault(); figurZug("nimm"); }
      else if (e.key.toLowerCase() in GEGNER_TASTE) { e.preventDefault(); gegnerZug(GEGNER_TASTE[e.key.toLowerCase()]); }
      else if (e.key === " ") { e.preventDefault(); gegnerZug(null); }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [figurZug, gegnerZug]);

  const z: Zustand = { x: s.fig.x, y: s.fig.y, r: s.fig.r, genommen: s.genommen, gegner: [0] };
  const karte = { ...KARTE, gegner: [{ weg: [s.geg] }] };
  const knopf = "w-11 h-11 rounded-xl bg-surface-hover border border-line text-lg font-black active:scale-95 disabled:opacity-30";
  const figDran = s.dran === "figur" && !s.ende, gegDran = s.dran === "gegner" && !s.ende;

  return (
    <div ref={huelle} className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
      <div className="flex flex-col gap-3">
        <section className="card p-4 text-sm flex flex-col gap-1">
          <h2 className="text-lg font-black">⚔️ Duell zu zweit</h2>
          <p>Ihr zieht abwechselnd. Schafft es {thema.woerter.held}, alle {thema.woerter.aPl} und {thema.woerter.bAkk} zu holen, bevor {thema.woerter.gegner} zuschlägt? Nach {MAX_RUNDEN} Runden gewinnt {thema.woerter.gegner}.</p>
          <p className="text-xs text-muted">Figur: Pfeiltasten + Enter · Gegner: W A S D, Leertaste = stehen bleiben</p>
        </section>
        <Spielfeld karte={karte} z={z} thema={thema} dauer={160} fehler={s.ende === "gegner"} />
        {meldung && <p className="text-sm text-bad">{meldung}</p>}
        {s.ende
          ? <div className="card p-3 text-center flex flex-col gap-2 items-center">
              <div className="text-lg font-black">{s.ende === "figur" ? `🎉 ${thema.woerter.held} gewinnt!` : `${thema.gegner} ${thema.woerter.gegner} gewinnt!`}</div>
              <button type="button" className="btn-primary" onClick={() => { setS(START); setMeldung(null); }}>Neues Duell</button>
            </div>
          : <div className="flex gap-6 flex-wrap">
              <Kreuz titel={`${thema.figur ?? "🟡"} Figur`} an={figDran} knopf={knopf}
                onRichtung={r => figurZug("geh", r)} mitte={{ text: "✋", aktion: () => figurZug("nimm") }} />
              <Kreuz titel={`${thema.gegner} Gegner`} an={gegDran} knopf={knopf}
                onRichtung={r => gegnerZug(r)} mitte={{ text: "·", aktion: () => gegnerZug(null) }} />
            </div>}
      </div>
      <div className="card p-3 flex flex-col gap-2">
        <div className="text-sm font-bold">📝 Protokoll ({s.protokoll.length}/{MAX_RUNDEN})</div>
        <div className="max-h-[50vh] overflow-auto">
          <table className="w-full text-sm text-center tabular-nums">
            <thead><tr className="text-muted text-xs"><th>Schritt</th><th>Figur</th><th>Gegner</th></tr></thead>
            <tbody>
              {s.protokoll.map((p, i) => (
                <tr key={i} className="border-t border-line"><td>{i + 1}</td><td className="text-lg">{p.figur}</td><td className="text-lg">{p.gegner ?? ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kreuz({ titel, an, knopf, onRichtung, mitte }: {
  titel: string; an: boolean; knopf: string; onRichtung: (r: Richtung) => void; mitte: { text: string; aktion: () => void };
}) {
  return (
    <div className={`flex flex-col gap-1 items-center rounded-xl p-2 ${an ? "ring-2 ring-accent" : "opacity-60"}`}>
      <div className="text-xs font-bold">{titel}{an ? " — du bist dran" : ""}</div>
      <div className="grid grid-cols-3 gap-1">
        <span /><button type="button" disabled={!an} className={knopf} onClick={() => onRichtung(0)}>↑</button><span />
        <button type="button" disabled={!an} className={knopf} onClick={() => onRichtung(3)}>←</button>
        <button type="button" disabled={!an} className={knopf} onClick={mitte.aktion}>{mitte.text}</button>
        <button type="button" disabled={!an} className={knopf} onClick={() => onRichtung(1)}>→</button>
        <span /><button type="button" disabled={!an} className={knopf} onClick={() => onRichtung(2)}>↓</button><span />
      </div>
    </div>
  );
}
