"use client";
/**
 * Eine per Code geteilte Zeitleiste — die Ansicht hinter einem Zeitstrahl-QR.
 *
 * Der Inhalt kommt bewusst nicht von `/api/timelines/{id}`: wer den QR scannt,
 * hat kein Konto. Der Sitzungscode gibt genau die eine Zeitleiste frei, die die
 * Lehrkraft geteilt hat — mehr nicht.
 *
 * »Üben« meldet jede geprüfte Runde als Sitzungsstand (lib/zeitstrahl/sitzung.ts),
 * sofern `zugang` gesetzt ist; der Stand liegt zusätzlich im Browser, damit ein
 * Neuladen die Zähler nicht auf null setzt.
 */
import { useEffect, useState } from "react";
import { api, type MausZugang } from "@/lib/api";
import type { TimelineSetDetail } from "@/components/timeline/types";
import { TimelineCanvas } from "@/components/timeline/TimelineCanvas";
import { PracticeTab, type RundenErgebnis } from "@/components/timeline/ZeitstrahlUeben";
import { useMeinStand } from "@/hooks/useMeinStand";
import { LEER, rundeEintragen, type ZeitstrahlStand } from "@/lib/zeitstrahl/sitzung";

const speicherName = (schluessel: string) => `hp_zeitstrahl_stand_${schluessel}`;

function geladen(schluessel: string | undefined): ZeitstrahlStand {
  if (!schluessel) return LEER;
  try {
    const roh = localStorage.getItem(speicherName(schluessel));
    return roh ? { ...LEER, ...JSON.parse(roh) } : LEER;
  } catch {
    return LEER;
  }
}

export function SharedTimeline({ code, guestToken, zugang, speicherSchluessel }: {
  code: string;
  guestToken?: string | null;
  /** Nur für Lernende und Gäste: dann landen die Übungsrunden im Dashboard. */
  zugang?: MausZugang;
  /** Je Person, damit sich zwei am selben Gerät nicht den Stand teilen. */
  speicherSchluessel?: string;
}) {
  const [set, setSet] = useState<TimelineSetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"ansehen" | "ueben">("ansehen");
  const [stand, setStand] = useState<ZeitstrahlStand>(() => geladen(speicherSchluessel));

  useMeinStand(zugang, stand.runden > 0 ? { ...stand } : null);

  useEffect(() => {
    let alive = true;
    api.toolSessions.content(code, guestToken)
      .then(s => { if (alive) setSet(s); })
      .catch(() => { if (alive) setError("Diese Zeitleiste lässt sich gerade nicht öffnen."); });
    return () => { alive = false; };
  }, [code, guestToken]);

  // Gespeichert wird beim Eintragen, nicht per Effekt (StrictMode-Falle).
  function runde(r: RundenErgebnis) {
    setStand(alt => {
      const neu = rundeEintragen(alt, r.results);
      if (speicherSchluessel) {
        try { localStorage.setItem(speicherName(speicherSchluessel), JSON.stringify(neu)); } catch { /* privat */ }
      }
      return neu;
    });
  }

  if (error) return <p className="p-6 text-sm text-muted">{error}</p>;
  if (!set) return <p className="p-6 text-sm text-muted animate-pulse">Zeitleiste wird geladen …</p>;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black tracking-tight">📏 {set.title}</h1>
          {set.description && (
            <p className="text-sm text-muted mt-1">{set.description}</p>
          )}
        </div>
        <div className="flex gap-1 rounded-xl border border-line p-1">
          {(["ansehen", "ueben"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                tab === t ? "bg-accent text-white font-semibold" : "hover:bg-surface-hover"
              }`}>
              {t === "ansehen" ? "🔍 Ansehen" : "🎯 Üben"}
            </button>
          ))}
        </div>
      </div>
      {tab === "ansehen"
        ? <TimelineCanvas axis={set.axis} lanes={set.lanes} events={set.events} />
        : (
          <>
            <PracticeTab set={set} visibleEvents={set.events} isTeacher={false} onRunde={runde} />
            {stand.runden > 0 && (
              <p className="text-xs text-muted">
                {stand.runden} {stand.runden === 1 ? "Runde" : "Runden"} · {stand.richtig} von {stand.gesamt} richtig
              </p>
            )}
          </>
        )}
    </div>
  );
}
