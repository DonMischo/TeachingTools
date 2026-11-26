"use client";
import { useState } from "react";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ExitGameSessionOut, ExitGameAttemptLog, ExitGameLogEvent } from "@/lib/api";
import { MathText } from "@/components/MathText";
import { AuswertungKnopf } from "@/components/sitzung/AuswertungKnopf";
import { SitzungKopf, KOPF_KNOPF } from "@/components/sitzung/SitzungKopf";
import { taskcrawlerQuelle } from "@/lib/taskcrawler/sitzung";
import SitzungDashboard from "@/components/sitzung/SitzungDashboard";

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

/** Ereignis-Log eines Versuchs, aufgeklappt unter seiner Zeile im Dashboard. */
function VersuchLog({ versuch }: { versuch: number }) {
  const { data: log } = useQuery<ExitGameAttemptLog>({
    queryKey: ["exitgame-attempt-log", versuch], queryFn: () => api.exitgame.attempts.log(versuch),
  });
  if (!log) return <p className="text-xs text-muted">Log wird geladen …</p>;
  return (
    <ul className="flex flex-col gap-1 max-h-96 overflow-y-auto text-xs rounded-lg border border-line p-2">
      {log.events.map((e, i) => {
        const d = describeEvent(e);
        return (
          <li key={i} className="flex gap-2 py-1 border-b border-line/30 last:border-0 items-baseline" title={JSON.stringify(e.payload)}>
            <span className="text-muted w-16 shrink-0">
              {new Date(e.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="shrink-0">{d.icon}</span>
            <span className="min-w-0"><MathText text={d.text} /></span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ExitgameHostPage() {
  const { code } = useParams<{ code: string }>();
  const qc = useQueryClient();
  const quelle = taskcrawlerQuelle(code);

  const { data: session } = useQuery<ExitGameSessionOut>({
    queryKey: ["exitgame-session", code], queryFn: () => api.exitgame.sessions.get(code),
  });

  // Der Socket meldet jeden Fortschritt — dann gleich neu laden statt auf den Takt zu warten.
  const { connected } = useLiveSocket(
    `/api/exitgame-sessions/${code}/ws`,
    (msg) => {
      if (msg.event === "roster" || msg.event === "progress") {
        qc.invalidateQueries({ queryKey: ["sitzung-quelle", ...quelle.schluessel] });
      }
    },
  );

  return (
    <div className="page">
      <SitzungKopf titel="🗝️ TaskCrawler — Live-Dashboard" code={code} pfad={`/play/taskcrawler/${code}`} gast="exitgame"
        live={connected} zurueck={{ href: `/aktivitaeten/taskcrawler/${session?.exitgame_id ?? ""}`, label: "Zur Übersicht" }}>
        <a href={api.exitgame.sessions.reportCsvUrl(code)} className={KOPF_KNOPF}>⬇ CSV</a>
        <AuswertungKnopf titel="TaskCrawler" quelle={quelle} />
        <ErgebnisPdfKnopf code={code} />
      </SitzungKopf>

      <SitzungDashboard code={code} quelle={quelle} leer="Noch niemand gestartet."
        detail={z => typeof z.daten.versuch === "number" && <VersuchLog versuch={z.daten.versuch} />} />
    </div>
  );
}
