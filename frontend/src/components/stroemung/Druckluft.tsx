"use client";
/**
 * Station »Druckluft« (Technik, Pneumatik): Kompressor mit Druckschalter,
 * Kessel, Druckregler, 3/2-Wegeventil mit Zu- und Abluftdrossel, einfach
 * wirkender Zylinder mit Rückstellfeder und Last. Läuft live (Luft, Löser).
 * Ein Regler blendet die Schaltzeichen nach DIN ISO 1219 über das Bild.
 */
import { useRef, useState } from "react";
import { A_KOLBEN, D_KOLBEN, Druckluft as Anlage, FEDER, HUB, type Einstellung } from "@/lib/stroemung/druckluft";
import { P_LUFT } from "@/lib/stroemung/modell";
import { Analogie, Karte, Pille, Regler, StationRahmen, Werte, bar, muted, text, useTakt, zahl } from "./rahmen";

export default function Druckluft() {
  const [e, setE] = useState<Einstellung>({ regler: 6e5, last: 400, zuluft: 50, abluft: 50 });
  const [raffer, setRaffer] = useState(5);
  const [mix, setMix] = useState(0);
  const anlage = useRef<Anlage | null>(null);
  if (!anlage.current) anlage.current = new Anlage(e);
  const a = anlage.current;
  useTakt(dt => a.laufe(Math.round(dt * raffer * 100) / 100));

  const anwenden = (neu: Einstellung) => { a.einstellen(neu); setE(neu); };
  const schalte = (auf: boolean) => { a.automatik = false; a.schalte(auf); };
  const setAutomatik = (an: boolean) => { a.automatik = an; };

  const s = a.sim;
  const ventil = a.ventil, automatik = a.automatik;
  const z = { kompressor: a.kompressor, huebe: a.huebe, verbrauch: a.verbrauch };
  const pKessel = a.kesselDruck, pRegler = s.druck("ar"), pZyl = s.druck("zy");
  const weg = a.weg;
  const noetig = (FEDER + e.last) / A_KOLBEN;
  const versuche = [
    { name: "Zylinder ausfahren", idee: "Ventil betätigen: Luft strömt durch die Zuluftdrossel in den Zylinder. Erst wenn p·A größer als Feder plus Last ist, fährt er aus.", los: () => { setAutomatik(false); schalte(true); } },
    { name: "Langsamer ausfahren", idee: "Die Drossel begrenzt den Luftstrom — so stellt man die Geschwindigkeit ein, ohne die Kraft zu ändern.", los: () => { setAutomatik(true); anwenden({ ...e, zuluft: 15 }); } },
    { name: "Zu schwere Last", idee: "Reicht der eingestellte Druck nicht (p < F/A), bewegt sich der Zylinder nicht, egal wie lange man wartet. Mehr Druck oder ein dickerer Kolben helfen.", los: () => { setAutomatik(false); anwenden({ ...e, last: 1200, regler: 5e5 }); schalte(true); } },
    { name: "Dauerbetrieb", idee: "Im Dauerbetrieb verbraucht jeder Hub Druckluft. Der Kessel leert sich, der Druckschalter startet den Kompressor bei 6 bar und stoppt ihn bei 8 bar.", los: () => { setAutomatik(true); setRaffer(10); } },
  ];

  // Geometrie
  const Y = 250;
  const wd = 1 - 0.85 * mix;
  const kolbenX = 700 + (weg / HUB) * 160;

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 470" className="w-full h-auto select-none" role="img" aria-label="Druckluftanlage mit Zylinder">
          {/* Leitungen */}
          <path d={`M130 ${Y} H600`} fill="none" stroke="#7b8794" strokeWidth={8} />
          <g style={{ opacity: wd }}>
            {/* Kompressor */}
            <rect x={40} y={Y - 50} width={90} height={100} rx={10} fill="#d64541" stroke="#7b241c" strokeWidth={3} />
            <circle cx={85} cy={Y} r={28} fill="#f2f4f6" stroke="#7b241c" strokeWidth={3} />
            <g style={{ transformOrigin: `85px ${Y}px` }} className={z.kompressor ? "animate-spin" : undefined}>
              <line x1={85} y1={Y - 22} x2={85} y2={Y + 22} stroke="#7b241c" strokeWidth={4} /><line x1={63} y1={Y} x2={107} y2={Y} stroke="#7b241c" strokeWidth={4} />
            </g>
            <text x={85} y={Y + 72} textAnchor="middle" fontSize={13} style={text}>Kompressor {z.kompressor ? "läuft" : "aus"}</text>
            {/* Kessel */}
            <rect x={180} y={Y - 45} width={150} height={90} rx={40} fill="#9aa5b1" stroke="#56616d" strokeWidth={3} />
            <text x={255} y={Y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#1f2a35">Kessel 20 L</text>
            {/* Druckregler */}
            <rect x={380} y={Y - 30} width={50} height={60} rx={6} fill="#f2f4f6" stroke="#56616d" strokeWidth={3} />
            <text x={405} y={Y + 5} textAnchor="middle" fontSize={20}>⚙️</text>
            <text x={405} y={Y + 55} textAnchor="middle" fontSize={12} style={muted}>Druckregler</text>
            {/* Wegeventil */}
            <g onClick={() => schalte(!ventil)} style={{ cursor: "pointer" }}>
              <rect x={490} y={Y - 32} width={70} height={64} rx={6} fill={ventil ? "#2e9e3e" : "#8a949e"} stroke="#4a545e" strokeWidth={3} />
              <text x={525} y={Y + 6} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">{ventil ? "Druck" : "Entl."}</text>
              <text x={525} y={Y + 55} textAnchor="middle" fontSize={12} style={muted}>3/2-Ventil (klick)</text>
            </g>
            {!ventil && <path d={`M525 ${Y + 32} v30`} stroke="#9aa5b1" strokeWidth={6} strokeDasharray="4 6" />}
          </g>
          {/* Zylinder mit Kolben, Feder und Last */}
          <rect x={620} y={Y - 40} width={200} height={80} rx={6} fill="#c7cdd3" stroke="#56616d" strokeWidth={3} />
          <rect x={620} y={Y - 36} width={Math.max(4, kolbenX - 620)} height={72} fill={`hsl(195 70% ${Math.round(85 - 30 * Math.min(1, pZyl / 8e5))}%)`} />
          <rect x={kolbenX} y={Y - 36} width={14} height={72} fill="#56616d" />
          <path d={Array.from({ length: 9 }, (_, i) => `${i ? "L" : "M"}${kolbenX + 14 + (i * (820 - kolbenX - 14)) / 8} ${Y + (i % 2 ? -24 : 24)}`).join(" ")} fill="none" stroke="#7b8794" strokeWidth={3} />
          <rect x={kolbenX + 14} y={Y - 6} width={190} height={12} fill="#8a949e" />
          <rect x={kolbenX + 204} y={Y - 50} width={60} height={100} rx={6} fill="#a0703c" stroke="#5c3a1a" strokeWidth={3} />
          <text x={kolbenX + 234} y={Y + 6} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">{zahl(e.last, 0)} N</text>
          <Pille x={720} y={Y - 60} t={`F = p·A = ${zahl(Math.max(0, pZyl) * A_KOLBEN, 0)} N · nötig ${zahl(FEDER + e.last, 0)} N`} />
          <Pille x={720} y={Y + 72} t={`Weg ${zahl(weg * 100, 1)} von ${HUB * 100} cm · Hübe ${z.huebe}`} />
          <Pille x={255} y={Y - 70} t={`Kessel ${bar(pKessel, 1)}`} gross />
          <Pille x={405} y={Y - 50} t={bar(pRegler, 1)} />

          {/* ── Schaltzeichen nach DIN ISO 1219 ── */}
          <g style={{ opacity: mix }} pointerEvents="none">
            <g style={{ stroke: "var(--text)" }} fill="none" strokeWidth={2.5}>
              {/* Kompressor: Kreis mit vollem Dreieck nach außen */}
              <circle cx={85} cy={Y} r={26} style={{ fill: "var(--surface)" }} />
              <path d={`M85 ${Y - 26} L75 ${Y - 8} L95 ${Y - 8} Z`} style={{ fill: "var(--text)" }} />
              {/* Rückschlagventil */}
              <circle cx={155} cy={Y} r={7} style={{ fill: "var(--surface)" }} /><path d={`M145 ${Y - 12} L162 ${Y} L145 ${Y + 12}`} />
              {/* Speicher: liegendes Langloch */}
              <rect x={190} y={Y - 22} width={130} height={44} rx={22} style={{ fill: "var(--surface)" }} />
              {/* Druckregler: Quadrat, Pfeil, Feder */}
              <rect x={385} y={Y - 25} width={40} height={50} style={{ fill: "var(--surface)" }} />
              <path d={`M405 ${Y + 20} V${Y - 18} M399 ${Y - 10} L405 ${Y - 20} L411 ${Y - 10}`} />
              <path d={`M425 ${Y - 10} l8 -6 l-8 -6 l8 -6`} />
              {/* 3/2-Wegeventil: zwei Felder, Taster links, Feder rechts */}
              <rect x={480} y={Y - 24} width={45} height={48} style={{ fill: ventil ? "rgba(46,158,62,0.25)" : "var(--surface)" }} />
              <rect x={525} y={Y - 24} width={45} height={48} style={{ fill: ventil ? "var(--surface)" : "rgba(46,158,62,0.25)" }} />
              <path d={`M490 ${Y + 18} L515 ${Y - 18} M509 ${Y - 18} L515 ${Y - 18} L515 ${Y - 12}`} />
              <path d={`M547 ${Y + 18} V${Y - 2} M541 ${Y - 2} H553 M535 ${Y - 18} L560 ${Y + 18}`} />
              <path d={`M470 ${Y - 10} H480 M470 ${Y + 10} H480 M470 ${Y - 10} V${Y + 10}`} />
              <path d={`M570 ${Y} l8 -6 l-8 -6 l8 -6`} />
              {/* Drossel: zwei Bögen */}
              <path d={`M590 ${Y - 12} q8 12 0 24 M606 ${Y - 12} q-8 12 0 24`} />
              {/* Zylinder einfach wirkend mit Feder */}
              <rect x={620} y={Y - 25} width={200} height={50} style={{ fill: "var(--surface)" }} />
              <line x1={kolbenX} y1={Y - 25} x2={kolbenX} y2={Y + 25} strokeWidth={5} />
              <line x1={kolbenX} y1={Y} x2={kolbenX + 210} y2={Y} strokeWidth={4} />
              <path d={Array.from({ length: 7 }, (_, i) => `${i ? "L" : "M"}${kolbenX + (i * (820 - kolbenX)) / 6} ${Y + (i % 2 ? -14 : 14)}`).join(" ")} strokeWidth={1.5} />
            </g>
            <text x={85} y={Y + 72} textAnchor="middle" fontSize={13} style={text}>Verdichter</text>
            <text x={255} y={Y + 46} textAnchor="middle" fontSize={13} style={text}>Speicher</text>
            <text x={525} y={Y + 46} textAnchor="middle" fontSize={13} style={text}>3/2-Wegeventil</text>
            <text x={598} y={Y + 30} textAnchor="middle" fontSize={12} style={text}>Drossel</text>
          </g>
        </svg>
      }
      seite={<>
        <Karte>
          <div className="flex flex-wrap gap-2">
            <button className={`btn ${ventil ? "btn-primary" : "btn-secondary"}`} onClick={() => schalte(!ventil)}>{ventil ? "⬅ Entlüften" : "➡ Ventil betätigen"}</button>
            <button className={`btn ${automatik ? "btn-primary" : "btn-secondary"}`} onClick={() => setAutomatik(!automatik)}>🔁 Dauerbetrieb</button>
          </div>
          <Regler label={`Druckregler: ${bar(e.regler, 1)}`} min={1e5} max={7e5} step={0.1e5} wert={e.regler} setze={v => anwenden({ ...e, regler: v })} />
          <Regler label={`Last: ${zahl(e.last, 0)} N`} min={0} max={1500} step={20} wert={e.last} setze={v => anwenden({ ...e, last: v })} />
          <Regler label={`Zuluftdrossel: ${e.zuluft} % offen`} min={5} max={100} step={5} wert={e.zuluft} setze={v => anwenden({ ...e, zuluft: v })} />
          <Regler label={`Abluftdrossel: ${e.abluft} % offen`} min={5} max={100} step={5} wert={e.abluft} setze={v => anwenden({ ...e, abluft: v })} />
          <Regler label={`Zeitraffer: ×${raffer}`} min={1} max={20} step={1} wert={raffer} setze={setRaffer} />
          <label className="flex items-center gap-2 font-bold">🖼️ <input type="range" min={0} max={1} step={0.01} value={mix} onChange={ev => setMix(Number(ev.target.value))} className="flex-1" aria-label="Schaltzeichen einblenden" /> DIN ISO 1219</label>
        </Karte>
        <Karte titel="Messwerte">
          <Werte zeilen={[
            ["Kessel", bar(pKessel, 2)],
            ["hinter dem Regler", bar(pRegler, 2)],
            ["im Zylinder", bar(pZyl, 2)],
            ["nötig: (Feder + Last) / A", bar(noetig, 2)],
            ["Kolben ⌀ / Fläche", `${D_KOLBEN * 100} cm / ${zahl(A_KOLBEN * 1e4, 1)} cm²`],
            ["Luft je Hub (bei Reglerdruck)", `${zahl(A_KOLBEN * HUB * (P_LUFT + e.regler) / P_LUFT * 1000, 1)} Normliter`],
            ["Luft verbraucht", `${zahl(z.verbrauch * 1000, 0)} Normliter`],
          ]} />
        </Karte>
      </>}
      unten={<Analogie>
        Der Kessel ist ein Akku, den der Kompressor wie ein Ladegerät mit Zweipunktregler nachlädt (an bei 6, aus bei 8 bar).
        Der Druckregler ist ein Spannungsregler, das 3/2-Ventil ein Umschalter, die Drossel ein einstellbarer Widerstand, der
        die Geschwindigkeit bestimmt — die Kraft am Kolben (p·A) bestimmt dagegen der Druck, wie beim Motor die Spannung.
      </Analogie>}
    />
  );
}
