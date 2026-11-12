"use client";
/**
 * Station »Wasserturm & Röhren«.
 *  Röhren:     drei verbundene Glasgefäße verschiedener Breite gleichen ihre
 *              Spiegel aus (Löser, live). Gießen per Klick aufs Gefäß, Handräder öffnen.
 *  Wasserturm: Turm versorgt ein Haus; je Stockwerk weniger Druck, offene Hähne
 *              (im Bild anklicken) ziehen den Druck herunter. Darüber auf Wunsch
 *              der Stromkreis (Turm = Quelle, Hähne = Lampen parallel).
 */
import { useMemo, useRef, useState } from "react";
import { Stroemung } from "@/lib/stroemung/loeser";
import { G, type Knoten, type Teil } from "@/lib/stroemung/modell";
import type { Zufluss } from "../fluessigkeit/Fluessigkeit";
import { FARBE, GlasTank, Hahn, Handrad, KitDefs, Kulisse, Muffe, Rohr, useFliessen } from "./kit";
import { Analogie, Karte, Pille, Regler, StationRahmen, Wahl, Werte, bar, useTakt, zahl } from "./rahmen";

export default function Wasserturm() {
  const [teil, setTeil] = useState<"roehren" | "turm">("roehren");
  return (
    <div className="flex flex-col gap-3">
      <Wahl werte={[{ id: "roehren", label: "🧪 Verbundene Röhren" }, { id: "turm", label: "🗼 Wasserturm" }]} wert={teil} setze={setTeil} />
      {teil === "roehren" ? <Roehren /> : <Turm />}
    </div>
  );
}

// ── Verbundene Röhren ──

const GEF = [
  { id: "A", x: 220, breite: 60 },
  { id: "B", x: 500, breite: 180 },
  { id: "C", x: 780, breite: 30 },
];
const R_BODEN = 360, R_SKALA = 250, R_HOEHE = 1.2;
const flaeche = (breite: number) => breite * 1e-4;   // m², nur das Verhältnis zählt

function roehrenNetz(pegel: number[], offen: boolean) {
  const knoten: Knoten[] = GEF.map(g => ({ id: g.id, z: 0 }));
  const teile: Teil[] = [
    ...GEF.map((g, i) => ({ id: `t${g.id}`, art: "behaelter" as const, a: g.id, flaeche: flaeche(g.breite), hoehe: R_HOEHE, fuellung: pegel[i] })),
    { id: "AB", art: "drossel", a: "A", b: "B", widerstand: offen ? 3e6 : Infinity },
    { id: "BC", art: "drossel", a: "B", b: "C", widerstand: offen ? 3e6 : Infinity },
  ];
  return new Stroemung({ medium: "wasser", knoten, teile });
}

