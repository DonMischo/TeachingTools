"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, HausOut, ClassOut, StudentOut, StudentRoleOut, ClassChoreOut, TransactionOut, StudentGroupOut, GroupType } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { HaeuserDiagram } from "@/components/HaeuserDiagram";

const ALLOWED_IMG_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMG_DIM = 1024;

async function validateClassImage(file: File): Promise<string | null> {
  if (!ALLOWED_IMG_TYPES.includes(file.type)) return "Nur PNG, JPG und WEBP erlaubt.";
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.width > MAX_IMG_DIM || img.height > MAX_IMG_DIM
        ? `Zu groß (${img.width}×${img.height} px). Max. ${MAX_IMG_DIM}×${MAX_IMG_DIM} px.` : null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve("Bild konnte nicht gelesen werden."); };
    img.src = url;
  });
}

// Klassenstufe aus Code wie "9a", "10b" ableiten
function gradeOf(code: string): number | null {
  const m = code.match(/^(\d{1,2})/);
  return m ? parseInt(m[1], 10) : null;
}

const KURS_PRESETS = ["Kurs I", "Kurs II", "Kurs III", "Kursgruppe"];
const WAHLPFLICHT_PRESETS = ["DuG", "NaT", "Fr", "Span"];

/** Compact label for the Klassenübersicht badges: "Kurs I"→"K1", "Kursgruppe"→"KG".
 *  WPF/other groups already carry their short label (Fr, Span, NaT, DuG). */
function groupShortCode(name: string): string {
  const kurs: Record<string, string> = {
    "Kurs I": "K1", "Kurs II": "K2", "Kurs III": "K3", "Kursgruppe": "KG",
  };
  return kurs[name.trim()] ?? name.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/** Name shown in exports: alias if set, else the first of the first names. */
function displayFirstName(vorname: string, alias: string | null | undefined): string {
  const a = alias?.trim();
  if (a) return a;
  return firstNameTokens(vorname)[0] ?? vorname;
}

/**
 * Open a printable A4-portrait list (Nachname, Vorname + a blank 0.8 cm grid
 * filling the page width) for a class / Kurs / Wahlpflicht roster.
 */
function exportRosterList(title: string, entries: { nachname: string; vorname: string; alias?: string | null }[]) {
  const CELL_MM = 8;     // 0.8 cm per grid cell
  const NACH_MM = 42;
  const VOR_MM  = 34;
  const USABLE_MM = 186; // A4 portrait (210 mm) minus 12 mm margins each side
  const cells = Math.max(1, Math.floor((USABLE_MM - NACH_MM - VOR_MM) / CELL_MM));

  const sorted = [...entries].sort(
    (a, b) => a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname)
  );
  const gridHead = Array.from({ length: cells }, () => `<th class="cell"></th>`).join("");
  const rows = sorted.map(e => `<tr>
      <td class="nach">${escapeHtml(e.nachname)}</td>
      <td class="vor">${escapeHtml(displayFirstName(e.vorname, e.alias))}</td>
      ${Array.from({ length: cells }, () => `<td class="cell"></td>`).join("")}
    </tr>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; color: #111; }
    h1 { font-size: 13pt; margin-bottom: 4mm; }
    table { border-collapse: collapse; table-layout: fixed; width: ${USABLE_MM}mm; }
    th, td { border: 0.3mm solid #333; height: ${CELL_MM}mm; font-size: 9pt; }
    th { background: #eee; }
    .nach, .vor { padding: 0 2mm; text-align: left; white-space: nowrap; overflow: hidden; }
    .nach { width: ${NACH_MM}mm; }
    .vor  { width: ${VOR_MM}mm; }
    .cell { width: ${CELL_MM}mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style></head><body>
    <h1>${escapeHtml(title)} · ${sorted.length}</h1>
    <table><thead><tr><th class="nach">Nachname</th><th class="vor">Vorname</th>${gridHead}</tr></thead>
    <tbody>${rows}</tbody></table>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

/** Kurs/Wahlpflicht level colors: I=rot, II=blau, III=grün (see legend). */
function kursLevel(name: string): "I" | "II" | "III" | null {
  const m = name.trim().match(/\b(III|II|I)$/);
  return (m?.[1] as "I" | "II" | "III") ?? null;
}

function kursBadgeClasses(name: string): string {
  switch (kursLevel(name)) {
    case "I":   return "bg-red-500/10 text-red-400 border-red-500/20";
    case "II":  return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "III": return "bg-green-500/10 text-green-400 border-green-500/20";
    default:    return "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]";
  }
}
const AB_PRESETS = ["A", "B"];

function GroupTabSection({
  groupType, cls, students, presetNames,
}: {
  groupType: GroupType;
  cls: ClassOut;
  students: StudentOut[];
  presetNames: string[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const scopedToClass = groupType === "ab_gruppe";
  const listKey = ["groups", groupType, scopedToClass ? cls.id : "all"];

  const { data: groups = [] } = useQuery<StudentGroupOut[]>({
    queryKey: listKey,
    queryFn: () => api.groups.list(scopedToClass ? { group_type: groupType, class_id: cls.id } : { group_type: groupType }),
    staleTime: 15_000,
  });

  const createMut = useMutation({
    mutationFn: (name: string) => api.groups.create({ group_type: groupType, name, class_id: scopedToClass ? cls.id : null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ groupId, studentId, member }: { groupId: number; studentId: number; member: boolean }) =>
      member ? api.groups.removeMember(groupId, studentId) : api.groups.addMember(groupId, studentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const missingPresets = presetNames.filter(p => !groups.some(g => g.name === p));

  return (
    <div className="flex flex-col gap-2">
      {groups.length === 0 && (
        <p className="text-xs text-[var(--text-muted)]">Noch keine Gruppen.</p>
      )}
      {groups.map(g => (
        <div key={g.id} className="rounded-lg border border-[var(--border)] p-2">
          <div className="text-xs font-semibold mb-1">{g.name} <span className="text-[var(--text-muted)] font-normal">({g.member_ids.length})</span></div>
          <div className="flex flex-wrap gap-1">
            {students.map(s => {
              const member = g.member_ids.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleMut.mutate({ groupId: g.id, studentId: s.id, member })}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    member
                      ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  {s.vorname} {s.nachname[0]}.
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {missingPresets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {missingPresets.map(p => (
            <button
              key={p}
              onClick={() => createMut.mutate(p)}
              disabled={createMut.isPending}
              className="text-xs px-2 py-1 rounded-lg border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >+ {p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupsManager({ cls, students }: { cls: ClassOut; students: StudentOut[] }) {
  const grade = gradeOf(cls.code);
  const showKurs = grade !== null && grade >= 9;
  const showWahlpflicht = grade !== null && grade >= 7;
  const tabs: { key: GroupType; label: string; presets: string[] }[] = [
    ...(showKurs ? [{ key: "kurs" as GroupType, label: "Kurse", presets: KURS_PRESETS }] : []),
    ...(showWahlpflicht ? [{ key: "wahlpflicht" as GroupType, label: "Wahlpflicht", presets: WAHLPFLICHT_PRESETS }] : []),
    { key: "ab_gruppe" as GroupType, label: "Gruppen A/B", presets: AB_PRESETS },
  ];
  const [tab, setTab] = useState<GroupType>(tabs[0].key);
  const active = tabs.find(t => t.key === tab) ?? tabs[0];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
              tab === t.key
                ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
            }`}
          >{t.label}</button>
        ))}
      </div>
      <GroupTabSection groupType={active.key} cls={cls} students={students} presetNames={active.presets} />
    </div>
  );
}

