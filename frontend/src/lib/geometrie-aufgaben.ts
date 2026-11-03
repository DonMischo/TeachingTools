/**
 * Gewürfelte Aufgaben zur Sim »Geometrie« (Grundbegriffe, Klasse 5–7):
 * Übungen (Winkelarten, Neben-/Scheitelwinkel, Winkel an Parallelen, Lage,
 * Abstand, Symmetrieachsen, Drehwinkel, Spiegeln im Koordinatensystem) und
 * Sachaufgaben (Uhr, Kompass, Bahnübergang, Billard, Spiegelschrift,
 * Windrad, Schatzkarte, Leiter). Reine Rechnung; die Skizzen sind Daten
 * (lib/geometrie/skizze.ts, y nach unten).
 */
import { z } from "@/lib/prozent";
import { auswahl, eins, ganz, gesucht, type Art, type Sachaufgabe, type Zufall } from "@/lib/geometrie/aufgabe";
import { P, type Flaeche, type Marke, type Pt, type Skizze, type Strecke, type Winkel } from "@/lib/geometrie/skizze";
import { spiegel, type Achse } from "@/lib/koordinaten/spiel";
import { WINKELARTEN, drehfigur, polar, winkelArt, winkelGroesse, partner, WINKEL_IDS, type Beziehung, type WinkelId, BEZIEHUNGEN } from "@/lib/grundbegriffe";

export type UebungsArt = "winkelart" | "nebenwinkel" | "parallelen" | "lage" | "abstand" | "achsen" | "drehwinkel" | "spiegeln";
export const UEBUNG_ARTEN: Art<UebungsArt>[] = [
  { id: "winkelart", icon: "📐", label: "Winkelarten" },
  { id: "nebenwinkel", icon: "✂️", label: "Neben- und Scheitelwinkel" },
  { id: "parallelen", icon: "🛤️", label: "Winkel an Parallelen" },
  { id: "lage", icon: "∥", label: "Lage" },
  { id: "abstand", icon: "📏", label: "Abstand" },
  { id: "achsen", icon: "🦋", label: "Symmetrieachsen" },
  { id: "drehwinkel", icon: "🌀", label: "Drehwinkel" },
  { id: "spiegeln", icon: "🪞", label: "Spiegeln im Koordinatensystem" },
];

export type AnwendungsArt = "uhr" | "kompass" | "bahn" | "billard" | "spiegelschrift" | "windrad" | "schatz" | "leiter";
export const ANWENDUNG_ARTEN: Art<AnwendungsArt>[] = [
  { id: "uhr", icon: "🕒", label: "Uhrzeiger" },
  { id: "kompass", icon: "🧭", label: "Kompass" },
  { id: "bahn", icon: "🚂", label: "Bahnübergang" },
  { id: "billard", icon: "🎱", label: "Billard" },
  { id: "spiegelschrift", icon: "🪞", label: "Spiegelschrift" },
  { id: "windrad", icon: "🌬️", label: "Windrad & Co." },
  { id: "schatz", icon: "🏴‍☠️", label: "Schatzkarte" },
  { id: "leiter", icon: "🪜", label: "Leiter" },
];

/* ─────────────────────────────────────────────────────── Zeichnungen ── */

const ORANGE = "#fbbf24";
/** Mathematischer Punkt → Skizzenpunkt (y nach unten). */
const M = (p: Pt): Pt => P(p.x, -p.y);
const G = (g: number) => `${z(g)}°`;

/** Winkelsektor als Fläche (geht auch über 180°), Radius in Einheiten. */
function sektor(s: Pt, von: number, grad: number, r: number, farbe = ORANGE): Flaeche {
  const n = Math.max(2, Math.ceil(grad / 6));
  const pts = [M(s), ...Array.from({ length: n + 1 }, (_, i) => M(polar(s, r, von + grad * i / n)))];
  return { pts, farbe, deckkraft: 0.55 };
}

/**
 * Winkel mit Scheitel S, Schenkel SA in Richtung `von`, SB um `grad` weiter
 * (gegen den Uhrzeigersinn). `text` steht im Bogen.
 */
export function winkelSkizze(grad: number, von: number, text?: string, namen = true): Skizze {
  const S = { x: 0, y: 0 }, A = polar(S, 4, von), B = polar(S, 4, von + grad);
  const mitte = M(polar(S, grad > 180 ? 1.9 : 1.75, von + grad / 2));
  const flaechen: Flaeche[] = [], winkel: Winkel[] = [];
  if (Math.abs(grad - 90) < 1e-9) winkel.push({ p: M(S), von: M(A), bis: M(B), recht: true });
  else flaechen.push(sektor(S, von, grad, 1.1));
  const marken: Marke[] = [];
  if (namen) marken.push({ p: M(S), text: "S" }, { p: M(A), text: "A" }, ...(grad < 359 ? [{ p: M(B), text: "B" }] : []));
  if (text) marken.push({ p: mitte, text });
  return {
    flaechen, winkel, marken,
    strecken: [
      { a: M(S), b: M(A) }, { a: M(S), b: M(B) },
      // gemeinsamer Rahmen, damit jede Skizze gleich groß ist
      { a: P(-4.6, -4.6), b: P(4.6, 4.6), art: "unsichtbar" },
    ],
  };
}

/**
 * Zwei Geraden g, h (h um `kipp` gedreht) und die Schnittgerade s unter
 * `phi`. `texte` beschriftet einzelne der acht Winkel.
 */
