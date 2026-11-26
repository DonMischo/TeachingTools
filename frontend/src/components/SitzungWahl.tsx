"use client";
/**
 * Sitzung je Klasse für Werkzeuge mit Lehrer-Übersicht (wie bei »Markieren &
 * Bearbeiten«): Beim Öffnen wählt die Lehrkraft zuerst die Klasse bzw. den
 * Kurs oder setzt eine eigene Sitzung fort; jede Klasse bekommt einen eigenen
 * Code, eigenen QR und eine eigene Übersicht.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ToolSessionOut } from "@/lib/api";
import { scopeBody, type Scope } from "@/components/ScopeSelect";
import { ToolSessionList } from "@/components/ToolSessionList";

/**
 * Die gewählte Sitzung der Lehrkraft für ein Werkzeug, je Klasse bzw. Kurs eine.
 *
 * - `refId`: Werkzeuge mit Inhalt (Challenge-Satz, Kartensatz) — je Inhalt eigene Sitzungen.
 * - `vorwaehlen`: die neueste eigene Sitzung gleich wählen, statt zuerst den Startbildschirm zu zeigen.
 */
export function useWerkzeugSitzung(werkzeug: string, aktiv: boolean,
  { refId, vorwaehlen = false }: { refId?: number; vorwaehlen?: boolean } = {}) {
  const qc = useQueryClient();
  const liste = useMemo(() => ["tool-sessions-list", werkzeug], [werkzeug]);
  const [sitzung, setze] = useState<ToolSessionOut | null>(null);
  const [fehler, setFehler] = useState("");
  const { data: alle, isLoading } = useQuery({
    queryKey: liste, queryFn: () => api.play.sessions("simulation", werkzeug), enabled: aktiv,
  });
  const meine = useMemo(
    () => (alle ?? []).filter(z => z.mine && (refId === undefined || z.ref_id === refId)),
    [alle, refId],
  );

  async function waehle(code: string) {
    try { setze(await api.toolSessions.get(code)); setFehler(""); } catch { setFehler("Die Sitzung ließ sich nicht laden."); }
  }
  async function neu(scope: Scope) {
    try {
      setze(await api.toolSessions.create(werkzeug, refId, scopeBody(scope)));
      setFehler("");
      qc.invalidateQueries({ queryKey: liste });
    } catch (e) { setFehler((e as Error).message || "Die Sitzung ließ sich nicht anlegen."); }
  }

  // Anderer Inhalt, andere Sitzungen
  useEffect(() => { setze(null); }, [refId]);
  const ersteCode = vorwaehlen ? meine[0]?.code : undefined;
  useEffect(() => {
    if (!sitzung && ersteCode) waehle(ersteCode);
    // waehle ist je Render neu, hängt aber nur an ersteCode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ersteCode, sitzung]);

  return { werkzeug, sitzung, setze, meine, waehle, neu, fehler, laedt: aktiv && isLoading };
}

export type SitzungWahl = ReturnType<typeof useWerkzeugSitzung>;

/** Startbildschirm der Lehrkraft: für welche Klasse läuft die Stunde? */
export function SitzungStart({ wahl, titel, text }: { wahl: SitzungWahl; titel: ReactNode; text?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 max-w-3xl mx-auto w-full" aria-label="Sitzung wählen">
      <h1 className="text-2xl font-black">{titel}</h1>
      <p className="text-sm text-muted">
        {text ?? "Für welche Klasse bzw. welchen Kurs läuft es? Jede bekommt einen eigenen Code und eine eigene Übersicht."}
      </p>
      <ToolSessionList slug={wahl.werkzeug} wahl={wahl} titel="Oder fortsetzen" />
      {wahl.fehler && <p className="text-sm text-bad">{wahl.fehler}</p>}
    </div>
  );
}

/** Kopf der Übersicht: Sitzung wechseln oder für eine weitere Klasse starten. */
export function SitzungLeiste({ wahl }: { wahl: SitzungWahl }) {
  return (
    <>
      <ToolSessionList slug={wahl.werkzeug} wahl={wahl}
        text="Jede Klasse bzw. jeder Kurs bekommt einen eigenen Code. Den QR zur gewählten Sitzung zeigt »Zum Mitmachen« oben." />
      {wahl.fehler && <p className="text-sm text-bad">{wahl.fehler}</p>}
    </>
  );
}
