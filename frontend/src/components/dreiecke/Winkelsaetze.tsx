"use client";
/**
 * Blatt »Winkelsätze«: vier Ansichten zum Ziehen und Ansehen.
 *   Innenwinkelsumme  α und β »abreißen« und an C anlegen (Drehung um die
 *                     Seitenmitten — genau der Beweis über Wechselwinkel)
 *   Außenwinkel       γ′ = α + β, mit der Parallelen zu AB durch C
 *   Basiswinkel       gleichschenkliges Dreieck an der Achse falten
 *   Thales            C auf dem Halbkreis: immer 90°; abseits davon nicht
 */
import { useEffect, useRef, useState } from "react";
import { z } from "@/lib/prozent";
import { abstand, innenwinkel, mitte, type Dreieck } from "@/lib/dreiecke";
import type { Pt } from "@/lib/geometrie/skizze";
import Zeichenblatt, { FARBE, Gerade, K, Keil, Linie, Marke, Punkt, RechterWinkel, T, Txt } from "./Zeichenblatt";

type Ansicht = "summe" | "aussen" | "basis" | "thales";
const ANSICHTEN: { id: Ansicht; label: string }[] = [
  { id: "summe", label: "Innenwinkelsumme" },
  { id: "aussen", label: "Außenwinkel" },
  { id: "basis", label: "Basiswinkel" },
  { id: "thales", label: "Satz des Thales" },
];

const g0 = (x: number) => `${z(Math.round(x))}°`;
const plus = (p: Pt, q: Pt): Pt => ({ x: p.x + q.x, y: p.y + q.y });
const minus = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });

/** Fortschritt 0 → 1 als Trickfilm mit Regler */
function useTrickfilm(dauer = 2500) {
  const [t, setT] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    if (!laeuft) return;
    const start = performance.now() - t * dauer;
    const schritt = (jetzt: number) => {
      const x = Math.min(1, (jetzt - start) / dauer);
      setT(x);
      if (x < 1) raf.current = requestAnimationFrame(schritt); else setLaeuft(false);
    };
    raf.current = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(raf.current);
  }, [laeuft]); // eslint-disable-line react-hooks/exhaustive-deps
  const knoepfe = (los: string) => (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button className="btn btn-primary" onClick={() => { if (t >= 1) setT(0); setLaeuft(true); }} disabled={laeuft}>▶ {los}</button>
      <button className="btn" onClick={() => { setLaeuft(false); setT(0); }}>↺ zurück</button>
      <input type="range" min={0} max={1} step={0.01} value={t} className="flex-1 min-w-32" aria-label="Fortschritt"
        onChange={e => { setLaeuft(false); setT(Number(e.target.value)); }} />
    </div>
  );
  return { t, knoepfe };
}

/** Drehung um m um `grad` (SVG-Sinn, im Uhrzeigersinn) — in Weltkoordinaten */
const dreh = (p: Pt, m: Pt, grad: number): Pt => {
  const w = grad * Math.PI / 180, c = Math.cos(w), s = Math.sin(w), d = minus(p, m);
  return { x: m.x + d.x * c - d.y * s, y: m.y + d.x * s + d.y * c };
};

