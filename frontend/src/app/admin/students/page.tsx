"use client";

import { useRef, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, StudentCredentialRow, StudentPreviewResponse } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Filter = "all" | "new" | "update";

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

const FIELD_LABELS: Record<string, string> = {
  nummer: "Nr.", nachname: "Nachname", vorname: "Vorname", klasse: "Klasse",
  geschlecht: "Geschlecht", geburtsdatum: "Geburtsdatum",
};

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

export default function AdminStudentsPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<StudentPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [applyResult, setApplyResult] = useState<{ applied: number; errors: string[] } | null>(null);
  const [credentials, setCredentials] = useState<StudentCredentialRow[] | null>(null);

  useEffect(() => {
    if (auth !== null && auth.role !== "admin") router.replace("/");
  }, [auth, router]);

  const previewMut = useMutation({
    mutationFn: (file: File) => api.students.preview(file),
    onSuccess: (res) => {
      setPreview(res);
      setApplyResult(null);
      // Auto-select new and update rows
      const autoSelected = new Set(
        res.diff.filter(r => r.action !== "unchanged").map(r => r.key)
      );
      setSelected(autoSelected);
      setFilter("all");
    },
  });

  const applyMut = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Keine Vorschau");
      const csvDataMap: Record<string, Record<string, string>> = {};
      for (const row of preview.diff) {
        if (selected.has(row.key)) csvDataMap[row.key] = row.csv_data;
      }
      return api.students.apply([...selected], csvDataMap);
    },
    onSuccess: (res) => {
      setApplyResult(res);
      setPreview(null);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const credentialsMut = useMutation({
    mutationFn: api.students.generateCredentials,
    onSuccess: (rows) => setCredentials(rows),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    previewMut.mutate(file);
  }

  const toggleRow = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  async function downloadCsv() {
    const r = await api.students.downloadCredentials();
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "zugangsdaten.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (!auth || auth.role !== "admin") return null;

  const visibleRows = preview?.diff.filter(r =>
    filter === "all" ? true : r.action === filter
  ) ?? [];

  const selectAll = () => setSelected(new Set(visibleRows.map(r => r.key)));
  const selectNone = () => setSelected(new Set());

  return (
    <div className="flex flex-col gap-8 p-6 max-w-5xl mx-auto w-full">
      <div>
        <button onClick={() => router.push("/admin")} className="mb-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">← Zurück</button>
        <h1 className="text-2xl font-black tracking-tight">👥 Schülerdaten</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">CSV importieren · Änderungen prüfen · bestätigen</p>
      </div>

      {/* Upload */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">CSV-Import</h2>
          <Hint text={"Pflichtfelder: Nachname, Vorname, Klasse. Optional: #, Geschlecht, Geburtsdatum und beliebige Zusatzfelder (z. B. Tool-Zugangsdaten).\n\nTrennzeichen: Komma, Semikolon oder Tab. Encoding wird automatisch erkannt.\n\nBestehende Schüler werden nicht gelöscht — nur ausgewählte Zeilen werden aktualisiert."} />
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={previewMut.isPending}
            className="btn-primary text-sm py-2 px-4"
          >
            {previewMut.isPending ? "Analysiere…" : "📂 CSV auswählen & Vorschau laden"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.tsv,text/csv" className="hidden" onChange={handleFileChange} />

        {previewMut.isError && (
          <div className="text-sm rounded-lg p-3 bg-red-900/30 text-red-300">
            {String(previewMut.error)}
          </div>
        )}
        {applyResult && (
          <div className={`text-sm rounded-lg p-3 ${applyResult.errors.length ? "bg-yellow-900/30 text-yellow-300" : "bg-green-900/30 text-green-300"}`}>
            <strong>{applyResult.applied} Schüler importiert.</strong>
            {applyResult.errors.map((e, i) => <div key={i} className="text-xs mt-1 opacity-80">{e}</div>)}
          </div>
        )}
      </section>

      {/* Diff table */}
      {preview && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-sm">Vorschau</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {preview.summary.new} neu · {preview.summary.update} geändert · {preview.summary.unchanged} unverändert
                {preview.extra_columns.length > 0 && (
                  <> · Zusatzfelder: {preview.extra_columns.join(", ")}</>
                )}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "new", "update"] as Filter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    filter === f
                      ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent"
                      : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  {f === "all" ? "Alle" : f === "new" ? "Nur neu" : "Nur geändert"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 text-xs">
            <button onClick={selectAll} className="underline opacity-70 hover:opacity-100">Alle auswählen</button>
            <button onClick={selectNone} className="underline opacity-70 hover:opacity-100">Keine</button>
            <span className="opacity-50">{selected.size} ausgewählt</span>
          </div>

          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-lg border border-[var(--border)]">
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
                  <tr
                    key={row.key}
                    onClick={() => toggleRow(row.key)}
                    className={`border-b border-[var(--border)]/40 cursor-pointer transition-colors hover:bg-[var(--surface-hover)] ${
                      selected.has(row.key) ? "bg-[var(--accent)]/5" : ""
                    }`}
                  >
                    <td className="py-1.5 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(row.key)}
                        onChange={() => toggleRow(row.key)}
                        onClick={e => e.stopPropagation()}
                        className="accent-[var(--accent)]"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 font-mono font-bold text-[10px] ${ACTION_COLOR[row.action]}`}>
                        {ACTION_LABEL[row.action]}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 font-medium">{row.csv_data.nachname}</td>
                    <td className="py-1.5 px-2">{row.csv_data.vorname}</td>
                    <td className="py-1.5 px-2 font-mono">{row.csv_data.klasse}</td>
                    <td className="py-1.5 px-2">
                      {row.action === "new" ? (
                        <span className="opacity-50 italic">Neuer Schüler</span>
                      ) : row.changed_fields.length > 0 ? (
                        <div className="flex flex-wrap">
                          {row.changed_fields.map(f => (
                            <FieldDiff
                              key={f}
                              field={f}
                              csvVal={row.csv_data[f] ?? ""}
                              dbVal={row.db_data?.[f]}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="opacity-30">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => applyMut.mutate()}
              disabled={applyMut.isPending || selected.size === 0}
              className="btn-primary text-sm py-2 px-5"
            >
              {applyMut.isPending ? "Übernehme…" : `✓ ${selected.size} Änderung${selected.size !== 1 ? "en" : ""} übernehmen`}
            </button>
            <button
              onClick={() => { setPreview(null); setSelected(new Set()); }}
              className="text-xs opacity-50 hover:opacity-80"
            >
              Abbrechen
            </button>
          </div>
        </section>
      )}

      {/* Credential generation */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">Zugangsdaten generieren</h2>
          <Hint text={"Erzeugt Benutzernamen und Passwörter für alle Schüler ohne Zugang. Passwörter bestehen aus Farbe + Tier + Zahl (z. B. BlaueTiger042). Bestehende Zugangsdaten bleiben unverändert."} />
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => credentialsMut.mutate()} disabled={credentialsMut.isPending} className="btn-primary text-sm py-2 px-4">
            {credentialsMut.isPending ? "Generiere…" : "🔑 Zugangsdaten generieren"}
          </button>
          <button onClick={downloadCsv} className="btn-secondary text-sm py-2 px-4">
            ⬇️ CSV exportieren
          </button>
        </div>

        {credentials && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <th className="text-left py-2 pr-4">Klasse</th>
                  <th className="text-left py-2 pr-4">Name</th>
                  <th className="text-left py-2 pr-4">Benutzername</th>
                  <th className="text-left py-2">Passwort</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map(row => (
                  <tr key={row.id} className="border-b border-[var(--border)]/50">
                    <td className="py-1.5 pr-4 font-mono">{row.klasse}</td>
                    <td className="py-1.5 pr-4">{row.nachname}, {row.vorname}</td>
                    <td className="py-1.5 pr-4 font-mono">{row.username}</td>
                    <td className="py-1.5 font-mono">{row.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
