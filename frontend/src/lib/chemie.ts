/**
 * Reaktionsgleichungen für die Chemie-Waage.
 *
 * Eine Formel behält beim Lesen ihre Struktur — Ca(OH)₂ bleibt „Ca, dann die
 * Gruppe (OH) zweimal" —, damit sich jeder Index einzeln hoch- und runterzählen
 * lässt. Ausgeglichen ist die Gleichung, wenn jedes Element links so oft
 * vorkommt wie rechts; die Waage neigt sich nach der Masse.
 *
 * Nicht abgedeckt: Ionen und Ladungen (SO₄²⁻), Hydrate (CuSO₄·5H₂O).
 */
import { element, shellGoal, type Element } from "./elemente";

export type Part =
  | { kind: "el"; el: string; n: number }
  | { kind: "grp"; parts: Part[]; n: number };

export type Species = { coef: number; parts: Part[] };
export type Reaction = { left: Species[]; right: Species[] };
export type SideKey = "left" | "right";

// ── Atome zählen ──────────────────────────────────────────────────────────────

export function countAtoms(parts: Part[], factor = 1): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (ps: Part[], f: number) => {
    for (const p of ps) {
      if (p.kind === "el") out[p.el] = (out[p.el] ?? 0) + p.n * f;
      else walk(p.parts, p.n * f);
    }
  };
  walk(parts, factor);
  return out;
}

export function sideAtoms(species: Species[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of species)
    for (const [el, n] of Object.entries(countAtoms(s.parts, s.coef))) out[el] = (out[el] ?? 0) + n;
  return out;
}

/** Molare Masse einer Formeleinheit; null, wenn ein Element unbekannt ist. */
export function molarMass(parts: Part[]): number | null {
  let m = 0;
  for (const [el, n] of Object.entries(countAtoms(parts))) {
    const e = element(el);
    if (!e) return null;
    m += e.mass * n;
  }
  return Math.round(m * 1000) / 1000;
}

export function sideMass(species: Species[]): number | null {
  let m = 0;
  for (const s of species) {
    const one = molarMass(s.parts);
    if (one === null) return null;
    m += one * s.coef;
  }
  return Math.round(m * 1000) / 1000;
}

export type ElementBalance = { el: string; left: number; right: number; ok: boolean };

export function elementBalance(r: Reaction): ElementBalance[] {
  const l = sideAtoms(r.left);
  const rt = sideAtoms(r.right);
  const els = [...new Set([...Object.keys(l), ...Object.keys(rt)])];
  els.sort((a, b) => (element(a)?.z ?? 999) - (element(b)?.z ?? 999));
  return els.map(el => ({ el, left: l[el] ?? 0, right: rt[el] ?? 0, ok: (l[el] ?? 0) === (rt[el] ?? 0) }));
}

export const isBalanced = (r: Reaction): boolean => elementBalance(r).every(b => b.ok);

/** Unbekannte Elementsymbole in der ganzen Gleichung. */
export function unknownElements(r: Reaction): string[] {
  const all = [...Object.keys(sideAtoms(r.left)), ...Object.keys(sideAtoms(r.right))];
  return [...new Set(all)].filter(s => !element(s));
}

// ── Ändern ────────────────────────────────────────────────────────────────────

const cloneParts = (ps: Part[]): Part[] =>
  ps.map(p => (p.kind === "el" ? { ...p } : { kind: "grp", n: p.n, parts: cloneParts(p.parts) }));

const cloneSpecies = (s: Species): Species => ({ coef: s.coef, parts: cloneParts(s.parts) });

export function withSpecies(r: Reaction, side: SideKey, i: number, fn: (s: Species) => void): Reaction {
  const next: Reaction = { left: r.left.map(cloneSpecies), right: r.right.map(cloneSpecies) };
  fn(next[side][i]);
  return next;
}

export const setCoef = (r: Reaction, side: SideKey, i: number, coef: number): Reaction =>
  withSpecies(r, side, i, s => {
    s.coef = Math.max(1, Math.min(20, Math.round(coef)));
  });

/** `path` zeigt über die Teilformeln auf einen Index (z. B. [1, 0] in Ca(OH)₂). */
export function setIndex(r: Reaction, side: SideKey, i: number, path: number[], n: number): Reaction {
  return withSpecies(r, side, i, s => {
    let ps = s.parts;
    for (let k = 0; k < path.length - 1; k++) {
      const p = ps[path[k]];
      if (p.kind !== "grp") return;
      ps = p.parts;
    }
    const target = ps[path[path.length - 1]];
    if (target) target.n = Math.max(1, Math.min(12, Math.round(n)));
  });
}

// ── Oxidationszahlen ──────────────────────────────────────────────────────────

/**
 * Oxidationszahlen nach den Schulregeln. Sauerstoff wird bewusst zuletzt
 * bestimmt — dadurch fällt bei Peroxiden (H₂O₂) von selbst −1 heraus.
 * Bleiben zwei oder mehr Elemente offen, gibt es null zurück statt zu raten.
 */
