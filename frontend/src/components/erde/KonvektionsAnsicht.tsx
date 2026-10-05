"use client";
/**
 * Mantelkonvektion im Querschnitt: der echte Löser (Stokes + Wärme) mit
 * Reglern für Zähigkeit, Heizung und einen Kontinent als Deckel.
 */
import { useEffect, useRef, useState } from "react";
import { JAHRE_JE_ZEITEINHEIT, Konvektion, tempoAusStufe, viskositaetAusRa } from "@/lib/erde/konvektion";
import { glut, mantelFarbe } from "@/lib/erde/farben";
import { zehnHoch } from "./SchichtInfo";

type Heizung = "kern" | "zerfall" | "beides";

const SEITEN = 2.5;
/** Dimensionslose Geschwindigkeit → cm/Jahr (κ/d · Sekunden je Jahr · 100). */
const CM_JE_JAHR = (1e-6 / 2.9e6) * 3.156e7 * 100;

export default function KonvektionsAnsicht() {
  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const loeserRef = useRef<Konvektion | null>(null);
  const teilchenRef = useRef<{ x: number; z: number }[]>([]);
  const [logRa, setLogRa] = useState(5);
  const [heizung, setHeizung] = useState<Heizung>("kern");
  const [deckel, setDeckel] = useState(false);
  const [deckelMitte, setDeckelMitte] = useState(0.5);
  const [farben, setFarben] = useState<"gestein" | "temperatur">("gestein");
  const [pfeile, setPfeile] = useState(false);
  const [laeuft, setLaeuft] = useState(true);
  const [neu, setNeu] = useState(0);
  const [anzeige, setAnzeige] = useState({ nu: 1, jahre: 0, tempo: 0, rate: 0 });
  const [tempoStufe, setTempoStufe] = useState(45);
  const tempoRef = useRef(tempoAusStufe(45));
  tempoRef.current = tempoAusStufe(tempoStufe);
  const optRef = useRef({ farben, pfeile });
  optRef.current = { farben, pfeile };

  // Neuer Löser bei Neustart oder anderer Heizung.
  useEffect(() => {
    const k = new Konvektion({
      ra: 10 ** logRa, seiten: SEITEN,
      kernHeizt: heizung !== "zerfall", zerfall: heizung === "kern" ? 0 : heizung === "zerfall" ? 10 : 4,
      deckel: deckel ? [deckelMitte - 0.17, deckelMitte + 0.17] : null,
    });
    for (let i = 0; i < 40; i++) k.schritt();
    loeserRef.current = k;
    teilchenRef.current = Array.from({ length: 500 }, () => ({ x: Math.random() * SEITEN, z: Math.random() }));
  }, [neu, heizung]); // eslint-disable-line react-hooks/exhaustive-deps

  // Regler, die ohne Neustart wirken.
  useEffect(() => {
    const k = loeserRef.current;
    if (!k) return;
    k.opt.ra = 10 ** logRa;
    k.opt.deckel = deckel ? [deckelMitte - 0.17, deckelMitte + 0.17] : null;
  }, [logRa, deckel, deckelMitte]);

  useEffect(() => {
    let id = 0, bild = 0;
    let messung: [number, number] | null = null;
    const tick = () => {
      id = requestAnimationFrame(tick);
      const k = loeserRef.current, c = leinwandRef.current;
      if (!k || !c) return;
      if (laeuft) {
        // Langsamer heißt kleinere Schritte, nicht seltenere — sonst ruckelt es.
        const f = tempoRef.current, n = Math.max(1, Math.ceil(f));
        for (let s = 0; s < n; s++) {
          const dt = (k.zeitschritt() * f) / n;
          k.schritt(dt);
          for (const t of teilchenRef.current) {
            const [u, w] = k.geschwindigkeit(t.x, t.z);
            t.x += u * dt; t.z += w * dt;
            if (t.x < 0 || t.x > SEITEN || t.z < 0 || t.z > 1 || Math.random() < 0.002) { t.x = Math.random() * SEITEN; t.z = Math.random(); }
          }
        }
      }
      zeichne(c, k, teilchenRef.current, optRef.current.farben, optRef.current.pfeile);
      if (++bild % 10 === 0) {
        const jahre = (k.zeit * JAHRE_JE_ZEITEINHEIT) / 1e6, jetzt = performance.now();
        const rate = messung ? (jahre - messung[1]) / Math.max(1e-3, (jetzt - messung[0]) / 1000) : 0;
        messung = [jetzt, jahre];
        setAnzeige({ nu: k.nusselt(), jahre, tempo: k.maxTempo() * CM_JE_JAHR, rate: Math.max(0, rate) });
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [laeuft]);

  function klick(e: React.PointerEvent<HTMLCanvasElement>) {
    const k = loeserRef.current, c = leinwandRef.current;
    if (!k || !c) return;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SEITEN;
    const z = 1 - (e.clientY - r.top) / r.height;
    k.heizeFleck(x, z, e.shiftKey || e.button === 2 ? -0.5 : 0.5);
    k.stokes();
  }

  const eta = viskositaetAusRa(10 ** logRa);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <canvas ref={leinwandRef} width={1000} height={400} onPointerDown={klick} onContextMenu={e => e.preventDefault()}
            className="w-full rounded-2xl border border-(--border) cursor-crosshair touch-none" />
          <div className="absolute left-2 top-2 text-[11px] text-white bg-black/50 rounded-sm px-2 py-0.5 pointer-events-none">Lithosphäre (kalt, oben)</div>
          <div className="absolute left-2 bottom-2 text-[11px] text-white bg-black/50 rounded-sm px-2 py-0.5 pointer-events-none">Kern-Mantel-Grenze (heiß, unten) · 2900 km</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Wert k="Modellzeit" v={`${Math.round(anzeige.jahre).toLocaleString("de-DE")} Mio. Jahre (${anzeige.rate.toLocaleString("de-DE", { maximumFractionDigits: anzeige.rate < 10 ? 1 : 0 })} Mio. J/s)`} />
          <Wert k="schnellste Strömung" v={`${anzeige.tempo.toLocaleString("de-DE", { maximumFractionDigits: 1 })} cm/Jahr`} />
          <Wert k="Wärmetransport" v={`${anzeige.nu.toLocaleString("de-DE", { maximumFractionDigits: 1 })} × Wärmeleitung`} />
        </div>
      </div>
      <aside className="flex flex-col gap-3 text-sm">
        <section className="rounded-2xl border border-(--border) bg-(--surface) p-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="flex justify-between"><b>Zähigkeit des Mantels</b><span>≈ {zehnHoch(Math.log10(eta))} Pa·s</span></span>
            <input type="range" min={2.5} max={7} step={0.1} value={logRa} onChange={e => setLogRa(+e.target.value)} />
            <span className="flex justify-between text-xs text-(--text-muted)"><span>zäher</span><span>Rayleigh-Zahl {zehnHoch(logRa)}</span><span>flüssiger</span></span>
          </label>
          <label className="flex flex-col gap-1">
            <b>Tempo</b>
            <span className="flex items-center gap-2"><span>🐢</span>
              <input type="range" min={0} max={100} value={tempoStufe} onChange={e => setTempoStufe(+e.target.value)} className="flex-1" />
              <span>🐇</span></span>
          </label>
          <div className="flex flex-col gap-1">
            <b>Was heizt?</b>
            <div className="flex flex-wrap gap-1">
              {([["kern", "der Kern"], ["zerfall", "Radioaktivität"], ["beides", "beides"]] as [Heizung, string][]).map(([id, l]) => (
                <button key={id} onClick={() => setHeizung(id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${heizung === id ? "bg-(--accent) text-(--accent-text,#111)" : "border border-(--border)"}`}>{l}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={deckel} onChange={e => setDeckel(e.target.checked)} />
            <b>Kontinent als Deckel</b>
          </label>
          {deckel && (
            <input type="range" min={0.2} max={0.8} step={0.01} value={deckelMitte} onChange={e => setDeckelMitte(+e.target.value)} />
          )}
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setFarben(f => f === "gestein" ? "temperatur" : "gestein")} className="px-2.5 py-1 rounded-lg text-xs font-bold border border-(--border)">
              Farben: {farben === "gestein" ? "Gestein" : "Temperatur"}
            </button>
            <button onClick={() => setPfeile(p => !p)} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${pfeile ? "bg-(--accent) text-(--accent-text,#111)" : "border border-(--border)"}`}>➜ Strömungspfeile</button>
            <button onClick={() => setLaeuft(l => !l)} className="px-2.5 py-1 rounded-lg text-xs font-bold border border-(--border)">{laeuft ? "⏸ Pause" : "▶ weiter"}</button>
            <button onClick={() => setNeu(n => n + 1)} className="px-2.5 py-1 rounded-lg text-xs font-bold border border-(--border)">↻ neu</button>
          </div>
          <p className="text-xs text-(--text-muted)">Ins Bild tippen: heißer Fleck (Plume). Mit Umschalt oder Rechtsklick: kalter Fleck (abtauchende Platte).</p>
        </section>
        <section className="rounded-2xl border border-(--border) bg-(--surface) p-3 leading-relaxed flex flex-col gap-1">
          <b>Was hier passiert</b>
          <p>Unten heizt der Kern den Mantel, dazu wärmt der Zerfall radioaktiver Stoffe. Warmes Gestein ist leichter und steigt in <b>Säulen (Plumes)</b> auf, kaltes sinkt als <b>Vorhänge</b> ab — obwohl der Mantel fest ist. Es geht nur wenige Zentimeter pro Jahr, so schnell wie Fingernägel wachsen.</p>
          <p>Ist der Mantel zu zäh (Rayleigh-Zahl unter ≈ 660), bleibt es bei reiner Wärmeleitung. Der echte Mantel liegt bei 10⁷–10⁸ und strömt kräftig.</p>
          <p>Ein <b>Kontinent</b> wirkt wie eine Bettdecke: Darunter staut sich Wärme, bis dort Gestein aufsteigt — so können Superkontinente auseinanderbrechen (Wilson-Zyklus).</p>
        </section>
      </aside>
    </div>
  );
}

function Wert({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-(--border) bg-(--surface) px-3 py-1.5">
      <div className="text-[11px] text-(--text-muted)">{k}</div>
      <div className="font-bold">{v}</div>
    </div>
  );
}

let hilf: HTMLCanvasElement | null = null;

function zeichne(c: HTMLCanvasElement, k: Konvektion, teilchen: { x: number; z: number }[], farben: string, pfeile: boolean) {
  const ctx = c.getContext("2d")!;
  const W = k.nx + 1, H = k.nz + 1;
  if (!hilf || hilf.width !== W || hilf.height !== H) { hilf = document.createElement("canvas"); hilf.width = W; hilf.height = H; }
  const hctx = hilf.getContext("2d")!;
  const bild = hctx.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const T = Math.min(1, Math.max(0, k.T[j * W + i]));
    const f = farben === "temperatur" ? glut((1300 + T * 2400) / 5600) : mantelFarbe(T);
    const p = ((H - 1 - j) * W + i) * 4;
    bild.data[p] = f[0] * 255; bild.data[p + 1] = f[1] * 255; bild.data[p + 2] = f[2] * 255; bild.data[p + 3] = 255;
  }
  hctx.putImageData(bild, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(hilf, 0, 0, c.width, c.height);

  const sx = c.width / k.opt.seiten, sy = c.height;
  ctx.fillStyle = "rgba(255,248,230,0.75)";
  for (const t of teilchen) ctx.fillRect(t.x * sx - 1.2, (1 - t.z) * sy - 1.2, 2.4, 2.4);

  if (pfeile) {
    const m = Math.max(1e-9, k.maxTempo());
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.3;
    for (let x = 0.08; x < k.opt.seiten; x += 0.14) for (let z = 0.08; z < 1; z += 0.14) {
      const [u, w] = k.geschwindigkeit(x, z);
      const l = 34 * Math.sqrt(Math.hypot(u, w) / m);
      if (l < 3) continue;
      const a = Math.atan2(-w, u);
      const x0 = x * sx, y0 = (1 - z) * sy, x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.lineTo(x1 - 6 * Math.cos(a - 0.4), y1 - 6 * Math.sin(a - 0.4));
      ctx.moveTo(x1, y1); ctx.lineTo(x1 - 6 * Math.cos(a + 0.4), y1 - 6 * Math.sin(a + 0.4));
      ctx.stroke();
    }
  }
  const d = k.opt.deckel;
  if (d) {
    ctx.fillStyle = "#8a6a4f";
    ctx.fillRect(d[0] * c.width, 0, (d[1] - d[0]) * c.width, 14);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Kontinent", ((d[0] + d[1]) / 2) * c.width, 11);
  }
}
