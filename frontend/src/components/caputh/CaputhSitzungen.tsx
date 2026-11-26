"use client";
/**
 * Sitzungen eines Caputh-Quiz als `SitzungListe` — in der Bibliothek je Quiz
 * und auf der Startseite des Quiz (dort mit »▶ Neue Sitzung«).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ClassOut, type ClassPoints } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { SitzungListe, SitzungAktion, type SitzungEintrag, type SitzungNeuProps } from "@/components/sitzung/SitzungListe";

type SessionRow = {
  join_code: string;
  status: string;
  class_id: number | null;
  group_id: number | null;
  /** »9a« bzw. »9 NaT« — bei einem Kurs/WPF steckt keine Klasse dahinter. */
  scope_label: string;
  participant_count: number;
  points_awarded: number | null;
  /** Je Klasse eine Zeile — bei einer klassenübergreifenden Runde mehrere. */
  points_by_class: ClassPoints[];
  started_at: string | null;
  finished_at: string | null;
};

export function CaputhSitzungen({ quizId, neu }: { quizId: number; neu?: SitzungNeuProps }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["caputh-sessions", quizId];

  const { data: sessions = [], isLoading } = useQuery<SessionRow[]>({
    queryKey: key,
    queryFn: () => api.capuths.listSessions(quizId),
  });
  const { data: classes = [] } = useQuery<ClassOut[]>({
    queryKey: ["classes"], queryFn: api.classes.list, staleTime: 60_000,
  });

  const fertig = { onSuccess: () => qc.invalidateQueries({ queryKey: key }), onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error") };
  const deleteMut = useMutation({ mutationFn: (code: string) => api.capuths.deleteSession(code), ...fertig });
  const clearMut = useMutation({ mutationFn: () => api.capuths.clearSessions(quizId), ...fertig });
  const resetMut = useMutation({ mutationFn: (code: string) => api.capuths.resetSession(code), ...fertig });

  return (
    <SitzungListe
      laedt={isLoading}
      neu={neu}
      kopf={sessions.length > 0 && (
        <SitzungAktion art="gefahr" disabled={clearMut.isPending}
          onClick={() => { if (confirm("Alle Sitzungen löschen? Bereits vergebene Punkte bleiben erhalten.")) clearMut.mutate(); }}>
          Alle löschen
        </SitzungAktion>
      )}
      eintraege={sessions.map((s): SitzungEintrag => {
        const cls = s.class_id != null ? classes.find(c => c.id === s.class_id) : undefined;
        const scored = s.points_awarded !== null;
        // Bei mehreren Klassen sagt die Summe wenig — dann steht hier, was
        // jede einzelne bekommen hat.
        const points = s.points_by_class.length > 1
          ? s.points_by_class.map(c => `${c.class_code}: ${c.points} Pkt.`)
          : scored ? [`${s.points_awarded} Pkt.`] : [];
        return {
          code: s.join_code,
          status: s.status === "active" ? { label: "läuft", ton: "live" }
            : s.status === "waiting" ? { label: "wartet", ton: "wartet" }
            : { label: "beendet", ton: "aus" },
          klasse: cls?.display_name ?? s.scope_label,
          info: [`${s.participant_count} Teiln.`, ...points],
          aktionen: <>
            {s.status !== "finished" && (
              <SitzungAktion art="haupt" href={`/aktivitaeten/caputh/host/${s.join_code}`}>Dashboard</SitzungAktion>
            )}
            {scored && <SitzungAktion href={`/api/sessions/${s.join_code}/report?fmt=csv`} download>CSV</SitzungAktion>}
            {!scored && (
              <SitzungAktion onClick={() => resetMut.mutate(s.join_code)} disabled={resetMut.isPending}>Zurücksetzen</SitzungAktion>
            )}
            <SitzungAktion art="gefahr" disabled={deleteMut.isPending} title="Sitzung löschen (Punkte bleiben erhalten)"
              onClick={() => { if (confirm("Sitzung löschen? Punkte bleiben erhalten.")) deleteMut.mutate(s.join_code); }}>
              Löschen
            </SitzungAktion>
          </>,
        };
      })}
    />
  );
}
