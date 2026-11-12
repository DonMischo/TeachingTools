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
import { Analogie, Karte, Pille, Regler, StationRahmen, Werte, bar, text, useTakt, zahl } from "./rahmen";
import { FARBE, KitDefs, Manometer, Rohr, useFliessen } from "./kit";

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
  const kolbenX = 630 + (weg / HUB) * 100;
  const BODEN = 330;
  const zeit = performance.now() / 1000;
  const abluft = Math.abs(s.fluss("abluft")) * 3e3;
  const tempo = (q: number) => (Math.abs(q) < 1e-6 ? 0 : Math.sign(q) * Math.min(160, 20 + Math.abs(q) * 3e5));
  const merke = useFliessen(() => new Map([
    ["rv", tempo(anlage.current!.sim.fluss("rv"))], ["regler", tempo(anlage.current!.sim.fluss("regler"))],
    ["regler2", tempo(anlage.current!.sim.fluss("regler"))], ["zu", tempo(anlage.current!.sim.fluss("zu"))],
  ]));

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 40 1000 350" className="w-full h-auto select-none" role="img" aria-label="Druckluftanlage mit Zylinder">
          <KitDefs />
          <defs>
            <linearGradient id="dlWand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dfe4e8" /><stop offset="1" stopColor="#c3cad0" /></linearGradient>
            <linearGradient id="dlRot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef6b5e" /><stop offset="0.5" stopColor="#d64541" /><stop offset="1" stopColor="#8e2a22" /></linearGradient>
            <linearGradient id="dlBlau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6fa8e8" /><stop offset="1" stopColor="#1d4f8f" /></linearGradient>
            <linearGradient id="dlHolz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c99a5b" /><stop offset="1" stopColor="#8a5d30" /></linearGradient>
          </defs>
          {/* Werkstatt: Wand, Boden */}
          <rect x={0} y={0} width={1000} height={BODEN} fill="url(#dlWand)" />
          <path d={Array.from({ length: 12 }, (_, i) => `M0 ${30 + i * 26} H1000`).join(" ")} stroke="#b5bdc4" strokeWidth={1} opacity={0.6} />
          <rect x={0} y={BODEN} width={1000} height={470 - BODEN} fill="#7d858c" />
          <path d={Array.from({ length: 11 }, (_, i) => `M${i * 100} ${BODEN} L${i * 100 - 40} 470`).join(" ")} stroke="#6a7279" strokeWidth={2} />
          <rect x={0} y={BODEN} width={1000} height={5} fill="#5d656c" />

          {/* Leitungen mit Luftbläschen */}
          <Rohr d={`M130 ${Y} H190`} w={10} fluessig={FARBE.luft} merke={merke("rv")} />
          <Rohr d={`M320 ${Y} H390`} w={10} fluessig={FARBE.luft} merke={merke("regler")} />
          <Rohr d={`M420 ${Y} H500`} w={10} fluessig={FARBE.luft} merke={merke("regler2")} />
          <Rohr d={`M550 ${Y} H630`} w={10} fluessig={FARBE.luft} merke={merke("zu")} />
          <g style={{ opacity: wd }}>
            {/* Kompressor: Motor, Riemen, Schwungrad */}
            <rect x={36} y={Y + 10} width={98} height={BODEN - Y - 10} rx={8} fill="url(#dlRot)" stroke="#7b241c" strokeWidth={2.5} filter="url(#kit-schatten)" />
            {Array.from({ length: 5 }, (_, i) => <line key={i} x1={48} y1={Y + 22 + i * 7} x2={122} y2={Y + 22 + i * 7} stroke="#7b241c" strokeWidth={2} opacity={0.6} />)}
            <rect x={50} y={Y - 34} width={44} height={44} rx={5} fill="url(#kit-metall)" stroke={FARBE.gehaeuse} strokeWidth={2} />
            {Array.from({ length: 4 }, (_, i) => <line key={i} x1={50} y1={Y - 26 + i * 9} x2={94} y2={Y - 26 + i * 9} stroke={FARBE.gehaeuse} strokeWidth={2} />)}
            <circle cx={116} cy={Y - 10} r={18} fill="#2f3740" />
            <g className={z.kompressor ? "animate-spin" : undefined} style={{ transformOrigin: `116px ${Y - 10}px`, animationDuration: "0.35s" }}>
              <circle cx={116} cy={Y - 10} r={15} fill="none" stroke="#c7cdd3" strokeWidth={3} />
              {[0, 60, 120].map(w => <line key={w} x1={116 - 15 * Math.cos(w * Math.PI / 180)} y1={Y - 10 - 15 * Math.sin(w * Math.PI / 180)} x2={116 + 15 * Math.cos(w * Math.PI / 180)} y2={Y - 10 + 15 * Math.sin(w * Math.PI / 180)} stroke="#c7cdd3" strokeWidth={2.5} />)}
            </g>
            <rect x={72} y={Y - 52} width={6} height={18} fill={FARBE.gehaeuse} />
            <circle cx={75} cy={Y - 58} r={9} fill="url(#kit-metall)" stroke={FARBE.gehaeuse} strokeWidth={1.5} />
            <text x={85} y={BODEN + 24} textAnchor="middle" fontSize={13} fontWeight={700} fill="#f2f4f6">Kompressor {z.kompressor ? "läuft" : "aus"}</text>
            {/* Kessel auf Füßen mit Manometer */}
            <rect x={180} y={Y - 45} width={150} height={90} rx={44} fill="url(#kit-metall)" stroke={FARBE.gehaeuse} strokeWidth={2.5} filter="url(#kit-schatten)" />
            <rect x={196} y={Y - 30} width={118} height={10} rx={5} fill="#fff" opacity={0.35} />
            {[205, 305].map(x => <path key={x} d={`M${x - 10} ${Y + 38} L${x - 14} ${BODEN} H${x + 14} L${x + 10} ${Y + 38}`} fill={FARBE.gehaeuse} />)}
            <text x={255} y={Y + 10} textAnchor="middle" fontSize={14} fontWeight={800} fill="#1f2a35">Kessel 20 L</text>
            <line x1={255} y1={Y - 45} x2={255} y2={Y - 62} stroke={FARBE.gehaeuse} strokeWidth={5} />
            <Manometer x={255} y={Y - 86} r={24} wert={pKessel / 1e5} max={10} />
            {/* Druckregler mit Drehknopf und Manometer */}
            <rect x={385} y={Y - 26} width={40} height={52} rx={6} fill="url(#dlBlau)" stroke="#123a6b" strokeWidth={2} filter="url(#kit-schatten)" />
            <rect x={393} y={Y - 44} width={24} height={18} rx={4} fill="#2f3740" />
            <path d={`M397 ${Y - 44} v18 M403 ${Y - 44} v18 M409 ${Y - 44} v18 M415 ${Y - 44} v18`} stroke="#56616d" strokeWidth={1.5} />
            <line x1={425} y1={Y - 12} x2={440} y2={Y - 12} stroke={FARBE.gehaeuse} strokeWidth={4} />
            <Manometer x={452} y={Y - 30} r={16} wert={pRegler / 1e5} max={10} />
            <text x={405} y={BODEN + 24} textAnchor="middle" fontSize={12} fontWeight={700} fill="#f2f4f6">Druckregler</text>
            {/* 3/2-Wegeventil mit Taster */}
            <g onClick={() => schalte(!ventil)} style={{ cursor: "pointer" }} role="button" aria-label="Ventil betätigen">
              <title>Ventil betätigen / entlüften</title>
              <rect x={490} y={Y - 24} width={70} height={48} rx={6} fill="url(#dlBlau)" stroke="#123a6b" strokeWidth={2} filter="url(#kit-schatten)" />
              <rect x={476} y={Y - 12} width={14} height={24} rx={3} fill={FARBE.gehaeuse} />
              <rect x={ventil ? 470 : 462} y={Y - 16} width={12} height={32} rx={5} fill={ventil ? FARBE.gruen : FARBE.rot} stroke="#2f3740" strokeWidth={1.5} style={{ transition: "x 0.15s" }} />
              <text x={525} y={Y + 5} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff">{ventil ? "Druck" : "Entl."}</text>
              <text x={525} y={BODEN + 24} textAnchor="middle" fontSize={12} fontWeight={700} fill="#f2f4f6">3/2-Ventil (klick)</text>
            </g>
            {/* Schalldämpfer mit Abluftwolke */}
            <rect x={519} y={Y + 24} width={12} height={16} rx={3} fill="#2f3740" />
            {!ventil && abluft > 0.02 && [0, 1, 2].map(k => {
              const t = (zeit + k / 3) % 1;
              return <circle key={k} cx={525 + (k - 1) * 8 * t} cy={Y + 44 + t * 30} r={4 + t * 14} fill="#fff" opacity={(1 - t) * 0.7 * Math.min(1, abluft)} />;
            })}
            {/* Drossel */}
            <circle cx={598} cy={Y} r={9} fill={FARBE.messing} stroke="#7a5f10" strokeWidth={2} />
            <line x1={598} y1={Y} x2={598} y2={Y - 18} stroke="#7a5f10" strokeWidth={4} strokeLinecap="round" />
          </g>
          {/* Zylinder im Schnitt: Luft, Kolben, Feder, Stange, Last */}
          <rect x={616} y={Y - 44} width={168} height={88} rx={8} fill="url(#kit-metall)" stroke={FARBE.gehaeuse} strokeWidth={2.5} filter="url(#kit-schatten)" />
          <rect x={622} y={Y - 36} width={156} height={72} fill="#2b2f33" />
          <rect x={622} y={Y - 36} width={Math.max(2, kolbenX - 622)} height={72} fill={`hsl(195 70% ${Math.round(80 - 35 * Math.min(1, pZyl / 8e5))}%)`} />
          {Array.from({ length: 10 }, (_, i) => (
            <circle key={i} cx={626 + ((i * 37 + zeit * 40 * (pZyl > 0.1e5 ? 1 : 0)) % Math.max(4, kolbenX - 630))} cy={Y - 28 + ((i * 23) % 56)} r={1.8 + Math.min(1, pZyl / 6e5)} fill="#fff" opacity={0.6} />
          ))}
          <path d={Array.from({ length: 9 }, (_, i) => `${i ? "L" : "M"}${kolbenX + 14 + (i * (778 - kolbenX - 14)) / 8} ${Y + (i % 2 ? -26 : 26)}`).join(" ")} fill="none" stroke="#c7cdd3" strokeWidth={3.5} />
          <rect x={kolbenX} y={Y - 36} width={14} height={72} rx={2} fill="url(#kit-metallQuer)" stroke={FARBE.gehaeuse} />
          <rect x={kolbenX + 14} y={Y - 6} width={166} height={12} fill="url(#kit-metall)" stroke={FARBE.gehaeuse} />
          <rect x={784} y={Y - 12} width={8} height={24} rx={2} fill={FARBE.gehaeuse} />
          {/* Last: Kiste auf Rollen */}
          <g filter="url(#kit-schatten)">
            <rect x={kolbenX + 180} y={BODEN - 92} width={74} height={80} rx={4} fill="url(#dlHolz)" stroke="#5c3a1a" strokeWidth={2.5} />
            <path d={`M${kolbenX + 180} ${BODEN - 92} l74 80 M${kolbenX + 254} ${BODEN - 92} l-74 80`} stroke="#5c3a1a" strokeWidth={2} opacity={0.5} />
            <circle cx={kolbenX + 196} cy={BODEN - 6} r={6} fill="#2f3740" /><circle cx={kolbenX + 238} cy={BODEN - 6} r={6} fill="#2f3740" />
          </g>
          <rect x={kolbenX + 176} y={Y - 6} width={6} height={12} fill={FARBE.gehaeuse} />
          <rect x={kolbenX + 192} y={BODEN - 62} width={50} height={20} rx={4} fill="#fff" opacity={0.9} />
          <text x={kolbenX + 217} y={BODEN - 47} textAnchor="middle" fontSize={13} fontWeight={800} fill="#3f2d1a">{zahl(e.last, 0)} N</text>
          <Pille x={720} y={Y - 64} t={`F = p·A = ${zahl(Math.max(0, pZyl) * A_KOLBEN, 0)} N · nötig ${zahl(FEDER + e.last, 0)} N`} />
          <Pille x={720} y={BODEN + 30} t={`Weg ${zahl(weg * 100, 1)} von ${HUB * 100} cm · Hübe ${z.huebe}`} />
          <Pille x={255} y={Y - 128} t={`Kessel ${bar(pKessel, 1)}`} gross />
          <Pille x={452} y={Y - 60} t={bar(pRegler, 1)} />

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
              <rect x={620} y={Y - 25} width={160} height={50} style={{ fill: "var(--surface)" }} />
              <line x1={kolbenX} y1={Y - 25} x2={kolbenX} y2={Y + 25} strokeWidth={5} />
              <line x1={kolbenX} y1={Y} x2={kolbenX + 180} y2={Y} strokeWidth={4} />
              <path d={Array.from({ length: 7 }, (_, i) => `${i ? "L" : "M"}${kolbenX + (i * (780 - kolbenX)) / 6} ${Y + (i % 2 ? -14 : 14)}`).join(" ")} strokeWidth={1.5} />
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
