"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, StudentOut, SportfestDiscipline, SportfestResult } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

const DISC_LABELS: Record<string, string> = {
  sprint: "Sprint",
  ausdauerlauf: "Ausdauer",
  weitsprung: "Weitsprung",
  ballwurf: "Ballwurf",
};

const DISC_PLACEHOLDER: Record<string, string> = {
  sprint: "9.50",
  ausdauerlauf: "4:30.0",
  weitsprung: "4.50",
  ballwurf: "25.80",
};

function ResultCell({
  student, discipline, result, disabled,
}: {
  student: StudentOut;
  discipline: SportfestDiscipline;
  result?: SportfestResult;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState(result?.value != null ? String(result.value) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(result?.value != null ? String(result.value) : "");
  }, [result]);

  async function save(raw: string) {
    if (!raw.trim()) {
      await api.sportfest.results.delete(student.id, discipline.id);
    } else {
      await api.sportfest.results.upsert(student.id, discipline.id, raw);
    }
    qc.invalidateQueries({ queryKey: ["sf-results"] });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={DISC_PLACEHOLDER[discipline.id] ?? ""}
        disabled={disabled}
        onChange={e => setValue(e.target.value)}
        onBlur={async e => {
          if (e.target.value === (result?.value != null ? String(result.value) : "")) return;
          setSaving(true);
          try { await save(e.target.value); } finally { setSaving(false); }
        }}
        className="input text-xs py-1 px-2 w-24"
      />
      <span className="absolute right-1 top-1 text-[10px] text-[var(--text-muted)]">
        {saving ? "⏳" : saved ? "✓" : result?.points != null ? result.points : ""}
      </span>
    </div>
  );
}

export default function SportfestErgebnissePage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [klasse, setKlasse] = useState("5a");

  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";
  useEffect(() => {
    if (auth !== null && !isTeacher) router.replace("/tools/sportfest");
  }, [auth, isTeacher, router]);

  const { data: disciplines = [] } = useQuery<SportfestDiscipline[]>({
    queryKey: ["sf-disciplines"],
    queryFn: api.sportfest.disciplines.list,
  });
  const enabledDisc = disciplines.filter(d => d.enabled);

  const { data: students = [] } = useQuery<StudentOut[]>({
    queryKey: ["students", klasse],
    queryFn: () => api.students.list({ klasse }),
    enabled: !!klasse,
  });

  const { data: results = [] } = useQuery<SportfestResult[]>({
    queryKey: ["sf-results", klasse],
    queryFn: () => api.sportfest.results.list({ klasse }),
    enabled: !!klasse,
  });

  const resultMap = new Map(results.map(r => [`${r.student_id}:${r.discipline_id}`, r]));

  const CLASSES = [5,6,7,8,9,10].flatMap(g => ["a","b","c"].map(s => `${g}${s}`));

  if (!isTeacher) return null;

  return (
    <div className="flex flex-col gap-4 p-4 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/tools/sportfest" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0">← Sportfest</Link>
        <h1 className="text-xl font-black tracking-tight">✏️ Ergebnisse erfassen</h1>
        <select value={klasse} onChange={e => setKlasse(e.target.value)} className="input text-sm py-1.5 w-24">
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {students.length === 0 ? (
        <div className="text-[var(--text-muted)] text-sm p-4 border border-dashed border-[var(--border)] rounded-2xl text-center">
          Keine Schüler für Klasse {klasse}. Bitte zuerst CSV importieren.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
                <th className="text-left px-3 py-2">Nr</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Geschl.</th>
                {enabledDisc.map(d => (
                  <th key={d.id} className="text-left px-3 py-2 whitespace-nowrap">{DISC_LABELS[d.id] ?? d.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} className="border-b border-[var(--border)]/50">
                  <td className="px-3 py-1.5 text-[var(--text-muted)]">{s.nummer ?? ""}</td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap">{s.nachname}, {s.vorname}</td>
                  <td className="px-3 py-1.5 text-[var(--text-muted)]">
                    {/* Ohne den Schalter »Geschlecht anzeigen« liefert das
                        Backend hier null — dann »—« statt fälschlich »w«. */}
                    {s.geschlecht === "männlich" ? "m" : s.geschlecht === "weiblich" ? "w" : "—"}
                  </td>
                  {enabledDisc.map(d => (
                    <td key={d.id} className="px-3 py-1">
                      <ResultCell
                        student={s}
                        discipline={d}
                        result={resultMap.get(`${s.id}:${d.id}`)}
                        disabled={false}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
