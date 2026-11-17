/**
 * Runden für die fünf Spiele. Jede Runde ist reine Logik; die Oberfläche
 * zählt Zeit und Punkte.
 */
import { kenngroessen, rangliste } from "./kenngroessen";
import { ergaenze, voll, FELDER, type FeldName, type Tafel } from "./vierfelder";
import { bruch, eins, ganz, mische, wert, zahl, type Bruch, type Zufall } from "./zahlen";
import type { Experiment } from "./zufall";

export type SpielId = "blitz" | "diagramm" | "schaetzen" | "baum" | "vierfelder";

export const SPIELE: { id: SpielId; icon: string; name: string; text: string; stufe: string }[] = [
  { id: "blitz", icon: "⚡", name: "Kenngrößen-Blitz", text: "60 Sekunden: Median, Mittel, Spannweite … im Kopf.", stufe: "ab Kl. 5" },
  { id: "diagramm", icon: "🖼️", name: "Welches Diagramm passt?", text: "Zu jeder Situation das beste Diagramm – schnell.", stufe: "ab Kl. 5" },
  { id: "schaetzen", icon: "🎯", name: "Schätzen gegen die Simulation", text: "Schätz die Wahrscheinlichkeit, dann würfelt der Computer 1000-mal.", stufe: "ab Kl. 7" },
  { id: "baum", icon: "🌳", name: "Baum-Puzzle", text: "Fehlende Äste ergänzen und Pfade ausrechnen.", stufe: "ab Kl. 8" },
  { id: "vierfelder", icon: "▦", name: "Vierfelder-Sprint", text: "Tafeln ausfüllen gegen die Uhr.", stufe: "ab Kl. 9" },
];

// ── Kenngrößen-Blitz ─────────────────────────────────────────────────────

export interface BlitzRunde { werte: number[]; frage: string; optionen: string[]; richtig: number; erklaerung: string }

const KG = ["Minimum", "Maximum", "Spannweite", "Median", "Modalwert", "Mittelwert"] as const;

export function blitzRunde(r: Zufall): BlitzRunde {
  for (;;) {
    const n = ganz(r, 5, 7);
    // Mittelwert ganzzahlig, damit es im Kopf geht
    const werte = Array.from({ length: n }, () => ganz(r, 1, 12));
    const k = kenngroessen(werte);
    if (!Number.isInteger(k.mittel) || k.modal.length !== 1) continue;
    const art = eins(r, KG);
    const zu = { Minimum: k.min, Maximum: k.max, Spannweite: k.spannweite, Median: k.median, Modalwert: k.modal[0], Mittelwert: k.mittel }[art];
    const kandidaten = [...new Set([k.min, k.max, k.spannweite, k.median, k.modal[0], k.mittel, zu + 1, zu - 1, ...werte].filter(x => x !== zu && x >= 0))];
    const falsch = mische(r, kandidaten).slice(0, 3);
    if (falsch.length < 3) continue;
    const opt = mische(r, [zu, ...falsch]);
    return {
      werte, frage: `${art}?`, optionen: opt.map(x => zahl(x)), richtig: opt.indexOf(zu),
      erklaerung: `Rangliste ${rangliste(werte).join(", ")} → ${art} = ${zahl(zu)}`,
    };
  }
}

// ── Welches Diagramm passt? ──────────────────────────────────────────────

export type DiaTyp = "saeulen" | "balken" | "kreis" | "linie" | "piktogramm" | "boxplot";
export const DIA_NAME: Record<DiaTyp, string> = {
  saeulen: "Säulendiagramm", balken: "Balkendiagramm", kreis: "Kreisdiagramm", linie: "Liniendiagramm", piktogramm: "Piktogramm", boxplot: "Boxplot",
};

const SITUATIONEN: { t: string; a: DiaTyp; warum: string }[] = [
  { t: "Körpergröße eines Kindes von 1 bis 12 Jahren", a: "linie", warum: "Entwicklung über die Zeit" },
  { t: "Wasserstand eines Flusses über eine Woche", a: "linie", warum: "Entwicklung über die Zeit" },
  { t: "Wie sich das Taschengeld der Klasse auf Sparen, Essen, Spiele aufteilt", a: "kreis", warum: "Teile eines Ganzen" },
  { t: "Anteile der Parteien an allen Stimmen", a: "kreis", warum: "Teile eines Ganzen" },
  { t: "Anzahl der Tore jeder Mannschaft im Turnier", a: "saeulen", warum: "Werte vergleichen" },
  { t: "Verkaufte Pausenbrötchen von Montag bis Freitag im Vergleich", a: "saeulen", warum: "Werte vergleichen" },
  { t: "Die längsten Flüsse Europas mit ihren Namen", a: "balken", warum: "lange Beschriftungen, Vergleich" },
  { t: "Lieblingsbücher mit langen Titeln und ihre Stimmen", a: "balken", warum: "lange Beschriftungen, Vergleich" },
  { t: "Wie viele Äpfel jedes Kind gesammelt hat – fürs Klassenplakat in Kl. 5", a: "piktogramm", warum: "anschaulich mit Bildchen, kleine Anzahlen" },
  { t: "Ergebnisse zweier Klassen im Test vergleichen: Streuung, Median, Quartile", a: "boxplot", warum: "Streuung und Lage auf einen Blick" },
  { t: "Sprungweiten der Mädchen und Jungen beim Sportfest vergleichen (Median und Streuung)", a: "boxplot", warum: "Streuung und Lage auf einen Blick" },
];

export interface DiaRunde { t: string; optionen: DiaTyp[]; richtig: number; warum: string }

