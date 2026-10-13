"use client";
/**
 * Erkunden von oben: eine Markov-Karte (lib/challenge/markovKarte) als Kachelbühne.
 * Die Figur läuft per Pfeiltasten/WASD, Bildschirmknöpfe oder Klick auf ein Objekt (Weg entlang der Gänge);
 * die Kamera folgt, gezeichnet werden nur sichtbare Kacheln. Betritt die Figur ein Objekt, meldet `onBetreten(id)`.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { bodenKachel, THEMES, type ThemeDef } from "@/lib/challenge/themes";
import type { Punkt } from "@/lib/gebaeude/plan";
import { Sprite } from "./Sprite";
import { Passend } from "./Passend";

const T = 32; // Kantenlänge einer Kachel auf der Bühne (16-px-Kachel ×2)
const VB = 14, VH = 9; // sichtbare Kacheln
const SCHRITT_MS = 150;

export type ErkundKarte = {
  R: number; start: Punkt;
  begehbar(p: Punkt): boolean;
  weg(von: Punkt, nach: Punkt): Punkt[];
};
export type ErkundObjekt = {
  id: number | string; x: number; y: number;
  render(): ReactNode;
  /** nicht betretbar: die Figur bleibt davor stehen, `onBetreten` feuert trotzdem */
  blockiert?: boolean;
  /** mit Label ist das Objekt klickbar (Figur läuft hin) */
  label?: string;
};
export type KachelArt = "boden" | "hecke" | "wald" | "haus";

type Look = { src: string; tile: number; cols: number; muster: { boden: number[]; wand: number[] } };

/** Kachelbild je Art; "boden" folgt dem Theme (Themes ohne Kacheln: Höhlenlook). */
export function kachelLook(theme: ThemeDef, art: KachelArt): Look {
  const wald = THEMES.wald.hintergrund!;
  if (art === "hecke") return { ...wald, muster: { boden: wald.muster.boden, wand: [560] } };
  if (art === "wald") return { ...wald, muster: { boden: wald.muster.boden, wand: [283] } };
  if (art === "haus") return THEMES.antike.hintergrund!;
  return theme.hintergrund ?? THEMES.verlies.hintergrund!;
}

