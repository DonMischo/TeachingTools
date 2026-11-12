"use client";
/**
 * Zeichenbausteine für »Druck & Strömung«: Rohre aus einem Guss (runde Bögen,
 * Muffen, Glanzlicht, fließende Bläschen), Handräder zum Anklicken,
 * Manometer mit Skala, Pumpe mit drehendem Laufrad, Glasbehälter mit der
 * WebGL-Flüssigkeit aus `components/fluessigkeit`, Hahn, Hintergründe.
 * Alles SVG; Farben, die vom Farbschema abhängen, nur per style (var() in
 * SVG-Attributen geht nicht).
 */
import { useEffect, useRef, type ReactNode } from "react";
import Fluessigkeit, { type Zufluss } from "../fluessigkeit/Fluessigkeit";

export const FARBE = {
  wasser: "#3b9fe0", wasserHell: "#8fd0ff", oel: "#e0a43a", luft: "#c9d6df", heiss: "#e5533d", kalt: "#3d7fe5",
  metall: "#a7b1bb", gehaeuse: "#3f4a55", messing: "#c9a227", rot: "#c0392b", gruen: "#2e9e3e",
};

/** Einmal je SVG: Verläufe und Schatten. */
export function KitDefs({ id = "kit" }: { id?: string }) {
  return (
    <defs>
      <filter id={`${id}-schatten`} x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.28" />
      </filter>
      <filter id={`${id}-glut`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <linearGradient id={`${id}-metall`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d9dfe5" /><stop offset="0.45" stopColor="#a7b1bb" /><stop offset="1" stopColor="#5d6873" />
      </linearGradient>
      <linearGradient id={`${id}-metallQuer`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#5d6873" /><stop offset="0.35" stopColor="#d9dfe5" /><stop offset="1" stopColor="#5d6873" />
      </linearGradient>
      <linearGradient id={`${id}-glas`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" /><stop offset="0.18" stopColor="#ffffff" stopOpacity="0.06" />
        <stop offset="0.8" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#ffffff" stopOpacity="0.22" />
      </linearGradient>
      <radialGradient id={`${id}-zifferblatt`} cx="0.4" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dde3e8" />
      </radialGradient>
      <radialGradient id={`${id}-pumpe`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#6fa8e8" /><stop offset="1" stopColor="#1d4f8f" />
      </radialGradient>
    </defs>
  );
}

/**
 * Rohr entlang eines SVG-Pfads. Mehrere Rohre, die sich treffen, wirken wie aus
 * einem Stück, wenn an der Stelle eine `Muffe` sitzt. `merke` bekommt den Pfad
 * mit den Bläschen (für useFliessen).
 */
export function Rohr({ d, w = 14, fluessig = FARBE.wasser, leer = false, merke, id = "kit" }: {
  d: string; w?: number; fluessig?: string; leer?: boolean; merke?: (el: SVGPathElement | null) => void; id?: string;
}) {
  return (
    <g>
      <path d={d} fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={w + 8} strokeLinejoin="round" strokeLinecap="round" transform="translate(2 4)" filter={`url(#${id}-glut)`} />
      <path d={d} fill="none" stroke={FARBE.gehaeuse} strokeWidth={w + 6} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={FARBE.metall} strokeWidth={w + 3} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={leer ? "#e9eef2" : fluessig} strokeWidth={w - 1} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.32} strokeWidth={Math.max(1.5, w * 0.2)} strokeLinejoin="round" strokeLinecap="round" />
      {merke && <path ref={merke} d={d} fill="none" stroke="#ffffff" strokeOpacity={0} strokeWidth={Math.max(2, w * 0.36)} strokeDasharray={`0 ${Math.max(10, w * 1.3)}`} strokeLinecap="round" />}
    </g>
  );
}

export function Muffe({ x, y, w = 14 }: { x: number; y: number; w?: number }) {
  return <circle cx={x} cy={y} r={w / 2 + 5} fill={FARBE.metall} stroke={FARBE.gehaeuse} strokeWidth={2.5} />;
}

/** Handrad zum Anklicken: rot, dreht sich mit der Öffnung (0…1). */
export function Handrad({ x, y, offen, r = 15, onClick, titel }: { x: number; y: number; offen: number; r?: number; onClick?: () => void; titel?: string }) {
  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : undefined }} role={onClick ? "button" : undefined} aria-label={titel}>
      {titel && <title>{titel}</title>}
      <circle cx={x} cy={y} r={r + 8} fill="transparent" />
      <line x1={x} y1={y + r * 0.2} x2={x} y2={y + r + 8} stroke={FARBE.gehaeuse} strokeWidth={5} />
      <g style={{ transform: `rotate(${offen * 300}deg)`, transformOrigin: `${x}px ${y}px`, transition: "transform 0.5s ease" }}>
        <circle cx={x} cy={y} r={r} fill="none" stroke={offen > 0 ? FARBE.rot : "#7b241c"} strokeWidth={4.5} />
        {[0, 60, 120].map(a => (
          <line key={a} x1={x - r * Math.cos(a * Math.PI / 180)} y1={y - r * Math.sin(a * Math.PI / 180)} x2={x + r * Math.cos(a * Math.PI / 180)} y2={y + r * Math.sin(a * Math.PI / 180)} stroke={FARBE.rot} strokeWidth={2.5} />
        ))}
        <circle cx={x} cy={y} r={3.5} fill={FARBE.gehaeuse} />
      </g>
    </g>
  );
}

/** Manometer mit Skala 0…max (in der Anzeigeeinheit), roter Bereich ab 80 %. */
export function Manometer({ x, y, wert, max, einheit = "bar", r = 24, id = "kit", beschriftung }: {
  x: number; y: number; wert: number; max: number; einheit?: string; r?: number; id?: string; beschriftung?: ReactNode;
}) {
  const winkel = (v: number) => -135 + 270 * Math.max(0, Math.min(1.04, v / max));
  const polar = (a: number, rr: number) => [x + rr * Math.sin(a * Math.PI / 180), y - rr * Math.cos(a * Math.PI / 180)];
  const bogen = (a0: number, a1: number, rr: number) => { const [x0, y0] = polar(a0, rr), [x1, y1] = polar(a1, rr); return `M${x0} ${y0} A${rr} ${rr} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
  return (
    <g filter={`url(#${id}-schatten)`}>
      <circle cx={x} cy={y} r={r + 3} fill={`url(#${id}-metall)`} stroke={FARBE.gehaeuse} strokeWidth={1.5} />
      <circle cx={x} cy={y} r={r} fill={`url(#${id}-zifferblatt)`} />
      <path d={bogen(winkel(max * 0.8), winkel(max), r - 4)} fill="none" stroke="#e5533d" strokeWidth={3} />
      {Array.from({ length: 11 }, (_, i) => {
        const a = -135 + i * 27, [x0, y0] = polar(a, r - 2), [x1, y1] = polar(a, r - (i % 2 ? 5 : 8));
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#2f3740" strokeWidth={i % 2 ? 1 : 1.8} />;
      })}
      <text x={x} y={y + r * 0.5} textAnchor="middle" fontSize={r * 0.3} fill="#56616d">{einheit}</text>
      <g style={{ transform: `rotate(${winkel(wert)}deg)`, transformOrigin: `${x}px ${y}px`, transition: "transform 0.35s ease-out" }}>
        <path d={`M${x - 2.2} ${y + 4} L${x} ${y - r + 6} L${x + 2.2} ${y + 4} Z`} fill="#c0392b" />
      </g>
      <circle cx={x} cy={y} r={3.2} fill="#2f3740" />
      <path d={bogen(-60, 10, r - 3)} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={2} />
      {beschriftung}
    </g>
  );
}

/** Kreiselpumpe: Spiralgehäuse mit Laufrad, das sich dreht, solange sie fördert. */
export function Pumpe({ x, y, r = 24, laeuft, id = "kit" }: { x: number; y: number; r?: number; laeuft: boolean; id?: string }) {
  return (
    <g filter={`url(#${id}-schatten)`}>
      <circle cx={x} cy={y} r={r} fill={`url(#${id}-pumpe)`} stroke="#123a6b" strokeWidth={2.5} />
      <g className={laeuft ? "animate-spin" : undefined} style={{ transformOrigin: `${x}px ${y}px`, animationDuration: "0.8s" }}>
        {[0, 72, 144, 216, 288].map(a => (
          <path key={a} d={`M${x} ${y} q ${r * 0.35} ${-r * 0.15} ${r * 0.62} ${r * 0.05}`} stroke="#e8f1fb" strokeWidth={3} fill="none" strokeLinecap="round" transform={`rotate(${a} ${x} ${y})`} />
        ))}
      </g>
      <circle cx={x} cy={y} r={r * 0.18} fill="#e8f1fb" />
      <path d={`M${x - r * 0.7} ${y - r * 0.55} A${r * 0.9} ${r * 0.9} 0 0 1 ${x + r * 0.2} ${y - r * 0.9}`} stroke="#fff" strokeOpacity={0.45} strokeWidth={3} fill="none" />
    </g>
  );
}

/** Glasgefäß mit wirbelnder WebGL-Flüssigkeit (ohne WebGL: Farbverlauf). */
export function GlasTank({ x, y, breite, hoehe, fuell, farbe = FARBE.wasser, zufluss = null, wirbel = 0.2, skala = true, id = "kit" }: {
  x: number; y: number; breite: number; hoehe: number; fuell: number; farbe?: string; zufluss?: Zufluss | null; wirbel?: number; skala?: boolean; id?: string;
}) {
  return (
    <g>
      <rect x={x - 3} y={y} width={breite + 6} height={hoehe + 4} rx={8} fill="#000" opacity={0.18} transform="translate(3 5)" />
      <foreignObject x={x} y={y} width={breite} height={hoehe}>
        <Fluessigkeit farbe={farbe} fuellstand={fuell} breite={breite} hoehe={hoehe} wirbel={wirbel} zufluss={zufluss} />
      </foreignObject>
      <rect x={x} y={y} width={breite} height={hoehe} rx={6} fill={`url(#${id}-glas)`} stroke="#c6d3dd" strokeWidth={2.5} />
      {skala && Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={x + breite - (i % 2 ? 6 : 10)} y1={y + hoehe - ((i + 1) * hoehe) / 10} x2={x + breite - 2} y2={y + hoehe - ((i + 1) * hoehe) / 10} stroke="#ffffff" strokeOpacity={0.7} strokeWidth={1.2} />
      ))}
    </g>
  );
}

