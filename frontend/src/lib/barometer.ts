// Pure helpers + constants for the Umfrage (barometer) feature — kept dependency-free
// so they're trivially unit-testable.
import type { BarometerAnswer, BarometerKind, BarometerQuestionIn, BarometerQuestionOut, BarometerScaleStyle, BarometerShowIf } from "@/lib/api";

export const OPTION_PRESETS: { id: string; label: string; options: string[] }[] = [
  { id: "geschlecht", label: "Geschlecht", options: ["männlich", "weiblich", "divers", "keine Angabe"] },
  { id: "alter-schule", label: "Alter (Schüler:innen)", options: ["unter 10", "10–11", "12–13", "14–15", "16–17", "18 oder älter"] },
  { id: "alter-erw", label: "Alter (Erwachsene)", options: ["unter 18", "18–29", "30–44", "45–59", "60 oder älter"] },
  { id: "klassenstufe", label: "Klassenstufe", options: ["5", "6", "7", "8", "9", "10", "11", "12", "13"] },
  { id: "ja-nein", label: "Ja / Nein", options: ["Ja", "Nein", "Weiß nicht"] },
  { id: "haeufigkeit", label: "Häufigkeit", options: ["nie", "selten", "manchmal", "oft", "immer"] },
  { id: "zustimmung", label: "Zustimmung", options: ["stimme voll zu", "stimme eher zu", "teils/teils", "stimme eher nicht zu", "stimme gar nicht zu"] },
  { id: "zufriedenheit", label: "Zufriedenheit", options: ["sehr zufrieden", "zufrieden", "neutral", "unzufrieden", "sehr unzufrieden"] },
  { id: "schulnote", label: "Schulnote", options: ["1 – sehr gut", "2 – gut", "3 – befriedigend", "4 – ausreichend", "5 – mangelhaft", "6 – ungenügend"] },
  { id: "rolle", label: "Rolle", options: ["Schüler:in", "Lehrkraft", "Elternteil", "Sonstige"] },
];

export const KIND_LABELS: Record<BarometerKind, string> = {
  scale: "Skala", choice: "Auswahl (Dropdown)", multi: "Mehrfachauswahl", number: "Zahl", text: "Freitext",
};

// First entry = default. Ids MUST match backend CHARTS.
export const CHART_TYPES: Record<BarometerKind, { id: string; label: string }[]> = {
  scale: [
    { id: "saeulen", label: "Säulen" },
    { id: "balken", label: "Balken" },
    { id: "donut", label: "Donut" },
    { id: "gestapelt", label: "Gestapelter Balken" },
    { id: "flaeche", label: "Fläche" },
  ],
  choice: [
    { id: "balken", label: "Balken" },
    { id: "saeulen", label: "Säulen" },
    { id: "donut", label: "Donut" },
    { id: "kreis", label: "Kreis" },
    { id: "gestapelt", label: "Gestapelter Balken" },
  ],
  multi: [
    { id: "balken", label: "Balken" },
    { id: "saeulen", label: "Säulen" },
  ],
  number: [
    { id: "histogramm", label: "Histogramm" },
    { id: "kennzahlen", label: "Kennzahlen" },
  ],
  text: [
    { id: "liste", label: "Liste" },
    { id: "wortwolke", label: "Wortwolke" },
  ],
};

export const BLOCK_CHART_TYPES: { id: string; label: string }[] = [
  { id: "likert", label: "Likert (gestapelt)" },
  { id: "mittelwerte", label: "Mittelwerte" },
];

export const SCALE_STYLES: { id: BarometerScaleStyle; label: string }[] = [
  { id: "zahlen", label: "Zahlen" },
  { id: "smileys_auf", label: "Smileys 😞 → 😀" },
  { id: "smileys_ab", label: "Smileys 😀 → 😞" },
];

export const SMILEYS = ["😣", "😞", "🙁", "😐", "🙂", "😊", "😀"];
export const MAX_SMILEY_STEPS = 7;

export function chartOf(q: { kind: BarometerKind; chart: string | null; block?: string | null }): string {
  if (q.block) {
    const validBlock = q.chart && BLOCK_CHART_TYPES.some(c => c.id === q.chart);
    return validBlock ? (q.chart as string) : "likert";
  }
  const types = CHART_TYPES[q.kind];
  const valid = q.chart && types.some(c => c.id === q.chart);
  return valid ? (q.chart as string) : types[0].id;
}

export function smileyFor(q: { scale_min: number; scale_max: number; scale_style: BarometerScaleStyle }, value: number): string | null {
  if (q.scale_style === "zahlen") return null;
  const n = q.scale_max - q.scale_min + 1;
  if (n === 1) return "😐";
  const pos = q.scale_style === "smileys_auf" ? value - q.scale_min : q.scale_max - value;
  const idx = Math.round((pos * 6) / (n - 1));
  return SMILEYS[Math.min(6, Math.max(0, idx))];
}

