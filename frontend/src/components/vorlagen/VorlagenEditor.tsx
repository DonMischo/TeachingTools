"use client";
/**
 * Bearbeiten-Modus für alles, was als JSON-Vorlage hochgeladen wird.
 *
 * Standard ist ein Formular (`render`) — niemand muss JSON anfassen. Wer will,
 * findet das Roh-JSON unter »Expertenmodus«. Konvention je Feature: ein GET
 * liefert den Inhalt im Upload-Format (`load`), ein PUT nimmt ihn entgegen
 * (`save`) und prüft mit demselben Validator wie beim Hochladen.
 */
import { useState, type ReactNode } from "react";

/** Server-Fehler lesbar machen: FastAPI liefert detail als Text, als
 *  {message, errors[]} oder als Pydantic-Liste. */
export function formatApiError(e: unknown): string[] {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    const detail = JSON.parse(raw).detail;
    if (typeof detail === "string") return [detail];
    if (Array.isArray(detail)) return detail.map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).join(".")}: ${d.msg}`);
    if (detail?.message) return [detail.message, ...(Array.isArray(detail.errors) ? detail.errors.map(String) : [])];
  } catch {}
  return [raw];
}

const BTN = "text-xs px-3 py-1.5 border border-(--border) rounded-lg text-(--text-muted) hover:border-(--accent) hover:text-(--accent) transition-colors disabled:opacity-40";

export function VorlagenEditor<T, R>({
  load, save, onSaved, render, fileName = "inhalt.json", label = "✎ Bearbeiten", title = "Bearbeiten",
}: {
  load: () => Promise<T>;
  save: (data: T) => Promise<R>;
  onSaved?: (result: R) => void;
  /** Das Formular: bekommt den aktuellen Stand und meldet Änderungen zurück. */
  render: (value: T, onChange: (v: T) => void) => ReactNode;
  fileName?: string;
  label?: string;
  title?: string;
}) {
  const [value, setValue] = useState<T | null>(null);
  const [dirty, setDirty] = useState(false);
  const [json, setJson] = useState<string | null>(null); // gesetzt = Expertenmodus
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function open() {
    setBusy(true);
    setErrors([]);
    try {
      setValue(await load());
      setDirty(false);
      setJson(null);
    } catch (e) {
      setErrors(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function change(v: T) {
    setValue(v);
    setDirty(true);
  }

  /** Aus dem Expertenmodus zurück: JSON übernehmen, sonst Fehler zeigen. */
  function current(): T | null {
    if (json === null) return value;
    try {
      return JSON.parse(json) as T;
    } catch (e) {
      setErrors([`Kein gültiges JSON: ${(e as Error).message}`]);
      return null;
    }
  }

  function toggleExpert() {
    if (json === null) {
      setJson(JSON.stringify(value, null, 2));
      return;
    }
    const v = current();
    if (v === null) return;
    setValue(v);
    setJson(null);
    setErrors([]);
  }

  async function handleSave() {
    const v = current();
    if (v === null) return;
    setBusy(true);
    setErrors([]);
    try {
      const result = await save(v);
      setValue(null);
      onSaved?.(result);
    } catch (e) {
      setErrors(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if ((dirty || json !== null) && !confirm("Änderungen verwerfen?")) return;
    setValue(null);
    setErrors([]);
  }

  function download() {
    const v = current();
    if (v === null) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(v, null, 2)], { type: "application/json" }));
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (value === null) {
    return (
      <span className="inline-flex flex-col gap-1">
        <button onClick={open} disabled={busy} className={BTN}>{busy ? "Lädt…" : label}</button>
        {errors.map((m, i) => <span key={i} className="text-xs text-red-500">{m}</span>)}
      </span>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4 rounded-2xl border border-(--accent)/40 bg-(--surface) p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-semibold flex-1">{title}</h2>
        <button onClick={download} className={BTN} title="Als Vorlagen-Datei sichern">⬇ Herunterladen</button>
        <button onClick={toggleExpert} className={BTN} title="Für Fortgeschrittene: Inhalt als JSON">
          {json === null ? "{ } Expertenmodus" : "← Zurück zum Formular"}
        </button>
      </div>

      {json === null ? render(value, change) : (
        <textarea
          value={json}
          onChange={e => { setJson(e.target.value); setDirty(true); }}
          spellCheck={false}
          aria-label="JSON-Inhalt"
          className="input font-mono text-xs leading-relaxed h-[60vh] resize-y"
        />
      )}

      {/* Bleibt bei langen Formularen am unteren Rand sichtbar. */}
      <div className="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 bg-(--surface) border-t border-(--border) rounded-b-2xl flex flex-col gap-2">
        {errors.length > 0 && (
          <ul className="text-xs text-red-500 list-disc pl-5">
            {errors.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        )}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={busy} className="btn-primary text-sm">
            {busy ? "Speichere…" : "Speichern"}
          </button>
          <button onClick={cancel} className={BTN}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
