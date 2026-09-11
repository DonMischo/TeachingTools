"use client";
/**
 * Die besten hundert je Liste — auch Gäste stehen darin.
 *
 * Weil Gäste ihren Namen selbst eintippen, kann eine Admin-Person einzelne
 * Einträge löschen (unpassende Namen).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type MausModus, type MausZugang } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const LISTEN: { id: MausModus; label: string }[] = [
  { id: "gesamt", label: "🏅 Gesamt" },
  { id: "klick", label: "👆 Klicken" },
  { id: "doppelklick", label: "✌️ Doppelklick" },
  { id: "ziehen", label: "✋ Ziehen" },
];

export default function MausBestenliste({ zugang }: { zugang?: MausZugang }) {
  const { auth } = useAuth();
  const admin = auth?.role === "admin";
  const qc = useQueryClient();
  const [modus, setModus] = useState<MausModus>("gesamt");

  const { data: eintraege = [], isLoading, isError } = useQuery({
    queryKey: ["maus-bestenliste", modus, zugang?.code ?? null],
    queryFn: () => api.mausBestenliste.liste(modus, zugang),
  });

  async function loeschen(id: number, name: string) {
    if (!window.confirm(`Den Eintrag »${name}« aus der Bestenliste löschen?`)) return;
    await api.mausBestenliste.loeschen(id);
    qc.invalidateQueries({ queryKey: ["maus-bestenliste"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {LISTEN.map(l => (
          <button
            key={l.id}
            onClick={() => setModus(l.id)}
            aria-pressed={modus === l.id}
            className={
              "text-sm rounded-lg px-3 py-1.5 border transition-colors " +
              (modus === l.id ? "border-[var(--accent)] text-[var(--accent)] font-bold" : "border-[var(--border)] hover:border-[var(--accent)]")
            }
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {isLoading && <p className="text-sm text-[var(--text-muted)] p-6 text-center">wird geladen …</p>}
        {isError && <p className="text-sm text-[var(--red)] p-6 text-center">Die Bestenliste ließ sich nicht laden.</p>}
        {!isLoading && !isError && eintraege.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] p-6 text-center">Noch kein Eintrag. Wer eine Stufe schafft, steht hier.</p>
        )}
        {eintraege.length > 0 && (
          <ol>
            {eintraege.map(e => (
              <li
                key={e.id}
                data-selbst={e.selbst || undefined}
                className={"flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] last:border-0 " + (e.selbst ? "bg-[var(--surface-hover)]" : "")}
              >
                <span className="w-8 text-right tabular-nums text-sm text-[var(--text-muted)]">{e.platz}.</span>
                <span className={"flex-1 truncate text-sm " + (e.selbst ? "font-black text-[var(--accent)]" : "")}>
                  {e.name}
                  {e.klasse && <span className="text-[var(--text-muted)] ml-2 text-xs">{e.klasse}</span>}
                  {e.gast && <span className="text-[var(--text-muted)] ml-2 text-xs">Gast</span>}
                </span>
                {e.kontext && <span className="hidden sm:block w-56 truncate text-xs text-[var(--text-muted)]">{e.kontext}</span>}
                <span className="w-24 text-right font-black tabular-nums">
                  {Math.round(e.wert).toLocaleString("de-DE")}
                  <span className="text-[10px] font-normal text-[var(--text-muted)] ml-1">P.</span>
                </span>
                {admin && (
                  <button
                    onClick={() => loeschen(e.id, e.name)}
                    title="Eintrag löschen"
                    aria-label={`Eintrag ${e.name} löschen`}
                    className="text-sm opacity-60 hover:opacity-100"
                  >
                    🗑️
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        Je Person zählt nur die beste Runde. Gäste über den QR-Code stehen mit ihrem eingegebenen Namen in der Liste.
      </p>
    </div>
  );
}
