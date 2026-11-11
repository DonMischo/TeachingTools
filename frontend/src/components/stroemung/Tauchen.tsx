"use client";
/**
 * Station »Tauchen«: Schweredruck p = ρ·g·h. Taucherin auf einstellbarer
 * Tiefe, Druckpfeile von allen Seiten, ein Luftballon schrumpft (Boyle).
 * Darunter das hydrostatische Paradoxon: drei Gefäße, gleicher Bodendruck.
 */
import { useState } from "react";
import { FLUESSIGKEITEN, blasenVolumen, schweredruck } from "@/lib/stroemung/druck";
import { G, P_LUFT } from "@/lib/stroemung/modell";
import { Analogie, Karte, Pille, Regler, StationRahmen, Werte, bar, muted, text, zahl } from "./rahmen";

const OBEN = 70, UNTEN = 530, MAX_TIEFE = 40;
const PX = (UNTEN - OBEN) / MAX_TIEFE;

export default function Tauchen() {
  const [tiefe, setTiefe] = useState(10);
  const [fid, setFid] = useState("suess");
  const [fuellung, setFuellung] = useState(1);
  const fl = FLUESSIGKEITEN.find(f => f.id === fid)!;
  const pW = schweredruck(fl.dichte, tiefe);
  const pAbs = P_LUFT + pW;
  const ballon = blasenVolumen(1, P_LUFT, pAbs);   // 1 L an der Oberfläche
  const ty = OBEN + tiefe * PX;

  const versuche = [
    { name: "10 m tief", idee: "In 10 m Wassertiefe kommt noch einmal so viel Druck dazu, wie die ganze Luft darüber drückt: 1 bar + 1 bar.", los: () => { setTiefe(10); setFid("suess"); } },
    { name: "Ballon schrumpft", idee: "Der Ballon wird mit der Tiefe kleiner: doppelter Druck, halbes Volumen (Boyle-Mariotte). Darum atmet man beim Auftauchen aus.", los: () => { setTiefe(30); setFid("suess"); } },
    { name: "Totes Meer", idee: "Dichtere Flüssigkeit, mehr Druck in gleicher Tiefe — und im Toten Meer trägt das Wasser einen Menschen fast von selbst.", los: () => { setTiefe(20); setFid("totes"); } },
    { name: "Quecksilber", idee: "Quecksilber ist 13,5-mal so dicht wie Wasser: Schon 76 cm drücken so stark wie die ganze Lufthülle.", los: () => { setTiefe(0.76); setFid("hg"); } },
  ];

  // Druckpfeile rings um die Taucherin, Länge wächst mit dem Gesamtdruck
  const pfeil = 14 + 9 * (pAbs / P_LUFT);
  const pfeile = Array.from({ length: 10 }, (_, i) => {
    const w = (i / 10) * 2 * Math.PI;
    const r0 = 80, r1 = r0 + pfeil;
    return { x1: 470 + r1 * Math.cos(w), y1: ty + r1 * Math.sin(w) * 0.8, x2: 470 + r0 * Math.cos(w), y2: ty + r0 * Math.sin(w) * 0.8 };
  });
  const rBallon = 22 * Math.cbrt(ballon);

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 560" className="w-full h-auto select-none" role="img" aria-label="Taucherin im Wasser">
          <defs>
            <linearGradient id="see" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="hsl(200 80% 62%)" />
              <stop offset="1" stopColor="hsl(215 75% 22%)" />
            </linearGradient>
            <marker id="tauchPfeil" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#ffd23f" /></marker>
          </defs>
          <rect x={0} y={OBEN} width={1000} height={UNTEN - OBEN + 30} fill="url(#see)" />
          <path d={`M0 ${OBEN} Q 125 ${OBEN - 8} 250 ${OBEN} T 500 ${OBEN} T 750 ${OBEN} T 1000 ${OBEN}`} fill="none" stroke="#e6f6ff" strokeWidth={3} />
          <text x={980} y={OBEN - 14} textAnchor="end" fontSize={14} style={text}>Luft: 1 bar</text>
          {/* Tiefenskala */}
          {Array.from({ length: MAX_TIEFE / 5 + 1 }, (_, i) => i * 5).map(t => (
            <g key={t}>
              <line x1={60} y1={OBEN + t * PX} x2={t % 10 ? 72 : 80} y2={OBEN + t * PX} stroke="#e6f6ff" strokeWidth={2} />
              {t % 10 === 0 && <text x={88} y={OBEN + t * PX + 6} fontSize={17} fontWeight={700} fill="#e6f6ff">{t} m · +{zahl(schweredruck(fl.dichte, t) / 1e5, 1)} bar</text>}
            </g>
          ))}
          <line x1={60} y1={OBEN} x2={60} y2={UNTEN} stroke="#e6f6ff" strokeWidth={2} />
          {/* Druckpfeile */}
          {pfeile.map((p, i) => <line key={i} {...p} stroke="#ffd23f" strokeWidth={3} markerEnd="url(#tauchPfeil)" />)}
          {/* Taucherin */}
          <g transform={`translate(470 ${ty}) scale(1.35)`}>
            <rect x={-38} y={-14} width={58} height={13} rx={6} fill="#c0c7cf" stroke="#3c4650" strokeWidth={2} />
            <ellipse cx={0} cy={6} rx={46} ry={14} fill="#222c36" />
            <circle cx={50} cy={2} r={12} fill="#f1c7a3" stroke="#222c36" strokeWidth={4} />
            <rect x={48} y={-6} width={14} height={9} rx={3} fill="#9ed8ff" stroke="#222c36" strokeWidth={2} />
            <path d="M-44 6 L-78 -6 L-80 16 Z" fill="#f39c12" />
          </g>
          {/* Luftballon an einer Schnur */}
          <line x1={520} y1={ty} x2={580} y2={ty - 40} stroke="#e6f6ff" strokeWidth={1.5} />
          <circle cx={580} cy={ty - 40 - rBallon} r={rBallon} fill="#e74c3c" stroke="#7b241c" strokeWidth={2} />
          <Pille x={580} y={ty - 52 - 2 * rBallon} t={`Ballon ${zahl(ballon)} L`} />
          <Pille x={760} y={ty + 6} t={`p = ${bar(P_LUFT)} + ${bar(pW)} = ${bar(pAbs)}`} gross />
          <rect x={0} y={UNTEN} width={1000} height={30} fill="#c9b27c" />
        </svg>
      }
      seite={<>
        <Karte>
          <Regler label={`Tiefe: ${zahl(tiefe)} m`} min={0} max={MAX_TIEFE} step={0.25} wert={tiefe} setze={setTiefe} />
          <label className="flex flex-col gap-1">
            Flüssigkeit
            <select className="input" value={fid} onChange={e => setFid(e.target.value)}>
              {FLUESSIGKEITEN.map(f => <option key={f.id} value={f.id}>{f.name} ({zahl(f.dichte, 0)} kg/m³)</option>)}
            </select>
          </label>
        </Karte>
        <Karte titel="p = ρ · g · h">
          <Werte zeilen={[
            ["ρ (Dichte)", `${zahl(fl.dichte, 0)} kg/m³`],
            ["g", `${zahl(G)} N/kg`],
            ["h (Tiefe)", `${zahl(tiefe)} m`],
            ["Schweredruck", bar(pW)],
            ["+ Luftdruck", bar(P_LUFT)],
            ["Gesamtdruck", bar(pAbs)],
            ["auf 1 cm² wie", `${zahl(pAbs * 1e-4 / G, 1)} kg`],
          ]} />
        </Karte>
      </>}
      unten={<>
        <Paradoxon fuellung={fuellung} setFuellung={setFuellung} />
        <Analogie>
          Der Druck hängt nur vom Höhenunterschied ab, nicht vom Weg dorthin — wie das Potenzial im Stromkreis nur
          davon abhängt, wo man misst. Ein Gegenstück zum Gewicht der Wassersäule gibt es elektrisch aber nicht.
        </Analogie>
      </>}
    />
  );
}

