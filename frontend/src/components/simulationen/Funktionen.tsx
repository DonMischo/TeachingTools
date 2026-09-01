"use client";
/**
 * Funktionen — Term, Wertetabelle und Graph, miteinander verbunden.
 *
 * Der Kern ist die Verbindung, nicht das Zeichnen: wer über eine Tabellenzeile
 * fährt, sieht den Punkt im Koordinatensystem; wer über den Graphen fährt,
 * sieht das x/y-Paar und die zugehörige Zeile. Und »?« in der Tabelle zeigt
 * den Rechenweg — erst die Formel mit dem x, dann der eingesetzte Wert, dann
 * Schritt für Schritt bis zur Zahl, die in der Tabelle steht.
 *
 * Die Rechnung selbst liegt in @/lib/funktionen (dort auch getestet).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  START, TEMPLATES, evalAt, fmt, fmtPi, hasX, parseFunction, substitutionSteps,
  tableRows, xAtPixel, type Instance, type Node, type Row, type Seg,
} from "@/lib/funktionen";

/* ── Zeichenfläche ─────────────────────────────────────────────────────────── */

const W = 640, H = 460, M = 34;      // Innenrand für die Achsenbeschriftung
const SAMPLES = 600;                 // Auflösung der Kurve

type View = { x0: number; x1: number; y0: number; y1: number };

/** Ein Achsenraster mit runden Schritten (1, 2, 5, 10 …). */
function tickStep(span: number): number {
  const rough = span / 10;
  const p = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const m of [1, 2, 5, 10]) if (rough <= m * p) return m * p;
  return 10 * p;
}

/** y-Bereich aus den Werten, damit der Graph nicht aus dem Bild läuft. */
function autoY(node: Node, x0: number, x1: number): { y0: number; y1: number } {
  const ys: number[] = [];
  for (let i = 0; i <= 200; i++) {
    const y = evalAt(node, x0 + ((x1 - x0) * i) / 200);
    if (y !== null && Math.abs(y) < 1e6) ys.push(y);
  }
  if (!ys.length) return { y0: -5, y1: 5 };
  ys.sort((a, b) => a - b);
  // Ränder kappen: eine Polstelle soll die Skala nicht allein bestimmen.
  const lo = ys[Math.floor(ys.length * 0.02)];
  const hi = ys[Math.floor(ys.length * 0.98)];
  let y0 = Math.min(lo, 0), y1 = Math.max(hi, 0);
  if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.12;
  return { y0: y0 - pad, y1: y1 + pad };
}

/* ── Rechenweg-Fenster ─────────────────────────────────────────────────────── */

function SegLine({ segs, big = false }: { segs: Seg[]; big?: boolean }) {
  return (
    <span className={big ? "text-xl font-bold" : "text-base"} style={{ fontVariantNumeric: "tabular-nums" }}>
      {segs.map((s, i) => (
        <span
          key={i}
          style={
            s.kind === "x" ? { color: "#8b5cf6", fontWeight: 800 }
            : s.kind === "mark" ? { color: "#f59e0b", fontWeight: 800 }
            : undefined
          }
        >
          {s.t}
        </span>
      ))}
    </span>
  );
}

function Rechenweg({ node, x, onClose }: { node: Node; x: number; onClose: () => void }) {
  const steps = useMemo(() => substitutionSteps(node, x), [node, x]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-black text-lg">Woher kommt der Wert?</h2>
            <p className="text-xs text-[var(--text-muted)]">
              <span style={{ color: "#8b5cf6", fontWeight: 800 }}>x</span> wird durch{" "}
              <span style={{ color: "#f59e0b", fontWeight: 800 }}>{fmt(x)}</span> ersetzt.
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">✕</button>
        </div>

        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-baseline gap-3">
              <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] w-28 shrink-0 text-right">
                {s.label}
              </span>
              <SegLine segs={s.segs} big={i === steps.length - 1} />
            </li>
          ))}
        </ol>

        <p className="text-xs text-[var(--text-muted)] mt-4">
          Immer von innen nach außen: was in Klammern steht und Punkt-vor-Strich zuerst.
        </p>
      </div>
    </div>
  );
}

/* ── Werkzeug ──────────────────────────────────────────────────────────────── */

