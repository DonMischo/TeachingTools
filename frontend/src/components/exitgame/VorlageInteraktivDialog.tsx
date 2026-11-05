"use client";
/**
 * Vor dem Herunterladen der interaktiven Vorlage: Für welche Fächer? Der
 * Katalog `_katalog['task.sim']` listet dann nur deren Werkzeuge. Mit jeder
 * neuen Simulation wird er sonst länger, und kostenlose KI-Modelle brechen
 * lange Antworten ab.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { alleFaecher, faecherFuer, passtZumFach } from "@/lib/faecher";
import { FachFilter } from "@/components/Faecher";
import { SIM_STATIONEN } from "@/components/exitgame/SimStation";

const WERKZEUGE = Object.keys(SIM_STATIONEN);

export function VorlageInteraktivDialog({ onClose, onDownload }: {
  onClose: () => void;
  /** Ohne Liste: alle Werkzeuge. */
  onDownload: (werkzeuge?: string[]) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const { data } = useQuery({ queryKey: ["tool-faecher"], queryFn: api.school.toolFaecher, staleTime: 60_000 });
  const vonHand = data?.faecher;
  const faecher = alleFaecher(WERKZEUGE.map(w => faecherFuer(w, vonHand)));
  const passend = WERKZEUGE.filter(w => passtZumFach(faecherFuer(w, vonHand), gewaehlt));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-60" onClick={onClose} />
      <div role="dialog" aria-label="Interaktive Vorlage"
        className="card fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-lg max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto shadow-2xl p-5 flex flex-col gap-3 z-70">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">🏰 Vorlage interaktiv</h3>
          <button onClick={onClose} aria-label="Schließen" className="text-muted hover:text-fg text-lg leading-none">×</button>
        </div>
        <p className="text-xs text-muted">
          Für welche Fächer ist dein TaskCrawler? Die Vorlage listet dann nur deren Werkzeuge. So bleibt sie kurz,
          und auch kostenlose KI-Modelle schaffen die Antwort.
        </p>
        <FachFilter faecher={faecher} gewaehlt={gewaehlt} setzen={setGewaehlt} />
        <p className="text-xs text-muted">
          {gewaehlt.length === 0 ? `Alle ${WERKZEUGE.length} Werkzeuge` : `${passend.length} von ${WERKZEUGE.length} Werkzeugen`}
          {gewaehlt.length > 0 && passend.length > 0 && `: ${passend.map(w => SIM_STATIONEN[w].name).join(", ")}`}
        </p>
        <p className="text-xs text-muted">
          Tipp: Bricht die Antwort der KI ab, lass sie erst einen Plan schreiben und dann Abschnitt für Abschnitt.
        </p>
        <button onClick={() => onDownload(gewaehlt.length ? passend : undefined)} className="btn-primary text-sm py-1.5 px-4 self-start">
          ⬇ Herunterladen
        </button>
      </div>
    </>
  );
}
