"use client";
/**
 * Station »Hausanschluss« (Technik): Versorgungsleitung, Wasserzähler,
 * Rückflussverhinderer, Druckminderer, Steigleitung durch vier Geschosse,
 * Zapfstellen. Gleichzeitiges Zapfen zieht den Druck herunter — die Dusche
 * oben wird schwach, wenn unten jemand spült.
 */
import { useMemo, useState } from "react";
import { Stroemung } from "@/lib/stroemung/loeser";
import type { Knoten, Teil } from "@/lib/stroemung/modell";
import { Analogie, Karte, Pille, Regler, StationRahmen, Werte, bar, zahl } from "./rahmen";
import { FARBE, Hahn, Handrad, KitDefs, Kulisse, Manometer, Muffe, Rohr, useFliessen } from "./kit";

interface Zapf { id: string; name: string; icon: string; ebene: number; nenn: number /* L/min bei 3 bar */ }
const ZAPF: Zapf[] = [
  { id: "garten", name: "Gartenschlauch", icon: "🌱", ebene: 0, nenn: 20 },
  { id: "wama", name: "Waschmaschine", icon: "🧺", ebene: 0, nenn: 12 },
  { id: "kueche", name: "Küche", icon: "🚰", ebene: 1, nenn: 8 },
  { id: "wc", name: "WC-Spülung", icon: "🚽", ebene: 1, nenn: 10 },
  { id: "bad", name: "Waschbecken", icon: "🪥", ebene: 2, nenn: 6 },
  { id: "dusche", name: "Dusche", icon: "🚿", ebene: 3, nenn: 12 },
];
const EBENEN = ["Keller", "EG", "1. OG", "2. OG"];
const Z = [0, 3, 6, 9];
const R_AUS = (nenn: number) => 3e5 / (nenn / 60000);
const lmin = (q: number) => `${zahl(q * 60000, 1)} L/min`;

interface Einstellung { netz: number; minderer: boolean; soll: number; auf: Record<string, boolean> }

function rechne(e: Einstellung) {
  const knoten: Knoten[] = [{ id: "s", z: -1.2 }, { id: "hz", z: 0 }, { id: "wz", z: 0 }, { id: "rf", z: 0 }, ...Z.map((z, i) => ({ id: `e${i}`, z }))];
  const teile: Teil[] = [
    { id: "netz", art: "druckquelle", a: "s", druck: e.netz },
    { id: "anschluss", art: "rohr", a: "s", b: "hz", laenge: 15, durchmesser: 0.025, turbulent: true },
    { id: "zaehler", art: "drossel", a: "hz", b: "wz", widerstand: 2.4e7 },
    { id: "rfv", art: "rueckschlag", a: "wz", b: "rf", widerstand: 1e6 },
    e.minderer
      ? { id: "dm", art: "druckminderer", a: "rf", b: "e0", druck: e.soll, widerstand: 5e6 }
      : { id: "dm", art: "drossel", a: "rf", b: "e0", widerstand: 5e6 },
    ...[1, 2, 3].map(i => ({ id: `steig${i}`, art: "rohr" as const, a: `e${i - 1}`, b: `e${i}`, laenge: 3.5, durchmesser: 0.013, turbulent: true })),
    ...ZAPF.map(zp => ({ id: zp.id, art: "auslass" as const, a: `e${zp.ebene}`, widerstand: e.auf[zp.id] ? R_AUS(zp.nenn) : Infinity })),
  ];
  const s = new Stroemung({ medium: "wasser", knoten, teile });
  s.schritt(0.01);
  return {
    ebene: Z.map((_, i) => s.druck(`e${i}`)),
    zapf: Object.fromEntries(ZAPF.map(zp => [zp.id, s.fluss(zp.id)])) as Record<string, number>,
    gesamt: s.fluss("zaehler"),
    vorMinderer: s.druck("rf"),
  };
}

