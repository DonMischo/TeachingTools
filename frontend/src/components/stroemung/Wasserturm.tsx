"use client";
/**
 * Station »Wasserturm & Röhren«.
 *  Röhren:     drei verbundene Gefäße verschiedener Breite gleichen ihre Spiegel aus (Löser, live).
 *  Wasserturm: Turm versorgt ein Haus; je Stockwerk weniger Druck, offene Hähne
 *              ziehen den Druck herunter. Darüber auf Wunsch der Stromkreis
 *              (Turm = Batterie, Hähne = Lampen parallel, Rohre = Leitungen).
 */
import { useMemo, useRef, useState } from "react";
import { Stroemung } from "@/lib/stroemung/loeser";
import { G, type Knoten, type Teil } from "@/lib/stroemung/modell";
import { Analogie, Karte, Pille, Regler, StationRahmen, Wahl, Werte, bar, muted, text, useTakt, zahl } from "./rahmen";

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
  { id: "A", x: 220, breite: 50 },
  { id: "B", x: 500, breite: 170 },
  { id: "C", x: 780, breite: 26 },
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
  const sim = useRef(roehrenNetz([0.9, 0.2, 0.5], false));
  const pegel = () => GEF.map(g => sim.current.zustand(`t${g.id}`));
  const neu = (p: number[], o: boolean) => { sim.current = roehrenNetz(p, o); setOffen(o); };
  useTakt(dt => sim.current.schritt(dt));
  const p = pegel();
  const giessen = (i: number) => neu(p.map((x, k) => (k === i ? Math.min(R_HOEHE, x + 0.001 / flaeche(GEF[i].breite)) : x)), offen);

  const versuche = [
    { name: "Hahn auf", idee: "Öffne den Hahn: Das Wasser fließt, bis überall derselbe Spiegel steht — egal wie breit oder schmal ein Gefäß ist.", los: () => neu([0.9, 0.2, 0.5], false) },
    { name: "Ins dünne Rohr gießen", idee: "Dieselbe Menge Wasser hebt den Spiegel im dünnen Rohr viel stärker. Am Ende verteilt sie sich auf alle — der Spiegel steigt überall gleich.", los: () => neu([0.4, 0.4, 0.4], true) },
  ];

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 420" className="w-full h-auto select-none" role="img" aria-label="Drei verbundene Gefäße">
          {/* Verbindungsrohr am Boden */}
          <path d={`M${GEF[0].x} ${R_BODEN} V${R_BODEN + 30} H${GEF[2].x} V${R_BODEN}`} fill="none" stroke="#7b8794" strokeWidth={18} />
          <path d={`M${GEF[0].x} ${R_BODEN} V${R_BODEN + 30} H${GEF[2].x} V${R_BODEN}`} fill="none" stroke={offen ? "hsl(205 80% 55%)" : "hsl(205 40% 45%)"} strokeWidth={12} />
          {[360, 640].map(x => (
            <g key={x} onClick={() => neu(p, !offen)} style={{ cursor: "pointer" }}>
              <rect x={x - 16} y={R_BODEN + 18} width={32} height={24} rx={4} fill="#8a949e" stroke="#4a545e" strokeWidth={2} />
              {!offen && <rect x={x - 3} y={R_BODEN + 20} width={6} height={20} fill="#b03a2e" />}
              <line x1={x} y1={R_BODEN + 18} x2={x} y2={R_BODEN + 4} stroke="#4a545e" strokeWidth={4} />
              <line x1={offen ? x - 14 : x} y1={offen ? R_BODEN + 2 : R_BODEN - 10} x2={offen ? x + 14 : x} y2={R_BODEN + 2} stroke="#b03a2e" strokeWidth={6} strokeLinecap="round" />
            </g>
          ))}
          {GEF.map((g, i) => {
            const h = p[i] * R_SKALA;
            return (
              <g key={g.id}>
                <rect x={g.x - g.breite / 2} y={R_BODEN - h} width={g.breite} height={h} fill="hsl(205 80% 55%)" />
                <path d={`M${g.x - g.breite / 2} ${R_BODEN - R_HOEHE * R_SKALA} V${R_BODEN} H${g.x + g.breite / 2} V${R_BODEN - R_HOEHE * R_SKALA}`} fill="none" stroke="#56616d" strokeWidth={4} />
                <text x={g.x} y={R_BODEN - R_HOEHE * R_SKALA - 10} textAnchor="middle" fontSize={15} fontWeight={700} style={text}>{g.id}</text>
                <Pille x={g.x} y={R_BODEN - h - 16} t={`${zahl(p[i] * 100, 0)} cm`} />
                <text x={g.x} y={R_BODEN - 8} textAnchor="middle" fontSize={12} fill="#ffffff">{bar(1000 * G * p[i], 3)}</text>
              </g>
            );
          })}
        </svg>
      }
      seite={<>
        <Karte>
          <button className="btn btn-primary" onClick={() => neu(p, !offen)}>{offen ? "🔒 Hahn zu" : "🔓 Hahn auf"}</button>
          <div className="flex flex-wrap gap-2">
            {GEF.map((g, i) => <button key={g.id} className="btn btn-secondary" onClick={() => giessen(i)}>💧 in {g.id} gießen</button>)}
          </div>
          <p className="text-muted">Jedes Mal kommt 1 Liter dazu — im schmalen Rohr steigt der Spiegel dabei viel mehr.</p>
        </Karte>
        <Karte titel="Druck am Boden">
          <Werte zeilen={GEF.map((g, i) => [`Gefäß ${g.id}`, bar(1000 * G * p[i], 3)])} />
        </Karte>
      </>}
      unten={<Analogie>Verbundene Gefäße sind wie Kondensatoren, die über Widerstände verbunden sind: Strom fließt, bis überall dieselbe Spannung herrscht. Ein breites Gefäß ist ein großer Kondensator — es braucht viel Wasser, bis sein Spiegel steigt.</Analogie>}
    />
  );
}

