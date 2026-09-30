"use client";
/**
 * Chemiemodus: Reaktionsgleichungen ausgleichen.
 *
 * Jedes Molekül liegt als Gruppe in der Schale — dieselbe Kisten-Metapher wie
 * die Klammer im Zahlenmodus —, darin die einzelnen Atome in ihren CPK-Farben.
 * Der stöchiometrische Faktor sagt, wie viele Kisten es sind; die Indizes
 * sagen, was drinsteckt. Beides lässt sich verstellen, auch falsch: die Waage
 * kippt nach der Masse, die Elementtabelle zeigt, was fehlt.
 */
import { useCallback, useMemo, useState } from "react";
import {
  bondHint, chargeBalance, CHEM_PRESETS, countAtoms, elementBalance, formatCharge, formatParts,
  formatReaction, fmtMass, formatSide, hasIons, isBalanced, molarMass, oxidationStates,
  parseReaction, setCharge, setCoef, setIndex, sideAtoms, sideMass, unknownElements,
  type Part, type Reaction, type SideKey, type Species,
} from "@/lib/chemie";
import { element, missingElectrons, shellGoal, textOn } from "@/lib/elemente";
import {
  Balance, bestLayout, flowLayout, GAP, Konfetti, Piece, tiltFor, useExitingItems, useWobble,
  type PanContent, type Placed,
} from "./Balance";

const ATOM = 32; // Kästchen je Atom
const CRATE_PAD = 8;
const LABEL_H = 15;
const CRATE_COLS = 4;
const MAX_COPIES = 6; // darüber eine Kiste mit ×n
const MAX_SAME = 8; // darüber ein Atom mit ×n

type Atom = { key: string; el: string; times: number; w: number; h: number; px: number; py: number };

type Crate = Placed & { id: string; atoms: Atom[]; label: string; times: number; charge: number };

/** Kationen rot, Anionen blau, neutrale Teilchen wie gehabt cyan. */
const ionColor = (charge: number): string =>
  charge > 0 ? "#ef4444" : charge < 0 ? "#3b82f6" : "#38bdf8";

/** Kurze Ladung fürs Abzeichen an der Kiste: +, 2− … */
const chargeBadge = (charge: number): string =>
  `${Math.abs(charge) > 1 ? Math.abs(charge) : ""}${charge > 0 ? "+" : "−"}`;

/** Die Atome einer Formeleinheit — Gruppen werden dabei ausgemultipliziert. */
function atomsOf(parts: Part[]): { el: string; times: number }[] {
  const out: { el: string; times: number }[] = [];
  for (const [el, n] of Object.entries(countAtoms(parts))) {
    if (n > MAX_SAME) out.push({ el, times: n });
    else for (let i = 0; i < n; i++) out.push({ el, times: 1 });
  }
  return out;
}

function layoutSide(species: Species[], prefix: SideKey): { crates: Crate[]; scale: number } {
  const crates: Crate[] = [];
  species.forEach((s, si) => {
    const copies = s.coef > MAX_COPIES ? 1 : s.coef;
    const times = s.coef > MAX_COPIES ? s.coef : 1;
    const label = formatParts(s.parts) + formatCharge(s.charge);
    for (let j = 0; j < copies; j++) {
      const atoms: Atom[] = atomsOf(s.parts).map((a, k) => ({
        key: `${k}-${a.el}-${a.times}`, el: a.el, times: a.times, w: ATOM, h: ATOM, px: 0, py: 0,
      }));
      const box = flowLayout(atoms, CRATE_COLS * ATOM + (CRATE_COLS - 1) * GAP);
      crates.push({
        id: `${prefix}-${si}-${j}`,
        atoms, label, times, charge: s.charge,
        w: box.w + 2 * CRATE_PAD,
        h: box.h + 2 * CRATE_PAD + LABEL_H,
        px: 0, py: 0, tx: 0, ty: 0,
      });
    }
  });
  return { crates, scale: bestLayout(crates).scale };
}

