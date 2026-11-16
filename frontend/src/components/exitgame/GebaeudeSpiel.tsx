"use client";
/**
 * Ein TaskCrawler als isometrisches Gebäude: jeder Abschnitt ein Stockwerk,
 * jede Folie ein Zimmer, jede Tür ein verschlossenes Treppenhaus. Geprüft
 * wird wie in der Folienansicht auf dem Server (gleiche Ereignisse,
 * gleiche Aufgaben-Bausteine) — das Gebäude ist nur eine andere Ansicht.
 */
import { useEffect, useMemo, useState } from "react";
import {
  api, type DdaAdaptation, type ExitGameAttemptSummary, type ExitGameData, type ExitGameFragment,
} from "@/lib/api";
import { abschnitte, seedAus, stationsObjekt } from "@/lib/gebaeude/exitgame";
import AvatarWahl from "@/components/gebaeude/AvatarWahl";
import { STANDARD_AVATAR, gespeicherterAvatar, ladeAvatar, type Avatar } from "@/components/gebaeude/avatar";
import { OBJEKT_NAME, OBJEKT_STIMME } from "@/lib/gebaeude/objekte";
import { bauePlan } from "@/lib/gebaeude/plan";
import { baueFreiPlan } from "@/lib/gebaeude/frei";
import Gebaeude, { type GebaeudeArt, type Ort } from "@/components/gebaeude/Gebaeude";
import FreiWelt from "@/components/gebaeude/frei/FreiWelt";
import { weltVon } from "@/components/gebaeude/frei/welt";
import type { RaumZustand, Stil } from "@/components/gebaeude/szene";
import { FolienText, MediaView, TaskArea, letzteInfo, levelOf } from "./FolienTeile";
import { SimKnopf } from "./SimStation";
import BossArea from "./BossArea";

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
  /** haus (Treppen hinauf), verlies (hinab, Monster und Bosse), ebene (Türen nebeneinander) oder frei (gemalte 3D-Welt, frei laufen) */
  art?: SpielArt;
  stil?: Stil;
  /** je Abschnitt ein eigener Stil ("gebaeude": {"stile": […]}) */
  stile?: (Stil | undefined)[];
}

export type SpielArt = GebaeudeArt | "frei";

/** Wörter je Art: wie heißen Stockwerk, Weiter und Zurück? */
const WORTE: Record<SpielArt, { stock: string; icon: string; weiter: string; zurueck: string; pfeil: string; tuer: string; hin: string }> = {
  haus: { stock: "Stockwerk", icon: "🏢", weiter: "Treppenhaus", zurueck: "⬇ Treppe hinunter", pfeil: "⬆", tuer: "Tür zum Treppenhaus", hin: "⬆ Die Treppe hinauf" },
  verlies: { stock: "Ebene", icon: "🗝️", weiter: "Treppe hinab (Boss)", zurueck: "⬆ Treppe hinauf", pfeil: "⬇", tuer: "Der Boss bewacht die Treppe", hin: "⬇ Die Treppe hinab" },
  ebene: { stock: "Abschnitt", icon: "🗺️", weiter: "Tür zum nächsten Abschnitt", zurueck: "⬅ Zurück durch die Tür", pfeil: "➡", tuer: "Verschlossene Tür", hin: "➡ Durch die Tür" },
  frei: { stock: "Abschnitt", icon: "🌲", weiter: "Tor zum nächsten Abschnitt", zurueck: "⬅ Zurück durchs Tor", pfeil: "➡", tuer: "Verschlossenes Tor", hin: "➡ Durchs Tor" },
};

/** Welt der freien Ansicht, wenn weder Spiel noch Spieler einen Stil wählen */
const FREI_STIL: Stil = "wald";

