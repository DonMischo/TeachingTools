"use client";
/**
 * Ein Exitgame als isometrisches Gebäude: jeder Abschnitt ein Stockwerk,
 * jede Folie ein Zimmer, jede Tür ein verschlossenes Treppenhaus. Geprüft
 * wird wie in der Folienansicht auf dem Server (gleiche Ereignisse,
 * gleiche Aufgaben-Bausteine) — das Gebäude ist nur eine andere Ansicht.
 */
import { useMemo, useState } from "react";
import {
  api, type DdaAdaptation, type ExitGameAttemptSummary, type ExitGameData, type ExitGameFragment,
} from "@/lib/api";
import { MathText } from "@/components/MathText";
import { abschnitte, seedAus } from "@/lib/gebaeude/exitgame";
import { bauePlan } from "@/lib/gebaeude/plan";
import Gebaeude, { type Ort } from "@/components/gebaeude/Gebaeude";
import type { RaumZustand } from "@/components/gebaeude/szene";
import { MediaView, TaskArea, levelOf } from "./FolienTeile";

interface Props {
  code: string;
  attempt: ExitGameAttemptSummary;
  exitgameId: number;
  data: ExitGameData;
  variantChoices: Record<string, number>;
  fragments: ExitGameFragment[];
  adaptation: DdaAdaptation | null;
  onSlideSolved: (attempt: ExitGameAttemptSummary, fragments: ExitGameFragment[]) => void;
  onAdaptation: (a: DdaAdaptation | null) => void;
  onFinish: () => void;
}

