"use client";
/**
 * Lehrkraft: einen gespeicherten Challenge-Satz teilen (Code/QR), Startstufe wählen,
 * live mitverfolgen, Hauspunkte vergeben, CSV holen, neue Runde.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ToolSessionOut } from "@/lib/api";
import { ToolSessionBar } from "@/components/ToolSessionBar";

export default function ChallengeLehrkraft({ satzId, titel }: { satzId: number; titel: string }) {
  const qc = useQueryClient();
  const [sitzung, setSitzung] = useState<ToolSessionOut | null>(null);
  const [meldung, setMeldung] = useState("");
  useEffect(() => {
    setSitzung(null);
    api.toolSessions.create("challenge", satzId).then(setSitzung).catch(() => setMeldung("Challenge-Sitzung ließ sich nicht anlegen."));
  }, [satzId]);
  const code = sitzung?.code;
  const { data: ueb } = useQuery({
    queryKey: ["challenge", "uebersicht", code], queryFn: () => api.challenge.uebersicht(code!), enabled: !!code, refetchInterval: 5000,
  });

  if (!sitzung) return meldung ? <p className="text-sm text-bad">{meldung}</p> : null;
  const startstufe = Number(sitzung.settings?.startstufe ?? 2);
  const vergebenAm = sitzung.settings?.punkte_vergeben as string | undefined;
  const setzeStufe = async (stufe: number) => {
    setSitzung(await api.toolSessions.einstellungen(sitzung.code, { ...sitzung.settings, startstufe: stufe }));
  };
  const vergeben = async () => {
    if (!window.confirm("Hauspunkte für diese Challenge jetzt vergeben? Das geht je Runde nur einmal.")) return;
    try {
      const r = await api.challenge.punkte(sitzung.code);
      setMeldung(r.vergeben.map((z) => `${z.klasse}: ${z.punkte} P.`).join(" · ") || "Keine Klasse hat teilgenommen.");
      setSitzung(await api.toolSessions.get(sitzung.code));
    } catch (err) {
      setMeldung((err as Error).message);
    }
  };
  const neueRunde = async () => {
    if (!window.confirm("Alle Ergebnisse dieser Runde löschen und neu beginnen?")) return;
    await api.challenge.zuruecksetzen(sitzung.code);
    setSitzung(await api.toolSessions.get(sitzung.code));
    qc.invalidateQueries({ queryKey: ["challenge", "uebersicht", code] });
    setMeldung("Neue Runde gestartet.");
  };
  const prozent = (x: number) => `${Math.round(100 * x)} %`;

  return (
    <section className="card p-4 flex flex-col gap-3 text-sm" aria-label="Challenge-Sitzung">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-black text-base">⚔️ Challenge: {titel}</h2>
        <ToolSessionBar tool="challenge" title={`Challenge: ${titel}`} refId={satzId} />
      </div>
      <label className="flex items-center gap-1.5">
        Startstufe
        <select className="input w-20" value={startstufe} onChange={(e) => setzeStufe(Number(e.target.value))}>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-xs text-muted">(die Stufe passt sich danach je Spieler an)</span>
      </label>

      {ueb && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th>Name</th><th>Klasse</th><th>Stufe</th><th>Güte</th><th>Ergebnis</th><th>Punkte</th><th>Fragen</th>
                <th>Erstversuch richtig</th><th>Kombos</th><th>Ablenker gewählt</th><th>Lesetempo (W/min)</th><th>geraten</th><th>fertig</th>
              </tr>
            </thead>
            <tbody>
              {ueb.teilnehmer.map((t, i) => (
                <tr key={i} className="border-t border-line">
                  <td>{t.name}</td><td>{t.klasse}</td><td>{t.stufe_start}→{t.stufe}</td><td>{prozent(t.guete)}</td>
                  <td>{prozent(t.ergebnis)}</td><td>{t.punkte}</td><td>{t.fragen}</td><td>{t.erstversuch_richtig}</td><td>{t.kombos}</td>
                  <td>{t.ablenker_gewaehlt.join(", ")}</td><td>{t.lesetempo_median ?? "—"}</td><td>{t.geraten}</td><td>{t.fertig ? "✓" : ""}</td>
                </tr>
              ))}
              {!ueb.teilnehmer.length && <tr><td colSpan={13} className="text-muted">Noch niemand dabei.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
        {ueb?.punkte.length ? <span>Vorschau: {ueb.punkte.map((z) => `${z.klasse} ${z.punkte} P.`).join(" · ")}</span> : null}
        <button onClick={vergeben} disabled={!!vergebenAm}
          className="px-3 py-1.5 rounded-lg font-bold border border-line hover:bg-surface-hover disabled:opacity-40">
          🏠 Hauspunkte vergeben
        </button>
        <a href={api.challenge.csvPfad(sitzung.code)} className="px-3 py-1.5 rounded-lg border border-line hover:bg-surface-hover">CSV</a>
        <button onClick={neueRunde} className="px-3 py-1.5 rounded-lg border border-line hover:bg-surface-hover">Zurücksetzen</button>
        {vergebenAm && <span className="text-xs text-muted">vergeben am {new Date(vergebenAm).toLocaleString("de-DE")}</span>}
        {meldung && <span className="text-xs">{meldung}</span>}
      </div>
    </section>
  );
}
