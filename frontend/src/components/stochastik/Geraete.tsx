"use client";
/** Zufallsgeräte einstellen und anzeigen: Würfel, Münze, Glücksrad, Urne. */
import { useState } from "react";
import { FARB_LABEL, FARBEN, type Experiment, type FarbName } from "@/lib/stochastik/zufall";
import { Muenze, Rad, Urne, Wuerfel } from "./diagramme";
import { Chips } from "./ui";

export type GeraetArt = "wuerfel" | "muenze" | "rad" | "urne";
const ARTEN: { id: GeraetArt; label: string }[] = [
  { id: "wuerfel", label: "🎲 Würfel" }, { id: "muenze", label: "🪙 Münze" }, { id: "rad", label: "🎡 Glücksrad" }, { id: "urne", label: "🏺 Urne" },
];
const RAD_FARBEN: FarbName[] = ["rot", "blau", "gruen", "gelb", "lila", "orange"];

export function useGeraet(start: GeraetArt = "wuerfel", ohneUrneOhneZ = false) {
  const [art, setArt] = useState<GeraetArt>(start);
  const [seiten, setSeiten] = useState(6);
  const [rad, setRad] = useState<{ label: string; farbe: FarbName; anteil: number }[]>([
    { label: "rot", farbe: "rot", anteil: 2 }, { label: "blau", farbe: "blau", anteil: 1 }, { label: "gelb", farbe: "gelb", anteil: 1 },
  ]);
  const [kugeln, setKugeln] = useState<Partial<Record<FarbName, number>>>({ rot: 3, blau: 2 });
  const [zl, setZl] = useState(true);

  const experiment: Experiment = art === "wuerfel" ? { art, seiten } : art === "muenze" ? { art } : art === "rad" ? { art, felder: rad } : { art, kugeln, zuruecklegen: zl };
  const kugelZahl = Object.values(kugeln).reduce((a, n) => a + (n ?? 0), 0);

  const einstellung = (
    <div className="flex flex-col gap-2">
      <Chips wahl={art} setze={setArt} optionen={ARTEN} />
      {art === "wuerfel" && (
        <div className="flex flex-wrap gap-1.5 items-center text-sm">
          <span className="text-muted">Seiten:</span>
          {[4, 6, 8, 10, 12, 20].map(n => <button key={n} className={`chip ${seiten === n ? "chip-on" : ""}`} onClick={() => setSeiten(n)}>{n}</button>)}
        </div>
      )}
      {art === "rad" && (
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">Felder (gleich große Grundfelder; »Anteil« = wie viele davon)</span>
          {rad.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-4 h-4 rounded-full" style={{ background: FARBEN[f.farbe] }} />
              <select className="input w-28" value={f.farbe} aria-label={`Farbe Feld ${i + 1}`}
                onChange={e => setRad(r => r.map((x, j) => (j === i ? { ...x, farbe: e.target.value as FarbName, label: FARB_LABEL[e.target.value as FarbName] } : x)))}>
                {RAD_FARBEN.map(c => <option key={c} value={c}>{FARB_LABEL[c]}</option>)}
              </select>
              <input type="number" className="input w-16" min={1} max={12} value={f.anteil} aria-label={`Anteil ${f.label}`}
                onChange={e => setRad(r => r.map((x, j) => (j === i ? { ...x, anteil: Math.max(1, Math.min(12, Number(e.target.value) || 1)) } : x)))} />
              {rad.length > 2 && <button className="btn" aria-label="Feld entfernen" onClick={() => setRad(r => r.filter((_, j) => j !== i))}>🗑</button>}
            </div>
          ))}
          {rad.length < 6 && <button className="btn self-start" onClick={() => {
            const frei = RAD_FARBEN.find(c => !rad.some(f => f.farbe === c)) ?? "lila";
            setRad(r => [...r, { label: FARB_LABEL[frei], farbe: frei, anteil: 1 }]);
          }}>＋ Feld</button>}
        </div>
      )}
      {art === "urne" && (
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex flex-wrap gap-3">
            {(["rot", "blau", "gruen", "gelb"] as FarbName[]).map(c => (
              <label key={c} className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full" style={{ background: FARBEN[c] }} />
                <input type="number" className="input w-16" min={0} max={9} value={kugeln[c] ?? 0} aria-label={`Kugeln ${FARB_LABEL[c]}`}
                  onChange={e => setKugeln(k => ({ ...k, [c]: Math.max(0, Math.min(9, Number(e.target.value) || 0)) }))} />
              </label>
            ))}
          </div>
          {!ohneUrneOhneZ && (
            <div className="flex gap-1.5">
              <button className={`chip ${zl ? "chip-on" : ""}`} onClick={() => setZl(true)}>mit Zurücklegen</button>
              <button className={`chip ${!zl ? "chip-on" : ""}`} onClick={() => setZl(false)}>ohne Zurücklegen</button>
            </div>
          )}
          {kugelZahl === 0 && <span className="text-bad text-xs">Mindestens eine Kugel hineinlegen.</span>}
        </div>
      )}
    </div>
  );
  return { experiment, einstellung, ok: art !== "urne" || kugelZahl > 0, kugelZahl };
}

/** Das Gerät mit dem letzten Ergebnis einer Stufe. */
export function GeraetBild({ e, ergebnis, bisher = [], drehung = 0 }: { e: Experiment; ergebnis?: string; bisher?: string[]; drehung?: number }) {
  if (e.art === "wuerfel") return <Wuerfel augen={Number(ergebnis ?? 1)} groesse={72} />;
  if (e.art === "muenze") return <Muenze seite={(ergebnis as "K" | "Z") ?? "K"} groesse={72} />;
  if (e.art === "rad") return <Rad felder={e.felder.map(f => ({ label: f.label, farbe: FARBEN[f.farbe], anteil: f.anteil }))} winkel={drehung} groesse={170} />;
  return <Urne kugeln={e.kugeln} weg={e.zuruecklegen ? [] : bisher} gross />;
}

/** Drehwinkel, damit der Zeiger auf einem Feld des Ergebnisses landet. */
export function radWinkel(e: Experiment, ergebnis: string, alt: number): number {
  if (e.art !== "rad") return alt;
  const ges = e.felder.reduce((a, f) => a + f.anteil, 0);
  let a0 = 0;
  const treffer: [number, number][] = [];
  for (const f of e.felder) {
    const w = (f.anteil / ges) * 360;
    if (f.label === ergebnis) treffer.push([a0, a0 + w]);
    a0 += w;
  }
  const [von, bis] = treffer[Math.floor(Math.random() * treffer.length)] ?? [0, 0];
  const ziel = von + (bis - von) * (0.2 + Math.random() * 0.6);
  // Zeiger oben: Rad so drehen, dass `ziel` nach oben kommt; immer vorwärts, mindestens zwei Umdrehungen
  const basis = Math.ceil(alt / 360) * 360 + 720;
  return basis + (360 - ziel);
}
