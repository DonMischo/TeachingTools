"use client";
/**
 * Das Spielfeld des Koordinaten-Laufs: Himmel über der x-Achse, Wasser
 * darunter (bzw. Erde, wenn es keine negativen y gibt), Raster, Punkte und die
 * Figur mit Helm.
 *
 * Der Spielzustand ist immer schon fertig gerechnet; hier wird nur gezeigt.
 * Die Figur läuft dem Zustand hinterher (requestAnimationFrame), Sprünge
 * spielen als Bogen ab — fehlt rAF (Tests), steht sie sofort am Ziel.
 *
 * Farben stehen hier fest (Spielgrafik, nicht Oberfläche) und als Hex —
 * var() in SVG-Attributen ignoriert der Browser.
 */
import { useEffect, useRef, useState } from "react";
import { basis, naechstes, type Aufgabe, type Ereignis, type Level, type P, type Zustand } from "@/lib/koordinaten/spiel";

export const U = 40;                  // Pixel je Einheit (viewBox)

const FARBE = {
  himmel: "#bfe6ff", himmelOben: "#7cc4f5", wasser: "#2b7bbf", wasserTief: "#123f73",
  erde: "#8b5a2b", gras: "#4caf50", raster: "#ffffff", rasterUnten: "#9cc8ee",
  achse: "#1e293b", punkt: "#e11d48", vorlage: "#7c3aed", linie: "#be123c",
  laufen: "#ea580c", springen: "#16a34a", gerade: "#0f172a", stein: "#06b6d4",
};

export type Effekt = { id: number; ereignis: Ereignis; landung: P };

type Sprung = { t0: number; dauer: number; von: P; apex: number; landung: P; tauchen: boolean };
type Blase = { x: number; y: number; t0: number; r: number };
type Spritzer = { x: number; t0: number };

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

/**
 * Höhe während eines Sprungs. Abtauchen ist eine eigene Bewegung: kurzer
 * Hüpfer vom Floß, langsames Sinken mit Schaukeln, kurz schweben, auftauchen.
 */
function sprungOrt(s: Sprung, t: number): { p: P; neigung: number } {
  if (!s.tauchen) {
    if (t < 0.45) return { p: { x: s.von.x, y: s.von.y + (s.apex - s.von.y) * easeOut(t / 0.45) }, neigung: 0 };
    if (t < 0.55) return { p: { x: s.von.x, y: s.apex }, neigung: 0 };
    return { p: { x: s.landung.x, y: s.apex + (s.landung.y - s.apex) * easeIn((t - 0.55) / 0.45) }, neigung: 0 };
  }
  const schaukel = (u: number) => Math.sin(u * Math.PI * 4);
  const hop = s.von.y >= 0 ? 0.6 : 0;          // vom Floß springt man erst hoch
  if (t < 0.14) return { p: { x: s.von.x, y: s.von.y + hop * Math.sin((t / 0.14) * Math.PI / 2) }, neigung: 0 };
  if (t < 0.52) {
    const u = (t - 0.14) / 0.38;
    const y = s.von.y + hop + (s.apex - s.von.y - hop) * easeInOut(u);
    return { p: { x: s.von.x + 0.06 * schaukel(u), y }, neigung: 10 * schaukel(u) };
  }
  if (t < 0.64) {
    const u = (t - 0.52) / 0.12;
    return { p: { x: s.von.x, y: s.apex + 0.05 * Math.sin(u * Math.PI * 2) }, neigung: 0 };
  }
  const u = (t - 0.64) / 0.36;
  return { p: { x: s.landung.x + 0.05 * schaukel(u), y: s.apex + (s.landung.y - s.apex) * easeInOut(u) }, neigung: -6 * schaukel(u) };
}

