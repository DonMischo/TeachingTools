/**
 * Gewürfelte Aufgaben zur Sim »dreiecke« (Klasse 5–8): Übungen (Winkelsumme,
 * Dreiecksarten, Außenwinkel, Basiswinkel, Fläche, Umfang, rückwärts,
 * Pythagoras, Kongruenzsätze, Thales) und Sachaufgaben (Giebel, Segel,
 * Leiter, Abkürzung, Wimpelkette, Beet, Verkehrsschild, Dachneigung), dazu
 * die Dreiecke für das Spiel »Dreiecks-Blitz«. Reine Rechnung; die Skizzen
 * sind Daten (lib/geometrie/skizze.ts).
 */
import { z } from "@/lib/prozent";
import { auswahl, eins, ganz, gesucht, type Art, type Sachaufgabe, type Zufall } from "@/lib/geometrie/aufgabe";
import { P, ecken, rechteck, seiten, type Pt, type Skizze, type Strecke, type Winkel } from "@/lib/geometrie/skizze";
import {
  RAD, ausSeiten, ausWinkeln, lotfuss, nachSeiten, nachWinkeln, seitenLaengen,
  SEITEN_NAMEN, WINKEL_NAMEN, type Dreieck, type NachSeiten, type NachWinkeln,
} from "@/lib/dreiecke";

export type UebungsArt = "winkelsumme" | "arten" | "aussenwinkel" | "basiswinkel" | "flaeche" | "umfang" | "rueckwaerts" | "pythagoras" | "kongruenz" | "thales";
export const UEBUNG_ARTEN: Art<UebungsArt>[] = [
  { id: "winkelsumme", icon: "🔺", label: "Winkelsumme" },
  { id: "arten", icon: "🔎", label: "Dreiecksarten" },
  { id: "aussenwinkel", icon: "↗️", label: "Außenwinkel" },
  { id: "basiswinkel", icon: "⛺", label: "Basiswinkel" },
  { id: "flaeche", icon: "🧱", label: "Fläche" },
  { id: "umfang", icon: "🚧", label: "Umfang" },
  { id: "rueckwaerts", icon: "↩️", label: "Rückwärts" },
  { id: "pythagoras", icon: "📐", label: "Pythagoras" },
  { id: "kongruenz", icon: "🧩", label: "Kongruenzsätze" },
  { id: "thales", icon: "🌗", label: "Thales" },
];

export type AnwendungsArt = "giebel" | "segel" | "leiter" | "abkuerzung" | "wimpel" | "beet" | "schild" | "dachneigung";
export const ANWENDUNG_ARTEN: Art<AnwendungsArt>[] = [
  { id: "giebel", icon: "🏠", label: "Giebel streichen" },
  { id: "segel", icon: "⛵", label: "Segel nähen" },
  { id: "leiter", icon: "🪜", label: "Leiter anlehnen" },
  { id: "abkuerzung", icon: "🚶", label: "Abkürzung" },
  { id: "wimpel", icon: "🎏", label: "Wimpelkette" },
  { id: "beet", icon: "🌷", label: "Dreiecksbeet" },
  { id: "schild", icon: "⚠️", label: "Verkehrsschild" },
  { id: "dachneigung", icon: "🏚️", label: "Dachneigung" },
];

const SEITEN_OPT = Object.values(SEITEN_NAMEN);
const WINKEL_OPT = Object.values(WINKEL_NAMEN);
export const SAETZE = ["SSS", "SWS", "WSW", "SsW", "nicht eindeutig"];
const GR = (x: number) => `${z(x)}°`;

/* ───────────────────────────────────────────────────────── Zeichnungen ── */

type Ecke = 0 | 1 | 2;
type Beschriftung = {
  /** Texte an den Seiten a (BC), b (CA), c (AB) */
  a?: string; b?: string; c?: string;
  /** Texte an den Winkeln α, β, γ */
  alpha?: string; beta?: string; gamma?: string;
  /** Ecke mit rechtem Winkel (bekommt das Zeichen) */
  recht?: Ecke;
  /** Höhe von dieser Ecke auf die Gegenseite, mit Text */
  hoehe?: { von: Ecke; text?: string };
  namen?: boolean;
  farbe?: string;
};

const art = (t?: string): Strecke["art"] => (t?.includes("?") ? "gesucht" : "hilfe");

/** Höhe von Ecke `i` als Strecken plus rechter Winkel; liegt der Fußpunkt außen, wird die Seite gestrichelt verlängert. */
export function hoeheSkizze(d: Dreieck, i: Ecke, text?: string): { strecken: Strecke[]; winkel: Winkel[] } {
  const P0 = d[i], Q = d[(i + 1) % 3], R = d[(i + 2) % 3];
  const F = lotfuss(P0, Q, R);
  const strecken: Strecke[] = [{ a: P0, b: F, text, art: art(text) }];
  const t = ((F.x - Q.x) * (R.x - Q.x) + (F.y - Q.y) * (R.y - Q.y)) / ((R.x - Q.x) ** 2 + (R.y - Q.y) ** 2);
  if (t < -0.01) strecken.push({ a: Q, b: F, art: "hilfe" });
  if (t > 1.01) strecken.push({ a: R, b: F, art: "hilfe" });
  const weit = Math.hypot(F.x - Q.x, F.y - Q.y) > Math.hypot(F.x - R.x, F.y - R.y) ? Q : R;
  return { strecken, winkel: [{ p: F, von: P0, bis: weit, recht: true }] };
}

