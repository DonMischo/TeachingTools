"use client";
/**
 * Spiel »Wer fasst mehr?«: Zwei Gefäße als Schrägbild mit Maßen — tippe das,
 * in das mehr Wasser passt. Danach wird umgefüllt: Zwei Messbecher zeigen,
 * wie viel jedes Gefäß wirklich fasst. 60 Sekunden, eine Serie bringt Bonus
 * und knappere Paare, ein Fehler kostet 3 Sekunden. Rekord im Browser.
 */
import { useEffect, useRef, useState } from "react";
import { fassPaar, type Gefaess } from "@/lib/koerper-aufgaben";
import { KOERPER } from "@/lib/koerper";
import { rahmen, type Skizze } from "@/lib/geometrie/skizze";
import { z } from "@/lib/prozent";
import { SkizzenInhalt } from "@/components/geometrie/Skizze";

const DAUER = 60, STRAFE = 3, SCHLUESSEL = "hp_koerper_fass_best";
const liesBest = () => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

/** Beide Skizzen im selben Maßstab: eine unsichtbare Strecke über den gemeinsamen Rahmen. */
function gleicherMassstab(a: Skizze, b: Skizze): [Skizze, Skizze] {
  const ra = rahmen(a), rb = rahmen(b);
  const breite = Math.max(ra.breite, rb.breite), hoehe = Math.max(ra.hoehe, rb.hoehe);
  const mit = (s: Skizze, r: typeof ra): Skizze => {
    const x = r.minX + r.breite / 2 - breite / 2, y = r.minY + r.hoehe - hoehe;
    return { ...s, nichtMassstaeblich: false, strecken: [...(s.strecken ?? []), { a: { x, y }, b: { x: x + breite, y: y + hoehe }, art: "unsichtbar" }] };
  };
  return [mit(a, ra), mit(b, rb)];
}

export default function FassDuell() {
  const [phase, setPhase] = useState<"start" | "spiel" | "ende">("start");
  const [paar, setPaar] = useState<[Gefaess, Gefaess] | null>(null);
  const [punkte, setPunkte] = useState(0);
  const [serie, setSerie] = useState(0);
  const [rest, setRest] = useState(DAUER);
  const [zeige, setZeige] = useState<{ wahl: number; richtig: boolean } | null>(null);
  const [best, setBest] = useState(0);
  const ende = useRef(0);

  useEffect(() => { setBest(liesBest()); }, []);

  useEffect(() => {
    if (phase !== "spiel") return;
    const t = setInterval(() => {
      const r = Math.max(0, Math.ceil((ende.current - Date.now()) / 1000));
      setRest(r);
      if (r === 0) setPhase("ende");
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "ende" && punkte > best) { setBest(punkte); schreibBest(punkte); }
  }, [phase, punkte, best]);

  const start = () => {
    ende.current = Date.now() + DAUER * 1000;
    setPunkte(0); setSerie(0); setRest(DAUER); setZeige(null);
    setPaar(fassPaar(0)); setPhase("spiel");
  };

  const tippe = (i: number) => {
    if (!paar || zeige || phase !== "spiel") return;
    const richtig = paar[i].V > paar[1 - i].V;
    const ns = richtig ? serie + 1 : 0;
    if (richtig) setPunkte(p => p + 1 + Math.floor(serie / 3));
    else ende.current -= STRAFE * 1000;
    setSerie(ns);
    setZeige({ wahl: i, richtig });
    setTimeout(() => { setZeige(null); setPaar(fassPaar(Math.floor(ns / 3))); }, richtig ? 1500 : 2400);
  };

  if (phase !== "spiel" || !paar) {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-4xl">🚰</div>
        <h3 className="text-xl font-black">Wer fasst mehr?</h3>
        <p className="max-w-xl text-muted">
          Zwei Gefäße, alle Maße in Zentimetern — tippe auf das, in das <strong>mehr Wasser</strong> passt. Danach wird umgefüllt,
          und du siehst, wie viel jedes wirklich fasst. Du hast {DAUER} Sekunden. Jede dritte richtige Antwort in Folge bringt
          einen Bonuspunkt mehr, aber die Gefäße werden sich auch ähnlicher. Ein Fehler kostet {STRAFE} Sekunden.
        </p>
        <p className="text-sm text-muted">Schätzen ist erlaubt — Rechnen ist sicherer.</p>
        {phase === "ende" && <p className="text-lg font-black">Ergebnis: {punkte} Punkte {punkte >= best && punkte > 0 ? "🏆 neuer Rekord!" : ""}</p>}
        {best > 0 && <p className="text-sm text-muted">Dein Rekord: {best}</p>}
        <button className="btn btn-primary" onClick={start}>{phase === "ende" ? "Nochmal" : "Los geht's"}</button>
      </div>
    );
  }

  const W = 380, H = 300;
  const skizzen = gleicherMassstab(paar[0].skizze, paar[1].skizze);
  const vMax = Math.max(paar[0].V, paar[1].V);
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 font-black">
        <span>⏱ {rest} s</span>
        <span>⭐ {punkte}</span>
        <span className="text-muted">Serie {serie}{serie >= 3 ? ` · Bonus +${Math.floor(serie / 3)}` : ""}</span>
        <span className="flex-1" />
        <span className="text-sm text-muted">Welches Gefäß fasst mehr?</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {paar.map((g, i) => {
          const mehr = paar[i].V > paar[1 - i].V;
          const rand = zeige ? (mehr ? "border-ok" : zeige.wahl === i ? "border-bad" : "border-line") : "border-line hover:border-accent";
          return (
            <button key={i} onClick={() => tippe(i)} aria-label={`Gefäß ${i + 1}: ${KOERPER[g.key].name}`}
              className={`rounded-xl border-4 ${rand} transition-colors bg-surface flex flex-col items-stretch`}>
              <div className="pt-2 font-bold text-sm">{KOERPER[g.key].icon} {KOERPER[g.key].name}</div>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[50vh]">
                <SkizzenInhalt s={skizzen[i]} w={W} h={H} />
              </svg>
              <div className="px-3 pb-3 flex items-end gap-3 h-20">
                {/* Messbecher: füllt sich beim Aufdecken bis zum Volumen des Gefäßes */}
                <div className="relative w-10 h-16 rounded-b-lg border-2 border-line overflow-hidden bg-surface">
                  <div className="absolute bottom-0 inset-x-0 bg-accent/60 transition-all duration-700 ease-out"
                    style={{ height: zeige ? `${(g.V / vMax) * 100}%` : "0%" }} />
                </div>
                <span className="text-sm font-black">
                  {zeige ? `V ${g.V < 1000 ? `≈ ${z(g.V, 0)} cm³` : `≈ ${z(g.V / 1000)} l`}` : "?"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {zeige && <p className={`text-center font-black ${zeige.richtig ? "text-ok" : "text-bad"}`}>
        {zeige.richtig ? "✔ Richtig!" : "✘ Leider nicht"} · Unterschied ≈ {z(Math.abs(paar[0].V - paar[1].V), 0)} cm³
      </p>}
    </div>
  );
}