/** Wasserhahn: klickbarer Griff, Strahl je nach Durchfluss (0…1). */
export function Hahn({ x, y, offen, strahl, onClick, farbe = FARBE.wasser, titel }: { x: number; y: number; offen: boolean; strahl: number; onClick?: () => void; farbe?: string; titel?: string }) {
  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : undefined }} role={onClick ? "button" : undefined} aria-label={titel}>
      {titel && <title>{titel}</title>}
      <rect x={x - 6} y={y - 26} width={60} height={56} fill="transparent" />
      <path d={`M${x} ${y - 7} H${x + 30} q 10 0 10 10 V${y + 12} H${x + 30} V${y + 7} H${x} Z`} fill={`url(#kit-metall)`} stroke={FARBE.gehaeuse} strokeWidth={1.5} />
      <rect x={x + 10} y={y - 15} width={8} height={8} fill={FARBE.gehaeuse} />
      <g style={{ transform: `rotate(${offen ? -70 : 0}deg)`, transformOrigin: `${x + 14}px ${y - 16}px`, transition: "transform 0.3s" }}>
        <rect x={x + 2} y={y - 21} width={26} height={7} rx={3.5} fill={offen ? FARBE.gruen : FARBE.rot} />
      </g>
      {strahl > 0.01 && (
        <path d={`M${x + 35} ${y + 12} q ${2 + strahl * 4} ${18 + strahl * 20} ${strahl * 10} ${30 + strahl * 40}`} fill="none" stroke={farbe} strokeWidth={2 + strahl * 7} strokeLinecap="round" opacity={0.85}>
          <animate attributeName="stroke-dasharray" values="4 3;3 4;4 3" dur="0.4s" repeatCount="indefinite" />
        </path>
      )}
    </g>
  );
}

