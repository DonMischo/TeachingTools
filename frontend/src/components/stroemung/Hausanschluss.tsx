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
import { Analogie, Karte, Pille, Regler, StationRahmen, Werte, bar, muted, text, zahl } from "./rahmen";

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

  const yE = (i: number) => 440 - i * 100;
  const SX = 360;

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 520" className="w-full h-auto select-none" role="img" aria-label="Hausanschluss mit Stockwerken">
          {/* Erdreich und Haus */}
          <rect x={0} y={480} width={1000} height={40} fill="#8d7b62" opacity={0.5} />
          <rect x={0} y={400} width={260} height={120} fill="#8d7b62" opacity={0.35} />
          <text x={20} y={505} fontSize={12} style={text}>Straße: Versorgungsleitung 1,2 m tief (frostfrei)</text>
          {EBENEN.map((n, i) => (
            <g key={n}>
              <rect x={260} y={yE(i) - 60} width={680} height={100} fill="none" stroke="#a0a8b0" strokeWidth={3} />
              <text x={930} y={yE(i) - 42} textAnchor="end" fontSize={14} fontWeight={700} style={text}>{n}</text>
              <Pille x={SX - 50} y={yE(i) - 30} t={bar(r.ebene[i])} farbe={r.ebene[i] > 6e5 ? "#d64541" : "#e0a000"} />
            </g>
          ))}
          <path d={`M970 ${yE(3) - 60} L600 ${yE(3) - 130} L230 ${yE(3) - 60}`} fill="#b5523b" />
          {/* Anschlussleitung: Straße → Keller */}
          <path d={`M10 500 H200 V${yE(0) + 10} H${SX}`} fill="none" stroke="#7b8794" strokeWidth={12} />
          <path d={`M10 500 H200 V${yE(0) + 10} H${SX}`} fill="none" stroke="hsl(205 80% 55%)" strokeWidth={7} />
          {/* Wasserzähler, Rückflussverhinderer, Druckminderer */}
          <g>
            <circle cx={230} cy={yE(0) + 10} r={16} fill="#f2f4f6" stroke="#56616d" strokeWidth={3} />
            <text x={230} y={yE(0) + 15} textAnchor="middle" fontSize={12} fontWeight={700} fill="#2f3740">m³</text>
            <text x={230} y={yE(0) + 48} textAnchor="middle" fontSize={11} style={muted}>Zähler</text>
            <path d={`M264 ${yE(0)} V${yE(0) + 20} L284 ${yE(0) + 10} Z`} fill="#56616d" />
            <text x={274} y={yE(0) - 14} textAnchor="middle" fontSize={11} style={muted}>RV</text>
            <g onClick={() => set({ minderer: !e.minderer })} style={{ cursor: "pointer" }}>
              <rect x={300} y={yE(0) - 6} width={34} height={32} rx={5} fill={e.minderer ? "#2e9e3e" : "#8a949e"} stroke="#4a545e" strokeWidth={2} />
              <path d={`M305 ${yE(0) + 20} L329 ${yE(0)}`} stroke="#fff" strokeWidth={2.5} />
              <text x={317} y={yE(0) + 48} textAnchor="middle" fontSize={11} style={muted}>{e.minderer ? `DM ${bar(e.soll, 1)}` : "kein DM"}</text>
            </g>
          </g>
          {/* Steigleitung */}
          <path d={`M${SX} ${yE(0) + 10} V${yE(3)}`} fill="none" stroke="#7b8794" strokeWidth={10} />
          <path d={`M${SX} ${yE(0) + 10} V${yE(3)}`} fill="none" stroke="hsl(205 80% 55%)" strokeWidth={5} />
          {/* Zapfstellen */}
          {ZAPF.map(zp => {
            const n = ZAPF.filter(z => z.ebene === zp.ebene).indexOf(zp);
            const x = 470 + n * 230, y = yE(zp.ebene);
            const q = r.zapf[zp.id] * 60000;
            const auf = e.auf[zp.id];
            return (
              <g key={zp.id} onClick={() => umschalten(zp.id)} style={{ cursor: "pointer" }}>
                <line x1={SX} y1={y} x2={x} y2={y} stroke="#7b8794" strokeWidth={6} />
                <text x={x + 14} y={y + 6} fontSize={22}>{zp.icon}</text>
                <rect x={x - 8} y={y - 9} width={16} height={18} rx={3} fill={auf ? "#2e9e3e" : "#b03a2e"} />
                {auf && q > 0 && <path d={`M${x + 6} ${y + 10} q 6 ${10 + q} 2 ${14 + q * 1.4}`} fill="none" stroke="hsl(205 80% 60%)" strokeWidth={3 + q / 4} strokeLinecap="round" />}
                <text x={x + 44} y={y + 2} fontSize={13} style={text}>{zp.name}</text>
                <text x={x + 44} y={y + 18} fontSize={12} style={muted}>{auf ? lmin(q / 60000) : "zu"}</text>
              </g>
            );
          })}
          <Pille x={130} y={yE(0) - 60} t={`Netz ${bar(e.netz, 1)}`} />
          <Pille x={130} y={yE(0) - 30} t={`Zähler ${zahl(r.gesamt * 3.6, 2)} m³/h`} />
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
            ["Zähler", `${zahl(r.gesamt * 60000, 1)} L/min`],
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