export function oxidationStates(parts: Part[]): Record<string, number | null> {
  const counts = countAtoms(parts);
  const els = Object.keys(counts);
  const out: Record<string, number | null> = {};
  if (els.length === 1) {
    out[els[0]] = 0; // Element in Reinform
    return out;
  }

  const known: Record<string, number> = {};
  const hasMetalPartner = els.some(s => element(s)?.metal);
  for (const s of els) {
    const e = element(s);
    if (!e) continue;
    if (s === "F") known[s] = -1;
    else if (s === "H") known[s] = els.length === 2 && hasMetalPartner ? -1 : 1;
    else if (e.metal && e.group === 1) known[s] = 1;
    else if (e.metal && e.group === 2) known[s] = 2;
    else if (s === "Al") known[s] = 3;
  }

  // Salzregel: im Zweistoff Metall + Nichtmetall füllt das Nichtmetall sein
  // Oktett auf (S → −2, Cl → −1). Sauerstoff bleibt außen vor, damit Peroxide
  // weiter von selbst herausfallen.
  if (els.length === 2 && els.some(s => element(s)?.metal)) {
    for (const s of els) {
      const e = element(s);
      if (!e || e.metal || s === "O" || s in known) continue;
      if (e.group !== null && e.group >= 5) known[s] = e.group - 8;
    }
  }

  let open = els.filter(s => !(s in known));
  // Sauerstoff nur festlegen, wenn danach noch genau ein Element offen bliebe.
  if (open.length > 1 && open.includes("O")) {
    known["O"] = -2;
    open = open.filter(s => s !== "O");
  }

  for (const s of els) out[s] = known[s] ?? null;

  let sum = 0;
  for (const [s, ox] of Object.entries(known)) sum += ox * counts[s];

  if (open.length === 0) {
    // Alles aus Regeln — nur ausgeben, wenn die Summe auch aufgeht.
    if (Math.abs(sum) > 1e-9) for (const s of els) out[s] = null;
    return out;
  }
  if (open.length !== 1) return out;

  const rest = open[0];
  const v = Math.round((-sum / counts[rest]) * 100) / 100;
  out[rest] = Object.is(v, -0) ? 0 : v;
  return out;
}

// ── Oktettregel ───────────────────────────────────────────────────────────────

/** Verbindungen, die die einfache Bindigkeitsregel scheinbar verletzen. */
const OK_ANYWAY = new Set(["CO", "NO", "NO2", "N2O", "O3", "H2O2", "PCl5", "SF6", "NO3", "SO2"]);

const formulaKey = (parts: Part[]): string =>
  Object.entries(countAtoms(parts))
    .map(([el, n]) => `${el}${n > 1 ? n : ""}`)
    .join("");

export type BondHint = { level: "unknown" | "warn"; text: string };

/**
 * Prüft nach der Bindigkeit, ob eine Verbindung aus zwei Elementen aufgehen
 * kann (Kreuzregel). Für alles andere gibt es bewusst keinen Hinweis, statt
 * falschen Alarm zu schlagen.
 */
export function bondHint(parts: Part[]): BondHint | null {
  const counts = countAtoms(parts);
  const els = Object.keys(counts);

  const unknown = els.filter(s => !element(s));
  if (unknown.length)
    return { level: "unknown", text: `Das Element »${unknown[0]}« kenne ich nicht — Tippfehler?` };

  if (els.length !== 2) return null;
  if (OK_ANYWAY.has(formulaKey(parts))) return null;

  const [a, b] = els;
  const ea = element(a)!;
  const eb = element(b)!;
  if (!ea.valence.length || !eb.valence.length) return null;
  if (ea.valence.includes(0) || eb.valence.includes(0))
    return { level: "warn", text: `${ea.name} ist ein Edelgas und geht normalerweise keine Bindungen ein.` };

  const fits = ea.valence.some(va => eb.valence.some(vb => va * counts[a] === vb * counts[b]));
  if (fits) return null;

  const need = (e: Element) =>
    e.outer !== null && !e.metal
      ? `${e.name} hat ${e.outer} Außenelektron${e.outer === 1 ? "" : "en"} und braucht ${e.valence[0]} `
        + `Bindung${e.valence[0] === 1 ? "" : "en"} ${shellGoal(e)}`
      : `${e.name} bildet üblicherweise ${e.valence.join(" oder ")} Bindungen`;

  return {
    level: "warn",
    text:
      `${formulaKey(parts)} geht so nicht auf: ${need(ea)}, ${need(eb)}. ` +
      `${counts[a]}·${a} liefert ${ea.valence[0] * counts[a]} Bindungen, ${counts[b]}·${b} aber ${eb.valence[0] * counts[b]}. ` +
      `Es gibt Ausnahmen von der Oktettregel — prüfe die Formel trotzdem.`,
  };
}

