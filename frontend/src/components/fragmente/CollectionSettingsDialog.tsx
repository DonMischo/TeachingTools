"use client";

// Shared collection settings dialog — used by the /fragmente landing (create +
// settings wheel) and by the board header's settings wheel.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, FragmentCollectionOut, FragmentGrantIn, FragmentPermission, ClassOut, TeacherOut,
  StudentGroupOut,
} from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { JoinQR } from "@/components/JoinQR";
import { useLanUrl } from "@/hooks/useLanUrl";

// ── Teacher multi-select picker ───────────────────────────────────────────────

export function TeacherPicker({
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
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line p-5 shadow-2xl"
        style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-3">Lehrer hinzufügen</h3>

        <input className="input mb-2" placeholder="Suchen…" value={q} onChange={e => setQ(e.target.value)} autoFocus />

        <div className="flex items-center justify-between mb-2 text-xs text-muted">
          <button className="hover:text-fg underline"
            onClick={() => setSel(new Set(shown.map(t => t.id)))}>Alle auswählen</button>
          <button className="hover:text-fg underline" onClick={() => setSel(new Set())}>Auswahl aufheben</button>
        </div>

        <div className="max-h-64 overflow-y-auto rounded-lg border border-line divide-y divide-line">
          {shown.length === 0 ? (
            <p className="text-sm text-muted p-3">Keine Lehrer gefunden.</p>
          ) : shown.map(t => (
            <label key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-hover">
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
          <button className="px-4 py-2 text-sm rounded-lg border border-line hover:bg-surface-hover" onClick={onClose}>Abbrechen</button>
          <button className="btn-primary px-4 py-2 text-sm"
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

export function CollectionModal({
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
  const [art, setArt] = useState<"standard" | "materialsammlung">(initial?.art ?? "standard");
  const { auth } = useAuth();
  // Eine Materialsammlung macht nur ein Admin wieder zur Standard-Sammlung (sonst wäre die Löschsperre umgehbar).
  const artGesperrt = initial?.art === "materialsammlung" && auth?.role !== "admin";
  const [grants, setGrants] = useState<GrantRow[]>(
    initial?.grants.map(g => ({
      grantee_type: g.grantee_type, class_id: g.class_id, teacher_id: g.teacher_id,
      group_id: g.group_id, permission: g.permission,
    })) ?? []
  );
  const [allowGuests, setAllowGuests] = useState(initial?.allow_guests ?? false);
  const [guestPermission, setGuestPermission] = useState<"read" | "contribute">(initial?.guest_permission ?? "read");
  const [teacherPicker, setTeacherPicker] = useState(false);
  const [selectedGrantIdx, setSelectedGrantIdx] = useState<Set<number>>(new Set());

  const { data: classes = [] } = useQuery<ClassOut[]>({ queryKey: ["classes"], queryFn: () => api.classes.list() });
  const { data: teachers = [] } = useQuery<TeacherOut[]>({ queryKey: ["teachers"], queryFn: () => api.teachers.list() });
  // A/B-Gruppen: eine halbe Klasse freigeben statt der ganzen.
  const { data: abGroups = [] } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "ab_gruppe"],
    queryFn: () => api.groups.list({ group_type: "ab_gruppe" }),
  });

  // Refresh both the landing list and this board's own record, since the dialog
  // is opened from either place.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fragment-collections"] });
    if (initial) qc.invalidateQueries({ queryKey: ["fragment-collection", initial.id] });
  };

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
        ...(art !== initial!.art ? { art } : {}),
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
  const usedGroupIds = new Set(grants.filter(g => g.grantee_type === "group").map(g => g.group_id));

  // Klassen mit ihren A/B-Gruppen darunter: »Klasse 9a (ganze Klasse)«,
  // »9a – Gruppe A«, »9a – Gruppe B«.
  const classEntries = classes.map(c => ({
    cls: c,
    groups: abGroups.filter(g => g.class_id === c.id)
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
  }));
  const hasAllTeachers = grants.some(g => g.grantee_type === "all_teachers");
  const grantableTeachers = teachers.filter(t => !initial || t.id !== initial.owner_teacher_id);

  const addGrant = (row: GrantRow) => setGrants(g => [...g, row]);
  const updateGrant = (i: number, patch: Partial<GrantRow>) =>
    setGrants(g => g.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeGrant = (i: number) => setGrants(g => g.filter((_, idx) => idx !== i));

  // LAN IP rather than localhost, so a scanned QR reaches this machine from a
  // student device on the same network.
  const guestUrlRaw = useLanUrl(initial?.guest_code ? `/fragmente/join?code=${initial.guest_code}` : "");
  const guestUrl = initial?.guest_code ? guestUrlRaw : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface) border border-line p-6 shadow-2xl"
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
            {isEdit && (
              <div>
                <label className="label">Art</label>
                <select className="input" value={art} disabled={artGesperrt} onChange={e => setArt(e.target.value as typeof art)}
                  title={artGesperrt ? "Nur ein Admin kann eine Materialsammlung wieder zur Standard-Sammlung machen" : undefined}>
                  <option value="standard">Standard</option>
                  <option value="materialsammlung">Materialsammlung (nur Admin löscht)</option>
                </select>
              </div>
            )}
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
            <span className="text-xs text-muted">Ohne Einträge: nur du (privat)</span>
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
                  value={
                    g.grantee_type === "all_teachers" ? "all_teachers"
                      : g.grantee_type === "class" ? `class:${g.class_id}`
                      : g.grantee_type === "group" ? `group:${g.group_id}`
                      : `teacher:${g.teacher_id}`}
                  onChange={e => {
                    const v = e.target.value;
                    const id = Number(v.split(":")[1]);
                    if (v === "all_teachers") updateGrant(i, { grantee_type: "all_teachers", class_id: null, teacher_id: null, group_id: null });
                    else if (v.startsWith("class:")) updateGrant(i, { grantee_type: "class", class_id: id, teacher_id: null, group_id: null });
                    else if (v.startsWith("group:")) updateGrant(i, { grantee_type: "group", group_id: id, class_id: null, teacher_id: null });
                    else updateGrant(i, { grantee_type: "teacher", teacher_id: id, class_id: null, group_id: null });
                  }}
                >
                  <option value="all_teachers" disabled={hasAllTeachers && g.grantee_type !== "all_teachers"}>Alle Lehrer (öffentlich)</option>
                  {classEntries.map(({ cls, groups }) => (
                    <optgroup key={cls.id} label={`Klasse ${cls.display_name}`}>
                      <option value={`class:${cls.id}`}
                        disabled={usedClassIds.has(cls.id) && g.class_id !== cls.id}>
                        {cls.display_name} — ganze Klasse
                      </option>
                      {groups.map(gr => (
                        <option key={gr.id} value={`group:${gr.id}`}
                          disabled={usedGroupIds.has(gr.id) && g.group_id !== gr.id}>
                          {cls.display_name} – Gruppe {gr.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
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
                <button className="text-muted hover:text-red-500 px-2 text-lg shrink-0" onClick={() => removeGrant(i)} title="Entfernen">×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {!hasAllTeachers && (
              <button className="text-xs px-2 py-1 rounded-sm border border-line hover:bg-surface-hover"
                onClick={() => addGrant({ grantee_type: "all_teachers", class_id: null, permission: "read" })}>
                + Alle Lehrer
              </button>
            )}
            <button className="text-xs px-2 py-1 rounded-sm border border-line hover:bg-surface-hover"
              onClick={() => {
                const free = classes.find(c => !usedClassIds.has(c.id));
                if (!free) { toast("Alle Klassen bereits hinzugefügt", "info"); return; }
                addGrant({ grantee_type: "class", class_id: free.id, permission: "read" });
              }}>
              + Klasse / Gruppe
            </button>
            <button className="text-xs px-2 py-1 rounded-sm border border-line hover:bg-surface-hover"
              onClick={() => setTeacherPicker(true)}>
              + Lehrer…
            </button>
            {selectedGrantIdx.size > 0 && (
              <button className="text-xs px-2 py-1 rounded-sm border border-red-500/40 text-red-500 hover:bg-red-500/10 ml-auto"
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
          <div className="mt-5 border-t border-line pt-4">
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
                    <div className="text-xs text-muted break-all">
                      Code: <span className="font-mono text-fg">{initial.guest_code}</span>
                      {guestUrl && <div className="mt-1">{guestUrl}</div>}
                      <button className="mt-1 underline hover:text-fg"
                        onClick={() => regenGuest.mutate()} disabled={regenGuest.isPending}>
                        Code neu erzeugen
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">Speichern erzeugt einen Gastcode.</p>
                  )}
                </div>
                {guestUrl && <JoinQR url={guestUrl} size={110} />}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-2 justify-end">
          <button className="px-4 py-2 text-sm rounded-lg border border-line hover:bg-surface-hover" onClick={onClose}>Abbrechen</button>
          <button className="btn-primary px-4 py-2 text-sm"
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

