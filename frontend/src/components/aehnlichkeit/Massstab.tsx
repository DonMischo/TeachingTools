"use client";
/**
 * Maßstab: Umrechner Bild ↔ Wirklichkeit für Verkleinerungen (1 : 25 000) und
 * Vergrößerungen (10 : 1), dazu je Maßstab ein passendes Beispielbild zum Nachmessen —
 * antippen, die Kartenstrecke in cm ablesen, in Kilometer umrechnen.
 */
import { useState } from "react";
import { imBild, inWirklichkeit, laengeText, MASSSTAEBE, massstabText, type Massstab as M } from "@/lib/aehnlichkeit";
import { BEISPIELE, BeispielBild, beispielFuer, type Beispiel } from "./Beispiele";

const de = (x: number, s = 2) => x.toLocaleString("de-DE", { maximumFractionDigits: s });
const EINHEIT_CM: Record<string, number> = { mm: 0.1, cm: 1, m: 100, km: 100000 };

export default function Massstab() {
  const [m, setM] = useState<M>({ bild: 1, echt: 25000 });
  const [richtung, setRichtung] = useState<"echt" | "bild">("echt");
  const [wert, setWert] = useState("4");
  const [einheit, setEinheit] = useState("cm");
  const zahl = Number(wert.replace(",", "."));
  const cm = Number.isFinite(zahl) ? zahl * EINHEIT_CM[einheit] : NaN;
  const ergebnis = richtung === "echt" ? inWirklichkeit(cm, m) : imBild(cm, m);
  // Beispielbild zum gewählten Maßstab; bei einem eigenen Maßstab bleibt das letzte stehen
  const [letztes, setLetztes] = useState<Beispiel>(BEISPIELE[0]);
  const passend = beispielFuer(m);
  const beispiel = passend ?? letztes;
  const passt = !!passend;
  if (passend && passend.id !== letztes.id) setLetztes(passend);
  return (
    // Einstellungen links, Karte rechts daneben — beides gleichzeitig im Blick
    <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)] items-start">
      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">📏 Maßstab umrechnen</h3>
        <p className="text-sm text-muted">Der Maßstab <b>Bild : Wirklichkeit</b> sagt, wie oft die Wirklichkeit größer ist als das Bild. 1 : 50 000 heißt: 1 cm auf der Karte sind 50 000 cm = 500 m in echt. 10 : 1 ist eine Vergrößerung — 10 mm im Bild sind 1 mm in echt.</p>
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
      <section className="card p-4 flex flex-col gap-3 lg:sticky lg:top-4">
        <h3 className="font-black">🔎 Beispiel: {beispiel.titel} ({massstabText(beispiel.m)})</h3>
        {!passt && <p className="text-xs text-muted">Zu {massstabText(m)} gibt es kein eigenes Bild — hier das zuletzt gewählte Beispiel. Wähle oben einen Maßstab, um sein Beispiel zu sehen.</p>}
        <BeispielBild key={beispiel.id} b={beispiel} />
      </section>
    </div>
  );
}
