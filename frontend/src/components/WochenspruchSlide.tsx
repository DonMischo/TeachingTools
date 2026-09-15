"use client";

import { useState } from "react";
import type { SlideshowWochenspruch } from "@/lib/slideshow";

// Poster-style slide for the week's Wochenspruch (data: kirchenjahr-evangelisch.de
// via wochenspruch.pfarr.tools). Deliberately theme-independent: light text on the
// week's background image, tinted with the liturgical color. Sizes use container
// units (cqmin) so the layout scales with the slide area, not the window.

const SERIF = `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`;

/** Liturgical black (Karfreitag) would vanish on the dark overlay — lift very dark accents. */
function readableAccent(hex: string | null): string {
  const m = hex?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "#d6c7a1";
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.12 ? "#9ca3af" : hex!;
}

function quoteSize(text: string): string {
  if (text.length <= 70) return "8.4cqmin";
  if (text.length <= 130) return "6.4cqmin";
  if (text.length <= 200) return "4.9cqmin";
  return "4.1cqmin";
}

export function WochenspruchSlide({ ws }: { ws: SlideshowWochenspruch }) {
  const [imageFailed, setImageFailed] = useState(false);
  const accent = readableAccent(ws.color);
  const showImage = !!ws.background_url && !imageFailed;

  return (
    <div
      className="ws-slide relative w-full h-full overflow-hidden rounded-2xl text-white shadow-2xl"
      style={{ containerType: "size", backgroundColor: "#15171c" }}
    >
      <style>{`
        @keyframes ws-drift { from { transform: scale(1.04) translate(0, 0); } to { transform: scale(1.14) translate(-1.5%, -1%); } }
        @keyframes ws-rise { from { opacity: 0; transform: translateY(2.5cqmin); } to { opacity: 1; transform: none; } }
        .ws-slide .ws-bg { animation: ws-drift 40s ease-out forwards; }
        .ws-slide .ws-rise { opacity: 0; animation: ws-rise 1.1s cubic-bezier(.2,.7,.2,1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .ws-slide .ws-bg, .ws-slide .ws-rise { animation: none; opacity: 1; }
        }
      `}</style>

      {showImage && (
        <img
          src={ws.background_url!}
          alt=""
          onError={() => setImageFailed(true)}
          className="ws-bg absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Legibility: dark wash from the text side, a hint of the liturgical color on the far side */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(105deg, rgba(12,13,17,.92) 0%, rgba(12,13,17,.78) 48%, ${accent}40 100%)`,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: "linear-gradient(to top, rgba(0,0,0,.55), transparent)" }} />
      <div className="absolute left-0 top-0 bottom-0" style={{ width: "0.9cqmin", background: accent }} />

      <div className="relative h-full flex flex-col" style={{ padding: "6cqmin 7cqmin 5cqmin 8cqmin", gap: "3cqmin" }}>
        {/* Header */}
        <header className="ws-rise flex flex-wrap items-start justify-between" style={{ gap: "2cqmin" }}>
          <div className="flex items-center uppercase font-semibold" style={{ gap: "1.4cqmin", fontSize: "2.1cqmin", letterSpacing: "0.32em" }}>
            <span className="rounded-full" style={{ width: "1.5cqmin", height: "1.5cqmin", background: accent }} title={ws.color_name ?? undefined} />
            Wochenspruch
          </div>
          <div className="text-right">
            <div className="font-semibold" style={{ fontFamily: SERIF, fontSize: "3.2cqmin", lineHeight: 1.15 }}>{ws.sunday}</div>
            <div className="text-white/70" style={{ fontSize: "1.9cqmin", marginTop: "0.6cqmin" }}>
              {[ws.season, ws.date_label && `ab ${ws.date_label}`].filter(Boolean).join(" · ")}
            </div>
          </div>
        </header>

        {/* Verse */}
        <main className="flex-1 min-h-0 flex flex-col justify-center" style={{ maxWidth: "88%" }}>
          <div className="relative ws-rise" style={{ animationDelay: "150ms" }}>
            <span
              aria-hidden
              className="absolute select-none leading-none"
              style={{ fontFamily: SERIF, color: accent, opacity: 0.6, fontSize: "24cqmin", left: "-5cqmin", top: "-9.5cqmin" }}
            >
              “
            </span>
            <blockquote
              className="relative"
              style={{ fontFamily: SERIF, fontSize: quoteSize(ws.text), lineHeight: 1.22, textWrap: "balance" as any, textShadow: "0 0.3cqmin 2cqmin rgba(0,0,0,.35)" }}
            >
              {ws.text}
            </blockquote>
          </div>
          {ws.reference && (
            <div className="ws-rise flex items-center uppercase" style={{ animationDelay: "350ms", gap: "1.8cqmin", marginTop: "3.4cqmin", fontSize: "2.4cqmin", letterSpacing: "0.18em" }}>
              <span style={{ width: "6cqmin", height: "0.35cqmin", background: accent }} />
              <span className="font-semibold">{ws.reference}</span>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="ws-rise flex flex-wrap items-end justify-between" style={{ animationDelay: "550ms", gap: "2cqmin" }}>
          <div className="flex flex-wrap" style={{ gap: "1.2cqmin" }}>
            {ws.hymns.map((hymn) => {
              const [number, ...rest] = hymn.split(": ");
              return (
                <span key={hymn} className="rounded-full bg-white/10 border border-white/15 backdrop-blur-sm"
                  style={{ padding: "0.8cqmin 2cqmin", fontSize: "1.9cqmin" }}>
                  <span style={{ color: accent }}>♪</span> <span className="font-semibold">{number}</span>
                  {rest.length > 0 && <span className="text-white/80"> · {rest.join(": ")}</span>}
                </span>
              );
            })}
            {ws.psalm && (
              <span className="rounded-full bg-white/10 border border-white/15 backdrop-blur-sm" style={{ padding: "0.8cqmin 2cqmin", fontSize: "1.9cqmin" }}>
                <span className="text-white/70">Wochenpsalm</span> <span className="font-semibold">{ws.psalm}</span>
              </span>
            )}
          </div>
          <div className="text-right text-white/50" style={{ fontSize: "1.45cqmin" }}>
            {showImage && ws.image_credit && <div>Bild: {ws.image_credit}</div>}
            <div>kirchenjahr-evangelisch.de</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
