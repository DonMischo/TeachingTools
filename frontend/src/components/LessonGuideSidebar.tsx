"use client";

import { useEffect, useState } from "react";
import { useLessonSession } from "@/contexts/LessonSessionContext";
import { api, LessonMaterialOut, Phase, ToolLink } from "@/lib/api";
import { launchTool } from "@/lib/toolLaunch";
import { useToast } from "@/contexts/ToastContext";

function useElapsedSeconds(startedAt: string | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

function fmtMin(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function currentPhaseIndex(phasen: Phase[], elapsedMin: number): number {
  let acc = 0;
  for (let i = 0; i < phasen.length; i++) {
    acc += phasen[i].dauer_min || 0;
    if (elapsedMin < acc) return i;
  }
  return phasen.length - 1;
}

export function LessonGuideSidebar() {
  const { session, plan, collapsed, setCollapsed, setViewingMaterial, end } = useLessonSession();
  const { toast } = useToast();
  const elapsedSec = useElapsedSeconds(session?.started_at);
  const [materials, setMaterials] = useState<LessonMaterialOut[]>([]);
  const [startingLink, setStartingLink] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) { setMaterials([]); return; }
    api.stundenplaner.materials.list(plan.id).then(setMaterials).catch(() => {});
  }, [plan?.id]);

  async function handleStart(link: ToolLink, key: string) {
    if (startingLink) return;
    setStartingLink(key);
    try {
      const url = await launchTool(link, plan?.klasse);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast(e.message ?? "Starten fehlgeschlagen", "error");
    } finally {
      setStartingLink(null);
    }
  }

  if (!session || !plan) return null;

  const phasen = plan.phasen ?? [];
  const totalMin = phasen.reduce((s, p) => s + (p.dauer_min || 0), 0);
  const elapsedMin = elapsedSec / 60;
  const activeIdx = phasen.length > 0 ? currentPhaseIndex(phasen, elapsedMin) : -1;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1 py-3 px-2 rounded-l-xl border border-r-0 border-[var(--border)] bg-[var(--surface)] shadow-lg"
        title={plan.title}
      >
        <span className="text-lg">▶</span>
        <span className="text-[10px] text-[var(--text-muted)] [writing-mode:vertical-rl]">{fmtMin(elapsedSec)}</span>
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-0 bottom-0 z-40 w-80 border-l border-[var(--border)] bg-[var(--surface)] flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{plan.title}</div>
          <div className="text-xs text-[var(--text-muted)]">{fmtMin(elapsedSec)} / {totalMin} min</div>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-sm px-1" title="Einklappen">
          ▸
        </button>
      </div>

      {/* Phase list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {phasen.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">Keine Phasen in dieser Planung.</p>
        )}
        {phasen.map((p, i) => {
          const isActive = i === activeIdx;
          const phaseMaterials = materials.filter(m => m.phase_id === p.id);
          return (
            <div
              key={p.id ?? i}
              className="rounded-xl p-2.5 border transition-colors"
              style={{
                borderColor: isActive ? "var(--accent)" : "var(--border)",
                background: isActive ? "rgba(255,235,59,0.08)" : "transparent",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] font-mono w-4 shrink-0">{i + 1}</span>
                <span className={`text-sm flex-1 truncate ${isActive ? "font-bold" : ""}`}>{p.name || "Phase"}</span>
                <span className="text-xs text-[var(--text-muted)] shrink-0">{p.dauer_min} min</span>
              </div>
              {(p.tool_link || phaseMaterials.length > 0) && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {p.tool_link && (
                    <button
                      onClick={() => handleStart(p.tool_link!, p.id ?? String(i))}
                      disabled={startingLink === (p.id ?? String(i))}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-50">
                      {startingLink === (p.id ?? String(i)) ? "Startet…" : <>▶ {p.tool_link.label || p.tool_link.type}</>}
                    </button>
                  )}
                  {phaseMaterials.map(m => (
                    <button key={m.id} onClick={() => setViewingMaterial(m)}
                      className="text-xs px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] transition-colors">
                      📎 {m.original_filename}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border)] shrink-0">
        <button onClick={end} className="w-full btn-secondary text-sm py-2 text-red-400 border-red-400/30 hover:bg-red-400/10">
          ⏹ Stunde beenden
        </button>
      </div>
    </aside>
  );
}
