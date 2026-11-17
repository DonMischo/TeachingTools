/**
 * Übungsaufgaben je Lektion, mit gewürfelten Zahlen, Tipps und Lösungsweg.
 * Stufe 1–3: 1 = Grundlagen (H), 2 = Standard (R/G), 3 = Transfer.
 * Antworten auf Wahrscheinlichkeiten dürfen als Bruch, Dezimalzahl oder
 * Prozent kommen (Feld mit `anteil`).
 */
import { leseZahl, type Feld } from "@/lib/quadratisch";
import { kenngroessen, haeufigkeiten, rangliste, type Zeile } from "./kenngroessen";
import { baum, pEreignis, type Experiment } from "./zufall";
import { voll, type Tafel, type FeldName } from "./vierfelder";
import { anzahl, faktoren, erwartungswert, summenTerm, type Wert } from "./kombinatorik";
import { bruch, bt, eins, ganz, leseAnteil, mische, prozent, wert, zahl, type Bruch, type Zufall } from "./zahlen";
import type { LektionId } from "./lektionen";

export type SFeld = Feld & { anteil?: boolean };
export type Stufe = 1 | 2 | 3;

export type Bild =
  | { art: "urliste"; werte: string[] }
  | { art: "zahlen"; werte: number[] }
  | { art: "saeulen"; zeilen: Zeile[]; titel: string }
  | { art: "urne"; kugeln: Record<string, number> }
  | { art: "tafel"; tafel: Tafel; zeigen: FeldName[]; a: string; b: string }
  | { art: "rad"; werte: { x: number; anteil: number }[] };

export interface Aufgabe {
  lektion: LektionId;
  frage: string;
  bild?: Bild;
  felder: SFeld[];
  tipps: string[];
  weg: string[];
}

export function stimmt(f: SFeld, eingabe: string | undefined): boolean {
  const e = (eingabe ?? "").trim();
  if (f.art === "wahl") return e !== "" && Number(e) === f.richtig;
  if (f.wert === null) return e === "" || /^[-–—]$/.test(e);
  const x = f.anteil ? leseAnteil(e) : leseZahl(e);
  return x !== null && Math.abs(x - f.wert) <= f.tol;
}

export const loesungText = (f: SFeld) =>
  f.art === "wahl" ? `${f.label}: ${f.optionen[f.richtig]}`
    : `${f.label} = ${f.wert === null ? "–" : f.anteil ? anteilText(f.wert) : zahl(f.wert)}`;

/** Wahrscheinlichkeit als Bruch, wenn sie sich mit kleinem Nenner schreiben lässt, sonst als Prozent. */
export function anteilText(x: number): string {
  for (let n = 1; n <= 100; n++) {
    const z = Math.round(x * n);
    if (Math.abs(z / n - x) < 1e-9) return `${bt(bruch(z, n))} ≈ ${prozent(x)}`;
  }
  return prozent(x);
}

const zf = (k: string, label: string, w: number, tol = 1e-6): SFeld => ({ key: k, label, art: "zahl", wert: w, tol });
const af = (k: string, label: string, b: Bruch | number): SFeld => ({ key: k, label, art: "zahl", wert: typeof b === "number" ? b : wert(b), tol: 0.0005, anteil: true });
const wf = (k: string, label: string, optionen: string[], richtig: number): SFeld => ({ key: k, label, art: "wahl", optionen, richtig });

/** Mischt die Optionen und merkt sich, wo die richtige landet. */
function wahlGemischt(r: Zufall, k: string, label: string, richtig: string, falsch: string[]): SFeld {
  const o = mische(r, [richtig, ...falsch]);
  return wf(k, label, o, o.indexOf(richtig));
}

// ── 5/6 ──────────────────────────────────────────────────────────────────

const FARBWAHL = ["blau", "rot", "grün", "gelb", "lila"];
const SPORT = ["Fußball", "Schwimmen", "Turnen", "Radfahren", "Tanzen"];

