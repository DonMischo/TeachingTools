"use client";
/**
 * Kreis-Labor: Mittelpunkt, Radius, Durchmesser, Umfang und Fläche live mit
 * Rechenweg. Den Radius zieht man am Rand (oder am Regler). Darunter die
 * Herleitung von π: Umfang abrollen (gut drei Durchmesser) und den Kreis in
 * Sektoren zerlegen und zum »Rechteck« π·r mal r legen.
 */
import { useEffect, useRef, useState } from "react";
import { Regler } from "@/components/groessen/bausteine";
import { z } from "@/lib/prozent";
import { flaeche, umfang } from "@/lib/kreis";
import { auf, svgPunkt, winkelVon } from "./ziehen";

const W = 560, H = 420, CX = 280, CY = 210, K = 18; // K Pixel je cm
const ROT = "#dc2626", BLAU = "#2563eb", ORANGE = "#d97706";

function Zeile({ farbe, name, children }: { farbe: string; name: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-3 flex flex-col gap-1">
      <span className="text-sm font-black" style={{ color: farbe }}>{name}</span>
      <span className="font-mono font-bold text-sm">{children}</span>
    </div>
  );
}

export default function KreisLabor() {
  const [r, setR] = useState(4);
  const [w, setW] = useState(35);
  const zieht = useRef(false);
  const d = 2 * r, u = umfang(r), A = flaeche(r);
  const rp = r * K;
  const P = auf(CX, CY, rp, w);
  const D1 = auf(CX, CY, rp, 180 + w + 90), D2 = auf(CX, CY, rp, w + 90);

  const zieh = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!zieht.current) return;
    const p = svgPunkt(e);
    const nr = Math.round(Math.hypot(p.x - CX, p.y - CY) / K * 10) / 10;
    setR(Math.min(10, Math.max(0.5, nr)));
    setW(Math.round(winkelVon(CX, CY, p.x, p.y)));
  };
  const greif = (e: React.PointerEvent<SVGElement>) => {
    zieht.current = true;
    (e.currentTarget.closest("svg") as SVGSVGElement).setPointerCapture(e.pointerId);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex flex-wrap gap-4 items-end">
          <Regler label="Radius r (cm)" wert={r} setze={setR} min={0.5} max={10} step={0.1} breit />
          <p className="text-sm text-muted max-w-sm">Zieh am Kreisrand oder am roten Punkt — der Radius ändert sich, alle Werte rechnen mit.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr] items-start">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[calc(100vh-10rem)] rounded-xl border border-line bg-surface touch-none select-none"
            role="img" aria-label={`Kreis mit Radius ${z(r)} cm`} onPointerMove={zieh} onPointerUp={() => { zieht.current = false; }}>
            <circle cx={CX} cy={CY} r={rp} fill="var(--accent)" fillOpacity={0.12} stroke="var(--accent)" strokeWidth={3} />
            <circle cx={CX} cy={CY} r={rp} fill="none" stroke="transparent" strokeWidth={22} className="cursor-grab" onPointerDown={greif} />
            <line x1={D1.x} y1={D1.y} x2={D2.x} y2={D2.y} stroke={BLAU} strokeWidth={3} strokeDasharray="8 5" />
            <line x1={CX} y1={CY} x2={P.x} y2={P.y} stroke={ROT} strokeWidth={4} strokeLinecap="round" />
            <text x={(CX + P.x) / 2 + 12 * Math.sin(w * Math.PI / 180)} y={(CY + P.y) / 2 + 12 * Math.cos(w * Math.PI / 180)} fill={ROT} fontWeight={800} fontSize={16}
              textAnchor="middle" dominantBaseline="central" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">r</text>
            <text x={D2.x + (D2.x - CX) * 0.12} y={D2.y + (D2.y - CY) * 0.12} fill={BLAU} fontWeight={800} fontSize={16}
              textAnchor="middle" dominantBaseline="central" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">d</text>
            <circle cx={CX} cy={CY} r={4} fill="var(--text)" />
            <text x={CX - 14} y={CY + 16} fontWeight={800} fontSize={16} fill="var(--text)">M</text>
            <circle cx={P.x} cy={P.y} r={11} fill={ROT} stroke="var(--surface)" strokeWidth={3} className="cursor-grab" onPointerDown={greif}
              aria-label="Radius ziehen" />
          </svg>
          <div className="flex flex-col gap-2">
            <Zeile farbe="var(--text)" name="M — Mittelpunkt">Alle Punkte der Kreislinie sind gleich weit von M entfernt.</Zeile>
            <Zeile farbe={ROT} name="r — Radius">r = {z(r)} cm</Zeile>
            <Zeile farbe={BLAU} name="d — Durchmesser">d = 2 · r = 2 · {z(r)} cm = {z(d)} cm</Zeile>
            <Zeile farbe="var(--accent)" name="u — Umfang">
              u = 2 · π · r = 2 · 3,1416 · {z(r)} cm ≈ {z(u)} cm<br />
              <span className="text-muted">oder u = π · d = 3,1416 · {z(d)} cm</span>
            </Zeile>
            <Zeile farbe={ORANGE} name="A — Flächeninhalt">
              A = π · r² = 3,1416 · ({z(r)} cm)² = 3,1416 · {z(r * r)} cm² ≈ {z(A)} cm²
            </Zeile>
            <p className="text-sm text-muted">Immer gleich, egal wie groß der Kreis ist: u : d = {z(u / d, 4)} = π</p>
          </div>
        </div>
      </div>
      <PiHerleitung />
    </div>
  );
}

