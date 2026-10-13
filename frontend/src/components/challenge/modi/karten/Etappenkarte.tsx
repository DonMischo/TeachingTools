"use client";
/** Kleine Slay-the-Spire-Karte aus dem Markov-Labyrinth: Kampf, Truhe (Bonus-Booster), Lagerfeuer (Wissen nachlesen). */
import { useMemo } from "react";
import { knotenKarte } from "@/lib/challenge/markovKarte";
import { knotenArt, type Raststelle } from "./logik";

const SYMBOL: Record<Raststelle, string> = { kampf: "⚔️", truhe: "🎁", lager: "🔥" };
const NAME: Record<Raststelle, string> = { kampf: "Kampf", truhe: "Truhe: Bonus-Booster", lager: "Lagerfeuer: Wissen nachlesen" };

/** Der Weg zur aktuellen Etappe: vom Start zum ersten Knoten der passenden Schicht. */
export function route(seed: number, etappen: number, etappe: number) {
  const k = knotenKarte(seed, Math.max(2, etappen));
  const ziel = Math.min(Math.max(0, etappe - 1), k.schichten - 1);
  const eltern = new Map(k.kanten.map(([a, b]) => [b, a]));
  const end = k.knoten.filter((n) => n.schicht === ziel).sort((a, b) => a.id - b.id)[0] ?? k.knoten[0];
  const weg: number[] = [];
  for (let n: number | undefined = end.id; n !== undefined; n = eltern.get(n)) weg.unshift(n);
  return { k, weg };
}

/** Anzahl der Truhen auf dem Weg (je Truhe ein Extra-Pick im Booster) und ob ein Lagerfeuer dabei ist. */
export function wegInfo(seed: number, etappen: number, etappe: number) {
  const { weg } = route(seed, etappen, etappe);
  return { truhen: weg.filter((id) => knotenArt(seed, id) === "truhe").length, lager: weg.some((id) => knotenArt(seed, id) === "lager") };
}

export default function Etappenkarte({ seed, etappen, etappe, onLager }: { seed: number; etappen: number; etappe: number; onLager?: () => void }) {
  const { k, weg } = useMemo(() => route(seed, etappen, etappe), [seed, etappen, etappe]);
  const xs = k.knoten.map((n) => n.x), ys = k.knoten.map((n) => n.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const bx = Math.max(1, Math.max(...xs) - x0), by = Math.max(1, Math.max(...ys) - y0);
  const px = (n: { x: number; y: number }) => [14 + ((n.x - x0) / bx) * 272, 14 + ((n.y - y0) / by) * 52];
  const aufWeg = new Set(weg);
  const aktuell = weg[weg.length - 1];
  const lager = weg.some((id) => knotenArt(seed, id) === "lager");
  return (
    <div className="card p-2 flex flex-wrap items-center gap-2" aria-label="Etappenkarte">
      <svg viewBox="0 0 300 80" className="w-full max-w-md h-20" role="img" aria-label={`Etappe ${etappe}`}>
        {k.kanten.map(([a, b]) => {
          const [ax, ay] = px(k.knoten[a]), [cx, cy] = px(k.knoten[b]);
          const fett = aufWeg.has(a) && aufWeg.has(b);
          return <line key={`${a}-${b}`} x1={ax} y1={ay} x2={cx} y2={cy} stroke={fett ? "#d4a017" : "#8a8f98"} strokeWidth={fett ? 3 : 1.5} />;
        })}
        {k.knoten.map((n) => {
          const [cx, cy] = px(n);
          return (
            <g key={n.id} opacity={aufWeg.has(n.id) ? 1 : 0.45}>
              <circle cx={cx} cy={cy} r={n.id === aktuell ? 11 : 8} fill="#fff8e1" stroke={n.id === aktuell ? "#d4a017" : "#8a8f98"} strokeWidth={n.id === aktuell ? 3 : 1.5} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={n.id === aktuell ? 12 : 10}>{SYMBOL[knotenArt(seed, n.id)]}</text>
            </g>
          );
        })}
      </svg>
      <div className="text-xs text-muted">
        {(["kampf", "truhe", "lager"] as Raststelle[]).map((a) => <div key={a}>{SYMBOL[a]} {NAME[a]}</div>)}
        {onLager && lager && <button className="btn-secondary mt-1" onClick={onLager}>🔥 Wissen nachlesen</button>}
      </div>
    </div>
  );
}