/** Bläschen in Rohren bewegen: Tempo je Schlüssel in px/s (Vorzeichen = Richtung). */
export function useFliessen(tempo: () => Map<string, number>) {
  const pfade = useRef(new Map<string, SVGPathElement>());
  const lage = useRef(tempo);
  lage.current = tempo;
  useEffect(() => {
    const phase = new Map<string, number>();
    let vorher = performance.now(), id = 0;
    const los = (jetzt: number) => {
      const dt = Math.min(0.05, (jetzt - vorher) / 1000);
      vorher = jetzt;
      const t = lage.current();
      for (const [k, el] of pfade.current) {
        const v = t.get(k) ?? 0;
        const p = ((phase.get(k) ?? 0) - v * dt) % 1000;
        phase.set(k, p);
        el.setAttribute("stroke-dashoffset", String(p));
        el.setAttribute("stroke-opacity", Math.abs(v) > 0.5 ? "0.6" : "0");
      }
      id = requestAnimationFrame(los);
    };
    id = requestAnimationFrame(los);
    return () => cancelAnimationFrame(id);
  }, []);
  return (k: string) => (el: SVGPathElement | null) => { if (el) pfade.current.set(k, el); else pfade.current.delete(k); };
}

/** Kulisse: Himmel mit Verlauf und Boden. */
export function Kulisse({ breite, hoehe, boden, nacht = false }: { breite: number; hoehe: number; boden: number; nacht?: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id="kulisseHimmel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={nacht ? "#1b2a44" : "#9fd3f5"} /><stop offset="1" stopColor={nacht ? "#33476b" : "#e9f6ff"} />
        </linearGradient>
        <linearGradient id="kulisseBoden" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7aa35a" /><stop offset="0.08" stopColor="#5f8746" /><stop offset="0.1" stopColor="#8b6b4a" /><stop offset="1" stopColor="#6b4f35" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={breite} height={boden} fill="url(#kulisseHimmel)" />
      <rect x={0} y={boden} width={breite} height={hoehe - boden} fill="url(#kulisseBoden)" />
    </g>
  );
}
