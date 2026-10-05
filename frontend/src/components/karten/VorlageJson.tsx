"use client";
/**
 * JSON-Vorlage des Kartensatzes: alle Kandidaten der gewählten Ebenen mit »aktiv«.
 * Gedacht zum Filtern (auch mit einem Sprachmodell: »setze aktiv auf true für alle
 * Hauptstädte der EU«) und Wieder-Hochladen. Geprüft wird auf dem Server.
 */
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Ebene } from "@/lib/karten/stil";
import type { Ausschnitt, SatzInhalt } from "@/lib/karten/satz";

export default function VorlageJson({ titel, inhalt, ausschnitt, ebenen, onImport }: {
  titel: string;
  inhalt: SatzInhalt;
  ausschnitt: () => Ausschnitt | null;
  /** Quiz-Ebenen, die gerade eingeschaltet sind */
  ebenen: Ebene[];
  onImport: (titel: string, inhalt: SatzInhalt) => void;
}) {
  const [wahl, setWahl] = useState<string[]>([]);
  const [nurAusschnitt, setNurAusschnitt] = useState(true);
  const [meldung, setMeldung] = useState("");
  const datei = useRef<HTMLInputElement>(null);
  const gewaehlt = wahl.length ? wahl : ebenen.filter((e) => inhalt.auswahl[e.id]?.objekte.length).map((e) => e.id);

  const exportieren = async () => {
    if (!gewaehlt.length) { setMeldung("Bitte mindestens eine Ebene wählen."); return; }
    try {
      const vorlage = await api.karten.vorlageExport({
        titel: titel || "Kartensatz", ebenen: gewaehlt, nur_ausschnitt: nurAusschnitt,
        inhalt: { ...inhalt, ausschnitt: ausschnitt() ?? inhalt.ausschnitt },
      });
      const url = URL.createObjectURL(new Blob([JSON.stringify(vorlage, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(titel || "kartensatz").replace(/[^\p{L}\p{N}_-]+/gu, "_")}.karten.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMeldung("");
    } catch (e) {
      setMeldung(`Export ging nicht: ${(e as Error).message}`);
    }
  };

  const importieren = async (f: File) => {
    try {
      const geladen = await api.karten.vorlageImport(JSON.parse(await f.text()));
      onImport(geladen.titel, geladen.inhalt);
      setMeldung(`»${geladen.titel}« geladen — zum Behalten speichern.`);
    } catch (e) {
      const text = (e as Error).message;
      setMeldung(text.startsWith("{") ? `Datei passt nicht: ${text}` : `Datei passt nicht: ${text || "kein gültiges JSON"}`);
    } finally {
      if (datei.current) datei.current.value = "";
    }
  };

  return (
    <details className="text-sm">
      <summary className="cursor-pointer px-3 py-1.5 rounded-lg font-bold border border-line hover:bg-surface-hover inline-block">
        {"{ }"} JSON
      </summary>
      <div className="mt-2 flex flex-col gap-2 p-3 rounded-xl border border-line bg-page max-w-md">
        <p className="text-xs text-muted">
          Vorlage mit allen Kandidaten und »aktiv« je Objekt — z. B. einem Sprachmodell geben, filtern lassen, wieder laden.
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {ebenen.map((e) => (
            <label key={e.id} className="flex items-center gap-1">
              <input type="checkbox" checked={gewaehlt.includes(e.id)}
                onChange={() => setWahl(gewaehlt.includes(e.id) ? gewaehlt.filter((x) => x !== e.id) : [...gewaehlt, e.id])} />
              {e.name}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={nurAusschnitt} onChange={() => setNurAusschnitt((n) => !n)} />
          nur Objekte im sichtbaren Ausschnitt
        </label>
        <div className="flex gap-2">
          <button onClick={exportieren} className="px-2 py-1 rounded-lg text-xs font-bold border border-line hover:bg-surface-hover">
            ⬇️ Vorlage herunterladen
          </button>
          <button onClick={() => datei.current?.click()} className="px-2 py-1 rounded-lg text-xs font-bold border border-line hover:bg-surface-hover">
            ⬆️ JSON laden
          </button>
          <input ref={datei} type="file" accept=".json,application/json" className="hidden" aria-label="JSON-Vorlage laden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importieren(f); }} />
        </div>
        {meldung && <p className="text-xs">{meldung}</p>}
      </div>
    </details>
  );
}
