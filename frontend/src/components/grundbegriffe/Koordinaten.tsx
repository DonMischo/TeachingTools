"use client";
/**
 * Reiter »Spiegeln im Koordinatensystem«: Ein Punkt, Dreieck oder Viereck
 * wird an der x-Achse, der y-Achse, einer Parallelen (x = k bzw. y = k) oder
 * am Ursprung gespiegelt. Bildpunkte setzt man durch Antippen eines
 * Gitterpunkts oder durch Eintippen der Koordinaten — beides hängt
 * zusammen. Die Spiegelregel kommt aus dem Koordinaten-Lauf
 * (`lib/koordinaten/spiel.ts`).
 */
import { useState, type ReactNode } from "react";
import { leseZahl, z } from "@/lib/prozent";
import { spiegel, type Achse } from "@/lib/koordinaten/spiel";
import { achsenName, spiegelRegel, zufallsAchse } from "@/lib/geometrie-aufgaben";
import { LEER, zaehle } from "@/components/prozent/ui";
import type { Pt } from "@/lib/grundbegriffe";

const N = 6, U = 32, RAND = 26, GR = 2 * N * U + 2 * RAND;
const sx = (x: number) => RAND + (x + N) * U, sy = (y: number) => RAND + (N - y) * U;
const BLAU = "#2563eb", ORANGE = "#ea580c", GRUEN = "#16a34a", ROT = "#dc2626";

type Form = "punkt" | "dreieck" | "viereck";
type AchsenWahl = "zufall" | "x" | "y" | "ursprung" | "parallele";
type Aufgabe = { namen: string[]; pts: Pt[]; achse: Achse };

const flaeche2 = (p: Pt[]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a.x * b.y - b.x * a.y; }, 0);

function erzeuge(form: Form, wahl: AchsenWahl): Aufgabe {
  const r = Math.random;
  const achse: Achse = wahl === "zufall" ? zufallsAchse(r)
    : wahl === "parallele" ? (r() < 0.5 ? { art: "senkrecht", k: [-2, -1, 1, 2][Math.floor(r() * 4)] } : { art: "waagerecht", k: [-2, -1, 1, 2][Math.floor(r() * 4)] })
    : { art: wahl } as Achse;
  const n = form === "punkt" ? 1 : form === "dreieck" ? 3 : 4;
  const namen = form === "punkt" ? ["P"] : ["A", "B", "C", "D"].slice(0, n);
  for (let v = 0; v < 500; v++) {
    const pts = Array.from({ length: n }, () => ({ x: Math.floor(r() * 11) - 5, y: Math.floor(r() * 11) - 5 }));
    const bild = pts.map(p => spiegel(p, achse));
    if (bild.some(q => Math.abs(q.x) > N || Math.abs(q.y) > N)) continue;
    if (new Set(pts.map(p => `${p.x},${p.y}`)).size < n) continue;
    if (n === 1 && bild[0].x === pts[0].x && bild[0].y === pts[0].y) continue;
    if (n >= 3 && Math.abs(flaeche2(pts)) < 16) continue;
    // Viereck ohne Überkreuzung: Ecken nach Winkel um den Schwerpunkt ordnen
    if (n === 4) {
      const m = { x: pts.reduce((s, p) => s + p.x, 0) / 4, y: pts.reduce((s, p) => s + p.y, 0) / 4 };
      pts.sort((a, b) => Math.atan2(a.y - m.y, a.x - m.x) - Math.atan2(b.y - m.y, b.x - m.x));
    }
    return { namen, pts, achse };
  }
  return { namen: ["P"], pts: [{ x: 3, y: 2 }], achse: { art: "x" } };
}

function AchsenLinie({ a }: { a: Achse }) {
  const st = { stroke: ROT, strokeWidth: 4, strokeLinecap: "round" as const };
  switch (a.art) {
    case "x": return <line x1={sx(-N)} y1={sy(0)} x2={sx(N)} y2={sy(0)} style={st} />;
    case "y": return <line x1={sx(0)} y1={sy(-N)} x2={sx(0)} y2={sy(N)} style={st} />;
    case "senkrecht": return <g><line x1={sx(a.k)} y1={sy(-N)} x2={sx(a.k)} y2={sy(N)} style={st} /><text x={sx(a.k) + 6} y={sy(N) + 14} fontSize={13} fontWeight={800} style={{ fill: ROT }}>x = {z(a.k)}</text></g>;
    case "waagerecht": return <g><line x1={sx(-N)} y1={sy(a.k)} x2={sx(N)} y2={sy(a.k)} style={st} /><text x={sx(-N) + 4} y={sy(a.k) - 6} fontSize={13} fontWeight={800} style={{ fill: ROT }}>y = {z(a.k)}</text></g>;
    case "ursprung": return <circle cx={sx(0)} cy={sy(0)} r={7} style={{ fill: ROT }} />;
  }
}