function Summe({ d, setD }: { d: Dreieck; setD: (d: Dreieck) => void }) {
  const { t, knoepfe } = useTrickfilm();
  const [A, B, C] = d, w = innenwinkel(d);
  const S = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
  // Drehsinn so, dass der Keil auf halbem Weg außen liegt
  const sinn = (ecke: Pt, nach: Pt, m: Pt) => {
    const spitze = plus(ecke, { x: (nach.x - ecke.x) * 0.15, y: (nach.y - ecke.y) * 0.15 });
    return abstand(dreh(spitze, m, 90), S) > abstand(dreh(spitze, m, -90), S) ? 1 : -1;
  };
  const mb = mitte(A, C), ma = mitte(B, C);
  const sA = sinn(A, C, mb), sB = sinn(B, C, ma);
  const rot = (m: Pt, grad: number) => { const c = T(m); return `rotate(${grad} ${c.x} ${c.y})`; };
  const ab = minus(B, A);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
      <Zeichenblatt d={d} setD={t === 0 ? setD : undefined} label="Innenwinkelsumme im Dreieck"
        kinder={<>
          {t > 0 && <Gerade a={C} b={plus(C, ab)} gestrichelt />}
          <Keil p={C} q={A} r={B} farbe={FARBE.gamma} text={`γ ${g0(w.gamma)}`} />
          <Keil p={A} q={B} r={C} farbe={FARBE.alpha} deckkraft={t > 0 ? 0.15 : 0.35} text={t > 0 ? undefined : `α ${g0(w.alpha)}`} />
          <Keil p={B} q={C} r={A} farbe={FARBE.beta} deckkraft={t > 0 ? 0.15 : 0.35} text={t > 0 ? undefined : `β ${g0(w.beta)}`} />
          {t > 0 && <>
            <Keil p={A} q={B} r={C} farbe={FARBE.alpha} deckkraft={0.55} transform={rot(mb, 180 * t * sA)} text={t === 1 ? undefined : "α"} />
            <Keil p={B} q={C} r={A} farbe={FARBE.beta} deckkraft={0.55} transform={rot(ma, 180 * t * sB)} text={t === 1 ? undefined : "β"} />
          </>}
          {t === 1 && <>
            <Keil p={C} q={minus(C, ab)} r={A} farbe={FARBE.alpha} deckkraft={0} radius={1.25} text={`α ${g0(w.alpha)}`} />
            <Keil p={C} q={B} r={plus(C, ab)} farbe={FARBE.beta} deckkraft={0} radius={1.25} text={`β ${g0(w.beta)}`} />
          </>}
        </>} />
      <div className="card p-4 flex flex-col gap-3 text-sm">
        <h3 className="font-black">Innenwinkelsumme: 180°</h3>
        <p>Reiß die Ecken α und β ab und leg sie an C an: Zusammen mit γ ergeben sie einen gestreckten Winkel — eine gerade Linie, also 180°.</p>
        {knoepfe("Abreißen und anlegen")}
        <p className="text-lg font-black">
          <span style={{ color: FARBE.alpha }}>{g0(w.alpha)}</span> + <span style={{ color: FARBE.beta }}>{g0(w.beta)}</span> + <span style={{ color: FARBE.gamma }}>{g0(w.gamma)}</span> = 180°
        </p>
        <p className="text-muted">Warum es immer passt: Die Gerade durch C ist parallel zu AB. α und β drehen sich je um eine Seitenmitte um 180° — sie landen als Wechselwinkel an der Parallelen. {t === 0 ? "Zieh vorher die Ecken, um ein anderes Dreieck zu nehmen." : ""}</p>
      </div>
    </div>
  );
}

function Aussen({ d, setD }: { d: Dreieck; setD: (d: Dreieck) => void }) {
  const [parallele, setParallele] = useState(true);
  const [A, B, C] = d, w = innenwinkel(d);
  const ac = minus(C, A), l = Math.hypot(ac.x, ac.y) || 1;
  const E = plus(C, { x: ac.x / l * 3, y: ac.y / l * 3 });
  const ab = minus(B, A);
  const P2 = plus(C, ab);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
      <Zeichenblatt d={d} setD={setD} label="Außenwinkel am Dreieck"
        kinder={<>
          <Linie a={C} b={E} breite={3} gestrichelt />
          {parallele && <Gerade a={C} b={P2} gestrichelt />}
          <Keil p={A} q={B} r={C} farbe={FARBE.alpha} text={`α ${g0(w.alpha)}`} />
          <Keil p={B} q={C} r={A} farbe={FARBE.beta} text={`β ${g0(w.beta)}`} />
          <Keil p={C} q={A} r={B} farbe={FARBE.gamma} deckkraft={0.15} radius={0.7} />
          {parallele ? <>
            <Keil p={C} q={E} r={P2} farbe={FARBE.alpha} radius={1.1} text="α" />
            <Keil p={C} q={P2} r={B} farbe={FARBE.beta} radius={1.1} text="β" />
          </> : <Keil p={C} q={B} r={E} farbe={FARBE.rot} radius={1.1} text={`γ′ ${g0(180 - w.gamma)}`} />}
        </>} />
      <div className="card p-4 flex flex-col gap-3 text-sm">
        <h3 className="font-black">Außenwinkelsatz</h3>
        <p>Verlängert man AC über C hinaus, entsteht der Außenwinkel γ′. Er ist so groß wie die beiden Innenwinkel, die nicht an C liegen:</p>
        <p className="text-lg font-black">γ′ = <span style={{ color: FARBE.alpha }}>α</span> + <span style={{ color: FARBE.beta }}>β</span> = {g0(w.alpha)} + {g0(w.beta)} = {g0(w.alpha + w.beta)}</p>
        <p className="text-muted">Ebenso gilt γ′ = 180° − γ = 180° − {g0(w.gamma)}, denn γ und γ′ sind Nebenwinkel.</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={parallele} onChange={e => setParallele(e.target.checked)} /> Parallele zu AB durch C zeigen (Stufen- und Wechselwinkel)</label>
      </div>
    </div>
  );
}

