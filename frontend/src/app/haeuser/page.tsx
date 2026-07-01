"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, HausOut, ClassOut, StudentOut, StudentRoleOut, ClassChoreOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSelectedClass } from "@/contexts/SelectedClassContext";
import { HaeuserDiagram } from "@/components/HaeuserDiagram";

function ClassIcon({ cls }: { cls: ClassOut }) {
  if (cls.symbol_image) {
    return (
      <img src={cls.symbol_image} alt={cls.code}
        style={{ width: "2.4rem", height: "2.4rem", objectFit: "contain", borderRadius: 4 }} />
    );
  }
  return <span style={{ fontSize: "2.4rem", lineHeight: 1 }}>{cls.symbol_emoji ?? "📚"}</span>;
}

// ─── Color helpers (used by HausCard/form) ────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) || 0;
  const g = parseInt(c.slice(2, 4), 16) || 0;
  const b = parseInt(c.slice(4, 6), 16) || 0;
  return [r, g, b];
}
function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`;
}
function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amt)},${Math.max(0, g - amt)},${Math.max(0, b - amt)})`;
}

const PALETTE = [
  "#e21b3c", "#1368ce", "#d89e00", "#26890c",
  "#7c3aed", "#db2777", "#ea580c", "#0891b2",
  "#16a34a", "#9333ea", "#c2410c", "#0369a1",
];

// ─── Siegetreppe icon ─────────────────────────────────────────────────────────

function SiegetreppeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 20" fill="currentColor" style={{ display: "inline-block", verticalAlign: "middle" }}>
      <rect x="0"  y="13" width="7"  height="7"  rx="1" opacity="0.45"/>
      <rect x="8"  y="7"  width="7"  height="13" rx="1" opacity="0.7"/>
      <rect x="16" y="1"  width="8"  height="19" rx="1"/>
    </svg>
  );
}

// ─── Classes Bar Diagram ──────────────────────────────────────────────────────