export function parallelenSkizze(phi: number, texte: Partial<Record<WinkelId, string>>, kipp = 0, namen: [string, string, string] = ["g", "h", "s"]): Skizze {
  const S1 = { x: 0, y: 0 };
  const S2 = polar(S1, 2.6 / Math.sin(phi * Math.PI / 180), phi + 180);
  const dirs = (s: 1 | 2) => {
    const r = s === 1 ? 0 : kipp;
    return [r, phi, r + 180, phi + 180];
  };
  const winkel: Winkel[] = [], flaechen: Flaeche[] = [], marken: Marke[] = [];
  for (const w of WINKEL_IDS) {
    if (!texte[w]) continue;
    const s = Number(w[1]) as 1 | 2, i = "αβγδ".indexOf(w[0]), S = s === 1 ? S1 : S2;
    const d = dirs(s), von = d[i], bis = d[(i + 1) % 4];
    const grad = ((bis - von) % 360 + 360) % 360;
    flaechen.push(sektor(S, von, grad, 0.8, texte[w]!.includes("?") ? "#f87171" : ORANGE));
    marken.push({ p: M(polar(S, 1.45, von + grad / 2)), text: texte[w]! });
  }
  const L = 5.5;
  return {
    flaechen, winkel, marken: [
      ...marken,
      { p: M(polar(S1, L + 0.5, 0)), text: namen[0] }, { p: M(polar(S2, L + 0.5, kipp)), text: namen[1] },
      { p: M(polar(S1, 3.3, phi)), text: namen[2] },
    ],
    strecken: [
      { a: M(polar(S1, L, 180)), b: M(polar(S1, L, 0)) },
      { a: M(polar(S2, L, 180 + kipp)), b: M(polar(S2, L, kipp)) },
      { a: M(polar(S1, 2.8, phi)), b: M(polar(S2, 2.8, phi + 180)) },
    ],
  };
}

/** Koordinatensystem von −n bis n mit Zahlen an den Achsen. */
export function koordinatenSkizze(n = 6): Skizze {
  const marken: Marke[] = [];
  for (let i = -n; i <= n; i += 2) {
    if (i === 0) continue;
    marken.push({ p: P(i, 0.45), text: z(i), groesse: 11 }, { p: P(-0.5, -i), text: z(i), groesse: 11 });
  }
  marken.push({ p: P(n + 0.3, -0.5), text: "x", groesse: 13 }, { p: P(0.5, -n - 0.3), text: "y", groesse: 13 });
  return {
    raster: true,
    strecken: [{ a: P(-n, 0), b: P(n, 0), art: "hilfe" }, { a: P(0, n), b: P(0, -n), art: "hilfe" }],
    marken,
  };
}

/** Spiegelachse als Strecke in einer Koordinaten-Skizze. */
function achsenStrecke(a: Achse, n: number): Strecke | null {
  switch (a.art) {
    case "x": return { a: P(-n, 0), b: P(n, 0), art: "gesucht" };
    case "y": return { a: P(0, -n), b: P(0, n), art: "gesucht" };
    case "senkrecht": return { a: P(a.k, -n), b: P(a.k, n), art: "gesucht", text: `x = ${z(a.k)}` };
    case "waagerecht": return { a: P(-n, -a.k), b: P(n, -a.k), art: "gesucht", text: `y = ${z(a.k)}` };
    case "ursprung": return null;
  }
}

export function achsenName(a: Achse): string {
  switch (a.art) {
    case "x": return "an der x-Achse";
    case "y": return "an der y-Achse";
    case "ursprung": return "am Ursprung O(0|0)";
    case "senkrecht": return `an der Geraden x = ${z(a.k)}`;
    case "waagerecht": return `an der Geraden y = ${z(a.k)}`;
  }
}

export const punktText = (name: string, p: Pt) => `${name}(${z(p.x)} | ${z(p.y)})`;

export function zufallsAchse(r: Zufall): Achse {
  return eins(r, [
    { art: "x" }, { art: "y" }, { art: "ursprung" },
    { art: "senkrecht", k: eins(r, [-2, -1, 1, 2, 3]) }, { art: "waagerecht", k: eins(r, [-2, -1, 1, 2]) },
  ] as Achse[]);
}

/** Regel zum Spiegeln, als Satz. */
export function spiegelRegel(a: Achse): string {
  switch (a.art) {
    case "x": return "An der x-Achse: x bleibt, y wechselt das Vorzeichen.";
    case "y": return "An der y-Achse: y bleibt, x wechselt das Vorzeichen.";
    case "ursprung": return "Am Ursprung: beide Koordinaten wechseln das Vorzeichen.";
    case "senkrecht": return `An x = ${z(a.k)}: y bleibt, der Abstand zur Geraden kommt auf die andere Seite (x′ = 2 · ${z(a.k)} − x).`;
    case "waagerecht": return `An y = ${z(a.k)}: x bleibt, der Abstand zur Geraden kommt auf die andere Seite (y′ = 2 · ${z(a.k)} − y).`;
  }
}

/* ─────────────────────────────────────────────────────────── Übungen ── */

/** Gerundete Nebenrechnung als Text: »180° − 35° = 145°« */
const minus = (a: number, b: number) => `${G(a)} − ${G(b)} = ${G(a - b)}`;

function winkelartAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const art = eins(r, WINKELARTEN).id;
  const grad = { spitz: ganz(r, 15, 80), recht: 90, stumpf: ganz(r, 100, 170), gestreckt: 180, ueberstumpf: ganz(r, 200, 340), voll: 360 }[art];
  const g = grad === 360 ? 359.5 : grad; // Vollwinkel: die Schenkel liegen aufeinander
  const optionen = WINKELARTEN.map(w => w.label);
  const richtig = WINKELARTEN.find(w => w.id === winkelArt(grad))!.label;
  return {
    art: "winkelart", titel: "Winkelart bestimmen",
    text: `Der Winkel α = ∠ASB ist ${G(grad)} groß. Welche Winkelart ist das?`,
    gesucht: [auswahl("art", "Winkelart", optionen, richtig)],
    hinweise: ["Vergleiche mit 90° (rechter Winkel) und 180° (gestreckter Winkel).", "Über 180° heißt der Winkel überstumpf, genau 360° Vollwinkel."],
    loesung: [`α = ${G(grad)}`, WINKELARTEN.find(w => w.label === richtig)!.bereich, `→ ${richtig}`],
    skizze: winkelSkizze(g, ganz(r, 0, 3) * 30, "α"),
  };
}

function nebenwinkelAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const a = ganz(r, 20, 160), phi = a;
  const fall = eins(r, ["neben", "scheitel", "beide"] as const);
  const texte: Partial<Record<WinkelId, string>> = { "α1": `α = ${G(a)}` };
  const g = fall === "neben" ? [gesucht("b", "Nebenwinkel β", "°", 180 - a, 0.5, 1)]
    : fall === "scheitel" ? [gesucht("c", "Scheitelwinkel γ", "°", a, 0.5, 1)]
    : [gesucht("b", "β", "°", 180 - a, 0.5, 1), gesucht("c", "γ", "°", a, 0.5, 1), gesucht("d", "δ", "°", 180 - a, 0.5, 1)];
  if (fall !== "scheitel") texte["β1"] = "β = ?";
  if (fall !== "neben") texte["γ1"] = "γ = ?";
  if (fall === "beide") texte["δ1"] = "δ = ?";
  const sk = parallelenSkizze(phi, texte);
  // Nur eine Gerade g und die Schnittgerade s: h und S₂ fallen weg.
  sk.strecken = [sk.strecken![0], { a: M(polar({ x: 0, y: 0 }, 3, phi)), b: M(polar({ x: 0, y: 0 }, 3, phi + 180)) }];
  sk.marken = sk.marken!.filter(m => m.text !== "h");
  return {
    art: "nebenwinkel", titel: fall === "beide" ? "Alle vier Winkel" : fall === "neben" ? "Nebenwinkel" : "Scheitelwinkel",
    text: `Zwei Geraden schneiden sich. Ein Winkel ist α = ${G(a)}. Berechne ${fall === "beide" ? "β, γ und δ" : fall === "neben" ? "den Nebenwinkel β" : "den Scheitelwinkel γ"}.`,
    gesucht: g,
    hinweise: ["Nebenwinkel liegen nebeneinander an einer Geraden: zusammen 180°.", "Scheitelwinkel liegen sich gegenüber: sie sind gleich groß."],
    loesung: [
      ...(fall !== "scheitel" ? [`β = ${minus(180, a)} (Nebenwinkel)`] : []),
      ...(fall !== "neben" ? [`γ = α = ${G(a)} (Scheitelwinkel)`] : []),
      ...(fall === "beide" ? [`δ = β = ${G(180 - a)} (Scheitelwinkel von β)`] : []),
    ],
    skizze: sk,
  };
}

function parallelenAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const phi = ganz(r, 35, 145);
  const von = eins(r, WINKEL_IDS);
  const bez = eins(r, ["stufen", "wechsel", "neben", "scheitel"] as Beziehung[]);
  const nach = bez === "neben" || bez === "scheitel"
    // an S₁ gegeben, an S₂ gesucht: Neben-/Scheitelwinkel des Stufenwinkels
    ? partner(partner(von, "stufen")[0], bez)[0]
    : partner(von, bez)[0];
  const gw = winkelGroesse(von, phi), zw = winkelGroesse(nach, phi);
  const nV = `${von[0]}${von[1] === "1" ? "₁" : "₂"}`, nN = `${nach[0]}${nach[1] === "1" ? "₁" : "₂"}`;
  const ueber = bez === "neben" || bez === "scheitel" ? partner(von, "stufen")[0] : null;
  const nU = ueber && `${ueber[0]}${ueber[1] === "1" ? "₁" : "₂"}`;
  const optionen = BEZIEHUNGEN.map(b => b.label);
  return {
    art: "parallelen", titel: "Winkel an Parallelen",
    text: `Die Geraden g und h sind parallel (g ∥ h), die Gerade s schneidet beide. Es ist ${nV} = ${G(gw)}. Wie groß ist ${nN}?`,
    gesucht: [
      gesucht("w", nN, "°", zw, 0.5, 1),
      ...(ueber ? [] : [auswahl("bez", `${nV} und ${nN} sind`, optionen, BEZIEHUNGEN.find(b => b.id === bez)!.label)]),
    ],
    hinweise: [
      "Stufenwinkel liegen an beiden Schnittpunkten an derselben Stelle, Wechselwinkel über Kreuz (wie ein Z).",
      ueber ? `Geh über ${nU}: Er ist Stufenwinkel zu ${nV}.` : BEZIEHUNGEN.find(b => b.id === bez)!.regel,
    ],
    loesung: ueber
      ? [`${nU} = ${nV} = ${G(gw)} (Stufenwinkel)`, bez === "neben" ? `${nN} = ${minus(180, gw)} (Nebenwinkel von ${nU})` : `${nN} = ${nU} = ${G(zw)} (Scheitelwinkel von ${nU})`]
      : [`${nV} und ${nN} sind ${BEZIEHUNGEN.find(b => b.id === bez)!.label}.`, `${nN} = ${nV} = ${G(zw)}`],
    skizze: parallelenSkizze(phi, { [von]: `${nV} = ${G(gw)}`, [nach]: `${nN} = ?` }),
  };
}

const RICHTUNGEN: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1], [2, 1], [1, 2], [2, -1], [1, -2], [3, 1], [1, 3], [3, -1], [1, -3]];
const senkrechtZu = ([a, b]: [number, number]): [number, number] => [-b, a];

/** Gerade durch `p` mit Richtung `d`, als Strecke im Kasten 0…10 × 0…8 (mathematisch). */
function imKasten(p: Pt, d: [number, number]): [Pt, Pt] {
  const ts: number[] = [];
  const add = (t: number) => { const q = { x: p.x + t * d[0], y: p.y + t * d[1] }; if (q.x >= -1e-9 && q.x <= 10 + 1e-9 && q.y >= -1e-9 && q.y <= 8 + 1e-9) ts.push(t); };
  if (d[0]) { add(-p.x / d[0]); add((10 - p.x) / d[0]); }
  if (d[1]) { add(-p.y / d[1]); add((8 - p.y) / d[1]); }
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  return [{ x: p.x + t0 * d[0], y: p.y + t0 * d[1] }, { x: p.x + t1 * d[0], y: p.y + t1 * d[1] }];
}

function lageAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const rahmen: Strecke = { a: P(0, 0), b: P(10, -8), art: "unsichtbar" };
  if (r() < 0.4) {
    const art = eins(r, ["Strecke", "Strahl", "Gerade"]);
    const A = { x: ganz(r, 2, 4), y: ganz(r, 2, 6) }, B = { x: ganz(r, 6, 8), y: ganz(r, 2, 6) };
    const d: [number, number] = [B.x - A.x, B.y - A.y];
    const [e0, e1] = imKasten(A, d);
    const a = art === "Gerade" ? e0 : A, b = art === "Strecke" ? B : e1;
    const zeichen = { Strecke: "AB mit Strich darüber", Strahl: "Strahl AB (Anfang in A, durch B, ohne Ende)", Gerade: "Gerade AB (ohne Anfang und Ende)" }[art];
    return {
      art: "lage", titel: "Strecke, Strahl oder Gerade?",
      text: "Die Linie hört nur dort auf, wo ein Punkt eingezeichnet ist — am Bildrand läuft sie weiter. Wie heißt sie?",
      gesucht: [auswahl("art", "Das ist eine", ["Strecke", "Strahl", "Gerade"], art)],
      hinweise: ["Eine Strecke hat zwei Endpunkte, ein Strahl einen Anfangspunkt, eine Gerade keinen."],
      loesung: [`Die Linie ${art === "Strecke" ? "endet in A und in B" : art === "Strahl" ? "beginnt in A und läuft über B hinaus" : "läuft in beide Richtungen über A und B hinaus"}.`, `→ ${zeichen}`],
      skizze: { raster: true, strecken: [{ a: M(a), b: M(b) }, rahmen], marken: [{ p: M(A), text: "A" }, { p: M(B), text: "B" }] },
    };
  }
  const lage = eins(r, ["parallel", "senkrecht", "schneiden"] as const);
  const dg = eins(r, RICHTUNGEN);
  let dh: [number, number];
  if (lage === "parallel") dh = dg;
  else if (lage === "senkrecht") dh = senkrechtZu(dg);
  else {
    const kand = RICHTUNGEN.filter(d => d[0] * dg[1] - d[1] * dg[0] !== 0 && d[0] * dg[0] + d[1] * dg[1] !== 0);
    dh = eins(r, kand);
  }
  const pg = { x: ganz(r, 3, 5), y: ganz(r, 3, 5) };
  let ph = { x: ganz(r, 4, 7), y: ganz(r, 2, 6) };
  // h darf nicht auf g liegen: dann seitlich (bei waagerechtem g nach oben) verschieben.
  if (lage === "parallel" && (ph.x - pg.x) * dg[1] - (ph.y - pg.y) * dg[0] === 0) ph = dg[1] ? { x: pg.x + 2, y: pg.y } : { x: pg.x, y: pg.y + 2 };
  const [g0, g1] = imKasten(pg, dg), [h0, h1] = imKasten(ph, dh);
  const richtig = { parallel: "g ∥ h (parallel)", senkrecht: "g ⊥ h (senkrecht)", schneiden: "schneiden sich, nicht senkrecht" }[lage];
  return {
    art: "lage", titel: "Lage zweier Geraden",
    text: "Wie liegen die Geraden g und h zueinander? Zähle die Kästchen: Wie viele nach rechts, wie viele nach oben?",
    gesucht: [auswahl("lage", "g und h", ["g ∥ h (parallel)", "g ⊥ h (senkrecht)", "schneiden sich, nicht senkrecht"], richtig)],
    hinweise: [
      "Parallele Geraden haben dieselbe Steigung im Kästchenmuster (z. B. 2 rechts, 1 hoch).",
      "Senkrecht: Das Muster dreht sich um — aus »2 rechts, 1 hoch« wird »1 links, 2 hoch«.",
    ],
    loesung: [`g: ${dg[0]} rechts, ${dg[1]} hoch · h: ${dh[0]} rechts, ${dh[1]} hoch`, `→ ${richtig}`],
    skizze: {
      raster: true,
      strecken: [{ a: M(g0), b: M(g1) }, { a: M(h0), b: M(h1), art: "hilfe" }, rahmen],
      marken: [{ p: M({ x: g1.x + (g1.x > 9.5 ? -0.4 : 0.4), y: g1.y + (g1.y > 7.5 ? -0.4 : 0.4) }), text: "g" }, { p: M({ x: h1.x + (h1.x > 9.5 ? -0.4 : 0.4), y: h1.y + (h1.y > 7.5 ? -0.4 : 0.4) }), text: "h" }],
    },
  };
}

function abstandAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const waag = r() < 0.5, max = waag ? 8 : 10;
  const k = ganz(r, 1, max - 1), n = ganz(r, 2, Math.min(5, Math.max(k, max - k)));
  // P liegt n Kästchen neben g — auf der Seite, wo noch Platz ist.
  const q = k + n <= max && (k - n < 0 || r() < 0.5) ? k + n : k - n;
  const P0 = waag ? { x: ganz(r, 2, 8), y: q } : { x: q, y: ganz(r, 1, 7) };
  const F = waag ? { x: P0.x, y: k } : { x: k, y: P0.y };
  const kaest = Math.abs(waag ? P0.y - k : P0.x - k);
  const halbe = r() < 0.5;
  const d = halbe ? kaest / 2 : kaest;
  const g: [Pt, Pt] = waag ? [{ x: 0, y: k }, { x: 10, y: k }] : [{ x: k, y: 0 }, { x: k, y: 8 }];
  return {
    art: "abstand", titel: "Abstand Punkt – Gerade",
    text: `Wie weit ist der Punkt P von der Geraden g entfernt? ${halbe ? "Ein Kästchen ist 0,5 cm breit." : "Ein Kästchen ist 1 cm breit."}`,
    gesucht: [gesucht("d", "Abstand d", "cm", d, 0.05, 1)],
    hinweise: ["Der Abstand ist der kürzeste Weg: das Lot von P auf g, also senkrecht zu g.", "Zähle die Kästchen auf dem Lot und rechne in cm um."],
    loesung: [`Lot von P auf g: ${kaest} Kästchen`, halbe ? `d = ${kaest} · 0,5 cm = ${z(d)} cm` : `d = ${z(d)} cm`],
    skizze: {
      raster: true,
      strecken: [{ a: M(g[0]), b: M(g[1]) }, { a: M(P0), b: M(F), art: "gesucht", text: "d" }, { a: P(0, 0), b: P(10, -8), art: "unsichtbar" }],
      winkel: [{ p: M(F), von: M(P0), bis: M(g[1]), recht: true }],
      marken: [{ p: M(P0), text: "P" }, { p: M({ x: g[1].x - (waag ? 0.4 : -0.4), y: g[1].y + (waag ? 0.45 : -0.4) }), text: "g" }],
    },
  };
}

