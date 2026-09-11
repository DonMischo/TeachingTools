"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { parseUploadError } from "@/lib/uploadError";
import { ResultChart } from "@/components/barometer/ResultChart";
import { BlockChart } from "@/components/barometer/BlockChart";
import { AnalysisView } from "@/components/barometer/AnalysisView";
import { segmentsOf, slidesOf } from "@/lib/barometer";

export default function BarometerPublicResultsPage() {
  const { code } = useParams<{ code: string }>();

  const { data, error, isLoading } = useQuery({
    queryKey: ["barometer-public", code],
    queryFn: () => api.barometer.publicResults(code),
    refetchInterval: 10_000,
    retry: false,
  });

  if (isLoading) {
    return <div className="h-full overflow-y-auto flex items-center justify-center p-6 text-[var(--text-muted)] text-sm">Laden…</div>;
  }

  if (error) {
    const msg = parseUploadError(error).message;
    const text = /nicht freigegeben/.test(msg)
      ? "Die Ergebnisse dieser Umfrage sind nicht freigegeben."
      : "Umfrage nicht gefunden.";
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center p-6 text-[var(--text-muted)] text-sm text-center">
        {text}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📊 {data.title}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Ergebnisse · aktualisiert sich automatisch</p>
        </div>
        <div className="flex flex-col gap-4">
          {slidesOf(data.questions).flatMap(slide => segmentsOf(slide)).map(seg => {
            if (seg.type === "block") {
              const results = Object.fromEntries(seg.questions.map(q => [q.id, { distribution: q.distribution, count: q.count }]));
              return (
                <div key={seg.block} className="border border-[var(--border)] rounded-2xl p-4 bg-[var(--surface)] flex flex-col gap-2">
                  {seg.questions[0].intro && <div className="font-semibold text-sm">{seg.questions[0].intro}</div>}
                  <BlockChart questions={seg.questions} results={results} chart={seg.questions[0].chart ?? "likert"} />
                </div>
              );
            }
            const q = seg.question;
            return (
              <div key={q.id} className="border border-[var(--border)] rounded-2xl p-4 bg-[var(--surface)] flex flex-col gap-2">
                <div className="font-semibold text-sm">{q.text}</div>
                {q.kind === "text" ? (
                  <>
                    <div className="text-sm text-[var(--text-muted)]">{q.count} Antwort{q.count !== 1 ? "en" : ""}</div>
                    {q.analysis ? (
                      <AnalysisView analysis={q.analysis} />
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">Freitext-Antworten sieht nur die Lehrkraft.</p>
                    )}
                  </>
                ) : (
                  <ResultChart question={q} distribution={q.distribution} count={q.count} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
