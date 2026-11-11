"use client";
/**
 * Station »Heizkreis« (Technik): Kessel, Umwälzpumpe, drei Heizkörper in
 * wachsendem Abstand. Ohne hydraulischen Abgleich bleibt der ferne Raum kalt;
 * die Voreinstellung der Thermostatventile verteilt das Wasser gerecht.
 * Der Regler 💧↔⚡ zeigt den Stromkreis: Lampen parallel an langen Leitungen.
 */
import { useMemo, useState } from "react";
import { BEDARF, RAUM, abgleich, rechneHeizung, type Heizung } from "@/lib/stroemung/heizung";
import { Analogie, Karte, Pille, Regler, StationRahmen, Werte, bar, text, zahl } from "./rahmen";

const START: Heizung = { pumpe: 0.25e5, vorlauf: 55, stufen: [6, 6, 6], offen: [true, true, true] };
const lh = (q: number) => `${zahl(q * 3.6e6, 0)} L/h`;
/** Temperatur → Farbe: 20 °C blau, 70 °C rot. */
const glut = (t: number) => {
  const f = Math.max(0, Math.min(1, (t - RAUM) / 50));
  const mische = (a: number, b: number) => Math.round(a + (b - a) * f);
  return `rgb(${mische(59, 239)} ${mische(130, 68)} ${mische(246, 68)})`;   // blau → rot, ohne Grün dazwischen
};

