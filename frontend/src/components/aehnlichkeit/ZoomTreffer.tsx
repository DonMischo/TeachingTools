"use client";
/**
 * Spiel »Zoom-Treffer«: Eine gestrichelte Zielfigur ist das Bild der blauen
 * Figur bei einer zentrischen Streckung. Zentrum Z setzen (antippen oder
 * ziehen) und k einstellen, bis das orange Bild auf dem Ziel liegt. Fünf
 * Runden, je genauer, desto mehr Punkte; ab Stufe 3 auch negative k.
 */
import { useState } from "react";
import { passung, streckeFigur, zoomZiel, type P } from "@/lib/aehnlichkeit";
import { Blatt, FigurZeichnung, sx, sy } from "./Blatt";

const BEST = "hp_aehnlichkeit_zoom_best";
const de = (x: number, s = 2) => x.toLocaleString("de-DE", { maximumFractionDigits: s });
const punkteFuer = (fehler: number) => (fehler < 0.05 ? 100 : fehler < 0.3 ? 70 : fehler < 0.8 ? 40 : fehler < 1.5 ? 10 : 0);

export default function ZoomTreffer() {
  const [stufe, setStufe] = useState<1 | 2 | 3>(1);
  const [runde, setRunde] = useState(0);
  const [ziel, setZiel] = useState(() => zoomZiel(Math.random, 1));
  const [z, setZ] = useState<P>({ x: 0, y: 3 });
  const [k, setK] = useState(1);
  const [ergebnis, setErgebnis] = useState<null | { fehler: number; punkte: number }>(null);
  const [summe, setSumme] = useState(0);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem(BEST)) || 0; } catch { return 0; } });
  const bild = streckeFigur(ziel.fig.f, z, k);
  const fertig = runde >= 5;

  const pruefe = () => {
    const f = passung(bild, ziel.ziel), p = punkteFuer(f);
    setErgebnis({ fehler: f, punkte: p });
    const s = summe + p;
    setSumme(s);
    if (runde === 4 && s > best) { setBest(s); try { localStorage.setItem(BEST, String(s)); } catch { /* egal */ } }
  };
  const weiter = () => { setRunde(r => r + 1); setZiel(zoomZiel(Math.random, stufe)); setErgebnis(null); setK(1); setZ({ x: 0, y: 3 }); };
  const neuesSpiel = (s = stufe) => { setStufe(s); setRunde(0); setSumme(0); setZiel(zoomZiel(Math.random, s)); setErgebnis(null); setK(1); };

  if (fertig) return (
    <div className="flex flex-col gap-3 items-start">
      <h3 className="font-black text-lg">🎯 {summe} von 500 Punkten{summe >= best && summe > 0 ? " — neuer Rekord!" : ""}</h3>
      <button className="btn-primary" onClick={() => neuesSpiel()}>Nochmal</button>
    </div>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Blatt label="Zoom-Treffer" onTippen={p => !ergebnis && setZ({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 })}
        onZiehen={(p, phase) => {
          if (ergebnis) return false;
          if (phase === "start") return Math.hypot(p.x - z.x, p.y - z.y) < 0.8;
          setZ({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 });
        }}>
        <FigurZeichnung f={ziel.ziel} farbe="#6b7280" strich="8 6" />
        <FigurZeichnung f={ziel.fig.f} farbe="#2563eb" />
        <FigurZeichnung f={bild} farbe="#ea580c" />
        {ergebnis && <g><circle cx={sx(ziel.z.x)} cy={sy(ziel.z.y)} r={7} fill="none" stroke="#6b7280" strokeWidth={3} /></g>}
        <circle cx={sx(z.x)} cy={sy(z.y)} r={9} fill="#16a34a" stroke="white" strokeWidth={2} />
      </Blatt>
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex gap-3 text-sm font-bold"><span>Runde {runde + 1} / 5</span><span>{summe} Punkte</span>{best > 0 && <span className="text-muted font-normal">Rekord {best}</span>}</div>
        <p className="text-sm">Strecke die <b className="text-[#2563eb]">blaue</b> Figur so, dass ihr <b className="text-[#ea580c]">Bild</b> genau auf dem gestrichelten Ziel liegt. Zentrum Z antippen oder ziehen, k einstellen.</p>
        <label className="flex flex-col gap-1 text-sm">k = <b className="text-2xl">{de(k)}</b>
          <input type="range" min={-3} max={3} step={0.25} value={k} disabled={!!ergebnis} onChange={e => setK(Number(e.target.value))} aria-label="Streckfaktor" />
        </label>
        {!ergebnis ? <button className="btn-primary" onClick={pruefe}>Treffer prüfen</button> : <>
          <p className={`font-bold ${ergebnis.punkte >= 70 ? "text-ok" : "text-bad"}`}>{ergebnis.punkte >= 70 ? "🎯 Treffer!" : "Daneben."} +{ergebnis.punkte} Punkte</p>
          <p className="text-sm">Gesucht war Z({de(ziel.z.x)} | {de(-ziel.z.y)}) und k = {de(ziel.k)} (grauer Kreis).</p>
          <button className="btn-primary" onClick={weiter}>{runde === 4 ? "Auswertung" : "Nächste Figur →"}</button>
        </>}
        <div className="flex gap-1 items-center text-sm">Stufe {([1, 2, 3] as const).map(s => <button key={s} className={`chip ${stufe === s ? "chip-on" : ""}`} onClick={() => neuesSpiel(s)}>{s}</button>)}</div>
        <p className="text-xs text-muted">Tipp: Verbinde entsprechende Ecken von Figur und Ziel — alle Verbindungslinien treffen sich im Zentrum.</p>
      </div>
    </div>
  );
}
