"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CalendarMeta } from "@/lib/api";
import type { SlideshowItem } from "@/lib/slideshow";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const KIND_ICON: Record<SlideshowItem["kind"], string> = {
  file: "🖼️", link: "🔗", calendar: "📅", wochenspruch: "📖", hauspunkte: "🏆",
};

function kindIcon(item: SlideshowItem): string {
  if (item.kind === "file") {
    if (item.media_type === "pdf") return "📄";
    if (item.media_type === "video") return "🎬";
  }
  return KIND_ICON[item.kind];
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const AUDIENCE_LABEL: Record<string, string> = { guest: "Gast", student: "Schüler", teacher: "Lehrer" };

function slotSummary(item: SlideshowItem): string {
  if (item.slot_days.length === 0) return "—";
  const days = item.slot_days.slice().sort((a, b) => a - b).map((d) => WEEKDAYS[d]).join(",");
  const time = item.slot_start && item.slot_end ? `${item.slot_start}–${item.slot_end}` : "?";
  return `${days} ${time}`;
}

function SlotEditor({ item, onSave, onClose }: {
  item: SlideshowItem;
  onSave: (patch: Partial<SlideshowItem>) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState<number[]>(item.slot_days);
  const [start, setStart] = useState(item.slot_start ?? "08:00");
  const [end, setEnd] = useState(item.slot_end ?? "16:00");
  const [from, setFrom] = useState(item.slot_from ?? "");
  const [until, setUntil] = useState(item.slot_until ?? "");

  const toggleDay = (d: number) => setDays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());

  return (
    <div className="absolute z-20 mt-1 right-0 w-72 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg space-y-2">
      <div className="flex flex-wrap gap-1">
        {WEEKDAYS.map((label, i) => (
          <button key={i} onClick={() => toggleDay(i)}
            className={`px-2 py-1 rounded text-xs border ${days.includes(i) ? "bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]" : "border-[var(--border)]"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-center text-sm">
        <span>von</span>
        <input type="time" className="input flex-1" value={start} onChange={(e) => setStart(e.target.value)} />
        <span>bis</span>
        <input type="time" className="input flex-1" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div className="flex gap-2 items-center text-sm">
        <span>Datum von</span>
        <input type="date" className="input flex-1" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="flex gap-2 items-center text-sm">
        <span>Datum bis</span>
        <input type="date" className="input flex-1" value={until} onChange={(e) => setUntil(e.target.value)} />
      </div>
      <div className="flex justify-between pt-1">
        <button className="text-xs text-red-400" onClick={() => {
          onSave({ slot_days: [], slot_start: null, slot_end: null, slot_from: null, slot_until: null });
          onClose();
        }}>Zeitfenster entfernen</button>
        <div className="flex gap-2">
          <button className="text-xs text-[var(--text-muted)]" onClick={onClose}>Abbrechen</button>
          <button className="btn-primary text-xs px-3 py-1" onClick={() => {
            onSave({ slot_days: days, slot_start: start, slot_end: end, slot_from: from || null, slot_until: until || null });
            onClose();
          }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSlideshowPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { ready, isAdmin, has } = useAdminAccess();
  const allowed = isAdmin || has("slideshow");

  useEffect(() => {
    if (ready && !allowed) router.replace("/");
  }, [ready, allowed, router]);

  const { data: items = [] } = useQuery<SlideshowItem[]>({
    queryKey: ["slideshow-items"], queryFn: api.slideshow.items,
  });
  const { data: calMeta } = useQuery<CalendarMeta>({
    queryKey: ["calendar-meta"], queryFn: api.calendar.meta,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["slideshow-items"] });
    qc.invalidateQueries({ queryKey: ["slideshow-public"] });
  };

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<SlideshowItem> }) => api.slideshow.update(id, patch as any),
    onSuccess: invalidate,
    onError: (e: any) => toast(String(e.message ?? e), "error"),
  });
  const orderMut = useMutation({
    mutationFn: (ids: number[]) => api.slideshow.order(ids),
    onSuccess: invalidate,
    onError: (e: any) => toast(String(e.message ?? e), "error"),
  });
  const removeMut = useMutation({
    mutationFn: (ids: number[]) => api.slideshow.remove(ids),
    onSuccess: (res) => { invalidate(); toast(`${res.deleted} gelöscht`, "success"); setSelected([]); },
    onError: (e: any) => toast(String(e.message ?? e), "error"),
  });
  const uploadMut = useMutation({
    mutationFn: (files: File[]) => api.slideshow.upload(files),
    onSuccess: invalidate,
    onError: (e: any) => toast(String(e.message ?? e), "error"),
  });
  const createMut = useMutation({
    mutationFn: (body: Parameters<typeof api.slideshow.create>[0]) => api.slideshow.create(body),
    onSuccess: invalidate,
    onError: (e: any) => toast(String(e.message ?? e), "error"),
  });

  const [selected, setSelected] = useState<number[]>([]);
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [openWarn, setOpenWarn] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [calTags, setCalTags] = useState<string[]>([]);
  const [calDays, setCalDays] = useState(14);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!auth || !ready || !allowed) return null;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    uploadMut.mutate(Array.from(fileList));
  };

  const toggleSelectAll = () => {
    const selectable = items.filter((i) => i.kind !== "hauspunkte").map((i) => i.id);
    setSelected(selected.length === selectable.length ? [] : selectable);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const ids = items.map((i) => i.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    orderMut.mutate(ids);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Startseiten-Slideshow</h1>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)]"}`}
      >
        <input ref={fileInputRef} type="file" multiple hidden
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.mp4,.webm"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        <div className="text-[var(--text-muted)]">
          {uploadMut.isPending ? "Wird hochgeladen…" : "Dateien hierher ziehen oder klicken (Bilder, PDFs, Videos)"}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-2">
          <div className="font-semibold">Link hinzufügen</div>
          <input className="input w-full" placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          <input className="input w-full" placeholder="Titel (optional)" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
          <button className="btn-primary" disabled={!linkUrl}
            onClick={() => { createMut.mutate({ kind: "link", url: linkUrl, title: linkTitle || undefined }); setLinkUrl(""); setLinkTitle(""); }}>
            Hinzufügen
          </button>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-2">
          <div className="font-semibold">Termine hinzufügen</div>
          <div className="flex flex-wrap gap-1">
            {(calMeta?.tags ?? []).map((t) => (
              <button key={t.name} onClick={() => setCalTags((cur) => cur.includes(t.name) ? cur.filter((x) => x !== t.name) : [...cur, t.name])}
                className={`px-2 py-1 rounded text-xs border ${calTags.includes(t.name) ? "bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]" : "border-[var(--border)]"}`}>
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Tage im Voraus</span>
            <input type="number" className="input w-20" value={calDays} onChange={(e) => setCalDays(Number(e.target.value))} />
          </div>
          <button className="btn-primary" onClick={() => { createMut.mutate({ kind: "calendar", calendar_tags: calTags, calendar_days_ahead: calDays }); setCalTags([]); }}>
            Hinzufügen
          </button>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-2">
          <div className="font-semibold">Wochenspruch hinzufügen</div>
          <div className="text-sm text-[var(--text-muted)]">
            Spruch, Wochenlieder und Bild der aktuellen Kirchenjahreswoche, aktualisiert sich selbst
            (Quelle: kirchenjahr-evangelisch.de über wochenspruch.pfarr.tools).
          </div>
          <button className="btn-primary" onClick={() => createMut.mutate({ kind: "wochenspruch" })}>
            Hinzufügen
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <button className="text-red-400 text-sm" onClick={() => {
          if (confirm(`${selected.length} Einträge wirklich löschen?`)) removeMut.mutate(selected);
        }}>
          Ausgewählte löschen ({selected.length})
        </button>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
              <th className="p-2"><input type="checkbox" checked={selected.length > 0 && selected.length === items.filter((i) => i.kind !== "hauspunkte").length} onChange={toggleSelectAll} /></th>
              <th className="p-2"></th>
              <th className="p-2">Typ</th>
              <th className="p-2">Titel</th>
              <th className="p-2">Zielgruppe</th>
              <th className="p-2">Dauer</th>
              <th className="p-2">Zeitfenster</th>
              <th className="p-2">Aktiv</th>
              <th className="p-2"></th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className="border-b border-[var(--border)]">
                <td className="p-2">
                  <input type="checkbox" disabled={item.kind === "hauspunkte"}
                    checked={selected.includes(item.id)}
                    onChange={() => setSelected((cur) => cur.includes(item.id) ? cur.filter((x) => x !== item.id) : [...cur, item.id])} />
                </td>
                <td className="p-2 whitespace-nowrap">
                  <button disabled={idx === 0} onClick={() => move(idx, -1)} className="px-1 disabled:opacity-30">↑</button>
                  <button disabled={idx === items.length - 1} onClick={() => move(idx, 1)} className="px-1 disabled:opacity-30">↓</button>
                </td>
                <td className="p-2">{kindIcon(item)}</td>
                <td className="p-2 min-w-[10rem]">
                  <input className="input w-full" defaultValue={item.title}
                    onBlur={(e) => { if (e.target.value !== item.title) updateMut.mutate({ id: item.id, patch: { title: e.target.value } }); }} />
                </td>
                <td className="p-2">
                  <select className="input" value={item.audience}
                    onChange={(e) => updateMut.mutate({ id: item.id, patch: { audience: e.target.value as any } })}>
                    <option value="guest">{AUDIENCE_LABEL.guest}</option>
                    <option value="student">{AUDIENCE_LABEL.student}</option>
                    <option value="teacher">{AUDIENCE_LABEL.teacher}</option>
                  </select>
                </td>
                <td className="p-2">
                  {item.media_type === "video" ? (
                    <input className="input w-20" disabled value="bis Ende" />
                  ) : (
                    <input type="number" className="input w-20" defaultValue={item.duration_seconds}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== item.duration_seconds) updateMut.mutate({ id: item.id, patch: { duration_seconds: v } });
                      }} />
                  )}
                </td>
                <td className="p-2 relative">
                  <button className="input" onClick={() => setOpenSlot(openSlot === item.id ? null : item.id)}>{slotSummary(item)}</button>
                  {openSlot === item.id && (
                    <SlotEditor item={item} onClose={() => setOpenSlot(null)}
                      onSave={(patch) => updateMut.mutate({ id: item.id, patch })} />
                  )}
                </td>
                <td className="p-2">
                  <input type="checkbox" checked={item.active}
                    onChange={(e) => updateMut.mutate({ id: item.id, patch: { active: e.target.checked } })} />
                </td>
                <td className="p-2 relative">
                  {item.warnings.length > 0 && (
                    <button title={item.warnings.join("\n")} className="text-amber-500"
                      onClick={() => setOpenWarn(openWarn === item.id ? null : item.id)}>⚠</button>
                  )}
                  {openWarn === item.id && (
                    <div className="absolute z-20 mt-1 right-0 w-64 rounded-lg border border-amber-500/50 bg-[var(--surface)] p-2 text-xs space-y-1">
                      {item.warnings.map((w, i) => <div key={i}>{w}</div>)}
                    </div>
                  )}
                </td>
                <td className="p-2">
                  {(item.file_url || item.url) && (
                    <a href={item.file_url ?? item.url ?? "#"} target="_blank" rel="noreferrer" className="text-[var(--accent)]">Vorschau</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
