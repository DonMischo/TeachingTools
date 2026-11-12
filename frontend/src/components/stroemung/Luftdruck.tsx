"use client";
/**
 * Station »Luftdruck«.
 *  Saugrohr:   Eine Kolbenpumpe sitzt oben auf dem Steigrohr — den Griff zieht
 *              man selbst. Hub um Hub wird die Luft im Rohr dünner, die Außenluft
 *              drückt die Flüssigkeit hoch: höchstens bis Luftdruck = ρ·g·h
 *              (Wasser gut 10 m, Quecksilber 76 cm). Modell: lib/stroemung/kolbenpumpe.ts.
 *  Saugheber:  Schlauch über eine Mauer; läuft, solange der Auslauf tiefer liegt
 *              und oben im Bogen kein Dampf entsteht (Löser, live).
 */
import { useRef, useState } from "react";
import { FLUESSIGKEITEN, luftdruckInHoehe, maxSaughoehe } from "@/lib/stroemung/druck";
import { Kolbenpumpe } from "@/lib/stroemung/kolbenpumpe";
import { Stroemung } from "@/lib/stroemung/loeser";
import { G, P_LUFT } from "@/lib/stroemung/modell";
import { FARBE, GlasTank, KitDefs, Kulisse, Manometer, Rohr, useFliessen } from "./kit";
import { Analogie, Karte, Pille, StationRahmen, Wahl, Werte, bar, useTakt, zahl } from "./rahmen";

export default function Luftdruck() {
  const [teil, setTeil] = useState<"saug" | "heber">("saug");
  return (
    <div className="flex flex-col gap-3">
      <Wahl werte={[{ id: "saug", label: "🪠 Saugpumpe" }, { id: "heber", label: "🪣 Saugheber" }]} wert={teil} setze={setTeil} />
      {teil === "saug" ? <Saugrohr /> : <Saugheber />}
    </div>
  );
}

const ORTE = [
  { name: "Meer", hoehe: 0 }, { name: "Brocken", hoehe: 1141 }, { name: "Zugspitze", hoehe: 2962 },
  { name: "Mont Blanc", hoehe: 4806 }, { name: "Mount Everest", hoehe: 8849 },
];

/** Feste Streuung für Luftteilchen-Punkte (gleiche Lage bei jedem Zeichnen). */
const STREU = Array.from({ length: 160 }, (_, i) => ({ x: ((i * 37) % 97) / 97, y: ((i * 61) % 89) / 89 }));

// Bildmaße der Pumpe
const ROHR_X = 500, ROHR_OBEN = 160, BECKEN = 470, ZYL_OBEN = 70, ZYL_B = 96, ROHR_B = 22;

function neuePumpe(fid: string, ort: number) {
  const fl = FLUESSIGKEITEN.find(f => f.id === fid)!;
  const luft = luftdruckInHoehe(ORTE[ort].hoehe);
  const laenge = maxSaughoehe(fl) * 1.2;
  return new Kolbenpumpe({ rohrFlaeche: 1.26e-3, rohrLaenge: laenge, zylFlaeche: 1.13e-2, hub: 0.3 }, luft, fl.dichte, fl.dampfdruck);
}