// ── Lesen und Schreiben ───────────────────────────────────────────────────────

/** Massen deutsch schreiben: 34,01 statt 34.01. */
export const fmtMass = (m: number): string =>
  m.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const sub = (n: number): string => String(n).split("").map(d => SUB[Number(d)] ?? d).join("");

export function formatParts(parts: Part[]): string {
  return parts
    .map(p =>
      p.kind === "el"
        ? `${p.el}${p.n > 1 ? sub(p.n) : ""}`
        : `(${formatParts(p.parts)})${p.n > 1 ? sub(p.n) : ""}`,
    )
    .join("");
}

export const formatSpecies = (s: Species): string =>
  `${s.coef > 1 ? `${s.coef} ` : ""}${formatParts(s.parts)}`;

export const formatSide = (species: Species[]): string => species.map(formatSpecies).join(" + ");

export const formatReaction = (r: Reaction): string =>
  `${formatSide(r.left)} → ${formatSide(r.right)}`;

class ChemieError extends Error {}

const SUB_DIGITS: Record<string, string> = Object.fromEntries(
  SUB.split("").map((c, i) => [c, String(i)]),
);

function parseSpecies(src: string): Species {
  const s = src.replace(/\s+/g, "").replace(/[₀-₉]/g, c => SUB_DIGITS[c] ?? c);
  if (!s) throw new ChemieError("Da fehlt ein Stoff.");
  let i = 0;

  const number = (): number | null => {
    let j = i;
    while (j < s.length && /[0-9]/.test(s[j])) j++;
    if (j === i) return null;
    const v = Number(s.slice(i, j));
    i = j;
    return v;
  };

  const coef = number() ?? 1;
  if (coef < 1) throw new ChemieError("Ein Faktor muss mindestens 1 sein.");

  const formula = (depth: number): Part[] => {
    const parts: Part[] = [];
    while (i < s.length) {
      const ch = s[i];
      if (ch === ")") {
        if (depth === 0) throw new ChemieError("Eine Klammer wurde zu viel geschlossen.");
        return parts;
      }
      if (ch === "(") {
        i++;
        const inner = formula(depth + 1);
        if (s[i] !== ")") throw new ChemieError("Eine Klammer wurde nicht geschlossen.");
        i++;
        if (!inner.length) throw new ChemieError("Die Klammer ist leer.");
        parts.push({ kind: "grp", parts: inner, n: number() ?? 1 });
        continue;
      }
      if (!/[A-Z]/.test(ch)) throw new ChemieError(`Ein Elementsymbol beginnt groß — »${ch}« passt nicht.`);
      let sym = ch;
      i++;
      if (i < s.length && /[a-z]/.test(s[i])) {
        sym += s[i];
        i++;
      }
      parts.push({ kind: "el", el: sym, n: number() ?? 1 });
    }
    if (depth > 0) throw new ChemieError("Eine Klammer wurde nicht geschlossen.");
    return parts;
  };

  const parts = formula(0);
  if (!parts.length) throw new ChemieError("Da fehlt eine Formel.");
  return { coef, parts };
}

export function parseReaction(input: string): { ok: true; r: Reaction } | { ok: false; error: string } {
  try {
    const normalized = input.replace(/⟶|→|=>|-->/g, "->").replace(/\s+/g, " ").trim();
    const halves = normalized.includes("->") ? normalized.split("->") : normalized.split("=");
    if (halves.length !== 2) return { ok: false, error: "Schreibe die Reaktion mit einem Pfeil: A + B -> C" };
    const side = (txt: string): Species[] => {
      const items = txt.split("+").map(t => t.trim()).filter(Boolean);
      if (!items.length) throw new ChemieError("Eine Seite der Reaktion ist leer.");
      return items.map(parseSpecies);
    };
    return { ok: true, r: { left: side(halves[0]), right: side(halves[1]) } };
  } catch (e) {
    return { ok: false, error: e instanceof ChemieError ? e.message : "Das konnte ich nicht lesen." };
  }
}

// ── Vorlagen ──────────────────────────────────────────────────────────────────

export type ChemPreset = { label: string; src: string };

export const CHEM_PRESETS: ChemPreset[] = [
  { label: "Knallgas", src: "H2 + O2 -> H2O" },
  { label: "Methan verbrennt", src: "CH4 + O2 -> CO2 + H2O" },
  { label: "Eisen rostet", src: "Fe + O2 -> Fe2O3" },
  { label: "Kochsalz", src: "Na + Cl2 -> NaCl" },
  { label: "Ammoniak", src: "N2 + H2 -> NH3" },
  { label: "Kalk brennen", src: "CaCO3 -> CaO + CO2" },
  { label: "Aluminium in Salzsäure", src: "Al + HCl -> AlCl3 + H2" },
  { label: "Kalkwasser", src: "Ca(OH)2 + CO2 -> CaCO3 + H2O" },
];
