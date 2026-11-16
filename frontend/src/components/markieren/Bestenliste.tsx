"use client";
/**
 * Bestenliste der Challenge — die schnellsten hundert je Modus, auch Gäste.
 * Wie beim Maus-Führerschein eingrenzbar auf die Sitzung (wer dort seine
 * Bestzeit erzielt hat) und die eigene Klasse; Admins löschen unpassende Namen.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type MarkierModus, type MausFilter, type MausZugang } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { MODI } from "@/lib/markieren/aufgaben";
import { sek } from "./Challenge";

type Bereich = "alle" | "sitzung" | "klasse";

export default function Bestenliste({ zugang, verwaltung, klasse, sitzungCode: gewaehlt }: {
  zugang?: MausZugang;
  /** Lehrkraft auf der Werkzeugseite: »Diese Sitzung« = ihre eigene. */
  verwaltung?: boolean;
  klasse?: string | null;
  /** Lehrkraft: die gewählte Sitzung (je Klasse eine). */
  sitzungCode?: string | null;
}) {
  // Hier und nicht in der Hülle: die Offline-Datei hat keinen QueryClient.
  const { data: eigeneSitzung } = useQuery({
    queryKey: ["markieren-sitzung"],
    queryFn: () => api.toolSessions.create("markieren"),
    enabled: !!verwaltung && !zugang && !gewaehlt,
  });
  const sitzungCode = zugang?.code ?? gewaehlt ?? eigeneSitzung?.code ?? null;
  const { auth } = useAuth();
  const admin = auth?.role === "admin";
  const qc = useQueryClient();
  const [modus, setModus] = useState<MarkierModus>("markieren");
  const [bereichGewaehlt, setBereich] = useState<Bereich | null>(null);
  // Die eigene Sitzung kommt erst nach dem Laden — bis zur ersten Wahl gilt sie als Vorgabe.
  const bereich: Bereich = bereichGewaehlt ?? (sitzungCode ? "sitzung" : "alle");

  const filter: MausFilter =
    bereich === "sitzung" && sitzungCode ? { sitzung: sitzungCode }
      : bereich === "klasse" && klasse ? { klasse }
        : {};

  const { data: eintraege = [], isLoading, isError } = useQuery({
    queryKey: ["markier-bestenliste", modus, zugang?.code ?? null, filter.sitzung ?? null, filter.klasse ?? null],
    queryFn: () => api.markierBestenliste.liste(modus, zugang, filter),
  });

  async function loeschen(id: number, name: string) {
    if (!window.confirm(`Den Eintrag »${name}« aus der Bestenliste löschen?`)) return;
    await api.markierBestenliste.loeschen(id);
    qc.invalidateQueries({ queryKey: ["markier-bestenliste"] });
  }

  const knopf = (aktiv: boolean) =>
    "text-sm rounded-lg px-3 py-1.5 border transition-colors " +
    (aktiv ? "border-accent text-accent font-bold" : "border-line hover:border-accent");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MODI) as MarkierModus[]).map(m => (
          <button key={m} onClick={() => setModus(m)} aria-pressed={modus === m} className={knopf(modus === m)}>
            {MODI[m].icon} {MODI[m].titel}
          </button>
        ))}
      </div>

      {(sitzungCode || klasse) && (
        <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Eingrenzen">
          <span className="text-xs text-muted">Zeigen:</span>
          <button onClick={() => setBereich("alle")} aria-pressed={bereich === "alle"} className={knopf(bereich === "alle")}>Ganze Schule</button>
          {sitzungCode && (
            <button onClick={() => setBereich("sitzung")} aria-pressed={bereich === "sitzung"} className={knopf(bereich === "sitzung")}>Diese Sitzung</button>
          )}
          {klasse && (
            <button onClick={() => setBereich("klasse")} aria-pressed={bereich === "klasse"} className={knopf(bereich === "klasse")}>Klasse {klasse}</button>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        {isLoading && <p className="text-sm text-muted p-6 text-center">wird geladen …</p>}
        {isError && <p className="text-sm text-bad p-6 text-center">Die Bestenliste ließ sich nicht laden.</p>}
        {!isLoading && !isError && eintraege.length === 0 && (
          <p className="text-sm text-muted p-6 text-center">Noch kein Eintrag. Wer eine Challenge ohne Überspringen schafft, steht hier.</p>
        )}
        {eintraege.length > 0 && (
          <ol>
            {eintraege.map(e => (
              <li key={e.id} data-selbst={e.selbst || undefined}
                className={"flex items-center gap-3 px-4 py-2 border-b border-line last:border-0 " + (e.selbst ? "bg-surface-hover" : "")}>
                <span className="w-8 text-right tabular-nums text-sm text-muted">{e.platz}.</span>
                <span className={"flex-1 truncate text-sm " + (e.selbst ? "font-black text-accent" : "")}>
                  {e.name}
                  {e.klasse && <span className="text-muted ml-2 text-xs">{e.klasse}</span>}
                  {e.gast && <span className="text-muted ml-2 text-xs">Gast</span>}
                </span>
                <span className="hidden sm:block w-24 text-right text-xs text-muted tabular-nums">{e.aktionen} Aktionen</span>
                <span className="w-20 text-right font-black tabular-nums">{sek(e.zeit_ms)}</span>
                {admin && (
                  <button onClick={() => loeschen(e.id, e.name)} title="Eintrag löschen" aria-label={`Eintrag ${e.name} löschen`}
                    className="text-sm opacity-60 hover:opacity-100">🗑️</button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="text-xs text-muted leading-relaxed">
        Je Person zählt nur die schnellste Runde ohne Überspringen. Gäste über den QR-Code stehen mit ihrem eingegebenen Namen in der Liste.
      </p>
    </div>
  );
}
