"use client";
/**
 * Bearbeiten-Modus für alles, was als JSON-Vorlage hochgeladen wird.
 *
 * Lädt den Inhalt im Upload-Format (`load`), zeigt ihn zum Bearbeiten an und
 * schickt ihn über `save` zurück — der Server prüft mit demselben Validator
 * wie beim Hochladen. Konvention je Feature: GET liefert das Upload-JSON,
 * PUT nimmt es entgegen.
 */
import { useState } from "react";

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

export function JsonEditPanel<R>({
  load, save, onSaved, fileName = "inhalt.json", label = "✎ Bearbeiten",
}: {
  load: () => Promise<unknown>;
  save: (data: unknown) => Promise<R>;
  onSaved?: (result: R) => void;
  fileName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function openEditor() {
    setBusy(true);
    setErrors([]);
    try {
      setText(JSON.stringify(await load(), null, 2));
      setOpen(true);
    } catch (e) {
      setErrors(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (e) {
      setErrors([`Kein gültiges JSON: ${(e as Error).message}`]);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const result = await save(data);
      setOpen(false);
      onSaved?.(result);
    } catch (e) {
      setErrors(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) file.text().then(setText);
  }

  const btn = "text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40";

  if (!open) {
    return (
      <span className="inline-flex flex-col gap-1">
        <button onClick={openEditor} disabled={busy} className={btn}>{busy ? "Lädt…" : label}</button>
        {errors.map((m, i) => <span key={i} className="text-xs text-red-500">{m}</span>)}
      </span>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-semibold text-sm flex-1">Bearbeiten (JSON wie in der Vorlage)</h2>
        <button onClick={download} className={btn}>⬇ Herunterladen</button>
        <label className={`${btn} cursor-pointer`}>
          ⬆ Datei einsetzen
          <input type="file" accept=".json,application/json" className="hidden" onChange={loadFile} />
        </label>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        spellCheck={false}
        aria-label="JSON-Inhalt"
        className="input font-mono text-xs leading-relaxed h-[60vh] resize-y"
      />
      {errors.length > 0 && (
        <ul className="text-xs text-red-500 list-disc pl-5">
          {errors.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={busy} className="btn-primary text-sm">
          {busy ? "Speichere…" : "Speichern"}
        </button>
        <button onClick={() => { setOpen(false); setErrors([]); }} className={btn}>Abbrechen</button>
      </div>
    </div>
  );
}
