"use client";
/**
 * Blatt »Dreiecksarten«: Ecken ziehen (mit Einrasten an besonderen Lagen) oder
 * per Regler setzen; die Einordnung nach Seiten und nach Winkeln läuft live
 * mit. Gleich lange Seiten bekommen Strichmarken, die Fachbegriffe (Schenkel,
 * Basis, Katheten, Hypotenuse) stehen an den Seiten.
 */
import { z } from "@/lib/prozent";
import {
  ausWinkeln, innenwinkel, nachSeiten, nachWinkeln, seitenLaengen, einrasten,
  SEITEN_NAMEN, WINKEL_NAMEN, type Dreieck, type NachSeiten, type NachWinkeln,
} from "@/lib/dreiecke";
import Zeichenblatt, { FARBE, Keil, Marke, RechterWinkel, SeitenText } from "./Zeichenblatt";
import { useState } from "react";

export const START: Dreieck = [{ x: 1.5, y: 7.5 }, { x: 10.5, y: 7.5 }, { x: 4.5, y: 2 }];

const VORLAGEN: { label: string; d: () => Dreieck }[] = [
  { label: "gleichseitig", d: () => ausWinkeln(7, 60, 60, { x: 2.5, y: 8 }) },
  { label: "gleichschenklig", d: () => ausWinkeln(8, 70, 70, { x: 2, y: 8.2 }) },
  { label: "rechtwinklig", d: () => ausWinkeln(8, 90, 35, { x: 2, y: 8 }) },
  { label: "gleichschenklig-rechtwinklig", d: () => ausWinkeln(8, 45, 45, { x: 2, y: 7.5 }) },
  { label: "stumpfwinklig", d: () => ausWinkeln(9, 25, 120, { x: 1, y: 7.5 }) },
  { label: "unregelmäßig", d: () => START },
];

const ERKLAER_S: Record<NachSeiten, string> = {
  unregelmaessig: "Alle drei Seiten sind verschieden lang.",
  gleichschenklig: "Zwei Seiten sind gleich lang: die Schenkel. Die dritte heißt Basis; die Winkel an der Basis (Basiswinkel) sind gleich groß.",
  gleichseitig: "Alle drei Seiten sind gleich lang, alle Winkel sind 60°. Jedes gleichseitige Dreieck ist auch gleichschenklig.",
};
const ERKLAER_W: Record<NachWinkeln, string> = {
  spitzwinklig: "Alle drei Winkel sind kleiner als 90°.",
  rechtwinklig: "Ein Winkel ist genau 90°. Die Seiten am rechten Winkel heißen Katheten, die gegenüber die Hypotenuse — sie ist die längste Seite.",
  stumpfwinklig: "Ein Winkel ist größer als 90° (stumpf). Mehr als einer geht nicht — zusammen sind es ja nur 180°.",
};

