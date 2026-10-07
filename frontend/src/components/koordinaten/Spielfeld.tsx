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

/* ── Bewegung ──────────────────────────────────────────────────────────────── */

/** Ein Stück eines Sprungs: Dauer und Ort über u ∈ [0, 1]. */
type Abschnitt = { ms: number; ort: (u: number) => { x: number; y: number; neigung: number }; bremst?: boolean };
type Sprung = { t0: number; abschnitte: Abschnitt[]; dauer: number; taucht: boolean };
type Blase = { x: number; y: number; t0: number; r: number };
type Spritzer = { x: number; t0: number };
type Rauch = { x: number; y: number; t0: number };

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

/**
 * Der Weg von y0 nach y1, an der Wasseroberfläche geteilt:
 *  - Luft, aufwärts: Wurfparabel — schnell los, zum Scheitel hin immer langsamer.
 *    Höhere Sprünge dauern länger (Steigzeit wächst mit der Wurzel der Höhe).
 *  - Luft, abwärts: fallen, kurz vor dem Ziel bremst der Raketenrucksack.
 *  - Wasser: gemächlich, sanft an- und abschwellend, mit Schaukeln.
 */
function wege(x: number, y0: number, y1: number): Abschnitt[] {
  if (y0 === y1) return [];
  if (y0 < 0 !== y1 < 0 && y0 !== 0 && y1 !== 0) return [...wege(x, y0, 0), ...wege(x, 0, y1)];
  const d = Math.abs(y1 - y0);
  if (Math.min(y0, y1) < 0) {
    const ab = y1 < y0;
    const wellen = Math.max(1, d / 1.5);
    return [{
      // Langsam, aber tiefe Tauchgänge nicht endlos: Dauer wächst mit der Wurzel der Tiefe.
      ms: 1000 + 650 * Math.sqrt(d),
      ort: u => ({
        x: x + 0.07 * Math.sin(u * Math.PI * 2 * wellen),
        y: y0 + (y1 - y0) * easeInOut(u),
        neigung: (ab ? 9 : -6) * Math.sin(u * Math.PI * 2 * wellen),
      }),
    }];
  }
  if (y1 > y0) {
    return [{ ms: 300 * Math.sqrt(d) + 140, ort: u => ({ x, y: y0 + d * (1 - (1 - u) * (1 - u)), neigung: 0 }) }];
  }
  // Fallen bis 70 % der Zeit, dann Bremsschub
  const s = (u: number) => (u < 0.7 ? 0.85 * (u / 0.7) ** 2 : 0.85 + 0.15 * (1 - (1 - (u - 0.7) / 0.3) ** 2));
  return [
    { ms: (240 * Math.sqrt(d) + 110) * 0.7, ort: u => ({ x, y: y0 - d * s(u * 0.7), neigung: 0 }) },
    { ms: (240 * Math.sqrt(d) + 110) * 0.3, ort: u => ({ x, y: y0 - d * s(0.7 + u * 0.3), neigung: 0 }), bremst: true },
  ];
}

function baueSprung(von: P, apex: number, landung: P, t0: number): Sprung {
  const x = von.x;
  const taucht = apex < von.y && apex < 0;
  const abschnitte: Abschnitt[] = [];
  // Vom Floß (oder Boden) erst ein Hüpfer, dann hinein.
  if (taucht && von.y === 0) {
    abschnitte.push({ ms: 380, ort: u => ({ x, y: 0.55 * Math.sin(u * Math.PI), neigung: 0 }) });
  }
  abschnitte.push(...wege(x, von.y, apex));
  // Am Ziel kurz innehalten: unter Wasser schweben, in der Luft auf dem Feuerstrahl stehen.
  if (apex === von.y) {
    abschnitte.push({ ms: 320, ort: u => ({ x, y: apex + (apex < 0 ? 0.15 : 0.4) * Math.sin(u * Math.PI), neigung: 0 }) });
  } else {
    abschnitte.push({
      ms: apex < 0 ? 650 : 160,
      ort: u => ({ x, y: apex + (apex < 0 ? 0.06 : 0.03) * Math.sin(u * Math.PI * 2), neigung: 0 }),
    });
  }
  abschnitte.push(...wege(landung.x, apex, landung.y));
  return { t0, abschnitte, taucht, dauer: abschnitte.reduce((s, a) => s + a.ms, 0) };
}

