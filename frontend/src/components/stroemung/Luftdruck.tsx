"use client";
/**
 * Station »Luftdruck«.
 *  Saugrohr:   Oben wird der Druck gesenkt, die Luft drückt die Flüssigkeit hoch —
 *              höchstens bis Luftdruck = ρ·g·h (Wasser ≈ 10 m, Quecksilber 76 cm).
 *  Saugheber:  Schlauch über eine Mauer; läuft, solange der Auslauf tiefer liegt
 *              und oben im Bogen kein Dampf entsteht (Löser, live).
 */
import { useRef, useState } from "react";
import { FLUESSIGKEITEN, luftdruckInHoehe, maxSaughoehe, saughoehe } from "@/lib/stroemung/druck";
import { Stroemung } from "@/lib/stroemung/loeser";
import { G, P_LUFT } from "@/lib/stroemung/modell";
import { Analogie, Karte, Pille, Regler, StationRahmen, Wahl, Werte, bar, muted, text, useTakt, zahl } from "./rahmen";

export default function Luftdruck() {
  const [teil, setTeil] = useState<"saug" | "heber">("saug");
  return (
    <div className="flex flex-col gap-3">
      <Wahl werte={[{ id: "saug", label: "🥤 Saugrohr" }, { id: "heber", label: "🪣 Saugheber" }]} wert={teil} setze={setTeil} />
      {teil === "saug" ? <Saugrohr /> : <Saugheber />}
    </div>
  );
}

const ORTE = [
  { name: "Meer", hoehe: 0 }, { name: "Brocken", hoehe: 1141 }, { name: "Zugspitze", hoehe: 2962 },
  { name: "Mont Blanc", hoehe: 4806 }, { name: "Mount Everest", hoehe: 8849 },
];