export default function Arten({ d, setD }: { d: Dreieck; setD: (d: Dreieck) => void }) {
  const [rasten, setRasten] = useState(true);
  const s = seitenLaengen(d), w = innenwinkel(d), ns = nachSeiten(d), nw = nachWinkeln(d);
  const [A, B, C] = d;
  const innen = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
  const L = [s.a, s.b, s.c];
  const seitePkt = [[B, C], [C, A], [A, B]] as const;
  const winkelL = [w.alpha, w.beta, w.gamma];
  const iRecht = nw === "rechtwinklig" ? winkelL.indexOf(Math.max(...winkelL)) : -1;
  const gl = (i: number, j: number) => Math.abs(L[i] - L[j]) < 0.05;
  // Fachbegriff je Seite
  const begriff = (i: number): string | null => {
    const teile: string[] = [];
    if (iRecht >= 0) teile.push(i === iRecht ? "Hypotenuse" : "Kathete");
    if (ns === "gleichschenklig") {
      const schenkel = [0, 1, 2].filter(j => j !== i).some(j => gl(i, j));
      teile.push(schenkel ? "Schenkel" : "Basis");
    }
    return teile.length ? teile.join(" = ") : null;
  };
  const marken = (i: number) => (ns === "gleichseitig" || [0, 1, 2].some(j => j !== i && gl(i, j))) ? 1 : 0;

  const regler = (alpha: number, beta: number, c: number) => {
    if (alpha + beta >= 175) return;
    const neu = ausWinkeln(c, alpha, beta, A);
    // Liegt C oberhalb des Blatts, ganze Figur nach unten schieben.
    const dy = Math.max(0, 0.6 - neu[2].y), dx = Math.max(0, neu[1].x - 12.4);
    setD(neu.map(p => ({ x: p.x - dx, y: p.y + dy })) as Dreieck);
  };
  const farbeW = [FARBE.alpha, FARBE.beta, FARBE.gamma];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
      <div className="flex flex-col gap-2">
        <Zeichenblatt d={d} setD={setD} label="Dreieck mit ziehbaren Ecken" fang={rasten ? (i, p, dd) => einrasten(dd, i, p) : undefined}
          kinder={<>
            {d.map((p, i) => i === iRecht
              ? <RechterWinkel key={i} p={p} q={d[(i + 1) % 3]} r={d[(i + 2) % 3]} farbe={farbeW[i]} />
              : <Keil key={i} p={p} q={d[(i + 1) % 3]} r={d[(i + 2) % 3]} farbe={farbeW[i]} text={`${["α", "β", "γ"][i]} ${z(Math.round(winkelL[i]))}°`} />)}
            {[0, 1, 2].map(i => marken(i) > 0 && <Marke key={`m${i}`} a={seitePkt[i][0]} b={seitePkt[i][1]} />)}
            {[0, 1, 2].map(i => (
              <SeitenText key={`s${i}`} a={seitePkt[i][0]} b={seitePkt[i][1]} innen={innen} ab={begriff(i) ? 30 : 18}>
                {`${"abc"[i]} = ${z(L[i], 1)} cm${begriff(i) ? ` · ${begriff(i)}` : ""}`}
              </SeitenText>
            ))}
          </>} />
        <p className="text-xs text-muted">Ecken ziehen. {rasten ? "Nahe an besonderen Lagen (gleichschenklig, rechtwinklig, gleichseitig) rastet die Ecke ein." : ""}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="card p-4 flex flex-col gap-3">
          <h3 className="font-black">Einordnung</h3>
          <div>
            <div className="text-xs font-bold text-muted mb-1">nach Seiten</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SEITEN_NAMEN) as NachSeiten[]).map(k => <span key={k} className={`chip ${ns === k || (ns === "gleichseitig" && k === "gleichschenklig") ? "chip-on" : "opacity-60"}`}>{SEITEN_NAMEN[k]}</span>)}
            </div>
            <p className="text-sm mt-1">{ERKLAER_S[ns]}</p>
          </div>
          <div>
            <div className="text-xs font-bold text-muted mb-1">nach Winkeln</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(WINKEL_NAMEN) as NachWinkeln[]).map(k => <span key={k} className={`chip ${nw === k ? "chip-on" : "opacity-60"}`}>{WINKEL_NAMEN[k]}</span>)}
            </div>
            <p className="text-sm mt-1">{ERKLAER_W[nw]}</p>
          </div>
          <p className="text-sm font-bold" data-testid="einordnung">
            Das Dreieck ist {WINKEL_NAMEN[nw]} und {SEITEN_NAMEN[ns]}.
          </p>
        </div>

        <div className="card p-4 flex flex-col gap-2 text-sm">
          <h3 className="font-black">Per Regler</h3>
          <label className="flex items-center gap-2"><span className="w-16" style={{ color: FARBE.alpha }}>α {z(Math.round(w.alpha))}°</span>
            <input type="range" className="flex-1" min={10} max={160} value={Math.round(w.alpha)} aria-label="Winkel alpha"
              onChange={e => regler(Number(e.target.value), Math.min(w.beta, 170 - Number(e.target.value)), s.c)} /></label>
          <label className="flex items-center gap-2"><span className="w-16" style={{ color: FARBE.beta }}>β {z(Math.round(w.beta))}°</span>
            <input type="range" className="flex-1" min={10} max={160} value={Math.round(w.beta)} aria-label="Winkel beta"
              onChange={e => regler(Math.min(w.alpha, 170 - Number(e.target.value)), Number(e.target.value), s.c)} /></label>
          <label className="flex items-center gap-2"><span className="w-16">c {z(s.c, 1)}</span>
            <input type="range" className="flex-1" min={3} max={11} step={0.5} value={Math.round(s.c * 2) / 2} aria-label="Seite c"
              onChange={e => regler(w.alpha, w.beta, Number(e.target.value))} /></label>
          <p className="text-muted">γ = 180° − α − β = {z(Math.round(w.gamma))}°</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={rasten} onChange={e => setRasten(e.target.checked)} /> Beim Ziehen einrasten</label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {VORLAGEN.map(v => <button key={v.label} className="chip" onClick={() => setD(v.d())}>{v.label}</button>)}
        </div>
      </div>
    </div>
  );
}
