"use client";
/**
 * Einheitskreis und Graph in einem Bild: links der Kreis mit Radius 1, rechts
 * sin, cos und tan über dem Winkel — mit demselben Maßstab, damit die Höhe
 * des Punktes waagerecht in den Graphen hinüberläuft. Ziehen geht im Kreis
 * und im Graphen; »Spur« zeichnet die Kurven nur bis zum aktuellen Winkel,
 * ▶ lässt den Punkt einmal herumlaufen.
 */
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { cosG, exakt, normiere, quadrant, sinG, tanG } from "@/lib/trigonometrie";
import { z } from "@/lib/prozent";

const W = 940, H = 380, CX = 180, CY = 190, R = 140;
const GX0 = 380, GX1 = 920; // Graph: 0° … 360°
const X = (w: number) => GX0 + (w / 360) * (GX1 - GX0);
const Y = (v: number) => CY - v * R;
const FARBE = { sin: "#ef4444", cos: "#3b82f6", tan: "#22c55e", cot: "#a855f7", sec: "#06b6d4", csc: "#ec4899" } as const;
const WAS: Record<keyof typeof FARBE, string> = {
  sin: "Höhe des Punktes (y-Wert)",
  cos: "Rechtsweg des Punktes (x-Wert)",
  tan: "Abschnitt auf der Tangente bei x = 1 — sin : cos",
  cot: "Abschnitt auf der Tangente bei y = 1 — cos : sin",
  sec: "Strecke vom Ursprung bis zur Tangente x = 1 — 1 : cos",
  csc: "Strecke vom Ursprung bis zur Tangente y = 1 — 1 : sin",
};
const cotG = (w: number) => cosG(w) / sinG(w);
const secG = (w: number) => 1 / cosG(w);
const cscG = (w: number) => 1 / sinG(w);
type Fkt = keyof typeof FARBE;
const BESONDERE = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const PI_TEXT: Record<number, string> = {
  0: "0", 30: "π/6", 45: "π/4", 60: "π/3", 90: "π/2", 120: "2π/3", 135: "3π/4", 150: "5π/6", 180: "π",
  210: "7π/6", 225: "5π/4", 240: "4π/3", 270: "3π/2", 300: "5π/3", 315: "7π/4", 330: "11π/6", 360: "2π",
};
const VZ: Record<1 | 2 | 3 | 4, string> = { 1: "sin +, cos +, tan +", 2: "sin +, cos −, tan −", 3: "sin −, cos −, tan +", 4: "sin −, cos +, tan −" };

function kurve(f: (w: number) => number, bis: number) {
  let d = "", neu = true;
  for (let w = 0; w <= bis + 1e-9; w += 1) {
    const v = f(w);
    if (!Number.isFinite(v) || Math.abs(v) > 3) { neu = true; continue; }
    d += `${neu ? "M" : "L"} ${X(w).toFixed(1)} ${Y(v).toFixed(1)} `;
    neu = false;
  }
  return d;
}