function AtomShape({ a }: { a: Atom }) {
  const e = element(a.el);
  const color = e?.color ?? "#64748b";
  const fg = textOn(color);
  const r = ATOM / 2 - 1;
  return (
    <g className="gw-in">
      <circle cx={ATOM / 2} cy={ATOM / 2} r={r} fill={color} stroke="#00000033" strokeWidth={1} />
      <ellipse cx={ATOM / 2 - r * 0.3} cy={ATOM / 2 - r * 0.35} rx={r * 0.28} ry={r * 0.2} fill="#ffffff" opacity={0.45} />
      <text x={ATOM / 2} y={ATOM / 2 + 1} textAnchor="middle" dominantBaseline="central"
        fontSize={a.el.length > 1 ? 12 : 14} fontWeight={800} fill={fg}>{a.el}</text>
      {a.times > 1 && (
        <>
          <circle cx={ATOM - 3} cy={5} r={7.5} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
          <text x={ATOM - 3} y={5.5} textAnchor="middle" dominantBaseline="central"
            fontSize={9} fontWeight={800} fill="var(--text)">{a.times}</text>
        </>
      )}
    </g>
  );
}

function Crates({ crates }: { crates: Crate[] }) {
  const shown = useExitingItems(crates);
  return (
    <>
      {shown.map(c => (
        <Piece key={c.id} tx={c.tx} ty={c.ty} gone={c.gone}>
          <rect x={0} y={0} width={c.w} height={c.h} rx={12}
            fill={ionColor(c.charge)} fillOpacity={c.charge ? 0.16 : 0.1}
            stroke={ionColor(c.charge)} strokeWidth={c.charge ? 2.2 : 1.6}
            strokeDasharray={c.charge ? undefined : "7 4"} />
          {c.charge !== 0 && (
            <g>
              <rect x={c.w - 26} y={-9} width={26} height={18} rx={9}
                fill={ionColor(c.charge)} />
              <text x={c.w - 13} y={0} textAnchor="middle" dominantBaseline="central"
                fontSize={12} fontWeight={900} fill="#ffffff">{chargeBadge(c.charge)}</text>
            </g>
          )}
          {c.atoms.map(a => (
            <g key={a.key} transform={`translate(${CRATE_PAD + a.px}, ${CRATE_PAD + a.py})`}>
              <AtomShape a={a} />
            </g>
          ))}
          <text x={c.w / 2} y={c.h - LABEL_H / 2 - 1} textAnchor="middle" dominantBaseline="central"
            fontSize={12} fontWeight={700} fill="var(--text-muted)">
            {c.times > 1 ? `${c.times} × ` : ""}{c.label}
          </text>
        </Piece>
      ))}
    </>
  );
}

const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/** Oxidationszahlen schreibt man mit römischen Ziffern: +I, −II. */
function oxLabel(v: number | null): string {
  if (v === null) return "?";
  if (v === 0) return "0";
  if (!Number.isInteger(v) || Math.abs(v) > 8) return (v > 0 ? "+" : "−") + String(Math.abs(v)).replace(".", ",");
  return (v > 0 ? "+" : "−") + ROMAN[Math.abs(v)];
}

/**
 * Der stöchiometrische Faktor in der Reaktionsgleichung. Die 1 steht blass
 * da — geschrieben wird sie nicht, verstellen können muss man sie trotzdem.
 */
function CoefStepper({ n, onChange, label }: { n: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 mr-1">
      <span className="inline-flex flex-col leading-none">
        <button onClick={() => onChange(n + 1)} aria-label={`Faktor von ${label} größer`}
          className="text-[11px] leading-none px-1 text-[var(--text-muted)] hover:text-[var(--accent)]">▲</button>
        <button onClick={() => onChange(n - 1)} disabled={n <= 1} aria-label={`Faktor von ${label} kleiner`}
          className="text-[11px] leading-none px-1 text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-25">▼</button>
      </span>
      <span className={`text-2xl sm:text-3xl font-black tabular-nums ${
        n > 1 ? "text-[var(--accent)]" : "text-[var(--text-muted)] opacity-50"
      }`}>
        {n}
      </span>
    </span>
  );
}