export default function GebaeudeSpiel({
  code, attempt, exitgameId, data, variantChoices, fragments, adaptation, onSlideSolved, onAdaptation, onFinish,
}: Props) {
  const slides = data.slides;
  const teile = useMemo(() => abschnitte(slides), [slides]);
  const plan = useMemo(() => bauePlan(teile.map(t => t.raeume.length), seedAus(code)), [teile, code]);
  const geloest = attempt.solved_slide_ids;

  /**
   * Tür offen: gelöst — oder es gibt an ihr nichts zu tun (keine Aufgabe und
   * keine Codeschnipsel im Abschnitt). Bewusst aus den Folien bestimmt, nicht
   * aus `fragments`: die kommen erst nach dem ersten Zeichnen an.
   */
  const tuerOffen = (i: number) => {
    const t = teile[i].tuer;
    if (t === null) return true;
    const s = slides[t];
    const mitSchnipsel = teile[i].raeume.some(k => {
      const f = slides[k];
      return !!f.task?.codeFragment || !!f.tasks?.some(a => a.codeFragment);
    });
    const nichts = !(s.tasks?.length || s.task) && !mitSchnipsel;
    return nichts || geloest.includes(s.id);
  };
  const zielOffen = teile.map((_, i) => tuerOffen(i));

  // Weiter oben anfangen, wenn die Türen darunter schon offen sind (Wiedereinstieg).
  const [stock, setStock] = useState(() => {
    const i = teile.findIndex((_, k) => !tuerOffen(k));
    return i < 0 ? teile.length - 1 : i;
  });
  const [gelesen, setGelesen] = useState<Set<string>>(new Set());
  const [offen, setOffen] = useState<number | null>(null);
  const [zurTuer, setZurTuer] = useState(false);
  const [auftrag, setAuftrag] = useState<{ ort: Ort; nr: number } | null>(null);
  const laufe = (ort: Ort) => setAuftrag(a => ({ ort, nr: (a?.nr ?? 0) + 1 }));

  const zustand = (idx: number): RaumZustand => {
    const s = slides[idx];
    if (s.type === "task") return geloest.includes(s.id) ? "geloest" : "offen";
    return gelesen.has(s.id) ? "gelesen" : "info";
  };
  const zustaende = teile.map(t => t.raeume.map(zustand));

  const zeige = (idx: number) => {
    setOffen(idx);
    const s = slides[idx];
    if (s.type !== "task" && s.type !== "door") setGelesen(g => new Set(g).add(s.id));
    api.exitgame.attempts.postEvent(attempt.id, s.id, "view", { slide_index: idx });
  };

  const letzter = stock === teile.length - 1;
  const hoch = () => {
    setOffen(null);
    if (letzter) onFinish();
    else setStock(s => s + 1);
  };

  const ankunft = (ort: Ort) => {
    if (ort.art === "raum") { setZurTuer(false); zeige(teile[stock].raeume[ort.raum]); return; }
    if (zielOffen[stock]) { hoch(); return; }
    zeige(teile[stock].tuer!);
  };

  // Rücksprung von der Tür zu einer offenen Aufgabe: im selben Stockwerk hinlaufen.
  const rueckblick = (slideId: string) => {
    const idx = slides.findIndex(s => s.id === slideId);
    if (idx < 0) return;
    api.exitgame.attempts.postEvent(attempt.id, slides[offen ?? idx].id, "review_jump", { target_slide_id: slideId });
    const k = teile[stock].raeume.indexOf(idx);
    setZurTuer(true);
    if (k >= 0) { setOffen(null); laufe({ art: "raum", raum: k }); }
    else zeige(idx);
  };

  const s = offen !== null ? slides[offen] : null;
  const abschnitt = teile[stock];
  const schnipsel = abschnitt.tuer !== null ? fragments.filter(f => f.door_id === slides[abschnitt.tuer!].id) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
        <div className="relative h-[70vh] min-h-[380px] rounded-2xl border border-[var(--border)] overflow-hidden bg-gradient-to-b from-sky-900/30 to-transparent">
          <Gebaeude plan={plan} stock={stock} zustaende={zustaende} zielOffen={zielOffen}
            aktiv={s === null} auftrag={auftrag} onAnkunft={ankunft} />
          <div className="absolute top-2 left-2 rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] px-2 py-1 text-xs font-bold">
            🏢 Stockwerk {stock + 1} / {teile.length}
          </div>

          {s && offen !== null && (
            <div className="absolute inset-0 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-6" data-zimmer={s.id}>
              <section className="w-full max-w-xl max-h-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-3 shadow-2xl">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-muted)]">
                    {s.type === "explanation" ? "📖 Erklärung" : s.type === "example" ? "💡 Beispiel" : s.type === "task" ? "✏️ Aufgabe" : "🚪 Tür zum Treppenhaus"}
                  </span>
                  <button onClick={() => setOffen(null)} className="text-sm px-2 rounded hover:bg-[var(--surface-hover)]" aria-label="Zimmer verlassen">✕</button>
                </div>
                {s.title && <h2 className="font-semibold">{s.title}</h2>}
                {s.text && <MathText text={s.text} blockEquations className="text-sm whitespace-pre-line" />}
                {s.media && <MediaView media={s.media} exitgameId={exitgameId} />}
                {(s.type === "task" || s.type === "door") && (
                  <TaskArea key={s.id} slide={s} attemptId={attempt.id} solvedSlideIds={geloest}
                    variantChoices={variantChoices} level={levelOf(adaptation)} fragments={fragments}
                    onSlideSolved={onSlideSolved} onAdaptation={a => { if (a) onAdaptation(a); }}
                    onReview={rueckblick} />
                )}
                <div className="flex gap-2 flex-wrap">
                  {s.type === "door" && zielOffen[stock] ? (
                    <button onClick={hoch} className="btn-primary text-sm py-1.5 px-4">
                      {letzter ? "🎉 Hinaus!" : "⬆ Die Treppe hinauf"}
                    </button>
                  ) : (
                    <button onClick={() => setOffen(null)} className="btn-primary text-sm py-1.5 px-4">
                      {s.type === "task" && !geloest.includes(s.id) ? "Später lösen" : "Zurück in den Flur"}
                    </button>
                  )}
                  {zurTuer && s.type !== "door" && abschnitt.tuer !== null && (
                    <button onClick={() => { setOffen(null); setZurTuer(false); laufe({ art: "ziel" }); }}
                      className="text-sm text-[var(--accent)] hover:underline">🚪 Zurück zur Tür</button>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <h2 className="font-black">{data.title}</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Klicke auf den Boden oder nutze die Pfeiltasten. In den Zimmern warten Erklärungen und Aufgaben; jede gelöste Aufgabe gibt einen
            Codeschnipsel für die Tür zum Treppenhaus.
          </p>
          <div className="flex flex-col gap-1">
            {abschnitt.raeume.map((idx, k) => {
              const z = zustand(idx);
              return (
                <button key={idx} onClick={() => laufe({ art: "raum", raum: k })}
                  className="text-left px-2 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] flex gap-2 items-center">
                  <span className="w-6 text-center">{z === "geloest" ? "✅" : z === "offen" ? "✏️" : z === "info" ? "📖" : "☑️"}</span>
                  <span className="truncate">{z === "info" || z === "gelesen" ? "" : `${k + 1}. `}{slides[idx].title ?? slides[idx].id}</span>
                </button>
              );
            })}
            <button onClick={() => laufe({ art: "ziel" })}
              className="text-left px-2 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] flex gap-2 items-center font-bold">
              <span className="w-6 text-center">{zielOffen[stock] ? (letzter ? "🏁" : "⬆") : "🔒"}</span>
              {letzter ? "Ausgang" : "Treppenhaus"}
            </button>
          </div>
          {schnipsel.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[var(--text-muted)] mb-1">🔑 Codeschnipsel für diese Tür</p>
              <div className="flex gap-1 flex-wrap">
                {schnipsel.map(f => (
                  <span key={`${f.slide_id}:${f.task_index}`}
                    className={`font-mono text-sm px-2 py-0.5 rounded border ${f.earned ? "border-[var(--border)]" : "border-dashed border-[var(--accent)] text-[var(--accent)]"}`}>
                    {f.earned ? f.fragment : "?"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