function Basis() {
  const A = { x: 2.5, y: 8 }, B = { x: 10.5, y: 8 }, M = mitte(A, B);
  const [d, setD] = useState<Dreieck>([A, B, { x: M.x, y: 2.5 }]);
  const { t, knoepfe } = useTrickfilm(1800);
  const C = d[2], w = innenwinkel(d);
  const mx = T(M).x;
  const falte = `translate(${mx} 0) scale(${Math.cos(Math.PI * t)} 1) translate(${-mx} 0)`;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
      <Zeichenblatt d={d} setD={setD} ziehbar={[false, false, true]} label="Gleichschenkliges Dreieck"
        fang={(_, p) => ({ x: M.x, y: Math.min(M.y - 0.5, p.y) })}
        kinder={<>
          <Gerade a={M} b={C} gestrichelt farbe={FARBE.lila} />
          <Marke a={A} b={C} /><Marke a={B} b={C} />
          <Keil p={A} q={B} r={C} farbe={FARBE.alpha} text={`α ${g0(w.alpha)}`} />
          <Keil p={B} q={C} r={A} farbe={FARBE.alpha} text={`β ${g0(w.beta)}`} />
          <Keil p={C} q={A} r={B} farbe={FARBE.gamma} text={`γ ${g0(w.gamma)}`} />
          {t > 0 && (
            <g transform={falte}>
              <polygon points={[A, M, C].map(p => { const q = T(p); return `${q.x},${q.y}`; }).join(" ")} fill={FARBE.lila} fillOpacity={0.25} stroke={FARBE.lila} strokeWidth={2} />
              <Keil p={A} q={B} r={C} farbe={FARBE.lila} deckkraft={0.5} />
            </g>
          )}
        </>} />
      <div className="card p-4 flex flex-col gap-3 text-sm">
        <h3 className="font-black">Basiswinkelsatz</h3>
        <p>Im gleichschenkligen Dreieck sind die Winkel an der Basis gleich groß. Zieh die Spitze C nach oben oder unten — α und β bleiben immer gleich.</p>
        <p className="text-lg font-black">α = β = {g0(w.alpha)} · γ = 180° − 2 · {g0(w.alpha)} = {g0(w.gamma)}</p>
        <p className="text-muted">Warum? Das Dreieck ist achsensymmetrisch zur Höhe auf die Basis. Faltet man es an der Achse, fällt die linke Hälfte genau auf die rechte — α auf β.</p>
        {knoepfe("An der Achse falten")}
      </div>
    </div>
  );
}