/** Wo die Figur gerade zu sehen ist — läuft dem Zustand hinterher. Dazu Blasen und Spritzer. */
function useAnzeige(held: P, effekt: Effekt | null) {
  const pos = useRef<P>({ ...held });
  const blick = useRef(1);
  const laeuft = useRef(false);
  const steigt = useRef(0);
  const neigung = useRef(0);
  const sprung = useRef<Sprung | null>(null);
  const blasen = useRef<Blase[]>([]);
  const spritzer = useRef<Spritzer[]>([]);
  const letzteBlase = useRef(0);
  const zuletzt = useRef<number | null>(null);
  const ziel = useRef(held);
  ziel.current = held;
  const [, tick] = useState(0);
  const hatRaf = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function";

  useEffect(() => {
    if (!effekt || effekt.ereignis.art === "nichts" || effekt.id === zuletzt.current) return;
    zuletzt.current = effekt.id;
    const { von, p } = effekt.ereignis;
    const h = Math.abs(p.y - von.y);
    const tauchen = p.y < von.y && p.y < 0;
    sprung.current = {
      t0: performance.now(), von, apex: p.y, landung: effekt.landung, tauchen,
      dauer: tauchen ? 900 + 180 * h : 320 + 70 * Math.max(h, 1),
    };
  }, [effekt]);

  useEffect(() => {
    if (!hatRaf) return;
    let id = 0, vorher = performance.now();
    const lauf = (jetzt: number) => {
      const dt = Math.min(0.05, (jetzt - vorher) / 1000);
      vorher = jetzt;
      const alt = pos.current;
      const s = sprung.current;
      if (s) {
        const t = (jetzt - s.t0) / s.dauer;
        if (t >= 1) { sprung.current = null; pos.current = { ...s.landung }; neigung.current = 0; }
        else { const o = sprungOrt(s, t); pos.current = o.p; neigung.current = o.neigung; }
        laeuft.current = false;
      } else {
        const z = ziel.current, p = pos.current;
        const dx = z.x - p.x, dy = z.y - p.y;
        // Unter Wasser geht es gemächlicher voran.
        const schritt = (p.y < -0.04 ? 5 : 9) * dt;
        laeuft.current = Math.abs(dx) > 0.01;
        if (Math.abs(dx) > 0.01) blick.current = dx > 0 ? 1 : -1;
        pos.current = {
          x: Math.abs(dx) <= schritt ? z.x : p.x + Math.sign(dx) * schritt,
          y: Math.abs(dy) <= schritt * 1.5 ? z.y : p.y + Math.sign(dy) * schritt * 1.5,
        };
        neigung.current = 0;
      }
      const neu = pos.current;
      steigt.current = dt > 0 ? (neu.y - alt.y) / dt : 0;
      // Durch die Wasseroberfläche → es spritzt.
      if ((alt.y >= -0.05) !== (neu.y >= -0.05)) spritzer.current.push({ x: neu.x, t0: jetzt });
      spritzer.current = spritzer.current.filter(sp => jetzt - sp.t0 < 700);
      // Unter Wasser steigen Blasen aus dem Helm.
      if (neu.y < -0.3 && jetzt - letzteBlase.current > 170) {
        letzteBlase.current = jetzt;
        blasen.current.push({ x: neu.x + 0.15 * blick.current, y: neu.y + 1.15, t0: jetzt, r: 1.5 + Math.random() * 2.5 });
      }
      blasen.current = blasen.current
        .map(bl => ({ ...bl, y: bl.y + 1.6 * dt }))
        .filter(bl => bl.y < -0.05 && jetzt - bl.t0 < 5000);
      tick(n => (n + 1) % 1e6);
      id = requestAnimationFrame(lauf);
    };
    id = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(id);
  }, [hatRaf]);

  if (!hatRaf) return { pos: held, blick: 1, laeuft: false, steigt: 0, neigung: 0, taucht: false, blasen: [] as Blase[], spritzer: [] as Spritzer[] };
  return {
    pos: pos.current, blick: blick.current, laeuft: laeuft.current, steigt: steigt.current,
    neigung: neigung.current, taucht: !!sprung.current?.tauchen, blasen: blasen.current, spritzer: spritzer.current,
  };
}

type Modus = "land" | "luft" | "wasser";

