"use client";
/** Eine Kennzahl unter der Übung — große Zahl, kleine Beschriftung. */
export function Wert({ label, wert, farbe }: { label: string; wert: string; farbe?: string }) {
  return (
    <div className="flex flex-col items-center px-3">
      <span className="text-xl sm:text-2xl font-black tabular-nums" style={{ color: farbe }}>{wert}</span>
      <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

/** Der Hinweis, der über einem unfokussierten Tippfeld liegt. */
export function Klickhinweis() {
  return (
    <div className="absolute inset-0 rounded-2xl bg-[var(--surface)]/80 flex items-center justify-center text-sm">
      Zum Tippen hier klicken
    </div>
  );
}
