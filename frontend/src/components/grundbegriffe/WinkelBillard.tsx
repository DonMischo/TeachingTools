"use client";
/**
 * Spiel »Winkel-Billard«: Die Kugel muss über die Bande ins Loch — mit
 * mindestens so vielen Banden, wie die Runde verlangt. Gezielt wird mit
 * einem Winkel in ganzen Grad (0° = nach rechts, gegen den Uhrzeigersinn):
 * auf den Tisch tippen, am Regler drehen oder eintippen. An jeder Bande gilt
 * Einfallswinkel = Ausfallswinkel. Zehn Runden, je drei Stöße (3, 2, 1
 * Punkte); der Spiegeltrick zeigt das Loch hinter den Banden und kostet einen
 * Punkt. Ab Runde 7 steht ein Hindernis im Weg. Rekord im Browser.
 */
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { LOCH_R, abstand, loesungen, polar, richtung, spiegelLoecher, stoss, tischFuer, type Pt, type Stoss, type Tisch } from "@/lib/grundbegriffe";
import { imSvg } from "./ziehen";

const RUNDEN = 10, VERSUCHE = 3, K = 50, M = 26, TEMPO = 16, SCHLUESSEL = "hp_geometrie_billard_best";
const liesBest = () => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

type Phase = "start" | "zielen" | "rollt" | "ergebnis" | "ende";

/** Punkt nach `s` Einheiten Weg auf dem Pfad. */
function aufPfad(pfad: Pt[], s: number): Pt {
  for (let i = 1; i < pfad.length; i++) {
    const l = abstand(pfad[i - 1], pfad[i]);
    if (s <= l) { const t = l ? s / l : 1; return { x: pfad[i - 1].x + t * (pfad[i].x - pfad[i - 1].x), y: pfad[i - 1].y + t * (pfad[i].y - pfad[i - 1].y) }; }
    s -= l;
  }
  return pfad[pfad.length - 1];
}
const laenge = (pfad: Pt[]) => pfad.slice(1).reduce((s, p, i) => s + abstand(pfad[i], p), 0);