function erfassen(r: Zufall, s: Stufe): Aufgabe {
  const kat = eins(r, [FARBWAHL, SPORT]).slice(0, s === 1 ? 3 : 4);
  const n = s === 1 ? ganz(r, 10, 15) : s === 2 ? 20 : 25;
  const urliste = Array.from({ length: n }, () => kat[Math.min(kat.length - 1, Math.floor(r() ** 1.3 * kat.length))]);
  const tab = haeufigkeiten(urliste, kat);
  const ziel = eins(r, tab.filter(t => t.anzahl > 0));
  const rel = ziel.anzahl / n;
  const felder: SFeld[] = [zf("abs", `absolute Häufigkeit von »${ziel.wert}«`, ziel.anzahl)];
  if (s >= 2) felder.push(af("rel", `relative Häufigkeit von »${ziel.wert}«`, bruch(ziel.anzahl, n)));
  if (s === 3) felder.push(zf("proz", `»${ziel.wert}« in Prozent`, rel * 100, 0.05));
  return {
    lektion: "erfassen",
    frage: `${n} Kinder wurden befragt. Hier ist die Urliste. Zähle mit einer Strichliste.`,
    bild: { art: "urliste", werte: urliste },
    felder,
    tipps: ["Mach für jede Antwort einen Strich, jeder fünfte Strich geht quer.", "Relative Häufigkeit = absolute Häufigkeit : Anzahl aller Antworten."],
    weg: [
      ...tab.map(t => `${t.wert}: ${t.anzahl}`),
      ...(s >= 2 ? [`relative Häufigkeit = ${ziel.anzahl} : ${n} = ${bt(bruch(ziel.anzahl, n))} ≈ ${zahl(rel, 3)}`] : []),
      ...(s === 3 ? [`${zahl(rel, 4)} · 100 % = ${zahl(rel * 100, 1)} %`] : []),
    ],
  };
}

function diagramme(r: Zufall, s: Stufe): Aufgabe {
  const art = s === 1 ? "lesen" : eins(r, ["lesen", "passt", "differenz"] as const);
  if (art === "passt") {
    const faelle = [
      { t: "Wie sich die Temperatur über einen Tag verändert", a: "Liniendiagramm", f: ["Kreisdiagramm", "Piktogramm"] },
      { t: "Welcher Anteil der Klasse mit welchem Verkehrsmittel kommt (zusammen 100 %)", a: "Kreisdiagramm", f: ["Liniendiagramm", "Boxplot"] },
      { t: "Wie viele Bücher jedes Kind gelesen hat, im Vergleich", a: "Säulendiagramm", f: ["Liniendiagramm", "Kreisdiagramm"] },
      { t: "Lange Namen von Ländern mit ihrer Einwohnerzahl", a: "Balkendiagramm", f: ["Liniendiagramm", "Kreisdiagramm"] },
    ];
    const f = eins(r, faelle);
    return {
      lektion: "diagramme", frage: `Welches Diagramm passt am besten? ${f.t}.`,
      felder: [wahlGemischt(r, "d", "Diagramm", f.a, f.f)],
      tipps: ["Verlauf über die Zeit → Linie. Anteile an einem Ganzen → Kreis. Vergleichen → Säulen oder Balken (lange Beschriftungen: Balken)."],
      weg: [`${f.a} – ${f.a === "Liniendiagramm" ? "es geht um eine Entwicklung über die Zeit" : f.a === "Kreisdiagramm" ? "alle Teile ergeben zusammen das Ganze" : f.a === "Balkendiagramm" ? "lange Beschriftungen passen links neben waagerechte Balken" : "Säulen nebeneinander lassen sich gut vergleichen"}.`],
    };
  }
  const kat = ["Mo", "Di", "Mi", "Do", "Fr"];
  const zeilen = kat.map(k => ({ wert: k, anzahl: ganz(r, 2, s === 1 ? 10 : 24) }));
  const a = eins(r, zeilen);
  let b = eins(r, zeilen);
  while (b === a) b = eins(r, zeilen);
  if (art === "lesen") return {
    lektion: "diagramme", frage: `Das Säulendiagramm zeigt, wie viele Kinder an jedem Tag die Schulbibliothek besucht haben. Wie viele waren es am ${a.wert}?`,
    bild: { art: "saeulen", zeilen, titel: "Besuche in der Bibliothek" },
    felder: [zf("w", `Besuche am ${a.wert}`, a.anzahl)],
    tipps: ["Folge der Säulenoberkante waagerecht bis zur Achse."], weg: [`Die Säule »${a.wert}« reicht bis ${a.anzahl}.`],
  };
  const ges = zeilen.reduce((x, z) => x + z.anzahl, 0);
  return {
    lektion: "diagramme", frage: `Wie viele Besuche waren es am ${a.wert} mehr oder weniger als am ${b.wert}? Und wie viele in der ganzen Woche?`,
    bild: { art: "saeulen", zeilen, titel: "Besuche in der Bibliothek" },
    felder: [zf("d", `Unterschied ${a.wert} − ${b.wert}`, a.anzahl - b.anzahl), zf("g", "Summe der Woche", ges)],
    tipps: ["Ablesen, dann subtrahieren. Weniger ergibt eine negative Zahl.", "Für die Summe alle fünf Säulen addieren."],
    weg: [`${a.anzahl} − ${b.anzahl} = ${a.anzahl - b.anzahl}`, `${zeilen.map(z => z.anzahl).join(" + ")} = ${ges}`],
  };
}

