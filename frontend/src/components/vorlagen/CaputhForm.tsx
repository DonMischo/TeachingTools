"use client";
/** Formular für ein Caputh im Upload-Format (siehe GET /api/capuths/{id}/export). */
import type { TimelineGameSpec } from "@/components/timeline/types";
import { AntwortListe, BildFeld, Feld, Gruppe, Karte, ListenFeld, StufenFeld, ZahlFeld, ZeilenKnoepfe, move, type Antwort } from "./felder";
import { LEERES_ZEITSTRAHL_SPIEL, ZeitstrahlSpielForm } from "./ZeitstrahlSpielForm";
import { KarteFrageForm, LEERE_KARTE, type KarteVerweis } from "./KarteFrageForm";

export type CaputhFrage = {
  type: "single" | "multi" | "survey" | "true_false" | "sort" | "umrechnung" | "timeline" | "karte";
  question: string;
  image?: string | null;
  time_limit?: number | null;
  preview_time?: number | null;
  answers?: Antwort[];
  timeline?: TimelineGameSpec;
  karte?: KarteVerweis;
};

export type CaputhJson = {
  title: string;
  description?: string | null;
  type?: string;
  max_points?: number;
  time_limit_default?: number;
  preview_time_default?: number;
  settings?: { randomize_answer_order?: boolean };
  tags?: string[];
  grades?: number[];
  questions: CaputhFrage[];
};

const QUIZ_TYPEN: [string, string][] = [
  ["classic", "Klassisch"], ["tue", "Tägliche Übung"], ["test", "Test / Klassenarbeit üben"],
  ["assignment", "Aufgabenblatt"], ["competition", "Wettbewerb"], ["custom", "Sonstiges"],
];

export const FRAGE_TYPEN: [CaputhFrage["type"], string][] = [
  ["single", "Eine richtige Antwort"],
  ["multi", "Mehrere richtige Antworten"],
  ["true_false", "Wahr oder falsch"],
  ["sort", "Reihenfolge sortieren"],
  ["umrechnung", "Einheiten umrechnen"],
  ["timeline", "Zeitstrahl"],
  ["karte", "Karte (benennen/finden)"],
  ["survey", "Umfrage (ohne Wertung)"],
];

/** Typwechsel: Antworten so umbauen, dass der neue Typ gültig startet. */
export function frageAlsTyp(q: CaputhFrage, type: CaputhFrage["type"]): CaputhFrage {
  const alt = q.answers ?? [];
  const rest = { ...q };
  delete rest.timeline;
  delete rest.karte;
  delete rest.answers;
  const texte = alt.map(a => a.text).filter(Boolean);
  switch (type) {
    case "timeline":
      return { ...rest, type, timeline: q.timeline ?? structuredClone(LEERES_ZEITSTRAHL_SPIEL) };
    case "karte":
      return { ...rest, type, karte: q.karte ?? { ...LEERE_KARTE } };
    case "true_false":
      return { ...rest, type, answers: [{ text: "Wahr", correct: true }, { text: "Falsch", correct: false }] };
    case "umrechnung":
      return { ...rest, type, answers: [{ text: "", correct: true }] };
    case "survey":
    case "sort": {
      const t = texte.length ? texte : ["", ""];
      return { ...rest, type, answers: t.map(text => ({ text })) };
    }
    default: {
      const base = alt.length && !["umrechnung", "timeline", "karte"].includes(q.type) ? alt : [{ text: "" }, { text: "" }];
      let answers = base.map(a => ({ text: a.text, correct: !!a.correct }));
      if (type === "single") {
        const first = Math.max(0, answers.findIndex(a => a.correct));
        answers = answers.map((a, i) => ({ ...a, correct: i === first }));
      }
      return { ...rest, type, answers };
    }
  }
}

/** Umrechnung: »30000 cm« → Zahl und Einheit getrennt bearbeiten. */
function splitWert(text: string): [string, string] {
  const i = text.lastIndexOf(" ");
  return i < 0 ? [text, ""] : [text.slice(0, i), text.slice(i + 1)];
}

/** Bild hochladen; ohne (z. B. im Test) fällt das Bildfeld weg. */
type Upload = (file: File) => Promise<{ path: string }>;

