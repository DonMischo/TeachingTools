"use client";
import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, QuizOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const QUIZ_TYPE_LABELS: Record<string, string> = {
  classic: "Klassisch",
  tue: "TÜ",
  test: "Test",
  assignment: "Aufgabe",
  competition: "Wettbewerb",
  custom: "Benutzerdefiniert",
};

const QUIZ_TYPE_COLORS: Record<string, string> = {
  classic:     "bg-blue-900/40 text-blue-300 border-blue-800",
  tue:         "bg-green-900/40 text-green-300 border-green-800",
  test:        "bg-orange-900/40 text-orange-300 border-orange-800",
  assignment:  "bg-purple-900/40 text-purple-300 border-purple-800",
  competition: "bg-yellow-900/40 text-yellow-300 border-yellow-800",
  custom:      "bg-gray-800/60 text-gray-400 border-gray-700",
};

const ALL_TYPE_KEYS = ["classic", "tue", "test", "assignment", "competition", "custom"];
const GRADES = [5, 6, 7, 8, 9, 10];

export default function CaputhsPage() {
  const qc = useQueryClient();
  const { auth } = useAuth();
  const { data: capuths = [], isLoading } = useQuery({
    queryKey: ["capuths"],
    queryFn: api.capuths.list,
  });

  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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
      router.push(`/capuths/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Caputh-Bibliothek</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          {auth && (
            <Link href="/capuths/gruppenauswertung"
              className="px-3 py-1.5 text-sm border border-indigo-700 text-indigo-300 rounded-lg hover:bg-indigo-900/30 transition-colors">
              📊 Gruppenauswertung
            </Link>
          )}
          <a href="/api/capuths/template" download="caputh_vorlage.json"
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:border-gray-500 transition-colors">
            Vorlage
          </a>
          {auth && (
            <label className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700 transition-colors">
              {uploading ? "Hochladen…" : "+ Hochladen"}
              <input ref={fileRef} type="file" accept=".json,.zip" className="hidden"
                onChange={handleUpload} disabled={uploading} />
            </label>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 p-3 bg-red-900/30 border border-red-800 text-red-300 rounded-lg text-sm">{error}</p>
      )}

      {/* Filters */}
      <div className="space-y-3 mb-5">
        {/* Type filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTypeFilter(null)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              !typeFilter ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--border)] text-gray-400 hover:border-gray-500"
            }`}>
            Alle Typen <span className="opacity-60">{capuths.length}</span>
          </button>
          {ALL_TYPE_KEYS.filter(t => typeCounts[t]).map(t => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                typeFilter === t ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--border)] text-gray-400 hover:border-gray-500"
              }`}>
              {QUIZ_TYPE_LABELS[t]} <span className="opacity-60">{typeCounts[t]}</span>
            </button>
          ))}
        </div>

        {/* Grade filter */}
        {Object.keys(gradeCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 mr-1">Klasse:</span>
            <button onClick={() => setGradeFilter(null)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                gradeFilter == null ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--border)] text-gray-400 hover:border-gray-500"
              }`}>
              Alle
            </button>
            {GRADES.filter(g => gradeCounts[g]).map(g => (
              <button key={g} onClick={() => setGradeFilter(gradeFilter === g ? null : g)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  gradeFilter === g ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--border)] text-gray-400 hover:border-gray-500"
                }`}>
                {g}. Klasse <span className="opacity-60">{gradeCounts[g]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 mr-1">Tags:</span>
            {allTags.map(tag => (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  activeTags.has(tag) ? "border-indigo-500 bg-indigo-900/30 text-indigo-300" : "border-[var(--border)] text-gray-500 hover:border-gray-500"
                }`}>
                {tag}
              </button>
            ))}
          </div>
        )}

        {hasFilters && (
          <button onClick={() => { setTypeFilter(null); setGradeFilter(null); setActiveTags(new Set()); }}
            className="text-xs text-gray-500 hover:text-white transition-colors">
            × Filter zurücksetzen
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-gray-400">Wird geladen…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p>{hasFilters ? "Keine Capuths für diese Filter." : "Noch keine Capuths vorhanden."}</p>
          {!hasFilters && <p className="text-sm mt-1">Lade eine JSON- oder ZIP-Datei hoch.</p>}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((q) => (
            <QuizCard key={q.id} quiz={q} canDelete={!!auth}
              onDelete={() => deleteMutation.mutate(q.id)}
              activeTagFilter={activeTags} onTagClick={toggleTag} />
          ))}
        </ul>
      )}
    </div>
  );
}

function QuizCard({
  quiz, canDelete, onDelete, activeTagFilter, onTagClick,
}: {
  quiz: QuizOut;
  canDelete: boolean;
  onDelete: () => void;
  activeTagFilter: Set<string>;
  onTagClick: (t: string) => void;
}) {
  const typeColor = QUIZ_TYPE_COLORS[quiz.quiz_type] ?? QUIZ_TYPE_COLORS.custom;
  const typeLabel = QUIZ_TYPE_LABELS[quiz.quiz_type] ?? quiz.quiz_type;

  return (
    <li className="flex items-center justify-between gap-4 p-4 border border-[var(--border)] bg-[var(--surface)] rounded-xl hover:border-gray-600 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="font-semibold truncate">{quiz.title}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${typeColor}`}>{typeLabel}</span>
          {quiz.grades.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-gray-700 text-gray-400 shrink-0">
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
                  ? "border-indigo-500 bg-indigo-900/30 text-indigo-300"
                  : "border-gray-700 text-gray-500 hover:border-gray-500"
              }`}>
              {tag}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Link href={`/capuths/${quiz.id}`}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          Starten
        </Link>
        {canDelete && (
          <button onClick={onDelete}
            className="px-3 py-1.5 text-sm border border-red-900 text-red-400 rounded-lg hover:bg-red-900/20 transition-colors">
            Löschen
          </button>
        )}
      </div>
    </li>
  );
}
