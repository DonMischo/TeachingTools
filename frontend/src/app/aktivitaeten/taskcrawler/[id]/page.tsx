"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, ExitGameDetailOut, ExitGameSessionOut } from "@/lib/api";
import { type Scope, scopeBody } from "@/components/ScopeSelect";
import { SitzungListe, SitzungAktion, type SitzungEintrag } from "@/components/sitzung/SitzungListe";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { VorlagenEditor } from "@/components/vorlagen/VorlagenEditor";
import { TaskCrawlerForm } from "@/components/vorlagen/TaskCrawlerForm";

export default function ExitgameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const gameId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { auth } = useAuth();
  // Students may author TaskCrawler but not host live sessions.
  const isTeacher = auth?.user_type === "teacher";

  const { data: game } = useQuery<ExitGameDetailOut>({
    queryKey: ["exitgame", gameId], queryFn: () => api.exitgame.get(gameId),
  });
  const { data: sessions = [] } = useQuery<ExitGameSessionOut[]>({
    queryKey: ["exitgame-sessions", gameId], queryFn: () => api.exitgame.sessions.list(gameId),
    enabled: isTeacher,
  });

  const createSessionMut = useMutation({
    mutationFn: (scope: Scope) => api.exitgame.sessions.create(gameId, scopeBody(scope)),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["exitgame-sessions", gameId] });
      router.push(`/aktivitaeten/taskcrawler/host/${s.join_code}`);
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const closeMut = useMutation({
    mutationFn: (code: string) => api.exitgame.sessions.close(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exitgame-sessions", gameId] }),
  });
  // Wieder öffnen kommt aus dem gemeinsamen Playhub-Endpunkt: der Code bleibt
  // derselbe, ein gedruckter QR funktioniert danach weiter.
  const reopenMut = useMutation({
    mutationFn: (code: string) => api.play.reopen("exitgame", code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exitgame-sessions", gameId] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });
  const deleteSessionMut = useMutation({
    mutationFn: (code: string) => api.exitgame.sessions.delete(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exitgame-sessions", gameId] }),
  });

  if (!game) return <div className="p-6 text-sm text-muted">Lade…</div>;

  return (
    <div className="page">
      <Link href="/aktivitaeten/taskcrawler" className="text-xs text-muted hover:text-fg">← Zurück</Link>
      <div>
        <h1 className="text-2xl font-black tracking-tight">{game.title}</h1>
        {game.description && <p className="text-muted text-sm mt-1">{game.description}</p>}
        <div className="flex flex-wrap gap-1.5 text-xs text-muted mt-2">
          <span>{game.subject}</span> · <span>{game.slide_count} Slides</span>
          {game.grade && <> · <span>Klasse {game.grade}</span></>}
        </div>
      </div>

      <VorlagenEditor
        title="TaskCrawler bearbeiten"
        load={() => api.exitgame.get(gameId).then(g => g.data)}
        render={(v, set) => <TaskCrawlerForm value={v} onChange={set} exitgameId={gameId} />}
        save={data => api.exitgame.update(gameId, data)}
        fileName={`taskcrawler_${gameId}.json`}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["exitgame", gameId] });
          qc.invalidateQueries({ queryKey: ["exitgames"] });
          toast("Gespeichert", "success");
        }}
      />

      {!isTeacher && (
        <p className="text-sm text-muted">
          Live-Sessions dieses TaskCrawlers werden von Lehrkräften gestartet.
        </p>
      )}

      {isTeacher && (
        <SitzungListe
          neu={{ onStart: s => createSessionMut.mutate(s), laeuft: createSessionMut.isPending }}
          eintraege={sessions.map((s): SitzungEintrag => ({
            code: s.join_code,
            status: s.status === "open" ? { label: "offen", ton: "live" } : { label: "geschlossen", ton: "aus" },
            klasse: s.scope_label,
            info: [`${s.attempt_count} Versuch(e)`],
            aktionen: <>
              <SitzungAktion art="haupt" href={`/aktivitaeten/taskcrawler/host/${s.join_code}`}>Dashboard</SitzungAktion>
              <SitzungAktion href={api.exitgame.sessions.reportCsvUrl(s.join_code)}>CSV</SitzungAktion>
              {s.status === "open" ? (
                <SitzungAktion onClick={() => closeMut.mutate(s.join_code)} disabled={closeMut.isPending}>Schließen</SitzungAktion>
              ) : (
                <SitzungAktion onClick={() => reopenMut.mutate(s.join_code)} disabled={reopenMut.isPending}
                  title="Wieder öffnen — der Code bleibt derselbe">Wieder öffnen</SitzungAktion>
              )}
              <SitzungAktion art="gefahr" onClick={() => { if (confirm("Sitzung löschen?")) deleteSessionMut.mutate(s.join_code); }}>Löschen</SitzungAktion>
            </>,
          }))}
        />
      )}
    </div>
  );
}
