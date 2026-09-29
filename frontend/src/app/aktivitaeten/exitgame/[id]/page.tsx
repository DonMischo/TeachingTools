"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, ExitGameDetailOut, ExitGameSessionOut } from "@/lib/api";
import { Scope, ScopeSelect, scopeBody } from "@/components/ScopeSelect";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { JsonEditPanel } from "@/components/JsonEditPanel";

export default function ExitgameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const gameId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { auth } = useAuth();
  // Students may author Exitgames but not host live sessions.
  const isTeacher = auth?.user_type === "teacher";
  const [scope, setScope] = useState<Scope>(null);

  const { data: game } = useQuery<ExitGameDetailOut>({
    queryKey: ["exitgame", gameId], queryFn: () => api.exitgame.get(gameId),
  });
  const { data: sessions = [] } = useQuery<ExitGameSessionOut[]>({
    queryKey: ["exitgame-sessions", gameId], queryFn: () => api.exitgame.sessions.list(gameId),
    enabled: isTeacher,
  });

  const createSessionMut = useMutation({
    mutationFn: () => api.exitgame.sessions.create(gameId, scopeBody(scope)),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["exitgame-sessions", gameId] });
      router.push(`/aktivitaeten/exitgame/host/${s.join_code}`);
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

  if (!game) return <div className="p-6 text-sm text-[var(--text-muted)]">Lade…</div>;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <Link href="/aktivitaeten/exitgame" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← Zurück</Link>
      <div>
        <h1 className="text-2xl font-black tracking-tight">{game.title}</h1>
        {game.description && <p className="text-[var(--text-muted)] text-sm mt-1">{game.description}</p>}
        <div className="flex flex-wrap gap-1.5 text-xs text-[var(--text-muted)] mt-2">
          <span>{game.subject}</span> · <span>{game.slide_count} Slides</span>
          {game.grade && <> · <span>Klasse {game.grade}</span></>}
        </div>
      </div>

      <JsonEditPanel
        load={() => api.exitgame.get(gameId).then(g => g.data)}
        save={data => api.exitgame.update(gameId, data)}
        fileName={`exitgame_${gameId}.json`}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["exitgame", gameId] });
          qc.invalidateQueries({ queryKey: ["exitgames"] });
          toast("Gespeichert", "success");
        }}
      />

      {!isTeacher && (
        <p className="text-sm text-[var(--text-muted)]">
          Live-Sessions dieses Exitgames werden von Lehrkräften gestartet.
        </p>
      )}

      {isTeacher && (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-sm">▶ Neue Session starten</h2>
        <div className="flex gap-2">
          <ScopeSelect value={scope} onChange={setScope} />
          <button onClick={() => createSessionMut.mutate()} disabled={!scope || createSessionMut.isPending}
            className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40">
            Starten
          </button>
        </div>
      </section>
      )}

      {isTeacher && (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
        <h2 className="font-semibold text-sm">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Noch keine Sessions.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {sessions.map(s => (
              <li key={s.id} className="py-2 flex items-center gap-3 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${s.status === "open" ? "border-green-500/40 text-green-500" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                  {s.status === "open" ? "offen" : "geschlossen"}
                </span>
                <span className="text-sm font-mono">{s.join_code}</span>
                {s.scope_label && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg)] text-[var(--text-muted)]">
                    {s.scope_label}
                  </span>
                )}
                <span className="text-xs text-[var(--text-muted)]">{s.attempt_count} Versuch(e)</span>
                <div className="flex-1" />
                <Link href={`/aktivitaeten/exitgame/host/${s.join_code}`} className="text-xs text-[var(--accent)] hover:underline">Dashboard</Link>
                <a href={api.exitgame.sessions.reportCsvUrl(s.join_code)} className="text-xs text-[var(--text-muted)] hover:underline">CSV</a>
                {s.status === "open" ? (
                  <button onClick={() => closeMut.mutate(s.join_code)} disabled={closeMut.isPending}
                    className="text-xs text-[var(--text-muted)] hover:underline disabled:opacity-40">Schließen</button>
                ) : (
                  <button onClick={() => reopenMut.mutate(s.join_code)} disabled={reopenMut.isPending}
                    title="Wieder öffnen — der Code bleibt derselbe"
                    className="text-xs text-[var(--text-muted)] hover:underline disabled:opacity-40">Wieder öffnen</button>
                )}
                <button onClick={() => { if (confirm("Session löschen?")) deleteSessionMut.mutate(s.join_code); }} className="text-xs text-red-400 hover:underline">Löschen</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
    </div>
  );
}
