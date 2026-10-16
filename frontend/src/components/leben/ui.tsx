"use client";
/** Kleine Bausteine für »Rock your Life« — dunkler Spiel-Look wie die Verkehrs-Sim. */
import type { ReactNode } from "react";

export { euro } from "@/lib/leben/kern";

export function Fenster({ titel, icon, onZu, children, breit = false, fuss }: {
  titel: string; icon?: string; onZu?: () => void; children: ReactNode; breit?: boolean; fuss?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4" role="dialog" aria-label={titel}
      onKeyDown={(e) => { if (e.key === "Escape" && onZu) onZu(); }}>
      <div className={`flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-2xl bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-white/10 ${breit ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          {icon && <span className="text-2xl" aria-hidden>{icon}</span>}
          <h2 className="flex-1 text-lg font-black">{titel}</h2>
          {onZu && (
            <button type="button" onClick={onZu} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Schließen">✕</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {fuss && <div className="border-t border-white/10 px-4 py-3">{fuss}</div>}
      </div>
    </div>
  );
}

export function Knopf({ children, onClick, art = "normal", disabled, title, klein, typ = "button" }: {
  children: ReactNode; onClick?: () => void; art?: "normal" | "haupt" | "gefahr" | "leise" | "gut";
  disabled?: boolean; title?: string; klein?: boolean; typ?: "button" | "submit";
}) {
  const farben = {
    normal: "bg-slate-700 hover:bg-slate-600 text-white",
    haupt: "bg-amber-500 hover:bg-amber-400 text-black",
    gefahr: "bg-rose-600 hover:bg-rose-500 text-white",
    gut: "bg-emerald-600 hover:bg-emerald-500 text-white",
    leise: "bg-transparent hover:bg-white/10 text-slate-300 ring-1 ring-white/15",
  }[art];
  return (
    <button type={typ} onClick={onClick} disabled={disabled} title={title}
      className={`${farben} ${klein ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"} rounded-xl font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40`}>
      {children}
    </button>
  );
}

export function Balken({ wert, farbe, label, icon }: { wert: number; farbe?: string; label: string; icon: string }) {
  const f = farbe ?? (wert > 60 ? "bg-emerald-500" : wert > 30 ? "bg-amber-400" : "bg-rose-500");
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${Math.round(wert)} / 100`}>
      <span className="w-5 text-center text-sm" aria-hidden>{icon}</span>
      <div className="h-2.5 w-16 overflow-hidden rounded-full bg-white/10 sm:w-20" role="meter" aria-label={label}
        aria-valuenow={Math.round(wert)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${f} transition-all`} style={{ width: `${Math.max(2, wert)}%` }} />
      </div>
    </div>
  );
}

export function Hinweis({ children, art = "info" }: { children: ReactNode; art?: "info" | "warnung" | "tipp" | "fehler" }) {
  const f = { info: "bg-sky-500/15 ring-sky-400/30", warnung: "bg-amber-500/15 ring-amber-400/30", tipp: "bg-emerald-500/15 ring-emerald-400/30", fehler: "bg-rose-500/15 ring-rose-400/30" }[art];
  const i = { info: "ℹ️", warnung: "⚠️", tipp: "💡", fehler: "⛔" }[art];
  return <div className={`my-2 flex gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${f}`}><span aria-hidden>{i}</span><div className="flex-1">{children}</div></div>;
}

export function Reiter<T extends string>({ reiter, aktiv, onWahl }: { reiter: { id: T; name: string }[]; aktiv: T; onWahl: (t: T) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1" role="tablist">
      {reiter.map((r) => (
        <button key={r.id} type="button" role="tab" aria-selected={aktiv === r.id} onClick={() => onWahl(r.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-bold ${aktiv === r.id ? "bg-amber-500 text-black" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>
          {r.name}
        </button>
      ))}
    </div>
  );
}

export function Zeile({ links, rechts, fett, klein }: { links: ReactNode; rechts: ReactNode; fett?: boolean; klein?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 border-b border-white/5 py-1 ${fett ? "font-black" : ""} ${klein ? "text-xs text-slate-400" : "text-sm"}`}>
      <span>{links}</span><span className="tabular-nums">{rechts}</span>
    </div>
  );
}

export function Feld({ label, children, hilfe }: { label: string; children: ReactNode; hilfe?: string }) {
  return (
    <label className="mb-2 block text-sm">
      <span className="mb-1 block font-bold text-slate-300">{label}</span>
      {children}
      {hilfe && <span className="mt-0.5 block text-xs text-slate-400">{hilfe}</span>}
    </label>
  );
}

export const eingabe = "w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white ring-1 ring-white/15 focus:outline-hidden focus:ring-amber-400";