function FrageForm({ q, i, onChange, upload }: { q: CaputhFrage; i: number; onChange: (q: CaputhFrage) => void; upload?: Upload }) {
  const answers = q.answers ?? [];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Feld label="Fragetyp">
          <select className="input" value={q.type} onChange={e => onChange(frageAlsTyp(q, e.target.value as CaputhFrage["type"]))}>
            {FRAGE_TYPEN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Feld>
        <Feld label="Zeit in Sekunden" hint="leer = Standard">
          <ZahlFeld className="input w-32" value={q.time_limit} onChange={v => onChange({ ...q, time_limit: v })} />
        </Feld>
      </div>

      <Feld label={q.type === "umrechnung" ? "Ausgangswert" : "Frage"}
        hint={q.type === "umrechnung" ? "z. B. »300 m« — angezeigt wird »Rechne um: 300 m = … Einheit«." : "Formeln mit $…$, z. B. $x^2$"}>
        {q.type === "umrechnung"
          ? <input className="input" value={q.question} onChange={e => onChange({ ...q, question: e.target.value })} />
          : <textarea className="input" rows={2} value={q.question} onChange={e => onChange({ ...q, question: e.target.value })} />}
      </Feld>

      {upload && (
        <BildFeld label="Bild zur Frage (optional)" value={q.image} upload={upload}
          urlFor={p => `/uploads/quizzes/${p}`} onChange={image => onChange({ ...q, image })} />
      )}

      {q.type === "umrechnung" && (() => {
        const [zahl, einheit] = splitWert(answers[0]?.text ?? "");
        const set = (z: string, e: string) => onChange({ ...q, answers: [{ text: e ? `${z} ${e}` : z, correct: true }] });
        return (
          <div className="flex gap-3 flex-wrap">
            <Feld label="Richtiges Ergebnis (Zahl)"><input className="input w-40" value={zahl} onChange={e => set(e.target.value, einheit)} /></Feld>
            <Feld label="Zieleinheit"><input className="input w-28" value={einheit} placeholder="cm" onChange={e => set(zahl, e.target.value)} /></Feld>
          </div>
        );
      })()}

      {q.type === "karte" && (
        <KarteFrageForm karte={q.karte ?? LEERE_KARTE} onChange={karte => onChange({ ...q, karte })} />
      )}

      {q.type === "timeline" && (
        <ZeitstrahlSpielForm spec={q.timeline ?? LEERES_ZEITSTRAHL_SPIEL} onChange={timeline => onChange({ ...q, timeline })} />
      )}

      {q.type === "true_false" && (
        <Gruppe label="Richtig ist">
          <div className="flex gap-4">
            {answers.map((a, j) => (
              <label key={j} className="flex items-center gap-2">
                <input type="radio" name={`tf-${i}`} checked={!!a.correct} className="accent-green-600"
                  onChange={() => onChange({ ...q, answers: answers.map((x, k) => ({ ...x, correct: k === j })) })} />
                {a.text}
              </label>
            ))}
          </div>
        </Gruppe>
      )}

      {(q.type === "single" || q.type === "multi" || q.type === "survey" || q.type === "sort") && (
        <Gruppe label="Antworten">
          <AntwortListe name={`frage-${i}`} answers={answers} onChange={a => onChange({ ...q, answers: a })}
            mode={q.type === "survey" ? "none" : q.type === "sort" ? "order" : q.type} />
        </Gruppe>
      )}
    </>
  );
}

export function CaputhForm({ value, onChange, upload }: { value: CaputhJson; onChange: (v: CaputhJson) => void; upload?: Upload }) {
  const set = (patch: Partial<CaputhJson>) => onChange({ ...value, ...patch });
  const questions = value.questions;
  const setQ = (qs: CaputhFrage[]) => set({ questions: qs });
  const typLabel = Object.fromEntries(FRAGE_TYPEN);

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <Feld label="Titel *" className="sm:col-span-2">
          <input className="input" value={value.title} onChange={e => set({ title: e.target.value })} />
        </Feld>
        <Feld label="Beschreibung" className="sm:col-span-2">
          <input className="input" value={value.description ?? ""} onChange={e => set({ description: e.target.value || null })} />
        </Feld>
        <Feld label="Art">
          <select className="input" value={value.type ?? "classic"} onChange={e => set({ type: e.target.value })}>
            {QUIZ_TYPEN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Feld>
        <Feld label="Klassenstufen"><StufenFeld value={value.grades ?? []} onChange={grades => set({ grades })} /></Feld>
        <Feld label="Schlagwörter" hint="durch Kommas getrennt">
          <ListenFeld value={value.tags ?? []} onChange={tags => set({ tags })} placeholder="z. B. mathe, brüche" />
        </Feld>
        <Feld label="Punkte für die Klasse (bei 100 %)" hint="höchstens 2 je gewertete Frage">
          <ZahlFeld value={value.max_points} onChange={v => set({ max_points: v ?? 0 })} />
        </Feld>
        <Feld label="Antwortzeit je Frage (Sekunden)">
          <ZahlFeld value={value.time_limit_default} onChange={v => set({ time_limit_default: v ?? 20 })} />
        </Feld>
        <Feld label="Vorschauzeit vor den Antworten (Sekunden)">
          <ZahlFeld value={value.preview_time_default} onChange={v => set({ preview_time_default: v ?? 3 })} />
        </Feld>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={!!value.settings?.randomize_answer_order}
            onChange={e => set({ settings: { ...value.settings, randomize_answer_order: e.target.checked } })} />
          Antworten in zufälliger Reihenfolge zeigen
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold text-sm">Fragen ({questions.length})</h3>
        {questions.map((q, i) => (
          <Karte key={i} offen={questions.length <= 3 || !q.question}
            titel={<>{i + 1}. <span className="text-muted text-xs">{typLabel[q.type]}</span> · {q.question || <em className="text-muted">ohne Text</em>}</>}
            knoepfe={<ZeilenKnoepfe index={i} count={questions.length} what="Frage"
              onMove={d => setQ(move(questions, i, d))}
              onRemove={() => confirm(`Frage ${i + 1} löschen?`) && setQ(questions.filter((_, j) => j !== i))} />}>
            <FrageForm q={q} i={i} upload={upload} onChange={nq => setQ(questions.map((x, j) => j === i ? nq : x))} />
          </Karte>
        ))}
        <button type="button" className="btn-primary text-sm self-start"
          onClick={() => setQ([...questions, frageAlsTyp({ type: "single", question: "" }, "single")])}>
          + Frage hinzufügen
        </button>
      </section>
    </div>
  );
}