function sprungOrt(s: Sprung, jetzt: number): { p: P; neigung: number; bremst: boolean } | null {
  let t = jetzt - s.t0;
  for (const a of s.abschnitte) {
    if (t < a.ms) {
      const o = a.ort(t / a.ms);
      return { p: { x: o.x, y: o.y }, neigung: o.neigung, bremst: !!a.bremst };
    }
    t -= a.ms;
  }
  return null;
}

/** Wo die Figur gerade zu sehen ist — läuft dem Zustand hinterher. Dazu Blasen, Spritzer und Rauch. */
function useAnzeige(held: P, effekt: Effekt | null) {
  const pos = useRef<P>({ ...held });
  const blick = useRef(1);
  const laeuft = useRef(false);
  const steigt = useRef(0);
  const neigung = useRef(0);
  const schwimm = useRef(0);
  const bremst = useRef(false);
  const sprung = useRef<Sprung | null>(null);
  const blasen = useRef<Blase[]>([]);
  const spritzer = useRef<Spritzer[]>([]);
  const rauch = useRef<Rauch[]>([]);
  const letzteBlase = useRef(0);
  const letzterRauch = useRef(0);
  const zuletzt = useRef<number | null>(null);
  const ziel = useRef(held);
  ziel.current = held;
  const [, tick] = useState(0);
  const hatRaf = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function";

  useEffect(() => {
    if (!effekt || effekt.ereignis.art === "nichts" || effekt.id === zuletzt.current) return;
    zuletzt.current = effekt.id;
    sprung.current = baueSprung(effekt.ereignis.von, effekt.ereignis.p.y, effekt.landung, performance.now());
  }, [effekt]);

  useEffect(() => {
    if (!hatRaf) return;
    let id = 0, vorher = performance.now();
    const lauf = (jetzt: number) => {
      const dt = Math.min(0.05, (jetzt - vorher) / 1000);
      vorher = jetzt;
      const alt = pos.current;
      const s = sprung.current;
      const o = s ? sprungOrt(s, jetzt) : null;
      if (s && !o) sprung.current = null;
      if (o) {
        pos.current = o.p; neigung.current = o.neigung; bremst.current = o.bremst;
        laeuft.current = false;
      } else {
        const z = ziel.current, p = pos.current;
        const dx = z.x - p.x, dy = z.y - p.y;
        // Unter Wasser geht es gemächlich voran.
        const schritt = (p.y < -0.04 ? 3.2 : 9) * dt;
        laeuft.current = Math.abs(dx) > 0.01;
        if (Math.abs(dx) > 0.01) blick.current = dx > 0 ? 1 : -1;
        pos.current = {
          x: Math.abs(dx) <= schritt ? z.x : p.x + Math.sign(dx) * schritt,
          y: Math.abs(dy) <= schritt * 1.5 ? z.y : p.y + Math.sign(dy) * schritt * 1.5,
        };
        neigung.current = 0; bremst.current = false;
      }
      const neu = pos.current;
      steigt.current = dt > 0 ? (neu.y - alt.y) / dt : 0;
      // Wer unter Wasser seitwärts schwimmt, legt sich flach.
      const soll = neu.y < -0.3 && laeuft.current ? 65 : 0;
      schwimm.current += Math.sign(soll - schwimm.current) * Math.min(Math.abs(soll - schwimm.current), 260 * dt);
      // Durch die Wasseroberfläche → es spritzt.
      if ((alt.y >= -0.05) !== (neu.y >= -0.05)) spritzer.current.push({ x: neu.x, t0: jetzt });
      spritzer.current = spritzer.current.filter(sp => jetzt - sp.t0 < 700);
      // Unter Wasser steigen Blasen aus dem Atemregler.
      if (neu.y < -0.3 && jetzt - letzteBlase.current > 230) {
        letzteBlase.current = jetzt;
        blasen.current.push({ x: neu.x + 0.25 * blick.current, y: neu.y + 0.9, t0: jetzt, r: 1.5 + Math.random() * 2.5 });
      }
      blasen.current = blasen.current
        .map(bl => ({ ...bl, y: bl.y + 1.3 * dt }))
        .filter(bl => bl.y < -0.05 && jetzt - bl.t0 < 6000);
      // Der Raketenrucksack qualmt, solange er schiebt.
      if (neu.y > 0.1 && (steigt.current > 0.4 || bremst.current) && jetzt - letzterRauch.current > 60) {
        letzterRauch.current = jetzt;
        rauch.current.push({ x: neu.x - 0.3 * blick.current, y: neu.y + 0.2, t0: jetzt });
      }
      rauch.current = rauch.current.filter(r => jetzt - r.t0 < 800);
      tick(n => (n + 1) % 1e6);
      id = requestAnimationFrame(lauf);
    };
    id = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(id);
  }, [hatRaf]);

  if (!hatRaf) {
    return { pos: held, blick: 1, laeuft: false, steigt: 0, neigung: 0, schwimm: 0, bremst: false, taucht: false,
      blasen: [] as Blase[], spritzer: [] as Spritzer[], rauch: [] as Rauch[] };
  }
  return {
    pos: pos.current, blick: blick.current, laeuft: laeuft.current, steigt: steigt.current,
    neigung: neigung.current, schwimm: schwimm.current, bremst: bremst.current, taucht: !!sprung.current?.taucht,
    blasen: blasen.current, spritzer: spritzer.current, rauch: rauch.current,
  };
}

