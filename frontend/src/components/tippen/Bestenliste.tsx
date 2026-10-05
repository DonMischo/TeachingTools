"use client";
/**
 * Die besten hundert je Modus.
 *
 * Drei Listen, weil die drei Modi drei verschiedene Dinge messen — und bei der
 * Tastenjagd gewinnt die kleinste Zahl. Je Person steht genau eine Zeile: die
 * beste. Die eigene ist hervorgehoben, damit man sich in hundert Namen findet.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type TippModus } from "@/lib/api";

const LISTEN: { id: TippModus; label: string; einheit: string; hinweis: string }[] = [
  { id: "lektionen", label: "📚 Lektionen", einheit: "A/min", hinweis: "Anschläge pro Minute — mehr ist besser" },
  { id: "wortregen", label: "🌧️ Wortregen", einheit: "Punkte", hinweis: "Punkte einer Runde — mehr ist besser" },
  { id: "tastenjagd", label: "🎯 Tastenjagd", einheit: "ms", hinweis: "Reaktion je Taste — weniger ist besser" },
];

export default function Bestenliste() {
  const [modus, setModus] = useState<TippModus>("lektionen");
  const gewaehlt = LISTEN.find(l => l.id === modus)!;

  const { data: eintraege = [], isLoading, isError } = useQuery({
    queryKey: ["tippen-bestenliste", modus],
    queryFn: () => api.tippenBestenliste.liste(modus),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {LISTEN.map(l => (
          <button
            key={l.id}
            onClick={() => setModus(l.id)}
            aria-pressed={modus === l.id}
            className={
              "text-sm rounded-lg px-3 py-1.5 border transition-colors " +
              (modus === l.id
                ? "border-(--accent) text-(--accent) font-bold"
                : "border-(--border) hover:border-(--accent)")
            }
          >
            {l.label}
          </button>
        ))}
        <span className="text-xs text-(--text-muted)">{gewaehlt.hinweis}</span>
      </div>

      <div className="rounded-2xl border border-(--border) bg-(--surface) overflow-hidden">
        {isLoading && <p className="text-sm text-(--text-muted) p-6 text-center">wird geladen …</p>}
        {isError && (
          <p className="text-sm text-(--red) p-6 text-center">
            Die Bestenliste ließ sich nicht laden.
          </p>
        )}
        {!isLoading && !isError && eintraege.length === 0 && (
          <p className="text-sm text-(--text-muted) p-6 text-center">
            Noch kein Eintrag. Wer die erste Runde zu Ende bringt, steht hier.
          </p>
        )}

        {eintraege.length > 0 && (
          <ol>
            {eintraege.map(e => (
              <li
                key={`${e.platz}-${e.name}`}
                data-platz={e.platz}
                data-selbst={e.selbst || undefined}
                className={
                  "flex items-center gap-3 px-4 py-2 border-b border-(--border) last:border-0 " +
                  (e.selbst ? "bg-(--surface-hover)" : "")
                }
              >
                <span className="w-8 text-right tabular-nums text-sm text-(--text-muted)">
                  {e.platz}.
                </span>
                <span className={"flex-1 truncate text-sm " + (e.selbst ? "font-black text-(--accent)" : "")}>
                  {e.name}
                  {e.klasse && <span className="text-(--text-muted) ml-2 text-xs">{e.klasse}</span>}
                </span>
                {e.kontext && (
                  <span className="hidden sm:block w-40 truncate text-xs text-(--text-muted)">
                    {e.kontext}
                  </span>
                )}
                <span
                  className="w-16 text-right text-xs tabular-nums"
                  style={{ color: e.fehler > 0 ? "var(--red)" : "var(--text-muted)" }}
                  title="Fehler"
                >
                  {e.fehler > 0 ? `${e.fehler}✗` : "fehlerfrei"}
                </span>
                <span className="w-24 text-right font-black tabular-nums">
                  {Math.round(e.wert)}
                  <span className="text-[10px] font-normal text-(--text-muted) ml-1">
                    {gewaehlt.einheit}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="text-xs text-(--text-muted) leading-relaxed">
        Eingetragen wird nur mit eigenem Zugang und nur die jeweils beste Runde — Gäste
        über den QR-Code spielen mit, stehen aber nicht in der Liste.
      </p>
    </div>
  );
}