const ZU: Record<string, boolean> = Object.fromEntries(ZAPF.map(z => [z.id, false]));

export default function Hausanschluss() {
  const [e, setE] = useState<Einstellung>({ netz: 5e5, minderer: true, soll: 3.5e5, auf: { ...ZU, dusche: true } });
  const set = (t: Partial<Einstellung>) => setE(a => ({ ...a, ...t }));
  const r = useMemo(() => rechne(e), [e]);
  const umschalten = (id: string) => set({ auf: { ...e.auf, [id]: !e.auf[id] } });
  const dusche = r.zapf.dusche * 60000;

  const versuche = [
    { name: "Unten wird gespült", idee: "Dusche oben läuft. Jetzt spült unten jemand, in Küche und Bad läuft Wasser: Durch Zähler, Druckminderer und Steigleitung fließt mehr — die Reibung frisst Druck, oben wird der Strahl dünn.", los: () => setE({ netz: 5e5, minderer: true, soll: 3.5e5, auf: { ...ZU, dusche: true, wc: true, kueche: true, bad: true, wama: true } }) },
    { name: "Ohne Druckminderer", idee: "Das Netz liefert hier 7 bar. Ohne Druckminderer liegen sie an jeder Armatur an — über 6 bar leiden Schläuche, Waschmaschine und Boiler. Der Druckminderer hält den Hausdruck fest, egal was das Netz macht.", los: () => setE({ netz: 7e5, minderer: false, soll: 3.5e5, auf: { ...ZU, dusche: true } }) },
    { name: "Schwaches Netz", idee: "Liefert das Netz weniger als den Sollwert, kann der Druckminderer nichts mehr regeln: Er steht ganz offen und gibt nur weiter, was ankommt.", los: () => setE({ netz: 2.5e5, minderer: true, soll: 3e5, auf: { ...ZU, dusche: true, kueche: true } }) },
  ];

  // Geometrie: Fußboden je Geschoss, Höhe der Abzweige, Steigleitung
  const boden = (i: number) => 470 - i * 100;
  const yA = (i: number) => boden(i) - 62;
  const SX = 470, LEITUNG = 440;
  const steigFluss = (i: number) => ZAPF.filter(z => z.ebene >= i).reduce((s, z) => s + r.zapf[z.id], 0) * 60000;
  const PXS = 7;   // px/s je L/min für die Bläschen
  const merke = useFliessen(() => new Map<string, number>([
    ["netz", r.gesamt * 60000 * PXS],
    ...[1, 2, 3].map(i => [`s${i}`, steigFluss(i) * PXS] as [string, number]),
    ...ZAPF.map(z => [z.id, r.zapf[z.id] * 60000 * PXS] as [string, number]),
  ]));
  const literMin = r.gesamt * 60000;

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 540" className="w-full h-auto select-none" role="img" aria-label="Hausanschluss mit Stockwerken">
          <KitDefs />
          <defs>
            <linearGradient id="haWand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6efe2" /><stop offset="1" stopColor="#e9dcc6" /></linearGradient>
            <linearGradient id="haKeller" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d2d6da" /><stop offset="1" stopColor="#b5bbc1" /></linearGradient>
            <pattern id="haFliesen" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#e8f1f6" /><path d="M0 0 H18 V18" fill="none" stroke="#c4d3dc" strokeWidth={1} /></pattern>
          </defs>
          <Kulisse breite={1000} hoehe={540} boden={372} />
          {/* Straße mit Gehweg */}
          <rect x={0} y={364} width={200} height={10} fill="#4a4f55" />
          <path d="M10 369 H40 M70 369 H100 M130 369 H160" stroke="#f2f2f2" strokeWidth={2} />
          <text x={12} y={356} fontSize={13} fontWeight={700} fill="#2f3740">Straße</text>
          <text x={12} y={528} fontSize={12} fill="#f2e6d6">Versorgungsleitung 1,2 m tief (frostfrei)</text>

          {/* Haus im Schnitt */}
          <path d={`M182 ${boden(3) - 100} L580 14 L978 ${boden(3) - 100} Z`} fill="#b5523b" stroke="#7d3424" strokeWidth={3} />
          {EBENEN.map((n, i) => (
            <g key={n}>
              <rect x={200} y={boden(i) - 100} width={760} height={100} fill={i === 0 ? "url(#haKeller)" : "url(#haWand)"} stroke="#a89a85" strokeWidth={3} />
              {i === 3 && <rect x={760} y={boden(i) - 100} width={200} height={100} fill="url(#haFliesen)" opacity={0.9} />}
              <rect x={194} y={boden(i)} width={772} height={8} fill="#9aa3ab" />
              <text x={950} y={boden(i) - 84} textAnchor="end" fontSize={14} fontWeight={800} fill="#3f2d1a">{n}</text>
            </g>
          ))}

          {/* Anschlussleitung: Straße → Keller, Armaturen, Steigleitung */}
          <Rohr d={`M0 505 H150 V${LEITUNG} H${SX}`} w={14} merke={merke("netz")} />
          <Rohr d={`M${SX} ${LEITUNG} V${yA(1)}`} w={11} merke={merke("s1")} />
          <Rohr d={`M${SX} ${yA(1)} V${yA(2)}`} w={11} merke={merke("s2")} />
          <Rohr d={`M${SX} ${yA(2)} V${yA(3)}`} w={11} merke={merke("s3")} />
          <Handrad x={236} y={LEITUNG - 30} offen={1} r={12} titel="Hauptabsperrung" />
          {/* Wasserzähler mit Flügelrad */}
          <g filter="url(#kit-schatten)">
            <rect x={270} y={LEITUNG - 16} width={50} height={32} rx={6} fill="url(#kit-metall)" stroke={FARBE.gehaeuse} strokeWidth={2} />
            <circle cx={295} cy={LEITUNG - 20} r={17} fill="#f4f7f9" stroke={FARBE.gehaeuse} strokeWidth={2.5} />
            <g style={{ transformOrigin: `295px ${LEITUNG - 20}px`, animation: literMin > 0.1 ? `spin ${Math.max(0.15, 30 / literMin)}s linear infinite` : undefined }}>
              {[0, 60, 120].map(a => <line key={a} x1={295 - 11 * Math.cos(a * Math.PI / 180)} y1={LEITUNG - 20 - 11 * Math.sin(a * Math.PI / 180)} x2={295 + 11 * Math.cos(a * Math.PI / 180)} y2={LEITUNG - 20 + 11 * Math.sin(a * Math.PI / 180)} stroke="#c0392b" strokeWidth={2.5} />)}
            </g>
            <text x={295} y={LEITUNG - 6} textAnchor="middle" fontSize={8} fontWeight={700} fill="#2f3740">m³</text>
          </g>
          {/* Rückflussverhinderer */}
          <rect x={340} y={LEITUNG - 13} width={34} height={26} rx={5} fill="url(#kit-metall)" stroke={FARBE.gehaeuse} strokeWidth={2} />
          <path d={`M349 ${LEITUNG - 7} L365 ${LEITUNG} L349 ${LEITUNG + 7} Z`} fill={FARBE.gehaeuse} />
          {/* Druckminderer: anklicken schaltet ihn ein und aus */}
          <g onClick={() => set({ minderer: !e.minderer })} style={{ cursor: "pointer" }} role="button" aria-label="Druckminderer ein/aus">
            <title>Druckminderer ein/aus</title>
            <rect x={392} y={LEITUNG - 17} width={44} height={34} rx={6} fill={e.minderer ? FARBE.messing : "#8a949e"} stroke={FARBE.gehaeuse} strokeWidth={2} />
            <rect x={404} y={LEITUNG - 42} width={20} height={25} rx={4} fill={e.minderer ? FARBE.messing : "#8a949e"} stroke={FARBE.gehaeuse} strokeWidth={2} />
            <path d={`M406 ${LEITUNG - 36} h16 M406 ${LEITUNG - 30} h16 M406 ${LEITUNG - 24} h16`} stroke={FARBE.gehaeuse} strokeWidth={1.5} />
          </g>
          <line x1={445} y1={LEITUNG} x2={445} y2={LEITUNG - 42} stroke={FARBE.gehaeuse} strokeWidth={4} />
          <Manometer x={445} y={LEITUNG - 58} r={16} wert={r.ebene[0] / 1e5} max={10} />
          {[[236, "Absperrung"], [295, "Zähler"], [357, "RV"], [414, e.minderer ? `DM ${bar(e.soll, 1)}` : "kein DM"]].map(([x, t]) => (
            <text key={t} x={x} y={LEITUNG + 28} textAnchor="middle" fontSize={11} fontWeight={700} fill="#3f4a55">{t}</text>
          ))}
          <Pille x={100} y={480} t={`Netz ${bar(e.netz, 1)}`} />
          <Pille x={100} y={414} t={`Zähler ${zahl(literMin, 1)} L/min`} />

          {/* Druck je Geschoss an der Steigleitung */}
          {[1, 2, 3].map(i => (
            <g key={i}>
              <line x1={SX} y1={yA(i)} x2={SX - 40} y2={yA(i)} stroke={FARBE.gehaeuse} strokeWidth={4} />
              <Manometer x={SX - 56} y={yA(i)} r={16} wert={r.ebene[i] / 1e5} max={10} />
              <Pille x={SX - 140} y={yA(i) + 5} t={bar(r.ebene[i])} farbe={r.ebene[i] > 6e5 ? "#d64541" : "#e0a000"} />
            </g>
          ))}
          <Pille x={SX - 140} y={boden(0) - 78} t={`Keller ${bar(r.ebene[0])}`} farbe={r.ebene[0] > 6e5 ? "#d64541" : "#e0a000"} />

          {/* Zapfstellen: Abzweig, Gerät, Hahn zum Anklicken */}
          {ZAPF.map(zp => {
            const n = ZAPF.filter(z => z.ebene === zp.ebene).indexOf(zp);
            const x = 590 + n * 190, y = yA(zp.ebene), fb = boden(zp.ebene);
            const q = r.zapf[zp.id] * 60000;
            const auf = e.auf[zp.id];
            const strahl = auf ? Math.min(1, q / 14) : 0;
            return (
              <g key={zp.id}>
                <Rohr d={`M${SX} ${y} H${x}`} w={8} merke={merke(zp.id)} />
                <Muffe x={SX} y={y} w={11} />
                {zp.id === "dusche"
                  ? <Dusche x={x} y={y} fb={fb} strahl={strahl} onClick={() => umschalten(zp.id)} />
                  : <Hahn x={x} y={y} offen={auf} strahl={zp.id === "wama" || zp.id === "wc" ? 0 : strahl} onClick={() => umschalten(zp.id)} titel={`${zp.name} auf/zu`} />}
                <Geraet id={zp.id} x={x} y={y} fb={fb} q={q} />
                <text x={x + 64} y={y - 12} fontSize={13} fontWeight={700} fill="#3f2d1a">{zp.name}</text>
                <text x={x + 64} y={y + 4} fontSize={12} fill={auf ? "#1f5f99" : "#8a7a65"}>{auf ? lmin(q / 60000) : "zu — anklicken"}</text>
              </g>
            );
          })}
        </svg>
      }
      seite={<>
        <Karte>
          <Regler label={`Netzdruck: ${bar(e.netz, 1)}`} min={2e5} max={8e5} step={0.1e5} wert={e.netz} setze={v => set({ netz: v })} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={e.minderer} onChange={ev => set({ minderer: ev.target.checked })} /> Druckminderer</label>
          {e.minderer && <Regler label={`Sollwert: ${bar(e.soll, 1)}`} min={2e5} max={5e5} step={0.1e5} wert={e.soll} setze={v => set({ soll: v })} />}
          <div className="flex flex-wrap gap-1">
            {ZAPF.map(zp => <button key={zp.id} className={`btn ${e.auf[zp.id] ? "btn-primary" : "btn-secondary"}`} onClick={() => umschalten(zp.id)}>{zp.icon} {zp.name}</button>)}
          </div>
        </Karte>
        <Karte titel="Messwerte">
          <Werte zeilen={[
            ["vor dem Druckminderer", bar(r.vorMinderer)],
            ...EBENEN.map((n, i) => [n, bar(r.ebene[i])] as [string, string]),
            ["Dusche", `${zahl(dusche, 1)} L/min ${e.auf.dusche ? (dusche < 8 ? "— schwach" : "— gut") : ""}`],
            ["Zähler", `${zahl(r.gesamt * 60000, 1)} L/min = ${zahl(r.gesamt * 3600, 2)} m³/h`],
          ]} />
          {Math.max(...r.ebene) > 6e5 && <p className="text-bad font-bold">Über 6 bar an den Armaturen — Schläuche und Geräte sind dafür nicht gebaut.</p>}
        </Karte>
      </>}
      unten={<Analogie>
        Der Druckminderer ist ein Spannungsregler: Er hält hinter sich eine feste Spannung, solange vorne mehr anliegt.
        Der Wasserzähler zählt wie der Stromzähler die durchgeflossene Menge, und der Rückflussverhinderer ist eine Diode —
        er lässt nur in eine Richtung durch, damit kein Hauswasser zurück ins Trinkwassernetz gelangt.
      </Analogie>}
    />
  );
}