/* ── Figur ─────────────────────────────────────────────────────────────────── */

type Modus = "land" | "luft" | "wasser";

/** Gerätetaucher: Haube, Maske, Atemregler, Flasche, Tarierweste, lange Flossen. */
function Taucher({ jetzt, aktiv }: { jetzt: number; aktiv: boolean }) {
  const k = Math.sin(jetzt / (aktiv ? 150 : 380));     // Flossenschlag
  const zug = Math.sin(jetzt / 420);
  return (
    <g>
      {/* Flasche mit Ventil */}
      <rect x={-18} y={-41} width={9} height={26} rx={4.5} fill="#e5e7eb" stroke="#6b7280" strokeWidth={1} />
      <rect x={-18} y={-33} width={9} height={4} fill="#facc15" />
      <rect x={-15.5} y={-45} width={4} height={5} rx={1} fill="#374151" />
      {/* Schlauch zum Atemregler */}
      <path d="M -13 -45 C -12 -52, 4 -52, 8 -37" fill="none" stroke="#111827" strokeWidth={2.2} />
      {/* Beine im Neoprenanzug, lange Flossen */}
      <g transform={`rotate(${14 * k} -4 -15)`}>
        <rect x={-7} y={-17} width={6} height={14} rx={2} fill="#111827" />
        <path d="M -8 -4 L -2 -4 L 14 -1 L 16 3 L -8 1 Z" fill="#0891b2" stroke="#155e75" strokeWidth={0.8} />
      </g>
      <g transform={`rotate(${-14 * k} 4 -15)`}>
        <rect x={1} y={-17} width={6} height={14} rx={2} fill="#0b1220" />
        <rect x={1} y={-14} width={6} height={2} fill="#22d3ee" />
        <path d="M 0 -4 L 6 -4 L 22 -1 L 24 3 L 0 1 Z" fill="#06b6d4" stroke="#155e75" strokeWidth={0.8} />
        <path d="M 8 -2.5 L 20 0.5 M 8 0 L 20 2" stroke="#a5f3fc" strokeWidth={0.7} />
      </g>
      {/* Anzug, Tarierweste, Bleigurt */}
      <rect x={-8} y={-34} width={16} height={19} rx={4} fill="#111827" />
      <path d="M -8 -30 L -8 -19 L 8 -19 L 8 -30 Q 0 -33 -8 -30 Z" fill="#374151" />
      <rect x={-2} y={-29} width={4} height={2.5} rx={0.8} fill="#facc15" />
      <rect x={-2} y={-24} width={4} height={2.5} rx={0.8} fill="#facc15" />
      <rect x={-8} y={-18} width={16} height={3} fill="#1f2937" />
      <rect x={-4} y={-18.5} width={3} height={4} fill="#9ca3af" />
      <rect x={2} y={-18.5} width={3} height={4} fill="#9ca3af" />
      <rect x={6} y={-33} width={2} height={14} fill="#22d3ee" />
      {/* Arm mit Handschuh, langsame Züge */}
      <g transform={`rotate(${-35 + 45 * zug} 5 -31)`}>
        <rect x={3} y={-32} width={5} height={13} rx={2} fill="#111827" />
        <circle cx={5.5} cy={-19} r={2.8} fill="#374151" />
      </g>
      {/* Kopf: Neoprenhaube, Maske mit Band, Atemregler */}
      <rect x={-8} y={-49} width={16} height={17} rx={7} fill="#111827" />
      <path d="M -8 -43 L 2 -43" stroke="#facc15" strokeWidth={2} />
      <rect x={1} y={-46} width={10} height={8} rx={3} fill="#bae6fd" stroke="#0f172a" strokeWidth={1.8} />
      <rect x={3} y={-45} width={3} height={2.5} rx={1} fill="#e0f2fe" opacity={0.9} />
      <circle cx={7} cy={-41.5} r={1.4} fill="#111" />
      <rect x={1} y={-38.5} width={8} height={5} rx={2} fill="#f2c79a" />
      <rect x={6} y={-37} width={5} height={4} rx={1.5} fill="#4b5563" />
      <circle cx={11.5} cy={-35} r={1.6} fill="#9ca3af" />
    </g>
  );
}

