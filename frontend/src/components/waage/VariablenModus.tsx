"use client";
/**
 * Variablenmodus: beliebige Formeln nach einer Größe umstellen.
 *
 * Jedes Monom liegt als Flächenmodell in der Schale — `m·a` mit m = 5 und
 * a = 2 ist ein Rechteck aus 5 × 2 Gewichten, die Kanten in den Farben der
 * beiden Größen. So bleibt wahr, was die Waage verspricht: die Zahl der
 * Gewichte ist das Gewicht.
 */
import { useCallback, useMemo, useState } from "react";
import { fmtNum, MINUS } from "@/lib/gleichung";
import {
  applyFOp, evalExpr, evalMono, exprToLatex, feqToLatex, formatExpr, formatFOp, initialValues,
  isolated, monoBody, monoKey, parseFormel, parseSingleMono, PRESETS, solveFor, suggestFOps, varsOf,
  type Feq, type FOp, type Expr, type Mono, type Values,
} from "@/lib/formel";
import {
  Balance, bestLayout, Konfetti, Piece, Protokoll, tiltFor, useExitingItems, useWobble,
  type PanContent, type Placed,
} from "./Balance";
import { Tex } from "@/components/Tex";

const PALETTE = ["#a78bfa", "#22d3ee", "#f472b6", "#34d399", "#fb923c", "#60a5fa", "#e879f9", "#facc15"];
const NEUTRAL = "#94a3b8";

const CELL = 26;
const CGAP = 3;
const STRIP = 18;
const PAD = 6;
const MAX_CELLS = 60;

type Cell = { i: number; x: number; y: number; frac: number };
type Edge = { label: string; value: number | null; color: string };
type Split = { cols: number; top: Edge; side: { label: string; color: string } };

type Tile = Placed & {
  id: string;
  cells: Cell[];
  neg: boolean;
  compact: string | null;
  top: { label: string; color: string } | null;
  side: { label: string; color: string } | null;
};

const colorsFor = (names: string[]): Record<string, string> =>
  Object.fromEntries(names.map((n, i) => [n, PALETTE[i % PALETTE.length]]));

/** Ein Monom als Rechteck: erste Kante = erster Faktor, zweite Kante = Rest. */
function tileFor(m: Mono, values: Values, colors: Record<string, string>, prefix: string): Tile | null {
  const raw = evalMono(m, values);
  const id = `${prefix}-${monoKey(m)}-${m.c < 0 ? "m" : "p"}`;
  const base: Tile = {
    id, cells: [], neg: (raw ?? 0) < 0, compact: null, top: null, side: null,
    w: 0, h: 0, px: 0, py: 0, tx: 0, ty: 0,
  };
  if (raw === null) return { ...base, ...compactBox(monoBody(m), "?", NEUTRAL) };
  const total = Math.abs(raw);
  if (total === 0) return null;

  // Kanten: Zahl-Faktor und jede Variable mit positivem Exponenten.
  const edges: Edge[] = [];
  if (Math.abs(m.c) !== 1) edges.push({ label: fmtNum(Math.abs(m.c)), value: Math.abs(m.c), color: NEUTRAL });
  for (const [k, e] of Object.entries(m.v)) {
    if (e < 0) continue;
    for (let i = 0; i < e; i++) edges.push({ label: k, value: values[k], color: colors[k] ?? NEUTRAL });
  }
  const hasQuotient = Object.values(m.v).some(e => e < 0);

  // Echtes Rechteck nur, wenn die Kanten ganzzahlig aufgehen. Von allen
  // möglichen Aufteilungen die kompakteste nehmen — m·g·h wird so 4 × 6
  // statt 3 × 8.
  let rect: Split | null = null;
  if (!hasQuotient && edges.length > 1) {
    let bestDiff = Infinity;
    for (let i = 0; i < edges.length; i++) {
      const cols = edges[i].value;
      if (cols === null || !Number.isInteger(cols) || cols <= 0) continue;
      const rows = total / cols;
      if (!Number.isInteger(rows) || rows <= 0) continue;
      if (Math.abs(cols - rows) >= bestDiff) continue;
      bestDiff = Math.abs(cols - rows);
      const rest = edges.filter((_, k) => k !== i);
      rect = {
        cols,
        top: edges[i],
        side: { label: rest.map(r => r.label).join("·"), color: rest.length === 1 ? rest[0].color : NEUTRAL },
      };
    }
  }

  // Ein Bruch bekommt den ganzen Term als Kantenbeschriftung, nicht nur den Zähler.
  const top = rect
    ? rect.top
    : hasQuotient || !edges.length
      ? { label: monoBody(m), value: total, color: edges[0]?.color ?? NEUTRAL }
      : edges[0];

  if (total > MAX_CELLS)
    return { ...base, ...compactBox(monoBody(m), fmtNum(raw), top.color), top: { label: top.label, color: top.color } };

  const cols = rect ? rect.cols : Math.min(6, Math.max(1, Math.ceil(Math.sqrt(total))));

  const cells: Cell[] = [];
  const whole = Math.floor(total + 1e-9);
  const restFrac = Math.round((total - whole) * 1e6) / 1e6;
  const n = whole + (restFrac > 0 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    cells.push({
      i,
      x: (i % cols) * (CELL + CGAP),
      y: Math.floor(i / cols) * (CELL + CGAP),
      frac: i < whole ? 1 : restFrac,
    });
  }
  const rows = Math.ceil(n / cols);
  const gridW = cols * CELL + (cols - 1) * CGAP;
  const gridH = rows * CELL + (rows - 1) * CGAP;

  return {
    ...base,
    cells,
    top: { label: top.label, color: top.color },
    side: rect ? rect.side : null,
    w: STRIP + PAD * 2 + gridW,
    h: STRIP + PAD * 2 + gridH,
  };
}