/** Kopf mit Helm (an Land und in der Luft). */
function Kopf() {
  return (
    <g>
      <rect x={-7} y={-45} width={14} height={13} rx={4} fill="#f2c79a" />
      <rect x={2} y={-41} width={3} height={3} fill="#111" />
      <path d="M -9 -42 Q -9 -54 1 -54 Q 10 -54 10 -44 L 10 -42 Z" fill="#facc15" stroke="#a16207" strokeWidth={1} />
      <rect x={-1} y={-54} width={3} height={12} fill="#dc2626" />
    </g>
  );
}

/**
 * Die Figur, Füße bei (0|0), Blick nach rechts. Eigenbau:
 * an Land mit Helm, in der Luft mit Raketenrucksack, im Wasser im Taucheranzug.
 */
function Figur({ modus, laeuft, steigt }: { modus: Modus; laeuft: boolean; steigt: number }) {
  const jetzt = typeof performance !== "undefined" ? performance.now() : 0;
  const takt = laeuft ? Math.floor(jetzt / 90) % 2 : 0;

  if (modus === "wasser") {
    // Flossen schlagen immer, schneller beim Schwimmen; die Arme machen Brustzüge.
    const k = Math.sin(jetzt / (laeuft || Math.abs(steigt) > 0.3 ? 90 : 220));
    const zug = Math.sin(jetzt / 260);
    return (
      <g>
        {/* Pressluftflasche und Schlauch */}
        <rect x={-15} y={-36} width={7} height={20} rx={3.5} fill="#facc15" stroke="#a16207" strokeWidth={1} />
        <path d="M -12 -36 Q -14 -46 -6 -46" fill="none" stroke="#111827" strokeWidth={2} />
        {/* Beine mit Flossen */}
        <g transform={`rotate(${12 * k} -3 -14)`}>
          <rect x={-7} y={-16} width={6} height={13} fill="#1f2937" />
          <path d="M -8 -3 L 6 -4 L 9 1 L -8 1 Z" fill="#0ea5e9" />
        </g>
        <g transform={`rotate(${-12 * k} 4 -14)`}>
          <rect x={1} y={-16} width={6} height={13} fill="#111827" />
          <path d="M 0 -3 L 14 -4 L 17 1 L 0 1 Z" fill="#0284c7" />
        </g>
        {/* Anzug und Arm */}
        <rect x={-8} y={-33} width={16} height={18} rx={4} fill="#f97316" />
        <rect x={-8} y={-26} width={16} height={3} fill="#111827" />
        <rect x={3} y={-31} width={5} height={13} rx={2} fill="#111827"
          transform={`rotate(${-40 + 50 * zug} 5 -30)`} />
        {/* Taucherhelm mit Sichtfenster */}
        <circle cx={0} cy={-43} r={11} fill="#b45309" stroke="#78350f" strokeWidth={1.5} />
        <circle cx={3} cy={-43} r={6.5} fill="#bae6fd" stroke="#78350f" strokeWidth={1.5} />
        <rect x={4} y={-45} width={2.5} height={2.5} fill="#111" />
        <circle cx={-8} cy={-43} r={1.5} fill="#78350f" />
      </g>
    );
  }

  const inLuft = modus === "luft";
  const bein = inLuft ? 3 : laeuft ? (takt ? 5 : -5) : 0;
  // Flamme: lang beim Steigen, kurz beim Sinken, flackernd.
  const flacker = 0.75 + 0.25 * Math.sin(jetzt / 35) + 0.15 * Math.sin(jetzt / 13);
  const flamme = (steigt > 0.3 ? 16 : steigt < -0.3 ? 5 : 9) * flacker;
  return (
    <g>
      {inLuft && (
        <g>
          {/* Raketenrucksack auf dem Rücken */}
          <path d={`M -15 -18 Q -12.5 ${-18 + 2 * flamme} -10 -18 Z`} fill="#f97316" />
          <path d={`M -14 -18 Q -12.5 ${-18 + 1.2 * flamme} -11 -18 Z`} fill="#fde047" />
          <rect x={-16} y={-36} width={8} height={18} rx={2} fill="#9ca3af" stroke="#4b5563" strokeWidth={1} />
          <rect x={-16} y={-30} width={8} height={3} fill="#dc2626" />
          <rect x={-15} y={-19} width={5} height={3} fill="#4b5563" />
        </g>
      )}
      {/* Beine */}
      <rect x={-7 + (bein > 0 ? -bein / 2 : 0)} y={-16} width={6} height={13} fill="#1d4ed8" />
      <rect x={2 + (bein < 0 ? bein / 2 : 0)} y={-16} width={6} height={13} fill="#1e40af" />
      <rect x={-9 + (bein > 0 ? -bein : 0)} y={-4} width={9} height={4} rx={1.5} fill="#dc2626" />
      <rect x={1 + (bein < 0 ? bein : 0)} y={-4} width={9} height={4} rx={1.5} fill="#dc2626" />
      {/* Körper mit Gurt, Arm in der Luft nach oben gestreckt */}
      <rect x={-8} y={-32} width={16} height={17} rx={3} fill="#16a34a" />
      <rect x={-6} y={-24} width={12} height={3} fill="#facc15" />
      {inLuft && <rect x={-8} y={-32} width={3} height={14} fill="#4b5563" />}
      <rect x={inLuft ? 4 : 3} y={inLuft ? -42 : -30} width={5} height={13} rx={2} fill="#f2c79a" />
      <Kopf />
    </g>
  );
}

