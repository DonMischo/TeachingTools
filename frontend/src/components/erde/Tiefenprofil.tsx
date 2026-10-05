"use client";
/**
 * Tiefenprofil: Temperatur, Druck, Dichte, Wellen, Zähigkeit und Schwere von
 * der Oberfläche bis zum Erdmittelpunkt — nebeneinander, mit gemeinsamer
 * Tiefenachse. Wer mit der Maus fährt, liest alle Werte in einer Tiefe ab.
 */
import { useMemo, useRef, useState } from "react";
import {
  ERDRADIUS, SCHICHTEN, TABELLEN, ZAEHIGKEITEN, profilWert, schichtBei, type Groesse,
} from "@/lib/erde/schichten";
import { zehnHoch } from "./SchichtInfo";

interface Kurve { groesse: Groesse; farbe: string; name: string; gestrichelt?: boolean }
interface Tafel {
  titel: string;
  einheit: string;
  min: number;
  max: number;
  ticks: number[];
  kurven: Kurve[];
  log?: boolean;
  format?: (x: number) => string;
}

const TAFELN: Tafel[] = [
  {
    titel: "Temperatur", einheit: "°C", min: 0, max: 6000, ticks: [0, 2000, 4000, 6000],
    kurven: [
      { groesse: "temperatur", farbe: "#ef4444", name: "Temperatur" },
      { groesse: "schmelzen", farbe: "#a3a3a3", name: "Schmelzbeginn", gestrichelt: true },
    ],
  },
  {
    titel: "Druck", einheit: "GPa", min: 0, max: 380, ticks: [0, 100, 200, 300],
    kurven: [{ groesse: "druck", farbe: "#8b5cf6", name: "Druck" }],
  },
  {
    titel: "Dichte", einheit: "g/cm³", min: 0, max: 14, ticks: [0, 5, 10],
    kurven: [{ groesse: "dichte", farbe: "#10b981", name: "Dichte" }],
  },
  {
    titel: "Erdbebenwellen", einheit: "km/s", min: 0, max: 14, ticks: [0, 5, 10],
    kurven: [
      { groesse: "vp", farbe: "#3b82f6", name: "P-Wellen" },
      { groesse: "vs", farbe: "#f59e0b", name: "S-Wellen" },
    ],
  },
  {
    titel: "Zähigkeit", einheit: "Pa·s", min: -5, max: 25, ticks: [-3, 8, 13, 20], log: true,
    kurven: [{ groesse: "viskositaet", farbe: "#ec4899", name: "Viskosität" }],
    format: x => `≈ ${zehnHoch(x)}`,
  },
  {
    titel: "Schwere", einheit: "m/s²", min: 0, max: 11, ticks: [0, 5, 10],
    kurven: [{ groesse: "schwere", farbe: "#06b6d4", name: "Schwere" }],
  },
];

const OBEN = 34, HOEHE = 520, BALKEN = 120, BREITE = 138, LUECKE = 10;

/** Tiefen, an denen sich etwas ändert, plus ein feines Raster. */
function stuetzstellen(bis: number): number[] {
  const z = new Set<number>();
  for (let i = 0; i <= 400; i++) z.add((bis * i) / 400);
  for (const t of Object.values(TABELLEN)) for (const [d] of t) if (d <= bis) { z.add(Math.max(0, d - 0.01)); z.add(Math.min(bis, d + 0.01)); }
  return [...z].sort((a, b) => a - b);
}

function fmt(x: number, stellen = 1) {
  return x.toLocaleString("de-DE", { maximumFractionDigits: stellen });
}

