"use client";
/** Konfetti-Regen für Belohnungsmomente (Etappe geschafft, Brücke fertig). Bei reduzierter Bewegung nur das Banner. */
import { useMemo } from "react";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import { rng } from "@/lib/challenge/zufall";

const FARBEN = ["#e63946", "#f4a261", "#e9c46a", "#2a9d8f", "#457b9d", "#9b5de5", "#ff70a6"];

export function Konfetti({ anzahl = 60, seed = 1 }: { anzahl?: number; seed?: number }) {
  const ruhig = useMemo(wenigerBewegung, []);
  const teile = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: anzahl }, (_, i) => ({
      links: r() * 100, verz: r() * 0.6, dauer: 1.6 + r() * 1.2, dreh: (r() < 0.5 ? -1 : 1) * (360 + r() * 540),
      w: 6 + r() * 6, h: 8 + r() * 8, farbe: FARBEN[i % FARBEN.length], drift: (r() - 0.5) * 120,
    }));
  }, [anzahl, seed]);
  if (ruhig) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden data-konfetti>
      <style>{`@keyframes ch-konfetti{0%{transform:translate(0,-20px) rotate(0)}100%{transform:translate(var(--drift),110vh) rotate(var(--dreh))}}`}</style>
      {teile.map((t, i) => (
        <span key={i} className="absolute top-0 rounded-sm"
          style={{ left: `${t.links}%`, width: t.w, height: t.h, background: t.farbe, animation: `ch-konfetti ${t.dauer}s ${t.verz}s ease-in forwards`,
            ["--drift" as string]: `${t.drift}px`, ["--dreh" as string]: `${t.dreh}deg` }} />
      ))}
    </div>
  );
}

/** Belohnungsmoment über dem Spiel: Konfetti und ein Banner, blockiert keine Eingaben. */
export function Jubel({ text, unter }: { text: string; unter?: string }) {
  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center" role="status" aria-live="polite">
      <Konfetti />
      <div className="ch-jubel card px-6 py-4 text-center shadow-xl">
        <div className="text-2xl font-black">{text}</div>
        {unter && <div className="text-sm text-muted mt-1">{unter}</div>}
      </div>
      <style>{`@keyframes ch-jubel{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}.ch-jubel{animation:ch-jubel .5s ease-out}@media (prefers-reduced-motion: reduce){.ch-jubel{animation:none}}`}</style>
    </div>
  );
}
