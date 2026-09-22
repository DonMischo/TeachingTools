"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { pickSlides, slideDurationMs, type SlideshowItem } from "@/lib/slideshow";
import { toVideoEmbed } from "@/lib/embed";
import { useAuth } from "@/contexts/AuthContext";
import { AppLogo } from "@/components/AppLogo";
import { HaeuserDiagram } from "@/components/HaeuserDiagram";
import { WochenspruchSlide } from "@/components/WochenspruchSlide";
import { PdfSlide } from "@/components/PdfSlide";
import { abWoche, isoWoche } from "@/lib/schoolyear";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Uhrzeit, Datum und A/B-Woche.
 *
 * Doppelt genutzt: als Folie `kind: "clock"` in der Rotation und als
 * Rückfallbild, solange überhaupt keine Folie etwas zu zeigen hat.
 *
 * Die A/B-Woche kommt aus derselben Funktion wie die Randspalte im Kalender
 * (`lib/schoolyear`) — stünde die Regel zweimal da, zeigte irgendwann die eine
 * Anzeige A und die andere B.
 */
function Screensaver() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const date = now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const kw = isoWoche(now);
  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full">
      <AppLogo />
      <div className="text-7xl font-bold tabular-nums">{time}</div>
      <div className="text-xl text-[var(--text-muted)] capitalize">{date}</div>
      <div className="flex items-center gap-3 text-xl" data-testid="ab-woche">
        <span className="text-[var(--text-muted)] tabular-nums">KW {kw}</span>
        <span className="px-4 py-1 rounded-full font-bold bg-[var(--accent)] text-[var(--accent-text)]">
          {abWoche(kw)}-Woche
        </span>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: SlideshowItem["events"][number] }) {
  // "YYYY-MM-DD" → "DD.MM." without Date parsing (new Date() would read it as UTC)
  const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
  const dateStr = event.end_date !== event.start_date
    ? `${ddmm(event.start_date)} – ${ddmm(event.end_date)}`
    : ddmm(event.start_date);
  const timeStr = event.all_day ? "ganztägig" : (event.start_time ?? "").slice(0, 5);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-sm text-[var(--text-muted)]">{dateStr} · {timeStr}</div>
      <div className="text-lg font-semibold">{event.title}</div>
      {event.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {event.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function HauspunkteSlide() {
  const { data: haeuser = [] } = useQuery({
    queryKey: ["haeuser"],
    queryFn: api.haeuser.list,
    refetchInterval: 15_000,
  });
  return (
    <div className="flex items-center justify-center h-full p-6">
      <HaeuserDiagram haeuser={haeuser} />
    </div>
  );
}

// `loop`: a pinned or lone video/PDF has nothing to advance to, so it repeats.
function SlideView({ item, onAdvance, loop }: { item: SlideshowItem; onAdvance: () => void; loop: boolean }) {
  if (item.kind === "hauspunkte") return <HauspunkteSlide />;
  if (item.kind === "clock") return <Screensaver />;
  if (item.kind === "wochenspruch" && item.wochenspruch) return <WochenspruchSlide ws={item.wochenspruch} />;

  if (item.kind === "calendar") {
    return (
      <div className="flex flex-col gap-3 h-full overflow-y-auto p-6 w-full max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">{item.title}</h2>
        {item.events.length === 0 && <div className="text-[var(--text-muted)]">Keine anstehenden Termine</div>}
        {item.events.map((ev, i) => <EventCard key={i} event={ev} />)}
      </div>
    );
  }

  if (item.kind === "link" && item.url) {
    const v = toVideoEmbed(item.url);
    if (v.kind === "video") {
      return <video src={v.url} autoPlay muted playsInline loop={loop} onEnded={onAdvance} onError={onAdvance} className="w-full h-full object-contain" />;
    }
    // YouTube/Vimeo only autoplay on an unattended display when muted.
    const src = v.url !== item.url ? `${v.url}?autoplay=1&mute=1&muted=1` : v.url;
    return <iframe src={src} className="w-full h-full border-0" allow="autoplay; fullscreen" allowFullScreen />;
  }

  if (item.kind === "file" && item.file_url) {
    if (item.media_type === "image") {
      return <img src={item.file_url} alt={item.title} className="w-full h-full object-contain" />;
    }
    if (item.media_type === "pdf") {
      return <PdfSlide url={item.file_url} pageMs={item.duration_seconds * 1000} loop={loop} onDone={onAdvance} />;
    }
    if (item.media_type === "video") {
      return <video src={item.file_url} autoPlay muted playsInline loop={loop} onEnded={onAdvance} onError={onAdvance} className="w-full h-full object-contain" />;
    }
  }

  return null;
}

export function StartSlideshow() {
  const { auth } = useAuth();
  const { data: items = [] } = useQuery({
    queryKey: ["slideshow-public", auth?.user_type ?? null, auth?.student?.id ?? auth?.teacher?.id ?? null],
    queryFn: api.slideshow.public,
    refetchInterval: 60_000,
  });

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  const { pinned, rotation } = useMemo(() => pickSlides(items, now), [items, now]);

  const [rotIndex, setRotIndex] = useState(0);
  useEffect(() => {
    setRotIndex(0);
  }, [rotation.length]);

  const current = pinned ?? rotation[rotIndex % Math.max(rotation.length, 1)] ?? null;

  const advance = () => setRotIndex((i) => (i + 1) % Math.max(rotation.length, 1));

  useEffect(() => {
    if (pinned || rotation.length === 0 || !current) return;
    const ms = slideDurationMs(current);
    if (ms === null) return; // video/PDF: the slide calls onAdvance itself
    const t = setTimeout(advance, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotIndex, current?.id, pinned, rotation.length]);

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-6">
        <Screensaver />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full w-full p-6">
      <SlideView key={current.id} item={current} onAdvance={advance} loop={!!pinned || rotation.length === 1} />
    </div>
  );
}
