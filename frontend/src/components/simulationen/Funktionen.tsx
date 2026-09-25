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
  START, TEMPLATES, axisStep, evalAt, fmt, fmtPi, hasX, parseFunction, piAxisStep,
  fmtPiLatex, normalForm, numLatex, panViewport, pxToUnits, quadraticCoeffs, squareViewport,
  substitutedLatex, substitutionSteps, tableRows, toLatex, vertex, vertexForm, xAtPixel,
  zoomViewport, type Instance, type Node, type Row, type Viewport,
} from "@/lib/funktionen";
import { Tex } from "@/components/Tex";

/* ── Zeichenfläche ─────────────────────────────────────────────────────────── */

const W = 640, H = 460, M = 34;      // Innenrand für die Achsenbeschriftung
const SNAP_PX = 14;                   // Einrastabstand zu Tabellenpunkten (viewBox)
const PLOT_W = W - 2 * M, PLOT_H = H - 2 * M;
const SAMPLES = 600;                 // Auflösung der Kurve

/**
 * y-Bereich aus den Werten, damit der Graph nicht aus dem Bild läuft.
 * `round` legt die Grenzen auf ganze Zahlen — dann trifft das Einer-Raster die
 * Ränder und man kann Kästchen zählen. Im π-Modus bleibt es krumm.
 */
function autoY(node: Node, x0: number, x1: number, round: boolean, tight = false): { y0: number; y1: number } {
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
  // Beim quadratischen Raster bleibt der y-Bereich eng: die Luft entsteht
  // ohnehin dadurch, dass das Seitenverhältnis die x-Achse aufzieht. Sonst
  // käme beides zusammen und der Ausschnitt würde unnötig weit.
  if (!tight) {
    const pad = (y1 - y0) * 0.12;
    y0 -= pad; y1 += pad;
  }
  if (round) { y0 = Math.floor(y0); y1 = Math.ceil(y1); }
  return { y0, y1 };
}

/* ── Rechenweg-Fenster ─────────────────────────────────────────────────────── */

/** Farbe für die Unbekannte und für jede Zahl, die an ihre Stelle getreten ist. */
const X_COLOR = "#8b5cf6";

