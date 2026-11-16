"use client";
/**
 * Übersicht der Lehrkraft für »Markieren & Bearbeiten«: je Klasse bzw. Kurs
 * eine eigene Sitzung mit eigenem Code (wie bei der Challenge und dem
 * TaskCrawler), dazu die Tabelle, wer dort wie weit ist — geschaffte
 * Techniken, Challenge-Bestzeiten, zitierte Quellen und was gerade läuft.
 * Abgefragt wird alle fünf Sekunden wie bei der Algorithmen-Werkstatt.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type MarkierModus, type ToolSessionOut } from "@/lib/api";
import { ScopeSelect, scopeBody, type Scope } from "@/components/ScopeSelect";
import { LEKTIONEN, MODI } from "@/lib/markieren/aufgaben";
import { faelle } from "@/lib/markieren/quellen";
import { sek } from "./Challenge";

const TAKT_MS = 5000;
const LISTE = ["tool-sessions-list", "markieren"];

function vor(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "gerade eben";
  const m = Math.round(s / 60);
  return m < 60 ? `vor ${m} Min.` : `vor ${Math.round(m / 60)} Std.`;
}

/**
 * Die gewählte Sitzung der Lehrkraft. Vorgewählt ist nichts: Wie bei der
 * Challenge wählt die Lehrkraft beim Öffnen zuerst die Klasse (oder setzt eine
 * eigene Sitzung fort), erst dann geht es ins Werkzeug.
 */
export function useMarkierSitzung(aktiv: boolean) {
  const qc = useQueryClient();
  const [sitzung, setSitzung] = useState<ToolSessionOut | null>(null);
  const [fehler, setFehler] = useState("");
  const { data: alle, isLoading } = useQuery({
    queryKey: LISTE, queryFn: () => api.play.sessions("simulation", "markieren"), enabled: aktiv,
  });
  const meine = useMemo(() => (alle ?? []).filter(z => z.mine), [alle]);

  async function waehle(code: string) {
    try { setSitzung(await api.toolSessions.get(code)); setFehler(""); } catch { setFehler("Die Sitzung ließ sich nicht laden."); }
  }
  async function neu(scope: Scope) {
    try {
      setSitzung(await api.toolSessions.create("markieren", undefined, scopeBody(scope)));
      setFehler("");
      qc.invalidateQueries({ queryKey: LISTE });
    } catch (e) { setFehler((e as Error).message || "Die Sitzung ließ sich nicht anlegen."); }
  }
  return { sitzung, meine, waehle, neu, fehler, laedt: aktiv && isLoading };
}

