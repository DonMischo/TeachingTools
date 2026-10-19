"use client";
/**
 * Erosion — Regen formt Gelände. Zufallsgelände (dieselbe Grundlage wie die
 * Stadtentwicklung), dann Schritt für Schritt Wassererosion und Rutschungen.
 * Vorbild: terrain-erosion-3-ways von Daniel Andrino (MIT), neu geschrieben.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { wahl as vorgabeWahl, type Vorgabe } from "@/lib/vorgabe";
import { erzeuge, type GelaendeWahl } from "@/lib/gelaende/gelaende";
import { gelaendeFarben } from "@/lib/gelaende/farbe";
import { aenderung, aufGelaende, erosionSchritt, erosionsSchritte, erosionStart, STANDARD_EROSION, type Erosion as ErosionsZustand, type ErosionsParameter } from "@/lib/gelaende/erosion";
import type { VoxelKarte } from "@/lib/gelaende/voxel";
import GelaendeLeiste from "@/components/gelaende/GelaendeLeiste";
import VoxelFlug from "@/components/gelaende/VoxelFlug";

const ANSICHTEN = [
  { id: "gelaende", label: "⛰️ Gelände" },
  { id: "wasser", label: "💧 Wasser" },
  { id: "aenderung", label: "🟥🟦 Abtrag/Ablagerung" },
  { id: "vorher", label: "⏮ Vorher" },
] as const;
type Ansicht = (typeof ANSICHTEN)[number]["id"];

const REGLER: { k: keyof ErosionsParameter; label: string; text: string }[] = [
  { k: "regen", label: "🌧️ Regen", text: "Wie viel Wasser je Schritt fällt." },
  { k: "loesen", label: "🪨 Lösekraft", text: "Wie schnell fließendes Wasser Boden mitnimmt." },
  { k: "boeschung", label: "⛰️ Standfestigkeit", text: "Ab welcher Neigung Hänge abrutschen (klein = rutscht früh)." },
  { k: "verdunstung", label: "☀️ Verdunstung", text: "Wie schnell Wasser verdunstet (trockenes Klima = hoch)." },
];

export default function Erosion({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const [wahl, setWahl] = useState<GelaendeWahl>({ art: "huegel", seed: 12, fluss: false, relief: 1.3 });
  const g = useMemo(() => erzeuge(wahl), [wahl]);
  const zustand = useRef<ErosionsZustand | null>(null);
  const [version, setVersion] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(4);
  const [param, setParam] = useState<ErosionsParameter>(STANDARD_EROSION);
  const [ansicht, setAnsicht] = useState<Ansicht>(vorgabeWahl(vorgabe, "ansicht", ANSICHTEN.map(a => a.id)) ?? "gelaende");
  const [drei, setDrei] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);
  const ziel = erosionsSchritte(g.n);

  useEffect(() => { zustand.current = erosionStart(g); setLaeuft(false); setVersion(v => v + 1); }, [g]);

  // Rechnen
  const paramRef = useRef(param);
  paramRef.current = param;
  useEffect(() => {
    if (!laeuft) return;
    let raf = 0;
    const lauf = () => {
      const e = zustand.current!;
      for (let i = 0; i < tempo; i++) erosionSchritt(e, paramRef.current);
      setVersion(v => v + 1);
      raf = requestAnimationFrame(lauf);
    };
    raf = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(raf);
  }, [laeuft, tempo]);

  // Zeichnen
  useEffect(() => {
    const e = zustand.current, c = cv.current;
    if (!e || !c) return;
    const jetzt = aufGelaende(e, g);
    let px: Uint8ClampedArray;
    if (ansicht === "vorher") px = gelaendeFarben(g, { linien: 10 });
    else if (ansicht === "aenderung") {
      const d = aenderung(e);
      const basis = gelaendeFarben(jetzt);
      let m = 0.5;
      for (let k = 0; k < d.length; k++) m = Math.max(m, Math.abs(d[k]));
      px = basis;
      for (let k = 0; k < d.length; k++) {
        const t = Math.min(1, Math.abs(d[k]) / (m * 0.5));
        const ziel = d[k] < 0 ? [220, 40, 40] : [40, 90, 230];
        for (let q = 0; q < 3; q++) px[k * 4 + q] = px[k * 4 + q] * (1 - t * 0.85) + ziel[q] * t * 0.85;
      }
    } else px = gelaendeFarben(jetzt, { wasserMenge: ansicht === "wasser" ? e.wasser : undefined });
    c.width = g.n; c.height = g.n;
    const ctx = c.getContext("2d")!;
    const b = ctx.createImageData(g.n, g.n);
    b.data.set(px);
    ctx.putImageData(b, 0, 0);
  }, [version, ansicht, g]);

  // Voxel-Karte nicht in jedem Bild, sondern alle paar Schritte neu
  const voxelStand = Math.floor(version / 8);
  const karte = useMemo<VoxelKarte | null>(() => {
    const e = zustand.current;
    if (!drei || !e) return null;
    const jetzt = aufGelaende(e, g);
    const farbe = gelaendeFarben(jetzt, { wasserMenge: e.wasser });
    const N = 512, f = g.n / N;
    const hoehe = new Float32Array(N * N), rgba = new Uint8ClampedArray(N * N * 4);
    let lo = Infinity;
    for (let k = 0; k < jetzt.hoehe.length; k++) lo = Math.min(lo, jetzt.hoehe[k]);
    const px = g.breite / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = Math.floor(j * f) * g.n + Math.floor(i * f);
      hoehe[j * N + i] = ((jetzt.hoehe[k] - lo) * 1.6) / px;
      for (let q = 0; q < 4; q++) rgba[(j * N + i) * 4 + q] = farbe[k * 4 + q];
    }
    return { n: N, hoehe, farbe: rgba };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drei, voxelStand, g]);

  const e = zustand.current;
  const d = e && version >= 0 ? aenderung(e) : null;
  let abtrag = 0, ablage = 0;
  if (d) for (let k = 0; k < d.length; k++) { abtrag = Math.min(abtrag, d[k]); ablage = Math.max(ablage, d[k]); }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🌧️ Erosion</h1>
          <p className="text-muted text-sm mt-1">Regen sammelt sich, fließt bergab und nimmt Boden mit — aus glattem Rauschen werden Täler, Grate und Schwemmfächer.</p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      <GelaendeLeiste wahl={wahl} setWahl={setWahl} gesperrt={laeuft} />
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {drei && karte ? <VoxelFlug karte={karte} /> : (
            <canvas ref={cv} className="aspect-square w-full max-w-[720px] rounded-xl border border-line" style={{ imageRendering: "auto" }} aria-label="Gelände von oben" />
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {ANSICHTEN.map(a => <button key={a.id} className={`chip ${ansicht === a.id && !drei ? "chip-on" : ""}`} onClick={() => { setAnsicht(a.id); setDrei(false); }}>{a.label}</button>)}
            <button className={`chip ${drei ? "chip-on" : ""}`} onClick={() => setDrei(x => !x)}>🛩️ 3D-Flug</button>
          </div>
        </div>
        <aside className="card flex flex-col gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setLaeuft(l => !l)}>{laeuft ? "⏸ Anhalten" : "▶ Regnen lassen"}</button>
            <button className="btn-secondary" disabled={laeuft} onClick={() => { for (let i = 0; i < 20; i++) erosionSchritt(zustand.current!, param); setVersion(v => v + 1); }}>⏭ 20 Schritte</button>
            <button className="btn-secondary" onClick={() => { setLaeuft(false); zustand.current = erosionStart(g); setVersion(v => v + 1); }}>↺ Zurück</button>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted"><span>Schritt {e?.schritte ?? 0}</span><span>»fertig« ab {ziel}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className="h-full bg-accent" style={{ width: `${Math.min(100, ((e?.schritte ?? 0) / ziel) * 100)}%` }} /></div>
          </div>
          <label className="text-xs text-muted">⏩ Tempo: {tempo} Schritte je Bild
            <input type="range" min={1} max={12} value={tempo} onChange={x => setTempo(Number(x.target.value))} className="w-full" />
          </label>
          {REGLER.map(r => (
            <label key={r.k} className="text-xs text-muted" title={r.text}>{r.label}: {param[r.k].toFixed(1)}×
              <input type="range" min={0.2} max={3} step={0.1} value={param[r.k]} onChange={x => setParam(p => ({ ...p, [r.k]: Number(x.target.value) }))} className="w-full" />
            </label>
          ))}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-bad/10 p-2"><div className="text-lg font-black">{abtrag.toFixed(1)} m</div><div className="text-xs text-muted">stärkster Abtrag</div></div>
            <div className="rounded-lg bg-accent/10 p-2"><div className="text-lg font-black">+{ablage.toFixed(1)} m</div><div className="text-xs text-muted">stärkste Ablagerung</div></div>
          </div>
          <details className="rounded-lg border border-line p-2">
            <summary className="cursor-pointer font-bold">📘 Was passiert hier?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li><b>Regen</b> fällt überall ein wenig.</li>
              <li>Das Wasser fließt in Richtung des <b>steilsten Gefälles</b>.</li>
              <li>Schnelles Wasser kann viel <b>Schlamm tragen</b>: Es löst Boden (Abtrag, rot). Wird es langsamer, setzt sich der Schlamm ab (Ablagerung, blau) — in Senken, am Hangfuß, im Meer als Delta.</li>
              <li>Zu steile Hänge <b>rutschen</b> ab (thermische Erosion).</li>
              <li>Ein Teil des Wassers <b>verdunstet</b>.</li>
            </ol>
            <p className="mt-2">Aus vielen kleinen Rinnsalen werden Bäche, die sich zu Tälern eingraben. Zwischen ihnen bleiben scharfe Grate stehen.</p>
            <p className="mt-2 text-muted">Drei Wege zu Gelände (nach Daniel Andrino): <b>Rauschen</b> (schnell, aber ohne Täler), <b>Simulation</b> (das hier) und <b>maschinelles Lernen</b> aus echten Höhendaten.</p>
          </details>
          <p className="text-xs text-muted">Vorbild: <a className="underline" href="https://github.com/dandrino/terrain-erosion-3-ways" target="_blank" rel="noreferrer">terrain-erosion-3-ways</a> (MIT), 3D nach <a className="underline" href="https://github.com/s-macke/VoxelSpace" target="_blank" rel="noreferrer">Voxel Space</a> (MIT) — neu geschrieben.</p>
        </aside>
      </div>
    </div>
  );
}
