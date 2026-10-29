"use client";
/**
 * Challenge auf Zeit: eine Reihe gewürfelter Aufgaben, jede Technik ist
 * erlaubt. Am Ende Gesamtzeit, Bestzeit im Browser und je Aufgabe der Vergleich
 * mit dem Profi-Weg — wer deutlich mehr Aktionen brauchte, sieht den schnelleren.
 */
import { useEffect, useRef, useState } from "react";
import { MODI, STRAFE_MS, challengeAufgaben, type Aufgabe, type Modus } from "@/lib/markieren/aufgaben";
import { TECHNIKEN } from "@/lib/markieren/technik";
import { mitTasten } from "@/components/maus/Taste";
import { Textfeld, type Loesung } from "./Textfeld";

const SCHLUESSEL = "hp_markieren_bestzeit";
type Bestzeiten = Partial<Record<Modus, number>>;
const liesBest = (): Bestzeiten => {
  try { return JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "{}"); } catch { return {}; }
};
const schreibBest = (b: Bestzeiten) => {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(b)); } catch { /* privat */ }
};

type Ergebnis = { aufgabe: Aufgabe; ms: number; aktionen: number; uebersprungen: boolean };
type Lauf = { modus: Modus; aufgaben: Aufgabe[]; ergebnisse: Ergebnis[]; seit: number };

