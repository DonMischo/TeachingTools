"use client";
/**
 * Laufende Sitzungen als Karten, zwei nebeneinander.
 *
 * Jedes Werkzeug bringt seine eigenen Sitzungsdaten mit (Caputh zaehlt
 * Teilnehmer, der Zeitstrahl nennt die geteilte Zeitleiste), deshalb nimmt das
 * Raster nur eine schmale, gemeinsame Form entgegen und laesst die Knoepfe die
 * Aufrufer bauen. So sehen die Uebersichten gleich aus, ohne dass die
 * Komponente die Werkzeuge kennen muss.
 */
import React from "react";

export type SessionTone = "live" | "waiting" | "done" | "closed";

export type SessionCardItem = {
  /** Beitritts-Code — zugleich der React-Key. */
  code: string;
  /** Erste Zeile: Klasse, geteilter Inhalt oder Besitzer. */
  title: string;
  status?: { label: string; tone: SessionTone } | null;
  /** Kurze Fakten, z.B. "12 Teiln." oder "30 Pkt." */
  meta?: string[];
};

const TONE: Record<SessionTone, string> = {
  live: "text-yellow-400",
  waiting: "text-blue-400",
  done: "text-(--text-muted)",
  closed: "text-red-400/80",
};

export function SessionGrid({
  items, empty = "Noch keine Sitzungen.", renderActions,
}: {
  items: SessionCardItem[];
  empty?: string;
  renderActions?: (item: SessionCardItem) => React.ReactNode;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-(--text-muted)">{empty}</p>;
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((s) => (
        <li
          key={s.code}
          className="flex flex-col gap-1.5 rounded-lg border border-(--border) bg-(--bg) px-3 py-2"
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{s.title}</span>
            {s.status && (
              <span className={`text-xs font-semibold ${TONE[s.status.tone]}`}>{s.status.label}</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs text-(--text-muted)">
            <span className="font-mono tracking-wider">{s.code}</span>
            {s.meta?.map((m) => <span key={m}>{m}</span>)}
          </div>

          {renderActions && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">{renderActions(s)}</div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Einheitlicher kleiner Knopf für die Kartenaktionen. */
export function SessionAction({
  onClick, href, download, danger, disabled, title, children,
}: {
  onClick?: () => void;
  href?: string;
  download?: boolean;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  const cls = `px-2 py-0.5 rounded border text-xs transition-colors disabled:opacity-40 ${
    danger
      ? "border-red-400/30 text-red-400/70 hover:text-red-400 hover:bg-red-400/10"
      : "border-(--border) text-(--text-muted) hover:border-(--text-muted)"
  }`;
  if (href) {
    return <a href={href} download={download} title={title} className={cls}>{children}</a>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls}>
      {children}
    </button>
  );
}