/** Startbildschirm der Lehrkraft: für welche Klasse läuft die Stunde? */
export function MarkierStart({ wahl }: { wahl: ReturnType<typeof useMarkierSitzung> }) {
  const { meine, waehle, neu, fehler, laedt } = wahl;
  const [scope, setScope] = useState<Scope>(null);
  return (
    <section className="card p-5 flex flex-col gap-4 text-sm max-w-3xl mx-auto w-full" aria-label="Sitzung wählen">
      <h1 className="text-2xl font-black">🖍️ Markieren &amp; Bearbeiten</h1>
      <p className="text-muted">
        Für welche Klasse bzw. welchen Kurs läuft es? Jede bekommt einen eigenen Code, eine eigene Übersicht
        und »Diese Sitzung« in der Bestenliste.
      </p>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Neue Sitzung">
        <label className="flex items-center gap-1.5 font-bold">Neu für <ScopeSelect value={scope} onChange={setScope} className="input w-56" /></label>
        <button type="button" className="btn-primary" disabled={!scope} onClick={() => neu(scope)}>Starten</button>
        <button type="button" className="px-3 py-1.5 rounded-lg border border-line hover:bg-surface-hover" onClick={() => neu(null)}>
          Ohne Klasse
        </button>
      </div>
      {laedt && <p className="text-muted">Sitzungen werden geladen …</p>}
      {meine.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="font-bold">Oder fortsetzen:</div>
          <div className="flex flex-wrap gap-2">
            {meine.map(z => (
              <button key={z.code} type="button" onClick={() => waehle(z.code)}
                className="rounded-lg border border-line px-3 py-2 text-left hover:border-accent">
                <span className="font-bold">{z.scope_label ?? "Alle (ohne Klasse)"}</span>
                <span className="text-muted tracking-widest ml-2">{z.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {fehler && <p className="text-bad">{fehler}</p>}
    </section>
  );
}

export default function MarkierUebersicht({ wahl }: { wahl: ReturnType<typeof useMarkierSitzung> }) {
  const { sitzung, meine, waehle, neu, fehler } = wahl;
  const [scope, setScope] = useState<Scope>(null);
  const quellen = useMemo(() => faelle(), []);
  const code = sitzung?.code;
  const { data: zeilen = [], isLoading, isError } = useQuery({
    queryKey: ["markieren-uebersicht", code],
    queryFn: () => api.markieren.uebersicht(code!),
    enabled: !!code,
    refetchInterval: TAKT_MS,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4 flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sitzung je Klasse">
          <span className="font-bold">Sitzung:</span>
          <select className="input w-56" aria-label="Sitzung" value={code ?? ""} onChange={e => waehle(e.target.value)}>
            {!code && <option value="">…</option>}
            {meine.map(z => <option key={z.code} value={z.code}>{z.scope_label ?? "Alle (ohne Klasse)"} · {z.code}</option>)}
          </select>
          <label className="flex items-center gap-1.5">Neu für <ScopeSelect value={scope} onChange={setScope} className="input w-56" /></label>
          <button type="button" className="btn-primary" disabled={!scope} onClick={() => { neu(scope); setScope(null); }}>Für diese Klasse starten</button>
        </div>
        <p className="text-muted">
          Jede Klasse bzw. jeder Kurs bekommt einen eigenen Code. Den QR zur gewählten Sitzung zeigt »Zum Mitmachen« oben.
          Die Liste aktualisiert sich alle fünf Sekunden.
        </p>
        {fehler && <p className="text-bad">{fehler}</p>}
      </div>

      <div className="card overflow-x-auto">
        {isLoading && code && <p className="text-sm text-muted p-6 text-center">wird geladen …</p>}
        {isError && <p className="text-sm text-bad p-6 text-center">Die Übersicht ließ sich nicht laden.</p>}
        {!isLoading && !isError && zeilen.length === 0 && (
          <p className="text-sm text-muted p-6 text-center">
            Noch niemand da. Zeig den Code <b className="text-fg tracking-widest">{code ?? "…"}</b> oder den QR über »Zum Mitmachen«.
          </p>
        )}
        {zeilen.length > 0 && (
          <table className="w-full text-sm" data-testid="markieren-uebersicht">
            <thead className="text-muted border-b border-line text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-normal">Name</th>
                <th className="px-2 py-2 text-right font-normal" title="Geschaffte Techniken">📘</th>
                {LEKTIONEN.map(l => <th key={l.id} className="px-0.5 py-2 font-normal" title={l.titel}>{l.icon}</th>)}
                {(Object.keys(MODI) as MarkierModus[]).map(m => (
                  <th key={m} className="px-2 py-2 text-right font-normal border-l border-line" title={`Bestzeit ${MODI[m].titel}`}>{MODI[m].icon}</th>
                ))}
                <th className="px-2 py-2 text-right font-normal border-l border-line" title="Richtig zitierte Quellen">📚</th>
                <th className="px-3 py-2 text-left font-normal">gerade</th>
                <th className="px-3 py-2 text-right font-normal">zuletzt</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z, i) => (
                <tr key={`${z.name}-${i}`} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-bold">{z.name}</span>
                    {z.klasse && <span className="text-xs text-muted ml-2">{z.klasse}</span>}
                    {z.gast && <span className="text-xs text-muted ml-2">Gast</span>}
                  </td>
                  <td className="px-2 text-right font-bold tabular-nums">{z.lektionen.length}/{LEKTIONEN.length}</td>
                  {LEKTIONEN.map(l => (
                    <td key={l.id} className="px-0.5 text-center">{z.lektionen.includes(l.id) ? "✅" : <span className="text-muted">·</span>}</td>
                  ))}
                  {(Object.keys(MODI) as MarkierModus[]).map(m => {
                    const c = z.challenge[m];
                    return (
                      <td key={m} className="px-2 text-right tabular-nums whitespace-nowrap border-l border-line"
                        title={c ? `${c.runden} Runde(n)` : undefined}>
                        {c?.best_ms != null ? sek(c.best_ms) : c ? <span className="text-muted">{c.runden}×</span> : <span className="text-muted">·</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 text-right tabular-nums border-l border-line">{Object.keys(z.quellen).length}/{quellen.length}</td>
                  <td className="px-3 text-xs text-muted max-w-[16rem] truncate" title={z.aktuell ?? undefined}>{z.aktuell ?? "—"}</td>
                  <td className="px-3 text-right text-xs text-muted whitespace-nowrap">{vor(z.aktualisiert_am)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
