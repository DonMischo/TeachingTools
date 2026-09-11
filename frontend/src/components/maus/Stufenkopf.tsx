"use client";
/** Kopf jeder Stufe: Auftrag, Punkte, »Vorführen« und »Weiter«. */
import type { ReactNode } from "react";

export function Stufenkopf({
  titel,
  auftrag,
  punkte,
  onDemo,
  onWeiter,
  weiterText = "Weiter →",
  hervor = false,
  children,
}: {
  titel: string;
  auftrag: ReactNode;
  punkte?: number;
  onDemo?: () => void;
  onWeiter: () => void;
  weiterText?: string;
  /** Die Stufe ist geschafft: »Weiter« wird zum Hauptknopf. */
  hervor?: boolean;
  /** Das Ziel groß neben dem Auftrag, z. B. das gesuchte Tier. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-black">{titel}</h2>
        <div className="flex-1" />
        {punkte !== undefined && (
          <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1 text-sm font-black tabular-nums" data-testid="punkte">
            ⭐ {punkte}
          </span>
        )}
        {onDemo && (
          <button
            onClick={onDemo}
            className="text-sm rounded-lg px-3 py-1.5 border border-[var(--border)] hover:border-[var(--accent)]"
          >
            ▶ Vorführen
          </button>
        )}
        <button
          onClick={onWeiter}
          className={
            "text-sm rounded-lg px-3 py-1.5 border font-bold " +
            (hervor
              ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--bg)]"
              : "border-[var(--border)] hover:border-[var(--accent)]")
          }
        >
          {weiterText}
        </button>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        {children}
        <div className="text-base leading-snug">{auftrag}</div>
      </div>
    </div>
  );
}
