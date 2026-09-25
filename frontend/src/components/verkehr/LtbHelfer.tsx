"use client";
/**
 * LTB (Linus Torwa Biblebrox), der Pinguin-Begleiter: eine Sprechblase unten
 * links über der Minikarte. Eigene Zeichnung — kein Tux, nur ein Pinguin mit
 * Warnweste und Helm.
 */

export function LtbBild({ groesse = 72 }: { groesse?: number }) {
  return (
    <svg viewBox="0 0 100 110" width={groesse} height={groesse * 1.1} aria-hidden>
      {/* Füße */}
      <ellipse cx="36" cy="102" rx="12" ry="5" fill="#f59e0b" />
      <ellipse cx="64" cy="102" rx="12" ry="5" fill="#f59e0b" />
      {/* Körper */}
      <ellipse cx="50" cy="62" rx="34" ry="40" fill="#1f2937" />
      <ellipse cx="50" cy="68" rx="23" ry="30" fill="#f8fafc" />
      {/* Warnweste */}
      <path d="M27 58 Q50 50 73 58 L70 92 Q50 98 30 92 Z" fill="#d7ff1f" opacity="0.92" />
      <rect x="29" y="72" width="42" height="4" fill="#e5e7eb" />
      <rect x="47" y="56" width="6" height="38" fill="#e5e7eb" />
      {/* Flügel, einer winkt */}
      <ellipse cx="17" cy="66" rx="7" ry="18" fill="#111827" transform="rotate(12 17 66)" />
      <ellipse cx="86" cy="48" rx="7" ry="18" fill="#111827" transform="rotate(-40 86 48)" />
      {/* Kopf */}
      <circle cx="50" cy="30" r="22" fill="#1f2937" />
      <ellipse cx="50" cy="35" rx="15" ry="13" fill="#f8fafc" />
      <circle cx="43" cy="30" r="4" fill="#111827" /><circle cx="44.3" cy="28.7" r="1.3" fill="#fff" />
      <circle cx="57" cy="30" r="4" fill="#111827" /><circle cx="58.3" cy="28.7" r="1.3" fill="#fff" />
      <path d="M44 37 L56 37 L50 45 Z" fill="#f59e0b" />
      {/* Helm */}
      <path d="M28 22 Q50 -4 72 22 Z" fill="#ef4444" />
      <rect x="26" y="20" width="48" height="5" rx="2.5" fill="#dc2626" />
    </svg>
  );
}

export function LtbHelfer({ text, weiter, onZu }: { text: string; weiter?: () => void; onZu: () => void }) {
  return (
    <div className="absolute left-2 top-14 z-20 flex max-w-[min(360px,80%)] items-start gap-2" role="status" aria-live="polite">
      <div className="shrink-0 drop-shadow-xl animate-[ltbWackel_1.2s_ease-in-out_infinite]">
        <LtbBild groesse={60} />
      </div>
      <div className="relative mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold leading-snug text-slate-900 shadow-2xl ring-2 ring-sky-400">
        <div className="text-[10px] font-black uppercase tracking-wide text-sky-600">LTB sagt</div>
        {text}
        <div className="mt-1 flex justify-end gap-3 text-xs">
          {weiter && <button type="button" className="font-bold text-sky-700 underline" onClick={weiter}>Weiter ▸</button>}
          <button type="button" className="text-slate-500 underline" onClick={onZu}>OK</button>
        </div>
        <span className="absolute -left-2 top-5 h-4 w-4 rotate-45 bg-white" />
      </div>
      <style>{`@keyframes ltbWackel { 0%,100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }`}</style>
    </div>
  );
}
