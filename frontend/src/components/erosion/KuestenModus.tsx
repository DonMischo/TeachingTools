"use client";
/**
 * Reiter »Küste«: Steilküste, Flachküste, Marsch mit Deich von oben —
 * Brandung, Kliffabbruch, Strandversatz, Dünen, Sturmflut und Deichbruch.
 * Das Querprofil zeigt eine Spalte (Klick in die Karte wählt sie).
 * Für Profile im Detail: die Simulation »Küstendynamik«.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KUESTEN, kuesteErzeugen, kuestenFarben, kuestenSchritt, rueckgang, STANDARD_KUESTE, ueberflutet, wasserstand,
  type Kueste, type KuestenParameter, type KuestenTyp,
} from "@/lib/gelaende/kuestenErosion";
import type { VoxelKarte } from "@/lib/gelaende/voxel";
import VoxelFlug from "@/components/gelaende/VoxelFlug";
import { voxelAusGitter } from "@/components/gelaende/voxelGitter";
import SimVerweis from "@/components/gelaende/SimVerweis";

const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

export default function KuestenModus({ startTyp }: { startTyp?: KuestenTyp }) {
  const [typ, setTyp] = useState<KuestenTyp>(startTyp ?? "steil");
  const [seed, setSeed] = useState(4);
  const [fein, setFein] = useState(false);
  const [deichHoehe, setDeichHoehe] = useState(8);
  const neu = () => kuesteErzeugen({ typ, seed, deich: deichHoehe }, fein ? 512 : 256, fein ? 3 : 6);
  const k = useRef<Kueste>(neu());
  const [version, setVersion] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [p, setP] = useState<KuestenParameter>(STANDARD_KUESTE);
  const [sturmAlle, setSturmAlle] = useState(10);
  const [spalte, setSpalte] = useState(0.5);
  const [drei, setDrei] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);
  const profil = useRef<HTMLCanvasElement>(null);
  const [letzterSturm, setLetzterSturm] = useState<number | null>(null);

  useEffect(() => { k.current = neu(); setLaeuft(false); setLetzterSturm(null); setVersion(v => v + 1); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typ, seed, fein, deichHoehe]);

  const pRef = useRef(p); pRef.current = p;
  const sturmRef = useRef(sturmAlle); sturmRef.current = sturmAlle;
  const schritt = (sturm?: boolean) => {
    const z = k.current;
    const s = sturm ?? (sturmRef.current > 0 && z.jahr % sturmRef.current === sturmRef.current - 1);
    kuestenSchritt(z, { ...pRef.current, sturm: s });
    if (s) setLetzterSturm(z.jahr);
  };
  useEffect(() => {
    if (!laeuft) return;
    let raf = 0, letzt = 0;
    const lauf = (t: number) => {
      if (t - letzt > 90) { schritt(); setVersion(v => v + 1); letzt = t; }
      raf = requestAnimationFrame(lauf);
    };
    raf = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laeuft]);

  const sturmJetzt = letzterSturm === k.current.jahr;
  const anzeigeP = { ...p, sturm: sturmJetzt };
  useEffect(() => {
    const c = cv.current, z = k.current;
    if (!c) return;
    c.width = z.n; c.height = z.n;
    const ctx = c.getContext("2d")!;
    const b = ctx.createImageData(z.n, z.n);
    b.data.set(kuestenFarben(z, anzeigeP));
    ctx.putImageData(b, 0, 0);
    // gewählte Spalte
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillRect(Math.floor(spalte * z.n), 0, 1, z.n);
    // Querprofil: Start (grau gestrichelt) und jetzt
    const pc = profil.current;
    if (!pc) return;
    const W = pc.width = 600, H = pc.height = 180, px = pc.getContext("2d")!;
    const i = Math.floor(spalte * z.n);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < z.n; j++) { lo = Math.min(lo, z.start[j * z.n + i], z.h[j * z.n + i]); hi = Math.max(hi, z.start[j * z.n + i], z.h[j * z.n + i]); }
    lo = Math.min(lo, -4); hi = Math.max(hi, 10);
    const X = (j: number) => (j / (z.n - 1)) * W, Y = (h: number) => H - 14 - ((h - lo) / (hi - lo)) * (H - 24);
    px.fillStyle = "#dbeafe"; px.fillRect(0, 0, W, H);
    const wl = wasserstand(anzeigeP);
    px.fillStyle = "#60a5fa"; px.fillRect(0, Y(wl), W, H - Y(wl));
    px.beginPath(); px.moveTo(0, H);
    for (let j = 0; j < z.n; j++) px.lineTo(X(j), Y(z.h[j * z.n + i]));
    px.lineTo(W, H); px.closePath();
    px.fillStyle = typ === "steil" ? "#e7e5e4" : typ === "flach" ? "#e8d6a0" : "#86a865"; px.fill();
    px.strokeStyle = "#57534e"; px.lineWidth = 1.5; px.stroke();
    px.setLineDash([4, 3]); px.strokeStyle = "#78716c"; px.beginPath();
    for (let j = 0; j < z.n; j++) { const y = Y(z.start[j * z.n + i]); if (j) px.lineTo(X(j), y); else px.moveTo(X(j), y); }
    px.stroke(); px.setLineDash([]);
    px.fillStyle = "#1c1917"; px.font = "12px system-ui"; px.fillText("Land (Norden)", 6, 14); px.textAlign = "right"; px.fillText("Meer (Süden)", W - 6, 14);
    px.textAlign = "left"; px.fillText(`Querprofil · gestrichelt = Jahr 0 · Höhe ${Math.round(lo)} bis ${Math.round(hi)} m`, 6, H - 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, spalte, typ]);

  const voxelStand = Math.floor(version / 5);
  const karte = useMemo<VoxelKarte | null>(() => {
    if (!drei) return null;
    const z = k.current;
    return voxelAusGitter(z.h, kuestenFarben(z, anzeigeP), z.n, z.zelle, 1024, 2.5, wasserstand(anzeigeP) - 0.3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drei, voxelStand, typ, seed, fein]);

  const z = k.current;
  const info = KUESTEN.find(x => x.id === typ)!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl border border-line bg-surface p-1">
          {KUESTEN.map(x => <button key={x.id} disabled={laeuft} onClick={() => setTyp(x.id)} className={chip(typ === x.id)}>{x.icon} {x.label}</button>)}
        </div>
        <button className="btn-secondary py-1.5" disabled={laeuft} onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>🎲 Neue Küste</button>
        <label className="flex items-center gap-1.5 text-sm text-muted"><input type="checkbox" checked={fein} disabled={laeuft} onChange={x => setFein(x.target.checked)} /> 🔍 Fein</label>
        <SimVerweis href={`/simulationen/kueste`} text="🌊 Profil im Detail: Küstendynamik" />
      </div>
      <p className="text-sm text-muted">{info.text}</p>
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {drei && karte ? <VoxelFlug karte={karte} /> : (
            <canvas ref={cv} className="aspect-square w-full max-w-[760px] cursor-crosshair rounded-xl border border-line" aria-label="Küste von oben"
              onClick={x => { const r = (x.target as HTMLElement).getBoundingClientRect(); setSpalte(Math.max(0, Math.min(0.999, (x.clientX - r.left) / r.width))); }} />
          )}
          <canvas ref={profil} className="mt-2 h-auto w-full max-w-[760px] rounded-lg border border-line" aria-label="Querprofil" />
          <div className="mt-1 flex flex-wrap gap-1">
            <button className={`chip ${drei ? "chip-on" : ""}`} onClick={() => setDrei(x => !x)}>🛩️ 3D-Flug</button>
            <span className="text-xs text-muted">Klick in die Karte wählt das Querprofil.</span>
          </div>
        </div>
        <aside className="card flex flex-col gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setLaeuft(l => !l)}>{laeuft ? "⏸ Anhalten" : "▶ Jahre laufen lassen"}</button>
            <button className="btn-secondary" disabled={laeuft} onClick={() => { for (let i = 0; i < 10; i++) schritt(); setVersion(v => v + 1); }}>⏭ 10 Jahre</button>
            <button className="btn-secondary" onClick={() => { schritt(true); setVersion(v => v + 1); }}>🌊 Sturmflut!</button>
            <button className="btn-secondary" onClick={() => { setLaeuft(false); k.current = neu(); setLetzterSturm(null); setVersion(v => v + 1); }}>↺</button>
          </div>
          <div className={`rounded-lg px-3 py-1.5 font-bold ${sturmJetzt ? "bg-bad/15" : "bg-accent/10"}`}>
            Jahr {z.jahr} · {sturmJetzt ? "🌊 Sturmflut: Wasser +3 m" : "Mittelwasser"}
          </div>
          <label className="text-xs text-muted">🧭 Wind und Wellen aus {richtungName(p.wind)} ({p.wind}°)
            <input type="range" min={90} max={270} step={5} value={p.wind} onChange={x => setP(q => ({ ...q, wind: Number(x.target.value) }))} className="w-full" />
          </label>
          <label className="text-xs text-muted">🌪️ Sturmflut alle {sturmAlle || "–"} Jahre
            <input type="range" min={0} max={30} value={sturmAlle} onChange={x => setSturmAlle(Number(x.target.value))} className="w-full" />
          </label>
          <label className="text-xs text-muted">📈 Meeresspiegel +{p.anstieg.toFixed(1)} m (Klimawandel: bis 2100 etwa +0,3 bis +1 m)
            <input type="range" min={0} max={3} step={0.1} value={p.anstieg} onChange={x => setP(q => ({ ...q, anstieg: Number(x.target.value) }))} className="w-full" />
          </label>
          {typ === "deich" && (
            <label className="text-xs text-muted">🛡️ Deichhöhe {deichHoehe} m (setzt neu)
              <input type="range" min={3} max={10} value={deichHoehe} disabled={laeuft} onChange={x => setDeichHoehe(Number(x.target.value))} className="w-full" />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-bad/10 p-2"><div className="text-lg font-black">{rueckgang(z).toFixed(1)} m</div><div className="text-xs text-muted">Küstenrückgang (Mittel)</div></div>
            <div className="rounded-lg bg-bad/10 p-2"><div className="text-lg font-black">{ueberflutet(z).toFixed(1)} ha</div><div className="text-xs text-muted">Land unter Wasser</div></div>
            <div className="rounded-lg bg-bad/10 p-2"><div className="text-lg font-black">{Math.round(z.abgetragen / 1000)}k m³</div><div className="text-xs text-muted">abgetragen</div></div>
            <div className="rounded-lg bg-accent/10 p-2"><div className="text-lg font-black">{Math.round(z.angelandet / 1000)}k m³</div><div className="text-xs text-muted">angelandet</div></div>
          </div>
          <details className="rounded-lg border border-line p-2">
            <summary className="cursor-pointer font-bold">📘 Was passiert hier?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><b>Steilküste</b>: Die Brandung höhlt den Fuß des Kliffs aus (Brandungshohlkehle), bis die Wand abbricht. Zurück bleibt eine flache <b>Brandungsplatte</b> — sie bremst spätere Wellen, darum wird der Rückgang langsamer.</li>
              <li><b>Flachküste</b>: Wellen laufen schräg an und schieben den Sand die Küste entlang (<b>Strandversatz</b>). Wo es tiefer oder ruhiger wird, setzt er sich ab: <b>Haken</b> und <b>Nehrungen</b>. Der Wind weht trockenen Sand zu <b>Dünen</b> auf.</li>
              <li><b>Marsch mit Deich</b>: Das Land liegt so tief, dass eine Sturmflut es überfluten würde. Der Deich hält, bis Wasser überläuft — dann spült es ihn aus, er bricht.</li>
              <li>Abtrag hier = Ablagerung woanders: Was das Kliff verliert, landet als Sand an anderer Stelle.</li>
            </ul>
          </details>
        </aside>
      </div>
    </div>
  );
}

function richtungName(w: number) {
  const n = ["Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten"];
  return n[Math.round(w / 45) % 8];
}
