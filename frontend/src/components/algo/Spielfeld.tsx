"use client";
/**
 * Das Spielfeld des Code-Abenteuers — eine SVG-Karte im Look des gewählten Themas.
 * Figur und Gegner gleiten per CSS-Übergang; die Drehung wird aufsummiert,
 * damit die Figur nie »den langen Weg« herumdreht.
 */
import { useRef } from "react";
import { gegnerFeld, type Karte, type Zustand } from "@/lib/algo/spiel";
import type { Thema } from "@/lib/algo/themen";

const C = 48;
const EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function Emoji({ x, y, z, groesse = 30 }: { x: number; y: number; z: string; groesse?: number }) {
  return (
    <text x={x * C + C / 2} y={y * C + C / 2 + 2} textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: groesse, fontFamily: EMOJI, pointerEvents: "none" }}>{z}</text>
  );
}

export default function Spielfeld({
  karte, z, thema, dauer = 300, onFeld, markiert, fehler,
}: {
  karte: Karte;
  z: Zustand;
  thema: Thema;
  dauer?: number;
  /** Klick auf ein Feld (Vorhersage-Aufgaben) */
  onFeld?: (x: number, y: number) => void;
  markiert?: { x: number; y: number; ok?: boolean } | null;
  fehler?: boolean;
}) {
  const f = thema.farben;
  const h = karte.zeilen.length, b = Math.max(...karte.zeilen.map(z => z.length));
  const winkel = useRef({ r: z.r, summe: z.r * 90 });
  if (winkel.current.r !== z.r) {
    let d = (z.r - winkel.current.r + 4) % 4;
    if (d === 3) d = -1;
    winkel.current = { r: z.r, summe: winkel.current.summe + d * 90 };
  }
  const genommen = new Set(z.genommen);
  const felder = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < b; x++) {
      const c = karte.zeilen[y][x] ?? "#";
      const wand = c === "#";
      felder.push(
        <rect key={`f${x},${y}`} x={x * C} y={y * C} width={C} height={C}
          rx={wand ? 6 : 0}
          style={{ fill: wand ? f.wand : f.boden, stroke: wand ? f.wandKante : f.linie, strokeWidth: wand ? 1.5 : 1, cursor: onFeld && !wand ? "pointer" : undefined }}
          onClick={onFeld && !wand ? () => onFeld(x, y) : undefined} />,
      );
      const ding = (c === "a" || c === "b") && !genommen.has(`${x},${y}`);
      if (ding) felder.push(<Emoji key={`d${x},${y}`} x={x} y={y} z={c === "a" ? thema.a : thema.b} groesse={28} />);
      if (c === "x") felder.push(<Emoji key={`g${x},${y}`} x={x} y={y} z={thema.gefahr} groesse={30} />);
      if (c === "Z") felder.push(<Emoji key={`z${x},${y}`} x={x} y={y} z={thema.ziel} groesse={30} />);
    }
  }
  const gleiten = (x: number, y: number) => ({
    transform: `translate(${x * C}px, ${y * C}px)`,
    transition: `transform ${dauer}ms ease-in-out`,
  });
  return (
    <svg viewBox={`0 0 ${b * C} ${h * C}`} className="w-full h-auto max-h-[60vh] rounded-xl select-none"
      style={{ background: f.grund }} role="img" aria-label="Spielfeld" data-testid="algo-spielfeld">
      <g style={{ pointerEvents: onFeld ? undefined : "none" }}>{felder}</g>
      {markiert && (
        <rect x={markiert.x * C + 3} y={markiert.y * C + 3} width={C - 6} height={C - 6} rx={8}
          style={{ fill: "none", stroke: markiert.ok === undefined ? f.akzent : markiert.ok ? "#22c55e" : "#ef4444", strokeWidth: 4, pointerEvents: "none" }} />
      )}
      {(karte.gegner ?? []).map((g, i) => {
        const [gx, gy] = gegnerFeld(g, z.gegner[i] ?? 0);
        return (
          <g key={`e${i}`} style={{ ...gleiten(gx, gy), pointerEvents: "none" }}>
            <Emoji x={0} y={0} z={thema.gegner} groesse={32} />
          </g>
        );
      })}
      <g style={{ ...gleiten(z.x, z.y), pointerEvents: "none" }} data-testid="algo-figur">
        <g style={{ transform: `translate(${C / 2}px, ${C / 2}px) rotate(${winkel.current.summe}deg)`, transition: `transform ${dauer}ms ease-in-out` }}>
          {thema.figur === null ? <Mampfi /> : (
            <polygon points={`0,${-C / 2 + 1} -7,${-C / 2 + 10} 7,${-C / 2 + 10}`} style={{ fill: f.akzent }} />
          )}
        </g>
        {thema.figur !== null && <Emoji x={0} y={0} z={thema.figur} groesse={30} />}
        {fehler && <Emoji x={0.32} y={-0.32} z="💥" groesse={20} />}
      </g>
    </svg>
  );
}

/** Eigene Figur für Labyrinthien: ein gelber Kreis mit Mund in Blickrichtung (nach oben = 0°). */
function Mampfi() {
  const r = C * 0.38;
  // Mund öffnet nach oben; die Gruppe dreht ihn in die Blickrichtung.
  const a = (35 * Math.PI) / 180;
  const p = `M0,0 L${-r * Math.sin(a)},${-r * Math.cos(a)} A${r},${r} 0 1,0 ${r * Math.sin(a)},${-r * Math.cos(a)} Z`;
  return (
    <g>
      <path d={p} style={{ fill: "#facc15", stroke: "#a16207", strokeWidth: 1.5 }} />
      <circle cx={-r * 0.45} cy={-r * 0.05} r={3} style={{ fill: "#1f2937" }} />
    </g>
  );
}
