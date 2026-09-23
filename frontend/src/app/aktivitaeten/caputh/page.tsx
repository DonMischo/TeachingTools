"use client";
import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, QuizOut, ClassOut, ClassPoints } from "@/lib/api";
import { SessionGrid, SessionAction, type SessionCardItem } from "@/components/SessionGrid";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useAvailability } from "@/hooks/useAvailability";
import { UploadErrorDialog } from "@/components/UploadErrorDialog";
import { parseUploadError, UploadError } from "@/lib/uploadError";

const QUIZ_TYPE_LABELS: Record<string, string> = {
  classic: "Klassisch",
  tue: "TÜ",
  test: "Test",
  assignment: "Aufgabe",
  competition: "Wettbewerb",
  custom: "Benutzerdefiniert",
};

const QUIZ_TYPE_COLORS: Record<string, string> = {
  classic:     "bg-blue-500/15 text-blue-400 border-blue-500/30",
  tue:         "bg-green-500/15 text-green-400 border-green-500/30",
  test:        "bg-orange-500/15 text-orange-400 border-orange-500/30",
  assignment:  "bg-purple-500/15 text-purple-400 border-purple-500/30",
  competition: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  custom:      "bg-[var(--surface-hover)] text-[var(--text-muted)] border-[var(--border)]",
};

const ALL_TYPE_KEYS = ["classic", "tue", "test", "assignment", "competition", "custom"];
const GRADES = [5, 6, 7, 8, 9, 10];

type SessionRow = {
  join_code: string;
  status: string;
  class_id: number | null;
  group_id: number | null;
  /** »9a« bzw. »9 NaT« — bei einem Kurs/WPF steckt keine Klasse dahinter. */
  scope_label: string;
  participant_count: number;
  points_awarded: number | null;
  /** Je Klasse eine Zeile — bei einer klassenübergreifenden Runde mehrere. */
  points_by_class: ClassPoints[];
  started_at: string | null;
  finished_at: string | null;
};

