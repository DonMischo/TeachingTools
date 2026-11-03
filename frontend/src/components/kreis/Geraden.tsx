"use client";
/**
 * Geraden am Kreis: Sekante (mit Sehne), Tangente, Passante — oder frei
 * ziehen und sehen, was entsteht. Gezogen wird der Lotfußpunkt F (der Punkt
 * der Geraden, der M am nächsten liegt); er legt Richtung und Abstand fest.
 * Die Tangente hängt am Berührradius: Sie steht immer senkrecht auf MB und
 * wandert mit, wenn man B oder r ändert.
 */
import { useRef, useState } from "react";
import { Regler } from "@/components/groessen/bausteine";
import { z } from "@/lib/prozent";
import { LAGE_NAME, lage, sehneImAbstand, type Lage } from "@/lib/kreis";
import { auf, svgPunkt, winkelVon } from "./ziehen";

const W = 560, H = 440, CX = 280, CY = 220, K = 22;
const ROT = "#dc2626", ORANGE = "#d97706", GRUEN = "#16a34a";
type Modus = Lage | "frei";
const MODI: { id: Modus; label: string }[] = [
  { id: "sekante", label: "✂️ Sekante" },
  { id: "tangente", label: "🤏 Tangente" },
  { id: "passante", label: "👋 Passante" },
  { id: "frei", label: "🔀 Frei ziehen" },
];
const ERKLAERUNG: Record<Lage, string> = {
  sekante: "Sekante (lat. secare = schneiden): schneidet den Kreis in zwei Punkten S₁ und S₂. Das Stück dazwischen ist eine Sehne. Die längste Sehne geht durch M — der Durchmesser.",
  tangente: "Tangente (lat. tangere = berühren): berührt den Kreis in genau einem Punkt B. Sie steht senkrecht auf dem Berührradius MB.",
  passante: "Passante (frz. passer = vorbeigehen): geht am Kreis vorbei, kein gemeinsamer Punkt.",
};
const EINRASTEN = 0.2;

