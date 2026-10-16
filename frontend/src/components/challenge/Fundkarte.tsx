"use client";
/** Karte der Sammelphase: »Gefunden! …« mit Fakt und Nachlese-Text, bis die Person mit OK weitermacht. */
import type { ChallengeFakt } from "@/lib/api";
import { Inhalt } from "./modi/teile";

export default function Fundkarte({ fakt, onOk, titel = "Gefunden!", ok = "OK", skizze, fokus = true, onWegwerfen }: {
  fakt: ChallengeFakt | ChallengeFakt[]; onOk(): void; titel?: string; ok?: string;
  /** Kleine Zeichnung neben dem Fakt (Notizbuch des Detektivs). */
  skizze?: string;
  /** false im Spiel mit Tastatursteuerung: sonst löst die Leertaste den Knopf aus. */
  fokus?: boolean;
  /** Gibt es das, zeigt die Karte »Wegwerfen« (nur lokal, über den Papierkorb umkehrbar). */
  onWegwerfen?(): void;
}) {
  return (
    <div className="card p-3 flex flex-col gap-2" role="status">
      <strong>{titel}</strong>
      {(Array.isArray(fakt) ? fakt : [fakt]).map((f) => (
        <div key={f.id} className={skizze ? "flex gap-3 items-start" : undefined}>
          {skizze && <span className="text-3xl border-2 border-dashed border-line rounded-lg p-2 -rotate-3" aria-hidden>{skizze}</span>}
          <div><Inhalt x={f} />{f.info && <p className="text-muted text-sm">{f.info.text}</p>}</div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" autoFocus={fokus} onClick={onOk}>{ok}</button>
        {onWegwerfen && <button className="btn-secondary" aria-label={`${(Array.isArray(fakt) ? fakt : [fakt]).map((f) => `»${f.text}«`).join(", ")} wegwerfen`} onClick={onWegwerfen}>🗑 Wegwerfen</button>}
      </div>
    </div>
  );
}