export function skizzeDreieck(d: Dreieck, o: Beschriftung = {}): Skizze {
  const [A, B, C] = d;
  const winkel: Winkel[] = [];
  const w = (i: Ecke, text?: string) => {
    const p = d[i], von = d[(i + 1) % 3], bis = d[(i + 2) % 3];
    if (o.recht === i) winkel.push({ p, von, bis, recht: true, text });
    else if (text) winkel.push({ p, von, bis, text });
  };
  w(0, o.alpha); w(1, o.beta); w(2, o.gamma);
  const strecken = seiten([A, B, C], [o.c, o.a, o.b]);
  for (const s of strecken) if (s.text?.includes("?")) s.art = "gesucht";
  if (o.hoehe) {
    const h = hoeheSkizze(d, o.hoehe.von, o.hoehe.text);
    strecken.push(...h.strecken);
    winkel.push(...h.winkel);
  }
  return {
    flaechen: [{ pts: [A, B, C], farbe: o.farbe }], strecken, winkel,
    marken: o.namen === false ? [] : ecken([A, B, C]),
  };
}

const mit = (x: number, e: string) => `${z(x)} ${e}`;

/* ─────────────────────────────────────────────────────────── Übungen ── */

/** Winkel α, β eines »schönen« Dreiecks: alle Winkel mindestens 20°. */
function zweiWinkel(r: Zufall) {
  const alpha = ganz(r, 25, 100), beta = ganz(r, 20, 160 - alpha);
  return { alpha, beta, gamma: 180 - alpha - beta };
}

function winkelsumme(r: Zufall): Sachaufgabe<UebungsArt> {
  const { alpha, beta, gamma } = zweiWinkel(r);
  const w = [alpha, beta, gamma], namen = ["α", "β", "γ"];
  const i = ganz(r, 0, 2), j = (i + 1) % 3, k = (i + 2) % 3;
  const txt = (n: number) => (n === i ? `${namen[n]} = ?` : `${namen[n]} = ${GR(w[n])}`);
  return {
    art: "winkelsumme", titel: "Der dritte Winkel",
    text: `In einem Dreieck ist ${namen[j]} = ${GR(w[j])} und ${namen[k]} = ${GR(w[k])}. Wie groß ist ${namen[i]}?`,
    gesucht: [gesucht("w", namen[i], "°", w[i], 0.5, 0)],
    hinweise: ["Die drei Innenwinkel eines Dreiecks ergeben zusammen immer 180°.", `Rechne 180° minus die beiden bekannten Winkel.`],
    loesung: ["α + β + γ = 180°", `${namen[i]} = 180° − ${GR(w[j])} − ${GR(w[k])} = ${GR(w[i])}`],
    skizze: skizzeDreieck(ausWinkeln(6, alpha, beta), { alpha: txt(0), beta: txt(1), gamma: txt(2) }),
  };
}

function arten(r: Zufall): Sachaufgabe<UebungsArt> {
  const [s, w] = eins(r, BLITZ_KLASSEN);
  const ws = blitzWinkel(r, s, w, 0);
  const d = ausWinkeln(6, ws[0], ws[1]);
  const gleich = ws[0] === ws[1] || ws[1] === ws[2] || ws[0] === ws[2];
  return {
    art: "arten", titel: "Welches Dreieck ist das?",
    text: `Ein Dreieck hat die Innenwinkel α = ${GR(ws[0])}, β = ${GR(ws[1])} und γ = ${GR(ws[2])}. Ordne es nach Winkeln und nach Seiten ein.`,
    gesucht: [auswahl("w", "Nach Winkeln", WINKEL_OPT, WINKEL_NAMEN[w]), auswahl("s", "Nach Seiten", SEITEN_OPT, SEITEN_NAMEN[s])],
    hinweise: [
      "Nach Winkeln entscheidet der größte Winkel: unter 90° spitzwinklig, genau 90° rechtwinklig, über 90° stumpfwinklig.",
      "Gleich große Winkel liegen gleich langen Seiten gegenüber: zwei gleiche Winkel → gleichschenklig, drei → gleichseitig.",
    ],
    loesung: [
      `größter Winkel ${GR(Math.max(...ws))} → ${WINKEL_NAMEN[w]}`,
      s === "gleichseitig" ? "alle Winkel 60° → alle Seiten gleich → gleichseitig"
        : gleich ? "zwei Winkel gleich → zwei Seiten gleich → gleichschenklig" : "alle Winkel verschieden → alle Seiten verschieden → unregelmäßig",
    ],
    skizze: skizzeDreieck(d, { alpha: GR(ws[0]), beta: GR(ws[1]), gamma: GR(ws[2]), recht: ws.indexOf(90) >= 0 ? (ws.indexOf(90) as Ecke) : undefined }),
  };
}

/** Punkt hinter C auf der Verlängerung von AC (für den Außenwinkel bei C). */
const verlaengert = (A: Pt, C: Pt, l = 2.5): Pt => {
  const dx = C.x - A.x, dy = C.y - A.y, n = Math.hypot(dx, dy) || 1;
  return P(C.x + dx / n * l, C.y + dy / n * l);
};