/** Was an der Zapfstelle hängt: Eimer, Waschmaschine, Spüle, WC, Waschbecken. */
function Geraet({ id, x, y, fb, q }: { id: string; x: number; y: number; fb: number; q: number }) {
  const laeuft = q > 0.1;
  if (id === "garten") return (
    <g>
      <path d={`M${x + 22} ${fb - 30} L${x + 26} ${fb} H${x + 54} L${x + 58} ${fb - 30} Z`} fill="#3d8f5a" stroke="#2a6640" strokeWidth={2} />
      <path d={`M${x + 22} ${fb - 30} Q${x + 40} ${fb - 44} ${x + 58} ${fb - 30}`} fill="none" stroke="#2a6640" strokeWidth={2} />
      {laeuft && <ellipse cx={x + 40} cy={fb - 28} rx={15} ry={3} fill={FARBE.wasserHell} />}
    </g>
  );
  if (id === "wama") return (
    <g filter="url(#kit-schatten)">
      <path d={`M${x + 38} ${y + 10} V${y + 22}`} stroke="#56616d" strokeWidth={4} />
      <rect x={x + 10} y={y + 22} width={56} height={fb - y - 22} rx={4} fill="#f4f6f8" stroke="#8d97a0" strokeWidth={2} />
      <circle cx={x + 38} cy={(y + 22 + fb) / 2 + 2} r={13} fill="#cfe2ef" stroke="#8d97a0" strokeWidth={3} />
      <g className={laeuft ? "animate-spin" : undefined} style={{ transformOrigin: `${x + 38}px ${(y + 22 + fb) / 2 + 2}px`, animationDuration: "1.2s" }}>
        <path d={`M${x + 30} ${(y + 22 + fb) / 2 + 2} h16`} stroke="#3b9fe0" strokeWidth={3} strokeLinecap="round" />
      </g>
    </g>
  );
  if (id === "wc") return (
    <g filter="url(#kit-schatten)">
      <path d={`M${x + 36} ${y + 10} V${y + 14}`} stroke="#56616d" strokeWidth={4} />
      <rect x={x + 20} y={y + 14} width={36} height={22} rx={3} fill="#fbfbfb" stroke="#9aa5b1" strokeWidth={2} />
      {laeuft && <rect x={x + 23} y={y + 26} width={30} height={8} fill={FARBE.wasserHell} />}
      <path d={`M${x + 22} ${fb - 26} H${x + 62} Q${x + 60} ${fb - 8} ${x + 44} ${fb - 6} V${fb} H${x + 30} V${fb - 8} Q${x + 22} ${fb - 14} ${x + 22} ${fb - 26} Z`} fill="#fbfbfb" stroke="#9aa5b1" strokeWidth={2} />
      <path d={`M${x + 30} ${y + 36} V${fb - 26}`} stroke="#9aa5b1" strokeWidth={4} />
    </g>
  );
  if (id === "kueche") return (
    <g>
      <rect x={x + 6} y={y + 30} width={96} height={fb - y - 30} fill="#b98c5e" stroke="#7a5a3a" strokeWidth={2} />
      <rect x={x + 2} y={y + 26} width={104} height={6} fill="#5b6570" />
      <path d={`M${x + 22} ${y + 26} V${y + 40} H${x + 54} V${y + 26}`} fill="#cfd6dc" stroke="#7b8794" strokeWidth={2} />
    </g>
  );
  if (id === "bad") return (
    <g>
      <path d={`M${x + 14} ${y + 28} H${x + 64} Q${x + 62} ${y + 46} ${x + 39} ${y + 46} Q${x + 16} ${y + 46} ${x + 14} ${y + 28} Z`} fill="#fbfbfb" stroke="#9aa5b1" strokeWidth={2} />
      <rect x={x + 33} y={y + 46} width={12} height={fb - y - 46} fill="#f0f2f4" stroke="#9aa5b1" strokeWidth={1.5} />
    </g>
  );
  return null;
}

