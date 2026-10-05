"use client";
/**
 * Zeitlupe: spielt die letzte Runde Takt für Takt ab. Jede Investition,
 * jeder wirkende Bereich und jedes Ereignis bekommt einen eigenen Moment;
 * die Werte im Wirkungsnetz laufen dabei sichtbar von alt nach neu, die
 * gerade wirkenden Pfeile fließen. Tempo wählbar.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { BEREICH } from "@/lib/leviathan/bereiche";
import { STARTJAHR } from "@/lib/leviathan/motor";
import { standBei, takte } from "@/lib/leviathan/zeitlupe";
import { HOCH_SCHLECHT, type Groesse, type Zustand } from "@/lib/leviathan/typen";
import { QuelleLink } from "./ui";
import Wirkungsnetz from "./Wirkungsnetz";

export type Tempo = "langsam" | "mittel" | "schnell";
export const TEMPO: Record<Tempo, { name: string; ms: number }> = {
  langsam: { name: "🐢 langsam", ms: 4000 },
  mittel: { name: "🚶 mittel", ms: 2200 },
  schnell: { name: "🐇 schnell", ms: 900 },
};

const SCHRITT_NAME: Record<string, string> = {
  budget: "Haushalt", investition: "Deine Investitionen", wirkung: "Wirkungsgefüge", eigen: "Eigendynamik",
  traegheit: "Trägheit", bevoelkerung: "Bevölkerung", ereignisse: "Ereignisse", wahl: "Wahl", lq: "Lebensqualität",
};

const zahl = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1).replace(".", ",")}`;
const gut = (g: Groesse, x: number) => (HOCH_SCHLECHT.has(g) ? x < 0 : x > 0);

export default function Zeitlupe({ z, tempo, onTempo, autostart = false, onFertig }: {
  z: Zustand; tempo: Tempo; onTempo: (t: Tempo) => void; autostart?: boolean;
  /** Nach dem letzten Takt (nur beim automatischen Abspielen): weiter zur nächsten Runde. */
  onFertig?: () => void;
}) {
  const r = z.rechnung;
  const ts = useMemo(() => (r ? takte(r) : []), [r]);
  // Position in einem Ref, damit der Animationstakt nichts doppelt zählt (StrictMode).
  const pos = useRef({ i: 0, a: 0 });
  const [, zeichne] = useState(0);
  const [laeuft, setLaeuft] = useState(autostart);
  const fertig = useRef(onFertig);
  fertig.current = onFertig;

  // Bewegung: Werte laufen in 60 % der Taktzeit hinüber, dann eine kurze Pause.
  useEffect(() => {
    if (!laeuft || !ts.length) return;
    let id = 0;
    let vorher: number | null = null;
    const dauer = TEMPO[tempo].ms;
    const tick = (jetzt: number) => {
      const p = pos.current;
      p.a += (jetzt - (vorher ?? jetzt)) / (dauer * 0.6);
      vorher = jetzt;
      if (p.a >= 1 + 0.4 / 0.6) {
        if (p.i + 1 >= ts.length) {
          // Ende: nicht weiterticken, sonst meldet sich »fertig« mehrfach.
          p.a = 1;
          zeichne((x) => x + 1);
          setLaeuft(false);
          if (fertig.current) setTimeout(() => fertig.current?.(), 400);
          return;
        }
        p.i += 1;
        p.a = 0;
      }
      zeichne((x) => x + 1);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [laeuft, tempo, ts.length]);

  const i = Math.min(pos.current.i, Math.max(0, ts.length - 1));
  const anteil = pos.current.a;

  if (!r) return <p className="text-sm text-muted">Nach der ersten Runde lässt sie sich hier in Zeitlupe abspielen.</p>;

  const t = ts[Math.min(i, ts.length - 1)];
  const f = Math.min(1, anteil);
  const werte = standBei(r, ts, i, f);
  const vorher = standBei(r, ts, i, 0);
  const aenderungen = [...new Set(t.beitraege.map((b) => b.nach))].map((g) => ({
    g, summe: t.beitraege.filter((b) => b.nach === g).reduce((a, b) => a + b.wert, 0),
  })).filter((x) => Math.abs(x.summe) >= 0.05).sort((a, b) => Math.abs(b.summe) - Math.abs(a.summe));

  const gehe = (j: number) => { pos.current = { i: Math.max(0, Math.min(ts.length - 1, j)), a: 1 }; setLaeuft(false); zeichne((x) => x + 1); };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => gehe(0)} aria-label="Von vorn" className="w-9 h-9 rounded-lg border border-line font-black">⏮</button>
        <button onClick={() => gehe(i - 1)} disabled={i === 0} aria-label="Voriger Takt" className="w-9 h-9 rounded-lg border border-line font-black disabled:opacity-30">◀</button>
        <button onClick={() => {
            // Fertig gezeigter Takt: beim nächsten weitermachen (am Ende von vorn).
            if (!laeuft && anteil >= 1) pos.current = { i: i >= ts.length - 1 ? 0 : i + 1, a: 0 };
            setLaeuft((l) => !l);
          }}
          className="btn-primary px-4 h-9">
          {laeuft ? "⏸ Pause" : "▶ Abspielen"}
        </button>
        <button onClick={() => gehe(i + 1)} disabled={i >= ts.length - 1} aria-label="Nächster Takt" className="w-9 h-9 rounded-lg border border-line font-black disabled:opacity-30">▶</button>
        {onFertig && (
          <button onClick={onFertig} className="px-3 h-9 rounded-lg text-sm font-bold border border-line">Weiter zur nächsten Runde ⏭</button>
        )}
        <div className="inline-flex rounded-xl border border-line p-1 ml-auto" role="radiogroup" aria-label="Tempo">
          {(Object.keys(TEMPO) as Tempo[]).map((x) => (
            <button key={x} role="radio" aria-checked={tempo === x} onClick={() => onTempo(x)}
              className={`px-2.5 py-1 rounded-lg text-sm font-bold ${tempo === x ? "bg-accent text-accent-fg" : "text-muted"}`}>{TEMPO[x].name}</button>
          ))}
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden" aria-hidden>
        <div className="h-full bg-accent" style={{ width: `${((i + f) / ts.length) * 100}%` }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-3 min-w-0" aria-live="polite">
          <div className="text-xs text-muted">
            {STARTJAHR + 2 * (r.runde - 1)} → {STARTJAHR + 2 * r.runde} · {SCHRITT_NAME[t.schritt] ?? t.schritt} · Takt {i + 1} von {ts.length}
          </div>
          <h3 className="text-xl font-black">{t.titel}</h3>
          {t.text && <p className="text-sm">{t.text}</p>}
          {t.schritt === "lq" && <p className="text-sm">Aus allen neuen Werten ergibt sich die Lebensqualität: <b className="text-2xl">{Math.round(z.lq)}</b></p>}
          <ul className="flex flex-col gap-1.5">
            {aenderungen.map(({ g, summe }) => {
              const jetzt = vorher[g] + summe * f;
              return (
                <li key={g} className="rounded-xl border border-line px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{BEREICH[g].icon} {BEREICH[g].name}</span>
                    <span className="tabular-nums font-black" style={{ color: gut(g, summe) ? "var(--green)" : "var(--red)" }}>{zahl(summe)}</span>
                  </div>
                  <div className="relative h-2.5 mt-1 rounded-full bg-surface-hover">
                    <div className="absolute top-0 bottom-0 rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, jetzt))}%`, background: gut(g, summe) ? "var(--green)" : "var(--red)", opacity: 0.8 }} />
                    <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-fg" style={{ left: `${Math.max(0, Math.min(100, vorher[g]))}%` }} title="vorher" />
                  </div>
                  <div className="text-xs text-muted tabular-nums mt-0.5">{Math.round(vorher[g])} → {Math.round(jetzt)}</div>
                </li>
              );
            })}
          </ul>
          {t.beitraege.length > 0 && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Woher genau?</summary>
              <ul className="mt-1 space-y-1">
                {t.beitraege.filter((b) => Math.abs(b.wert) >= 0.05).map((b, j) => (
                  <li key={j}>{BEREICH[b.nach].name} {zahl(b.wert)}: {b.grund} {b.quelle && b.quelle !== "annahme" && <QuelleLink id={b.quelle} />}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="min-w-0">
          <Wirkungsnetz z={z} werte={werte} markiert={t.pfeile} hervorheben={t.fokus ? [t.fokus] : []}
            fliessen={laeuft ? TEMPO[tempo].ms / 2500 : 0} />
        </div>
      </div>
    </div>
  );
}
