"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ClassOut, TeacherOut, WochenstundenOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useAdminAccess } from "@/hooks/useAdminAccess";

function Hint({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex">
      <span className="w-4 h-4 rounded-full border border-line text-muted text-[10px] flex items-center justify-center cursor-default select-none hover:border-accent hover:text-accent transition-colors">?</span>
      <span className="absolute left-5 top-0 z-50 hidden group-hover:block w-72 bg-surface border border-line rounded-xl p-3 text-xs text-muted shadow-lg leading-relaxed">
        {text}
      </span>
    </span>
  );
}

const SUBJECTS = ["Ma", "De", "En", "Bio", "Ph", "Ch", "Ge", "Geo", "Sp", "Mu", "Ku", "Inf", "WAT", "LER", "Re", "Wahlpflicht"];
const KURS_SUBJECTS = new Set(["Ma", "De", "En"]);
const GRADES = [5, 6, 7, 8, 9, 10];

function gradeOf(code: string): number | null {
  const m = code.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

// ── Fächerverteilung — Teachers × Subjects, cell = classes assigned ────────
// Merged: Klassenleitung right after the name, Korrektur/Notiz/Gesamt at the end.

function KlassenleitungCell({ teacher, classes }: { teacher: TeacherOut; classes: ClassOut[] }) {
  const qc = useQueryClient();
  const klasseMut = useMutation({
    mutationFn: (klasse_id: number | null) => api.teachers.setKlasse(teacher.id, klasse_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teachers"] }),
  });
  return (
    <td className="py-1 px-1.5 border-l border-line/30">
      <select
        className="input text-xs py-1 w-20"
        value={teacher.klasse_id ?? ""}
        onChange={e => klasseMut.mutate(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">—</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
      </select>
    </td>
  );
}

/** Diff of contracted hours (AvSt) vs assigned WS: green = fully spent,
 * orange = hours still open, red = over the contract limit. */
function avstDiffClass(diff: number | null): string {
  if (diff == null) return "text-muted";
  if (diff === 0) return "text-green-500";
  if (diff > 0) return "text-orange-400";
  return "text-red-500";
}

function KorrekturNotizCells({ teacher }: { teacher: TeacherOut }) {
  const qc = useQueryClient();
  const [notiz, setNotiz] = useState(teacher.notiz ?? "");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["teachers"] });

  const korrekturMut = useMutation({
    mutationFn: (korrektur: number) => api.teachers.setKorrektur(teacher.id, { korrektur, notiz }),
    onSuccess: invalidate,
  });
  const notizMut = useMutation({
    mutationFn: () => api.teachers.setKorrektur(teacher.id, { korrektur: teacher.korrektur, notiz }),
    onSuccess: invalidate,
  });
  const avMut = useMutation({
    mutationFn: (av: number | null) => api.teachers.setKorrektur(teacher.id, {
      korrektur: teacher.korrektur, notiz,
      av_stunden: av ?? undefined, clear_av_stunden: av == null,
    }),
    onSuccess: invalidate,
  });

  const diff = teacher.av_stunden != null ? teacher.av_stunden - teacher.total_ws : null;

  return (
    <>
      <td className="py-1 px-1.5 border-l border-line/30">
        <input type="number" className="input text-xs py-1 w-14 text-center"
          defaultValue={teacher.korrektur}
          onBlur={e => korrekturMut.mutate(Number(e.target.value) || 0)}
        />
      </td>
      <td className="py-1 px-1.5">
        <input className="input text-xs py-1 w-64 min-w-[150px]" placeholder="z. B. Abminderung Fachleitung"
          value={notiz} onChange={e => setNotiz(e.target.value)} onBlur={() => notizMut.mutate()}
        />
      </td>
      <td className="py-1 px-1.5 border-l border-line/30">
        <input type="number" min={0} className="input text-xs py-1 w-14 text-center"
          defaultValue={teacher.av_stunden ?? ""}
          placeholder="–"
          title="Stunden nach Arbeitsvertrag"
          onBlur={e => avMut.mutate(e.target.value === "" ? null : Number(e.target.value))}
        />
      </td>
      <td className={`py-1 px-1.5 text-center font-semibold tabular-nums border-l border-line/30 ${avstDiffClass(diff)}`}
        title={diff == null ? "AvSt nicht gesetzt" : diff === 0 ? "voll verplant" : diff > 0 ? `${diff} WS offen` : `${-diff} WS über AvSt`}>
        {diff == null ? "–" : diff > 0 ? `+${diff}` : diff}
      </td>
      <td className="py-1 px-3 text-sm font-semibold text-right tabular-nums border-l border-line/30">
        {teacher.total_ws}
      </td>
    </>
  );
}

function ClassCheckboxCell({ teacher, subject, classes, teachers }: {
  teacher: TeacherOut; subject: string; classes: ClassOut[]; teachers: TeacherOut[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["teachers"] });

  const addMut = useMutation({
    mutationFn: (classId: number) => api.teachers.addAssignment(teacher.id, { subject, class_id: classId }),
    onSuccess: invalidate,
  });
  const removeMut = useMutation({
    mutationFn: (assignmentId: number) => api.teachers.deleteAssignment(assignmentId),
    onSuccess: invalidate,
  });

  // Kl. 9/10 Ma/De/En run in the Kurssystem (separate group-based assignment), not per class here.
  const eligibleClasses = KURS_SUBJECTS.has(subject)
    ? classes.filter(c => { const g = gradeOf(c.code); return g == null || g < 9; })
    : classes;

  const myAssignments = teacher.assignments.filter(a => a.subject === subject && a.class_id != null);
  const myClassIds = new Set(myAssignments.map(a => a.class_id));

  // Classes already taken by someone else for this subject — hidden so the
  // Schulleiter can see at a glance what's still unassigned.
  const takenElsewhere = new Set<number>();
  for (const t of teachers) {
    if (t.id === teacher.id) continue;
    for (const a of t.assignments) {
      if (a.subject === subject && a.class_id != null) takenElsewhere.add(a.class_id);
    }
  }

  const selectable = eligibleClasses.filter(c => !takenElsewhere.has(c.id));

  function toggle(c: ClassOut) {
    if (myClassIds.has(c.id)) {
      const a = myAssignments.find(a => a.class_id === c.id);
      if (a) removeMut.mutate(a.id);
    } else {
      addMut.mutate(c.id);
    }
  }

  return (
    <td className="py-1 px-1.5 border-l border-line/30 relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-full text-xs text-left px-1.5 py-1 rounded-sm border border-transparent hover:border-line transition-colors min-h-7">
        {myAssignments.length > 0
          ? (
            <span className="flex flex-col gap-0.5">
              {myAssignments.map(a => <span key={a.id} className="whitespace-nowrap">{a.class_code}</span>)}
            </span>
          )
          : <span className="text-muted">—</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-50 mt-1 w-40 max-h-56 overflow-y-auto bg-surface border border-line rounded-lg shadow-xl p-2 flex flex-col gap-0.5">
            {selectable.length === 0 && (
              <span className="text-xs text-muted px-1 py-1">Keine Klassen offen</span>
            )}
            {selectable.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-xs px-1 py-0.5 rounded-sm hover:bg-surface-hover cursor-pointer">
                <input type="checkbox" checked={myClassIds.has(c.id)} onChange={() => toggle(c)} />
                {c.code}
              </label>
            ))}
          </div>
        </>
      )}
    </td>
  );
}