/** Formel mit Steppern an jedem Index. */
function FormulaEditor({
  parts, path = [], onIndex,
}: {
  parts: Part[];
  path?: number[];
  onIndex: (path: number[], n: number) => void;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {parts.map((p, i) => {
        const here = [...path, i];
        const stepper = (
          <span className="inline-flex items-center rounded-md border border-[var(--border)] overflow-hidden ml-0.5">
            <button onClick={() => onIndex(here, p.n - 1)} disabled={p.n <= 1}
              className="px-1 text-xs leading-none py-0.5 hover:bg-[var(--surface-hover)] disabled:opacity-30"
              aria-label="Index kleiner">−</button>
            <span className="px-1 text-sm font-black tabular-nums">{p.n}</span>
            <button onClick={() => onIndex(here, p.n + 1)}
              className="px-1 text-xs leading-none py-0.5 hover:bg-[var(--surface-hover)]"
              aria-label="Index größer">+</button>
          </span>
        );
        if (p.kind === "el") {
          const e = element(p.el);
          return (
            <span key={i} className="inline-flex items-center">
              <span className="w-4 h-4 rounded-full mr-1 inline-block align-middle"
                style={{ background: e?.color ?? "#64748b" }} />
              <span className="font-black text-base">{p.el}</span>
              {stepper}
            </span>
          );
        }
        return (
          <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-[#38bdf8]/50 px-1.5 py-0.5">
            <span className="text-[#38bdf8] font-bold">(</span>
            <FormulaEditor parts={p.parts} path={here} onIndex={onIndex} />
            <span className="text-[#38bdf8] font-bold">)</span>
            {stepper}
          </span>
        );
      })}
    </span>
  );
}

function SpeciesCard({
  s, side, i, showOx, onCoef, onIndex, onCharge,
}: {
  s: Species; side: SideKey; i: number; showOx: boolean;
  onCoef: (side: SideKey, i: number, n: number) => void;
  onIndex: (side: SideKey, i: number, path: number[], n: number) => void;
  onCharge: (side: SideKey, i: number, n: number) => void;
}) {
  const mass = molarMass(s.parts);
  const hint = bondHint(s.parts, s.charge);
  const ox = showOx ? oxidationStates(s.parts, s.charge) : null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Faktor</span>
          <span className="inline-flex items-center rounded-lg border border-[var(--accent)] overflow-hidden">
            <button onClick={() => onCoef(side, i, s.coef - 1)} disabled={s.coef <= 1}
              className="px-2 py-1 text-sm font-black hover:bg-[var(--surface-hover)] disabled:opacity-30"
              aria-label="Faktor kleiner">−</button>
            <span className="px-2.5 py-1 text-base font-black tabular-nums text-[var(--accent)]">{s.coef}</span>
            <button onClick={() => onCoef(side, i, s.coef + 1)}
              className="px-2 py-1 text-sm font-black hover:bg-[var(--surface-hover)]"
              aria-label="Faktor größer">+</button>
          </span>
        </span>
        <span className="text-lg font-black">
          {formatParts(s.parts)}
          <span style={{ color: s.charge ? ionColor(s.charge) : undefined }}>{formatCharge(s.charge)}</span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Formel</span>
        <FormulaEditor parts={s.parts} onIndex={(p, n) => onIndex(side, i, p, n)} />
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Ladung</span>
          <span className="inline-flex items-center rounded-lg border overflow-hidden"
            style={{ borderColor: s.charge ? ionColor(s.charge) : "var(--border)" }}>
            <button onClick={() => onCharge(side, i, s.charge - 1)} disabled={s.charge <= -6}
              className="px-2 py-1 text-sm font-black hover:bg-[var(--surface-hover)] disabled:opacity-30"
              aria-label="Ladung kleiner">−</button>
            <span className="px-2 py-1 text-sm font-black tabular-nums"
              style={{ color: s.charge ? ionColor(s.charge) : "var(--text-muted)" }}>
              {s.charge === 0 ? "0" : chargeBadge(s.charge)}
            </span>
            <button onClick={() => onCharge(side, i, s.charge + 1)} disabled={s.charge >= 6}
              className="px-2 py-1 text-sm font-black hover:bg-[var(--surface-hover)] disabled:opacity-30"
              aria-label="Ladung größer">+</button>
          </span>
        </span>
        <span className="text-xs text-[var(--text-muted)] ml-auto tabular-nums">
          {mass === null ? "—" : `M = ${fmtMass(mass)} u`}
        </span>
      </div>

      {ox && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-[var(--text-muted)]">Oxidationszahlen:</span>
          {Object.entries(ox).map(([el, v]) => (
            <span key={el} className="font-mono font-bold">
              {el} <span className={v === null ? "text-[var(--text-muted)]" : "text-[var(--accent)]"}>{oxLabel(v)}</span>
            </span>
          ))}
        </div>
      )}

      {hint && (
        <div className={`text-xs leading-relaxed rounded-lg px-2.5 py-2 ${
          hint.level === "warn" ? "bg-[var(--red)]/10 text-[var(--red)]" : "bg-[var(--surface-hover)] text-[var(--text-muted)]"
        }`}>
          ⚠️ {hint.text}
        </div>
      )}
    </div>
  );
}