export function diagrammRunde(r: Zufall, ohneBoxplot = false): DiaRunde {
  const s = eins(r, SITUATIONEN.filter(x => !(ohneBoxplot && x.a === "boxplot")));
  const andere = mische(r, (Object.keys(DIA_NAME) as DiaTyp[]).filter(d => d !== s.a && !(ohneBoxplot && d === "boxplot"))).slice(0, 3);
  const optionen = mische(r, [s.a, ...andere]);
  return { t: s.t, optionen, richtig: optionen.indexOf(s.a), warum: s.warum };
}

// ── Schätzen gegen die Simulation ────────────────────────────────────────

export interface SchaetzRunde { text: string; experiment: Experiment; stufen: number; treffer: (pfad: string[]) => boolean; p: Bruch }

export function schaetzRunde(r: Zufall): SchaetzRunde {
  const art = ganz(r, 0, 3);
  if (art === 0) {
    const k = ganz(r, 2, 5);
    return { text: `Zwei Würfel: Augensumme mindestens ${12 - k}`, experiment: { art: "wuerfel", seiten: 6 }, stufen: 2, treffer: p => Number(p[0]) + Number(p[1]) >= 12 - k, p: bruch([1, 3, 6, 10, 15, 21][k], 36) };
  }
  if (art === 1) {
    const rot = ganz(r, 1, 6), blau = ganz(r, 1, 6);
    return { text: `Urne mit ${rot} roten und ${blau} blauen Kugeln, zweimal ohne Zurücklegen: beide rot`, experiment: { art: "urne", kugeln: { rot, blau }, zuruecklegen: false }, stufen: 2, treffer: p => p.every(x => x === "rot"), p: bruch(rot * (rot - 1), (rot + blau) * (rot + blau - 1)) };
  }
  if (art === 2) {
    return { text: "Drei Münzwürfe: mindestens zweimal Kopf", experiment: { art: "muenze" }, stufen: 3, treffer: p => p.filter(x => x === "K").length >= 2, p: bruch(1, 2) };
  }
  const n = ganz(r, 2, 4);
  return { text: `Ein Würfel, ${n}-mal geworfen: mindestens eine Sechs`, experiment: { art: "wuerfel", seiten: 6 }, stufen: n, treffer: p => p.includes("6"), p: bruch(6 ** n - 5 ** n, 6 ** n) };
}

/** Punkte fürs Schätzen: 100 bei Volltreffer, 0 ab 25 Prozentpunkten daneben. */
export const schaetzPunkte = (schaetzung: number, p: number) => Math.max(0, Math.round(100 - Math.abs(schaetzung - p) * 400));

// ── Baum-Puzzle ──────────────────────────────────────────────────────────

export interface BaumRunde {
  /** P(A), P_A(B), P_Ā(B) als Brüche mit Nenner 10 oder 20. */
  p1: Bruch; p2: Bruch; p2n: Bruch;
  /** Welche Äste fehlen: Kennung je Ast. */
  luecken: AstId[];
  /** Zusätzlich gefragt: ein Pfad. */
  pfad: [boolean, boolean];
}
export type AstId = "A" | "nA" | "B|A" | "nB|A" | "B|nA" | "nB|nA";

export function astWert(rd: BaumRunde, a: AstId): number {
  const v = { A: wert(rd.p1), "B|A": wert(rd.p2), "B|nA": wert(rd.p2n) };
  if (a === "nA") return 1 - v.A;
  if (a === "nB|A") return 1 - v["B|A"];
  if (a === "nB|nA") return 1 - v["B|nA"];
  return v[a];
}

export function baumRunde(r: Zufall): BaumRunde {
  const n = eins(r, [10, 20]);
  const zehntel = () => bruch(ganz(r, 1, n - 1), n);
  const paare: [AstId, AstId][] = [["A", "nA"], ["B|A", "nB|A"], ["B|nA", "nB|nA"]];
  // aus jedem Paar fehlt höchstens ein Ast – sonst ist er nicht bestimmbar
  const luecken = paare.filter(() => r() < 0.75).map(p => eins(r, p));
  return { p1: zehntel(), p2: zehntel(), p2n: zehntel(), luecken: luecken.length ? luecken : ["nA"], pfad: [r() < 0.5, r() < 0.5] };
}

export const pfadWert = (rd: BaumRunde) =>
  astWert(rd, rd.pfad[0] ? "A" : "nA") * astWert(rd, rd.pfad[0] ? (rd.pfad[1] ? "B|A" : "nB|A") : (rd.pfad[1] ? "B|nA" : "nB|nA"));

// ── Vierfelder-Sprint ────────────────────────────────────────────────────

export interface TafelRunde { tafel: Tafel; bekannt: FeldName[] }

export function tafelRunde(r: Zufall, prozent = false): TafelRunde {
  for (;;) {
    const t: Tafel = prozent
      ? (() => { const a = ganz(r, 1, 7), b = ganz(r, 1, 7), c = ganz(r, 1, 7); return { ab: a * 5, aNb: b * 5, nAb: c * 5, nAnB: 100 - 5 * (a + b + c) }; })()
      : { ab: ganz(r, 3, 30), aNb: ganz(r, 3, 30), nAb: ganz(r, 3, 30), nAnB: ganz(r, 3, 30) };
    if (t.nAnB <= 0) continue;
    const v = voll(t);
    const bekannt = mische(r, FELDER).slice(0, 4) as FeldName[];
    const w = ergaenze(Object.fromEntries(bekannt.map(k => [k, v[k]])));
    if (FELDER.every(k => w[k] !== undefined)) return { tafel: t, bekannt };
  }
}
