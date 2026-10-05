"use client";
/** Bausteine für die Formular-Editoren der Vorlagen. */
import { useEffect, useState, type ReactNode } from "react";

export const KLEIN_BTN = "text-xs px-2 py-1 rounded-lg border border-line text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-30";

/** Beschriftetes Eingabefeld (ein Element). */
export function Feld({ label, hint, children, className = "" }: {
  label: string; hint?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm min-w-0 ${className}`}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Beschriftete Gruppe mehrerer Elemente (kein <label>, sonst springt der Klick). */
export function Gruppe({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="text-xs font-medium text-muted">{label}</span>
      {hint && <span className="text-xs text-muted -mt-1">{hint}</span>}
      {children}
    </div>
  );
}

export function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** ↑ ↓ 🗑 für eine Zeile in einer Liste. */
export function ZeilenKnoepfe({ index, count, onMove, onRemove, what = "Eintrag" }: {
  index: number; count: number; onMove: (dir: -1 | 1) => void; onRemove: () => void; what?: string;
}) {
  return (
    <span className="inline-flex gap-1 shrink-0">
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={KLEIN_BTN} aria-label={`${what} nach oben`}>↑</button>
      <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} className={KLEIN_BTN} aria-label={`${what} nach unten`}>↓</button>
      <button type="button" onClick={onRemove} className={`${KLEIN_BTN} hover:border-red-400! hover:text-red-400!`} aria-label={`${what} löschen`}>🗑</button>
    </span>
  );
}

/** Zahl oder leer (null). */
export function ZahlFeld({ value, onChange, placeholder, className = "input", step }: {
  value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string; className?: string; step?: number | "any";
}) {
  return (
    <input type="number" className={className} value={value ?? ""} placeholder={placeholder} step={step ?? "any"}
      onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))} />
  );
}

/** Kommagetrennte Liste; übernimmt beim Verlassen, damit Kommas tippbar bleiben. */
export function ListenFeld({ value, onChange, placeholder, trenner = /[,;]/ }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; trenner?: RegExp;
}) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => { setText(value.join(", ")); }, [value]);
  return (
    <input className="input" value={text} placeholder={placeholder}
      onChange={e => setText(e.target.value)}
      onBlur={() => onChange(text.split(trenner).map(s => s.trim()).filter(Boolean))} />
  );
}

/** Klassenstufen als Text: »5, 6« oder »5-7«. */
export function parseStufen(text: string): number[] {
  const out = new Set<number>();
  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) for (let g = Number(m[1]); g <= Number(m[2]); g++) out.add(g);
    else if (/^\d+$/.test(part)) out.add(Number(part));
  }
  return [...out].sort((a, b) => a - b);
}

export function StufenFeld({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => { setText(value.join(", ")); }, [value]);
  return (
    <input className="input" value={text} placeholder="z. B. 7, 8 oder 5-10 (leer = alle)"
      onChange={e => setText(e.target.value)} onBlur={() => onChange(parseStufen(text))} />
  );
}

/** Liste einzelner Texte (Hinweise, akzeptierte Antworten …). */
export function TextListe({ values, onChange, placeholder, addLabel = "+ hinzufügen", what = "Eintrag", multiline = false }: {
  values: string[]; onChange: (v: string[]) => void; placeholder?: string; addLabel?: string; what?: string; multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {values.map((v, i) => (
        <div key={i} className="flex gap-2 items-start">
          {multiline ? (
            <textarea className="input flex-1 text-sm" rows={2} value={v} placeholder={placeholder} aria-label={`${what} ${i + 1}`}
              onChange={e => onChange(values.map((x, j) => j === i ? e.target.value : x))} />
          ) : (
            <input className="input flex-1 text-sm" value={v} placeholder={placeholder} aria-label={`${what} ${i + 1}`}
              onChange={e => onChange(values.map((x, j) => j === i ? e.target.value : x))} />
          )}
          <ZeilenKnoepfe index={i} count={values.length} what={what}
            onMove={d => onChange(move(values, i, d))} onRemove={() => onChange(values.filter((_, j) => j !== i))} />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...values, ""])} className="text-xs text-accent hover:underline self-start">
        {addLabel}
      </button>
    </div>
  );
}

export type Antwort = { text: string; correct?: boolean };

/**
 * Antwortmöglichkeiten.
 * - single: genau eine richtig (Radio)
 * - multi: beliebig viele richtig (Kästchen)
 * - none: ohne Wertung (Umfrage)
 * - order: die Reihenfolge ist die Lösung
 */
export function AntwortListe({ answers, onChange, mode, name }: {
  answers: Antwort[]; onChange: (a: Antwort[]) => void; mode: "single" | "multi" | "none" | "order"; name: string;
}) {
  function setCorrect(i: number, on: boolean) {
    onChange(answers.map((a, j) => mode === "single" ? { ...a, correct: j === i } : j === i ? { ...a, correct: on } : a));
  }
  return (
    <div className="flex flex-col gap-1.5">
      {mode === "order" && <p className="text-xs text-muted">In der richtigen Reihenfolge eintragen — gemischt wird beim Spielen.</p>}
      {mode !== "order" && mode !== "none" && (
        <p className="text-xs text-muted">{mode === "single" ? "Die richtige Antwort anklicken." : "Alle richtigen Antworten ankreuzen."}</p>
      )}
      {answers.map((a, i) => (
        <div key={i} className="flex gap-2 items-center">
          {mode === "order" && <span className="text-xs text-muted w-5 text-right">{i + 1}.</span>}
          {(mode === "single" || mode === "multi") && (
            <input type={mode === "single" ? "radio" : "checkbox"} name={name} checked={!!a.correct}
              onChange={e => setCorrect(i, e.target.checked)} aria-label={`Antwort ${i + 1} ist richtig`}
              className="w-4 h-4 accent-green-600 shrink-0" />
          )}
          <input className={`input flex-1 text-sm ${a.correct && mode !== "none" && mode !== "order" ? "border-green-500" : ""}`}
            value={a.text} placeholder={`Antwort ${i + 1}`} aria-label={`Antwort ${i + 1}`}
            onChange={e => onChange(answers.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
          <ZeilenKnoepfe index={i} count={answers.length} what="Antwort"
            onMove={d => onChange(move(answers, i, d))} onRemove={() => onChange(answers.filter((_, j) => j !== i))} />
        </div>
      ))}
      <button type="button" className="text-xs text-accent hover:underline self-start"
        onClick={() => onChange([...answers, mode === "none" || mode === "order" ? { text: "" } : { text: "", correct: false }])}>
        + Antwort
      </button>
    </div>
  );
}

/** Aufklappbare Karte für Fragen, Folien, Texte. */
export function Karte({ titel, knoepfe, children, offen = false }: {
  titel: ReactNode; knoepfe?: ReactNode; children: ReactNode; offen?: boolean;
}) {
  return (
    <details open={offen} className="rounded-xl border border-line bg-page group">
      <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none">
        <span className="text-muted text-xs transition-transform group-open:rotate-90">▶</span>
        <span className="flex-1 min-w-0 truncate text-sm font-medium">{titel}</span>
        {knoepfe && <span onClick={e => e.preventDefault()}>{knoepfe}</span>}
      </summary>
      <div className="px-3 pb-3 pt-1 flex flex-col gap-3">{children}</div>
    </details>
  );
}

/** Eindeutige Kennung aus einem Titel, z. B. für Folien-IDs. */
export function eindeutigeId(basis: string, vergeben: string[], fallback = "teil"): string {
  const slug = basis.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || fallback;
  let id = slug;
  for (let n = 2; vergeben.includes(id); n++) id = `${slug}-${n}`;
  return id;
}

/**
 * Bild: Vorschau, hochladen, entfernen. `upload` legt die Datei im Ordner des
 * Inhalts ab (z. B. data/quizzes/{id}/gfx) und liefert den Pfad fürs JSON.
 */
export function BildFeld({ value, onChange, upload, urlFor, label = "Bild" }: {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  upload: (file: File) => Promise<{ path: string }>;
  urlFor: (path: string) => string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function waehlen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setFehler(null);
    try {
      onChange((await upload(file)).path);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      try { setFehler(JSON.parse(raw).detail ?? raw); } catch { setFehler(raw); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Gruppe label={label}>
      <div className="flex items-center gap-3 flex-wrap">
        {value && <img src={urlFor(value)} alt="" className="h-20 max-w-40 rounded-lg object-contain border border-line bg-surface" />}
        <label className={`${KLEIN_BTN} cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
          {busy ? "Lädt hoch…" : value ? "📷 Anderes Bild" : "📷 Bild hochladen"}
          <input type="file" accept="image/*" className="hidden" onChange={waehlen} aria-label={`${label} hochladen`} />
        </label>
        {value && (
          <button type="button" onClick={() => onChange(null)} className={`${KLEIN_BTN} hover:border-red-400! hover:text-red-400!`}>
            🗑 Bild entfernen
          </button>
        )}
      </div>
      {fehler && <span className="text-xs text-red-500">{fehler}</span>}
    </Gruppe>
  );
}
