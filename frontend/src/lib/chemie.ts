/**
 * Reaktionsgleichungen für die Chemie-Waage.
 *
 * Eine Formel behält beim Lesen ihre Struktur — Ca(OH)₂ bleibt „Ca, dann die
 * Gruppe (OH) zweimal" —, damit sich jeder Index einzeln hoch- und runterzählen
 * lässt. Ausgeglichen ist die Gleichung, wenn jedes Element links so oft
 * vorkommt wie rechts — und die Ladungen auf beiden Seiten gleich sind; die
 * Waage neigt sich nach der Masse.
 *
 * Ionen werden mit angehängter Ladung geschrieben: (H)+, (CO2)2-, SO4^2-, Na+.
 * Stoffe trennt ein Plus mit Leerzeichen ringsum, damit es nicht mit einer
 * Ladung verwechselt wird: »(H)+ + (OH)- -> H2O«.
 *
 * Nicht abgedeckt: Hydrate (CuSO₄·5H₂O).
 */
import { element, isParticle, shellGoal, type Element } from "./elemente";

export type Part =
  | { kind: "el"; el: string; n: number }
  | { kind: "grp"; parts: Part[]; n: number };

/** `charge` ist die Ionenladung: 0 = neutral, +1 für H⁺, −2 für CO₃²⁻. */
export type Species = { coef: number; parts: Part[]; charge: number };
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

