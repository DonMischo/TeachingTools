"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ClassOut, TransactionOut, StudentOut, StudentRoleOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSelectedClass } from "@/contexts/SelectedClassContext";
import { useToast } from "@/contexts/ToastContext";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_DIM = 1024;

function ClassIcon({ cls, size = "3rem" }: { cls: ClassOut; size?: string }) {
  if (cls.symbol_image) {
    return (
      <img src={cls.symbol_image} alt={cls.code}
        style={{ width: size, height: size, objectFit: "contain", borderRadius: 6 }} />
    );
  }
  return <span style={{ fontSize: size, lineHeight: 1 }}>{cls.symbol_emoji ?? "📚"}</span>;
}

async function validateImage(file: File): Promise<string | null> {
  if (!ALLOWED_TYPES.includes(file.type)) return "Nur PNG, JPG und WEBP erlaubt.";
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.width > MAX_DIM || img.height > MAX_DIM
        ? `Zu groß (${img.width}×${img.height} px). Max. ${MAX_DIM}×${MAX_DIM} px.` : null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve("Bild konnte nicht gelesen werden."); };
    img.src = url;
  });
}

function ClassCard({ cls, selected, onSelect }: {
  cls: ClassOut;
  selected: boolean;
  onSelect: () => void;
}) {
  const { auth } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const [aliasInput, setAliasInput] = useState(cls.class_name ?? "");
  const [editingAlias, setEditingAlias] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const canEdit = auth?.role === "teacher" || auth?.role === "admin";

  const logQuery = useQuery<TransactionOut[]>({
    queryKey: ["transactions", cls.id],
    queryFn: () => api.transactions.list(cls.id),
    enabled: showLog,
    staleTime: 30_000,
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => api.classes.uploadSymbolImage(cls.id, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); setUploadError(""); },
    onError: () => setUploadError("Upload fehlgeschlagen."),
  });

  const nameMut = useMutation({
    mutationFn: (name: string | null) => api.classes.updateClassName(cls.id, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); setEditingAlias(false); },
  });

  const { data: students = [] } = useQuery<StudentOut[]>({
    queryKey: ["students", cls.code],
    queryFn: () => api.students.list({ klasse: cls.code }),
    enabled: showRoles,
    staleTime: 60_000,
  });

  const { data: roles = [] } = useQuery<StudentRoleOut[]>({
    queryKey: ["roles", "klassensprecher", cls.id],
    queryFn: () => api.roles.list({ role_type: "klassensprecher", scope_id: cls.id }),
    enabled: showRoles,
    staleTime: 30_000,
  });

  const assignRoleMut = useMutation({
    mutationFn: (student_id: number) => api.roles.assign({ student_id, role_type: "klassensprecher", scope_id: cls.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); toast("Rolle zugewiesen", "success"); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const removeRoleMut = useMutation({
    mutationFn: (id: number) => api.roles.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadError("");
    const err = await validateImage(file);
    if (err) { setUploadError(err); return; }
    uploadMut.mutate(file);
  }

  return (
    <div
      onClick={onSelect}
      className="rounded-2xl border bg-[var(--surface)] overflow-hidden flex flex-col cursor-pointer transition-all hover:bg-[var(--surface-hover)]"
      style={{
        borderColor: selected ? "var(--accent)" : "var(--border)",
        boxShadow: selected ? "0 0 0 2px var(--accent)33" : undefined,
      }}
    >
      <div className="flex items-center gap-4 p-4">
        <div className="shrink-0">
          <ClassIcon cls={cls} size="3rem" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">
            {cls.code}
            {cls.class_name && (
              <span className="ml-2 text-[var(--text-muted)] font-normal text-sm">„{cls.class_name}"</span>
            )}
          </div>
          {cls.display_name && (
            <div className="text-xs text-[var(--text-muted)] truncate">{cls.display_name}</div>
          )}
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-[var(--accent)]">{cls.total_points}</div>
          <div className="text-xs text-[var(--text-muted)]">Punkte</div>
        </div>
      </div>

      {/* Edit panel — visible only when selected and canEdit */}
      {selected && canEdit && (
        <div
          className="border-t border-[var(--border)] px-4 py-3 flex flex-col gap-2 bg-[var(--bg)]"
          onClick={e => e.stopPropagation()}
        >
          {/* Image upload */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadMut.isPending}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {uploadMut.isPending ? "Lade hoch…" : "🖼 Bild hochladen"}
            </button>
            {uploadError && <span className="text-xs text-red-400">{uploadError}</span>}
          </div>
          <input ref={fileRef} type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            className="hidden" onChange={handleFileChange} />

          {/* Log */}
          <button
            onClick={() => setShowLog(v => !v)}
            className="self-start text-xs text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1"
          >
            📋 {showLog ? "Log ausblenden" : "Punkte-Log anzeigen"}
          </button>
          {showLog && (
            <div className="rounded-lg border border-[var(--border)] overflow-hidden text-xs max-h-48 overflow-y-auto">
              {logQuery.isLoading ? (
                <div className="p-3 text-[var(--text-muted)]">Laden…</div>
              ) : !logQuery.data?.length ? (
                <div className="p-3 text-[var(--text-muted)]">Keine Einträge.</div>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {logQuery.data.map(tx => (
                      <tr key={tx.id} className="border-b border-[var(--border)]/50 last:border-0">
                        <td className="py-1.5 px-2 text-[var(--text-muted)] whitespace-nowrap">
                          {new Date(tx.ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                        </td>
                        <td className={`py-1.5 px-2 font-mono font-bold whitespace-nowrap ${tx.points >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {tx.points > 0 ? "+" : ""}{tx.points}
                        </td>
                        <td className="py-1.5 px-2 text-[var(--text-muted)] truncate max-w-[12rem]">{tx.reason ?? "–"}</td>
                        <td className="py-1.5 px-2 text-[var(--text-muted)] whitespace-nowrap">{tx.teacher_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Klassensprecher */}
          <div>
            <button onClick={() => setShowRoles(v => !v)}
              className="self-start text-xs text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1">
              👑 {showRoles ? "Klassensprecher ausblenden" : "Klassensprecher verwalten"}
            </button>
            {showRoles && (
              <div className="mt-2 flex flex-col gap-1.5">
                {roles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {roles.map(r => (
                      <span key={r.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)]">
                        👑 {r.student_name}
                        <button onClick={() => removeRoleMut.mutate(r.id)}
                          className="ml-0.5 hover:text-red-400">✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <select
                  className="input text-xs py-1"
                  defaultValue=""
                  onChange={e => { if (e.target.value) { assignRoleMut.mutate(Number(e.target.value)); e.target.value = ""; } }}
                >
                  <option value="">Schüler/in zuweisen…</option>
                  {students
                    .filter(s => !roles.some(r => r.student_id === s.id))
                    .sort((a, b) => a.nachname.localeCompare(b.nachname))
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.nachname}, {s.vorname}</option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {editingAlias ? (
            <div className="flex items-center gap-2">
              <input
                className="input text-xs py-1 flex-1"
                placeholder="Klassenname (z. B. Otter)"
                value={aliasInput}
                onChange={e => setAliasInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") nameMut.mutate(aliasInput || null);
                  if (e.key === "Escape") setEditingAlias(false);
                }}
                autoFocus
              />
              <button
                onClick={() => nameMut.mutate(aliasInput || null)}
                disabled={nameMut.isPending}
                className="btn-primary text-xs py-1 px-2"
              >✓</button>
              <button onClick={() => setEditingAlias(false)} className="text-[var(--text-muted)] text-xs">✕</button>
            </div>
          ) : (
            <button
              onClick={() => { setAliasInput(cls.class_name ?? ""); setEditingAlias(true); }}
              className="self-start text-xs text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1"
            >
              ✏️ {cls.class_name ? `„${cls.class_name}" ändern` : "Klassenname festlegen"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function KlassenPage() {
  const { data: classes = [], isLoading } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    staleTime: 30_000,
  });
  const { selectedClass, setSelectedClass } = useSelectedClass();

  const sorted = [...classes].sort((a, b) => b.total_points - a.total_points || a.code.localeCompare(b.code));

  function handleSelect(cls: ClassOut) {
    setSelectedClass(selectedClass?.id === cls.id ? null : cls);
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">🎓 Klassen</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          {sorted.length} Klassen
          {selectedClass
            ? <> · <span style={{ color: "var(--accent)" }}>{selectedClass.code} ausgewählt</span></>
            : " · Klasse auswählen für Punkte vergeben"}
        </p>
      </div>

      {isLoading ? (
        <div className="text-[var(--text-muted)] text-sm">Laden…</div>
      ) : sorted.length === 0 ? (
        <div className="flex items-center justify-center h-40 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)]">
          Noch keine Klassen angelegt.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map(cls => (
            <ClassCard
              key={cls.id}
              cls={cls}
              selected={selectedClass?.id === cls.id}
              onSelect={() => handleSelect(cls)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