function aussenwinkel(r: Zufall): Sachaufgabe<UebungsArt> {
  const { alpha, beta } = zweiWinkel(r);
  const d = ausWinkeln(6, alpha, beta), [A, B, C] = d, E = verlaengert(A, C);
  const aussen = alpha + beta;
  const rueck = r() < 0.4;
  const s = skizzeDreieck(d, { alpha: `α = ${GR(alpha)}`, beta: rueck ? "β = ?" : `β = ${GR(beta)}` });
  s.strecken!.push({ a: C, b: E, art: "hilfe" });
  s.winkel!.push({ p: C, von: B, bis: E, text: rueck ? `γ′ = ${GR(aussen)}` : "γ′ = ?" });
  return rueck ? {
    art: "aussenwinkel", titel: "Außenwinkel rückwärts",
    text: `Der Außenwinkel bei C ist γ′ = ${GR(aussen)}, der Innenwinkel bei A ist α = ${GR(alpha)}. Wie groß ist β?`,
    gesucht: [gesucht("b", "β", "°", beta, 0.5, 0)],
    hinweise: ["Außenwinkelsatz: Ein Außenwinkel ist so groß wie die beiden nicht anliegenden Innenwinkel zusammen.", "Also γ′ = α + β."],
    loesung: ["γ′ = α + β", `β = γ′ − α = ${GR(aussen)} − ${GR(alpha)} = ${GR(beta)}`],
    skizze: s,
  } : {
    art: "aussenwinkel", titel: "Außenwinkel",
    text: `In einem Dreieck ist α = ${GR(alpha)} und β = ${GR(beta)}. Die Seite AC wird über C hinaus verlängert. Wie groß ist der Außenwinkel γ′ bei C?`,
    gesucht: [gesucht("a", "γ′", "°", aussen, 0.5, 0)],
    hinweise: ["Außenwinkelsatz: Ein Außenwinkel ist so groß wie die beiden nicht anliegenden Innenwinkel zusammen.", "Oder: erst γ ausrechnen, dann γ′ = 180° − γ (Nebenwinkel)."],
    loesung: ["γ′ = α + β", `γ′ = ${GR(alpha)} + ${GR(beta)} = ${GR(aussen)}`, `Probe: γ = ${GR(180 - aussen)}, 180° − ${GR(180 - aussen)} = ${GR(aussen)}`],
    skizze: s,
  };
}

function basiswinkel(r: Zufall): Sachaufgabe<UebungsArt> {
  const spitze = r() < 0.5;
  const gamma = spitze ? 2 * ganz(r, 10, 70) : 0;
  const alpha = spitze ? (180 - gamma) / 2 : ganz(r, 20, 80);
  const g = 180 - 2 * alpha;
  const d = ausWinkeln(6, alpha, alpha);
  const sk = skizzeDreieck(d, { a: "s", b: "s", alpha: spitze ? "α = ?" : `α = ${GR(alpha)}`, beta: spitze ? undefined : "β", gamma: spitze ? `γ = ${GR(g)}` : "γ = ?" });
  return spitze ? {
    art: "basiswinkel", titel: "Basiswinkel gesucht",
    text: `Ein gleichschenkliges Dreieck hat an der Spitze den Winkel γ = ${GR(g)}. Wie groß sind die Basiswinkel α und β?`,
    gesucht: [gesucht("a", "α (= β)", "°", alpha, 0.5, 1)],
    hinweise: ["Im gleichschenkligen Dreieck sind die beiden Basiswinkel gleich groß.", "Für beide zusammen bleiben 180° − γ."],
    loesung: ["α = β und α + β + γ = 180°", `2 · α = 180° − ${GR(g)} = ${GR(180 - g)}`, `α = β = ${GR(180 - g)} : 2 = ${GR(alpha)}`],
    skizze: sk,
  } : {
    art: "basiswinkel", titel: "Winkel an der Spitze",
    text: `Ein gleichschenkliges Dreieck hat den Basiswinkel α = ${GR(alpha)}. Wie groß ist der Winkel γ an der Spitze?`,
    gesucht: [gesucht("g", "γ", "°", g, 0.5, 0)],
    hinweise: ["Der zweite Basiswinkel β ist genauso groß wie α.", "γ = 180° − α − β."],
    loesung: [`β = α = ${GR(alpha)}`, `γ = 180° − 2 · ${GR(alpha)} = ${GR(g)}`],
    skizze: sk,
  };
}

function flaecheU(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, ["cm", "m", "dm", "mm"]);
  if (r() < 0.3) {
    const a = ganz(r, 3, 12), b = ganz(r, 3, 12);
    const d: Dreieck = [P(0, 0), P(a, 0), P(0, -b)];
    return {
      art: "flaeche", titel: "Fläche: rechtwinkliges Dreieck",
      text: `Ein rechtwinkliges Dreieck hat die Katheten ${mit(a, e)} und ${mit(b, e)}. Berechne den Flächeninhalt.`,
      gesucht: [gesucht("A", "Fläche A", `${e}²`, a * b / 2)],
      hinweise: ["Die eine Kathete ist die Grundseite, die andere steht senkrecht darauf — sie ist die Höhe.", "A = g · h : 2"],
      loesung: ["A = g · h : 2", `A = ${z(a)} · ${z(b)} : 2 = ${z(a * b)} : 2 = ${mit(a * b / 2, e + "²")}`],
      skizze: skizzeDreieck(d, { c: mit(a, e), b: mit(b, e), recht: 0 }),
    };
  }
  const g = ganz(r, 4, 14), h = ganz(r, 2, 10), p = r() < 0.3 ? -ganz(r, 1, 3) : ganz(r, 1, g - 1);
  const d: Dreieck = [P(0, 0), P(g, 0), P(p, -h)];
  return {
    art: "flaeche", titel: "Fläche eines Dreiecks",
    text: `Ein Dreieck hat die Grundseite g = ${mit(g, e)} und die zugehörige Höhe h = ${mit(h, e)}. Berechne den Flächeninhalt.`,
    gesucht: [gesucht("A", "Fläche A", `${e}²`, g * h / 2)],
    hinweise: ["Zwei gleiche Dreiecke ergeben zusammen ein Parallelogramm mit A = g · h.", "Ein Dreieck ist die Hälfte davon: A = g · h : 2." + (p < 0 ? " Die Höhe darf außerhalb liegen." : "")],
    loesung: ["A = g · h : 2", `A = ${z(g)} · ${z(h)} : 2 = ${z(g * h)} : 2 = ${mit(g * h / 2, e + "²")}`],
    skizze: { ...skizzeDreieck(d, { c: `g = ${mit(g, e)}`, hoehe: { von: 2, text: `h = ${mit(h, e)}` } }), nichtMassstaeblich: true },
  };
}