/** Summe der Eigenladungen aller Kernteilchen einer Formel. */
export function particleCharge(parts: Part[]): number {
  let q = 0;
  for (const [sym, n] of Object.entries(countAtoms(parts))) {
    const e = element(sym);
    if (e?.particleCharge) q += e.particleCharge * n;
  }
  return q;
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

/**
 * Elementbilanz — Kernteilchen bleiben bewusst draußen.
 *
 * In einer Redox-Halbgleichung stehen die Elektronen nur auf einer Seite
 * (Cu²⁺ + 2e⁻ → Cu), und bei einer Kernumwandlung wandeln sich die Teilchen
 * ineinander um (n → p⁺ + e⁻). Beides ist richtig, würde aber jede
 * Teilchenbilanz reißen. Was hier zählen muss, ist die **Ladung** — die prüft
 * chargeBalance, und isBalanced verlangt beides.
 */
export function elementBalance(r: Reaction): ElementBalance[] {
  const l = sideAtoms(r.left);
  const rt = sideAtoms(r.right);
  const els = [...new Set([...Object.keys(l), ...Object.keys(rt)])].filter(el => !isParticle(el));
  els.sort((a, b) => (element(a)?.z ?? 999) - (element(b)?.z ?? 999));
  return els.map(el => ({ el, left: l[el] ?? 0, right: rt[el] ?? 0, ok: (l[el] ?? 0) === (rt[el] ?? 0) }));
}

export const sideCharge = (species: Species[]): number =>
  species.reduce((sum, s) => sum + s.coef * s.charge, 0);

export type ChargeBalance = { left: number; right: number; ok: boolean };

export function chargeBalance(r: Reaction): ChargeBalance {
  const left = sideCharge(r.left);
  const right = sideCharge(r.right);
  return { left, right, ok: left === right };
}

/** Kommt in der Gleichung überhaupt ein Ion vor? */
export const hasIons = (r: Reaction): boolean =>
  [...r.left, ...r.right].some(s => s.charge !== 0);

/** Ausgeglichen heißt: jedes Element stimmt — und die Ladung auch. */
export const isBalanced = (r: Reaction): boolean =>
  elementBalance(r).every(b => b.ok) && chargeBalance(r).ok;

/** Unbekannte Elementsymbole in der ganzen Gleichung. */
export function unknownElements(r: Reaction): string[] {
  const all = [...Object.keys(sideAtoms(r.left)), ...Object.keys(sideAtoms(r.right))];
  return [...new Set(all)].filter(s => !element(s));
}

// ── Ändern ────────────────────────────────────────────────────────────────────

const cloneParts = (ps: Part[]): Part[] =>
  ps.map(p => (p.kind === "el" ? { ...p } : { kind: "grp", n: p.n, parts: cloneParts(p.parts) }));

const cloneSpecies = (s: Species): Species => ({ coef: s.coef, charge: s.charge, parts: cloneParts(s.parts) });

export function withSpecies(r: Reaction, side: SideKey, i: number, fn: (s: Species) => void): Reaction {
  const next: Reaction = { left: r.left.map(cloneSpecies), right: r.right.map(cloneSpecies) };
  fn(next[side][i]);
  return next;
}

export const setCoef = (r: Reaction, side: SideKey, i: number, coef: number): Reaction =>
  withSpecies(r, side, i, s => {
    s.coef = Math.max(1, Math.min(20, Math.round(coef)));
  });

export const setCharge = (r: Reaction, side: SideKey, i: number, charge: number): Reaction =>
  withSpecies(r, side, i, s => {
    s.charge = Math.max(-6, Math.min(6, Math.round(charge)));
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
 * Die Summe ergibt die Ladung des Teilchens: 0 im Molekül, sonst die Ionenladung.
 * Bleiben zwei oder mehr Elemente offen, gibt es null zurück statt zu raten.
 */
export function oxidationStates(parts: Part[], charge = 0): Record<string, number | null> {
  const counts = countAtoms(parts);
  const els = Object.keys(counts);
  const out: Record<string, number | null> = {};
  if (els.length === 1) {
    // Element in Reinform (0) oder einatomiges Ion (Na⁺ → +I).
    const v = charge / counts[els[0]];
    out[els[0]] = Object.is(v, -0) ? 0 : v;
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
    // Alles aus Regeln — nur ausgeben, wenn die Summe auch die Ladung trifft.
    if (Math.abs(sum - charge) > 1e-9) for (const s of els) out[s] = null;
    return out;
  }
  if (open.length !== 1) return out;

  const rest = open[0];
  const v = Math.round(((charge - sum) / counts[rest]) * 100) / 100;
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
 * falschen Alarm zu schlagen — auch bei Ionen nicht, denn deren Bindigkeit
 * verschiebt sich mit der Ladung (H⁺ hat gar keine Bindung).
 */
export function bondHint(parts: Part[], charge = 0): BondHint | null {
  const counts = countAtoms(parts);
  const els = Object.keys(counts);

  const unknown = els.filter(s => !element(s));
  if (unknown.length)
    return { level: "unknown", text: `Das Element »${unknown[0]}« kenne ich nicht — Tippfehler?` };

  if (charge !== 0) return null;
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

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const sup = (n: number): string => String(n).split("").map(d => SUP[Number(d)] ?? d).join("");

/** Die Ladung als Hochstellung: ⁺, ²⁻ … — leer bei neutralen Teilchen. */
export function formatCharge(charge: number): string {
  if (!charge) return "";
  const n = Math.abs(charge);
  return `${n > 1 ? sup(n) : ""}${charge > 0 ? "⁺" : "⁻"}`;
}

export const formatSpecies = (s: Species): string =>
  `${s.coef > 1 ? `${s.coef} ` : ""}${formatParts(s.parts)}${formatCharge(s.charge)}`;

export const formatSide = (species: Species[]): string => species.map(formatSpecies).join(" + ");

export const formatReaction = (r: Reaction): string =>
  `${formatSide(r.left)} → ${formatSide(r.right)}`;

class ChemieError extends Error {}

const SUB_DIGITS: Record<string, string> = Object.fromEntries(
  SUB.split("").map((c, i) => [c, String(i)]),
);

/** Trennt eine angehängte Ladung ab: »(CO2)2-« → [»(CO2)«, −2], »SO4^2-« → [»SO4«, −2]. */
function splitCharge(src: string): [string, number] {
  const m = /(\^?)(\d*)([+-])$/.exec(src);
  if (!m) return [src, 0];
  const magnitude = m[2] === "" ? 1 : Number(m[2]);
  if (magnitude < 1 || magnitude > 6) throw new ChemieError(`Die Ladung »${m[0]}« kann ich nicht lesen.`);
  return [src.slice(0, m.index), m[3] === "+" ? magnitude : -magnitude];
}

function parseSpecies(src: string): Species {
  const [body, charge] = splitCharge(src.replace(/\s+/g, "").replace(/[₀-₉]/g, c => SUB_DIGITS[c] ?? c));
  const s = body;
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
      // Kernteilchen (p, n, e) sind klein geschrieben — sie kollidieren
      // deshalb nicht mit Phosphor und Stickstoff.
      if (isParticle(ch)) {
        i++;
        parts.push({ kind: "el", el: ch, n: number() ?? 1 });
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
  // »e« ohne Vorzeichen ist trotzdem ein Elektron. Nur ergänzen, wenn niemand
  // eine Ladung geschrieben hat — sonst gilt das Geschriebene.
  const chargeWithParticles = charge !== 0 ? charge : particleCharge(parts);
  // »(H)+« meint das Ion, nicht die Gruppe: eine Klammer, die die ganze Formel
  // umschließt und nur einmal zählt, wird ausgepackt.
  const only = parts.length === 1 ? parts[0] : null;
  if (only && only.kind === "grp" && only.n === 1)
    return { coef, parts: only.parts, charge: chargeWithParticles };
  return { coef, parts, charge: chargeWithParticles };
}

/**
 * Zerlegt eine Seite in Stoffe. Das Plus trennt nur dann, wenn danach ein
 * neuer Stoff beginnt — sonst gehört es als Ladung zum Teilchen davor
 * (»(H)+ + (OH)-«).
 */
function splitSpecies(txt: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "+" && depth === 0 && /^[A-Za-z0-9(]/.test(txt.slice(i + 1).trimStart())) {
      out.push(txt.slice(start, i));
      start = i + 1;
    }
  }
  out.push(txt.slice(start));
  return out.map(t => t.trim()).filter(Boolean);
}

export function parseReaction(input: string): { ok: true; r: Reaction } | { ok: false; error: string } {
  try {
    const normalized = input.replace(/⟶|→|=>|-->/g, "->").replace(/\s+/g, " ").trim();
    const halves = normalized.includes("->") ? normalized.split("->") : normalized.split("=");
    if (halves.length !== 2) return { ok: false, error: "Schreibe die Reaktion mit einem Pfeil: A + B -> C" };
    const side = (txt: string): Species[] => {
      const items = splitSpecies(txt);
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
  { label: "Neutralisation (Ionen)", src: "(H)+ + (OH)- -> H2O" },
  { label: "Silberchlorid fällt aus", src: "Ag+ + Cl- -> AgCl" },
  { label: "Kalk aus Ionen", src: "Ca2+ + (CO3)2- -> CaCO3" },
  // Kernteilchen: Redox-Halbgleichungen und Kernumwandlungen. Ausgeglichen
  // ist hier vor allem die Ladung — die Masse eines Elektrons fällt kaum auf.
  { label: "Eisen gibt ein Elektron ab", src: "Fe2+ -> Fe3+ + e-" },
  { label: "Kupfer nimmt Elektronen auf", src: "Cu2+ + 2e- -> Cu" },
  { label: "Chlor wird zum Chlorid", src: "Cl2 + 2e- -> 2Cl-" },
  { label: "Neutron zerfällt", src: "n -> p+ + e-" },
];
