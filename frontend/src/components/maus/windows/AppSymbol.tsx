"use client";
/**
 * Eigene App-Symbole für das nachgebaute Windows.
 *
 * Keine echten Logos (Marken, kaum frei lizenziert): jede App bekommt Farbe
 * und Form, die an ihren Zweck erinnern — Globus für Browser, Blatt für
 * Textprogramme, Palette für Paint. Der Name steht immer dabei.
 */
import type { ReactNode } from "react";
import { APPS, type AppId } from "@/lib/maus/windows";

const SCHRIFT = '"Segoe UI", system-ui, sans-serif';

function Kachel({ farbe, children }: { farbe: string; children?: ReactNode }) {
  return (
    <>
      <rect x="4" y="4" width="40" height="40" rx="9" fill={farbe} />
      {children}
    </>
  );
}

function Buchstabe({ zeichen, groesse = 20 }: { zeichen: string; groesse?: number }) {
  return (
    <text x="24" y="24" dy="0.36em" textAnchor="middle" fontSize={groesse} fontWeight={800} fill="#fff" fontFamily={SCHRIFT}>
      {zeichen}
    </text>
  );
}

/** Weißes Blatt mit farbigem Eselsohr und farbigem Feld — die freien Office-Programme. */
function Blatt({ farbe, children }: { farbe: string; children?: ReactNode }) {
  return (
    <>
      <path d="M12 5h17l9 9v29H12z" fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M29 5v9h9z" fill={farbe} />
      <rect x="15" y="21" width="20" height="17" rx="2" fill={farbe} />
      {children}
    </>
  );
}

function Globus({ farbe }: { farbe: string }) {
  return (
    <g fill="none" stroke={farbe} strokeWidth="2">
      <circle cx="24" cy="24" r="9" />
      <path d="M15 24h18M24 15c-4 5-4 13 0 18M24 15c4 5 4 13 0 18" />
    </g>
  );
}

