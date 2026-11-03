"use client";
/**
 * Laufende Sitzungen eines zustandslosen Werkzeugs — ansehen, öffnen, schließen.
 *
 * Abakus, Tippen, Zeitstrahl & Co. teilen sich eine Tabelle, deshalb kommt die
 * Liste über den gemeinsamen Endpunkt und grenzt per Slug ein. Man sieht die
 * eigenen Sitzungen; Admins sehen alle, dann steht die Lehrkraft dabei.
 *
 * Schließen nimmt Gäste heraus, lässt den Code aber stehen — ein gedruckter QR
 * funktioniert nach dem Wiederöffnen weiter.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type PlaySessionRow } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { SessionGrid, SessionAction, type SessionCardItem } from "@/components/SessionGrid";

export function ToolSessionList({ slug }: { slug: string }) {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const key = ["tool-sessions-list", slug];

  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";

  const { data: sessions = [], isLoading } = useQuery<PlaySessionRow[]>({
    queryKey: key,
    queryFn: () => api.play.sessions("simulation", slug),
    enabled: isTeacher,
  });

  const toggleMut = useMutation({
    mutationFn: (s: PlaySessionRow) =>
      s.closed ? api.play.reopen("simulation", s.code) : api.play.close("simulation", s.code),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  if (!isTeacher) return null;

  return (
    <section className="card flex flex-col gap-2 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Laufende Sitzungen
      </h2>

      {isLoading ? (
        <p className="text-xs text-muted">Laden…</p>
      ) : (
        <SessionGrid
          items={sessions.map((s): SessionCardItem => ({
            code: s.code,
            title: s.ref_title ?? s.owner ?? "Sitzung",
            status: s.closed
              ? { label: "Geschlossen", tone: "closed" }
              : { label: "Offen", tone: "live" },
            meta: [
              ...(s.scope_label ? [s.scope_label] : []),
              ...(s.mine ? [] : [s.owner ?? "fremde Sitzung"]),
              ...(s.created_at ? [new Date(s.created_at).toLocaleDateString("de-DE")] : []),
            ],
          }))}
          empty="Für dieses Werkzeug läuft gerade keine Sitzung."
          renderActions={(item) => {
            const s = sessions.find(x => x.code === item.code)!;
            return (
              <>
                <SessionAction onClick={() => router.push(s.join_url)}>Ansehen</SessionAction>
                {s.mine && (
                  <SessionAction
                    danger={!s.closed}
                    disabled={toggleMut.isPending}
                    onClick={() => toggleMut.mutate(s)}
                    title={s.closed
                      ? "Wieder öffnen — der Code bleibt derselbe"
                      : "Schließen — der Code bleibt gültig"}
                  >
                    {s.closed ? "Wieder öffnen" : "Schließen"}
                  </SessionAction>
                )}
              </>
            );
          }}
        />
      )}
    </section>
  );
}