/* ─────────────────────────────────────────────────────── π herleiten ── */

const HW = 640, HH = 300;
const glatt = (t: number) => t * t * (3 - 2 * t);

function useAbspielen(dauer = 4000) {
  const [t, setT] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => {
    if (!laeuft) return;
    let id = 0, start = 0;
    const t0 = t >= 1 ? 0 : t;
    const schritt = (jetzt: number) => {
      if (!start) start = jetzt;
      const n = Math.min(1, t0 + (jetzt - start) / dauer);
      setT(n);
      if (n < 1) id = requestAnimationFrame(schritt); else setLaeuft(false);
    };
    id = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(id);
  }, [laeuft]); // eslint-disable-line react-hooks/exhaustive-deps
  return { t, setT: (x: number) => { setLaeuft(false); setT(x); }, laeuft, abspielen: () => setLaeuft(true) };
}

function PiHerleitung() {
  const [art, setArt] = useState<"abrollen" | "zerlegen">("abrollen");
  const [n, setN] = useState(16);
  const { t, setT, laeuft, abspielen } = useAbspielen(art === "abrollen" ? 4000 : 3000);
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-black mr-2">Wo kommt π her?</h3>
        <button className={`chip ${art === "abrollen" ? "chip-on" : ""}`} aria-pressed={art === "abrollen"} onClick={() => { setArt("abrollen"); setT(0); }}>🛞 Umfang abrollen</button>
        <button className={`chip ${art === "zerlegen" ? "chip-on" : ""}`} aria-pressed={art === "zerlegen"} onClick={() => { setArt("zerlegen"); setT(0); }}>🍕 Kreis zerlegen</button>
        {art === "zerlegen" && (
          <label className="flex items-center gap-1.5 text-sm ml-2">Stücke
            <select className="input w-auto" value={n} onChange={e => setN(Number(e.target.value))} aria-label="Anzahl Stücke">
              {[4, 8, 16, 32, 64].map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
        )}
        <span className="flex-1" />
        <button className="btn btn-primary" onClick={abspielen} disabled={laeuft}>▶ Abspielen</button>
        <input type="range" min={0} max={1} step={0.01} value={t} onChange={e => setT(Number(e.target.value))} className="accent-accent w-40" aria-label="Fortschritt" />
      </div>
      <svg viewBox={`0 0 ${HW} ${HH}`} className="w-full h-auto rounded-xl border border-line bg-surface" role="img"
        aria-label={art === "abrollen" ? "Kreis rollt ab" : "Kreis in Sektoren zerlegt"}>
        {art === "abrollen" ? <Abrollen t={glatt(t)} /> : <Zerlegen t={glatt(t)} n={n} />}
      </svg>
      <p className="text-sm text-muted">
        {art === "abrollen"
          ? "Rollt der Kreis einmal ganz ab, ist die Spur so lang wie sein Umfang: gut dreimal der Durchmesser. Genau u : d = π ≈ 3,14 — also u = π · d = 2 · π · r."
          : "Die Stücke abwechselnd nach oben und unten gelegt ergeben fast ein Rechteck: so breit wie der halbe Umfang (π · r), so hoch wie der Radius r. Je mehr Stücke, desto gerader die Ränder. A = π · r · r = π · r²."}
      </p>
    </div>
  );
}