function Roehren() {
  const [offen, setOffen] = useState(false);
  const [zufluss, setZufluss] = useState<(Zufluss | null)[]>([null, null, null]);
  const sim = useRef(roehrenNetz([0.9, 0.2, 0.5], false));
  const neu = (p: number[], o: boolean) => { sim.current = roehrenNetz(p, o); setOffen(o); };
  useTakt(dt => sim.current.schritt(dt));
  const p = GEF.map(g => sim.current.zustand(`t${g.id}`));
  const q = { AB: sim.current.fluss("AB"), BC: sim.current.fluss("BC") };
  const merke = useFliessen(() => new Map([["AB", q.AB * 60000 * 6], ["BC", q.BC * 60000 * 6]]));
  const giessen = (i: number) => {
    neu(p.map((x, k) => (k === i ? Math.min(R_HOEHE, x + 0.001 / flaeche(GEF[i].breite)) : x)), offen);
    setZufluss(z => z.map((v, k) => (k === i ? { id: Date.now(), groesse: 0.5, teilchen: 14 } : v)));
  };

  const versuche = [
    { name: "Hahn auf", idee: "Dreh an einem roten Handrad: Das Wasser fließt, bis überall derselbe Spiegel steht — egal wie breit oder schmal ein Gefäß ist.", los: () => neu([0.9, 0.2, 0.5], false) },
    { name: "Ins dünne Rohr gießen", idee: "Klick aufs dünne Gefäß: Ein Liter hebt dort den Spiegel viel stärker. Am Ende verteilt er sich auf alle — der Spiegel steigt überall gleich.", los: () => neu([0.4, 0.4, 0.4], true) },
  ];
  const leitung = `M${GEF[0].x} ${R_BODEN} V${R_BODEN + 34} H${GEF[2].x} V${R_BODEN}`;

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 440" className="w-full h-auto select-none" role="img" aria-label="Drei verbundene Gefäße">
          <KitDefs />
          <defs>
            <pattern id="kacheln" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="#eef1f3" /><path d="M0 0 H48 M0 0 V48" stroke="#d6dce1" strokeWidth={2} /></pattern>
            <linearGradient id="tisch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b98a5a" /><stop offset="1" stopColor="#8a5f37" /></linearGradient>
          </defs>
          <rect width={1000} height={400} fill="url(#kacheln)" />
          <rect y={400} width={1000} height={40} fill="url(#tisch)" />
          <Rohr d={leitung} w={14} />
          {/* Bläschen je Hälfte: A↔B und B↔C fließen verschieden schnell */}
          <path ref={merke("AB")} d={`M${GEF[0].x} ${R_BODEN} V${R_BODEN + 34} H${GEF[1].x}`} fill="none" stroke="#fff" strokeOpacity={0} strokeWidth={5} strokeDasharray="0 18" strokeLinecap="round" />
          <path ref={merke("BC")} d={`M${GEF[1].x} ${R_BODEN + 34} H${GEF[2].x} V${R_BODEN}`} fill="none" stroke="#fff" strokeOpacity={0} strokeWidth={5} strokeDasharray="0 18" strokeLinecap="round" />
          {GEF.map(g => <Muffe key={g.id} x={g.x} y={R_BODEN + 34} w={14} />)}
          {[360, 640].map(x => (
            <Handrad key={x} x={x} y={R_BODEN + 8} offen={offen ? 1 : 0} onClick={() => neu(p, !offen)} titel={offen ? "Hahn schließen" : "Hahn öffnen"} />
          ))}
          {GEF.map((g, i) => (
            <g key={g.id} onClick={() => giessen(i)} style={{ cursor: "pointer" }}>
              <title>{`1 Liter in ${g.id} gießen`}</title>
              <GlasTank x={g.x - g.breite / 2} y={R_BODEN - R_HOEHE * R_SKALA} breite={g.breite} hoehe={R_HOEHE * R_SKALA} fuell={p[i] / R_HOEHE} zufluss={zufluss[i]} />
              <text x={g.x} y={R_BODEN - R_HOEHE * R_SKALA - 34} textAnchor="middle" fontSize={16} fontWeight={800} fill="#2f3740">{g.id}</text>
              <Pille x={g.x} y={R_BODEN - p[i] * R_SKALA - 14} t={`${zahl(p[i] * 100, 0)} cm`} />
              <Pille x={g.x} y={R_BODEN - 16} t={bar(1000 * G * p[i], 3)} farbe="#3b9fe0" />
            </g>
          ))}
          <text x={500} y={30} textAnchor="middle" fontSize={14} fill="#56616d">Gefäß anklicken = 1 Liter hineingießen · Handrad = Verbindung auf/zu</text>
        </svg>
      }
      seite={<>
        <Karte>
          <button className="btn btn-primary" onClick={() => neu(p, !offen)}>{offen ? "🔒 Verbindung schließen" : "🔓 Verbindung öffnen"}</button>
          <div className="flex flex-wrap gap-2">
            {GEF.map((g, i) => <button key={g.id} className="btn btn-secondary" onClick={() => giessen(i)}>💧 in {g.id} gießen</button>)}
          </div>
        </Karte>
        <Karte titel="Druck am Boden p = ρ·g·h">
          <Werte zeilen={GEF.map((g, i) => [`Gefäß ${g.id}`, bar(1000 * G * p[i], 3)])} />
        </Karte>
      </>}
      unten={<Analogie>Verbundene Gefäße sind wie Kondensatoren, die über Widerstände verbunden sind: Strom fließt, bis überall dieselbe Spannung herrscht. Ein breites Gefäß ist ein großer Kondensator — es braucht viel Wasser, bis sein Spiegel steigt.</Analogie>}
    />
  );
}

