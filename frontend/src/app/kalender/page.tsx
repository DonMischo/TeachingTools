"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, CalendarEntryOut, CalendarTagOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { getSchoolYearStart, getSchoolYearLabel } from "@/lib/schoolyear";

// Fixed audience-tier colors (category = who sees it, no longer the visual dimension).
const CATEGORY_COLORS: Record<string, string> = {
  Kollegium: "#64748b",
  Primar: "#0ea5e9",
  Sekundar: "#6366f1",
  Schulgemeinschaft: "#14b8a6",
  Ferien: "#16a34a",
  Persönlich: "#a855f7",
};
const FALLBACK_TAG_COLOR = "#6b7280";
const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function entryColor(e: { category: string; tags: string[] }, tagColors: Map<string, string>): string {
  for (const t of e.tags) if (tagColors.has(t)) return tagColors.get(t)!;
  return CATEGORY_COLORS[e.category] ?? FALLBACK_TAG_COLOR;
}

type Draft = {
  id?: number;
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string;
  end_time: string;
  tags: string[];
};

function blankDraft(date?: string): Draft {
  return {
    title: "", description: "", category: "Schulgemeinschaft",
    start_date: date ?? fmtDate(new Date()), end_date: date ?? fmtDate(new Date()),
    all_day: true, start_time: "08:00", end_time: "09:00",
    tags: [],
  };
}
function draftFromEntry(e: CalendarEntryOut): Draft {
  return {
    id: e.id, title: e.title, description: e.description ?? "", category: e.category,
    start_date: e.start_date, end_date: e.end_date,
    all_day: e.all_day, start_time: e.start_time ?? "08:00", end_time: e.end_time ?? "09:00",
    tags: e.tags,
  };
}

// ── Entry edit/create modal ─────────────────────────────────────────────────