function Saugrohr() {
  const [fid, setFid] = useState("suess");
  const [ort, setOrt] = useState(0);
  const pumpe = useRef(neuePumpe("suess", 0));
  const p = pumpe.current;
  const [auto, setAuto] = useState(0);            // noch zu fahrende Hübe
  const phase = useRef(0);
  const greift = useRef(false);
  const svg = useRef<SVGSVGElement>(null);
  const fl = FLUESSIGKEITEN.find(f => f.id === fid)!;
  const neu = (f: string, o: number) => { setFid(f); setOrt(o); pumpe.current = neuePumpe(f, o); setAuto(0); };

  useTakt(dt => {
    if (auto > 0 && !greift.current) {
      phase.current += dt / 0.9;
      const q = phase.current % 1;
      p.bewege(p.m.hub * (q < 0.5 ? q * 2 : 2 - q * 2));
      if (phase.current >= 1) { phase.current = 0; p.bewege(0); setAuto(a => a - 1); }
    }
  });

  // Geometrie: Kolben im Zylinder (unten = 0), Säule im Rohr
  const zylUnten = ROHR_OBEN, zylHoehe = ROHR_OBEN - ZYL_OBEN;
  const kolbenY = zylUnten - (p.s / p.m.hub) * (zylHoehe - 8);
  const pxM = (BECKEN - ROHR_OBEN) / p.m.rohrLaenge;
  const saeuleY = BECKEN - p.h * pxM;
  const grenzeY = BECKEN - p.grenze * pxM;
  const griffY = kolbenY - 58;
  const hg = fid === "hg";
  const farbe = hg ? "#b8c0c8" : fid === "oel" ? FARBE.oel : FARBE.wasser;
  const meter = (m: number) => (hg ? `${zahl(m * 100, 1)} cm` : `${zahl(m, 2)} m`);

  const ziehe = (ev: React.PointerEvent) => {
    if (!greift.current || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const y = ((ev.clientY - r.top) / r.height) * 560 + 58;          // Kolbenhöhe aus der Griffhöhe
    p.bewege(((zylUnten - y) / (zylHoehe - 8)) * p.m.hub);
  };

  // Luftteilchen: Dichte ∝ Druck
  const luftPunkte = (x0: number, y0: number, b: number, h: number, druck: number, key: string) =>
    STREU.slice(0, Math.round(Math.min(160, (h * b) / 140) * Math.min(1.2, druck / P_LUFT))).map((s, i) => (
      <circle key={`${key}${i}`} cx={x0 + 3 + s.x * (b - 6)} cy={y0 + 3 + s.y * Math.max(0, h - 6)} r={1.6} fill="#5d6873" opacity={0.7} />
    ));

  const versuche = [
    { name: "Selbst pumpen", idee: "Zieh den Griff hoch und drück ihn wieder runter — immer wieder. Beim Hochziehen wird die Luft im Rohr dünner, und die Außenluft drückt das Wasser ein Stück nach oben.", los: () => neu("suess", 0) },
    { name: "10-Meter-Grenze", idee: "Pumpe weiter, so lange du willst: Über gut 10 m kommt das Wasser nicht. Mehr als den ganzen Luftdruck gibt es nicht — darüber bleibt nur Wasserdampf.", los: () => { neu("suess", 0); setAuto(30); } },
    { name: "Torricelli 1643", idee: "Mit Quecksilber bleibt die Säule bei 76 cm stehen. So wurde der Luftdruck zum ersten Mal gemessen: 760 mm Quecksilbersäule.", los: () => { neu("hg", 0); setAuto(25); } },
    { name: "Auf der Zugspitze", idee: "Oben drückt weniger Luft auf das Becken: Die Säule kommt nur noch gut 7 m hoch.", los: () => { neu("suess", 2); setAuto(30); } },
  ];

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg ref={svg} viewBox="0 0 1000 560" className="w-full h-auto select-none touch-none" role="img" aria-label="Saugpumpe auf einem Steigrohr"
          onPointerMove={ziehe} onPointerUp={() => { greift.current = false; }} onPointerLeave={() => { greift.current = false; }}>
          <KitDefs />
          <Kulisse breite={1000} hoehe={560} boden={BECKEN - 20} />
          {/* Brunnenbecken */}
          <path d={`M250 ${BECKEN - 30} V540 H750 V${BECKEN - 30}`} fill="#9aa5b1" stroke="#56616d" strokeWidth={4} />
          <rect x={254} y={BECKEN} width={492} height={66} fill={farbe} opacity={0.9} />
          <path d={`M254 ${BECKEN} q 30 -5 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0`} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={2} />
          {/* Luftdruck drückt aufs Becken */}
          {[300, 370, 630, 700].map(x => (
            <g key={x}>
              <line x1={x} y1={BECKEN - 110} x2={x} y2={BECKEN - 12} stroke="#e0a000" strokeWidth={5} />
              <path d={`M${x - 8} ${BECKEN - 22} L${x} ${BECKEN - 8} L${x + 8} ${BECKEN - 22} Z`} fill="#e0a000" />
            </g>
          ))}
          <Pille x={820} y={BECKEN - 70} t={`Luft drückt: ${bar(p.luft, 3)}`} />

          {/* Steigrohr aus Glas mit Säule und dünner werdender Luft */}
          <rect x={ROHR_X - ROHR_B / 2} y={ROHR_OBEN} width={ROHR_B} height={BECKEN + 40 - ROHR_OBEN} fill="#eef6fb" opacity={0.55} />
          <rect x={ROHR_X - ROHR_B / 2} y={saeuleY} width={ROHR_B} height={BECKEN + 40 - saeuleY} fill={farbe} />
          {p.druckRohr <= p.dampf * 1.01 && p.h > 0.01 && <text x={ROHR_X + 20} y={(ROHR_OBEN + saeuleY) / 2} fontSize={13} fill="#2f3740">nur Dampf</text>}
          {luftPunkte(ROHR_X - ROHR_B / 2, ROHR_OBEN, ROHR_B, saeuleY - ROHR_OBEN, p.druckRohr, "r")}
          <rect x={ROHR_X - ROHR_B / 2} y={ROHR_OBEN} width={ROHR_B} height={BECKEN + 40 - ROHR_OBEN} fill="url(#kit-glas)" stroke="#9fb3c2" strokeWidth={2} />
          {/* Skala und Grenze */}
          {Array.from({ length: Math.floor(p.m.rohrLaenge / (hg ? 0.1 : 1)) + 1 }, (_, i) => i * (hg ? 0.1 : 1)).map(m => (
            <g key={m}>
              <line x1={ROHR_X - ROHR_B / 2 - 10} y1={BECKEN - m * pxM} x2={ROHR_X - ROHR_B / 2 - 2} y2={BECKEN - m * pxM} stroke="#2f3740" strokeWidth={1.5} />
              <text x={ROHR_X - ROHR_B / 2 - 14} y={BECKEN - m * pxM + 4} textAnchor="end" fontSize={12} fill="#2f3740">{hg ? `${zahl(m * 100, 0)} cm` : `${m} m`}</text>
            </g>
          ))}
          <line x1={ROHR_X - 90} y1={grenzeY} x2={ROHR_X + 90} y2={grenzeY} stroke="#c0392b" strokeWidth={2} strokeDasharray="7 5" />
          <text x={ROHR_X - 62} y={grenzeY - 6} textAnchor="end" fontSize={13} fontWeight={700} fill="#c0392b">Grenze {meter(p.grenze)}</text>
          <Pille x={ROHR_X + 130} y={saeuleY} t={`h = ${meter(p.h)}`} gross />

          {/* Pumpenzylinder mit Kolben, Ventilen und Griff */}
          <rect x={ROHR_X - ZYL_B / 2 - 6} y={ZYL_OBEN - 6} width={ZYL_B + 12} height={zylHoehe + 12} rx={6} fill="url(#kit-metallQuer)" stroke={FARBE.gehaeuse} strokeWidth={2} />
          <rect x={ROHR_X - ZYL_B / 2} y={ZYL_OBEN} width={ZYL_B} height={zylHoehe} fill="#eef6fb" />
          {luftPunkte(ROHR_X - ZYL_B / 2, kolbenY + 6, ZYL_B, zylUnten - kolbenY - 6, p.druckZyl, "z")}
          <rect x={ROHR_X - ZYL_B / 2} y={kolbenY - 6} width={ZYL_B} height={12} rx={2} fill="#56616d" />
          <line x1={ROHR_X} y1={kolbenY - 6} x2={ROHR_X} y2={griffY} stroke="#3f4a55" strokeWidth={7} />
          <g onPointerDown={ev => { greift.current = true; setAuto(0); try { (ev.target as Element).setPointerCapture(ev.pointerId); } catch { /* Zeiger schon weg */ } }} style={{ cursor: "ns-resize" }}>
            <rect x={ROHR_X - 60} y={griffY - 30} width={120} height={60} fill="transparent" />
            <rect x={ROHR_X - 46} y={griffY - 9} width={92} height={18} rx={9} fill="#e0a000" stroke="#7a5f10" strokeWidth={2} />
          </g>
          <text x={ROHR_X + 56} y={griffY + 5} fontSize={13} fontWeight={700} fill="#2f3740">↕ ziehen</text>
          {/* Saugventil (Klappe am Zylinderboden): offen, wenn innen weniger Druck ist */}
          <line x1={ROHR_X - ROHR_B / 2} y1={zylUnten} x2={ROHR_X + ROHR_B / 2} y2={zylUnten - (p.druckZyl < p.druckRohr * 0.999 ? 10 : 0)} stroke={FARBE.rot} strokeWidth={4} strokeLinecap="round" />

          {/* Manometer: absoluter Druck der Luft im Rohr */}
          <line x1={ROHR_X + ROHR_B / 2} y1={ROHR_OBEN + 30} x2={ROHR_X + 70} y2={ROHR_OBEN + 30} stroke={FARBE.gehaeuse} strokeWidth={5} />
          <Manometer x={ROHR_X + 98} y={ROHR_OBEN + 30} r={26} wert={p.druckRohr / 1e5} max={1.2} einheit="bar abs." />
          <Pille x={ROHR_X + 98} y={ROHR_OBEN - 12} t={`innen ${bar(p.druckRohr, 3)}`} />
          <Pille x={150} y={40} t={`Hübe: ${p.huebe}`} />
        </svg>
      }
      seite={<>
        <Karte>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={auto > 0} onClick={() => { phase.current = 0; setAuto(1); }}>⬆⬇ Ein Hub</button>
            <button className="btn btn-secondary" disabled={auto > 0} onClick={() => { phase.current = 0; setAuto(10); }}>⏩ 10 Hübe</button>
            <button className="btn btn-secondary" onClick={() => { p.belueften(); setAuto(0); }}>💨 Belüften</button>
          </div>
          <label className="flex flex-col gap-1">
            Flüssigkeit
            <select className="input" value={fid} onChange={e => neu(e.target.value, ort)}>
              {FLUESSIGKEITEN.filter(f => ["suess", "hg", "oel"].includes(f.id)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Ort
            <select className="input" value={ort} onChange={e => neu(fid, Number(e.target.value))}>
              {ORTE.map((o, i) => <option key={o.name} value={i}>{o.name} ({zahl(o.hoehe, 0)} m)</option>)}
            </select>
          </label>
        </Karte>
        <Karte titel="p innen + ρ·g·h = p außen">
          <Werte zeilen={[
            ["Luftdruck außen", bar(p.luft, 3)],
            ["Luft im Rohr", bar(p.druckRohr, 3)],
            ["ρ·g·h", bar(fl.dichte * G * p.h, 3)],
            ["Säule h", meter(p.h)],
            ["höchstens", meter(p.grenze)],
            ["Hübe", String(p.huebe)],
          ]} />
        </Karte>
      </>}
      unten={<Analogie>
        Eine Pumpe, die oben saugt, »zieht« nicht am Wasser — sie nimmt nur Luft weg. Geschoben wird von unten, vom
        Luftdruck. Der ist wie eine feste Spannung, die von außen anliegt: Mehr als sie kann keine Saugpumpe nutzen. Pumpen,
        die von unten drücken, schaffen dagegen beliebig viel.
      </Analogie>}
    />
  );
}

// ── Saugheber ──

const H_FL = 0.05;     // m² je Eimer
function heber(mauer: number, pegel: [number, number]) {
  return new Stroemung({
    medium: "wasser",
    knoten: [{ id: "o", z: 1 }, { id: "top", z: mauer }, { id: "u", z: 0 }],
    teile: [
      { id: "oben", art: "behaelter", a: "o", flaeche: H_FL, hoehe: 1, fuellung: pegel[0] },
      { id: "unten", art: "behaelter", a: "u", flaeche: H_FL, hoehe: 1, fuellung: pegel[1] },
      { id: "h1", art: "drossel", a: "o", b: "top", widerstand: 4e6 },
      { id: "h2", art: "drossel", a: "top", b: "u", widerstand: 4e6 },
    ],
  });
}

function Saugheber() {
  const [mauer, setMauer] = useState(2);
  const [abriss, setAbriss] = useState(false);
  const sim = useRef(heber(2, [0.8, 0.1]));
  const neu = (m: number, p: [number, number]) => { sim.current = heber(m, p); setAbriss(false); };
  useTakt(dt => {
    if (abriss) return;
    sim.current.schritt(dt);
    // Sinkt der Druck oben im Bogen bis zum Dampfdruck, reißt die Wassersäule ab.
    if (sim.current.druck("top") + P_LUFT < 2340) {
      sim.current.setze("h1", "widerstand", Infinity);
      sim.current.setze("h2", "widerstand", Infinity);
      setAbriss(true);
    }
  });
  const po = sim.current.zustand("oben"), pu = sim.current.zustand("unten");
  const q = abriss ? 0 : sim.current.fluss("h1");
  const pTop = abriss ? 2340 - P_LUFT : sim.current.druck("top");
  const merke = useFliessen(() => new Map([["schlauch", q * 1000 * 60]]));

  // Maßstab folgt der Mauer, damit niedrige Mauern nicht winzig werden
  const px = Math.min(120, 400 / (mauer + 0.6)), boden = 480, y = (z: number) => boden - z * px;
  const eimerH = px;      // 1 m hoch
  const versuche = [
    { name: "Läuft", idee: "Einmal gefüllt, läuft der Schlauch von selbst — sogar über die Mauer, solange der Auslauf tiefer liegt als der Wasserspiegel oben.", los: () => { neu(2, [0.8, 0.1]); setMauer(2); } },
    { name: "Bis die Spiegel gleich sind", idee: "Der Antrieb ist der Höhenunterschied der beiden Spiegel. Je kleiner er wird, desto langsamer fließt es — bei gleicher Höhe steht es.", los: () => { neu(1.5, [0.5, 0.45]); setMauer(1.5); } },
    { name: "Mauer zu hoch", idee: "Oben im Bogen herrscht Unterdruck. Ist die Mauer höher als etwa 10 m über dem Spiegel, reicht der Luftdruck nicht mehr: Die Säule reißt ab.", los: () => { neu(12, [0.8, 0.1]); setMauer(12); } },
  ];
  const schlauch = `M230 ${y(1) + eimerH * 0.15} V${y(mauer + 0.2)} H770 V${y(0) - eimerH * 0.15}`;

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 520" className="w-full h-auto select-none" role="img" aria-label="Saugheber über einer Mauer">
          <KitDefs />
          <defs>
            <pattern id="ziegel" width="40" height="20" patternUnits="userSpaceOnUse">
              <rect width="40" height="20" fill="#b5563c" /><path d="M0 0 H40 M0 10 H40 M20 0 V10 M0 10 V20 M40 10 V20" stroke="#e8d8c8" strokeWidth={1.5} />
            </pattern>
          </defs>
          <Kulisse breite={1000} hoehe={520} boden={boden} />
          {/* Mauer */}
          <rect x={465} y={y(mauer - 0.3)} width={70} height={boden - y(mauer - 0.3)} fill="url(#ziegel)" stroke="#6e2b1d" strokeWidth={2} />
          {/* Sockel für den oberen Eimer */}
          <rect x={140} y={y(1)} width={180} height={boden - y(1)} fill="url(#kit-metall)" stroke={FARBE.gehaeuse} strokeWidth={2} />
          <GlasTank x={170} y={y(2)} breite={120} hoehe={eimerH} fuell={po} />
          <GlasTank x={710} y={y(1)} breite={120} hoehe={eimerH} fuell={pu} />
          {/* Schlauch */}
          <Rohr d={schlauch} w={12} fluessig={abriss ? "#e9eef2" : FARBE.wasser} leer={abriss} merke={merke("schlauch")} />
          <line x1={500} y1={y(mauer + 0.2)} x2={500} y2={y(mauer + 0.2) - 30} stroke={FARBE.gehaeuse} strokeWidth={4} />
          <Manometer x={500} y={y(mauer + 0.2) - 58} r={24} wert={(pTop + P_LUFT) / 1e5} max={1.2} einheit="bar abs." />
          <Pille x={640} y={y(mauer + 0.2) - 64} t={abriss ? "abgerissen: Dampf im Bogen" : `Bogen: ${bar(pTop)}`} farbe={pTop < 0 ? "#d64541" : "#e0a000"} />
          <Pille x={230} y={y(2) - 16} t={`${zahl(po * 100, 0)} cm`} />
          <Pille x={770} y={y(1) - 16} t={`${zahl(pu * 100, 0)} cm`} />
          <Pille x={880} y={y(0.5)} t={q > 1e-6 ? `${zahl(q * 1000)} L/s` : "steht"} />
        </svg>
      }
      seite={<>
        <Karte>
          <label className="flex flex-col gap-1">
            <span>Mauer: {zahl(mauer, 1)} m hoch</span>
            <input type="range" min={1.3} max={12} step={0.1} value={mauer} onChange={e => { const m = Number(e.target.value); setMauer(m); neu(m, [po, pu]); }} />
          </label>
          <button className="btn btn-primary" onClick={() => neu(mauer, [0.8, 0.1])}>💧 Neu füllen</button>
        </Karte>
        <Karte titel="Messwerte">
          <Werte zeilen={[
            ["Spiegel oben / unten", `${zahl(1 + po)} m / ${zahl(pu)} m`],
            ["Höhenunterschied", `${zahl(1 + po - pu)} m`],
            ["Druck oben im Bogen", abriss ? "Dampfdruck" : bar(pTop)],
            ["Durchfluss", `${zahl(q * 1000)} L/s`],
          ]} />
          <p className="text-muted">Unterdruck im Bogen ≈ ρ·g·(Bogen − Spiegel oben) = {bar(1000 * G * Math.max(0, mauer - 1 - po))} unter Luftdruck (ohne Reibung).</p>
        </Karte>
      </>}
      unten={<Analogie>
        Antrieb ist allein der Höhenunterschied der Spiegel — wie die Spannung zwischen zwei Polen. Der Bogen über die Mauer
        ist ein Umweg, der nichts kostet, solange der Druck dort nicht unter den Dampfdruck fällt.
      </Analogie>}
    />
  );
}
