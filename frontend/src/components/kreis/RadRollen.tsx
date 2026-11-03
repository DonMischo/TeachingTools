"use client";
/**
 * Spiel »Rad-Rollen«: Ein Rad soll genau bis zur Fahne rollen. Mal ist der
 * Radius gegeben und die Zahl der Umdrehungen gesucht, mal umgekehrt. Dann
 * rollt das Rad wirklich — eine Umdrehung = ein Umfang. Fünf Würfe, bis zu
 * 100 Punkte je Wurf, der Rekord bleibt im Browser.
 */
import { useEffect, useRef, useState } from "react";
import { leseZahl, z } from "@/lib/prozent";
import { radPunkte, radRunde, type RadRunde } from "@/lib/kreis-aufgaben";

const RUNDEN = 5, SCHLUESSEL = "hp_kreis_rad_best";
const liesBest = () => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

const W = 640, H = 220, X0 = 40, BODEN = 170;

export default function RadRollen() {
  const [phase, setPhase] = useState<"start" | "spiel" | "ende">("start");
  const [nr, setNr] = useState(0);
  const [runde, setRunde] = useState<RadRunde | null>(null);
  const [ein, setEin] = useState("");
  const [wurf, setWurf] = useState<{ strecke: number; radius: number; punkte: number } | null>(null);
  const [p, setP] = useState(0); // Fortschritt der Rollbewegung 0..1
  const [summe, setSumme] = useState(0);
  const [best, setBest] = useState(0);
  const anim = useRef(0);

  useEffect(() => { setBest(liesBest()); return () => cancelAnimationFrame(anim.current); }, []);

  const neueRunde = (i: number) => {
    setNr(i); setRunde(radRunde(Math.floor(i / 2))); setEin(""); setWurf(null); setP(0);
  };
  const start = () => { setSumme(0); setPhase("spiel"); neueRunde(0); };

  const x = leseZahl(ein);
  const rollen = () => {
    if (!runde || wurf || x === null || x <= 0) return;
    const radius = runde.art === "radius" ? x : runde.r;
    const n = runde.art === "radius" ? runde.n : x;
    const strecke = n * 2 * Math.PI * radius;
    const punkte = radPunkte(runde.s, strecke);
    setWurf({ strecke, radius, punkte });
    let t0 = 0;
    const schritt = (jetzt: number) => {
      if (!t0) t0 = jetzt;
      const q = Math.min(1, (jetzt - t0) / 1800);
      setP(1 - (1 - q) * (1 - q));
      if (q < 1) anim.current = requestAnimationFrame(schritt);
      else setSumme(s => s + punkte);
    };
    anim.current = requestAnimationFrame(schritt);
  };
  const weiter = () => {
    if (nr + 1 < RUNDEN) return neueRunde(nr + 1);
    const gesamt = summe;
    if (gesamt > best) { setBest(gesamt); schreibBest(gesamt); }
    setPhase("ende");
  };

  if (phase !== "spiel" || !runde) {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-4xl">🛞</div>
        <h3 className="text-xl font-black">Rad-Rollen</h3>
        <p className="max-w-xl text-muted">
          Das Rad soll <strong>genau bis zur Fahne</strong> rollen. Rechne aus, wie oft es sich drehen muss — oder wie groß es sein muss.
          Bei einer Umdrehung rollt es genau seinen Umfang ab: u = 2 · π · r. {RUNDEN} Würfe, bis zu 100 Punkte je Wurf.
        </p>
        {phase === "ende" && <p className="text-lg font-black">Ergebnis: {summe} von {RUNDEN * 100} Punkten {summe >= best && summe > 0 ? "🏆 neuer Rekord!" : ""}</p>}
        {best > 0 && <p className="text-sm text-muted">Dein Rekord: {best}</p>}
        <button className="btn btn-primary" onClick={start}>{phase === "ende" ? "Nochmal" : "Los geht's"}</button>
      </div>
    );
  }

  // Maßstab: Fahne und Wurf passen aufs Bild.
  const weit = Math.max(runde.s, wurf?.strecke ?? 0) * 1.12;
  const k = (W - X0 - 30) / weit;
  const radius = wurf?.radius ?? (runde.art === "umdrehungen" ? runde.r : runde.s / (2 * Math.PI * runde.n));
  const rp = Math.min(46, Math.max(14, radius * k)); // Rad sichtbar, auch wenn es im Maßstab winzig wäre
  const gerollt = (wurf?.strecke ?? 0) * p;
  const cx = X0 + gerollt * k, cy = BODEN - rp;
  const dreh = gerollt / radius * 180 / Math.PI;
  const fahne = X0 + runde.s * k;
  const fertig = wurf && p >= 1;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 font-black">
        <span>Wurf {nr + 1} von {RUNDEN}</span>
        <span>⭐ {summe}</span>
        {best > 0 && <span className="text-muted text-sm">Rekord {best}</span>}
      </div>
      <p className="text-lg">
        {runde.art === "umdrehungen"
          ? <>Das Rad hat den Radius <strong>r = {z(runde.r)} cm</strong>. Die Fahne steht <strong>{z(runde.s, 0)} cm</strong> weit weg. Wie viele Umdrehungen braucht es?</>
          : <>Das Rad soll sich genau <strong>{z(runde.n)}-mal</strong> drehen. Die Fahne steht <strong>{z(runde.s, 0)} cm</strong> weit weg. Welchen Radius muss es haben?</>}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto rounded-xl border border-line bg-surface" role="img" aria-label="Rad und Fahne">
        <line x1={10} y1={BODEN} x2={W - 10} y2={BODEN} stroke="var(--border)" strokeWidth={3} />
        <line x1={X0} y1={BODEN} x2={cx} y2={BODEN} stroke="var(--accent)" strokeWidth={5} />
        <line x1={fahne} y1={BODEN} x2={fahne} y2={BODEN - 90} stroke="var(--text)" strokeWidth={3} />
        <path d={`M ${fahne} ${BODEN - 90} l 34 11 l -34 11 Z`} fill="#dc2626" />
        <g transform={`translate(${cx} ${cy}) rotate(${dreh})`}>
          <circle r={rp} fill="var(--surface)" stroke="var(--text)" strokeWidth={5} />
          {[0, 60, 120].map(a => <line key={a} x1={-rp * Math.cos(a * Math.PI / 180)} y1={-rp * Math.sin(a * Math.PI / 180)} x2={rp * Math.cos(a * Math.PI / 180)} y2={rp * Math.sin(a * Math.PI / 180)} stroke="var(--text-muted)" strokeWidth={2} />)}
          <circle cx={0} cy={rp - 6} r={4} fill="#dc2626" />
          <circle r={4} fill="var(--text)" />
        </g>
        <text x={W - 12} y={H - 10} textAnchor="end" fontSize={11} fill="var(--text-muted)">Rad nicht maßstäblich</text>
        {fertig && (
          <text x={W / 2} y={30} textAnchor="middle" fontSize={20} fontWeight={900} fill="var(--text)" stroke="var(--surface)" strokeWidth={5} paintOrder="stroke">
            {wurf.punkte >= 95 ? "🎯 Volltreffer!" : wurf.punkte >= 70 ? "👍 Knapp!" : wurf.strecke < runde.s ? "Zu kurz" : "Zu weit"} · +{wurf.punkte}
          </text>
        )}
      </svg>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 font-bold">
          {runde.art === "umdrehungen" ? "Umdrehungen" : "Radius r"}
          <input className="input w-28" inputMode="decimal" value={ein} disabled={!!wurf} aria-label={runde.art === "umdrehungen" ? "Umdrehungen" : "Radius"}
            onChange={e => setEin(e.target.value)} onKeyDown={e => { if (e.key === "Enter") rollen(); }} />
          {runde.art === "radius" && <span className="text-muted">cm</span>}
        </label>
        {!wurf && <button className="btn btn-primary" onClick={rollen} disabled={x === null || x <= 0}>🛞 Rollen!</button>}
        {fertig && <button className="btn btn-primary" onClick={weiter}>{nr + 1 < RUNDEN ? "➡ Nächster Wurf" : "🏁 Auswertung"}</button>}
      </div>
      {fertig && (
        <p className="text-sm font-mono font-bold rounded-lg bg-surface-hover px-3 py-2">
          {runde.art === "umdrehungen"
            ? `u = 2 · π · ${z(runde.r)} cm ≈ ${z(2 * Math.PI * runde.r)} cm; ${z(runde.s, 0)} cm : ${z(2 * Math.PI * runde.r)} cm ≈ ${z(runde.n)} Umdrehungen`
            : `u = ${z(runde.s, 0)} cm : ${z(runde.n)} ≈ ${z(runde.s / runde.n)} cm; r = u : (2 · π) ≈ ${z(runde.r)} cm`}
          {` — gerollt: ${z(wurf.strecke, 0)} cm`}
        </p>
      )}
    </div>
  );
}