function EntryModal({ draft, categories, tags, onClose, onSaved, onCreateTag, onDelete, canDelete }: {
  draft: Draft;
  categories: string[];
  tags: CalendarTagOut[];
  onClose: () => void;
  onSaved: (d: Draft) => void;
  onCreateTag: (name: string, color: string) => void;
  onDelete?: () => void;
  canDelete: boolean;
}) {
  const [d, setD] = useState<Draft>(draft);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [showNewTag, setShowNewTag] = useState(false);

  function toggleTag(t: string) {
    setD(prev => ({ ...prev, tags: prev.tags.includes(t) ? prev.tags.filter(x => x !== t) : [...prev.tags, t] }));
  }
  function submitNewTag() {
    const name = newTagName.trim();
    if (!name) return;
    onCreateTag(name, newTagColor);
    setD(prev => ({ ...prev, tags: [...prev.tags, name] }));
    setNewTagName("");
    setShowNewTag(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 flex flex-col gap-3 z-[70]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{d.id ? "Eintrag bearbeiten" : "Neuer Eintrag"}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
        </div>

        <input className="input text-sm py-2" placeholder="Titel" value={d.title}
          onChange={e => setD({ ...d, title: e.target.value })} />

        <textarea className="input text-sm py-2 min-h-[3.5rem]" placeholder="Beschreibung (optional)"
          value={d.description} onChange={e => setD({ ...d, description: e.target.value })} />

        <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
          <input type="checkbox" checked={d.all_day} onChange={e => setD({ ...d, all_day: e.target.checked })} />
          Ganztägig / mehrtägig
        </label>

        <div className="flex gap-2">
          <label className="flex-1 flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            {d.all_day ? "Start" : "Datum"}
            <input type="date" className="input text-sm py-1.5" value={d.start_date}
              onChange={e => setD({ ...d, start_date: e.target.value, end_date: e.target.value > d.end_date ? e.target.value : d.end_date })} />
          </label>
          {d.all_day && (
            <label className="flex-1 flex flex-col gap-1 text-xs text-[var(--text-muted)]">
              Ende
              <input type="date" className="input text-sm py-1.5" value={d.end_date} min={d.start_date}
                onChange={e => setD({ ...d, end_date: e.target.value })} />
            </label>
          )}
        </div>

        {!d.all_day && (
          <div className="flex gap-2">
            <label className="flex-1 flex flex-col gap-1 text-xs text-[var(--text-muted)]">
              Uhrzeit von
              <input type="time" className="input text-sm py-1.5" value={d.start_time}
                onChange={e => setD({ ...d, start_time: e.target.value })} />
            </label>
            <label className="flex-1 flex flex-col gap-1 text-xs text-[var(--text-muted)]">
              bis
              <input type="time" className="input text-sm py-1.5" value={d.end_time}
                onChange={e => setD({ ...d, end_time: e.target.value })} />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Kategorie (wer sieht diesen Eintrag)
          <select className="input text-sm py-1.5" value={d.category} onChange={e => setD({ ...d, category: e.target.value })}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--text-muted)]">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(t => {
              const active = d.tags.includes(t.name);
              return (
                <button key={t.name} type="button" onClick={() => toggleTag(t.name)}
                  className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                  style={active ? { background: t.color, borderColor: "transparent", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  {t.name}
                </button>
              );
            })}
          </div>
          {!showNewTag ? (
            <button type="button" onClick={() => setShowNewTag(true)} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] underline self-start mt-0.5">
              + neuer Tag
            </button>
          ) : (
            <div className="flex gap-1.5 items-center mt-1">
              <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-[var(--border)]" />
              <input className="input text-xs py-1 flex-1" placeholder="Tag-Name…" value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitNewTag(); } }} />
              <button type="button" onClick={submitNewTag} className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)]">+</button>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-1">
          <button onClick={() => onSaved(d)} disabled={!d.title.trim()} className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40 flex-1">
            {d.id ? "Speichern" : "Erstellen"}
          </button>
          {d.id && canDelete && onDelete && (
            <button onClick={onDelete} className="text-sm border border-red-400/50 text-red-400 hover:bg-red-400/10 rounded-lg px-3 py-1.5">
              Löschen
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Month grid ───────────────────────────────────────────────────────────

function MonthGrid({ year, month, entries, tagColors, isTeacher, onDayClick, onEntryClick }: {
  year: number; month: number; entries: CalendarEntryOut[]; tagColors: Map<string, string>; isTeacher: boolean;
  onDayClick: (dateStr: string) => void; onEntryClick: (e: CalendarEntryOut) => void;
}) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = fmtDate(new Date());

  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function entriesForDay(day: number): CalendarEntryOut[] {
    const dateStr = fmtDate(new Date(year, month, day));
    return entries.filter(e => e.start_date <= dateStr && e.end_date >= dateStr);
  }

  const holidays = useMemo(() => new Map([...thuringenHolidays(year - 1), ...thuringenHolidays(year), ...thuringenHolidays(year + 1)]), [year]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--bg)]">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`text-center text-xs font-semibold py-1.5 ${i >= 5 ? "text-green-600" : "text-[var(--text-muted)]"}`}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} className="min-h-[5.5rem] border-b border-r border-[var(--border)]/30" />;
          const dateStr = fmtDate(new Date(year, month, day));
          const dayEntries = entriesForDay(day);
          const isToday = dateStr === todayStr;
          const weekday = new Date(year, month, day).getDay();
          const isWeekend = weekday === 0 || weekday === 6;
          const holidayName = holidays.get(dateStr);
          return (
            <div key={i}
              onClick={() => isTeacher && onDayClick(dateStr)}
              title={holidayName}
              className={`min-h-[5.5rem] border-b border-r border-[var(--border)]/30 p-1 flex flex-col gap-0.5 ${isTeacher ? "cursor-pointer hover:bg-[var(--surface-hover)]" : ""} ${
                holidayName ? "bg-green-500/10" : isWeekend ? "bg-[var(--bg)]" : ""
              }`}>
              <span className={`text-xs px-1 ${holidayName ? "font-bold text-green-600" : isToday ? "font-bold text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                {day}
              </span>
              {dayEntries.slice(0, 3).map(e => (
                <button key={e.id} onClick={(ev) => { ev.stopPropagation(); onEntryClick(e); }}
                  className="text-[10px] leading-tight text-left px-1 py-0.5 rounded truncate text-white"
                  style={{ background: entryColor(e, tagColors) }}
                  title={e.title}>
                  {!e.all_day && e.start_time ? `${e.start_time} ` : ""}{e.title}
                </button>
              ))}
              {dayEntries.length > 3 && <span className="text-[10px] text-[var(--text-muted)] px-1">+{dayEntries.length - 3} mehr</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Thüringen public holidays (Feiertage) — computed, not imported ────────
// Fixed dates + Easter-relative (Gauss's algorithm). Ferien (school holidays)
// come from OpenHolidaysAPI (see the "Feriendaten laden" action below).

function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function thuringenHolidays(year: number): Map<string, string> {
  const easter = easterSunday(year);
  const holidays: [Date, string][] = [
    [new Date(year, 0, 1), "Neujahr"],
    [addDays(easter, -2), "Karfreitag"],
    [addDays(easter, 1), "Ostermontag"],
    [new Date(year, 4, 1), "Tag der Arbeit"],
    [addDays(easter, 39), "Christi Himmelfahrt"],
    [addDays(easter, 50), "Pfingstmontag"],
    [new Date(year, 9, 3), "Tag der Deutschen Einheit"],
    [new Date(year, 8, 20), "Weltkindertag"],
    [new Date(year, 9, 31), "Reformationstag"],
    [new Date(year, 11, 25), "1. Weihnachtstag"],
    [new Date(year, 11, 26), "2. Weihnachtstag"],
  ];
  return new Map(holidays.map(([d, name]) => [fmtDate(d), name]));
}

// ── PDF export: A3 year planner, 6 months per page, vertical bars ─────────

function printYearCalendar(entries: CalendarEntryOut[], schoolYearStart: number, tagColors: Map<string, string>) {
  const holidays = new Map([
    ...thuringenHolidays(schoolYearStart),
    ...thuringenHolidays(schoolYearStart + 1),
  ]);

  // Aug(7)..Dec(11) of startYear, then Jan(0)..Jul(6) of startYear+1 — 12 months total, 6 per page.
  const allMonths = [
    ...Array.from({ length: 5 }, (_, i) => ({ year: schoolYearStart, month: 7 + i })),   // Aug-Dec
    ...Array.from({ length: 7 }, (_, i) => ({ year: schoolYearStart + 1, month: i })),   // Jan-Jul
  ];
  const page1 = allMonths.slice(0, 6);
  const page2 = allMonths.slice(6, 12);

  function monthColumn(year: number, month: number): string {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthEntries = entries.filter(e => {
      const s = parseDate(e.start_date), en = parseDate(e.end_date);
      return s <= new Date(year, month, daysInMonth) && en >= new Date(year, month, 1);
    });
    // Greedy lane assignment (interval graph coloring) so overlapping spans sit side by side.
    const sorted = [...monthEntries].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const laneEnds: string[] = [];
    const laneOf = new Map<number, number>();
    for (const e of sorted) {
      let lane = laneEnds.findIndex(end => end < e.start_date);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(e.end_date); }
      else laneEnds[lane] = e.end_date;
      laneOf.set(e.id, lane);
    }
    const laneCount = Math.max(1, laneEnds.length);

    const bars = monthEntries.map(e => {
      const s = parseDate(e.start_date), en = parseDate(e.end_date);
      const dayStart = Math.max(1, s.getFullYear() === year && s.getMonth() === month ? s.getDate() : 1);
      const dayEnd = Math.min(daysInMonth, en.getFullYear() === year && en.getMonth() === month ? en.getDate() : daysInMonth);
      const top = ((dayStart - 1) / daysInMonth) * 100;
      const height = ((dayEnd - dayStart + 1) / daysInMonth) * 100;
      const lane = laneOf.get(e.id) ?? 0;
      const color = entryColor(e, tagColors);
      return `<div class="bar" style="top:${top}%;height:${height}%;left:${(lane / laneCount) * 100}%;width:${100 / laneCount}%;background:${color}"><span>${e.title.replace(/</g, "&lt;")}</span></div>`;
    }).join("");

    const dayRows = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = fmtDate(new Date(year, month, day));
      const weekday = new Date(year, month, day).getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = weekday === 0 || weekday === 6;
      const holidayName = holidays.get(dateStr);
      const cls = holidayName ? "day-row holiday" : isWeekend ? "day-row weekend" : "day-row";
      return `<div class="${cls}" style="top:${(i / daysInMonth) * 100}%;height:${(1 / daysInMonth) * 100}%" title="${holidayName ?? ""}">
        <span class="daynum">${day}</span>
      </div>`;
    }).join("");

    return `<div class="month-col">
      <div class="month-head">${MONTH_NAMES[month]}</div>
      <div class="month-body">${dayRows}${bars}</div>
    </div>`;
  }

  const legendItems = [...tagColors.entries()].map(([name, color]) =>
    `<span class="legend-item"><span class="swatch" style="background:${color}"></span>${name}</span>`
  ).join("");
  const legendHtml = `<div class="legend">
    ${legendItems}
    <span class="legend-item"><span class="swatch" style="background:#f2f2f2;border:0.2mm solid #ccc"></span>Wochenende</span>
    <span class="legend-item"><span class="swatch" style="background:#86efac"></span>Feiertag (Thüringen)</span>
  </div>`;

  function page(months: { year: number; month: number }[]): string {
    return `<div class="page">
      <div class="months-row">${months.map(m => monthColumn(m.year, m.month)).join("")}</div>
      ${legendHtml}
    </div>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Jahreskalender ${schoolYearStart}/${schoolYearStart + 1}</title><style>
    @page { size: A3 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; color: #111; margin: 0; }
    .page { page-break-after: always; height: 277mm; display: flex; flex-direction: column; }
    .page:last-child { page-break-after: auto; }
    .months-row { display: flex; gap: 3mm; flex: 1 1 auto; min-height: 0; }
    .month-col { flex: 1; display: flex; flex-direction: column; border: 1px solid #ccc; }
    .month-head { text-align: center; font-weight: 700; font-size: 9pt; padding: 2mm; border-bottom: 1px solid #ccc; background: #f5f5f5; }
    .month-body { position: relative; flex: 1; }
    .day-row { position: absolute; left: 0; right: 0; border-top: 1px dotted #ddd; display: flex; align-items: center; }
    .day-row.weekend { background: #f2f2f2; }
    .day-row.holiday { background: #86efac; }
    .daynum { font-size: 5.5pt; color: #888; padding-left: 1mm; line-height: 1; }
    .day-row.holiday .daynum { color: #166534; font-weight: 700; }
    .bar { position: absolute; overflow: hidden; border-radius: 1mm; opacity: .92; }
    .bar span { display: block; writing-mode: vertical-rl; transform: rotate(180deg); font-size: 6pt; color: #fff; font-weight: 600; padding: 0.5mm; white-space: nowrap; }
    .legend { flex: 0 0 auto; display: flex; gap: 4mm; flex-wrap: wrap; margin-top: 3mm; font-size: 8pt; }
    .legend-item { display: flex; align-items: center; gap: 1.5mm; }
    .swatch { width: 3mm; height: 3mm; border-radius: 1mm; display: inline-block; }
  </style></head><body>
    ${page(page1)}
    ${page(page2)}
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function KalenderPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isTeacher = auth?.user_type === "teacher";
  const isAdmin = auth?.role === "admin";
  const fileRef = useRef<HTMLInputElement>(null);

  const [schoolYearStart, setSchoolYearStart] = useState(() => getSchoolYearStart());
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [modalDraft, setModalDraft] = useState<Draft | null>(null);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportTags, setExportTags] = useState<Set<string>>(new Set());
  const [exportCategories, setExportCategories] = useState<Set<string>>(new Set());

  const { data: meta } = useQuery({ queryKey: ["calendar-meta"], queryFn: api.calendar.meta, staleTime: 60_000 });
  const categories = meta?.categories ?? [];
  const tags = meta?.tags ?? [];
  const tagColors = useMemo(() => new Map(tags.map(t => [t.name, t.color])), [tags]);

  const { data: entries = [] } = useQuery<CalendarEntryOut[]>({
    queryKey: ["calendar", schoolYearStart],
    queryFn: () => api.calendar.list({ from: `${schoolYearStart}-08-01`, to: `${schoolYearStart + 1}-07-31` }),
    enabled: !!auth,
  });

  const visibleEntries = useMemo(() => entries.filter(e =>
    (categoryFilter.size === 0 || categoryFilter.has(e.category)) &&
    (tagFilter.size === 0 || e.tags.some(t => tagFilter.has(t)))
  ), [entries, categoryFilter, tagFilter]);

  const createMut = useMutation({
    mutationFn: (d: Draft) => api.calendar.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar"] }); setModalDraft(null); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });
  const updateMut = useMutation({
    mutationFn: (d: Draft) => api.calendar.update(d.id!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar"] }); setModalDraft(null); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.calendar.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar"] }); setModalDraft(null); },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });
  const importMut = useMutation({
    mutationFn: (file: File) => api.calendar.importIcs(file),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      toast(`${res.created} Termine importiert${res.errors.length ? `, ${res.errors.length} Fehler` : ""}`, res.errors.length ? "error" : "success");
    },
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });
  const createTagMut = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) => api.calendar.tags.create(name, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-meta"] }),
    onError: (e: any) => toast(e.message ?? "Fehler", "error"),
  });
  const fetchHolidaysMut = useMutation({
    mutationFn: () => api.calendar.fetchHolidays(schoolYearStart),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      toast(`${res.created} Ferientermine (${res.bundesland}) geladen`, "success");
    },
    onError: (e: any) => toast(e.message ?? "Fehler beim Laden der Feriendaten", "error"),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) importMut.mutate(file);
  }

  function toggleSet(set: Set<string>, setSet: (s: Set<string>) => void, value: string) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setSet(next);
  }

  if (!auth) {
    return <div className="p-8 text-[var(--text-muted)] text-sm">Bitte einloggen, um den Kalender zu sehen.</div>;
  }

  return (
    <div className="flex flex-col gap-5 p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📅 Kalender</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Schuljahr {getSchoolYearLabel(new Date(schoolYearStart, 8, 1))}</p>
        </div>
        {isTeacher && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setModalDraft(blankDraft(fmtDate(new Date(viewMonth.year, viewMonth.month, new Date().getDate()))))}
              className="btn-primary text-sm py-1.5 px-4">+ Neuer Termin</button>
            <button onClick={() => setShowExportPanel(v => !v)}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]">
              📤 Import / Export
            </button>
            <button onClick={() => printYearCalendar(entries, schoolYearStart, tagColors)}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]">
              🖨 Jahresplaner (A3 PDF)
            </button>
          </div>
        )}
      </div>

      {showExportPanel && isTeacher && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--text-muted)]">ICS-Import</span>
              <button onClick={() => fileRef.current?.click()} disabled={importMut.isPending}
                className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)] disabled:opacity-40">
                {importMut.isPending ? "Importiere…" : "📂 .ics-Datei wählen"}
              </button>
              <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={handleFileChange} />
            </div>

            {isAdmin && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Feriendaten</span>
                <button onClick={() => fetchHolidaysMut.mutate()} disabled={fetchHolidaysMut.isPending}
                  className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)] disabled:opacity-40">
                  {fetchHolidaysMut.isPending ? "Lade…" : `🏖 Ferien ${schoolYearStart}/${schoolYearStart + 1} laden`}
                </button>
                <span className="text-[10px] text-[var(--text-muted)]">Bundesland unter Admin → Kalender-Einstellungen</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--text-muted)]">ICS-Export</span>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-[var(--text-muted)]">Kategorie</span>
                <div className="flex flex-wrap gap-1.5 max-w-xs">
                  {categories.map(c => (
                    <button key={c} onClick={() => toggleSet(exportCategories, setExportCategories, c)}
                      className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                      style={exportCategories.has(c) ? { background: CATEGORY_COLORS[c], borderColor: "transparent", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      {c}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-[var(--text-muted)] mt-1">Tag</span>
                <div className="flex flex-wrap gap-1.5 max-w-xs">
                  {tags.map(t => (
                    <button key={t.name} onClick={() => toggleSet(exportTags, setExportTags, t.name)}
                      className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                      style={exportTags.has(t.name) ? { background: t.color, borderColor: "transparent", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <a href={api.calendar.exportIcsUrl([...exportTags], [...exportCategories])} target="_blank" rel="noreferrer"
                className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)] text-center mt-1">
                ⬇️ Exportieren
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-[var(--text-muted)] mr-1">Kategorie:</span>
          {categories.map(c => (
            <button key={c} onClick={() => toggleSet(categoryFilter, setCategoryFilter, c)}
              className="text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={categoryFilter.has(c) ? { background: CATEGORY_COLORS[c], borderColor: "transparent", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-muted)" }}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-[var(--text-muted)] mr-1">Tag:</span>
          {tags.map(t => (
            <button key={t.name} onClick={() => toggleSet(tagFilter, setTagFilter, t.name)}
              className="text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={tagFilter.has(t.name) ? { background: t.color, borderColor: "transparent", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-muted)" }}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <button onClick={() => setViewMonth(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })}
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]">←</button>
        <span className="font-semibold text-sm w-40 text-center">{MONTH_NAMES[viewMonth.month]} {viewMonth.year}</span>
        <button onClick={() => setViewMonth(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })}
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]">→</button>
        <button onClick={() => {
          const now = new Date();
          setViewMonth({ year: now.getFullYear(), month: now.getMonth() });
          setSchoolYearStart(getSchoolYearStart(now));
        }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline ml-2">Heute</button>
        <div className="flex-1" />
        <button onClick={() => setSchoolYearStart(y => y - 1)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">« Schuljahr</button>
        <span className="text-xs text-[var(--text-muted)]">{schoolYearStart}/{schoolYearStart + 1}</span>
        <button onClick={() => setSchoolYearStart(y => y + 1)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Schuljahr »</button>
      </div>

      <MonthGrid
        year={viewMonth.year} month={viewMonth.month} entries={visibleEntries} tagColors={tagColors} isTeacher={!!isTeacher}
        onDayClick={(dateStr) => setModalDraft(blankDraft(dateStr))}
        onEntryClick={(e) => setModalDraft(draftFromEntry(e))}
      />

      {/* Upcoming list */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
        <h2 className="font-semibold text-sm">Termine im Schuljahr</h2>
        {visibleEntries.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Keine Termine.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {visibleEntries.map(e => (
              <li key={e.id} className="py-2 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entryColor(e, tagColors) }} />
                <div className="flex-1 min-w-0">
                  <button onClick={() => setModalDraft(draftFromEntry(e))} className="text-sm font-medium hover:text-[var(--accent)] transition-colors text-left">
                    {e.title}
                  </button>
                  <div className="text-xs text-[var(--text-muted)]">
                    {e.start_date}{e.end_date !== e.start_date ? ` – ${e.end_date}` : ""}
                    {!e.all_day && e.start_time ? ` · ${e.start_time}–${e.end_time}` : ""} · {e.category}
                    {e.tags.length > 0 && ` · ${e.tags.join(", ")}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalDraft && (
        <EntryModal
          draft={modalDraft}
          categories={categories}
          tags={tags}
          onClose={() => setModalDraft(null)}
          onSaved={(d) => d.id ? updateMut.mutate(d) : createMut.mutate(d)}
          onCreateTag={(name, color) => createTagMut.mutate({ name, color })}
          onDelete={modalDraft.id ? () => deleteMut.mutate(modalDraft.id!) : undefined}
          canDelete={isAdmin || !!isTeacher}
        />
      )}
    </div>
  );
}
