"use client";
/**
 * Lehrkraft: einen gespeicherten Challenge-Satz teilen (Code/QR), Startstufe wählen,
 * live mitverfolgen, Hauspunkte vergeben, CSV holen, neue Runde.
 * Je Klasse bzw. Kurs/WPF/A-B-Gruppe eine eigene Sitzung mit eigenem Code (wie Caputh, TaskCrawler).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ChallengeKalibrierungWerte } from "@/lib/api";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import SitzungDashboard from "@/components/sitzung/SitzungDashboard";
import { SitzungLeiste, useWerkzeugSitzung } from "@/components/SitzungWahl";
import { challengeQuelle } from "@/lib/challenge/sitzung";
import { SPIELARTEN } from "@/lib/challenge/spielarten";
import { THEMES } from "@/lib/challenge/themes";

const SKINS = [["monster", "Monster"], ["rap", "Rapper"], ["prinzessin", "Prinzessin"], ["einhorn", "Einhorn"]];

function KlassenSelect({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const { data: klassen = [] } = useQuery({ queryKey: ["classes"], queryFn: () => api.classes.list() });
  return (
    <select className="input w-48" aria-label="Klasse" value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Klasse wählen…</option>
      {klassen.map((k) => <option key={k.id} value={k.id}>{k.display_name}</option>)}
    </select>
  );
}

function Startstufen({ code }: { code: string }) {
  const [klasse, setKlasse] = useState<number | null>(null);
  const qc = useQueryClient();
  const key = ["challenge", "schueler", code, klasse];
  const { data: schueler = [] } = useQuery({ queryKey: key, queryFn: () => api.challenge.schueler(code, klasse!), enabled: klasse != null });
  const setze = async (id: number, wert: string) => {
    await api.challenge.stufen(code, { [id]: wert ? Number(wert) : null });
    qc.invalidateQueries({ queryKey: key });
  };
  return (
    <details className="card p-3">
      <summary className="cursor-pointer font-bold">Startstufen je Schüler·in</summary>
      <div className="flex flex-col gap-2 mt-2">
        <KlassenSelect value={klasse} onChange={setKlasse} />
        {schueler.length > 0 && (
          <table className="w-full max-w-md">
            <tbody>
              {schueler.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td>{s.name}</td>
                  <td>
                    <select className="input w-24" aria-label={`Startstufe ${s.name}`} value={s.startstufe ?? ""} onChange={(e) => setze(s.id, e.target.value)}>
                      <option value="">–</option>
                      {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-muted">– = Standard der Sitzung. Gilt beim nächsten Start der Person.</p>
      </div>
    </details>
  );
}

function Kalibrierung() {
  const [klasse, setKlasse] = useState<number | null>(null);
  const qc = useQueryClient();
  const key = ["challenge", "kalibrierung", klasse];
  const { data } = useQuery({ queryKey: key, queryFn: () => api.challenge.kalibrierung(klasse!), enabled: klasse != null });
  const neu = () => qc.invalidateQueries({ queryKey: key });
  const uebernehmen = async (w: ChallengeKalibrierungWerte) => { await api.challenge.kalibrierungSetzen(klasse!, w); neu(); };
  const zeile = (w: ChallengeKalibrierungWerte) =>
    `${[1, 2, 3, 4].map((n) => `Stufe ${n}: ${w.lese_wpm[String(n)] ?? "–"} W/min`).join(" · ")} · Antwortzeit schnell ${w.antwortzeit.schnell} s, langsam ${w.antwortzeit.langsam} s`;
  return (
    <details className="card p-3">
      <summary className="cursor-pointer font-bold">Kalibrierung der Anpassung</summary>
      <div className="flex flex-col gap-2 mt-2">
        <KlassenSelect value={klasse} onChange={setKlasse} />
        {data && (
          <>
            <p>Aktuell: {zeile(data.aktuell)}</p>
            <p>Vorschlag: {zeile(data.vorschlag)}</p>
            <p className="text-xs text-muted">
              Stichprobe: {[1, 2, 3, 4].map((n) => `Stufe ${n}: ${data.stichprobe[String(n)] ?? 0}`).join(" · ")}
              {!data.genug && " – noch zu wenig Daten für einen Vorschlag"}
            </p>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={!data.genug} onClick={() => uebernehmen(data.vorschlag)}>Vorschlag übernehmen</button>
              <button className="btn-secondary" onClick={async () => { await api.challenge.kalibrierungLoeschen(klasse!); neu(); }}>Zurücksetzen</button>
            </div>
          </>
        )}
        <p className="text-xs text-muted">Nur Summen der Klasse, keine Einzelprofile.</p>
      </div>
    </details>
  );
}

export default function ChallengeLehrkraft({ satzId, titel }: { satzId: number; titel: string }) {
  const qc = useQueryClient();
  const wahl = useWerkzeugSitzung("challenge", true, { refId: satzId, vorwaehlen: true });
  const { sitzung, setze: setSitzung } = wahl;
  const [meldung, setMeldung] = useState("");
  const code = sitzung?.code;
  const { data: ueb } = useQuery({
    queryKey: ["challenge", "uebersicht", code], queryFn: () => api.challenge.uebersicht(code!), enabled: !!code, refetchInterval: 5000,
  });

  if (!sitzung) {
    return (
      <div className="flex flex-col gap-3 text-sm" aria-label="Challenge-Sitzung">
        <h2 className="font-black text-base">⚔️ Challenge: {titel}</h2>
        <p className="text-muted">Für welche Klasse bzw. welchen Kurs läuft die Challenge? Jede bekommt einen eigenen Code.</p>
        <SitzungLeiste wahl={wahl} />
      </div>
    );
  }
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
  const speichere = async (patch: Record<string, unknown>) => {
    setSitzung(await api.toolSessions.einstellungen(sitzung.code, { ...sitzung.settings, ...patch }));
  };
  const spiele = (sitzung.settings?.spiele as string[] | undefined) ?? ["normal"];
  const schalte = (id: string) => {
    const neu = spiele.includes(id) ? spiele.filter((x) => x !== id) : [...spiele, id];
    if (neu.length) speichere({ spiele: neu });
  };
  const stufeAendern = async (standId: number, stufe: number) => {
    await api.challenge.standStufe(sitzung.code, standId, stufe);
    qc.invalidateQueries({ queryKey: ["challenge", "uebersicht", code] });
    qc.invalidateQueries({ queryKey: ["sitzung-quelle", "challenge", code] });
  };

  return (
    <section className="card p-4 flex flex-col gap-3 text-sm" aria-label="Challenge-Sitzung">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-black text-base">⚔️ Challenge: {titel}{sitzung.scope_label && <span className="font-normal text-muted"> · {sitzung.scope_label}</span>}</h2>
        <ToolSessionBar tool="challenge" title={`Challenge: ${titel}${sitzung.scope_label ? ` (${sitzung.scope_label})` : ""}`} refId={satzId} sitzung={sitzung} wahl={wahl} quelle={challengeQuelle(sitzung.code)} />
      </div>
      <label className="flex items-center gap-1.5">
        Startstufe
        <select className="input w-20" value={startstufe} onChange={(e) => setzeStufe(Number(e.target.value))}>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-xs text-muted">(die Stufe passt sich danach je Spieler an)</span>
      </label>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Spielarten">
        Spielarten
        {SPIELARTEN.map((s) => (
          <button key={s.id} type="button" title={s.text} aria-pressed={spiele.includes(s.id)} onClick={() => schalte(s.id)}
            className={`chip ${spiele.includes(s.id) ? "chip-on" : ""}`}>{s.icon} {s.name}</button>
        ))}
      </div>
      {spiele.includes("gericht") && <p className="text-xs text-muted">Gerichtssaal braucht Behauptungen (claims) im Satz; ohne sie ist er nicht wählbar.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">Theme
          <select className="input w-40" value={String(sitzung.settings?.theme ?? "klassisch")} onChange={(e) => speichere({ theme: e.target.value })}>
            {Object.entries(THEMES).map(([id, t]) => <option key={id} value={id}>{t.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">Boss-Aussehen
          <select className="input w-40" value={String(sitzung.settings?.skin ?? "monster")} onChange={(e) => speichere({ skin: e.target.value })}>
            {SKINS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={sitzung.settings?.etappen_mischen === true} onChange={(e) => speichere({ etappen_mischen: e.target.checked })} />
        Etappen in zufälliger Reihenfolge
      </label>
      <Startstufen code={sitzung.code} />
      <Kalibrierung />

      <SitzungDashboard code={code} quelle={challengeQuelle(sitzung.code)} leer="Noch niemand dabei." detailLabel="Stufe"
        detail={z => typeof z.daten.stand === "number" && (
          <label className="flex items-center gap-1.5 text-xs">
            Stufe {String(z.daten.stufe_start)}→ ändern auf
            <select className="input w-14" aria-label={`Stufe ${z.name}`} value={Number(z.daten.stufe)}
              onChange={(e) => stufeAendern(z.daten.stand as number, Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )} />

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