function KlassenDiagram({ classes }: { classes: ClassOut[] }) {
  const sorted = [...classes].sort((a, b) => b.total_points - a.total_points);
  const maxPts = Math.max(...sorted.map(c => c.total_points), 1);

  const BAR_W   = 48;
  const BAR_GAP = 14;
  const MAX_H   = 180;
  const BASE_Y  = 210;
  const PAD_L   = 36;
  const ICON_H  = 28;
  const SVG_H   = BASE_Y + ICON_H + 22;
  const totalW  = sorted.length * (BAR_W + BAR_GAP) - BAR_GAP + PAD_L + 20;

  if (sorted.length === 0) return null;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${totalW} ${SVG_H}`} width="100%" height="auto" style={{ display: "block" }}>
        {/* Y-axis */}
        <line x1={PAD_L} y1={0} x2={PAD_L} y2={BASE_Y} stroke="var(--border)" strokeWidth="1"/>
        {/* Baseline */}
        <line x1={PAD_L} y1={BASE_Y} x2={totalW} y2={BASE_Y} stroke="var(--border)" strokeWidth="1.5"/>

        {sorted.map((cls, i) => {
          const x    = PAD_L + i * (BAR_W + BAR_GAP);
          const pts  = cls.total_points;
          const h    = pts > 0 ? Math.max(3, (pts / maxPts) * MAX_H) : 3;
          const topY = BASE_Y - h;
          const opacity = 1 - (i / Math.max(sorted.length - 1, 1)) * 0.45;
          const hasIcon = !!(cls.symbol_image || cls.symbol_emoji);

          return (
            <g key={cls.id}>
              {/* Bar */}
              <rect x={x} y={BASE_Y} width={BAR_W} height={0}
                fill="var(--accent)" rx={4} ry={4} opacity={opacity}>
                <animate attributeName="height" from="0" to={h}
                  dur="0.7s" begin={`${i * 0.05}s`} fill="freeze"
                  calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>
                <animate attributeName="y" from={BASE_Y} to={topY}
                  dur="0.7s" begin={`${i * 0.05}s`} fill="freeze"
                  calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>
              </rect>

              {/* Points above bar */}
              {pts > 0 && (
                <text x={x + BAR_W / 2} y={topY - 5}
                  textAnchor="middle" fontSize="10" fontWeight="bold"
                  fill="var(--text-muted)">
                  {pts}
                </text>
              )}

              {/* Class icon below baseline: image takes priority over emoji */}
              {cls.symbol_image ? (
                <image
                  href={cls.symbol_image}
                  x={x + (BAR_W - 24) / 2} y={BASE_Y + 4}
                  width={24} height={24}
                />
              ) : cls.symbol_emoji ? (
                <text x={x + BAR_W / 2} y={BASE_Y + 22}
                  textAnchor="middle" fontSize="18">
                  {cls.symbol_emoji}
                </text>
              ) : null}

              {/* Class code */}
              <text
                x={x + BAR_W / 2}
                y={hasIcon ? BASE_Y + ICON_H + 14 : BASE_Y + 16}
                textAnchor="middle" fontSize="10" fontWeight="600"
                fill="var(--text)">
                {cls.code}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Verwalten Modal (triggered from diagram) ────────────────────────────────

function HausVerwaltenModal({
  haus,
  classes,
  onClose,
}: {
  haus: HausOut;
  classes: ClassOut[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { auth } = useAuth();
  const isAdmin = auth?.teacher?.role === "admin";

  const [name, setName]       = useState(haus.name);
  const [color, setColor]     = useState(haus.color);
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set(haus.class_ids));
  const logoRef = useRef<HTMLInputElement>(null);

  const updateMut = useMutation({
    mutationFn: () => api.haeuser.update(haus.id, name, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["haeuser"] }),
  });
  const memberMut = useMutation({
    mutationFn: (ids: number[]) => api.haeuser.setMembers(haus.id, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["haeuser"] }),
  });
  const logoMut = useMutation({
    mutationFn: (file: File) => api.haeuser.uploadLogo(haus.id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["haeuser"] }),
  });

  function toggleMember(cid: number) {
    const next = new Set(memberIds);
    if (next.has(cid)) next.delete(cid); else next.add(cid);
    setMemberIds(next);
    memberMut.mutate(Array.from(next));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <div className="h-1.5" style={{ backgroundColor: color }} />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-base">{haus.name} verwalten</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {isAdmin && (
            <>
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Name</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1 text-sm"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Hausname"
                  />
                  <button
                    onClick={() => updateMut.mutate()}
                    disabled={!name.trim() || updateMut.isPending}
                    className="px-3 py-1.5 text-xs font-semibold bg-[var(--accent)] text-white rounded-lg disabled:opacity-40"
                  >
                    Speichern
                  </button>
                </div>
              </div>

              {/* Color */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Farbe</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-10 h-9 rounded-lg border border-[var(--border)] cursor-pointer bg-[var(--bg)]"
                  />
                  <button
                    onClick={() => updateMut.mutate()}
                    disabled={updateMut.isPending}
                    className="px-3 py-1.5 text-xs font-semibold bg-[var(--accent)] text-white rounded-lg disabled:opacity-40"
                  >
                    Übernehmen
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Avatar / Logo */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Avatar / Logo</label>
                <div className="flex items-center gap-3">
                  {haus.logo_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={haus.logo_path} alt="" className="w-14 h-14 rounded-xl object-cover border border-[var(--border)]" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-2xl border border-[var(--border)]"
                      style={{ background: color }}>
                      {haus.name[0]}
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <input
                      ref={logoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) logoMut.mutate(f); }}
                    />
                    <button
                      onClick={() => logoRef.current?.click()}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      {logoMut.isPending ? "Lade hoch…" : "Bild hochladen"}
                    </button>
                    {haus.logo_path && <span className="text-xs text-green-400">✓ Logo gesetzt</span>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Member classes — visible to all, editable only for admins */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Mitglieds-Klassen</label>
            <div className="flex flex-wrap gap-2">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => isAdmin && toggleMember(cls.id)}
                  disabled={!isAdmin}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    memberIds.has(cls.id)
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)]"
                  } ${isAdmin ? "cursor-pointer hover:border-gray-500" : "cursor-default"}`}
                >
                  {cls.symbol_emoji ?? ""} {cls.code}
                </button>
              ))}
              {classes.length === 0 && (
                <span className="text-xs text-[var(--text-muted)]">Keine Klassen angelegt.</span>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2 text-sm rounded-xl border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Manage Panel ─────────────────────────────────────────────────────────────

function HausCard({
  haus,
  classes,
  onSaved,
}: {
  haus: HausOut;
  classes: ClassOut[];
  onSaved: () => void;
}) {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(haus.name);
  const [color, setColor] = useState(haus.color);
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set(haus.class_ids));
  const logoRef = useRef<HTMLInputElement>(null);

  const updateMut = useMutation({
    mutationFn: () => api.haeuser.update(haus.id, name, color),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["haeuser"] }); onSaved(); },
  });

  const memberMut = useMutation({
    mutationFn: (ids: number[]) => api.haeuser.setMembers(haus.id, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["haeuser"] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.haeuser.delete(haus.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["haeuser"] }),
  });

  const logoMut = useMutation({
    mutationFn: (file: File) => api.haeuser.uploadLogo(haus.id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["haeuser"] }),
  });

  function toggleMember(cid: number) {
    const next = new Set(memberIds);
    if (next.has(cid)) next.delete(cid);
    else next.add(cid);
    setMemberIds(next);
    memberMut.mutate(Array.from(next));
  }

  const isAdmin = auth?.teacher?.role === "admin";

  return (
    <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--surface)]">
      {/* Header bar */}
      <div className="h-2" style={{ backgroundColor: haus.color }} />

      <div className="p-4 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-center gap-3">
          {haus.logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={haus.logo_path} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-lg shrink-0"
              style={{ backgroundColor: haus.color }}
            >
              {haus.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate">{haus.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{haus.total_points} Punkte · {haus.class_ids.length} Klassen</p>
          </div>
          {isAdmin && (
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setEditing(!editing)}
                className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors"
              >
                {editing ? "Schließen" : "Bearbeiten"}
              </button>
              <button
                onClick={() => { if (confirm(`„${haus.name}" wirklich löschen?`)) deleteMut.mutate(); }}
                className="px-2 py-1.5 text-xs rounded-lg text-red-400 hover:bg-red-900/20 border border-red-900/40 transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Edit form */}
        {editing && isAdmin && (
          <div className="flex flex-col gap-3 pt-2 border-t border-[var(--border)]">
            {/* Name + color */}
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Name"
              />
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-10 h-9 rounded-lg border border-[var(--border)] cursor-pointer bg-[var(--bg)]"
                title="Farbe"
              />
              <button
                onClick={() => updateMut.mutate()}
                disabled={!name.trim() || updateMut.isPending}
                className="px-3 py-1.5 text-xs font-semibold bg-[var(--accent)] text-white rounded-lg disabled:opacity-40"
              >
                Speichern
              </button>
            </div>
            {/* Palette quick-picks */}
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? "border-white scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Logo upload */}
            <div className="flex items-center gap-2">
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) logoMut.mutate(f);
                }}
              />
              <button
                onClick={() => logoRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                {logoMut.isPending ? "Lade hoch…" : "Logo hochladen"}
              </button>
              {haus.logo_path && (
                <span className="text-xs text-green-400">✓ Logo vorhanden</span>
              )}
            </div>

            {/* Member classes */}
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Mitglieds-Klassen:</p>
              <div className="flex flex-wrap gap-2">
                {classes.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => toggleMember(cls.id)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      memberIds.has(cls.id)
                        ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-gray-500"
                    }`}
                  >
                    {cls.symbol_emoji ?? ""} {cls.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Members preview (when not editing) */}
        {!editing && haus.class_ids.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {haus.class_ids.map(cid => {
              const cls = classes.find(c => c.id === cid);
              return cls ? (
                <span key={cid} className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)]">
                  {cls.symbol_emoji ?? ""} {cls.code}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AddHausForm({ classes, onDone }: { classes: ClassOut[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);

  const mut = useMutation({
    mutationFn: () => api.haeuser.create(name, color),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["haeuser"] });
      setName("");
      setColor(PALETTE[0]);
      onDone();
    },
  });

  return (
    <div className="border border-dashed border-[var(--accent)]/50 rounded-2xl p-4 flex flex-col gap-3 bg-[var(--accent)]/5">
      <p className="text-sm font-semibold">Neues Haus anlegen</p>
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder="Name des Hauses…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && mut.mutate()}
        />
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="w-10 h-9 rounded-lg border border-[var(--border)] cursor-pointer bg-[var(--bg)]"
          title="Farbe wählen"
        />
        <button
          onClick={() => mut.mutate()}
          disabled={!name.trim() || mut.isPending}
          className="px-4 py-2 text-sm font-semibold bg-[var(--accent)] text-white rounded-lg disabled:opacity-40 hover:opacity-90"
        >
          {mut.isPending ? "…" : "+ Anlegen"}
        </button>
      </div>
      {/* Palette quick-picks */}
      <div className="flex flex-wrap gap-1.5">
        {PALETTE.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? "border-white scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Class Detail Dialog ──────────────────────────────────────────────────────

const CLASS_ROLES = ["Klassensprecher", "Schülersprecher", "Haussprecher"];
const COMPLETION_DAYS = 4;

function StudentChorePopover({
  student, stats, chores,
}: {
  student: StudentOut;
  stats: Record<string, number>;
  chores: ClassChoreOut[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Active assignment for this student that hasn't counted yet
  const activeAssignments = chores.filter(c =>
    c.enabled && c.student_id === student.id && c.assigned_at
  ).map(c => {
    const assigned = new Date(c.assigned_at!);
    const daysHeld = Math.floor((Date.now() - assigned.getTime()) / 86_400_000);
    const daysLeft = Math.max(0, COMPLETION_DAYS - daysHeld);
    return { chore_name: c.chore_name, daysHeld, daysLeft, counted: daysLeft === 0 };
  });

  const totalCompleted = Object.values(stats).reduce((s, n) => s + n, 0);
  const hasAny = totalCompleted > 0 || activeAssignments.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Dienst-Verlauf"
        className={`w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center transition-colors
          ${open ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
      >?</button>

      {open && (
        <div className="absolute right-0 top-8 z-20 w-56 bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-xl p-3 flex flex-col gap-2">
          <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">
            {student.vorname} — Dienst-Verlauf
          </div>
          {!hasAny ? (
            <p className="text-xs text-[var(--text-muted)]">Noch keine abgeschlossenen Dienste.</p>
          ) : (
            <>
              {Object.entries(stats).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text)]">{name}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: "var(--accent)" }}>×{count}</span>
                </div>
              ))}
              {activeAssignments.filter(a => !a.counted).map(a => (
                <div key={a.chore_name} className="flex items-center justify-between gap-2 opacity-50">
                  <span className="text-xs text-[var(--text)]">{a.chore_name}</span>
                  <span className="text-xs tabular-nums text-[var(--text-muted)]">noch {a.daysLeft}d</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ChoreSelector({
  allNames, chores, cls, onToggle, onAddCustom,
}: {
  allNames: string[];
  chores: ClassChoreOut[];
  cls: ClassOut;
  onToggle: (name: string, enabled: boolean) => void;
  onAddCustom: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const enabledNames = new Set(chores.filter(c => c.enabled).map(c => c.chore_name));
  const activeCount = enabledNames.size;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] w-full"
      >
        <span className="flex-1 text-left text-[var(--text-muted)]">
          🧹 Dienste auswählen
        </span>
        <span className="text-xs bg-[var(--accent)] text-white rounded-full px-2 py-0.5">{activeCount} aktiv</span>
        <span className="text-[var(--text-muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {allNames.map(name => {
              const checked = enabledNames.has(name);
              return (
                <label key={name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(name, !checked)}
                    className="accent-[var(--accent)] w-4 h-4"
                  />
                  <span className="text-sm">{name}</span>
                </label>
              );
            })}
          </div>
          <div className="border-t border-[var(--border)] p-2 flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Eigener Dienst…"
              className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm"
              onKeyDown={e => {
                if (e.key === "Enter" && newName.trim()) {
                  onAddCustom(newName.trim());
                  setNewName("");
                }
              }}
            />
            <button
              onClick={() => { if (newName.trim()) { onAddCustom(newName.trim()); setNewName(""); } }}
              className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
            >+</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KlassenlisteSection({
  students, roles, chores, choreStats,
}: {
  students: StudentOut[];
  roles: StudentRoleOut[];
  chores: ClassChoreOut[];
  choreStats: import("@/lib/api").ClassChoreStats;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const sorted = [...students].sort(
    (a, b) => a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname)
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-6">Keine Schüler:innen in dieser Klasse.</p>;
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Reset row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--text-muted)]">{checked.size > 0 ? `${checked.size} markiert` : ""}</span>
        {checked.size > 0 && (
          <button
            onClick={() => setChecked(new Set())}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] rounded-lg px-3 py-1 transition-colors"
          >
            ↺ Zurücksetzen
          </button>
        )}
      </div>

      <div className="flex flex-col divide-y divide-[var(--border)]">
        {sorted.map(s => {
          const studentRoles = roles.filter(r => r.student_id === s.id);
          const studentChores = chores.filter(c => c.enabled && c.student_id === s.id);
          const studentStats = choreStats[s.id] ?? {};
          const isChecked = checked.has(s.id);

          return (
            <label key={s.id} className="flex items-center gap-3 py-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => setChecked(prev => {
                  const next = new Set(prev);
                  next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                  return next;
                })}
                className="accent-[var(--accent)] w-4 h-4 shrink-0"
              />
              <span className={`text-sm font-semibold shrink-0 transition-colors ${isChecked ? "line-through text-[var(--text-muted)]" : ""}`}>
                {s.nachname}, {s.vorname}
              </span>
              {/* Roles in accent */}
              {studentRoles.map(r => (
                <span key={r.id} className="text-xs px-1.5 py-0.5 rounded-md shrink-0" style={{ background: "var(--accent)22", color: "var(--accent)" }}>
                  {r.role_type}
                </span>
              ))}
              {/* Chores in muted */}
              {studentChores.map(c => {
                const days = c.assigned_at
                  ? Math.floor((Date.now() - new Date(c.assigned_at).getTime()) / 86_400_000)
                  : 0;
                return (
                  <span key={c.id} className="text-xs px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] shrink-0">
                    {c.chore_name}{days > 0 ? ` · ${days}d` : ""}
                  </span>
                );
              })}
              <span className="flex-1" />
              {Object.keys(studentStats).length > 0 && (
                <StudentChorePopover student={s} stats={studentStats} chores={chores} />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function TrackingSection({
  cls, students,
}: {
  cls: ClassOut;
  students: StudentOut[];
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: trackers = [] } = useQuery<import("@/lib/api").ClassTrackerOut[]>({
    queryKey: ["trackers", cls.id],
    queryFn: () => api.trackers.list(cls.id),
  });

  const createTracker = useMutation({
    mutationFn: (name: string) => api.trackers.create({ class_id: cls.id, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trackers", cls.id] });
      setNewName("");
    },
  });

  const deleteTracker = useMutation({
    mutationFn: (id: number) => api.trackers.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trackers", cls.id] }),
  });

  const toggleCheck = useMutation({
    mutationFn: ({ tracker_id, student_id }: { tracker_id: number; student_id: number }) =>
      api.trackers.toggle(tracker_id, student_id),
    onSuccess: (updated) => {
      qc.setQueryData<import("@/lib/api").ClassTrackerOut[]>(["trackers", cls.id], prev =>
        prev ? prev.map(t => t.id === updated.id ? updated : t) : prev
      );
    },
  });

  const sorted = [...students].sort(
    (a, b) => a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname)
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Add tracker input */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Neues Tracking-Element… (z. B. Materialgeld)"
          className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
          onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createTracker.mutate(newName.trim()); }}
        />
        <button
          onClick={() => { if (newName.trim()) createTracker.mutate(newName.trim()); }}
          disabled={!newName.trim() || createTracker.isPending}
          className="px-3 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-40"
        >+</button>
      </div>

      {trackers.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          Noch keine Tracking-Elemente. Oben hinzufügen.
        </p>
      )}

      {trackers.map(tracker => {
        const checkedIds = new Set(tracker.checked_student_ids);
        const doneCount = checkedIds.size;
        const total = sorted.length;
        return (
          <div key={tracker.id} className="flex flex-col gap-2">
            {/* Tracker header */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm flex-1">{tracker.name}</span>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">{doneCount}/{total}</span>
              <button
                onClick={() => deleteTracker.mutate(tracker.id)}
                className="text-[var(--text-muted)] hover:text-red-400 text-sm px-1 transition-colors"
                title="Tracker löschen"
              >✕</button>
            </div>
            {/* Student checklist */}
            <div className="flex flex-col divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] overflow-hidden">
              {sorted.map(s => {
                const done = checkedIds.has(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--surface-hover)]">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleCheck.mutate({ tracker_id: tracker.id, student_id: s.id })}
                      className="accent-[var(--accent)] w-4 h-4 shrink-0"
                    />
                    <span className={`text-sm flex-1 transition-colors ${done ? "line-through text-[var(--text-muted)]" : ""}`}>
                      {s.nachname}, {s.vorname}
                    </span>
                    {done && <span className="text-xs text-[var(--accent)]">✓</span>}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClassDetailDialog({ cls, onClose }: { cls: ClassOut; onClose: () => void }) {
  const qc = useQueryClient();
  const [section, setSection] = useState<"schüler" | "rollen" | "dienste" | "tracking">("schüler");
  const [newRole, setNewRole] = useState("");

  const { data: students = [] } = useQuery<StudentOut[]>({
    queryKey: ["students", cls.id],
    queryFn: () => api.students.list({ klasse: cls.code }),
  });

  const { data: roles = [] } = useQuery<StudentRoleOut[]>({
    queryKey: ["roles", cls.id],
    queryFn: () => api.roles.list({ scope_id: cls.id }),
  });

  const { data: chores = [] } = useQuery<ClassChoreOut[]>({
    queryKey: ["chores", cls.id],
    queryFn: () => api.chores.list(cls.id),
  });

  const { data: choreStats = {} } = useQuery<import("@/lib/api").ClassChoreStats>({
    queryKey: ["chore-stats", cls.id],
    queryFn: () => api.chores.stats(cls.id),
    staleTime: 60_000,
  });

  const { data: allChoreNames = [] } = useQuery<string[]>({
    queryKey: ["chores-all-names"],
    queryFn: () => api.chores.allNames(),
    staleTime: 30_000,
  });

  const assignRole = useMutation({
    mutationFn: ({ role_type, student_id }: { role_type: string; student_id: number | null }) =>
      student_id
        ? api.roles.assign({ student_id, role_type, scope_id: cls.id })
        : Promise.resolve(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles", cls.id] }),
  });

  const removeRole = useMutation({
    mutationFn: (id: number) => api.roles.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles", cls.id] }),
  });

  const upsertChore = useMutation({
    mutationFn: (body: { chore_name: string; student_id?: number | null; enabled?: boolean }) =>
      api.chores.upsert({ class_id: cls.id, ...body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chores", cls.id] });
      qc.invalidateQueries({ queryKey: ["chores-all-names"] });
      qc.invalidateQueries({ queryKey: ["chore-stats", cls.id] });
    },
  });

  const clearChores = useMutation({
    mutationFn: () => api.chores.clear(cls.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chores", cls.id] });
      qc.invalidateQueries({ queryKey: ["chore-stats", cls.id] });
    },
  });

  const randomAssign = useMutation({
    mutationFn: () => api.chores.randomAssign(cls.id),
    onSuccess: (data) => {
      qc.setQueryData<ClassChoreOut[]>(["chores", cls.id], prev =>
        prev ? prev.map(c => data.find(d => d.id === c.id) ?? c) : data
      );
      qc.invalidateQueries({ queryKey: ["chore-stats", cls.id] });
    },
  });

  function getRoleFor(role_type: string): StudentRoleOut | undefined {
    return roles.find(r => r.role_type.toLowerCase() === role_type.toLowerCase() && r.scope_id === cls.id);
  }

  const allRoleTypes = [...new Set([...CLASS_ROLES, ...roles.map(r => r.role_type)])];
  if (newRole.trim() && !allRoleTypes.includes(newRole.trim())) allRoleTypes.push(newRole.trim());

  const enabledChores = chores.filter(c => c.enabled);

  function handleToggleChore(name: string, enable: boolean) {
    upsertChore.mutate({ chore_name: name, enabled: enable, student_id: null });
  }

  function handleAddCustom(name: string) {
    upsertChore.mutate({ chore_name: name, enabled: true, student_id: null });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full sm:max-w-xl max-h-[85dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-[var(--bg)] border border-[var(--border)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] shrink-0">
          <ClassIcon cls={cls} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg truncate">{cls.code}{cls.class_name ? ` — „${cls.class_name}"` : ""}</div>
            <div className="text-xs text-[var(--text-muted)]">{students.length} Schüler:innen</div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-2xl leading-none px-1">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)] shrink-0">
          {(["schüler", "rollen", "dienste", "tracking"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className="flex-1 py-2.5 text-xs font-semibold transition-colors"
              style={{
                color: section === s ? "var(--accent)" : "var(--text-muted)",
                borderBottom: section === s ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              {s === "schüler" ? "👥 Klasse" : s === "rollen" ? "👑 Rollen" : s === "dienste" ? "🧹 Dienste" : "📋 Tracking"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">

          {/* ── Schüler ── */}
          {section === "schüler" && (
            <KlassenlisteSection
              students={students}
              roles={roles}
              chores={chores}
              choreStats={choreStats}
            />
          )}

          {/* ── Rollen ── */}
          {section === "rollen" && (
            <>
              {allRoleTypes.map(role_type => {
                const existing = getRoleFor(role_type);
                return (
                  <div key={role_type} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 text-sm font-semibold text-[var(--text-muted)] capitalize">{role_type}</div>
                    <select
                      className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                      value={existing?.student_id ?? ""}
                      onChange={e => {
                        const sid = e.target.value ? Number(e.target.value) : null;
                        if (existing && !sid) removeRole.mutate(existing.id);
                        else if (sid) assignRole.mutate({ role_type, student_id: sid });
                      }}
                    >
                      <option value="">— niemand —</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.vorname} {s.nachname}</option>
                      ))}
                    </select>
                  </div>
                );
              })}

              {/* Add custom role */}
              <div className="flex gap-2 mt-2">
                <input
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  placeholder="Neue Rolle…"
                  className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                  onKeyDown={e => { if (e.key === "Enter") setNewRole(""); }}
                />
                <button
                  onClick={() => setNewRole("")}
                  className="px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
                >
                  + Hinzufügen
                </button>
              </div>
            </>
          )}

          {/* ── Dienste ── */}
          {section === "dienste" && (
            <>
              {/* Chore picker dropdown */}
              <ChoreSelector
                allNames={allChoreNames}
                chores={chores}
                cls={cls}
                onToggle={handleToggleChore}
                onAddCustom={handleAddCustom}
              />

              {/* Action buttons */}
              {enabledChores.length > 0 && (
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => clearChores.mutate()}
                    className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
                  >
                    🗑 Zuweisungen löschen
                  </button>
                  <button
                    onClick={() => randomAssign.mutate()}
                    disabled={randomAssign.isPending}
                    className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    🎲 Zufällig zuweisen
                  </button>
                </div>
              )}

              {/* Assignment rows — only enabled chores */}
              {enabledChores.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-6">
                  Noch keine Dienste aktiviert. Oben Dienste auswählen.
                </p>
              ) : (
                enabledChores.map(chore => (
                  <div key={chore.id} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 text-sm font-semibold text-[var(--text-muted)]">{chore.chore_name}</div>
                    <select
                      className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                      value={chore.student_id ?? ""}
                      onChange={e => {
                        const sid = e.target.value ? Number(e.target.value) : null;
                        upsertChore.mutate({ chore_name: chore.chore_name, student_id: sid, enabled: true });
                      }}
                    >
                      <option value="">— niemand —</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.vorname} {s.nachname}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </>
          )}

          {/* ── Tracking ── */}
          {section === "tracking" && (
            <TrackingSection cls={cls} students={students} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HaeuserPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const { selectedClass, setSelectedClass } = useSelectedClass();
  const [tab, setTab] = useState<"charts" | "manage" | "klassen">("charts");
  const [showAddForm, setShowAddForm] = useState(false);
  const [verwaltenHaus, setVerwaltenHaus] = useState<HausOut | null>(null);
  const [detailClass, setDetailClass] = useState<ClassOut | null>(null);

  const { data: haeuser = [], isLoading: hLoading } = useQuery<HausOut[]>({
    queryKey: ["haeuser"],
    queryFn: api.haeuser.list,
    refetchInterval: 15_000,
  });

  const { data: classes = [], isLoading: cLoading } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    refetchInterval: 15_000,
  });

  const isAdmin = auth?.teacher?.role === "admin";
  const sortedByPts = haeuser;

  return (
    <div className="p-6 flex flex-col gap-6 min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <button onClick={() => router.push("/admin")} className="self-start text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">← Zurück</button>
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">🛡️ Häuser &amp; Klassen</h1>
        <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
          {([
            ["charts",  "📊 Übersicht"],
            ["klassen", "🎓 Klassen"],
            ["manage",  "⚙️ Verwaltung"],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                tab === t
                  ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* ── Diagramme ── */}
      {tab === "charts" && (
        <div className="flex flex-col gap-8">
          {/* Houses 3D chart */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
            {hLoading ? (
              <div className="h-32 flex items-center justify-center text-[var(--text-muted)]">Laden…</div>
            ) : (
              <HaeuserDiagram haeuser={haeuser} />
            )}
          </div>

          {/* Classes bar chart */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><SiegetreppeIcon size={22} /> Klassen-Übersicht</h2>
            {cLoading ? (
              <div className="h-32 flex items-center justify-center text-[var(--text-muted)]">Laden…</div>
            ) : (
              <KlassenDiagram classes={classes} />
            )}
          </div>
        </div>
      )}

      {/* ── Klassen ── */}
      {tab === "klassen" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            {classes.length} Klassen
            {selectedClass && (
              <> · <span style={{ color: "var(--accent)" }}>{selectedClass.code} ausgewählt</span></>
            )}
            {!selectedClass && " · Klasse auswählen für Punkte vergeben"}
          </p>
          {cLoading ? (
            <div className="text-[var(--text-muted)] text-sm">Laden…</div>
          ) : classes.length === 0 ? (
            <div className="flex items-center justify-center h-40 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)]">
              Noch keine Klassen angelegt.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...classes]
                .sort((a, b) => b.total_points - a.total_points || a.code.localeCompare(b.code))
                .map(cls => (
                  <div
                    key={cls.id}
                    className="rounded-2xl border bg-[var(--surface)] flex items-center gap-4 p-4 transition-all"
                    style={{
                      borderColor: selectedClass?.id === cls.id ? "var(--accent)" : "var(--border)",
                      boxShadow: selectedClass?.id === cls.id ? "0 0 0 2px var(--accent)33" : undefined,
                    }}
                  >
                    <button
                      className="flex items-center gap-4 flex-1 min-w-0 text-left hover:opacity-80"
                      onClick={() => setSelectedClass(selectedClass?.id === cls.id ? null : cls)}
                    >
                    <ClassIcon cls={cls} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">
                        {cls.code}
                        {cls.class_name && (
                          <span className="ml-2 text-[var(--text-muted)] font-normal text-sm">
                            „{cls.class_name}"
                          </span>
                        )}
                      </div>
                      {cls.display_name && (
                        <div className="text-xs text-[var(--text-muted)] truncate">{cls.display_name}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                        {cls.total_points}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">Pkt</div>
                    </div>
                    </button>
                    <button
                      onClick={() => setDetailClass(cls)}
                      className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                      title="Klasse konfigurieren"
                    >
                      ⚙️
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Verwaltung ── */}
      {tab === "manage" && (
        <div className="flex flex-col gap-4">
          {/* Add form */}
          {isAdmin && (
            showAddForm ? (
              <AddHausForm classes={classes} onDone={() => setShowAddForm(false)} />
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="self-start px-4 py-2 text-sm font-semibold bg-[var(--accent)] text-white rounded-xl hover:opacity-90"
              >
                + Neues Haus
              </button>
            )
          )}

          {hLoading ? (
            <p className="text-[var(--text-muted)]">Laden…</p>
          ) : sortedByPts.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-2xl">
              Noch keine Häuser angelegt.
              {isAdmin && (
                <p className="mt-2 text-sm">Klick auf „+ Neues Haus" um zu starten.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedByPts.map(h => (
                <HausCard key={h.id} haus={h} classes={classes} onSaved={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}

      {verwaltenHaus && (
        <HausVerwaltenModal
          haus={verwaltenHaus}
          classes={classes}
          onClose={() => setVerwaltenHaus(null)}
        />
      )}

      {detailClass && (
        <ClassDetailDialog cls={detailClass} onClose={() => setDetailClass(null)} />
      )}
    </div>
  );
}
