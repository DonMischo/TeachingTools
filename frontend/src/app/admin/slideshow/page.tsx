"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CalendarMeta, SlideshowPatch } from "@/lib/api";
import type { SlideshowItem } from "@/lib/slideshow";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const KIND_ICON: Record<SlideshowItem["kind"], string> = {
  file: "🖼️", link: "🔗", calendar: "📅", wochenspruch: "📖", hauspunkte: "🏆", clock: "🕒",
};
// Always present, can only be deactivated (see api/routers/slideshow.py BUILTIN_KINDS)
const BUILTIN_KINDS: SlideshowItem["kind"][] = ["hauspunkte", "calendar", "wochenspruch", "clock"];

function kindIcon(item: SlideshowItem): string {
  if (item.kind === "file") {
    if (item.media_type === "pdf") return "📄";
    if (item.media_type === "video") return "🎬";
  }
  return KIND_ICON[item.kind];
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const AUDIENCE_LABEL: Record<SlideshowItem["audience"], string> = { guest: "Gast", student: "Schüler", teacher: "Lehrer" };
// Calendar categories a viewer level can see (mirrors the calendar router's visibility rules)
const VISIBLE_CATEGORIES: Record<SlideshowItem["audience"], string[] | null> = {
  guest: ["Schulgemeinschaft", "Ferien"],
  student: ["Schulgemeinschaft", "Ferien", "Primar", "Sekundar"],
  teacher: null,
};

const CHIP = "px-2 py-1 rounded text-xs border";
const CHIP_ON = "bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]";
const CHIP_OFF = "border-[var(--border)]";

function slotSummary(item: SlideshowItem): string {
  if (item.slot_days.length === 0) return "—";
  const days = item.slot_days.slice().sort((a, b) => a - b).map((d) => WEEKDAYS[d]).join(",");
  const time = item.slot_start && item.slot_end ? `${item.slot_start}–${item.slot_end}` : "?";
  return `${days} ${time}`;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function SlotEditor({ item, onSave, onClose }: {
  item: SlideshowItem;
  onSave: (patch: SlideshowPatch) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState<number[]>(item.slot_days);
  const [start, setStart] = useState(item.slot_start ?? "08:00");
  const [end, setEnd] = useState(item.slot_end ?? "16:00");
  const [from, setFrom] = useState(item.slot_from ?? "");
  const [until, setUntil] = useState(item.slot_until ?? "");

  return (
    <div className="absolute z-20 mt-1 right-0 w-72 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg space-y-2">
      <div className="text-xs text-[var(--text-muted)]">Im Zeitfenster bleibt der Eintrag stehen, sonst läuft er normal mit.</div>
      <div className="flex flex-wrap gap-1">
        {WEEKDAYS.map((label, i) => (
          <button key={i} onClick={() => setDays((cur) => toggle(cur, i).sort())}
            className={`${CHIP} ${days.includes(i) ? CHIP_ON : CHIP_OFF}`}>
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
          <button className="btn-primary !w-auto text-xs px-3 py-1" onClick={() => {
            onSave({ slot_days: days, slot_start: start, slot_end: end, slot_from: from || null, slot_until: until || null });
            onClose();
          }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

/** Filters of the built-in Termine slide plus a live preview of what they match. */
function CalendarConfig({ item, meta, onChange }: {
  item: SlideshowItem;
  meta: CalendarMeta | undefined;
  onChange: (patch: SlideshowPatch) => void;
}) {
  const { data: events = [], isFetching } = useQuery({
    queryKey: ["slideshow-events", item.id, item.calendar_tags, item.calendar_categories, item.calendar_days_ahead],
    queryFn: () => api.slideshow.events(item.id),
  });
  const { data: tags = [] } = useQuery({ queryKey: ["slideshow-calendar-tags"], queryFn: api.slideshow.calendarTags });
  const categories = (meta?.categories ?? []).filter((c) => c !== "Persönlich");
  const visible = VISIBLE_CATEGORIES[item.audience];
  const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

  return (
    <div className="grid lg:grid-cols-2 gap-4 p-3 rounded-lg bg-[var(--surface)]">
      <div className="space-y-3">
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1">Kategorien</div>
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <button key={c} onClick={() => onChange({ calendar_categories: toggle(item.calendar_categories, c) })}
                className={`${CHIP} ${item.calendar_categories.includes(c) ? CHIP_ON : CHIP_OFF}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1">Tags</div>
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <button key={t.name} onClick={() => onChange({ calendar_tags: toggle(item.calendar_tags, t.name) })}
                className={`${CHIP} inline-flex items-center gap-1 ${item.calendar_tags.includes(t.name) ? CHIP_ON : CHIP_OFF}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: t.color ?? "#6b7280" }} />
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Tage im Voraus</span>
          <input key={item.calendar_days_ahead} type="number" min={1} max={365} className="input !w-20"
            defaultValue={item.calendar_days_ahead}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v !== item.calendar_days_ahead) onChange({ calendar_days_ahead: v });
            }} />
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          Nichts ausgewählt = keine Einschränkung. Private Termine erscheinen nie.
        </div>
      </div>

      <div>
        <div className="text-xs text-[var(--text-muted)] mb-1">
          Vorschau ({events.length} Termine){isFetching && " · lädt…"}
        </div>
        <div className="max-h-64 overflow-y-auto rounded border border-[var(--border)] divide-y divide-[var(--border)]">
          {events.length === 0 && <div className="p-2 text-sm text-[var(--text-muted)]">Keine passenden Termine</div>}
          {events.map((ev, i) => {
            const hidden = visible !== null && !visible.includes(ev.category);
            return (
              <div key={i} className={`p-2 text-sm flex flex-wrap items-baseline gap-x-2 ${hidden ? "opacity-50" : ""}`}>
                <span className="tabular-nums text-[var(--text-muted)]">
                  {ddmm(ev.start_date)}{ev.end_date !== ev.start_date && `–${ddmm(ev.end_date)}`}
                </span>
                <span className="font-medium">{ev.title}</span>
                <span className="text-xs text-[var(--text-muted)]">{ev.category}</span>
                {hidden && <span className="text-xs text-amber-500">nicht sichtbar für {AUDIENCE_LABEL[item.audience]}</span>}
              </div>
            );
          })}
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
  const onError = (e: any) => toast(String(e.message ?? e), "error");

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: SlideshowPatch }) => api.slideshow.update(id, patch),
    onSuccess: invalidate, onError,
  });
  const updateManyMut = useMutation({
    mutationFn: ({ ids, patch }: { ids: number[]; patch: SlideshowPatch }) => api.slideshow.updateMany(ids, patch),
    onSuccess: invalidate, onError,
  });
  const orderMut = useMutation({
    mutationFn: (ids: number[]) => api.slideshow.order(ids),
    onSuccess: invalidate, onError,
  });
  const removeMut = useMutation({
    mutationFn: (ids: number[]) => api.slideshow.remove(ids),
    onSuccess: (res) => { invalidate(); toast(`${res.deleted} gelöscht`, "success"); setSelected([]); },
    onError,
  });
  const uploadMut = useMutation({
    mutationFn: (files: File[]) => api.slideshow.upload(files),
    onSuccess: invalidate, onError,
  });
  const createMut = useMutation({
    mutationFn: (body: Parameters<typeof api.slideshow.create>[0]) => api.slideshow.create(body),
    onSuccess: () => { invalidate(); setLinkUrl(""); setLinkTitle(""); },
    onError,
  });

  const [selected, setSelected] = useState<number[]>([]);
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [openWarn, setOpenWarn] = useState<number | null>(null);
  const [openCalendar, setOpenCalendar] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!auth || !ready || !allowed) return null;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    uploadMut.mutate(Array.from(fileList));
  };

  /** Shared settings: an edit on a selected row applies to every selected row. */
  const change = (item: SlideshowItem, patch: SlideshowPatch) => {
    if (selected.length > 1 && selected.includes(item.id)) updateManyMut.mutate({ ids: selected, patch });
    else updateMut.mutate({ id: item.id, patch });
  };

  const deletable = selected.filter((id) => {
    const item = items.find((i) => i.id === id);
    return item && !BUILTIN_KINDS.includes(item.kind);
  });

  const move = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const ids = items.map((i) => i.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    orderMut.mutate(ids);
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <h1 className="text-2xl font-bold">Startseiten-Slideshow</h1>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)]"}`}
      >
        <input ref={fileInputRef} type="file" multiple hidden
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.mp4,.webm"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        <div className="text-[var(--text-muted)]">
          {uploadMut.isPending ? "Wird hochgeladen…" : "Dateien hierher ziehen oder klicken (Bilder, PDFs, Videos)"}
        </div>
      </div>

      <form
        className="flex flex-wrap sm:flex-nowrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (linkUrl) createMut.mutate({ kind: "link", url: linkUrl, title: linkTitle || undefined });
        }}
      >
        <span aria-hidden>🔗</span>
        {/* .input/.btn-primary are w-full globally — widths need ! to win */}
        <input className="input !w-auto flex-1 min-w-[12rem]" type="url" placeholder="Link hinzufügen: https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        <input className="input sm:!w-56 shrink-0" placeholder="Titel (optional)" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
        <button type="submit" className="btn-primary !w-auto shrink-0 whitespace-nowrap px-4 disabled:opacity-40" disabled={!linkUrl || createMut.isPending}>Hinzufügen</button>
      </form>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--accent)]/60 px-3 py-2 text-sm">
          <span className="font-semibold">{selected.length} ausgewählt</span>
          {selected.length > 1 && (
            <span className="text-[var(--text-muted)]">Zielgruppe, Dauer, Zeitfenster und Aktiv gelten für alle ausgewählten</span>
          )}
          <span className="flex-1" />
          <button className="text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => setSelected([])}>Auswahl aufheben</button>
          <button className="text-red-400 disabled:opacity-40" disabled={deletable.length === 0} onClick={() => {
            if (confirm(`${deletable.length} Einträge wirklich löschen?`)) removeMut.mutate(deletable);
          }}>
            Löschen ({deletable.length})
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
              <th className="p-2"><input type="checkbox" checked={items.length > 0 && selected.length === items.length}
                onChange={() => setSelected(selected.length === items.length ? [] : items.map((i) => i.id))} /></th>
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
            {items.map((item, idx) => {
              const isSelected = selected.includes(item.id);
              return [
                <tr key={item.id} className={`border-b border-[var(--border)] ${isSelected ? "bg-[var(--surface)]" : ""}`}>
                  <td className="p-2">
                    <input type="checkbox" checked={isSelected} onChange={() => setSelected((cur) => toggle(cur, item.id))} />
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <button disabled={idx === 0} onClick={() => move(idx, -1)} className="px-1 disabled:opacity-30">↑</button>
                    <button disabled={idx === items.length - 1} onClick={() => move(idx, 1)} className="px-1 disabled:opacity-30">↓</button>
                  </td>
                  <td className="p-2">{kindIcon(item)}</td>
                  <td className="p-2 min-w-[12rem]">
                    <div className="flex items-center gap-2">
                      <input key={item.title} className="input w-full" defaultValue={item.title}
                        onBlur={(e) => { if (e.target.value !== item.title) updateMut.mutate({ id: item.id, patch: { title: e.target.value } }); }} />
                      {item.kind === "calendar" && (
                        <button className="text-xs whitespace-nowrap text-[var(--accent)]"
                          onClick={() => setOpenCalendar(openCalendar === item.id ? null : item.id)}>
                          {openCalendar === item.id ? "Schließen ▴" : "Anpassen ▾"}
                        </button>
                      )}
                      {/* Die Uhr haelt sich nicht an ihren Listenplatz — ohne den
                          Hinweis schiebt man sie hoch und runter und wundert sich. */}
                      {item.kind === "clock" && (
                        <span className="text-xs whitespace-nowrap text-[var(--text-muted)]">
                          kommt nach je 2 Folien
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <select className="input" value={item.audience}
                      onChange={(e) => change(item, { audience: e.target.value as SlideshowItem["audience"] })}>
                      {Object.entries(AUDIENCE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {item.media_type === "video" ? (
                      <input className="input !w-20" disabled value="bis Ende" />
                    ) : (
                      <>
                        <input key={item.duration_seconds} type="number" min={3} max={3600} className="input !w-20"
                          defaultValue={item.duration_seconds}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== item.duration_seconds) change(item, { duration_seconds: v });
                          }} />
                        <span className="ml-1 text-xs text-[var(--text-muted)]">{item.media_type === "pdf" ? "s/Seite" : "s"}</span>
                      </>
                    )}
                  </td>
                  <td className="p-2 relative">
                    <button className="input whitespace-nowrap" onClick={() => setOpenSlot(openSlot === item.id ? null : item.id)}>{slotSummary(item)}</button>
                    {openSlot === item.id && (
                      <SlotEditor item={item} onClose={() => setOpenSlot(null)} onSave={(patch) => change(item, patch)} />
                    )}
                  </td>
                  <td className="p-2">
                    <input type="checkbox" checked={item.active} onChange={(e) => change(item, { active: e.target.checked })} />
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
                </tr>,
                item.kind === "calendar" && openCalendar === item.id && (
                  <tr key={`${item.id}-config`} className="border-b border-[var(--border)]">
                    <td colSpan={10} className="p-2">
                      <CalendarConfig item={item} meta={calMeta} onChange={(patch) => updateMut.mutate({ id: item.id, patch })} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