export default function Tiefenprofil() {
  const [nurOben, setNurOben] = useState(false);
  const [tiefe, setTiefe] = useState<number | null>(410);
  const svgRef = useRef<SVGSVGElement>(null);
  const bis = nurOben ? 1000 : ERDRADIUS;
  const y = (z: number) => OBEN + (z / bis) * HOEHE;
  const zs = useMemo(() => stuetzstellen(bis), [bis]);
  const breite = BALKEN + TAFELN.length * (BREITE + LUECKE);

  function bewegen(e: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const z = ((p.y - OBEN) / HOEHE) * bis;
    if (z >= 0 && z <= bis) setTiefe(z);
  }

  const sch = tiefe != null ? schichtBei(tiefe) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => setNurOben(false)} className={`px-3 py-1 rounded-lg font-bold ${!nurOben ? "bg-accent text-accent-fg" : "border border-line"}`}>ganze Erde</button>
        <button onClick={() => setNurOben(true)} className={`px-3 py-1 rounded-lg font-bold ${nurOben ? "bg-accent text-accent-fg" : "border border-line"}`}>obere 1000 km</button>
        <span className="text-muted">Mit der Maus (oder dem Finger) über das Bild fahren.</span>
      </div>
      <div className="card overflow-x-auto">
        <svg ref={svgRef} viewBox={`0 0 ${breite} ${OBEN + HOEHE + 30}`} className="w-full min-w-[760px] touch-none select-none"
          onPointerMove={bewegen} onPointerDown={bewegen}>
          {/* Schichtbalken */}
          {SCHICHTEN.filter(s => s.von < bis).map(s => (
            <g key={s.id}>
              <rect x={40} y={y(s.von)} width={BALKEN - 48} height={y(Math.min(s.bis, bis)) - y(s.von)} fill={s.farbe} />
              {y(Math.min(s.bis, bis)) - y(s.von) > 14 && (
                <text x={40 + (BALKEN - 48) / 2} y={(y(s.von) + y(Math.min(s.bis, bis))) / 2 + 4} textAnchor="middle" fontSize={10}
                  fill={s.id === "innenkern" || s.id === "aussenkern" ? "#111" : "#fff"} fontWeight={700}>
                  {s.name.replace("Lithosphärischer ", "Lith. ")}
                </text>
              )}
            </g>
          ))}
          {/* Tiefenachse */}
          {(nurOben ? [0, 100, 200, 410, 660, 1000] : [0, 660, 1000, 2000, 2891, 4000, 5150, 6371]).map(z => (
            <g key={z}>
              <line x1={34} x2={40} y1={y(z)} y2={y(z)} stroke="currentColor" opacity={0.5} />
              <text x={32} y={y(z) + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.7}>{fmt(z, 0)}</text>
            </g>
          ))}
          <text x={4} y={OBEN - 12} fontSize={10} fill="currentColor" opacity={0.7}>Tiefe km</text>

          {TAFELN.map((t, k) => {
            const x0 = BALKEN + k * (BREITE + LUECKE);
            const xw = (w: number) => x0 + ((Math.min(t.max, Math.max(t.min, w)) - t.min) / (t.max - t.min)) * BREITE;
            return (
              <g key={t.titel}>
                <text x={x0 + BREITE / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={800} fill="currentColor">{t.titel}</text>
                <text x={x0 + BREITE / 2} y={27} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>{t.einheit}{t.log ? " (log)" : ""}</text>
                <rect x={x0} y={OBEN} width={BREITE} height={HOEHE} fill="none" stroke="currentColor" opacity={0.2} />
                {/* Schichtgrenzen */}
                {SCHICHTEN.filter(s => s.bis < bis).map(s => (
                  <line key={s.id} x1={x0} x2={x0 + BREITE} y1={y(s.bis)} y2={y(s.bis)} stroke="currentColor" opacity={0.12} />
                ))}
                {t.ticks.map(v => (
                  <g key={v}>
                    <line x1={xw(v)} x2={xw(v)} y1={OBEN} y2={OBEN + HOEHE} stroke="currentColor" opacity={0.08} />
                    <text x={xw(v)} y={OBEN + HOEHE + 12} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>
                      {t.log ? zehnHoch(v) : fmt(v, 0)}
                    </text>
                  </g>
                ))}
                {t.log && ZAEHIGKEITEN.map(v => (
                  <g key={v.name}>
                    <line x1={xw(v.log)} x2={xw(v.log)} y1={OBEN} y2={OBEN + 8} stroke="#ec4899" opacity={0.7} />
                    <text x={xw(v.log) + 2} y={OBEN + 16 + (ZAEHIGKEITEN.indexOf(v) % 3) * 9} fontSize={8} fill="#ec4899">{v.name}</text>
                  </g>
                ))}
                {t.kurven.map(c => (
                  <polyline key={c.groesse} fill="none" stroke={c.farbe} strokeWidth={2} strokeDasharray={c.gestrichelt ? "4 3" : undefined}
                    points={zs.map(z => `${xw(profilWert(c.groesse, z)).toFixed(1)},${y(z).toFixed(1)}`).join(" ")} />
                ))}
                {tiefe != null && t.kurven.map(c => {
                  const w = profilWert(c.groesse, tiefe);
                  return <circle key={c.groesse} cx={xw(w)} cy={y(tiefe)} r={3.5} fill={c.farbe} />;
                })}
                {t.kurven.length > 1 && t.kurven.map((c, i) => (
                  <text key={c.name} x={x0 + BREITE - 4} y={OBEN + HOEHE - 8 - i * 11} textAnchor="end" fontSize={9} fill={c.farbe} fontWeight={700}>{c.name}</text>
                ))}
              </g>
            );
          })}
          {tiefe != null && (
            <line x1={34} x2={breite} y1={y(tiefe)} y2={y(tiefe)} stroke="currentColor" opacity={0.5} strokeDasharray="3 3" />
          )}
        </svg>
      </div>

      {tiefe != null && sch && (
        <div className="card p-3 text-sm grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <Wert k="Tiefe" v={`${fmt(tiefe, 0)} km`} />
          <Wert k="Schicht" v={sch.name} />
          <Wert k="Temperatur" v={`${fmt(profilWert("temperatur", tiefe), 0)} °C`} />
          <Wert k="Druck" v={`${fmt(profilWert("druck", tiefe))} GPa ≈ ${fmt(profilWert("druck", tiefe) * 10000, 0)} bar`} />
          <Wert k="Dichte" v={`${fmt(profilWert("dichte", tiefe), 2)} g/cm³`} />
          <Wert k="P / S" v={`${fmt(profilWert("vp", tiefe))} / ${profilWert("vs", tiefe) === 0 ? "–" : fmt(profilWert("vs", tiefe))} km/s`} />
          <Wert k="Zähigkeit" v={`≈ ${zehnHoch(profilWert("viskositaet", tiefe))} Pa·s`} />
          <Wert k="Schwere" v={`${fmt(profilWert("schwere", tiefe), 2)} m/s²`} />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <Hinweis titel="🌡️ Warum ist der innere Kern fest?">
          Die gestrichelte Linie zeigt, ab welcher Temperatur das Material schmilzt. Im äußeren Kern liegt die Temperatur darüber — er ist flüssig.
          Zur Mitte hin steigt der Druck so stark, dass der Schmelzpunkt die Temperatur überholt: Der innere Kern ist fest, obwohl er heißer ist.
        </Hinweis>
        <Hinweis titel="🫠 Warum fließt die Asthenosphäre?">
          In 100–250 km Tiefe kommt die Temperatur dem Schmelzbeginn am nächsten. Das Gestein bleibt fest, wird aber weich — ein winziger Teil schmilzt.
          Die Zähigkeit fällt um das Tausendfache, die Erdbebenwellen werden langsamer. Auf dieser Schicht gleiten die Platten.
        </Hinweis>
        <Hinweis titel="📈 Sprünge im Profil">
          An der Moho, bei 410 und 660 km und an der Kerngrenze springen Dichte und Wellengeschwindigkeit. Dort ändert sich der Stoff (Gestein → Metall)
          oder die Kristalle packen sich dichter. An der Kerngrenze fallen die S-Wellen auf null: Der äußere Kern ist flüssig.
        </Hinweis>
      </div>
    </div>
  );
}

function Wert({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{k}</div>
      <div className="font-bold">{v}</div>
    </div>
  );
}

function Hinweis({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="card p-3 leading-relaxed">
      <h4 className="font-black mb-1">{titel}</h4>
      <p>{children}</p>
    </div>
  );
}
