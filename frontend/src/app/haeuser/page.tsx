"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, HausOut, ClassOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { HaeuserDiagram } from "@/components/HaeuserDiagram";

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

// ─── Classes Bar Diagram ──────────────────────────────────────────────────────

function KlassenDiagram({ classes }: { classes: ClassOut[] }) {
  const sorted = [...classes].sort((a, b) => b.total_points - a.total_points);
  const maxPts = Math.max(...sorted.map(c => c.total_points), 1);

  const BAR_W = 48;
  const BAR_GAP = 14;
  const MAX_H = 180;
  const BASE_Y = 210;
  const PAD_L = 36;
  const SVG_H = BASE_Y + 60;
  const totalW = sorted.length * (BAR_W + BAR_GAP) - BAR_GAP + PAD_L + 20;

  const barColor = "var(--accent)";

  if (sorted.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-2">
      <svg width={totalW} height={SVG_H} style={{ minWidth: totalW, display: "block" }}>
        <defs>
          <linearGradient id="kd-bar-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>

        {/* Y-axis line */}
        <line x1={PAD_L} y1={0} x2={PAD_L} y2={BASE_Y} stroke="var(--border)" strokeWidth="1" />
        {/* Baseline */}
        <line x1={PAD_L} y1={BASE_Y} x2={totalW} y2={BASE_Y} stroke="var(--border)" strokeWidth="1.5" />

        {sorted.map((cls, i) => {
          const x = PAD_L + i * (BAR_W + BAR_GAP);
          const pts = cls.total_points;
          const h = pts > 0 ? Math.max(3, (pts / maxPts) * MAX_H) : 3;
          const topY = BASE_Y - h;

          return (
            <g key={cls.id}>
              {/* Bar */}
              <rect x={x} y={BASE_Y} width={BAR_W} height={0} fill="url(#kd-bar-grad)" rx={4} ry={4}>
                <animate
                  attributeName="height" from="0" to={h}
                  dur="0.7s" begin={`${i * 0.05}s`} fill="freeze"
                  calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"
                />
                <animate
                  attributeName="y" from={BASE_Y} to={topY}
                  dur="0.7s" begin={`${i * 0.05}s`} fill="freeze"
                  calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"
                />
              </rect>

              {/* Points label above bar (only if bar is taller than ~24px) */}
              {pts > 0 && (
                <text
                  x={x + BAR_W / 2} y={topY - 5}
                  textAnchor="middle" fontSize="10" fontWeight="bold"
                  fill="var(--text-muted)"
                >
                  {pts}
                </text>
              )}

              {/* Emoji or initial below baseline */}
              <text
                x={x + BAR_W / 2} y={BASE_Y + 18}
                textAnchor="middle" fontSize="18"
              >
                {cls.symbol_emoji ?? cls.code.slice(0, 2)}
              </text>

              {/* Class code */}
              <text
                x={x + BAR_W / 2} y={BASE_Y + 36}
                textAnchor="middle" fontSize="10" fontWeight="600"
                fill="var(--text)"
              >
                {cls.code}
              </text>
            </g>
          );
        })}
      </svg>
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

  const isAdmin = auth?.teacher.role === "admin";

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HaeuserPage() {
  const { auth } = useAuth();
  const [tab, setTab] = useState<"charts" | "manage">("charts");
  const [showAddForm, setShowAddForm] = useState(false);

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

  const isAdmin = auth?.teacher.role === "admin";
  const sortedByPts = haeuser;

  return (
    <div className="p-6 flex flex-col gap-6 min-h-full">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">🏛️ Häuser</h1>
        <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
          {(["charts", "manage"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                tab === t
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {t === "charts" ? "📊 Diagramme" : "⚙️ Verwaltung"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Diagramme ── */}
      {tab === "charts" && (
        <div className="flex flex-col gap-8">
          {/* Houses 3D chart */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <h2 className="text-lg font-bold mb-4">🏛️ Häuser-Rangliste</h2>
            {hLoading ? (
              <div className="h-32 flex items-center justify-center text-[var(--text-muted)]">Laden…</div>
            ) : (
              <HaeuserDiagram haeuser={haeuser} />
            )}
          </div>

          {/* Classes bar chart */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <h2 className="text-lg font-bold mb-4">📊 Klassen-Übersicht</h2>
            {cLoading ? (
              <div className="h-32 flex items-center justify-center text-[var(--text-muted)]">Laden…</div>
            ) : (
              <KlassenDiagram classes={classes} />
            )}
          </div>
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
    </div>
  );
}
