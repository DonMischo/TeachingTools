"use client";
/** Erkennen: Teile anklicken und nachlesen, oder im Quiz das gesuchte Teil finden. */
import { useEffect, useMemo, useState } from "react";
import { inSchicht, komplett, teil } from "@/lib/pcbau/logik";
import type { Geraet, Teil } from "@/lib/pcbau/typen";
import { Ansicht, KATEGORIEN, type Blick } from "./Ansichten";
import { KategorieChip, Vorschau } from "./Teile";

const RUNDEN = 10;
const quizKey = (id: string) => `hp_pcbau_quiz_${id}`;

type Aufgabe = { id: string; nachName: boolean };

function mische<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export default function Erkennen({ g, blick }: { g: Geraet; blick: Blick }) {
  const bau = useMemo(() => komplett(g), [g]);
  const [schicht, setSchicht] = useState<number | undefined>(g.schichten ? 1 : undefined);
  const kandidaten = useMemo(() => g.teile.filter(t => !t.nichtAbfragen && inSchicht(t, schicht)), [g, schicht]);
  const speicher = quizKey(g.id + (schicht === undefined ? "" : `_s${schicht}`));
  const [markiert, setMarkiert] = useState<string | null>(null);
  const [namen, setNamen] = useState(false);
  const [quiz, setQuiz] = useState<{ aufgaben: Aufgabe[]; i: number; punkte: number; versuch: number } | null>(null);
  const [blitz, setBlitz] = useState<{ id: string; ok: boolean } | null>(null);
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    setQuiz(null); setMarkiert(null);
    try { const v = localStorage.getItem(speicher); setBest(v ? Number(v) : null); } catch { setBest(null); }
  }, [speicher]);

  function starte() {
    const ids = mische(kandidaten).slice(0, Math.min(RUNDEN, kandidaten.length));
    setQuiz({ aufgaben: ids.map((t, i) => ({ id: t.id, nachName: i % 2 === 0 })), i: 0, punkte: 0, versuch: 0 });
    setNamen(false); setMarkiert(null);
  }

  function klick(id: string) {
    if (!quiz || quiz.i >= quiz.aufgaben.length) { setMarkiert(id); return; }
    if (blitz) return;
    const ziel = quiz.aufgaben[quiz.i].id;
    const ok = id === ziel;
    setBlitz({ id, ok });
    setTimeout(() => {
      setBlitz(null);
      if (!ok && quiz.versuch === 0) { setQuiz({ ...quiz, versuch: 1 }); return; }
      const punkte = quiz.punkte + (ok ? (quiz.versuch === 0 ? 2 : 1) : 0);
      const i = quiz.i + 1;
      setQuiz({ ...quiz, i, punkte, versuch: 0 });
      if (i >= quiz.aufgaben.length && (best === null || punkte > best)) {
        setBest(punkte);
        try { localStorage.setItem(speicher, String(punkte)); } catch { /* nur im Speicher */ }
      }
    }, 700);
  }

  const aktiv = quiz && quiz.i < quiz.aufgaben.length ? quiz.aufgaben[quiz.i] : null;
  const gesucht = aktiv ? teil(g, aktiv.id)! : null;
  const m = markiert ? teil(g, markiert) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
      <div className="grid gap-3">
        {gesucht && (
          <div className="card p-3 flex items-center gap-3 border-accent">
            <span className="text-2xl">🔎</span>
            <div className="flex-1">
              <div className="text-xs font-bold text-muted">Frage {quiz!.i + 1} von {quiz!.aufgaben.length}{quiz!.versuch ? " · zweiter Versuch" : ""}</div>
              <div className="font-black">
                {aktiv!.nachName ? <>Wo ist: {gesucht.name}?</> : <>Welches Teil {gesucht.kurz}?</>}
              </div>
            </div>
            <div className="text-lg font-black">{quiz!.punkte} P</div>
          </div>
        )}
        {g.schichten && schicht !== undefined && <SchichtWahl schichten={g.schichten} schicht={schicht} setSchicht={setSchicht} />}
        <Ansicht blick={blick} g={g} bau={bau} an={!quiz} markiert={quiz ? null : markiert} namen={namen} blitz={blitz} schicht={schicht}
          onTeil={klick} onKnoten={klick} />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={starte}>🎯 {quiz ? "Quiz neu starten" : "Quiz starten"}</button>
          {!quiz && (
            <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={namen} onChange={e => setNamen(e.target.checked)} /> Namen anzeigen
            </label>
          )}
          {quiz && <button className="btn btn-secondary" onClick={() => setQuiz(null)}>Quiz beenden</button>}
          {best !== null && <span className="ml-auto text-sm text-muted">🏆 Bestes Quiz: {best} von {2 * Math.min(RUNDEN, kandidaten.length)} Punkten</span>}
        </div>
        {quiz && !aktiv && (
          <div className="card p-4">
            <h3 className="text-lg font-black">🏁 {quiz.punkte} von {2 * quiz.aufgaben.length} Punkten</h3>
            <p className="text-sm text-muted">Im ersten Versuch gibt es 2 Punkte, im zweiten noch 1. Probier es auch im Schaltplan!</p>
          </div>
        )}
      </div>

      <aside className="grid gap-3">
        {m && !aktiv ? (
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <Vorschau t={m} />
              <div><h3 className="font-black leading-tight">{m.name}</h3><div className="mt-1"><KategorieChip t={m} /></div></div>
            </div>
            <p className="font-semibold text-sm mt-3">{m.kurz[0].toUpperCase() + m.kurz.slice(1)}.</p>
            <p className="text-sm text-muted mt-1">{m.info}</p>
          </div>
        ) : (
          <div className="card p-4 text-sm text-muted">
            {aktiv ? "Klicke in der Ansicht auf das gesuchte Teil." : "Klicke ein Teil an, um zu erfahren, was es tut."}
          </div>
        )}
        <Legende teile={kandidaten} onWahl={id => !aktiv && setMarkiert(id)} markiert={markiert} verdeckt={!!aktiv} />
      </aside>
    </div>
  );
}