function Abrollen({ t }: { t: number }) {
  const rp = 52, x0 = 60, boden = 250, u = 2 * Math.PI * rp;
  const cx = x0 + t * u, cy = boden - rp;
  const phi = t * 360; // im Uhrzeigersinn gedreht
  // Bildschirmwinkel (y nach unten, im Uhrzeigersinn): Startpunkt unten = 90°.
  const p = (a: number) => ({ x: cx + rp * Math.cos(a * Math.PI / 180), y: cy + rp * Math.sin(a * Math.PI / 180) });
  const a0 = 90 + phi, rest = 360 - phi;
  const s = p(a0), e = p(450 - 0.001);
  return (
    <g>
      <line x1={20} y1={boden} x2={HW - 20} y2={boden} stroke="var(--border)" strokeWidth={2} />
      {[1, 2, 3].map(k => (
        <g key={k}>
          <line x1={x0 + k * 2 * rp} y1={boden - 6} x2={x0 + k * 2 * rp} y2={boden + 6} stroke={BLAU} strokeWidth={2} />
          <text x={x0 + (k - 0.5) * 2 * rp} y={boden + 22} textAnchor="middle" fontSize={14} fontWeight={800} fill={BLAU}>d</text>
        </g>
      ))}
      <line x1={x0} y1={boden} x2={cx} y2={boden} stroke="var(--accent)" strokeWidth={6} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={rp} fill="var(--accent)" fillOpacity={0.1} stroke="var(--border)" strokeWidth={2} />
      {rest > 0.5 && <path d={`M ${s.x} ${s.y} A ${rp} ${rp} 0 ${rest > 180 ? 1 : 0} 1 ${e.x} ${e.y}`} fill="none" stroke="var(--accent)" strokeWidth={6} strokeLinecap="round" />}
      <line x1={p(90 + phi + 180).x} y1={p(90 + phi + 180).y} x2={s.x} y2={s.y} stroke={BLAU} strokeWidth={2} strokeDasharray="6 4" />
      <circle cx={s.x} cy={s.y} r={5} fill={ROT} />
      <circle cx={cx} cy={cy} r={3} fill="var(--text)" />
      <text x={x0} y={boden + 44} fontSize={14} fill="var(--text-muted)">Start</text>
      {t > 0.98 && (
        <text x={x0 + u / 2} y={60} textAnchor="middle" fontSize={18} fontWeight={900} fill="var(--text)">
          u = 3 d + ein Stückchen ≈ 3,14 · d = π · d
        </text>
      )}
    </g>
  );
}

function Zerlegen({ t, n }: { t: number; n: number }) {
  const rp = 90, C = { x: 150, y: 150 }, w = 360 / n;
  const b = 2 * rp * Math.sin(w / 2 * Math.PI / 180);
  const xL = 300, oben = 150 - rp / 2;
  const sektor = `M 0 0 L ${rp * Math.cos(w / 2 * Math.PI / 180)} ${-rp * Math.sin(w / 2 * Math.PI / 180)} A ${rp} ${rp} 0 0 1 ${rp * Math.cos(w / 2 * Math.PI / 180)} ${rp * Math.sin(w / 2 * Math.PI / 180)} Z`;
  return (
    <g>
      <circle cx={C.x} cy={C.y} r={rp} fill="none" stroke="var(--border)" strokeWidth={2} strokeDasharray="5 4" />
      {Array.from({ length: n }, (_, i) => {
        const theta = (i + 0.5) * w; // Bildschirmwinkel im Uhrzeigersinn
        const k = Math.floor(i / 2), gerade = i % 2 === 0;
        const ziel = gerade ? { x: xL + b / 2 + k * b, y: oben } : { x: xL + b + k * b, y: oben + rp };
        const zielW0 = gerade ? 90 : 270;
        const zielW = zielW0 + 360 * Math.round((theta - zielW0) / 360);
        const x = C.x + (ziel.x - C.x) * t, y = C.y + (ziel.y - C.y) * t, a = theta + (zielW - theta) * t;
        return <path key={i} d={sektor} transform={`translate(${x} ${y}) rotate(${a})`}
          fill={gerade ? "#f59e0b" : "#3b82f6"} fillOpacity={0.55} stroke="var(--surface)" strokeWidth={1} />;
      })}
      {t > 0.98 && (
        <g fontWeight={800} fontSize={15}>
          <line x1={xL} y1={oben - 14} x2={xL + (n / 2) * b} y2={oben - 14} stroke={ROT} strokeWidth={2} />
          <text x={xL + (n / 4) * b} y={oben - 26} textAnchor="middle" fill={ROT}>halber Umfang = π · r</text>
          <line x1={xL + (n / 2) * b + 18} y1={oben} x2={xL + (n / 2) * b + 18} y2={oben + rp} stroke={BLAU} strokeWidth={2} />
          <text x={xL + (n / 2) * b + 28} y={oben + rp / 2} dominantBaseline="central" fill={BLAU}>r</text>
          <text x={xL + (n / 4) * b} y={oben + rp + 36} textAnchor="middle" fill="var(--text)">A ≈ π · r · r = π · r²</text>
        </g>
      )}
    </g>
  );
}