// ── Wasserturm ──

const T_BODEN = 500, T_SKALA = 11;   // px je m
const STOCK = 3.5;                    // m je Stockwerk
const R_HAHN = 1.5e9;                 // ≈ 0,2 L/s bei 3 bar
const yAus = (z: number) => T_BODEN - z * T_SKALA;

function Turm() {
  const [turmHoehe, setTurmHoehe] = useState(25);
  const [stockwerke, setStockwerke] = useState(5);
  const [offen, setOffen] = useState<boolean[]>(Array(9).fill(false));
  const [mix, setMix] = useState(0);
  const FUELL = 5;  // m Wasser im Turm
  const spiegel = turmHoehe + FUELL;

  const stand = useMemo(() => {
    const knoten: Knoten[] = [{ id: "turm", z: turmHoehe }, { id: "strasse", z: 0 }];
    const teile: Teil[] = [
      { id: "quelle", art: "druckquelle", a: "turm", druck: 1000 * G * FUELL },
      { id: "fall", art: "rohr", a: "turm", b: "strasse", laenge: 300, durchmesser: 0.032, turbulent: true },
    ];
    let vorher = "strasse";
    for (let s = 0; s < stockwerke; s++) {
      knoten.push({ id: `s${s}`, z: 1 + s * STOCK });
      teile.push({ id: `steig${s}`, art: "rohr", a: vorher, b: `s${s}`, laenge: s ? STOCK : 6, durchmesser: 0.02, turbulent: true });
      teile.push({ id: `hahn${s}`, art: "auslass", a: `s${s}`, widerstand: offen[s] ? R_HAHN : Infinity });
      vorher = `s${s}`;
    }
    const sim = new Stroemung({ medium: "wasser", knoten, teile });
    sim.schritt(0.01);
    return {
      druck: Array.from({ length: stockwerke }, (_, s) => sim.druck(`s${s}`)),
      fluss: Array.from({ length: stockwerke }, (_, s) => sim.fluss(`hahn${s}`)),
      steig: Array.from({ length: stockwerke }, (_, s) => sim.fluss(`steig${s}`)),
      strasse: sim.druck("strasse"),
      gesamt: sim.fluss("fall"),
    };
  }, [turmHoehe, stockwerke, offen]);

  const umschalten = (s: number) => setOffen(o => o.map((x, i) => (i === s ? !x : x)));
  const versuche = [
    { name: "Oben weniger Druck", idee: "Jedes Stockwerk liegt 3,5 m höher — und hat rund 0,35 bar weniger Druck. Es zählt nur, wie tief der Hahn unter dem Wasserspiegel im Turm liegt. Klick auf die Hähne!", los: () => { setTurmHoehe(25); setStockwerke(5); setOffen(Array(9).fill(false)); } },
    { name: "Alle duschen", idee: "Drehen alle gleichzeitig auf, fließt viel Wasser durch die Leitungen — die Reibung frisst Druck, und oben kommt deutlich weniger an.", los: () => { setStockwerke(5); setOffen(Array(9).fill(true)); } },
    { name: "Hochhaus", idee: "Liegt ein Hahn höher als der Wasserspiegel im Turm, kommt dort nichts an. Hochhäuser brauchen deshalb eigene Druckerhöhungspumpen.", los: () => { setTurmHoehe(15); setStockwerke(9); setOffen(Array(9).fill(true)); } },
  ];

  const hausX = 600, hausB = 340, steigX = 640;
  const wd = 1 - 0.8 * mix;
  const potFarbe = (pGes: number) => `hsl(${Math.round(120 * Math.max(0, Math.min(1, pGes / (spiegel * 1000 * G))))} 75% 45%)`;
  const yOben = yAus(1 + (stockwerke - 1) * STOCK);
  const leitung = `M140 ${yAus(turmHoehe)} V${T_BODEN + 30} H${steigX}`;
  const merke = useFliessen(() => new Map([
    ["fall", stand.gesamt * 60000 * 4],
    ...stand.steig.map((q, s) => [`s${s}`, q * 60000 * 4] as [string, number]),
    ...stand.fluss.map((q, s) => [`h${s}`, q * 60000 * 4] as [string, number]),
  ]));

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 560" className="w-full h-auto select-none" role="img" aria-label="Wasserturm und Haus">
          <KitDefs />
          <Kulisse breite={1000} hoehe={560} boden={T_BODEN} />
          {/* Spiegel im Turm als Linie quer übers Bild */}
          <line x1={0} y1={yAus(spiegel)} x2={1000} y2={yAus(spiegel)} stroke={FARBE.wasser} strokeWidth={1.5} strokeDasharray="8 6" />
          <text x={995} y={yAus(spiegel) - 6} textAnchor="end" fontSize={13} fill="#1d3d63">Wasserspiegel im Turm: {zahl(spiegel, 1)} m</text>
          <g style={{ opacity: wd }}>
            {/* Turm: Betonschaft mit Behälter */}
            <path d={`M110 ${T_BODEN} L118 ${yAus(turmHoehe)} H162 L170 ${T_BODEN} Z`} fill="#c9c3b8" stroke="#8d867a" strokeWidth={2} />
            {Array.from({ length: Math.floor(turmHoehe / 5) }, (_, i) => <rect key={i} x={133} y={yAus(5 + i * 5) - 8} width={14} height={10} rx={2} fill="#6d7b88" />)}
            <path d={`M70 ${yAus(turmHoehe) + 4} H210 L195 ${yAus(spiegel) - 8} H85 Z`} fill="url(#kit-metallQuer)" stroke={FARBE.gehaeuse} strokeWidth={2} />
            <rect x={92} y={yAus(spiegel)} width={96} height={FUELL * T_SKALA} fill={FARBE.wasser} opacity={0.85} />
            <path d={`M80 ${yAus(spiegel) - 8} L140 ${yAus(spiegel) - 30} L200 ${yAus(spiegel) - 8} Z`} fill="#8a5240" />
            {/* Leitung Turm → Haus (unter der Erde) */}
            <Rohr d={leitung} w={12} merke={merke("fall")} />
            {/* Haus */}
            <rect x={hausX} y={yAus(stockwerke * STOCK + 1)} width={hausB} height={T_BODEN - yAus(stockwerke * STOCK + 1)} fill="#f3eadb" stroke="#a89a85" strokeWidth={3} />
            <path d={`M${hausX - 18} ${yAus(stockwerke * STOCK + 1)} L${hausX + hausB / 2} ${yAus(stockwerke * STOCK + 5.5)} L${hausX + hausB + 18} ${yAus(stockwerke * STOCK + 1)} Z`} fill="#b5523b" stroke="#7a3022" strokeWidth={2} />
            {Array.from({ length: stockwerke }, (_, s) => (
              <g key={s}>
                <line x1={hausX} y1={yAus(1 + s * STOCK) + 16} x2={hausX + hausB} y2={yAus(1 + s * STOCK) + 16} stroke="#d8ccb8" strokeWidth={2} />
                <rect x={hausX + 200} y={yAus(1 + s * STOCK) - 24} width={44} height={30} rx={3} fill="#a9dcff" stroke="#8a7a65" strokeWidth={2} />
              </g>
            ))}
            {/* Steigleitung */}
            {Array.from({ length: stockwerke }, (_, s) => (
              <Rohr key={s} d={`M${steigX} ${s ? yAus(1 + (s - 1) * STOCK) : T_BODEN + 30} V${yAus(1 + s * STOCK)}`} w={10} merke={merke(`s${s}`)} />
            ))}
          </g>
          {Array.from({ length: stockwerke }, (_, s) => {
            const y = yAus(1 + s * STOCK);
            const q = stand.fluss[s];
            const p = stand.druck[s];
            return (
              <g key={s}>
                <g style={{ opacity: wd }}>
                  <Rohr d={`M${steigX} ${y} H${steigX + 80}`} w={8} merke={merke(`h${s}`)} />
                  <Muffe x={steigX} y={y} w={10} />
                  <Hahn x={steigX + 80} y={y} offen={offen[s]} strahl={Math.min(1, (q * 60000) / 14)} onClick={() => umschalten(s)} titel={offen[s] ? "Hahn zudrehen" : "Hahn aufdrehen"} />
                  {offen[s] && q === 0 && <text x={steigX + 130} y={y + 24} fontSize={12} fill="#c0392b">kein Wasser</text>}
                </g>
                {/* Elektrik: Lampe je Hahn, parallel an der Steigleitung */}
                <g style={{ opacity: mix }} pointerEvents="none">
                  <line x1={steigX} y1={y} x2={steigX + 100} y2={y} style={{ stroke: "var(--text)" }} strokeWidth={3} />
                  <circle cx={steigX + 116} cy={y} r={14} fill={q > 0 ? `rgba(255,210,63,${Math.min(1, 0.3 + q * 3000)})` : "transparent"} style={{ stroke: "var(--text)" }} strokeWidth={2.5} />
                  <path d={`M${steigX + 106} ${y - 10} L${steigX + 126} ${y + 10} M${steigX + 126} ${y - 10} L${steigX + 106} ${y + 10}`} style={{ stroke: "var(--text)" }} strokeWidth={2} />
                </g>
                <Pille x={hausX + hausB - 50} y={y + 4} t={p > 0 ? `${bar(p)}${q > 0 ? ` · ${zahl(q * 60000, 1)} L/min` : ""}` : "Unterdruck"} farbe={p > 0 ? "#e0a000" : "#d64541"} />
              </g>
            );
          })}
          {/* Elektrik: Leitung im Potenzial gefärbt, Turm als Batterie */}
          <g style={{ opacity: mix }} pointerEvents="none">
            <path d={`${leitung} V${yOben}`} fill="none" stroke={potFarbe(stand.strasse)} strokeWidth={6} />
            <line x1={110} y1={yAus(turmHoehe) - 26} x2={170} y2={yAus(turmHoehe) - 26} style={{ stroke: "var(--text)" }} strokeWidth={3} />
            <line x1={125} y1={yAus(turmHoehe) - 12} x2={155} y2={yAus(turmHoehe) - 12} style={{ stroke: "var(--text)" }} strokeWidth={9} />
            <Pille x={140} y={yAus(turmHoehe) + 30} t={`Quelle ≙ ${zahl(spiegel, 1)} m`} />
          </g>
          <Pille x={400} y={T_BODEN + 50} t={`Durchfluss gesamt ${zahl(stand.gesamt * 60000, 1)} L/min`} gross />
        </svg>
      }
      seite={<>
        <Karte>
          <Regler label={`Turm: Boden auf ${turmHoehe} m`} min={5} max={40} step={1} wert={turmHoehe} setze={setTurmHoehe} />
          <Regler label={`Stockwerke: ${stockwerke}`} min={1} max={9} step={1} wert={stockwerke} setze={setStockwerke} />
          <p className="text-muted">Hähne im Bild anklicken — oder hier:</p>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: stockwerke }, (_, s) => (
              <button key={s} className={`btn ${offen[s] ? "btn-primary" : "btn-secondary"}`} onClick={() => umschalten(s)}>{s === 0 ? "EG" : `${s}. OG`}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 font-bold">
            💧 <input type="range" min={0} max={1} step={0.01} value={mix} onChange={e => setMix(Number(e.target.value))} className="flex-1" aria-label="Stromkreis einblenden" /> ⚡
          </label>
        </Karte>
        <Karte titel="Messwerte">
          <Werte zeilen={[
            ["Druck an der Straße", bar(stand.strasse)],
            ...stand.druck.map((p, s) => [s === 0 ? "EG" : `${s}. OG`, `${p > 0 ? bar(p) : "—"}${stand.fluss[s] > 0 ? ` · ${zahl(stand.fluss[s] * 60000, 1)} L/min` : ""}`] as [string, string]),
            ["Durchfluss gesamt", `${zahl(stand.gesamt * 60000, 1)} L/min`],
          ]} />
        </Karte>
      </>}
      unten={<Analogie>
        Der Turm ist die Quelle, die Hähne sind Lampen, die parallel an der Steigleitung hängen: Je mehr Lampen brennen,
        desto mehr Strom fließt durch die Zuleitung und desto mehr Spannung geht auf ihr verloren. Anders als im Stromkreis
        hängt jede Zapfstelle aber auf ihrer eigenen Höhe — als hätte jede Lampe ihren Minuspol woanders.
      </Analogie>}
    />
  );
}
