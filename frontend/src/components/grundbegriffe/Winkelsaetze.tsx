"use client";
/**
 * Reiter »Winkel an Geraden«: Zwei Geraden g und h, geschnitten von s. Die
 * acht Winkel α₁ … δ₂ sind farbig gekoppelt (gleiche Farbe = gleich groß).
 * Einen Winkel antippen und eine Beziehung wählen — Neben-, Scheitel-,
 * Stufen- oder Wechselwinkel —, dann leuchten die Partner auf. »h kippen«
 * zeigt, dass Stufen- und Wechselwinkel nur an Parallelen gleich sind.
 * »Üben« fragt nach dem Partner eines Winkels.
 */
import { useState } from "react";
import { z } from "@/lib/prozent";
import { BEZIEHUNGEN, WINKEL_IDS, norm, partner, polar, richtung, teile, winkelGroesse, type Beziehung, type WinkelId } from "@/lib/grundbegriffe";
import { LEER, zaehle } from "@/components/prozent/ui";
import { useZiehen } from "./ziehen";

const W = 640, H = 420, S1 = { x: 330, y: 140 }, ABST = 150, R = 42;
const scr = (m: { x: number; y: number }, r: number, g: number) => { const p = polar({ x: 0, y: 0 }, r, g); return { x: m.x + p.x, y: m.y - p.y }; };
const tief = (w: WinkelId) => `${w[0]}${w[1] === "1" ? "₁" : "₂"}`;
const FARBEN = [["#f59e0b", "#0ea5e9"], ["#ea580c", "#14b8a6"]];

function sektor(m: { x: number; y: number }, von: number, grad: number, r: number) {
  const a = scr(m, r, von), b = scr(m, r, von + grad);
  return `M ${m.x} ${m.y} L ${a.x} ${a.y} A ${r} ${r} 0 ${grad > 180 ? 1 : 0} 0 ${b.x} ${b.y} Z`;
}