/** Figuren mit bekannter Zahl von Symmetrieachsen (Ecken mathematisch). */
export const ACHSEN_FIGUREN: { name: string; achsen: number; pts: Pt[] }[] = [
  { name: "Quadrat", achsen: 4, pts: [P(0, 0), P(4, 0), P(4, 4), P(0, 4)] },
  { name: "Rechteck", achsen: 2, pts: [P(0, 0), P(6, 0), P(6, 3), P(0, 3)] },
  { name: "Raute", achsen: 2, pts: [P(0, 2), P(3, 0), P(6, 2), P(3, 4)] },
  { name: "Parallelogramm", achsen: 0, pts: [P(0, 0), P(5, 0), P(7, 3), P(2, 3)] },
  { name: "gleichschenkliges Trapez", achsen: 1, pts: [P(0, 0), P(7, 0), P(5, 3), P(2, 3)] },
  { name: "Drachen", achsen: 1, pts: [P(0, 3), P(2, 0), P(4, 3), P(2, 4.2)] },
  { name: "gleichschenkliges Dreieck", achsen: 1, pts: [P(0, 0), P(5, 0), P(2.5, 4.5)] },
  { name: "gleichseitiges Dreieck", achsen: 3, pts: [P(0, 0), P(5, 0), P(2.5, 5 * Math.sqrt(3) / 2)] },
  { name: "unregelmäßiges Dreieck", achsen: 0, pts: [P(0, 0), P(6, 0), P(1.5, 3.5)] },
  { name: "regelmäßiges Fünfeck", achsen: 5, pts: drehfigur("vieleck", 5).flaechen[0] },
  { name: "regelmäßiges Sechseck", achsen: 6, pts: drehfigur("vieleck", 6).flaechen[0] },
  { name: "regelmäßiges Achteck", achsen: 8, pts: drehfigur("vieleck", 8).flaechen[0] },
];

function achsenAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const f = eins(r, ACHSEN_FIGUREN);
  return {
    art: "achsen", titel: "Symmetrieachsen zählen",
    text: `Wie viele Symmetrieachsen hat dieses ${f.name}?`,
    gesucht: [gesucht("n", "Anzahl Achsen", "", f.achsen, 0.1, 0)],
    hinweise: ["Eine Symmetrieachse teilt die Figur in zwei Hälften, die beim Falten genau aufeinanderliegen.", "Prüfe senkrecht, waagerecht und schräg — auch durch die Ecken."],
    loesung: [f.achsen ? `Das ${f.name} hat ${f.achsen} Symmetrieachse${f.achsen > 1 ? "n" : ""}.` : `Das ${f.name} hat keine Symmetrieachse${f.name === "Parallelogramm" ? " (aber es ist punktsymmetrisch)" : ""}.`],
    // Wert 0 ist erlaubt: auch »keine Achse« ist eine Antwort.
    skizze: { flaechen: [{ pts: f.pts.map(M) }] },
  };
}

function drehwinkelAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const art = eins(r, ["windrad", "stern", "vieleck", "propeller"] as const);
  const n = art === "propeller" ? ganz(r, 2, 5) : ganz(r, 3, 8);
  const f = drehfigur(art, n);
  return {
    art: "drehwinkel", titel: "Drehwinkel bestimmen",
    text: `Um welchen kleinsten Winkel (größer als 0°) muss man ${/^(regelmäßiges|Windrad)/.test(f.name) ? "das" : "den"} ${f.name} um die Mitte drehen, damit die Figur wieder genau auf sich selbst fällt?`,
    gesucht: [gesucht("w", "kleinster Drehwinkel", "°", 360 / n, 0.5, 1)],
    hinweise: [`Zähle die gleichen Teile: Es sind ${n}.`, "Eine ganze Umdrehung (360°) wird gleichmäßig auf die Teile verteilt."],
    loesung: [`${n} gleiche Teile`, `360° : ${n} = ${G(360 / n)}`],
    skizze: { flaechen: f.flaechen.map(pts => ({ pts: pts.map(M) })), marken: [{ p: P(0, 0), text: "•" }] },
  };
}

function spiegelnAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const a = zufallsAchse(r);
  let p: Pt, q: Pt;
  do {
    p = { x: ganz(r, -5, 5), y: ganz(r, -5, 5) };
    q = spiegel(p, a);
  } while (Math.abs(q.x) > 6 || Math.abs(q.y) > 6 || (q.x === p.x && q.y === p.y));
  const sk = koordinatenSkizze();
  const st = achsenStrecke(a, 6);
  if (st) sk.strecken!.push(st);
  sk.marken!.push({ p: M(p), text: "P" });
  if (a.art === "ursprung") sk.marken!.push({ p: P(0, 0), text: "O" });
  return {
    art: "spiegeln", titel: "Spiegeln im Koordinatensystem",
    text: `Spiegle ${punktText("P", p)} ${achsenName(a)}. Gib die Koordinaten des Bildpunkts P′ an.`,
    gesucht: [gesucht("x", "x-Koordinate von P′", "", q.x, 0.1, 0), gesucht("y", "y-Koordinate von P′", "", q.y, 0.1, 0)],
    hinweise: [spiegelRegel(a), "Zeichne P′ ein: Die Verbindung PP′ steht senkrecht auf der Achse, und beide sind gleich weit von ihr entfernt."],
    loesung: [spiegelRegel(a), `${punktText("P", p)} → ${punktText("P′", q)}`],
    skizze: sk,
  };
}

