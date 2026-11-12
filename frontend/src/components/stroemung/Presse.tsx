"use client";
/**
 * Station »Hydraulische Presse«: Wagenheber wie in der Werkstatt. Den Pumphebel
 * zieht man selbst auf und ab: hinauf saugt der Pumpkolben Öl aus dem Vorrat
 * (Saugventil), hinunter drückt er es in den Hubzylinder (Druckventil).
 * Pascal: überall derselbe Druck ⇒ F₁/A₁ = F₂/A₂; der Hebel verstärkt die Hand
 * noch einmal 8-fach. Ablassventil auf: Das Öl läuft zurück, das Auto sinkt.
 * Modell: lib/stroemung/wagenheber.ts.
 */
import { useRef, useState } from "react";
import { G } from "@/lib/stroemung/modell";
import { HEBEL, HUB, MAX_HEBUNG, Wagenheber, kreis, type Einstellung } from "@/lib/stroemung/wagenheber";
import { FARBE, GlasTank, Handrad, KitDefs, Manometer, Rohr, Muffe, useFliessen } from "./kit";
import { Analogie, Karte, Pille, Regler, StationRahmen, Werte, bar, useTakt, zahl } from "./rahmen";

const OEL = FARBE.oel;
const DREH = { x: 380, y: 235 };        // Drehpunkt des Hebels
const KURZ = 60, LANG = 260;            // Hebelarme in px (Bild); gerechnet wird mit HEBEL
const ALPHA = 0.55;                     // halber Schwenkbereich (rad)
const KOLBEN_X = DREH.x - KURZ;