export default function Einheitskreis() {
  const [phi, setPhi] = useState(40);
  const [bogen, setBogen] = useState(false);
  const [an, setAn] = useState<Record<Fkt, boolean>>({ sin: true, cos: true, tan: false, cot: false, sec: false, csc: false });
  const [spur, setSpur] = useState(false);
  const [gleich, setGleich] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const zieht = useRef(false);

  useEffect(() => {
    if (!laeuft) return;
    let t0: number | null = null, start = 0, id = 0;
    setPhi(p => { start = p >= 359 ? 0 : p; return start; });
    const schritt = (t: number) => {
      if (t0 === null) t0 = t;
      const w = start + ((t - t0) / 1000) * 50; // 50° pro Sekunde
      if (w >= 360) { setPhi(360); setLaeuft(false); return; }
      setPhi(Math.round(w));
      id = requestAnimationFrame(schritt);
    };
    id = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(id);
  }, [laeuft]);

  const ziehe = (e: PointerEvent<SVGSVGElement>) => {
    const s = svg.current;
    const m = s?.getScreenCTM?.();
    if (!s || !m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    if (p.x < (CX + R + GX0) / 2) {
      setPhi(Math.round(normiere(Math.atan2(CY - p.y, p.x - CX) * 180 / Math.PI)));
    } else {
      setPhi(Math.round(Math.max(0, Math.min(360, ((p.x - GX0) / (GX1 - GX0)) * 360))));
    }
  };

  const s = sinG(phi), c = cosG(phi), t = tanG(phi), ct = cotG(phi);
  const tanOk = Math.abs(c) > 1e-6 && Math.abs(t) < 3;
  const cotOk = Math.abs(s) > 1e-6 && Math.abs(ct) < 3;
  const px = CX + R * c, py = CY - R * s;
  const ex = exakt(phi), q = quadrant(phi);
  const rad = (phi * Math.PI) / 180;
  const winkelText = bogen ? (PI_TEXT[phi] ?? z(rad, 3)) : `${phi}°`;
  const fn: Record<Fkt, (w: number) => number> = { sin: sinG, cos: cosG, tan: tanG, cot: cotG, sec: secG, csc: cscG };
  const exText: Partial<Record<Fkt, string>> = { sin: ex?.sin, cos: ex?.cos, tan: ex?.tan };
  const definiert = (k: Fkt) => { const v = fn[k](phi); return Number.isFinite(v) && Math.abs(v) < 1e6; };
  const bis = spur ? phi : 360;
  // Bogen für den Winkel: im Gradmaß klein, im Bogenmaß auf dem Kreis selbst
  const bogenPfad = (r: number) => phi >= 359.99
    ? `M ${CX + r} ${CY} A ${r} ${r} 0 1 0 ${CX - r} ${CY} A ${r} ${r} 0 1 0 ${CX + r} ${CY}`
    : `M ${CX + r} ${CY} A ${r} ${r} 0 ${phi > 180 ? 1 : 0} 0 ${CX + r * c} ${CY - r * s}`;

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex flex-col gap-1 flex-1 min-w-56">
          <span className="text-xs text-muted">Winkel φ = <strong className="text-fg text-base">{winkelText}</strong>
            {bogen ? <span> ≈ {z(rad, 3)} (= {phi}°)</span> : <span> = {PI_TEXT[phi] ?? z(rad, 3)} im Bogenmaß</span>}</span>
          <input type="range" min={0} max={360} value={phi} onChange={e => { setLaeuft(false); setPhi(Number(e.target.value)); }} className="accent-accent" aria-label="Winkel" />
        </label>
        <button className="btn" onClick={() => setLaeuft(l => !l)}>{laeuft ? "⏸ Anhalten" : "▶ Einmal herum"}</button>
        <div className="flex flex-wrap gap-1.5">
          <button className={`chip ${!bogen ? "chip-on" : ""}`} onClick={() => setBogen(false)}>Gradmaß</button>
          <button className={`chip ${bogen ? "chip-on" : ""}`} onClick={() => setBogen(true)}>Bogenmaß</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center text-sm">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Funktionen">
          {(Object.keys(FARBE) as Fkt[]).map(k => (
            <label key={k} className="flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 font-black cursor-pointer"
              style={{ borderColor: FARBE[k], color: an[k] ? "#fff" : FARBE[k], background: an[k] ? FARBE[k] : "transparent" }}>
              <input type="checkbox" checked={an[k]} onChange={e => setAn({ ...an, [k]: e.target.checked })} style={{ accentColor: FARBE[k] }} /> {k}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={spur} onChange={e => setSpur(e.target.checked)} /> Spur (Graph nur bis φ zeichnen)</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={gleich} onChange={e => setGleich(e.target.checked)} /> Winkel mit gleichem Wert zeigen</label>
      </div>
      <div className="flex flex-wrap gap-1">
        {BESONDERE.map(w => (
          <button key={w} className={`chip text-xs ${phi === w ? "chip-on" : ""}`} onClick={() => { setLaeuft(false); setPhi(w); }}>
            {bogen ? PI_TEXT[w] : `${w}°`}
          </button>
        ))}
      </div>

      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none select-none cursor-pointer" role="img" aria-label="Einheitskreis und Graph"
        onPointerDown={e => { zieht.current = true; setLaeuft(false); (e.target as Element).setPointerCapture?.(e.pointerId); ziehe(e); }}
        onPointerMove={e => { if (zieht.current) ziehe(e); }}
        onPointerUp={() => { zieht.current = false; }}>
        <defs><clipPath id="ek-graph"><rect x={GX0 - 5} y={8} width={GX1 - GX0 + 10} height={H - 16} /></clipPath></defs>
        {/* Kreis */}
        <line x1={CX - R - 20} y1={CY} x2={CX + R + 20} y2={CY} stroke="var(--text-muted)" />
        <line x1={CX} y1={CY - R - 20} x2={CX} y2={CY + R + 20} stroke="var(--text-muted)" />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border-selected)" strokeWidth={2} />
        {[1, 2, 3, 4].map(n => (
          <text key={n} x={CX + (n === 1 || n === 4 ? 1 : -1) * R * 0.8} y={CY + (n <= 2 ? -1 : 1) * R * 0.8} textAnchor="middle" dominantBaseline="central"
            fontSize={13} fill="var(--text-muted)" opacity={q === n ? 1 : 0.45} fontWeight={q === n ? 800 : 400}>{["I", "II", "III", "IV"][n - 1]}</text>
        ))}
        <text x={CX + R + 4} y={CY + 16} fontSize={12} fill="var(--text-muted)">1</text>
        <text x={CX + 6} y={CY - R - 6} fontSize={12} fill="var(--text-muted)">1</text>
        {/* Tangente bei x = 1 */}
        {an.tan && <line x1={CX + R} y1={CY - R * 1.3} x2={CX + R} y2={CY + R * 1.3} stroke={FARBE.tan} strokeOpacity={0.35} strokeDasharray="4 4" />}
        {bogen
          ? <path d={bogenPfad(R)} fill="none" stroke="#f59e0b" strokeWidth={6} strokeOpacity={0.8} />
          : <path d={bogenPfad(30)} fill="none" stroke="#f59e0b" strokeWidth={2.5} />}
        {gleich && (
          <g opacity={0.55}>
            <line x1={CX} y1={CY} x2={CX + R * cosG(180 - phi)} y2={CY - R * sinG(180 - phi)} stroke={FARBE.sin} strokeDasharray="5 4" />
            <circle cx={CX + R * cosG(180 - phi)} cy={CY - R * sinG(180 - phi)} r={6} fill={FARBE.sin} />
            <line x1={CX} y1={CY} x2={CX + R * c} y2={CY + R * s} stroke={FARBE.cos} strokeDasharray="5 4" />
            <circle cx={CX + R * c} cy={CY + R * s} r={6} fill={FARBE.cos} />
            <line x1={px} y1={py} x2={CX + R * cosG(180 - phi)} y2={py} stroke={FARBE.sin} strokeDasharray="2 4" />
            <line x1={px} y1={py} x2={px} y2={CY + R * s} stroke={FARBE.cos} strokeDasharray="2 4" />
          </g>
        )}
        {an.tan && tanOk && (
          <g>
            <line x1={CX} y1={CY} x2={CX + R} y2={CY - R * t} stroke={FARBE.tan} strokeWidth={1.5} strokeDasharray="3 3" />
            <line x1={CX + R} y1={CY} x2={CX + R} y2={CY - R * t} stroke={FARBE.tan} strokeWidth={5} strokeLinecap="round" />
          </g>
        )}
        {an.cot && <line x1={CX - R * 1.3} y1={CY - R} x2={CX + R * 1.3} y2={CY - R} stroke={FARBE.cot} strokeOpacity={0.35} strokeDasharray="4 4" />}
        {an.cot && cotOk && (
          <g>
            <line x1={CX} y1={CY} x2={CX + R * ct} y2={CY - R} stroke={FARBE.cot} strokeWidth={1.5} strokeDasharray="3 3" />
            <line x1={CX} y1={CY - R} x2={CX + R * ct} y2={CY - R} stroke={FARBE.cot} strokeWidth={5} strokeLinecap="round" />
          </g>
        )}
        {an.sec && tanOk && <line x1={CX} y1={CY} x2={CX + R} y2={CY - R * t} stroke={FARBE.sec} strokeWidth={4} strokeOpacity={0.8} strokeLinecap="round" />}
        {an.csc && cotOk && <line x1={CX} y1={CY} x2={CX + R * ct} y2={CY - R} stroke={FARBE.csc} strokeWidth={4} strokeOpacity={0.8} strokeLinecap="round" />}
        <line x1={CX} y1={CY} x2={px} y2={py} stroke="var(--text)" strokeWidth={2.5} />
        {an.cos && <line x1={CX} y1={CY} x2={px} y2={CY} stroke={FARBE.cos} strokeWidth={5} strokeLinecap="round" />}
        {an.sin && <line x1={px} y1={CY} x2={px} y2={py} stroke={FARBE.sin} strokeWidth={5} strokeLinecap="round" />}
        <circle cx={px} cy={py} r={9} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        <text x={Math.max(CX - R + 50, Math.min(CX + R - 20, px))} y={py + (s >= 0 ? -16 : 26)} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">
          P({z(c, 2)} | {z(s, 2)})
        </text>

        {/* Graph */}
        {[-1, 1].map(v => <line key={v} x1={GX0} y1={Y(v)} x2={GX1} y2={Y(v)} stroke="var(--border)" strokeDasharray="3 5" />)}
        {[90, 180, 270, 360].map(w => <line key={w} x1={X(w)} y1={Y(1.3)} x2={X(w)} y2={Y(-1.3)} stroke="var(--border)" strokeDasharray="3 5" />)}
        <line x1={GX0} y1={CY} x2={GX1 + 10} y2={CY} stroke="var(--text-muted)" />
        <line x1={GX0} y1={Y(1.3)} x2={GX0} y2={Y(-1.3)} stroke="var(--text-muted)" />
        {[0, 90, 180, 270, 360].map(w => (
          <text key={w} x={X(w)} y={CY + 18} textAnchor="middle" fontSize={12} fill="var(--text-muted)">{bogen ? PI_TEXT[w] : `${w}°`}</text>
        ))}
        <text x={GX0 - 6} y={Y(1)} textAnchor="end" dominantBaseline="central" fontSize={12} fill="var(--text-muted)">1</text>
        <text x={GX0 - 6} y={Y(-1)} textAnchor="end" dominantBaseline="central" fontSize={12} fill="var(--text-muted)">−1</text>
        <g clipPath="url(#ek-graph)">
          {(Object.keys(FARBE) as Fkt[]).filter(k => an[k]).map(k => (
            <path key={k} d={kurve(fn[k], bis)} fill="none" stroke={FARBE[k]} strokeWidth={3} strokeOpacity={0.9} />
          ))}
          {(Object.keys(FARBE) as Fkt[]).filter(k => an[k] && k !== "sin" && k !== "cos").flatMap(k => (k === "tan" || k === "sec" ? [90, 270] : [0, 180, 360]).map(w => [k, w] as const)).map(([k, w]) => <line key={`${k}${w}`} x1={X(w)} y1={Y(1.4)} x2={X(w)} y2={Y(-1.4)} stroke={FARBE[k]} strokeOpacity={0.4} strokeDasharray="8 4" />)}
          <line x1={X(phi)} y1={Y(1.35)} x2={X(phi)} y2={Y(-1.35)} stroke="#f59e0b" strokeWidth={1.5} />
          {an.sin && <line x1={px} y1={py} x2={X(phi)} y2={py} stroke={FARBE.sin} strokeDasharray="4 4" strokeOpacity={0.7} />}
          {(Object.keys(FARBE) as Fkt[]).filter(k => an[k] && definiert(k) && Math.abs(fn[k](phi)) < 3).map(k => (
            <circle key={k} cx={X(phi)} cy={Y(fn[k](phi))} r={7} fill={FARBE[k]} stroke="var(--surface)" strokeWidth={2} />
          ))}
          {gleich && an.sin && phi <= 180 && <circle cx={X(180 - phi)} cy={Y(s)} r={6} fill={FARBE.sin} opacity={0.5} />}
          {gleich && an.cos && <circle cx={X(360 - phi)} cy={Y(c)} r={6} fill={FARBE.cos} opacity={0.5} />}
        </g>
      </svg>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(FARBE) as Fkt[]).filter(k => an[k]).map(k => (
          <div key={k} className="rounded-xl border border-line p-3" style={{ borderLeft: `5px solid ${FARBE[k]}` }}>
            <div className="text-lg font-black">
              {k} {winkelText} = {definiert(k) ? z(fn[k](phi), 4) : "nicht definiert"}
              {exText[k] && definiert(k) && <span className="text-muted font-bold text-base"> = {exText[k]}</span>}
            </div>
            <div className="text-xs text-muted">{WAS[k]}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted max-w-4xl">
        {q ? <>Der Punkt liegt im <strong>{["I", "II", "III", "IV"][q - 1]}. Quadranten</strong>: {VZ[q]}. </> : <>Der Punkt liegt auf einer Achse. </>}
        Immer gilt <strong>sin² φ + cos² φ = 1</strong> (Pythagoras im Kreis): {z(s * s, 4)} + {z(c * c, 4)} = 1.
        {gleich && <> Gleicher Sinus bei <strong style={{ color: FARBE.sin }}>180° − φ = {normiere(180 - phi)}°</strong>, gleicher Kosinus bei{" "}
          <strong style={{ color: FARBE.cos }}>360° − φ = {normiere(360 - phi)}°</strong>. Darum liefert der Sinussatz manchmal <strong>zwei</strong> Dreiecke:
          der Taschenrechner gibt nur den spitzen Winkel aus, der stumpfe 180° − φ passt oft auch.</>}
      </p>
    </div>
  );
}
