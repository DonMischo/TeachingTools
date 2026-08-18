"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  api, ClassOut, TeacherOut, StudentOut,
  TeacherCredentialRow, StudentCredentialRow, TeacherPreviewResponse, StudentPreviewResponse,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useToast } from "@/contexts/ToastContext";

type UserType = "student" | "teacher" | "admin";
type ResetType = "student" | "teacher";
type Filter = "all" | "new" | "update";

const TYPE_LABEL: Record<UserType, string> = {
  student: "Schüler:in",
  teacher: "Lehrkraft",
  admin: "Admin",
};

// apiFetch throws Error(<response body>); FastAPI bodies are {"detail": "…"}.
function apiErr(e: any): string {
  try { return JSON.parse(e?.message)?.detail ?? e?.message; } catch { return e?.message ?? "Fehler"; }
}

function Hint({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex">
      <span className="w-4 h-4 rounded-full border border-[var(--border)] text-[var(--text-muted)] text-[10px] flex items-center justify-center cursor-default select-none hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">?</span>
      <span className="absolute left-5 top-0 z-50 hidden group-hover:block w-72 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text-muted)] shadow-lg leading-relaxed">
        {text}
      </span>
    </span>
  );
}

const ACTION_LABEL: Record<string, string> = { new: "NEU", update: "GEÄNDERT", unchanged: "–" };
const ACTION_COLOR: Record<string, string> = {
  new: "bg-green-900/40 text-green-300",
  update: "bg-yellow-900/40 text-yellow-300",
  unchanged: "text-[var(--text-muted)]",
};
const FIELD_LABELS: Record<string, string> = { nummer: "Nr.", email: "E-Mail", klasse: "Klasse", role: "Rolle", geschlecht: "Geschl.", geburtsdatum: "Geb." };

function FieldDiff({ field, csvVal, dbVal }: { field: string; csvVal: string; dbVal: string | undefined }) {
  const label = FIELD_LABELS[field] ?? field;
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-[var(--bg)] rounded px-1.5 py-0.5 mr-1 mb-1">
      <span className="text-[var(--text-muted)]">{label}:</span>
      {dbVal ? <><span className="line-through opacity-50">{dbVal}</span><span>→</span></> : null}
      <span className="text-[var(--accent)]">{csvVal || "(leer)"}</span>
    </span>
  );
}

// Unified credential row for the "created / reset" result tables.
type CredResult = { kind: UserType | "reset"; label: string; sub: string; username: string; password: string | null };