function kenngroessenAufgabe(r: Zufall, s: Stufe): Aufgabe {
  const n = s === 1 ? ganz(r, 5, 7) : ganz(r, 8, 11);
  const werte = Array.from({ length: n }, () => ganz(r, s === 3 ? 20 : 1, s === 3 ? 60 : 12));
  const k = kenngroessen(werte);
  const felder: SFeld[] = [
    zf("min", "Minimum", k.min), zf("max", "Maximum", k.max), zf("sw", "Spannweite", k.spannweite),
    zf("med", "Median", k.median), zf("mit", "arithmetisches Mittel (auf eine Stelle)", Math.round(k.mittel * 10) / 10, 0.051),
  ];
  if (s >= 2) felder.push(zf("q1", "unteres Quartil", k.q1), zf("q3", "oberes Quartil", k.q3));
  const r_ = rangliste(werte);
  return {
    lektion: "kenngroessen",
    frage: `Punkte in einem Test (${s === 1 ? "H" : "R/G"}): bestimme die Kenngrößen${s >= 2 ? " und die Quartile" : ""}.`,
    bild: { art: "zahlen", werte },
    felder,
    tipps: [
      "Erst eine Rangliste schreiben (der Größe nach).",
      `Median: der mittlere Wert der Rangliste${n % 2 ? "" : " – bei gerader Anzahl das Mittel der beiden mittleren"}.`,
      ...(s >= 2 ? ["Quartile: Median der unteren und der oberen Hälfte (der Median selbst gehört bei ungerader Anzahl zu keiner Hälfte)."] : []),
    ],
    weg: [
      `Rangliste: ${r_.join("; ")}`,
      `Minimum ${k.min}, Maximum ${k.max}, Spannweite ${k.max} − ${k.min} = ${k.spannweite}`,
      `Median: ${zahl(k.median)}`,
      `Mittel: ${r_.reduce((a, b) => a + b, 0)} : ${n} ≈ ${zahl(k.mittel, 2)}`,
      ...(s >= 2 ? [`unteres Quartil ${zahl(k.q1)}, oberes Quartil ${zahl(k.q3)}`] : []),
    ],
  };
}

