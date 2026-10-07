"use client";
/**
 * Zahlenmodus: lineare Gleichungen mit einem x.
 *
 * Jede Seite liegt als Klötzchen in der Schale — violette x-Kisten, goldene
 * 1er, rote Minus-Ballons. Eine Klammer ist eine Kiste, die ihre Klötzchen
 * zusammenhält; ihre Klötzchen tragen schon die ids, die sie nach dem
 * Ausmultiplizieren haben, und gleiten deshalb beim Auflösen an ihren Platz,
 * statt zu verschwinden.
 *
 * Aus dem Vorrat neben der Waage lassen sich Teile auf nur eine Schale ziehen
 * (oder aus ihr heraus) — dann kippt die Waage, und die Gleichung stimmt nicht
 * mehr. Plus- und Minus-Teil derselben Art dürfen dabei nebeneinander liegen.
 */
import { useCallback, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import {
  applyOp, clean, coeffs, equationToLatex, evalSide, fmtNum, formatOp, formatSide,
  generateTask, hasPairs, isSolved, LEVELS, MINUS, parseEquation, putOn, sideToLatex, simplify, solve,
  suggestions, takeOff, type Equation, type Op, type Side,
} from "@/lib/gleichung";
import {
  Balance, bestLayout, flowLayout, GAP, Konfetti, Piece, Protokoll, tiltFor,
  useExitingItems, useWobble, type PanContent, type Placed,
} from "./Balance";
import { Tex } from "@/components/Tex";
import { MOTIV_DEFS, MOTIVE, MotivShape, motivSize, type MotivId } from "./Motive";

const XW = 48, XH = 46;
const NW = 34, NH = 34;
const PAREN_W = 13;
const CRATE_PAD = 9;
const CRATE_MAX_W = 3 * XW + 2 * GAP;
const COMPACT_AT = 20; // ab hier ein Block mit Zahl statt vieler Klötzchen

type Blk = {
  id: string;
  kind: "x" | "n";
  neg: boolean;
  frac: number; // 1 = ganzes Klötzchen
  label: string | null;
  w: number; h: number;
  px: number; py: number;
};

type Unit = Placed & {
  id: string;
  blk: Blk | null;
  inner: Blk[] | null; // gesetzt ⇒ Klammer
};

function layoutSide(side: Side, prefix: string, motiv: MotivId): { units: Unit[]; scale: number } {
  // Fortlaufende ids je Art: dieselbe Kachel behält beim Umformen ihre id und
  // gleitet an den neuen Platz, statt zu verschwinden.
  const counters: Record<string, number> = {};
  const nextId = (kind: "x" | "n", neg: boolean) => {
    const key = `${kind}${neg ? "m" : "p"}`;
    const i = counters[key] ?? 0;
    counters[key] = i + 1;
    return `${prefix}-${key}-${i}`;
  };

  const makeBlocks = (kind: "x" | "n", n: number): Blk[] => {
    const v = clean(n);
    if (v === 0) return [];
    const neg = v < 0;
    const a = Math.abs(v);
    const size = motivSize(motiv, kind, neg);
    const w = size?.w ?? (kind === "x" ? XW : NW);
    const h = size?.h ?? (kind === "x" ? XH : NH);
    const mk = (frac: number, label: string | null): Blk => ({
      id: nextId(kind, neg), kind, neg, frac, label, w, h, px: 0, py: 0,
    });
    if (a > COMPACT_AT) {
      const b = mk(1, `${fmtNum(v)}${kind === "x" ? "x" : ""}`);
      b.w = 78;
      if (size) b.h = Math.max(h, 30);
      return [b];
    }
    const out: Blk[] = [];
    const whole = Math.floor(a + 1e-9);
    for (let i = 0; i < whole; i++) out.push(mk(1, null));
    const rest = clean(a - whole);
    if (rest > 0) out.push(mk(rest, fmtNum(rest)));
    return out;
  };

  const asUnit = (b: Blk): Unit => ({
    id: b.id, w: b.w, h: b.h, px: 0, py: 0, tx: 0, ty: 0, blk: b, inner: null,
  });

  const units: Unit[] = [];
  let gi = 0;
  for (const t of side) {
    if (t.t === "g") {
      const sign = t.k < 0 ? -1 : 1;
      const copies = Math.abs(t.k);
      const whole = Math.floor(copies + 1e-9);
      const gid = gi++;
      for (let j = 0; j < whole; j++) {
        const inner = [...makeBlocks("x", sign * t.x), ...makeBlocks("n", sign * t.c)];
        const box = flowLayout(inner, CRATE_MAX_W);
        units.push({
          id: `${prefix}-g${gid}-${j}`,
          w: box.w + 2 * (PAREN_W + CRATE_PAD),
          h: box.h + 2 * CRATE_PAD,
          px: 0, py: 0, tx: 0, ty: 0, blk: null, inner,
        });
      }
      const rest = clean(copies - whole); // halbe Klammer ⇒ lose Klötzchen
      if (rest > 0) {
        for (const b of [...makeBlocks("x", sign * rest * t.x), ...makeBlocks("n", sign * rest * t.c)])
          units.push(asUnit(b));
      }
    } else {
      for (const b of makeBlocks(t.t, t.n)) units.push(asUnit(b));
    }
  }

  // Minus-Teile kommen in die unterste Reihe.
  if (motiv !== "kloetze") units.sort((a, b) => Number(!!b.blk?.neg) - Number(!!a.blk?.neg));

  const { scale } = bestLayout(units);
  return { units, scale };
}

function BlockShape({ b }: { b: Blk }) {
  const label = b.label ?? (b.kind === "x" ? "x" : "1");
  const text = b.neg ? `${MINUS}${label}` : label;

  if (b.neg) {
    // Minus-Ballon: er zieht nach oben statt zu drücken.
    const rx = b.w * 0.5;
    const ry = b.h * 0.44;
    const cx = b.w / 2;
    const cy = ry + 1;
    return (
      <g>
        <path d={`M ${cx} ${cy + ry} C ${cx - 4} ${b.h * 0.82} ${cx + 5} ${b.h * 0.88} ${cx} ${b.h}`}
          fill="none" stroke="#fb7185" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#gwNeg)" stroke="#e11d48" strokeWidth={1.5} />
        <ellipse cx={cx - rx * 0.34} cy={cy - ry * 0.36} rx={rx * 0.22} ry={ry * 0.16} fill="#ffffff" opacity={0.5} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
          fontSize={b.kind === "x" ? 17 : 14} fontWeight={800} fill="#ffffff">{text}</text>
      </g>
    );
  }

  const fillH = b.h * b.frac;
  return (
    <g>
      {b.frac < 1 && (
        <rect x={0} y={0} width={b.w} height={b.h} rx={9} fill="none"
          stroke={b.kind === "x" ? "#a78bfa" : "#f59e0b"} strokeWidth={1.4} strokeDasharray="4 3" opacity={0.7} />
      )}
      <rect x={0} y={b.h - fillH} width={b.w} height={fillH} rx={9}
        fill={b.kind === "x" ? "url(#gwX)" : "url(#gwN)"} stroke="#00000033" strokeWidth={1} />
      <rect x={4} y={b.h - fillH + 4} width={b.w - 8} height={Math.max(2, fillH * 0.22)} rx={5} fill="#ffffff" opacity={0.22} />
      <text x={b.w / 2} y={b.h - fillH / 2 + 1} textAnchor="middle" dominantBaseline="central"
        fontSize={b.kind === "x" ? 21 : 16} fontWeight={800}
        fontStyle={b.kind === "x" && !b.label ? "italic" : "normal"}
        fill={b.kind === "x" ? "#ffffff" : "#4a2c00"}>{text}</text>
    </g>
  );
}

/** Ein Teil im gewählten Motiv — Klötzchen oder Alltagsding. */
function Teil({ b, motiv }: { b: Blk; motiv: MotivId }) {
  if (motiv === "kloetze") return <BlockShape b={b} />;
  const v = Number(b.id.split("-").pop()) || 0;
  return <MotivShape motiv={motiv} kind={b.kind} neg={b.neg} frac={b.frac} label={b.label} w={b.w} h={b.h} v={v} />;
}

/** Ein Musterteil für Vorrat und Ziehbild. */
function sample(kind: "x" | "n", neg: boolean, motiv: MotivId): Blk {
  const size = motivSize(motiv, kind, neg);
  return {
    id: "sample", kind, neg, frac: 1, label: null,
    w: size?.w ?? (kind === "x" ? XW : NW), h: size?.h ?? (kind === "x" ? XH : NH), px: 0, py: 0,
  };
}

function TeilSvg({ b, motiv, scale = 1 }: { b: Blk; motiv: MotivId; scale?: number }) {
  return (
    <svg width={b.w * scale} height={b.h * scale} viewBox={`-1 -1 ${b.w + 2} ${b.h + 2}`} overflow="visible">
      <Teil b={b} motiv={motiv} />
    </svg>
  );
}

function Units({ units, motiv, onGrab }: {
  units: Unit[];
  motiv: MotivId;
  onGrab: (b: Blk, e: RPointerEvent) => void;
}) {
  const shown = useExitingItems(units);
  return (
    <>
      {shown.map(u => (
        <Piece key={u.id} tx={u.tx} ty={u.ty} gone={u.gone}>
          {u.inner ? (
            <g>
              <rect x={0} y={0} width={u.w} height={u.h} rx={12}
                fill="rgba(56,189,248,0.12)" stroke="#38bdf8" strokeWidth={2} strokeDasharray="7 4" />
              <text x={PAREN_W * 0.62} y={u.h / 2 + 1} textAnchor="middle" dominantBaseline="central"
                fontSize={u.h * 0.95} fontWeight={300} fill="#38bdf8">(</text>
              <text x={u.w - PAREN_W * 0.62} y={u.h / 2 + 1} textAnchor="middle" dominantBaseline="central"
                fontSize={u.h * 0.95} fontWeight={300} fill="#38bdf8">)</text>
              {u.inner.map(b => (
                <g key={b.id} transform={`translate(${PAREN_W + CRATE_PAD + b.px}, ${CRATE_PAD + b.py})`}>
                  <Teil b={b} motiv={motiv} />
                </g>
              ))}
            </g>
          ) : (
            u.blk && (
              <g onPointerDown={e => !u.gone && onGrab(u.blk!, e)} onMouseDown={e => e.preventDefault()} style={{ cursor: "grab", touchAction: "none" }}>
                <Teil b={u.blk} motiv={motiv} />
              </g>
            )
          )}
        </Piece>
      ))}
    </>
  );
}

const DEFS = (
  <>
    <linearGradient id="gwX" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#a78bfa" />
      <stop offset="1" stopColor="#6d28d9" />
    </linearGradient>
    <linearGradient id="gwN" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fde68a" />
      <stop offset="1" stopColor="#f59e0b" />
    </linearGradient>
    <linearGradient id="gwNeg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fb7185" />
      <stop offset="1" stopColor="#e11d48" />
    </linearGradient>
    {MOTIV_DEFS}
  </>
);

type PanSide = "L" | "R";
const SIDE_NAME: Record<PanSide, string> = { L: "links", R: "rechts" };

/** Ein Teil, das gerade gezogen wird — aus dem Vorrat (from null) oder aus einer Schale. */
type Drag = { kind: "x" | "n"; neg: boolean; from: PanSide | null; x: number; y: number };

const START: Equation = {
  left: [{ t: "x", n: 3 }, { t: "n", n: 4 }],
  right: [{ t: "x", n: 1 }, { t: "n", n: 10 }],
};

const SIGNS = [
  { s: "+", title: "dazuzählen" },
  { s: MINUS, title: "abziehen" },
  { s: "·", title: "malnehmen" },
  { s: ":", title: "teilen" },
] as const;

type SignKey = (typeof SIGNS)[number]["s"];

/** Liest den Wert aus dem Eingabefeld: "4", "x", "2x". */
function parseValue(v: string): { kind: "x" | "n"; n: number } | null {
  const s = v.trim().replace(",", ".").replace(MINUS, "-");
  const m = /^(-?\d*(?:\.\d+)?)(x?)$/i.exec(s);
  if (!m) return null;
  const isX = m[2].toLowerCase() === "x";
  if (!m[1] || m[1] === "-") {
    if (!isX) return null;
    return { kind: "x", n: m[1] === "-" ? -1 : 1 };
  }
  const n = Number(m[1]);
  if (!isFinite(n)) return null;
  return { kind: isX ? "x" : "n", n };
}

export default function ZahlenModus({ onMessage, fest, anfang }: {
  onMessage: (m: string) => void;
  /** Feste Gleichung (TaskCrawler-Station): keine Stufen, keine neuen oder eigenen Aufgaben. */
  fest?: string;
  /** Startgleichung aus dem Link (?gleichung=…): nur der Anfang, danach alles frei. */
  anfang?: string;
}) {
  const [level, setLevel] = useState(3);
  const [chain, setChain] = useState<Equation[]>(() => {
    const quelle = fest ?? anfang;
    const r = quelle ? parseEquation(quelle) : null;
    return [r?.ok ? r.eq : START];
  });
  const [ops, setOps] = useState<string[]>([]);
  const [motiv, setMotiv] = useState<MotivId>("hoelzer");
  const [drag, setDrag] = useState<Drag | null>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const [wobble, kick] = useWobble();
  const [sign, setSign] = useState<SignKey>(MINUS);
  const [value, setValue] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("2(x + 3) = 4x − 2");

  const current = chain[chain.length - 1];
  const original = chain[0];
  const sol = solve(current);

  // Das echte x steckt in der Ausgangsgleichung: die Schachtel enthält immer
  // gleich viel, egal was man danach auf die Schalen legt.
  const sol0 = solve(original);
  const hiddenX = sol0.kind === "one" ? sol0.x : 1;
  const balanced = (eq: Equation) =>
    sol0.kind !== "one" || clean(evalSide(eq.left, hiddenX) - evalSide(eq.right, hiddenX)) === 0;
  const broken = !balanced(current);
  const solvedX = broken ? null : isSolved(current);
  const noX = coeffs(current.left).x === 0 && coeffs(current.right).x === 0;
  const pairs = hasPairs(current.left) || hasPairs(current.right);

  const push = useCallback((eq: Equation, label: string) => {
    setChain(c => [...c, eq]);
    setOps(o => [...o, label]);
    kick();
  }, [kick]);

  const apply = useCallback((op: Op) => {
    push(applyOp(current, op), formatOp(op));
  }, [current, push]);

  /** Ein Teil nur auf einer Seite hinlegen, wegnehmen oder umlegen. */
  const moveByHand = useCallback((kind: "x" | "n", neg: boolean, from: PanSide | null, to: PanSide | null) => {
    if (from === to) return;
    const piece = kind === "x" ? "x" : "1";
    const key = (s: PanSide) => (s === "L" ? "left" : "right");
    let eq = current;
    const parts: string[] = [];
    if (from) {
      const side = takeOff(eq[key(from)], kind, neg);
      if (side === eq[key(from)]) return;
      eq = { ...eq, [key(from)]: side };
      parts.push(`${SIDE_NAME[from]} ${neg ? "+" : MINUS} ${piece}`);
    }
    if (to) {
      eq = { ...eq, [key(to)]: putOn(eq[key(to)], kind, neg ? -1 : 1) };
      parts.push(`${SIDE_NAME[to]} ${neg ? MINUS : "+"} ${piece}`);
    }
    push(eq, parts.length === 1 ? `nur ${parts[0]}` : parts.join(", "));
  }, [current, push]);

  // Ziehen: die Fenster-Ereignisse hängen nur während eines Zugs — gleich beim
  // Greifen, sonst geht ein schneller Zug verloren, bevor React neu zeichnet.
  const moveRef = useRef(moveByHand);
  moveRef.current = moveByHand;
  const dropSide = (x: number, y: number): PanSide | null => {
    const r = scaleRef.current?.getBoundingClientRect();
    if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    return x < r.left + r.width / 2 ? "L" : "R";
  };
  const grab = (kind: "x" | "n", neg: boolean, from: PanSide | null, e: RPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDrag({ kind, neg, from, x: e.clientX, y: e.clientY });
    const move = (ev: PointerEvent) => setDrag(d => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
    const end = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setDrag(null);
      if (ev.type === "pointerup") moveRef.current(kind, neg, from, dropSide(ev.clientX, ev.clientY));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  const hover = drag ? dropSide(drag.x, drag.y) : null;

  const start = useCallback((eq: Equation) => {
    setChain([eq]);
    setOps([]);
    kick();
  }, [kick]);

  const applyManual = () => {
    const parsed = parseValue(value);
    if (!parsed) return onMessage("Erlaubt sind z. B. 4, x oder 2x.");
    if (sign === "+" || sign === MINUS) {
      apply({ op: "add", kind: parsed.kind, n: sign === MINUS ? -parsed.n : parsed.n });
    } else {
      if (parsed.kind === "x") return onMessage("Mal- und Geteiltrechnen geht nur mit einer Zahl.");
      if (parsed.n === 0) return onMessage("Durch 0 kann man nicht teilen.");
      apply(sign === "·" ? { op: "mul", n: parsed.n } : { op: "div", n: parsed.n });
    }
    setValue("");
  };

  const applyCustom = () => {
    const r = parseEquation(customText);
    if (!r.ok) return onMessage(r.error);
    start(r.eq);
    setCustomOpen(false);
  };

  // Die Last ist der Wert der Seite für die echte Lösung: solange beide Seiten
  // gleich umgeformt werden, bleibt die Waage im Gleichgewicht.
  // Von Hand auf nur eine Seite gelegt, stimmt sie nicht mehr — dann kippt die Waage.
  const tilt = tiltFor(evalSide(current.left, hiddenX), evalSide(current.right, hiddenX), wobble);

  const leftLayout = useMemo(() => layoutSide(current.left, "L", motiv), [current.left, motiv]);
  const rightLayout = useMemo(() => layoutSide(current.right, "R", motiv), [current.right, motiv]);
  const chips = useMemo(() => (solvedX === null && !broken ? suggestions(current) : []), [current, solvedX, broken]);
  const preview = useMemo(() => parseEquation(customText), [customText]);
  const motivInfo = MOTIVE.find(m => m.id === motiv)!;

  const pan = (l: { units: Unit[]; scale: number }, side: Side, ps: PanSide): PanContent => ({
    node: <Units units={l.units} motiv={motiv} onGrab={(b, e) => grab(b.kind, b.neg, ps, e)} />,
    scale: l.scale,
    label: formatSide(side),
    empty: !l.units.length,
  });

  const probe = solvedX !== null
    ? { l: evalSide(original.left, solvedX), r: evalSide(original.right, solvedX) }
    : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!fest && LEVELS.map(l => (
          <button key={l.level} onClick={() => { setLevel(l.level); start(generateTask(l.level)); }} title={l.hint}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
              level === l.level
                ? "bg-accent text-accent-fg border-accent"
                : "border-line text-muted hover:text-fg hover:border-accent"
            }`}>
            <span className="font-black mr-1.5">{l.level}</span>{l.label}
          </button>
        ))}
        {!fest && <>
        <button onClick={() => start(generateTask(level))}
          className="px-3 py-1.5 rounded-xl text-sm font-bold border border-line hover:border-accent">
          🎲 Neue Aufgabe
        </button>
        <button onClick={() => setCustomOpen(o => !o)}
          className="px-3 py-1.5 rounded-xl text-sm border border-line text-muted hover:text-fg hover:border-accent">
          ✏️ Eigene Gleichung
        </button>
        </>}
        <div className="flex-1" />
        <button onClick={() => { setChain(c => c.slice(0, -1)); setOps(o => o.slice(0, -1)); kick(); }}
          disabled={chain.length < 2}
          className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent disabled:opacity-40">
          ↶ Zurück
        </button>
        <button onClick={() => { setChain([original]); setOps([]); kick(); }} disabled={chain.length < 2}
          className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent disabled:opacity-40">
          ↺ Von vorn
        </button>
      </div>

      {customOpen && (
        <div className="card p-4 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 items-center">
            <input value={customText} onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applyCustom(); }}
              placeholder="z. B. 2(x + 3) = 4x − 2"
              className="flex-1 min-w-[220px] bg-page border border-line rounded-lg px-3 py-2 text-base font-mono" />
            <button onClick={applyCustom}
              className="btn-primary px-4 py-2 text-sm">
              Auf die Waage
            </button>
          </div>
          <div className="text-sm min-h-7">
            {preview.ok ? (
              <>
                <span className="text-muted">So lese ich das: </span>
                <Tex tex={equationToLatex(preview.eq)} />
              </>
            ) : (
              <span className="text-bad">{preview.error}</span>
            )}
          </div>
          <p className="text-xs text-muted">
            Erlaubt sind Zahlen, x, + − · : und Klammern — z. B. <code>3x - 4 = x + 2</code> oder <code>2(x + 3) = 14</code>.
            LaTeX geht auch: <code>\frac{"{x}"}{"{2}"} = 3</code>, <code>2 \cdot (x+3) = 14</code>.
          </p>
        </div>
      )}

      {solvedX !== null && (
        <div className="gw-banner relative overflow-hidden rounded-2xl border-2 border-ok bg-ok/10 px-5 py-4">
          <Konfetti seed={chain.length} />
          <div className="relative">
            <div className="text-xl font-black text-ok">🎉 Gelöst! x = {fmtNum(solvedX)}</div>
            {probe && (
              <div className="text-sm text-muted mt-1">
                Probe mit der Ausgangsgleichung {formatSide(original.left)} = {formatSide(original.right)}:
                links {fmtNum(probe.l)}, rechts {fmtNum(probe.r)} — {probe.l === probe.r ? "passt ✓" : "passt nicht ✗"}
              </div>
            )}
          </div>
        </div>
      )}

      {broken && (
        <div className="gw-banner rounded-2xl border-2 border-bad bg-bad/10 px-5 py-4">
          <div className="font-black text-bad">⚖️ Aus dem Gleichgewicht — die Gleichung stimmt nicht mehr (≠).</div>
          <div className="text-sm text-muted mt-1">
            Du hast nur auf einer Seite etwas verändert. Leg auf der anderen Seite dasselbe dazu,
            nimm es wieder weg — oder ↶ Zurück.
          </div>
        </div>
      )}

      {solvedX === null && noX && !broken && (
        <div className="card gw-banner px-5 py-4">
          <div className="font-black">
            {sol.kind === "all" ? "♾️ Jede Zahl ist eine Lösung." : "🚫 Diese Gleichung hat keine Lösung."}
          </div>
          <div className="text-sm text-muted mt-1">
            {sol.kind === "all"
              ? "Beide Seiten sind gleich schwer, egal was x ist."
              : "Das x ist weg und übrig bleibt eine falsche Aussage — die Waage kann nicht ins Gleichgewicht kommen."}
          </div>
        </div>
      )}

      <div className="card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-muted">Motiv:</span>
          <div className="inline-flex flex-wrap rounded-xl border border-line p-0.5">
            {MOTIVE.map(m => (
              <button key={m.id} onClick={() => setMotiv(m.id)} title={m.label}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  motiv === m.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
                }`}>
                {m.icon} <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <div ref={scaleRef} className="relative flex-1 min-w-0">
            {drag && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-2">
                {(["L", "R"] as const).map(s => (
                  <div key={s} className={`rounded-xl transition-colors ${
                    hover === s ? "bg-accent/15 outline-2 outline-dashed outline-accent" : ""
                  }`} />
                ))}
              </div>
            )}
            <Balance tilt={tilt} defs={DEFS}
              ariaLabel={`Waage: ${formatSide(current.left)} ${broken ? "≠" : "="} ${formatSide(current.right)}`}
              left={pan(leftLayout, current.left, "L")} right={pan(rightLayout, current.right, "R")} />
          </div>

          <div className={`sm:w-28 shrink-0 rounded-xl border border-dashed p-2 flex flex-col gap-1 transition-colors ${
            drag?.from && !hover ? "border-accent bg-accent/10" : "border-line"
          }`}>
            <div className="text-[10px] uppercase tracking-widest text-muted text-center">Vorrat</div>
            <div className="flex sm:flex-col flex-wrap items-center justify-center gap-2 flex-1">
              {([["x", false], ["n", false], ["x", true], ["n", true]] as const).map(([kind, neg]) => (
                <div key={`${kind}${neg}`} onPointerDown={e => grab(kind, neg, null, e)} onMouseDown={e => e.preventDefault()}
                  title={`${neg ? (kind === "x" ? motivInfo.minusX : motivInfo.minusOne) : kind === "x" ? motivInfo.x : motivInfo.one} — auf eine Schale ziehen`}
                  className="cursor-grab select-none rounded-lg px-2 py-1.5 hover:bg-page flex items-center justify-center min-w-[56px]"
                  style={{ touchAction: "none" }}>
                  <TeilSvg b={sample(kind, neg, motiv)} motiv={motiv} />
                </div>
              ))}
            </div>
            <div className="text-[10px] leading-tight text-muted text-center">
              Auf eine Schale ziehen — oder aus der Schale hierher zurück.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 justify-center text-xs text-muted pt-1">
          <span><span className="inline-block w-3 h-3 rounded-sm align-middle mr-1.5" style={{ background: "#7c3aed" }} />{motivInfo.x}</span>
          <span><span className="inline-block w-3 h-3 rounded-sm align-middle mr-1.5" style={{ background: "#f59e0b" }} />{motivInfo.one}</span>
          <span><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5" style={{ background: "#e11d48" }} />
            {motivInfo.minus}</span>
          <span><span className="inline-block w-3 h-3 rounded-sm align-middle mr-1.5 border-2" style={{ borderColor: "#38bdf8" }} />Klammer</span>
        </div>
      </div>

      {drag && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg"
          style={{ left: drag.x, top: drag.y }}>
          <TeilSvg b={sample(drag.kind, drag.neg, motiv)} motiv={motiv} scale={1.3} />
        </div>
      )}

      <div className="card p-4 flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest text-muted">Auf beiden Seiten …</div>

        {solvedX !== null ? (
          <p className="text-sm text-muted">Fertig — x steht allein. Hol dir mit 🎲 die nächste Aufgabe.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pairs && (
              <button onClick={() => push({ left: simplify(current.left), right: simplify(current.right) }, "Nullpaare weg")}
                title="Ein Teil und sein Minus-Gegenstück heben sich auf — beide dürfen weg."
                className="px-3.5 py-2 rounded-xl text-base font-bold border border-ok text-ok bg-ok/10 transition-all hover:scale-[1.04] active:scale-95">
                🧹 Nullpaare wegräumen
              </button>
            )}
            {broken && (
              <span className="text-sm text-muted self-center">
                Erst wieder ins Gleichgewicht bringen — dann gibt es Vorschläge.
              </span>
            )}
            {chips.map(op => (
              <button key={formatOp(op)} onClick={() => apply(op)}
                className={`px-3.5 py-2 rounded-xl text-base font-bold border transition-all hover:scale-[1.04] active:scale-95 ${
                  op.op === "expand" ? "border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/10" : "border-line hover:border-accent"
                }`}>
                {op.op === "expand" ? "❰❱ Klammern auflösen" : formatOp(op)}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line mt-1">
          <span className="text-sm text-muted pt-3">oder selbst:</span>
          <div className="inline-flex rounded-xl border border-line p-1 mt-2">
            {SIGNS.map(s => (
              <button key={s.s} onClick={() => setSign(s.s)} title={s.title}
                className={`w-9 h-8 rounded-lg text-lg font-black transition-colors ${
                  sign === s.s ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
                }`}>{s.s}</button>
            ))}
          </div>
          <input value={value} onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") applyManual(); }}
            placeholder="4" aria-label="Wert für die Umformung"
            className="mt-2 w-24 bg-page border border-line rounded-lg px-3 py-1.5 text-base font-bold text-center" />
          <button onClick={applyManual} disabled={solvedX !== null}
            className="mt-2 px-4 py-1.5 rounded-lg text-sm font-bold border border-line hover:border-accent disabled:opacity-40">
            Anwenden
          </button>
        </div>
      </div>

      <Protokoll tex lines={chain.map((eq, i) => ({
        left: sideToLatex(eq.left), right: sideToLatex(eq.right), op: ops[i], rel: balanced(eq) ? "=" : "≠",
      }))} />
    </>
  );
}
