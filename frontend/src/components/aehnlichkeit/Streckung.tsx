"use client";
/**
 * Zentrische Streckung: Zentrum Z ziehen, Streckfaktor k einstellen. Strahlen
 * von Z durch jede Ecke zeigen, wo die Bildecke liegt (|ZA'| = |k| · |ZA|).
 * Daneben: Seiten mal |k|, Winkel bleiben, Fläche mal k².
 */
import { useState } from "react";
import { FIGUREN, flaeche, seiten, strecke, streckeFigur, streckText, umfang, winkel, type P } from "@/lib/aehnlichkeit";
import { Chips } from "@/components/prozent/ui";
import { Blatt, FigurZeichnung, sx, sy } from "./Blatt";

const de = (x: number, s = 2) => x.toLocaleString("de-DE", { maximumFractionDigits: s });
const ORIG = "#2563eb", BILD = "#ea580c";

export default function Streckung() {
  const [figId, setFigId] = useState("dreieck");
  const [k, setK] = useState(2);
  const [z, setZ] = useState<P>({ x: -4, y: 2 });
  const fig = FIGUREN.find(f => f.id === figId)!.f;
  const bild = streckeFigur(fig, z, k);
  const s1 = seiten(fig), s2 = seiten(bild), w1 = winkel(fig);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="card p-3 flex flex-col gap-2">
        <Blatt label="Zentrische Streckung" onZiehen={(p, phase) => {
          if (phase === "start") return Math.hypot(p.x - z.x, p.y - z.y) < 0.8;
          setZ({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 });
        }}>
          {fig.map((p, i) => {
            // Z, Ecke und Bildecke liegen auf einer Geraden: t = 0 (Z), 1 (Ecke), k (Bildecke)
            const von = strecke(p, z, Math.min(0, 1, k) - 0.15), bis = strecke(p, z, Math.max(0, 1, k) + 0.15);
            return <line key={i} x1={sx(von.x)} y1={sy(von.y)} x2={sx(bis.x)} y2={sy(bis.y)} stroke="var(--color-muted)" strokeDasharray="4 4" />;
          })}
          <FigurZeichnung f={fig} farbe={ORIG} beschriftung="" />
          <FigurZeichnung f={bild} farbe={BILD} beschriftung="'" />
          <circle cx={sx(z.x)} cy={sy(z.y)} r={9} fill="#16a34a" stroke="white" strokeWidth={2} style={{ cursor: "grab" }} />
          <text x={sx(z.x) + 12} y={sy(z.y) - 10} fontWeight={900} fill="#16a34a">Z</text>
        </Blatt>
        <p className="text-xs text-muted">Das grüne Zentrum Z lässt sich ziehen.</p>
      </div>
      <div className="card p-4 flex flex-col gap-3">
        <Chips wahl={figId} setze={setFigId} optionen={FIGUREN.map(f => ({ id: f.id, label: f.name }))} />
        <label className="flex flex-col gap-1 text-sm">Streckfaktor <b className="text-2xl">k = {de(k)}</b>
          <input type="range" min={-3} max={3} step={0.25} value={k} onChange={e => setK(Number(e.target.value))} aria-label="Streckfaktor" />
        </label>
        <div className="flex flex-wrap gap-1">{[-1, 0.5, 1.5, 2, 3].map(v => <button key={v} className="chip" onClick={() => setK(v)}>k = {de(v)}</button>)}</div>
        <p className="text-sm font-bold">{streckText(k)}</p>
        <table className="text-sm">
          <thead><tr className="text-muted"><th className="text-left">Seite</th><th>Original</th><th>Bild</th><th>Bild : Original</th></tr></thead>
          <tbody>
            {s1.map((s, i) => (
              <tr key={i}><td>{"ABCDEFG"[i]}{"ABCDEFG"[(i + 1) % s1.length]}</td><td className="text-center">{de(s)}</td><td className="text-center">{de(s2[i])}</td><td className="text-center font-bold">{s ? de(s2[i] / s) : "–"}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm">Winkel: {w1.map(w => `${de(w, 0)}°`).join(", ")} — <b>bleiben gleich</b>.</p>
        <p className="text-sm">Umfang: {de(umfang(fig))} → {de(umfang(bild))} (mal |k| = {de(Math.abs(k))})</p>
        <p className="text-sm">Fläche: {de(flaeche(fig))} → {de(flaeche(bild))} (mal k² = {de(k * k)})</p>
        <p className="text-xs text-muted">Bild und Original sind <b>ähnlich</b>: gleiche Form, alle Längen im selben Verhältnis |k|, gleiche Winkel.</p>
      </div>
    </div>
  );
}
