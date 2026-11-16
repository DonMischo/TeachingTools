"use client";
/**
 * Erkunden von oben: eine Markov-Karte (lib/challenge/markovKarte) als Kachelbühne.
 * Die Figur läuft per Pfeiltasten/WASD, Bildschirmknöpfe oder Klick auf ein Objekt (Weg entlang der Gänge);
 * die Kamera folgt. Die Karte wird einmal in ein Canvas gemalt (nicht je Schritt hunderte Kachelbilder neu),
 * bei reduzierter Bewegung kommt die Figur ohne Zwischenschritte an. Betritt die Figur ein Objekt, meldet `onBetreten(id)`;
 * Enter/E/Leertaste nimmt ein Objekt auf dem Feld oder direkt daneben (zuerst in Blickrichtung), ohne hinzulaufen.
 * Mit `licht` ist es dunkel bis auf eine Taschenlampe um die Figur: Objekte zeigen sich nur in deren Schein.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import { bodenKachel, THEMES, type ThemeDef } from "@/lib/challenge/themes";
import type { Punkt } from "@/lib/gebaeude/plan";
import { Sprite } from "./Sprite";
import { Passend } from "./Passend";

const T = 32; // Kantenlänge einer Kachel auf der Bühne (16-px-Kachel ×2)
const VB = 14, VH = 9; // sichtbare Kacheln
const SCHRITT_MS = 150;
const M = 3; // Pixel je Feld auf der Minikarte

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
  /** nur absichtlich: Darüberlaufen löst nichts aus, erst Enter/E daneben oder ein Klick */
  untersuchen?: boolean;
};
const NACHBARN: Record<"links" | "rechts" | "hoch" | "runter", [number, number]> = { links: [-1, 0], rechts: [1, 0], hoch: [0, -1], runter: [0, 1] };
const AKTION = new Set(["enter", "e", " "]);
export type KachelArt = "boden" | "hecke" | "wald" | "haus";
type Blick = "links" | "rechts" | "hoch" | "runter";

type Look = { src: string; tile: number; cols: number; muster: { boden: number[]; wand: number[] } };

