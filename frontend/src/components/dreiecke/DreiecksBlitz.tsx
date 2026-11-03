"use client";
/**
 * Spiel »Dreiecks-Blitz«: Ein Dreieck mit seinen Winkeln erscheint — tippe in
 * der 3 × 3-Tafel das passende Feld (nach Seiten × nach Winkeln). Zwei Felder
 * sind gesperrt, denn gleichseitig geht nur spitzwinklig. 60 Sekunden, jede
 * dritte richtige Antwort in Folge bringt einen Bonuspunkt mehr; ab Serie 3
 * liegen die Dreiecke schräg, ab Serie 6 knapp an der Grenze (88°, 92° …).
 * Ein Fehler kostet 3 Sekunden. Rekord im Browser.
 */
import { useEffect, useRef, useState } from "react";
import { blitzDreieck, skizzeDreieck } from "@/lib/dreiecke-aufgaben";
import { SEITEN_NAMEN, WINKEL_NAMEN, type NachSeiten, type NachWinkeln } from "@/lib/dreiecke";
import { SkizzenInhalt } from "@/components/geometrie/Skizze";

const DAUER = 60, STRAFE = 3, SCHLUESSEL = "hp_dreiecke_blitz_best";
const liesBest = () => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

const ZEILEN = Object.keys(SEITEN_NAMEN) as NachSeiten[];
const SPALTEN = Object.keys(WINKEL_NAMEN) as NachWinkeln[];
const moeglich = (s: NachSeiten, w: NachWinkeln) => s !== "gleichseitig" || w === "spitzwinklig";

type Runde = ReturnType<typeof blitzDreieck>;

export default function DreiecksBlitz() {
  const [phase, setPhase] = useState<"start" | "spiel" | "ende">("start");
  const [runde, setRunde] = useState<Runde | null>(null);
  const [punkte, setPunkte] = useState(0);
  const [serie, setSerie] = useState(0);
  const [rest, setRest] = useState(DAUER);
  const [zeige, setZeige] = useState<{ s: NachSeiten; w: NachWinkeln; richtig: boolean } | null>(null);
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
    setRunde(blitzDreieck(0)); setPhase("spiel");
  };

  const tippe = (s: NachSeiten, w: NachWinkeln) => {
    if (!runde || zeige || phase !== "spiel") return;
    const richtig = s === runde.seiten && w === runde.winkel;
    const ns = richtig ? serie + 1 : 0;
    if (richtig) setPunkte(p => p + 1 + Math.floor(serie / 3));
    else ende.current -= STRAFE * 1000;
    setSerie(ns);
    setZeige({ s, w, richtig });
    setTimeout(() => { setZeige(null); setRunde(blitzDreieck(Math.floor(ns / 3))); }, richtig ? 550 : 1500);
  };

  if (phase !== "spiel" || !runde) {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-4xl">⚡</div>
        <h3 className="text-xl font-black">Dreiecks-Blitz</h3>
        <p className="max-w-xl text-muted">
          Ein Dreieck erscheint mit seinen drei Winkeln. Tippe so schnell du kannst das passende Feld: <strong>nach Seiten</strong> (Zeile)
          und <strong>nach Winkeln</strong> (Spalte). Gleich große Winkel verraten gleich lange Seiten! Du hast {DAUER} Sekunden,
          jede dritte richtige Antwort in Folge bringt einen Bonuspunkt mehr — aber dann werden die Dreiecke kniffliger. Ein Fehler kostet {STRAFE} Sekunden.
        </p>
        {phase === "ende" && <p className="text-lg font-black">Ergebnis: {punkte} Punkte {punkte >= best && punkte > 0 ? "🏆 neuer Rekord!" : ""}</p>}
        {best > 0 && <p className="text-sm text-muted">Dein Rekord: {best}</p>}
        <button className="btn btn-primary" onClick={start}>{phase === "ende" ? "Nochmal" : "Los geht's"}</button>
      </div>
    );
  }

  const [a, b, c] = runde.ws;
  const iRecht = runde.ws.indexOf(90);
  const sk = skizzeDreieck(runde.d, { alpha: `${a}°`, beta: `${b}°`, gamma: `${c}°`, recht: iRecht >= 0 ? (iRecht as 0 | 1 | 2) : undefined, namen: false });
  const W = 420, H = 320;
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 font-black">
        <span>⏱ {rest} s</span>
        <span>⭐ {punkte}</span>
        <span className="text-muted">Serie {serie}{serie >= 3 ? ` · Bonus +${Math.floor(serie / 3)}` : ""}</span>
        <span className="flex-1" />
        <span className="text-sm text-muted">Was für ein Dreieck ist das?</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 items-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[55vh] rounded-xl border border-line bg-surface" role="img" aria-label="Dreieck zum Einordnen">
          <SkizzenInhalt s={sk} w={W} h={H} />
        </svg>
        <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1.5 text-sm" role="group" aria-label="Einordnung wählen">
          <span />
          {SPALTEN.map(w => <span key={w} className="text-center font-bold text-muted">{WINKEL_NAMEN[w]}</span>)}
          {ZEILEN.map(s => [
            <span key={s} className="font-bold text-muted self-center pr-1">{SEITEN_NAMEN[s]}</span>,
            ...SPALTEN.map(w => {
              const geht = moeglich(s, w);
              const loesung = zeige && s === runde.seiten && w === runde.winkel;
              const falsch = zeige && !zeige.richtig && zeige.s === s && zeige.w === w;
              return (
                <button key={s + w} disabled={!geht} aria-label={`${SEITEN_NAMEN[s]} und ${WINKEL_NAMEN[w]}`} onClick={() => tippe(s, w)}
                  className={`h-16 rounded-xl border-4 font-black transition-colors ${!geht ? "border-line opacity-30 cursor-not-allowed" : loesung ? "border-ok bg-surface-hover" : falsch ? "border-bad" : "border-line hover:border-accent bg-surface"}`}>
                  {!geht ? "✕" : loesung ? "✔" : falsch ? "✘" : ""}
                </button>
              );
            }),
          ])}
        </div>
      </div>
      {zeige && !zeige.richtig && <p className="text-sm">Richtig wäre: <strong>{SEITEN_NAMEN[runde.seiten]} und {WINKEL_NAMEN[runde.winkel]}</strong>.</p>}
    </div>
  );
}
