"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { FEATURE_HELP } from "@/lib/featureHelp";

/**
 * Kleines (?)-Symbol, das eine Kurzhilfe zum jeweiligen Feature öffnet.
 * Wird i.d.R. in der oberen Ecke einer Feature-Karte platziert. Da die Karten
 * selbst <Link> sind, unterbindet der Button die Navigation (stopPropagation).
 */
export default function HelpButton({ slug, className = "" }: { slug: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const help = FEATURE_HELP[slug];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!help) return null;

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <>
      <button
        type="button"
        aria-label={`Hilfe zu ${help.title}`}
        title={`Hilfe zu ${help.title}`}
        onClick={(e) => { stop(e); setOpen(true); }}
        className={`text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors ${className}`}
      >
        <HelpCircle size={18} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
          onClick={(e) => { stop(e); setOpen(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Hilfe zu ${help.title}`}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-left"
            onClick={stop}
          >
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)] shrink-0">
              <HelpCircle size={18} className="text-[var(--accent)]" />
              <span className="font-black text-base flex-1">{help.title}</span>
              <button
                type="button"
                onClick={(e) => { stop(e); setOpen(false); }}
                className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none px-1"
                aria-label="Schließen"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex flex-col gap-3">
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{help.intro}</p>
              <div className="flex flex-col gap-3">
                {help.sections.map((s) => (
                  <div key={s.label}>
                    <div className="text-sm font-semibold">{s.label}</div>
                    <div className="text-sm text-[var(--text-muted)] leading-relaxed">{s.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
