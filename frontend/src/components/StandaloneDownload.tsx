"use client";
/**
 * Knopf für eine Offline-Datei: ein Werkzeug-Bündel als einzelne HTML zum
 * Mitgeben. Welche Bündel es gibt, sagt das Backend (api/routers/standalone.py)
 * — hier steht nur der Name, deshalb taugt der Knopf für jedes weitere Bündel:
 * `<StandaloneDownload name="…" />`.
 *
 * Ist die Datei noch nicht gebaut, zeigt sich der Knopf gar nicht erst.
 */
import { useEffect, useState } from "react";
import { api, type StandaloneBundle } from "@/lib/api";

const mb = (bytes: number) => (bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 });

export function StandaloneDownload({ name, className = "" }: { name: string; className?: string }) {
  const [bundle, setBundle] = useState<StandaloneBundle | null>(null);

  useEffect(() => {
    let alive = true;
    api.standalone
      .list()
      .then(list => { if (alive) setBundle(list.find(b => b.name === name) ?? null); })
      .catch(() => { if (alive) setBundle(null); });
    return () => { alive = false; };
  }, [name]);

  if (!bundle?.available) return null;

  const built = bundle.built_at ? new Date(bundle.built_at).toLocaleDateString("de-DE") : null;

  return (
    <div className={`rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-wrap items-center gap-3 ${className}`}>
      <div className="flex-1 min-w-[220px]">
        <div className="font-bold text-sm">💾 {bundle.label} zum Mitnehmen</div>
        <p className="text-xs text-(--text-muted) mt-0.5 leading-relaxed">{bundle.note}</p>
      </div>
      <a
        href={api.standalone.downloadUrl(bundle.name)}
        download
        title={built ? `Stand vom ${built}` : undefined}
        className="px-4 py-2 rounded-lg text-sm font-bold bg-(--accent) text-(--accent-text,#111) hover:opacity-90"
      >
        ⬇️ Herunterladen{bundle.size_bytes ? ` (${mb(bundle.size_bytes)} MB)` : ""}
      </a>
    </div>
  );
}
