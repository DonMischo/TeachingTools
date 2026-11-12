"use client";
/**
 * Station »Tauchen«: Schweredruck p = ρ·g·h. Die Taucherin lässt sich auf jede
 * Tiefe ziehen; Druckpfeile von allen Seiten, ein Luftballon schrumpft (Boyle),
 * Ausatemblasen wachsen beim Aufsteigen. Darunter das hydrostatische Paradoxon:
 * drei Gefäße, gleicher Bodendruck.
 */
import { useRef, useState } from "react";
import { FLUESSIGKEITEN, blasenVolumen, schweredruck } from "@/lib/stroemung/druck";
import { G, P_LUFT } from "@/lib/stroemung/modell";
import { Analogie, Karte, Pille, Regler, StationRahmen, Werte, bar, muted, text, useTakt, zahl } from "./rahmen";
import { FARBE, KitDefs, Manometer } from "./kit";

const OBEN = 70, UNTEN = 530, MAX_TIEFE = 40;
const PX = (UNTEN - OBEN) / MAX_TIEFE;
/** Farbton und Sättigung der Flüssigkeit. */
const FARBTON: Record<string, [number, number]> = { suess: [200, 80], meer: [193, 75], totes: [172, 55], oel: [44, 85], hg: [210, 6] };

export default function Tauchen() {
  const [tiefe, setTiefe] = useState(10);
  const [fid, setFid] = useState("suess");
  const [fuellung, setFuellung] = useState(1);
  const fl = FLUESSIGKEITEN.find(f => f.id === fid)!;
  const pW = schweredruck(fl.dichte, tiefe);
  const pAbs = P_LUFT + pW;
  const ballon = blasenVolumen(1, P_LUFT, pAbs);   // 1 L an der Oberfläche
  const ty = OBEN + tiefe * PX;
  const [ton, satt] = FARBTON[fid] ?? FARBTON.suess;
  const hg = fid === "hg";

  // Bewegung: Zeit, Ausatemblasen (wachsen beim Aufsteigen), Schwebeteilchen
  const zeit = useRef(0);
  const blasen = useRef<{ x: number; y: number; v0: number; p0: number }[]>([]);
  const schweb = useRef(Array.from({ length: 46 }, (_, i) => ({ x: (i * 211) % 1000, y: OBEN + 20 + ((i * 97) % (UNTEN - OBEN - 30)), r: 1 + (i % 3) * 0.7 })));
  const naechste = useRef(0);
  useTakt(dt => {
    zeit.current += dt;
    naechste.current -= dt;
    if (naechste.current <= 0 && tiefe > 0.3) {
      naechste.current = 1.6;
      for (let k = 0; k < 4; k++) blasen.current.push({ x: 470 + 74 + (Math.random() - 0.5) * 6, y: ty - 4 - k * 9, v0: 0.5 + Math.random() * 0.8, p0: pAbs });
    }
    blasen.current = blasen.current.filter(b => {
      b.y -= (70 + 25 * b.v0) * dt;
      b.x += Math.sin(zeit.current * 4 + b.v0 * 9) * 18 * dt;
      return b.y > OBEN;
    });
    for (const t of schweb.current) { t.x = (t.x + 6 * dt + 1000) % 1000; t.y += Math.sin(zeit.current * 0.7 + t.x) * 3 * dt; }
  });
  const pBei = (y: number) => P_LUFT + schweredruck(fl.dichte, Math.max(0, (y - OBEN) / PX));

  // Taucherin ziehen
  const svg = useRef<SVGSVGElement>(null);
  const greift = useRef(false);
  const ziehe = (ev: React.PointerEvent) => {
    if (!greift.current || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const y = ((ev.clientY - r.top) / r.height) * 560;
    setTiefe(Math.round(Math.max(0, Math.min(MAX_TIEFE, (y - OBEN) / PX)) * 4) / 4);
  };

  const versuche = [
    { name: "10 m tief", idee: "In 10 m Wassertiefe kommt noch einmal so viel Druck dazu, wie die ganze Luft darüber drückt: 1 bar + 1 bar.", los: () => { setTiefe(10); setFid("suess"); } },
    { name: "Ballon schrumpft", idee: "Der Ballon wird mit der Tiefe kleiner: doppelter Druck, halbes Volumen (Boyle-Mariotte). Darum atmet man beim Auftauchen aus — und die Ausatemblasen werden nach oben hin immer größer.", los: () => { setTiefe(30); setFid("suess"); } },
    { name: "Totes Meer", idee: "Dichtere Flüssigkeit, mehr Druck in gleicher Tiefe — und im Toten Meer trägt das Wasser einen Menschen fast von selbst.", los: () => { setTiefe(20); setFid("totes"); } },
    { name: "Quecksilber", idee: "Quecksilber ist 13,5-mal so dicht wie Wasser: Schon 76 cm drücken so stark wie die ganze Lufthülle.", los: () => { setTiefe(0.76); setFid("hg"); } },
  ];

  // Druckpfeile rings um die Taucherin, Länge und Dicke wachsen mit dem Gesamtdruck
  const pfeil = Math.min(110, 14 + 9 * (pAbs / P_LUFT));
  const pfeile = Array.from({ length: 12 }, (_, i) => {
    const w = (i / 12) * 2 * Math.PI;
    const r0 = 96, r1 = r0 + pfeil;
    return { x1: 470 + r1 * Math.cos(w), y1: ty + r1 * Math.sin(w) * 0.7, x2: 470 + r0 * Math.cos(w), y2: ty + r0 * Math.sin(w) * 0.7 };
  });
  const rBallon = 24 * Math.cbrt(ballon);
  const z = zeit.current;
  const flosse = Math.sin(z * 3) * 9;
  const welle = (dy: number) => Array.from({ length: 21 }, (_, i) => `${i * 50} ${OBEN + dy + Math.sin(z * 1.4 + i * 0.9) * 4}`).join(" L");

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg ref={svg} viewBox="0 0 1000 560" className="w-full h-auto select-none touch-none" role="img" aria-label="Taucherin im Wasser, zum Tauchen nach oben oder unten ziehen"
          onPointerMove={ziehe} onPointerUp={() => { greift.current = false; }} onPointerLeave={() => { greift.current = false; }}>
          <KitDefs />
          <defs>
            <linearGradient id="see" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={`hsl(${ton} ${satt}% ${hg ? 72 : 60}%)`} />
              <stop offset="0.55" stopColor={`hsl(${ton + 8} ${satt}% ${hg ? 45 : 34}%)`} />
              <stop offset="1" stopColor={`hsl(${ton + 15} ${satt}% ${hg ? 22 : 13}%)`} />
            </linearGradient>
            <linearGradient id="himmel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8fc9f0" /><stop offset="1" stopColor="#e6f4fc" />
            </linearGradient>
            <linearGradient id="strahl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity={hg ? 0.12 : 0.3} /><stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c9b27c" /><stop offset="1" stopColor="#8a7448" />
            </linearGradient>
            <radialGradient id="ballonGlanz" cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor="#ff8a7a" /><stop offset="0.6" stopColor="#e03c2c" /><stop offset="1" stopColor="#8e1f15" />
            </radialGradient>
            <linearGradient id="flasche" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe066" /><stop offset="0.5" stopColor="#f2b705" /><stop offset="1" stopColor="#a87b00" />
            </linearGradient>
            <marker id="tauchPfeil" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4} markerHeight={4} orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#ffd23f" /></marker>
          </defs>

          {/* Himmel, Boot, Wasser */}
          <rect x={0} y={0} width={1000} height={OBEN + 10} fill="url(#himmel)" />
          <circle cx={880} cy={20} r={34} fill="#fff6c8" opacity={0.85} />
          <g transform={`translate(250 ${OBEN - 2 + Math.sin(z * 1.4 + 4.5) * 3}) rotate(${Math.sin(z * 1.1) * 2})`}>
            <path d="M-70 -18 L70 -18 L52 6 L-56 6 Z" fill="#f4f4f4" stroke="#56616d" strokeWidth={2} />
            <path d="M-70 -18 L70 -18 L66 -12 L-67 -12 Z" fill="#d64541" />
            <rect x={-20} y={-36} width={38} height={18} rx={3} fill="#e7edf2" stroke="#56616d" strokeWidth={2} />
            <path d="M58 -18 V-46 L84 -40 L58 -34" fill="#d64541" stroke="#56616d" strokeWidth={1.5} />
          </g>
          <path d={`M0 ${OBEN} L${welle(0)} L1000 ${UNTEN + 30} L0 ${UNTEN + 30} Z`} fill="url(#see)" />
          {[120, 330, 560, 760, 920].map((x, i) => {
            const s = Math.sin(z * 0.5 + i * 1.7) * 30;
            return <path key={x} d={`M${x - 18} ${OBEN} L${x + 18} ${OBEN} L${x + 120 + s} ${UNTEN - 60} L${x + 30 + s} ${UNTEN - 60} Z`} fill="url(#strahl)" />;
          })}
          <path d={`M${welle(0)}`} fill="none" stroke="#e6f6ff" strokeWidth={3} />
          <path d={`M${welle(7)}`} fill="none" stroke="#e6f6ff" strokeWidth={1.5} opacity={0.4} />
          {schweb.current.map((t, i) => <circle key={i} cx={t.x} cy={t.y} r={t.r} fill="#e6f6ff" opacity={0.35} />)}
          <text x={980} y={OBEN - 14} textAnchor="end" fontSize={14} fontWeight={700} fill="#2f3740">Luft: 1 bar</text>

          {/* Meeresgrund mit Steinen, Seegras und Fischen */}
          <path d={`M0 ${UNTEN} Q 120 ${UNTEN - 14} 240 ${UNTEN - 4} T 520 ${UNTEN - 8} T 800 ${UNTEN - 2} T 1000 ${UNTEN - 10} V560 H0 Z`} fill="url(#sand)" />
          <ellipse cx={820} cy={UNTEN - 4} rx={60} ry={22} fill="#5d6873" /><ellipse cx={800} cy={UNTEN - 14} rx={26} ry={10} fill="#77828d" />
          <ellipse cx={170} cy={UNTEN} rx={34} ry={14} fill="#6b7680" />
          {[[880, 70], [905, 55], [140, 60], [650, 48], [668, 64]].map(([x, h], i) => (
            <path key={i} d={`M${x} ${UNTEN} Q ${x + 14 * Math.sin(z * 1.2 + i)} ${UNTEN - h / 2} ${x + 8 * Math.sin(z * 1.2 + i + 1)} ${UNTEN - h}`} fill="none" stroke="#2f8f4e" strokeWidth={6} strokeLinecap="round" />
          ))}
          {!hg && Array.from({ length: 7 }, (_, i) => {
            const fx = ((z * 22 + i * 23) % 1300) - 150, fy = 160 + (i % 3) * 16 + Math.sin(z + i) * 5;
            return <path key={i} d={`M${fx} ${fy} q 10 -7 20 0 q -10 7 -20 0 M${fx} ${fy} l -7 -5 v 10 z`} fill="#f0a64a" opacity={0.85} />;
          })}

          {/* Tiefenskala als Messband */}
          <rect x={44} y={OBEN} width={14} height={UNTEN - OBEN} fill="#f2f2f2" opacity={0.85} />
          {Array.from({ length: MAX_TIEFE + 1 }, (_, t) => t).map(t => (
            <g key={t}>
              <line x1={44} y1={OBEN + t * PX} x2={t % 5 ? 50 : 58} y2={OBEN + t * PX} stroke="#2f3740" strokeWidth={t % 5 ? 1 : 2} />
              {t % 10 === 0 && <text x={66} y={OBEN + t * PX + 6} fontSize={16} fontWeight={700} fill="#e6f6ff">{t} m · +{zahl(schweredruck(fl.dichte, t) / 1e5, 1)} bar</text>}
            </g>
          ))}

          {/* Ausatemblasen: wachsen beim Aufsteigen, weil der Druck sinkt */}
          {blasen.current.map((b, i) => {
            const r = 3.5 * b.v0 * Math.cbrt(b.p0 / pBei(b.y)) + 2;
            return (
              <g key={i}>
                <circle cx={b.x} cy={b.y} r={r} fill="#fff" fillOpacity={0.25} stroke="#fff" strokeOpacity={0.8} strokeWidth={1.2} />
                <circle cx={b.x - r * 0.35} cy={b.y - r * 0.35} r={r * 0.25} fill="#fff" opacity={0.8} />
              </g>
            );
          })}

          {/* Druckpfeile */}
          {pfeile.map((p, i) => <line key={i} {...p} stroke="#ffd23f" strokeWidth={2 + pAbs / P_LUFT} strokeLinecap="round" markerEnd="url(#tauchPfeil)" opacity={0.9} />)}

          {/* Taucherin zum Ziehen */}
          <g transform={`translate(470 ${ty})`} style={{ cursor: "ns-resize" }}
            onPointerDown={ev => { greift.current = true; try { (ev.target as Element).setPointerCapture(ev.pointerId); } catch { /* Zeiger schon weg */ } }}>
            <ellipse cx={0} cy={0} rx={110} ry={50} fill="transparent" />
            <g transform="scale(1.3)">
              <path d="M-30 6 L-62 4" stroke="#1d252d" strokeWidth={11} strokeLinecap="round" />
              <path d="M-30 10 L-60 16" stroke="#1d252d" strokeWidth={11} strokeLinecap="round" />
              <path d={`M-62 4 L-92 ${-6 + flosse} L-94 ${8 + flosse} Z`} fill="#f39c12" />
              <path d={`M-60 16 L-90 ${22 - flosse} L-90 ${34 - flosse} Z`} fill="#e67e22" />
              <rect x={-34} y={-20} width={52} height={14} rx={7} fill="url(#flasche)" stroke="#7a5f10" strokeWidth={1.5} />
              <rect x={18} y={-17} width={7} height={8} rx={2} fill={FARBE.metall} />
              <ellipse cx={0} cy={6} rx={38} ry={13} fill="#222c36" />
              <path d="M-30 4 Q 0 -4 34 4" stroke="#3b9fe0" strokeWidth={3} fill="none" />
              <path d="M24 8 L46 18 L60 10" stroke="#222c36" strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={61} cy={9} r={4} fill="#f1c7a3" />
              <circle cx={44} cy={0} r={11} fill="#1d252d" />
              <rect x={45} y={-7} width={14} height={9} rx={3} fill="#9ed8ff" stroke="#1d252d" strokeWidth={2} />
              <circle cx={56} cy={6} r={3.5} fill="#56616d" />
              <path d="M22 -14 Q 40 -16 54 6" stroke="#2f3740" strokeWidth={2} fill="none" />
            </g>
          </g>
          <text x={470} y={ty + 76} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff" opacity={0.85}>↕ ziehen</text>

          {/* Luftballon an der Schnur */}
          <path d={`M${470 + 79} ${ty + 12} Q ${580 + Math.sin(z * 2) * 6} ${ty - 10} 590 ${ty - 46}`} stroke="#e6f6ff" strokeWidth={1.5} fill="none" />
          <ellipse cx={590} cy={ty - 46 - rBallon} rx={rBallon * 0.92} ry={rBallon} fill="url(#ballonGlanz)" />
          <path d={`M586 ${ty - 46} l4 -6 l4 6 z`} fill="#8e1f15" />
          <Pille x={590} y={ty - 58 - 2 * rBallon} t={`Ballon ${zahl(ballon)} L`} />

          {/* Tauchcomputer */}
          <Manometer x={800} y={ty} r={34} wert={pAbs / 1e5} max={Math.max(6, Math.ceil(pAbs / 1e5) + 1)} />
          <Pille x={800} y={ty + 60} t={`p = ${bar(P_LUFT)} + ${bar(pW)} = ${bar(pAbs)}`} gross />
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
        <svg viewBox="0 0 1000 330" className="w-full h-auto" role="img" aria-label="Drei Gefäße mit gleicher Füllhöhe">
          <KitDefs id="kitp" />
          <defs>
            <linearGradient id="paradoxWasser" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7cc4f2" /><stop offset="1" stopColor="#1f6fb5" />
            </linearGradient>
          </defs>
          <rect x={20} y={boden + 4} width={960} height={14} rx={4} fill="#9a6b43" />
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
            const links = stufen.map(y => `${cx - (g.breite(y) * SKALA) / 2} ${boden - y * SKALA}`).join(" L");
            const rechts = stufen.map(y => `${cx + (g.breite(y) * SKALA) / 2} ${boden - y * SKALA}`).join(" L");
            return (
              <g key={g.name}>
                <path d={`M${umriss(stufen).join(" L")} Z`} fill="#e6f3fb" opacity={0.25} />
                {h > 0 && <path d={`M${umriss(wasser).join(" L")} Z`} fill="url(#paradoxWasser)" opacity={0.9} />}
                {h > 0 && <path d={`M${umriss([h]).join(" L")}`} stroke="#d4eeff" strokeWidth={2} />}
                {[links, rechts].map((d, k) => <g key={k}><path d={`M${d}`} fill="none" stroke="#9fb3c2" strokeWidth={6} strokeLinecap="round" /><path d={`M${d}`} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.5} /></g>)}
                <line x1={cx - 48} y1={boden} x2={cx + 48} y2={boden} stroke="#56616d" strokeWidth={6} />
                <line x1={cx + 48} y1={boden - 8} x2={cx + 70} y2={boden - 8} stroke="#56616d" strokeWidth={5} />
                <Manometer x={cx + 92} y={boden - 26} r={22} wert={pBoden / 1000} max={10} einheit="kPa" id="kitp" />
                <text x={cx} y={boden + 42} textAnchor="middle" fontSize={14} style={text}>{g.name} · {zahl(vol * 1000, 0)} kg Wasser</text>
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