/** Floß aus zwei Stämmen, schaukelt auf der Wasseroberfläche. */
function Floss({ x }: { x: number }) {
  const jetzt = typeof performance !== "undefined" ? performance.now() : 0;
  const bob = 1.2 * Math.sin(jetzt / 400);
  return (
    <g transform={`translate(${x} ${bob}) rotate(${1.5 * Math.sin(jetzt / 530)})`} data-testid="floss">
      {/* zwei Stämme längs, mit Seil gebunden */}
      <rect x={-22} y={0} width={44} height={5} rx={2.5} fill="#a16207" stroke="#713f12" strokeWidth={1} />
      <rect x={-20} y={4.5} width={40} height={5} rx={2.5} fill="#92400e" stroke="#713f12" strokeWidth={1} />
      <path d="M -14 -0.5 v 10 M 14 -0.5 v 10" stroke="#fde68a" strokeWidth={1.5} />
      <circle cx={-22} cy={2.5} r={2} fill="#ca8a04" />
      <circle cx={-20} cy={7} r={2} fill="#ca8a04" />
    </g>
  );
}

function Spritzen({ x, alter }: { x: number; alter: number }) {
  const k = alter / 700;
  return (
    <g opacity={1 - k}>
      <ellipse cx={x} cy={2} rx={6 + 22 * k} ry={2 + 4 * k} fill="none" stroke="#e0f2fe" strokeWidth={2} />
      {[-16, -9, -3, 4, 10, 17].map((d, i) => (
        <circle key={i} cx={x + d * (0.4 + 1.2 * k)} cy={-(22 + (i % 3) * 6) * k + 60 * k * k} r={2.2} fill="#e0f2fe" />
      ))}
    </g>
  );
}

function Edelstein({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M 0 -11 L 9 -3 L 0 11 L -9 -3 Z" fill={FARBE.stein} stroke="#0e7490" strokeWidth={1.5} />
      <path d="M -9 -3 L 9 -3 M 0 -11 L -3 -3 L 0 11 M 0 -11 L 3 -3" stroke="#a5f3fc" strokeWidth={1} fill="none" />
    </g>
  );
}

