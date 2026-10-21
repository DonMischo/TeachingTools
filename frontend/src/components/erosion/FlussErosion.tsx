"use client";
/**
 * Reiter »Flüsse & Täler«: Regen, Jahreszeiten, Flüsse graben Täler, neue
 * Flüsse und Seen entstehen. Vorbild terrain-erosion-3-ways (MIT).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { erzeuge, type GelaendeWahl } from "@/lib/gelaende/gelaende";
import { gelaendeFarben, hoehenSpanne } from "@/lib/gelaende/farbe";
import {
  aenderung, aufGelaende, erosionSchritt, flussFormen, erosionsSchritte, erosionStart, gewaesser, jahreszeit, JAHR, STANDARD_EROSION,
  type Erosion as ErosionsZustand, type ErosionsParameter,
} from "@/lib/gelaende/erosion";
import type { VoxelKarte } from "@/lib/gelaende/voxel";
import GelaendeLeiste from "@/components/gelaende/GelaendeLeiste";
import VoxelFlug from "@/components/gelaende/VoxelFlug";
import { voxelAusGitter } from "@/components/gelaende/voxelGitter";
import Formschilder from "@/components/gelaende/Formschilder";

export const ANSICHTEN = [
  { id: "gelaende", label: "⛰️ Gelände" },
  { id: "wasser", label: "💧 Wasser" },
  { id: "aenderung", label: "🟥🟦 Abtrag/Ablagerung" },
  { id: "vorher", label: "⏮ Vorher" },
] as const;
export type Ansicht = (typeof ANSICHTEN)[number]["id"];

const REGLER: { k: keyof ErosionsParameter; label: string; text: string; max: number }[] = [
  { k: "regen", label: "🌧️ Regen", text: "Wie viel Wasser je Schritt fällt.", max: 3 },
  { k: "jahreszeiten", label: "🌦️ Regen- und Trockenzeit", text: "0 = jeden Schritt gleich viel Regen; hoch = ausgeprägte Regenzeit, in der die Flüsse anschwellen.", max: 1 },
  { k: "zufluss", label: "🏞️ Zufluss von außen", text: "Wasser, das am Oberlauf in die Karte fließt (nur mit Fluss).", max: 3 },
  { k: "loesen", label: "🪨 Lösekraft", text: "Wie schnell fließendes Wasser Boden mitnimmt.", max: 3 },
  { k: "boeschung", label: "⛰️ Standfestigkeit", text: "Ab welcher Neigung Hänge abrutschen (klein = rutscht früh).", max: 3 },
  { k: "verdunstung", label: "☀️ Verdunstung", text: "Wie schnell Wasser verdunstet (trockenes Klima = hoch).", max: 3 },
];

export default function FlussErosion({ startAnsicht }: { startAnsicht?: Ansicht }) {
  const [wahl, setWahl] = useState<GelaendeWahl>({ art: "huegel", seed: 12, fluss: true, relief: 1.3 });
  const [fein, setFein] = useState(false);
  const g = useMemo(() => (fein ? erzeuge(wahl, 512, 6) : erzeuge(wahl, 256, 12)), [wahl, fein]);
  const spanne = useMemo(() => hoehenSpanne(g), [g]);
  const zustand = useRef<ErosionsZustand | null>(null);
  const [version, setVersion] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(4);
  const [param, setParam] = useState<ErosionsParameter>(STANDARD_EROSION);
  const [ansicht, setAnsicht] = useState<Ansicht>(startAnsicht ?? "gelaende");
  const [drei, setDrei] = useState(false);
  const [schilder, setSchilder] = useState(true);
  const cv = useRef<HTMLCanvasElement>(null);
  const ziel = erosionsSchritte(g.n);

  useEffect(() => { zustand.current = erosionStart(g); setLaeuft(false); setVersion(v => v + 1); }, [g]);

  const paramRef = useRef(param);
  paramRef.current = param;
  useEffect(() => {
    if (!laeuft) return;
    let raf = 0;
    const lauf = () => {
      const e = zustand.current!;
      const t = performance.now();
      for (let i = 0; i < tempo && performance.now() - t < 40; i++) erosionSchritt(e, paramRef.current);
      setVersion(v => v + 1);
      raf = requestAnimationFrame(lauf);
    };
    raf = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(raf);
  }, [laeuft, tempo]);

  // Gewässer (Flüsse, Seen) nicht in jedem Bild neu suchen
  const gwStand = Math.floor(version / 6);
  const jetzt = useMemo(() => (zustand.current ? aufGelaende(zustand.current, g) : g),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gwStand, g]);

  useEffect(() => {
    const e = zustand.current, c = cv.current;
    if (!e || !c) return;
    const hoehe = new Float32Array(e.h.length);
    for (let k = 0; k < hoehe.length; k++) hoehe[k] = e.null + e.h[k] * e.einheit;
    const aktuell = { ...jetzt, hoehe };
    let px: Uint8ClampedArray;
    if (ansicht === "vorher") px = gelaendeFarben(g, { spanne });
    else if (ansicht === "aenderung") {
      const d = aenderung(e);
      px = gelaendeFarben(aktuell, { spanne });
      let m = 0.5;
      for (let k = 0; k < d.length; k++) m = Math.max(m, Math.abs(d[k]));
      for (let k = 0; k < d.length; k++) {
        const t = Math.min(1, Math.abs(d[k]) / (m * 0.5));
        const f = d[k] < 0 ? [220, 40, 40] : [40, 90, 230];
        for (let q = 0; q < 3; q++) px[k * 4 + q] = px[k * 4 + q] * (1 - t * 0.85) + f[q] * t * 0.85;
      }
    } else px = gelaendeFarben(aktuell, { spanne, wasserMenge: ansicht === "wasser" ? e.wasser : undefined });
    c.width = g.n; c.height = g.n;
    const ctx = c.getContext("2d")!;
    const b = ctx.createImageData(g.n, g.n);
    b.data.set(px);
    ctx.putImageData(b, 0, 0);
  }, [version, ansicht, g, jetzt, spanne]);

  const voxelStand = Math.floor(version / 8);
  const karte = useMemo<VoxelKarte | null>(() => {
    const e = zustand.current;
    if (!drei || !e) return null;
    const farbe = gelaendeFarben(jetzt, { spanne, wasserMenge: e.wasser });
    return voxelAusGitter(jetzt.hoehe, farbe, g.n, g.zelle, 1024);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drei, voxelStand, g]);

  const e = zustand.current;
  const d = e ? aenderung(e) : null;
  // 1. und 99. Perzentil statt Extremwert — einzelne Zellen am Flussbett verzerren sonst
  let abtrag = 0, ablage = 0;
  if (d) { const st = Array.from(d).sort((x, y) => x - y); abtrag = Math.min(0, st[Math.floor(st.length * 0.01)]); ablage = Math.max(0, st[Math.floor(st.length * 0.99)]); }
  const gw = useMemo(() => (e ? gewaesser(e) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gwStand, g]);
  let fluss = 0, see = 0;
  if (gw) for (let k = 0; k < gw.length; k++) { if (gw[k] === 1 && !g.wasser[k]) fluss++; if (gw[k] === 3) see++; }
  const marken = useMemo(() => (schilder && e && e.schritte > 30 ? flussFormen(e, g) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gwStand, schilder, g]);
  const ha = (z: number) => ((z * g.zelle * g.zelle) / 10000).toFixed(1);
  const jz = e ? jahreszeit(e, param) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <GelaendeLeiste wahl={wahl} setWahl={setWahl} gesperrt={laeuft} />
        <label className="flex items-center gap-1.5 text-sm text-muted" title="512² statt 256²: schärfer, aber etwa dreimal langsamer">
          <input type="checkbox" checked={fein} disabled={laeuft} onChange={x => setFein(x.target.checked)} /> 🔍 Fein (512²)
        </label>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {drei && karte ? <VoxelFlug karte={karte} /> : (
            <div className="relative w-full max-w-[760px]">
              <canvas ref={cv} className="aspect-square w-full rounded-xl border border-line" aria-label="Gelände von oben" />
              {schilder && <Formschilder marken={marken} n={g.n} />}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {ANSICHTEN.map(a => <button key={a.id} className={`chip ${ansicht === a.id && !drei ? "chip-on" : ""}`} onClick={() => { setAnsicht(a.id); setDrei(false); }}>{a.label}</button>)}
            <button className={`chip ${drei ? "chip-on" : ""}`} onClick={() => setDrei(x => !x)}>🛩️ 3D-Flug</button>
            <button className={`chip ${schilder ? "chip-on" : ""}`} onClick={() => setSchilder(x => !x)}>✨ Formen erkennen</button>
          </div>
        </div>
        <aside className="card flex flex-col gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setLaeuft(l => !l)}>{laeuft ? "⏸ Anhalten" : "▶ Regnen lassen"}</button>
            <button className="btn-secondary" disabled={laeuft} onClick={() => { for (let i = 0; i < 20; i++) erosionSchritt(zustand.current!, param); setVersion(v => v + 1); }}>⏭ 20 Schritte</button>
            <button className="btn-secondary" onClick={() => { setLaeuft(false); zustand.current = erosionStart(g); setVersion(v => v + 1); }}>↺ Zurück</button>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted"><span>Schritt {e?.schritte ?? 0} · Jahr {Math.floor((e?.schritte ?? 0) / JAHR) + 1}</span><span>»fertig« ab {ziel}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className="h-full bg-accent" style={{ width: `${Math.min(100, ((e?.schritte ?? 0) / ziel) * 100)}%` }} /></div>
          </div>
          {jz && param.jahreszeiten > 0 && (
            <div className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${jz.regenzeit ? "bg-accent/15" : "bg-bad/10"}`}>
              <span className="font-bold">{jz.regenzeit ? "☔ Regenzeit" : "☀️ Trockenzeit"}</span>
              <span className="text-xs text-muted">Regen × {jz.faktor.toFixed(1)}</span>
            </div>
          )}
          <label className="text-xs text-muted">⏩ Tempo: {tempo} Schritte je Bild
            <input type="range" min={1} max={12} value={tempo} onChange={x => setTempo(Number(x.target.value))} className="w-full" />
          </label>
          {REGLER.map(r => (
            <label key={r.k} className="text-xs text-muted" title={r.text}>{r.label}: {param[r.k].toFixed(1)}{r.max === 1 ? "" : "×"}
              <input type="range" min={r.max === 1 ? 0 : 0} max={r.max} step={0.1} value={param[r.k]} onChange={x => setParam(p => ({ ...p, [r.k]: Number(x.target.value) }))} className="w-full" />
            </label>
          ))}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-bad/10 p-2"><div className="text-lg font-black">{abtrag.toFixed(1)} m</div><div className="text-xs text-muted">starker Abtrag (1 % der Fläche)</div></div>
            <div className="rounded-lg bg-accent/10 p-2"><div className="text-lg font-black">+{ablage.toFixed(1)} m</div><div className="text-xs text-muted">starke Ablagerung (1 %)</div></div>
            <div className="rounded-lg bg-accent/10 p-2"><div className="text-lg font-black">{ha(fluss)} ha</div><div className="text-xs text-muted">neue Flüsse</div></div>
            <div className="rounded-lg bg-accent/10 p-2"><div className="text-lg font-black">{ha(see)} ha</div><div className="text-xs text-muted">Seen</div></div>
          </div>
          <details className="rounded-lg border border-line p-2">
            <summary className="cursor-pointer font-bold">📘 Was passiert hier?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li><b>Regen</b> fällt überall — in der Regenzeit viel, in der Trockenzeit wenig. Am Oberlauf fließt zusätzlich ein Fluss in die Karte.</li>
              <li>Das Wasser fließt in Richtung des <b>steilsten Gefälles</b> und sammelt sich in Rinnen.</li>
              <li>Schnelles, viel Wasser trägt viel <b>Schlamm</b>: Es löst Boden (rot). Wird es langsamer, setzt sich der Schlamm ab (blau) — in Senken, am Hangfuß, im Meer als Delta.</li>
              <li>Wo dauerhaft viel Wasser fließt, entsteht ein <b>neuer Fluss</b>. In der Regenzeit schwellen Flüsse an und graben stärker.</li>
              <li>Kann Wasser aus einer Senke nicht abfließen, entsteht ein <b>See</b>, bis er überläuft.</li>
              <li>Zu steile Hänge <b>rutschen</b> ab, ein Teil des Wassers <b>verdunstet</b>.</li>
            </ol>
            <p className="mt-2 text-muted">Drei Wege zu Gelände (nach Daniel Andrino): <b>Rauschen</b> (schnell, aber ohne Täler), <b>Simulation</b> (das hier) und <b>maschinelles Lernen</b> aus echten Höhendaten.</p>
          </details>
        </aside>
      </div>
    </div>
  );
}
