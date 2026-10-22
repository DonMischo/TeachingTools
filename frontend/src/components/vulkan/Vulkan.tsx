"use client";
/**
 * Vulkane — Schildvulkan und Schichtvulkan wachsen Ausbruch für Ausbruch.
 * Die Form ist nicht vorgegeben: Sie entsteht aus Kieselsäure- und
 * Gasgehalt des Magmas (Modell in lib/vulkan/modell.ts). Karte von oben,
 * Querschnitt mit allen Schichten und 3D-Flug (Voxel Space wie bei der Erosion).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { wahl as vorgabeWahl, type Vorgabe } from "@/lib/vorgabe";
import {
  ausbrechen, caldera, explosivAnteil, hotspotPhase, jahreJeAusbruch, kennzahlen, lavaWerte, schritt, STOFFE, TYPEN, vulkanStart,
  type Magma, type Stoff, type TypId, type Vulkan as VulkanZustand,
} from "@/lib/vulkan/modell";
import { kartenFarben, kraterseen, schnittLinie, vulkanMarken, zeichneQuerschnitt, type SchnittGeometrie } from "@/lib/vulkan/zeichnen";
import { quelleSetzen, sandBild, sandSchritt, sandStart, setzeBoden, wolkeSchritt, wolkeStart, wolkeZeichnen } from "@/lib/vulkan/sand";
import type { VoxelKarte } from "@/lib/gelaende/voxel";
import VoxelFlug from "@/components/gelaende/VoxelFlug";
import { voxelAusGitter } from "@/components/gelaende/voxelGitter";
import Formschilder from "@/components/gelaende/Formschilder";
import FotoGalerie, { BildStreifen } from "@/components/galerie/FotoGalerie";
import { BEREICHE, bilderZuTyp, GALERIE, nachweisFuer } from "@/lib/vulkan/galerie";
import { WISSEN_ZU_STOFF } from "@/lib/vulkan/wissen";
import VulkanWissen from "./VulkanWissen";

type Wahl = TypId | "eigen";
const SCHNITT_W = 800, SCHNITT_H = 640;
/** Teilchengitter über dem Querschnitt: 4 × 4 Pixel je Zelle */
const SAND_PX = 4, SAND_W = SCHNITT_W / SAND_PX, SAND_H = SCHNITT_H / SAND_PX;
const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

const REGLER: { k: keyof Magma; label: string; min: number; max: number; step: number; text: string; zeige: (x: number) => string }[] = [
  { k: "sio2", label: "🧪 Kieselsäure (SiO₂)", min: 45, max: 75, step: 1, text: "Viel SiO₂ macht das Magma zäh — wie Honig statt Wasser.", zeige: x => `${x} % · ${x < 53 ? "Basalt" : x < 63 ? "Andesit" : x < 68 ? "Dazit" : "Rhyolith"}` },
  { k: "gas", label: "💨 Gasgehalt", min: 0, max: 6, step: 0.1, text: "Gelöstes Wasser und CO₂. In zähem Magma kann das Gas nicht entweichen — es zerreißt das Magma zu Asche.", zeige: x => `${x.toFixed(1)} %` },
  { k: "menge", label: "📦 Fördermenge je Ausbruch", min: 0.3, max: 2, step: 0.1, text: "Wie viel Magma bei einem Ausbruch herauskommt.", zeige: x => `${(x * 0.9).toFixed(1)} km³` },
  { k: "flanke", label: "↘️ Flanken- und Spaltenausbrüche", min: 0, max: 0.8, step: 0.05, text: "Wie oft sich das Magma einen Weg an der Seite sucht statt durch den Gipfel.", zeige: x => `${Math.round(x * 100)} %` },
  { k: "windAus", label: "🧭 Wind aus", min: 0, max: 355, step: 5, text: "Aus dieser Richtung weht der Wind; die Aschefahne zieht auf die andere Seite.", zeige: x => ["N", "NO", "O", "SO", "S", "SW", "W", "NW"][Math.round(x / 45) % 8] },
  { k: "wind", label: "🌬️ Windstärke", min: 0, max: 2, step: 0.1, text: "Starker Wind trägt Asche weit fort.", zeige: x => (x < 0.3 ? "still" : x < 1.2 ? "mäßig" : "stark") },
];

