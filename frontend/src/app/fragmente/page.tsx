"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, FragmentCollectionOut, FragmentGrantIn, FragmentPermission, ClassOut, TeacherOut,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { JoinQR } from "@/components/JoinQR";

const PERM_LABEL: Record<FragmentPermission, string> = {
  read: "Nur lesen",
  contribute: "Beitragen",
  manage: "Verwalten",
};

// ── Teacher multi-select picker ───────────────────────────────────────────────

function TeacherPicker({
  teachers, onConfirm, onClose,
}: {
  teachers: TeacherOut[];
  onConfirm: (ids: number[], permission: FragmentPermission) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [permission, setPermission] = useState<FragmentPermission>("read");
  const [q, setQ] = useState("");

  const shown = teachers.filter(t =>
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(q.trim().toLowerCase()));

  const toggle = (id: number) => setSel(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] p-5 shadow-2xl"
        style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-3">Lehrer hinzufügen</h3>

        <input className="input mb-2" placeholder="Suchen…" value={q} onChange={e => setQ(e.target.value)} autoFocus />

        <div className="flex items-center justify-between mb-2 text-xs text-[var(--text-muted)]">
          <button className="hover:text-[var(--text)] underline"
            onClick={() => setSel(new Set(shown.map(t => t.id)))}>Alle auswählen</button>
          <button className="hover:text-[var(--text)] underline" onClick={() => setSel(new Set())}>Auswahl aufheben</button>
        </div>

        <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
          {shown.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] p-3">Keine Lehrer gefunden.</p>
          ) : shown.map(t => (
            <label key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--surface-hover)]">
              <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
              <span>{t.first_name} {t.last_name}</span>
            </label>
          ))}
        </div>

        <div className="mt-3">
          <label className="label">Berechtigung für alle Ausgewählten</label>
          <select className="input" value={permission} onChange={e => setPermission(e.target.value as FragmentPermission)}>
            <option value="read">Nur lesen</option>
            <option value="contribute">Beitragen</option>
            <option value="manage">Verwalten</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]" onClick={onClose}>Abbrechen</button>
          <button className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90 disabled:opacity-50"
            disabled={sel.size === 0} onClick={() => onConfirm([...sel], permission)}>
            {sel.size > 0 ? `${sel.size} hinzufügen` : "Hinzufügen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Collection create/edit modal ──────────────────────────────────────────────

type GrantRow = FragmentGrantIn;

function CollectionModal({
  initial, onClose,
}: {
  initial: FragmentCollectionOut | null;   // null → create
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!initial;

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [grants, setGrants] = useState<GrantRow[]>(
    initial?.grants.map(g => ({ grantee_type: g.grantee_type, class_id: g.class_id, permission: g.permission })) ?? []
  );
  const [allowGuests, setAllowGuests] = useState(initial?.allow_guests ?? false);
  const [guestPermission, setGuestPermission] = useState<"read" | "contribute">(initial?.guest_permission ?? "read");
  const [teacherPicker, setTeacherPicker] = useState(false);
  const [selectedGrantIdx, setSelectedGrantIdx] = useState<Set<number>>(new Set());

  const { data: classes = [] } = useQuery<ClassOut[]>({ queryKey: ["classes"], queryFn: () => api.classes.list() });
  const { data: teachers = [] } = useQuery<TeacherOut[]>({ queryKey: ["teachers"], queryFn: () => api.teachers.list() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["fragment-collections"] });

  const save = useMutation({
    mutationFn: async () => {
      if (!isEdit) {
        return api.fragments.createCollection({
          name: name.trim(),
          description: description.trim() || null,
          subject: subject.trim() || null,
          grants,
        });
      }
      const id = initial!.id;
      await api.fragments.updateCollection(id, {
        name: name.trim(),
        description: description.trim() || null,
        subject: subject.trim() || null,
        allow_guests: allowGuests,
        guest_permission: guestPermission,
      });
      await api.fragments.setGrants(id, grants);
      return api.fragments.getCollection(id);
    },
    onSuccess: () => { invalidate(); toast(isEdit ? "Gespeichert" : "Sammlung erstellt", "success"); onClose(); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const regenGuest = useMutation({
    mutationFn: () => api.fragments.regenerateGuestCode(initial!.id),
    onSuccess: () => { invalidate(); setAllowGuests(true); toast("Neuer Gastcode erzeugt", "success"); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const usedClassIds = new Set(grants.filter(g => g.grantee_type === "class").map(g => g.class_id));
  const usedTeacherIds = new Set(grants.filter(g => g.grantee_type === "teacher").map(g => g.teacher_id));
  const hasAllTeachers = grants.some(g => g.grantee_type === "all_teachers");
  const grantableTeachers = teachers.filter(t => !initial || t.id !== initial.owner_teacher_id);

  const addGrant = (row: GrantRow) => setGrants(g => [...g, row]);
  const updateGrant = (i: number, patch: Partial<GrantRow>) =>
    setGrants(g => g.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeGrant = (i: number) => setGrants(g => g.filter((_, idx) => idx !== i));

  const guestUrl = typeof window !== "undefined" && initial?.guest_code
    ? `${window.location.origin}/fragmente/join?code=${initial.guest_code}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--surface,var(--bg))] border border-[var(--border)] p-6 shadow-2xl"
        style={{ background: "var(--bg)" }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">{isEdit ? "Sammlung bearbeiten" : "Neue Sammlung"}</h2>

        {/* Details */}
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Lernkarten Geschichte 10c" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fach (optional)</label>
              <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="z. B. Geschichte" />
            </div>
          </div>
          <div>
            <label className="label">Beschreibung (optional)</label>
            <textarea className="input min-h-[64px] resize-y" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>

        {/* Access grants */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Zugriff</h3>
            <span className="text-xs text-[var(--text-muted)]">Ohne Einträge: nur du (privat)</span>
          </div>
          <div className="space-y-2">
            {grants.map((g, i) => (
              <div key={i} className="flex items-center gap-2 w-full">
                <input type="checkbox" className="shrink-0" title="Auswählen"
                  checked={selectedGrantIdx.has(i)}
                  onChange={e => setSelectedGrantIdx(s => {
                    const n = new Set(s);
                    e.target.checked ? n.add(i) : n.delete(i);
                    return n;
                  })} />
                {/* Inline flex sizing: .input carries `w-full` via @apply, which would
                    otherwise force each select to the full row width and overflow. */}
                <select
                  className="input"
                  style={{ flex: "1 1 0%", minWidth: 0, width: "auto" }}
                  value={g.grantee_type === "all_teachers" ? "all_teachers" : g.grantee_type === "class" ? `class:${g.class_id}` : `teacher:${g.teacher_id}`}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "all_teachers") updateGrant(i, { grantee_type: "all_teachers", class_id: null, teacher_id: null });
                    else if (v.startsWith("class:")) updateGrant(i, { grantee_type: "class", class_id: Number(v.split(":")[1]), teacher_id: null });
                    else updateGrant(i, { grantee_type: "teacher", teacher_id: Number(v.split(":")[1]), class_id: null });
                  }}
                >
                  <option value="all_teachers" disabled={hasAllTeachers && g.grantee_type !== "all_teachers"}>Alle Lehrer (öffentlich)</option>
                  <optgroup label="Klassen">
                    {classes.map(c => (
                      <option key={c.id} value={`class:${c.id}`}
                        disabled={usedClassIds.has(c.id) && g.class_id !== c.id}>
                        Klasse {c.display_name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Lehrer">
                    {grantableTeachers.map(t => (
                      <option key={t.id} value={`teacher:${t.id}`}
                        disabled={usedTeacherIds.has(t.id) && g.teacher_id !== t.id}>
                        {t.first_name} {t.last_name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <select className="input" style={{ flex: "0 0 9.5rem", width: "9.5rem", minWidth: 0 }}
                  value={g.permission}
                  onChange={e => updateGrant(i, { permission: e.target.value as FragmentPermission })}>
                  <option value="read">Nur lesen</option>
                  <option value="contribute">Beitragen</option>
                  <option value="manage">Verwalten</option>
                </select>
                <button className="text-[var(--text-muted)] hover:text-red-500 px-2 text-lg shrink-0" onClick={() => removeGrant(i)} title="Entfernen">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {!hasAllTeachers && (
              <button className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                onClick={() => addGrant({ grantee_type: "all_teachers", class_id: null, permission: "read" })}>
                + Alle Lehrer
              </button>
            )}
            <button className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)]"
              onClick={() => {
                const free = classes.find(c => !usedClassIds.has(c.id));
                if (!free) { toast("Alle Klassen bereits hinzugefügt", "info"); return; }
                addGrant({ grantee_type: "class", class_id: free.id, permission: "read" });
              }}>
              + Klasse
            </button>
            <button className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--surface-hover)]"
              onClick={() => setTeacherPicker(true)}>
              + Lehrer…
            </button>
            {selectedGrantIdx.size > 0 && (
              <button className="text-xs px-2 py-1 rounded border border-red-500/40 text-red-500 hover:bg-red-500/10 ml-auto"
                onClick={() => {
                  setGrants(g => g.filter((_, i) => !selectedGrantIdx.has(i)));
                  setSelectedGrantIdx(new Set());
                }}>
                {selectedGrantIdx.size} ausgewählte entfernen
              </button>
            )}
          </div>
        </div>

        {/* Guests — only meaningful once the collection exists */}
        {isEdit && (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={allowGuests} onChange={e => setAllowGuests(e.target.checked)} />
              Gastzugang per QR / Link
            </label>
            {allowGuests && (
              <div className="mt-3 flex gap-4 items-start">
                <div className="flex-1 space-y-2">
                  <div>
                    <label className="label">Gäste dürfen</label>
                    <select className="input w-40" value={guestPermission}
                      onChange={e => setGuestPermission(e.target.value as "read" | "contribute")}>
                      <option value="read">Nur lesen</option>
                      <option value="contribute">Beitragen</option>
                    </select>
                  </div>
                  {initial?.guest_code ? (
                    <div className="text-xs text-[var(--text-muted)] break-all">
                      Code: <span className="font-mono text-[var(--text)]">{initial.guest_code}</span>
                      {guestUrl && <div className="mt-1">{guestUrl}</div>}
                      <button className="mt-1 underline hover:text-[var(--text)]"
                        onClick={() => regenGuest.mutate()} disabled={regenGuest.isPending}>
                        Code neu erzeugen
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">Speichern erzeugt einen Gastcode.</p>
                  )}
                </div>
                {guestUrl && <JoinQR url={guestUrl} size={110} />}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-2 justify-end">
          <button className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]" onClick={onClose}>Abbrechen</button>
          <button className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90 disabled:opacity-50"
            disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Speichern…" : isEdit ? "Speichern" : "Erstellen"}
          </button>
        </div>

        {teacherPicker && (
          <TeacherPicker
            teachers={grantableTeachers.filter(t => !usedTeacherIds.has(t.id))}
            onConfirm={(ids, permission) => {
              setGrants(g => [...g, ...ids.map(id => ({ grantee_type: "teacher" as const, teacher_id: id, permission }))]);
              setTeacherPicker(false);
            }}
            onClose={() => setTeacherPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Collection card ────────────────────────────────────────────────────────────

function CollectionCard({
  coll, onOpen, onEdit, onDelete,
}: {
  coll: FragmentCollectionOut;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const canManage = coll.my_permission === "manage";
  const audience = coll.grants.length === 0
    ? "Privat"
    : coll.grants.some(g => g.grantee_type === "all_teachers") && !coll.grants.some(g => g.grantee_type === "class")
      ? "Öffentlich (Lehrer)"
      : `${coll.grants.length} Gruppe${coll.grants.length === 1 ? "" : "n"}`;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 flex flex-col gap-2 hover:border-[var(--accent)] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button className="text-left flex-1 min-w-0" onClick={onOpen}>
          <div className="font-semibold truncate">{coll.name}</div>
          {coll.subject && <div className="text-xs text-[var(--text-muted)]">{coll.subject}</div>}
        </button>
        {coll.my_permission !== "manage" && (
          <span className="text-[10px] shrink-0 px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)]">
            {PERM_LABEL[coll.my_permission as FragmentPermission] ?? "—"}
          </span>
        )}
      </div>

      {coll.description && <p className="text-xs text-[var(--text-muted)] line-clamp-2">{coll.description}</p>}

      <div className="text-xs text-[var(--text-muted)] flex items-center gap-3 mt-auto pt-1">
        <span>📝 {coll.fragment_count}</span>
        <span>📎 {coll.research_count}</span>
        <span className="truncate">· {audience}</span>
        {coll.allow_guests && <span title="Gastzugang aktiv">🔗</span>}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 mt-1">
        <span className="text-[10px] text-[var(--text-muted)] truncate">{coll.is_owner ? "Deine Sammlung" : coll.owner_name}</span>
        <div className="flex gap-1">
          <button className="text-xs px-2 py-1 rounded hover:bg-[var(--surface-hover)]" onClick={onOpen}>Öffnen</button>
          {canManage && <button className="text-xs px-2 py-1 rounded hover:bg-[var(--surface-hover)]" onClick={onEdit}>Bearbeiten</button>}
          {coll.is_owner && <button className="text-xs px-2 py-1 rounded hover:bg-red-500/10 text-red-500" onClick={onDelete}>Löschen</button>}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FragmentsLandingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { auth } = useAuth();
  const isTeacher = auth?.user_type === "teacher";

  const [modal, setModal] = useState<null | { collection: FragmentCollectionOut | null }>(null);
  const [confirmDel, setConfirmDel] = useState<FragmentCollectionOut | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<string>("");   // "" | meine | public | geteilt | alle | class:<id>

  const { data: collections = [], isLoading } = useQuery<FragmentCollectionOut[]>({
    queryKey: ["fragment-collections"],
    queryFn: () => api.fragments.listCollections(),
  });

  const del = useMutation({
    mutationFn: (id: number) => api.fragments.deleteCollection(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fragment-collections"] }); toast("Gelöscht", "success"); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });

  const isPublic = (c: FragmentCollectionOut) => c.grants.some(g => g.grantee_type === "all_teachers");

  // Distinct classes present across visible collections → filter chips.
  const classChips = useMemo(() => {
    const seen = new Map<number, string>();
    for (const c of collections)
      for (const g of c.grants)
        if (g.grantee_type === "class" && g.class_id != null) seen.set(g.class_id, g.class_code ?? String(g.class_id));
    return [...seen.entries()].map(([id, code]) => ({ id, code }));
  }, [collections]);

  const shown = useMemo(() => collections.filter(c => {
    if (filter === "meine") return c.is_owner;
    if (filter === "public") return isPublic(c);
    if (filter === "geteilt") return !c.is_owner && !isPublic(c);
    if (filter === "alle") return true;
    if (filter.startsWith("class:")) {
      const cid = Number(filter.split(":")[1]);
      return c.grants.some(g => g.grantee_type === "class" && g.class_id === cid);
    }
    // default: teachers see own + public; students see everything shared with them.
    return isTeacher ? (c.is_owner || isPublic(c)) : true;
  }), [collections, filter, isTeacher]);

  const chip = (key: string, label: string) => (
    <button key={key} onClick={() => setFilter(f => f === key ? "" : key)}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        filter === key ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}>
      {label}
    </button>
  );

  return (
    <div className="mx-auto w-[92%] max-w-[1600px] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Fragmente</h1>
          <p className="text-sm text-[var(--text-muted)]">Pinnwände mit Karten & Clippings</p>
        </div>
        {isTeacher && (
          <button className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90"
            onClick={() => setModal({ collection: null })}>
            + Neue Sammlung
          </button>
        )}
      </div>

      {/* Filter bar + view toggle */}
      {collections.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {isTeacher && chip("meine", "Meine")}
          {isTeacher && chip("public", "Öffentlich")}
          {isTeacher && chip("geteilt", "Geteilt")}
          {classChips.map(c => chip(`class:${c.id}`, `Klasse ${c.code}`))}
          {chip("alle", "Alle")}
          <div className="ml-auto flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
            <button className={`px-2 py-1 text-sm ${view === "grid" ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
              onClick={() => setView("grid")} title="Raster">▦</button>
            <button className={`px-2 py-1 text-sm ${view === "list" ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}
              onClick={() => setView("list")} title="Liste">☰</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-[var(--text-muted)]">Lädt…</p>
      ) : collections.length === 0 ? (
        <div className="text-center py-24 text-[var(--text-muted)]">
          <p>Noch keine Sammlungen.</p>
          {isTeacher && <p className="text-sm mt-1">Erstelle deine erste Pinnwand.</p>}
        </div>
      ) : shown.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm py-16 text-center">Keine Sammlungen für diesen Filter.</p>
      ) : (
        <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-2"}>
          {shown.map(c => (
            <CollectionCard key={c.id} coll={c}
              onOpen={() => router.push(`/fragmente/${c.id}`)}
              onEdit={() => setModal({ collection: c })}
              onDelete={() => setConfirmDel(c)}
            />
          ))}
        </div>
      )}

      {modal && <CollectionModal initial={modal.collection} onClose={() => setModal(null)} />}
      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDel(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] p-5 shadow-2xl"
            style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-3">Sammlung löschen?</h3>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              „{confirmDel.name}" wird mit allen {confirmDel.fragment_count} Karten und {confirmDel.research_count} Clippings dauerhaft gelöscht.
            </p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                onClick={() => setConfirmDel(null)}>Abbrechen</button>
              <button className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-semibold hover:opacity-90"
                onClick={() => { del.mutate(confirmDel.id); setConfirmDel(null); }}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
