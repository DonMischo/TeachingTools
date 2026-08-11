"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  api, ClassOut, TeacherOut, StudentOut,
  TeacherCredentialRow, StudentCredentialRow, TeacherPreviewResponse,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

type UserType = "student" | "teacher" | "admin";
type ResetType = "student" | "teacher";
type Filter = "all" | "new" | "update";

const TYPE_LABEL: Record<UserType, string> = {
  student: "Schüler:in",
  teacher: "Lehrkraft",
  admin: "Admin",
};

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
const FIELD_LABELS: Record<string, string> = { nummer: "Nr.", email: "E-Mail", klasse: "Klasse", role: "Rolle" };

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

export default function AdminUsersPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (auth !== null && auth.role !== "admin") router.replace("/");
  }, [auth, router]);

  const isAdmin = auth?.role === "admin";
  const { data: classes = [] } = useQuery<ClassOut[]>({
    queryKey: ["classes"], queryFn: api.classes.list, enabled: isAdmin, staleTime: 60_000,
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
    queryKey: ["teachers"], queryFn: api.teachers.list, enabled: isAdmin,
  });
  const { data: resetStudents = [] } = useQuery<StudentOut[]>({
    queryKey: ["students", resetClass],
    queryFn: () => api.students.list({ klasse: resetClass }),
    enabled: isAdmin && resetType === "student" && Boolean(resetClass),
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

  if (!auth || auth.role !== "admin") return null;

  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto w-full">
      <div>
        <button onClick={() => router.push("/admin")} className="mb-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">← Zurück</button>
        <h1 className="text-2xl font-black tracking-tight">👤 Benutzerverwaltung</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Konten anlegen · Zugangsdaten generieren · Lehrer-CSV importieren · Passwörter zurücksetzen</p>
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
    </div>
  );
}
