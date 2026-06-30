"use client";
import React from "react";
import { useTheme } from "@/contexts/ThemeContext";

export type NavKey =
  | "home" | "caputh" | "sportundspiele" | "haeuser" | "klassen"
  | "schreibraum" | "barometer" | "auction" | "bingo" | "exit-ticket"
  | "admin" | "punkte" | "user" | "login";

/* ── Fantasy SVG icon set ───────────────────────────────────────────────── */
// home → Siegerpokal (Victory Trophy)
// caputh → D20 (icosahedron die)
// sportundspiele → Crossed Swords
// haeuser → Wappen (Heraldic Shield)
// klassen → Scroll
// schreibraum → Quill
// admin → Sorcerer's Hat
// punkte → Five-pointed star
// user/login → Cloaked figure / Portal

const FANTASY: Record<NavKey, React.ReactElement> = {

  // ── Victory Trophy (Siegerpokal) ──────────────────────────────────────
  home: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Bowl filled */}
      <path d="M5.5 2.5h9l-1.2 7A3.5 3.5 0 0110 12a3.5 3.5 0 01-3.3-2.5L5.5 2.5z"/>
      {/* Left handle */}
      <path d="M5.5 4C3.5 4.5 2.5 6 2.5 7.5S4 10 5.5 9.5"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      {/* Right handle */}
      <path d="M14.5 4C16.5 4.5 17.5 6 17.5 7.5S16 10 14.5 9.5"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      {/* Stem */}
      <rect x="9" y="12" width="2" height="3.5" rx=".8"/>
      {/* Base */}
      <rect x="5.5" y="15.5" width="9" height="2" rx="1"/>
      {/* Shine on bowl */}
      <path d="M8 4.5c-.4 1.2-.3 3 .5 4" stroke="var(--surface)" strokeWidth=".7"
        fill="none" strokeLinecap="round" opacity=".5"/>
    </svg>
  ),

  // ── D20 Die ───────────────────────────────────────────────────────────
  caputh: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Outer polygon (7-point silhouette of D20) */}
      <polygon points="10,1.5 16.5,5 18.5,11.5 15,17.5 5,17.5 1.5,11.5 3.5,5"
        fill="none" stroke="currentColor" strokeWidth="1.3"/>
      {/* Front triangular face (center) */}
      <polygon points="10,6 15,16 5,16"
        fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="1"/>
      {/* Radiating edge lines from triangle corners to outer shape */}
      <line x1="10" y1="1.5" x2="10" y2="6" stroke="currentColor" strokeWidth=".9"/>
      <line x1="16.5" y1="5" x2="15" y2="6" stroke="currentColor" strokeWidth=".9"/>
      <line x1="3.5" y1="5" x2="5" y2="6" stroke="currentColor" strokeWidth=".9"/>
      <line x1="18.5" y1="11.5" x2="15" y2="16" stroke="currentColor" strokeWidth=".9"/>
      <line x1="1.5" y1="11.5" x2="5" y2="16" stroke="currentColor" strokeWidth=".9"/>
      <line x1="15" y1="17.5" x2="15" y2="16" stroke="currentColor" strokeWidth=".9"/>
      <line x1="5" y1="17.5" x2="5" y2="16" stroke="currentColor" strokeWidth=".9"/>
      {/* Center mark */}
      <circle cx="10" cy="12" r="1.3" fill="currentColor" opacity=".7"/>
    </svg>
  ),

  // ── Crossed Swords (Sport und Spiele) ────────────────────────────────
  sportundspiele: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Blade 1: top-left → bottom-right */}
      <line x1="2.5" y1="2.5" x2="15" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      {/* Crossguard 1 (perpendicular near top-left) */}
      <line x1="3.5" y1="7.5" x2="7.5" y2="3.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
      {/* Pommel 1 */}
      <circle cx="2" cy="9" r="1.6" fill="currentColor"/>
      {/* Blade 2: top-right → bottom-left */}
      <line x1="17.5" y1="2.5" x2="5" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      {/* Crossguard 2 (perpendicular near top-right) */}
      <line x1="16.5" y1="7.5" x2="12.5" y2="3.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
      {/* Pommel 2 */}
      <circle cx="18" cy="9" r="1.6" fill="currentColor"/>
      {/* Tips (double-ended) */}
      <circle cx="16" cy="16" r="1.2" fill="currentColor" opacity=".7"/>
      <circle cx="4" cy="16" r="1.2" fill="currentColor" opacity=".7"/>
    </svg>
  ),

  // ── Heraldic Shield (Wappen / Häuser) ────────────────────────────────
  haeuser: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Shield silhouette */}
      <path d="M10 1.5L17 4.5V10C17 14.5 13 17.5 10 18.5C7 17.5 3 14.5 3 10V4.5L10 1.5z"
        fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="1.3"/>
      {/* Shield division (cross) */}
      <line x1="10" y1="3.5" x2="10" y2="16.5" stroke="currentColor" strokeWidth=".9" opacity=".65"/>
      <line x1="4" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth=".9" opacity=".65"/>
      {/* Chief band (top third fill) */}
      <path d="M3 4.5V8H17V4.5L10 1.5z" fill="currentColor" opacity=".3"/>
    </svg>
  ),

  // ── Scroll (Klassen) ─────────────────────────────────────────────────
  klassen: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Scroll body */}
      <rect x="4" y="4" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      {/* Top curl */}
      <path d="M4 5C4 3.3 6 3 6 5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M16 5C16 3.3 14 3 14 5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      {/* Bottom curl */}
      <path d="M4 15C4 16.7 6 17 6 15" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M16 15C16 16.7 14 17 14 15" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      {/* Text lines on scroll */}
      <line x1="7" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth=".9" opacity=".7"/>
      <line x1="7" y1="10.5" x2="13" y2="10.5" stroke="currentColor" strokeWidth=".9" opacity=".7"/>
      <line x1="7" y1="13" x2="11" y2="13" stroke="currentColor" strokeWidth=".9" opacity=".7"/>
    </svg>
  ),

  // ── Quill Pen (Schreibraum) ───────────────────────────────────────────
  schreibraum: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Feather spine: top-right to bottom-left */}
      <path d="M17 2C13 5 8 10 5.5 15" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      {/* Right vane */}
      <path d="M17 2C19 6 18 10 15 13" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round"/>
      {/* Left vane */}
      <path d="M17 2C15 6 10 9 8 12" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round"/>
      {/* Cross-barbs (vane texture) */}
      <line x1="14.5" y1="5" x2="12" y2="7.5" stroke="currentColor" strokeWidth=".7" opacity=".55"/>
      <line x1="12" y1="8" x2="9.5" y2="10" stroke="currentColor" strokeWidth=".7" opacity=".55"/>
      <line x1="9.5" y1="10.5" x2="7.5" y2="12.5" stroke="currentColor" strokeWidth=".7" opacity=".55"/>
      {/* Nib tip */}
      <path d="M5.5 15L4 17.5L7 16.5z" fill="currentColor"/>
      {/* Ink scratch below nib */}
      <path d="M4 17L8 15.5" stroke="currentColor" strokeWidth=".7" fill="none" strokeLinecap="round" opacity=".5"/>
    </svg>
  ),

  // ── Sorcerer's / Wizard's Hat (Admin) ────────────────────────────────
  admin: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Hat cone */}
      <path d="M10 1.5L15.5 14H4.5L10 1.5z" fill="currentColor" fillOpacity=".85"/>
      {/* Brim ellipse */}
      <ellipse cx="10" cy="14.5" rx="7" ry="2.5" fill="currentColor"/>
      {/* Band on hat */}
      <path d="M6 11.5h8" stroke="var(--surface)" strokeWidth="1.2" fill="none" opacity=".5"/>
      {/* Stars on hat */}
      <path d="M9 5l.5 1 1 .1-.8.7.2 1-.9-.5-.9.5.2-1-.8-.7 1-.1z"
        fill="var(--surface)" fillOpacity=".7" transform="scale(.75) translate(3,2)"/>
      <circle cx="12.5" cy="7" r=".8" fill="var(--surface)" opacity=".6"/>
      <circle cx="8" cy="9" r=".5" fill="var(--surface)" opacity=".5"/>
    </svg>
  ),

  // ── Five-pointed Star (Punkte vergeben) ──────────────────────────────
  punkte: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      <path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L10 14.3l-4.8 2.5.9-5.3L2.2 7.7l5.4-.8L10 2z"/>
    </svg>
  ),

  // ── Cloaked Figure (User) ────────────────────────────────────────────
  user: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Head with hood */}
      <circle cx="10" cy="6.5" r="3.5"/>
      {/* Hood/cloak arc */}
      <path d="M4 6C4 4 6 2 10 2s6 2 6 4" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      {/* Cloak body */}
      <path d="M3 19c0-4 3.1-7 7-7s7 3 7 7H3z"/>
      {/* Cloak edge detail */}
      <path d="M3 19l3-7M17 19l-3-7" stroke="var(--surface)" strokeWidth=".7" fill="none" opacity=".3"/>
    </svg>
  ),

  // ── Barometer (scale bars) ────────────────────────────────────────────
  barometer: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      <rect x="2" y="13" width="3" height="5" rx=".8"/>
      <rect x="6.5" y="9" width="3" height="9" rx=".8"/>
      <rect x="11" y="5" width="3" height="13" rx=".8"/>
      <rect x="15.5" y="11" width="3" height="7" rx=".8"/>
      <line x1="1" y1="2.5" x2="19" y2="2.5" stroke="currentColor" strokeWidth="1" opacity=".4" strokeLinecap="round"/>
    </svg>
  ),

  // ── Hammer + Gavel (Auction / Punkte-Auktion) ───────────────────────
  auction: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Gavel head */}
      <rect x="10" y="2" width="7" height="4" rx="1" transform="rotate(45 13.5 4)"/>
      {/* Handle */}
      <line x1="12" y1="8" x2="3" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      {/* Block */}
      <rect x="2" y="16" width="9" height="2.5" rx="1"/>
    </svg>
  ),

  // ── Bingo Grid ────────────────────────────────────────────────────────
  bingo: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* 3×3 grid */}
      <rect x="2" y="2" width="5" height="5" rx=".8" opacity=".85"/>
      <rect x="7.5" y="2" width="5" height="5" rx=".8" opacity=".6"/>
      <rect x="13" y="2" width="5" height="5" rx=".8" opacity=".85"/>
      <rect x="2" y="7.5" width="5" height="5" rx=".8" opacity=".6"/>
      <rect x="7.5" y="7.5" width="5" height="5" rx=".8"/>
      <rect x="13" y="7.5" width="5" height="5" rx=".8" opacity=".6"/>
      <rect x="2" y="13" width="5" height="5" rx=".8" opacity=".85"/>
      <rect x="7.5" y="13" width="5" height="5" rx=".8" opacity=".6"/>
      <rect x="13" y="13" width="5" height="5" rx=".8" opacity=".85"/>
      {/* checkmark on center */}
      <path d="M9.5 10.5l1 1 2-2" stroke="var(--surface)" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),

  // ── Exit Ticket (Ticket stub) ─────────────────────────────────────────
  "exit-ticket": (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Ticket body */}
      <rect x="1.5" y="5" width="17" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3"/>
      {/* Perforation cut */}
      <line x1="7" y1="5" x2="7" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5"/>
      {/* Checkmark */}
      <path d="M9.5 9.5l1.5 1.5 2.5-2.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),

  // ── Gate / Portal (Login) ─────────────────────────────────────────────
  login: (
    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
      {/* Gate frame */}
      <rect x="2.5" y="3" width="15" height="15" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      {/* Arch inside */}
      <path d="M7 18V11a3 3 0 016 0v7" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      {/* Arch keystone */}
      <path d="M7 11A3 3 0 0113 11" fill="none" stroke="currentColor" strokeWidth="1.4"/>
      {/* Keystone diamond */}
      <polygon points="10,7 11.5,9 10,11 8.5,9" fill="currentColor" opacity=".8"/>
      {/* Door handle */}
      <circle cx="12" cy="14.5" r=".8" fill="currentColor"/>
    </svg>
  ),
};