export default function WinkelBillard() {
  const [phase, setPhase] = useState<Phase>("start");
  const [runde, setRunde] = useState(0);
  const [tisch, setTisch] = useState<Tisch>(() => tischFuer(0));
  const [versuch, setVersuch] = useState(0);
  const [winkel, setWinkel] = useState(30);
  const [hilfe, setHilfe] = useState(false);
  const [punkte, setPunkte] = useState(0);
  const [rundenPunkte, setRundenPunkte] = useState<number[]>([]);
  const [letzter, setLetzter] = useState<Stoss | null>(null);
  const [kugel, setKugel] = useState<Pt | null>(null);
  const [meldung, setMeldung] = useState("");
  const [best, setBest] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const anim = useRef(0);

  useEffect(() => { setBest(liesBest()); return () => cancelAnimationFrame(anim.current); }, []);

  const starte = () => {
    setRunde(0); setPunkte(0); setRundenPunkte([]); setVersuch(0); setHilfe(false); setLetzter(null); setKugel(null); setMeldung("");
    setTisch(tischFuer(0)); setWinkel(30); setPhase("zielen");
  };

  const ausgang = (s: Stoss) => {
    setKugel(null);
    if (s.versenkt) {
      const p = Math.max(0, VERSUCHE - versuch - (hilfe ? 1 : 0));
      setPunkte(x => x + p); setRundenPunkte(r => [...r, p]);
      setMeldung(`🎉 Versenkt mit ${s.banden} Bande${s.banden === 1 ? "" : "n"}! +${p} Punkt${p === 1 ? "" : "e"}`);
      setPhase("ergebnis");
      return;
    }
    const grund = s.zuFrueh ? `Ins Loch — aber erst nach ${s.banden} Bande${s.banden === 1 ? "" : "n"}, verlangt sind ${tisch.pflicht}.` : `Daneben (${s.banden} Banden).`;
    if (versuch + 1 >= VERSUCHE) {
      const l = loesungen(tisch);
      setRundenPunkte(r => [...r, 0]);
      setMeldung(`${grund} Keine Stöße mehr — so wäre es gegangen: ${l.slice(0, 3).map(g => `${g}°`).join(", ")}${l.length > 3 ? " …" : ""}`);
      setLetzter(stoss(tisch, l[0]));
      setPhase("ergebnis");
    } else {
      setVersuch(v => v + 1);
      setMeldung(`${grund} Noch ${VERSUCHE - versuch - 1} ${VERSUCHE - versuch - 1 === 1 ? "Stoß" : "Stöße"}.`);
      setPhase("zielen");
    }
  };

  const schiesse = () => {
    if (phase !== "zielen") return;
    const s = stoss(tisch, winkel);
    setLetzter(s); setMeldung(""); setPhase("rollt");
    const L = laenge(s.pfad);
    if (typeof requestAnimationFrame !== "function") { ausgang(s); return; }
    const t0 = performance.now();
    const schritt = (t: number) => {
      const w = (t - t0) / 1000 * TEMPO;
      if (w >= L) { ausgang(s); return; }
      setKugel(aufPfad(s.pfad, w));
      anim.current = requestAnimationFrame(schritt);
    };
    anim.current = requestAnimationFrame(schritt);
  };

  const weiter = () => {
    const n = runde + 1;
    if (n >= RUNDEN) {
      setPhase("ende");
      if (punkte > best) { setBest(punkte); schreibBest(punkte); }
      return;
    }
    setRunde(n); setTisch(tischFuer(n)); setVersuch(0); setHilfe(false); setLetzter(null); setMeldung(""); setPhase("zielen");
  };

  if (phase === "start" || phase === "ende") {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-4xl">🎱</div>
        <h3 className="text-xl font-black">Winkel-Billard</h3>
        <p className="max-w-xl text-muted">
          Stoße die Kugel unter dem richtigen <strong>Winkel</strong> ins Loch — aber erst über die <strong>Bande</strong>!
          An jeder Bande prallt sie ab wie ein Lichtstrahl am Spiegel: Einfallswinkel = Ausfallswinkel.
          {" "}{RUNDEN} Runden mit je {VERSUCHE} Stößen (3, 2 oder 1 Punkt). Der 🪞 Spiegeltrick zeigt dir das Loch hinter der Bande, kostet aber einen Punkt.
        </p>
        {phase === "ende" && <p className="text-lg font-black">Ergebnis: {punkte} von {RUNDEN * VERSUCHE} Punkten {punkte >= best && punkte > 0 ? "🏆 neuer Rekord!" : ""}</p>}
        {phase === "ende" && <p className="text-sm text-muted">Runden: {rundenPunkte.join(" · ")}</p>}
        {best > 0 && <p className="text-sm text-muted">Dein Rekord: {best}</p>}
        <button className="btn btn-primary" onClick={starte}>{phase === "ende" ? "Nochmal" : "Los geht's"}</button>
      </div>
    );
  }

  const { w, h } = tisch;
  const X = (p: Pt) => ({ x: p.x * K, y: (h - p.y) * K });
  const spiegel = hilfe ? spiegelLoecher(tisch) : [];
  const xs = [0, w, ...spiegel.map(p => p.x)], ys = [0, h, ...spiegel.map(p => p.y)];
  const vb = { x: Math.min(...xs) * K - M, y: (h - Math.max(...ys)) * K - M, w: (Math.max(...xs) - Math.min(...xs)) * K + 2 * M, h: (Math.max(...ys) - Math.min(...ys)) * K + 2 * M };

  // Vorschau: erste Bahn bis zur Bande, mit Spiegeltrick auch die zweite
  const vorschau = stoss({ ...tisch, loch: { x: -99, y: -99 } }, winkel).pfad.slice(0, hilfe ? 3 : 2);
  const b = X(tisch.ball), ref = X(polar(tisch.ball, 1.6, 0)), bog = X(polar(tisch.ball, 1.1, winkel));
  const zielen = phase === "zielen";

  const tippe = (e: PointerEvent<SVGSVGElement>) => {
    if (!zielen || !svg.current) return;
    const p = imSvg(svg.current, e.clientX, e.clientY);
    const m = { x: p.x / K, y: h - p.y / K };
    if (abstand(m, tisch.ball) < 0.3) return;
    setWinkel(Math.round(richtung(tisch.ball, m)) % 360);
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 font-black">
        <span>Runde {runde + 1}/{RUNDEN}</span>
        <span>⭐ {punkte}</span>
        <span>🎱 Stoß {Math.min(versuch + 1, VERSUCHE)}/{VERSUCHE}</span>
        <span className="rounded-lg px-2 py-0.5 bg-surface-hover">mindestens {tisch.pflicht} Bande{tisch.pflicht > 1 ? "n" : ""}</span>
        <span className="flex-1" />
        {best > 0 && <span className="text-sm text-muted">Rekord {best}</span>}
      </div>
      <svg ref={svg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="w-full h-auto max-h-[62vh] rounded-xl select-none" role="img" aria-label="Billardtisch"
        onPointerDown={tippe} onPointerMove={e => { if (e.buttons) tippe(e); }} style={{ touchAction: "none", cursor: zielen ? "crosshair" : undefined }}>
        <rect x={-M} y={-M} width={w * K + 2 * M} height={h * K + 2 * M} rx={18} style={{ fill: "#78350f" }} />
        <rect x={0} y={0} width={w * K} height={h * K} style={{ fill: "#15803d" }} />
        {spiegel.map((p, i) => {
          const q = X(p);
          return (
            <g key={i} opacity={0.75}>
              <rect x={i < 2 ? 0 : i === 2 ? -w * K : w * K} y={i === 0 ? h * K : i === 1 ? -h * K : 0} width={w * K} height={h * K} fill="none" style={{ stroke: "#86efac" }} strokeDasharray="8 6" strokeWidth={2} />
              <circle cx={q.x} cy={q.y} r={LOCH_R * K} style={{ fill: "#111827", stroke: "#86efac" }} strokeWidth={2} strokeDasharray="4 3" />
              <text x={q.x} y={q.y - LOCH_R * K - 6} textAnchor="middle" fontSize={14} fontWeight={800} style={{ fill: "#166534" }}>Loch′</text>
            </g>
          );
        })}
        {tisch.klotze.map((k, i) => <rect key={i} x={k.x0 * K} y={(h - k.y1) * K} width={(k.x1 - k.x0) * K} height={(k.y1 - k.y0) * K} rx={4} style={{ fill: "#78350f" }} />)}
        <circle cx={X(tisch.loch).x} cy={X(tisch.loch).y} r={LOCH_R * K} style={{ fill: "#111827" }} />
        {letzter && <polyline points={letzter.pfad.map(p => { const q = X(p); return `${q.x},${q.y}`; }).join(" ")} fill="none" style={{ stroke: "#fef3c7" }} strokeWidth={2} strokeDasharray="3 5" opacity={phase === "rollt" ? 0.25 : 0.7} />}
        {zielen && (
          <g pointerEvents="none">
            <polyline points={vorschau.map(p => { const q = X(p); return `${q.x},${q.y}`; }).join(" ")} fill="none" style={{ stroke: "#ffffff" }} strokeWidth={2.5} strokeDasharray="10 7" />
            <line x1={b.x} y1={b.y} x2={ref.x} y2={ref.y} style={{ stroke: "#fde68a" }} strokeWidth={1.5} strokeDasharray="4 4" />
            <path d={`M ${b.x + 1.1 * K} ${b.y} A ${1.1 * K} ${1.1 * K} 0 ${winkel > 180 ? 1 : 0} 0 ${bog.x} ${bog.y}`} fill="none" style={{ stroke: "#fde68a" }} strokeWidth={2.5} />
            <text x={X(polar(tisch.ball, 1.65, winkel / 2)).x} y={X(polar(tisch.ball, 1.65, winkel / 2)).y} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={900}
              style={{ fill: "#fef9c3", stroke: "#14532d", strokeWidth: 4, paintOrder: "stroke" }}>{winkel}°</text>
          </g>
        )}
        {(() => { const q = X(kugel ?? (phase === "rollt" ? tisch.ball : tisch.ball)); return <circle cx={q.x} cy={q.y} r={0.25 * K} style={{ fill: "#ffffff", stroke: "#334155" }} strokeWidth={1.5} />; })()}
      </svg>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-bold">Winkel
          <button className="btn" onClick={() => setWinkel(g => (g + 359) % 360)} disabled={!zielen} aria-label="1 Grad weniger">−</button>
          <input type="range" min={0} max={359} value={winkel} onChange={e => setWinkel(Number(e.target.value))} disabled={!zielen} aria-label="Stoßwinkel" className="w-48" />
          <button className="btn" onClick={() => setWinkel(g => (g + 1) % 360)} disabled={!zielen} aria-label="1 Grad mehr">+</button>
          <input className="input w-20" inputMode="numeric" value={winkel} disabled={!zielen} aria-label="Stoßwinkel in Grad"
            onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) setWinkel(((Math.round(n) % 360) + 360) % 360); }}
            onKeyDown={e => { if (e.key === "Enter") schiesse(); }} />°
        </label>
        <button className="btn btn-primary" onClick={schiesse} disabled={!zielen}>🎱 Stoß!</button>
        <button className="btn" onClick={() => setHilfe(true)} disabled={!zielen || hilfe}>🪞 Spiegeltrick (−1)</button>
        {phase === "ergebnis" && <button className="btn btn-primary" onClick={weiter}>{runde + 1 >= RUNDEN ? "🏁 Auswertung" : "➡ Nächste Runde"}</button>}
      </div>
      {meldung && <p className="font-bold">{meldung}</p>}
      {hilfe && zielen && <p className="text-sm text-muted">Spiegeltrick: Ziele auf ein gespiegeltes Loch′ — die Kugel prallt an der Bande genau so ab, dass sie im echten Loch landet. Bei zwei Banden spiegelt man zweimal.</p>}
    </div>
  );
}
