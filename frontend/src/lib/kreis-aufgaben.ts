/**
 * Gewürfelte Aufgaben zum Kreis: Übungen (Umfang, Fläche, rückwärts,
 * Kreisteile, Ring, Halb-/Viertelkreis, Lage einer Geraden) und Sachaufgaben
 * (Pizza, Fahrrad, Uhr, Laufbahn, Brunnen, Torte, Rasensprenger). Reine
 * Rechnung; die Skizzen sind Daten (lib/geometrie/skizze.ts).
 */
import { z } from "@/lib/prozent";
import { auswahl, eins, ganz, gesucht, type Art, type Sachaufgabe, type Zufall } from "@/lib/geometrie/aufgabe";
import { P, bogenPunkt, type Skizze } from "@/lib/geometrie/skizze";
import { LAGE_NAME, bogen, flaeche, lage, ring, sektor, umfang } from "@/lib/kreis";

export type UebungsArt = "umfang" | "flaeche" | "rueckwaerts" | "teile" | "ring" | "halbkreis" | "lage";
export const UEBUNG_ARTEN: Art<UebungsArt>[] = [
  { id: "umfang", icon: "⭕", label: "Umfang" },
  { id: "flaeche", icon: "🟠", label: "Fläche" },
  { id: "rueckwaerts", icon: "↩️", label: "Rückwärts" },
  { id: "teile", icon: "🍰", label: "Sektor & Bogen" },
  { id: "ring", icon: "🍩", label: "Kreisring" },
  { id: "halbkreis", icon: "◗", label: "Halb- & Viertelkreis" },
  { id: "lage", icon: "📏", label: "Lage der Geraden" },
];

export type AnwendungsArt = "pizza" | "fahrrad" | "uhr" | "laufbahn" | "brunnen" | "torte" | "sprenger";
export const ANWENDUNG_ARTEN: Art<AnwendungsArt>[] = [
  { id: "pizza", icon: "🍕", label: "Pizza-Angebot" },
  { id: "fahrrad", icon: "🚲", label: "Fahrradrad" },
  { id: "uhr", icon: "🕰️", label: "Uhrzeiger" },
  { id: "laufbahn", icon: "🏟️", label: "Laufbahn" },
  { id: "brunnen", icon: "⛲", label: "Brunnen mit Weg" },
  { id: "torte", icon: "🎂", label: "Tortenstück" },
  { id: "sprenger", icon: "💦", label: "Rasensprenger" },
];

const PI = "π";
const mit = (x: number, e: string, nk = 2) => `${z(x, nk)} ${e}`;

/* ───────────────────────────────────────────────────────── Zeichnungen ── */

const M = P(0, 0);

/** Kreis um M mit Radius `r` oder Durchmesser `d` als beschrifteter Strecke. */
export function kreisSkizze(r: number, text: { r?: string; d?: string }): Skizze {
  const s: Skizze = { kreise: [{ m: M, r }], nichtMassstaeblich: true };
  if (text.d) s.strecken = [{ a: bogenPunkt(M, r, 200), b: bogenPunkt(M, r, 20), text: text.d, art: text.d.includes("?") ? "gesucht" : "hilfe" }];
  else s.strecken = [{ a: M, b: bogenPunkt(M, r, 30), text: text.r, art: text.r?.includes("?") ? "gesucht" : "hilfe" }];
  s.marken = [{ p: M, text: "M" }];
  return s;
}

/** Kreisausschnitt mit Winkel α, symmetrisch nach oben geöffnet; der volle Kreis gestrichelt. */
export function sektorSkizze(r: number, alpha: number, texte: { r?: string; alpha?: string; b?: string }): Skizze {
  const von = 90 - alpha / 2, bis = 90 + alpha / 2;
  return {
    kreise: [{ m: M, r, gestrichelt: true, deckkraft: 0 }],
    boegen: [{ m: M, r, von, bis, flaeche: "sektor", farbe: "#f59e0b", deckkraft: 0.35, text: texte.b }],
    strecken: [{ a: M, b: bogenPunkt(M, r, von), text: texte.r, art: "hilfe" }],
    winkel: texte.alpha ? [{ p: M, von: bogenPunkt(M, r, von), bis: bogenPunkt(M, r, bis), text: texte.alpha }] : [],
    marken: [{ p: M, text: "M" }],
    nichtMassstaeblich: true,
  };
}