export default function Funktionen({ action }: { action?: ReactNode }) {
  const [src, setSrc] = useState(START.src);
  const [from, setFrom] = useState(START.from);
  const [to, setTo] = useState(START.to);
  const [step, setStep] = useState(START.step);
  // Bei Winkelfunktionen zählen von/bis/Schritt in Vielfachen von π.
  const [pi, setPi] = useState(START.pi);
  const [tpl, setTpl] = useState<string | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);   // vom Graphen
  const [hoverRow, setHoverRow] = useState<number | null>(null); // von der Tabelle
  const [wegX, setWegX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  /** π-Modus: die Eingabefelder rechnen in π, die Funktion in Bogenmaß. */
  const unit = pi ? Math.PI : 1;
  /** x-Werte beschriften — im π-Modus als Bruchteil von π. */
  const fmtX = (v: number) => (pi ? fmtPi(v) : fmt(v));

  /** Vorlage anwenden. Nochmal auf dieselbe klicken würfelt neue Parameter. */
  function useTemplate(key: string) {
    const t = TEMPLATES.find(x => x.key === key);
    if (!t) return;
    const inst: Instance = t.build();
    setSrc(inst.src);
    setFrom(inst.from);
    setTo(inst.to);
    setStep(inst.step);
    setPi(inst.pi);
    setTpl(key);
    setHoverRow(null);
    setHoverX(null);
  }

  const parsed = useMemo(() => parseFunction(src), [src]);
  const node = parsed.ok ? parsed.node : null;

  const rows: Row[] = useMemo(
    () => (node ? tableRows(node, from * unit, to * unit, step * unit) : []),
    [node, from, to, step, unit],
  );

  const view: View = useMemo(() => {
    // Etwas Luft links und rechts, damit die Randpunkte nicht am Rahmen kleben.
    const a = from * unit, b = to * unit;
    const pad = Math.max((b - a) * 0.1, 0.5 * unit);
    const x0 = a - pad, x1 = b + pad;
    return node ? { x0, x1, ...autoY(node, x0, x1) } : { x0, x1, y0: -5, y1: 5 };
  }, [node, from, to, unit]);

  const sx = (x: number) => M + ((x - view.x0) / (view.x1 - view.x0)) * (W - 2 * M);
  const sy = (y: number) => H - M - ((y - view.y0) / (view.y1 - view.y0)) * (H - 2 * M);

  /** Die Kurve, an Lücken und Polstellen in Teilstücke zerlegt. */
  const paths = useMemo(() => {
    if (!node) return [];
    const out: string[] = [];
    let cur: string[] = [];
    let prevY: number | null = null;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = view.x0 + ((view.x1 - view.x0) * i) / SAMPLES;
      const y = evalAt(node, x);
      const inside = y !== null && y > view.y0 - (view.y1 - view.y0) && y < view.y1 + (view.y1 - view.y0);
      // Ein Sprung über die halbe Höhe ist eine Polstelle, keine Linie.
      const jump = prevY !== null && y !== null && Math.abs(y - prevY) > (view.y1 - view.y0) * 0.9;
      if (!inside || jump) {
        if (cur.length > 1) out.push(cur.join(" "));
        cur = [];
      }
      if (y !== null && inside) cur.push(`${cur.length ? "L" : "M"}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`);
      prevY = y;
    }
    if (cur.length > 1) out.push(cur.join(" "));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, view]);

  // Im π-Modus liegen die Striche auf Vielfachen von π, nicht auf 1, 2, 5.
  const xStep = pi
    ? ([0.25, 0.5, 1, 2].find(m => (view.x1 - view.x0) / (m * Math.PI) <= 10) ?? 2) * Math.PI
    : tickStep(view.x1 - view.x0);
  const yStep = tickStep(view.y1 - view.y0);
  const ticks = (a: number, b: number, s: number) => {
    const out: number[] = [];
    for (let t = Math.ceil(a / s) * s; t <= b + 1e-9; t += s) out.push(Math.round(t * 1e6) / 1e6);
    return out;
  };

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || !node) return;
    const r = svg.getBoundingClientRect();
    if (!(r.width > 0)) return;                       // noch nicht gelayoutet
    const px = ((e.clientX - r.left) / r.width) * W;  // Bildschirm → viewBox
    setHoverX(xAtPixel(px, view.x0, view.x1, W, M));
  }

  // Punkt, der hervorgehoben wird: Tabelle hat Vorrang vor dem Graphen.
  const marked = hoverRow != null && rows[hoverRow]
    ? rows[hoverRow]
    : hoverX != null && node
      ? { x: hoverX, y: evalAt(node, hoverX) }
      : null;

  const reset = () => {
    setSrc(START.src); setFrom(START.from); setTo(START.to);
    setStep(START.step); setPi(START.pi); setTpl(null);
  };

  return (
    <div className="flex flex-col gap-5 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📈 Funktionen</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Term eingeben, Wertetabelle und Graph entstehen mitsammen. Über die Tabelle fahren
            zeigt den Punkt, über den Graphen fahren zeigt das Wertepaar — und »?« zeigt, wie
            der Wert ausgerechnet wird.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button onClick={reset}
            className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]">
            ↺ Zurücksetzen
          </button>
        </div>
      </div>

      {/* Term */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-lg">f(x) =</span>
          <input
            value={src}
            onChange={e => setSrc(e.target.value)}
            spellCheck={false}
            aria-label="Funktionsterm"
            className="flex-1 min-w-[16rem] bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 font-mono text-lg"
          />
        </label>
        {!parsed.ok
          ? <p className="text-sm text-red-500">{parsed.error}</p>
          : !hasX(node!)
            ? <p className="text-sm text-amber-500">In dem Term steht kein x — der Graph ist eine waagerechte Linie.</p>
            : null}
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map(t => (
            <button
              key={t.key}
              onClick={() => useTemplate(t.key)}
              title={`${t.hint} — nochmal klicken für neue Zahlen`}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                tpl === t.key
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 font-bold"
                  : "border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              {t.label}{tpl === t.key ? " ↻" : ""}
            </button>
          ))}
        </div>
        {/* Auch hier feste Höhe — sonst springt die Seite beim Vorlagenwechsel. */}
        <p className="text-xs text-[var(--text-muted)] min-h-[2rem]">
          {tpl
            ? <>💡 {TEMPLATES.find(t => t.key === tpl)!.hint} <span className="opacity-70">Nochmal klicken: neue Zahlen.</span></>
            : "Eine Vorlage wählen — jeder weitere Klick auf dieselbe würfelt neue Zahlen."}
        </p>
      </div>

      {/* Bereich */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="grid grid-cols-3 gap-3 max-w-md">
        {([["von", from, setFrom], ["bis", to, setTo], ["Schritt", step, setStep]] as const).map(
          ([label, val, set]) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-muted)]">
                {label}{pi ? " · π" : ""}
              </span>
              <input
                type="number" value={val}
                step={pi ? 0.25 : label === "Schritt" ? 0.5 : 1}
                min={label === "Schritt" ? 0.05 : undefined}
                onChange={e => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) set(label === "Schritt" ? Math.max(0.05, v) : v);
                }}
                className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm"
              />
            </label>
          ),
        )}
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer pb-1.5">
          <input type="checkbox" checked={pi} onChange={e => setPi(e.target.checked)} className="accent-[var(--accent)]" />
          in π rechnen
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-start">
        {/* Koordinatensystem */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            style={{ touchAction: "none" }}
            onPointerMove={onMove}
            onPointerLeave={() => setHoverX(null)}
            role="img"
            aria-label={`Graph von f(x) = ${src}`}
          >
            {/* Raster */}
            <g stroke="var(--border)" strokeWidth={1} opacity={0.4}>
              {ticks(view.x0, view.x1, xStep).map(t => (
                <line key={`gx${t}`} x1={sx(t)} y1={M} x2={sx(t)} y2={H - M} />
              ))}
              {ticks(view.y0, view.y1, yStep).map(t => (
                <line key={`gy${t}`} x1={M} y1={sy(t)} x2={W - M} y2={sy(t)} />
              ))}
            </g>

            {/* Achsen */}
            <g stroke="var(--text)" strokeWidth={1.8}>
              <line x1={M} y1={sy(0)} x2={W - M} y2={sy(0)} />
              <line x1={sx(0)} y1={M} x2={sx(0)} y2={H - M} />
            </g>
            <g fill="var(--text-muted)" fontSize={11} style={{ fontVariantNumeric: "tabular-nums" }}>
              {ticks(view.x0, view.x1, xStep).filter(t => Math.abs(t) > 1e-9).map(t => (
                <text key={`tx${t}`} x={sx(t)} y={sy(0) + 15} textAnchor="middle">{fmtX(t)}</text>
              ))}
              {ticks(view.y0, view.y1, yStep).filter(t => Math.abs(t) > 1e-9).map(t => (
                <text key={`ty${t}`} x={sx(0) - 6} y={sy(t) + 4} textAnchor="end">{fmt(t)}</text>
              ))}
              <text x={W - M + 4} y={sy(0) + 4} fontWeight={700}>x</text>
              <text x={sx(0) + 5} y={M - 6} fontWeight={700}>y</text>
            </g>

            {/* Kurve */}
            {paths.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="var(--accent)" strokeWidth={2.5}
                strokeLinecap="round" strokeLinejoin="round" />
            ))}

            {/* Tabellenpunkte — sie sind die Brücke zur Wertetabelle */}
            {rows.map((r, i) =>
              r.y === null ? null : (
                <circle
                  key={`p${i}`}
                  cx={sx(r.x)} cy={sy(r.y)}
                  r={hoverRow === i ? 7 : 4}
                  fill={hoverRow === i ? "#f59e0b" : "var(--accent)"}
                  stroke="var(--surface)" strokeWidth={1.5}
                  style={{ cursor: "pointer" }}
                  onPointerEnter={() => setHoverRow(i)}
                  onPointerLeave={() => setHoverRow(null)}
                  onClick={() => setWegX(r.x)}
                />
              ),
            )}

            {/* Fadenkreuz */}
            {marked && marked.y !== null && (
              <g>
                <line x1={sx(marked.x)} y1={sy(marked.y)} x2={sx(marked.x)} y2={sy(0)}
                  stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="4 3" />
                <line x1={sx(marked.x)} y1={sy(marked.y)} x2={sx(0)} y2={sy(marked.y)}
                  stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="4 3" />
                <circle cx={sx(marked.x)} cy={sy(marked.y)} r={6} fill="#f59e0b" />
                <g transform={`translate(${Math.min(sx(marked.x) + 10, W - 118)}, ${Math.max(sy(marked.y) - 26, M + 4)})`}>
                  <rect width={108} height={22} rx={5} fill="var(--bg)" stroke="#f59e0b" strokeWidth={1} />
                  <text x={54} y={15} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--text)">
                    ({fmtX(marked.x)} | {fmt(marked.y)})
                  </text>
                </g>
              </g>
            )}
          </svg>

          {/* Bewusst unveränderlich. Vorher stand hier abwechselnd der Hinweis
              oder die Punktangabe — zwei Texte verschiedener Länge, die je nach
              Spaltenbreite unterschiedlich oft umbrachen. Dadurch wuchs und
              schrumpfte die Seite bei jedem Überfahren der Tabelle. Die
              Koordinaten stehen ohnehin am Punkt selbst, im SVG, wo sie nichts
              umwerfen können. */}
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Über den Graphen oder die Tabelle fahren zeigt den Punkt samt Koordinaten.
            Anklicken zeigt den Rechenweg.
          </p>
        </div>

        {/* Wertetabelle */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 w-full lg:w-64">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Wertetabelle
          </div>
          <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="text-[var(--text-muted)]">
                <th className="text-left font-bold pb-1" style={{ color: "#8b5cf6" }}>x</th>
                <th className="text-left font-bold pb-1">f(x)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  onPointerEnter={() => setHoverRow(i)}
                  onPointerLeave={() => setHoverRow(null)}
                  className="border-t border-[var(--border)] cursor-pointer"
                  style={hoverRow === i ? { background: "rgba(245,158,11,0.15)" } : undefined}
                >
                  <td className="py-1 font-bold" style={{ color: "#8b5cf6" }}>{fmtX(r.x)}</td>
                  <td className="py-1">{r.y === null ? "—" : fmt(r.y)}</td>
                  <td className="py-1 text-right">
                    {r.y !== null && (
                      <button
                        onClick={() => setWegX(r.x)}
                        title={`Rechenweg für x = ${fmtX(r.x)}`}
                        aria-label={`Rechenweg für x = ${fmtX(r.x)}`}
                        className="text-xs w-5 h-5 rounded-full border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        ?
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={3} className="py-2 text-xs text-[var(--text-muted)]">
                  Kein Bereich — »von« muss kleiner als »bis« sein.
                </td></tr>
              )}
            </tbody>
          </table>
          {rows.some(r => r.y === null) && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              — heißt: dort ist die Funktion nicht definiert.
            </p>
          )}
        </div>
      </div>

      {wegX !== null && node && (
        <Rechenweg node={node} x={wegX} onClose={() => setWegX(null)} />
      )}
    </div>
  );
}
