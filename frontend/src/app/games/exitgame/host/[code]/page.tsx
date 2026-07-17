"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, ExitGameSessionOut, ExitGameAttemptLog, ExitGameLogEvent } from "@/lib/api";
import { JoinQR } from "@/components/JoinQR";
import { useLanUrl } from "@/hooks/useLanUrl";
import { MathText } from "@/components/MathText";

/** Render one log event as a human-readable German sentence. */
function describeEvent(e: ExitGameLogEvent): { icon: string; text: string } {
  const p = e.payload as Record<string, unknown>;
  const answer = Array.isArray(p.answer) ? (p.answer as string[]).join(", ") : String(p.answer ?? "");
  const attempt = p.attempt_number ? ` (Versuch ${p.attempt_number}` : "";
  const hints = p.attempt_number ? `${Number(p.hints_shown) > 0 ? `, ${p.hints_shown} Hinweis(e)` : ""})` : "";
  const easier = p.variant === "easier" ? " · leichtere Variante" : "";
  switch (e.event_type) {
    case "view":
      return { icon: "👁", text: `öffnet »${e.slide_id}«` };
    case "success":
      return { icon: "✅", text: `löst »${e.slide_id}« richtig: „${answer}“${attempt}${hints}${easier}` };
    case "fail":
      return { icon: "❌", text: `antwortet falsch bei »${e.slide_id}«: „${answer}“${attempt}${hints}${easier}` };
    case "hint":
      return { icon: "💡", text: `sieht Hinweis ${Number(p.hint_index ?? 0) + 1} bei »${e.slide_id}«` };
    case "easier_taken":
      return { icon: "🔀", text: `wechselt bei »${e.slide_id}« zur leichteren Aufgabe` };
    case "review_jump":
      return { icon: "↩", text: `wiederholt von »${e.slide_id}« aus: »${p.target_slide_id}«` };
    default:
      return { icon: "•", text: `${e.event_type} bei »${e.slide_id}«` };
  }
}

type RosterRow = {
  participant_key: string;
  attempt_id: number;
  student_name: string;
  student_class: string;
  current_slide_idx: number;
  total_slides: number;
  status: string;
  errors_total: number;
  hints_total: number;
};

export default function ExitgameHostPage() {
  const { code } = useParams<{ code: string }>();
  const wsRef = useRef<WebSocket | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [logAttemptId, setLogAttemptId] = useState<number | null>(null);
  const joinUrl = useLanUrl(`/play/exitgame/${code}`);

  const { data: session } = useQuery<ExitGameSessionOut>({
    queryKey: ["exitgame-session", code], queryFn: () => api.exitgame.sessions.get(code),
  });
  const { data: log } = useQuery<ExitGameAttemptLog>({
    queryKey: ["exitgame-attempt-log", logAttemptId],
    queryFn: () => api.exitgame.attempts.log(logAttemptId as number),
    enabled: logAttemptId != null,
  });

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/api/exitgame-sessions/${code}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "roster") {
        setRoster(msg.attempts);
      } else if (msg.event === "progress") {
        setRoster(prev => {
          const idx = prev.findIndex(r => r.participant_key === msg.participant_key);
          const row: RosterRow = {
            participant_key: msg.participant_key, attempt_id: msg.attempt_id,
            student_name: msg.student_name, student_class: msg.student_class,
            current_slide_idx: msg.current_slide_idx, total_slides: msg.total_slides,
            status: msg.status, errors_total: msg.errors_total, hints_total: msg.hints_total,
          };
          if (idx === -1) return [...prev, row];
          const next = [...prev];
          next[idx] = row;
          return next;
        });
      }
    };
    return () => ws.close();
  }, [code]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🗝️ Exitgame — Live-Dashboard</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Code: <span className="font-mono">{code}</span> · {connected ? "🟢 live" : "🔴 getrennt"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {joinUrl && (
            <div className="flex flex-col items-center gap-1">
              <JoinQR url={joinUrl} />
              <span className="text-[10px] text-[var(--text-muted)]">/play/exitgame/{code}</span>
            </div>
          )}
          <a href={api.exitgame.sessions.reportCsvUrl(code)} className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]">
            📊 Ergebnisse (CSV)
          </a>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
        {roster.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Noch niemand gestartet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {roster.map(r => {
              const pct = r.total_slides ? Math.round((r.current_slide_idx / r.total_slides) * 100) : 0;
              return (
                <li key={r.participant_key} className="py-2.5 flex items-center gap-3">
                  <span className="text-sm font-medium w-32 truncate" title={r.student_class}>{r.student_name}</span>
                  <span className="text-xs text-[var(--text-muted)] w-10 shrink-0">{r.student_class}</span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--bg)] overflow-hidden">
                    <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-[var(--text-muted)] w-16 text-right">{r.current_slide_idx}/{r.total_slides}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${r.status === "finished" ? "border-green-500/40 text-green-500" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
                    {r.status === "finished" ? "fertig" : "läuft"}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">❌{r.errors_total} 💡{r.hints_total}</span>
                  <button onClick={() => setLogAttemptId(prev => prev === r.attempt_id ? null : r.attempt_id)}
                    className="text-xs text-[var(--accent)] hover:underline">Log</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {logAttemptId != null && log && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Detailliertes Log — {log.student_name} ({log.student_class})</h2>
            <button onClick={() => setLogAttemptId(null)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">✕ schließen</button>
          </div>
          <ul className="flex flex-col gap-1 max-h-96 overflow-y-auto text-xs">
            {log.events.map((e, i) => {
              const d = describeEvent(e);
              return (
                <li key={i} className="flex gap-2 py-1 border-b border-[var(--border)]/30 items-baseline"
                  title={JSON.stringify(e.payload)}>
                  <span className="text-[var(--text-muted)] w-16 shrink-0">
                    {new Date(e.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span className="shrink-0">{d.icon}</span>
                  <span className="min-w-0"><MathText text={d.text} /></span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Link href={`/games/exitgame/${session?.exitgame_id ?? ""}`} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← Zurück zur Übersicht</Link>
    </div>
  );
}