/** Drei Seiten mit Dreiecksungleichung (jede kürzer als die beiden anderen zusammen, mit Luft). */
function dreiSeiten(r: Zufall, dezimal: boolean) {
  for (;;) {
    const s = [0, 1, 2].map(() => (dezimal ? ganz(r, 20, 120) / 10 : ganz(r, 3, 15)));
    const [a, b, c] = s;
    if (a + b > c * 1.15 && b + c > a * 1.15 && a + c > b * 1.15) return { a, b, c };
  }
}

function umfangU(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, ["cm", "m", "dm"]);
  const gl = r() < 0.3;
  const { a: a0, b, c } = dreiSeiten(r, r() < 0.4);
  const a = gl ? b : a0;
  const u = a + b + c;
  return {
    art: "umfang", titel: gl ? "Umfang: gleichschenkliges Dreieck" : "Umfang eines Dreiecks",
    text: gl
      ? `Ein gleichschenkliges Dreieck hat die Basis c = ${mit(c, e)} und zwei Schenkel von je ${mit(b, e)}. Wie groß ist der Umfang?`
      : `Ein Dreieck hat die Seiten a = ${mit(a, e)}, b = ${mit(b, e)} und c = ${mit(c, e)}. Wie groß ist der Umfang?`,
    gesucht: [gesucht("u", "Umfang u", e, u)],
    hinweise: ["Der Umfang ist einmal ganz außen herum: alle drei Seiten zusammen.", gl ? "Beide Schenkel sind gleich lang — zähle den Schenkel zweimal." : "u = a + b + c"],
    loesung: [gl ? "u = 2 · s + c" : "u = a + b + c", gl ? `u = 2 · ${z(b)} + ${z(c)} = ${mit(u, e)}` : `u = ${z(a)} + ${z(b)} + ${z(c)} = ${mit(u, e)}`],
    skizze: skizzeDreieck(ausSeiten(a, b, c), { a: gl ? "s" : `a = ${mit(a, e)}`, b: gl ? `s = ${mit(b, e)}` : `b = ${mit(b, e)}`, c: `c = ${mit(c, e)}` }),
  };
}

function rueckwaerts(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, ["cm", "m"]);
  if (r() < 0.5) {
    const g = ganz(r, 4, 14), h = ganz(r, 2, 12), A = g * h / 2;
    const p = ganz(r, 1, g - 1);
    return {
      art: "rueckwaerts", titel: "Höhe gesucht",
      text: `Ein Dreieck hat den Flächeninhalt A = ${mit(A, e + "²")} und die Grundseite g = ${mit(g, e)}. Wie lang ist die Höhe h auf g?`,
      gesucht: [gesucht("h", "Höhe h", e, h)],
      hinweise: ["Setze in A = g · h : 2 ein, was du kennst.", "Rückwärts: erst · 2, dann : g."],
      loesung: [`${z(A)} = ${z(g)} · h : 2`, `h = 2 · A : g = 2 · ${z(A)} : ${z(g)} = ${mit(h, e)}`],
      skizze: { ...skizzeDreieck([P(0, 0), P(g, 0), P(p, -h)], { c: `g = ${mit(g, e)}`, hoehe: { von: 2, text: "h = ?" } }), nichtMassstaeblich: true },
    };
  }
  const { a, b, c } = dreiSeiten(r, false), u = a + b + c;
  return {
    art: "rueckwaerts", titel: "Dritte Seite gesucht",
    text: `Ein Dreieck hat den Umfang u = ${mit(u, e)}. Zwei Seiten sind a = ${mit(a, e)} und b = ${mit(b, e)} lang. Wie lang ist c?`,
    gesucht: [gesucht("c", "Seite c", e, c)],
    hinweise: ["u = a + b + c", "Ziehe die bekannten Seiten vom Umfang ab."],
    loesung: [`c = u − a − b = ${z(u)} − ${z(a)} − ${z(b)} = ${mit(c, e)}`],
    skizze: skizzeDreieck(ausSeiten(a, b, c), { a: `a = ${mit(a, e)}`, b: `b = ${mit(b, e)}`, c: "c = ?" }),
  };
}

const TRIPEL: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]];

function pythagoras(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, ["cm", "m"]);
  let a: number, b: number;
  if (r() < 0.5) { const [x, y] = eins(r, TRIPEL), k = ganz(r, 1, 3); [a, b] = r() < 0.5 ? [x * k, y * k] : [y * k, x * k]; }
  else { a = ganz(r, 2, 12); b = ganz(r, 2, 12); }
  const c = Math.hypot(a, b);
  const d: Dreieck = [P(0, 0), P(a, 0), P(0, -b)];
  // rechter Winkel bei A: Katheten AB (= c im Bild) und AC (= b im Bild), Hypotenuse BC
  if (r() < 0.5) {
    return {
      art: "pythagoras", titel: "Hypotenuse gesucht",
      text: `Ein rechtwinkliges Dreieck hat die Katheten ${mit(a, e)} und ${mit(b, e)}. Wie lang ist die Hypotenuse? (auf eine Nachkommastelle)`,
      gesucht: [gesucht("c", "Hypotenuse", e, c, 0.06, 1)],
      hinweise: ["Satz des Pythagoras: Kathete² + Kathete² = Hypotenuse².", "Die Hypotenuse liegt dem rechten Winkel gegenüber und ist die längste Seite."],
      loesung: [`c² = ${z(a)}² + ${z(b)}² = ${z(a * a)} + ${z(b * b)} = ${z(a * a + b * b)}`, `c = √${z(a * a + b * b)} ≈ ${mit(Math.round(c * 10) / 10, e)}`],
      skizze: skizzeDreieck(d, { c: mit(a, e), b: mit(b, e), a: "?", recht: 0 }),
    };
  }
  return {
    art: "pythagoras", titel: "Kathete gesucht",
    text: `In einem rechtwinkligen Dreieck ist die Hypotenuse ${mit(Math.round(c * 10) / 10, e)} lang, eine Kathete ${mit(a, e)}. Wie lang ist die andere Kathete? (auf eine Nachkommastelle)`,
    gesucht: [gesucht("b", "Kathete", e, Math.sqrt((Math.round(c * 10) / 10) ** 2 - a * a), 0.08, 1)],
    hinweise: ["Satz des Pythagoras: Kathete² + Kathete² = Hypotenuse².", "Umgestellt: Kathete² = Hypotenuse² − Kathete²."],
    loesung: (() => { const h = Math.round(c * 10) / 10, q = h * h - a * a; return [`b² = ${z(h)}² − ${z(a)}² = ${z(h * h)} − ${z(a * a)} = ${z(q)}`, `b = √${z(q)} ≈ ${mit(Math.round(Math.sqrt(q) * 10) / 10, e)}`]; })(),
    skizze: skizzeDreieck(d, { c: mit(a, e), b: "?", a: mit(Math.round(c * 10) / 10, e), recht: 0 }),
  };
}

