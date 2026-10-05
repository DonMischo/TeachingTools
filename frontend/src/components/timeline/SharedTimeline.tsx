"use client";
/**
 * Eine per Code geteilte Zeitleiste — die Ansicht hinter einem Zeitstrahl-QR.
 *
 * Der Inhalt kommt bewusst nicht von `/api/timelines/{id}`: wer den QR scannt,
 * hat kein Konto. Der Sitzungscode gibt genau die eine Zeitleiste frei, die die
 * Lehrkraft geteilt hat — mehr nicht.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TimelineSetDetail } from "@/components/timeline/types";
import { TimelineCanvas } from "@/components/timeline/TimelineCanvas";

export function SharedTimeline({ code, guestToken }: { code: string; guestToken?: string | null }) {
  const [set, setSet] = useState<TimelineSetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.toolSessions.content(code, guestToken)
      .then(s => { if (alive) setSet(s); })
      .catch(() => { if (alive) setError("Diese Zeitleiste lässt sich gerade nicht öffnen."); });
    return () => { alive = false; };
  }, [code, guestToken]);

  if (error) return <p className="p-6 text-sm text-muted">{error}</p>;
  if (!set) return <p className="p-6 text-sm text-muted animate-pulse">Zeitleiste wird geladen …</p>;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-black tracking-tight">📏 {set.title}</h1>
        {set.description && (
          <p className="text-sm text-muted mt-1">{set.description}</p>
        )}
      </div>
      <TimelineCanvas axis={set.axis} lanes={set.lanes} events={set.events} />
    </div>
  );
}
