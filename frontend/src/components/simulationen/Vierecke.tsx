"use client";
/**
 * Vierecke — Formen, Umfang und Fläche in einem Werkzeug.
 *
 * Zusammengeführt aus zwei Werkzeugen des Mathetool-Ordners:
 *   »Formen«  — das Vierecke-Smartboard-Tool: sechs Vierecke, Formeln,
 *               Eigenschaften, Rechenweg.
 *   »Umfang«  — die Umfangsaufgabe des GeoTools, hier als Weide, die
 *               Feld für Feld eingezäunt wird: der Umfang ist die Länge
 *               des Zauns.
 *   »Fläche«  — die Flächenaufgabe des GeoTools: Einheitsquadrate auslegen.
 *
 * Beide Aufgaben gibt es nur für Quadrat und Rechteck — nur die zerfallen
 * lückenlos in Einheitsquadrate. Bei den anderen Formen zeigt das Blatt
 * »Fläche« stattdessen die Herleitung der Formel als Trickfilm; das Blatt
 * »Umfang« rechnet am Rechteck weiter und sagt das auch.
 *
 * Gelegt wird durch Antippen; mit gedrückter Maus/Finger auch im Streichen.
 * Auf dem Smartboard ist das zuverlässiger als Ziehen und Ablegen.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { wahl, zahlen, type Vorgabe } from "@/lib/vorgabe";
import {
  SHAPES, SHAPE_ORDER, bounds, defaults, fmt,
  type ShapeKey, type Vals,
} from "@/lib/vierecke";
import Herleitung from "@/components/simulationen/Herleitung";

type Tab = "formen" | "umfang" | "flaeche";

const VB = { w: 620, h: 420 };
const PAD = { x: 74, y: 62 };
const VERTEX_LABELS = ["A", "B", "C", "D"];

/* ────────────────────────────────────────────────────────────── Formen ── */

