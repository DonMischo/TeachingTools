"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, LueckentextGap, LueckentextSessionOut, LueckentextSetDetail } from "@/lib/api";
import { SessionGrid, SessionAction, type SessionCardItem } from "@/components/SessionGrid";
import { parseUploadError } from "@/lib/uploadError";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

type Draft = {
  title: string;
  description: string;
  tags: string;
  grades: string;
  text: string;
  gaps: LueckentextGap[];
  distractors: string[];
};

function toDraft(set: LueckentextSetDetail): Draft {
  return {
    title: set.title,
    description: set.description ?? "",
    tags: set.tags.join(", "),
    grades: set.grades.join(", "),
    text: set.text,
    gaps: set.gaps.map(g => ({ ...g })),
    distractors: [...set.distractors],
  };
}

/** Client-side pre-check: {{gap_id}} placeholders in the text vs the ids
 * present in the gaps list. Just a helpful heads-up — the backend remains
 * the source of truth. */
function findMismatches(text: string, gaps: LueckentextGap[]): string[] {
  const problems: string[] = [];
  const referenced = new Set<string>();
  const re = /\{\{\s*([\w-]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) referenced.add(m[1]);
  const gapIds = new Set(gaps.map(g => g.id));
  for (const id of referenced) {
    if (!gapIds.has(id)) problems.push(`Der Text verweist auf keine Lücke "${id}"`);
  }
  for (const id of gapIds) {
    if (!referenced.has(id)) problems.push(`Die Lücke "${id}" kommt im Text nicht vor`);
  }
  return problems;
}

export default function LueckentextDetailPage() {
  const { id } = useParams<{ id: string }>();
  const setId = Number(id);
  const { auth } = useAuth();
  const isTeacher = auth?.user_type === "teacher";
  const { toast } = useToast();
  const qc = useQueryClient();
  const router = useRouter();

  const { data: set, isLoading, isError } = useQuery<LueckentextSetDetail>({
    queryKey: ["lueckentext", setId],
    queryFn: () => api.lueckentexte.get(setId),
    enabled: Number.isFinite(setId) && !!auth,
  });

  // Teachers may edit any set; students only shared-pool (student-authored) sets.
  const canEdit = isTeacher || (!!set && set.created_by_student != null);

  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => { if (set) setDraft(toDraft(set)); }, [set]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("Kein Entwurf");
      return api.lueckentexte.update(setId, {
        title: draft.title,
        description: draft.description || null,
        tags: draft.tags.split(",").map(t => t.trim()).filter(Boolean),
        grades: draft.grades.split(",").map(g => parseInt(g.trim(), 10)).filter(n => Number.isFinite(n)),
        text: draft.text,
        gaps: draft.gaps,
        distractors: draft.distractors,
      });
    },
    onSuccess: () => {
      toast("Gespeichert", "success");
      qc.invalidateQueries({ queryKey: ["lueckentext", setId] });
      qc.invalidateQueries({ queryKey: ["lueckentexte"] });
    },
    onError: (e: Error) => {
      let msg = e.message;
      try {
        const parsed = JSON.parse(msg);
        msg = parsed.detail?.errors?.join("\n") ?? parsed.detail?.message ?? msg;
      } catch { /* raw message */ }
      toast(msg, "error");
    },
  });

  const mismatches = useMemo(() => draft ? findMismatches(draft.text, draft.gaps) : [], [draft]);

  const startSessionMut = useMutation({
    mutationFn: () => api.lueckentexte.createSession(setId),
    onSuccess: (session) => router.push(`/aktivitaeten/lueckentext/host/${session.join_code}`),
    onError: (e: Error) => toast(e.message, "error"),
  });

  function addGap() {
    if (!draft) return;
    const id = `gap-${draft.gaps.length + 1}`;
    setDraft({
      ...draft,
      gaps: [...draft.gaps, { id, answer: "", type: "free_type", difficulty: "medium", hint: null, choices: null }],
    });
  }

  function patchGap(idx: number, patch: Partial<LueckentextGap>) {
    if (!draft) return;
    setDraft({ ...draft, gaps: draft.gaps.map((g, i) => i === idx ? { ...g, ...patch } : g) });
  }

  function removeGap(idx: number) {
    if (!draft) return;
    setDraft({ ...draft, gaps: draft.gaps.filter((_, i) => i !== idx) });
  }

  function addChoice(idx: number) {
    if (!draft) return;
    const gap = draft.gaps[idx];
    const choices = [...(gap.choices ?? []), ""];
    if (choices.length > 4) return;
    patchGap(idx, { choices });
  }

  function patchChoice(idx: number, choiceIdx: number, value: string) {
    if (!draft) return;
    const gap = draft.gaps[idx];
    const choices = (gap.choices ?? []).map((c, i) => i === choiceIdx ? value : c);
    patchGap(idx, { choices });
  }

  function removeChoice(idx: number, choiceIdx: number) {
    if (!draft) return;
    const gap = draft.gaps[idx];
    const choices = (gap.choices ?? []).filter((_, i) => i !== choiceIdx);
    if (choices.length < 2) return;
    patchGap(idx, { choices });
  }

  function addDistractor() {
    if (!draft) return;
    setDraft({ ...draft, distractors: [...draft.distractors, ""] });
  }

  function patchDistractor(idx: number, value: string) {
    if (!draft) return;
    setDraft({ ...draft, distractors: draft.distractors.map((d, i) => i === idx ? value : d) });
  }

  function removeDistractor(idx: number) {
    if (!draft) return;
    setDraft({ ...draft, distractors: draft.distractors.filter((_, i) => i !== idx) });
  }

  if (isLoading) return <div className="p-8 text-sm text-muted">Lade…</div>;
  if (isError || !set) return <div className="p-8 text-sm text-muted">Lückentext nicht gefunden.</div>;

  if (!canEdit) {
    return (
      <div className="page">
        <h1 className="text-2xl font-black tracking-tight">{set.title}</h1>
        {set.description && <p className="text-sm text-muted">{set.description}</p>}
        <p className="whitespace-pre-wrap text-sm">
          {set.text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, gid) => `[${gid}]`)}
        </p>
        <table className="text-sm border border-line rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-surface">
              <th className="text-left p-2">Lücke</th>
              <th className="text-left p-2">Antwort</th>
              <th className="text-left p-2">Typ</th>
              <th className="text-left p-2">Schwierigkeit</th>
            </tr>
          </thead>
          <tbody>
            {set.gaps.map(g => (
              <tr key={g.id} className="border-t border-line">
                <td className="p-2">{g.id}</td>
                <td className="p-2">{g.answer}</td>
                <td className="p-2">{g.type}</td>
                <td className="p-2">{g.difficulty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!draft) return null;

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-black tracking-tight">📝 Lückentext bearbeiten</h1>
        <div className="flex gap-2 flex-nowrap items-center">
          <a href={`/api/lueckentexte/${setId}/export.pdf?filled=0`}
            className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent whitespace-nowrap">
            📄 PDF (leer)
          </a>
          <a href={`/api/lueckentexte/${setId}/export.pdf?filled=1`}
            className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent whitespace-nowrap">
            📄 PDF (gefüllt)
          </a>
          {isTeacher && (
            <button onClick={() => startSessionMut.mutate()} disabled={startSessionMut.isPending}
              className="text-sm border border-line rounded-lg px-6 py-1.5 hover:border-accent disabled:opacity-40 whitespace-nowrap">
              {startSessionMut.isPending ? "Starte…" : "▶ Sitzung starten"}
            </button>
          )}
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="btn-primary text-sm py-1.5 px-4 whitespace-nowrap">
            {saveMut.isPending ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </div>

      {mismatches.length > 0 && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
          {mismatches.map((m, i) => <div key={i}>{m}</div>)}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Titel
          <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
            className="border border-line rounded-lg px-3 py-1.5 bg-transparent" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Beschreibung
          <input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}
            className="border border-line rounded-lg px-3 py-1.5 bg-transparent" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tags (kommagetrennt)
          <input value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })}
            className="border border-line rounded-lg px-3 py-1.5 bg-transparent" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Klassenstufen (kommagetrennt)
          <input value={draft.grades} onChange={e => setDraft({ ...draft, grades: e.target.value })}
            className="border border-line rounded-lg px-3 py-1.5 bg-transparent" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Text ({"{{gap_id}}"} für Lücken)
          <textarea value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })}
            rows={8} className="border border-line rounded-lg px-3 py-1.5 bg-transparent font-mono text-xs" />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Lücken</h2>
          <button onClick={addGap} className="text-xs border border-line rounded-lg px-2 py-1 hover:border-accent">
            + Lücke
          </button>
        </div>
        {draft.gaps.map((g, idx) => (
          <div key={idx} className="rounded-xl border border-line p-3 flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap items-end">
              <label className="flex flex-col gap-1 text-xs">
                ID
                <input value={g.id} onChange={e => patchGap(idx, { id: e.target.value })}
                  className="border border-line rounded-lg px-2 py-1 bg-transparent w-28" />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Antwort
                <input value={g.answer} onChange={e => patchGap(idx, { answer: e.target.value })}
                  className="border border-line rounded-lg px-2 py-1 bg-transparent w-40" />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Typ
                <select value={g.type} onChange={e => patchGap(idx, { type: e.target.value as LueckentextGap["type"] })}
                  className="border border-line rounded-lg px-2 py-1 bg-transparent">
                  <option value="word_bank">word_bank</option>
                  <option value="free_type">free_type</option>
                  <option value="multiple_choice">multiple_choice</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Schwierigkeit
                <select value={g.difficulty} onChange={e => patchGap(idx, { difficulty: e.target.value as LueckentextGap["difficulty"] })}
                  className="border border-line rounded-lg px-2 py-1 bg-transparent">
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Hinweis
                <input value={g.hint ?? ""} onChange={e => patchGap(idx, { hint: e.target.value || null })}
                  className="border border-line rounded-lg px-2 py-1 bg-transparent w-40" />
              </label>
              <button onClick={() => removeGap(idx)} className="text-xs text-red-400 hover:underline mb-1">Löschen</button>
            </div>
            {g.type === "multiple_choice" && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted">Antwortmöglichkeiten (2–4)</span>
                {(g.choices ?? []).map((c, cIdx) => (
                  <div key={cIdx} className="flex gap-2 items-center">
                    <input value={c} onChange={e => patchChoice(idx, cIdx, e.target.value)}
                      className="border border-line rounded-lg px-2 py-1 bg-transparent text-xs w-48" />
                    <button onClick={() => removeChoice(idx, cIdx)} className="text-xs text-red-400 hover:underline">×</button>
                  </div>
                ))}
                <button onClick={() => addChoice(idx)} className="text-xs border border-line rounded-lg px-2 py-0.5 w-fit hover:border-accent">
                  + Antwortmöglichkeit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm">Distraktoren</h2>
        <p className="text-xs text-muted">Zusätzliche Wörter für die Wortbank (nie eine richtige Antwort).</p>
        {draft.distractors.map((d, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input value={d} onChange={e => patchDistractor(idx, e.target.value)}
              className="border border-line rounded-lg px-2 py-1 bg-transparent text-sm w-48" />
            <button onClick={() => removeDistractor(idx)} className="text-xs text-red-400 hover:underline">×</button>
          </div>
        ))}
        <button onClick={addDistractor} className="text-xs border border-line rounded-lg px-2 py-1 w-fit hover:border-accent">
          + Distraktor
        </button>
      </div>

      {isTeacher && <SessionHistory setId={setId} />}
    </div>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "ohne Datum";
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<string, string> = { waiting: "wartet", active: "läuft", finished: "beendet" };

/** Past sessions of this Lückentext — the way back to an Auswertung once the
 *  join code has scrolled out of the browser history. Own sessions only. */
function SessionHistory({ setId }: { setId: number }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const { data: sessions = [], isLoading } = useQuery<LueckentextSessionOut[]>({
    queryKey: ["lueckentext-sessions", setId],
    queryFn: () => api.lueckentexte.sessions(setId),
    enabled: Number.isFinite(setId),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.lueckentexte.deleteSession(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lueckentext-sessions", setId] }),
    onError: (e: Error) => toast(parseUploadError(e, "Löschen fehlgeschlagen").message, "error"),
  });

  return (
    <section className="card p-4 flex flex-col gap-2">
      <h2 className="font-semibold text-sm">Sitzungen</h2>
      {isLoading ? (
        <p className="text-sm text-muted">Lade…</p>
      ) : (
        <SessionGrid
          items={sessions.map((s): SessionCardItem => ({
            code: s.join_code,
            title: `${s.participant_count} ${s.participant_count === 1 ? "Teilnehmer" : "Teilnehmende"}`,
            status: {
              label: STATUS_LABEL[s.status] ?? s.status,
              tone: s.status === "active" ? "live" : s.status === "waiting" ? "waiting" : "done",
            },
            meta: [formatWhen(s.created_at)],
          }))}
          empty="Noch keine Sitzungen gestartet."
          renderActions={(item) => {
            const s = sessions.find(x => x.join_code === item.code)!;
            return (
              <>
                <SessionAction onClick={() => router.push(`/aktivitaeten/lueckentext/host/${s.join_code}`)}>
                  Sitzung
                </SessionAction>
                <SessionAction onClick={() => router.push(`/aktivitaeten/lueckentext/review/${s.join_code}`)}>
                  Auswertung
                </SessionAction>
                <SessionAction href={api.lueckentexte.reportCsvUrl(s.join_code)}>CSV</SessionAction>
                <SessionAction
                  danger
                  disabled={deleteMut.isPending}
                  onClick={() => {
                    const what = s.participant_count > 0
                      ? `Sitzung ${s.join_code} mit der Auswertung von ${s.participant_count} Teilnehmenden löschen?`
                      : `Sitzung ${s.join_code} löschen?`;
                    if (confirm(what)) deleteMut.mutate(s.join_code);
                  }}
                >
                  🗑
                </SessionAction>
              </>
            );
          }}
        />
      )}
    </section>
  );
}
