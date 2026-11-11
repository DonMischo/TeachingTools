"use client";
/**
 * Station »Hydraulische Presse«: Wagenheber mit kleinem Pumpkolben und großem
 * Hubkolben. Pascal: überall derselbe Druck ⇒ F₁/A₁ = F₂/A₂, dafür ist der Weg
 * des kleinen Kolbens länger (Arbeit bleibt gleich). Mit Luftblase in der
 * Leitung (Bremse) geht ein Teil des Pumpwegs fürs Zusammendrücken drauf.
 */
import { useState } from "react";
import { blasenVolumen, blasenWeg, presse } from "@/lib/stroemung/druck";
import { G, P_LUFT } from "@/lib/stroemung/modell";
import { Analogie, Karte, Pille, Regler, StationRahmen, Werte, bar, muted, text, useTakt, zahl } from "./rahmen";

const HUB = 0.1;        // m Weg des Pumpkolbens je Stoß
const BLASE = 3e-6;     // m³ Luftblase (3 cm³)
const DAUER = 0.8;      // s je Stoß
const MAX_HEBUNG = 0.3; // m

const kreis = (d: number) => Math.PI * d * d / 4;

export default function Presse() {
  const [d1, setD1] = useState(2);      // cm
  const [d2, setD2] = useState(20);     // cm
  const [masse, setMasse] = useState(1200);
  const [hand, setHand] = useState(150);
  const [blase, setBlase] = useState(false);
  const [hebung, setHebung] = useState(0);
  const [stoesse, setStoesse] = useState(0);
  const [phase, setPhase] = useState<number | null>(null);   // 0…1 während eines Stoßes

  const A1 = kreis(d1 / 100), A2 = kreis(d2 / 100);
  const last = masse * G;
  const r = presse(A1, A2, last);
  const stark = hand >= r.kraft;
  const leerweg = blase ? Math.min(HUB, blasenWeg(BLASE, A1, r.druck)) : 0;
  const hebtJeStoss = stark ? Math.max(0, HUB - leerweg) * A1 / A2 : 0;

  useTakt(dt => {
    if (phase === null) return;
    const n = phase + dt / DAUER;
    if (n >= 1) {
      setPhase(null);
      setHebung(h => Math.min(MAX_HEBUNG, h + hebtJeStoss));
      setStoesse(s => s + 1);
    } else setPhase(n);
  }, phase !== null);

  // Pumpkolben: in der ersten Hälfte hinunter (wenn die Kraft reicht), dann zurück
  const runter = phase === null ? 0 : phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const s1 = stark ? runter * HUB : 0;
  const imStoss = phase !== null && phase < 0.5 ? Math.max(0, s1 - leerweg) * A1 / A2 : phase !== null ? hebtJeStoss : 0;
  const hoehe = hebung + Math.min(imStoss, hebtJeStoss);
  // Was der Pumpkolben anfangs verdrängt, drückt die Blase zusammen (bis auf ihr Volumen beim Arbeitsdruck)
  const blaseJetzt = blase ? Math.max(blasenVolumen(BLASE, P_LUFT, P_LUFT + r.druck), BLASE - Math.min(s1, leerweg) * A1) : 0;

  const versuche = [
    { name: "Auto anheben", idee: "Mit 150 N — so viel wie 15 kg — hebt der Wagenheber ein Auto von 1,2 t. Dafür muss man oft pumpen: Der kleine Kolben legt viel mehr Weg zurück.", los: () => { setD1(2); setD2(20); setMasse(1200); setHand(150); setBlase(false); setHebung(0); setStoesse(0); } },
    { name: "Zu schwach", idee: "Reicht die Handkraft nicht für den nötigen Druck, bewegt sich gar nichts. Ein dünnerer Pumpkolben hilft — dann braucht es aber mehr Stöße.", los: () => { setD1(4); setD2(20); setMasse(1200); setHand(150); setHebung(0); setStoesse(0); } },
    { name: "Luft in der Bremse", idee: "Luft lässt sich zusammendrücken, Öl nicht. Mit Blase geht ein Teil des Pedalwegs nur fürs Zusammendrücken drauf — die Bremse fühlt sich »weich« an.", los: () => { setD1(2); setD2(20); setMasse(1200); setHand(150); setBlase(true); setHebung(0); setStoesse(0); } },
  ];

  // Geometrie
  const kx = 300, gx = 680, oben = 150, boden = 400;
  const kb = 18 + d1 * 9, gb = Math.min(260, 40 + d2 * 5);
  const ky = oben + 30 + (s1 / HUB) * 90;
  const gy = boden - 110 - (hoehe / MAX_HEBUNG) * 120;
  const oel = "hsl(40 85% 55%)";

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 500" className="w-full h-auto select-none" role="img" aria-label="Hydraulischer Wagenheber">
          <line x1={0} y1={460} x2={1000} y2={460} stroke="#8d7b62" strokeWidth={3} />
          {/* Verbindung unten */}
          <rect x={kx - 10} y={boden} width={gx - kx + 20} height={30} fill={oel} stroke="#56616d" strokeWidth={3} />
          {blase && <circle cx={(kx + gx) / 2} cy={boden + 15} r={4 + 10 * Math.cbrt(blaseJetzt / BLASE)} fill="#ffffff" stroke="#9aa5b1" strokeWidth={2} />}
          {/* kleiner Zylinder */}
          <rect x={kx - kb / 2} y={ky} width={kb} height={boden - ky + 2} fill={oel} />
          <path d={`M${kx - kb / 2} ${oben} V${boden} M${kx + kb / 2} ${oben} V${boden}`} stroke="#56616d" strokeWidth={4} />
          <rect x={kx - kb / 2 + 2} y={ky - 14} width={kb - 4} height={14} fill="#8a949e" stroke="#4a545e" strokeWidth={2} />
          <line x1={kx} y1={ky - 14} x2={kx} y2={ky - 60} stroke="#4a545e" strokeWidth={6} />
          {/* Hand mit Kraftpfeil */}
          <line x1={kx} y1={ky - 120} x2={kx} y2={ky - 68} stroke={stark ? "#2e9e3e" : "#d64541"} strokeWidth={5} markerEnd="url(#pressPfeil)" />
          <Pille x={kx} y={ky - 132} t={`F₁ = ${zahl(hand, 0)} N`} farbe={stark ? "#2e9e3e" : "#d64541"} />
          {/* großer Zylinder */}
          <rect x={gx - gb / 2} y={gy} width={gb} height={boden - gy + 2} fill={oel} />
          <path d={`M${gx - gb / 2} ${oben + 60} V${boden} M${gx + gb / 2} ${oben + 60} V${boden}`} stroke="#56616d" strokeWidth={4} />
          <rect x={gx - gb / 2 + 2} y={gy - 16} width={gb - 4} height={16} fill="#8a949e" stroke="#4a545e" strokeWidth={2} />
          <rect x={gx - 8} y={gy - 70} width={16} height={54} fill="#8a949e" />
          {/* Auto */}
          <g transform={`translate(${gx} ${gy - 70})`}>
            <path d="M-150 -10 L-130 -50 L-50 -70 L60 -70 L110 -40 L150 -35 L150 -10 Z" fill="#c0392b" stroke="#6e1f17" strokeWidth={3} />
            <rect x={-40} y={-64} width={80} height={24} fill="#9ed8ff" />
            <circle cx={-95} cy={-6} r={20} fill="#222" /><circle cx={95} cy={-6} r={20} fill="#222" />
          </g>
          <Pille x={gx} y={gy - 180} t={`F₂ = ${zahl(last / 1000, 1)} kN (${zahl(masse, 0)} kg)`} />
          <Pille x={(kx + gx) / 2} y={boden - 30} t={`p = ${bar(r.druck, 1)} überall`} gross />
          <text x={kx} y={boden + 52} textAnchor="middle" fontSize={13} style={text}>A₁ = {zahl(A1 * 1e4, 1)} cm²</text>
          <text x={gx} y={boden + 52} textAnchor="middle" fontSize={13} style={text}>A₂ = {zahl(A2 * 1e4, 0)} cm²</text>
          {!stark && <text x={kx} y={oben - 10} textAnchor="middle" fontSize={14} fontWeight={700} fill="#d64541">zu wenig Kraft: nötig {zahl(r.kraft, 0)} N</text>}
          <text x={gx + gb / 2 + 12} y={gy} fontSize={13} style={muted}>gehoben: {zahl(hoehe * 100, 1)} cm</text>
          <defs><marker id="pressPfeil" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill={stark ? "#2e9e3e" : "#d64541"} /></marker></defs>
        </svg>
      }
      seite={<>
        <Karte>
          <button className="btn btn-primary" disabled={phase !== null || hebung >= MAX_HEBUNG} onClick={() => setPhase(0)}>⬇ Pumpstoß</button>
          <button className="btn btn-secondary" disabled={phase !== null || !stark} onClick={() => { setHebung(h => Math.min(MAX_HEBUNG, h + 10 * hebtJeStoss)); setStoesse(s => s + 10); }}>⏩ 10 Stöße auf einmal</button>
          <button className="btn btn-secondary" onClick={() => { setHebung(0); setStoesse(0); }}>⟲ Ablassen</button>
          <Regler label={`Handkraft F₁: ${zahl(hand, 0)} N`} min={10} max={500} step={5} wert={hand} setze={setHand} />
          <Regler label={`Pumpkolben: ⌀ ${zahl(d1, 1)} cm`} min={1} max={5} step={0.5} wert={d1} setze={setD1} />
          <Regler label={`Hubkolben: ⌀ ${zahl(d2, 0)} cm`} min={5} max={40} step={1} wert={d2} setze={setD2} />
          <Regler label={`Last: ${zahl(masse, 0)} kg`} min={100} max={2500} step={50} wert={masse} setze={setMasse} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={blase} onChange={e => setBlase(e.target.checked)} /> Luftblase in der Leitung (3 cm³)</label>
        </Karte>
        <Karte titel="F₁ : A₁ = F₂ : A₂">
          <Werte zeilen={[
            ["Druck p = F₂/A₂", bar(r.druck, 1)],
            ["nötige Kraft F₁ = p·A₁", `${zahl(r.kraft, 0)} N`],
            ["Übersetzung A₂/A₁", `${zahl(r.uebersetzung, 0)} : 1`],
            ["Weg je Stoß: klein / groß", `${zahl(HUB * 100, 0)} cm / ${zahl(hebtJeStoss * 1000, 1)} mm`],
            ...(blase ? [["davon für die Blase", `${zahl(leerweg * 100, 1)} cm`] as [string, string]] : []),
            ["Arbeit aufs Öl F₁·s₁", `${zahl(r.kraft * (HUB - leerweg), 1)} J`],
            ["= Hubarbeit F₂·s₂", `${zahl(last * hebtJeStoss, 1)} J`],
            ["Stöße bisher", String(stoesse)],
          ]} />
        </Karte>
      </>}
      unten={<Analogie>
        Die Presse tauscht Kraft gegen Weg — wie ein Transformator Spannung gegen Strom tauscht. Was hineingeht (F₁·s₁),
        kommt auch heraus (F₂·s₂); verstärkt wird nur die Kraft, nicht die Arbeit.
      </Analogie>}
    />
  );
}
