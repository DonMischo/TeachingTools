"use client";
import { useState, type ReactNode } from "react";
import { BEREICH } from "@/lib/leviathan/bereiche";
import { QUELLEN } from "@/lib/leviathan/quellen";
import { EIGENDYNAMIK, REGELN } from "@/lib/leviathan/regeln";
import { istHebel } from "@/lib/leviathan/motor";
import { HOCH_SCHLECHT, type Groesse } from "@/lib/leviathan/typen";

export function Karte({ titel, children, rechts, className = "" }: {
  titel?: ReactNode; children: ReactNode; rechts?: ReactNode; className?: string;
}) {
  return (
    <section className={`card p-4 ${className}`}>
      {(titel || rechts) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-muted">{titel}</h2>
          {rechts}
        </div>
      )}
      {children}
    </section>
  );
}

/** Farbe eines Werts: grün = gut, rot = schlecht – unabhängig davon, ob hoch gut ist. */
export function farbe(g: Groesse, wert: number): string {
  const gut = HOCH_SCHLECHT.has(g) ? 100 - wert : wert;
  return gut >= 60 ? "var(--green)" : gut >= 35 ? "var(--accent)" : "var(--red)";
}

export function Trend({ g, delta }: { g: Groesse; delta: number }) {
  if (Math.abs(delta) < 0.5) return <span className="text-muted text-xs w-8 text-right">±0</span>;
  const gut = HOCH_SCHLECHT.has(g) ? delta < 0 : delta > 0;
  return (
    <span className="text-xs font-bold w-8 text-right tabular-nums" style={{ color: gut ? "var(--green)" : "var(--red)" }}>
      {delta > 0 ? "▲" : "▼"}{Math.abs(Math.round(delta))}
    </span>
  );
}

export function Balken({ g, wert, delta, markierungen = [] }: {
  g: Groesse; wert: number; delta?: number; markierungen?: number[];
}) {
  const b = BEREICH[g];
  return (
    <div className="flex items-center gap-2 text-sm" title={b.kurz}>
      <span className="w-6 text-center" aria-hidden>{b.icon}</span>
      <span className="w-28 sm:w-40 shrink-0 truncate">{b.name}</span>
      <div className="relative flex-1 min-w-12 h-3 rounded-full bg-surface-hover overflow-hidden" role="meter"
        aria-label={b.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(wert)}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${wert}%`, background: farbe(g, wert) }} />
        {markierungen.map((m) => (
          <div key={m} className="absolute top-0 bottom-0 w-0.5 bg-fg opacity-60" style={{ left: `${m}%` }}
            title={`Kipppunkt bei ${m}`} />
        ))}
      </div>
      <span className="w-8 text-right tabular-nums font-bold">{Math.round(wert)}</span>
      {delta !== undefined && <Trend g={g} delta={delta} />}
      <Warum g={g} />
    </div>
  );
}

export function QuelleLink({ id }: { id?: string }) {
  if (!id) return null;
  const q = QUELLEN[id];
  if (!q) return null;
  return (
    <span className="text-xs text-muted">
      {q.umstritten && <span className="font-bold text-accent">Forschung uneins · </span>}
      {q.url ? <a href={q.url} target="_blank" rel="noreferrer" className="underline hover:text-fg">{q.kurz}</a> : q.kurz}
    </span>
  );
}

/** »Warum?«: welche Bereiche wirken auf diese Größe, und woher wissen wir das? */
export function Warum({ g }: { g: Groesse }) {
  const [offen, setOffen] = useState(false);
  const regeln = REGELN.filter((r) => r.nach === g);
  const eigen = EIGENDYNAMIK[g] ?? [];
  return (
    <span className="relative">
      <button onClick={() => setOffen((o) => !o)} aria-expanded={offen} aria-label={`Warum ändert sich ${BEREICH[g].name}?`}
        className="w-5 h-5 rounded-full border border-line text-[10px] font-black text-muted hover:text-fg">?</button>
      {offen && (
        <div className="absolute right-0 top-6 z-20 w-80 max-w-[85vw] rounded-xl border border-line bg-surface shadow-xl p-3 text-xs space-y-2">
          <div className="font-bold text-sm">Was wirkt auf {BEREICH[g].name}?</div>
          {regeln.map((r, i) => {
            const plus = r.staerke > 0;
            return (
              <div key={i} className="border-t border-line pt-2">
                <div>
                  <b>{BEREICH[r.von].icon} {BEREICH[r.von].name}</b>{" "}
                  {r.nurUeber50 ? "(ab 50) " : ""}
                  <span style={{ color: plus ? "var(--green)" : "var(--red)" }}>{plus ? "hoch → steigt" : "hoch → sinkt"}</span>
                  {r.verzoegerung > 0 && <span className="text-muted"> · wirkt nach {r.verzoegerung * 2} Jahren</span>}
                </div>
                <div className="text-muted mt-0.5">{QUELLEN[r.quelle]?.befund}</div>
                <QuelleLink id={r.quelle} />
              </div>
            );
          })}
          {eigen.map((x, i) => (
            <div key={`e${i}`} className="border-t border-line pt-2">
              <div>{x.text}</div>
              <QuelleLink id={x.quelle} />
            </div>
          ))}
          {g !== "klima" && (
            <div className="border-t border-line pt-2 text-muted">
              {istHebel(g) ? "Ohne Investitionen verfällt dieser Bereich langsam." : "Ohne Anstoß kehrt der Wert langsam zur Mitte zurück."}
            </div>
          )}
          <button onClick={() => setOffen(false)} className="text-muted underline">schließen</button>
        </div>
      )}
    </span>
  );
}

export function Punkte({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span aria-label={`Schwierigkeit ${n} von ${max}`} className="tracking-tighter">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ color: i < n ? "var(--accent)" : "var(--border)" }}>●</span>
      ))}
    </span>
  );
}