function kongruenz(r: Zufall): Sachaufgabe<UebungsArt> {
  const fall = eins(r, ["SSS", "SWS", "WSW", "SsW", "WWW", "Ssw"] as const);
  let alpha = ganz(r, 30, 95), beta = ganz(r, 25, 150 - alpha);
  if (alpha === beta) beta += 3;
  // SsW braucht den Winkel gegenüber der längeren Seite (α > β ⇔ a > b), der Gegenfall ist nicht eindeutig.
  if ((fall === "SsW" && alpha < beta) || (fall === "Ssw" && alpha > beta)) [alpha, beta] = [beta, alpha];
  const d = ausWinkeln(ganz(r, 5, 9), alpha, beta), s = seitenLaengen(d), gamma = 180 - alpha - beta;
  const L = (x: number) => `${z(Math.round(x * 10) / 10)} cm`;
  const teile: Record<typeof fall, [string, Beschriftung]> = {
    SSS: [`a = ${L(s.a)}, b = ${L(s.b)}, c = ${L(s.c)}`, { a: L(s.a), b: L(s.b), c: L(s.c) }],
    SWS: [`b = ${L(s.b)}, c = ${L(s.c)} und α = ${GR(alpha)}`, { b: L(s.b), c: L(s.c), alpha: GR(alpha) }],
    WSW: [`c = ${L(s.c)}, α = ${GR(alpha)} und β = ${GR(beta)}`, { c: L(s.c), alpha: GR(alpha), beta: GR(beta) }],
    SsW: [`a = ${L(s.a)}, b = ${L(s.b)} und α = ${GR(alpha)}`, { a: L(s.a), b: L(s.b), alpha: GR(alpha) }],
    Ssw: [`a = ${L(s.a)}, b = ${L(s.b)} und α = ${GR(alpha)}`, { a: L(s.a), b: L(s.b), alpha: GR(alpha) }],
    WWW: [`α = ${GR(alpha)}, β = ${GR(beta)} und γ = ${GR(gamma)}`, { alpha: GR(alpha), beta: GR(beta), gamma: GR(gamma) }],
  };
  const richtig = fall === "WWW" || fall === "Ssw" ? "nicht eindeutig" : fall;
  const warum: Record<typeof fall, string> = {
    SSS: "Drei Seiten gegeben → SSS: Das Dreieck ist eindeutig.",
    SWS: "Zwei Seiten und der eingeschlossene Winkel (α liegt zwischen b und c) → SWS.",
    WSW: "Eine Seite und die beiden anliegenden Winkel (α und β liegen an c) → WSW.",
    SsW: "Zwei Seiten und der Winkel gegenüber der längeren (a > b, α liegt a gegenüber) → SsW.",
    Ssw: "Der Winkel α liegt der kürzeren Seite a gegenüber (a < b) → es kann zwei verschiedene Dreiecke geben.",
    WWW: "Nur Winkel: Man kann das Dreieck beliebig vergrößern oder verkleinern → nicht eindeutig.",
  };
  return {
    art: "kongruenz", titel: "Welcher Kongruenzsatz?",
    text: `Gegeben sind ${teile[fall][0]}. Ist das Dreieck damit eindeutig festgelegt? Wenn ja, nach welchem Kongruenzsatz?`,
    gesucht: [auswahl("k", "Kongruenzsatz", SAETZE, richtig)],
    hinweise: [
      "S steht für eine Seite, W für einen Winkel. Achte darauf, ob der Winkel zwischen den Seiten liegt oder gegenüber.",
      "SsW gilt nur, wenn der Winkel der längeren der beiden Seiten gegenüberliegt. Drei Winkel allein legen die Größe nicht fest.",
    ],
    loesung: [warum[fall]],
    skizze: { ...skizzeDreieck(d, teile[fall][1]), nichtMassstaeblich: true },
  };
}

function thales(r: Zufall): Sachaufgabe<UebungsArt> {
  const alpha = ganz(r, 20, 70), R = 4;
  const M = P(R, 0), C = P(R + R * Math.cos(2 * alpha * RAD), -R * Math.sin(2 * alpha * RAD));
  const d: Dreieck = [P(0, 0), P(2 * R, 0), C];
  const s = skizzeDreieck(d, { alpha: `α = ${GR(alpha)}`, beta: "β = ?", recht: 2 });
  s.kreise = [{ m: M, r: R, gestrichelt: true, deckkraft: 0 }];
  s.marken!.push({ p: P(R, 0.45), text: "M", groesse: 13 });
  return {
    art: "thales", titel: "Satz des Thales",
    text: `Die Strecke AB ist ein Durchmesser des Kreises, C liegt auf dem Kreis. Bei A misst der Winkel α = ${GR(alpha)}. Wie groß ist β?`,
    gesucht: [gesucht("b", "β", "°", 90 - alpha, 0.5, 0)],
    hinweise: ["Satz des Thales: Liegt C auf dem Halbkreis über AB, ist der Winkel bei C ein rechter Winkel.", "Dann bleiben für α + β genau 90°."],
    loesung: ["γ = 90° (Thales)", `β = 180° − 90° − ${GR(alpha)} = ${GR(90 - alpha)}`],
    skizze: s,
  };
}

