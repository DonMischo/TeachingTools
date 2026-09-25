"use client";
/**
 * LTB (Linus Torwa Biblebrox), der Pinguin-Begleiter: eine Sprechblase unten
 * links über der Minikarte. Eigene Zeichnung — kein Tux, nur ein Pinguin mit
 * Warnweste und Helm.
 */

export function LtbBild({ groesse = 72 }: { groesse?: number }) {
  // Tux von Larry Ewing (mit The GIMP), Lizenz: Nennung — dazu Warnweste und Helm, LTB ist im Verkehr unterwegs
  return (
    <div className="relative" style={{ width: groesse, height: groesse * 1.1 }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/verkehr/tux.svg" alt="" width={groesse} height={groesse * 1.1} className="h-full w-full object-contain" />
      <svg viewBox="0 0 216 256" className="absolute inset-0 h-full w-full">
        <path d="M58 150 Q108 128 158 150 L150 214 Q108 228 66 214 Z" fill="#d7ff1f" opacity="0.85" />
        <rect x="62" y="176" width="92" height="7" fill="#e5e7eb" />
        <path d="M58 52 Q108 -6 158 52 Z" fill="#ef4444" />
        <rect x="52" y="48" width="112" height="9" rx="4" fill="#dc2626" />
      </svg>
    </div>
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