function experimente(r: Zufall, s: Stufe): Aufgabe {
  const faelle = [
    { t: "Eine Münze wird zweimal geworfen.", n: 4, w: "KK, KZ, ZK, ZZ" },
    { t: "Eine Münze wird geworfen, dann ein Würfel.", n: 12, w: "2 Äste für die Münze, an jedem 6 Äste für den Würfel: 2 · 6 = 12" },
    { t: "Ein Glücksrad mit den Feldern rot, blau, gelb wird zweimal gedreht.", n: 9, w: "3 · 3 = 9" },
    { t: "Aus einer Urne mit einer roten, einer blauen und einer grünen Kugel werden zwei Kugeln ohne Zurücklegen gezogen.", n: 6, w: "3 Möglichkeiten für die erste, dann nur noch 2: 3 · 2 = 6" },
    { t: "Ein Würfel wird zweimal geworfen.", n: 36, w: "6 · 6 = 36" },
  ];
  const f = eins(r, faelle.slice(0, s === 1 ? 3 : 5));
  return {
    lektion: "experimente", frage: `${f.t} Zeichne ein Baumdiagramm (ohne Wahrscheinlichkeiten). Wie viele Ergebnisse gibt es?`,
    felder: [zf("n", "Anzahl der Ergebnisse", f.n), wf("st", "Wie viele Stufen hat das Experiment?", ["einstufig", "zweistufig"], 1)],
    tipps: ["Jede Stufe ist eine Ebene im Baum.", "Jeder Pfad vom Start bis ganz rechts ist ein Ergebnis."],
    weg: [f.w],
  };
}

// ── 7/8 ──────────────────────────────────────────────────────────────────

function labor(r: Zufall, s: Stufe): Aufgabe {
  const n = eins(r, [50, 100, 200, 500, 1000]);
  const p = eins(r, [1 / 6, 1 / 2, 1 / 4, 1 / 3]);
  const t = Math.round(n * p + (r() - 0.5) * Math.sqrt(n) * 1.2);
  const ding = p === 1 / 6 ? "eine Sechs" : p === 1 / 2 ? "Kopf" : p === 1 / 4 ? "rot (Glücksrad mit 4 gleichen Feldern, 1 rot)" : "eine 1 oder 2";
  const felder: SFeld[] = [af("h", "relative Häufigkeit", t / n)];
  if (s >= 2) felder.push(wahlGemischt(r, "w", "Welche Wahrscheinlichkeit wird geschätzt?", bt(bruch(Math.round(p * 12), 12)), ["1/5", "2/3", "1/8"].filter(x => x !== bt(bruch(Math.round(p * 12), 12))).slice(0, 2)));
  return {
    lektion: "labor", frage: `Bei ${n} Versuchen kam ${t}-mal ${ding}.`,
    felder,
    tipps: ["relative Häufigkeit = Treffer : Versuche", "Bei vielen Versuchen liegt die relative Häufigkeit nahe an der Wahrscheinlichkeit."],
    weg: [`${t} : ${n} = ${zahl(t / n, 3)} ≈ ${prozent(t / n)}`, `Das liegt nahe bei ${bt(bruch(Math.round(p * 12), 12))} ≈ ${prozent(p)}.`],
  };
}

function laplace(r: Zufall, s: Stufe): Aufgabe {
  if (s === 1 || r() < 0.5) {
    const ev = eins(r, [
      { t: "eine gerade Zahl", m: [2, 4, 6] }, { t: "eine Zahl größer als 4", m: [5, 6] }, { t: "eine Primzahl", m: [2, 3, 5] },
      { t: "höchstens eine 2", m: [1, 2] }, { t: "eine 7", m: [] }, { t: "eine Zahl kleiner als 7", m: [1, 2, 3, 4, 5, 6] },
    ]);
    const p = bruch(ev.m.length, 6);
    const art = ev.m.length === 0 ? 1 : ev.m.length === 6 ? 0 : 2;
    return {
      lektion: "laplace", frage: `Ein Würfel wird geworfen. Ereignis E: ${ev.t}.`,
      felder: [
        af("p", "P(E)", p),
        ...(s >= 2 ? [af("g", "P(Ē) – Gegenereignis", bruch(6 - ev.m.length, 6))] : []),
        wf("a", "E ist …", ["sicher", "unmöglich", "weder noch"], art),
      ],
      tipps: ["Laplace: P(E) = Anzahl der günstigen Ergebnisse : Anzahl aller Ergebnisse.", "Gegenereignis: P(Ē) = 1 − P(E)."],
      weg: [`E = {${ev.m.join("; ")}}`, `P(E) = ${ev.m.length}/6 = ${bt(p)}`, ...(s >= 2 ? [`P(Ē) = 1 − ${bt(p)} = ${bt(bruch(6 - ev.m.length, 6))}`] : [])],
    };
  }
  const rot = ganz(r, 1, 6), blau = ganz(r, 1, 6), gruen = ganz(r, 0, 4);
  const g = rot + blau + gruen;
  return {
    lektion: "laplace", frage: `In einer Urne liegen ${rot} rote, ${blau} blaue und ${gruen} grüne Kugeln. Eine Kugel wird gezogen.`,
    bild: { art: "urne", kugeln: { rot, blau, gruen } },
    felder: [af("r", "P(rot)", bruch(rot, g)), af("nb", "P(nicht blau)", bruch(g - blau, g))],
    tipps: ["Alle Kugeln sind gleich wahrscheinlich – zähle die günstigen.", "»nicht blau« ist das Gegenereignis zu »blau«."],
    weg: [`P(rot) = ${rot}/${g} = ${bt(bruch(rot, g))}`, `P(nicht blau) = 1 − ${blau}/${g} = ${bt(bruch(g - blau, g))}`],
  };
}

