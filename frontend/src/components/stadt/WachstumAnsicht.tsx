"use client";
/**
 * Reiter »Wachstum«: Die Stadt wächst Epoche für Epoche auf dem gewählten
 * Gelände. Daneben Erklärung, was neu ist, und ein Quiz zum Prüfen.
 */
import type { GelaendeBilder } from "@/components/gelaende/leinwand";
import { useEffect, useMemo, useState } from "react";
import type { Gelaende } from "@/lib/gelaende/gelaende";
import { schwerpunkt } from "@/lib/stadt/geometrie";
import { haeuser } from "@/lib/stadt/haeuser";
import { STILE, ZONEN, type Epoche, type Stil } from "@/lib/stadt/modell";
import { quizFragen, trifft, zielOrt, type Frage } from "@/lib/stadt/quiz";
import { wachse, zonenIn } from "@/lib/stadt/wachstum";
import Karte from "./Karte";
import Stadt3D from "./Stadt3D";

const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

export default function WachstumAnsicht({ g, bild, stil, setStil }: { g: Gelaende; bild: GelaendeBilder; stil: Stil; setStil: (s: Stil) => void }) {
  const [epochen, setEpochen] = useState<Epoche[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [zonen, setZonen] = useState(false);
  const [drei, setDrei] = useState(false);
  const [quiz, setQuiz] = useState<{ fragen: Frage[]; nr: number; punkte: number; antwort: null | { ok: boolean; wahl?: number } } | null>(null);

  useEffect(() => {
    setEpochen(null);
    setQuiz(null);
    const t = setTimeout(() => { const e = wachse(stil, g, g.wahl.seed); setEpochen(e); setIdx(i => Math.min(i, e.length - 1)); }, 20);
    return () => clearTimeout(t);
  }, [stil, g]);

  const frage = quiz && quiz.nr < quiz.fragen.length ? quiz.fragen[quiz.nr] : null;
  const zeigeIdx = frage?.art === "epoche" ? frage.epoche : idx;
  const stadt = epochen?.[zeigeIdx]?.stadt ?? null;
  const hs = useMemo(() => (stadt ? haeuser(stadt, g, g.wahl.seed) : []), [stadt, g]);
  const fokus = useMemo(() => {
    if (!epochen) return null;
    // Mitte aus der frühen Stadt, Ausschnitt so groß wie die späteste
    const frueh = epochen[Math.min(1, epochen.length - 1)].stadt;
    const c = schwerpunkt([...frueh.bauten, ...frueh.zonen.flatMap(z => z.poly)]);
    const spaet = epochen[epochen.length - 1].stadt.zonen.flatMap(z => z.poly);
    const r = Math.max(450, ...spaet.map(p => Math.hypot(p.x - c.x, p.y - c.y)));
    return { x: c.x, y: c.y, r: Math.min(g.breite / 2, r * 1.05) };
  }, [epochen, g]);

  const e = epochen?.[idx];
  const startQuiz = () => epochen && setQuiz({ fragen: quizFragen(stil, epochen, idx, Date.now() % 1e6), nr: 0, punkte: 0, antwort: null });
  const antworte = (ok: boolean, wahl?: number) => setQuiz(q => (q && !q.antwort ? { ...q, punkte: q.punkte + (ok ? 1 : 0), antwort: { ok, wahl } } : q));
  const marken = frage?.art === "zeige" && quiz?.antwort && stadt ? (() => { const o = zielOrt(frage, stadt); return o ? [{ p: o, r: 40, farbe: quiz.antwort.ok ? "#16a34a" : "#dc2626" }] : []; })() : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl border border-line bg-surface p-1">
          {STILE.map(s => <button key={s.id} onClick={() => setStil(s.id)} className={chip(stil === s.id)}>{s.icon} {s.label}</button>)}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted"><input type="checkbox" checked={zonen} onChange={x => setZonen(x.target.checked)} /> Viertel farbig</label>
        <button className={drei ? "btn-primary py-1.5" : "btn-secondary py-1.5"} onClick={() => setDrei(d => !d)}>🛩️ 3D-Flug</button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {!epochen || !stadt ? (
            <div className="flex h-[600px] items-center justify-center rounded-xl border border-line text-muted">⏳ Die Stadt wächst …</div>
          ) : drei ? (
            <Stadt3D g={g} stadt={stadt} haeuser={hs} bild={bild} mitte={fokus} />
          ) : (
            <Karte g={g} bild={bild} stadt={stadt} haeuser={hs} zonen={zonen} fokus={fokus} marken={marken}
              werkzeug={frage?.art === "zeige" && !quiz?.antwort ? "klick" : null}
              onKlick={p => { if (frage?.art === "zeige" && stadt) antworte(trifft(frage, stadt, p)); }} />
          )}
          {epochen && (
            <div className="mt-2 flex items-center gap-2">
              <input type="range" min={0} max={epochen.length - 1} value={idx} disabled={!!quiz} onChange={x => setIdx(Number(x.target.value))} className="flex-1" aria-label="Epoche" />
            </div>
          )}
          {epochen && (
            <div className="mt-1 flex flex-wrap gap-1">
              {epochen.map((x, i) => (
                <button key={i} disabled={!!quiz} onClick={() => setIdx(i)} className={`chip ${i === idx ? "chip-on" : ""}`}>{x.jahr}</button>
              ))}
            </div>
          )}
        </div>
        <aside className="card flex flex-col gap-3 p-4">
          {!quiz && e && (
            <>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-muted">{e.jahr}</div>
                <h2 className="text-lg font-black">{e.titel}</h2>
              </div>
              <p className="text-sm leading-relaxed">{e.text}</p>
              <div>
                <div className="mb-1 text-xs font-bold text-muted">Neu in dieser Epoche</div>
                <ul className="list-disc pl-5 text-sm">{e.neu.map(n => <li key={n}>{n}</li>)}</ul>
              </div>
              <div>
                <div className="mb-1 text-xs font-bold text-muted">Viertel</div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {zonenIn(e.stadt).map(z => <span key={z} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: ZONEN[z].farbe }} />{ZONEN[z].label}</span>)}
                </div>
              </div>
              <div className="mt-auto flex gap-2">
                <button className="btn-secondary" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>◀</button>
                <button className="btn-secondary" disabled={idx === epochen!.length - 1} onClick={() => setIdx(i => i + 1)}>▶</button>
                <button className="btn-primary flex-1" onClick={startQuiz}>❓ Quiz zu dieser Karte</button>
              </div>
            </>
          )}
          {quiz && (
            <QuizKasten quiz={quiz} frage={frage} antworte={antworte}
              weiter={() => setQuiz(q => (q ? { ...q, nr: q.nr + 1, antwort: null } : q))}
              ende={() => setQuiz(null)} nochmal={startQuiz} />
          )}
        </aside>
      </div>
    </div>
  );
}