export function erzeugeUebung(art: UebungsArt, r: Zufall = Math.random): Sachaufgabe<UebungsArt> {
  switch (art) {
    case "winkelsumme": return winkelsumme(r);
    case "arten": return arten(r);
    case "aussenwinkel": return aussenwinkel(r);
    case "basiswinkel": return basiswinkel(r);
    case "flaeche": return flaecheU(r);
    case "umfang": return umfangU(r);
    case "rueckwaerts": return rueckwaerts(r);
    case "pythagoras": return pythagoras(r);
    case "kongruenz": return kongruenz(r);
    case "thales": return thales(r);
  }
}

/* ──────────────────────────────────────────────────────── Anwendungen ── */

const HOLZ = "#b45309", GRUEN = "#16a34a", ROT = "#dc2626", BLAU = "#0284c7", GRAU = "#6b7280";
const e1 = (x: number) => Math.round(x * 10) / 10;

export function erzeugeAnwendung(art: AnwendungsArt, r: Zufall = Math.random): Sachaufgabe<AnwendungsArt> {
  switch (art) {
    case "giebel": {
      const b = ganz(r, 6, 12), h = ganz(r, 3, 6), proL = eins(r, [6, 8, 10]), A = b * h / 2, L = 2 * A / proL;
      const d: Dreieck = [P(0, 0), P(b, 0), P(b / 2, -h)];
      const s = skizzeDreieck(d, { c: `${b} m`, hoehe: { von: 2, text: `${h} m` }, namen: false, farbe: HOLZ });
      s.flaechen!.unshift({ pts: rechteck(0, 0, b, h * 0.9), farbe: GRAU, deckkraft: 0.12 });
      return {
        art, titel: "Giebel streichen",
        text: `Der dreieckige Giebel eines Hauses ist unten ${b} m breit und ${h} m hoch. Er wird zweimal gestrichen; 1 Liter Farbe reicht für ${proL} m². Wie groß ist die Giebelfläche und wie viel Farbe braucht man?`,
        gesucht: [gesucht("A", "Giebelfläche", "m²", A), gesucht("L", "Farbe", "l", L)],
        hinweise: ["Der Giebel ist ein Dreieck: A = g · h : 2.", "Zweimal streichen heißt doppelte Fläche.", `Liter = Fläche · 2 : ${proL}`],
        loesung: [`A = ${b} · ${h} : 2 = ${z(A)} m²`, `Farbe = ${z(A)} · 2 : ${proL} = ${z(L)} l`],
        skizze: s,
      };
    }
    case "segel": {
      const m = ganz(r, 4, 9), b = ganz(r, 2, 5), preis = ganz(r, 18, 45), A = m * b / 2;
      const d: Dreieck = [P(0, 0), P(b, 0), P(0, -m)];
      const s = skizzeDreieck(d, { c: `${b} m`, b: `${m} m`, recht: 0, namen: false, farbe: BLAU });
      s.marken = [{ p: P(b * 0.7, 0.8), text: "⛵", groesse: 28 }];
      return {
        art, titel: "Ein Segel nähen",
        text: `Ein Segel ist ein rechtwinkliges Dreieck: Es ist ${m} m am Mast hoch und ${b} m am Baum lang. Segeltuch kostet ${preis} € pro m². Wie groß ist das Segel und was kostet das Tuch?`,
        gesucht: [gesucht("A", "Segelfläche", "m²", A), gesucht("p", "Preis", "€", A * preis)],
        hinweise: ["Mast und Baum stehen senkrecht aufeinander — der eine ist Grundseite, der andere Höhe.", "A = g · h : 2, dann mal Preis pro m²."],
        loesung: [`A = ${m} · ${b} : 2 = ${z(A)} m²`, `Preis = ${z(A)} · ${preis} € = ${z(A * preis)} €`],
        skizze: s,
      };
    }
    case "leiter": {
      const l = ganz(r, 8, 16) / 2, a = eins(r, [1, 1.2, 1.5, 1.8, 2]), h = Math.sqrt(l * l - a * a);
      const d: Dreieck = [P(0, 0), P(a, 0), P(0, -h)];
      const s = skizzeDreieck(d, { c: `${z(a)} m`, a: `${z(l)} m`, b: "h = ?", recht: 0, namen: false, farbe: HOLZ });
      s.flaechen!.push({ pts: rechteck(-0.6, -h - 0.4, 0.6, h + 0.4), farbe: GRAU, deckkraft: 0.3 });
      s.marken = [{ p: P(a * 0.75, -h * 0.55), text: "🪜", groesse: 24 }];
      return {
        art, titel: "Wie hoch reicht die Leiter?",
        text: `Eine ${z(l)} m lange Leiter lehnt an einer Hauswand. Unten steht sie ${z(a)} m von der Wand entfernt. In welcher Höhe berührt sie die Wand? (auf zwei Nachkommastellen)`,
        gesucht: [gesucht("h", "Höhe", "m", h)],
        hinweise: ["Wand und Boden bilden einen rechten Winkel — die Leiter ist die Hypotenuse.", "Pythagoras: h² = Leiter² − Abstand²."],
        loesung: [`h² = ${z(l)}² − ${z(a)}² = ${z(l * l)} − ${z(a * a)} = ${z(l * l - a * a)}`, `h = √${z(l * l - a * a)} ≈ ${z(h)} m`],
        skizze: s,
      };
    }
    case "abkuerzung": {
      const a = ganz(r, 30, 80), b = ganz(r, 20, 60), d0 = Math.hypot(a, b), spar = a + b - d0;
      const pts = rechteck(0, 0, a, b);
      return {
        art, titel: "Quer über die Wiese",
        text: `Der Schulweg führt um eine rechteckige Wiese herum: ${a} m geradeaus, dann ${b} m nach rechts. Quer über die Wiese wäre es kürzer. Wie lang ist der Weg quer hinüber und wie viele Meter spart man?`,
        gesucht: [gesucht("d", "Weg quer", "m", d0), gesucht("s", "Ersparnis", "m", spar, 1)],
        hinweise: ["Die beiden Wegstücke stehen senkrecht aufeinander, der Weg quer ist die Hypotenuse.", "Pythagoras, dann (a + b) minus Weg quer."],
        loesung: [`d² = ${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b}`, `d = √${a * a + b * b} ≈ ${z(d0)} m`, `Ersparnis = ${a + b} − ${z(d0)} ≈ ${z(spar)} m`],
        skizze: {
          flaechen: [{ pts, farbe: GRUEN, deckkraft: 0.22 }],
          strecken: [{ a: pts[3], b: pts[2], text: `${a} m` }, { a: pts[2], b: pts[1], text: `${b} m` }, { a: pts[3], b: pts[1], text: "?", art: "gesucht" }],
          winkel: [{ p: pts[2], von: pts[3], bis: pts[1], recht: true }],
          marken: [{ p: pts[3], text: "🚶", groesse: 22 }, { p: pts[1], text: "🏫", groesse: 22 }],
        },
      };
    }
    case "wimpel": {
      const n = ganz(r, 10, 24), b = ganz(r, 15, 25), h = ganz(r, 20, 35), A = b * h / 2;
      const d: Dreieck = [P(0, 0), P(b, 0), P(b / 2, h)];
      const s = skizzeDreieck(d, { c: `${b} cm`, hoehe: { von: 2, text: `${h} cm` }, namen: false, farbe: ROT });
      s.strecken!.push({ a: P(-b * 0.6, 0), b: P(b * 1.6, 0), art: "hilfe" });
      return {
        art, titel: "Wimpelkette fürs Schulfest",
        text: `Für eine Wimpelkette werden ${n} gleiche Wimpel genäht. Jeder ist ein gleichschenkliges Dreieck, oben ${b} cm breit und ${h} cm lang (Höhe). Wie viel Stoff braucht ein Wimpel, und wie viele m² sind es für alle?`,
        gesucht: [gesucht("A", "Ein Wimpel", "cm²", A), gesucht("G", "Alle Wimpel", "m²", n * A / 10000)],
        hinweise: ["A = g · h : 2 für einen Wimpel.", "Mal Anzahl, dann umrechnen: 1 m² = 10 000 cm²."],
        loesung: [`A = ${b} · ${h} : 2 = ${z(A)} cm²`, `${n} · ${z(A)} cm² = ${z(n * A)} cm² = ${z(n * A / 10000, 4)} m²`],
        skizze: s,
      };
    }
    case "beet": {
      const c = ganz(r, 4, 8), h = ganz(r, 2, 5), p = ganz(r, 1, c - 1);
      const a = e1(Math.hypot(c - p, h)), b = e1(Math.hypot(p, h)), u = a + b + c;
      const d: Dreieck = [P(0, 0), P(c, 0), P(p, -h)];
      return {
        art, titel: "Ein dreieckiges Beet",
        text: `Ein Blumenbeet hat die Form eines Dreiecks mit den Seiten ${z(c)} m, ${z(a)} m und ${z(b)} m. Die Höhe auf die ${c}-m-Seite ist ${h} m. Das Beet bekommt einen niedrigen Zaun. Wie lang wird der Zaun und wie groß ist das Beet?`,
        gesucht: [gesucht("u", "Zaun", "m", u), gesucht("A", "Beetfläche", "m²", c * h / 2)],
        hinweise: ["Zaun = Umfang: alle drei Seiten zusammen.", `Fläche: A = g · h : 2 mit g = ${c} m.`],
        loesung: [`u = ${z(c)} + ${z(a)} + ${z(b)} = ${z(u)} m`, `A = ${c} · ${h} : 2 = ${z(c * h / 2)} m²`],
        skizze: { ...skizzeDreieck(d, { c: `${c} m`, a: `${z(a)} m`, b: `${z(b)} m`, hoehe: { von: 2, text: `${h} m` }, namen: false, farbe: GRUEN }), marken: [{ p: P(p * 0.6 + c * 0.2, -h * 0.3), text: "🌷", groesse: 22 }] },
      };
    }
    case "schild": {
      const a = eins(r, [63, 90, 126]), h = e1(a * Math.sqrt(3) / 2), n = ganz(r, 5, 20), A = a * h / 2;
      const d: Dreieck = [P(0, 0), P(a, 0), P(a / 2, -a * Math.sqrt(3) / 2)];
      const s = skizzeDreieck(d, { c: `${a} cm`, hoehe: { von: 2, text: `${z(h)} cm` }, namen: false, farbe: ROT });
      s.marken = [{ p: P(a / 2, -h * 0.3), text: "❗", groesse: 26 }];
      return {
        art, titel: "Reflexfolie für Warnschilder",
        text: `Ein Gefahrzeichen ist ein gleichseitiges Dreieck mit ${a} cm Seitenlänge; seine Höhe ist ${z(h)} cm. Die Straßenmeisterei beklebt ${n} Schilder ganz mit Reflexfolie. Wie groß ist ein Schild, und wie viele m² Folie braucht man?`,
        gesucht: [gesucht("A", "Ein Schild", "cm²", A), gesucht("F", "Folie", "m²", n * A / 10000)],
        hinweise: ["A = g · h : 2 mit g = Seitenlänge.", "Mal Anzahl der Schilder, dann : 10 000 für m²."],
        loesung: [`A = ${a} · ${z(h)} : 2 = ${z(A)} cm²`, `${n} · ${z(A)} cm² = ${z(n * A)} cm² ≈ ${z(n * A / 10000)} m²`],
        skizze: s,
      };
    }
    case "dachneigung": {
      const alpha = ganz(r, 25, 55), g = 180 - 2 * alpha;
      const d = ausWinkeln(10, alpha, alpha);
      const s = skizzeDreieck(d, { alpha: `${alpha}°`, gamma: "First ?", namen: false, farbe: HOLZ });
      const E = P(-2.5, 0);
      s.strecken!.push({ a: E, b: d[0], art: "hilfe" });
      s.winkel!.push({ p: d[0], von: d[2], bis: E, text: "außen ?" });
      s.flaechen!.push({ pts: rechteck(0.5, 0, 9, 4), farbe: GRAU, deckkraft: 0.12 });
      return {
        art, titel: "Wie steil ist das Dach?",
        text: `Ein Satteldach ist von vorn gesehen ein gleichschenkliges Dreieck. Die Dachneigung (Winkel zwischen Sparren und Dachboden) beträgt ${alpha}°. Welcher Winkel entsteht oben am First? Und welchen Winkel bildet der Sparren außen mit der verlängerten Dachrinne?`,
        gesucht: [gesucht("g", "Winkel am First", "°", g, 0.5, 0), gesucht("w", "Winkel außen", "°", 180 - alpha, 0.5, 0)],
        hinweise: ["Beide Dachseiten sind gleich steil — die Basiswinkel sind gleich.", "Am First bleibt 180° − 2 · Neigung.", "Außen: Nebenwinkel, zusammen 180°."],
        loesung: [`First = 180° − 2 · ${alpha}° = ${g}°`, `außen = 180° − ${alpha}° = ${180 - alpha}°`],
        skizze: s,
      };
    }
  }
}

