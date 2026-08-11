"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ExitTicketSummary } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability } from "@/hooks/useAvailability";

const STATUS_LABEL: Record<string, string> = { open: "Offen", closed: "Geschlossen" };

export default function ExitTicketPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const canEdit = auth?.role === "teacher" || auth?.role === "admin";
  const { can } = useAvailability();

  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [ratingEnabled, setRatingEnabled] = useState(true);

  const { data: sessions = [], isLoading } = useQuery<ExitTicketSummary[]>({
    queryKey: ["exit-ticket"],
    queryFn: () => api.exitTicket.list(),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () => api.exitTicket.create({ title, question, rating_enabled: ratingEnabled }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["exit-ticket"] });
      router.push(`/tools/exit-ticket/host/${s.code}`);
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.exitTicket.delete(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exit-ticket"] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  if (!canEdit) {
    return <div className="p-8 text-[var(--text-muted)]">Nur für Lehrkräfte.</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <button onClick={() => router.push("/tools")} className="self-start text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
        ← Tools
      </button>
      <div>
        <h1 className="text-2xl font-black tracking-tight">🎫 Exit Ticket</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Anonymes Schnell-Feedback am Ende einer Stunde.
        </p>
      </div>

      {canEdit && can("exit-ticket", "host") && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-sm">Neues Exit Ticket</h2>
          <input className="input" placeholder="Titel (z. B. Stunde vom 30.6.)" value={title}
            onChange={e => setTitle(e.target.value)} />
          <textarea className="input resize-none text-sm" rows={3}
            placeholder="Frage / Aufgabe (z. B. Was war heute dein wichtigster Lernmoment?)"
            value={question} onChange={e => setQuestion(e.target.value)} />
          <label className="flex items-center gap-3 cursor-pointer text-sm">
            <div
              onClick={() => setRatingEnabled(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${ratingEnabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${ratingEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            Bewertungsskala (1–5 Sterne) aktivieren
          </label>
          <button
            onClick={() => createMut.mutate()}
            disabled={!title.trim() || !question.trim() || createMut.isPending}
            className="btn-primary self-start"
          >
            {createMut.isPending ? "Erstelle…" : "Exit Ticket starten"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-[var(--text-muted)] text-sm">Laden…</div>
      ) : sessions.length === 0 ? (
        <div className="flex items-center justify-center h-32 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)] text-sm">
          Noch keine Exit Tickets.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map(s => (
            <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{s.title}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{s.question}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {STATUS_LABEL[s.status] ?? s.status} · {s.response_count} Antworten
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => router.push(`/tools/exit-ticket/host/${s.code}`)}
                  className="shrink-0 w-auto rounded-lg border border-[var(--border)] text-[var(--text)] font-semibold py-1 px-3 text-xs hover:bg-[var(--surface-hover)] transition-colors">Öffnen</button>
                {canEdit && (
                  <button onClick={() => deleteMut.mutate(s.code)}
                    className="shrink-0 w-auto text-xs border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-3 py-1 transition-colors">
                    Löschen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