/** Steckbrief eines Elements — beim Tippen auf sein Kügelchen. */
function ElementInfo({ symbol }: { symbol: string }) {
  const e = element(symbol);
  if (!e)
    return (
      <div className="text-sm text-[var(--text-muted)]">
        »{symbol}« steht nicht in meiner Elementliste.
      </div>
    );
  const missing = missingElectrons(e);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      <span className="font-black text-base" style={{ color: e.color }}>{e.symbol}</span>
      <span className="font-bold">{e.name}</span>
      <span className="text-[var(--text-muted)]">Ordnungszahl {e.z}</span>
      <span className="text-[var(--text-muted)]">Masse {e.mass.toLocaleString("de-DE")} u</span>
      <span className="text-[var(--text-muted)]">
        {e.group ? `${e.group}. Hauptgruppe` : "Nebengruppe"}
      </span>
      {e.outer !== null && (
        <span className="text-[var(--text-muted)]">
          {e.outer} Außenelektron{e.outer === 1 ? "" : "en"}
        </span>
      )}
      <span className="text-[var(--text-muted)]">
        Bindigkeit {e.valence.join(" oder ")}
      </span>
      <span className="text-[var(--text-muted)]">{e.metal ? "Metall" : "Nichtmetall"}</span>
      {missing !== null && missing > 0 && (
        <span className="text-[var(--accent)]">
          {missing === 1 ? "fehlt 1 Elektron" : `fehlen ${missing} Elektronen`} {shellGoal(e)}
        </span>
      )}
    </div>
  );
}

const START = CHEM_PRESETS[0];