export default function Geraden() {
  const [modus, setModus] = useState<Modus>("tangente");
  const [r, setR] = useState(5);
  const [phi, setPhi] = useState(40);
  const [dist, setDist] = useState(5);
  const zieht = useRef(false);

  const d = modus === "tangente" ? r
    : modus === "sekante" ? Math.min(dist, 0.92 * r)
    : modus === "passante" ? Math.min(9.5, Math.max(dist, 1.08 * r))
    : dist;
  const l = lage(d, r, 1e-6);
  const F = auf(CX, CY, d * K, phi);
  const n = { x: Math.cos(phi * Math.PI / 180), y: -Math.sin(phi * Math.PI / 180) };
  const t = { x: -n.y, y: n.x };
  const h = sehneImAbstand(r, d) / 2 * K;
  const S1 = { x: F.x + t.x * h, y: F.y + t.y * h }, S2 = { x: F.x - t.x * h, y: F.y - t.y * h };

  const waehle = (m: Modus) => {
    setModus(m);
    if (m === "sekante") setDist(0.55 * r);
    if (m === "passante") setDist(Math.min(9.5, 1.35 * r));
    if (m === "frei" || m === "tangente") setDist(r);
  };
  const zieh = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!zieht.current) return;
    const p = svgPunkt(e);
    setPhi(Math.round(winkelVon(CX, CY, p.x, p.y)));
    let nd = Math.hypot(p.x - CX, p.y - CY) / K;
    if (modus === "frei" && Math.abs(nd - r) < EINRASTEN) nd = r;
    setDist(Math.min(9.5, nd));
  };
  const greif = (e: React.PointerEvent<SVGElement>) => {
    zieht.current = true;
    (e.currentTarget.closest("svg") as SVGSVGElement).setPointerCapture(e.pointerId);
  };
  const ecke = (p: { x: number; y: number }, u: { x: number; y: number }, v: { x: number; y: number }, e = 13) =>
    `M ${p.x + u.x * e} ${p.y + u.y * e} L ${p.x + (u.x + v.x) * e} ${p.y + (u.y + v.y) * e} L ${p.x + v.x * e} ${p.y + v.y * e}`;
  const zuM = { x: -n.x, y: -n.y };
  const txt = (x: number, y: number, s: string, farbe = "var(--text)") => (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={800} fill={farbe}
      stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">{s}</text>
  );

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Art der Geraden">
          {MODI.map(m => (
            <button key={m.id} className={`chip ${modus === m.id ? "chip-on" : ""}`} aria-pressed={modus === m.id} onClick={() => waehle(m.id)}>{m.label}</button>
          ))}
        </div>
        <Regler label="Radius r (cm)" wert={r} setze={setR} min={2} max={8} step={0.5} breit />
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[calc(100vh-10rem)] rounded-xl border border-line bg-surface touch-none select-none"
          role="img" aria-label={`${LAGE_NAME[l]} am Kreis`} onPointerMove={zieh} onPointerUp={() => { zieht.current = false; }}>
          <circle cx={CX} cy={CY} r={r * K} fill="var(--accent)" fillOpacity={0.1} stroke="var(--accent)" strokeWidth={3} />
          <line x1={F.x - t.x * 900} y1={F.y - t.y * 900} x2={F.x + t.x * 900} y2={F.y + t.y * 900} stroke="var(--text)" strokeWidth={2.5} />
          {txt(F.x + t.x * 190 + n.x * 16, F.y + t.y * 190 + n.y * 16, "g")}
          {l === "sekante" && <line x1={S1.x} y1={S1.y} x2={S2.x} y2={S2.y} stroke={GRUEN} strokeWidth={6} strokeLinecap="round" />}
          {l === "tangente" ? (
            <>
              <line x1={CX} y1={CY} x2={F.x} y2={F.y} stroke={ROT} strokeWidth={3.5} />
              {txt((CX + F.x) / 2 + t.x * 14, (CY + F.y) / 2 + t.y * 14, "r", ROT)}
              <path d={ecke(F, zuM, t, 24)} fill="none" stroke={ORANGE} strokeWidth={2} />
              <circle cx={F.x + (zuM.x + t.x) * 16} cy={F.y + (zuM.y + t.y) * 16} r={2.5} fill={ORANGE} />
            </>
          ) : d > 0.3 && (
            <>
              <line x1={CX} y1={CY} x2={F.x} y2={F.y} stroke={ORANGE} strokeWidth={2} strokeDasharray="6 4" />
              {txt((CX + F.x) / 2 - t.x * 14, (CY + F.y) / 2 - t.y * 14, "d", ORANGE)}
              <path d={ecke(F, zuM, t)} fill="none" stroke={ORANGE} strokeWidth={1.5} />
            </>
          )}
          {l === "sekante" && [S1, S2].map((S, i) => (
            <g key={i}>
              <circle cx={S.x} cy={S.y} r={5} fill={GRUEN} />
              {txt(S.x + (S.x - CX) * 0.1, S.y + (S.y - CY) * 0.1, i ? "S₂" : "S₁", GRUEN)}
            </g>
          ))}
          <circle cx={CX} cy={CY} r={4} fill="var(--text)" />
          {txt(CX - 12 * t.x - 14 * n.x, CY - 12 * t.y - 14 * n.y, "M")}
          <circle cx={F.x} cy={F.y} r={11} fill={l === "tangente" ? ROT : ORANGE} stroke="var(--surface)" strokeWidth={3} className="cursor-grab" onPointerDown={greif} aria-label="Gerade ziehen" />
          {txt(F.x + n.x * 24 - t.x * 4, F.y + n.y * 24 - t.y * 4, l === "tangente" ? "B" : "F")}
        </svg>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            {modus === "tangente" ? "Zieh den roten Berührpunkt B um den Kreis oder ändere r — die Tangente bleibt senkrecht auf dem Radius."
              : modus === "frei" ? "Zieh den Punkt F: Nah am Rand rastet die Gerade als Tangente ein."
              : "Zieh den Punkt F: Er ist der Punkt der Geraden, der M am nächsten liegt."}
          </p>
          <div className="rounded-xl border border-line p-3 font-mono font-bold text-sm flex flex-col gap-1">
            <span>Abstand d(M, g) = {z(d)} cm</span>
            <span>Radius r = {z(r)} cm</span>
          </div>
          {(["sekante", "tangente", "passante"] as const).map(x => (
            <div key={x} className={`rounded-xl border px-3 py-2 text-sm font-bold ${x === l ? "border-accent bg-surface-hover" : "border-line text-muted"}`}>
              {x === "sekante" ? "d < r" : x === "tangente" ? "d = r" : "d > r"} → {LAGE_NAME[x]} · {x === "sekante" ? "2 Schnittpunkte" : x === "tangente" ? "1 Berührpunkt" : "kein gemeinsamer Punkt"}
            </div>
          ))}
          <p className="text-sm">{ERKLAERUNG[l]}</p>
          {l === "sekante" && (
            <p className="text-sm font-mono font-bold rounded-lg bg-surface-hover px-3 py-2">
              Sehne s = 2 · √(r² − d²) = 2 · √({z(r * r)} − {z(d * d)}) ≈ {z(sehneImAbstand(r, d))} cm
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