/** Pilot mit Lederkappe, Fliegerbrille, Schal und Doppel-Raketenrucksack. */
function Pilot({ jetzt, flamme }: { jetzt: number; flamme: number }) {
  const flattern = Math.sin(jetzt / 70);
  const flacker = 0.8 + 0.2 * Math.sin(jetzt / 31) + 0.12 * Math.sin(jetzt / 11);
  const L = flamme * flacker;
  const duese = (cx: number) => (
    <g key={cx}>
      <path d={`M ${cx - 3} -13 Q ${cx} ${-13 + 2.2 * L} ${cx + 3} -13 Z`} fill="#f97316" />
      <path d={`M ${cx - 2} -13 Q ${cx} ${-13 + 1.5 * L} ${cx + 2} -13 Z`} fill="#fde047" />
      <path d={`M ${cx - 1} -13 Q ${cx} ${-13 + 0.7 * L} ${cx + 1} -13 Z`} fill="#ffffff" />
    </g>
  );
  return (
    <g>
      {/* Schal weht nach hinten */}
      <path d={`M -4 -33 Q -14 ${-36 + 3 * flattern} -24 ${-32 + 5 * flattern} L -23 ${-28 + 5 * flattern} Q -14 ${-31 + 3 * flattern} -4 -30 Z`}
        fill="#dc2626" />
      {/* Doppel-Raketenrucksack */}
      {duese(-18)}{duese(-11)}
      <rect x={-21} y={-39} width={7} height={22} rx={3.5} fill="#6b7280" stroke="#374151" strokeWidth={1} />
      <rect x={-15} y={-39} width={7} height={22} rx={3.5} fill="#d1d5db" stroke="#4b5563" strokeWidth={1} />
      <path d="M -21 -36 Q -17.5 -42 -14 -36 Z M -15 -36 Q -11.5 -42 -8 -36 Z" fill="#dc2626" />
      <path d="M -21 -17 L -15 -17 L -16 -13 L -20 -13 Z M -14 -17 L -8 -17 L -9 -13 L -13 -13 Z" fill="#374151" />
      <rect x={-21} y={-29} width={13} height={2.5} fill="#f59e0b" />
      {/* Beine hängen leicht angewinkelt */}
      <rect x={-6} y={-16} width={6} height={12} fill="#1d4ed8" transform="rotate(8 -3 -16)" />
      <rect x={2} y={-16} width={6} height={12} fill="#1e40af" transform="rotate(-6 5 -16)" />
      <rect x={-8} y={-5} width={9} height={4} rx={1.5} fill="#78350f" />
      <rect x={2} y={-5} width={9} height={4} rx={1.5} fill="#78350f" />
      {/* Fliegerjacke mit Gurt */}
      <rect x={-8} y={-33} width={16} height={18} rx={3} fill="#92400e" />
      <rect x={-8} y={-19} width={16} height={3} fill="#78350f" />
      <path d="M -8 -32 L 7 -20" stroke="#1f2937" strokeWidth={3} />
      <rect x={-1.5} y={-27.5} width={4} height={4} rx={1} fill="#d1d5db" />
      {/* Arm nach vorn oben */}
      <rect x={3} y={-44} width={5} height={14} rx={2} fill="#92400e" />
      <circle cx={5.5} cy={-44} r={2.8} fill="#f2c79a" />
      {/* Kopf: Lederkappe mit Ohrenklappe, Fliegerbrille */}
      <rect x={-7} y={-46} width={14} height={13} rx={4} fill="#f2c79a" />
      <path d="M -9 -40 Q -9 -53 1 -53 Q 10 -53 9 -43 L -9 -43 Z" fill="#7c4a1e" />
      <rect x={-8} y={-43} width={5} height={9} rx={2} fill="#7c4a1e" />
      <path d="M -9 -43 L 9 -43" stroke="#3f2a14" strokeWidth={2.5} />
      <circle cx={5} cy={-42} r={3.8} fill="#7dd3fc" stroke="#b8860b" strokeWidth={1.8} />
      <circle cx={4} cy={-43} r={1.1} fill="#ffffff" />
      <path d="M -1 -36 Q 2 -34 5 -36" stroke="#7c2d12" strokeWidth={1} fill="none" />
    </g>
  );
}