/** Dusche: Brausestange mit Kopf, Strahlen bis in die Wanne; Kopf oder Griff anklicken. */
function Dusche({ x, y, fb, strahl, onClick }: { x: number; y: number; fb: number; strahl: number; onClick: () => void }) {
  const kopfX = x + 36, kopfY = y - 24;
  return (
    <g onClick={onClick} style={{ cursor: "pointer" }} role="button" aria-label="Dusche auf/zu">
      <title>Dusche auf/zu</title>
      <rect x={x - 6} y={kopfY - 14} width={64} height={fb - kopfY + 14} fill="transparent" />
      <path d={`M${x} ${y} H${x + 14} V${kopfY} H${kopfX}`} fill="none" stroke={FARBE.metall} strokeWidth={5} strokeLinejoin="round" />
      <rect x={x + 6} y={y - 6} width={16} height={12} rx={3} fill={strahl > 0 ? FARBE.gruen : FARBE.rot} stroke={FARBE.gehaeuse} strokeWidth={1.5} />
      <path d={`M${kopfX - 12} ${kopfY + 4} H${kopfX + 12} L${kopfX + 6} ${kopfY - 4} H${kopfX - 6} Z`} fill="url(#kit-metall)" stroke={FARBE.gehaeuse} strokeWidth={1.5} />
      {strahl > 0.01 && [-9, -4.5, 0, 4.5, 9].map(d => (
        <line key={d} x1={kopfX + d * 0.8} y1={kopfY + 6} x2={kopfX + d * (1 + 1.5 * strahl)} y2={kopfY + 6 + (fb - kopfY - 12) * (0.35 + 0.65 * strahl)}
          stroke={FARBE.wasser} strokeWidth={1.5 + strahl * 1.5} strokeDasharray="5 4" opacity={0.85}>
          <animate attributeName="stroke-dashoffset" values="9;0" dur="0.3s" repeatCount="indefinite" />
        </line>
      ))}
      <rect x={kopfX - 26} y={fb - 8} width={52} height={8} rx={2} fill="#fbfbfb" stroke="#9aa5b1" strokeWidth={1.5} />
    </g>
  );
}
