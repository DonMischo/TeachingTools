"use client";
/**
 * Auswertung einer Sitzung — jederzeit, auch mitten in der Stunde: Kennzahlen,
 * schwerste Aufgaben, Tabelle je Person und Download als CSV, PDF oder DOCX.
 *
 * Zeilen kommen aus dem gemeinsamen Sitzungsstand (`code`) oder fertig von
 * einem Adapter (`zeilen`, z. B. TaskCrawler mit eigenen Tabellen).
 */
import { useMemo, useState } from "react";
import type { SitzungZeile } from "@/lib/api";
import type { SitzungAnsicht, SitzungQuelle } from "@/lib/sitzung/typen";
import { auswerten, csvHerunterladen, docxHerunterladen, kennzahlenText, pdfHerunterladen } from "@/lib/sitzung/auswertung";
import { useSitzungZeilen } from "./SitzungDashboard";

export default function SitzungAuswertung({ code, zeilen: vorgegeben, ansicht: ansichtVorgabe, quelle, titel }: {
  code?: string;
  zeilen?: SitzungZeile[];
  ansicht?: SitzungAnsicht;
  /** Eigene Datenquelle (Adapter) statt des gemeinsamen Sitzungsstands */
  quelle?: SitzungQuelle;
  titel: string;
}) {
  const { data, isLoading, isError } = useSitzungZeilen(vorgegeben ? undefined : code, 15000, vorgegeben ? undefined : quelle);
  const zeilen = useMemo(() => vorgegeben ?? data?.zeilen ?? [], [vorgegeben, data]);
  const ansicht = ansichtVorgabe ?? data?.ansicht;
  const a = useMemo(() => auswerten(zeilen, ansicht), [zeilen, ansicht]);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState("");

  async function lade(art: string, f: () => Promise<void>) {
    setLaeuft(art); setFehler("");
    try { await f(); } catch { setFehler("Der Download ließ sich nicht erzeugen."); } finally { setLaeuft(null); }
  }

  if (!vorgegeben && isLoading && (code || quelle)) return <p className="text-sm text-muted p-6 text-center">wird geladen …</p>;
  if (!vorgegeben && isError) return <p className="text-sm text-bad p-6 text-center">Die Auswertung ließ sich nicht laden.</p>;

  return (
    <div className="flex flex-col gap-3 text-sm" data-testid="sitzung-auswertung">
      <div className="card p-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-black text-base flex-1">📊 Auswertung</h3>
          {(["CSV", "PDF", "DOCX"] as const).map(art => (
            <button key={art} type="button" disabled={!zeilen.length || laeuft != null}
              className="text-xs border border-line rounded-lg px-2.5 py-1.5 hover:border-accent disabled:opacity-40"
              onClick={() => lade(art, () => (art === "CSV" ? csvHerunterladen : art === "PDF" ? pdfHerunterladen : docxHerunterladen)(titel, a))}>
              {laeuft === art ? "…" : `⬇ ${art}`}
            </button>
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
          {kennzahlenText(a.kennzahlen).map(t => <li key={t}>{t}</li>)}
        </ul>
        {fehler && <p className="text-bad">{fehler}</p>}
      </div>

      {a.schwerste.length > 0 && (
        <div className="card p-4 flex flex-col gap-2">
          <h4 className="font-bold">Am schwersten</h4>
          <ul className="flex flex-col gap-1.5">
            {a.schwerste.map(s => (
              <li key={s.id} className="flex items-center gap-3">
                <span className="flex-1 truncate" title={s.titel}>{s.titel}</span>
                <span className="w-32 h-2 rounded-full bg-line overflow-hidden">
                  <span className="block h-full bg-accent" style={{ width: `${Math.round(s.quote * 100)}%` }} />
                </span>
                <span className="w-20 text-right tabular-nums text-muted">{s.geschafft}/{a.kennzahlen.teilnehmende}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-x-auto">
        {zeilen.length === 0
          ? <p className="text-muted p-6 text-center">Noch keine Ergebnisse.</p>
          : (
            <table className="w-full text-sm">
              <thead className="text-muted border-b border-line text-xs">
                <tr>{a.kopf.map(k => <th key={k} className="px-3 py-2 text-left font-normal whitespace-nowrap">{k}</th>)}</tr>
              </thead>
              <tbody>
                {a.tabelle.map((z, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {z.map((w, j) => <td key={j} className={`px-3 py-1.5 ${j === 0 ? "font-bold whitespace-nowrap" : "tabular-nums"}`}>{w}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