/* ── Cyberpunk SVG icons (angular, circuit feel) ────────────────────────── */
const CYBER: Record<NavKey, React.ReactElement> = {
  home: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <path d="M10 2L2 8v1h2v9h4v-5h4v5h4V9h2V8L10 2zm0 2.5l5 3.7V17h-2v-5H7v5H5V8.2L10 4.5z"/>
    <path d="M8 10h4v2H8z" opacity=".5"/>
  </svg>,
  caputh: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <rect x="2" y="6" width="16" height="10" rx="2"/>
    <rect x="4" y="8" width="4" height="4" rx="1" opacity=".6"/>
    <circle cx="14" cy="9" r="1.2"/><circle cx="16" cy="11" r="1.2"/>
    <circle cx="14" cy="13" r="1.2"/><circle cx="12" cy="11" r="1.2"/>
    <rect x="8" y="3" width="4" height="3" rx="1"/>
  </svg>,
  sportundspiele: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <line x1="3" y1="3" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="17" y1="3" x2="3" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="4" y1="7" x2="7" y2="4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="16" y1="7" x2="13" y2="4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <circle cx="3" cy="8.5" r="1.3"/><circle cx="17" cy="8.5" r="1.3"/>
  </svg>,
  haeuser: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <rect x="2" y="8" width="7" height="10"/><rect x="11" y="5" width="7" height="13"/>
    <path d="M2 8L5.5 4 9 8"/><path d="M11 5L14.5 1 18 5"/>
    <rect x="4" y="11" width="2" height="3" opacity=".6"/>
    <rect x="13" y="8" width="2" height="3" opacity=".6"/>
  </svg>,
  klassen: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <path d="M10 3L2 7l8 4 8-4-8-4z"/>
    <path d="M5 9.5v4c0 1.5 2 2.5 5 2.5s5-1 5-2.5v-4l-5 2.5-5-2.5z"/>
    <rect x="17" y="7" width="1.5" height="7" rx=".75"/>
  </svg>,
  schreibraum: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <rect x="2" y="3" width="16" height="12" rx="1"/>
    <path d="M5 7h10M5 10h7" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".5"/>
    <path d="M14 13l4 4M16 15l2-2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
  </svg>,
  admin: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4z" opacity=".4"/>
    <path d="M10 7a3 3 0 100 6 3 3 0 000-6zm0 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/>
    <path d="M10 4v2M10 14v2M4 10h2M14 10h2M5.8 5.8l1.4 1.4M12.8 12.8l1.4 1.4M14.2 5.8l-1.4 1.4M7.2 12.8l-1.4 1.4"
      stroke="currentColor" strokeWidth="1" fill="none"/>
  </svg>,
  punkte: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <polygon points="10,2 12.5,7.5 18,8 14,12 15,18 10,15 5,18 6,12 2,8 7.5,7.5"/>
  </svg>,
  user: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <path d="M10 2a4 4 0 100 8 4 4 0 000-8z" opacity=".8"/>
    <path d="M3 18c0-3.9 3.1-7 7-7s7 3.1 7 7H3z"/>
    <rect x="2" y="2" width="2" height="2" opacity=".3"/>
    <rect x="16" y="16" width="2" height="2" opacity=".3"/>
  </svg>,
  login: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <rect x="2" y="3" width="10" height="14" rx="1" opacity=".4"/>
    <path d="M13 7l5 3-5 3v-2H8v-2h5V7z"/>
    <rect x="2" y="2" width="2" height="2" opacity=".3"/>
  </svg>,
  barometer: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <rect x="2" y="13" width="3" height="5" rx=".5"/>
    <rect x="6.5" y="9" width="3" height="9" rx=".5"/>
    <rect x="11" y="5" width="3" height="13" rx=".5"/>
    <rect x="15.5" y="11" width="3" height="7" rx=".5"/>
    <line x1="1" y1="3" x2="19" y2="3" stroke="currentColor" strokeWidth="1.2" opacity=".5" strokeLinecap="round"/>
  </svg>,
  auction: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <rect x="10" y="2" width="7" height="4" rx="1" transform="rotate(45 13.5 4)"/>
    <line x1="12" y1="8" x2="3" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <rect x="2" y="16" width="9" height="2.5" rx="1"/>
  </svg>,
  bingo: <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <rect x="2" y="2" width="5" height="5" rx=".8" opacity=".85"/>
    <rect x="7.5" y="2" width="5" height="5" rx=".8" opacity=".5"/>
    <rect x="13" y="2" width="5" height="5" rx=".8" opacity=".85"/>
    <rect x="2" y="7.5" width="5" height="5" rx=".8" opacity=".5"/>
    <rect x="7.5" y="7.5" width="5" height="5" rx=".8"/>
    <rect x="13" y="7.5" width="5" height="5" rx=".8" opacity=".5"/>
    <rect x="2" y="13" width="5" height="5" rx=".8" opacity=".85"/>
    <rect x="7.5" y="13" width="5" height="5" rx=".8" opacity=".5"/>
    <rect x="13" y="13" width="5" height="5" rx=".8" opacity=".85"/>
  </svg>,
  "exit-ticket": <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
    <rect x="1.5" y="5" width="17" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3"/>
    <line x1="7" y1="5" x2="7" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5"/>
    <path d="M9.5 9.5l1.5 1.5 2.5-2.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
};

/* ── Emoji fallback set ─────────────────────────────────────────────────── */
const EMOJI: Record<NavKey, string> = {
  home:           "🏆",
  caputh:         "🎲",
  sportundspiele: "⚔️",
  haeuser:        "🛡️",
  klassen:        "🎓",
  schreibraum:    "🪶",
  barometer:      "📊",
  auction:        "🏷",
  bingo:          "🎰",
  "exit-ticket":  "🎫",
  admin:          "🧙",
  punkte:         "⭐",
  user:           "👤",
  login:          "🔑",
};

export function NavIcon({ name }: { name: NavKey }) {
  const { iconTheme, style } = useTheme();

  // Custom SVG from style pack overrides everything
  if (style.icons.includes(name)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/uploads/style-pack/icons/${name}.svg`}
        alt={name}
        width={18} height={18}
        style={{ display: "block" }}
      />
    );
  }

  if (iconTheme === "cyberpunk") return CYBER[name];
  if (iconTheme === "fantasy")   return FANTASY[name];
  return <span style={{ fontSize: 18, lineHeight: 1 }}>{EMOJI[name]}</span>;
}
