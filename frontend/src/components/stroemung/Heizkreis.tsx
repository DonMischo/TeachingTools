"use client";
/**
 * Station »Heizkreis« (Technik): Kessel, Umwälzpumpe, drei Heizkörper in
 * wachsendem Abstand. Ohne hydraulischen Abgleich bleibt der ferne Raum kalt;
 * die Voreinstellung der Thermostatventile verteilt das Wasser gerecht.
 * Vorlauf (rot) und Rücklauf (blau) laufen als durchgehende Leitungen; jeder
 * Heizkörper hängt mit T-Stücken daran. Der Regler 💧↔⚡ zeigt den Stromkreis.
 */
import { useMemo, useState } from "react";
import { BEDARF, RAUM, abgleich, rechneHeizung, type Heizung } from "@/lib/stroemung/heizung";
import { FARBE, KitDefs, Manometer, Muffe, Pumpe, Rohr, useFliessen } from "./kit";
import { Analogie, Karte, Pille, Regler, StationRahmen, Werte, bar, zahl } from "./rahmen";

const START: Heizung = { pumpe: 0.25e5, vorlauf: 55, stufen: [6, 6, 6], offen: [true, true, true] };
const lh = (q: number) => `${zahl(q * 3.6e6, 0)} L/h`;
/** Temperatur → Farbe: 20 °C blau, 70 °C rot, ohne Grün dazwischen. */
const glut = (t: number) => {
  const f = Math.max(0, Math.min(1, (t - RAUM) / 50));
  const m = (a: number, b: number) => Math.round(a + (b - a) * f);
  return `rgb(${m(61, 229)} ${m(127, 83)} ${m(229, 61)})`;
};

// Geometrie
const VL = 446, RL = 482;                       // Vorlauf / Rücklauf
const RAEUME = [262, 502, 742];                 // linke Kante je Raum (Breite 230)
const HK_Y = 300, HK_H = 64, HK_B = 132;        // Heizkörper
const zuX = (i: number) => RAEUME[i] + 40;      // Abzweig Vorlauf
const abX = (i: number) => RAEUME[i] + 40 + HK_B + 22;   // Abzweig Rücklauf