function baumAufgabe(r: Zufall, s: Stufe): Aufgabe {
  const rot = ganz(r, 2, 5), blau = ganz(r, 2, 5);
  const zl = s === 1 ? true : r() < 0.5;
  const e: Experiment = { art: "urne", kugeln: { rot, blau }, zuruecklegen: zl };
  const stufen = s === 3 ? 3 : 2;
  const b = baum(e, stufen);
  const allesRot = pEreignis(b, p => p.every(x => x === "rot"));
  const genauEin = pEreignis(b, p => p.filter(x => x === "rot").length === 1);
  const g = rot + blau;
  const z1 = `${rot}/${g}`, z2 = zl ? `${rot}/${g}` : `${rot - 1}/${g - 1}`;
  return {
    lektion: "baum",
    frage: `Urne mit ${rot} roten und ${blau} blauen Kugeln. Es wird ${stufen}-mal ${zl ? "mit" : "ohne"} Zurücklegen gezogen.`,
    bild: { art: "urne", kugeln: { rot, blau } },
    felder: [af("rr", stufen === 2 ? "P(beide rot)" : "P(alle rot)", allesRot), af("e", "P(genau eine rote)", genauEin)],
    tipps: [
      "1. Pfadregel: Wahrscheinlichkeiten entlang eines Pfades multiplizieren.",
      "2. Pfadregel: Wahrscheinlichkeiten der passenden Pfade addieren.",
      ...(zl ? [] : ["Ohne Zurücklegen: In der zweiten Stufe fehlt eine Kugel – Zähler und Nenner ändern sich."]),
    ],
    weg: [
      stufen === 2 ? `P(rr) = ${z1} · ${z2} = ${bt(allesRot)}` : `P(rrr) = ${bt(allesRot)} (drei Faktoren entlang des Pfades)`,
      `genau eine rote: ${stufen === 2 ? "Pfade rb und br" : "Pfade rbb, brb, bbr"} addieren = ${bt(genauEin)}`,
    ],
  };
}

function venn(r: Zufall, s: Stufe): Aufgabe {
  const A = eins(r, [{ t: "gerade Zahl", m: [2, 4, 6] }, { t: "Primzahl", m: [2, 3, 5] }, { t: "ungerade Zahl", m: [1, 3, 5] }]);
  const B = eins(r, [{ t: "größer als 3", m: [4, 5, 6] }, { t: "höchstens 2", m: [1, 2] }, { t: "durch 3 teilbar", m: [3, 6] }]);
  const und = A.m.filter(x => B.m.includes(x));
  const oder = [...new Set([...A.m, ...B.m])].sort();
  return {
    lektion: "venn", frage: `Würfelwurf. A: ${A.t}, B: ${B.t}.`,
    felder: [
      af("u", "P(A ∩ B)", bruch(und.length, 6)), af("o", "P(A ∪ B)", bruch(oder.length, 6)),
      ...(s >= 2 ? [af("k", "P(Ā)", bruch(6 - A.m.length, 6))] : []),
    ],
    tipps: ["A ∩ B: beide zugleich (»und«). A ∪ B: mindestens eins von beiden (»oder«).", "Schreib A und B als Mengen und vergleiche."],
    weg: [`A = {${A.m.join("; ")}}, B = {${B.m.join("; ")}}`, `A ∩ B = {${und.join("; ")}} → ${und.length}/6`, `A ∪ B = {${oder.join("; ")}} → ${oder.length}/6`],
  };
}