function ClassIcon({ cls }: { cls: ClassOut }) {
  if (cls.symbol_image) {
    return (
      <img src={cls.symbol_image} alt={cls.code}
        style={{ width: "2.4rem", height: "2.4rem", objectFit: "contain", borderRadius: 4 }} />
    );
  }
  return <span style={{ fontSize: "2.4rem", lineHeight: 1 }}>{cls.symbol_emoji ?? "📚"}</span>;
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

const CLASS_ROLES = ["Klassensprecher", "Stellvertretender Klassensprecher", "Schülersprecher", "Haussprecher"];
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

/** Checkbox dropdown for picking which role types a class uses. */
function RoleSelector({
  catalog, active, onSetTypes,
}: {
  catalog: string[];
  active: string[];
  onSetTypes: (types: string[]) => void;
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

  const activeSet = new Set(active.map(t => t.toLowerCase()));

  function toggle(name: string) {
    onSetTypes(
      activeSet.has(name.toLowerCase())
        ? active.filter(t => t.toLowerCase() !== name.toLowerCase())
        : [...active, name]
    );
  }

  function addCustom() {
    const name = newName.trim();
    if (!name) return;
    if (!activeSet.has(name.toLowerCase())) onSetTypes([...active, name]);
    setNewName("");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] w-full"
      >
        <span className="flex-1 text-left text-[var(--text-muted)]">👑 Rollen auswählen</span>
        <span className="text-xs bg-[var(--accent)] text-white rounded-full px-2 py-0.5">{active.length} aktiv</span>
        <span className="text-[var(--text-muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {catalog.map(name => (
              <label key={name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeSet.has(name.toLowerCase())}
                  onChange={() => toggle(name)}
                  className="accent-[var(--accent)] w-4 h-4"
                />
                <span className="text-sm">{name}</span>
              </label>
            ))}
          </div>
          <div className="border-t border-[var(--border)] p-2 flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Eigene Rolle…"
              className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm"
              onKeyDown={e => { if (e.key === "Enter") addCustom(); }}
            />
            <button
              onClick={addCustom}
              className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
            >+</button>
          </div>
        </div>
      )}
    </div>
  );
}