/* ───────────────────────────────────────────────────────── Spiel ── */

/** Die sieben möglichen Kombinationen (gleichseitig geht nur spitzwinklig). */
export const BLITZ_KLASSEN: [NachSeiten, NachWinkeln][] = [
  ["gleichseitig", "spitzwinklig"],
  ["gleichschenklig", "spitzwinklig"], ["gleichschenklig", "rechtwinklig"], ["gleichschenklig", "stumpfwinklig"],
  ["unregelmaessig", "spitzwinklig"], ["unregelmaessig", "rechtwinklig"], ["unregelmaessig", "stumpfwinklig"],
];

/**
 * Drei ganzzahlige Innenwinkel zu einer Einordnung. Ab Stufe 2 liegen sie
 * knapp an der Grenze (88°, 92°, Basiswinkel 59° …).
 */
export function blitzWinkel(r: Zufall, s: NachSeiten, w: NachWinkeln, stufe: number): [number, number, number] {
  const knapp = stufe >= 2;
  if (s === "gleichseitig") return [60, 60, 60];
  if (s === "gleichschenklig") {
    if (w === "rechtwinklig") return [45, 45, 90];
    let b = w === "spitzwinklig" ? (knapp ? eins(r, [46, 47, 58, 59, 61, 62]) : ganz(r, 48, 80)) : (knapp ? ganz(r, 40, 44) : ganz(r, 20, 40));
    if (b === 60) b = 64;
    return [b, b, 180 - 2 * b];
  }
  if (w === "rechtwinklig") {
    let x = knapp ? ganz(r, 40, 50) : ganz(r, 20, 70);
    if (x === 45) x = 42;
    return [x, 90 - x, 90];
  }
  const abst = knapp ? 3 : 8;
  for (let i = 0; ; i++) {
    let ws: number[];
    if (w === "stumpfwinklig") {
      const g = knapp ? ganz(r, 92, 97) : ganz(r, 100, 140), a = ganz(r, 15, 165 - g);
      ws = [a, 180 - g - a, g];
    } else {
      const a = ganz(r, 30, 85), b = ganz(r, 30, 85);
      ws = [a, b, 180 - a - b];
      if (ws[2] >= 90 || ws[2] < 20 || (knapp && Math.max(...ws) < 84)) continue;
    }
    const [a, b, c] = [...ws].sort((x, y) => x - y);
    if ((b - a >= abst && c - b >= abst) || i > 500) return ws as [number, number, number];
  }
}

/** Ein Dreieck fürs Spiel: Winkel gemischt auf die Ecken verteilt, ab Stufe 1 gedreht. */
export function blitzDreieck(stufe: number, r: Zufall = Math.random) {
  const [s, w] = eins(r, BLITZ_KLASSEN);
  const ws = blitzWinkel(r, s, w, stufe).sort(() => r() - 0.5) as [number, number, number];
  let d = ausWinkeln(6, ws[0], ws[1]);
  if (stufe >= 1) {
    const t = r() * 2 * Math.PI, c = Math.cos(t), sn = Math.sin(t);
    d = d.map(p => P(p.x * c - p.y * sn, p.x * sn + p.y * c)) as Dreieck;
  }
  return { seiten: s, winkel: w, ws, d };
}

/** Prüft die Einordnung eines Spiel-Dreiecks über seine Lage (für Tests). */
export const ordneEin = (d: Dreieck) => [nachSeiten(d), nachWinkeln(d)] as const;