// ── 9/10 ─────────────────────────────────────────────────────────────────

const SZENEN = [
  { a: "Mädchen", b: "fährt mit dem Rad", wer: "Kinder einer Jahrgangsstufe" },
  { a: "geimpft", b: "erkrankt", wer: "Personen in einer Studie" },
  { a: "hat ein Haustier", b: "wohnt im Dorf", wer: "Befragte" },
];

function vierfelderAufgabe(r: Zufall, s: Stufe): Aufgabe {
  const sz = eins(r, SZENEN);
  const t: Tafel = { ab: ganz(r, 5, 40), aNb: ganz(r, 5, 40), nAb: ganz(r, 5, 40), nAnB: ganz(r, 5, 40) };
  const v = voll(t);
  const zeigen: FeldName[] = s === 1 ? ["ab", "aNb", "nAb", "nAnB"] : ["ab", "a", "nAb", "ges"];
  const felder: SFeld[] = s === 1
    ? [zf("a", "Summe A", v.a), zf("b", "Summe B", v.b), zf("g", "gesamt", v.ges)]
    : [zf("aNb", "A ∩ B̄", v.aNb), zf("nAnB", "Ā ∩ B̄", v.nAnB), af("pab", "P(A ∩ B)", bruch(t.ab, v.ges))];
  if (s === 3) felder.push(af("bed", "P_A(B) = P(B | A)", bruch(t.ab, v.a)));
  return {
    lektion: "vierfelder", frage: `${v.ges} ${sz.wer}. A: ${sz.a}, B: ${sz.b}. Fülle die Vierfeldertafel.`,
    bild: { art: "tafel", tafel: t, zeigen, a: sz.a, b: sz.b },
    felder,
    tipps: ["Jede Zeile und jede Spalte ergibt ihre Summe am Rand.", "P(A ∩ B) = Feld A∩B : gesamt.", ...(s === 3 ? ["Bedingt: Nur die Zeile A zählt – P_A(B) = |A ∩ B| : |A|."] : [])],
    weg: [
      `A ∩ B̄ = ${v.a} − ${t.ab} = ${t.aNb}`, `Ā ∩ B̄ = ${v.nA} − ${t.nAb} = ${t.nAnB}`,
      `P(A ∩ B) = ${t.ab}/${v.ges} ≈ ${prozent(t.ab / v.ges)}`,
      ...(s === 3 ? [`P_A(B) = ${t.ab}/${v.a} ≈ ${prozent(t.ab / v.a)}`] : []),
    ],
  };
}