export default function CaputhsPage() {
  const qc = useQueryClient();
  const { auth } = useAuth();
  const { can } = useAvailability();
  const { data: capuths = [], isLoading } = useQuery({
    queryKey: ["capuths"],
    queryFn: api.capuths.list,
  });

  const { data: classes = [] } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    staleTime: 60_000,
  });

  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.capuths.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capuths"] }),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const created = await api.capuths.upload(file);
      qc.invalidateQueries({ queryKey: ["capuths"] });
      if (created.warning) setError(`⚠️ ${created.warning}`);
      router.push(`/aktivitaeten/caputh/${created.id}`);
    } catch (err: unknown) {
      setUploadError(parseUploadError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggleTag(tag: string) {
    setActiveTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  // Collect all unique tags across all quizzes
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const q of capuths) for (const t of q.tags) set.add(t);
    return Array.from(set).sort();
  }, [capuths]);

  // Type counts (for badges)
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const q of capuths) m[q.quiz_type] = (m[q.quiz_type] ?? 0) + 1;
    return m;
  }, [capuths]);

  // Grade counts
  const gradeCounts = useMemo(() => {
    const m: Record<number, number> = {};
    for (const q of capuths) for (const g of q.grades) m[g] = (m[g] ?? 0) + 1;
    return m;
  }, [capuths]);

  const filtered = useMemo(() => capuths.filter(q => {
    if (typeFilter && q.quiz_type !== typeFilter) return false;
    if (gradeFilter != null && !q.grades.includes(gradeFilter)) return false;
    if (activeTags.size > 0 && !q.tags.some(t => activeTags.has(t))) return false;
    return true;
  }), [capuths, typeFilter, gradeFilter, activeTags]);

  const hasFilters = typeFilter || gradeFilter != null || activeTags.size > 0;

  if (!auth) {
    return <div className="p-8 text-[var(--text-muted)]">Bitte einloggen.</div>;
  }
  const isTeacher = auth.role === "teacher" || auth.role === "admin";

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <Link href="/aktivitaeten" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Aktivitäten</Link>
          <h1 className="text-2xl font-bold mt-1">Caputh-Bibliothek</h1>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {isTeacher && (
            <Link href="/aktivitaeten/caputh/gruppenauswertung"
              className="px-3 py-1.5 text-sm border border-[var(--accent)] text-[var(--accent)] rounded-lg hover:bg-[var(--accent)]/10 transition-colors">
              📊 Gruppenauswertung
            </Link>
          )}
          <a href="/api/capuths/template" download="caputh_vorlage.json"
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:border-[var(--text-muted)] transition-colors">
            Vorlage
          </a>
          {auth && can("caputh", "upload") && (
            <label className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg cursor-pointer hover:opacity-90 transition-opacity">
              {uploading ? "Hochladen…" : "+ Hochladen"}
              <input ref={fileRef} type="file" accept=".json,.zip" className="hidden"
                onChange={handleUpload} disabled={uploading} />
            </label>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">{error}</p>
      )}

      {/* Filters */}
      <div className="space-y-3 mb-5">
        {/* Type filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTypeFilter(null)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              !typeFilter ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
            }`}>
            Alle Typen <span className="opacity-60">{capuths.length}</span>
          </button>
          {ALL_TYPE_KEYS.filter(t => typeCounts[t]).map(t => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                typeFilter === t ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
              }`}>
              {QUIZ_TYPE_LABELS[t]} <span className="opacity-60">{typeCounts[t]}</span>
            </button>
          ))}
        </div>

        {/* Grade filter */}
        {Object.keys(gradeCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-[var(--text-muted)] mr-1">Klasse:</span>
            <button onClick={() => setGradeFilter(null)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                gradeFilter == null ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
              }`}>
              Alle
            </button>
            {GRADES.filter(g => gradeCounts[g]).map(g => (
              <button key={g} onClick={() => setGradeFilter(gradeFilter === g ? null : g)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  gradeFilter === g ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                }`}>
                {g}. Klasse <span className="opacity-60">{gradeCounts[g]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-[var(--text-muted)] mr-1">Tags:</span>
            {allTags.map(tag => (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  activeTags.has(tag) ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                }`}>
                {tag}
              </button>
            ))}
          </div>
        )}

        {hasFilters && (
          <button onClick={() => { setTypeFilter(null); setGradeFilter(null); setActiveTags(new Set()); }}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            × Filter zurücksetzen
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-[var(--text-muted)]">Wird geladen…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <p className="text-4xl mb-2">📋</p>
          <p>{hasFilters ? "Keine Capuths für diese Filter." : "Noch keine Capuths vorhanden."}</p>
          {!hasFilters && <p className="text-sm mt-1">Lade eine JSON- oder ZIP-Datei hoch.</p>}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((q) => (
            <QuizCard key={q.id} quiz={q} canDelete={isTeacher} classes={classes}
              onDelete={() => deleteMutation.mutate(q.id)}
              activeTagFilter={activeTags} onTagClick={toggleTag} />
          ))}
        </ul>
      )}

      <UploadErrorDialog error={uploadError} onClose={() => setUploadError(null)} />
    </div>
  );
}

function SessionsSection({ quizId, classes }: { quizId: number; classes: ClassOut[] }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  const { data: sessions = [], isLoading } = useQuery<SessionRow[]>({
    queryKey: ["caputh-sessions", quizId],
    queryFn: () => api.capuths.listSessions(quizId),
  });

  const deleteMut = useMutation({
    mutationFn: (code: string) => api.capuths.deleteSession(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caputh-sessions", quizId] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  const clearMut = useMutation({
    mutationFn: () => api.capuths.clearSessions(quizId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caputh-sessions", quizId] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  const resetMut = useMutation({
    mutationFn: (code: string) => api.capuths.resetSession(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caputh-sessions", quizId] }),
    onError: (e: unknown) => toast((e as Error).message ?? "Fehler", "error"),
  });

  if (isLoading) return <p className="text-xs text-[var(--text-muted)] pt-2">Laden…</p>;

  return (
    <div className="border-t border-[var(--border)] pt-3 mt-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Sessions</span>
        {sessions.length > 0 && (
          <button
            onClick={() => {
              if (confirm("Alle Sessions löschen? Bereits vergebene Punkte bleiben erhalten.")) clearMut.mutate();
            }}
            disabled={clearMut.isPending}
            className="text-xs text-red-400/80 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            Alle löschen
          </button>
        )}
      </div>
      <SessionGrid
        items={sessions.map((s): SessionCardItem => {
          const cls = s.class_id != null ? classes.find(c => c.id === s.class_id) : undefined;
          // Bei mehreren Klassen sagt die Summe wenig — dann steht hier, was
          // jede einzelne bekommen hat.
          const points = s.points_by_class.length > 1
            ? s.points_by_class.map(c => `${c.class_code}: ${c.points} Pkt.`)
            : s.points_awarded !== null ? [`${s.points_awarded} Pkt.`] : [];
          return {
            code: s.join_code,
            title: cls?.display_name ?? s.scope_label,
            status: s.status === "active" ? { label: "Läuft", tone: "live" }
              : s.status === "waiting" ? { label: "Wartet", tone: "waiting" }
              : { label: "Beendet", tone: "done" },
            meta: [
              `${s.participant_count} Teiln.`,
              ...points,
            ],
          };
        })}
        renderActions={(item) => {
          const s = sessions.find(x => x.join_code === item.code)!;
          const scored = s.points_awarded !== null;
          return (
            <>
              {s.status !== "finished" && (
                <SessionAction onClick={() => router.push(`/aktivitaeten/caputh/host/${s.join_code}`)}>
                  Öffnen
                </SessionAction>
              )}
              {scored && (
                <SessionAction href={`/api/sessions/${s.join_code}/report?fmt=csv`} download>
                  ↓ Bericht
                </SessionAction>
              )}
              {!scored && (
                <SessionAction onClick={() => resetMut.mutate(s.join_code)} disabled={resetMut.isPending}>
                  ↺ Reset
                </SessionAction>
              )}
              <SessionAction
                danger
                onClick={() => deleteMut.mutate(s.join_code)}
                disabled={deleteMut.isPending}
                title="Session löschen (Punkte bleiben erhalten)"
              >
                ✕
              </SessionAction>
            </>
          );
        }}
      />
    </div>
  );
}

function QuizCard({
  quiz, canDelete, classes, onDelete, activeTagFilter, onTagClick,
}: {
  quiz: QuizOut;
  canDelete: boolean;
  classes: ClassOut[];
  onDelete: () => void;
  activeTagFilter: Set<string>;
  onTagClick: (t: string) => void;
}) {
  // Standardmaessig offen: die Sitzungen sind der Grund, warum man hier ist.
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const typeColor = QUIZ_TYPE_COLORS[quiz.quiz_type] ?? QUIZ_TYPE_COLORS.custom;
  const typeLabel = QUIZ_TYPE_LABELS[quiz.quiz_type] ?? quiz.quiz_type;

  return (
    <li className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-xl hover:border-[var(--text-muted)] transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-semibold truncate">{quiz.title}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${typeColor}`}>{typeLabel}</span>
            {quiz.grades.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] shrink-0">
                Kl. {quiz.grades.length === 1 ? quiz.grades[0] : `${Math.min(...quiz.grades)}–${Math.max(...quiz.grades)}`}
              </span>
            )}
          </div>
          {quiz.description && (
            <p className="text-sm text-[var(--text-muted)] truncate">{quiz.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-[var(--text-muted)]">
              {quiz.question_count} Fragen · max. {quiz.max_points} Punkte
            </p>
            {quiz.tags.map(tag => (
              <button key={tag} onClick={() => onTagClick(tag)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  activeTagFilter.has(tag)
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                }`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {canDelete && (
            <button onClick={() => setSessionsOpen(v => !v)}
              className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                sessionsOpen
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
              }`}>
              Sessions {sessionsOpen ? "▴" : "▾"}
            </button>
          )}
          {canDelete && (
            <Link href={`/aktivitaeten/caputh/${quiz.id}`}
              className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity">
              Starten
            </Link>
          )}
          {canDelete && (
            <button onClick={onDelete}
              className="px-3 py-1.5 text-sm border border-red-400/30 text-red-400 rounded-lg hover:bg-red-400/10 transition-colors">
              Löschen
            </button>
          )}
        </div>
      </div>
      {sessionsOpen && <SessionsSection quizId={quiz.id} classes={classes} />}
    </li>
  );
}