export default function ChemieModus({ onMessage, fest }: {
  onMessage: (m: string) => void;
  /** Feste Reaktion (TaskCrawler-Station): keine Vorlagen, keine eigenen Reaktionen. */
  fest?: string;
}) {
  const [reaction, setReaction] = useState<Reaction>(() => {
    const f = fest ? parseReaction(fest) : null;
    if (f?.ok) return f.r;
    const r = parseReaction(START.src);
    return r.ok ? r.r : { left: [], right: [] };
  });
  const [wobble, kick] = useWobble();
  const [showOx, setShowOx] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("C3H8 + O2 -> CO2 + H2O");

  const update = useCallback((next: Reaction) => {
    setReaction(next);
    kick();
  }, [kick]);

  const onCoef = (side: SideKey, i: number, n: number) => update(setCoef(reaction, side, i, n));
  const onIndex = (side: SideKey, i: number, path: number[], n: number) =>
    update(setIndex(reaction, side, i, path, n));
  const onCharge = (side: SideKey, i: number, n: number) => update(setCharge(reaction, side, i, n));

  const applyCustom = () => {
    const r = parseReaction(customText);
    if (!r.ok) return onMessage(r.error);
    update(r.r);
    setCustomOpen(false);
  };

  const leftPan = useMemo(() => layoutSide(reaction.left, "left"), [reaction.left]);
  const rightPan = useMemo(() => layoutSide(reaction.right, "right"), [reaction.right]);

  const balance = elementBalance(reaction);
  const charges = chargeBalance(reaction);
  const ionen = hasIons(reaction);
  const done = isBalanced(reaction);
  const unknown = unknownElements(reaction);
  const ml = sideMass(reaction.left) ?? 0;
  const mr = sideMass(reaction.right) ?? 0;
  const tilt = tiltFor(ml, mr, wobble);
  const atomsL = Object.values(sideAtoms(reaction.left)).reduce((a, b) => a + b, 0);
  const atomsR = Object.values(sideAtoms(reaction.right)).reduce((a, b) => a + b, 0);

  const pan = (p: { crates: Crate[]; scale: number }, species: Species[]): PanContent => ({
    node: <Crates crates={p.crates} />, scale: p.scale, label: formatSide(species), empty: !p.crates.length,
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!fest && CHEM_PRESETS.map(p => (
          <button key={p.src} title={p.src}
            onClick={() => {
              const r = parseReaction(p.src);
              if (r.ok) update(r.r);
            }}
            className="px-3 py-1.5 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)]">
            {p.label}
          </button>
        ))}
        {!fest && <button onClick={() => setCustomOpen(o => !o)}
          className="px-3 py-1.5 rounded-xl text-sm border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent)]">
          ✏️ Eigene Reaktion
        </button>}
      </div>

      {customOpen && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 items-center">
            <input value={customText} onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applyCustom(); }}
              placeholder="z. B. CH4 + O2 -> CO2 + H2O"
              className="flex-1 min-w-[240px] bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-base font-mono" />
            <button onClick={applyCustom}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-[var(--accent)] text-[var(--accent-text,#111)]">
              Auf die Waage
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Elementsymbole groß schreiben, Indizes als Zahl: <code>Ca(OH)2 + CO2 -&gt; CaCO3 + H2O</code>.
            Ionen bekommen ihre Ladung angehängt: <code>(H)+ + (OH)- -&gt; H2O</code> — auch
            <code>Na+</code>, <code>Cl-</code> oder <code>SO4^2-</code>. Zwischen zwei Stoffen
            gehört ein Leerzeichen um das Plus, sonst wird daraus eine Ladung.
            Hydrate (CuSO₄·5H₂O) kann die Waage noch nicht.
          </p>
        </div>
      )}

      {unknown.length > 0 && (
        <div className="gw-banner rounded-xl border border-[var(--red)] bg-[var(--red)]/10 px-4 py-2 text-sm text-[var(--red)]">
          Unbekannte Elementsymbole: {unknown.join(", ")} — Masse und Farbe fehlen dafür.
        </div>
      )}

      {done && (
        <div className="gw-banner relative overflow-hidden rounded-2xl border-2 border-[var(--green)] bg-[var(--green)]/10 px-5 py-4">
          <Konfetti seed={atomsL} />
          <div className="relative">
            <div className="text-xl font-black text-[var(--green)]">⚗️ Ausgeglichen!</div>
            <div className="text-sm text-[var(--text-muted)] mt-1 font-mono">{formatReaction(reaction)}</div>
            <div className="text-sm text-[var(--text-muted)] mt-1">
              Links wie rechts {atomsL} Atome und {fmtMass(ml)} u — nichts geht verloren, nichts kommt dazu.
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
        <Balance tilt={tilt} ariaLabel={`Reaktionswaage: ${formatReaction(reaction)}`}
          left={pan(leftPan, reaction.left)} right={pan(rightPan, reaction.right)} />
        <div className="flex justify-center gap-6 text-xs text-[var(--text-muted)] pt-1">
          <span>links: {atomsL} Atome · {fmtMass(ml)} u</span>
          <span>rechts: {atomsR} Atome · {fmtMass(mr)} u</span>
        </div>
      </div>

      {/* Reaktionsgleichung — hier stehen die Faktoren zum Einstellen */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-3">
          Reaktionsgleichung — Faktoren hier einstellen
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
          {(["left", "right"] as SideKey[]).map(side => (
            <div key={side} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
              {side === "right" && (
                <span className="text-3xl font-black text-[var(--accent)] px-2" aria-label="reagiert zu">→</span>
              )}
              {reaction[side].map((s, i) => (
                <div key={`${side}-${i}`} className="flex items-center">
                  {i > 0 && <span className="text-2xl font-black px-2 text-[var(--text-muted)]">+</span>}
                  <CoefStepper n={s.coef} onChange={n => onCoef(side, i, n)} label={formatParts(s.parts)} />
                  <span className="text-2xl sm:text-3xl font-black">{formatParts(s.parts)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] text-center mt-3">
          Der Faktor sagt, wie oft der ganze Stoff dasteht — er verändert nichts am Stoff selbst.
          Die Formel (die Indizes) änderst du unten bei den Stoffen. Eine 1 schreibt man normalerweise nicht mit.
        </p>
      </div>

      {/* Elementbilanz */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-2">
          Elementbilanz — jedes Element muss links so oft vorkommen wie rechts
          {ionen && ", die Ladung auch"}
        </div>
        <div className="flex flex-wrap gap-2">
          {balance.map(b => {
            const e = element(b.el);
            return (
              <button key={b.el} onClick={() => setInfo(i => (i === b.el ? null : b.el))}
                title={`Steckbrief von ${e?.name ?? b.el}`}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-colors ${
                  b.ok ? "border-[var(--green)] bg-[var(--green)]/10" : "border-[var(--red)] bg-[var(--red)]/10"
                } ${info === b.el ? "ring-2 ring-[var(--accent)]" : ""}`}>
                <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-black"
                  style={{ background: e?.color ?? "#64748b", color: textOn(e?.color ?? "#64748b") }}>
                  {b.el}
                </span>
                <span className="font-mono text-sm tabular-nums">
                  {b.left} <span className="text-[var(--text-muted)]">:</span> {b.right}
                </span>
                <span className={b.ok ? "text-[var(--green)]" : "text-[var(--red)]"}>{b.ok ? "✓" : "✗"}</span>
              </button>
            );
          })}
        </div>
        {ionen && (
          <div className={`mt-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${
            charges.ok ? "border-[var(--green)] bg-[var(--green)]/10" : "border-[var(--red)] bg-[var(--red)]/10"
          }`}>
            <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Ladung</span>
            <span className="font-mono text-sm tabular-nums">
              {charges.left > 0 ? `+${charges.left}` : charges.left}
              <span className="text-[var(--text-muted)]"> : </span>
              {charges.right > 0 ? `+${charges.right}` : charges.right}
            </span>
            <span className={charges.ok ? "text-[var(--green)]" : "text-[var(--red)]"}>
              {charges.ok ? "✓" : "✗"}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              <span style={{ color: ionColor(1) }}>■</span> positiv ·
              <span style={{ color: ionColor(-1) }}> ■</span> negativ
            </span>
          </div>
        )}
        {info && (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
            <ElementInfo symbol={info} />
          </div>
        )}
        {!info && (
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Tipp auf ein Element für seinen Steckbrief: Masse, Hauptgruppe, Außenelektronen und Bindigkeit.
          </p>
        )}
      </div>

      {/* Stoffe */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
            Stoffe — hier änderst du die Formeln
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showOx} onChange={e => setShowOx(e.target.checked)} />
            Oxidationszahlen zeigen
          </label>
        </div>

        {(["left", "right"] as SideKey[]).map(side => (
          <div key={side} className="flex flex-col gap-2">
            <div className="text-xs font-bold text-[var(--text-muted)]">
              {side === "left" ? "Edukte (links)" : "Produkte (rechts)"}
            </div>
            {reaction[side].map((s, i) => (
              <SpeciesCard key={`${side}-${i}`} s={s} side={side} i={i} showOx={showOx}
                onCoef={onCoef} onIndex={onIndex} onCharge={onCharge} />
            ))}
          </div>
        ))}

        <p className="text-xs text-[var(--text-muted)]">
          Einen Index zu ändern heißt: ein anderer Stoff. Ausgeglichen wird über die Faktoren —
          die stehen auch oben in der Reaktionsgleichung und meinen dasselbe.
          Der Oktett-Hinweis prüft nur Verbindungen aus zwei Elementen über ihre Bindigkeit
          (Kreuzregel) — und es gibt Ausnahmen. Er ersetzt kein Nachdenken, er stupst nur an.
        </p>
      </div>
    </>
  );
}