/** An Land: Helm, Fliegerbrille hochgeschoben. */
function Laeufer({ jetzt, laeuft }: { jetzt: number; laeuft: boolean }) {
  const takt = laeuft ? Math.floor(jetzt / 90) % 2 : 0;
  const bein = laeuft ? (takt ? 5 : -5) : 0;
  return (
    <g>
      <rect x={-7 + (bein > 0 ? -bein / 2 : 0)} y={-16} width={6} height={13} fill="#1d4ed8" />
      <rect x={2 + (bein < 0 ? bein / 2 : 0)} y={-16} width={6} height={13} fill="#1e40af" />
      <rect x={-9 + (bein > 0 ? -bein : 0)} y={-4} width={9} height={4} rx={1.5} fill="#dc2626" />
      <rect x={1 + (bein < 0 ? bein : 0)} y={-4} width={9} height={4} rx={1.5} fill="#dc2626" />
      <rect x={-8} y={-32} width={16} height={17} rx={3} fill="#16a34a" />
      <rect x={-6} y={-24} width={12} height={3} fill="#facc15" />
      <rect x={3} y={-30} width={5} height={13} rx={2} fill="#f2c79a" />
      <rect x={-7} y={-45} width={14} height={13} rx={4} fill="#f2c79a" />
      <rect x={2} y={-41} width={3} height={3} fill="#111" />
      <path d="M -9 -42 Q -9 -54 1 -54 Q 10 -54 10 -44 L 10 -42 Z" fill="#facc15" stroke="#a16207" strokeWidth={1} />
      <rect x={-1} y={-54} width={3} height={12} fill="#dc2626" />
      <circle cx={5} cy={-49} r={2.6} fill="#7dd3fc" stroke="#b8860b" strokeWidth={1.2} />
    </g>
  );
}

/** Die Figur, Füße bei (0|0), Blick nach rechts. */
function Figur({ modus, laeuft, steigt, bremst }: { modus: Modus; laeuft: boolean; steigt: number; bremst: boolean }) {
  const jetzt = typeof performance !== "undefined" ? performance.now() : 0;
  if (modus === "wasser") return <Taucher jetzt={jetzt} aktiv={laeuft || Math.abs(steigt) > 0.2} />;
  if (modus === "luft") {
    // Lang beim schnellen Steigen, kürzer zum Scheitel hin, Bremsschub vor der Landung.
    const flamme = bremst ? 13 : steigt > 0.2 ? Math.min(14, 4 + 1.6 * steigt) : steigt < -0.2 ? 2.5 : 5;
    return <Pilot jetzt={jetzt} flamme={flamme} />;
  }
  return <Laeufer jetzt={jetzt} laeuft={laeuft} />;
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
  const { pos, blick, laeuft, steigt, neigung, schwimm, bremst, taucht, blasen, spritzer, rauch } = useAnzeige(zustand.held, effekt);

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
        {rauch.map(r => {
          const k = (jetzt - r.t0) / 800;
          return <circle key={`r${r.t0}`} cx={sx(r.x)} cy={sy(r.y - 0.4 * k)} r={3 + 7 * k} fill="#e5e7eb" fillOpacity={0.55 * (1 - k)} />;
        })}
        {floss && <Floss x={sx(pos.x)} />}
        {/* Schwimmlage dreht um die Körpermitte, Schaukeln um die Füße */}
        <g transform={`translate(${sx(pos.x)} ${sy(pos.y)}) rotate(${neigung}) rotate(${schwimm * blick} 0 -25) scale(${blick} 1)`}
          data-testid="figur" data-modus={modus} opacity={demo ? 0.95 : 1}>
          <Figur modus={modus} laeuft={laeuft} steigt={steigt} bremst={bremst} />
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

