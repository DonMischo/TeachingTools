// Mirrors api/routers/slideshow.py's ItemOut. Dates are "YYYY-MM-DD" strings.

export type SlideshowKind = "file" | "link" | "calendar" | "wochenspruch" | "hauspunkte";
export type SlideshowAudience = "guest" | "student" | "teacher";
export type SlideshowMediaType = "image" | "pdf" | "video";

export type SlideshowEvent = {
  title: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  tags: string[];
  category: string;
};

export type SlideshowWochenspruch = {
  sunday: string;
  season: string | null;
  date_label: string | null;
  text: string;
  reference: string | null;
  psalm: string | null;
  color: string | null;
  color_name: string | null;
  background_url: string | null;
  image_credit: string | null;
  hymns: string[];
  source_url: string | null;
};

export type SlideshowItem = {
  id: number;
  position: number;
  kind: SlideshowKind;
  title: string;
  active: boolean;
  audience: SlideshowAudience;
  duration_seconds: number;
  media_type: SlideshowMediaType | null;
  file_url: string | null;
  original_filename: string | null;
  url: string | null;
  calendar_tags: string[];
  calendar_categories: string[];
  calendar_days_ahead: number;
  slot_days: number[];
  slot_start: string | null;
  slot_end: string | null;
  slot_from: string | null;
  slot_until: string | null;
  warnings: string[];
  events: SlideshowEvent[];
  wochenspruch: SlideshowWochenspruch | null;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function localTimeStr(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** JS getDay(): 0=Sun..6=Sat → weekday index 0=Mon..6=Sun. */
function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function hasSlot(item: SlideshowItem): boolean {
  return item.slot_days.length > 0;
}

export function isInSlot(item: SlideshowItem, now: Date): boolean {
  if (!hasSlot(item)) return false;
  if (!item.slot_start || !item.slot_end) return false;
  if (item.slot_start >= item.slot_end) return false;
  if (!item.slot_days.includes(weekdayIndex(now))) return false;
  const time = localTimeStr(now);
  if (time < item.slot_start || time >= item.slot_end) return false;
  const date = localDateStr(now);
  if (item.slot_from && date < item.slot_from) return false;
  if (item.slot_until && date > item.slot_until) return false;
  return true;
}

/** A Wochenspruch the server couldn't fetch, or Termine with nothing upcoming, has nothing to show. */
function hasContent(item: SlideshowItem): boolean {
  if (item.kind === "wochenspruch") return item.wochenspruch !== null;
  if (item.kind === "calendar") return item.events.length > 0;
  return true;
}

/** A slot pins its item while it is active; outside the slot the item simply rotates. */
export function pickSlides(
  items: SlideshowItem[],
  now: Date
): { pinned: SlideshowItem | null; rotation: SlideshowItem[] } {
  const rotation = items.filter(hasContent);
  const pinned = rotation.find((item) => isInSlot(item, now)) ?? null;
  return { pinned, rotation };
}

/** null = the slide advances on its own (videos when they end, PDFs after their last page). */
export function slideDurationMs(item: SlideshowItem): number | null {
  if (item.media_type === "video" || item.media_type === "pdf") return null;
  return item.duration_seconds * 1000;
}