function Figur({ shapeKey, vals }: { shapeKey: ShapeKey; vals: Vals }) {
  const shape = SHAPES[shapeKey];
  const pts = shape.poly(vals);
  const b = bounds(pts);
  const scale = Math.min(
    (VB.w - 2 * PAD.x) / (b.width || 1),
    (VB.h - 2 * PAD.y) / (b.height || 1),
  );
  const ox = (VB.w - b.width * scale) / 2 - b.minX * scale;
  const oy = (VB.h - b.height * scale) / 2 - b.minY * scale;
  const P = pts.map(p => ({ x: ox + p.x * scale, y: oy + p.y * scale }));

  // Rasterlinien im Abstand einer Einheit — macht die Maße ablesbar.
  const lines: ReactNode[] = [];
  for (let i = 0; i <= Math.ceil(b.width); i++) {
    const x = ox + (b.minX + i) * scale;
    lines.push(<line key={`v${i}`} x1={x} y1={oy} x2={x} y2={oy + b.height * scale} />);
  }
  for (let i = 0; i <= Math.ceil(b.height); i++) {
    const y = oy + (b.minY + i) * scale;
    lines.push(<line key={`h${i}`} x1={ox} y1={y} x2={ox + b.width * scale} y2={y} />);
  }

  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full h-auto max-h-[60vh]" role="img"
      aria-label={`${shape.title} mit den eingestellten Maßen`}>
      <g stroke="var(--border)" strokeWidth={1} opacity={0.45}>{lines}</g>

      <polygon
        points={P.map(p => `${p.x},${p.y}`).join(" ")}
        fill="var(--accent)" fillOpacity={0.14}
        stroke="var(--accent)" strokeWidth={3} strokeLinejoin="round"
      />

      {/* Höhe als gestrichelte Senkrechte, wo sie zur Formel gehört */}
      {(shapeKey === "parallelogramm" || shapeKey === "trapez") && (
        <line
          x1={P[3].x} y1={P[3].y} x2={P[3].x} y2={P[0].y}
          stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4"
        />
      )}
      {/* Diagonalen, wo die Formel sie braucht */}
      {(shapeKey === "raute" || shapeKey === "drachen") && (
        <g stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4">
          <line x1={P[0].x} y1={P[0].y} x2={P[2].x} y2={P[2].y} />
          <line x1={P[1].x} y1={P[1].y} x2={P[3].x} y2={P[3].y} />
        </g>
      )}

      {P.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill="var(--accent)" />
          <text
            x={p.x + (p.x < VB.w / 2 ? -14 : 14)}
            y={p.y + (p.y < VB.h / 2 ? -12 : 20)}
            textAnchor="middle" fontSize={17} fontWeight={800} fill="var(--text)"
          >
            {VERTEX_LABELS[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────── Legen (Zaun & Fläche) ── */

/** Gemeinsame Streich-Geste: gedrückt halten und über die Felder fahren. */
function usePaint(place: (i: number) => void) {
  const down = useRef(false);
  useEffect(() => {
    const up = () => { down.current = false; };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
  return {
    onPointerDown: (i: number) => () => { down.current = true; place(i); },
    onPointerEnter: (i: number) => () => { if (down.current) place(i); },
  };
}

const CELL = 46;
const FENCE = 26; // Tiefe eines Zaunfelds am Rand

/**
 * Ein Zaunfeld: zwei Pfosten, zwei Querlatten. Waagerecht oder senkrecht,
 * je nachdem, an welcher Seite der Weide es steht.
 */
function Zaunfeld({ x, y, w, h, horizontal }: {
  x: number; y: number; w: number; h: number; horizontal: boolean;
}) {
  const wood = "#a86b3c", woodDark = "#7c4a24", rail = "#c8894f";
  if (horizontal) {
    const postW = 7;
    return (
      <g>
        <rect x={x + 2} y={y + h * 0.28} width={w - 4} height={4} rx={1.5} fill={rail} />
        <rect x={x + 2} y={y + h * 0.62} width={w - 4} height={4} rx={1.5} fill={rail} />
        <rect x={x + 3} y={y} width={postW} height={h} rx={2} fill={wood} />
        <rect x={x + w - postW - 3} y={y} width={postW} height={h} rx={2} fill={wood} />
        <rect x={x + 3} y={y} width={postW} height={3} fill={woodDark} />
        <rect x={x + w - postW - 3} y={y} width={postW} height={3} fill={woodDark} />
      </g>
    );
  }
  const postH = 7;
  return (
    <g>
      <rect x={x + w * 0.28} y={y + 2} width={4} height={h - 4} rx={1.5} fill={rail} />
      <rect x={x + w * 0.62} y={y + 2} width={4} height={h - 4} rx={1.5} fill={rail} />
      <rect x={x} y={y + 3} width={w} height={postH} rx={2} fill={wood} />
      <rect x={x} y={y + h - postH - 3} width={w} height={postH} rx={2} fill={wood} />
    </g>
  );
}

type Seg = { x: number; y: number; w: number; h: number; horizontal: boolean };

/** Die Umfangs-Segmente der Weide, im Uhrzeigersinn ab oben links. */
function fenceSegments(a: number, b: number): Seg[] {
  const segs: Seg[] = [];
  const gx = FENCE, gy = FENCE;
  for (let i = 0; i < a; i++) segs.push({ x: gx + i * CELL, y: 0, w: CELL, h: FENCE, horizontal: true });
  for (let i = 0; i < b; i++) segs.push({ x: gx + a * CELL, y: gy + i * CELL, w: FENCE, h: CELL, horizontal: false });
  for (let i = a - 1; i >= 0; i--) segs.push({ x: gx + i * CELL, y: gy + b * CELL, w: CELL, h: FENCE, horizontal: true });
  for (let i = b - 1; i >= 0; i--) segs.push({ x: 0, y: gy + i * CELL, w: FENCE, h: CELL, horizontal: false });
  return segs;
}

function Weide({ a, b, done, onPlace }: {
  a: number; b: number; done: boolean[]; onPlace: (i: number) => void;
}) {
  const segs = fenceSegments(a, b);
  const paint = usePaint(onPlace);
  const w = a * CELL + 2 * FENCE;
  const h = b * CELL + 2 * FENCE;
  const complete = done.every(Boolean);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto max-h-[60vh]" style={{ touchAction: "none" }}
      role="group" aria-label="Weide zum Einzäunen">
      {/* Weide */}
      <rect x={FENCE} y={FENCE} width={a * CELL} height={b * CELL} fill="#4e9a3e" />
      <g stroke="#3f7f32" strokeWidth={1}>
        {Array.from({ length: a + 1 }, (_, i) => (
          <line key={`gv${i}`} x1={FENCE + i * CELL} y1={FENCE} x2={FENCE + i * CELL} y2={FENCE + b * CELL} />
        ))}
        {Array.from({ length: b + 1 }, (_, i) => (
          <line key={`gh${i}`} x1={FENCE} y1={FENCE + i * CELL} x2={FENCE + a * CELL} y2={FENCE + i * CELL} />
        ))}
      </g>

      {/* Erst wenn der Zaun dicht ist, dürfen die Tiere raus auf die Weide. */}
      {complete && (
        <text x={FENCE + (a * CELL) / 2} y={FENCE + (b * CELL) / 2 + 12}
          textAnchor="middle" fontSize={34}>🐑</text>
      )}

      {segs.map((s, i) => (
        <g key={i}>
          {done[i]
            ? <Zaunfeld {...s} />
            : (
              <rect
                x={s.x + 2} y={s.y + 2} width={s.w - 4} height={s.h - 4} rx={3}
                fill="rgba(0,0,0,0.16)" stroke="#8a5a2b" strokeWidth={1.5} strokeDasharray="5 4"
              />
            )}
          {/* Grosszuegige Trefferflaeche — Finger und Smartboard-Stift. */}
          <rect
            x={s.x} y={s.y} width={s.w} height={s.h} fill="transparent"
            style={{ cursor: done[i] ? "default" : "pointer" }}
            onPointerDown={paint.onPointerDown(i)}
            onPointerEnter={paint.onPointerEnter(i)}
          />
        </g>
      ))}
    </svg>
  );
}

function Flaechenfeld({ a, b, done, onPlace }: {
  a: number; b: number; done: boolean[]; onPlace: (i: number) => void;
}) {
  const paint = usePaint(onPlace);
  const w = a * CELL, h = b * CELL;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto max-h-[60vh]" style={{ touchAction: "none" }}
      role="group" aria-label="Fläche zum Auslegen">
      <rect x={0} y={0} width={w} height={h} fill="var(--surface)" stroke="var(--accent)" strokeWidth={3} />
      {Array.from({ length: a * b }, (_, i) => {
        const cx = (i % a) * CELL, cy = Math.floor(i / a) * CELL;
        return (
          <g key={i}>
            {done[i] ? (
              <g>
                <rect x={cx + 2} y={cy + 2} width={CELL - 4} height={CELL - 4} rx={3}
                  fill="var(--accent)" fillOpacity={0.55} stroke="var(--accent)" strokeWidth={1.5} />
                <text x={cx + CELL / 2} y={cy + CELL / 2 + 4} textAnchor="middle"
                  fontSize={11} fontWeight={700} fill="var(--text)">1</text>
              </g>
            ) : (
              <rect x={cx + 1} y={cy + 1} width={CELL - 2} height={CELL - 2}
                fill="transparent" stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3" />
            )}
            <rect
              x={cx} y={cy} width={CELL} height={CELL} fill="transparent"
              style={{ cursor: done[i] ? "default" : "pointer" }}
              onPointerDown={paint.onPointerDown(i)}
              onPointerEnter={paint.onPointerEnter(i)}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ───────────────────────────────────────────────────────────── Werkzeug ── */

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "formen", label: "Formen", icon: "📐" },
  { id: "umfang", label: "Umfang", icon: "🚧" },
  { id: "flaeche", label: "Fläche", icon: "🧱" },
];

/**
 * `vorgabe` (TaskCrawler-Station): { form: "trapez", masse: { a: 8, c: 4, h: 3 }, blatt?: "formen" | "umfang" | "flaeche",
 * rechnung?: true }. Form, Maße und Blatt stehen dann fest; die fertige Rechnung (u = …, A = …) bleibt
 * verborgen, außer `rechnung: true` — sonst stünde die Antwort schon da.
 */
export default function Vierecke({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festeForm = wahl(vorgabe, "form", SHAPE_ORDER);
  const festesBlatt = festeForm ? (wahl(vorgabe, "blatt", TABS.map(t => t.id)) ?? "formen") : undefined;
  const rechnungZeigen = !festeForm || vorgabe?.rechnung === true;
  const [tab, setTab] = useState<Tab>(festesBlatt ?? "formen");
  const [shapeKey, setShapeKey] = useState<ShapeKey>(festeForm ?? "quadrat");
  const [vals, setVals] = useState<Vals>(() => {
    if (!festeForm) return defaults(SHAPES.quadrat);
    // Nur Maße übernehmen, die die Form kennt, und innerhalb ihrer Grenzen.
    const d = defaults(SHAPES[festeForm]);
    const m = zahlen(vorgabe, "masse") ?? {};
    for (const f of SHAPES[festeForm].fields) {
      if (m[f.key] !== undefined) d[f.key] = Math.min(f.max, Math.max(f.min, m[f.key]));
    }
    return d;
  });

  const shape = SHAPES[shapeKey];

  // Die Aufgaben brauchen ein Raster. Wer sie mit einem Trapez aufruft,
  // rechnet auf dem Rechteck weiter — die Form bleibt aber gewählt.
  const gridVals = shape.gridable ? vals : defaults(SHAPES.rechteck);
  const a = Math.round(gridVals.a ?? 6);
  const b = Math.round(shapeKey === "quadrat" ? a : (gridVals.b ?? 4));

  const segCount = 2 * (a + b);
  const cellCount = a * b;
  const [fence, setFence] = useState<boolean[]>(() => Array(segCount).fill(false));
  const [tiles, setTiles] = useState<boolean[]>(() => Array(cellCount).fill(false));

  // Maße geändert → die Aufgabe beginnt neu, sonst passte das Gelegte nicht mehr.
  useEffect(() => { setFence(Array(segCount).fill(false)); }, [segCount]);
  useEffect(() => { setTiles(Array(cellCount).fill(false)); }, [cellCount]);

  function pickShape(k: ShapeKey) {
    setShapeKey(k);
    setVals(defaults(SHAPES[k]));
  }

  const u = shape.perimeter(vals);
  const A = shape.area(vals);
  const fenceDone = fence.filter(Boolean).length;
  const tilesDone = tiles.filter(Boolean).length;

  const setAll = (v: boolean) => {
    if (tab === "umfang") setFence(Array(segCount).fill(v));
    else if (tab === "flaeche") setTiles(Array(cellCount).fill(v));
  };

  const place = (arr: boolean[], set: (b: boolean[]) => void) => (i: number) => {
    if (arr[i]) return;
    const next = [...arr];
    next[i] = true;
    set(next);
  };

  const zaunHinweis = useMemo(() => {
    if (fenceDone === 0) return `Tippe die Lücken an — es fehlen noch ${segCount} Zaunfelder.`;
    if (fenceDone < segCount) return `${fenceDone} von ${segCount} Zaunfeldern stehen — ${segCount - fenceDone} fehlen noch.`;
    return `Der Zaun ist dicht: ${segCount} Zaunfelder, also u = ${segCount}.`;
  }, [fenceDone, segCount]);

  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📐 Vierecke</h1>
          <p className="text-muted text-sm mt-1">
            Sechs Vierecke mit Formeln und Eigenschaften — und zwei Aufgaben zum Anfassen:
            die Weide einzäunen (Umfang) und die Fläche auslegen.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {/* Blätter */}
      {!festeForm && <div className="inline-flex self-start rounded-xl border border-line p-1 bg-surface">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              tab === t.id
                ? "bg-accent text-accent-fg"
                : "text-muted hover:text-fg"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>}

      {/* Formwahl — gilt für alle Blätter */}
      {!festeForm && <div className="flex flex-wrap gap-2">
        {SHAPE_ORDER.map(k => {
          const s = SHAPES[k];
          const dimmed = tab === "umfang" && !s.gridable;
          return (
            <button
              key={k}
              onClick={() => pickShape(k)}
              title={dimmed ? `${s.title}: Zaun legen geht nur bei Quadrat und Rechteck` : s.title}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                shapeKey === k
                  ? "border-accent bg-accent/10 font-bold"
                  : "border-line hover:border-accent"
              } ${dimmed ? "opacity-45" : ""}`}
            >
              <span className="mr-1">{s.icon}</span>{s.title}
            </button>
          );
        })}
      </div>}

      {/* Maße */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {shape.fields.map(f => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-xs text-muted">
              {f.label} = <strong className="text-fg">{fmt(vals[f.key])}</strong>
            </span>
            <input
              type="range" min={f.min} max={f.max} step={1}
              value={vals[f.key]} disabled={!!festeForm}
              onChange={e => setVals(v => ({ ...v, [f.key]: Number(e.target.value) }))}
              className="accent-accent"
            />
          </label>
        ))}
      </div>

      {tab === "formen" && (
        <>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
              <strong>u</strong> · {shape.formulaU}
            </span>
            <span className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
              <strong>A</strong> · {shape.formulaA}
            </span>
          </div>

          <div className="card p-4">
            <Figur shapeKey={shapeKey} vals={vals} />
          </div>

          {rechnungZeigen && <div className="card p-4 flex flex-col gap-2">
            <div className="font-mono text-sm">{shape.stepsU(vals)}</div>
            <div className="font-mono text-sm">{shape.stepsA(vals)}</div>
            <div className="text-xs text-muted mt-1">
              Umfang u = {fmt(u)} · Fläche A = {fmt(A)}
            </div>
          </div>}

          <div className="card p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted mb-2">
              Eigenschaften
            </div>
            <ul className="list-disc pl-5 text-sm flex flex-col gap-1">
              {shape.properties.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        </>
      )}

      {tab === "flaeche" && !shape.gridable && (
        <div className="card p-4">
          <Herleitung shapeKey={shapeKey} vals={vals} />
        </div>
      )}

      {(tab === "umfang" || (tab === "flaeche" && shape.gridable)) && (
        <>
          {!shape.gridable && (
            <p className="text-sm rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              Den Zaun Feld für Feld legen geht nur beim Quadrat und beim Rechteck. Gerechnet wird
              hier deshalb am Rechteck {a} × {b}.
            </p>
          )}

          <div className="card p-4">
            {tab === "umfang"
              ? <Weide a={a} b={b} done={fence} onPlace={place(fence, setFence)} />
              : <Flaechenfeld a={a} b={b} done={tiles} onPlace={place(tiles, setTiles)} />}
          </div>

          <div className="card p-4 flex flex-col gap-2">
            {tab === "umfang" ? (
              <>
                <div className="text-sm">{zaunHinweis}</div>
                <div className="font-mono text-sm">
                  u = 2 · ({a} + {b}) = {segCount}
                </div>
                <div className="text-xs text-muted">
                  Der Umfang ist die Länge des Zauns — einmal rundherum, nicht die Weide selbst.
                </div>
              </>
            ) : (
              <>
                <div className="text-sm">
                  {tilesDone < cellCount
                    ? `${tilesDone} von ${cellCount} Einheitsquadraten liegen — ${cellCount - tilesDone} fehlen noch.`
                    : `Die Fläche ist ausgelegt: ${cellCount} Einheitsquadrate, also A = ${cellCount}.`}
                </div>
                <div className="font-mono text-sm">A = {a} · {b} = {cellCount}</div>
                <div className="text-xs text-muted">
                  Die Fläche ist das, was drinnen liegt — gezählt in Einheitsquadraten.
                </div>
              </>
            )}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setAll(true)}
                className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent"
              >
                Alles auslegen
              </button>
              <button
                onClick={() => setAll(false)}
                className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent"
              >
                ↺ Zurücksetzen
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