export function Spielfeld({ level, aufgabe, zustand, effekt, demo = false, maxHoehe = "calc(100dvh - 17rem)" }: {
  level: Level; aufgabe: Aufgabe; zustand: Zustand; effekt: Effekt | null; demo?: boolean;
  /** Höchstens so hoch (CSS) — die Breite folgt dem Seitenverhältnis, damit alles auf den Schirm passt. */
  maxHoehe?: string;
}) {
  const { bereich: b } = level;
  const sx = (x: number) => x * U;
  const sy = (y: number) => -y * U;
  const vx0 = sx(b.x0 - 1.2), vx1 = sx(b.x1 + 1);
  const vy0 = sy(b.y1 + 1.8), vy1 = sy(b.y0 - 1);
  const breite = vx1 - vx0, hoehe = vy1 - vy0;
  const { pos, blick, laeuft, steigt, neigung, taucht, blasen, spritzer } = useAnzeige(zustand.held, effekt);

  const basisP = basis(aufgabe, zustand);
  const xs = Array.from({ length: b.x1 - b.x0 + 1 }, (_, i) => b.x0 + i);
  const ys = Array.from({ length: b.y1 - b.y0 + 1 }, (_, i) => b.y0 + i);
  const fertig = zustand.gesetzt.every(Boolean);
  const ziel = { x: zustand.held.x, y: zustand.held.y + zustand.sprung };

  // Steigungsdreiecke der gesetzten relativen Punkte
  const dreiecke: { von: P; nach: P }[] = [];
  if (aufgabe.relativAb !== null) {
    for (let i = aufgabe.relativAb; i < aufgabe.ziele.length; i++) {
      if (!zustand.gesetzt[i]) break;
      const von = i === 0 ? aufgabe.start : aufgabe.ziele[i - 1].p;
      if (von) dreiecke.push({ von, nach: aufgabe.ziele[i].p });
    }
  }

  // Ganze Gerade, sobald alles gesetzt ist
  let gerade: { a: P; e: P } | null = null;
  if (fertig && (level.art === "steigung" || level.art === "gerade")) {
    const [z, n] = level.m;
    const p0 = level.art === "steigung" ? level.start : { x: 0, y: level.n };
    const yAt = (x: number) => p0.y + (z / n) * (x - p0.x);
    gerade = { a: { x: b.x0 - 1, y: yAt(b.x0 - 1) }, e: { x: b.x1 + 1, y: yAt(b.x1 + 1) } };
  }

  const fehlsprung = effekt?.ereignis.art === "daneben" ? { id: effekt.id, p: effekt.ereignis.p } : null;
  // Der Hüpfer vom Floß vor dem Abtauchen ist ein Sprung, kein Raketenflug.
  const modus: Modus = pos.y < -0.04 ? "wasser" : pos.y > 0.04 && !taucht ? "luft" : "land";
  // Das Floß gibt es, wo Wasser ist und auf der x-Achse gelaufen wird.
  const floss = b.y0 < 0 && zustand.held.y === 0;
  const jetzt = typeof performance !== "undefined" ? performance.now() : 0;

  return (
    <div className="mx-auto" style={{ width: `min(100%, calc(${maxHoehe} * ${(breite / hoehe).toFixed(4)}))`, minWidth: "min(100%, 16rem)" }}>
    <svg viewBox={`${vx0} ${vy0} ${breite} ${hoehe}`} className="block w-full h-auto rounded-xl select-none touch-none"
      role="img" aria-label="Koordinatensystem mit Spielfigur" data-testid="koordinaten-feld">
      <defs>
        <linearGradient id="kl-himmel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={FARBE.himmelOben} /><stop offset="1" stopColor={FARBE.himmel} />
        </linearGradient>
        <linearGradient id="kl-wasser" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={FARBE.wasser} /><stop offset="1" stopColor={FARBE.wasserTief} />
        </linearGradient>
        <clipPath id="kl-rahmen"><rect x={vx0} y={vy0} width={breite} height={hoehe} rx={12} /></clipPath>
      </defs>
      <style>{`
        @keyframes kl-pop { 0% { transform: scale(0); } 70% { transform: scale(1.5); } 100% { transform: scale(1); } }
        @keyframes kl-weg { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
        .kl-pop { transform-box: fill-box; transform-origin: center; animation: kl-pop 350ms ease-out; }
        .kl-weg { animation: kl-weg 1400ms ease-in forwards; }
      `}</style>

      <g clipPath="url(#kl-rahmen)">
        <rect x={vx0} y={vy0} width={breite} height={sy(0) - vy0} fill="url(#kl-himmel)" />
        {b.y0 < 0
          ? <rect x={vx0} y={sy(0)} width={breite} height={vy1 - sy(0)} fill="url(#kl-wasser)" />
          : <>
            <rect x={vx0} y={sy(0)} width={breite} height={vy1 - sy(0)} fill={FARBE.erde} />
            <rect x={vx0} y={sy(0)} width={breite} height={6} fill={FARBE.gras} />
          </>}

        {/* Raster */}
        {xs.map(x => (
          <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={sy(b.y1 + 0.5)} y2={sy(Math.min(b.y0, 0) - 0.5)}
            stroke={FARBE.raster} strokeOpacity={b.y0 < 0 ? 0.45 : 0.6} strokeWidth={1} />
        ))}
        {ys.map(y => (
          <line key={`gy${y}`} x1={sx(b.x0 - 0.5)} x2={sx(b.x1 + 0.5)} y1={sy(y)} y2={sy(y)}
            stroke={y < 0 ? FARBE.rasterUnten : FARBE.raster} strokeOpacity={0.45} strokeWidth={1} />
        ))}

        {/* Achsen mit Pfeil und Zahlen */}
        <line x1={sx(b.x0 - 0.8)} x2={sx(b.x1 + 0.7)} y1={0} y2={0} stroke={FARBE.achse} strokeWidth={2.5} />
        <path d={`M ${sx(b.x1 + 0.85)} 0 l -10 -5 l 0 10 z`} fill={FARBE.achse} />
        <text x={sx(b.x1 + 0.7)} y={-8} fontSize={15} fontWeight={800} fill={FARBE.achse} textAnchor="end">x</text>
        {b.x0 <= 0 && b.x1 >= 0 && <>
          <line x1={0} x2={0} y1={sy(b.y0 - 0.8)} y2={sy(b.y1 + 0.7)} stroke={FARBE.achse} strokeWidth={2.5} />
          <path d={`M 0 ${sy(b.y1 + 0.85)} l -5 10 l 10 0 z`} fill={FARBE.achse} />
          <text x={8} y={sy(b.y1 + 0.6)} fontSize={15} fontWeight={800} fill={FARBE.achse}>y</text>
        </>}
        {xs.map(x => (
          <g key={`lx${x}`}>
            <line x1={sx(x)} x2={sx(x)} y1={-4} y2={4} stroke={FARBE.achse} strokeWidth={1.5} />
            {x !== 0 && <text x={sx(x)} y={18} fontSize={12} fontWeight={700} textAnchor="middle"
              fill={b.y0 < 0 ? "#ffffff" : "#fef3c7"}>{x < 0 ? "−" + -x : x}</text>}
          </g>
        ))}
        {ys.filter(y => y !== 0).map(y => (
          <g key={`ly${y}`}>
            <line x1={-4} x2={4} y1={sy(y)} y2={sy(y)} stroke={FARBE.achse} strokeWidth={1.5} />
            <text x={-8} y={sy(y) + 4} fontSize={12} fontWeight={700} textAnchor="end"
              fill={y < 0 ? "#ffffff" : FARBE.achse}>{y < 0 ? "−" + -y : y}</text>
          </g>
        ))}
        <text x={-7} y={17} fontSize={12} fontWeight={700} textAnchor="end" fill={b.y0 < 0 ? "#ffffff" : "#fef3c7"}>0</text>

        {/* Spiegelachse */}
        {level.art === "spiegeln" && (() => {
          const a = level.achse;
          const st = { stroke: "#7c3aed", strokeWidth: 3, strokeDasharray: "10 6" };
          if (a.art === "y" || a.art === "senkrecht") {
            const k = a.art === "y" ? 0 : a.k;
            return <line x1={sx(k)} x2={sx(k)} y1={sy(b.y1 + 0.6)} y2={sy(b.y0 - 0.6)} {...st} />;
          }
          if (a.art === "x" || a.art === "waagerecht") {
            const k = a.art === "x" ? 0 : a.k;
            return <line x1={sx(b.x0 - 0.6)} x2={sx(b.x1 + 0.6)} y1={sy(k)} y2={sy(k)} {...st} />;
          }
          return <circle cx={0} cy={0} r={8} fill="none" stroke="#7c3aed" strokeWidth={3} />;
        })()}

        {/* Vorlage (Spiegeln) */}
        {aufgabe.vorlage.length > 0 && aufgabe.linien.map((pl, k) => (
          <polyline key={`vl${k}`} points={pl.map(i => `${sx(aufgabe.vorlage[i].p.x)},${sy(aufgabe.vorlage[i].p.y)}`).join(" ")}
            fill="none" stroke={FARBE.vorlage} strokeWidth={3} strokeLinejoin="round" />
        ))}
        {aufgabe.vorlage.map(v => (
          <g key={`v${v.name}`}>
            <circle cx={sx(v.p.x)} cy={sy(v.p.y)} r={5} fill={FARBE.vorlage} />
            <text x={sx(v.p.x) - 8} y={sy(v.p.y) - 8} fontSize={13} fontWeight={800} fill={FARBE.vorlage} textAnchor="end">{v.name}</text>
          </g>
        ))}

        {/* Linien der Figur, Stück für Stück */}
        {aufgabe.linien.flatMap((pl, k) => pl.slice(1).map((j, s) => {
          const i = pl[s];
          if (!zustand.gesetzt[i] || !zustand.gesetzt[j]) return null;
          const a = aufgabe.ziele[i].p, e = aufgabe.ziele[j].p;
          return <line key={`l${k}-${s}`} x1={sx(a.x)} y1={sy(a.y)} x2={sx(e.x)} y2={sy(e.y)}
            stroke={FARBE.linie} strokeWidth={3.5} strokeLinecap="round" />;
        }))}

        {/* Ganze Gerade */}
        {gerade && <line x1={sx(gerade.a.x)} y1={sy(gerade.a.y)} x2={sx(gerade.e.x)} y2={sy(gerade.e.y)}
          stroke={FARBE.gerade} strokeWidth={2.5} />}

        {/* Steigungsdreiecke */}
        {dreiecke.map(({ von, nach }, k) => (
          <g key={`d${k}`}>
            <line x1={sx(von.x)} y1={sy(von.y)} x2={sx(nach.x)} y2={sy(von.y)} stroke={FARBE.laufen} strokeWidth={3} strokeDasharray="6 4" />
            <line x1={sx(nach.x)} y1={sy(von.y)} x2={sx(nach.x)} y2={sy(nach.y)} stroke={FARBE.springen} strokeWidth={3} strokeDasharray="6 4" />
            <line x1={sx(von.x)} y1={sy(von.y)} x2={sx(nach.x)} y2={sy(nach.y)} stroke={FARBE.linie} strokeWidth={3} />
          </g>
        ))}
        {aufgabe.start && (
          <g>
            <circle cx={sx(aufgabe.start.x)} cy={sy(aufgabe.start.y)} r={6} fill={FARBE.punkt} />
            <text x={sx(aufgabe.start.x) - 8} y={sy(aufgabe.start.y) - 8} fontSize={13} fontWeight={800} textAnchor="end" fill="#111">A</text>
          </g>
        )}

        {/* Laufweg vom letzten Punkt (Steigung) */}
        {basisP && !fertig && zustand.held.x !== basisP.x && (
          <line x1={sx(basisP.x)} y1={sy(basisP.y)} x2={sx(zustand.held.x)} y2={sy(basisP.y)}
            stroke={FARBE.laufen} strokeWidth={4} strokeDasharray="8 5" />
        )}

        {/* Sichtbare Edelsteine */}
        {level.art === "setzen" && level.sichtbar && aufgabe.ziele.map((t, i) => !zustand.gesetzt[i] && (
          <Edelstein key={`e${t.name}`} x={sx(t.p.x)} y={sy(t.p.y)} />
        ))}

        {/* Gesetzte Punkte */}
        {aufgabe.ziele.map((t, i) => zustand.gesetzt[i] && (
          <g key={`p${t.name}`}>
            <circle cx={sx(t.p.x)} cy={sy(t.p.y)} r={6.5} fill={FARBE.punkt} stroke="#fff" strokeWidth={2} className="kl-pop" />
            <text x={sx(t.p.x) + 9} y={sy(t.p.y) - 9} fontSize={13} fontWeight={800} fill="#111"
              stroke="#fff" strokeWidth={3} paintOrder="stroke">{t.name}</text>
          </g>
        ))}

        {/* Sprungziel: wohin die Füße kommen */}
        {!fertig && zustand.sprung !== 0 && (
          <g>
            <line x1={sx(ziel.x)} y1={sy(zustand.held.y)} x2={sx(ziel.x)} y2={sy(ziel.y)}
              stroke={zustand.sprung > 0 ? FARBE.springen : "#e0f2fe"} strokeWidth={3} strokeDasharray="3 5" />
            <circle cx={sx(ziel.x)} cy={sy(ziel.y)} r={9} fill="none"
              stroke={zustand.sprung > 0 ? FARBE.springen : "#e0f2fe"} strokeWidth={3} />
            <text x={sx(ziel.x) + 14} y={sy(ziel.y) + 5} fontSize={14} fontWeight={900}
              fill={zustand.sprung > 0 ? FARBE.springen : "#ffffff"} stroke={zustand.sprung > 0 ? "#fff" : FARBE.wasserTief}
              strokeWidth={3} paintOrder="stroke">
              {zustand.sprung > 0 ? `↑ ${zustand.sprung}` : `↓ ${-zustand.sprung}`}
            </text>
          </g>
        )}

        {/* Fehlsprung */}
        {fehlsprung && (
          <g key={`f${fehlsprung.id}`} className="kl-weg">
            <path d={`M ${sx(fehlsprung.p.x) - 8} ${sy(fehlsprung.p.y) - 8} l 16 16 m 0 -16 l -16 16`}
              stroke="#dc2626" strokeWidth={4} strokeLinecap="round" />
          </g>
        )}

        {/* Luftblasen, Floß, Spritzer, Figur */}
        {blasen.map((bl, i) => (
          <circle key={`b${bl.t0}-${i}`} cx={sx(bl.x) + 3 * Math.sin((jetzt - bl.t0) / 180)} cy={sy(bl.y)} r={bl.r}
            fill="#e0f2fe" fillOpacity={0.25} stroke="#e0f2fe" strokeWidth={1} />
        ))}
        {floss && <Floss x={sx(pos.x)} />}
        <g transform={`translate(${sx(pos.x)} ${sy(pos.y)}) rotate(${neigung}) scale(${blick} 1)`} data-testid="figur"
          data-modus={modus} opacity={demo ? 0.95 : 1}>
          <Figur modus={modus} laeuft={laeuft} steigt={steigt} />
        </g>
        {spritzer.map(sp => <Spritzen key={`s${sp.t0}`} x={sx(sp.x)} alter={jetzt - sp.t0} />)}

        {/* Gerade beschriften */}
        {gerade && level.art === "gerade" && (
          <text x={sx(b.x1 + 0.6)} y={sy(gerade.e.y - 0.4) < vy0 + 20 ? vy0 + 20 : sy(gerade.e.y - 0.4)} fontSize={15}
            fontWeight={900} textAnchor="end" fill={FARBE.gerade} stroke="#fff" strokeWidth={3} paintOrder="stroke">
            {geradeText(level.m, level.n)}
          </text>
        )}
      </g>
      {/* unsichtbar: nächstes Ziel für Tests und Vorlesehilfen */}
      <desc>{(() => {
        const i = naechstes(aufgabe, zustand);
        return i < 0 ? "fertig" : `nächstes Ziel ${aufgabe.ziele[i].name}`;
      })()}</desc>
    </svg>
    </div>
  );
}

function geradeText([z, n]: [number, number], b: number) {
  const az = Math.abs(z);
  const m = n === 1 ? (az === 1 ? "" : String(az)) : `${az}/${n}·`;
  const plus = b === 0 ? "" : b > 0 ? ` + ${b}` : ` − ${-b}`;
  return `y = ${z < 0 ? "−" : ""}${m}x${plus}`;
}

