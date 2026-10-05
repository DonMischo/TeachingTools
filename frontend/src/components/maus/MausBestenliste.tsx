"use client";
/**
 * Die besten hundert je Liste — auch Gäste stehen darin.
 *
 * Eingrenzen lässt sich auf die eigene Sitzung (wer über denselben Code
 * mitmacht) und auf die eigene Klasse: am Beamer interessiert selten die
 * ganze Schule. 🤝 markiert Runden im Hilfsmodus.
 *
 * Weil Gäste ihren Namen selbst eintippen, kann eine Admin-Person einzelne
 * Einträge löschen (unpassende Namen).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type MausFilter, type MausModus, type MausZugang } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const LISTEN: { id: MausModus; label: string }[] = [
  { id: "gesamt", label: "🏅 Gesamt" },
  { id: "klick", label: "👆 Klicken" },
  { id: "doppelklick", label: "✌️ Doppelklick" },
  { id: "ziehen", label: "✋ Ziehen" },
];

type Bereich = "alle" | "sitzung" | "klasse";

export default function MausBestenliste({
  zugang, sitzungCode, klasse,
}: {
  zugang?: MausZugang;
  /** Code der Sitzung, auf die sich eingrenzen lässt (Beitritt oder Sitzung der Lehrkraft). */
  sitzungCode?: string | null;
  /** Klasse des angemeldeten Kindes. */
  klasse?: string | null;
}) {
  const { auth } = useAuth();
  const admin = auth?.role === "admin";
  const qc = useQueryClient();
  const [modus, setModus] = useState<MausModus>("gesamt");
  const [bereich, setBereich] = useState<Bereich>(sitzungCode ? "sitzung" : "alle");

  const filter: MausFilter =
    bereich === "sitzung" && sitzungCode ? { sitzung: sitzungCode }
      : bereich === "klasse" && klasse ? { klasse }
        : {};

  const { data: eintraege = [], isLoading, isError } = useQuery({
    queryKey: ["maus-bestenliste", modus, zugang?.code ?? null, filter.sitzung ?? null, filter.klasse ?? null],
    queryFn: () => api.mausBestenliste.liste(modus, zugang, filter),
  });

  async function loeschen(id: number, name: string) {
    if (!window.confirm(`Den Eintrag »${name}« aus der Bestenliste löschen?`)) return;
    await api.mausBestenliste.loeschen(id);
    qc.invalidateQueries({ queryKey: ["maus-bestenliste"] });
  }

  const knopf = (aktiv: boolean) =>
    "text-sm rounded-lg px-3 py-1.5 border transition-colors " +
    (aktiv ? "border-(--accent) text-(--accent) font-bold" : "border-(--border) hover:border-(--accent)");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {LISTEN.map(l => (
          <button key={l.id} onClick={() => setModus(l.id)} aria-pressed={modus === l.id} className={knopf(modus === l.id)}>
            {l.label}
          </button>
        ))}
      </div>

      {(sitzungCode || klasse) && (
        <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Eingrenzen">
          <span className="text-xs text-(--text-muted)">Zeigen:</span>
          <button onClick={() => setBereich("alle")} aria-pressed={bereich === "alle"} className={knopf(bereich === "alle")}>
            Ganze Schule
          </button>
          {sitzungCode && (
            <button onClick={() => setBereich("sitzung")} aria-pressed={bereich === "sitzung"} className={knopf(bereich === "sitzung")}>
              Diese Sitzung
            </button>
          )}
          {klasse && (
            <button onClick={() => setBereich("klasse")} aria-pressed={bereich === "klasse"} className={knopf(bereich === "klasse")}>
              Klasse {klasse}
            </button>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-(--border) bg-(--surface) overflow-hidden">
        {isLoading && <p className="text-sm text-(--text-muted) p-6 text-center">wird geladen …</p>}
        {isError && <p className="text-sm text-(--red) p-6 text-center">Die Bestenliste ließ sich nicht laden.</p>}
        {!isLoading && !isError && eintraege.length === 0 && (
          <p className="text-sm text-(--text-muted) p-6 text-center">Noch kein Eintrag. Wer eine Stufe schafft, steht hier.</p>
        )}
        {eintraege.length > 0 && (
          <ol>
            {eintraege.map(e => (
              <li
                key={e.id}
                data-selbst={e.selbst || undefined}
                className={"flex items-center gap-3 px-4 py-2 border-b border-(--border) last:border-0 " + (e.selbst ? "bg-(--surface-hover)" : "")}
              >
                <span className="w-8 text-right tabular-nums text-sm text-(--text-muted)">{e.platz}.</span>
                <span className={"flex-1 truncate text-sm " + (e.selbst ? "font-black text-(--accent)" : "")}>
                  {e.name}
                  {e.klasse && <span className="text-(--text-muted) ml-2 text-xs">{e.klasse}</span>}
                  {e.gast && <span className="text-(--text-muted) ml-2 text-xs">Gast</span>}
                  {e.hilfe && <span className="ml-2 text-xs" title="Im Hilfsmodus erspielt">🤝</span>}
                </span>
                {e.kontext && <span className="hidden sm:block w-56 truncate text-xs text-(--text-muted)">{e.kontext}</span>}
                <span className="w-24 text-right font-black tabular-nums">
                  {Math.round(e.wert).toLocaleString("de-DE")}
                  <span className="text-[10px] font-normal text-(--text-muted) ml-1">P.</span>
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

      <p className="text-xs text-(--text-muted) leading-relaxed">
        Je Person zählt nur die beste Runde. Gäste über den QR-Code stehen mit ihrem eingegebenen Namen in der Liste.
      </p>
    </div>
  );
}