// ── Wasserturm ──

const T_BODEN = 510, T_SKALA = 11;   // px je m
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
      strasse: sim.druck("strasse"),
      gesamt: sim.fluss("fall"),
    };
  }, [turmHoehe, stockwerke, offen]);

  const umschalten = (s: number) => setOffen(o => o.map((x, i) => (i === s ? !x : x)));
  const versuche = [
    { name: "Oben weniger Druck", idee: "Jedes Stockwerk liegt 3,5 m höher — und hat rund 0,35 bar weniger Druck. Es zählt nur, wie tief der Hahn unter dem Wasserspiegel im Turm liegt.", los: () => { setTurmHoehe(25); setStockwerke(5); setOffen(Array(9).fill(false)); } },
    { name: "Alle duschen", idee: "Drehen alle gleichzeitig auf, fließt viel Wasser durch die Leitungen — die Reibung frisst Druck, und oben kommt deutlich weniger an.", los: () => { setStockwerke(5); setOffen(Array(9).fill(true)); } },
    { name: "Hochhaus", idee: "Liegt ein Hahn höher als der Wasserspiegel im Turm, kommt dort nichts an. Hochhäuser brauchen deshalb eigene Druckerhöhungspumpen.", los: () => { setTurmHoehe(15); setStockwerke(9); setOffen(Array(9).fill(true)); } },
  ];

  const hausX = 620, hausB = 300, steigX = 660;
  const wd = 1 - 0.8 * mix;
  const potFarbe = (pGes: number) => `hsl(${Math.round(120 * Math.max(0, Math.min(1, pGes / (spiegel * 1000 * G))))} 75% 45%)`;

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 560" className="w-full h-auto select-none" role="img" aria-label="Wasserturm und Haus">
          <line x1={0} y1={T_BODEN} x2={1000} y2={T_BODEN} stroke="#8d7b62" strokeWidth={3} />
          {/* Spiegel im Turm als Linie quer übers Bild */}
          <line x1={0} y1={yAus(spiegel)} x2={1000} y2={yAus(spiegel)} stroke="hsl(205 80% 55%)" strokeWidth={1.5} strokeDasharray="8 6" />
          <text x={995} y={yAus(spiegel) - 6} textAnchor="end" fontSize={13} style={muted}>Wasserspiegel im Turm: {zahl(spiegel, 1)} m</text>
          <g style={{ opacity: wd }}>
            {/* Turm */}
            <line x1={95} y1={yAus(turmHoehe)} x2={80} y2={T_BODEN} stroke="#8b5a2b" strokeWidth={8} />
            <line x1={185} y1={yAus(turmHoehe)} x2={200} y2={T_BODEN} stroke="#8b5a2b" strokeWidth={8} />
            <rect x={80} y={yAus(spiegel) - 4} width={120} height={FUELL * T_SKALA + 4} fill="hsl(205 80% 55%)" stroke="#56616d" strokeWidth={3} />
            <text x={140} y={yAus(spiegel) - 12} textAnchor="middle" fontSize={13} style={text}>Wasserturm</text>
            {/* Leitung: Turm → Straße → Haus */}
            <path d={`M140 ${yAus(turmHoehe)} V${T_BODEN + 20} H${steigX} V${yAus(1 + (stockwerke - 1) * STOCK)}`} fill="none" stroke="#7b8794" strokeWidth={12} />
            <path d={`M140 ${yAus(turmHoehe)} V${T_BODEN + 20} H${steigX} V${yAus(1 + (stockwerke - 1) * STOCK)}`} fill="none" stroke="hsl(205 80% 55%)" strokeWidth={7} />
            {/* Haus */}
            <rect x={hausX} y={yAus(stockwerke * STOCK + 1)} width={hausB} height={stockwerke * STOCK * T_SKALA + T_SKALA} fill="none" stroke="#a0a8b0" strokeWidth={3} />
            <path d={`M${hausX - 15} ${yAus(stockwerke * STOCK + 1)} L${hausX + hausB / 2} ${yAus(stockwerke * STOCK + 5)} L${hausX + hausB + 15} ${yAus(stockwerke * STOCK + 1)}`} fill="#b5523b" />
          </g>
          {Array.from({ length: stockwerke }, (_, s) => {
            const y = yAus(1 + s * STOCK);
            const q = stand.fluss[s];
            const p = stand.druck[s];
            const strahl = q > 0 ? 18 + 260 * Math.sqrt(q * 1000) : 0;
            return (
              <g key={s}>
                <g style={{ opacity: wd }}>
                  <line x1={hausX} y1={y + 16} x2={hausX + hausB} y2={y + 16} stroke="#a0a8b0" strokeWidth={2} />
                  <line x1={steigX} y1={y} x2={steigX + 70} y2={y} stroke="#7b8794" strokeWidth={8} />
                  <g onClick={() => umschalten(s)} style={{ cursor: "pointer" }}>
                    <rect x={steigX + 64} y={y - 10} width={22} height={18} rx={4} fill={offen[s] ? "#2e9e3e" : "#b03a2e"} />
                    <text x={steigX + 75} y={y + 4} textAnchor="middle" fontSize={11} fill="#fff">{offen[s] ? "auf" : "zu"}</text>
                  </g>
                  {strahl > 0 && <path d={`M${steigX + 86} ${y} q ${strahl * 0.5} 0 ${strahl * 0.7} 14`} fill="none" stroke="hsl(205 80% 60%)" strokeWidth={5} strokeLinecap="round" />}
                  {offen[s] && q === 0 && <text x={steigX + 96} y={y + 4} fontSize={12} style={muted}>kein Wasser</text>}
                </g>
                {/* Elektrik: Lampe je Hahn, parallel an der Steigleitung */}
                <g style={{ opacity: mix }}>
                  <line x1={steigX} y1={y} x2={steigX + 100} y2={y} style={{ stroke: "var(--text)" }} strokeWidth={3} />
                  <circle cx={steigX + 116} cy={y} r={14} fill={q > 0 ? `rgba(255,210,63,${Math.min(1, 0.3 + q * 3000)})` : "transparent"} style={{ stroke: "var(--text)" }} strokeWidth={2.5} />
                  <path d={`M${steigX + 106} ${y - 10} L${steigX + 126} ${y + 10} M${steigX + 126} ${y - 10} L${steigX + 106} ${y + 10}`} style={{ stroke: "var(--text)" }} strokeWidth={2} />
                  {!offen[s] && <text x={steigX + 140} y={y + 5} fontSize={12} style={muted}>Schalter offen</text>}
                </g>
                <Pille x={hausX + hausB - 60} y={y + 4} t={p > 0 ? bar(p) : "Unterdruck"} />
              </g>
            );
          })}
          {/* Elektrik: Leitung im Potenzial gefärbt, Turm als Batterie */}
          <g style={{ opacity: mix }} pointerEvents="none">
            <path d={`M140 ${yAus(turmHoehe)} V${T_BODEN + 20} H${steigX} V${yAus(1 + (stockwerke - 1) * STOCK)}`} fill="none" stroke={potFarbe(stand.strasse + 0)} strokeWidth={6} />
            <line x1={110} y1={yAus(turmHoehe) - 26} x2={170} y2={yAus(turmHoehe) - 26} style={{ stroke: "var(--text)" }} strokeWidth={3} />
            <line x1={125} y1={yAus(turmHoehe) - 12} x2={155} y2={yAus(turmHoehe) - 12} style={{ stroke: "var(--text)" }} strokeWidth={9} />
            <Pille x={140} y={yAus(turmHoehe) + 30} t={`Quelle ≙ ${zahl(spiegel, 1)} m`} />
            <Pille x={400} y={T_BODEN + 50} t={`I gesamt = ${zahl(stand.gesamt * 1000)} L/s`} gross />
          </g>
        </svg>
      }
      seite={<>
        <Karte>
          <Regler label={`Turm: Boden auf ${turmHoehe} m`} min={5} max={40} step={1} wert={turmHoehe} setze={setTurmHoehe} />
          <Regler label={`Stockwerke: ${stockwerke}`} min={1} max={9} step={1} wert={stockwerke} setze={setStockwerke} />
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
            ...stand.druck.map((p, s) => [s === 0 ? "EG" : `${s}. OG`, `${p > 0 ? bar(p) : "—"}${stand.fluss[s] > 0 ? ` · ${zahl(stand.fluss[s] * 1000)} L/s` : ""}`] as [string, string]),
            ["Durchfluss gesamt", `${zahl(stand.gesamt * 1000)} L/s`],
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
