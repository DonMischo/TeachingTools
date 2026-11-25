"use client";
/**
 * Live-Dashboard einer Werkzeugsitzung: wer mitmacht, wie weit und was gerade.
 *
 * Eine Komponente für alle Werkzeuge — welche Spalten und Aufgaben es gibt,
 * beschreibt die `SitzungAnsicht` des Werkzeugs (lib/sitzung/typen.ts). Vier
 * Ansichten: Tabelle, Kacheln (Beamer), Matrix (Personen × Aufgaben) und
 * Rangliste (nur mit Wertung). Die gewählte merkt sich der Browser.
 */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type SitzungZeile } from "@/lib/api";
import { fortschrittVon, sekunden, vor, zelle, type SitzungAnsicht } from "@/lib/sitzung/typen";

export type DashboardArt = "tabelle" | "kacheln" | "matrix" | "rangliste";

const ARTEN: { id: DashboardArt; label: string }[] = [
  { id: "tabelle", label: "☰ Tabelle" },
  { id: "kacheln", label: "▦ Kacheln" },
  { id: "matrix", label: "▩ Matrix" },
  { id: "rangliste", label: "🏆 Rangliste" },
];
const SPEICHER = "hp_dashboard_ansicht";

function gemerkt(): DashboardArt | null {
  try { return (localStorage.getItem(SPEICHER) as DashboardArt | null) ?? null; } catch { return null; }
}

export function useSitzungZeilen(code: string | undefined, takt = 5000) {
  return useQuery({
    queryKey: ["sitzung-uebersicht", code],
    queryFn: () => api.sitzungen.uebersicht(code!),
    enabled: !!code,
    refetchInterval: takt,
  });
}

function Name({ z }: { z: SitzungZeile }) {
  return (
    <>
      <span className="font-bold">{z.name}</span>
      {z.klasse && <span className="text-xs text-muted ml-2">{z.klasse}</span>}
      {z.gast && <span className="text-xs text-muted ml-2">Gast</span>}
      {z.fertig_am && <span className="text-xs ml-2" title="fertig">🏁</span>}
    </>
  );
}

function Balken({ wert }: { wert: number }) {
  return (
    <div className="h-2 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={Math.round(wert * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-accent" style={{ width: `${Math.round(wert * 100)}%` }} />
    </div>
  );
}