/** Kreisring: außen R, innen r (ausgespart). */
export function ringSkizze(R: number, r: number, texte: { R?: string; r?: string }): Skizze {
  return {
    kreise: [{ m: M, r: R, deckkraft: 0.3 }, { m: M, r, farbe: "var(--surface)", deckkraft: 1 }],
    strecken: [
      { a: M, b: bogenPunkt(M, R, 20), text: texte.R, art: "hilfe" },
      { a: M, b: bogenPunkt(M, r, 200), text: texte.r, art: "hilfe" },
    ],
    nichtMassstaeblich: true,
  };
}

/** Laufbahn: zwei Geraden der Länge g, an den Enden Halbkreise mit Radius r. */
export function laufbahnSkizze(g: number, r: number, texte: { g?: string; r?: string }): Skizze {
  const l = P(-g / 2, 0), rr = P(g / 2, 0);
  return {
    flaechen: [{ pts: [P(-g / 2, -r), P(g / 2, -r), P(g / 2, r), P(-g / 2, r)], farbe: "#16a34a", deckkraft: 0.18 }],
    boegen: [
      { m: rr, r, von: -90, bis: 90, flaeche: "sektor", farbe: "#16a34a", deckkraft: 0.18 },
      { m: l, r, von: 90, bis: 270, flaeche: "sektor", farbe: "#16a34a", deckkraft: 0.18 },
    ],
    strecken: [
      { a: P(-g / 2, r), b: P(g / 2, r), text: texte.g },
      { a: P(-g / 2, -r), b: P(g / 2, -r) },
      { a: rr, b: bogenPunkt(rr, r, 45), text: texte.r, art: "hilfe" },
    ],
    nichtMassstaeblich: true,
  };
}

/* ─────────────────────────────────────────────────────────── Übungen ── */

const EINHEITEN = ["cm", "m", "mm", "dm"];

function umfangAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, EINHEITEN), rad = ganz(r, 2, 15), mitD = r() < 0.5;
  const u = umfang(rad);
  return {
    art: "umfang", titel: "Umfang eines Kreises",
    text: mitD ? `Ein Kreis hat den Durchmesser d = ${mit(2 * rad, e)}. Berechne den Umfang.` : `Ein Kreis hat den Radius r = ${mit(rad, e)}. Berechne den Umfang.`,
    gesucht: [gesucht("u", "Umfang u", e, u)],
    hinweise: ["Der Umfang ist die Länge der Kreislinie.", "u = 2 · π · r = π · d", `π ≈ 3,14`],
    loesung: mitD
      ? ["u = π · d", `u = ${PI} · ${mit(2 * rad, e)} ≈ ${mit(u, e)}`]
      : ["u = 2 · π · r", `u = 2 · ${PI} · ${mit(rad, e)} ≈ ${mit(u, e)}`],
    skizze: kreisSkizze(rad, mitD ? { d: `d = ${mit(2 * rad, e)}` } : { r: `r = ${mit(rad, e)}` }),
  };
}

function flaecheAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, EINHEITEN), rad = ganz(r, 2, 15), mitD = r() < 0.5;
  const A = flaeche(rad);
  return {
    art: "flaeche", titel: "Fläche eines Kreises",
    text: mitD ? `Ein Kreis hat den Durchmesser d = ${mit(2 * rad, e)}. Berechne seinen Flächeninhalt.` : `Ein Kreis hat den Radius r = ${mit(rad, e)}. Berechne seinen Flächeninhalt.`,
    gesucht: [gesucht("A", "Fläche A", e + "²", A)],
    hinweise: [mitD ? "Erst den Radius bestimmen: r = d : 2." : "Die Formel braucht den Radius.", "A = π · r²", "r² heißt r · r — nicht 2 · r."],
    loesung: [
      ...(mitD ? [`r = ${mit(2 * rad, e)} : 2 = ${mit(rad, e)}`] : []),
      "A = π · r²",
      `A = ${PI} · (${mit(rad, e)})² = ${PI} · ${mit(rad * rad, e + "²")} ≈ ${mit(A, e + "²")}`,
    ],
    skizze: kreisSkizze(rad, mitD ? { d: `d = ${mit(2 * rad, e)}` } : { r: `r = ${mit(rad, e)}` }),
  };
}

function rueckwaertsAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, EINHEITEN), rad = ganz(r, 2, 15);
  if (r() < 0.5) {
    const u = Math.round(umfang(rad) * 100) / 100, d = u / Math.PI;
    return {
      art: "rueckwaerts", titel: "Vom Umfang zum Radius",
      text: `Ein Kreis hat den Umfang u = ${mit(u, e)}. Wie groß sind Durchmesser und Radius?`,
      gesucht: [gesucht("d", "Durchmesser d", e, d), gesucht("r", "Radius r", e, d / 2)],
      hinweise: ["u = π · d — umgestellt: d = u : π", "Der Radius ist der halbe Durchmesser."],
      loesung: ["d = u : π", `d = ${mit(u, e)} : ${PI} ≈ ${mit(d, e)}`, `r = d : 2 ≈ ${mit(d / 2, e)}`],
      skizze: kreisSkizze(rad, { d: "d = ?" }),
    };
  }
  const A = Math.round(flaeche(rad) * 100) / 100, rr = Math.sqrt(A / Math.PI);
  return {
    art: "rueckwaerts", titel: "Von der Fläche zum Radius",
    text: `Ein Kreis hat den Flächeninhalt A = ${mit(A, e + "²")}. Wie groß ist sein Radius?`,
    gesucht: [gesucht("r", "Radius r", e, rr)],
    hinweise: ["A = π · r² — erst durch π teilen, dann die Wurzel ziehen.", "r = √(A : π)"],
    loesung: ["r² = A : π", `r² = ${mit(A, e + "²")} : ${PI} ≈ ${mit(A / Math.PI, e + "²")}`, `r = √${z(A / Math.PI)} ≈ ${mit(rr, e)}`],
    skizze: kreisSkizze(rad, { r: "r = ?" }),
  };
}

const WINKEL = [30, 36, 40, 45, 60, 72, 90, 120, 135, 144, 150, 180];

function teileAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, EINHEITEN), rad = ganz(r, 2, 12), a = eins(r, WINKEL), fl = r() < 0.5;
  const skizze = sektorSkizze(rad, a, { r: `r = ${mit(rad, e)}`, alpha: `${a}°`, b: fl ? undefined : "b = ?" });
  if (fl) {
    const A = sektor(rad, a);
    return {
      art: "teile", titel: "Fläche eines Kreisausschnitts",
      text: `Ein Kreisausschnitt hat den Radius r = ${mit(rad, e)} und den Mittelpunktswinkel α = ${a}°. Berechne seine Fläche.`,
      gesucht: [gesucht("A", "Fläche A", e + "²", A)],
      hinweise: [`Der Ausschnitt ist der ${z(a / 360, 4)}-te Teil des Kreises (α : 360°).`, "A = π · r² · α : 360°"],
      loesung: ["A = π · r² · α : 360°", `A = ${PI} · (${mit(rad, e)})² · ${a}° : 360° ≈ ${mit(A, e + "²")}`],
      skizze,
    };
  }
  const b = bogen(rad, a);
  return {
    art: "teile", titel: "Länge eines Kreisbogens",
    text: `Ein Kreisbogen gehört zum Radius r = ${mit(rad, e)} und zum Mittelpunktswinkel α = ${a}°. Wie lang ist der Bogen?`,
    gesucht: [gesucht("b", "Bogenlänge b", e, b)],
    hinweise: ["Der Bogen ist ein Stück vom Umfang.", "b = 2 · π · r · α : 360°"],
    loesung: ["b = 2 · π · r · α : 360°", `b = 2 · ${PI} · ${mit(rad, e)} · ${a}° : 360° ≈ ${mit(b, e)}`],
    skizze,
  };
}

function ringAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, EINHEITEN), R = ganz(r, 4, 15), ri = ganz(r, 1, R - 1);
  const A = ring(R, ri);
  return {
    art: "ring", titel: "Fläche eines Kreisrings",
    text: `Ein Kreisring hat den Außenradius R = ${mit(R, e)} und den Innenradius r = ${mit(ri, e)}. Berechne die Fläche des Rings.`,
    gesucht: [gesucht("A", "Ringfläche A", e + "²", A)],
    hinweise: ["Großer Kreis minus kleiner Kreis.", "A = π · (R² − r²)", "Erst quadrieren, dann abziehen — nicht (R − r)²."],
    loesung: ["A = π · (R² − r²)", `A = ${PI} · (${z(R * R)} − ${z(ri * ri)}) ${e}² = ${PI} · ${mit(R * R - ri * ri, e + "²")} ≈ ${mit(A, e + "²")}`],
    skizze: ringSkizze(R, ri, { R: `R = ${mit(R, e)}`, r: `r = ${mit(ri, e)}` }),
  };
}

function halbkreisAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, EINHEITEN), rad = ganz(r, 2, 12), halb = r() < 0.5;
  const teil = halb ? 2 : 4, name = halb ? "Halbkreis" : "Viertelkreis";
  const A = flaeche(rad) / teil, bogenL = umfang(rad) / teil, u = bogenL + 2 * rad;
  const skizze: Skizze = {
    kreise: [{ m: M, r: rad, gestrichelt: true, deckkraft: 0 }],
    boegen: [{ m: M, r: rad, von: 0, bis: halb ? 180 : 90, flaeche: "sektor", farbe: "#f59e0b", deckkraft: 0.35 }],
    strecken: [{ a: M, b: P(rad, 0), text: `r = ${mit(rad, e)}`, art: "hilfe" }],
    nichtMassstaeblich: true,
  };
  return {
    art: "halbkreis", titel: `${name}: Fläche und Umfang`,
    text: `Ein ${name} hat den Radius r = ${mit(rad, e)}. Berechne Fläche und Umfang der ganzen Figur.`,
    gesucht: [gesucht("A", "Fläche A", e + "²", A), gesucht("u", "Umfang u", e, u)],
    hinweise: [
      `Ein ${name} ist ${halb ? "die Hälfte" : "ein Viertel"} des ganzen Kreises.`,
      `Zum Umfang gehört nicht nur der Bogen: Die geraden Ränder (${halb ? "der Durchmesser" : "zwei Radien"}) zählen mit.`,
    ],
    loesung: [
      `A = π · r² : ${teil} = ${PI} · (${mit(rad, e)})² : ${teil} ≈ ${mit(A, e + "²")}`,
      `Bogen = 2 · π · r : ${teil} ≈ ${mit(bogenL, e)}`,
      `u = Bogen + ${halb ? "d" : "2 · r"} ≈ ${mit(bogenL, e)} + ${mit(2 * rad, e)} ≈ ${mit(u, e)}`,
    ],
    skizze,
  };
}

const LAGEN = ["Sekante", "Tangente", "Passante"];

function lageAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, ["cm", "m", "mm"]), rad = ganz(r, 3, 12);
  const welche = eins(r, ["sekante", "tangente", "passante"] as const);
  const d = welche === "tangente" ? rad : welche === "sekante" ? ganz(r, 1, rad - 1) : rad + ganz(r, 1, 6);
  const mitD = r() < 0.5;
  return {
    art: "lage", titel: "Lage einer Geraden zum Kreis",
    text: `Ein Kreis hat den ${mitD ? `Durchmesser ${mit(2 * rad, e)}` : `Radius ${mit(rad, e)}`}. Eine Gerade g hat vom Mittelpunkt den Abstand ${mit(d, e)}. Was ist g für den Kreis?`,
    gesucht: [auswahl("lage", "Die Gerade ist eine", LAGEN, LAGE_NAME[lage(d, rad)])],
    hinweise: [mitD ? "Vergleiche den Abstand mit dem Radius, nicht mit dem Durchmesser." : "Vergleiche den Abstand d mit dem Radius r.", "d < r: Sekante · d = r: Tangente · d > r: Passante"],
    loesung: [
      ...(mitD ? [`r = ${mit(2 * rad, e)} : 2 = ${mit(rad, e)}`] : []),
      `d = ${mit(d, e)} ${d < rad ? "<" : d === rad ? "=" : ">"} r = ${mit(rad, e)} → ${LAGE_NAME[lage(d, rad)]}`,
    ],
  };
}

export function erzeugeUebung(art: UebungsArt, r: Zufall = Math.random): Sachaufgabe<UebungsArt> {
  switch (art) {
    case "umfang": return umfangAufgabe(r);
    case "flaeche": return flaecheAufgabe(r);
    case "rueckwaerts": return rueckwaertsAufgabe(r);
    case "teile": return teileAufgabe(r);
    case "ring": return ringAufgabe(r);
    case "halbkreis": return halbkreisAufgabe(r);
    case "lage": return lageAufgabe(r);
  }
}

/* ──────────────────────────────────────────────────────── Anwendungen ── */

const euro = (x: number) => `${x.toFixed(2).replace(".", ",")} €`;

function pizzaAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  // So lange würfeln, bis ein Angebot klar (mehr als 5 %) günstiger ist.
  for (;;) {
    const dG = eins(r, [30, 32, 36, 40]), dK = eins(r, [20, 22, 24, 26]), n = eins(r, [2, 3]);
    const pG = ganz(r, 18, 30) / 2 - 0.1, pK = ganz(r, 9, 16) / 2 - 0.1;
    const AG = flaeche(dG / 2), AK = n * flaeche(dK / 2);
    const jeG = AG / pG, jeK = AK / (n * pK);
    if (Math.abs(jeG - jeK) / Math.min(jeG, jeK) < 0.05) continue;
    const besser = jeG > jeK ? "die große Pizza" : `die ${n} kleinen`;
    return {
      art: "pizza", titel: "Pizza-Angebot",
      text: `Die Pizzeria bietet eine große Pizza mit ${dG} cm Durchmesser für ${euro(pG)} oder ${n} kleine Pizzen mit je ${dK} cm Durchmesser für je ${euro(pK)}. Wie viel Pizza (Fläche) bekommt man jeweils, und bei welchem Angebot bekommt man mehr Pizza pro Euro?`,
      gesucht: [
        gesucht("AG", "Fläche große Pizza", "cm²", AG, undefined, 0),
        gesucht("AK", `Fläche ${n} kleine zusammen`, "cm²", AK, undefined, 0),
        auswahl("besser", "Mehr Pizza pro Euro gibt es für", ["die große Pizza", `die ${n} kleinen`], besser),
      ],
      hinweise: ["Der Radius ist der halbe Durchmesser.", "A = π · r² für jede Pizza", "Teile die Fläche durch den Preis: cm² pro Euro."],
      loesung: [
        `groß: A = ${PI} · ${dG / 2}² ≈ ${mit(AG, "cm²", 0)}; ${mit(AG, "cm²", 0)} : ${euro(pG)} ≈ ${mit(jeG, "cm²/€", 0)}`,
        `klein: A = ${n} · ${PI} · ${dK / 2}² ≈ ${mit(AK, "cm²", 0)}; ${mit(AK, "cm²", 0)} : ${euro(n * pK)} ≈ ${mit(jeK, "cm²/€", 0)}`,
        `Mehr Pizza pro Euro: ${besser}`,
      ],
      skizze: {
        kreise: [{ m: P(0, 0), r: dG / 2, farbe: "#f59e0b", deckkraft: 0.3 }, ...Array.from({ length: n }, (_, i) => ({ m: P(dG / 2 + 8 + dK / 2 + i * (dK + 4), 0), r: dK / 2, farbe: "#f59e0b", deckkraft: 0.3 }))],
        strecken: [{ a: P(-dG / 2, 0), b: P(dG / 2, 0), text: `${dG} cm`, art: "hilfe" }],
        marken: [{ p: P(0, -dG / 4), text: "🍕", groesse: 26 }],
        nichtMassstaeblich: true,
      },
    };
  }
}

function fahrradAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const zoll = eins(r, [20, 24, 26, 28]), km = ganz(r, 2, 12);
  const d = zoll * 2.54, u = Math.PI * d, n = km * 100000 / u;
  return {
    art: "fahrrad", titel: "Wie oft dreht sich das Rad?",
    text: `Ein Fahrrad hat ${zoll}-Zoll-Räder: Der Durchmesser ist ${zoll} Zoll (1 Zoll = 2,54 cm). Wie lang ist der Umfang eines Rades, und wie oft dreht es sich auf ${km} km Schulweg?`,
    gesucht: [gesucht("u", "Umfang u", "cm", u), gesucht("n", "Umdrehungen", "", n, undefined, 0)],
    hinweise: ["Durchmesser in cm: Zoll · 2,54", "Bei einer Umdrehung rollt das Rad genau seinen Umfang ab: u = π · d", "1 km = 100 000 cm — dann Strecke : Umfang"],
    loesung: [
      `d = ${zoll} · 2,54 cm = ${mit(d, "cm")}`,
      `u = ${PI} · ${mit(d, "cm")} ≈ ${mit(u, "cm")}`,
      `${km} km = ${z(km * 100000, 0)} cm; ${z(km * 100000, 0)} cm : ${mit(u, "cm")} ≈ ${z(n, 0)} Umdrehungen`,
    ],
    skizze: { ...kreisSkizze(d / 2, { d: `d = ${zoll}″` }), marken: [{ p: P(0, d / 2 + 6), text: "🚲", groesse: 22 }] },
  };
}

function uhrAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const L = ganz(r, 8, 30), t = 5 * ganz(r, 2, 11), a = 6 * t, b = bogen(L, a);
  return {
    art: "uhr", titel: "Der Weg der Zeigerspitze",
    text: `Der Minutenzeiger einer Bahnhofsuhr ist ${L} cm lang. Um welchen Winkel dreht er sich in ${t} Minuten, und welchen Weg legt seine Spitze dabei zurück?`,
    gesucht: [gesucht("a", "Winkel α", "°", a, 0.5, 0), gesucht("b", "Weg der Spitze b", "cm", b)],
    hinweise: ["In 60 Minuten dreht sich der Minutenzeiger einmal ganz herum: 360°.", "Pro Minute also 6°.", "Die Spitze läuft auf einem Kreisbogen: b = 2 · π · r · α : 360°"],
    loesung: [`α = ${t} · 6° = ${a}°`, `b = 2 · ${PI} · ${L} cm · ${a}° : 360° ≈ ${mit(b, "cm")}`],
    skizze: { ...sektorSkizze(L, a, { r: `${L} cm`, alpha: `${a}°`, b: "b = ?" }), marken: [{ p: P(0, L * 0.45), text: "🕰️", groesse: 22 }] },
  };
}

function laufbahnAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const g = ganz(r, 80, 100), rad = ganz(r, 30, 38), bahn = ganz(r, 2, 8);
  const L1 = 2 * g + umfang(rad), mehr = umfang(1.22 * (bahn - 1));
  return {
    art: "laufbahn", titel: "Laufbahn im Stadion",
    text: `Eine Laufbahn besteht aus zwei Geraden von je ${g} m und zwei Halbkreisen mit dem Radius ${rad} m (gemessen an der Innenkante von Bahn 1). Wie lang ist eine Runde auf Bahn 1? Jede Bahn ist 1,22 m breit. Wie viel länger ist eine Runde auf Bahn ${bahn}?`,
    gesucht: [gesucht("L", "Runde Bahn 1", "m", L1), gesucht("mehr", `Mehr auf Bahn ${bahn}`, "m", mehr)],
    hinweise: ["Zwei Halbkreise ergeben zusammen einen ganzen Kreis.", "Runde = 2 · Gerade + 2 · π · r", `Auf Bahn ${bahn} ist der Radius um ${bahn - 1} · 1,22 m größer — die Geraden bleiben gleich.`],
    loesung: [
      `Runde = 2 · ${g} m + 2 · ${PI} · ${rad} m ≈ ${mit(L1, "m")}`,
      `Radius wächst um ${bahn - 1} · 1,22 m = ${mit(1.22 * (bahn - 1), "m")}`,
      `mehr = 2 · ${PI} · ${mit(1.22 * (bahn - 1), "m")} ≈ ${mit(mehr, "m")}`,
    ],
    skizze: laufbahnSkizze(g, rad, { g: `${g} m`, r: `r = ${rad} m` }),
  };
}

function brunnenAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const d = ganz(r, 3, 10), w = ganz(r, 2, 6) / 2, preis = ganz(r, 25, 60);
  const ri = d / 2, R = ri + w, A = ring(R, ri), K = A * preis;
  return {
    art: "brunnen", titel: "Weg um den Brunnen",
    text: `Um einen runden Brunnen mit ${d} m Durchmesser wird ein ${z(w)} m breiter Weg gepflastert. Wie groß ist die Fläche des Weges, und was kostet das Pflaster bei ${euro(preis)} pro m²?`,
    gesucht: [gesucht("A", "Fläche des Weges", "m²", A), gesucht("K", "Kosten", "€", K)],
    hinweise: ["Der Weg ist ein Kreisring.", `Innenradius = Brunnenradius, Außenradius = Brunnenradius + Wegbreite`, "A = π · (R² − r²)"],
    loesung: [
      `r = ${d} m : 2 = ${mit(ri, "m")}; R = ${mit(ri, "m")} + ${mit(w, "m")} = ${mit(R, "m")}`,
      `A = ${PI} · (${z(R)}² − ${z(ri)}²) m² ≈ ${mit(A, "m²")}`,
      `Kosten ≈ ${mit(A, "m²")} · ${euro(preis)} ≈ ${euro(K)}`,
    ],
    skizze: { ...ringSkizze(R, ri, { R: `${z(w)} m Weg`, r: `${d} m` }), strecken: [
      { a: bogenPunkt(M, ri, 0), b: bogenPunkt(M, R, 0), text: `${z(w)} m`, art: "hilfe" },
      { a: bogenPunkt(M, ri, 180), b: bogenPunkt(M, ri, 0), text: `${d} m`, art: "hilfe" },
    ], marken: [{ p: P(0, -ri / 2), text: "⛲", groesse: 24 }] },
  };
}

function torteAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const d = eins(r, [24, 26, 28, 30]), n = eins(r, [8, 10, 12, 16]);
  const a = 360 / n, A = sektor(d / 2, a);
  return {
    art: "torte", titel: "Tortenstücke",
    text: `Eine runde Torte mit ${d} cm Durchmesser wird in ${n} gleich große Stücke geschnitten. Wie groß ist der Winkel an der Spitze eines Stücks, und wie viel Torte (Fläche von oben) bekommt jeder?`,
    gesucht: [gesucht("a", "Winkel α", "°", a, 0.05, 1), gesucht("A", "Fläche eines Stücks", "cm²", A)],
    hinweise: ["Alle Stücke zusammen ergeben 360°.", "Ein Stück ist ein Kreisausschnitt: A = π · r² · α : 360° — oder einfach Kreisfläche : Anzahl."],
    loesung: [`α = 360° : ${n} = ${z(a, 1)}°`, `A = ${PI} · ${d / 2}² cm² : ${n} ≈ ${mit(A, "cm²")}`],
    skizze: { ...sektorSkizze(d / 2, a, { r: `${d / 2} cm`, alpha: "α" }), marken: [{ p: P(0, d / 4), text: "🎂", groesse: 22 }] },
  };
}

function sprengerAufgabe(r: Zufall): Sachaufgabe<AnwendungsArt> {
  const rad = ganz(r, 4, 12), a = eins(r, [60, 90, 120, 135, 150, 180]);
  const A = sektor(rad, a), b = bogen(rad, a);
  return {
    art: "sprenger", titel: "Rasensprenger",
    text: `Ein Rasensprenger in der Gartenecke spritzt ${rad} m weit und dreht sich dabei um ${a}° hin und her. Wie viel Rasen wird nass, und wie lang ist der Rand, an dem das Wasser zuletzt ankommt?`,
    gesucht: [gesucht("A", "nasse Fläche", "m²", A), gesucht("b", "äußerer Rand b", "m", b)],
    hinweise: ["Die nasse Fläche ist ein Kreisausschnitt.", "A = π · r² · α : 360°", "b = 2 · π · r · α : 360°"],
    loesung: [`A = ${PI} · ${rad}² m² · ${a}° : 360° ≈ ${mit(A, "m²")}`, `b = 2 · ${PI} · ${rad} m · ${a}° : 360° ≈ ${mit(b, "m")}`],
    skizze: { ...sektorSkizze(rad, a, { r: `${rad} m`, alpha: `${a}°` }), marken: [{ p: P(0, -rad * 0.55), text: "💦", groesse: 22 }] },
  };
}

export function erzeugeAnwendung(art: AnwendungsArt, r: Zufall = Math.random): Sachaufgabe<AnwendungsArt> {
  switch (art) {
    case "pizza": return pizzaAufgabe(r);
    case "fahrrad": return fahrradAufgabe(r);
    case "uhr": return uhrAufgabe(r);
    case "laufbahn": return laufbahnAufgabe(r);
    case "brunnen": return brunnenAufgabe(r);
    case "torte": return torteAufgabe(r);
    case "sprenger": return sprengerAufgabe(r);
  }
}

/* ─────────────────────────────────────────────────────────── Rad-Rollen ── */

export type RadRunde = { art: "umdrehungen" | "radius"; s: number; r: number; n: number };

/**
 * Eine Runde fürs Spiel: Die Marke liegt `s` cm weit weg. Entweder ist der
 * Radius gegeben und die Zahl der Umdrehungen gesucht, oder umgekehrt.
 * Ab Stufe 2 sind die Umdrehungen keine ganze Zahl mehr.
 */
export function radRunde(stufe: number, r: Zufall = Math.random): RadRunde {
  const rad = ganz(r, 5, 20);
  const n = stufe < 2 ? ganz(r, 2, 6) : ganz(r, 4, 24) / 4;
  const s = Math.round(n * umfang(rad));
  if (stufe >= 1 && r() < 0.5) return { art: "radius", s, r: s / (2 * Math.PI * n), n };
  return { art: "umdrehungen", s, r: rad, n: s / umfang(rad) };
}

/** Punkte für einen Wurf: 100 bei Treffer, bis 0 bei 25 % daneben. */
export const radPunkte = (ziel: number, gerollt: number) => Math.max(0, Math.round(100 - 400 * Math.abs(gerollt - ziel) / ziel));
