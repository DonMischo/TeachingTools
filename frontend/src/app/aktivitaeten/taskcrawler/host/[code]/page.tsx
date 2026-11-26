"use client";
import { useState } from "react";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ExitGameSessionOut, ExitGameAttemptLog, ExitGameLogEvent } from "@/lib/api";
import { MathText } from "@/components/MathText";
import { AuswertungKnopf } from "@/components/sitzung/AuswertungKnopf";
import { SitzungKopf, KOPF_KNOPF } from "@/components/sitzung/SitzungKopf";
import { taskcrawlerQuelle } from "@/lib/taskcrawler/sitzung";

/** Ergebnissicherung (Merksätze aller Aufgaben) als PDF — wie am Ende des Spiels, zum Drucken oder Austeilen. */
function ErgebnisPdfKnopf({ code }: { code: string }) {
  const [status, setStatus] = useState<"" | "laedt" | "leer" | "fehler">("");
  async function laden() {
    setStatus("laedt");
    try {
      const d = await api.exitgame.sessions.ergebnissicherung(code);
      if (!d.ergebnissicherung.length) { setStatus("leer"); return; }
      const { speichereErgebnisPdf } = await import("@/lib/taskcrawler/ergebnisPdf");
      await speichereErgebnisPdf({ titel: d.title, abschnitte: d.ergebnissicherung, akzent: d.akzent ?? undefined });
      setStatus("");
    } catch {
      setStatus("fehler");
    }
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      <button onClick={laden} disabled={status === "laedt"}
        title="Die Merksätze aller Aufgaben, je Abschnitt — dasselbe PDF, das die Lernenden am Ende bekommen"
        className={KOPF_KNOPF}>
        {status === "laedt" ? "⏳ PDF wird erstellt …" : "📄 Ergebnissicherung (PDF)"}
      </button>
      {status === "leer" && <span className="text-[11px] text-muted max-w-56">Dieser TaskCrawler hat keine Ergebnissicherung (Feld »ergebnissicherung« an den Folien).</span>}
      {status === "fehler" && <span className="text-[11px] text-bad">PDF ging nicht — bitte noch einmal.</span>}
    </div>
  );
}

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
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [logAttemptId, setLogAttemptId] = useState<number | null>(null);

  const { data: session } = useQuery<ExitGameSessionOut>({
    queryKey: ["exitgame-session", code], queryFn: () => api.exitgame.sessions.get(code),
  });
  const { data: log } = useQuery<ExitGameAttemptLog>({
    queryKey: ["exitgame-attempt-log", logAttemptId],
    queryFn: () => api.exitgame.attempts.log(logAttemptId as number),
    enabled: logAttemptId != null,
  });

  const { connected } = useLiveSocket(
    `/api/exitgame-sessions/${code}/ws`,
    (msg) => {
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
    },
  );

  return (
    <div className="page">
      <SitzungKopf titel="🗝️ TaskCrawler — Live-Dashboard" code={code} pfad={`/play/taskcrawler/${code}`} gast="exitgame"
        live={connected} zurueck={{ href: `/aktivitaeten/taskcrawler/${session?.exitgame_id ?? ""}`, label: "Zur Übersicht" }}>
        <a href={api.exitgame.sessions.reportCsvUrl(code)} className={KOPF_KNOPF}>⬇ CSV</a>
        <AuswertungKnopf titel="TaskCrawler" quelle={taskcrawlerQuelle(code)} />
        <ErgebnisPdfKnopf code={code} />
      </SitzungKopf>

      <section className="card p-4 flex flex-col gap-2">
        {roster.length === 0 ? (
          <p className="text-sm text-muted">Noch niemand gestartet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {roster.map(r => {
              // current_slide_idx is 0-based; a student on the last slide is on
              // slide total_slides, not total_slides - 1.
              const position = r.status === "finished"
                ? r.total_slides
                : Math.min(r.current_slide_idx + 1, r.total_slides);
              const pct = r.total_slides ? Math.round((position / r.total_slides) * 100) : 0;
              return (
                <li key={r.participant_key} className="py-2.5 flex items-center gap-3">
                  <span className="text-sm font-medium w-32 truncate" title={r.student_class}>{r.student_name}</span>
                  <span className="text-xs text-muted w-10 shrink-0">{r.student_class}</span>
                  <div className="flex-1 h-2 rounded-full bg-page overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted w-16 text-right">{position}/{r.total_slides}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${r.status === "finished" ? "border-green-500/40 text-green-500" : "border-line text-muted"}`}>
                    {r.status === "finished" ? "fertig" : "läuft"}
                  </span>
                  <span className="text-xs text-muted">❌{r.errors_total} 💡{r.hints_total}</span>
                  <button onClick={() => setLogAttemptId(prev => prev === r.attempt_id ? null : r.attempt_id)}
                    className="text-xs text-accent hover:underline">Log</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {logAttemptId != null && log && (
        <section className="card p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Detailliertes Log — {log.student_name} ({log.student_class})</h2>
            <button onClick={() => setLogAttemptId(null)} className="text-xs text-muted hover:text-fg">✕ schließen</button>
          </div>
          <ul className="flex flex-col gap-1 max-h-96 overflow-y-auto text-xs">
            {log.events.map((e, i) => {
              const d = describeEvent(e);
              return (
                <li key={i} className="flex gap-2 py-1 border-b border-line/30 items-baseline"
                  title={JSON.stringify(e.payload)}>
                  <span className="text-muted w-16 shrink-0">
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
    </div>
  );
}
