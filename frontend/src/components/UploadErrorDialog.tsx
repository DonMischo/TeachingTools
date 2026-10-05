"use client";

// Shared "der Upload hat nicht geklappt" dialog for every content upload
// (Caputh, TaskCrawler, Lückentext, Zeitstrahl, Umfrage). A validation failure
// can list a dozen findings — far too much for a toast — so they get a real
// dialog with a copy button: the teacher pastes the list back to the AI that
// wrote the file and gets a corrected version.

import { useEffect, useState } from "react";
import { UploadError } from "@/lib/uploadError";

export function UploadErrorDialog({
  error, onClose, title = "Upload fehlgeschlagen",
}: {
  error: UploadError | null;
  onClose: () => void;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!error) return;
    setCopied(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [error, onClose]);

  if (!error) return null;

  const asText = [error.message, ...error.errors].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-line p-5 shadow-2xl flex flex-col gap-3"
        style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-red-400">⚠️ {title}</h3>

        <p className="text-sm whitespace-pre-line">{error.message}</p>

        {error.errors.length > 0 && (
          <>
            <p className="text-xs text-muted">
              {error.errors.length === 1 ? "1 Fehler in der Datei:" : `${error.errors.length} Fehler in der Datei:`}
            </p>
            <ol className="max-h-72 overflow-y-auto rounded-lg border border-line divide-y divide-line text-xs">
              {error.errors.map((e, i) => (
                <li key={i} className="px-3 py-2 font-mono wrap-break-word whitespace-pre-wrap">{e}</li>
              ))}
            </ol>
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={copy} className="text-sm px-3 py-1.5 rounded-lg border border-line hover:border-accent">
            {copied ? "✓ Kopiert" : "Fehler kopieren"}
          </button>
          <button onClick={onClose} className="btn-primary text-sm py-1.5 px-4">Schließen</button>
        </div>
      </div>
    </div>
  );
}
