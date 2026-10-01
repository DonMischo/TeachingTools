"use client";
/**
 * Seitenleiste: eigene Ebenen der Lehrkräfte — hochladen (GeoJSON, KML, KMZ,
 * GPX), ein- und ausblenden, Namensfeld wählen, fürs Kollegium teilen, löschen.
 * Die Grundebenen bleiben davon unberührt (Server legt sie getrennt ab).
 */
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Ebene } from "@/lib/karten/stil";

export default function EigeneEbenen({ ebenen, an, schalte, lehrkraft }: {
  ebenen: Ebene[];
  an: string[];
  schalte: (id: string) => void;
  lehrkraft: boolean;
}) {
  const qc = useQueryClient();
  const datei = useRef<HTMLInputElement>(null);
  const [titel, setTitel] = useState("");
  const [meldung, setMeldung] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const neuLaden = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["karten", "katalog"] });
    if (id) qc.invalidateQueries({ queryKey: ["karten", "ebene", id] });
  };

  const hochladen = async () => {
    const f = datei.current?.files?.[0];
    if (!f) { setMeldung("Bitte eine Datei wählen."); return; }
    setLaeuft(true);
    setMeldung("");
    try {
      const neu = await api.karten.eigeneHochladen(f, titel);
      setTitel("");
      if (datei.current) datei.current.value = "";
      neuLaden();
      if (!an.includes(neu.id)) schalte(neu.id);
      setMeldung(`»${neu.name}« mit ${neu.anzahl} Objekten geladen.`);
    } catch (e) {
      setMeldung((e as Error).message.replace(/^\{"detail":"(.*)"\}$/, "$1"));
    } finally {
      setLaeuft(false);
    }
  };

  const aendern = async (e: Ebene, aenderung: { titel?: string; geteilt?: boolean; namensfeld?: string }) => {
    const alt = e.eigen!;
    await api.karten.eigeneAendern(alt.id, { titel: e.name, geteilt: alt.geteilt, namensfeld: alt.namensfeld, ...aenderung });
    neuLaden(e.id);
  };
  const loeschen = async (e: Ebene) => {
    if (!window.confirm(`Ebene »${e.name}« löschen? Kartensätze, die sie nutzen, verlieren diese Ebene.`)) return;
    if (an.includes(e.id)) schalte(e.id);
    await api.karten.eigeneLoeschen(e.eigen!.id);
    neuLaden();
  };

  if (!ebenen.length && !lehrkraft) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Eigene Ebenen</h3>
      {ebenen.map((e) => (
        <div key={e.id} className="flex flex-col gap-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={an.includes(e.id)} onChange={() => schalte(e.id)} />
            <span className="flex-1 truncate" title={`${e.eigen?.dateiname} · ${e.anzahl} Objekte`}>{e.name}</span>
            {e.eigen?.geteilt && <span title="für Kollegium sichtbar">👥</span>}
            {e.eigen?.eigen && (
              <button aria-label={`${e.name} löschen`} onClick={() => loeschen(e)} className="px-1">🗑</button>
            )}
          </label>
          {e.eigen?.eigen && an.includes(e.id) && (
            <div className="ml-6 flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                Name aus
                <select value={e.eigen.namensfeld} onChange={(ev) => aendern(e, { namensfeld: ev.target.value })}
                  className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)]">
                  <option value="">— durchnummeriert —</option>
                  {e.eigen.felder.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={e.eigen.geteilt} onChange={() => aendern(e, { geteilt: !e.eigen!.geteilt })} /> Kollegium
              </label>
            </div>
          )}
        </div>
      ))}

      {lehrkraft && (
        <div className="flex flex-col gap-1.5 mt-1 p-2 rounded-lg border border-dashed border-[var(--border)]">
          <input ref={datei} type="file" accept=".geojson,.json,.kml,.kmz,.gpx" aria-label="Datei für eigene Ebene"
            className="text-xs" />
          <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Name der Ebene (optional)"
            className="px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs" />
          <button onClick={hochladen} disabled={laeuft}
            className="self-start px-2 py-1 rounded-lg text-xs font-bold border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-40">
            {laeuft ? "⏳ lädt …" : "⬆️ Hochladen"}
          </button>
          <p className="text-[10px] text-[var(--text-muted)]">GeoJSON, KML/KMZ (z. B. Google My Maps) oder GPX; höchstens 5 MB, Koordinaten in WGS84.</p>
          {meldung && <p className="text-xs">{meldung}</p>}
        </div>
      )}
    </div>
  );
}
