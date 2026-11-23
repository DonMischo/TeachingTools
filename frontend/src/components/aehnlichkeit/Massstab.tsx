"use client";
/**
 * Maßstab: Umrechner Bild ↔ Wirklichkeit für Verkleinerungen (1 : 25 000) und
 * Vergrößerungen (10 : 1), dazu eine Inselkarte zum Nachmessen — zwei Orte
 * antippen, die Kartenstrecke in cm ablesen, in Kilometer umrechnen.
 */
import { useState } from "react";
import { imBild, inWirklichkeit, laengeText, MASSSTAEBE, massstabText, type Massstab as M } from "@/lib/aehnlichkeit";

const de = (x: number, s = 2) => x.toLocaleString("de-DE", { maximumFractionDigits: s });
const EINHEIT_CM: Record<string, number> = { mm: 0.1, cm: 1, m: 100, km: 100000 };

/** Orte auf der Insel in Karten-cm (x nach rechts, y nach unten) */
export const ORTE = [
  { name: "Hafenstadt", x: 2.5, y: 6.5 }, { name: "Leuchtturm", x: 1, y: 2.5 }, { name: "Bergdorf", x: 8, y: 2 },
  { name: "Mühlheim", x: 11, y: 6 }, { name: "Seeblick", x: 6.5, y: 7.5 }, { name: "Ostkap", x: 14.5, y: 4 },
];
const PX = 36; // Bildschirm-Pixel je Karten-cm (nur zur Anzeige)

