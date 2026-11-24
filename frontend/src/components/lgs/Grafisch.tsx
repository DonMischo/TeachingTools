"use client";
/**
 * Grafisch lösen: jede Gleichung ist eine Gerade, die Lösung ist ihr
 * Schnittpunkt. Parallele Geraden: keine Lösung; dieselbe Gerade: unendlich viele.
 */
import { useState } from "react";
import { gerade, leseGleichung, loeseSystem, qDeutsch, qWert, stelleFrei, gleichungText, type Gleichung } from "@/lib/lgs";
import { GleichungSatz } from "./teile";

const FARBEN = ["#2563eb", "#dc2626"];
const R = 8, W = 480, s = W / (2 * R);
const px = (x: number) => (x + R) * s, py = (y: number) => (R - y) * s;

export function Koordinaten({ gleichungen, punkt, markiert }: { gleichungen: Gleichung[]; punkt?: { x: number; y: number } | null; markiert?: boolean }) {
  const gitter = [];
  for (let i = -R; i <= R; i++) {
    gitter.push(<line key={`v${i}`} x1={px(i)} y1={0} x2={px(i)} y2={W} stroke="var(--color-line)" strokeWidth={i === 0 ? 0 : 1} />);
    gitter.push(<line key={`h${i}`} x1={0} y1={py(i)} x2={W} y2={py(i)} stroke="var(--color-line)" strokeWidth={i === 0 ? 0 : 1} />);
    if (i !== 0 && i % 2 === 0) {
      gitter.push(<text key={`tx${i}`} x={px(i)} y={py(0) + 14} fontSize={11} textAnchor="middle" fill="var(--color-muted)">{i < 0 ? `−${-i}` : i}</text>);
      gitter.push(<text key={`ty${i}`} x={px(0) - 5} y={py(i) + 4} fontSize={11} textAnchor="end" fill="var(--color-muted)">{i < 0 ? `−${-i}` : i}</text>);
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${W}`} className="w-full max-w-[30rem]" role="img" aria-label="Koordinatensystem">
      {gitter}
      <line x1={0} y1={py(0)} x2={W} y2={py(0)} stroke="var(--color-fg)" strokeWidth={1.5} />
      <line x1={px(0)} y1={0} x2={px(0)} y2={W} stroke="var(--color-fg)" strokeWidth={1.5} />
      <text x={W - 6} y={py(0) - 6} textAnchor="end" fontWeight={800} fill="var(--color-fg)">x</text>
      <text x={px(0) + 8} y={14} fontWeight={800} fill="var(--color-fg)">y</text>
      {gleichungen.map((g, i) => {
        const ge = gerade(g);
        const farbe = FARBEN[i % 2];
        if ("senkrecht" in ge) return Number.isFinite(ge.senkrecht)
          ? <line key={i} x1={px(ge.senkrecht)} y1={0} x2={px(ge.senkrecht)} y2={W} stroke={farbe} strokeWidth={3} strokeDasharray={i ? "10 6" : undefined} /> : null;
        return <line key={i} x1={px(-R)} y1={py(ge.m * -R + ge.n)} x2={px(R)} y2={py(ge.m * R + ge.n)} stroke={farbe} strokeWidth={3} strokeDasharray={i ? "10 6" : undefined} />;
      })}
      {punkt && Math.abs(punkt.x) <= R && Math.abs(punkt.y) <= R && (
        <g>
          {markiert && <>
            <line x1={px(punkt.x)} y1={py(punkt.y)} x2={px(punkt.x)} y2={py(0)} stroke="#16a34a" strokeDasharray="4 3" strokeWidth={2} />
            <line x1={px(punkt.x)} y1={py(punkt.y)} x2={px(0)} y2={py(punkt.y)} stroke="#16a34a" strokeDasharray="4 3" strokeWidth={2} />
          </>}
          <circle cx={px(punkt.x)} cy={py(punkt.y)} r={7} fill="#16a34a" stroke="white" strokeWidth={2} />
        </g>
      )}
    </svg>
  );
}

const BEISPIELE = [
  { name: "genau eine Lösung", g: ["2x + y = 7", "x − y = 2"] },
  { name: "keine Lösung", g: ["y = 2x + 1", "−2x + y = −3"] },
  { name: "unendlich viele", g: ["x + 2y = 4", "2x + 4y = 8"] },
  { name: "Lösung mit Bruch", g: ["x + y = 3", "3x − y = 0"] },
];

export default function Grafisch() {
  const [texte, setTexte] = useState(BEISPIELE[0].g);
  const gl = texte.map(leseGleichung);
  const ok = gl.every(Boolean) as boolean;
  const g = gl as Gleichung[];
  const l = ok ? loeseSystem(g[0], g[1]) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      <div className="card p-3"><Koordinaten gleichungen={ok ? g : []} punkt={l?.art === "eine" ? { x: qWert(l.x), y: qWert(l.y) } : null} markiert /></div>
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">{BEISPIELE.map(b => <button key={b.name} className="chip" onClick={() => setTexte(b.g)}>{b.name}</button>)}</div>
        {texte.map((t, i) => {
          const f = gl[i] ? stelleFrei(gl[i]!, "y") : null;
          return (
            <div key={i} className="flex flex-col gap-1">
              <label className="flex items-center gap-2">
                <span className="font-black w-8" style={{ color: FARBEN[i] }}>{i === 0 ? "I" : "II"}</span>
                <input className="input font-mono" value={t} onChange={e => setTexte(x => x.map((y, k) => (k === i ? e.target.value : y)))} aria-label={`Gleichung ${i === 0 ? "I" : "II"}`} />
              </label>
              {!gl[i] ? <span className="text-sm text-bad ml-10">Nicht verstanden — z. B. 2x + y = 7</span>
                : f ? <span className="text-sm ml-10 text-muted">als Gerade: <GleichungSatz text={gleichungText(f.ergebnis)} /></span>
                : <span className="text-sm ml-10 text-muted">senkrechte Gerade (kein y)</span>}
            </div>
          );
        })}
        {l && (
          <div className="rounded-xl bg-page p-3">
            {l.art === "eine" && <p className="font-bold">Die Geraden schneiden sich in S({qDeutsch(l.x)} | {qDeutsch(l.y)}). <span className="font-normal">Genau eine Lösung: x = {qDeutsch(l.x)}, y = {qDeutsch(l.y)}.</span></p>}
            {l.art === "keine" && <p className="font-bold">Die Geraden sind parallel — sie schneiden sich nie. Das System hat keine Lösung.</p>}
            {l.art === "unendlich" && <p className="font-bold">Beide Gleichungen beschreiben dieselbe Gerade — jeder Punkt darauf ist eine Lösung: unendlich viele.</p>}
          </div>
        )}
        <p className="text-sm text-muted">Jedes Zahlenpaar (x | y), das eine Gleichung erfüllt, ist ein Punkt auf ihrer Geraden. Eine Lösung des Systems muss beide erfüllen — also auf beiden Geraden liegen. Grafisch abgelesen ist das Ergebnis aber nur so genau wie die Zeichnung: Brüche sieht man schlecht, rechnen ist sicherer.</p>
      </div>
    </div>
  );
}