export default function SitzungDashboard({ code, ansicht, takt = 5000, leer }: {
  code: string | undefined;
  ansicht?: SitzungAnsicht;
  takt?: number;
  /** Text, solange niemand da ist */
  leer?: ReactNode;
}) {
  const { data, isLoading, isError } = useSitzungZeilen(code, takt);
  const zeilen = data?.zeilen ?? [];
  const moeglich = ARTEN.filter(a => (a.id !== "matrix" || ansicht?.aufgaben?.length) && (a.id !== "rangliste" || ansicht?.rang));
  const [gewaehlt, setGewaehlt] = useState<DashboardArt | null>(gemerkt);
  const art = moeglich.some(a => a.id === gewaehlt) ? gewaehlt! : "tabelle";
  const waehle = (a: DashboardArt) => {
    setGewaehlt(a);
    try { localStorage.setItem(SPEICHER, a); } catch { /* nur Bequemlichkeit */ }
  };

  const spalten = ansicht?.spalten ?? [];
  const aufgaben = ansicht?.aufgaben ?? [];

  let inhalt: ReactNode;
  if (isLoading && code) inhalt = <p className="text-sm text-muted p-6 text-center">wird geladen …</p>;
  else if (isError) inhalt = <p className="text-sm text-bad p-6 text-center">Die Übersicht ließ sich nicht laden.</p>;
  else if (zeilen.length === 0) inhalt = (
    <p className="text-sm text-muted p-6 text-center">
      {leer ?? <>Noch niemand da. Zeig den Code <b className="text-fg tracking-widest">{code ?? "…"}</b> oder den QR.</>}
    </p>
  );
  else if (art === "kacheln") inhalt = (
    <div className="grid gap-3 p-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))" }} data-testid="dashboard-kacheln">
      {zeilen.map((z, i) => {
        const f = fortschrittVon(ansicht, z.daten);
        return (
          <div key={`${z.name}-${i}`} className="rounded-xl border border-line p-3 flex flex-col gap-2 text-sm">
            <div className="truncate"><Name z={z} /></div>
            {f != null && <Balken wert={f} />}
            <div className="text-xs text-muted truncate" title={z.aktuell ?? undefined}>{z.aktuell ?? "—"}</div>
            <div className="text-xs text-muted text-right">{vor(z.aktualisiert_am)}</div>
          </div>
        );
      })}
    </div>
  );
  else if (art === "matrix") {
    const quote = (id: string) => zeilen.filter(z => ansicht!.geschafft!(z.daten, id)).length / zeilen.length;
    inhalt = (
      <table className="w-full text-sm" data-testid="dashboard-matrix">
        <thead className="text-muted border-b border-line text-xs">
          <tr>
            <th className="px-3 py-2 text-left font-normal">Name</th>
            {aufgaben.map(a => <th key={a.id} className="px-1 py-2 font-normal" title={a.titel}>{a.icon ?? a.titel.slice(0, 3)}</th>)}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z, i) => (
            <tr key={`${z.name}-${i}`} className="border-b border-line">
              <td className="px-3 py-1.5 whitespace-nowrap"><Name z={z} /></td>
              {aufgaben.map(a => {
                const ok = ansicht!.geschafft!(z.daten, a.id);
                return <td key={a.id} className={`px-1 text-center ${ok ? "bg-ok/25" : ""}`} title={`${a.titel}: ${ok ? "geschafft" : "offen"}`}>{ok ? "✓" : ""}</td>;
              })}
            </tr>
          ))}
          <tr className="text-xs text-muted">
            <td className="px-3 py-1.5">geschafft</td>
            {aufgaben.map(a => <td key={a.id} className="px-1 text-center tabular-nums">{Math.round(quote(a.id) * 100)}%</td>)}
          </tr>
        </tbody>
      </table>
    );
  } else if (art === "rangliste") {
    const r = ansicht!.rang!;
    const mitWert = zeilen.map(z => ({ z, w: r.wert(z.daten) })).filter((x): x is { z: SitzungZeile; w: number } => x.w != null)
      .sort((a, b) => (r.richtung === "min" ? a.w - b.w : b.w - a.w));
    inhalt = mitWert.length === 0
      ? <p className="text-sm text-muted p-6 text-center">Noch keine Wertung für »{r.titel}«.</p>
      : (
        <ol className="flex flex-col p-3 gap-1" data-testid="dashboard-rangliste">
          {mitWert.map(({ z, w }, i) => (
            <li key={`${z.name}-${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2 border border-line">
              <span className="w-8 text-right font-black tabular-nums">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</span>
              <span className="flex-1 truncate"><Name z={z} /></span>
              <span className="tabular-nums font-bold">{r.art === "zeit" ? sekunden(w) : w.toLocaleString("de-DE")}</span>
            </li>
          ))}
        </ol>
      );
  } else inhalt = (
    <table className="w-full text-sm" data-testid="dashboard-tabelle">
      <thead className="text-muted border-b border-line text-xs">
        <tr>
          <th className="px-3 py-2 text-left font-normal">Name</th>
          {ansicht && fortschrittVon(ansicht, {}) != null && <th className="px-2 py-2 text-left font-normal w-24">Fortschritt</th>}
          {spalten.map(s => <th key={s.id} className="px-2 py-2 text-right font-normal" title={s.titel}>{s.icon ?? s.titel}</th>)}
          <th className="px-3 py-2 text-left font-normal">gerade</th>
          <th className="px-3 py-2 text-right font-normal">zuletzt</th>
        </tr>
      </thead>
      <tbody>
        {zeilen.map((z, i) => {
          const f = fortschrittVon(ansicht, z.daten);
          return (
            <tr key={`${z.name}-${i}`} className="border-b border-line last:border-0">
              <td className="px-3 py-2 whitespace-nowrap"><Name z={z} /></td>
              {f != null && <td className="px-2"><Balken wert={f} /></td>}
              {spalten.map(s => <td key={s.id} className="px-2 text-right tabular-nums whitespace-nowrap">{zelle(s, z.daten) || <span className="text-muted">·</span>}</td>)}
              <td className="px-3 text-xs text-muted max-w-[16rem] truncate" title={z.aktuell ?? undefined}>{z.aktuell ?? "—"}</td>
              <td className="px-3 text-right text-xs text-muted whitespace-nowrap">{vor(z.aktualisiert_am)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="card overflow-x-auto flex flex-col">
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-line text-xs" role="group" aria-label="Ansicht">
        <span className="text-muted mr-1">{zeilen.length} dabei{zeilen.some(z => z.fertig_am) ? ` · ${zeilen.filter(z => z.fertig_am).length} fertig` : ""}</span>
        <span className="flex-1" />
        {moeglich.map(a => (
          <button key={a.id} type="button" aria-pressed={art === a.id} onClick={() => waehle(a.id)}
            className={`rounded-md px-2 py-1 border ${art === a.id ? "border-accent text-accent font-bold" : "border-line hover:border-accent"}`}>
            {a.label}
          </button>
        ))}
      </div>
      {inhalt}
    </div>
  );
}