export default function Winkelsaetze() {
  const [phi, setPhi] = useState(62);
  const [kipp, setKipp] = useState(0);
  const [bez, setBez] = useState<Beziehung>("stufen");
  const [sel, setSel] = useState<WinkelId | null>("α1");
  const [werte, setWerte] = useState(true);
  const [ueben, setUeben] = useState<null | { w: WinkelId; bez: Beziehung; antwort?: WinkelId }>(null);
  const [punkte, setPunkte] = useState(LEER);

  const { start, props } = useZiehen<"s">((_, p) => {
    let g = richtung(S1, { x: p.x, y: 2 * S1.y - p.y });
    if (g > 180) g = g > 270 ? 15 : 165;
    setPhi(Math.round(Math.max(15, Math.min(165, g))));
  });

  const S2 = scr(S1, ABST / Math.sin(phi * Math.PI / 180), phi + 180);
  const ecke = (w: WinkelId) => (teile(w).s === 1 ? S1 : S2);
  const richtungen = (s: 1 | 2) => (s === 1 ? [0, phi, 180, phi + 180] : [kipp, phi, kipp + 180, phi + 180]);
  const bogen = (w: WinkelId) => { const { i, s } = teile(w); const d = richtungen(s); return { von: d[i], grad: norm(d[(i + 1) % 4] - d[i]) }; };
  const parallel = kipp === 0;

  const neueFrage = () => {
    const w = WINKEL_IDS[Math.floor(Math.random() * 8)];
    const b = BEZIEHUNGEN[Math.floor(Math.random() * 4)].id;
    setUeben({ w, bez: b }); setSel(null); setKipp(0);
  };
  const tippe = (w: WinkelId) => {
    if (ueben) {
      if (ueben.antwort) return;
      const ok = partner(ueben.w, ueben.bez).includes(w);
      setUeben({ ...ueben, antwort: w });
      setPunkte(p => zaehle(p, ok));
      return;
    }
    setSel(w);
  };

  const partnerVon = ueben ? (ueben.antwort ? partner(ueben.w, ueben.bez) : []) : sel ? partner(sel, bez) : [];
  const fest = ueben ? ueben.w : sel;
  const B = BEZIEHUNGEN.find(b => b.id === (ueben?.bez ?? bez))!;

  let satz = "";
  if (!ueben && sel) {
    const ps = partner(sel, bez), a = winkelGroesse(sel, phi, kipp);
    const namen = ps.map(tief).join(" und ");
    if (bez === "neben") satz = `${tief(sel)} und ${namen} sind Nebenwinkel: ${tief(sel)} + ${tief(ps[0])} = ${z(a)}° + ${z(winkelGroesse(ps[0], phi, kipp))}° = 180°.`;
    else {
      const b = winkelGroesse(ps[0], phi, kipp);
      satz = Math.abs(a - b) < 1e-9
        ? `${tief(sel)} und ${namen} sind ${B.label}: ${tief(sel)} = ${tief(ps[0])} = ${z(a)}°.`
        : `${tief(sel)} und ${namen} sind ${B.label} — aber g und h sind nicht parallel: ${tief(sel)} = ${z(a)}°, ${tief(ps[0])} = ${z(b)}°. Nicht gleich!`;
    }
  }

  const L = 300;
  const gA = scr(S1, L, 180), gB = scr(S1, L, 0), hA = scr(S2, L, 180 + kipp), hB = scr(S2, L, kipp);
  const sA = scr(S1, 120, phi), sB = scr(S2, 120, phi + 180);

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={`chip ${!ueben ? "chip-on" : ""}`} onClick={() => { setUeben(null); setSel("α1"); }}>🔍 Erkunden</button>
        <button className={`chip ${ueben ? "chip-on" : ""}`} onClick={neueFrage}>🎯 Üben</button>
        <span className="w-3" />
        {!ueben && BEZIEHUNGEN.map(b => (
          <button key={b.id} className={`chip ${bez === b.id ? "chip-on" : ""}`} aria-pressed={bez === b.id} onClick={() => setBez(b.id)}>{b.label}</button>
        ))}
        <span className="flex-1" />
        {punkte.gesamt > 0 && <span className="text-sm font-black">✔ {punkte.richtig} von {punkte.gesamt} · Serie {punkte.serie}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[70vh] rounded-xl border border-line select-none" role="img" aria-label="Zwei Geraden und eine Schnittgerade" {...props}>
          <line x1={gA.x} y1={gA.y} x2={gB.x} y2={gB.y} style={{ stroke: "var(--text)" }} strokeWidth={3} />
          <line x1={hA.x} y1={hA.y} x2={hB.x} y2={hB.y} style={{ stroke: "var(--text)" }} strokeWidth={3} />
          <line x1={sA.x} y1={sA.y} x2={sB.x} y2={sB.y} style={{ stroke: "var(--accent)" }} strokeWidth={3} />
          <text x={W - 26} y={S1.y - 10} fontSize={18} fontWeight={800} style={{ fill: "var(--text)" }}>g</text>
          <text x={W - 26} y={scr(S2, (W - 26 - S2.x), kipp).y - 10} fontSize={18} fontWeight={800} style={{ fill: "var(--text)" }}>h</text>
          <text x={sA.x + 10} y={sA.y} fontSize={18} fontWeight={800} style={{ fill: "var(--accent)" }}>s</text>
          {parallel && <text x={20} y={(S1.y + S2.y) / 2} fontSize={15} fontWeight={700} style={{ fill: "var(--text-muted)" }}>g ∥ h</text>}
          {WINKEL_IDS.map(w => {
            const { i, s } = teile(w), m = ecke(w), b = bogen(w);
            const farbe = FARBEN[s === 2 && !parallel ? 1 : 0][i % 2];
            const ist = fest === w, partnerIst = partnerVon.includes(w);
            const falsch = ueben?.antwort === w && !partner(ueben.w, ueben.bez).includes(w);
            const rand = ist ? "#dc2626" : falsch ? "#7f1d1d" : partnerIst ? "#16a34a" : farbe;
            const t = scr(m, R + 26, b.von + b.grad / 2);
            return (
              <g key={w} onClick={() => tippe(w)} style={{ cursor: "pointer" }} role="button" aria-label={`Winkel ${tief(w)}`}>
                <path d={sektor(m, b.von, b.grad, R)} style={{ fill: farbe, stroke: rand }} fillOpacity={ist || partnerIst ? 0.75 : 0.4}
                  strokeWidth={ist || partnerIst || falsch ? 4 : 1.5} strokeDasharray={falsch ? "5 3" : undefined} />
                <text x={t.x} y={t.y - (werte ? 7 : 0)} fontSize={15} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={{ fill: "var(--text)" }}>{tief(w)}</text>
                {werte && <text x={t.x} y={t.y + 9} fontSize={11} textAnchor="middle" dominantBaseline="central" style={{ fill: "var(--text-muted)" }}>{z(winkelGroesse(w, phi, kipp))}°</text>}
              </g>
            );
          })}
          <circle cx={sA.x} cy={sA.y} r={13} style={{ fill: "var(--accent)", cursor: "grab" }} fillOpacity={0.35} onPointerDown={start("s")} aria-label="Schnittgerade drehen" />
          <circle cx={S1.x} cy={S1.y} r={4} style={{ fill: "var(--text)" }} />
          <circle cx={S2.x} cy={S2.y} r={4} style={{ fill: "var(--text)" }} />
          <text x={S1.x - 130} y={S1.y + 20} fontSize={13} fontWeight={700} style={{ fill: "var(--text-muted)" }}>S₁</text>
          <text x={S2.x - 130} y={S2.y + 20} fontSize={13} fontWeight={700} style={{ fill: "var(--text-muted)" }}>S₂</text>
        </svg>

        <div className="flex flex-col gap-3 text-sm">
          {ueben ? (
            <div className="rounded-xl border border-line p-3 flex flex-col gap-2">
              <p className="font-bold text-base">Tippe {ueben.bez === "neben" ? "einen" : "den"} {B.label} zu {tief(ueben.w)}.</p>
              {ueben.antwort && (
                partner(ueben.w, ueben.bez).includes(ueben.antwort)
                  ? <p className="text-ok font-bold">✔ Richtig — {B.regel}</p>
                  : <p className="text-bad font-bold">✘ {tief(ueben.antwort)} ist {(() => { const x = BEZIEHUNGEN.find(b => partner(ueben.w, b.id).includes(ueben.antwort!)); return x ? `${x.label} zu ${tief(ueben.w)}` : `kein besonderer Partner von ${tief(ueben.w)}`; })()}. Gesucht: {partner(ueben.w, ueben.bez).map(tief).join(" oder ")}.</p>
              )}
              <button className="btn btn-primary self-start" onClick={neueFrage}>{ueben.antwort ? "➡ Nächste Frage" : "🎲 Andere Frage"}</button>
            </div>
          ) : (
            <div className="rounded-xl border border-line p-3 leading-relaxed">
              {sel ? satz : "Tippe einen Winkel an."}
              <p className="text-muted mt-2">{B.regel}</p>
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-bold">Schnittwinkel α₁ = {phi}° (oder Griff an s ziehen)</span>
            <input type="range" min={15} max={165} value={phi} onChange={e => setPhi(Number(e.target.value))} aria-label="Schnittwinkel" />
          </label>
          {!ueben && (
            <label className="flex flex-col gap-1">
              <span className="font-bold">h kippen: {kipp}° {kipp === 0 ? "(parallel)" : "(nicht parallel)"}</span>
              <input type="range" min={-20} max={20} value={kipp} onChange={e => setKipp(Number(e.target.value))} aria-label="h kippen" />
            </label>
          )}
          <label className="flex items-center gap-2"><input type="checkbox" checked={werte} onChange={e => setWerte(e.target.checked)} /> Größen anzeigen</label>
          <ul className="text-muted flex flex-col gap-0.5">
            <li><strong>Nebenwinkel</strong>: nebeneinander an einer Geraden, zusammen 180°</li>
            <li><strong>Scheitelwinkel</strong>: gegenüber am selben Scheitel, gleich groß</li>
            <li><strong>Stufenwinkel</strong>: gleiche Lage an S₁ und S₂ (F-Form)</li>
            <li><strong>Wechselwinkel</strong>: über Kreuz zwischen S₁ und S₂ (Z-Form)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