function Thales() {
  const A = { x: 2, y: 7.5 }, B = { x: 11, y: 7.5 }, M = mitte(A, B), R = abstand(A, B) / 2;
  const [d, setD] = useState<Dreieck>([A, B, { x: M.x - R * Math.cos(1.1), y: M.y - R * Math.sin(1.1) }]);
  const [aufKreis, setAufKreis] = useState(true);
  const C = d[2], w = innenwinkel(d);
  const fang = (_: number, p: Pt): Pt => {
    if (!aufKreis) return p;
    const v = minus(p, M), l = Math.hypot(v.x, v.y) || 1;
    const q = { x: M.x + v.x / l * R, y: M.y + v.y / l * R };
    return q.y > M.y - 0.3 ? { x: q.x, y: M.y - 0.3 } : q;
  };
  const rM = T(M), dist = abstand(C, M) - R;
  const lage = Math.abs(dist) < 0.05 ? "auf dem Kreis" : dist < 0 ? "innerhalb des Kreises" : "außerhalb des Kreises";
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
      <Zeichenblatt d={d} setD={dd => setD([A, B, fang(2, dd[2])])} ziehbar={[false, false, true]} label="Satz des Thales"
        hinten={<circle cx={rM.x} cy={rM.y} r={R * K} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="6 5" />}
        kinder={<>
          <Linie a={M} b={C} gestrichelt />
          <Marke a={A} b={M} /><Marke a={M} b={B} /><Marke a={M} b={C} />
          <Keil p={A} q={B} r={C} farbe={FARBE.alpha} text={`α ${g0(w.alpha)}`} />
          <Keil p={B} q={C} r={A} farbe={FARBE.beta} text={`β ${g0(w.beta)}`} />
          {Math.abs(Math.round(w.gamma) - 90) < 0.5 ? <RechterWinkel p={C} q={A} r={B} farbe={FARBE.gamma} />
            : <Keil p={C} q={A} r={B} farbe={FARBE.gamma} radius={0.6} />}
          <Keil p={C} q={A} r={M} farbe={FARBE.alpha} radius={1.1} deckkraft={0.2} />
          <Keil p={C} q={M} r={B} farbe={FARBE.beta} radius={1.1} deckkraft={0.2} />
          <Punkt p={M} text="M" />
          <Txt p={{ x: T(C).x, y: T(C).y - 42 }} farbe={FARBE.gamma}>{`γ ${g0(w.gamma)}`}</Txt>
        </>} />
      <div className="card p-4 flex flex-col gap-3 text-sm">
        <h3 className="font-black">Satz des Thales</h3>
        <p>Liegt C auf dem Halbkreis über der Strecke AB, dann ist der Winkel bei C ein rechter Winkel — egal, wo auf dem Bogen.</p>
        <p className="text-lg font-black">C liegt {lage}: γ = {g0(w.gamma)}</p>
        <p className="text-muted">
          Warum? MA, MB und MC sind Radien, also gleich lang. Die Dreiecke AMC und MBC sind gleichschenklig, ihre Basiswinkel gleich:
          bei C liegen noch einmal <span style={{ color: FARBE.alpha }}>α</span> und <span style={{ color: FARBE.beta }}>β</span>.
          Also α + β + (α + β) = 180°, und γ = α + β = 90°.
        </p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={aufKreis} onChange={e => setAufKreis(e.target.checked)} /> C bleibt auf dem Kreis</label>
        {!aufKreis && <p className="text-muted">Innerhalb des Kreises wird γ stumpf, außerhalb spitz.</p>}
      </div>
    </div>
  );
}

export default function Winkelsaetze({ d, setD }: { d: Dreieck; setD: (d: Dreieck) => void }) {
  const [ansicht, setAnsicht] = useState<Ansicht>("summe");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Winkelsätze">
        {ANSICHTEN.map(a => <button key={a.id} className={`chip ${ansicht === a.id ? "chip-on" : ""}`} aria-pressed={ansicht === a.id} onClick={() => setAnsicht(a.id)}>{a.label}</button>)}
      </div>
      {ansicht === "summe" && <Summe d={d} setD={setD} />}
      {ansicht === "aussen" && <Aussen d={d} setD={setD} />}
      {ansicht === "basis" && <Basis />}
      {ansicht === "thales" && <Thales />}
    </div>
  );
}
