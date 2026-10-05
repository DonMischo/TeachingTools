"use client";
/**
 * Ein Kontextmenü, das aussieht wie unter Windows 11: abgerundet, leichter
 * Schatten, Segoe UI, feine Symbole, Tastenkürzel rechts. Nur der erste
 * Eintrag ist wählbar — die übrigen stehen ausgegraut da, damit das Menü echt
 * wirkt und das Kind lernt, dass nicht alles immer geht.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type Eintrag = { text: string; symbol?: ReactNode; kuerzel?: string; aus?: boolean; onWahl?: () => void };

const strich = { fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const SYMBOLE = {
  tier: <svg viewBox="0 0 16 16" width="16" height="16" {...strich}><circle cx="8" cy="8" r="6.2" /><path d="M5 8.2 7.1 10.3 11 6" /></svg>,
  ausschneiden: <svg viewBox="0 0 16 16" width="16" height="16" {...strich}><circle cx="4.5" cy="12" r="2" /><circle cx="11.5" cy="12" r="2" /><path d="M5.8 10.5 12 2M10.2 10.5 4 2" /></svg>,
  kopieren: <svg viewBox="0 0 16 16" width="16" height="16" {...strich}><rect x="5" y="5" width="8.5" height="9" rx="1.5" /><path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H10" /></svg>,
  umbenennen: <svg viewBox="0 0 16 16" width="16" height="16" {...strich}><rect x="1.5" y="4.5" width="13" height="7" rx="1.5" /><path d="M9 2.5v11M7.5 2.5h3M7.5 13.5h3" /></svg>,
  loeschen: <svg viewBox="0 0 16 16" width="16" height="16" {...strich}><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.2a1 1 0 0 0 1 .8h4.6a1 1 0 0 0 1-.8L12 4" /></svg>,
  eigenschaften: <svg viewBox="0 0 16 16" width="16" height="16" {...strich}><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M5 6h6M5 8.5h6M5 11h3.5" /></svg>,
};

export function Kontextmenue({
  x, y, eintraege, onZu,
}: { x: number; y: number; eintraege: (Eintrag | "trenner")[]; onZu: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ort, setOrt] = useState({ x, y });

  // Wie das echte Menü: klappt nach links/oben, wenn rechts/unten kein Platz ist.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setOrt({
      x: x + width > window.innerWidth - 4 ? Math.max(4, x - width) : x,
      y: y + height > window.innerHeight - 4 ? Math.max(4, y - height) : y,
    });
  }, [x, y]);

  useEffect(() => {
    const zu = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      onZu();
    };
    window.addEventListener("keydown", zu);
    window.addEventListener("mousedown", zu);
    window.addEventListener("blur", onZu);
    window.addEventListener("resize", onZu);
    return () => {
      window.removeEventListener("keydown", zu);
      window.removeEventListener("mousedown", zu);
      window.removeEventListener("blur", onZu);
      window.removeEventListener("resize", onZu);
    };
  }, [onZu]);

  return (
    <div
      ref={ref}
      role="menu"
      onContextMenu={e => e.preventDefault()}
      className="fixed z-50 min-w-[250px] p-1 select-none"
      style={{
        left: ort.x,
        top: ort.y,
        fontFamily: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
        fontSize: 14,
        color: "#1a1a1a",
        background: "rgba(249, 249, 249, 0.97)",
        backdropFilter: "blur(30px)",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        borderRadius: 8,
        boxShadow: "0 8px 16px rgba(0, 0, 0, 0.14)",
      }}
    >
      {eintraege.map((e, i) =>
        e === "trenner" ? (
          <div key={i} role="separator" className="my-1 mx-[-4px] h-px" style={{ background: "rgba(0,0,0,0.08)" }} />
        ) : (
          <button
            key={i}
            role="menuitem"
            aria-disabled={e.aus || undefined}
            disabled={e.aus}
            onClick={() => { e.onWahl?.(); onZu(); }}
            className="w-full flex items-center gap-3 h-8 px-3 rounded-sm text-left enabled:hover:bg-black/6 enabled:active:bg-black/4"
            style={{ color: e.aus ? "rgba(0,0,0,0.36)" : undefined }}
          >
            <span className="w-4 h-4 flex items-center justify-center shrink-0">{e.symbol}</span>
            <span className="flex-1">{e.text}</span>
            {e.kuerzel && <span className="text-xs" style={{ color: e.aus ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.55)" }}>{e.kuerzel}</span>}
          </button>
        ),
      )}
    </div>
  );
}
