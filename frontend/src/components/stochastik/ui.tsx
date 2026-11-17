"use client";
/** Gemeinsame Bausteine der Stochastik-Blätter: Lektionskopf, Kästen, Erfolgsmeldung. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { lektion, NIVEAU_NAME, type LektionId, type Niveau } from "@/lib/stochastik/lektionen";
import { melde, type Erfolg, type Stand } from "@/lib/stochastik/erfolge";

export { Kasten } from "@/components/quadratisch/teile";
export { Chips } from "@/components/prozent/ui";

/** Springen zu einer anderen Lektion (für »kennst du aus …«) und das gewählte Niveau. */
export const Navi = createContext<{ gehe: (id: LektionId) => void; niveau: Niveau | null }>({ gehe: () => {}, niveau: null });

const NIV_FARBE: Record<Niveau, string> = { H: "#0ea5e9", R: "#22c55e", G: "#a855f7" };

export function NiveauMarke({ n, aus }: { n: Niveau; aus?: boolean }) {
  return (
    <span title={NIVEAU_NAME[n]} className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-black text-white ${aus ? "opacity-25" : ""}`}
      style={{ background: NIV_FARBE[n] }}>{n}</span>
  );
}

/** Kopf jeder Lektion: Klasse, Niveaus, Lehrplan, Rückgriffe, früher. */
export function LektionsKopf({ id, children }: { id: LektionId; children?: ReactNode }) {
  const l = lektion(id);
  const { gehe, niveau } = useContext(Navi);
  const [offen, setOffen] = useState(false);
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-black">{l.icon} {l.label}</h2>
        <span className="rounded-full bg-accent text-accent-fg px-2.5 py-0.5 text-xs font-black">Kl. {l.klasse}</span>
        <span className="flex gap-1">{(["H", "R", "G"] as Niveau[]).map(n => <NiveauMarke key={n} n={n} aus={!l.niveaus.includes(n)} />)}</span>
        {niveau && !l.niveaus.includes(niveau) && <span className="text-xs text-bad font-bold">nicht im {NIVEAU_NAME[niveau]}</span>}
        <span className="flex-1" />
        <button className="text-xs text-muted hover:text-fg underline" onClick={() => setOffen(o => !o)}>{offen ? "Lehrplan zu" : "📜 Lehrplan"}</button>
      </div>
      {children && <p className="text-sm max-w-4xl">{children}</p>}
      {l.rueckgriff && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {l.rueckgriff.map(r => {
            const z = lektion(r.id);
            return (
              <button key={r.id} onClick={() => gehe(r.id)} title={r.text}
                className="rounded-full border border-line px-2.5 py-1 hover:border-line-active hover:bg-surface-hover text-left">
                ↩ kennst du aus Kl. {z.klasse}: <b>{z.icon} {z.label}</b> – <span className="text-muted">{r.text}</span>
              </button>
            );
          })}
        </div>
      )}
      {offen && (
        <div className="text-xs text-muted flex flex-col gap-1 border-t border-line pt-2">
          <p><b className="text-fg">Lehrplan Mathematik 2026 (Thüringen):</b> {l.lehrplan}.</p>
          {l.frueher && <p><b className="text-fg">Wanderung:</b> {l.frueher}</p>}
          {l.ausblick && <p><b className="text-fg">Ausblick:</b> {l.ausblick}</p>}
          <p>Die neuen Pläne gelten ab 2026/27 für Kl. 5/6 und 7, danach jährlich für 8, 9 und 10.</p>
        </div>
      )}
    </div>
  );
}

/** Kleine Kennzahl-Kachel. */
export function Kachel({ label, wert, farbe, hinweis }: { label: ReactNode; wert: ReactNode; farbe?: string; hinweis?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-page px-3 py-2 flex flex-col min-w-24">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-lg font-black tabular-nums" style={farbe ? { color: farbe } : undefined}>{wert}</span>
      {hinweis && <span className="text-[11px] text-muted">{hinweis}</span>}
    </div>
  );
}

/** Meldet einen Fortschritt und zeigt neu erreichte Erfolge kurz an. */
const Melder = createContext<(f: (s: Stand) => Stand) => void>(() => {});
export const useMelden = () => useContext(Melder);

export function ErfolgsMelder({ children }: { children: ReactNode }) {
  const [neu, setNeu] = useState<Erfolg[]>([]);
  useEffect(() => {
    if (!neu.length) return;
    const t = setTimeout(() => setNeu([]), 4500);
    return () => clearTimeout(t);
  }, [neu]);
  const melden = (f: (s: Stand) => Stand) => {
    const n = melde(f);
    if (n.length) setNeu(alt => [...alt, ...n]);
  };
  return (
    <Melder.Provider value={melden}>
      {children}
      {neu.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status">
          {neu.map(e => (
            <div key={e.id} className="card px-4 py-3 shadow-xl border-line-active flex items-center gap-3 animate-[pulse_1s_ease-in-out_1]">
              <span className="text-3xl">{e.icon}</span>
              <span><span className="text-xs text-muted block">Erfolg erreicht</span><b>{e.name}</b></span>
            </div>
          ))}
        </div>
      )}
    </Melder.Provider>
  );
}

/** Zahl mit Zahlfeld, für kleine Eingaben. */
export function Zahl({ label, wert, setze, min, max, breite = "w-20" }: { label: ReactNode; wert: number; setze: (n: number) => void; min: number; max: number; breite?: string }) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <input type="number" className={`input ${breite}`} value={wert} min={min} max={max}
        onChange={e => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n)) setze(Math.max(min, Math.min(max, n))); }} />
    </label>
  );
}
