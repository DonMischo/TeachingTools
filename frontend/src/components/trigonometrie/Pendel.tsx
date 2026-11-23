"use client";
/**
 * Ideales Pendel: links das schwingende Fadenpendel, rechts der Graph φ(t)
 * — eine Kosinuskurve φ(t) = φ₀ · cos(2π/T · t). Regler für Länge, Amplitude,
 * Masse und Ortsfaktor; eine Kurve »festhalten« zeigt, was sich ändert und
 * was nicht (die Masse nicht!). Für große Auslenkung zusätzlich die exakte,
 * numerisch gerechnete Kurve.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { gemessenePeriode, grad, ORTSFAKTOREN, periode, rad, simuliere, vMax, winkelKlein } from "@/lib/pendel";

const de = (x: number, s = 2) => x.toLocaleString("de-DE", { maximumFractionDigits: s });
type Kurve = { L: number; phi0: number; g: number; m: number; name: string };

function Regler({ label, wert, setze, min, max, schritt, einheit }: { label: string; wert: number; setze: (v: number) => void; min: number; max: number; schritt: number; einheit: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted min-w-40">{label}: <b className="text-fg text-sm">{de(wert)} {einheit}</b>
      <input type="range" min={min} max={max} step={schritt} value={wert} onChange={e => setze(Number(e.target.value))} aria-label={label} />
    </label>
  );
}

export default function Pendel() {
  const [L, setL] = useState(1);
  const [phi0Grad, setPhi0Grad] = useState(15);
  const [m, setM] = useState(0.5);
  const [ort, setOrt] = useState<(typeof ORTSFAKTOREN)[number]["id"]>("erde");
  const [exakt, setExakt] = useState(false);
  const [laeuft, setLaeuft] = useState(true);
  const [gehalten, setGehalten] = useState<Kurve | null>(null);
  const [t, setT] = useState(0);
  const g = ORTSFAKTOREN.find(o => o.id === ort)!.g;
  const phi0 = rad(phi0Grad);
  const T = periode(L, g);
  const dauer = Math.max(4, Math.min(20, 3 * T));

  const sim = useMemo(() => (exakt ? simuliere(phi0, L, g, dauer, 0.005) : null), [exakt, phi0, L, g, dauer]);
  const Texakt = sim ? gemessenePeriode(sim) : null;
  const winkel = (zeit: number) => {
    if (!sim) return winkelKlein(zeit, phi0, L, g);
    const i = Math.min(sim.length - 1, Math.round(zeit / 0.005));
    return sim[i].phi;
  };

  // Animation: Zeit läuft in einer Schleife über die gezeigte Dauer
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!laeuft) return;
    let r = 0;
    const schritt = (jetzt: number) => {
      if (start.current === null) start.current = jetzt - t * 1000;
      setT(((jetzt - start.current) / 1000) % dauer);
      r = requestAnimationFrame(schritt);
    };
    r = requestAnimationFrame(schritt);
    return () => { cancelAnimationFrame(r); start.current = null; };
  }, [laeuft, dauer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pendelbild
  const B = 320, aufh = { x: B / 2, y: 20 }, skala = 220 / 3; // 3 m passen
  const phi = winkel(t);
  const lp = L * skala;
  const kugel = { x: aufh.x + lp * Math.sin(phi), y: aufh.y + lp * Math.cos(phi) };
  const r = 8 + Math.cbrt(m) * 10;

  // Graph
  const GW = 560, GH = 260, ymax = Math.max(phi0Grad, gehalten ? gehalten.phi0 : 0) * 1.15;
  const gx = (zeit: number) => 40 + (zeit / dauer) * (GW - 50), gy = (deg: number) => GH / 2 - (deg / ymax) * (GH / 2 - 16);
  const pfad = (f: (zeit: number) => number) => Array.from({ length: 301 }, (_, i) => { const z = (i / 300) * dauer; return `${i ? "L" : "M"}${gx(z).toFixed(1)} ${gy(f(z)).toFixed(1)}`; }).join(" ");
  const gehaltenPfad = gehalten ? pfad(z => grad(winkelKlein(z, rad(gehalten.phi0), gehalten.L, gehalten.g))) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <Regler label="Fadenlänge L" wert={L} setze={setL} min={0.1} max={3} schritt={0.05} einheit="m" />
        <Regler label="Amplitude φ₀" wert={phi0Grad} setze={setPhi0Grad} min={2} max={80} schritt={1} einheit="°" />
        <Regler label="Masse m" wert={m} setze={setM} min={0.05} max={5} schritt={0.05} einheit="kg" />
        <div className="flex flex-col gap-1 text-xs text-muted">Ort
          <div className="flex flex-wrap gap-1">{ORTSFAKTOREN.map(o => <button key={o.id} className={`chip ${ort === o.id ? "chip-on" : ""}`} onClick={() => setOrt(o.id)}>{o.name} ({de(o.g)})</button>)}</div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exakt} onChange={e => setExakt(e.target.checked)} /> exakt gerechnet (große Winkel)</label>
        <button className="btn-secondary" onClick={() => setLaeuft(l => !l)}>{laeuft ? "⏸ Anhalten" : "▶ Weiter"}</button>
        <button className="btn-secondary" onClick={() => setGehalten({ L, phi0: phi0Grad, g, m, name: `L = ${de(L)} m, φ₀ = ${phi0Grad}°, m = ${de(m)} kg, g = ${de(g)}` })}>📌 Kurve festhalten</button>
        {gehalten && <button className="btn-secondary" onClick={() => setGehalten(null)}>Festgehaltene löschen</button>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="card p-3">
          <svg viewBox={`0 0 ${B} ${B}`} className="w-full" role="img" aria-label="Fadenpendel">
            <line x1={aufh.x - 60} y1={aufh.y} x2={aufh.x + 60} y2={aufh.y} stroke="var(--color-fg)" strokeWidth={4} />
            <line x1={aufh.x} y1={aufh.y} x2={aufh.x} y2={aufh.y + lp + 20} stroke="var(--color-muted)" strokeDasharray="4 4" />
            <path d={`M ${aufh.x} ${aufh.y + 40} A 40 40 0 0 ${phi0 > 0 ? 0 : 1} ${aufh.x + 40 * Math.sin(phi0)} ${aufh.y + 40 * Math.cos(phi0)}`} fill="none" stroke="#f59e0b" strokeWidth={2} />
            <text x={aufh.x + 46 * Math.sin(phi0 / 2) + 4} y={aufh.y + 52 * Math.cos(phi0 / 2)} fontSize={13} fontWeight={800} fill="#f59e0b">φ₀</text>
            <line x1={aufh.x} y1={aufh.y} x2={kugel.x} y2={kugel.y} stroke="var(--color-fg)" strokeWidth={2} />
            <circle cx={kugel.x} cy={kugel.y} r={r} fill="#2563eb" stroke="#1e3a8a" strokeWidth={2} />
          </svg>
          <p className="text-sm text-center">t = {de(t, 1)} s · φ = {de(grad(phi), 1)}°</p>
        </div>

        <div className="card p-3 flex flex-col gap-2">
          <svg viewBox={`0 0 ${GW} ${GH}`} className="w-full" role="img" aria-label="Graph des Auslenkwinkels">
            <line x1={40} y1={GH / 2} x2={GW - 5} y2={GH / 2} stroke="var(--color-fg)" />
            <line x1={40} y1={8} x2={40} y2={GH - 8} stroke="var(--color-fg)" />
            <text x={GW - 8} y={GH / 2 - 6} textAnchor="end" fontSize={12} fill="var(--color-muted)">t in s</text>
            <text x={44} y={16} fontSize={12} fill="var(--color-muted)">φ in °</text>
            {Array.from({ length: Math.floor(dauer) + 1 }, (_, s) => s).filter(s => dauer <= 10 || s % 2 === 0).map(s => (
              <text key={s} x={gx(s)} y={GH / 2 + 15} fontSize={10} textAnchor="middle" fill="var(--color-muted)">{s}</text>
            ))}
            {[phi0Grad, -phi0Grad].map(v => <text key={v} x={36} y={gy(v) + 4} fontSize={10} textAnchor="end" fill="var(--color-muted)">{v}</text>)}
            {/* eine Periode markieren */}
            {T <= dauer && <g>
              <line x1={gx(0)} y1={gy(phi0Grad) - 6} x2={gx(T)} y2={gy(phi0Grad) - 6} stroke="#16a34a" strokeWidth={2} />
              <text x={gx(T / 2)} y={gy(phi0Grad) - 10} textAnchor="middle" fontSize={12} fontWeight={800} fill="#16a34a">T = {de(T)} s</text>
            </g>}
            {gehaltenPfad && <path d={gehaltenPfad} fill="none" stroke="var(--color-muted)" strokeWidth={2} strokeDasharray="6 4" />}
            <path d={pfad(z => grad(winkelKlein(z, phi0, L, g)))} fill="none" stroke="#2563eb" strokeWidth={exakt ? 1.5 : 3} strokeDasharray={exakt ? "3 3" : undefined} />
            {exakt && <path d={pfad(z => grad(winkel(z)))} fill="none" stroke="#dc2626" strokeWidth={3} />}
            <line x1={gx(t)} y1={8} x2={gx(t)} y2={GH - 8} stroke="#f59e0b" strokeWidth={1.5} />
            <circle cx={gx(t)} cy={gy(grad(phi))} r={5} fill="#f59e0b" />
          </svg>
          <div className="text-sm flex flex-col gap-1">
            <p className="font-mono font-bold">φ(t) = {phi0Grad}° · cos(2π/{de(T)} s · t)</p>
            <p>Periode <b>T = 2π · √(L / g) = 2π · √({de(L)} m / {de(g)} m/s²) = {de(T, 3)} s</b>, Frequenz f = 1/T = {de(1 / T, 3)} Hz, schnellster Punkt unten: v = {de(vMax(L, g, phi0))} m/s.</p>
            {exakt && Texakt && <p className="text-bad">Exakt gerechnet (rot): T = {de(Texakt, 3)} s — bei {phi0Grad}° also {de((Texakt / T - 1) * 100, 1)} % länger. Die Formel gilt nur für kleine Winkel (sin φ ≈ φ).</p>}
            {gehalten && <p className="text-muted">Gestrichelt grau: {gehalten.name} — T = {de(periode(gehalten.L, gehalten.g), 3)} s.</p>}
            <p className="text-muted">Was ändert T? Die Länge (4-mal so lang → doppelt so lange Periode) und der Ortsfaktor g. Die Masse und — für kleine Winkel — die Amplitude ändern T <b>nicht</b>. Der Graph ist eine Kosinuskurve: Amplitude a = φ₀, Periode T, also b = 2π/T wie im Blatt »Funktionsgraphen«.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