const GROUP_ASSIGNMENT_GRADE = 9; // Kurs/Wahlpflicht groups: representative grade for WS lookup (matches backend)

function assignmentHours(subject: string, classCode: string | null, groupId: number | null, wsByKey: Map<string, number>): number {
  if (groupId != null) return wsByKey.get(`${subject}|${GROUP_ASSIGNMENT_GRADE}`) ?? 0;
  const grade = classCode ? gradeOf(classCode) : null;
  return grade != null ? (wsByKey.get(`${subject}|${grade}`) ?? 0) : 0;
}

/** Assigned Wochenstunden per subject, summed across every teacher's assignments. */
function computeAssignedTotals(teachers: TeacherOut[], wsByKey: Map<string, number>): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(SUBJECTS.map(s => [s, 0]));
  for (const t of teachers) {
    for (const a of t.assignments) {
      totals[a.subject] = (totals[a.subject] ?? 0) + assignmentHours(a.subject, a.class_code, a.group_id, wsByKey);
    }
  }
  return totals;
}

function countClassesByGrade(classes: ClassOut[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const c of classes) {
    const g = gradeOf(c.code);
    if (g != null) counts[g] = (counts[g] ?? 0) + 1;
  }
  return counts;
}

function useWochenstundenLookup() {
  const { data: wsRows = [] } = useQuery<WochenstundenOut[]>({
    queryKey: ["wochenstunden"],
    queryFn: api.teachers.getWochenstunden,
  });
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const r of wsRows) m.set(`${r.subject}|${r.grade}`, r.hours);
    return m;
  }, [wsRows]);
}

