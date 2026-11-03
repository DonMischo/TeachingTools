"use client";
/**
 * Spiel »Flächen-Duell«: Zwei Vierecke auf Kästchenpapier — tippe das mit der
 * größeren Fläche. 60 Sekunden, eine Serie gibt Bonuspunkte, ein Fehler kostet
 * 3 Sekunden. Je länger die Serie, desto knapper liegen die Flächen beieinander.
 * Nach jedem Tipp stehen kurz beide Flächen da — Kästchen zählen lohnt sich.
 */
import { useEffect, useRef, useState } from "react";
import { duellPaar } from "@/lib/vierecke-aufgaben";
import { z } from "@/lib/prozent";
import { SkizzenInhalt } from "@/components/geometrie/Skizze";
import { SHAPES } from "@/lib/vierecke";

const DAUER = 60, STRAFE = 3, SCHLUESSEL = "hp_vierecke_duell_best";
const liesBest = () => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

type Paar = ReturnType<typeof duellPaar>;

export default function FlaechenDuell() {
  const [phase, setPhase] = useState<"start" | "spiel" | "ende">("start");
  const [paar, setPaar] = useState<Paar | null>(null);
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
    setPaar(duellPaar(0)); setPhase("spiel");
  };

  const tippe = (i: number) => {
    if (!paar || zeige || phase !== "spiel") return;
    const richtig = paar[i].A > paar[1 - i].A;
    const ns = richtig ? serie + 1 : 0;
    if (richtig) setPunkte(p => p + 1 + Math.floor(serie / 3));
    else ende.current -= STRAFE * 1000;
    setSerie(ns);
    setZeige({ wahl: i, richtig });
    setTimeout(() => { setZeige(null); setPaar(duellPaar(Math.floor(ns / 3))); }, richtig ? 650 : 1400);
  };

  if (phase !== "spiel" || !paar) {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-4xl">⚔️</div>
        <h3 className="text-xl font-black">Flächen-Duell</h3>
        <p className="max-w-xl text-muted">
          Zwei Vierecke auf Kästchenpapier — tippe auf das mit der <strong>größeren Fläche</strong>. Du hast {DAUER} Sekunden.
          Jede dritte richtige Antwort in Folge bringt einen Bonuspunkt mehr, aber die Flächen liegen dann auch knapper beieinander.
          Ein Fehler kostet {STRAFE} Sekunden.
        </p>
        {phase === "ende" && <p className="text-lg font-black">Ergebnis: {punkte} Punkte {punkte >= best && punkte > 0 ? "🏆 neuer Rekord!" : ""}</p>}
        {best > 0 && <p className="text-sm text-muted">Dein Rekord: {best}</p>}
        <button className="btn btn-primary" onClick={start}>{phase === "ende" ? "Nochmal" : "Los geht's"}</button>
      </div>
    );
  }

  const W = 380, H = 320;
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 font-black">
        <span>⏱ {rest} s</span>
        <span>⭐ {punkte}</span>
        <span className="text-muted">Serie {serie}{serie >= 3 ? ` · Bonus +${Math.floor(serie / 3)}` : ""}</span>
        <span className="flex-1" />
        <span className="text-sm text-muted">Welche Fläche ist größer?</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {paar.map((v, i) => {
          const rahmen = zeige ? (paar[i].A > paar[1 - i].A ? "border-ok" : zeige.wahl === i ? "border-bad" : "border-line") : "border-line hover:border-accent";
          return (
            <button key={i} onClick={() => tippe(i)} aria-label={`Viereck ${i + 1}`}
              className={`rounded-xl border-4 ${rahmen} transition-colors bg-surface`}>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[60vh]">
                {/* Unsichtbare Diagonale über das ganze 8 × 7-Blatt: beide Seiten im selben Maßstab. */}
                <SkizzenInhalt s={{ flaechen: [{ pts: v.pts }], strecken: [{ a: { x: 0, y: 0 }, b: { x: 8, y: 7 }, art: "unsichtbar" }], raster: true }} w={W} h={H} />
                {zeige && (
                  <text x={W / 2} y={H - 14} textAnchor="middle" fontSize={20} fontWeight={900} fill="var(--text)"
                    stroke="var(--surface)" strokeWidth={5} paintOrder="stroke">
                    {SHAPES[v.form].title}: A = {z(v.A)} Kästchen
                  </text>
                )}
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
