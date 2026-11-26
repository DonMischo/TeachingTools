"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, BarometerQuestionOut, BarometerSessionOut, BarometerResults } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { JoinQR } from "@/components/JoinQR";
import { SitzungKopf } from "@/components/sitzung/SitzungKopf";
import { UploadErrorDialog } from "@/components/UploadErrorDialog";
import { parseUploadError, UploadError } from "@/lib/uploadError";
import { useLanUrl } from "@/hooks/useLanUrl";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { ResultChart } from "@/components/barometer/ResultChart";
import { BlockChart } from "@/components/barometer/BlockChart";
import { AnalysisView } from "@/components/barometer/AnalysisView";
import { BLOCK_CHART_TYPES, CHART_TYPES, KIND_LABELS, segmentsOf, slidesOf } from "@/lib/barometer";

type LiveState = {
  status: string;
  current_slide: number;
  total_slides: number;
  results_visible: boolean;
  participants: number;
  mode: "live" | "self";
  results: Record<number, BarometerResults>;
};

function mergeResults(prev: Record<number, BarometerResults>, incoming: Record<string, BarometerResults>) {
  const next = { ...prev };
  for (const [k, v] of Object.entries(incoming)) {
    const qid = Number(k);
    next[qid] = { ...v, texts: v.texts ?? next[qid]?.texts };
  }
  return next;
}

