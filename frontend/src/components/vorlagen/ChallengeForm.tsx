"use client";
/** Formular für einen Challenge-Satz im Upload-Format (api/challenge_engine.py). */
import type { AssetOut } from "@/lib/api";
import { BildFeld, Feld, Gruppe, Karte, ZeilenKnoepfe, eindeutigeId, move } from "./felder";

type Etappe = { id: number; title: string };
type Fakt = {
  id: string; text: string; image?: string | null; formula?: string | null; decoy?: boolean;
  info?: { text?: string; source?: { label?: string; url?: string } };
};
type Loesung = { all?: string[]; any?: string[] };
type Aufgabe = {
  id: string; text: string; solve: Loesung; strength?: number; stage?: number; feedback?: string; tip?: string;
};
// levels und unbekannte Felder laufen beim Bearbeiten unverändert durch
export type ChallengeJson = {
  title: string; subject?: string | null; grade?: number | null; stages?: Etappe[]; facts: Fakt[]; challenges: Aufgabe[];
  levels?: unknown; [weitere: string]: unknown;
};

const modus = (c: Aufgabe): "all" | "any" => (c.solve.all ? "all" : "any");
const loesungsIds = (c: Aufgabe) => c.solve.all ?? c.solve.any ?? [];

export function ChallengeForm({ value, onChange, upload, satzId, urlFor }: {
  value: ChallengeJson; onChange: (v: ChallengeJson) => void; upload: (file: File) => Promise<AssetOut>; satzId: number;
  /** Vorschau-Adresse eines Bildes, wenn die Bilder nicht beim Satz liegen (Boss-Folie im TaskCrawler). */
  urlFor?: (p: string) => string;
}) {
  const etappen = value.stages ?? [];
  const fakten = value.facts ?? [];
  const aufgaben = value.challenges ?? [];
  const bildUrl = urlFor ?? ((p: string) => `/uploads/challenges/${satzId}/assets/${p}`);
  const setzeListe = (key: "stages" | "facts" | "challenges", liste: unknown[]) => onChange({ ...value, [key]: liste });
  const setFakt = (i: number, f: Fakt) => setzeListe("facts", fakten.map((x, j) => (j === i ? f : x)));
  const setAufgabe = (i: number, c: Aufgabe) => setzeListe("challenges", aufgaben.map((x, j) => (j === i ? c : x)));
  const loesungsChips = fakten.filter(f => !f.decoy);

  function umschalten(i: number, c: Aufgabe, faktId: string) {
    const ids = loesungsIds(c);
    const neu = ids.includes(faktId) ? ids.filter(x => x !== faktId) : [...ids, faktId];
    setAufgabe(i, { ...c, solve: { [modus(c)]: neu } });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Feld label="Titel"><input className="input" value={value.title ?? ""} onChange={e => onChange({ ...value, title: e.target.value })} /></Feld>
        <Feld label="Fach"><input className="input" value={value.subject ?? ""} onChange={e => onChange({ ...value, subject: e.target.value || null })} /></Feld>
        <Feld label="Klassenstufe">
          <input type="number" className="input" value={value.grade ?? ""} onChange={e => onChange({ ...value, grade: e.target.value === "" ? null : Number(e.target.value) })} />
        </Feld>
      </div>
      <p className="text-xs text-muted">Anpassungen je Stufe (levels) gibt es im Expertenmodus.</p>

      <Gruppe label="Etappen" hint="Eine Etappe ist ein Abschnitt der Karte; jede Challenge gehört zu einer.">
        {etappen.map((e, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input type="number" className="input w-20" aria-label={`Etappe ${i + 1} Nummer`} value={e.id}
              onChange={ev => setzeListe("stages", etappen.map((x, j) => (j === i ? { ...x, id: Number(ev.target.value) } : x)))} />
            <input className="input flex-1" aria-label={`Etappe ${i + 1} Titel`} value={e.title}
              onChange={ev => setzeListe("stages", etappen.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))} />
            <ZeilenKnoepfe index={i} count={etappen.length} what="Etappe"
              onMove={d => setzeListe("stages", move(etappen, i, d))} onRemove={() => setzeListe("stages", etappen.filter((_, j) => j !== i))} />
          </div>
        ))}
        <button type="button" className="text-xs text-accent hover:underline self-start"
          onClick={() => setzeListe("stages", [...etappen, { id: Math.max(0, ...etappen.map(e => e.id)) + 1, title: "" }])}>
          + Etappe
        </button>
      </Gruppe>

      <Gruppe label="Fakten" hint="Karten, die die Spieler auf Challenges legen. »Ablenker« sehen aus wie Fakten, passen aber zu nichts.">
        {fakten.map((f, i) => (
          <Karte key={i} titel={`${f.id}: ${f.text || "(leer)"}${f.decoy ? " · Ablenker" : ""}`}
            knoepfe={<ZeilenKnoepfe index={i} count={fakten.length} what="Fakt"
              onMove={d => setzeListe("facts", move(fakten, i, d))} onRemove={() => setzeListe("facts", fakten.filter((_, j) => j !== i))} />}>
            <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-3">
              <Feld label="Kennung"><input className="input" value={f.id} onChange={e => setFakt(i, { ...f, id: e.target.value })} /></Feld>
              <Feld label="Text"><input className="input" value={f.text} onChange={e => setFakt(i, { ...f, text: e.target.value })} /></Feld>
            </div>
            <Feld label="Formel (LaTeX, optional)">
              <input className="input font-mono" value={f.formula ?? ""} onChange={e => setFakt(i, { ...f, formula: e.target.value || undefined })} />
            </Feld>
            <BildFeld value={f.image} upload={upload} urlFor={bildUrl} label={`Bild zu ${f.id}`} onChange={p => setFakt(i, { ...f, image: p ?? undefined })} />
            <Feld label="Nachlesen: Text" hint="Erscheint im Bereich »Wissen nachlesen«.">
              <textarea className="input" rows={2} value={f.info?.text ?? ""} onChange={e => setFakt(i, { ...f, info: { ...f.info, text: e.target.value } })} />
            </Feld>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Feld label="Quelle: Bezeichnung">
                <input className="input" value={f.info?.source?.label ?? ""}
                  onChange={e => setFakt(i, { ...f, info: { ...f.info, source: { ...f.info?.source, label: e.target.value } } })} />
              </Feld>
              <Feld label="Quelle: Adresse">
                <input className="input" value={f.info?.source?.url ?? ""}
                  onChange={e => setFakt(i, { ...f, info: { ...f.info, source: { ...f.info?.source, url: e.target.value } } })} />
              </Feld>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!f.decoy} onChange={e => setFakt(i, { ...f, decoy: e.target.checked || undefined })} /> Ablenker
            </label>
          </Karte>
        ))}
        <button type="button" className="text-xs text-accent hover:underline self-start"
          onClick={() => setzeListe("facts", [...fakten, { id: eindeutigeId("fakt", fakten.map(f => f.id)), text: "" }])}>
          + Fakt
        </button>
      </Gruppe>

      <Gruppe label="Challenges">
        {aufgaben.map((c, i) => (
          <Karte key={i} titel={`${c.id}: ${c.text || "(leer)"}`}
            knoepfe={<ZeilenKnoepfe index={i} count={aufgaben.length} what="Challenge"
              onMove={d => setzeListe("challenges", move(aufgaben, i, d))} onRemove={() => setzeListe("challenges", aufgaben.filter((_, j) => j !== i))} />}>
            <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-3">
              <Feld label="Kennung"><input className="input" value={c.id} onChange={e => setAufgabe(i, { ...c, id: e.target.value })} /></Feld>
              <Feld label="Text"><textarea className="input" rows={2} value={c.text} onChange={e => setAufgabe(i, { ...c, text: e.target.value })} /></Feld>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Feld label="Etappe">
                <select className="input" value={c.stage ?? 1} onChange={e => setAufgabe(i, { ...c, stage: Number(e.target.value) })}>
                  {(etappen.length ? etappen : [{ id: 1, title: "" }]).map(e => <option key={e.id} value={e.id}>{e.id}{e.title ? `: ${e.title}` : ""}</option>)}
                </select>
              </Feld>
              <Feld label="Stärke">
                <select className="input" value={c.strength ?? 1} onChange={e => setAufgabe(i, { ...c, strength: Number(e.target.value) })}>
                  {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Feld>
              <Feld label="Lösung">
                <select className="input" value={modus(c)} onChange={e => setAufgabe(i, { ...c, solve: { [e.target.value]: loesungsIds(c) } })}>
                  <option value="all">alle nötig (Kombo)</option>
                  <option value="any">eine genügt</option>
                </select>
              </Feld>
            </div>
            <Gruppe label="Lösungsfakten" hint="Anklicken, welche Fakten zur Lösung gehören.">
              <div className="flex flex-wrap gap-1.5">
                {loesungsChips.map(f => {
                  const an = loesungsIds(c).includes(f.id);
                  return (
                    <button key={f.id} type="button" aria-pressed={an} onClick={() => umschalten(i, c, f.id)}
                      className={`chip ${an ? "chip-on" : ""}`}>
                      {f.text || f.id}
                    </button>
                  );
                })}
              </div>
            </Gruppe>
            <Feld label="Rückmeldung bei Treffer"><input className="input" value={c.feedback ?? ""} onChange={e => setAufgabe(i, { ...c, feedback: e.target.value || undefined })} /></Feld>
            <Feld label="Tipp"><input className="input" value={c.tip ?? ""} onChange={e => setAufgabe(i, { ...c, tip: e.target.value || undefined })} /></Feld>
          </Karte>
        ))}
        <button type="button" className="text-xs text-accent hover:underline self-start"
          onClick={() => setzeListe("challenges", [...aufgaben, { id: eindeutigeId("challenge", aufgaben.map(c => c.id)), text: "", solve: { any: [] }, stage: etappen[0]?.id ?? 1 }])}>
          + Challenge
        </button>
      </Gruppe>
    </div>
  );
}