export function scaleLabel(q: { scale_min: number; scale_max: number; scale_style?: BarometerScaleStyle }, value: number): string {
  if (q.scale_style && q.scale_style !== "zahlen") {
    const s = smileyFor({ scale_min: q.scale_min, scale_max: q.scale_max, scale_style: q.scale_style }, value);
    if (s) return s;
  }
  return String(value);
}

export function chartRows(
  q: { kind: BarometerKind; scale_min: number; scale_max: number; options: string[]; scale_style?: BarometerScaleStyle },
  distribution: Record<string, number>,
): { key: string; label: string; count: number }[] {
  if (q.kind === "scale") {
    const rows: { key: string; label: string; count: number }[] = [];
    for (let v = q.scale_min; v <= q.scale_max; v++) {
      const key = String(v);
      rows.push({ key, label: scaleLabel(q, v), count: distribution[key] ?? 0 });
    }
    return rows;
  }
  if (q.kind === "choice" || q.kind === "multi") {
    return q.options.map((label, i) => {
      const key = String(i);
      return { key, label, count: distribution[key] ?? 0 };
    });
  }
  return [];
}

export function scaleMean(q: { scale_min: number; scale_max: number }, distribution: Record<string, number>): number | null {
  let sum = 0;
  let count = 0;
  for (let v = q.scale_min; v <= q.scale_max; v++) {
    const c = distribution[String(v)] ?? 0;
    sum += v * c;
    count += c;
  }
  return count === 0 ? null : sum / count;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export function numberStats(distribution: Record<string, number>): { n: number; mean: number; median: number; min: number; max: number } | null {
  const values: number[] = [];
  for (const [key, count] of Object.entries(distribution)) {
    const v = Number(key);
    for (let i = 0; i < count; i++) values.push(v);
  }
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  const n = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mid = Math.floor(n / 2);
  const median = n % 2 === 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return { n, mean: sum / n, median, min: values[0], max: values[n - 1] };
}

export function histogramRows(distribution: Record<string, number>, maxBins = 8): { key: string; label: string; count: number }[] {
  const entries = Object.entries(distribution)
    .map(([key, count]) => ({ key, v: Number(key), count }))
    .filter(e => e.count > 0)
    .sort((a, b) => a.v - b.v);
  if (entries.length === 0) return [];
  if (entries.length <= maxBins) {
    return entries.map(e => ({ key: e.key, label: formatNumber(e.v), count: e.count }));
  }
  const min = entries[0].v;
  const max = entries[entries.length - 1].v;
  const width = (max - min) / maxBins || 1;
  const bins = Array.from({ length: maxBins }, (_, i) => {
    const lo = min + i * width;
    const hi = i === maxBins - 1 ? max : min + (i + 1) * width;
    return { key: String(i), label: `${formatNumber(lo)}–${formatNumber(hi)}`, count: 0 };
  });
  for (const e of entries) {
    let idx = Math.floor((e.v - min) / width);
    if (idx >= maxBins) idx = maxBins - 1;
    if (idx < 0) idx = 0;
    bins[idx].count += e.count;
  }
  return bins;
}

export function slidesOf<T extends { same_slide: boolean }>(qs: T[]): T[][] {
  const slides: T[][] = [];
  for (const q of qs) {
    if (slides.length === 0 || !q.same_slide) slides.push([q]);
    else slides[slides.length - 1].push(q);
  }
  return slides;
}

export type Segment<T> = { type: "block"; block: string; questions: T[] } | { type: "single"; question: T };

export function segmentsOf<T extends { block: string | null }>(slide: T[]): Segment<T>[] {
  const segments: Segment<T>[] = [];
  for (const q of slide) {
    if (q.block) {
      const last = segments[segments.length - 1];
      if (last && last.type === "block" && last.block === q.block) {
        last.questions.push(q);
        continue;
      }
      segments.push({ type: "block", block: q.block, questions: [q] });
    } else {
      segments.push({ type: "single", question: q });
    }
  }
  return segments;
}

export function conditionMet(q: { show_if: BarometerShowIf | null }, answers: Record<number, BarometerAnswer>): boolean {
  if (!q.show_if) return true;
  const key = q.show_if.parent_id ?? q.show_if.question;
  const a = answers[key];
  if (a === undefined) return false;
  if (Array.isArray(a)) return a.some(v => q.show_if!.options.includes(v));
  if (typeof a === "number") return q.show_if.options.includes(a);
  return false;
}

const STOP_WORDS = new Set([
  "und", "oder", "aber", "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen",
  "ist", "sind", "war", "mit", "für", "auf", "nicht", "auch", "ich", "wir", "sie", "man",
  "mehr", "sehr", "dass", "wenn", "noch", "bei", "von", "zu", "im", "in", "es",
]);

export function wordFrequencies(texts: string[], max = 40): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const words = text.toLowerCase().split(/[^a-zäöüß]+/i).filter(Boolean);
    for (const word of words) {
      if (word.length < 3 || STOP_WORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, max);
}

// ── Editor drafts ────────────────────────────────────────────────────────────

export type DraftCondition = { parentUid: string; options: number[] } | null;

export type DraftQuestion = {
  uid: string; type: "question"; text: string; kind: BarometerKind; options: string[]; chart: string;
  scale_min: number; scale_max: number; scale_min_label: string; scale_max_label: string; scale_style: BarometerScaleStyle;
  max_choices: number | null; num_min: number | null; num_max: number | null; unit: string;
  same_slide: boolean; show_if: DraftCondition;
};

export type DraftBlock = {
  uid: string; type: "block"; intro: string; statements: string[]; chart: string;
  scale_min: number; scale_max: number; scale_min_label: string; scale_max_label: string; scale_style: BarometerScaleStyle;
  same_slide: boolean; show_if: DraftCondition;
};

export type DraftItem = DraftQuestion | DraftBlock;

export function newUid(prefix: "q" | "b"): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 36).toString(36);
  return prefix + s;
}