export default function Heizkreis() {
  const [h, setH] = useState<Heizung>(START);
  const [mix, setMix] = useState(0);
  const set = (t: Partial<Heizung>) => setH(a => ({ ...a, ...t }));
  const r = useMemo(() => rechneHeizung(h), [h]);
  const gesamtWaerme = r.heizkoerper.reduce((a, k) => a + k.leistung, 0);
  const q = r.heizkoerper.map(k => k.q);

  // Bläschen: auf dem Vorlauf nimmt der Strom nach jedem Abzweig ab, auf dem Rücklauf zu
  const v = (x: number) => x * 3.6e6 * 0.6;
  const merke = useFliessen(() => new Map([
    ["vl0", v(q[0] + q[1] + q[2])], ["vl1", v(q[1] + q[2])], ["vl2", v(q[2])],
    ["rl2", v(q[2])], ["rl1", v(q[1] + q[2])], ["rl0", v(q[0] + q[1] + q[2])],
    ...q.flatMap((x, i) => [[`z${i}`, v(x)], [`a${i}`, v(x)]] as [string, number][]),
  ]));

  const versuche = [
    { name: "Hinten kalt", idee: "Alle Ventile ganz offen: Das Wasser nimmt den kürzesten Weg — der nahe Heizkörper bekommt viel zu viel, im fernen Zimmer bleibt es kühl.", los: () => setH(START) },
    { name: "Pumpe hochdrehen?", idee: "Die Pumpe stärker stellen hilft hinten kaum — vorne wird es noch wärmer, die Pumpe braucht mehr Strom, und es rauscht in den Ventilen.", los: () => setH({ ...START, pumpe: 0.45e5 }) },
    { name: "Hydraulischer Abgleich", idee: "Vorne drosseln, hinten offen lassen: Jetzt bekommt jeder Raum, was er braucht — mit weniger Pumpendruck. Genau das macht der Heizungsbauer beim Abgleich.", los: () => setH({ ...START, stufen: abgleich(START) }) },
  ];

  const wd = 1 - 0.8 * mix;
  const pAlle = ["po", "k", "v1", "v2", "v3", "r1", "r2", "r3", "pu"].map(r.druck);
  const pMin = Math.min(...pAlle), pMax = Math.max(...pAlle);
  const pot = (id: string) => `hsl(${Math.round(120 * (pMax > pMin ? (r.druck(id) - pMin) / (pMax - pMin) : 1))} 75% 45%)`;
  const ende = abX(2) + 20;

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 540" className="w-full h-auto select-none" role="img" aria-label="Heizkreis mit drei Heizkörpern">
          <KitDefs />
          <defs>
            <linearGradient id="hkWand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6efe2" /><stop offset="1" stopColor="#e9dcc6" /></linearGradient>
            <linearGradient id="hkKeller" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d2d6da" /><stop offset="1" stopColor="#b5bbc1" /></linearGradient>
            <pattern id="hkDielen" width="80" height="14" patternUnits="userSpaceOnUse"><rect width="80" height="14" fill="#a8743f" /><path d="M0 0 H80 M40 0 V14" stroke="#8a5d30" strokeWidth={1.5} /></pattern>
          </defs>
          {/* Haus im Schnitt: Kellerraum links, drei Zimmer, Boden mit Leitungen */}
          <rect x={0} y={0} width={1000} height={540} fill="#9fb4c4" />
          <rect x={14} y={110} width={232} height={300} fill="url(#hkKeller)" stroke="#8d97a0" strokeWidth={3} />
          <text x={130} y={135} textAnchor="middle" fontSize={14} fontWeight={700} fill="#3f4a55">Heizraum</text>
          {RAEUME.map((x, i) => {
            const k = r.heizkoerper[i];
            const warm = k.leistung >= BEDARF;
            const raumT = RAUM - 4 + 6 * Math.min(1.3, k.leistung / BEDARF);
            return (
              <g key={i}>
                <rect x={x} y={110} width={232} height={300} fill="url(#hkWand)" stroke="#a89a85" strokeWidth={3} />
                <rect x={x} y={110} width={232} height={300} fill={warm ? "#ff8a3d" : "#4c8dff"} opacity={warm ? 0.08 : 0.12} />
                <rect x={x + 80} y={150} width={80} height={84} rx={4} fill="#cfe9ff" stroke="#8a7a65" strokeWidth={3} />
                <line x1={x + 120} y1={150} x2={x + 120} y2={234} stroke="#8a7a65" strokeWidth={2} />
                <text x={x + 116} y={136} textAnchor="middle" fontSize={15} fontWeight={800} fill="#3f2d1a">Raum {i + 1} {warm ? "🙂" : "🥶"}</text>
                <text x={x + 116} y={256} textAnchor="middle" fontSize={12} fill="#6b5a45">{["nah am Kessel", "Mitte", "am weitesten weg"][i]}</text>
                {/* Thermometer */}
                <rect x={x + 196} y={160} width={10} height={70} rx={5} fill="#fff" stroke="#8a7a65" />
                <rect x={x + 198} y={160 + 66 - Math.max(6, Math.min(62, (raumT - 12) * 6))} width={6} height={Math.max(6, Math.min(62, (raumT - 12) * 6))} rx={3} fill={warm ? "#e5533d" : "#3d7fe5"} />
                <circle cx={x + 201} cy={232} r={7} fill={warm ? "#e5533d" : "#3d7fe5"} />
                <text x={x + 201} y={252} textAnchor="middle" fontSize={12} fontWeight={700} fill="#3f2d1a">{zahl(raumT, 0)} °C</text>
              </g>
            );
          })}
          <rect x={0} y={410} width={1000} height={14} fill="url(#hkDielen)" />
          <rect x={0} y={424} width={1000} height={116} fill="#a99c8a" />

          <g style={{ opacity: wd }}>
            {/* Kessel mit Flammenfenster */}
            <rect x={40} y={180} width={110} height={190} rx={10} fill="#f4f5f6" stroke="#8d97a0" strokeWidth={3} filter="url(#kit-schatten)" />
            <rect x={62} y={290} width={66} height={50} rx={6} fill="#2b2f33" />
            <path d={`M75 336 q8 -30 20 -10 q6 -26 18 0 q8 -20 14 10 Z`} fill={glut(h.vorlauf)}>
              <animate attributeName="d" dur="0.9s" repeatCount="indefinite" values="M75 336 q8 -30 20 -10 q6 -26 18 0 q8 -20 14 10 Z;M75 336 q8 -24 20 -14 q6 -30 18 4 q8 -26 14 10 Z;M75 336 q8 -30 20 -10 q6 -26 18 0 q8 -20 14 10 Z" />
            </path>
            <text x={95} y={215} textAnchor="middle" fontSize={15} fontWeight={800} fill="#3f4a55">Kessel</text>
            <text x={95} y={245} textAnchor="middle" fontSize={20} fontWeight={800} fill={glut(h.vorlauf)}>{h.vorlauf} °C</text>

            {/* Vorlauf: Kessel → Pumpe → T-Stücke; Rücklauf zurück, Ausdehnungsgefäß */}
            <Rohr d={`M150 ${VL - 120} H190 V${VL} H${zuX(0)}`} w={12} fluessig={glut(h.vorlauf)} merke={merke("vl0")} />
            <Rohr d={`M${zuX(0)} ${VL} H${zuX(1)}`} w={12} fluessig={glut(h.vorlauf)} merke={merke("vl1")} />
            <Rohr d={`M${zuX(1)} ${VL} H${zuX(2)}`} w={12} fluessig={glut(h.vorlauf)} merke={merke("vl2")} />
            <Rohr d={`M${ende} ${RL} H${abX(1)}`} w={12} fluessig={glut(r.heizkoerper[2].ruecklauf)} merke={merke("rl2")} />
            <Rohr d={`M${abX(1)} ${RL} H${abX(0)}`} w={12} fluessig={glut((r.heizkoerper[1].ruecklauf + r.heizkoerper[2].ruecklauf) / 2)} merke={merke("rl1")} />
            <Rohr d={`M${abX(0)} ${RL} H110 V370`} w={12} fluessig={glut(r.ruecklauf)} merke={merke("rl0")} />
            <Rohr d={`M${abX(2)} ${RL} H${ende}`} w={12} fluessig={glut(r.heizkoerper[2].ruecklauf)} />
            <Pumpe x={190} y={VL - 60} r={20} laeuft={r.gesamt > 0} />
            <text x={222} y={VL - 82} fontSize={12} fill="#3f4a55">Pumpe</text>
            <line x1={60} y1={RL} x2={60} y2={RL + 4} stroke={FARBE.gehaeuse} strokeWidth={5} />
            <Rohr d={`M110 ${RL} H60 V${RL + 10}`} w={8} fluessig={glut(r.ruecklauf)} />
            <ellipse cx={60} cy={RL + 26} rx={24} ry={14} fill="#d64541" stroke="#7b241c" strokeWidth={2} filter="url(#kit-schatten)" />
            <text x={60} y={RL + 52} textAnchor="middle" fontSize={10} fill="#3f2d1a">Ausdehnungsgefäß</text>
            <line x1={150} y1={RL} x2={150} y2={RL + 18} stroke={FARBE.gehaeuse} strokeWidth={4} />
            <Manometer x={150} y={RL + 36} r={16} wert={1.5 + (r.druck("po") - r.druck("pu")) / 1e5} max={4} />
          </g>

          {RAEUME.map((x, i) => {
            const k = r.heizkoerper[i];
            const tm = (h.vorlauf + k.ruecklauf) / 2;
            const zu = !h.offen[i];
            const kalt = zu || k.q <= 0;
            const hx = x + 50;
            return (
              <g key={i}>
                <g style={{ opacity: wd }}>
                  {/* Zulauf: T-Stück am Vorlauf → hoch → Thermostatventil → Heizkörper oben links */}
                  <Rohr d={`M${zuX(i)} ${VL} V${HK_Y + 8} H${hx}`} w={8} fluessig={glut(h.vorlauf)} merke={merke(`z${i}`)} />
                  {/* Ablauf: unten rechts → runter → T-Stück am Rücklauf */}
                  <Rohr d={`M${hx + HK_B} ${HK_Y + HK_H - 8} H${abX(i)} V${RL}`} w={8} fluessig={glut(k.ruecklauf)} merke={merke(`a${i}`)} />
                  <Muffe x={zuX(i)} y={VL} w={12} />
                  <Muffe x={abX(i)} y={RL} w={12} />
                  {/* Heizkörper: Lamellen nach Temperatur, Wärmeflimmern darüber */}
                  <rect x={hx} y={HK_Y} width={HK_B} height={HK_H} rx={6} fill={kalt ? glut(RAUM) : glut(tm)} stroke="#56616d" strokeWidth={1.5} filter="url(#kit-schatten)" />
                  {Array.from({ length: 11 }, (_, s) => (
                    <rect key={s} x={hx + 6 + s * 11.6} y={HK_Y + 4} width={7} height={HK_H - 8} rx={3} fill="#ffffff" opacity={0.22} />
                  ))}
                  {!kalt && [0, 1, 2].map(w => (
                    <path key={w} d={`M${hx + 30 + w * 36} ${HK_Y - 8} q 6 -10 0 -20 q -6 -10 0 -20`} fill="none" stroke={glut(tm)} strokeWidth={2.5} strokeLinecap="round" opacity={Math.min(0.8, k.leistung / 1600)}>
                      <animateTransform attributeName="transform" type="translate" values="0 6;0 -6;0 6" dur={`${1.6 + w * 0.3}s`} repeatCount="indefinite" />
                    </path>
                  ))}
                  {/* Thermostatkopf: anklicken schließt/öffnet, Zahl = Voreinstellung */}
                  <g onClick={() => set({ offen: h.offen.map((o, n) => (n === i ? !o : o)) as Heizung["offen"] })} style={{ cursor: "pointer" }} role="button" aria-label={zu ? "Thermostat öffnen" : "Thermostat schließen"}>
                    <title>{zu ? "Ventil öffnen" : "Ventil schließen"} · Voreinstellung {h.stufen[i]}</title>
                    <rect x={zuX(i) - 14} y={HK_Y - 30} width={28} height={30} rx={8} fill={zu ? "#c0392b" : "#f2f4f6"} stroke="#56616d" strokeWidth={2} filter="url(#kit-schatten)" />
                    <text x={zuX(i)} y={HK_Y - 9} textAnchor="middle" fontSize={15} fontWeight={800} fill={zu ? "#fff" : "#2f3740"}>{zu ? "✕" : h.stufen[i]}</text>
                  </g>
                </g>
                {/* Elektrik: Lampe mit Vorwiderstand */}
                <g style={{ opacity: mix }} pointerEvents="none">
                  <path d={`M${zuX(i)} ${VL} V${HK_Y + 8}`} fill="none" stroke={pot(`v${i + 1}`)} strokeWidth={5} />
                  <path d={`M${abX(i)} ${HK_Y + HK_H - 8} V${RL}`} fill="none" stroke={pot(`r${i + 1}`)} strokeWidth={5} />
                  <circle cx={hx + HK_B / 2} cy={HK_Y + HK_H / 2} r={22} fill={`rgba(255,210,63,${Math.min(1, k.leistung / 1600)})`} style={{ stroke: "var(--text)" }} strokeWidth={3} />
                  <path d={`M${hx + HK_B / 2 - 15} ${HK_Y + HK_H / 2 - 15} L${hx + HK_B / 2 + 15} ${HK_Y + HK_H / 2 + 15} M${hx + HK_B / 2 + 15} ${HK_Y + HK_H / 2 - 15} L${hx + HK_B / 2 - 15} ${HK_Y + HK_H / 2 + 15}`} style={{ stroke: "var(--text)" }} strokeWidth={2.5} />
                </g>
                <Pille x={hx + HK_B / 2} y={HK_Y + HK_H + 22} t={zu ? "Ventil zu" : `${zahl(k.leistung / 1000, 2)} kW · ${lh(k.q)}`} farbe={k.leistung >= BEDARF ? "#2e9e3e" : "#2e6fb5"} />
              </g>
            );
          })}
          <Pille x={600} y={RL + 44} t={`Vorlauf ${h.vorlauf} °C → Rücklauf ${zahl(r.ruecklauf, 0)} °C · ${lh(r.gesamt)}`} gross />
        </svg>
      }
      seite={<>
        <Karte>
          <Regler label={`Pumpe: ${bar(h.pumpe)}`} min={0.1e5} max={0.6e5} step={0.01e5} wert={h.pumpe} setze={x => set({ pumpe: x })} />
          <Regler label={`Vorlauf: ${h.vorlauf} °C`} min={35} max={75} step={1} wert={h.vorlauf} setze={x => set({ vorlauf: x })} />
          {[0, 1, 2].map(i => (
            <Regler key={i} label={`Ventil Raum ${i + 1}: Stufe ${h.stufen[i]}`} min={1} max={6} step={1} wert={h.stufen[i]}
              setze={x => set({ stufen: h.stufen.map((s, n) => (n === i ? x : s)) as Heizung["stufen"] })} />
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