export default function BarometerHostPage() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const resultsUrl = useLanUrl(`/play/barometer/${code}/ergebnisse`);

  const { data: session } = useQuery<BarometerSessionOut>({
    queryKey: ["barometer", code],
    queryFn: () => api.barometer.get(code),
    staleTime: 60_000,
  });

  const [live, setLive] = useState<LiveState>({
    status: "active", current_slide: -1, total_slides: 0, results_visible: false,
    participants: 0, mode: "live", results: {},
  });
  const [chartOverrides, setChartOverrides] = useState<Record<number, string>>({});
  const [resultsPublic, setResultsPublic] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const analysisFileRef = useRef<HTMLInputElement>(null);

  // WebSocket
  const liveSocket = useLiveSocket(
    `/api/barometer/${code}/ws?role=teacher`,
    (msg) => {
      if (msg.event === "state") {
        setLive(prev => ({
          ...prev,
          status: msg.status,
          current_slide: msg.current_slide,
          total_slides: msg.total_slides,
          results_visible: msg.results_visible,
          participants: msg.participants ?? prev.participants,
          mode: msg.mode ?? prev.mode,
          // Nach »Neu starten« kommt ein state ohne Ergebnisse — die alten gehoeren dann weg.
          results: msg.results ? mergeResults(msg.reset ? {} : prev.results, msg.results) : msg.reset ? {} : prev.results,
        }));
      } else if (msg.event === "participant_joined") {
        setLive(prev => ({ ...prev, participants: msg.count }));
      } else if (msg.event === "response_update") {
        setLive(prev => ({
          ...prev,
          results: {
            ...prev.results,
            [msg.question_id]: { distribution: msg.distribution, count: msg.count, texts: msg.texts ?? prev.results[msg.question_id]?.texts },
          },
        }));
      } else if (msg.event === "slide") {
        setLive(prev => ({
          ...prev,
          current_slide: msg.index,
          results_visible: false,
          total_slides: msg.total,
        }));
      } else if (msg.event === "results") {
        setLive(prev => ({
          ...prev,
          results_visible: true,
          results: mergeResults(prev.results, msg.results),
        }));
      } else if (msg.event === "closed") {
        setLive(prev => ({ ...prev, status: "closed" }));
      }
    },
    { onRejected: () => toast("WebSocket-Fehler", "error") },
  );

  function send(msg: object) {
    liveSocket.send(msg);
  }

  async function handleSetChart(questionIds: number[], chart: string) {
    const prevOverrides = chartOverrides;
    setChartOverrides(o => {
      const next = { ...o };
      for (const id of questionIds) next[id] = chart;
      return next;
    });
    try {
      await api.barometer.setChart(code, questionIds[0], chart);
    } catch {
      setChartOverrides(prevOverrides);
      toast("Fehler beim Speichern der Darstellung", "error");
    }
  }

  async function handleExport() {
    const data = await api.barometer.exportResults(code);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `umfrage-${code}-ergebnisse.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleToggleResultsPublic() {
    try {
      const r = await api.barometer.setResultsPublic(code, !resultsPublic);
      setResultsPublic(r.results_public);
    } catch {
      toast("Fehler", "error");
    }
  }

  async function openAiPanel() {
    const willOpen = !showAi;
    setShowAi(willOpen);
    if (willOpen) {
      try {
        const r = await api.barometer.analysisPrompt(code);
        setAiPrompt(r.prompt);
      } catch {
        toast("Fehler beim Laden des Prompts", "error");
      }
    }
  }

  function copyPrompt() {
    navigator.clipboard.writeText(aiPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleAnalysisUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.barometer.uploadAnalysis(code, file);
      qc.invalidateQueries({ queryKey: ["barometer", code] });
      toast("Auswertung gespeichert", "success");
    } catch (err) {
      setUploadError(parseUploadError(err));
    } finally {
      if (analysisFileRef.current) analysisFileRef.current.value = "";
    }
  }

  // Initialize resultsPublic from the fetched session once (WS "state" doesn't carry it).
  const initializedResultsPublic = useRef(false);
  useEffect(() => {
    if (session && !initializedResultsPublic.current) {
      initializedResultsPublic.current = true;
      setResultsPublic(session.results_public);
    }
  }, [session]);

  const hasTextQuestion = session?.questions.some(q => q.kind === "text") ?? false;
  const slides = session ? slidesOf(session.questions) : [];

  function followUpBadge(q: BarometerQuestionOut): string | null {
    if (!q.show_if) return null;
    const parent = session?.questions.find(p => p.id === q.show_if!.parent_id) ?? session?.questions[q.show_if.question];
    if (!parent) return null;
    const labels = q.show_if.options.map(i => parent.options[i]).filter(Boolean).join(" / ");
    return `Folgefrage zu Frage ${parent.order + 1}: ${labels}`;
  }

  // Löscht alle Antworten und KI-Auswertungen (WS »restart«) — darum zweimal nachfragen.
  function zuruecksetzen() {
    if (!confirm("Umfrage zurücksetzen?\n\nAlle Antworten und KI-Auswertungen werden gelöscht. Die Fragen bleiben.")) return;
    if (!confirm("Wirklich alle Antworten löschen?\n\nDas lässt sich nicht rückgängig machen. Tipp: vorher »Ergebnisse (JSON)« sichern.")) return;
    send({ action: "restart" });
  }

  return (
    <div className="page">
      <SitzungKopf titel={`📊 ${session?.title ?? "…"}`} code={code} pfad={`/play/barometer/${code}`} gast="barometer" selbst={false}
        zurueck={{ href: "/tools/barometer", label: "Barometer" }}
        info={[`${live.participants} Teilnehmer`, ...(live.status === "closed" ? [<span key="z" className="text-amber-400">Abgeschlossen</span>] : [])]}
        untertitel={live.mode === "self" && <span className="text-xs">Selbst ausfüllen: Die Teilnehmenden sehen alle Fragen auf einmal.</span>}
        qrExtra={<>
          <label className="flex items-center gap-2 text-xs cursor-pointer mt-1">
            <button type="button" onClick={handleToggleResultsPublic}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              style={{ background: resultsPublic ? "var(--accent)" : "#cbd5e1" }}>
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                style={{ transform: resultsPublic ? "translateX(18px)" : "translateX(2px)" }} />
            </button>
            Ergebnisse teilen
          </label>
          {resultsPublic && resultsUrl && (
            <div className="flex flex-col items-center gap-1 mt-1">
              <JoinQR url={resultsUrl} size={70} />
              <span className="text-xs text-muted">Ergebnisse</span>
            </div>
          )}
        </>} />

      {/* Slide navigator */}
      {session && (
        <div className="flex flex-col gap-3">
          {slides.map((slide, i) => {
            const isActive = live.current_slide === i;
            const showResults = live.mode === "self" || isActive || slide.some(q => (live.results[q.id]?.count ?? 0) > 0);
            return (
              <div key={i}
                className={`border rounded-2xl p-4 flex flex-col gap-3 transition-colors ${isActive ? "border-accent bg-surface" : "border-line bg-page"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-muted">Folie {i + 1}/{slides.length}</span>
                  {live.mode === "live" && (
                    <div className="flex gap-2 shrink-0">
                      {!isActive && live.status !== "closed" && (
                        <button onClick={() => send({ action: "show_slide", index: i })}
                          className="btn-primary text-xs py-1 px-3">Zeigen</button>
                      )}
                      {isActive && !live.results_visible && live.status !== "closed" && (
                        <button onClick={() => send({ action: "show_results" })}
                          className="btn-secondary text-xs py-1 px-3">Ergebnis zeigen</button>
                      )}
                      {isActive && i < slides.length - 1 && live.status !== "closed" && (
                        <button onClick={() => send({ action: "show_slide", index: i + 1 })}
                          className="btn-primary text-xs py-1 px-3">Weiter →</button>
                      )}
                    </div>
                  )}
                </div>

                {segmentsOf(slide).map(seg => {
                  if (seg.type === "block") {
                    const first = seg.questions[0];
                    const chartValue = chartOverrides[first.id] ?? first.chart ?? BLOCK_CHART_TYPES[0].id;
                    return (
                      <div key={seg.block} className="border border-line rounded-xl p-3 flex flex-col gap-2 bg-surface">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {first.intro && <div className="font-semibold text-sm">{first.intro}</div>}
                            <span className="text-[10px] uppercase tracking-wide text-muted">Aussagen-Block</span>
                          </div>
                          <select aria-label="Darstellung" value={chartValue}
                            onChange={e => handleSetChart(seg.questions.map(q => q.id), e.target.value)}
                            className="input w-auto! text-xs! py-1! px-2! shrink-0">
                            {BLOCK_CHART_TYPES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </div>
                        {showResults && <BlockChart questions={seg.questions} results={live.results} chart={chartValue} />}
                      </div>
                    );
                  }
                  const q = seg.question;
                  const result = live.results[q.id] ?? { distribution: {}, count: 0 };
                  const chartValue = chartOverrides[q.id] ?? q.chart ?? "";
                  const badge = followUpBadge(q);
                  return (
                    <div key={q.id} className="border border-line rounded-xl p-3 flex flex-col gap-2 bg-surface">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{q.text}</div>
                          <span className="text-[10px] uppercase tracking-wide text-muted">{KIND_LABELS[q.kind]}</span>
                          {badge && (
                            <div className="text-[10px] text-muted bg-page w-fit rounded-md px-2 py-0.5 mt-1">{badge}</div>
                          )}
                        </div>
                        <select aria-label="Darstellung" value={chartValue || CHART_TYPES[q.kind][0].id}
                          onChange={e => handleSetChart([q.id], e.target.value)}
                          className="input w-auto! text-xs! py-1! px-2! shrink-0">
                          {CHART_TYPES[q.kind].map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      </div>
                      {showResults && (
                        <ResultChart question={q} distribution={result.distribution} count={result.count}
                          texts={result.texts} chart={chartValue} />
                      )}
                      {q.analysis && <AnalysisView analysis={q.analysis} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Link href={`/tools/barometer?edit=${code}`}
          className="self-start text-sm border border-line text-muted hover:text-fg hover:border-accent rounded-xl px-4 py-1.5 transition-colors">
          ✏️ Bearbeiten
        </Link>
        {live.status === "closed" ? (
          <button onClick={() => send({ action: "restart" })}
            className="self-start text-sm border border-accent text-accent hover:bg-accent/10 rounded-xl px-4 py-1.5 transition-colors">
            🔁 Neu starten
          </button>
        ) : (
          <button onClick={() => send({ action: "close" })}
            className="self-start text-sm border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-4 py-1.5 transition-colors">
            Umfrage beenden
          </button>
        )}
        <button onClick={zuruecksetzen}
          className="self-start text-sm border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-xl px-4 py-1.5 transition-colors">
          🗑 Umfrage zurücksetzen
        </button>
        <button onClick={handleExport}
          className="self-start text-sm border border-line text-muted hover:text-fg hover:border-accent rounded-xl px-4 py-1.5 transition-colors">
          ⬇️ Ergebnisse (JSON)
        </button>
      </div>

      {hasTextQuestion && (
        <div className="rounded-xl border border-line overflow-hidden">
          <button onClick={openAiPanel}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-muted hover:bg-surface-hover transition-colors">
            <span>🤖 KI-Auswertung</span>
            <span>{showAi ? "▲" : "▼"}</span>
          </button>
          {showAi && (
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-line">
              <ol className="text-xs text-muted pt-3 leading-relaxed list-decimal list-inside">
                <li>Prompt kopieren – oder gleich die Datei »Ergebnisse (JSON)« an die KI geben, der Auftrag steht darin ganz oben</li>
                <li>in ChatGPT/Claude/… einfügen</li>
                <li>die JSON-Antwort als .json speichern und hier hochladen — pro Frage erscheint die Essenz als Balkendiagramm, auch auf der geteilten Ergebnisseite</li>
              </ol>
              <pre className="text-xs bg-page border border-line rounded-lg p-3 whitespace-pre-wrap leading-relaxed text-muted max-h-48 overflow-y-auto">
                {aiPrompt}
              </pre>
              <div className="flex gap-2">
                <button onClick={copyPrompt}
                  className="btn-primary text-xs px-3 py-1.5">
                  {copied ? "✓ Kopiert!" : "Prompt kopieren"}
                </button>
                <button onClick={() => analysisFileRef.current?.click()}
                  className="text-xs px-3 py-1.5 border border-line rounded-lg hover:border-accent transition-colors">
                  ⬆️ Auswertung hochladen
                </button>
                <input ref={analysisFileRef} type="file" accept=".json" className="hidden" onChange={handleAnalysisUpload} />
              </div>
            </div>
          )}
        </div>
      )}

      <UploadErrorDialog error={uploadError} onClose={() => setUploadError(null)} />
    </div>
  );
}