export function blankQuestion(): DraftQuestion {
  return {
    uid: newUid("q"), type: "question", text: "", kind: "scale", options: [], chart: "",
    scale_min: 1, scale_max: 6, scale_min_label: "sehr gut", scale_max_label: "schlecht", scale_style: "zahlen",
    max_choices: null, num_min: null, num_max: null, unit: "", same_slide: false, show_if: null,
  };
}

export function blankBlock(): DraftBlock {
  return {
    uid: newUid("b"), type: "block", intro: "", statements: ["", ""], chart: "",
    scale_min: 1, scale_max: 5, scale_min_label: "stimme gar nicht zu", scale_max_label: "stimme voll zu", scale_style: "zahlen",
    same_slide: false, show_if: null,
  };
}

export function draftsToQuestions(items: DraftItem[]): BarometerQuestionIn[] {
  const out: BarometerQuestionIn[] = [];
  const parentInfo = new Map<string, { index: number; kind: BarometerKind; optionsLen: number }>();

  function resolveShowIf(cond: DraftCondition): BarometerShowIf | null {
    if (!cond) return null;
    const info = parentInfo.get(cond.parentUid);
    if (!info) return null;
    if (info.kind !== "choice" && info.kind !== "multi") return null;
    if (info.optionsLen === 0) return null;
    return { question: info.index, options: cond.options };
  }

  for (const item of items) {
    if (item.type === "question") {
      if (!item.text.trim()) continue;
      const outIndex = out.length;
      const options = item.kind === "choice" || item.kind === "multi"
        ? item.options.map(o => o.trim()).filter(Boolean) : [];
      out.push({
        text: item.text.trim(),
        kind: item.kind,
        options,
        chart: item.chart || null,
        scale_min: item.scale_min,
        scale_max: item.scale_max,
        scale_min_label: item.scale_min_label || undefined,
        scale_max_label: item.scale_max_label || undefined,
        scale_style: item.scale_style,
        max_choices: item.kind === "multi" ? item.max_choices : null,
        num_min: item.kind === "number" ? item.num_min : null,
        num_max: item.kind === "number" ? item.num_max : null,
        unit: item.kind === "number" && item.unit ? item.unit : null,
        same_slide: outIndex > 0 && item.same_slide,
        block: null,
        intro: null,
        show_if: resolveShowIf(item.show_if),
      });
      parentInfo.set(item.uid, { index: outIndex, kind: item.kind, optionsLen: options.length });
    } else {
      const statements = item.statements.map(s => s.trim()).filter(Boolean);
      if (statements.length === 0) continue;
      const showIf = resolveShowIf(item.show_if);
      statements.forEach((text, j) => {
        const outIndex = out.length;
        out.push({
          text,
          kind: "scale",
          options: [],
          chart: item.chart || null,
          scale_min: item.scale_min,
          scale_max: item.scale_max,
          scale_min_label: item.scale_min_label || undefined,
          scale_max_label: item.scale_max_label || undefined,
          scale_style: item.scale_style,
          max_choices: null,
          num_min: null,
          num_max: null,
          unit: null,
          same_slide: j === 0 ? (outIndex > 0 && item.same_slide) : true,
          block: item.uid,
          intro: j === 0 ? (item.intro.trim() || null) : null,
          show_if: showIf,
        });
      });
    }
  }
  return out;
}