function layoutTiles(
  e: Expr, values: Values, colors: Record<string, string>, prefix: string,
): { tiles: Tile[]; scale: number } {
  const tiles = e.map(m => tileFor(m, values, colors, prefix)).filter((t): t is Tile => t !== null);
  return { tiles, scale: bestLayout(tiles).scale };
}

function compactBox(label: string, value: string, color: string) {
  return { compact: `${label} = ${value}`, w: Math.max(96, label.length * 11 + 60), h: 46, top: { label, color } };
}

function TileShape({ t }: { t: Tile }) {
  return (
    <g>
      <rect x={0} y={0} width={t.w} height={t.h} rx={11}
        fill={t.neg ? "rgba(225,29,72,0.10)" : "rgba(148,163,184,0.10)"}
        stroke={t.neg ? "#e11d48" : "var(--border)"} strokeWidth={1.5} />
      {t.top && (
        <>
          <rect x={t.side ? STRIP : 0} y={0} width={t.w - (t.side ? STRIP : 0)} height={STRIP} rx={6} fill={t.top.color} />
          <text x={t.side ? STRIP + (t.w - STRIP) / 2 : t.w / 2} y={STRIP / 2 + 1} textAnchor="middle"
            dominantBaseline="central" fontSize={13} fontWeight={800} fill="#111">
            {t.neg ? MINUS : ""}{t.top.label}
          </text>
        </>
      )}
      {t.side && (
        <>
          <rect x={0} y={STRIP} width={STRIP} height={t.h - STRIP} rx={6} fill={t.side.color} />
          <text x={STRIP / 2} y={STRIP + (t.h - STRIP) / 2} textAnchor="middle" dominantBaseline="central"
            fontSize={13} fontWeight={800} fill="#111"
            transform={`rotate(-90 ${STRIP / 2} ${STRIP + (t.h - STRIP) / 2})`}>
            {t.side.label}
          </text>
        </>
      )}
      {t.compact ? (
        <text x={t.w / 2} y={STRIP + (t.h - STRIP) / 2} textAnchor="middle" dominantBaseline="central"
          fontSize={15} fontWeight={800} fill="var(--text)">{t.compact.split(" = ")[1]}</text>
      ) : (
        t.cells.map(c => (
          <g key={c.i} transform={`translate(${STRIP + PAD + c.x}, ${STRIP + PAD + c.y})`}>
            <rect x={0} y={CELL * (1 - c.frac)} width={CELL} height={CELL * c.frac} rx={5}
              fill={t.neg ? "url(#gwNeg)" : "url(#gwN)"} stroke="#00000022" strokeWidth={0.8} />
          </g>
        ))
      )}
    </g>
  );
}