function Legende({ teile, onWahl, markiert, verdeckt }: { teile: Teil[]; onWahl: (id: string) => void; markiert: string | null; verdeckt: boolean }) {
  return (
    <div className="card p-3">
      <h3 className="font-black text-sm mb-2">🧩 Alle Teile ({teile.length})</h3>
      <div className="grid gap-1">
        {teile.map(t => (
          <button key={t.id} disabled={verdeckt} onClick={() => onWahl(t.id)}
            className={`flex items-center gap-2 rounded-lg px-2 py-1 text-left text-sm transition ${markiert === t.id ? "bg-accent/15 font-bold" : "hover:bg-surface-hover"} disabled:opacity-40`}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: KATEGORIEN[t.kategorie].farbe }} />
            {verdeckt ? "???" : t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Zerlegen: Schicht für Schicht abnehmen oder wieder zusammensetzen. */
function SchichtWahl({ schichten, schicht, setSchicht }: { schichten: { name: string; text: string }[]; schicht: number; setSchicht: (n: number) => void }) {
  const letzte = schichten.length - 1;
  return (
    <div className="card p-3 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-secondary" disabled={schicht === 0} onClick={() => setSchicht(schicht - 1)} aria-label="Schicht zurück">◀</button>
        <div className="flex flex-1 flex-wrap gap-1">
          {schichten.map((s, i) => (
            <button key={s.name} onClick={() => setSchicht(i)} aria-pressed={i === schicht}
              className={`flex-1 min-w-24 rounded-lg px-2 py-1.5 text-sm font-bold transition-colors ${i === schicht ? "bg-accent text-accent-fg" : i < schicht ? "bg-surface-hover text-fg" : "text-muted hover:text-fg border border-line"}`}>
              {i + 1}. {s.name}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" disabled={schicht === letzte} onClick={() => setSchicht(schicht + 1)}>Abnehmen ▶</button>
      </div>
      <p className="text-sm text-muted">🛠️ {schichten[schicht].text}</p>
    </div>
  );
}
