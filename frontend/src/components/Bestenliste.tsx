"use client";
/**
 * Gemeinsame Bestenliste der Werkzeuge (Markieren, Maus-Führerschein, Schreibübung):
 * die besten hundert je Modus, eigene Zeile hervorgehoben, auch Gäste.
 *
 * Eingrenzen lässt sich auf die Sitzung (wer dort mitmacht bzw. seine Bestleistung
 * erzielt hat) und auf die eigene Klasse. Weil Gäste ihren Namen selbst eintippen,
 * kann eine Admin-Person einzelne Einträge löschen.
 *
 * Was ein Wert bedeutet und wie er aussieht, bestimmt das Werkzeug über `format`;
 * ob mehr oder weniger gewinnt, entscheidet der Server (api/bestenliste_regeln.py).
 */
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type BestenlisteWerkzeug, type BestenlisteZeile, type MausFilter, type MausZugang } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type BestenlisteModus = { id: string; titel: string; icon?: string; hinweis?: string };
type Bereich = "alle" | "sitzung" | "klasse";

const MEDAILLEN = ["🥇", "🥈", "🥉"];

export default function Bestenliste({
  werkzeug, modi, format, zugang, klasse, sitzungCode, detail, marke, leer, fuss,
}: {
  werkzeug: BestenlisteWerkzeug;
  modi: BestenlisteModus[];
  /** Der Wert einer Zeile als Text, z. B. »38,2 s« oder »1.240 P.«. */
  format: (wert: number, extra: Record<string, unknown>, modus: string) => string;
  zugang?: MausZugang;
  /** Klasse der angemeldeten Person — schaltet »Klasse …« frei. */
  klasse?: string | null;
  /** Sitzung, auf die sich eingrenzen lässt — schaltet »Diese Sitzung« frei. */
  sitzungCode?: string | null;
  /** Kleingedrucktes je Zeile (nur ab sm), z. B. Aktionen oder Lektion. */
  detail?: (e: BestenlisteZeile) => ReactNode;
  /** Kennzeichen hinter dem Namen, z. B. 🤝. */
  marke?: (e: BestenlisteZeile) => ReactNode;
  /** Text, wenn die Liste leer ist. */
  leer?: string;
  /** Fußnote unter der Liste. */
  fuss?: string;
}) {
  const { auth } = useAuth();
  const admin = auth?.role === "admin";
  const qc = useQueryClient();
  const [modus, setModus] = useState(modi[0].id);
  const [bereichGewaehlt, setBereich] = useState<Bereich | null>(null);
  // Die Sitzung kann erst nach dem Laden bekannt sein — bis zur ersten Wahl gilt sie als Vorgabe.
  const bereich: Bereich = bereichGewaehlt ?? (sitzungCode ? "sitzung" : "alle");
  const aktuell = modi.find(m => m.id === modus) ?? modi[0];

  const filter: MausFilter =
    bereich === "sitzung" && sitzungCode ? { sitzung: sitzungCode }
      : bereich === "klasse" && klasse ? { klasse }
        : {};

  const { data: eintraege = [], isLoading, isError } = useQuery({
    queryKey: ["bestenliste", werkzeug, modus, zugang?.code ?? null, filter.sitzung ?? null, filter.klasse ?? null],
    queryFn: () => api.bestenlisten.liste(werkzeug, modus, zugang, filter),
  });

  async function loeschen(id: number, name: string) {
    if (!window.confirm(`Den Eintrag »${name}« aus der Bestenliste löschen?`)) return;
    await api.bestenlisten.loeschen(id);
    qc.invalidateQueries({ queryKey: ["bestenliste", werkzeug] });
  }

  const knopf = (aktiv: boolean) =>
    "text-sm rounded-lg px-3 py-1.5 border transition-colors " +
    (aktiv ? "border-accent text-accent font-bold" : "border-line hover:border-accent");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {modi.map(m => (
          <button key={m.id} onClick={() => setModus(m.id)} aria-pressed={modus === m.id} className={knopf(modus === m.id)}>
            {m.icon} {m.titel}
          </button>
        ))}
        {aktuell.hinweis && <span className="text-xs text-muted">{aktuell.hinweis}</span>}
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
          <p className="text-sm text-muted p-6 text-center">{leer ?? "Noch kein Eintrag."}</p>
        )}
        {eintraege.length > 0 && (
          <ol>
            {eintraege.map(e => (
              <li key={e.id} data-platz={e.platz} data-selbst={e.selbst || undefined}
                className={"flex items-center gap-3 px-4 py-2 border-b border-line last:border-0 " + (e.selbst ? "bg-surface-hover" : "")}>
                <span className="w-8 text-right tabular-nums text-sm text-muted">{MEDAILLEN[e.platz - 1] ?? `${e.platz}.`}</span>
                <span className={"flex-1 truncate text-sm " + (e.selbst ? "font-black text-accent" : "")}>
                  {e.name}
                  {e.selbst && <span className="ml-2 text-xs font-normal">(du)</span>}
                  {e.klasse && <span className="text-muted ml-2 text-xs">{e.klasse}</span>}
                  {e.gast && <span className="text-muted ml-2 text-xs">Gast</span>}
                  {marke?.(e)}
                </span>
                {detail && <span className="hidden sm:block max-w-56 truncate text-right text-xs text-muted tabular-nums">{detail(e)}</span>}
                <span className="min-w-20 text-right font-black tabular-nums">{format(e.wert, e.extra, modus)}</span>
                {admin && (
                  <button onClick={() => loeschen(e.id, e.name)} title="Eintrag löschen" aria-label={`Eintrag ${e.name} löschen`}
                    className="text-sm opacity-60 hover:opacity-100">🗑️</button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {fuss && <p className="text-xs text-muted leading-relaxed">{fuss}</p>}
    </div>
  );
}
