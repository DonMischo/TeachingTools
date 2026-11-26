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
import { fortschrittVon, sekunden, vor, zelle, type SitzungAnsicht, type SitzungQuelle } from "@/lib/sitzung/typen";

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

/** Zeilen aus dem gemeinsamen Sitzungsstand oder aus der eigenen Quelle des Werkzeugs. */
export function useSitzungZeilen(code: string | undefined, takt = 5000, quelle?: SitzungQuelle) {
  return useQuery({
    queryKey: quelle ? ["sitzung-quelle", ...quelle.schluessel] : ["sitzung-uebersicht", code],
    queryFn: async (): Promise<{ zeilen: SitzungZeile[]; ansicht?: SitzungAnsicht }> =>
      quelle ? quelle.laden() : { zeilen: (await api.sitzungen.uebersicht(code!)).zeilen },
    enabled: !!quelle || !!code,
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

export default function SitzungDashboard({ code, ansicht: vorgegeben, quelle, takt = 5000, leer, detail, detailLabel = "Log" }: {
  code: string | undefined;
  ansicht?: SitzungAnsicht;
  /** Eigene Datenquelle (Adapter) statt des gemeinsamen Sitzungsstands */
  quelle?: SitzungQuelle;
  takt?: number;
  /** Text, solange niemand da ist */
  leer?: ReactNode;
  /** Aufklappbares Detail je Person in der Tabelle (TaskCrawler: Ereignis-Log) */
  detail?: (z: SitzungZeile) => ReactNode;
  /** Beschriftung des Aufklapp-Knopfs */
  detailLabel?: string;
}) {
  const [offen, setOffen] = useState<string | null>(null);
  const { data, isLoading, isError } = useSitzungZeilen(code, takt, quelle);
  const zeilen = data?.zeilen ?? [];
  const ansicht = vorgegeben ?? data?.ansicht;
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
  if (isLoading && (code || quelle)) inhalt = <p className="text-sm text-muted p-6 text-center">wird geladen …</p>;
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
    // Eine Zeile je Person wie im TaskCrawler-Dashboard: Name, Balken, Status, Kennzahlen, gerade.
    <ul className="divide-y divide-line px-3" data-testid="dashboard-tabelle">
      {zeilen.map((z, i) => {
        const f = fortschrittVon(ansicht, z.daten);
        const schluessel = `${z.name}-${i}`;
        const auf = detail && offen === schluessel;
        return (
          <li key={schluessel} className="py-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <span className="w-40 truncate" title={z.klasse ?? undefined}><Name z={z} /></span>
              {f != null
                ? <div className="flex-1 min-w-24 flex items-center gap-2"><div className="flex-1"><Balken wert={f} /></div><span className="text-xs text-muted w-10 text-right tabular-nums">{Math.round(f * 100)} %</span></div>
                : <span className="flex-1 text-xs text-muted truncate" title={z.aktuell ?? undefined}>{z.aktuell ?? "—"}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${z.fertig_am ? "border-green-500/40 text-green-500" : "border-line text-muted"}`}>
                {z.fertig_am ? "fertig" : "läuft"}
              </span>
              {spalten.map(sp => {
                const w = zelle(sp, z.daten);
                return w ? <span key={sp.id} className="text-xs text-muted whitespace-nowrap" title={sp.titel}>{sp.icon ?? sp.titel} <b className="text-fg tabular-nums font-normal">{w}</b></span> : null;
              })}
              {f != null && z.aktuell && <span className="text-xs text-muted max-w-[14rem] truncate" title={z.aktuell}>{z.aktuell}</span>}
              <span className="text-xs text-muted whitespace-nowrap">{vor(z.aktualisiert_am)}</span>
              {detail && (
                <button type="button" onClick={() => setOffen(auf ? null : schluessel)} aria-expanded={!!auf}
                  className="text-xs text-accent hover:underline">{detailLabel}</button>
              )}
            </div>
            {auf && detail(z)}
          </li>
        );
      })}
    </ul>
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
