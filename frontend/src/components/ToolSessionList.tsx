"use client";
/**
 * Sitzungen eines Werkzeugs aus der gemeinsamen Tabelle (Abakus, Tippen,
 * Markieren, Challenge …) — als `SitzungListe`.
 *
 * Ohne `wahl`: alle laufenden Sitzungen ansehen, eigene schließen; Admins sehen
 * auch fremde, dann steht die Lehrkraft dabei.
 * Mit `wahl` (Sitzung je Klasse): die eigenen Sitzungen wählen und für eine
 * weitere Klasse starten.
 *
 * Schließen nimmt Gäste heraus, lässt den Code aber stehen — ein gedruckter QR
 * funktioniert nach dem Wiederöffnen weiter.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api, type PlaySessionRow } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { SitzungListe, SitzungAktion, type SitzungEintrag } from "@/components/sitzung/SitzungListe";
import type { SitzungWahl } from "@/components/SitzungWahl";

export function ToolSessionList({ slug, wahl, titel, text }: {
  slug: string;
  wahl?: SitzungWahl;
  titel?: ReactNode;
  text?: ReactNode;
}) {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["tool-sessions-list", slug];

  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";

  const { data: alle = [], isLoading } = useQuery<PlaySessionRow[]>({
    queryKey: key,
    queryFn: () => api.play.sessions("simulation", slug),
    // Mit `wahl` kommt die Liste aus useWerkzeugSitzung (derselbe Schlüssel).
    enabled: isTeacher && !wahl,
  });

  const toggleMut = useMutation({
    mutationFn: (s: PlaySessionRow) =>
      s.closed ? api.play.reopen("simulation", s.code) : api.play.close("simulation", s.code),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  if (!isTeacher && !wahl) return null;

  const sessions = wahl ? wahl.meine : alle;
  const gewaehlt = wahl?.sitzung?.code;

  return (
    <SitzungListe
      titel={titel ?? (wahl ? "Deine Sitzungen" : "Laufende Sitzungen")}
      text={text}
      laedt={wahl ? wahl.laedt : isLoading}
      leer={wahl ? "Noch keine Sitzung — starte oben eine." : "Für dieses Werkzeug läuft gerade keine Sitzung."}
      neu={wahl && { onStart: wahl.neu, ohneKlasse: true }}
      eintraege={sessions.map((s): SitzungEintrag => ({
        code: s.code,
        status: s.closed ? { label: "geschlossen", ton: "aus" } : { label: "offen", ton: "live" },
        klasse: s.scope_label ?? (wahl ? "ohne Klasse" : null),
        info: [
          ...(s.ref_title && !wahl ? [s.ref_title] : []),
          ...(s.mine ? [] : [s.owner ?? "fremde Sitzung"]),
          ...(s.created_at ? [new Date(s.created_at).toLocaleDateString("de-DE")] : []),
        ],
        gewaehlt: s.code === gewaehlt,
        aktionen: (
          <>
            {wahl
              ? s.code !== gewaehlt && <SitzungAktion art="haupt" onClick={() => wahl.waehle(s.code)}>Wählen</SitzungAktion>
              : <SitzungAktion art="haupt" href={s.join_url}>Ansehen</SitzungAktion>}
            {s.mine && (
              <SitzungAktion
                disabled={toggleMut.isPending}
                onClick={() => toggleMut.mutate(s)}
                title={s.closed ? "Wieder öffnen — der Code bleibt derselbe" : "Schließen — der Code bleibt gültig"}
              >
                {s.closed ? "Wieder öffnen" : "Schließen"}
              </SitzungAktion>
            )}
          </>
        ),
      }))}
    />
  );
}
