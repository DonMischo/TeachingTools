"use client";
/**
 * Angehängte Dateien gut sichtbar: je Datei eine Zeile mit Symbol nach Dateityp,
 * Name, Endung und Öffnen/Herunterladen. Dazu die Liste der im Dialog gewählten,
 * noch nicht hochgeladenen Dateien.
 */
import type { ResearchMediaOut } from "@/lib/api";

const ARTEN: [RegExp, string, string][] = [
  [/\.pdf$/i, "📕", "PDF"],
  [/\.(docx?|odt|ott|rtf)$/i, "📘", "Text"],
  [/\.(xlsx?|ods|csv)$/i, "📗", "Tabelle"],
  [/\.(pptx?|odp)$/i, "📙", "Folien"],
  [/\.(md|txt|tex)$/i, "📄", "Text"],
  [/\.(png|jpe?g|gif|webp|avif|svg)$/i, "🖼️", "Bild"],
];

export function dateiArt(name: string): { icon: string; art: string; endung: string } {
  const endung = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toUpperCase();
  const t = ARTEN.find(([re]) => re.test(name));
  return { icon: t?.[1] ?? "📎", art: t?.[2] ?? "Datei", endung };
}

const groesse = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/** Hochgeladene PDFs und Dokumente eines Clippings. */
export function Anhaenge({ media, onPdf, onLoeschen }: {
  media: ResearchMediaOut[];
  onPdf: (pfad: string) => void;
  /** fehlt → nur ansehen */
  onLoeschen?: (id: number) => void;
}) {
  const liste = media.filter(m => m.kind === "pdf" || m.kind === "file");
  if (!liste.length) return null;
  return (
    <ul className="flex flex-col gap-1" aria-label="Anhänge">
      {liste.map(m => {
        const name = m.name ?? (m.kind === "pdf" ? "Dokument.pdf" : m.path.split("/").pop() ?? "Datei");
        const { icon, endung } = dateiArt(m.kind === "pdf" && !/\.pdf$/i.test(name) ? `${name}.pdf` : name);
        return (
          <li key={m.id} className="group/datei flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5">
            <span className="text-lg leading-none" aria-hidden>{icon}</span>
            {m.kind === "pdf"
              ? <button onClick={() => onPdf(m.path)} className="flex-1 min-w-0 text-left text-xs font-medium truncate hover:text-accent" title="Ansehen">{name}</button>
              : <a href={m.path} download={m.name ?? undefined} className="flex-1 min-w-0 text-xs font-medium truncate hover:text-accent" title="Herunterladen">{name}</a>}
            {endung && <span className="text-[9px] font-mono font-bold px-1 rounded bg-page border border-line text-muted">{endung}</span>}
            <a href={m.path} download={m.name ?? undefined} className="text-muted hover:text-accent text-sm" title="Herunterladen" aria-label={`${name} herunterladen`}>⬇</a>
            {onLoeschen && (
              <button onClick={() => onLoeschen(m.id)} className="text-muted hover:text-red-500 text-sm" title="Entfernen" aria-label={`${name} entfernen`}>×</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Im Dialog gewählte Dateien, bevor sie hochgeladen werden. */
export function GewaehlteDateien({ dateien, onEntfernen }: { dateien: File[]; onEntfernen: (i: number) => void }) {
  if (!dateien.length) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1" aria-label="Ausgewählte Dateien">
      {dateien.map((f, i) => {
        const { icon, endung } = dateiArt(f.name);
        return (
          <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-dashed border-accent/60 bg-accent/5 px-2 py-1 text-xs">
            <span aria-hidden>{icon}</span>
            <span className="flex-1 min-w-0 truncate font-medium">{f.name}</span>
            <span className="text-[10px] text-muted whitespace-nowrap">{endung} · {groesse(f.size)}</span>
            <button type="button" onClick={() => onEntfernen(i)} className="text-muted hover:text-red-500" aria-label={`${f.name} nicht hochladen`}>×</button>
          </li>
        );
      })}
    </ul>
  );
}
