"use client";
/** Aufklappbare Liste der weggeworfenen Fakten mit »Zurückholen«; ohne Inhalt wird nichts gezeigt. */
import type { ChallengeFakt } from "@/lib/api";
import { Inhalt } from "./modi/teile";

export default function Papierkorb({ weg, fakten, onZurueck }: { weg: string[]; fakten: ChallengeFakt[]; onZurueck(id: string): void }) {
  const drin = fakten.filter((f) => weg.includes(f.id));
  if (!drin.length) return null;
  return (
    <details className="card p-2">
      <summary className="cursor-pointer font-bold">🗑 Papierkorb ({drin.length})</summary>
      <ul className="flex flex-col gap-1 mt-2">
        {drin.map((f) => (
          <li key={f.id} className="flex items-center gap-2 justify-between">
            <span className="text-sm"><Inhalt x={f} /></span>
            <button className="btn-secondary shrink-0" aria-label={`»${f.text}« zurückholen`} onClick={() => onZurueck(f.id)}>Zurückholen</button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Kleiner 🗑-Knopf neben einem Fakt (Inventar, Notizbuch, Akte). */
export function WegKnopf({ fakt, onClick }: { fakt: ChallengeFakt; onClick(): void }) {
  return (
    <button className="btn-secondary self-start text-xs px-2 py-0.5" aria-label={`»${fakt.text}« wegwerfen`} title="Wegwerfen" onClick={onClick}>🗑</button>
  );
}
