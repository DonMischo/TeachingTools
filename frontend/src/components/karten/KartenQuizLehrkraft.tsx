"use client";
/**
 * Lehrkraft: einen gespeicherten Kartensatz als Quiz teilen (Code/QR), Modus
 * und Punkte einstellen, live mitverfolgen, Hauspunkte vergeben, neue Runde.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import SitzungDashboard from "@/components/sitzung/SitzungDashboard";
import { SitzungLeiste, useWerkzeugSitzung } from "@/components/SitzungWahl";
import { kartenQuizQuelle } from "@/lib/karten/sitzung";

export default function KartenQuizLehrkraft({ satzId, titel }: { satzId: number; titel: string }) {
  const qc = useQueryClient();
  // Je Klasse bzw. Kurs eine eigene Quiz-Sitzung (wie Challenge, TaskCrawler); die neueste ist vorgewählt
  const wahl = useWerkzeugSitzung("karten", true, { refId: satzId, vorwaehlen: true });
  const { sitzung, setze: setSitzung } = wahl;
  const [meldung, setMeldung] = useState("");
  const code = sitzung?.code;
  const { data: ueb } = useQuery({
    queryKey: ["karten", "quiz", code], queryFn: () => api.karten.quizUebersicht(code!), enabled: !!code, refetchInterval: 5000,
  });

  if (!sitzung) {
    return (
      <div className="flex flex-col gap-3 text-sm" aria-label="Kartenquiz">
        <h2 className="font-black text-base">🎮 Kartenquiz: {titel}</h2>
        <p className="text-muted">Für welche Klasse bzw. welchen Kurs läuft das Quiz? Jede bekommt einen eigenen Code.</p>
        <SitzungLeiste wahl={wahl} />
      </div>
    );
  }
  const e = { modus: "benennen", wortbank: false, max_punkte: 10, ueben: true, ...sitzung.settings } as Record<string, unknown>;
  const setze = async (aenderung: Record<string, unknown>) => {
    setSitzung(await api.toolSessions.einstellungen(sitzung.code, { ...sitzung.settings, ...aenderung }));
    qc.invalidateQueries({ queryKey: ["karten", "quiz", code] });
  };
  const vergeben = async () => {
    if (!window.confirm("Hauspunkte für dieses Quiz jetzt vergeben? Das geht je Runde nur einmal.")) return;
    try {
      const r = await api.karten.quizPunkte(sitzung.code);
      setMeldung(r.vergeben.map((z) => `${z.klasse}: ${z.punkte} P.`).join(" · ") || "Keine Klasse hat teilgenommen.");
      setSitzung(await api.toolSessions.get(sitzung.code));
    } catch (err) {
      setMeldung((err as Error).message);
    }
  };
  const neueRunde = async () => {
    if (!window.confirm("Alle Ergebnisse dieser Runde löschen und neu beginnen?")) return;
    await api.karten.quizZuruecksetzen(sitzung.code);
    setSitzung(await api.toolSessions.get(sitzung.code));
    qc.invalidateQueries({ queryKey: ["karten", "quiz", code] });
    setMeldung("Neue Runde gestartet.");
  };
  const vergebenAm = sitzung.settings?.punkte_vergeben as string | undefined;

  return (
    <section className="card p-4 flex flex-col gap-3 text-sm" aria-label="Kartenquiz">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-black text-base">🎮 Kartenquiz: {titel}{sitzung.scope_label && <span className="font-normal text-muted"> · {sitzung.scope_label}</span>}</h2>
        <ToolSessionBar tool="karten" title={`Kartenquiz: ${titel}${sitzung.scope_label ? ` (${sitzung.scope_label})` : ""}`}
          refId={satzId} sitzung={sitzung} wahl={wahl} quelle={kartenQuizQuelle(sitzung.code)} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {([["benennen", "Nummern benennen"], ["finden", "Orte finden (anklicken)"]] as const).map(([wert, text]) => (
          <label key={wert} className="flex items-center gap-1.5">
            <input type="radio" name="quizmodus" checked={e.modus === wert} onChange={() => setze({ modus: wert })} /> {text}
          </label>
        ))}
        {e.modus === "benennen" && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={!!e.wortbank} onChange={() => setze({ wortbank: !e.wortbank })} /> Wortbank
          </label>
        )}
        <label className="flex items-center gap-1.5" title="Lernhelfer: übt einzeln, was noch nicht sitzt — zählt nicht für Punkte">
          <input type="checkbox" checked={!!e.ueben} onChange={() => setze({ ueben: !e.ueben })} /> 🎯 Üben erlauben
        </label>
        <label className="flex items-center gap-1.5">
          Hauspunkte bis
          <input type="number" min={0} max={100} value={Number(e.max_punkte)} onChange={(ev) => setze({ max_punkte: Number(ev.target.value) })}
            className="w-16 px-2 py-1 rounded-lg border border-line bg-page" />
        </label>
      </div>

      {ueb && (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
          <SitzungDashboard code={code} quelle={kartenQuizQuelle(sitzung.code)} leer="Noch niemand dabei." />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Am schwersten</span>
            {[...ueb.je_aufgabe].filter((a) => a.versucht).sort((x, y) => x.richtig / x.versucht - y.richtig / y.versucht).slice(0, 5).map((a) => (
              <span key={a.nr}>{a.marke && <b className="text-bad">{a.marke}</b>} {a.name}: {Math.round((100 * a.richtig) / a.versucht)} % richtig</span>
            ))}
            {ueb.je_aufgabe.some((a) => a.sicherheit != null) && (
              <>
                <span className="text-xs text-muted pt-2">Noch unsicher (Lernstand aus Quiz und Üben)</span>
                {[...ueb.je_aufgabe].filter((a) => a.sicherheit != null && a.sicherheit < 0.5)
                  .sort((x, y) => (x.sicherheit ?? 0) - (y.sicherheit ?? 0)).slice(0, 5).map((a) => (
                    <span key={`s${a.nr}`}>{a.name}: Sicherheit {Math.round(100 * (a.sicherheit ?? 0))} %</span>
                  ))}
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
        {ueb?.punkte.length ? <span>Vorschau: {ueb.punkte.map((z) => `${z.klasse} ${z.punkte} P.`).join(" · ")}</span> : null}
        <button onClick={vergeben} disabled={!!vergebenAm}
          className="px-3 py-1.5 rounded-lg font-bold border border-line hover:bg-surface-hover disabled:opacity-40">
          🏠 Hauspunkte vergeben
        </button>
        <button onClick={neueRunde} className="px-3 py-1.5 rounded-lg border border-line hover:bg-surface-hover">↻ Neue Runde</button>
        {vergebenAm && <span className="text-xs text-muted">vergeben am {new Date(vergebenAm).toLocaleString("de-DE")}</span>}
        {meldung && <span className="text-xs">{meldung}</span>}
      </div>
    </section>
  );
}