function Insel({ m, wahl, setWahl }: { m: M; wahl: number[]; setWahl: (w: number[]) => void }) {
  const tippe = (i: number) => setWahl(wahl.length >= 2 ? [i] : wahl.includes(i) ? wahl : [...wahl, i]);
  const [a, b] = wahl.map(i => ORTE[i]);
  const cm = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${16 * PX} ${10 * PX}`} className="w-full rounded-xl" style={{ background: "#bfdbfe" }} role="img" aria-label="Inselkarte">
        <path d={`M ${0.4 * PX} ${3 * PX} C ${2 * PX} ${0.3 * PX}, ${9 * PX} ${0.2 * PX}, ${12 * PX} ${1.6 * PX} S ${15.8 * PX} ${3 * PX}, ${15.2 * PX} ${5 * PX} S ${12 * PX} ${9.4 * PX}, ${7 * PX} ${9 * PX} S ${0.6 * PX} ${8.6 * PX}, ${0.4 * PX} ${3 * PX} Z`}
          fill="#d9f99d" stroke="#65a30d" strokeWidth={3} />
        <path d={`M ${6.5 * PX} ${2.8 * PX} l ${1.5 * PX} ${-1.6 * PX} l ${1.5 * PX} ${1.6 * PX} Z`} fill="#a16207" opacity={0.6} />
        {a && b && <line x1={a.x * PX} y1={a.y * PX} x2={b.x * PX} y2={b.y * PX} stroke="#dc2626" strokeWidth={3} strokeDasharray="8 5" />}
        {ORTE.map((o, i) => (
          <g key={o.name} onClick={() => tippe(i)} style={{ cursor: "pointer" }} role="button" aria-label={o.name}>
            <circle cx={o.x * PX} cy={o.y * PX} r={9} fill={wahl.includes(i) ? "#dc2626" : "#1f2937"} stroke="white" strokeWidth={2} />
            <text x={o.x * PX + 12} y={o.y * PX - 8} fontSize={14} fontWeight={800} fill="#1f2937">{o.name}</text>
          </g>
        ))}
        {/* Maßstabsleiste: 2 cm */}
        <g transform={`translate(${11.5 * PX} ${9.3 * PX})`}>
          <rect x={0} y={0} width={PX} height={8} fill="#1f2937" /><rect x={PX} y={0} width={PX} height={8} fill="white" stroke="#1f2937" />
          <text x={0} y={-4} fontSize={11}>0</text><text x={2 * PX} y={-4} fontSize={11} textAnchor="end">{laengeText(inWirklichkeit(2, m))}</text>
        </g>
      </svg>
      {cm !== null ? (
        <p className="text-sm">Auf der Karte: <b>{de(cm, 1)} cm</b>. Bei {massstabText(m)}: {de(cm, 1)} cm · {de(m.echt / m.bild, 0)} = {de(inWirklichkeit(cm, m), 0)} cm = <b>{laengeText(inWirklichkeit(cm, m))}</b> Luftlinie.</p>
      ) : <p className="text-sm text-muted">Zwei Orte antippen, um ihre Entfernung zu messen. (Die Karte ist 16 cm breit gedacht.)</p>}
    </div>
  );
}

export default function Massstab() {
  const [m, setM] = useState<M>({ bild: 1, echt: 50000 });
  const [richtung, setRichtung] = useState<"echt" | "bild">("echt");
  const [wert, setWert] = useState("4");
  const [einheit, setEinheit] = useState("cm");
  const [wahl, setWahl] = useState<number[]>([0, 2]);
  const zahl = Number(wert.replace(",", "."));
  const cm = Number.isFinite(zahl) ? zahl * EINHEIT_CM[einheit] : NaN;
  const ergebnis = richtung === "echt" ? inWirklichkeit(cm, m) : imBild(cm, m);
  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">📏 Maßstab umrechnen</h3>
        <p className="text-sm text-muted max-w-3xl">Der Maßstab <b>Bild : Wirklichkeit</b> sagt, wie oft die Wirklichkeit größer ist als das Bild. 1 : 50 000 heißt: 1 cm auf der Karte sind 50 000 cm = 500 m in echt. 10 : 1 ist eine Vergrößerung — 10 mm im Bild sind 1 mm in echt.</p>
        <div className="flex flex-wrap gap-1.5">
          {MASSSTAEBE.map(x => <button key={x.wo} className={`chip ${x.m.bild === m.bild && x.m.echt === m.echt ? "chip-on" : ""}`} onClick={() => setM(x.m)}>{massstabText(x.m)} · {x.wo}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span>Maßstab</span>
          <input type="number" className="input w-24" min={1} value={m.bild} onChange={e => setM({ ...m, bild: Math.max(1, Number(e.target.value) || 1) })} aria-label="Bild" />
          <span>:</span>
          <input type="number" className="input w-36" min={1} value={m.echt} onChange={e => setM({ ...m, echt: Math.max(1, Number(e.target.value) || 1) })} aria-label="Wirklichkeit" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={`chip ${richtung === "echt" ? "chip-on" : ""}`} onClick={() => setRichtung("echt")}>Bild → Wirklichkeit</button>
          <button className={`chip ${richtung === "bild" ? "chip-on" : ""}`} onClick={() => setRichtung("bild")}>Wirklichkeit → Bild</button>
          <input className="input w-24" value={wert} onChange={e => setWert(e.target.value)} aria-label="Länge" />
          <select className="input w-20" value={einheit} onChange={e => setEinheit(e.target.value)}>{Object.keys(EINHEIT_CM).map(u => <option key={u}>{u}</option>)}</select>
          <span className="text-lg font-black">= {Number.isFinite(ergebnis) ? laengeText(ergebnis) : "?"}</span>
        </div>
        {Number.isFinite(ergebnis) && <p className="text-sm">Rechnung: {de(cm)} cm {richtung === "echt" ? `· ${de(m.echt)} : ${de(m.bild)}` : `· ${de(m.bild)} : ${de(m.echt)}`} = {de(ergebnis, 4)} cm</p>}
      </section>
      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">🗺️ Auf der Karte messen</h3>
        <Insel m={m.bild === 1 && m.echt >= 10000 ? m : { bild: 1, echt: 50000 }} wahl={wahl} setWahl={setWahl} />
      </section>
    </div>
  );
}