/** Kachelbild je Art; "boden" folgt dem Theme (Themes ohne Kacheln: Höhlenlook). */
export function kachelLook(theme: ThemeDef, art: KachelArt): Look {
  const wald = THEMES.wald.hintergrund!;
  if (art === "hecke") return { ...wald, muster: { boden: wald.muster.boden, wand: [602] } }; // Heckenblock (Overworld 601–603), kachelt nahtlos
  if (art === "wald") return { ...wald, muster: { boden: wald.muster.boden, wand: [562] } }; // runder Busch
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

export default function Erkunden({ karte, theme, objekte, onBetreten, pausiert = false, kachel = "boden", label, licht }: {
  karte: ErkundKarte; theme: ThemeDef; objekte: ErkundObjekt[]; onBetreten(id: ErkundObjekt["id"]): void;
  pausiert?: boolean; kachel?: KachelArt; label: string;
  /** Radius der Taschenlampe in Feldern; ohne: alles hell */
  licht?: number;
}) {
  const { R } = karte;
  const [pos, setPos] = useState<Punkt>(karte.start);
  const [dir, setDir] = useState<Blick>("runter");
  const [geht, setGeht] = useState(false);
  const seite = useRef<"links" | "rechts">("rechts");
  const [route, setRoute] = useState<Punkt[]>([]);
  const ruhig = useMemo(wenigerBewegung, []);
  const betreten = useRef(onBetreten);
  betreten.current = onBetreten;

  useEffect(() => {
    if (!geht) return;
    const t = setTimeout(() => setGeht(false), SCHRITT_MS + 100);
    return () => clearTimeout(t);
  }, [geht, pos]);

  // Ziel eines Klicks: dort angekommen, wird auch ein Untersuchen-Objekt ausgelöst
  const klickZiel = useRef<ErkundObjekt["id"] | null>(null);
  const gehe = (p: Punkt) => {
    const o = objekte.find((x) => x.x === p[0] && x.y === p[1]);
    const gewollt = !!o && klickZiel.current === o.id;
    if (o && (!o.untersuchen || gewollt)) { setRoute([]); klickZiel.current = null; }
    if (o?.blockiert) { betreten.current(o.id); return; }
    setDir(p[0] !== pos[0] ? (p[0] < pos[0] ? "links" : "rechts") : p[1] < pos[1] ? "hoch" : "runter");
    setPos(p); setGeht(true);
    if (o && (!o.untersuchen || gewollt)) betreten.current(o.id);
  };
  /** Objekt auf dem eigenen Feld oder daneben, zuerst in Blickrichtung. */
  const inReichweite = (): ErkundObjekt | undefined => {
    const auf = (x: number, y: number) => objekte.find((o) => o.label && o.x === x && o.y === y);
    const [bx, by] = NACHBARN[dir];
    return auf(pos[0], pos[1]) ?? auf(pos[0] + bx, pos[1] + by)
      ?? Object.values(NACHBARN).map(([dx, dy]) => auf(pos[0] + dx, pos[1] + dy)).find(Boolean);
  };
  const klick = (o: ErkundObjekt) => {
    if (Math.abs(o.x - pos[0]) + Math.abs(o.y - pos[1]) <= 1) { setRoute([]); betreten.current(o.id); return; }
    klickZiel.current = o.id;
    setRoute(karte.weg(pos, [o.x, o.y]));
  };
  const schritt = (r: [number, number]) => {
    const p: Punkt = [pos[0] + r[0], pos[1] + r[1]];
    setRoute([]);
    if (karte.begehbar(p)) gehe(p);
  };

  // Auto-Lauf entlang der Route (wartet, wenn der Tab verdeckt ist)
  useEffect(() => {
    if (!route.length || pausiert) return;
    if (ruhig) {
      // Ohne Animation: gleich bis zum Ziel bzw. bis zum ersten Objekt unterwegs
      const halt = route.findIndex((p) => objekte.some((o) => o.x === p[0] && o.y === p[1]));
      const ziel = halt < 0 ? route[route.length - 1] : route[halt];
      setRoute([]); gehe(ziel);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (document.hidden) { t = setTimeout(tick, 500); return; }
      const [p, ...rest] = route;
      setRoute(rest); gehe(p);
    };
    t = setTimeout(tick, SCHRITT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, pausiert]);

  // Tastatur: Pfeile / WASD
  // Gedrückt halten = gleichmäßig weiterlaufen. Die Tastenwiederholung des Systems (erst Pause,
  // dann sehr schnell) wird ignoriert; die zuletzt gedrückte, noch gehaltene Richtung zählt.
  const schrittRef = useRef(schritt);
  schrittRef.current = schritt;
  const aktionRef = useRef(() => {});
  aktionRef.current = () => { const o = inReichweite(); if (o) { setRoute([]); betreten.current(o.id); } };
  const gehalten = useRef<string[]>([]);
  useEffect(() => {
    if (pausiert) { gehalten.current = []; return; }
    let takt: ReturnType<typeof setInterval> | null = null;
    const halt = () => { if (takt) clearInterval(takt); takt = null; };
    const laufe = () => {
      const taste = gehalten.current[gehalten.current.length - 1];
      if (!taste) { halt(); return; }
      if (!document.hidden) schrittRef.current(RICHTUNG[taste]);
    };
    const runter = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      // Aufheben/Untersuchen; auf einem fokussierten Knopf lösen Enter und Leertaste weiter den Knopf aus
      if (AKTION.has(k)) {
        if (!e.repeat && (k === "e" || !(e.target as HTMLElement)?.closest?.("button,a"))) { e.preventDefault(); aktionRef.current(); }
        return;
      }
      if (!RICHTUNG[k]) return;
      e.preventDefault();
      if (e.repeat || gehalten.current.includes(k)) return;
      gehalten.current = [...gehalten.current, k];
      laufe();
      if (!takt) takt = setInterval(laufe, SCHRITT_MS);
    };
    const hoch = (e: KeyboardEvent) => {
      gehalten.current = gehalten.current.filter((k) => k !== e.key.toLowerCase());
      if (!gehalten.current.length) halt();
    };
    const loslassen = () => { gehalten.current = []; halt(); };
    const sichtbar = () => { if (document.hidden) loslassen(); };
    window.addEventListener("keydown", runter);
    window.addEventListener("keyup", hoch);
    window.addEventListener("blur", loslassen);
    document.addEventListener("visibilitychange", sichtbar);
    return () => {
      halt();
      window.removeEventListener("keydown", runter);
      window.removeEventListener("keyup", hoch);
      window.removeEventListener("blur", loslassen);
      document.removeEventListener("visibilitychange", sichtbar);
    };
  }, [pausiert]);

  const h = useMemo(() => kachelLook(theme, kachel), [theme, kachel]);
  const cx = klemme(pos[0] - Math.floor(VB / 2), 0, Math.max(0, R - VB));
  const cy = klemme(pos[1] - Math.floor(VH / 2), 0, Math.max(0, R - VH));
  // Die ganze Karte einmal ins Canvas malen; die Kamera verschiebt nur die Ebene
  const leinwand = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = leinwand.current?.getContext("2d");
    if (!ctx) return;
    const bild = new Image();
    bild.onload = () => {
      ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < R; y++) {
        for (let x = 0; x < R; x++) {
          // erst schlichter Boden darunter: Büsche, Blumen u. a. haben durchsichtige Pixel
          const grund = h.muster.boden[0];
          const id = karte.begehbar([x, y]) ? bodenKachel(h.muster.boden, x, y) : bodenKachel(h.muster.wand, x, y);
          for (const k of id === grund ? [id] : [grund, id]) {
            ctx.drawImage(bild, (k % h.cols) * h.tile, Math.floor(k / h.cols) * h.tile, h.tile, h.tile, x * T, y * T, T, T);
          }
        }
      }
    };
    bild.src = h.src;
    return () => { bild.onload = null; };
  }, [R, karte, h.src, h.tile, h.cols, h.muster]);

  // Minikarte oben rechts: Gänge hell, Objekte gelb, Figur rot — sonst findet niemand die fernen Räume
  const mini = useRef<HTMLCanvasElement>(null);
  const miniFest = useRef<HTMLCanvasElement | null>(null); // Gänge und Objekte, nur bei neuer Karte/neuen Objekten gemalt
  useEffect(() => {
    const fest = document.createElement("canvas");
    fest.width = fest.height = R * M;
    const ctx = fest.getContext("2d");
    if (!ctx) { miniFest.current = null; return; }
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      if (karte.begehbar([x, y])) ctx.fillRect(x * M, y * M, M, M);
    }
    ctx.fillStyle = "#facc15";
    // im Dunkeln verrät die Minikarte keine unentdeckten Stellen
    for (const o of objekte) if (!licht || !o.label) ctx.fillRect(o.x * M - 1, o.y * M - 1, M + 2, M + 2);
    miniFest.current = fest;
  }, [R, karte, objekte, licht]);
  useEffect(() => {
    const ctx = mini.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, R * M, R * M);
    if (miniFest.current) ctx.drawImage(miniFest.current, 0, 0);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(pos[0] * M - 1, pos[1] * M - 1, M + 2, M + 2);
  }, [R, karte, objekte, pos]);

  const sp = theme.spieler;
  // Hoch/runter fehlen in manchen Blättern: dann die letzte Seitenrichtung
  const bilder = sp.laufen[dir] ?? sp.laufen[seite.current];
  if (dir === "links" || dir === "rechts") seite.current = dir;
  const lauf = { frames: bilder, fps: 8 };
  const sh = sp.stehen.h * 2;
  const bewegung = ruhig ? undefined : `${SCHRITT_MS}ms linear`;
  const imLicht = (o: ErkundObjekt) => !licht || Math.hypot(o.x - pos[0], o.y - pos[1]) <= licht;
  const nah = pausiert ? undefined : inReichweite();

  return (
    <div className="flex flex-col gap-2">
      <Passend breite={VB * T} hoehe={VH * T}>
        <div role="group" aria-label={label} className="relative overflow-hidden rounded-lg" style={{ width: VB * T, height: VH * T, background: "#0b0710" }}>
          <div className="absolute left-0 top-0" style={{ width: R * T, height: R * T, transform: `translate(${-cx * T}px, ${-cy * T}px)`, transition: bewegung && `transform ${bewegung}` }}>
            <canvas ref={leinwand} aria-hidden width={R * T} height={R * T} className="absolute left-0 top-0" style={{ imageRendering: "pixelated" }} />
            {objekte.map((o) => {
              const hell = imLicht(o);
              const stil = { left: o.x * T - 6, top: o.y * T - 8, width: T + 12, height: T + 8, opacity: hell ? 1 : 0, transition: "opacity .3s", pointerEvents: hell ? undefined : ("none" as const) };
              if (!o.label) return <span key={o.id} className="absolute flex items-center justify-center" style={stil}>{o.render()}</span>;
              return (
                <button key={o.id} style={stil} aria-label={o.label} onClick={() => klick(o)} data-nah={nah?.id === o.id || undefined}
                  className="absolute flex items-center justify-center focus-visible:outline-2 focus-visible:outline-accent">
                  {o.render()}
                </button>
              );
            })}
            {licht && (
              // Taschenlampe: Dunkelheit mit hellem Kreis um die Figur, wandert mit ihr
              <div className="absolute left-0 top-0 pointer-events-none" aria-hidden data-licht
                style={{ width: R * T * 2, height: R * T * 2, transform: `translate(${(pos[0] + 0.5) * T - R * T}px, ${(pos[1] + 0.5) * T - R * T}px)`, transition: bewegung && `transform ${bewegung}`,
                  background: `radial-gradient(circle at center, rgba(255,240,200,0.06) 0, transparent ${licht * T * 0.55}px, rgba(4,4,12,0.9) ${licht * T}px)` }} />
            )}
            <div className="absolute pointer-events-none" aria-label="Spielfigur" role="img" data-feld={`${pos[0]},${pos[1]}`}
              style={{ left: 0, top: 0, transform: `translate(${pos[0] * T}px, ${pos[1] * T - (sh - T)}px)`, transition: bewegung && `transform ${bewegung}` }}>
              <Sprite src={sp.src} frame={bilder[0]} scale={2} animation={geht ? lauf : undefined} />
            </div>
          </div>
          {R > VB && (
            <canvas ref={mini} aria-hidden width={R * M} height={R * M} title="Karte"
              className="absolute right-1 top-1 rounded pointer-events-none" style={{ background: "rgba(0,0,0,0.55)", imageRendering: "pixelated" }} />
          )}
        </div>
      </Passend>
      <div className="flex flex-wrap items-center gap-2">
        {KNOEPFE.map((k) => (
          <button key={k.label} className="btn-secondary w-10" aria-label={k.label} disabled={pausiert} onClick={() => schritt(k.r)}>{k.zeichen}</button>
        ))}
        <button className="btn-secondary" disabled={pausiert || !nah} onClick={() => aktionRef.current()} title="Enter, E oder Leertaste">
          {nah?.untersuchen ? "🔍 Untersuchen" : "✋ Aufheben"} <span className="text-muted text-xs">(Enter)</span>
        </button>
      </div>
    </div>
  );
}
