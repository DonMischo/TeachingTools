"use client";
/**
 * Vorschau der Karten zum Durchklicken (Vertrag mit den Baukästen, Abschnitt 5): je Kartenart
 * mehrere Seeds nebeneinander, mit Sälen, Durchgängen, Tor, Brücken und Ablauf-Kanten.
 */
import { useEffect, useRef, useState } from "react";
import { DURCHGANG, PLATZ, WAND, baueFreiPlan, type FreiEbene, type KartenArt } from "@/lib/gebaeude/frei";

const ARTEN: KartenArt[] = ["bach", "lichtung", "hoehle", "hoehlebach", "saal", "burgsaal", "tempel", "raster"];

function Karte({ e, px }: { e: FreiEbene; px: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      const i = y * e.b + x, a = e.art[i];
      const dick = e.wanddicke?.[i] ?? 0;
      ctx.fillStyle = e.wasser?.[i] ? (a === WAND ? "#2563eb" : "#93c5fd")
        : a === WAND ? (dick === 1 ? "#3f3f46" : dick === 2 ? "#27272a" : dick > 2 ? "#18181b" : "#09090b")
        : a === PLATZ ? "#d9e4c8" : a === DURCHGANG ? "#eab308" : "#9ca3af";
      ctx.fillRect(x * px, y * px, px, px);
    }
    ctx.lineWidth = 1;
    for (const s of e.saele ?? []) {
      ctx.strokeStyle = s.art === "start" ? "#2563eb" : s.art === "ziel" ? "#e11d48" : s.art === "station" ? "#f59e0b" : "#a855f7";
      ctx.strokeRect(s.x * px + 0.5, s.y * px + 0.5, s.b * px - 1, s.h * px - 1);
    }
    if (e.ablauf) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      for (const k of e.ablauf.kanten) {
        const a = e.saele![e.ablauf.saal[k.a]], b = e.saele![e.ablauf.saal[k.b]];
        ctx.beginPath(); ctx.moveTo((a.mx + 0.5) * px, (a.my + 0.5) * px); ctx.lineTo((b.mx + 0.5) * px, (b.my + 0.5) * px); ctx.stroke();
      }
    }
    if (e.tor) {
      ctx.fillStyle = "#e11d48";
      ctx.fillRect((e.tor.x - Math.abs(e.tor.dy)) * px, (e.tor.y - Math.abs(e.tor.dx)) * px, (Math.abs(e.tor.dy) * 2 + 1) * px, (Math.abs(e.tor.dx) * 2 + 1) * px);
    }
    for (const b of e.bruecken ?? []) {
      ctx.strokeStyle = "#a16207"; ctx.lineWidth = 3 * px;
      const ux = Math.cos(b.winkel) * b.lang / 2, uy = Math.sin(b.winkel) * b.lang / 2;
      ctx.beginPath(); ctx.moveTo((b.x - ux) * px, (b.y - uy) * px); ctx.lineTo((b.x + ux) * px, (b.y + uy) * px); ctx.stroke();
      ctx.lineWidth = 1;
    }
    const punkt = (x: number, y: number, f: string) => { ctx.fillStyle = f; ctx.fillRect((x - 1) * px, (y - 1) * px, px * 3, px * 3); };
    e.raeume.forEach(r => punkt(r.x, r.y, "#f59e0b"));
    punkt(e.ziel[0], e.ziel[1], "#e11d48");
    punkt(e.start[0], e.start[1], "#2563eb");
  });
  return <canvas ref={ref} width={e.b * px} height={e.h * px} style={{ imageRendering: "pixelated" }} />;
}

export default function KartenVorschau({ art: start = "saal", seed: s0 = 1, zimmer: z0 = 4 }: { art?: KartenArt; seed?: number; zimmer?: number }) {
  const [art, setArt] = useState<KartenArt>(start);
  const [seed, setSeed] = useState(s0);
  const [zimmer, setZimmer] = useState(z0);
  const seeds = Array.from({ length: 6 }, (_, i) => seed + i);
  let fehler = "";
  const ebenen: FreiEbene[] = [];
  for (const s of seeds) {
    try { ebenen.push(baueFreiPlan([zimmer], s, [art]).ebenen[0]); } catch (err) { fehler = String(err); }
  }
  return (
    <div style={{ padding: 12, color: "#e5e7eb", fontFamily: "system-ui", background: "#111", minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        {ARTEN.map(a => <button key={a} onClick={() => setArt(a)} style={{ fontWeight: a === art ? 700 : 400 }}>{a}</button>)}
        <span>Seed {seed}–{seed + 5}</span>
        <button onClick={() => setSeed(s => Math.max(1, s - 6))}>◀</button>
        <button onClick={() => setSeed(s => s + 6)}>▶</button>
        <span>Stationen</span>
        <input type="number" min={1} max={12} value={zimmer} onChange={ev => setZimmer(Number(ev.target.value) || 1)} style={{ width: 48 }} />
      </div>
      <p style={{ fontSize: 12, margin: "0 0 8px" }}>
        Säle: blau Start · rot Ziel · orange Station · lila Halle · gelb Durchgang · Wand dunkler = dicker · rotes Feld = Tor (Höhle) · braun = Brücke · weiße Linien = Ablauf
      </p>
      {fehler && <p style={{ color: "#f87171" }}>{fehler}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {ebenen.map((e, i) => (
          <figure key={i} style={{ margin: 0 }}>
            <Karte e={e} px={Math.max(2, Math.floor(420 / e.b))} />
            <figcaption style={{ fontSize: 12 }}>Seed {seeds[i]} · {e.b}×{e.h} · {e.ablauf?.zyklus ?? "–"} · Höhe {e.hoehe ?? "Himmel"}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