type KlassenlisteFilter = "rollen" | "gruppen" | "dienste";
const KLASSENLISTE_FILTERS: { key: KlassenlisteFilter; label: string }[] = [
  { key: "rollen", label: "👑 Rollen" },
  { key: "gruppen", label: "🧩 Gruppen" },
  { key: "dienste", label: "🧹 Dienste" },
];

function KlassenlisteSection({
  students, roles, chores, choreStats, groups,
}: {
  students: StudentOut[];
  roles: StudentRoleOut[];
  chores: ClassChoreOut[];
  choreStats: import("@/lib/api").ClassChoreStats;
  groups: StudentGroupOut[];
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Set<KlassenlisteFilter>>(
    new Set(["rollen", "gruppen", "dienste"])
  );

  function toggleFilter(f: KlassenlisteFilter) {
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  }

  const sorted = [...students].sort(
    (a, b) => a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname)
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-6">Keine Schüler:innen in dieser Klasse.</p>;
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Filter row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {KLASSENLISTE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => toggleFilter(f.key)}
            className="text-xs px-2.5 py-1 rounded-full border transition-colors"
            style={
              activeFilters.has(f.key)
                ? { background: "var(--accent)22", color: "var(--accent)", borderColor: "var(--accent)" }
                : { color: "var(--text-muted)", borderColor: "var(--border)" }
            }
          >
            {f.label}
          </button>
        ))}
        {activeFilters.has("gruppen") && (
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] ml-1">
            <span className="px-1.5 py-0.5 rounded-md border bg-red-500/10 text-red-400 border-red-500/20">Kurs I</span>
            <span className="px-1.5 py-0.5 rounded-md border bg-blue-500/10 text-blue-400 border-blue-500/20">Kurs II</span>
            <span className="px-1.5 py-0.5 rounded-md border bg-green-500/10 text-green-400 border-green-500/20">Kurs III</span>
          </span>
        )}
      </div>

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
          const studentGroups = groups.filter(g => g.member_ids.includes(s.id));
          const studentStats = choreStats[s.id] ?? {};
          const isChecked = checked.has(s.id);

          return (
            <label key={s.id} className="flex items-center gap-3 py-2.5 cursor-pointer group flex-wrap">
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
              {activeFilters.has("rollen") && studentRoles.map(r => (
                <span key={r.id} className="text-xs px-1.5 py-0.5 rounded-md shrink-0" style={{ background: "var(--accent)22", color: "var(--accent)" }}>
                  {r.role_type}
                </span>
              ))}
              {/* Groups (Kurse/Wahlpflicht/A-B) — Kursstufe color-coded */}
              {activeFilters.has("gruppen") && studentGroups.map(g => (
                <span key={g.id} className={`text-xs px-1.5 py-0.5 rounded-md shrink-0 border ${kursBadgeClasses(g.name)}`}>
                  {g.name}
                </span>
              ))}
              {/* Chores in muted */}
              {activeFilters.has("dienste") && studentChores.map(c => {
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
              {activeFilters.has("dienste") && Object.keys(studentStats).length > 0 && (
                <StudentChorePopover student={s} stats={studentStats} chores={chores} />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function firstNameTokens(vorname: string): string[] {
  return vorname.trim().split(/\s+/).filter(Boolean);
}

// Per-student Alias (for the Sitzplan) + Nachteilsausgleich flags (1–5).
function NtaSection({
  cls, students, canEdit,
}: {
  cls: ClassOut;
  students: StudentOut[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [customMode, setCustomMode] = useState<Set<number>>(new Set());
  const [customText, setCustomText] = useState<Record<number, string>>({});

  const save = useMutation({
    mutationFn: ({ id, alias, nta }: { id: number; alias: string | null; nta: number[] }) =>
      api.students.updateProfile(id, { alias, nta }),
    onSuccess: (updated) => {
      qc.setQueryData<StudentOut[]>(["students", cls.id], prev =>
        prev ? prev.map(s => s.id === updated.id ? updated : s) : prev);
      qc.invalidateQueries({ queryKey: ["roster", cls.id] });
    },
  });

  const sorted = [...students].sort((a, b) =>
    a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname));

  function toggleNta(s: StudentOut, n: number) {
    if (!canEdit) return;
    const nta = s.nta.includes(n) ? s.nta.filter(x => x !== n) : [...s.nta, n].sort((a, b) => a - b);
    save.mutate({ id: s.id, alias: s.alias, nta });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-[var(--text-muted)] text-xs">
            <th className="text-left py-2 px-2">Name</th>
            <th className="text-left py-2 px-2 min-w-[10rem]">Alias (Sitzplan)</th>
            {[1, 2, 3, 4, 5].map(n => (
              <th key={n} className="py-2 px-1.5 text-center w-8" title={`Nachteilsausgleich ${n}`}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => {
            const tokens = firstNameTokens(s.vorname);
            const isCustom = customMode.has(s.id) || (!!s.alias && !tokens.includes(s.alias));
            return (
              <tr key={s.id} className="border-t border-[var(--border)]">
                <td className="py-1.5 px-2 whitespace-nowrap">
                  <span className="font-medium">{s.nachname}</span>, {s.vorname}
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-1.5">
                    <select
                      disabled={!canEdit}
                      value={isCustom ? "__custom__" : (s.alias ?? "")}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === "__custom__") {
                          setCustomMode(prev => new Set(prev).add(s.id));
                          setCustomText(prev => ({ ...prev, [s.id]: s.alias ?? "" }));
                        } else {
                          setCustomMode(prev => { const nx = new Set(prev); nx.delete(s.id); return nx; });
                          save.mutate({ id: s.id, alias: v || null, nta: s.nta });
                        }
                      }}
                      className="bg-[var(--surface)] border border-[var(--border)] rounded px-1.5 py-1 text-xs"
                    >
                      <option value="">— (Vorname)</option>
                      {tokens.map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="__custom__">Eigener…</option>
                    </select>
                    {isCustom && (
                      <input
                        disabled={!canEdit}
                        value={customText[s.id] ?? s.alias ?? ""}
                        placeholder="Eigener Alias"
                        onChange={e => setCustomText(prev => ({ ...prev, [s.id]: e.target.value }))}
                        onBlur={e => save.mutate({ id: s.id, alias: e.target.value.trim() || null, nta: s.nta })}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="w-24 bg-[var(--surface)] border border-[var(--border)] rounded px-1.5 py-1 text-xs"
                      />
                    )}
                  </div>
                </td>
                {[1, 2, 3, 4, 5].map(n => (
                  <td key={n} className="py-1.5 px-1.5 text-center">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={s.nta.includes(n)}
                      onChange={() => toggleNta(s, n)}
                      className="w-4 h-4 accent-[var(--accent)] cursor-pointer disabled:cursor-default"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={7} className="py-6 text-center text-[var(--text-muted)] text-sm">Keine Schüler:innen.</td></tr>
          )}
        </tbody>
      </table>
      <p className="text-xs text-[var(--text-muted)] mt-3">
        Alias steuert den im Sitzplan angezeigten Namen. Spalten 1–5 = Nachteilsausgleiche (frei belegbar).
      </p>
    </div>
  );
}

function TrackingSection({
  cls, students, canEdit,
}: {
  cls: ClassOut;
  students: StudentOut[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [filter, setFilter] = useState("");

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
  const q = filter.toLowerCase();
  const visible = q ? sorted.filter(s =>
    `${s.nachname} ${s.vorname}`.toLowerCase().includes(q)
  ) : sorted;

  return (
    <div className="flex flex-col gap-3">
      {/* Add tracker + filter */}
      {canEdit && (
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
      )}

      {trackers.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          {canEdit ? "Noch keine Tracking-Elemente. Oben hinzufügen." : "Noch keine Tracking-Elemente."}
        </p>
      ) : (
        <>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Schüler:in filtern…"
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm"
          />

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <th className="text-left px-3 py-2 font-semibold text-[var(--text-muted)] whitespace-nowrap">Name</th>
                  {trackers.map(t => (
                    <th key={t.id} className="px-3 py-2 text-center font-semibold whitespace-nowrap min-w-[6rem]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{t.name}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-normal tabular-nums">
                          {t.checked_student_ids.length}/{sorted.length}
                        </span>
                        {canEdit && (
                          <button
                            onClick={() => deleteTracker.mutate(t.id)}
                            className="text-[var(--text-muted)] hover:text-red-400 text-[10px] leading-none transition-colors"
                            title="Tracker löschen"
                          >✕ löschen</button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((s, i) => (
                  <tr
                    key={s.id}
                    className={i % 2 === 0 ? "" : "bg-[var(--surface)]"}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{s.nachname}, {s.vorname}</td>
                    {trackers.map(t => {
                      const done = t.checked_student_ids.includes(s.id);
                      return (
                        <td key={t.id} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={done}
                            disabled={!canEdit}
                            onChange={() => toggleCheck.mutate({ tracker_id: t.id, student_id: s.id })}
                            className="accent-[var(--accent)] w-4 h-4 cursor-pointer disabled:cursor-default disabled:opacity-60"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={trackers.length + 1} className="text-center text-[var(--text-muted)] py-4 text-sm">
                      Keine Treffer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EinstellungenSection({ cls, canEdit }: { cls: ClassOut; canEdit: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const [aliasInput, setAliasInput] = useState(cls.class_name ?? "");
  const [editingAlias, setEditingAlias] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [ksEdit, setKsEdit] = useState(!!cls.ksprecher_can_edit);

  const ksprecherMut = useMutation({
    mutationFn: (enabled: boolean) => api.classes.setKsprecherEdit(cls.id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
  });

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadError("");
    const err = await validateClassImage(file);
    if (err) { setUploadError(err); return; }
    uploadMut.mutate(file);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Image upload */}
      {canEdit && (
        <>
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
        </>
      )}

      {/* Alias */}
      {!canEdit ? null : editingAlias ? (
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

      {/* Klassensprecher edit-grant */}
      {canEdit && (
        <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={ksEdit}
            onChange={e => { setKsEdit(e.target.checked); ksprecherMut.mutate(e.target.checked); }}
            className="accent-[var(--accent)] w-4 h-4"
          />
          👑 Klassensprecher dürfen Dienste &amp; Sitzpläne bearbeiten
        </label>
      )}

      {/* Log */}
      <button
        onClick={() => setShowLog(v => !v)}
        className="self-start text-xs text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1"
      >
        📋 {showLog ? "Punkte-Log ausblenden" : "Punkte-Log anzeigen"}
      </button>
      {showLog && (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden text-xs max-h-60 overflow-y-auto">
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
    </div>
  );
}

// ─── Kurs / Wahlpflicht Detail Dialog (roster + export) ───────────────────────

function GroupDetailDialog({
  group, classes, onClose,
}: {
  group: StudentGroupOut;
  classes: ClassOut[];
  onClose: () => void;
}) {
  const { data: roster = [], isLoading } = useQuery<import("@/lib/api").GroupRosterEntry[]>({
    queryKey: ["group-roster", group.id],
    queryFn: () => api.groups.roster(group.id),
  });
  const memberClasses = classes.filter(c => group.member_class_ids.includes(c.id));
  const typeLabel = group.group_type === "kurs" ? "Kurs" : group.group_type === "wahlpflicht" ? "Wahlpflicht" : "Gruppe";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full sm:w-[95vw] sm:max-w-lg max-h-[92dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-[var(--bg)] border border-[var(--border)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg truncate">{group.name}</div>
            <div className="text-xs text-[var(--text-muted)]">{typeLabel} · {roster.length} Schüler:innen</div>
          </div>
          <button
            onClick={() => exportRosterList(`${typeLabel} ${group.name}`, roster)}
            disabled={roster.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-40"
          >
            🖨 Export
          </button>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-2xl leading-none px-1">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-3">
          {memberClasses.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {memberClasses.map(c => (
                <span key={c.id} className="text-xs px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]">
                  {c.code}
                </span>
              ))}
            </div>
          )}
          {isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Laden…</p>
          ) : roster.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">
              Noch keine Mitglieder. In einer Klasse → Tab „Gruppen" zuordnen.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {roster.map(s => (
                <div key={s.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="font-semibold">{s.nachname},</span>
                  <span>{displayFirstName(s.vorname, s.alias)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClassDetailDialog({ cls, onClose }: { cls: ClassOut; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { auth } = useAuth();
  // Only this class's Klassenlehrer (or an admin) may edit it; every teacher may
  // view. Backend enforces the same rule (require_class_teacher).
  const canEdit = auth?.teacher?.role === "admin"
    || (auth?.teacher?.klasse_id != null && auth.teacher.klasse_id === cls.id);
  const [section, setSection] = useState<"schüler" | "rollen" | "dienste" | "tracking" | "gruppen" | "nta" | "sitzplan" | "einstellungen">("schüler");

  const { data: students = [] } = useQuery<StudentOut[]>({
    queryKey: ["students", cls.id],
    queryFn: () => api.students.list({ klasse: cls.code }),
  });

  const { data: roles = [] } = useQuery<StudentRoleOut[]>({
    queryKey: ["roles", cls.id],
    queryFn: () => api.roles.list({ scope_id: cls.id }),
  });

  const { data: roleTypes = [] } = useQuery<string[]>({
    queryKey: ["role-types", cls.id],
    queryFn: () => api.roles.types(cls.id),
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

  const { data: kursGroups = [] } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "kurs"],
    queryFn: () => api.groups.list({ group_type: "kurs" }),
  });

  const { data: wahlpflichtGroups = [] } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "wahlpflicht"],
    queryFn: () => api.groups.list({ group_type: "wahlpflicht" }),
  });

  const { data: abGroups = [] } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "ab_gruppe", cls.id],
    queryFn: () => api.groups.list({ group_type: "ab_gruppe", class_id: cls.id }),
  });

  const allGroups = [...kursGroups, ...wahlpflichtGroups, ...abGroups];

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

  const setRoleTypes = useMutation({
    mutationFn: (types: string[]) => api.roles.setTypes(cls.id, types),
    onSuccess: types => {
      qc.setQueryData(["role-types", cls.id], types);
      qc.invalidateQueries({ queryKey: ["roles", cls.id] });
    },
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

  // Catalog for the picker: the built-in roles plus whatever this class added.
  const roleCatalog = [...new Set([...CLASS_ROLES, ...roleTypes])];

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
      <div className="relative w-full sm:w-[95vw] sm:max-w-[95vw] max-h-[92dvh] sm:h-[95vh] sm:max-h-[95vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-[var(--bg)] border border-[var(--border)] flex flex-col shadow-2xl">
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
          {(["schüler", "rollen", "gruppen", "dienste", "tracking", "nta", "sitzplan", "einstellungen"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className="flex-1 py-2.5 text-xs font-semibold transition-colors"
              style={{
                color: section === s ? "var(--accent)" : "var(--text-muted)",
                borderBottom: section === s ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              {s === "schüler" ? "👥 Klasse" : s === "rollen" ? "👑 Rollen" : s === "gruppen" ? "🧩 Gruppen" : s === "dienste" ? "🧹 Dienste" : s === "tracking" ? "📋 Tracking" : s === "nta" ? "⚖️ NTA" : s === "sitzplan" ? "🪑 Sitzplan" : "⚙️ Einstellungen"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">

          {!canEdit && (
            <div className="text-xs text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 flex items-center gap-2">
              🔒 Nur die Klassenleitung von {cls.code} kann diese Klasse bearbeiten — Ansicht schreibgeschützt.
            </div>
          )}

          {/* ── Schüler ── */}
          {section === "schüler" && (
            <>
              {students.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => exportRosterList(`Klasse ${cls.code}`, students)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    🖨 Liste exportieren
                  </button>
                </div>
              )}
              <KlassenlisteSection
                students={students}
                roles={roles}
                chores={chores}
                choreStats={choreStats}
                groups={allGroups}
              />
            </>
          )}

          {/* ── Rollen ── */}
          {section === "rollen" && (
            <>
              {canEdit && (
                <RoleSelector
                  catalog={roleCatalog}
                  active={roleTypes}
                  onSetTypes={types => setRoleTypes.mutate(types)}
                />
              )}

              {roleTypes.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-6">
                  Noch keine Rollen aktiviert. Oben Rollen auswählen.
                </p>
              ) : (
                roleTypes.map(role_type => {
                  const existing = getRoleFor(role_type);
                  return (
                    <div key={role_type} className="flex items-center gap-3">
                      <div className="w-36 shrink-0 text-sm font-semibold text-[var(--text-muted)] capitalize">{role_type}</div>
                      {canEdit ? (
                        <>
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
                          <button
                            onClick={() => {
                              if (confirm(`Rolle „${role_type}“ löschen?${existing ? ` ${existing.student_name} verliert sie.` : ""}`))
                                setRoleTypes.mutate(roleTypes.filter(t => t !== role_type));
                            }}
                            title="Rolle löschen"
                            className="shrink-0 px-2 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                          >
                            🗑
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 text-sm py-2 text-[var(--text-muted)]">{existing?.student_name ?? "— niemand —"}</div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* ── Dienste ── */}
          {section === "dienste" && (
            <>
              {/* Chore picker dropdown */}
              {canEdit && (
                <ChoreSelector
                  allNames={allChoreNames}
                  chores={chores}
                  cls={cls}
                  onToggle={handleToggleChore}
                  onAddCustom={handleAddCustom}
                />
              )}

              {/* Action buttons */}
              {canEdit && enabledChores.length > 0 && (
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
                    {canEdit ? (
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
                    ) : (
                      <div className="flex-1 text-sm py-2 text-[var(--text-muted)]">{chore.student_name ?? "— niemand —"}</div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {/* ── Tracking ── */}
          {section === "tracking" && (
            <TrackingSection cls={cls} students={students} canEdit={canEdit} />
          )}

          {/* ── Gruppen (Kurse / Wahlpflicht / A-B) ── */}
          {/* Groups (Kurse/Wahlpflicht) span multiple classes, so they are not
              locked to a single class's Klassenlehrer. */}
          {section === "gruppen" && (
            <GroupsManager cls={cls} students={students} />
          )}

          {/* ── Nachteilsausgleich + Alias ── */}
          {section === "nta" && (
            <NtaSection cls={cls} students={students} canEdit={canEdit} />
          )}

          {/* ── Sitzplan ── */}
          {section === "sitzplan" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="text-5xl">🪑</div>
              <div>
                <p className="font-semibold">Sitzplan-Editor</p>
                <p className="text-sm text-[var(--text-muted)] max-w-sm mt-1">
                  Tische, Stühle und Inventar frei platzieren, Namen zuweisen und als A4-PDF drucken.
                  Mehrere Räume pro Klasse möglich.
                </p>
              </div>
              <button
                onClick={() => router.push(`/haeuser/sitzplan/${cls.id}`)}
                className="px-5 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-xl hover:opacity-90"
              >
                Sitzplan-Editor öffnen →
              </button>
            </div>
          )}

          {/* ── Einstellungen ── */}
          {section === "einstellungen" && (
            <EinstellungenSection cls={cls} canEdit={canEdit} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Scoped Klassenverwaltung view for a granted Klassensprecher: only their class,
 * only the limited subset (Klassendienste assignment). Backend enforces the same
 * grant (require_class_manager).
 */
function KlassensprecherView({ classId }: { classId: number }) {
  const qc = useQueryClient();
  const { data: roster = [] } = useQuery<{ id: number; vorname: string; nachname: string }[]>({
    queryKey: ["roster", classId],
    queryFn: () => api.classes.roster(classId),
  });
  const { data: chores = [] } = useQuery<ClassChoreOut[]>({
    queryKey: ["chores", classId],
    queryFn: () => api.chores.list(classId),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["chores", classId] });
  const upsert = useMutation({
    mutationFn: (b: { chore_name: string; student_id: number | null }) =>
      api.chores.upsert({ class_id: classId, enabled: true, ...b }),
    onSuccess: invalidate,
  });
  const clear = useMutation({ mutationFn: () => api.chores.clear(classId), onSuccess: invalidate });
  const random = useMutation({ mutationFn: () => api.chores.randomAssign(classId), onSuccess: invalidate });

  const enabled = chores.filter(c => c.enabled);

  return (
    <div className="p-6 flex flex-col gap-4 max-w-xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🧹 Klassendienste</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Als Klassensprecher:in darfst du die Dienste eurer Klasse verteilen.
          </p>
        </div>
        <Link
          href={`/haeuser/sitzplan/${classId}`}
          className="shrink-0 text-sm px-3 py-2 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] flex items-center gap-2"
        >🪑 Sitzplan</Link>
      </div>

      {enabled.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-6 text-center">
          Die Klassenleitung hat noch keine Dienste aktiviert.
        </p>
      ) : (
        <>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => clear.mutate()}
              className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
            >🗑 Zuweisungen löschen</button>
            <button
              onClick={() => random.mutate()}
              disabled={random.isPending}
              className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >🎲 Zufällig zuweisen</button>
          </div>
          {enabled.map(chore => (
            <div key={chore.id} className="flex items-center gap-3">
              <div className="w-36 shrink-0 text-sm font-semibold text-[var(--text-muted)]">{chore.chore_name}</div>
              <select
                className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                value={chore.student_id ?? ""}
                onChange={e => upsert.mutate({ chore_name: chore.chore_name, student_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">— niemand —</option>
                {roster.map(s => (
                  <option key={s.id} value={s.id}>{s.vorname} {s.nachname}</option>
                ))}
              </select>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function HaeuserPage() {
  return <KlassenHaeuserView mode="haeuser" />;
}

/**
 * Shared view behind two routes:
 *  - mode="haeuser" → /haeuser: Häuser-Übersicht + Verwaltung (admin only).
 *  - mode="klassen" → /klassen: Klassenverwaltung — the class grid + detail
 *    (teachers/admin, or a granted Klassensprecher via the scoped Dienste view).
 */
export function KlassenHaeuserView({ mode }: { mode: "haeuser" | "klassen" }) {
  const { auth } = useAuth();
  const router = useRouter();
  const isStudent = auth?.role === "student";

  const { data: myMgmt } = useQuery<{ class_id: number | null }>({
    queryKey: ["my-management"],
    queryFn: api.classes.myManagement,
    enabled: mode === "klassen" && isStudent,
  });
  const [tab, setTab] = useState<"charts" | "manage">("charts");
  const [gridFilter, setGridFilter] = useState<"klassen" | "kurs" | "wahlpflicht">("klassen");
  const [showAddForm, setShowAddForm] = useState(false);
  const [verwaltenHaus, setVerwaltenHaus] = useState<HausOut | null>(null);
  const [detailClass, setDetailClass] = useState<ClassOut | null>(null);
  const [detailGroup, setDetailGroup] = useState<StudentGroupOut | null>(null);

  const { data: haeuser = [], isLoading: hLoading } = useQuery<HausOut[]>({
    queryKey: ["haeuser"],
    queryFn: api.haeuser.list,
    refetchInterval: 15_000,
    enabled: mode === "haeuser",
  });

  const { data: classes = [], isLoading: cLoading } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    refetchInterval: 15_000,
  });

  // Kurse + Wahlpflicht span classes — loaded for the /klassen filter and the
  // per-class "grade + short-code" badges (e.g. "7 Fr", "10 K1").
  const { data: kursGroups = [] } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "kurs"],
    queryFn: () => api.groups.list({ group_type: "kurs" }),
    enabled: mode === "klassen",
  });
  const { data: wpfGroups = [] } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "wahlpflicht"],
    queryFn: () => api.groups.list({ group_type: "wahlpflicht" }),
    enabled: mode === "klassen",
  });
  const classGroups = [...kursGroups, ...wpfGroups];

  // Access. /haeuser is admin-only; /klassen is for teachers/admin, and for a
  // granted Klassensprecher (student) it collapses to the scoped Dienste view.
  useEffect(() => {
    if (!auth) return;
    if (mode === "haeuser") {
      if (auth.role !== "admin") router.replace("/");
    } else if (isStudent && myMgmt && myMgmt.class_id == null) {
      router.replace("/");
    }
  }, [auth, mode, isStudent, myMgmt, router]);

  if (mode === "klassen" && isStudent) {
    if (!myMgmt || myMgmt.class_id == null) return null;  // loading or redirecting
    return <KlassensprecherView classId={myMgmt.class_id} />;
  }
  if (!auth) return null;
  if (mode === "haeuser" && auth.role !== "admin") return null;

  const isAdmin = auth?.teacher?.role === "admin";
  const sortedByPts = haeuser;

  return (
    <div className="p-6 flex flex-col gap-6 min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">{mode === "klassen" ? "🎓 Klassenverwaltung" : "🛡️ Häuser & Klassen"}</h1>
        {mode === "haeuser" && (
          <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
            {([
              ["charts",  "📊 Übersicht"],
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
        )}
      </div>
      </div>

      {/* ── Diagramme (Übersicht) ── */}
      {mode === "haeuser" && tab === "charts" && (
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

      {/* ── Klassen (Klassenverwaltung) ── */}
      {mode === "klassen" && (
        <div className="flex flex-col gap-4">
          {/* Filter: Klassen / Kurs / Wahlpflicht */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
              {([
                ["klassen", "🎓 Klassen"],
                ["kurs", "📘 Kurse"],
                ["wahlpflicht", "🧩 Wahlpflicht"],
              ] as const).map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setGridFilter(f)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                    gridFilter === f
                      ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {gridFilter === "klassen"
                ? `${classes.length} Klassen · Klasse anklicken zum Konfigurieren`
                : gridFilter === "kurs"
                ? `${kursGroups.length} Kurse · anklicken für Liste & Export`
                : `${wpfGroups.length} Wahlpflicht-Gruppen · anklicken für Liste & Export`}
            </p>
          </div>

          {cLoading ? (
            <div className="text-[var(--text-muted)] text-sm">Laden…</div>
          ) : gridFilter === "klassen" ? (
            classes.length === 0 ? (
              <div className="flex items-center justify-center h-40 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)]">
                Noch keine Klassen angelegt.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...classes]
                  .sort((a, b) => b.total_points - a.total_points || a.code.localeCompare(b.code))
                  .map(cls => {
                    const grade = gradeOf(cls.code);
                    const badges = classGroups.filter(g => g.member_class_ids.includes(cls.id));
                    return (
                      <button
                        key={cls.id}
                        onClick={() => setDetailClass(cls)}
                        className="rounded-2xl border bg-[var(--surface)] flex items-center gap-4 p-4 transition-all text-left hover:bg-[var(--surface-hover)]"
                        style={{ borderColor: "var(--border)" }}
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
                          {/* Kurse / WPF badges: "7 Fr", "10 K1" */}
                          {badges.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {badges.map(g => (
                                <span key={g.id} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${kursBadgeClasses(g.name)}`}>
                                  {grade !== null ? `${grade} ` : ""}{groupShortCode(g.name)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                            {cls.total_points}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">Pkt</div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )
          ) : (
            // Kurs / Wahlpflicht cards
            (() => {
              const list = gridFilter === "kurs" ? kursGroups : wpfGroups;
              if (list.length === 0) {
                return (
                  <div className="flex items-center justify-center h-40 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-muted)] text-sm text-center px-6">
                    Noch keine {gridFilter === "kurs" ? "Kurse" : "Wahlpflicht-Gruppen"} angelegt. In einer Klasse → Tab „Gruppen" anlegen &amp; zuordnen.
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...list]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(g => {
                      const memberClasses = classes.filter(c => g.member_class_ids.includes(c.id));
                      return (
                        <button
                          key={g.id}
                          onClick={() => setDetailGroup(g)}
                          className="rounded-2xl border bg-[var(--surface)] flex items-center gap-4 p-4 transition-all text-left hover:bg-[var(--surface-hover)]"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <span className={`text-xs font-bold px-2 py-1 rounded-md border shrink-0 ${kursBadgeClasses(g.name)}`}>
                            {groupShortCode(g.name)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate">{g.name}</div>
                            <div className="text-xs text-[var(--text-muted)] truncate">
                              {memberClasses.length > 0 ? memberClasses.map(c => c.code).join(", ") : "keine Klassen"}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                              {g.member_ids.length}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">SuS</div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ── Verwaltung ── */}
      {mode === "haeuser" && tab === "manage" && (
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

      {mode === "klassen" && detailClass && (
        <ClassDetailDialog cls={detailClass} onClose={() => setDetailClass(null)} />
      )}

      {mode === "klassen" && detailGroup && (
        <GroupDetailDialog group={detailGroup} classes={classes} onClose={() => setDetailGroup(null)} />
      )}
    </div>
  );
}