const sek = (ms: number) => (ms / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " s";
const summe = (e: Ergebnis[]) => e.reduce((s, x) => s + x.ms + (x.uebersprungen ? STRAFE_MS : 0), 0);

export default function Challenge() {
  const [best, setBest] = useState<Bestzeiten>({});
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const [neuerRekord, setNeuerRekord] = useState(false);
  const [jetzt, setJetzt] = useState(0);
  const uhr = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setBest(liesBest()); }, []);
  useEffect(() => () => { if (uhr.current) clearInterval(uhr.current); }, []);

  const fertig = !!lauf && lauf.ergebnisse.length >= lauf.aufgaben.length;

  useEffect(() => {
    if (lauf && !fertig) {
      uhr.current = setInterval(() => setJetzt(performance.now()), 100);
      return () => { if (uhr.current) clearInterval(uhr.current); };
    }
  }, [lauf, fertig]);

  function los(modus: Modus) {
    setNeuerRekord(false);
    setLauf({ modus, aufgaben: challengeAufgaben(modus), ergebnisse: [], seit: performance.now() });
    setJetzt(performance.now());
  }

  function weiter(e: Ergebnis) {
    if (!lauf) return;
    const ergebnisse = [...lauf.ergebnisse, e];
    setLauf({ ...lauf, ergebnisse, seit: performance.now() });
    if (ergebnisse.length === lauf.aufgaben.length) {
      const gesamt = summe(ergebnisse);
      const alt = best[lauf.modus];
      // Bestzeit nur ohne Überspringen — sonst wäre »alles überspringen« ein Rekord.
      if (!ergebnisse.some(x => x.uebersprungen) && (alt === undefined || gesamt < alt)) {
        const neu = { ...best, [lauf.modus]: gesamt };
        setBest(neu);
        schreibBest(neu);
        setNeuerRekord(true);
      }
    }
  }

  if (!lauf) {
    return (
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
        {(Object.keys(MODI) as Modus[]).map(m => (
          <div key={m} className="card p-4 flex flex-col gap-2">
            <h2 className="text-lg font-black">{MODI[m].icon} {MODI[m].titel}</h2>
            <p className="text-sm text-muted flex-1">{MODI[m].text}</p>
            <p className="text-sm">{MODI[m].anzahl} Aufgaben · Bestzeit: <b>{best[m] !== undefined ? sek(best[m]!) : "—"}</b></p>
            <button type="button" className="btn-primary" onClick={() => los(m)}>Los!</button>
          </div>
        ))}
        <p className="text-sm text-muted col-span-full">
          Jede Technik ist erlaubt — schnell ist, wer die richtige wählt. Überspringen kostet {STRAFE_MS / 1000} Sekunden, und die Runde zählt nicht als Bestzeit.
        </p>
      </div>
    );
  }

  if (fertig) return <Auswertung lauf={lauf} best={best[lauf.modus]} neuerRekord={neuerRekord} onNochmal={() => los(lauf.modus)} onZurueck={() => setLauf(null)} />;

  const nr = lauf.ergebnisse.length;
  const aufgabe = lauf.aufgaben[nr];
  const laufend = summe(lauf.ergebnisse) + Math.max(0, jetzt - lauf.seit);
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-black">{MODI[lauf.modus].icon} {MODI[lauf.modus].titel} · Aufgabe {nr + 1} von {lauf.aufgaben.length}</span>
        <span className="font-mono text-2xl font-black tabular-nums" aria-label="Zeit">⏱️ {sek(laufend)}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${(nr / lauf.aufgaben.length) * 100}%` }} />
      </div>
      <p className="font-bold text-lg">👉 {mitTasten(aufgabe.auftrag)}</p>
      <Textfeld key={nr} aufgabe={aufgabe}
        onGeloest={(l: Loesung) => weiter({ aufgabe, ms: Math.round(performance.now() - lauf.seit), aktionen: l.aktionen, uebersprungen: false })} />
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-secondary text-sm"
          onClick={() => weiter({ aufgabe, ms: Math.round(performance.now() - lauf.seit), aktionen: 0, uebersprungen: true })}>
          Überspringen (+{STRAFE_MS / 1000} s)
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setLauf(null)}>Abbrechen</button>
      </div>
    </div>
  );
}

function Auswertung({ lauf, best, neuerRekord, onNochmal, onZurueck }: {
  lauf: Lauf; best?: number; neuerRekord: boolean; onNochmal: () => void; onZurueck: () => void;
}) {
  const gesamt = summe(lauf.ergebnisse);
  const tipps = lauf.ergebnisse.filter(e => !e.uebersprungen && e.aktionen > e.aufgabe.profiAktionen + 2);
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-6 flex flex-col items-center gap-2 text-center">
        <div className="text-4xl">{neuerRekord ? "🏆" : "🏁"}</div>
        <p className="text-3xl font-black tabular-nums">{sek(gesamt)}</p>
        <p className="text-sm text-muted">
          {neuerRekord ? "Neue Bestzeit!" : best !== undefined ? `Bestzeit: ${sek(best)}` : ""}
          {" · "}Ø {sek(gesamt / lauf.ergebnisse.length)} je Aufgabe
        </p>
        <div className="flex gap-2 flex-wrap justify-center mt-2">
          <button type="button" className="btn-primary" onClick={onNochmal}>↺ Nochmal</button>
          <button type="button" className="btn-secondary" onClick={onZurueck}>Andere Challenge</button>
        </div>
      </div>

      {tipps.length > 0 && (
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">💡 Hier geht es schneller</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {tipps.map((e, i) => (
              <li key={i}>
                {mitTasten(e.aufgabe.auftrag)} — du: {e.aktionen} Aktionen, Profi-Weg (etwa {e.aufgabe.profiAktionen}):{" "}
                {e.aufgabe.profi.map((t, j) => <span key={t}>{j > 0 && ", "}{mitTasten(TECHNIKEN[t].tasten)}</span>)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 pr-2">#</th><th className="py-1 pr-2">Aufgabe</th>
              <th className="py-1 pr-2 text-right">Zeit</th><th className="py-1 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {lauf.ergebnisse.map((e, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="py-1 pr-2">{mitTasten(e.aufgabe.auftrag)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{e.uebersprungen ? `übersprungen (+${STRAFE_MS / 1000} s)` : sek(e.ms)}</td>
                <td className="py-1 text-right tabular-nums">{e.uebersprungen ? "—" : e.aktionen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