export default function GebaeudeSpiel({
  code, attempt, exitgameId, data, variantChoices, fragments, adaptation, onSlideSolved, onAdaptation, onFinish,
  art = "haus", stil, stile,
}: Props) {
  const slides = data.slides;
  const frei = art === "frei";
  const W = WORTE[art];
  const teile = useMemo(() => abschnitte(slides), [slides]);
  // Frei: je Abschnitt der Stil — er bestimmt die Welt (Gebäude, Höhle, Wald).
  const stilSchluessel = JSON.stringify([stil, stile]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const freiStile = useMemo(() => teile.map((_, i) => stile?.[i] ?? stil ?? FREI_STIL), [teile, stilSchluessel]);
  // Monster und Bosse: im Verlies überall, frei nur in den Höhlen.
  const monster = useMemo(() => teile.map((_, i) => (frei ? weltVon(freiStile[i]) === "hoehle" : art === "verlies")), [teile, frei, art, freiStile]);
  const plan = useMemo(() => (frei ? null : bauePlan(teile.map(t => t.raeume.length), seedAus(code), art as GebaeudeArt)), [teile, code, art, frei]);
  const organisch = JSON.stringify(freiStile.map(s => weltVon(s) !== "gebaeude"));
  const freiPlan = useMemo(
    () => (frei ? baueFreiPlan(teile.map(t => t.raeume.length), seedAus(code), JSON.parse(organisch) as boolean[]) : null),
    [teile, code, frei, organisch]);
  const objekte = useMemo(() => teile.map((t, k) => t.raeume.map(i => stationsObjekt(slides[i], monster[k]))), [teile, slides, monster]);
  // Wo Monster hausen, bewacht an jeder Tür ein Boss den Weg weiter.
  const waechter = useMemo(() => teile.map((t, k) => monster[k] && t.tuer !== null), [teile, monster]);
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
      return !!f.task?.codeFragment || !!f.tasks?.some(a => a.codeFragment) || !!f.bossFragment;
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
  const [avatar, setAvatar] = useState<Avatar>(STANDARD_AVATAR);
  const [ersteWahl, setErsteWahl] = useState(false);
  useEffect(() => { setAvatar(ladeAvatar()); setErsteWahl(!gespeicherterAvatar()); }, []);
  const [offen, setOffen] = useState<number | null>(null);
  const [zurTuer, setZurTuer] = useState(false);
  const [auftrag, setAuftrag] = useState<{ ort: Ort; nr: number } | null>(null);
  const laufe = (ort: Ort) => setAuftrag(a => ({ ort, nr: (a?.nr ?? 0) + 1 }));

  const zustand = (idx: number): RaumZustand => {
    const s = slides[idx];
    if (s.type === "task" || s.type === "boss") return geloest.includes(s.id) ? "geloest" : "offen";
    return gelesen.has(s.id) ? "gelesen" : "info";
  };
  const zustaende = teile.map(t => t.raeume.map(zustand));

  const zeige = (idx: number) => {
    setOffen(idx);
    const s = slides[idx];
    if (s.type !== "task" && s.type !== "door" && s.type !== "boss") setGelesen(g => new Set(g).add(s.id));
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
    // Zurück geht immer — die Türen darunter sind ja schon offen.
    if (ort.art === "zurueck") { setOffen(null); setStock(s => Math.max(0, s - 1)); return; }
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
  const verlies = monster[stock];
  const schnipsel = abschnitt.tuer !== null ? fragments.filter(f => f.door_id === slides[abschnitt.tuer!].id) : [];

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* ab lg füllt das Spiel die ganze Höhe; darunter bleibt die Karte 70vh hoch */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)] gap-3 items-start lg:items-stretch lg:flex-1 lg:min-h-0">
        <div className="relative h-[70vh] min-h-[380px] lg:h-auto rounded-2xl border border-line overflow-hidden bg-linear-to-b from-sky-900/30 to-transparent">
          {freiPlan
            ? <FreiWelt plan={freiPlan} stock={stock} zustaende={zustaende} zielOffen={zielOffen} objekte={objekte}
                stile={freiStile} waechter={waechter} seed={seedAus(code)}
                avatar={avatar} aktiv={s === null} auftrag={auftrag} onAnkunft={ankunft} />
            : plan && <Gebaeude plan={plan} stock={stock} zustaende={zustaende} zielOffen={zielOffen} objekte={objekte}
                art={art as GebaeudeArt} stil={stil} stile={stile} waechter={waechter}
                avatar={avatar} aktiv={s === null} auftrag={auftrag} onAnkunft={ankunft} festeKamera />}
          <div className="absolute top-2 left-2 flex items-start gap-2">
            <div className="rounded-lg bg-surface/90 border border-line px-2 py-1 text-xs font-bold">
              {W.icon} {W.stock} {stock + 1} / {teile.length}
            </div>
            <AvatarWahl avatar={avatar} onWahl={setAvatar} startOffen={ersteWahl} />
          </div>

          {s && offen !== null && (
            <div className="absolute inset-0 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-6" data-zimmer={s.id}>
              {/* Boss: das Challenge-Spiel bekommt die ganze Spielfläche */}
              <section className={`card w-full max-h-full overflow-y-auto p-5 flex flex-col gap-3 shadow-2xl ${s.type === "boss" ? "h-full" : "max-w-xl"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    {s.type === "door" ? `${verlies ? "👹" : "🚪"} ${W.tuer}` : (() => {
                      // Das Objekt im Zimmer spricht: das Telefon klingelt, das Radio sendet …
                      const st = OBJEKT_STIMME[objekte[stock][teile[stock].raeume.indexOf(offen)]];
                      return st ? `${st.icon} ${s.type === "task" || s.type === "boss" ? st.aufgabe : st.info} …` : s.type === "boss" ? "⚔️ Boss" : s.type === "task" ? "✏️ Aufgabe" : "📖 Erklärung";
                    })()}
                  </span>
                  <button onClick={() => setOffen(null)} className="text-sm px-2 rounded-sm hover:bg-surface-hover" aria-label="Zimmer verlassen">✕</button>
                </div>
                <FolienText slide={s} />
                {s.media && <MediaView media={s.media} exitgameId={exitgameId} />}
                {s.sim && <SimKnopf sim={s.sim} frage={s.title} zurueck="✓ Zurück zur Folie" />}
                {s.type === "boss" && (
                  <BossArea slide={s} attemptId={attempt.id} onSlideSolved={onSlideSolved} onFertig={() => setOffen(null)} />
                )}
                {(s.type === "task" || s.type === "door") && (
                  <TaskArea key={s.id} slide={s} attemptId={attempt.id} solvedSlideIds={geloest}
                    variantChoices={variantChoices} level={levelOf(adaptation)} fragments={fragments} info={letzteInfo(slides, s.id)}
                    onSlideSolved={onSlideSolved} onAdaptation={a => { if (a) onAdaptation(a); }}
                    onReview={rueckblick} />
                )}
                <div className="flex gap-2 flex-wrap">
                  {s.type === "door" && zielOffen[stock] ? (
                    <button onClick={hoch} className="btn-primary text-sm py-1.5 px-4">
                      {letzter ? "🎉 Hinaus!" : W.hin}
                    </button>
                  ) : (
                    <button onClick={() => setOffen(null)} className="btn-primary text-sm py-1.5 px-4">
                      {(s.type === "task" || s.type === "boss") && !geloest.includes(s.id) ? "Später lösen" : frei ? "Weiter erkunden" : "Zurück in den Flur"}
                    </button>
                  )}
                  {zurTuer && s.type !== "door" && abschnitt.tuer !== null && (
                    <button onClick={() => { setOffen(null); setZurTuer(false); laufe({ art: "ziel" }); }}
                      className="text-sm text-accent hover:underline">🚪 Zurück zur Tür</button>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        <aside className="card flex flex-col gap-3 p-4 text-sm lg:overflow-y-auto">
          <h2 className="font-black">{data.title}</h2>
          <p className="text-xs text-muted">
            {frei
              ? "Laufe mit W/S oder den Pfeiltasten, drehe dich mit A/D oder durch Ziehen mit der Maus (Umschalt rennt, Mausrad zoomt). Ein Klick auf den Boden oder eine Station läuft hin, ebenso die Nummer (1–9, 0 = Tor). An den leuchtenden Ringen warten Erklärungen und Aufgaben"
              : "Klicke auf den Boden oder ein Zimmer, nutze die Pfeiltasten oder tippe die Zimmernummer (1–9, 0 = Treppe bzw. Tür). In den Zimmern warten Erklärungen und Aufgaben"}
            {verlies ? " — die Monster geben sich erst geschlagen, wenn du ihre Aufgabe löst" : ""}; jede gelöste Aufgabe gibt einen
            Codeschnipsel für {frei ? (verlies ? "den Boss am Tor" : "das Tor") : art === "ebene" ? "die nächste Tür" : verlies ? "den Boss an der Treppe" : "die Tür zum Treppenhaus"}.
          </p>
          <div className="flex flex-col gap-1">
            {abschnitt.raeume.map((idx, k) => {
              const z = zustand(idx);
              return (
                <button key={idx} onClick={() => laufe({ art: "raum", raum: k })} title={OBJEKT_NAME[objekte[stock][k]]}
                  className="text-left px-2 py-1.5 rounded-lg border border-line hover:border-accent flex gap-2 items-center">
                  <span className="w-6 text-center">{z === "geloest" ? "✅" : z === "offen" ? (objekte[stock][k] === "monster" || objekte[stock][k] === "boss" ? "👾" : "✏️") : z === "info" ? "📖" : "☑️"}</span>
                  <span className="truncate">{z === "info" || z === "gelesen" ? "" : `${k + 1}. `}{slides[idx].title ?? slides[idx].id}</span>
                </button>
              );
            })}
            <button onClick={() => laufe({ art: "ziel" })}
              className="text-left px-2 py-1.5 rounded-lg border border-line hover:border-accent flex gap-2 items-center font-bold">
              <span className="w-6 text-center">{zielOffen[stock] ? (letzter ? "🏁" : W.pfeil) : "🔒"}</span>
              {letzter ? "Ausgang" : W.weiter}
            </button>
            {stock > 0 && (
              <button onClick={() => laufe({ art: "zurueck" })}
                className="text-left px-2 py-1.5 rounded-lg border border-line hover:border-accent flex gap-2 items-center">
                {W.zurueck}
              </button>
            )}
          </div>
          {schnipsel.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted mb-1">🔑 Codeschnipsel für diese Tür</p>
              <div className="flex gap-1 flex-wrap">
                {schnipsel.map(f => (
                  <span key={`${f.slide_id}:${f.task_index}`}
                    className={`font-mono text-sm px-2 py-0.5 rounded-sm border ${f.earned ? "border-line" : "border-dashed border-accent text-accent"}`}>
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