function Tiles({ tiles }: { tiles: Tile[] }) {
  const shown = useExitingItems(tiles);
  return (
    <>
      {shown.map(t => (
        <Piece key={t.id} tx={t.tx} ty={t.ty} gone={t.gone}>
          <TileShape t={t} />
        </Piece>
      ))}
    </>
  );
}

const DEFS = (
  <>
    <linearGradient id="gwN" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fde68a" />
      <stop offset="1" stopColor="#f59e0b" />
    </linearGradient>
    <linearGradient id="gwNeg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fb7185" />
      <stop offset="1" stopColor="#e11d48" />
    </linearGradient>
  </>
);

const SIGNS = ["+", MINUS, "·", ":"] as const;
type SignKey = (typeof SIGNS)[number];

const START = PRESETS[0];

/** Feste Formel (TaskCrawler-Station): gesuchte Größe und Werte vorgegeben, keine anderen Formeln. */
export interface FesteFormel { formel: string; nach?: string; werte?: Record<string, number> }

export default function VariablenModus({ onMessage, fest }: { onMessage: (m: string) => void; fest?: FesteFormel }) {
  // Die feste Formel gilt nur, wenn sie sich lesen lässt — sonst die übliche Vorlage.
  const [anfang] = useState(() => {
    const r = fest ? parseFormel(fest.formel) : null;
    if (fest && r?.ok) {
      const vs = varsOf(r.eq);
      const t = fest.nach && vs.includes(fest.nach) ? fest.nach : vs[vs.length - 1];
      return { eq: r.eq, target: t, values: fest.werte };
    }
    const s = parseFormel(START.formel);
    return { eq: s.ok ? s.eq : { left: [], right: [] }, target: START.target, values: START.values };
  });
  const [chain, setChain] = useState<Feq[]>([anfang.eq]);
  const [ops, setOps] = useState<FOp[]>([]);
  const [target, setTarget] = useState(anfang.target);
  const [values, setValues] = useState<Values>(() => initialValues(anfang.eq, anfang.target, anfang.values));
  const [wobble, kick] = useWobble();
  const [sign, setSign] = useState<SignKey>(":");
  const [input, setInput] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("E = m·g·h");

  const current = chain[chain.length - 1];
  const names = useMemo(() => varsOf(chain[0]), [chain]);
  const colors = useMemo(() => colorsFor(names), [names]);

  const targetValue = solveFor(current, target, values);
  // Stabile Identität: die Kacheln hängen daran, sonst rendert die Schale endlos.
  const allValues = useMemo<Values>(
    () => ({ ...values, [target]: targetValue ?? 1 }),
    [values, target, targetValue],
  );
  const done = isolated(current, target);

  const apply = useCallback((op: FOp) => {
    setChain(c => [...c, applyFOp(c[c.length - 1], op)]);
    setOps(o => [...o, op]);
    kick();
  }, [kick]);

  const start = useCallback((eq: Feq, t: string, preset?: Record<string, number>) => {
    setChain([eq]);
    setOps([]);
    setTarget(t);
    setValues(initialValues(eq, t, preset));
    kick();
  }, [kick]);

  const chooseTarget = (v: string) => {
    if (v === target || fest) return;
    // Die bisher gesuchte Größe bekommt ihren errechneten Wert, damit die
    // Formel weiter durchgerechnet werden kann.
    setValues(old => ({ ...old, [target]: targetValue ?? 2, [v]: null }));
    setTarget(v);
    setChain([chain[0]]);
    setOps([]);
    kick();
  };

  const applyManual = () => {
    const r = parseSingleMono(input);
    if (!r.ok) return onMessage(r.error);
    if (sign === "+" || sign === MINUS)
      apply({ op: "add", m: sign === MINUS ? { c: -r.m.c, v: r.m.v } : r.m });
    else if (r.m.c === 0) return onMessage("Durch 0 kann man nicht teilen.");
    else apply(sign === "·" ? { op: "mul", m: r.m } : { op: "div", m: r.m });
    setInput("");
  };

  const applyCustom = () => {
    const r = parseFormel(customText);
    if (!r.ok) return onMessage(r.error);
    // Die zuletzt genannte Größe ist meist die interessante — E = m·g·h ⇒ h.
    const vs = varsOf(r.eq);
    start(r.eq, vs[vs.length - 1], undefined);
    setCustomOpen(false);
  };

  const leftPan = useMemo(() => layoutTiles(current.left, allValues, colors, "L"), [current.left, allValues, colors]);
  const rightPan = useMemo(() => layoutTiles(current.right, allValues, colors, "R"), [current.right, allValues, colors]);

  const wl = evalExpr(current.left, allValues) ?? 0;
  const wr = evalExpr(current.right, allValues) ?? 0;
  const tilt = tiltFor(wl, wr, wobble);

  const chips = done ? [] : suggestFOps(current, target);
  const preview = useMemo(() => parseFormel(customText), [customText]);
  const pan = (p: { tiles: Tile[]; scale: number }, e: Expr): PanContent => ({
    node: <Tiles tiles={p.tiles} />, scale: p.scale, label: formatExpr(e), empty: !p.tiles.length,
  });

  const resultSide = done && current.left.length === 1 && current.left[0].v[target] ? current.right : current.left;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!fest && PRESETS.map(p => (
          <button key={p.formel} title={p.label}
            onClick={() => {
              const r = parseFormel(p.formel);
              if (r.ok) start(r.eq, p.target, p.values);
            }}
            className="px-3 py-1.5 rounded-xl text-sm font-medium border border-(--border) text-(--text-muted) hover:text-(--text) hover:border-(--accent)">
            {p.formel}
          </button>
        ))}
        {!fest && <button onClick={() => setCustomOpen(o => !o)}
          className="px-3 py-1.5 rounded-xl text-sm border border-(--border) text-(--text-muted) hover:text-(--text) hover:border-(--accent)">
          ✏️ Eigene Formel
        </button>}
        <div className="flex-1" />
        <button onClick={() => { setChain(c => c.slice(0, -1)); setOps(o => o.slice(0, -1)); kick(); }}
          disabled={chain.length < 2}
          className="text-sm border border-(--border) rounded-lg px-3 py-1.5 hover:border-(--accent) disabled:opacity-40">
          ↶ Zurück
        </button>
        <button onClick={() => { setChain([chain[0]]); setOps([]); kick(); }} disabled={chain.length < 2}
          className="text-sm border border-(--border) rounded-lg px-3 py-1.5 hover:border-(--accent) disabled:opacity-40">
          ↺ Von vorn
        </button>
      </div>

      {customOpen && (
        <div className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 items-center">
            <input value={customText} onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applyCustom(); }}
              placeholder="z. B. E = m·g·h"
              className="flex-1 min-w-[220px] bg-(--bg) border border-(--border) rounded-lg px-3 py-2 text-base font-mono" />
            <button onClick={applyCustom}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-(--accent) text-(--accent-text,#111)">
              Auf die Waage
            </button>
          </div>
          <div className="text-sm min-h-7">
            {preview.ok ? (
              <>
                <span className="text-(--text-muted)">So lese ich das: </span>
                <Tex tex={feqToLatex(preview.eq)} />
              </>
            ) : (
              <span className="text-(--red)">{preview.error}</span>
            )}
          </div>
          <p className="text-xs text-(--text-muted)">
            Variablen sind einzelne Buchstaben, gern mit Index (<code>v0</code>, <code>s_1</code>).
            Erlaubt sind + − · : ^ und Klammern — <code>E = 0,5·m·v^2</code>, <code>p = F/A</code>.
            LaTeX geht auch: <code>p = \frac{"{F}"}{"{A}"}</code>, <code>E = m \cdot c^{"{2}"}</code>.
            Klammern werden beim Einlesen ausmultipliziert.
          </p>
        </div>
      )}

      {/* Größen */}
      <div className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-(--text-muted)">
          Größen — tippe auf 🔍, um eine andere zu suchen
        </div>
        <div className="flex flex-wrap gap-2">
          {names.map(v => {
            const isTarget = v === target;
            return (
              <div key={v}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${
                  isTarget ? "border-(--accent) bg-(--accent)/10" : "border-(--border)"
                }`}>
                <span className="w-3.5 h-3.5 rounded-sm" style={{ background: colors[v] }} />
                <span className="font-black text-base">{v}</span>
                <span className="text-(--text-muted)">=</span>
                {isTarget ? (
                  <span className="font-bold text-base tabular-nums text-(--accent) min-w-12 text-center">
                    {/* An der Station wird der Wert erst verraten, wenn die Größe allein steht. */}
                    {targetValue === null || (fest && !done) ? "?" : fmtNum(targetValue)}
                  </span>
                ) : (
                  <input
                    inputMode="decimal"
                    value={values[v] === null || values[v] === undefined ? "" : String(values[v])}
                    onChange={e => {
                      const raw = e.target.value.replace(",", ".");
                      const n = raw === "" ? null : Number(raw);
                      setValues(old => ({ ...old, [v]: raw !== "" && isFinite(n as number) ? (n as number) : null }));
                    }}
                    className="w-16 bg-(--bg) border border-(--border) rounded-lg px-2 py-1 text-base font-bold text-center" />
                )}
                <button onClick={() => chooseTarget(v)} title={`Nach ${v} umstellen`}
                  className={`text-sm ${isTarget ? "opacity-40" : "text-(--text-muted) hover:text-(--accent)"}`}>
                  🔍
                </button>
              </div>
            );
          })}
        </div>
        {targetValue === null && (
          <p className="text-xs text-(--red)">
            Für {target} lässt sich hier kein eindeutiger Wert ausrechnen — die Waage zeigt {target} = 1.
            Fehlt vielleicht noch ein Wert?
          </p>
        )}
      </div>

      {done && (
        <div className="gw-banner relative overflow-hidden rounded-2xl border-2 border-(--green) bg-(--green)/10 px-5 py-4">
          <Konfetti seed={chain.length} />
          <div className="relative">
            <div className="text-xl font-black text-(--green)">
              🎉 Nach {target} umgestellt: {target} = {formatExpr(resultSide)}
            </div>
            <div className="text-sm text-(--text-muted) mt-1">
              Werte eingesetzt: {target} = {targetValue === null ? "?" : fmtNum(targetValue)}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-(--border) bg-(--surface) p-3 sm:p-4">
        <Balance tilt={tilt} defs={DEFS}
          ariaLabel={`Waage: ${formatExpr(current.left)} = ${formatExpr(current.right)}`}
          left={pan(leftPan, current.left)} right={pan(rightPan, current.right)} />
        <p className="text-center text-xs text-(--text-muted) pt-1">
          Ein Produkt ist ein Rechteck: die Kantenfarben zeigen, welche Größe wie oft zählt.
          Jedes Kästchen wiegt 1.
        </p>
      </div>

      <div className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-(--text-muted)">
          Auf beiden Seiten … (Ziel: {target} steht allein)
        </div>
        {done ? (
          <p className="text-sm text-(--text-muted)">
            Fertig — {target} steht allein. Wähle mit 🔍 eine andere Größe oder eine neue Formel.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {chips.map(op => (
              <button key={formatFOp(op)} onClick={() => apply(op)}
                className="px-3.5 py-2 rounded-xl text-base font-bold border border-(--border) hover:border-(--accent) transition-all hover:scale-[1.04] active:scale-95">
                {formatFOp(op)}
              </button>
            ))}
            {!chips.length && (
              <span className="text-sm text-(--text-muted)">
                Hier weiß ich keinen Schritt — nimm die freie Eingabe.
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-(--border) mt-1">
          <span className="text-sm text-(--text-muted) pt-3">oder selbst:</span>
          <div className="inline-flex rounded-xl border border-(--border) p-1 mt-2">
            {SIGNS.map(s => (
              <button key={s} onClick={() => setSign(s)}
                className={`w-9 h-8 rounded-lg text-lg font-black transition-colors ${
                  sign === s ? "bg-(--accent) text-(--accent-text,#111)" : "text-(--text-muted) hover:text-(--text)"
                }`}>{s}</button>
            ))}
          </div>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") applyManual(); }}
            placeholder="a" aria-label="Term für die Umformung"
            className="mt-2 w-24 bg-(--bg) border border-(--border) rounded-lg px-3 py-1.5 text-base font-bold text-center" />
          <button onClick={applyManual}
            className="mt-2 px-4 py-1.5 rounded-lg text-sm font-bold border border-(--border) hover:border-(--accent)">
            Anwenden
          </button>
        </div>
      </div>

      <Protokoll tex lines={chain.map((eq, i) => ({
        left: exprToLatex(eq.left), right: exprToLatex(eq.right), op: ops[i] ? formatFOp(ops[i]) : undefined,
      }))} />
    </>
  );
}