const RICHTUNG: Record<string, [number, number]> = {
  arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
};
const KNOEPFE: { label: string; zeichen: string; r: [number, number] }[] = [
  { label: "Nach links", zeichen: "←", r: [-1, 0] }, { label: "Nach oben", zeichen: "↑", r: [0, -1] },
  { label: "Nach unten", zeichen: "↓", r: [0, 1] }, { label: "Nach rechts", zeichen: "→", r: [1, 0] },
];
const klemme = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ruhigeBewegung = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export default function Erkunden({ karte, theme, objekte, onBetreten, pausiert = false, kachel = "boden", label }: {
  karte: ErkundKarte; theme: ThemeDef; objekte: ErkundObjekt[]; onBetreten(id: ErkundObjekt["id"]): void;
  pausiert?: boolean; kachel?: KachelArt; label: string;
}) {
  const { R } = karte;
  const [pos, setPos] = useState<Punkt>(karte.start);
  const [dir, setDir] = useState<"links" | "rechts">("rechts");
  const [geht, setGeht] = useState(false);
  const [route, setRoute] = useState<Punkt[]>([]);
  const ruhig = useMemo(ruhigeBewegung, []);
  const betreten = useRef(onBetreten);
  betreten.current = onBetreten;

  useEffect(() => {
    if (!geht) return;
    const t = setTimeout(() => setGeht(false), SCHRITT_MS + 100);
    return () => clearTimeout(t);
  }, [geht, pos]);

  const gehe = (p: Punkt) => {
    const o = objekte.find((x) => x.x === p[0] && x.y === p[1]);
    if (o) setRoute([]);
    if (o?.blockiert) { betreten.current(o.id); return; }
    if (p[0] !== pos[0]) setDir(p[0] < pos[0] ? "links" : "rechts");
    setPos(p); setGeht(true);
    if (o) betreten.current(o.id);
  };
  const schritt = (r: [number, number]) => {
    const p: Punkt = [pos[0] + r[0], pos[1] + r[1]];
    setRoute([]);
    if (karte.begehbar(p)) gehe(p);
  };

  // Auto-Lauf entlang der Route (wartet, wenn der Tab verdeckt ist)
  useEffect(() => {
    if (!route.length || pausiert) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (document.hidden) { t = setTimeout(tick, 500); return; }
      const [p, ...rest] = route;
      setRoute(rest); gehe(p);
    };
    t = setTimeout(tick, ruhig ? 30 : SCHRITT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, pausiert]);

  // Tastatur: Pfeile / WASD
  useEffect(() => {
    if (pausiert) return;
    const f = (e: KeyboardEvent) => {
      const r = RICHTUNG[e.key.toLowerCase()];
      if (!r || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      e.preventDefault(); schritt(r);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  });

  const h = kachelLook(theme, kachel);
  const cx = klemme(pos[0] - Math.floor(VB / 2), 0, Math.max(0, R - VB));
  const cy = klemme(pos[1] - Math.floor(VH / 2), 0, Math.max(0, R - VH));
  const kacheln = useMemo(() => {
    const k: ReactNode[] = [];
    for (let y = Math.max(0, cy - 1); y <= Math.min(R - 1, cy + VH); y++) {
      for (let x = Math.max(0, cx - 1); x <= Math.min(R - 1, cx + VB); x++) {
        const id = karte.begehbar([x, y]) ? bodenKachel(h.muster.boden, x, y) : bodenKachel(h.muster.wand, x, y);
        k.push(
          <span key={`${x}-${y}`} className="absolute leading-[0]" style={{ left: x * T, top: y * T }}>
            <Sprite src={h.src} scale={T / h.tile} frame={{ x: (id % h.cols) * h.tile, y: Math.floor(id / h.cols) * h.tile, w: h.tile, h: h.tile }} />
          </span>,
        );
      }
    }
    return k;
  }, [cx, cy, R, karte, h]);

  const sp = theme.spieler;
  const lauf = { frames: sp.laufen[dir], fps: 8 };
  const sh = sp.stehen.h * 2;
  const bewegung = ruhig ? undefined : `${SCHRITT_MS}ms linear`;

  return (
    <div className="flex flex-col gap-2">
      <Passend breite={VB * T} hoehe={VH * T}>
        <div role="group" aria-label={label} className="relative overflow-hidden rounded-lg" style={{ width: VB * T, height: VH * T, background: "#0b0710" }}>
          <div className="absolute left-0 top-0" style={{ width: R * T, height: R * T, transform: `translate(${-cx * T}px, ${-cy * T}px)`, transition: bewegung && `transform ${bewegung}` }}>
            <div aria-hidden>{kacheln}</div>
            {objekte.map((o) => {
              const stil = { left: o.x * T - 6, top: o.y * T - 8, width: T + 12, height: T + 8 };
              if (!o.label) return <span key={o.id} className="absolute flex items-center justify-center" style={stil}>{o.render()}</span>;
              return (
                <button key={o.id} style={stil} aria-label={o.label} onClick={() => setRoute(karte.weg(pos, [o.x, o.y]))}
                  className="absolute flex items-center justify-center focus-visible:outline-2 focus-visible:outline-accent">
                  {o.render()}
                </button>
              );
            })}
            <div className="absolute pointer-events-none" aria-label="Spielfigur" role="img" data-feld={`${pos[0]},${pos[1]}`}
              style={{ left: pos[0] * T, top: pos[1] * T - (sh - T), transition: bewegung && `left ${bewegung}, top ${bewegung}` }}>
              <Sprite src={sp.src} frame={sp.stehen} scale={2} animation={geht ? lauf : undefined} />
            </div>
          </div>
        </div>
      </Passend>
      <div className="flex flex-wrap items-center gap-2">
        {KNOEPFE.map((k) => (
          <button key={k.label} className="btn-secondary w-10" aria-label={k.label} disabled={pausiert} onClick={() => schritt(k.r)}>{k.zeichen}</button>
        ))}
      </div>
    </div>
  );
}