function QuizKasten({ quiz, frage, antworte, weiter, ende, nochmal }: {
  quiz: { fragen: Frage[]; nr: number; punkte: number; antwort: null | { ok: boolean; wahl?: number } };
  frage: Frage | null;
  antworte: (ok: boolean, wahl?: number) => void;
  weiter: () => void; ende: () => void; nochmal: () => void;
}) {
  if (!frage) {
    const q = quiz.punkte / quiz.fragen.length;
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-black">Geschafft!</h2>
        <p className="text-3xl font-black">{quiz.punkte} / {quiz.fragen.length}</p>
        <p className="text-sm text-muted">{q >= 0.9 ? "🏆 Stadtplanungs-Profi!" : q >= 0.6 ? "👍 Gut — schau dir die Fehler noch einmal an." : "📘 Lies die Epochen noch einmal und versuch es nochmal."}</p>
        <div className="flex gap-2"><button className="btn-primary" onClick={nochmal}>🔁 Neue Fragen</button><button className="btn-secondary" onClick={ende}>Zurück</button></div>
      </div>
    );
  }
  const a = quiz.antwort;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between text-xs text-muted"><span>Frage {quiz.nr + 1} / {quiz.fragen.length}</span><span>✅ {quiz.punkte}</span></div>
      <h2 className="font-bold">{frage.text}</h2>
      {frage.art === "zeige" && !a && <p className="text-sm text-muted">👆 Klicke in die Karte. (Rechte Maustaste verschiebt.)</p>}
      {frage.art !== "zeige" && (
        <div className="flex flex-col gap-1.5">
          {frage.optionen.map((o, i) => (
            <button key={i} disabled={!!a} onClick={() => antworte(i === frage.richtig, i)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${a && i === frage.richtig ? "border-ok bg-ok/15" : a && a.wahl === i ? "border-bad bg-bad/15" : "border-line hover:bg-surface-hover"}`}>{o}</button>
          ))}
        </div>
      )}
      {a && (
        <div className={`rounded-lg p-3 text-sm ${a.ok ? "bg-ok/15" : "bg-bad/15"}`}>
          <b>{a.ok ? "✅ Richtig!" : frage.art === "zeige" ? "❌ Daneben — der Kreis zeigt, wo es ist." : "❌ Leider falsch."}</b>
          {frage.erklaerung && <p className="mt-1">{frage.erklaerung}</p>}
        </div>
      )}
      <div className="mt-auto flex gap-2">
        {a && <button className="btn-primary flex-1" onClick={weiter}>Weiter ▶</button>}
        {frage.art === "zeige" && !a && <button className="btn-secondary" onClick={() => antworte(false)}>Weiß nicht</button>}
        <button className="btn-secondary" onClick={ende}>Beenden</button>
      </div>
    </div>
  );
}