const SYMBOLE: Record<AppId, ReactNode> = {
  papierkorb: (
    <>
      <path d="M14 16h20l-2.5 25h-15z" fill="#e2ecf7" stroke="#6b85a6" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11 13h26" stroke="#6b85a6" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 21l.6 15M24 21v15M28 21l-.6 15" stroke="#9fb3cc" strokeWidth="1.6" />
    </>
  ),
  dieserpc: (
    <>
      <rect x="6" y="9" width="36" height="24" rx="3" fill="#1e3a8a" />
      <rect x="9" y="12" width="30" height="18" rx="1.5" fill="#60a5fa" />
      <path d="M24 33v5M17 39h14" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  explorer: (
    <>
      <path d="M5 13a3 3 0 0 1 3-3h10l4 4h18a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#e0a800" />
      <path d="M5 19h38v18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#f7d774" />
    </>
  ),
  einstellungen: (
    <>
      <circle cx="24" cy="24" r="14" fill="none" stroke="#6b7280" strokeWidth="7" strokeDasharray="5.5 3.6" />
      <circle cx="24" cy="24" r="10" fill="#9ca3af" />
      <circle cx="24" cy="24" r="4" fill="#f3f4f6" />
    </>
  ),
  edge: (
    <>
      <circle cx="24" cy="24" r="19" fill="#0c8ce9" />
      <path d="M9 27c3-11 18-15 26-8 4 3 3 9-3 9H19c1 6 10 9 18 5-7 8-24 7-28-6z" fill="#3ccf91" />
    </>
  ),
  firefox: (
    <>
      <circle cx="24" cy="24" r="19" fill="#7542e5" />
      <path d="M24 6a18 18 0 1 0 18 18c0-4-1-7-3-9 1 6-4 11-10 11a9 9 0 0 1-9-9c0-6 5-8 7-11z" fill="#ff7139" />
      <circle cx="26" cy="25" r="6" fill="#ffd567" />
    </>
  ),
  chrome: (
    <Kachel farbe="#f8fafc">
      <rect x="4" y="4" width="40" height="40" rx="9" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
      <circle cx="17" cy="17" r="6" fill="#ea4335" />
      <circle cx="31" cy="17" r="6" fill="#fbbc05" />
      <circle cx="17" cy="31" r="6" fill="#34a853" />
      <circle cx="31" cy="31" r="6" fill="#4285f4" />
    </Kachel>
  ),
  brave: (
    <>
      <path d="M24 4l16 6-2 21c-1 6-7 11-14 13-7-2-13-7-14-13L8 10z" fill="#fb542b" />
      <path d="M17 19l7-5 7 5-2 10-5 4-5-4z" fill="#fff" />
    </>
  ),
  word: <Kachel farbe="#185abd"><Buchstabe zeichen="W" /></Kachel>,
  writer: (
    <Blatt farbe="#2a6fc9">
      <path d="M18 26h14M18 30h14M18 34h9" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </Blatt>
  ),
  excel: <Kachel farbe="#107c41"><Buchstabe zeichen="X" /></Kachel>,
  calc: (
    <Blatt farbe="#1e9e4a">
      <path d="M15 27h20M15 32h20M22 21v17M28 21v17" stroke="#fff" strokeWidth="1.6" />
    </Blatt>
  ),
  powerpoint: <Kachel farbe="#c43e1c"><Buchstabe zeichen="P" /></Kachel>,
  impress: (
    <Blatt farbe="#d0652d">
      <rect x="18" y="24" width="14" height="10" rx="1" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M25 34v3" stroke="#fff" strokeWidth="2" />
    </Blatt>
  ),
  reader: (
    <Kachel farbe="#d7282a">
      <path d="M15 10h13l6 6v22H15z" fill="#fff" />
      <text x="24" y="31" textAnchor="middle" fontSize="8" fontWeight={800} fill="#d7282a" fontFamily={SCHRIFT}>PDF</text>
    </Kachel>
  ),
  irfanview: (
    <Kachel farbe="#c62828">
      <rect x="11" y="13" width="26" height="22" rx="2" fill="#fff" />
      <path d="M13 33l8-9 5 5 3-3 6 7z" fill="#c62828" />
      <circle cx="31" cy="19" r="2.8" fill="#fbbf24" />
    </Kachel>
  ),
  inkscape: (
    <Kachel farbe="#222222">
      <path d="M12 33c6-19 18 1 24-17" fill="none" stroke="#fff" strokeWidth="3" />
      <rect x="9.5" y="30.5" width="5" height="5" fill="#fff" />
      <rect x="33.5" y="13.5" width="5" height="5" fill="#fff" />
      <path d="M12 33l6-12M36 16l-8 3" stroke="#9ca3af" strokeWidth="1.2" />
    </Kachel>
  ),
  paint: (
    <>
      <path d="M24 6C13 6 5 14 5 24c0 10 8 18 17 18 3 0 5-2 5-4s-2-3-2-6 3-5 6-5h5c5 0 9-4 9-10C45 12 36 6 24 6z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="15" cy="22" r="3.5" fill="#ef4444" />
      <circle cx="21" cy="14" r="3.5" fill="#3b82f6" />
      <circle cx="31" cy="13" r="3.5" fill="#f59e0b" />
      <circle cx="38" cy="20" r="3.5" fill="#22c55e" />
    </>
  ),
  gimp: (
    <Kachel farbe="#7a6a53">
      <path d="M29 9l10 10-14 14-10-10z" fill="#fde68a" />
      <path d="M15 23l10 10c-2 6-8 8-14 7 1-6 0-13 4-17z" fill="#f97316" />
    </Kachel>
  ),
  vlc: (
    <Kachel farbe="#ff8800">
      <path d="M19 14l15 10-15 10z" fill="#fff" />
    </Kachel>
  ),
  editor: (
    <>
      <rect x="10" y="8" width="28" height="34" rx="3" fill="#fff" stroke="#60a5fa" strokeWidth="2" />
      <path d="M15 18h18M15 24h18M15 30h11" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 5v6M21 5v6M27 5v6M33 5v6" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  rechner: (
    <Kachel farbe="#374151">
      <rect x="12" y="10" width="24" height="8" rx="1.5" fill="#a7f3d0" />
      {[0, 1, 2].flatMap(z => [0, 1, 2].map(s => (
        <rect key={`${z}-${s}`} x={12 + s * 8.5} y={21 + z * 6.5} width="6.5" height="5" rx="1" fill={s === 2 && z === 2 ? "#f97316" : "#d1d5db"} />
      )))}
    </Kachel>
  ),
  audacity: (
    <Kachel farbe="#1d4ed8">
      <path d="M9 24h5l3-9 4 18 4-13 3 8 3-4h8" fill="none" stroke="#fdba74" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </Kachel>
  ),
  zip: (
    <Kachel farbe="#475569">
      <rect x="12" y="12" width="24" height="24" rx="3" fill="#fcd34d" />
      <path d="M24 12v24" stroke="#78350f" strokeWidth="3" strokeDasharray="2.5 2" />
    </Kachel>
  ),
  thunderbird: (
    <Kachel farbe="#0a84ff">
      <rect x="10" y="15" width="28" height="19" rx="2" fill="#fff" />
      <path d="M10 16l14 10 14-10" fill="none" stroke="#0a84ff" strokeWidth="2" />
    </Kachel>
  ),
  geogebra: (
    <>
      <ellipse cx="24" cy="24" rx="17" ry="12" fill="none" stroke="#555" strokeWidth="2.5" transform="rotate(-12 24 24)" />
      {[[8, 26], [18, 12], [37, 16], [36, 31], [16, 36]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="#99f" stroke="#333" strokeWidth="1.2" />
      ))}
    </>
  ),
  scratch: (
    <Kachel farbe="#f9a825">
      <path d="M11 17h8a3 3 0 0 0 6 0h12v15H11z" fill="#fff" />
      <path d="M11 32h26" stroke="#e08e00" strokeWidth="1.5" />
    </Kachel>
  ),
  snipping: (
    <Kachel farbe="#8b5cf6">
      <circle cx="17" cy="32" r="4.5" fill="none" stroke="#fff" strokeWidth="2.5" />
      <circle cx="31" cy="32" r="4.5" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M20 28l12-17M28 28L16 11" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </Kachel>
  ),
};

export function AppSymbol({ id, groesse = 32, titel = true }: { id: AppId; groesse?: number | string; titel?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={groesse}
      height={groesse}
      role="img"
      aria-label={APPS[id].name}
      data-app={id}
    >
      {titel && <title>{APPS[id].name}</title>}
      {SYMBOLE[id]}
      {/* Browser bekommen zusätzlich einen kleinen Globus — daran erkennt man die Gruppe. */}
      {APPS[id].art === "browser" && id === "chrome" && <Globus farbe="#ffffff" />}
    </svg>
  );
}