function Saugrohr() {
  const [fid, setFid] = useState("suess");
  const [sog, setSog] = useState(0.3);      // Anteil der möglichen Absenkung
  const [ort, setOrt] = useState(0);
  const fl = FLUESSIGKEITEN.find(f => f.id === fid)!;
  const luft = luftdruckInHoehe(ORTE[ort].hoehe);
  const pOben = luft - sog * (luft - fl.dampfdruck);
  const hMax = maxSaughoehe(fl, luft);
  const rohr = maxSaughoehe(fl) * 1.2;        // Rohrlänge: etwas mehr als auf Meereshöhe möglich
  const h = Math.min(rohr, saughoehe(luft - pOben, fl.dichte));
  const vakuum = sog >= 0.999;

  const boden = 470, top = 50, px = (boden - 60 - top) / rohr;
  const rx = 500, rb = 34;
  const farbe = fid === "hg" ? "#b8c0c8" : "hsl(205 80% 55%)";
  const versuche = [
    { name: "Strohhalm", idee: "Du saugst nicht das Getränk hoch — du senkst den Druck im Halm, und die Luft draußen drückt es hinauf.", los: () => { setFid("suess"); setSog(0.03); setOrt(0); } },
    { name: "10-Meter-Grenze", idee: "Selbst mit der besten Pumpe kommt Wasser nicht höher als gut 10 m: Mehr als den ganzen Luftdruck gibt es nicht. Darüber bleibt nur Wasserdampf.", los: () => { setFid("suess"); setSog(1); setOrt(0); } },
    { name: "Torricelli 1643", idee: "Mit Quecksilber steht die Säule bei 76 cm — so wurde der Luftdruck zum ersten Mal gemessen (760 mm Hg).", los: () => { setFid("hg"); setSog(1); setOrt(0); } },
    { name: "Auf dem Berg", idee: "Oben drückt weniger Luft: Auf der Zugspitze schafft die beste Pumpe nur noch gut 7 m.", los: () => { setFid("suess"); setSog(1); setOrt(2); } },
  ];

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 520" className="w-full h-auto select-none" role="img" aria-label="Saugrohr im Becken">
          {/* Becken */}
          <rect x={250} y={boden - 50} width={500} height={50} fill={farbe} />
          <path d={`M250 ${boden - 80} V${boden} H750 V${boden - 80}`} fill="none" stroke="#56616d" strokeWidth={4} />
          {/* Rohr mit Säule */}
          <rect x={rx - rb / 2} y={boden - 50 - h * px} width={rb} height={h * px + 30} fill={farbe} />
          {vakuum && <rect x={rx - rb / 2} y={top + 30} width={rb} height={boden - 50 - h * px - top - 30} fill="url(#dampf)" />}
          <path d={`M${rx - rb / 2} ${boden - 20} V${top + 30} H${rx + rb / 2} V${boden - 20}`} fill="none" stroke="#56616d" strokeWidth={4} />
          <line x1={rx} y1={top + 30} x2={rx} y2={top} stroke="#56616d" strokeWidth={6} />
          <rect x={rx - 40} y={top - 26} width={80} height={26} rx={6} fill="#8a949e" stroke="#4a545e" strokeWidth={2} />
          <text x={rx} y={top - 8} textAnchor="middle" fontSize={13} fill="#fff">Pumpe</text>
          {/* Skala */}
          {Array.from({ length: Math.floor(rohr / (fid === "hg" ? 0.1 : 1)) + 1 }, (_, i) => i * (fid === "hg" ? 0.1 : 1)).map(m => (
            <g key={m}>
              <line x1={rx + rb / 2 + 4} y1={boden - 50 - m * px} x2={rx + rb / 2 + 14} y2={boden - 50 - m * px} stroke="#8a949e" strokeWidth={2} />
              <text x={rx + rb / 2 + 18} y={boden - 46 - m * px} fontSize={12} style={muted}>{fid === "hg" ? `${zahl(m * 100, 0)} cm` : `${m} m`}</text>
            </g>
          ))}
          <line x1={380} y1={boden - 50 - hMax * px} x2={620} y2={boden - 50 - hMax * px} stroke="#d64541" strokeWidth={2} strokeDasharray="6 5" />
          <text x={380} y={boden - 50 - hMax * px + 18} fontSize={13} fill="#d64541">Grenze hier: {fid === "hg" ? `${zahl(hMax * 100, 1)} cm` : `${zahl(hMax)} m`}</text>
          {/* Luftdruck-Pfeile aufs Becken */}
          {[300, 380, 620, 700].map(x => <line key={x} x1={x} y1={boden - 130} x2={x} y2={boden - 60} stroke="#e0a000" strokeWidth={4} markerEnd="url(#luftPfeil)" />)}
          <Pille x={870} y={boden - 95} t={`Luft: ${bar(luft, 3)}`} />
          <Pille x={rx + 125} y={boden - 50 - h * px - 10} t={`oben: ${bar(pOben, 3)}`} />
          <Pille x={rx - 110} y={boden - 50 - (h * px) / 2} t={`h = ${fid === "hg" ? `${zahl(h * 100, 1)} cm` : `${zahl(h)} m`}`} gross />
          {vakuum && <text x={rx - rb / 2 - 8} y={top + 48} textAnchor="end" fontSize={13} style={text}>nur Dampf</text>}
          <defs>
            <marker id="luftPfeil" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#e0a000" /></marker>
            <pattern id="dampf" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.2" fill="#9aa5b1" /></pattern>
          </defs>
        </svg>
      }
      seite={<>
        <Karte>
          <Regler label={`Pumpe senkt den Druck oben: ${zahl(sog * 100, 0)} %`} min={0} max={1} step={0.01} wert={sog} setze={setSog} />
          <label className="flex flex-col gap-1">
            Flüssigkeit
            <select className="input" value={fid} onChange={e => setFid(e.target.value)}>
              {FLUESSIGKEITEN.filter(f => f.id === "suess" || f.id === "hg" || f.id === "oel").map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Ort
            <select className="input" value={ort} onChange={e => setOrt(Number(e.target.value))}>
              {ORTE.map((o, i) => <option key={o.name} value={i}>{o.name} ({zahl(o.hoehe, 0)} m)</option>)}
            </select>
          </label>
        </Karte>
        <Karte titel="Luftdruck = ρ · g · h">
          <Werte zeilen={[
            ["Luftdruck außen", bar(luft, 3)],
            ["Druck oben im Rohr", bar(pOben, 3)],
            ["Unterschied", bar(luft - pOben, 3)],
            ["Säule h = Δp / (ρ·g)", fid === "hg" ? `${zahl(h * 1000, 0)} mm` : `${zahl(h)} m`],
            ["höchstens möglich", fid === "hg" ? `${zahl(hMax * 1000, 0)} mm` : `${zahl(hMax)} m`],
          ]} />
        </Karte>
      </>}
      unten={<Analogie>
        Der Luftdruck ist wie eine feste Spannung, die von außen anliegt: Mehr als sie kann keine Pumpe »heraussaugen«.
        Eine Pumpe, die von oben saugt, nutzt nur diesen Unterschied — Pumpen, die drücken, schaffen beliebig viel.
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

  // Maßstab folgt der Mauer, damit niedrige Mauern nicht winzig werden
  const px = Math.min(120, 400 / (mauer + 0.6)), boden = 480, y = (z: number) => boden - z * px;
  const versuche = [
    { name: "Läuft", idee: "Einmal gefüllt, läuft der Schlauch von selbst — sogar über die Mauer, solange der Auslauf tiefer liegt als der Wasserspiegel oben.", los: () => { neu(2, [0.8, 0.1]); setMauer(2); } },
    { name: "Bis die Spiegel gleich sind", idee: "Der Antrieb ist der Höhenunterschied der beiden Spiegel. Je kleiner er wird, desto langsamer fließt es — bei gleicher Höhe steht es.", los: () => { neu(1.5, [0.5, 0.45]); setMauer(1.5); } },
    { name: "Mauer zu hoch", idee: "Oben im Bogen herrscht Unterdruck. Ist die Mauer höher als etwa 10 m über dem Spiegel, reicht der Luftdruck nicht mehr: Die Säule reißt ab.", los: () => { neu(12, [0.8, 0.1]); setMauer(12); } },
  ];

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 520" className="w-full h-auto select-none" role="img" aria-label="Saugheber über einer Mauer">
          <line x1={0} y1={boden} x2={1000} y2={boden} stroke="#8d7b62" strokeWidth={3} />
          {/* Mauer */}
          <rect x={470} y={y(mauer - 0.3)} width={60} height={boden - y(mauer - 0.3)} fill="#a0703c" stroke="#5c3a1a" strokeWidth={2} />
          {/* Eimer oben auf einem Sockel, Eimer unten am Boden */}
          <rect x={150} y={y(1)} width={140} height={boden - y(1)} fill="#8a949e" />
          {[{ x: 160, z: 1, p: po }, { x: 700, z: 0, p: pu }].map((e, i) => (
            <g key={i}>
              <rect x={e.x} y={y(e.z + e.p)} width={120} height={e.p * px} fill="hsl(205 80% 55%)" />
              <path d={`M${e.x} ${y(e.z + 1)} V${y(e.z)} H${e.x + 120} V${y(e.z + 1)}`} fill="none" stroke="#56616d" strokeWidth={4} />
            </g>
          ))}
          {/* Schlauch */}
          <path d={`M230 ${y(1.05)} V${y(mauer + 0.2)} H770 V${y(0.05)}`} fill="none" stroke="#2f3740" strokeWidth={14} strokeLinejoin="round" />
          <path d={`M230 ${y(1.05)} V${y(mauer + 0.2)} H770 V${y(0.05)}`} fill="none" stroke={abriss ? "#9aa5b1" : "hsl(205 80% 55%)"} strokeWidth={8} strokeLinejoin="round" strokeDasharray={q > 0 ? "10 6" : undefined} />
          <Pille x={500} y={y(mauer + 0.2) - 22} t={abriss ? "abgerissen: Dampf im Bogen" : `oben im Bogen: ${bar(pTop)}`} farbe={pTop < 0 ? "#d64541" : "#e0a000"} />
          <Pille x={220} y={y(1 + po) - 18} t={`${zahl(po * 100, 0)} cm`} />
          <Pille x={760} y={y(pu) - 18} t={`${zahl(pu * 100, 0)} cm`} />
          <text x={820} y={y(0.6)} fontSize={13} style={text}>{q > 1e-6 ? `${zahl(q * 1000)} L/s` : "steht"}</text>
        </svg>
      }
      seite={<>
        <Karte>
          <Regler label={`Mauer: ${zahl(mauer, 1)} m hoch`} min={1.3} max={12} step={0.1} wert={mauer} setze={m => { setMauer(m); neu(m, [po, pu]); }} />
          <button className="btn btn-primary" onClick={() => neu(mauer, [0.8, 0.1])}>💧 Neu füllen</button>
        </Karte>
        <Karte titel="Messwerte">
          <Werte zeilen={[
            ["Spiegel oben / unten", `${zahl(1 + po)} m / ${zahl(pu)} m`],
            ["Höhenunterschied", `${zahl(1 + po - pu)} m`],
            ["Druck oben im Bogen", abriss ? "Dampfdruck" : bar(pTop)],
            ["Durchfluss", `${zahl(q * 1000)} L/s`],
          ]} />
          <p className="text-muted">Unterdruck im Bogen = Spiegel oben bis Bogen: ρ·g·Δh = {bar(1000 * G * Math.max(0, mauer - 1 - po))} unter Luftdruck (ohne Reibung).</p>
        </Karte>
      </>}
      unten={<Analogie>
        Antrieb ist allein der Höhenunterschied der Spiegel — wie die Spannung zwischen zwei Polen. Der Bogen über die Mauer
        ist ein Umweg, der nichts kostet, solange der Druck dort nicht unter den Dampfdruck fällt.
      </Analogie>}
    />
  );
}
