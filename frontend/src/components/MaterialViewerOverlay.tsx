"use client";

import { useLessonSession } from "@/contexts/LessonSessionContext";

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

export function MaterialViewerOverlay() {
  const { viewingMaterial, setViewingMaterial } = useLessonSession();
  if (!viewingMaterial) return null;

  const m = viewingMaterial;
  const isImage = m.content_type.startsWith("image/") || IMAGE_EXT.some(ext => m.url.toLowerCase().endsWith(ext));
  const pdfSrc = m.pdf_url ?? (m.content_type === "application/pdf" || m.url.toLowerCase().endsWith(".pdf") ? m.url : null);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
      onClick={() => setViewingMaterial(null)}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] shrink-0">
          <span className="font-semibold text-sm flex-1 truncate">{m.original_filename}</span>
          <a href={m.url} download={m.original_filename} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
            ⬇ Herunterladen
          </a>
          <button onClick={() => setViewingMaterial(null)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none px-1">×</button>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg)]">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.url} alt={m.original_filename} className="max-w-full max-h-full object-contain" />
          ) : pdfSrc ? (
            <iframe src={pdfSrc} title={m.original_filename} className="w-full h-full border-0" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-[var(--text-muted)] text-sm">
              <span>Keine Vorschau verfügbar für diesen Dateityp.</span>
              <a href={m.url} download={m.original_filename} className="btn-primary text-sm py-1.5 px-4">
                ⬇ Datei herunterladen
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