/** Drei Gefäße mit gleichem Boden: Breite in m über der Höhe y (m). */
const GEFAESSE: { name: string; breite: (y: number) => number }[] = [
  { name: "Zylinder", breite: () => 0.3 },
  { name: "Trichter", breite: y => 0.3 + 1.0 * y },
  { name: "Flasche", breite: y => (y < 0.4 ? 0.3 : 0.08) },
];
const SKALA = 300; // px je m

function Paradoxon({ fuellung, setFuellung }: { fuellung: number; setFuellung: (v: number) => void }) {
  const boden = 260, hoehe = 0.75;
  const pBoden = schweredruck(1000, fuellung * hoehe);
  return (
    <Karte titel="Hydrostatisches Paradoxon: Ist dem Boden die Form egal?">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-center">
        <svg viewBox="0 0 1000 300" className="w-full h-auto" role="img" aria-label="Drei Gefäße mit gleicher Füllhöhe">
          {GEFAESSE.map((g, i) => {
            const cx = 180 + i * 320;
            const stufen = Array.from({ length: 61 }, (_, k) => (k / 60) * hoehe);
            const umriss = (ys: number[]) => [
              ...ys.map(y => `${cx - (g.breite(y) * SKALA) / 2} ${boden - y * SKALA}`),
              ...[...ys].reverse().map(y => `${cx + (g.breite(y) * SKALA) / 2} ${boden - y * SKALA}`),
            ];
            const h = fuellung * hoehe;
            const wasser = stufen.filter(y => y <= h).concat([h]);
            // Volumen bei runden Gefäßen: ∫ π (b/2)² dy
            let vol = 0;
            for (let k = 0; k < 200; k++) { const y = ((k + 0.5) / 200) * h; vol += Math.PI * (g.breite(y) / 2) ** 2 * (h / 200); }
            return (
              <g key={g.name}>
                {h > 0 && <path d={`M${umriss(wasser).join(" L")} Z`} fill="hsl(205 80% 55%)" opacity={0.85} />}
                <path d={`M${stufen.map(y => `${cx - (g.breite(y) * SKALA) / 2} ${boden - y * SKALA}`).join(" L")}`} fill="none" stroke="#56616d" strokeWidth={4} />
                <path d={`M${stufen.map(y => `${cx + (g.breite(y) * SKALA) / 2} ${boden - y * SKALA}`).join(" L")}`} fill="none" stroke="#56616d" strokeWidth={4} />
                <line x1={cx - 45} y1={boden} x2={cx + 45} y2={boden} stroke="#56616d" strokeWidth={6} />
                <text x={cx} y={boden + 24} textAnchor="middle" fontSize={14} style={text}>{g.name} · {zahl(vol * 1000, 0)} kg Wasser</text>
                <Pille x={cx} y={boden - 14} t={bar(pBoden, 3)} />
              </g>
            );
          })}
          <line x1={20} y1={boden - fuellung * hoehe * SKALA} x2={980} y2={boden - fuellung * hoehe * SKALA} stroke="#e0a000" strokeWidth={1.5} strokeDasharray="6 6" />
          <text x={24} y={boden - fuellung * hoehe * SKALA - 6} fontSize={13} style={muted}>gleiche Höhe {zahl(fuellung * hoehe * 100, 0)} cm</text>
        </svg>
        <div className="flex flex-col gap-3 text-sm">
          <Regler label={`Füllhöhe: ${zahl(fuellung * hoehe * 100, 0)} cm`} min={0} max={1} step={0.01} wert={fuellung} setze={setFuellung} />
          <p>Die Gefäße wiegen ganz verschieden viel — aber auf den gleich großen Boden drückt überall derselbe Druck: <b>{bar(pBoden, 3)}</b>. Es zählt nur die Höhe der Wassersäule.</p>
        </div>
      </div>
    </Karte>
  );
}