export default function Heizkreis() {
  const [h, setH] = useState<Heizung>(START);
  const [mix, setMix] = useState(0);
  const set = (t: Partial<Heizung>) => setH(a => ({ ...a, ...t }));
  const r = useMemo(() => rechneHeizung(h), [h]);
  const gesamtWaerme = r.heizkoerper.reduce((a, k) => a + k.leistung, 0);

  const versuche = [
    { name: "Hinten kalt", idee: "Alle Ventile ganz offen: Das Wasser nimmt den kürzesten Weg — der nahe Heizkörper bekommt viel zu viel, im fernen Zimmer bleibt es kühl.", los: () => setH(START) },
    { name: "Pumpe hochdrehen?", idee: "Die Pumpe stärker stellen hilft hinten kaum — vorne wird es noch wärmer, die Pumpe braucht mehr Strom, und es rauscht in den Ventilen.", los: () => setH({ ...START, pumpe: 0.45e5 }) },
    { name: "Hydraulischer Abgleich", idee: "Vorne drosseln, hinten offen lassen: Jetzt bekommt jeder Raum, was er braucht — mit weniger Pumpendruck. Genau das macht der Heizungsbauer beim Abgleich.", los: () => setH({ ...START, stufen: abgleich(START) }) },
  ];

  // Geometrie
  const VL = 430, RL = 470, X = [300, 530, 760];
  const wd = 1 - 0.8 * mix;
  const pAlle = ["po", "k", "v1", "v2", "v3", "r1", "r2", "r3", "pu"].map(r.druck);
  const pMin = Math.min(...pAlle), pMax = Math.max(...pAlle);
  const pot = (id: string) => `hsl(${Math.round(120 * (pMax > pMin ? (r.druck(id) - pMin) / (pMax - pMin) : 1))} 75% 45%)`;

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 520" className="w-full h-auto select-none" role="img" aria-label="Heizkreis mit drei Heizkörpern">
          {/* Räume */}
          {X.map((x, i) => {
            const k = r.heizkoerper[i];
            const warm = k.leistung >= BEDARF;
            return (
              <g key={i}>
                <rect x={x - 50} y={140} width={210} height={250} fill={warm ? "rgba(255,140,60,0.10)" : "rgba(80,150,255,0.10)"} stroke="#a0a8b0" strokeWidth={3} />
                <text x={x + 55} y={170} textAnchor="middle" fontSize={15} fontWeight={700} style={text}>Raum {i + 1} {warm ? "🙂" : "🥶"}</text>
                <text x={x + 55} y={190} textAnchor="middle" fontSize={12} style={text}>{["nah am Kessel", "Mitte", "am weitesten weg"][i]}</text>
              </g>
            );
          })}
          <g style={{ opacity: wd }}>
            {/* Kessel und Pumpe */}
            <rect x={40} y={230} width={110} height={170} rx={10} fill="#c7cdd3" stroke="#56616d" strokeWidth={3} />
            <text x={95} y={260} textAnchor="middle" fontSize={14} fontWeight={700} fill="#2f3740">Kessel</text>
            <path d="M75 380 q8 -30 20 -10 q6 -25 18 0 q8 -20 14 10 Z" fill={glut(h.vorlauf)} />
            <text x={95} y={300} textAnchor="middle" fontSize={13} fill="#2f3740">{h.vorlauf} °C</text>
            {/* Vorlauf / Rücklauf */}
            <path d={`M150 ${VL - 30} H180 V${VL} H${X[2]}`} fill="none" stroke="#7b8794" strokeWidth={13} />
            <path d={`M150 ${VL - 30} H180 V${VL} H${X[2]}`} fill="none" stroke={glut(h.vorlauf)} strokeWidth={8} />
            <path d={`M${X[2] + 110} ${RL} H200 M180 ${RL} H95 V400`} fill="none" stroke="#7b8794" strokeWidth={13} />
            <path d={`M${X[2] + 110} ${RL} H200 M180 ${RL} H95 V400`} fill="none" stroke={glut(r.ruecklauf)} strokeWidth={8} />
            <circle cx={190} cy={RL} r={18} fill="#2e6fb5" stroke="#1d3d63" strokeWidth={3} />
            <path d="M182 461 L200 470 L182 479 Z" fill="#fff" />
            <ellipse cx={240} cy={RL + 30} rx={22} ry={14} fill="#d64541" />
            <line x1={240} y1={RL} x2={240} y2={RL + 16} stroke="#7b8794" strokeWidth={5} />
            <text x={268} y={RL + 35} fontSize={11} style={text}>Ausdehnungsgefäß (1,5 bar)</text>
            <text x={190} y={RL - 26} textAnchor="middle" fontSize={12} style={text}>Pumpe</text>
          </g>
          {X.map((x, i) => {
            const k = r.heizkoerper[i];
            const tm = (h.vorlauf + k.ruecklauf) / 2;
            const zu = !h.offen[i];
            return (
              <g key={i}>
                <g style={{ opacity: wd }}>
                  {/* Abzweig: hoch zum Ventil, durch den Heizkörper, runter zum Rücklauf */}
                  <path d={`M${x} ${VL} V320 H${x + 20}`} fill="none" stroke={glut(h.vorlauf)} strokeWidth={7} />
                  <path d={`M${x + 110} 370 H${x + 120} V${RL}`} fill="none" stroke={glut(k.ruecklauf)} strokeWidth={7} />
                  {/* Heizkörper */}
                  {Array.from({ length: 9 }, (_, s) => (
                    <rect key={s} x={x + 22 + s * 10} y={300} width={8} height={80} rx={3} fill={zu || k.q <= 0 ? glut(RAUM) : glut(tm)} stroke="#56616d" strokeWidth={1} />
                  ))}
                  {/* Thermostatventil mit Voreinstellung */}
                  <g onClick={() => set({ offen: h.offen.map((o, n) => (n === i ? !o : o)) as Heizung["offen"] })} style={{ cursor: "pointer" }}>
                    <rect x={x - 12} y={300} width={24} height={30} rx={6} fill={zu ? "#b03a2e" : "#f2f4f6"} stroke="#56616d" strokeWidth={2} />
                    <text x={x} y={320} textAnchor="middle" fontSize={13} fontWeight={700} fill={zu ? "#fff" : "#2f3740"}>{zu ? "✕" : h.stufen[i]}</text>
                  </g>
                </g>
                {/* Elektrik: Lampe mit Vorwiderstand an den Leitungen */}
                <g style={{ opacity: mix }}>
                  <path d={`M${x} ${VL} V320`} fill="none" stroke={pot(`v${i + 1}`)} strokeWidth={5} />
                  <path d={`M${x + 120} 340 V${RL}`} fill="none" stroke={pot(`r${i + 1}`)} strokeWidth={5} />
                  <rect x={x - 10} y={265} width={20} height={50} style={{ fill: "var(--surface)", stroke: "var(--text)" }} strokeWidth={2.5} />
                  <line x1={x - 18} y1={312} x2={x + 18} y2={268} style={{ stroke: "var(--text)" }} strokeWidth={2} />
                  <line x1={x} y1={265} x2={x} y2={250} style={{ stroke: "var(--text)" }} strokeWidth={3} />
                  <line x1={x} y1={250} x2={x + 120} y2={250} style={{ stroke: "var(--text)" }} strokeWidth={3} />
                  <line x1={x + 120} y1={250} x2={x + 120} y2={340} style={{ stroke: "var(--text)" }} strokeWidth={3} />
                  <circle cx={x + 60} cy={250} r={18} fill={`rgba(255,210,63,${Math.min(1, k.leistung / 1600)})`} style={{ stroke: "var(--text)" }} strokeWidth={2.5} />
                  <path d={`M${x + 47} 237 L${x + 73} 263 M${x + 73} 237 L${x + 47} 263`} style={{ stroke: "var(--text)" }} strokeWidth={2} />
                </g>
                <Pille x={x + 55} y={222} t={zu ? "Ventil zu" : `${zahl(k.leistung / 1000, 2)} kW · ${lh(k.q)}`} farbe={k.leistung >= BEDARF ? "#2e9e3e" : "#2e6fb5"} />
              </g>
            );
          })}
          <g style={{ opacity: mix }}>
            <path d={`M180 ${VL} H${X[2]}`} fill="none" stroke={pot("v2")} strokeWidth={5} />
            <path d={`M${X[2] + 120} ${RL} H200`} fill="none" stroke={pot("r2")} strokeWidth={5} />
            <line x1={160} y1={RL - 14} x2={160} y2={RL + 14} style={{ stroke: "var(--text)" }} strokeWidth={3} />
            <line x1={172} y1={RL - 7} x2={172} y2={RL + 7} style={{ stroke: "var(--text)" }} strokeWidth={8} />
          </g>
          <Pille x={560} y={505} t={`Vorlauf ${h.vorlauf} °C → Rücklauf ${zahl(r.ruecklauf, 0)} °C · ${lh(r.gesamt)}`} />
        </svg>
      }
      seite={<>
        <Karte>
          <Regler label={`Pumpe: ${bar(h.pumpe)}`} min={0.1e5} max={0.6e5} step={0.01e5} wert={h.pumpe} setze={v => set({ pumpe: v })} />
          <Regler label={`Vorlauf: ${h.vorlauf} °C`} min={35} max={75} step={1} wert={h.vorlauf} setze={v => set({ vorlauf: v })} />
          {[0, 1, 2].map(i => (
            <Regler key={i} label={`Ventil Raum ${i + 1}: Stufe ${h.stufen[i]}`} min={1} max={6} step={1} wert={h.stufen[i]}
              setze={v => set({ stufen: h.stufen.map((s, n) => (n === i ? v : s)) as Heizung["stufen"] })} />
          ))}
          <button className="btn btn-primary" onClick={() => set({ stufen: abgleich(h) })}>⚖️ Abgleich berechnen</button>
          <button className="btn btn-secondary" onClick={() => set({ stufen: [6, 6, 6] })}>Alle Ventile ganz offen</button>
          <label className="flex items-center gap-2 font-bold">💧 <input type="range" min={0} max={1} step={0.01} value={mix} onChange={e => setMix(Number(e.target.value))} className="flex-1" aria-label="Stromkreis einblenden" /> ⚡</label>
        </Karte>
        <Karte titel="Messwerte">
          <Werte zeilen={[
            ["Bedarf je Raum", `${zahl(BEDARF / 1000, 1)} kW`],
            ...r.heizkoerper.map((k, i) => [`Raum ${i + 1}`, `${zahl(k.leistung / 1000, 2)} kW ${k.leistung >= BEDARF ? "✓" : "✗"}`] as [string, string]),
            ["Wärme gesamt", `${zahl(gesamtWaerme / 1000, 2)} kW`],
            ["Umlauf", lh(r.gesamt)],
            ["Pumpe Δp", bar(r.foerderhoehe)],
            ["Pumpe (hydraulisch)", `${zahl(r.foerderhoehe * r.gesamt, 1)} W`],
          ]} />
        </Karte>
      </>}
      unten={<Analogie>
        Drei Lampen hängen parallel an langen, dünnen Leitungen: Auf dem Weg zur fernsten geht am meisten Spannung verloren,
        sie leuchtet schwach. Höhere Spannung (Pumpe) macht vor allem die nahe heller. Der Abgleich gibt den nahen Lampen
        Vorwiderstände — dann bekommt jede, was sie braucht.
      </Analogie>}
    />
  );
}