function Rechenweg({ node, x, fmtValue, onClose }: {
  node: Node; x: number; fmtValue: (v: number) => string; onClose: () => void;
}) {
  const steps = useMemo(() => substitutionSteps(node, x, fmtValue), [node, x, fmtValue]);
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
              <span style={{ color: X_COLOR, fontWeight: 800 }}>x</span> wird durch{" "}
              <span style={{ color: X_COLOR, fontWeight: 800 }}>{fmt(x)}</span> ersetzt.
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
              <Tex tex={s.tex} className={i === steps.length - 1 ? "text-2xl" : "text-lg"} />
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

/** Quadratischer Knopf für die Ansichtssteuerung. */
function ZoomBtn({ onClick, title, children }: {
  onClick: () => void; title: string; children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-7 h-7 rounded-lg border border-[var(--border)] hover:border-[var(--accent)]
        text-sm leading-none flex items-center justify-center"
    >
      {children}
    </button>
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
  const [tabelleOffen, setTabelleOffen] = useState(true);
  const [schritteOffen, setSchritteOffen] = useState(true);
  // null = automatisch einpassen. Sobald jemand zoomt, steht hier sein Ausschnitt.
  const [zoom, setZoom] = useState<Viewport | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Läuft ein Ziehen? Merkt sich Startpunkt und Ausschnitt von damals, damit
  // die Verschiebung nicht von Zwischenschritten abhängt und nicht driftet.
  const drag = useRef<{ x: number; y: number; view: Viewport; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  // Nach einem echten Ziehen darf der Klick am Ende keinen Rechenweg öffnen.
  const swallowClick = useRef(false);

  /** π-Modus: die Eingabefelder rechnen in π, die Funktion in Bogenmaß. */
  const unit = pi ? Math.PI : 1;
  /** x-Werte beschriften — im π-Modus als Bruchteil von π. */
  const fmtX = (v: number) => (pi ? fmtPi(v) : fmt(v));
  /** Dasselbe für den Formelsatz: dort wird der Bruch wirklich gesetzt. */
  const texX = (v: number) => (pi ? fmtPiLatex(v) : numLatex(v));

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

  const baseView: Viewport = useMemo(() => {
    // Etwas Luft links und rechts, damit die Randpunkte nicht am Rahmen kleben.
    const a = from * unit, b = to * unit;
    const pad = Math.max((b - a) * 0.1, 0.5 * unit);
    const x0 = a - pad, x1 = b + pad;
    const roh: Viewport = node
      ? { x0, x1, ...autoY(node, x0, x1, !pi, !pi) }
      : { x0, x1, y0: -5, y1: 5 };
    // Ungestreckt sind die Kästchen quadratisch: ein Schritt nach rechts ist
    // so lang wie ein Schritt nach oben. Wer das nicht will, dehnt eine Achse
    // einzeln — dann gilt es bewusst nicht mehr.
    //
    // Im π-Modus nicht: dort ist ein x-Schritt ein Bruchteil von π und ein
    // y-Schritt eine 1 — die sind nicht vergleichbar, Quadrate hätten keine
    // Bedeutung.
    return pi ? roh : squareViewport(roh, PLOT_W, PLOT_H);
  }, [node, from, to, unit, pi]);

  const view = zoom ?? baseView;

  // Neue Funktion oder neuer Bereich: wieder automatisch einpassen. Ohne das
  // bliebe der alte Ausschnitt stehen und die neue Kurve läge daneben.
  useEffect(() => { setZoom(null); }, [src, from, to, pi]);

  /** Beide Achsen oder nur eine skalieren. Faktor < 1 heißt hineinzoomen. */
  const scale = (fx: number, fy: number) =>
    setZoom(v => zoomViewport(v ?? baseView, fx, fy));

  // Mausrad über der Zeichenfläche zoomt, wie in den üblichen Funktionenplottern.
  // Als nicht-passiver Listener, sonst darf preventDefault die Seite nicht
  // am Mitscrollen hindern.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      setZoom(v => zoomViewport(v ?? baseView, f, f));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [baseView]);

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

  // Einer-Raster, wo es lesbar bleibt — bei π-Achsen Vielfache von π.
  //
  // Stehen beide Achsen im selben Maßstab, bekommen sie auch dieselbe Teilung:
  // sonst wären die Maßstäbe zwar gleich, die Kästchen aber trotzdem länglich
  // (etwa 5er-Schritte quer, 1er-Schritte hoch).
  const spanX = view.x1 - view.x0, spanY = view.y1 - view.y0;
  const gleicherMassstab = !pi && Math.abs(spanX / PLOT_W - spanY / PLOT_H) < 1e-9;
  const gemeinsam = axisStep(Math.max(spanX, spanY), true);
  const xStep = pi ? piAxisStep(spanX) : gleicherMassstab ? gemeinsam : axisStep(spanX, true);
  const yStep = gleicherMassstab ? gemeinsam : axisStep(spanY, !pi);
  const ticks = (a: number, b: number, s: number) => {
    const out: number[] = [];
    for (let t = Math.ceil(a / s) * s; t <= b + 1e-9; t += s) out.push(Math.round(t * 1e6) / 1e6);
    return out;
  };

  function onDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false };
    swallowClick.current = false;
    setDragging(true);
    setHoverX(null);
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || !node) return;
    const r = svg.getBoundingClientRect();
    if (!(r.width > 0)) return;                       // noch nicht gelayoutet

    const d = drag.current;
    if (d) {
      const dxPx = e.clientX - d.x, dyPx = e.clientY - d.y;
      if (Math.abs(dxPx) + Math.abs(dyPx) > 3) d.moved = true;
      const dxU = pxToUnits(dxPx, r.width, W, PLOT_W, d.view.x1 - d.view.x0);
      const dyU = pxToUnits(dyPx, r.height, H, PLOT_H, d.view.y1 - d.view.y0);
      // Der Inhalt folgt dem Zeiger: nach rechts ziehen schiebt das Fenster
      // nach links, nach unten ziehen schiebt es nach oben.
      setZoom(panViewport(d.view, -dxU, dyU));
      return;
    }

    const px = ((e.clientX - r.left) / r.width) * W;  // Bildschirm → viewBox
    const py = ((e.clientY - r.top) / r.height) * H;
    // Nah an einem Tabellenpunkt rastet der Zeiger dort ein — so trifft man
    // die glatten Werte, statt x = 1,97 zu erwischen.
    let snap: number | null = null;
    let best = SNAP_PX;
    for (const p of rows) {
      if (p.y === null) continue;
      const dist = Math.hypot(sx(p.x) - px, sy(p.y) - py);
      if (dist < best) { best = dist; snap = p.x; }
    }
    setHoverX(snap ?? xAtPixel(px, view.x0, view.x1, W, M));
  }

  function onUp(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (svg?.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    swallowClick.current = drag.current?.moved ?? false;
    drag.current = null;
    setDragging(false);
  }

  // Punkt, der hervorgehoben wird: Tabelle hat Vorrang vor dem Graphen.
  const marked = hoverRow != null && rows[hoverRow]
    ? rows[hoverRow]
    : hoverX != null && node
      ? { x: hoverX, y: evalAt(node, hoverX) }
      : null;

  /** Die Zeilen der quer gelegten Tabelle: je Größe eine. */
  const TABELLE: { key: string; label: string; zelle: (r: Row) => ReactNode }[] = [
    { key: "x", label: "x", zelle: r => <span className="font-bold" style={{ color: X_COLOR }}>{fmtX(r.x)}</span> },
    { key: "y", label: "f(x)", zelle: r => (r.y === null ? "—" : fmt(r.y)) },
    {
      key: "punkt", label: "Punkt",
      // Dieselbe Schreibweise wie am Graphen — so ist die Tabellenspalte und
      // der Punkt im Koordinatensystem als dasselbe zu erkennen.
      // Auch gesetzt: sonst stößt der Trennstrich mit einem π-Bruch zusammen
      // (»P(−3π/2/0,707)«). Gestapelt ist der Bruch klar vom Trenner zu
      // unterscheiden.
      zelle: r => r.y === null ? "—" : (
        <Tex tex={`P(\\textcolor{${X_COLOR}}{${texX(r.x)}} / ${numLatex(r.y)})`} />
      ),
    },
    {
      key: "rechnung", label: "Rechnung",
      // Der Term mit eingesetztem x, in derselben Farbe wie die x-Zeile:
      // es ist überall dieselbe Zahl.
      zelle: r => (node ? <Tex tex={substitutedLatex(node, r.x, texX)} /> : null),
    },
    {
      key: "weg", label: "",
      zelle: r => r.y === null ? null : (
        <button
          onClick={() => setWegX(r.x)}
          title={`Rechenweg für x = ${fmtX(r.x)}`}
          aria-label={`Rechenweg für x = ${fmtX(r.x)}`}
          className="text-xs w-5 h-5 rounded-full border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          ?
        </button>
      ),
    },
  ];

  // Quadratisch? Dann lässt sich zwischen den beiden Formen umschalten. Die
  // Koeffizienten kommen aus Stützstellen, also geht das auch bei einem selbst
  // getippten Term, nicht nur bei der Vorlage.
  const quad = useMemo(() => (node ? quadraticCoeffs(node) : null), [node]);
  const formen = useMemo(() => {
    if (!quad) return null;
    return { nf: normalForm(quad), spf: vertexForm(quad) };
  }, [quad]);
  const vertexOf = useMemo(() => (quad ? vertex(quad) : { d: 0, e: 0 }), [quad]);

  const reset = () => {
    setSrc(START.src); setFrom(START.from); setTo(START.to);
    setStep(START.step); setPi(START.pi); setTpl(null); setZoom(null);
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
        {/* Der Term, wie er in einem Heft stünde. Die Eingabe bleibt Text —
            getippt wird »x^2«, gesetzt erscheint es hochgestellt. */}
        {parsed.ok && (
          <div className="rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-3 overflow-x-auto">
            <Tex tex={`f(x) = ${toLatex(node!)}`} className="text-2xl" />
          </div>
        )}
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
        {formen && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-[var(--text-muted)] mr-0.5">Form</span>
            {([["nf", "Normalform", formen.nf], ["spf", "Scheitelpunktform", formen.spf]] as const).map(
              ([key, label, term]) => (
                <button
                  key={key}
                  onClick={() => setSrc(term)}
                  title={`f(x) = ${term}`}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    src.trim() === term
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 font-bold"
                      : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
            <span className="text-xs text-[var(--text-muted)] ml-1">
              Scheitelpunkt ({fmt(vertexOf.d)} | {fmt(vertexOf.e)})
            </span>
          </div>
        )}

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

        {/* Ausschnitt. Beide Achsen zusammen — oder jede für sich, wenn eine
            Kurve flach liegt oder aus dem Bild läuft. */}
        <div className="flex items-center gap-1.5 pb-0.5 flex-wrap">
          <span className="text-xs text-[var(--text-muted)] mr-0.5">Ansicht</span>
          <ZoomBtn onClick={() => scale(1 / 1.4, 1 / 1.4)} title="Hineinzoomen">＋</ZoomBtn>
          <ZoomBtn onClick={() => scale(1.4, 1.4)} title="Herauszoomen">−</ZoomBtn>
          <span className="text-xs text-[var(--text-muted)] ml-1.5">x</span>
          <ZoomBtn onClick={() => scale(1 / 1.4, 1)} title="x-Achse dehnen">＋</ZoomBtn>
          <ZoomBtn onClick={() => scale(1.4, 1)} title="x-Achse stauchen">−</ZoomBtn>
          <span className="text-xs text-[var(--text-muted)] ml-1.5">y</span>
          <ZoomBtn onClick={() => scale(1, 1 / 1.4)} title="y-Achse dehnen">＋</ZoomBtn>
          <ZoomBtn onClick={() => scale(1, 1.4)} title="y-Achse stauchen">−</ZoomBtn>
          <button
            onClick={() => setZoom(null)}
            disabled={!zoom}
            title="Wieder automatisch einpassen"
            className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-40 ml-1"
          >
            Passend
          </button>
        </div>
      </div>

      {/* Wertetabelle — quer gelegt und über dem Diagramm: eine Zeile je
          Größe, eine Spalte je Stelle. So liest sie sich wie an der Tafel,
          und bei vielen Stellen wird waagerecht gescrollt statt in die Länge
          gezogen. Die Beschriftungsspalte bleibt dabei stehen. */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setTabelleOffen(o => !o)}
            aria-expanded={tabelleOffen}
            className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {tabelleOffen ? "▾" : "▸"} Wertetabelle
          </button>
          {tabelleOffen && (
            <button
              onClick={() => setSchritteOffen(o => !o)}
              aria-expanded={schritteOffen}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {schritteOffen ? "▾" : "▸"} Rechenschritte
            </button>
          )}
        </div>

        {!tabelleOffen ? null : rows.length ? (
          <div className="overflow-x-auto mt-2">
            <table className="text-sm border-collapse" style={{ fontVariantNumeric: "tabular-nums" }}>
              <tbody>
                {TABELLE.filter(z => schritteOffen || (z.key !== "rechnung" && z.key !== "weg")).map(zeile => (
                  <tr key={zeile.key} className="border-t border-[var(--border)] first:border-t-0">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-[var(--surface)] text-left font-bold
                        pr-3 py-1 whitespace-nowrap text-[var(--text-muted)]"
                      style={zeile.key === "x" ? { color: X_COLOR } : undefined}
                    >
                      {zeile.label}
                    </th>
                    {rows.map((r, i) => (
                      <td
                        key={i}
                        onPointerEnter={() => setHoverRow(i)}
                        onPointerLeave={() => setHoverRow(null)}
                        className="px-2 py-1 border-l border-[var(--border)] whitespace-nowrap cursor-pointer text-center"
                        style={hoverRow === i || hoverX === r.x ? { background: "rgba(245,158,11,0.15)" } : undefined}
                      >
                        {zeile.zelle(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Kein Bereich — »von« muss kleiner als »bis« sein.
          </p>
        )}

        {tabelleOffen && rows.some(r => r.y === null) && (
          <p className="text-xs text-[var(--text-muted)] mt-2">
            — heißt: dort ist die Funktion nicht definiert.
          </p>
        )}
      </div>

      <div>
        {/* Koordinatensystem */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => { if (!drag.current) setHoverX(null); }}
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
                  onClick={() => { if (!swallowClick.current) setWegX(r.x); }}
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
            Anklicken zeigt den Rechenweg. Mausrad zoomt, Ziehen verschiebt den Ausschnitt.
          </p>
        </div>

      </div>

      {wegX !== null && node && (
        <Rechenweg node={node} x={wegX} fmtValue={texX} onClose={() => setWegX(null)} />
      )}
    </div>
  );
}