function FaecherverteilungTable({ teachers, classes }: { teachers: TeacherOut[]; classes: ClassOut[] }) {
  const wsByKey = useWochenstundenLookup();
  const subjectTotals = useMemo(() => computeAssignedTotals(teachers, wsByKey), [teachers, wsByKey]);
  const grandTotal = teachers.reduce((sum, t) => sum + t.total_ws, 0);
  const avTotal = teachers.reduce((sum, t) => sum + (t.av_stunden ?? 0), 0);
  const diffTotal = avTotal - grandTotal;

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="py-2 px-3 text-left sticky left-0 z-20 bg-surface text-muted font-semibold">Lehrkraft</th>
            <th className="py-2 px-1.5 text-muted font-semibold border-l border-line/30">Klassenleitung</th>
            {SUBJECTS.map(s => (
              <th key={s} className="py-2 px-1.5 text-muted font-semibold border-l border-line/30 min-w-[48px]">{s}</th>
            ))}
            <th className="py-2 px-1.5 text-muted font-semibold border-l border-line/30">Korrektur</th>
            <th className="py-2 px-1.5 text-left text-muted font-semibold">Notiz</th>
            <th className="py-2 px-1.5 text-muted font-semibold border-l border-line/30" title="Stunden nach Arbeitsvertrag">AvSt</th>
            <th className="py-2 px-1.5 text-muted font-semibold border-l border-line/30" title="AvSt minus zugewiesene WS">Diff</th>
            <th className="py-2 px-3 text-right text-muted font-semibold border-l border-line/30">Gesamt-WS</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map(t => (
            <tr key={t.id} className="border-t border-line/40">
              <td className="py-1 px-3 whitespace-nowrap sticky left-0 z-20 bg-page font-medium">{t.last_name}, {t.first_name}</td>
              <KlassenleitungCell teacher={t} classes={classes} />
              {SUBJECTS.map(s => (
                <ClassCheckboxCell key={s} teacher={t} subject={s} classes={classes} teachers={teachers} />
              ))}
              <KorrekturNotizCells teacher={t} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line">
            <td className="py-2 px-3 font-semibold sticky left-0 z-20 bg-surface">Summe WS</td>
            <td className="border-l border-line/30" />
            {SUBJECTS.map(s => (
              <td key={s} className="py-2 px-1.5 text-center font-semibold tabular-nums border-l border-line/30">
                {subjectTotals[s] || ""}
              </td>
            ))}
            <td className="border-l border-line/30" />
            <td />
            <td className="py-2 px-1.5 text-center font-semibold tabular-nums border-l border-line/30" title="Summe AvSt">
              {avTotal || ""}
            </td>
            <td className={`py-2 px-1.5 text-center font-semibold tabular-nums border-l border-line/30 ${avstDiffClass(avTotal ? diffTotal : null)}`}>
              {avTotal ? (diffTotal > 0 ? `+${diffTotal}` : diffTotal) : ""}
            </td>
            <td className="py-2 px-3 text-right font-bold tabular-nums border-l border-line/30">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Wochenstunden — Subjects × Grades, editable hours ──────────────────────

function WochenstundenTable({ teachers, classes }: { teachers: TeacherOut[]; classes: ClassOut[] }) {
  const qc = useQueryClient();
  const wsByKey = useWochenstundenLookup();

  const setMut = useMutation({
    mutationFn: (row: WochenstundenOut) => api.teachers.setWochenstunden([row]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wochenstunden"] }),
  });

  const gradeCounts = useMemo(() => countClassesByGrade(classes), [classes]);
  const assignedTotals = useMemo(() => computeAssignedTotals(teachers, wsByKey), [teachers, wsByKey]);

  // Total demand per subject = hours(subject, grade) × number of classes in that grade,
  // summed over all grades — how many Wochenstunden the subject actually needs school-wide.
  function neededFor(subject: string): number {
    return GRADES.reduce((sum, g) => sum + (wsByKey.get(`${subject}|${g}`) ?? 0) * (gradeCounts[g] ?? 0), 0);
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="py-2 px-3 text-left text-muted font-semibold">Fach</th>
            {GRADES.map(g => (
              <th key={g} className="py-2 px-1.5 text-muted font-semibold border-l border-line/30 w-20">{g}</th>
            ))}
            <th className="py-2 px-1.5 text-muted font-semibold border-l border-line/30">Summe</th>
            <th className="py-2 px-3 text-muted font-semibold border-l border-line/30">Zugewiesen / Gesamt</th>
          </tr>
        </thead>
        <tbody>
          {SUBJECTS.map(s => {
            const needed = neededFor(s);
            const assigned = assignedTotals[s] ?? 0;
            const fullyAssigned = assigned >= needed;
            return (
              <tr key={s} className="border-t border-line/40">
                <td className="py-1 px-3 font-medium">{s}</td>
                {GRADES.map(g => (
                  <td key={g} className="py-1 px-1.5 border-l border-line/30">
                    {/* Uncontrolled input: without the value in the key it keeps the
                        0 it mounted with before the query resolved — the key forces
                        a remount once the saved value arrives. */}
                    <input type="number" min={0}
                      key={`${s}|${g}|${wsByKey.get(`${s}|${g}`) ?? 0}`}
                      className="input text-xs py-1 w-16 text-center"
                      defaultValue={wsByKey.get(`${s}|${g}`) ?? 0}
                      onBlur={e => setMut.mutate({ subject: s, grade: g, hours: Number(e.target.value) || 0 })}
                    />
                  </td>
                ))}
                <td className="py-1 px-1.5 text-center font-semibold tabular-nums border-l border-line/30">
                  {needed || ""}
                </td>
                <td className={`py-1 px-3 text-center font-semibold tabular-nums border-l border-line/30 ${
                  needed === 0 ? "text-muted" : fullyAssigned ? "text-green-500" : "text-red-500"
                }`}>
                  {needed === 0 ? "–" : `${assigned}/${needed}`}
                  {needed > 0 && !fullyAssigned && <span className="ml-1" title="Nicht vollständig zugewiesen">⚠️</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Print / PDF export (browser print-to-PDF, same pattern as Schülerkarten) ──

function openPrintWindow(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

function printWochenstunden(teachers: TeacherOut[], classes: ClassOut[], wsByKey: Map<string, number>) {
  const gradeCounts = countClassesByGrade(classes);
  const assignedTotals = computeAssignedTotals(teachers, wsByKey);

  const rows = SUBJECTS.map(s => {
    const needed = GRADES.reduce((sum, g) => sum + (wsByKey.get(`${s}|${g}`) ?? 0) * (gradeCounts[g] ?? 0), 0);
    const assigned = assignedTotals[s] ?? 0;
    const cells = GRADES.map(g => `<td>${wsByKey.get(`${s}|${g}`) ?? 0}</td>`).join("");
    const statusClass = needed === 0 ? "muted" : assigned >= needed ? "ok" : "warn";
    const statusText = needed === 0 ? "–" : `${assigned}/${needed}`;
    return `<tr><td class="subject">${s}</td>${cells}<td class="num">${needed || ""}</td><td class="num ${statusClass}">${statusText}</td></tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wochenstunden-Übersicht</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; color: #111; margin: 0; }
    h1 { font-size: 14pt; margin: 0 0 3mm; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th, td { border: 1px solid #ccc; padding: 3px 6px; text-align: center; }
    th { background: #f0f0f0; }
    td.subject { text-align: left; font-weight: 600; }
    td.num { font-weight: 600; }
    td.ok { color: #16a34a; }
    td.warn { color: #dc2626; }
    td.muted { color: #999; }
  </style></head><body>
    <h1>Wochenstunden-Übersicht</h1>
    <table>
      <thead><tr><th>Fach</th>${GRADES.map(g => `<th>${g}</th>`).join("")}<th>Summe</th><th>Zugewiesen / Gesamt</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;

  openPrintWindow(html);
}

function printTeacherSheets(teachers: TeacherOut[], wsByKey: Map<string, number>) {
  const blocks = teachers.map(t => {
    const assignmentRows = t.assignments.map(a => {
      const hours = assignmentHours(a.subject, a.class_code, a.group_id, wsByKey);
      const target = a.class_code ?? a.group_name ?? "?";
      return `<tr><td>${a.subject}</td><td>${target}</td><td class="num">${hours}</td></tr>`;
    }).join("");
    const blankRows = Array.from({ length: 4 }).map(() =>
      `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`
    ).join("");

    return `<div class="half">
      <div class="head">
        <div class="name">${t.last_name}, ${t.first_name}${t.teacher_role ? ` <span class="role">(${t.teacher_role})</span>` : ""}</div>
        <div class="badges">
          ${t.klasse ? `<span class="badge">Klassenleitung ${t.klasse}</span>` : ""}
          <span class="badge total">Gesamt-WS: ${t.total_ws}</span>
        </div>
      </div>
      <table>
        <thead><tr><th>Fach</th><th>Klasse / Kurs</th><th>WS</th></tr></thead>
        <tbody>${assignmentRows}${blankRows}</tbody>
      </table>
      ${t.notiz ? `<div class="notiz">Notiz: ${t.notiz}${t.korrektur ? ` · Korrektur: ${t.korrektur > 0 ? "+" : ""}${t.korrektur}` : ""}</div>` : t.korrektur ? `<div class="notiz">Korrektur: ${t.korrektur > 0 ? "+" : ""}${t.korrektur}</div>` : ""}
    </div>`;
  });

  // Two teachers per page — top half / bottom half, dashed cut line between them.
  const pages: string[] = [];
  for (let i = 0; i < blocks.length; i += 2) {
    pages.push(`<div class="page">${blocks[i]}${blocks[i + 1] ?? '<div class="half"></div>'}</div>`);
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lehrkräfte-Zuweisungsplanung</title><style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; color: #111; margin: 0; }
    .page { height: 277mm; display: flex; flex-direction: column; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .half { flex: 1 1 50%; padding: 6mm 4mm; border-bottom: 1px dashed #999; overflow: hidden; }
    .half:last-child { border-bottom: none; }
    .head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 3mm; flex-wrap: wrap; gap: 2mm; }
    .name { font-size: 13pt; font-weight: 700; }
    .role { font-weight: 400; font-size: 9pt; color: #666; }
    .badges { display: flex; gap: 4mm; font-size: 8.5pt; }
    .badge { background: #eee; border-radius: 4px; padding: 2px 8px; }
    .badge.total { background: #dbeafe; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
    td.num { text-align: center; font-weight: 600; width: 15%; }
    th { background: #f5f5f5; }
    .notiz { margin-top: 2mm; font-size: 8.5pt; color: #555; }
  </style></head><body>${pages.join("")}</body></html>`;

  openPrintWindow(html);
}

export default function AdminTeachersPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const { ready: aReady, isAdmin: aAdmin, has: aHas } = useAdminAccess();
  const allowed = aAdmin || aHas("teachers");
  useEffect(() => {
    if (aReady && !allowed) router.replace("/");
  }, [aReady, allowed, router]);
  const { data: teachers = [] } = useQuery<TeacherOut[]>({
    queryKey: ["teachers"],
    queryFn: api.teachers.list,
    enabled: allowed,
  });
  const { data: classes = [] } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    enabled: allowed,
    staleTime: 60_000,
  });

  if (!auth || !aReady || !allowed) return null;

  return (
    <div className="flex flex-col gap-8 p-6 max-w-seite mx-auto w-full">
      <div>
        <button onClick={() => router.push("/admin")} className="mb-2 text-sm text-muted hover:text-fg transition-colors">← Zurück</button>
        <h1 className="text-2xl font-black tracking-tight">🧑‍🏫 Lehrerdaten</h1>
        <p className="text-muted text-sm mt-1">
          Klassenleitung · Fächerverteilung · Wochenstunden. Lehrkräfte anlegen &amp; per CSV importieren unter{" "}
          <button onClick={() => router.push("/admin/users")} className="underline hover:text-accent">Benutzerverwaltung</button>.
        </p>
      </div>

      {/* Teachersetup: Klassenleitung + Fächerverteilung + Korrektur/Gesamt-WS (admin only) */}
      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">Fächerverteilung</h2>
          <Hint text={"Klassenleitung: berechtigt zum Bearbeiten der eigenen Klasse (Name, Symbol). Zwei Lehrkräfte mit derselben Klasse bilden ein Klassenleitungsteam.\n\nPro Lehrkraft und Fach: Klassen per Checkbox zuweisen. Bereits einer anderen Lehrkraft zugewiesene Klassen werden für dieses Fach ausgeblendet — offene Zellen zeigen, was noch unbesetzt ist. Klasse 9/10: Ma, De, En laufen im Kurssystem und werden hier nicht als Klasse zugewiesen.\n\nKorrektur: manuelle Anpassung der Gesamt-Wochenstunden (+/-), z. B. Abminderung für eine Funktion. Notiz erklärt den Grund. Gesamt-WS = Summe aus der Fächerverteilung + Korrektur. Die Summenzeile zeigt die Gesamtstunden je Fach und die Schulgesamtsumme."} />
          <div className="flex-1" />
          <button
            onClick={async () => printTeacherSheets(teachers, new Map((await api.teachers.getWochenstunden()).map(r => [`${r.subject}|${r.grade}`, r.hours])))}
            disabled={teachers.length === 0}
            className="shrink-0 w-auto rounded-lg border border-line text-xs font-semibold py-1.5 px-3 hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
          >
            🖨 Zuweisungsplan drucken (PDF)
          </button>
        </div>
        {teachers.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Lehrkräfte — erst per CSV importieren.</p>
        ) : (
          <FaecherverteilungTable teachers={teachers} classes={classes} />
        )}
      </section>

      <section className="card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">Wochenstunden</h2>
          <Hint text={"Wochenstunden je Fach und Klassenstufe — bestimmt die Gesamt-WS jeder Lehrkraft aus ihrer Fächerverteilung.\n\nStandardwerte: Hauptfächer (Ma, De, En) 4 · Nebenfächer 1 · Religion 2 · Sport 2 · Wahlpflicht 3. Hier anpassbar.\n\n'Summe' = benötigte Wochenstunden für das Fach (Stunden × Klassenanzahl je Stufe). 'Zugewiesen / Gesamt' zeigt, wie viel davon bereits Lehrkräften zugewiesen ist — rot mit ⚠️ bei unvollständiger Zuweisung, grün wenn vollständig gedeckt."} />
          <div className="flex-1" />
          <button
            onClick={async () => printWochenstunden(teachers, classes, new Map((await api.teachers.getWochenstunden()).map(r => [`${r.subject}|${r.grade}`, r.hours])))}
            className="shrink-0 w-auto rounded-lg border border-line text-xs font-semibold py-1.5 px-3 hover:border-accent hover:text-accent transition-colors"
          >
            🖨 Übersicht drucken (PDF)
          </button>
        </div>
        <WochenstundenTable teachers={teachers} classes={classes} />
      </section>
    </div>
  );
}