function CredTable({ rows }: { rows: CredResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
            <th className="text-left py-2 pr-4">Typ</th>
            <th className="text-left py-2 pr-4">Name</th>
            <th className="text-left py-2 pr-4">Benutzername</th>
            <th className="text-left py-2">Passwort</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--border)]/50">
              <td className="py-1.5 pr-4">{r.sub}</td>
              <td className="py-1.5 pr-4">{r.label}</td>
              <td className="py-1.5 pr-4 font-mono">{r.username}</td>
              <td className="py-1.5 font-mono">{r.password ?? <span className="opacity-40">eigenes Passwort</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Student CSV import (preview → diff → apply). Mirrors the teacher import; writes
// the selected new/changed students to the DB via /api/students/apply.
function StudentImportSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [preview, setPreview] = useState<StudentPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [applyResult, setApplyResult] = useState<{ applied: number; errors: string[] } | null>(null);

  const previewMut = useMutation({
    mutationFn: (file: File) => api.students.preview(file),
    onSuccess: (res) => {
      setPreview(res); setApplyResult(null);
      setSelected(new Set(res.diff.filter(r => r.action !== "unchanged").map(r => r.key)));
      setFilter("all");
    },
    onError: (e: any) => toast(apiErr(e), "error"),
  });
  const applyMut = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Keine Vorschau");
      const map: Record<string, Record<string, string>> = {};
      for (const row of preview.diff) if (selected.has(row.key)) map[row.key] = row.csv_data;
      return api.students.apply([...selected], map);
    },
    onSuccess: (res) => {
      setApplyResult(res); setPreview(null); setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["students"] });
      toast(`${res.applied} Schüler importiert`, res.errors.length ? "error" : "success");
    },
    onError: (e: any) => toast(apiErr(e), "error"),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) previewMut.mutate(file);
  }
  const toggleRow = useCallback((key: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);
  const visibleRows = preview?.diff.filter(r => filter === "all" ? true : r.action === filter) ?? [];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-sm">Schüler-CSV-Import</h2>
        <Hint text={"Spalten: # (Nummer), Nachname, Vorname, Klasse, Geschlecht, Geburtsdatum. Pflichtfelder: Nachname, Klasse. Bestehende Schüler werden über Name + Klasse (bzw. AK-Code über den Jahrgangswechsel hinweg) erkannt und aktualisiert, nicht gelöscht. Zusatzspalten werden als Extra-Felder übernommen. Trennzeichen: Komma, Semikolon oder Tab."} />
      </div>
      <div className="flex gap-3 items-center flex-wrap">
        <label className="btn-primary text-sm py-2 px-4 cursor-pointer">
          {previewMut.isPending ? "Analysiere…" : "📂 CSV auswählen & Vorschau laden"}
          <input type="file" accept=".csv,.tsv,text/csv" className="hidden" onChange={handleFileChange} disabled={previewMut.isPending} />
        </label>
      </div>
      {applyResult && (
        <div className={`text-sm rounded-lg p-3 ${applyResult.errors.length ? "bg-yellow-900/30 text-yellow-300" : "bg-green-900/30 text-green-300"}`}>
          <strong>{applyResult.applied} Schüler importiert.</strong>
          {applyResult.errors.map((e, i) => <div key={i} className="text-xs mt-1 opacity-80">{e}</div>)}
        </div>
      )}

      {preview && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              {preview.summary.new} neu · {preview.summary.update} geändert · {preview.summary.unchanged} unverändert
              {preview.extra_columns.length > 0 && <> · Zusatzfelder: {preview.extra_columns.join(", ")}</>}
            </p>
            <div className="flex gap-2 flex-wrap">
              {(["all", "new", "update"] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    filter === f ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent" : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}>
                  {f === "all" ? "Alle" : f === "new" ? "Nur neu" : "Nur geändert"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 text-xs">
            <button onClick={() => setSelected(new Set(visibleRows.map(r => r.key)))} className="underline opacity-70 hover:opacity-100">Alle auswählen</button>
            <button onClick={() => setSelected(new Set())} className="underline opacity-70 hover:opacity-100">Keine</button>
            <span className="opacity-50">{selected.size} ausgewählt</span>
          </div>
          <div className="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[var(--surface)] z-10">
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <th className="w-8 py-2 px-2"></th>
                  <th className="text-left py-2 px-2 w-24">Status</th>
                  <th className="text-left py-2 px-2">Nachname</th>
                  <th className="text-left py-2 px-2">Vorname</th>
                  <th className="text-left py-2 px-2">Klasse</th>
                  <th className="text-left py-2 px-2">Änderungen</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.key} onClick={() => toggleRow(row.key)}
                    className={`border-b border-[var(--border)]/40 cursor-pointer transition-colors hover:bg-[var(--surface-hover)] ${selected.has(row.key) ? "bg-[var(--accent)]/5" : ""}`}>
                    <td className="py-1.5 px-2 text-center">
                      <input type="checkbox" checked={selected.has(row.key)} onChange={() => toggleRow(row.key)} onClick={e => e.stopPropagation()} className="accent-[var(--accent)]" />
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 font-mono font-bold text-[10px] ${ACTION_COLOR[row.action]}`}>{ACTION_LABEL[row.action]}</span>
                    </td>
                    <td className="py-1.5 px-2 font-medium">{row.csv_data.nachname}</td>
                    <td className="py-1.5 px-2">{row.csv_data.vorname}</td>
                    <td className="py-1.5 px-2 font-mono">{row.csv_data.klasse || "–"}</td>
                    <td className="py-1.5 px-2">
                      {row.action === "new" ? <span className="opacity-50 italic">Neuer Schüler</span>
                        : row.changed_fields.length > 0 ? (
                          <div className="flex flex-wrap">
                            {row.changed_fields.map(f => <FieldDiff key={f} field={f} csvVal={row.csv_data[f] ?? ""} dbVal={row.db_data?.[f]} />)}
                          </div>
                        ) : <span className="opacity-30">–</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => applyMut.mutate()} disabled={applyMut.isPending || selected.size === 0} className="btn-primary text-sm py-2 px-5">
              {applyMut.isPending ? "Übernehme…" : `✓ ${selected.size} Änderung${selected.size !== 1 ? "en" : ""} übernehmen`}
            </button>
            <button onClick={() => { setPreview(null); setSelected(new Set()); }} className="text-xs opacity-50 hover:opacity-80">Abbrechen</button>
          </div>
        </div>
      )}
    </section>
  );
}

// Inline-editable username cell — stays in edit mode if the save rejects (e.g. 409).
function UsernameCell({ value, onSave, disabled }: { value: string | null; onSave: (name: string) => Promise<unknown>; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!editing) setText(value ?? ""); }, [value, editing]);

  async function commit() {
    const name = text.trim();
    if (!name || name === (value ?? "")) { setEditing(false); return; }
    setBusy(true);
    try { await onSave(name); setEditing(false); }
    catch { /* keep editing; parent shows a toast */ }
    finally { setBusy(false); }
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-mono">{value ?? <span className="opacity-40">—</span>}</span>
        {!disabled && <button onClick={() => setEditing(true)} className="opacity-50 hover:opacity-100" title="Benutzernamen ändern">✏️</button>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input autoFocus value={text} onChange={e => setText(e.target.value)} disabled={busy}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="input text-xs py-1 w-32 font-mono" />
      <button disabled={busy} onClick={commit} className="text-green-400 disabled:opacity-40" title="Speichern">✓</button>
      <button onClick={() => setEditing(false)} className="opacity-50 hover:opacity-100" title="Abbrechen">×</button>
    </span>
  );
}

export default function AdminUsersPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { ready: aReady, isAdmin: aAdmin, has: aHas } = useAdminAccess();
  const allowed = aAdmin || aHas("students") || aHas("teachers");
  useEffect(() => {
    if (aReady && !allowed) router.replace("/");
  }, [aReady, allowed, router]);
  const { data: classes = [] } = useQuery<ClassOut[]>({
    queryKey: ["classes"], queryFn: api.classes.list, enabled: allowed, staleTime: 60_000,
  });

  // ── Manual create ────────────────────────────────────────────────────────
  const [type, setType] = useState<UserType>("teacher");
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [klasse, setKlasse] = useState("");
  const [geschlecht, setGeschlecht] = useState("");
  const [email, setEmail] = useState("");
  const [profession, setProfession] = useState("");
  const [created, setCreated] = useState<CredResult[]>([]);

  const createMut = useMutation({
    mutationFn: async (): Promise<CredResult> => {
      const first = vorname.trim(), last = nachname.trim();
      if (type === "student") {
        const r: StudentCredentialRow = await api.students.create({ vorname: first, nachname: last, klasse: klasse.trim(), geschlecht });
        return { kind: "student", sub: TYPE_LABEL.student, label: `${r.nachname}, ${r.vorname} (${r.klasse})`, username: r.username, password: r.password };
      }
      const r: TeacherCredentialRow = await api.teachers.create({
        first_name: first, last_name: last, role: type === "admin" ? "admin" : "teacher",
        email: email.trim() || null, teacher_role: profession || null,
      });
      return { kind: type, sub: TYPE_LABEL[type], label: `${r.last_name}, ${r.first_name}`, username: r.username, password: r.password };
    },
    onSuccess: (row) => {
      setCreated(prev => [row, ...prev]);
      setVorname(""); setNachname(""); setKlasse(""); setGeschlecht(""); setEmail(""); setProfession("");
      qc.invalidateQueries({ queryKey: ["teachers"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      toast(`${row.sub} angelegt: ${row.username}`, "success");
    },
    onError: (e: any) => toast(e?.message ?? "Fehler beim Anlegen", "error"),
  });

  const namesOk = vorname.trim() && nachname.trim();
  const canCreate = type === "student" ? Boolean(namesOk && klasse.trim() && geschlecht) : Boolean(namesOk);

  // ── Credential generation ─────────────────────────────────────────────────
  const [studentCreds, setStudentCreds] = useState<StudentCredentialRow[] | null>(null);
  const [teacherCreds, setTeacherCreds] = useState<TeacherCredentialRow[] | null>(null);
  const studentGenMut = useMutation({ mutationFn: api.students.generateCredentials, onSuccess: setStudentCreds });
  const teacherGenMut = useMutation({ mutationFn: api.teachers.generateCredentials, onSuccess: setTeacherCreds });

  async function downloadCsv(which: "students" | "teachers") {
    const r = which === "students" ? await api.students.downloadCredentials() : await api.teachers.downloadCredentials();
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = which === "students" ? "zugangsdaten.csv" : "lehrer-zugangsdaten.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Teacher CSV import (moved here from Lehrerdaten) ───────────────────────
  const [preview, setPreview] = useState<TeacherPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [applyResult, setApplyResult] = useState<{ applied: number; errors: string[] } | null>(null);

  const previewMut = useMutation({
    mutationFn: (file: File) => api.teachers.preview(file),
    onSuccess: (res) => {
      setPreview(res); setApplyResult(null);
      setSelected(new Set(res.diff.filter(r => r.action !== "unchanged").map(r => r.key)));
      setFilter("all");
    },
    onError: (e: any) => toast(e?.message ?? "Import-Fehler", "error"),
  });
  const applyMut = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Keine Vorschau");
      const csvDataMap: Record<string, Record<string, string>> = {};
      for (const row of preview.diff) if (selected.has(row.key)) csvDataMap[row.key] = row.csv_data;
      return api.teachers.apply([...selected], csvDataMap);
    },
    onSuccess: (res) => {
      setApplyResult(res); setPreview(null); setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["teachers"] });
    },
  });
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) previewMut.mutate(file);
  }
  const toggleRow = useCallback((key: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);
  const visibleRows = preview?.diff.filter(r => filter === "all" ? true : r.action === filter) ?? [];

  // ── Password reset ────────────────────────────────────────────────────────
  const [resetType, setResetType] = useState<ResetType>("teacher");
  const [resetClass, setResetClass] = useState("");
  const [resetStudentId, setResetStudentId] = useState("");
  const [resetTeacherId, setResetTeacherId] = useState("");
  const [resetResult, setResetResult] = useState<CredResult | null>(null);

  const { data: teachers = [] } = useQuery<TeacherOut[]>({
    queryKey: ["teachers"], queryFn: api.teachers.list, enabled: allowed,
  });
  const { data: resetStudents = [] } = useQuery<StudentOut[]>({
    queryKey: ["students", resetClass],
    queryFn: () => api.students.list({ klasse: resetClass }),
    enabled: allowed && resetType === "student" && Boolean(resetClass),
  });

  const resetMut = useMutation({
    mutationFn: async (): Promise<CredResult> => {
      if (resetType === "teacher") {
        const r = await api.teachers.resetPassword(Number(resetTeacherId));
        return { kind: "reset", sub: "Lehrkraft", label: `${r.last_name}, ${r.first_name}`, username: r.username, password: r.password };
      }
      const r = await api.students.resetPassword(Number(resetStudentId));
      return { kind: "reset", sub: "Schüler:in", label: `${r.nachname}, ${r.vorname} (${r.klasse})`, username: r.username, password: r.password };
    },
    onSuccess: (row) => { setResetResult(row); toast(`Neues Passwort für ${row.label}`, "success"); },
    onError: (e: any) => toast(e?.message ?? "Fehler beim Zurücksetzen", "error"),
  });
  const canReset = resetType === "teacher" ? Boolean(resetTeacherId) : Boolean(resetStudentId);

  // ── User management (username change + per-row reset + delete) ─────────────
  const [mgmtRole, setMgmtRole] = useState<UserType>("student");
  const [mgmtClass, setMgmtClass] = useState("");
  const [mgmtCreds, setMgmtCreds] = useState<CredResult[]>([]);
  const { data: allStudents = [] } = useQuery<StudentOut[]>({
    queryKey: ["students", "manage-all"], queryFn: () => api.students.list(), enabled: allowed,
  });

  const setUsernameMut = useMutation({
    mutationFn: ({ kind, id, username }: { kind: ResetType; id: number; username: string }): Promise<any> =>
      kind === "student" ? api.students.setUsername(id, username) : api.teachers.setUsername(id, username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["teachers"] });
      toast("Benutzername geändert", "success");
    },
    onError: (e: any) => toast(apiErr(e), "error"),
  });

  const mgmtResetMut = useMutation({
    mutationFn: ({ kind, id }: { kind: ResetType; id: number }): Promise<any> =>
      kind === "student" ? api.students.resetPassword(id) : api.teachers.resetPassword(id),
    onSuccess: (r: any, vars) => {
      const row: CredResult = vars.kind === "student"
        ? { kind: "reset", sub: "Schüler:in", label: `${r.nachname}, ${r.vorname} (${r.klasse})`, username: r.username, password: r.password }
        : { kind: "reset", sub: r.role === "admin" ? "Admin" : "Lehrkraft", label: `${r.last_name}, ${r.first_name}`, username: r.username, password: r.password };
      setMgmtCreds(prev => [row, ...prev]);
      toast(`Neues Passwort für ${row.label}`, "success");
    },
    onError: (e: any) => toast(apiErr(e) ?? "Fehler beim Zurücksetzen", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: ({ kind, id }: { kind: ResetType; id: number }): Promise<unknown> =>
      kind === "student" ? api.students.delete(id) : api.teachers.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["teachers"] });
      toast("Benutzer gelöscht", "success");
    },
    onError: (e: any) => toast(apiErr(e), "error"),
  });

  // Rows for the currently selected role + class. Admins are teachers with role === "admin".
  const mgmtRows: { id: number; name: string; sub: string; username: string | null; kind: ResetType }[] =
    mgmtRole === "student"
      ? allStudents
          .filter(s => !mgmtClass || s.klasse === mgmtClass)
          .sort((a, b) => a.klasse.localeCompare(b.klasse) || a.nachname.localeCompare(b.nachname))
          .map(s => ({ id: s.id, name: `${s.nachname}, ${s.vorname} (${s.klasse})`, sub: "Schüler:in", username: s.username, kind: "student" as const }))
      : teachers
          .filter(t => (mgmtRole === "admin" ? t.role === "admin" : t.role !== "admin") && (!mgmtClass || t.klasse === mgmtClass))
          .sort((a, b) => a.last_name.localeCompare(b.last_name))
          .map(t => ({ id: t.id, name: `${t.last_name}, ${t.first_name}${t.klasse ? ` · ${t.klasse}` : ""}`, sub: TYPE_LABEL[mgmtRole], username: t.username, kind: "teacher" as const }));

  if (!auth || !aReady || !allowed) return null;

  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto w-full">
      <div>
        <button onClick={() => router.push("/admin")} className="mb-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">← Zurück</button>
        <h1 className="text-2xl font-black tracking-tight">👤 Benutzerverwaltung</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Konten anlegen · Zugänge generieren · Lehrer- &amp; Schüler-CSV · Passwörter · Löschen</p>
      </div>

      {/* ── Manual create ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
        <h2 className="font-semibold text-sm">Benutzer manuell anlegen</h2>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--text-muted)]">Rolle</span>
          <div className="flex gap-2 flex-wrap">
            {(["student", "teacher", "admin"] as UserType[]).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                  type === t ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent" : "border-[var(--border)] hover:border-[var(--accent)]"
                }`}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
            Vorname
            <input className="input text-sm py-2" value={vorname} onChange={e => setVorname(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
            Nachname
            <input className="input text-sm py-2" value={nachname} onChange={e => setNachname(e.target.value)} />
          </label>

          {type === "student" && (
            <>
              <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                Klasse
                <select className="input text-sm py-2" value={klasse} onChange={e => setKlasse(e.target.value)}>
                  <option value="">— wählen —</option>
                  {classes.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                Geschlecht
                <select className="input text-sm py-2" value={geschlecht} onChange={e => setGeschlecht(e.target.value)}>
                  <option value="">— wählen —</option>
                  <option value="m">männlich</option>
                  <option value="w">weiblich</option>
                </select>
              </label>
            </>
          )}

          {type !== "student" && (
            <>
              <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                E-Mail <span className="opacity-60">(optional)</span>
                <input className="input text-sm py-2" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                Profession <span className="opacity-60">(optional)</span>
                <select className="input text-sm py-2" value={profession} onChange={e => setProfession(e.target.value)}>
                  <option value="">— keine —</option>
                  <option value="Lehrer">Lehrer</option>
                  <option value="SPF">SPF</option>
                </select>
              </label>
            </>
          )}
        </div>

        <div>
          <button onClick={() => createMut.mutate()} disabled={!canCreate || createMut.isPending}
            className="btn-primary text-sm py-2 px-5 disabled:opacity-40">
            {createMut.isPending ? "Lege an…" : `${TYPE_LABEL[type]} anlegen`}
          </button>
        </div>

        {created.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--text-muted)]">Passwörter werden nur hier angezeigt — bitte notieren.</p>
            <CredTable rows={created} />
          </div>
        )}
      </section>

      {/* ── Credential generation ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">Zugangsdaten generieren</h2>
          <Hint text={"Erzeugt Benutzernamen und Passwörter für alle Schüler bzw. Lehrkräfte ohne Zugang. Passwörter bestehen aus Farbe + Tier + Zahl (z. B. BlaueTiger042). Bestehende und selbst gesetzte Passwörter bleiben unverändert."} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Schüler</span>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => studentGenMut.mutate()} disabled={studentGenMut.isPending} className="btn-primary text-sm py-2 px-4">
                {studentGenMut.isPending ? "Generiere…" : "🔑 Generieren"}
              </button>
              <button onClick={() => downloadCsv("students")} className="btn-secondary text-sm py-2 px-4">⬇️ CSV</button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Lehrkräfte</span>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => teacherGenMut.mutate()} disabled={teacherGenMut.isPending} className="btn-primary text-sm py-2 px-4">
                {teacherGenMut.isPending ? "Generiere…" : "🔑 Generieren"}
              </button>
              <button onClick={() => downloadCsv("teachers")} className="btn-secondary text-sm py-2 px-4">⬇️ CSV</button>
            </div>
          </div>
        </div>

        {studentCreds && (
          <CredTable rows={studentCreds.map(r => ({ kind: "student", sub: "Schüler:in", label: `${r.nachname}, ${r.vorname} (${r.klasse})`, username: r.username, password: r.password }))} />
        )}
        {teacherCreds && (
          <CredTable rows={teacherCreds.map(r => ({ kind: "teacher", sub: r.role === "admin" ? "Admin" : "Lehrkraft", label: `${r.last_name}, ${r.first_name}`, username: r.username, password: r.password }))} />
        )}
      </section>

      {/* ── Teacher CSV import ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">Lehrer-CSV-Import</h2>
          <Hint text={"Spalten: # (Nummer), Nachname, Vorname, E-Mail, Klasse, Rolle. Pflichtfelder: Nachname, Vorname. Nummer wird als stabiler Abgleichschlüssel genutzt, sonst der Name. Klasse leer oder eine bestehende Klasse (dann Klassenleitung). Rolle 'Lehrer' oder 'SPF'. Trennzeichen: Komma, Semikolon oder Tab. Bestehende Lehrkräfte werden nicht gelöscht."} />
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <label className="btn-primary text-sm py-2 px-4 cursor-pointer">
            {previewMut.isPending ? "Analysiere…" : "📂 CSV auswählen & Vorschau laden"}
            <input type="file" accept=".csv,.tsv,text/csv" className="hidden" onChange={handleFileChange} disabled={previewMut.isPending} />
          </label>
        </div>
        {applyResult && (
          <div className={`text-sm rounded-lg p-3 ${applyResult.errors.length ? "bg-yellow-900/30 text-yellow-300" : "bg-green-900/30 text-green-300"}`}>
            <strong>{applyResult.applied} Lehrkräfte importiert.</strong>
            {applyResult.errors.map((e, i) => <div key={i} className="text-xs mt-1 opacity-80">{e}</div>)}
          </div>
        )}

        {preview && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                {preview.summary.new} neu · {preview.summary.update} geändert · {preview.summary.unchanged} unverändert
              </p>
              <div className="flex gap-2 flex-wrap">
                {(["all", "new", "update"] as Filter[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      filter === f ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent" : "border-[var(--border)] hover:border-[var(--accent)]"
                    }`}>
                    {f === "all" ? "Alle" : f === "new" ? "Nur neu" : "Nur geändert"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              <button onClick={() => setSelected(new Set(visibleRows.map(r => r.key)))} className="underline opacity-70 hover:opacity-100">Alle auswählen</button>
              <button onClick={() => setSelected(new Set())} className="underline opacity-70 hover:opacity-100">Keine</button>
              <span className="opacity-50">{selected.size} ausgewählt</span>
            </div>
            <div className="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-[var(--surface)] z-10">
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    <th className="w-8 py-2 px-2"></th>
                    <th className="text-left py-2 px-2 w-24">Status</th>
                    <th className="text-left py-2 px-2">Nachname</th>
                    <th className="text-left py-2 px-2">Vorname</th>
                    <th className="text-left py-2 px-2">Klasse</th>
                    <th className="text-left py-2 px-2">Rolle</th>
                    <th className="text-left py-2 px-2">Änderungen</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.key} onClick={() => toggleRow(row.key)}
                      className={`border-b border-[var(--border)]/40 cursor-pointer transition-colors hover:bg-[var(--surface-hover)] ${selected.has(row.key) ? "bg-[var(--accent)]/5" : ""}`}>
                      <td className="py-1.5 px-2 text-center">
                        <input type="checkbox" checked={selected.has(row.key)} onChange={() => toggleRow(row.key)} onClick={e => e.stopPropagation()} className="accent-[var(--accent)]" />
                      </td>
                      <td className="py-1.5 px-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 font-mono font-bold text-[10px] ${ACTION_COLOR[row.action]}`}>{ACTION_LABEL[row.action]}</span>
                      </td>
                      <td className="py-1.5 px-2 font-medium">{row.csv_data.nachname}</td>
                      <td className="py-1.5 px-2">{row.csv_data.vorname}</td>
                      <td className="py-1.5 px-2 font-mono">{row.csv_data.klasse || "–"}</td>
                      <td className="py-1.5 px-2">{row.csv_data.role || "Lehrer"}</td>
                      <td className="py-1.5 px-2">
                        {row.action === "new" ? <span className="opacity-50 italic">Neue Lehrkraft</span>
                          : row.changed_fields.length > 0 ? (
                            <div className="flex flex-wrap">
                              {row.changed_fields.map(f => <FieldDiff key={f} field={f} csvVal={row.csv_data[f] ?? ""} dbVal={row.db_data?.[f]} />)}
                            </div>
                          ) : <span className="opacity-30">–</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => applyMut.mutate()} disabled={applyMut.isPending || selected.size === 0} className="btn-primary text-sm py-2 px-5">
                {applyMut.isPending ? "Übernehme…" : `✓ ${selected.size} Änderung${selected.size !== 1 ? "en" : ""} übernehmen`}
              </button>
              <button onClick={() => { setPreview(null); setSelected(new Set()); }} className="text-xs opacity-50 hover:opacity-80">Abbrechen</button>
            </div>
          </div>
        )}
      </section>

      {/* ── Student CSV import (below the teacher import) ───────────────────── */}
      <StudentImportSection />

      {/* ── Password reset ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">Passwort zurücksetzen</h2>
          <Hint text={"Erzeugt ein neues zufälliges Passwort für eine einzelne Person. Das alte Passwort wird ungültig. Fehlt ein Benutzername, wird er dabei ebenfalls erzeugt."} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["teacher", "student"] as ResetType[]).map(t => (
            <button key={t} onClick={() => { setResetType(t); setResetResult(null); }}
              className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                resetType === t ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent" : "border-[var(--border)] hover:border-[var(--accent)]"
              }`}>
              {t === "teacher" ? "Lehrkraft" : "Schüler:in"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {resetType === "teacher" ? (
            <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)] sm:col-span-2">
              Lehrkraft
              <select className="input text-sm py-2" value={resetTeacherId} onChange={e => setResetTeacherId(e.target.value)}>
                <option value="">— wählen —</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.last_name}, {t.first_name}</option>)}
              </select>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                Klasse
                <select className="input text-sm py-2" value={resetClass} onChange={e => { setResetClass(e.target.value); setResetStudentId(""); }}>
                  <option value="">— wählen —</option>
                  {classes.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                Schüler:in
                <select className="input text-sm py-2" value={resetStudentId} onChange={e => setResetStudentId(e.target.value)} disabled={!resetClass}>
                  <option value="">— wählen —</option>
                  {resetStudents.map(s => <option key={s.id} value={s.id}>{s.nachname}, {s.vorname}</option>)}
                </select>
              </label>
            </>
          )}
        </div>

        <div>
          <button onClick={() => resetMut.mutate()} disabled={!canReset || resetMut.isPending} className="btn-primary text-sm py-2 px-5 disabled:opacity-40">
            {resetMut.isPending ? "Setze zurück…" : "🔁 Neues Passwort erzeugen"}
          </button>
        </div>

        {resetResult && <CredTable rows={[resetResult]} />}
      </section>

      {/* ── User management (username + reset) ──────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">Benutzer verwalten</h2>
          <Hint text={"Benutzernamen ändern (✏️), Passwörter zurücksetzen und Konten löschen. Nach Rolle und Klasse gefiltert — Admins sind Lehrkräfte mit Admin-Rechten. Löschen ist endgültig; Lehrkräfte mit erstellten Inhalten oder vergebenen Punkten lassen sich nicht löschen."} />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {(["student", "teacher", "admin"] as UserType[]).map(t => (
              <button key={t} onClick={() => setMgmtRole(t)}
                className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                  mgmtRole === t ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent" : "border-[var(--border)] hover:border-[var(--accent)]"
                }`}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <select className="input text-sm py-2 ml-auto" value={mgmtClass} onChange={e => setMgmtClass(e.target.value)}
            title={mgmtRole === "student" ? "Nach Klasse filtern" : "Nach Klassenleitung filtern"}>
            <option value="">Alle Klassen</option>
            {classes.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-[var(--surface)] z-10">
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="text-left py-2 px-2">Name</th>
                <th className="text-left py-2 px-2">Benutzername</th>
                <th className="text-left py-2 px-2 w-28">Passwort</th>
                <th className="text-left py-2 px-2 w-20">Löschen</th>
              </tr>
            </thead>
            <tbody>
              {mgmtRows.map(r => (
                <tr key={`${r.kind}-${r.id}`} className="border-b border-[var(--border)]/40">
                  <td className="py-1.5 px-2">{r.name}</td>
                  <td className="py-1.5 px-2">
                    <UsernameCell value={r.username} onSave={(name) => setUsernameMut.mutateAsync({ kind: r.kind, id: r.id, username: name })} />
                  </td>
                  <td className="py-1.5 px-2">
                    <button onClick={() => mgmtResetMut.mutate({ kind: r.kind, id: r.id })} disabled={mgmtResetMut.isPending}
                      className="text-xs underline opacity-70 hover:opacity-100 disabled:opacity-30">🔁 zurücksetzen</button>
                  </td>
                  <td className="py-1.5 px-2">
                    <button
                      onClick={() => { if (window.confirm(`„${r.name}" endgültig löschen? Das kann nicht rückgängig gemacht werden.`)) deleteMut.mutate({ kind: r.kind, id: r.id }); }}
                      disabled={deleteMut.isPending}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-30" title="Endgültig löschen">🗑️ löschen</button>
                  </td>
                </tr>
              ))}
              {mgmtRows.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-[var(--text-muted)]">Keine Einträge.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {mgmtCreds.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--text-muted)]">Neue Passwörter — bitte notieren.</p>
            <CredTable rows={mgmtCreds} />
          </div>
        )}
      </section>
    </div>
  );
}
