"use client";
/**
 * Sitzung je Klasse für Werkzeuge mit Lehrer-Übersicht (wie bei »Markieren &
 * Bearbeiten«): Beim Öffnen wählt die Lehrkraft zuerst die Klasse bzw. den
 * Kurs oder setzt eine eigene Sitzung fort; jede Klasse bekommt einen eigenen
 * Code, eigenen QR und eine eigene Übersicht.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ToolSessionOut } from "@/lib/api";
import { ScopeSelect, scopeBody, type Scope } from "@/components/ScopeSelect";

export function useWerkzeugSitzung(werkzeug: string, aktiv: boolean) {
  const qc = useQueryClient();
  const liste = useMemo(() => ["tool-sessions-list", werkzeug], [werkzeug]);
  const [sitzung, setSitzung] = useState<ToolSessionOut | null>(null);
  const [fehler, setFehler] = useState("");
  const { data: alle, isLoading } = useQuery({
    queryKey: liste, queryFn: () => api.play.sessions("simulation", werkzeug), enabled: aktiv,
  });
  const meine = useMemo(() => (alle ?? []).filter(z => z.mine), [alle]);

  async function waehle(code: string) {
    try { setSitzung(await api.toolSessions.get(code)); setFehler(""); } catch { setFehler("Die Sitzung ließ sich nicht laden."); }
  }
  async function neu(scope: Scope) {
    try {
      setSitzung(await api.toolSessions.create(werkzeug, undefined, scopeBody(scope)));
      setFehler("");
      qc.invalidateQueries({ queryKey: liste });
    } catch (e) { setFehler((e as Error).message || "Die Sitzung ließ sich nicht anlegen."); }
  }
  return { sitzung, meine, waehle, neu, fehler, laedt: aktiv && isLoading };
}

export type SitzungWahl = ReturnType<typeof useWerkzeugSitzung>;

/** Startbildschirm der Lehrkraft: für welche Klasse läuft die Stunde? */
export function SitzungStart({ wahl, titel, text }: { wahl: SitzungWahl; titel: ReactNode; text?: ReactNode }) {
  const { meine, waehle, neu, fehler, laedt } = wahl;
  const [scope, setScope] = useState<Scope>(null);
  return (
    <section className="card p-5 flex flex-col gap-4 text-sm max-w-3xl mx-auto w-full" aria-label="Sitzung wählen">
      <h1 className="text-2xl font-black">{titel}</h1>
      <p className="text-muted">
        {text ?? "Für welche Klasse bzw. welchen Kurs läuft es? Jede bekommt einen eigenen Code und eine eigene Übersicht."}
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

/** Kopf der Übersicht: Sitzung wechseln oder für eine weitere Klasse starten. */
export function SitzungLeiste({ wahl }: { wahl: SitzungWahl }) {
  const { sitzung, meine, waehle, neu, fehler } = wahl;
  const [scope, setScope] = useState<Scope>(null);
  const code = sitzung?.code;
  return (
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
  );
}