export function erzeugeUebung(art: UebungsArt, r: Zufall = Math.random): Sachaufgabe<UebungsArt> {
  switch (art) {
    case "winkelart": return winkelartAufgabe(r);
    case "nebenwinkel": return nebenwinkelAufgabe(r);
    case "parallelen": return parallelenAufgabe(r);
    case "lage": return lageAufgabe(r);
    case "abstand": return abstandAufgabe(r);
    case "achsen": return achsenAufgabe(r);
    case "drehwinkel": return drehwinkelAufgabe(r);
    case "spiegeln": return spiegelnAufgabe(r);
  }
}

/* ─────────────────────────────────────────────────────── Anwendungen ── */

/** Kleinerer Winkel zwischen den Zeigern um h:m Uhr. */
export function zeigerWinkel(h: number, m: number): number {
  const d = Math.abs(30 * (h % 12) - 5.5 * m) % 360;
  return Math.min(d, 360 - d);
}

function uhrAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  let h: number, m: number, w: number;
  do { h = ganz(r, 1, 12); m = eins(r, [0, 0, 30, 15, 45, 20, 10]); w = zeigerWinkel(h, m); } while (w === 0);
  const zeit = `${h}:${String(m).padStart(2, "0")} Uhr`;
  const zwoelf = { x: 0, y: 0 };
  const stunde = polar(zwoelf, 2.2, 90 - (h % 12) * 30 - m * 0.5), minute = polar(zwoelf, 3.3, 90 - m * 6);
  const marken: Marke[] = [12, 3, 6, 9].map(n => ({ p: M(polar(zwoelf, 3.6, 90 - n * 30)), text: String(n), groesse: 13 }));
  return {
    art: "uhr", titel: "Winkel zwischen den Uhrzeigern",
    text: `Es ist ${zeit}. Wie groß ist der kleinere Winkel zwischen Stunden- und Minutenzeiger? Welche Winkelart ist das?`,
    gesucht: [gesucht("w", "Winkel", "°", w, 0.5, 1), auswahl("art", "Winkelart", WINKELARTEN.slice(0, 4).map(x => x.label), WINKELARTEN.find(x => x.id === winkelArt(w))!.label)],
    hinweise: [
      "Zwischen zwei Zahlen auf dem Ziffernblatt liegen 360° : 12 = 30°.",
      m ? `Der Stundenzeiger wandert mit: in ${m} Minuten um ${z(m / 2)}° (ein halbes Grad je Minute).` : "Zur vollen Stunde zeigt der Minutenzeiger genau auf die 12.",
    ],
    loesung: [
      `Minutenzeiger: ${m} · 6° = ${G(m * 6)} ab der 12`,
      `Stundenzeiger: ${h % 12} · 30° + ${m} · 0,5° = ${G((h % 12) * 30 + m * 0.5)} ab der 12`,
      `Unterschied: ${G(w)}${Math.abs(30 * (h % 12) - 5.5 * m) % 360 > 180 ? " (kleinerer Winkel: 360° minus den größeren)" : ""}`,
    ],
    skizze: {
      kreise: [{ m: P(0, 0), r: 4, deckkraft: 0.06 }],
      strecken: [{ a: P(0, 0), b: M(stunde) }, { a: P(0, 0), b: M(minute), art: "hilfe" }],
      marken,
    },
  };
}

const KOMPASS = ["Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten"];
const KOMPASS_K = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];

function kompassAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const a = ganz(r, 0, 7);
  let b = ganz(r, 0, 7);
  if (b === a) b = (a + 3) % 8;
  const rechts = r() < 0.5;
  const schritte = rechts ? (b - a + 8) % 8 : (a - b + 8) % 8;
  const w = schritte * 45;
  const marken: Marke[] = KOMPASS_K.map((k, i) => ({ p: M(polar({ x: 0, y: 0 }, 3.8, 90 - i * 45)), text: k, groesse: 13 }));
  return {
    art: "kompass", titel: "Drehen nach Himmelsrichtungen",
    text: `Du schaust nach ${KOMPASS[a]} und drehst dich ${rechts ? "im Uhrzeigersinn (rechtsherum)" : "gegen den Uhrzeigersinn (linksherum)"}, bis du nach ${KOMPASS[b]} schaust. Um wie viel Grad hast du dich gedreht?`,
    gesucht: [gesucht("w", "Drehwinkel", "°", w, 0.5, 0)],
    hinweise: ["Zwischen zwei benachbarten Richtungen der Windrose (z. B. N und NO) liegen 45°.", `Zähle die Schritte ${rechts ? "rechtsherum" : "linksherum"}.`],
    loesung: [`${schritte} Schritte zu je 45°`, `${schritte} · 45° = ${G(w)}`],
    skizze: {
      kreise: [{ m: P(0, 0), r: 3.1, deckkraft: 0.05 }],
      strecken: [{ a: P(0, 0), b: M(polar({ x: 0, y: 0 }, 3, 90 - a * 45)) }, { a: P(0, 0), b: M(polar({ x: 0, y: 0 }, 3, 90 - b * 45)), art: "hilfe" }],
      marken: [...marken, { p: P(0, 0), text: "🧍", groesse: 18 }],
    },
  };
}

function bahnAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const phi = ganz(r, 40, 140);
  const bez = eins(r, ["stufen", "wechsel"] as Beziehung[]);
  const von = eins(r, ["α1", "β1", "γ1", "δ1"] as WinkelId[]);
  const nach = partner(von, bez)[0];
  const w = winkelGroesse(von, phi);
  const sk = parallelenSkizze(phi, { [von]: G(w), [nach]: "?" }, 0, ["Hauptstraße", "Gartenweg", "Gleis"]);
  return {
    art: "bahn", titel: "Bahnübergang",
    text: `Die Hauptstraße und der Gartenweg verlaufen parallel. Ein Gleis kreuzt beide. An der Hauptstraße misst das Gleis ${G(w)}. Welcher Winkel ergibt sich am Gartenweg an der markierten Stelle? Wie heißt die Winkelbeziehung?`,
    gesucht: [gesucht("w", "Winkel am Gartenweg", "°", winkelGroesse(nach, phi), 0.5, 1), auswahl("bez", "Beziehung", ["Stufenwinkel", "Wechselwinkel", "Nebenwinkel"], BEZIEHUNGEN.find(b => b.id === bez)!.label)],
    hinweise: ["Parallel heißt: An beiden Kreuzungen entstehen dieselben Winkel.", "Gleiche Lage an beiden Kreuzungen → Stufenwinkel; über Kreuz (Z-Form) → Wechselwinkel."],
    loesung: [`${BEZIEHUNGEN.find(b => b.id === bez)!.regel}`, `Winkel am Gartenweg = ${G(w)}`],
    skizze: sk,
  };
}

function billardAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const a = ganz(r, 20, 70);
  const B = { x: 0, y: 0 };
  const hin = polar(B, 4, 180 - a), weg = polar(B, 4, a);
  return {
    art: "billard", titel: "Billardkugel an der Bande",
    text: `Eine Billardkugel trifft unter ${G(a)} auf die Bande (gemessen zwischen Bahn und Bande). Unter welchem Winkel prallt sie ab? Wie groß ist der Winkel zwischen Hinweg und Rückweg?`,
    gesucht: [gesucht("aus", "Abprallwinkel zur Bande", "°", a, 0.5, 1), gesucht("zw", "Winkel zwischen Hin- und Rückweg", "°", 180 - 2 * a, 0.5, 1)],
    hinweise: ["Einfallswinkel = Ausfallswinkel: Die Kugel prallt ab wie ein Spiegelbild.", "An der Bande liegen drei Winkel nebeneinander: zusammen 180° (gestreckter Winkel)."],
    loesung: [`Abprallwinkel = Einfallswinkel = ${G(a)}`, `180° − ${G(a)} − ${G(a)} = ${G(180 - 2 * a)}`],
    skizze: {
      flaechen: [sektor(B, 180 - a, a, 1), sektor(B, 0, a, 1), sektor(B, a, 180 - 2 * a, 0.7, "#f87171"), { pts: [P(-5, 0), P(5, 0), P(5, 0.5), P(-5, 0.5)], farbe: "#15803d", deckkraft: 0.5 }],
      strecken: [{ a: M(hin), b: M(B), art: "hilfe" }, { a: M(B), b: M(weg), art: "hilfe" }, { a: P(-5, -4.5), b: P(5, 0.5), art: "unsichtbar" }],
      marken: [{ p: M(hin), text: "🎱", groesse: 18 }, { p: M(polar(B, 1.6, 180 - a / 2)), text: G(a) }, { p: M(polar(B, 1.6, a / 2)), text: "?" }, { p: M(polar(B, 1.3, 90)), text: "?" }],
    },
  };
}

/** Großbuchstaben mit senkrechter bzw. waagerechter Symmetrieachse (in einer schlichten Blockschrift). */
export const SENKRECHT_SYM = new Set("AHIMOTUVWXY");
export const WAAGERECHT_SYM = new Set("BCDEHIKOX");
const WOERTER = ["OTTO", "HAUS", "MATHE", "TOMATE", "WIKI", "HOCHBEET", "AUTO", "UHU", "MIXER", "TAXI", "KOCHBUCH", "DECKE", "BOOT", "WOHNHAUS", "HEXE", "TIMO", "OBOE", "MAUS"];

function spiegelschriftAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const wort = eins(r, WOERTER), senk = r() < 0.6;
  const set = senk ? SENKRECHT_SYM : WAAGERECHT_SYM;
  const bleiben = [...wort].filter(c => set.has(c));
  return {
    art: "spiegelschrift", titel: "Spiegelschrift",
    text: senk
      ? `Das Wort ${wort} wird auf eine Glasscheibe geschrieben und von hinten gelesen (Spiegelung an einer senkrechten Achse). Wie viele seiner ${wort.length} Buchstaben sehen danach genauso aus wie vorher?`
      : `Das Wort ${wort} spiegelt sich in einem ruhigen See (Spiegelung an einer waagerechten Achse). Wie viele seiner ${wort.length} Buchstaben sehen im Spiegelbild genauso aus?`,
    gesucht: [gesucht("n", "Anzahl Buchstaben", "", bleiben.length, 0.1, 0)],
    hinweise: [
      senk ? "Ein Buchstabe bleibt gleich, wenn er eine senkrechte Symmetrieachse hat (wie A oder T)." : "Ein Buchstabe bleibt gleich, wenn er eine waagerechte Symmetrieachse hat (wie B oder E).",
      "Gezählt wird jeder Buchstabe, auch doppelte. Wir nehmen eine schlichte Blockschrift an.",
    ],
    loesung: [
      `Mit ${senk ? "senkrechter" : "waagerechter"} Achse: ${[...set].join(", ")}`,
      `In ${wort}: ${bleiben.length ? bleiben.join(", ") : "keiner"} → ${bleiben.length}`,
    ],
  };
}

const DREHDINGE: { name: string; den: string; art: "windrad" | "propeller" | "stern"; n: [number, number] }[] = [
  { name: "Windkraftanlage", den: "die", art: "propeller", n: [3, 3] },
  { name: "Ventilator", den: "den", art: "propeller", n: [4, 5] },
  { name: "Papier-Windrad", den: "das", art: "windrad", n: [4, 6] },
  { name: "Seestern", den: "den", art: "stern", n: [5, 5] },
  { name: "Schneeflocke", den: "die", art: "stern", n: [6, 6] },
  { name: "Riesenrad", den: "das", art: "windrad", n: [8, 12] },
];

function windradAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const d = eins(r, DREHDINGE), n = ganz(r, d.n[0], d.n[1]);
  const teil = d.name === "Riesenrad" ? "Gondeln" : d.art === "stern" ? "Arme" : d.art === "windrad" ? "Flügel" : "Rotorblätter";
  return {
    art: "windrad", titel: `${d.name} drehen`,
    text: `Ein${d.den === "die" ? "e" : ""} ${d.name} hat ${n} gleiche ${teil}. Um wie viel Grad muss man ${d.den} ${d.name} mindestens drehen, bis alles wieder genauso aussieht? Wie oft passiert das bei einer vollen Umdrehung?`,
    gesucht: [gesucht("w", "kleinster Drehwinkel", "°", 360 / n, 0.5, 1), gesucht("n", "so oft je Umdrehung", "", n, 0.1, 0)],
    hinweise: ["Eine volle Umdrehung hat 360°.", `Die ${n} ${teil} teilen die Umdrehung gleichmäßig auf.`],
    loesung: [`360° : ${n} = ${G(360 / n)}`, `In 360° sieht es ${n}-mal gleich aus (das letzte Mal nach der vollen Drehung).`],
    skizze: { flaechen: drehfigur(d.art, n).flaechen.map(pts => ({ pts: pts.map(M) })) },
  };
}

function schatzAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const a = zufallsAchse(r);
  let p: Pt, q: Pt;
  do {
    p = { x: ganz(r, -5, 5), y: ganz(r, -5, 5) };
    q = spiegel(p, a);
  } while (Math.abs(q.x) > 6 || Math.abs(q.y) > 6 || (q.x === p.x && q.y === p.y));
  const sk = koordinatenSkizze();
  const st = achsenStrecke(a, 6);
  if (st) sk.strecken!.push(st);
  sk.marken!.push({ p: M(p), text: "🌴", groesse: 20 });
  const wo = a.art === "x" ? "am Fluss entlang der x-Achse" : a.art === "y" ? "an der Straße entlang der y-Achse" : a.art === "ursprung" ? "am alten Brunnen im Ursprung" : `an der Mauer (${achsenName(a).replace("an der ", "")})`;
  return {
    art: "schatz", titel: "Schatzkarte",
    text: `Auf der Schatzkarte steht die Palme bei ${punktText("P", p)}. Der Schatz liegt genau spiegelbildlich ${wo}. Wo muss gegraben werden?`,
    gesucht: [gesucht("x", "x-Koordinate des Schatzes", "", q.x, 0.1, 0), gesucht("y", "y-Koordinate des Schatzes", "", q.y, 0.1, 0)],
    hinweise: [spiegelRegel(a)],
    loesung: [spiegelRegel(a), `Schatz bei ${punktText("S", q)}`],
    skizze: sk,
  };
}

function leiterAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const a = ganz(r, 55, 82);
  const fuss = { x: 0, y: 0 }, oben = polar(fuss, 5, 180 - a);
  const sicher = a >= 65 && a <= 75;
  return {
    art: "leiter", titel: "Leiter anlehnen",
    text: `Eine Leiter lehnt an einer Hauswand. Auf der Wandseite bildet sie mit dem Boden einen Winkel von ${G(a)}. Wie groß ist der Winkel auf der anderen Seite (zwischen Leiter und Boden, von der Wand weg)? Für sicheres Stehen soll der Anstellwinkel zwischen 65° und 75° liegen — passt das?`,
    gesucht: [gesucht("b", "Winkel auf der anderen Seite", "°", 180 - a, 0.5, 1), auswahl("sicher", "Sicher aufgestellt?", ["ja", "nein, zu steil", "nein, zu flach"], sicher ? "ja" : a > 75 ? "nein, zu steil" : "nein, zu flach")],
    hinweise: ["Die beiden Winkel am Fuß der Leiter liegen an einer Geraden (dem Boden): Nebenwinkel.", "Je größer der Anstellwinkel, desto steiler steht die Leiter."],
    loesung: [`${minus(180, a)} (Nebenwinkel)`, sicher ? "Der Anstellwinkel liegt zwischen 65° und 75°: sicher." : a > 75 ? "Über 75°: zu steil, die Leiter kann nach hinten kippen." : "Unter 65°: zu flach, die Leiter kann wegrutschen."],
    skizze: {
      flaechen: [sektor(fuss, 180 - a, a, 0.9), sektor(fuss, 0, 180 - a, 0.6, "#f87171"), { pts: [M({ x: oben.x - 0.4, y: -0.2 }), M({ x: oben.x, y: -0.2 }), M({ x: oben.x, y: 5.2 }), M({ x: oben.x - 0.4, y: 5.2 })], farbe: "#9ca3af", deckkraft: 0.6 }],
      strecken: [{ a: M({ x: oben.x - 0.4, y: 0 }), b: M({ x: 3, y: 0 }) }, { a: M(fuss), b: M(oben), art: "hilfe" }],
      marken: [{ p: M(polar(fuss, 1.5, 180 - a / 2)), text: G(a) }, { p: M(polar(fuss, 1.2, (180 - a) / 2)), text: "?" }, { p: M({ x: oben.x - 0.9, y: 4.6 }), text: "🏠", groesse: 18 }],
    },
  };
}

export function erzeugeAnwendung(art: AnwendungsArt, r: Zufall = Math.random): Sachaufgabe<AnwendungsArt> {
  switch (art) {
    case "uhr": return uhrAufgabe(r);
    case "kompass": return kompassAufgabe(r);
    case "bahn": return bahnAufgabe(r);
    case "billard": return billardAufgabe(r);
    case "spiegelschrift": return spiegelschriftAufgabe(r);
    case "windrad": return windradAufgabe(r);
    case "schatz": return schatzAufgabe(r);
    case "leiter": return leiterAufgabe(r);
  }
}