export function questionsToDrafts(qs: BarometerQuestionOut[]): DraftItem[] {
  const uidForIndex: string[] = [];
  const items: DraftItem[] = [];
  let i = 0;
  while (i < qs.length) {
    const q = qs[i];
    if (q.block) {
      const blockId = q.block;
      const members: BarometerQuestionOut[] = [];
      while (i < qs.length && qs[i].block === blockId) {
        uidForIndex[i] = blockId;
        members.push(qs[i]);
        i++;
      }
      const first = members[0];
      items.push({
        uid: blockId, type: "block",
        intro: first.intro ?? "",
        statements: members.map(m => m.text),
        chart: first.chart ?? "",
        scale_min: first.scale_min, scale_max: first.scale_max,
        scale_min_label: first.scale_min_label ?? "", scale_max_label: first.scale_max_label ?? "",
        scale_style: first.scale_style,
        same_slide: first.same_slide,
        show_if: null,
      });
    } else {
      const uid = "q" + q.id;
      uidForIndex[i] = uid;
      items.push({
        uid, type: "question", text: q.text, kind: q.kind,
        options: [...q.options], chart: q.chart ?? "",
        scale_min: q.scale_min, scale_max: q.scale_max,
        scale_min_label: q.scale_min_label ?? "", scale_max_label: q.scale_max_label ?? "",
        scale_style: q.scale_style,
        max_choices: q.max_choices, num_min: q.num_min, num_max: q.num_max, unit: q.unit ?? "",
        same_slide: q.same_slide,
        show_if: null,
      });
      i++;
    }
  }
  const itemByUid = new Map(items.map(it => [it.uid, it]));
  const firstSeen = new Set<string>();
  for (let idx = 0; idx < qs.length; idx++) {
    const q = qs[idx];
    const uid = uidForIndex[idx];
    if (firstSeen.has(uid)) continue;
    firstSeen.add(uid);
    if (q.show_if) {
      const parentUid = uidForIndex[q.show_if.question];
      const item = itemByUid.get(uid);
      if (item) item.show_if = parentUid ? { parentUid, options: q.show_if.options } : null;
    }
  }
  return items;
}

// ── Gastfenster einer Umfrage ───────────────────────────────────────────────
// `guest_minutes`: null = Schulvorgabe, 0 = bis geschlossen, sonst GAST_MIN … GAST_MAX.

export const GAST_MIN = 60;
export const GAST_MAX = 30 * 24 * 60;
export type GastEinheit = "min" | "h" | "d";
const FAKTOR: Record<GastEinheit, number> = { min: 1, h: 60, d: 24 * 60 };

/** Zahl + Einheit → Minuten; NaN, wenn nichts Brauchbares eingetragen ist. */
export function gastMinuten(zahl: number, einheit: GastEinheit): number {
  return Number.isFinite(zahl) && zahl > 0 ? Math.round(zahl * FAKTOR[einheit]) : NaN;
}

/** Minuten → größte glatte Einheit, für die Anzeige im Formular. */
export function gastAufteilen(minuten: number): { zahl: number; einheit: GastEinheit } {
  if (minuten % FAKTOR.d === 0) return { zahl: minuten / FAKTOR.d, einheit: "d" };
  if (minuten % FAKTOR.h === 0) return { zahl: minuten / FAKTOR.h, einheit: "h" };
  return { zahl: minuten, einheit: "min" };
}

export function gastMinutenGueltig(m: number | null): boolean {
  return m === null || m === 0 || (Number.isFinite(m) && m >= GAST_MIN && m <= GAST_MAX);
}

// ── Zahlenbereich ───────────────────────────────────────────────────────────
// Der Server verwirft Zahlen außerhalb von num_min … num_max kommentarlos —
// die Seite muss das also vor dem Absenden abfangen.

export function zahlAusserhalb(q: { kind: string; num_min: number | null; num_max: number | null }, v: unknown): boolean {
  if (q.kind !== "number" || typeof v !== "number") return false;
  if (!Number.isFinite(v)) return true;
  return (q.num_min !== null && v < q.num_min) || (q.num_max !== null && v > q.num_max);
}

export function zahlBereich(q: { num_min: number | null; num_max: number | null }): string | null {
  const { num_min: lo, num_max: hi } = q;
  if (lo !== null && hi !== null) return `zwischen ${lo} und ${hi}`;
  if (lo !== null) return `mindestens ${lo}`;
  if (hi !== null) return `höchstens ${hi}`;
  return null;
}