export default function Koordinaten() {
  const [form, setForm] = useState<Form>("dreieck");
  const [wahl, setWahl] = useState<AchsenWahl>("zufall");
  const [auf, setAuf] = useState<Aufgabe>(() => erzeuge("dreieck", "zufall"));
  const [ein, setEin] = useState<{ x: string; y: string }[]>(() => auf.pts.map(() => ({ x: "", y: "" })));
  const [geprueft, setGeprueft] = useState(false);
  const [hilfe, setHilfe] = useState(false);
  const [punkte, setPunkte] = useState(LEER);

  const neu = (f = form, w = wahl) => {
    const a = erzeuge(f, w);
    setAuf(a); setEin(a.pts.map(() => ({ x: "", y: "" }))); setGeprueft(false); setHilfe(false);
  };
  const bild = auf.pts.map(p => spiegel(p, auf.achse));
  const gesetzt = ein.map(e => { const x = leseZahl(e.x.replace("−", "-")), y = leseZahl(e.y.replace("−", "-")); return x !== null && y !== null ? { x, y } : null; });
  const stimmt = gesetzt.map((g, i) => !!g && g.x === bild[i].x && g.y === bild[i].y);
  const alle = stimmt.every(Boolean);

  const tippe = (p: Pt) => {
    const i = gesetzt.findIndex(g => !g);
    const j = i >= 0 ? i : ein.length - 1;
    const nx = [...ein]; nx[j] = { x: String(p.x), y: String(p.y) };
    setEin(nx); setGeprueft(false);
  };
  const pruefe = () => { if (!geprueft && !hilfe) setPunkte(p => zaehle(p, alle)); setGeprueft(true); };

  const raster: ReactNode[] = [], zahlen: ReactNode[] = [], ziele: ReactNode[] = [];
  for (let i = -N; i <= N; i++) {
    raster.push(<line key={`v${i}`} x1={sx(i)} y1={sy(-N)} x2={sx(i)} y2={sy(N)} />, <line key={`h${i}`} x1={sx(-N)} y1={sy(i)} x2={sx(N)} y2={sy(i)} />);
    if (i !== 0) zahlen.push(
      <text key={`zx${i}`} x={sx(i)} y={sy(0) + 15} fontSize={11} textAnchor="middle">{z(i)}</text>,
      <text key={`zy${i}`} x={sx(0) - 7} y={sy(i) + 4} fontSize={11} textAnchor="end">{z(i)}</text>,
    );
    for (let j = -N; j <= N; j++) ziele.push(
      <circle key={`t${i},${j}`} cx={sx(i)} cy={sy(j)} r={U / 2.4} fill="transparent" onClick={() => tippe({ x: i, y: j })} style={{ cursor: "pointer" }} role="button" aria-label={`Punkt (${i} | ${j})`} />,
    );
  }
  const poly = (pts: Pt[]) => pts.map(p => `${sx(p.x)},${sy(p.y)}`).join(" ");
  const fertigGesetzt = gesetzt.every(Boolean) ? (gesetzt as Pt[]) : null;

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["punkt", "dreieck", "viereck"] as Form[]).map(f => (
          <button key={f} className={`chip ${form === f ? "chip-on" : ""}`} aria-pressed={form === f} onClick={() => { setForm(f); neu(f); }}>
            {{ punkt: "• Punkt", dreieck: "△ Dreieck", viereck: "▱ Viereck" }[f]}
          </button>
        ))}
        <span className="w-3" />
        {(["zufall", "x", "y", "parallele", "ursprung"] as AchsenWahl[]).map(w => (
          <button key={w} className={`chip ${wahl === w ? "chip-on" : ""}`} aria-pressed={wahl === w} onClick={() => { setWahl(w); neu(form, w); }}>
            {{ zufall: "🎲 gemischt", x: "x-Achse", y: "y-Achse", parallele: "Parallele", ursprung: "Ursprung" }[w]}
          </button>
        ))}
        <span className="flex-1" />
        {punkte.gesamt > 0 && <span className="text-sm font-black">✔ {punkte.richtig} von {punkte.gesamt} · Serie {punkte.serie}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,36rem)_1fr] items-start">
        <svg viewBox={`0 0 ${GR} ${GR}`} className="w-full h-auto max-h-[72vh] max-w-[36rem] rounded-xl border border-line select-none" role="img" aria-label="Koordinatensystem">
          <rect width={GR} height={GR} style={{ fill: "var(--surface)" }} />
          <g style={{ stroke: "var(--border)" }} strokeWidth={1}>{raster}</g>
          <g style={{ stroke: "var(--text)" }} strokeWidth={1.8}>
            <line x1={sx(-N)} y1={sy(0)} x2={sx(N) + 12} y2={sy(0)} /><line x1={sx(0)} y1={sy(-N)} x2={sx(0)} y2={sy(N) - 12} />
          </g>
          <g style={{ fill: "var(--text-muted)" }}>{zahlen}</g>
          <text x={sx(N) + 10} y={sy(0) - 8} fontSize={14} fontWeight={800} style={{ fill: "var(--text)" }}>x</text>
          <text x={sx(0) + 8} y={sy(N) - 4} fontSize={14} fontWeight={800} style={{ fill: "var(--text)" }}>y</text>
          <AchsenLinie a={auf.achse} />
          {(hilfe || geprueft) && auf.pts.map((p, i) => (
            <line key={`hl${i}`} x1={sx(p.x)} y1={sy(p.y)} x2={sx(bild[i].x)} y2={sy(bild[i].y)} style={{ stroke: GRUEN }} strokeWidth={1.5} strokeDasharray="5 4" />
          ))}
          {auf.pts.length > 1 && <polygon points={poly(auf.pts)} style={{ fill: BLAU, stroke: BLAU }} fillOpacity={0.18} strokeWidth={2.5} />}
          {fertigGesetzt && fertigGesetzt.length > 1 && <polygon points={poly(fertigGesetzt)} style={{ fill: ORANGE, stroke: ORANGE }} fillOpacity={0.18} strokeWidth={2.5} />}
          {auf.pts.map((p, i) => (
            <g key={`p${i}`}><circle cx={sx(p.x)} cy={sy(p.y)} r={5} style={{ fill: BLAU }} />
              <text x={sx(p.x) + 7} y={sy(p.y) - 7} fontSize={15} fontWeight={800} style={{ fill: BLAU }}>{auf.namen[i]}</text></g>
          ))}
          {gesetzt.map((g, i) => g && (
            <g key={`b${i}`}><circle cx={sx(g.x)} cy={sy(g.y)} r={5.5} style={{ fill: geprueft ? (stimmt[i] ? GRUEN : ROT) : ORANGE }} />
              <text x={sx(g.x) + 7} y={sy(g.y) + 16} fontSize={15} fontWeight={800} style={{ fill: geprueft ? (stimmt[i] ? GRUEN : ROT) : ORANGE }}>{auf.namen[i]}′</text></g>
          ))}
          <g>{ziele}</g>
        </svg>

        <div className="flex flex-col gap-3 text-sm">
          <p className="text-base font-bold">Spiegle {auf.pts.length === 1 ? "den Punkt" : "die Figur"} {achsenName(auf.achse)}.</p>
          <p className="text-muted">Tippe die Bildpunkte im Koordinatensystem an oder trage die Koordinaten ein.</p>
          <table className="w-fit">
            <tbody>
              {auf.pts.map((p, i) => (
                <tr key={i}>
                  <td className="pr-3 font-bold">{auf.namen[i]}({z(p.x)} | {z(p.y)})</td>
                  <td className="pr-1">→ {auf.namen[i]}′(</td>
                  <td><input className="input w-14" inputMode="numeric" aria-label={`x von ${auf.namen[i]}′`} value={ein[i].x}
                    onChange={e => { const nx = [...ein]; nx[i] = { ...nx[i], x: e.target.value }; setEin(nx); setGeprueft(false); }} /></td>
                  <td className="px-1">|</td>
                  <td><input className="input w-14" inputMode="numeric" aria-label={`y von ${auf.namen[i]}′`} value={ein[i].y}
                    onChange={e => { const nx = [...ein]; nx[i] = { ...nx[i], y: e.target.value }; setEin(nx); setGeprueft(false); }} /></td>
                  <td className="pl-1">)</td>
                  <td className="pl-2">{geprueft && (stimmt[i] ? <span className="text-ok">✔</span> : <span className="text-bad">✘ {z(bild[i].x)} | {z(bild[i].y)}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={pruefe}>✔ Prüfen</button>
            <button className="btn" onClick={() => setHilfe(true)} disabled={hilfe}>💡 Regel & Hilfslinien</button>
            <button className="btn" onClick={() => setEin(auf.pts.map(() => ({ x: "", y: "" })))}>⌫ Leeren</button>
            <button className="btn" onClick={() => neu()}>🎲 Neue Aufgabe</button>
          </div>
          {hilfe && <p className="rounded-lg bg-surface-hover px-3 py-2">{spiegelRegel(auf.achse)}</p>}
          {geprueft && <p className={alle ? "text-ok font-bold" : "text-bad font-bold"}>{alle ? "✔ Alle Bildpunkte stimmen!" : "✘ Noch nicht alle — die grünen Hilfslinien zeigen, wohin jeder Punkt gehört."}</p>}
          <p className="text-muted">Merke: Punkt und Bildpunkt sind gleich weit von der Achse entfernt; ihre Verbindung steht senkrecht auf der Achse. Liegt ein Punkt auf der Achse, bleibt er, wo er ist.</p>
        </div>
      </div>
    </div>
  );
}