/** Zähigkeit zum Anfassen */
function vergleich(eta: number) {
  if (eta < 1e3) return "wie Ketchup";
  if (eta < 1e5) return "wie Erdnussbutter";
  if (eta < 1e7) return "wie Teer";
  return "wie kalter Asphalt";
}

const LEGENDE: Stoff[] = ["basalt", "andesit", "rhyolith", "schlacke", "asche", "ignimbrit", "schutt"];

/** `vorgabe` (TaskCrawler-Station): { typ: "schild" | "schicht", untergrund: "land" | "meer" } */
export default function Vulkan({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festTyp = vorgabeWahl(vorgabe, "typ", TYPEN.map(t => t.id));
  const [typ, setTyp] = useState<Wahl>(festTyp ?? "schild");
  const [magma, setMagma] = useState<Magma>({ ...(TYPEN.find(t => t.id === (festTyp ?? "schild"))!.magma) });
  const [meer, setMeer] = useState(vorgabeWahl(vorgabe, "untergrund", ["land", "meer"] as const) === "meer");
  const [seed, setSeed] = useState(7);
  // Hotspot ist ein eigener Maßstab (320 km, wandernde Platte) — bleibt beim Mischen des Magmas erhalten
  const [hotspot, setHotspot] = useState(festTyp === "hotspot");
  const zustand = useRef<VulkanZustand>(vulkanStart(seed, meer, hotspot));
  const [version, setVersion] = useState(0);
  const [dauer, setDauer] = useState(false);
  const [raffer, setRaffer] = useState(0);
  const [tempo, setTempo] = useState(6);
  const [drei, setDrei] = useState(false);
  const [schilder, setSchilder] = useState(true);
  const [winkel, setWinkel] = useState(0);
  /** Simulation, Fotogalerie oder Wissen */
  const [seite, setSeite] = useState<"sim" | "galerie" | "wissen">("sim");
  const [wissenId, setWissenId] = useState("tephra");
  const wissenZeigen = (id: string) => { setWissenId(id); setSeite("wissen"); };
  const karteRef = useRef<HTMLCanvasElement>(null);
  const schnittRef = useRef<HTMLCanvasElement>(null);
  const [ueberhoehung, setUeberhoehung] = useState(1);
  // Ausbruch zum Zusehen: fallender Sand über dem Querschnitt, Aschewolke über der Karte
  const sandRef = useRef(sandStart(SAND_W, SAND_H));
  const wolkeRef = useRef(wolkeStart());
  const geoRef = useRef<SchnittGeometrie | null>(null);
  const sandCv = useRef<HTMLCanvasElement>(null);
  const wolkeCv = useRef<HTMLCanvasElement>(null);
  const winkelRef = useRef(winkel);
  winkelRef.current = winkel;

  const neu = (s = seed, m = meer, h = hotspot) => { zustand.current = vulkanStart(s, m, h); setDauer(false); setRaffer(0); setVersion(x => x + 1); };
  useEffect(() => { neu(seed, meer, hotspot); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [seed, meer, hotspot]);

  const magmaRef = useRef(magma);
  magmaRef.current = magma;
  const rafferRef = useRef(raffer);
  rafferRef.current = raffer;
  const laeuft = dauer || raffer > 0;

  const dauerRef = useRef(dauer);
  dauerRef.current = dauer;
  const tempoRef = useRef(tempo);
  tempoRef.current = tempo;
  // Rechnen: läuft ein Ausbruch, fließt die Lava; sonst beginnt (Dauerbetrieb / Zeitraffer) der nächste
  useEffect(() => {
    let raf = 0, bild = 0;
    const lauf = () => {
      const v = zustand.current, t = performance.now();
      let tat = true;
      if (rafferRef.current > 0) {
        while (performance.now() - t < 30 && rafferRef.current > 0) {
          if (!v.ausbruch) ausbrechen(v, magmaRef.current);
          for (let i = 0; i < 40 && v.ausbruch; i++) schritt(v);
          if (!v.ausbruch) { rafferRef.current--; setRaffer(rafferRef.current); }
        }
      } else if (v.ausbruch) {
        // die Aschephase langsam (jedes zweite Bild ein Schritt), damit man die Säule sieht
        bild++;
        const n = v.ausbruch.asche ? bild % 2 : tempoRef.current;
        for (let i = 0; i < n && v.ausbruch && performance.now() - t < 30; i++) schritt(v);
      } else if (dauerRef.current) ausbrechen(v, magmaRef.current);
      else if (v.wolke) schritt(v);
      else tat = false;
      if (tat) setVersion(x => x + 1);
      if (rafferRef.current === 0) teilchen(v);
      raf = requestAnimationFrame(lauf);
    };
    raf = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** ein Schritt der Teilchen: Quelle aus dem Ausbruchszustand, Wind aus den Reglern */
  function teilchen(v: VulkanZustand) {
    const s = sandRef.current, geo = geoRef.current, m = magmaRef.current, a = v.ausbruch;
    const calderaJetzt = !!v.wolke?.gross && v.wolke.alter < 60;
    // tief unter Wasser: keine Säule (der Wasserdruck unterdrückt Explosionen)
    const explosiv = a?.asche && a.wasser !== "tief" ? a.explosiv : calderaJetzt ? 1 : 0;
    const lava = a && !a.asche && a.rest > 0 && a.stoff === "basalt" ? 0.6 : 0;
    const glut = calderaJetzt || (!!a?.asche && a.explosiv > 0.45 && a.asche.rest < a.asche.proSchritt * 15);
    const wr = ((m.windAus + 180) * Math.PI) / 180, sw = (winkelRef.current * Math.PI) / 180;
    // Windanteil entlang des Schnitts A→B
    const entlang = (Math.sin(wr) * Math.cos(sw) - Math.cos(wr) * Math.sin(sw)) * m.wind * 0.35;
    let ort = geo?.schlot ?? null;
    // Schlot unter dem Meer: die Säule bricht an der Wasseroberfläche durch
    if (ort && geo) ort = { x: ort.x, y: Math.min(ort.y, geo.oberflaeche[Math.max(0, Math.min(geo.oberflaeche.length - 1, Math.round(ort.x / 2)))]) };
    if (!ort && calderaJetzt && geo) ort = { x: geo.mitteX, y: geo.oberflaeche[Math.max(0, Math.min(geo.oberflaeche.length - 1, Math.round(geo.mitteX / 2)))] };
    const aktiv = ort && (explosiv > 0 || lava > 0 || glut);
    quelleSetzen(s, aktiv ? { x: ort!.x / SAND_PX, y: ort!.y / SAND_PX, explosiv, lava, glut, dampf: a?.wasser === "flach" } : null, entlang);
    if (s.quelle || s.anzahl > 0) {
      sandSchritt(s);
      const c = sandCv.current;
      if (c) { const ctx = c.getContext("2d")!; const b = ctx.createImageData(SAND_W, SAND_H); sandBild(s, b); ctx.putImageData(b, 0, 0); }
    }
    const w = wolkeRef.current;
    const sc = a?.schlot ?? (calderaJetzt ? { i: v.n / 2, j: v.n / 2 } : null);
    const menge = a?.asche && a.wasser !== "tief" ? Math.round(3 + 14 * a.explosiv) : calderaJetzt ? 30 : 0;
    if (sc && menge) wolkeSchritt(w, sc.i + 0.5, sc.j + 0.5, menge, wr, m.wind);
    else if (w.n) wolkeSchritt(w, 0, 0, 0, wr, m.wind);
    const wc = wolkeCv.current;
    if (wc && (w.n || menge)) wolkeZeichnen(wc.getContext("2d")!, w, wc.width / v.n);
    else if (wc && wc.dataset.leer !== "1") { wc.getContext("2d")!.clearRect(0, 0, wc.width, wc.height); }
    if (wc) wc.dataset.leer = w.n ? "0" : "1";
  }

  const v = zustand.current;
  const ruhig = !v.ausbruch;
  // Kraterseen nur in Ruhe suchen (Priority-Flood)
  const seen = useMemo(() => (ruhig && !laeuft ? kraterseen(v) : new Uint8Array(v.n * v.n)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ruhig, laeuft, v, v.nr]);

  useEffect(() => {
    const c = karteRef.current;
    if (!c || drei) return;
    c.width = v.n; c.height = v.n;
    const ctx = c.getContext("2d")!;
    const b = ctx.createImageData(v.n, v.n);
    b.data.set(kartenFarben(v, seen));
    ctx.putImageData(b, 0, 0);
  }, [version, v, seen, drei]);

  useEffect(() => {
    const c = schnittRef.current;
    if (!c) return;
    // im Zeitraffer nicht jedes Bild neu
    if (raffer > 0 && version % 4) return;
    const geo = zeichneQuerschnitt(c.getContext("2d")!, v, { winkel: (winkel * Math.PI) / 180, beschriften: schilder });
    geoRef.current = geo;
    setUeberhoehung(geo.ueberhoehung);
    // Boden für die Teilchen: höchste Oberkante je Sandspalte
    const boden = new Float32Array(SAND_W), je = SAND_PX / 2;
    for (let i = 0; i < SAND_W; i++) {
      let y = Infinity;
      for (let q = 0; q < je; q++) y = Math.min(y, geo.oberflaeche[i * je + q] ?? Infinity);
      boden[i] = y / SAND_PX;
    }
    setzeBoden(sandRef.current, boden);
  }, [version, v, winkel, schilder, raffer]);

  const voxelStand = Math.floor(version / 10);
  const karte3d = useMemo<VoxelKarte | null>(() => {
    if (!drei) return null;
    const N = v.n * v.n, h = new Float32Array(N);
    for (let k = 0; k < N; k++) h[k] = v.G[k] + v.L[k];
    const farbe = kartenFarben(v, seen);
    return voxelAusGitter(h, farbe, v.n, v.zelle, 512, 1.2, v.meer ?? -Infinity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drei, voxelStand, v, seen]);

  const kz = useMemo(() => kennzahlen(v, magma.sio2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(version / 15), v.nr, ruhig, magma.sio2, v]);
  const marken = useMemo(() => (schilder ? vulkanMarken(v, seen) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schilder, Math.floor(version / 10), v, seen]);
  const lw = lavaWerte(magma.sio2);
  const explosiv = explosivAnteil(magma);
  const linie = schnittLinie(v, (winkel * Math.PI) / 180);
  const a = v.ausbruch;
  const hp = v.platte ? hotspotPhase(v) : null;

  const typWaehlen = (t: TypId) => { setTyp(t); setMagma({ ...TYPEN.find(x => x.id === t)!.magma }); setHotspot(t === "hotspot"); neu(seed, meer, t === "hotspot"); };
  const beschreibung = typ === "eigen" ? "Eigenes Magma: Schiebe Kieselsäure und Gas und schau, welche Form entsteht." : TYPEN.find(t => t.id === typ)!.text;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🌋 Vulkane</h1>
          <p className="text-muted text-sm mt-1">Schildvulkan oder Schichtvulkan? Das entscheidet das Magma: Ausbruch für Ausbruch wächst der Berg — aus dünnflüssiger Lava, zäher Lava und Asche.</p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!festTyp && (
          <div className="inline-flex flex-wrap rounded-xl border border-line p-1 bg-surface">
            {TYPEN.map(t => <button key={t.id} onClick={() => typWaehlen(t.id)} className={chip(typ === t.id)}>{t.icon} {t.label}</button>)}
            <button onClick={() => setTyp("eigen")} className={chip(typ === "eigen")}>🧪 Eigenes Magma</button>
          </div>
        )}
        <div className="inline-flex rounded-xl border border-line p-1 bg-surface">
          <button className={chip(!meer && !hotspot)} disabled={laeuft || hotspot} onClick={() => setMeer(false)}>🌾 Auf dem Land</button>
          <button className={chip(meer || hotspot)} disabled={laeuft || hotspot} onClick={() => setMeer(true)}>🌊 Im Meer</button>
        </div>
        <button className="btn-secondary py-1.5" disabled={laeuft} onClick={() => setSeed(Math.floor(Math.random() * 1e9))} title="Neuer Untergrund">🎲 Neuer Untergrund</button>
        <button className={`btn-secondary py-1.5 ${seite === "galerie" ? "bg-accent text-accent-fg" : ""}`} onClick={() => setSeite(x => (x === "galerie" ? "sim" : "galerie"))} title="Fotos echter Vulkane mit Erklärung">📷 Echte Vulkane</button>
        <button className={`btn-secondary py-1.5 ${seite === "wissen" ? "bg-accent text-accent-fg" : ""}`} onClick={() => setSeite(x => (x === "wissen" ? "sim" : "wissen"))} title="Asche, Lapilli, Bomben, Ausbruchsarten, Lava, Gefahren">📚 Wissen</button>
        {seite !== "sim" && <button className="btn-primary py-1.5" onClick={() => setSeite("sim")}>🌋 Zur Simulation</button>}
      </div>
      {seite === "wissen" && <VulkanWissen eintrag={wissenId} waehlen={setWissenId} />}
      {seite === "galerie" && (
        <FotoGalerie bilder={GALERIE} bereiche={BEREICHE} nachweisFuer={nachweisFuer}
          einleitung="So sehen die Vulkane aus, die hier wachsen: steile Schichtvulkane, flache Schilde, Ausbrüche mit Aschesäule und Glutwolken, Hawaii über seinem Hotspot — und Vulkane in Deutschland. Antippen vergrößert; mit ← → blätterst du." />
      )}
      <div className={seite !== "sim" ? "hidden" : "contents"}>
      <p className="text-sm text-muted -mt-2">{beschreibung}</p>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 grid gap-3 xl:grid-cols-2 content-start">
          <div className="min-w-0">
            {drei && karte3d ? <VoxelFlug karte={karte3d} /> : (
              <div className="relative w-full">
                {v.platte && <div className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-black/55 px-2 py-0.5 text-xs font-bold text-white">← Pazifische Platte, 9 cm/Jahr · Ausschnitt 320 km</div>}
                <canvas ref={karteRef} className="aspect-square w-full rounded-xl border border-line" aria-label="Vulkan von oben" />
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${v.n} ${v.n}`} preserveAspectRatio="none">
                  <line x1={linie.a.x} y1={linie.a.y} x2={linie.b.x} y2={linie.b.y} stroke="white" strokeWidth={0.6} strokeDasharray="2 1.5" opacity={0.85} />
                  <text x={linie.a.x + 1} y={linie.a.y - 1.5} fontSize={4} fill="white" stroke="black" strokeWidth={0.2}>A</text>
                  <text x={linie.b.x - 4} y={linie.b.y - 1.5} fontSize={4} fill="white" stroke="black" strokeWidth={0.2}>B</text>
                </svg>
                <canvas ref={wolkeCv} width={640} height={640} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
                {schilder && <Formschilder marken={marken} n={v.n} />}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              <button className={`chip ${!drei ? "chip-on" : ""}`} onClick={() => setDrei(false)}>🗺️ Karte</button>
              <button className={`chip ${drei ? "chip-on" : ""}`} onClick={() => setDrei(true)}>🛩️ 3D-Flug</button>
              <button className={`chip ${schilder ? "chip-on" : ""}`} onClick={() => setSchilder(x => !x)}>✨ Beschriften</button>
            </div>
          </div>
          <div className="min-w-0">
            <div className="relative">
              <canvas ref={schnittRef} width={SCHNITT_W} height={SCHNITT_H} className="block w-full rounded-xl border border-line" aria-label="Querschnitt durch den Vulkan" />
              <canvas ref={sandCv} width={SAND_W} height={SAND_H} className="pointer-events-none absolute inset-0 h-full w-full rounded-xl [image-rendering:pixelated]" aria-hidden />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
              <label className="flex items-center gap-2">🔪 Schnitt A–B drehen
                <input type="range" min={0} max={175} step={5} value={winkel} onChange={x => setWinkel(Number(x.target.value))} className="w-32" />
              </label>
              <span>Überhöhung × {ueberhoehung.toFixed(1)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-label="Legende">
              {LEGENDE.map(s => (
                <button key={s} className="flex items-center gap-1 hover:text-fg hover:underline" title={`${STOFFE[s].text} — mehr im Wissen`} onClick={() => wissenZeigen(WISSEN_ZU_STOFF[s])}>
                  <span className="inline-block h-3 w-5 rounded-sm border border-line" style={{ background: `rgb(${STOFFE[s].farbe.join(",")})` }} />{STOFFE[s].label}
                </button>
              ))}
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded-sm border border-line" style={{ background: "rgb(122,112,104)" }} />Grundgebirge</span>
            </div>
          </div>
        </div>

        <aside className="card flex flex-col gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => { setRaffer(0); setDauer(d => !d); }}>{dauer ? "⏸ Anhalten" : "▶ Ausbrüche"}</button>
            <button className="btn-secondary" disabled={laeuft || !!a} onClick={() => { ausbrechen(v, magma); setVersion(x => x + 1); }}>💥 Ein Ausbruch</button>
            <button className="btn-secondary" disabled={laeuft} onClick={() => { setDauer(false); setRaffer(10); }} title="10 Ausbrüche schnell hintereinander">⏩ 10 Ausbrüche</button>
            <button className="btn-secondary" disabled={laeuft || v.nr < 5 || kz.hoehe < 300} onClick={() => { caldera(v, magma); setVersion(x => x + 1); }} title="Riesiger Ausbruch: Die Magmakammer leert sich, der Gipfel bricht ein">🕳️ Caldera</button>
            <button className="btn-secondary" onClick={() => neu()}>↺ Neu</button>
          </div>
          <div className={`rounded-lg px-3 py-2 ${a ? "bg-bad/10" : "bg-accent/10"}`}>
            {a ? (
              <>
                <div className="font-bold">🌋 Ausbruch {a.nr} · {a.schlot.art === "gipfel" ? "Gipfelkrater" : a.schlot.art === "spalte" ? "Spalte an der Flanke" : "Nebenkrater"}</div>
                <div className="text-xs text-muted">{Math.round(a.explosiv * 100)} % explosiv (Asche) · {a.rest > 0 ? "Lava tritt aus" : "Lava kühlt ab und erstarrt"}</div>
                {a.wasser === "flach" && <div className="text-xs mt-1">💨 Im flachen Meer: Wasser verdampft schlagartig — Dampf- und Aschesäule (surtseyanisch, wie Surtsey 1963 oder Hunga Tonga 2022).</div>}
                {a.wasser === "tief" && <div className="text-xs mt-1">🌊 Tief unter Wasser: Der Wasserdruck verhindert Explosionen — keine Aschesäule, die Lava quillt als Kissenlava.</div>}
              </>
            ) : (
              <div className="font-bold">😴 Ruhe · {v.nr} Ausbrüche bisher{raffer > 0 ? ` · ⏩ noch ${raffer}` : ""}</div>
            )}
            {v.platte && (
              <div className="text-xs mt-1 flex flex-col gap-0.5">
                <span>{v.nr === 0 ? "🔥 Über dem Hotspot ist noch flacher Meeresboden, 3000 m tief. Westlich liegen ältere Inseln — starte die Ausbrüche!" : hp!.phase === "seamount" ? `🌊 Der junge Vulkan wächst unter Wasser — Gipfel ${Math.round(-hp!.gipfel)} m tief.` : hp!.phase === "flach" ? `💨 Gipfel nur ${Math.round(-hp!.gipfel)} m unter dem Meer: Dampfexplosionen (surtseyanisch).` : `🏝️ Die junge Insel ist ${Math.round(hp!.gipfel)} m hoch.`}</span>
                <span className="text-muted">Nachschub aus dem Plume: {hp!.schub > 0.6 ? "stark" : hp!.schub > 0.25 ? "mittel" : "schwach — die Platte trägt den Vulkan fort, bis der nächste Schub kommt"} · 1 Ausbruch ≈ {Math.round(jahreJeAusbruch(v) / 1000)} 000 Jahre · Platte bisher {((v.nr * jahreJeAusbruch(v)) / 1e6).toFixed(1).replace(".", ",")} Mio. Jahre gewandert</span>
              </div>
            )}
          </div>
          <label className="text-xs text-muted">⏱️ Tempo: {tempo} Schritte je Bild
            <input type="range" min={1} max={20} value={tempo} onChange={x => setTempo(Number(x.target.value))} className="w-full" />
          </label>
          {REGLER.map(r => (
            <label key={r.k} className="text-xs text-muted" title={r.text}>{r.label}: <b className="text-fg">{r.zeige(magma[r.k])}</b>
              <input type="range" min={r.min} max={r.max} step={r.step} value={magma[r.k]}
                onChange={x => { setMagma(m => ({ ...m, [r.k]: Number(x.target.value) })); if (r.k === "sio2" || r.k === "gas") setTyp("eigen"); }} className="w-full" />
            </label>
          ))}
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-line p-2 text-center text-xs">
            <div><div className="font-black text-base">{Math.round(lw.t0)} °C</div><div className="text-muted">Temperatur</div></div>
            <div title={`Zähigkeit ${lw.eta.toExponential(0)} Pa·s`}><div className="font-black text-base">10<sup>{Math.round(Math.log10(lw.eta))}</sup></div><div className="text-muted">Pa·s · {vergleich(lw.eta)}</div></div>
            <div><div className="font-black text-base">{Math.round(explosiv * 100)} %</div><div className="text-muted">explosiv</div></div>
          </div>
          <div className="rounded-lg bg-accent/15 p-3">
            <div className="text-xs text-muted">So sieht er aus:</div>
            <div className="text-lg font-black">{kz.form.label}</div>
            <div className="text-xs">{kz.form.text}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-surface-hover p-2"><div className="text-lg font-black">{Math.round(kz.hoehe)} m</div><div className="text-xs text-muted">Höhe über Umland</div></div>
            <div className="rounded-lg bg-surface-hover p-2"><div className="text-lg font-black">{(kz.durchmesser / 1000).toFixed(1)} km</div><div className="text-xs text-muted">Durchmesser</div></div>
            <div className="rounded-lg bg-surface-hover p-2"><div className="text-lg font-black">{kz.neigung.toFixed(0)}°</div><div className="text-xs text-muted">mittlere Hangneigung</div></div>
            <div className="rounded-lg bg-surface-hover p-2"><div className="text-lg font-black">{Math.round(kz.tephraAnteil * 100)} %</div><div className="text-xs text-muted">Asche/Schlacke</div></div>
            <div className="rounded-lg bg-surface-hover p-2"><div className="text-lg font-black">{kz.volumen.toFixed(1)} km³</div><div className="text-xs text-muted">Volumen</div></div>
            <div className="rounded-lg bg-surface-hover p-2"><div className="text-lg font-black">{v.schichten.length}</div><div className="text-xs text-muted">Schichten</div></div>
          </div>
          <details className="rounded-lg border border-line p-2">
            <summary className="cursor-pointer font-bold">📘 Was passiert hier?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>In der <b>Magmakammer</b> sammelt sich Magma. Bei einem Ausbruch steigt es durch den <b>Schlot</b> — oder durch einen Gang zu einem <b>Nebenkrater</b> bzw. einer <b>Spalte</b>.</li>
              <li><b>Wenig Kieselsäure</b> (Basalt): heiß und dünnflüssig. Gas entweicht leicht, die Lava fließt kilometerweit und erstarrt in dünnen Decken → flacher <b>Schildvulkan</b>.</li>
              <li><b>Viel Kieselsäure</b> (Andesit): kühler und zäh. Das Gas kann nicht entweichen und zerreißt das Magma zu <b>Asche</b>. Sie fällt um den Krater und mit dem Wind. Zähe Lava fließt nur kurz.</li>
              <li>Lockere Asche rutscht ab, bis der Hang etwa 33° steil ist. Erst die <b>Lava dazwischen</b> verkittet sie — so entsteht ein steiler <b>Schichtvulkan</b> aus Asche- und Lavaschichten.</li>
              <li>Lava kühlt an der Luft ab (dünne Ränder zuerst), im <b>Meer</b> sehr schnell. Junge Lava ist dunkel, alte wird grün.</li>
              <li>Leert sich die Magmakammer bei einem Riesenausbruch, sackt der Gipfel ein: eine <b>Caldera</b>. Glutwolken (Ignimbrit) füllen die Täler.</li>
            </ol>
            <p className="mt-2 text-muted">Ein »Ausbruch« steht hier für eine ganze Ausbruchsphase (Jahrhunderte). Lava fließt nach dem Bingham-Modell: erst ab einer Mindestdicke, die mit der Zähigkeit wächst.</p>
          </details>
        </aside>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-sm font-bold">📷 So sieht das in echt aus</div>
        <BildStreifen bilder={bilderZuTyp(hotspot ? "hotspot" : typ !== "eigen" ? typ : magma.sio2 < 54 ? "schild" : "schicht")} nachweisFuer={nachweisFuer} />
      </div>
      <p className="text-xs text-muted">Eigenes, vereinfachtes Modell für den Unterricht (Lava als Zellautomat nach dem Bingham-Modell wie bei SCIARA/MAGFLOW, Asche als Ring + Windfahne). Ausbruchswolke als fallender Sand nach dem Vorbild von <a className="underline" href="https://github.com/MaxBittker/sandspiel" target="_blank" rel="noreferrer">Sandspiel</a> (Max Bittker, MIT); Gelände, Kraterseen und 3D-Flug aus der Erosion (<a className="underline" href="https://github.com/s-macke/VoxelSpace" target="_blank" rel="noreferrer">Voxel Space</a>, MIT) — alles neu geschrieben. Fotos: Wikimedia Commons, Nachweis an jedem Bild.</p>
      </div>
    </div>
  );
}