function kombinatorikAufgabe(r: Zufall, s: Stufe): Aufgabe {
  const art = eins(r, s === 1 ? (["mitZ", "ohneZ"] as const) : (["mitZ", "ohneZ", "griff"] as const));
  const fall = art === "mitZ"
    ? { n: 10, k: ganz(r, 3, 4), t: (k: number) => `Ein Zahlenschloss hat ${k} Rädchen mit den Ziffern 0 bis 9.`, frage: "Wie viele Codes gibt es?" }
    : art === "ohneZ"
      ? { n: ganz(r, 6, 10), k: 3, t: (n: number) => `${n} Läuferinnen laufen um Gold, Silber und Bronze.`, frage: "Wie viele Siegerpodeste sind möglich?" }
      : { n: ganz(r, 6, 10), k: ganz(r, 2, 3), t: (n: number) => `Aus ${n} Kindern werden mit einem Griff Kinder für den Tischdienst ausgelost.`, frage: "Wie viele Gruppen sind möglich?" };
  const t = art === "mitZ" ? fall.t(fall.k) : art === "ohneZ" ? fall.t(fall.n) : `${fall.t(fall.n)} Es sind ${fall.k} Plätze.`;
  const f = faktoren(fall.n, fall.k, art);
  const n = anzahl(fall.n, fall.k, art);
  return {
    lektion: "kombinatorik", frage: `${t} ${fall.frage}`,
    felder: [zf("n", "Anzahl", n), wf("a", "Welches Ziehen?", ["mit Zurücklegen, Reihenfolge zählt", "ohne Zurücklegen, Reihenfolge zählt", "mit einem Griff (ohne Reihenfolge)"], art === "mitZ" ? 0 : art === "ohneZ" ? 1 : 2)],
    tipps: ["Darf etwas mehrfach vorkommen? Dann mit Zurücklegen.", "Zählt die Reihenfolge nicht, teile durch die Zahl der Anordnungen (k!)."],
    weg: [art === "griff" ? `${f.join(" · ")} : ${Array.from({ length: fall.k }, (_, i) => fall.k - i).join(" · ")} = ${n}` : `${f.join(" · ")} = ${n}`],
  };
}

function zufallsgroessenAufgabe(r: Zufall, s: Stufe): Aufgabe {
  const einsatz = eins(r, [1, 2]);
  const felder = [
    { x: ganz(r, 3, 10), anteil: 1 }, { x: ganz(r, 1, 3), anteil: ganz(r, 1, 2) }, { x: 0, anteil: ganz(r, 2, 5) },
  ];
  const ges = felder.reduce((a, f) => a + f.anteil, 0);
  const v: Wert[] = felder.map(f => ({ x: f.x - einsatz, p: bruch(f.anteil, ges) }));
  const E = erwartungswert(v);
  return {
    lektion: "zufallsgroessen",
    frage: `Glücksrad mit ${ges} gleich großen Feldern: ${felder.map(f => `${f.anteil}× ${f.x} €`).join(", ")}. Einsatz ${einsatz} €. X = Gewinn minus Einsatz.`,
    bild: { art: "rad", werte: felder },
    felder: [
      zf("e", "Erwartungswert E(X) in € (auf Cent)", Math.round(wert(E) * 100) / 100, 0.006),
      wf("f", "Das Spiel ist …", ["günstig für mich", "fair", "ungünstig für mich"], wert(E) > 0 ? 0 : wert(E) === 0 ? 1 : 2),
      ...(s >= 2 ? [af("p", `P(X > 0)`, v.filter(w => w.x > 0).reduce((a, w) => a + wert(w.p), 0))] : []),
    ],
    tipps: ["E(X) = Σ xᵢ · P(X = xᵢ): jeden Wert mit seiner Wahrscheinlichkeit malnehmen und addieren.", "Fair heißt E(X) = 0."],
    weg: [`E(X) = ${summenTerm(v, bt)} = ${bt(E)} ≈ ${zahl(wert(E), 2)} €`],
  };
}

export const ERZEUGER: Record<LektionId, (r: Zufall, s: Stufe) => Aufgabe> = {
  erfassen, diagramme, kenngroessen: kenngroessenAufgabe, umfrage: erfassen, experimente,
  labor, laplace, baum: baumAufgabe, venn,
  vierfelder: vierfelderAufgabe, kombinatorik: kombinatorikAufgabe, zufallsgroessen: zufallsgroessenAufgabe,
};

/** Lektionen mit eigenen Übungen (die Umfrage hat keine). */
export const UEB_LEKTIONEN: LektionId[] = ["erfassen", "diagramme", "kenngroessen", "experimente", "labor", "laplace", "baum", "venn", "vierfelder", "kombinatorik", "zufallsgroessen"];

export function erzeuge(lektion: LektionId, s: Stufe, r: Zufall = Math.random): Aufgabe {
  return ERZEUGER[lektion](r, s);
}
