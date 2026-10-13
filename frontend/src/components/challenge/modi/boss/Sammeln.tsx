"use client";
/**
 * Sammelphase des Bosskampfs: eine Verlies-Karte (Markov-Regeln wie bei TaskCrawler) von oben.
 * Die Figur läuft durch die Gänge (Pfeile/WASD, Bildschirmknöpfe oder Klick auf ein Ziel);
 * Truhen öffnen sich beim Betreten, Mini-Monster starten einen Klicker-Kampf. Jedes gibt 1–2 Fakten.
 */
import { useEffect, useMemo, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import { bodenKachel, THEMES, type ThemeDef } from "@/lib/challenge/themes";
import { baueBossKarte, type BossObjekt } from "@/lib/challenge/bossKarte";
import { begehbar, weg, type Punkt } from "@/lib/gebaeude/plan";
import { Sprite } from "@/components/challenge/pixel/Sprite";
import { Passend } from "@/components/challenge/pixel/Passend";
import { Inhalt } from "../teile";
import Kampf from "./Kampf";
import { reduziert } from "./Szene";

export { reduziert };

const OBJ = "/challenge/pixel/gfx/objects.png";
const TRUHE = { x: 148, y: 0, w: 22, h: 16 };
const TRUHE_AUF = { x: 181, y: 0, w: 20, h: 16 };
const LOG = "/challenge/pixel/gfx/log.png";
const MONSTER = { x: 0, y: 64, w: 32, h: 32 };
const T = 32; // Kantenlänge einer Kachel auf der Bühne (16-px-Kachel ×2)
const VB = 14, VH = 9; // sichtbare Kacheln
const SCHRITT_MS = 150;

const RICHTUNG: Record<string, [number, number]> = {
  arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
};
const KNOEPFE: { label: string; zeichen: string; r: [number, number] }[] = [
  { label: "Nach links", zeichen: "←", r: [-1, 0] }, { label: "Nach oben", zeichen: "↑", r: [0, -1] },
  { label: "Nach unten", zeichen: "↓", r: [0, 1] }, { label: "Nach rechts", zeichen: "→", r: [1, 0] },
];
const klemme = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function Sammeln({ fakten, theme, seed, gefunden, setGefunden, weiter }: {
  fakten: ChallengeFakt[]; theme: ThemeDef; seed: number; gefunden: string[]; setGefunden(f: (g: string[]) => string[]): void; weiter(): void;
}) {
  const karte = useMemo(() => baueBossKarte(seed, fakten.length), [seed, fakten.length]);
  const { R, st, objekte } = karte;
  const [pos, setPos] = useState<Punkt>(karte.start);
  const [dir, setDir] = useState<"links" | "rechts">("rechts");
  const [geht, setGeht] = useState(false);
  const [route, setRoute] = useState<Punkt[]>([]);
  const [fertig, setFertig] = useState<number[]>([]);
  const [zeige, setZeige] = useState<ChallengeFakt[]>([]);
  const [kampf, setKampf] = useState<BossObjekt | null>(null);
  const [ueberspringen, setUeberspringen] = useState(reduziert);
  const ruhig = useMemo(reduziert, []);

  useEffect(() => {
    const t = setTimeout(() => setUeberspringen(true), 20000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!geht) return;
    const t = setTimeout(() => setGeht(false), SCHRITT_MS + 100);
    return () => clearTimeout(t);
  }, [geht, pos]);

  const faktenVon = (o: BossObjekt) => o.faktIdx.map((i) => fakten[i]).filter(Boolean);
  const alle = fakten.length > 0 && fakten.every((f) => gefunden.includes(f.id));
  const nimm = (fs: ChallengeFakt[]) => setGefunden((g) => [...g, ...fs.map((f) => f.id).filter((id) => !g.includes(id))]);
  const blockiert = !!kampf || zeige.length > 0;

  const gehe = (p: Punkt) => {
    if (p[0] !== pos[0]) setDir(p[0] < pos[0] ? "links" : "rechts");
    setPos(p); setGeht(true);
    const o = objekte.find((x) => x.x === p[0] && x.y === p[1] && !fertig.includes(x.id));
    if (!o) return;
    setRoute([]);
    if (o.art === "truhe") { setFertig((f) => [...f, o.id]); nimm(faktenVon(o)); setZeige(faktenVon(o)); } else setKampf(o);
  };
  const schritt = (r: [number, number]) => {
    const p: Punkt = [pos[0] + r[0], pos[1] + r[1]];
    setRoute([]);
    if (begehbar(R, st, p)) gehe(p);
  };

  // Auto-Lauf entlang der Route (pausiert, wenn der Tab verdeckt ist)
  useEffect(() => {
    if (!route.length || blockiert) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (document.hidden) { t = setTimeout(tick, 500); return; }
      const [p, ...rest] = route;
      setRoute(rest); gehe(p);
    };
    t = setTimeout(tick, ruhig ? 30 : SCHRITT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, blockiert]);

  // Tastatur: Pfeile / WASD
  useEffect(() => {
    if (blockiert) return;
    const f = (e: KeyboardEvent) => {
      const r = RICHTUNG[e.key.toLowerCase()];
      if (!r || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      e.preventDefault(); schritt(r);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  });

  const geheZu = (o: BossObjekt) => setRoute(weg(R, st, pos, [o.x, o.y]));
  const alleEinsammeln = () => { nimm(fakten); setFertig(objekte.map((o) => o.id)); setZeige([]); setKampf(null); weiter(); };

  const h = theme.hintergrund ?? THEMES.verlies.hintergrund!; // Themes ohne Kacheln: Höhlenlook
  const cx = klemme(pos[0] - Math.floor(VB / 2), 0, Math.max(0, R - VB));
  const cy = klemme(pos[1] - Math.floor(VH / 2), 0, Math.max(0, R - VH));
  const kacheln = useMemo(() => {
    const k: React.ReactNode[] = [];
    for (let y = Math.max(0, cy - 1); y <= Math.min(R - 1, cy + VH); y++) {
      for (let x = Math.max(0, cx - 1); x <= Math.min(R - 1, cx + VB); x++) {
        const id = begehbar(R, st, [x, y]) ? bodenKachel(h.muster.boden, x, y) : h.muster.wand[0];
        k.push(
          <span key={`${x}-${y}`} className="absolute leading-[0]" style={{ left: x * T, top: y * T }}>
            <Sprite src={h.src} scale={T / h.tile} frame={{ x: (id % h.cols) * h.tile, y: Math.floor(id / h.cols) * h.tile, w: h.tile, h: h.tile }} />
          </span>,
        );
      }
    }
    return k;
  }, [cx, cy, R, st, h]);
  if (kampf) {
    return <Kampf theme={theme} fakten={faktenVon(kampf)}
      onSieg={() => { setFertig((f) => [...f, kampf.id]); nimm(faktenVon(kampf)); }} onEnde={() => setKampf(null)} />;
  }

  const sp = theme.spieler;
  const lauf = { frames: sp.laufen[dir], fps: 8 };
  const sh = sp.stehen.h * 2;
  const bewegung = ruhig ? undefined : `${SCHRITT_MS}ms linear`;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted">Erkunde das Verlies: Pfeiltasten/WASD, die Knöpfe oder ein Ziel anklicken. Truhen öffnen sich beim Betreten, gegen Mini-Monster kämpfst du per Klick. Gefunden: {gefunden.length}/{fakten.length}</p>
      <Passend breite={VB * T} hoehe={VH * T}>
        <div className="relative overflow-hidden rounded-lg" style={{ width: VB * T, height: VH * T, background: "#0b0710" }}>
          <div className="absolute left-0 top-0" style={{ width: R * T, height: R * T, transform: `translate(${-cx * T}px, ${-cy * T}px)`, transition: bewegung && `transform ${bewegung}` }}>
            <div aria-hidden>{kacheln}</div>
            {objekte.map((o) => {
              const auf = fertig.includes(o.id);
              if (o.art === "monster" && auf) return null;
              const stil = { left: o.x * T - 6, top: o.y * T - 8, width: T + 12, height: T + 8 };
              if (auf) return <span key={o.id} className="absolute flex items-center justify-center" style={stil}><Sprite src={OBJ} frame={TRUHE_AUF} scale={1.5} label="Truhe (leer)" /></span>;
              return (
                <button key={o.id} style={stil} onClick={() => geheZu(o)}
                  aria-label={o.art === "truhe" ? "Truhe öffnen" : "Mini-Monster herausfordern"}
                  className="absolute flex items-center justify-center focus-visible:outline-2 focus-visible:outline-accent">
                  {o.art === "truhe" ? <Sprite src={OBJ} frame={TRUHE} scale={1.5} /> : <Sprite src={LOG} frame={MONSTER} scale={1.3} />}
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
          <button key={k.label} className="btn-secondary w-10" aria-label={k.label} disabled={blockiert} onClick={() => schritt(k.r)}>{k.zeichen}</button>
        ))}
        {alle && <button className="btn-primary" onClick={weiter}>Zum Kampf</button>}
        {!alle && ueberspringen && <button className="btn-secondary" onClick={alleEinsammeln}>Alles einsammeln</button>}
      </div>
      {zeige.length > 0 && (
        <div className="card p-3 flex flex-col gap-2" role="status">
          <strong>Gefunden!</strong>
          {zeige.map((f) => (
            <div key={f.id}><Inhalt x={f} />{f.info && <p className="text-muted text-sm">{f.info.text}</p>}</div>
          ))}
          <button className="btn-secondary self-start" autoFocus onClick={() => setZeige([])}>OK</button>
        </div>
      )}
    </div>
  );
}