export default function Presse() {
  const [e, setE] = useState<Einstellung>({ d1: 0.03, d2: 0.12, last: 1200 * G, hand: 150, blase: false });
  const [ablass, setAblass] = useState(false);
  const [auto, setAuto] = useState<number | null>(null);     // Pumpstöße, die noch automatisch laufen
  const w = useRef<Wagenheber | null>(null);
  if (!w.current) w.current = new Wagenheber(e);
  const h = w.current;
  const greift = useRef<boolean>(false);
  const svg = useRef<SVGSVGElement>(null);
  const tempo = useRef({ saug: 0, druck: 0, rueck: 0 });
  const phase = useRef(0);

  const setze = (t: Partial<Einstellung>) => {
    const n = { ...e, ...t };
    if (t.d2 !== undefined && t.d2 !== e.d2) w.current = new Wagenheber(n); else h.einstellen(n);
    setE(n);
  };

  // Hebel → Kolbenweg und zurück
  const sinVon = (s: number) => -Math.sin(ALPHA) + (s / HUB) * 2 * Math.sin(ALPHA);
  const bewege = (sNeu: number, dt: number) => {
    const vorher = h.s;
    h.bewege(sNeu);
    const v = ((h.s - vorher) * h.A1 * 60000) / Math.max(dt, 1e-3);     // L/min
    tempo.current = { saug: h.saugt ? -v * 40 : 0, druck: h.drueckt ? v * 40 : 0, rueck: tempo.current.rueck };
  };

  useTakt(dt => {
    if (ablass) {
      const vorher = h.hebung;
      h.ablassen(dt);
      tempo.current.rueck = vorher > h.hebung ? 160 : 0;
    } else tempo.current.rueck = 0;
    if (auto !== null && !greift.current) {
      phase.current += dt / 0.7;
      const p = phase.current % 1;
      bewege(HUB * (p < 0.5 ? p * 2 : 2 - p * 2), dt);
      if (phase.current >= auto) { setAuto(null); phase.current = 0; bewege(0, dt); }
    }
    if (!greift.current && auto === null) tempo.current.saug = tempo.current.druck = 0;
  });
  const merke = useFliessen(() => new Map([["saug", tempo.current.saug], ["druck", tempo.current.druck], ["rueck", tempo.current.rueck]]));

  const zeiger = (ev: React.PointerEvent) => {
    if (!greift.current || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const y = ((ev.clientY - r.top) / r.height) * 520;   // viewBox-Höhe
    const sinT = Math.max(-Math.sin(ALPHA), Math.min(Math.sin(ALPHA), (y - DREH.y) / LANG));
    bewege(((sinT + Math.sin(ALPHA)) / (2 * Math.sin(ALPHA))) * HUB, 1 / 60);
  };

  // Geometrie aus dem Zustand
  const sinT = sinVon(h.s), cosT = Math.sqrt(1 - sinT * sinT);
  const griff = { x: DREH.x - LANG * cosT, y: DREH.y + LANG * sinT };
  const anlenk = { x: DREH.x - KURZ * cosT, y: DREH.y + KURZ * sinT };
  const kolbenY = anlenk.y + 70;                         // 268 … 336                          // Oberkante Pumpkolben
  const kb = 26 + e.d1 * 500;                              // Breite Pumpzylinder in px
  const gb = Math.min(190, 40 + e.d2 * 500);              // Breite Hubzylinder in px
  const GX = 720, BODEN = 440;
  const ramY = 300 - (h.hebung / MAX_HEBUNG) * 150;
  const kapazitaet = 1.15 * kreis(e.d2) * MAX_HEBUNG;
  const pAnzeige = h.drueckt || h.blockiert || h.hebung > 0 ? h.druck : 0;
  const masse = e.last / G;

  const versuche = [
    { name: "Auto anheben", idee: "Zieh den Hebel auf und ab! Hinauf saugt der kleine Kolben Öl aus dem Vorrat, hinunter drückt er es unter das Auto. 150 N an der Hand heben 1,2 t — Hebel und Kolben verstärken die Kraft.", los: () => { setze({ d1: 0.03, d2: 0.12, last: 1200 * G, hand: 150, blase: false }); } },
    { name: "Zu schwer", idee: "Reicht die Kraft am Kolben nicht für p·A₁, lässt sich der Hebel nicht hinunterdrücken. Ein dünnerer Pumpkolben hilft — dann braucht es mehr Stöße.", los: () => setze({ last: 3000 * G }) },
    { name: "Luft im System", idee: "Mit Luftblase federt der Hebel: Ein Teil jedes Stoßes drückt nur die Luft zusammen, und hinauf dehnt sie sich wieder aus. So fühlt sich eine Bremse mit Luft an.", los: () => setze({ last: 1200 * G, blase: true }) },
    { name: "Ablassen", idee: "Das Ablassventil öffnet den Rückweg: Das Auto drückt das Öl in den Vorrat zurück. Das Öl geht nie verloren — es wandert nur hin und her.", los: () => setAblass(true) },
  ];

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg ref={svg} viewBox="0 0 1000 520" className="w-full h-auto select-none touch-none" role="img" aria-label="Hydraulischer Wagenheber"
          onPointerMove={zeiger} onPointerUp={() => { greift.current = false; }} onPointerLeave={() => { greift.current = false; }}>
          <KitDefs />
          <defs>
            <linearGradient id="werkstatt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9d2c5" /><stop offset="1" stopColor="#b9b0a0" /></linearGradient>
            <pattern id="fliesen" width="60" height="30" patternUnits="userSpaceOnUse"><rect width="60" height="30" fill="#8d8f93" /><path d="M0 0 H60 M0 0 V30" stroke="#6f7176" strokeWidth={2} /></pattern>
          </defs>
          <rect width={1000} height={470} fill="url(#werkstatt)" />
          <rect y={470} width={1000} height={50} fill="url(#fliesen)" />

          {/* Vorratsbehälter */}
          <GlasTank x={40} y={250} breite={95} hoehe={170} fuell={h.vorrat / kapazitaet} farbe={OEL} wirbel={0.15} />
          <Pille x={88} y={205} t={`Vorrat ${zahl(h.vorrat * 1000, 2)} L`} />

          {/* Leitungen: Saugleitung, Druckleitung, Rücklauf */}
          <Rohr d={`M88 420 V455 H${KOLBEN_X} V430`} w={12} fluessig={OEL} merke={merke("saug")} />
          <Rohr d={`M${KOLBEN_X} 430 V445 H${GX - 20}`} w={12} fluessig={OEL} merke={merke("druck")} />
          <Rohr d={`M${GX + 20} ${BODEN + 4} V495 H160 V230 H110 V250`} w={10} fluessig={OEL} merke={merke("rueck")} />
          <Muffe x={KOLBEN_X} y={445} w={12} />

          {/* Rückschlagventile (Kugel im Sitz): hebt sich, solange Öl hindurchfließt */}
          {[{ x: 200, y: 455, offen: h.saugt, name: "Saugventil" }, { x: 480, y: 445, offen: h.drueckt, name: "Druckventil" }].map(v => (
            <g key={v.name}>
              <rect x={v.x - 22} y={v.y - 18} width={44} height={36} rx={8} fill="url(#kit-metall)" stroke={FARBE.gehaeuse} strokeWidth={2} />
              <path d={`M${v.x - 8} ${v.y + 12} L${v.x} ${v.y + 2} L${v.x + 8} ${v.y + 12}`} fill="none" stroke={FARBE.gehaeuse} strokeWidth={2.5} />
              <circle cx={v.x} cy={v.y - (v.offen ? 8 : 0)} r={6} fill={v.offen ? FARBE.gruen : "#56616d"} style={{ transition: "cy 0.12s" }} />
              <text x={v.x} y={v.y + 34} textAnchor="middle" fontSize={12} fill="#3f4a55">{v.name}</text>
            </g>
          ))}

          {/* Pumpzylinder mit Kolben */}
          <rect x={KOLBEN_X - kb / 2 - 6} y={262} width={kb + 12} height={173} rx={6} fill="url(#kit-metallQuer)" stroke={FARBE.gehaeuse} strokeWidth={2} />
          <rect x={KOLBEN_X - kb / 2} y={268} width={kb} height={163} fill="#2b2f33" />
          <rect x={KOLBEN_X - kb / 2} y={kolbenY + 10} width={kb} height={431 - kolbenY - 10} fill={OEL} />
          {h.blase > 0 && <circle cx={KOLBEN_X} cy={kolbenY + 26} r={3 + 9 * Math.cbrt(h.blase / 2e-6)} fill="#fff" fillOpacity={0.85} stroke="#9aa5b1" />}
          <rect x={KOLBEN_X - kb / 2} y={kolbenY} width={kb} height={10} fill="#8a949e" />
          <line x1={KOLBEN_X} y1={kolbenY} x2={anlenk.x} y2={anlenk.y} stroke="#56616d" strokeWidth={7} strokeLinecap="round" />

          {/* Pumphebel zum Ziehen */}
          <rect x={DREH.x - 8} y={DREH.y} width={16} height={205} fill="url(#kit-metallQuer)" stroke={FARBE.gehaeuse} />
          <line x1={DREH.x} y1={DREH.y} x2={griff.x} y2={griff.y} stroke="#2f3740" strokeWidth={11} strokeLinecap="round" />
          <circle cx={DREH.x} cy={DREH.y} r={8} fill={FARBE.messing} stroke="#7a5f10" strokeWidth={2} />
          <g onPointerDown={ev => { greift.current = true; setAuto(null); try { (ev.target as Element).setPointerCapture(ev.pointerId); } catch { /* Zeiger schon weg */ } }} style={{ cursor: "ns-resize" }}>
            <circle cx={griff.x} cy={griff.y} r={30} fill="transparent" />
            <rect x={griff.x - 10} y={griff.y - 24} width={20} height={48} rx={9} fill={h.blockiert ? "#d64541" : "#e0a000"} stroke="#7a5f10" strokeWidth={2} />
          </g>
          <text x={griff.x} y={griff.y - 32} textAnchor="middle" fontSize={13} fontWeight={700} fill="#2f3740">↕ ziehen</text>
          {h.blockiert && <text x={griff.x + 30} y={griff.y + 50} fontSize={14} fontWeight={700} fill="#c0392b">zu schwer — nötig {zahl(h.noetigeHand, 0)} N</text>}
          <Pille x={830} y={500} t={`Hand ${zahl(e.hand, 0)} N × Hebel ${HEBEL} = ${zahl(h.kolbenkraft, 0)} N am Kolben`} />

          {/* Manometer an der Druckleitung */}
          <line x1={560} y1={445} x2={560} y2={392} stroke={FARBE.gehaeuse} strokeWidth={5} />
          <Manometer x={560} y={366} r={26} wert={pAnzeige / 1e5} max={Math.max(10, Math.ceil(h.druck / 1e5 / 10) * 10 + 10)} />
          <Pille x={560} y={320} t={`p = ${bar(pAnzeige, 1)}`} gross />

          {/* Hubzylinder mit Kolbenstange und Auto */}
          <rect x={GX - gb / 2 - 8} y={290} width={gb + 16} height={BODEN - 286} rx={6} fill="url(#kit-metallQuer)" stroke={FARBE.gehaeuse} strokeWidth={2} />
          <rect x={GX - gb / 2} y={ramY} width={gb} height={BODEN - ramY} fill={OEL} opacity={0.9} />
          <rect x={GX - 14} y={ramY - 110} width={28} height={110} fill="url(#kit-metallQuer)" />
          <rect x={GX - 120} y={ramY - 120} width={240} height={12} rx={3} fill="#4b5563" />
          <g transform={`translate(${GX} ${ramY - 120})`}>
            <path d="M-170 -12 L-150 -52 L-60 -74 L55 -74 L115 -44 L170 -38 L172 -12 Z" fill="#b83a2f" stroke="#5e1d17" strokeWidth={3} />
            <path d="M-50 -66 L48 -66 L92 -44 L-60 -44 Z" fill="#a9dcff" stroke="#5e1d17" strokeWidth={2} />
            <rect x={-170} y={-20} width={342} height={6} fill="#8e2b23" />
            {[-110, 110].map(x => <g key={x}><circle cx={x} cy={-10} r={24} fill="#1f1f1f" /><circle cx={x} cy={-10} r={10} fill="#9aa5b1" /></g>)}
          </g>
          <Pille x={GX} y={ramY - 230} t={`F₂ = ${zahl(e.last / 1000, 1)} kN (${zahl(masse, 0)} kg)`} />
          <text x={GX + gb / 2 + 16} y={ramY + 6} fontSize={14} fontWeight={700} fill="#2f3740">↑ {zahl(h.hebung * 100, 1)} cm</text>
          <text x={GX} y={BODEN + 22} textAnchor="middle" fontSize={13} fill="#2f3740">A₂ = {zahl(h.A2 * 1e4, 0)} cm²</text>
          <text x={KOLBEN_X + kb / 2 + 34} y={300} textAnchor="middle" fontSize={13} fill="#2f3740">A₁ = {zahl(h.A1 * 1e4, 1)} cm²</text>

          {/* Ablassventil */}
          <Handrad x={420} y={482} r={14} offen={ablass ? 1 : 0} onClick={() => setAblass(a => !a)} titel={ablass ? "Ablassventil schließen" : "Ablassventil öffnen"} />
          <text x={445} y={487} fontSize={12} fill="#3f4a55">Ablassventil {ablass ? "offen" : "zu"}</text>
        </svg>
      }
      seite={<>
        <Karte>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={auto !== null} onClick={() => { phase.current = 0; setAblass(false); setAuto(1); }}>⬇ Pumpstoß</button>
            <button className="btn btn-secondary" disabled={auto !== null} onClick={() => { phase.current = 0; setAblass(false); setAuto(10); }}>⏩ 10 Stöße</button>
            <button className={`btn ${ablass ? "btn-primary" : "btn-secondary"}`} onClick={() => setAblass(a => !a)}>🔧 Ablassen</button>
          </div>
          <Regler label={`Handkraft: ${zahl(e.hand, 0)} N`} min={20} max={400} step={10} wert={e.hand} setze={v => setze({ hand: v })} />
          <Regler label={`Pumpkolben: ⌀ ${zahl(e.d1 * 100, 1)} cm`} min={1} max={6} step={0.5} wert={e.d1 * 100} setze={v => setze({ d1: v / 100 })} />
          <Regler label={`Hubkolben: ⌀ ${zahl(e.d2 * 100, 0)} cm`} min={6} max={30} step={1} wert={e.d2 * 100} setze={v => setze({ d2: v / 100 })} />
          <Regler label={`Last: ${zahl(masse, 0)} kg`} min={100} max={3000} step={50} wert={masse} setze={v => setze({ last: v * G })} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={e.blase} onChange={ev => setze({ blase: ev.target.checked })} /> Luftblase in der Pumpkammer</label>
        </Karte>
        <Karte titel="Pascal: F₁ : A₁ = F₂ : A₂">
          <Werte zeilen={[
            ["Druck p = F₂ / A₂", bar(h.druck, 1)],
            ["Kolbenkraft nötig p·A₁", `${zahl(h.druck * h.A1, 0)} N`],
            ["Handkraft nötig (÷ Hebel)", `${zahl(h.noetigeHand, 0)} N`],
            ["Übersetzung A₂ / A₁", `${zahl(h.A2 / h.A1, 0)} : 1`],
            ["je Stoß: Kolben / Auto", `${zahl(HUB * 100, 0)} cm / ${zahl((HUB * h.A1 / h.A2) * 1000, 1)} mm`],
            ["Stöße", String(h.stoesse)],
            ["Öl: Vorrat + Zylinder", `${zahl(h.vorrat * 1000, 2)} + ${zahl(h.hebung * h.A2 * 1000, 2)} L`],
          ]} />
        </Karte>
      </>}
      unten={<Analogie>
        Die Presse tauscht Kraft gegen Weg — wie ein Transformator Spannung gegen Strom tauscht. Was hineingeht (F₁·s₁),
        kommt auch heraus (F₂·s₂); verstärkt wird nur die Kraft, nicht die Arbeit. Und wie die Ladung im Stromkreis
        geht auch das Öl nie verloren: Es wandert vom Vorrat in den Zylinder und wieder zurück.
      </Analogie>}
    />
  );
}
