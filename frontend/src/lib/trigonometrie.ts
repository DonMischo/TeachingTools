/**
 * Trigonometrie — reine Rechnung, ohne Oberfläche.
 *
 * Winkel immer in Grad. Dreiecke wie im Unterricht beschriftet: Ecken A, B, C,
 * gegenüber die Seiten a, b, c, an den Ecken die Winkel α, β, γ. Im
 * rechtwinkligen Dreieck liegt der rechte Winkel bei C, c ist die Hypotenuse.
 */
import { z } from "@/lib/prozent";

export const RAD = Math.PI / 180;
export const sinG = (w: number) => Math.sin(w * RAD);
export const cosG = (w: number) => Math.cos(w * RAD);
export const tanG = (w: number) => Math.tan(w * RAD);
const asinG = (x: number) => Math.asin(Math.max(-1, Math.min(1, x))) / RAD;
const acosG = (x: number) => Math.acos(Math.max(-1, Math.min(1, x))) / RAD;
const atanG = (x: number) => Math.atan(x) / RAD;

/** Winkel auf [0, 360) */
export const normiere = (w: number) => ((w % 360) + 360) % 360;

/** Seite bzw. Winkel so, wie er in Rechnungen steht */
export const zs = (x: number) => z(x, 2);
export const zw = (x: number) => z(x, 1) + "°";

/* ─────────────────────────────────────────────────────── Einheitskreis ── */

export function quadrant(w: number): 1 | 2 | 3 | 4 | 0 {
  const n = normiere(w);
  if (n % 90 === 0) return 0; // auf einer Achse
  return (Math.floor(n / 90) + 1) as 1 | 2 | 3 | 4;
}

const EXAKT: Record<number, [string, string, string]> = {
  0: ["0", "1", "0"],
  30: ["½", "½√3", "⅓√3"],
  45: ["½√2", "½√2", "1"],
  60: ["½√3", "½", "√3"],
  90: ["1", "0", "–"],
};

/** Exakte Werte an den besonderen Winkeln (Vielfache von 30° und 45°), sonst null. */
export function exakt(w: number): { sin: string; cos: string; tan: string } | null {
  const n = Math.round(normiere(w) * 1e6) / 1e6;
  if (!Number.isInteger(n) || (n % 30 && n % 45)) return null;
  const ref = n <= 90 ? n : n <= 180 ? 180 - n : n <= 270 ? n - 180 : 360 - n;
  const [s, c, t] = EXAKT[ref];
  const vz = (x: number, txt: string) => (Math.abs(x) < 1e-9 || txt === "0" ? "0" : x < 0 ? "−" + txt : txt);
  return {
    sin: vz(sinG(n), s),
    cos: vz(cosG(n), c),
    tan: n % 180 === 90 ? "nicht definiert" : vz(sinG(n) * cosG(n), t),
  };
}

/* ────────────────────────────────────────────────────────────── Dreieck ── */

export type Seite = "a" | "b" | "c";
export type Winkel = "alpha" | "beta" | "gamma";
export type Groesse = Seite | Winkel;
export type Dreieck = Record<Groesse, number>;
export type Gegeben = Partial<Dreieck>;

export const SEITEN: Seite[] = ["a", "b", "c"];
export const WINKEL: Winkel[] = ["alpha", "beta", "gamma"];
export const GROESSEN: Groesse[] = [...SEITEN, ...WINKEL];
export const ZEICHEN: Record<Groesse, string> = { a: "a", b: "b", c: "c", alpha: "α", beta: "β", gamma: "γ" };
export const ECKE: Record<Winkel, "A" | "B" | "C"> = { alpha: "A", beta: "B", gamma: "C" };
export const GEGENUEBER: Record<Seite, Winkel> & Record<Winkel, Seite> = {
  a: "alpha", b: "beta", c: "gamma", alpha: "a", beta: "b", gamma: "c",
};
export const istSeite = (g: Groesse): g is Seite => g === "a" || g === "b" || g === "c";
export const wert = (g: Groesse, x: number) => (istSeite(g) ? zs(x) : zw(x));

export type Fall = "SSS" | "SWS" | "SSW" | "WSW" | "WWS" | "rechtwinklig";
export const FAELLE: Record<Fall, { name: string; satz: string }> = {
  SSS: { name: "SSS — drei Seiten", satz: "Kosinussatz, nach dem Winkel umgestellt" },
  SWS: { name: "SWS — zwei Seiten und der Winkel dazwischen", satz: "Kosinussatz für die dritte Seite" },
  SSW: { name: "SsW — zwei Seiten und ein Winkel, der nicht dazwischen liegt", satz: "Sinussatz — Vorsicht: es kann 0, 1 oder 2 Dreiecke geben" },
  WSW: { name: "WSW — eine Seite und die beiden Winkel daran", satz: "Winkelsumme, dann Sinussatz" },
  WWS: { name: "WWS — eine Seite und zwei Winkel, einer davon gegenüber", satz: "Winkelsumme, dann Sinussatz" },
  rechtwinklig: { name: "rechtwinklig — γ = 90°", satz: "sin, cos, tan als Seitenverhältnisse und Pythagoras" },
};

export type Schritt = { text: string; rechnung: string };
export type Loesung = {
  fall: Fall | null;
  dreiecke: Dreieck[];
  /** je Dreieck der Rechenweg; bei zwei Lösungen teilen sie sich den Anfang */
  schritte: Schritt[][];
  /** Begründung, wenn es kein oder kein eindeutiges Dreieck gibt */
  hinweis?: string;
  fehler?: string;
};

const fehler = (text: string, fall: Fall | null = null): Loesung => ({ fall, dreiecke: [], schritte: [], fehler: text });

/** Was die drei Angaben für ein Fall sind. */
export function fallVon(g: Gegeben): Fall | null {
  const s = SEITEN.filter(k => g[k] !== undefined);
  const w = WINKEL.filter(k => g[k] !== undefined);
  if (s.length + w.length !== 3 || !s.length) return null;
  if (s.length === 3) return "SSS";
  if (s.length === 2) return g[GEGENUEBER[SEITEN.find(k => g[k] === undefined)!]] !== undefined ? "SWS" : "SSW";
  return g[GEGENUEBER[s[0]]] === undefined ? "WSW" : "WWS";
}

/** Löst ein beliebiges Dreieck aus genau drei Angaben (mindestens eine Seite). */
export function loese(g: Gegeben): Loesung {
  for (const k of GROESSEN) {
    const x = g[k];
    if (x === undefined) continue;
    if (!(x > 0)) return fehler(`${ZEICHEN[k]} muss größer als 0 sein.`);
    if (!istSeite(k) && x >= 180) return fehler(`${ZEICHEN[k]} muss kleiner als 180° sein.`);
  }
  const anzahl = GROESSEN.filter(k => g[k] !== undefined).length;
  if (anzahl !== 3) return fehler("Ein Dreieck ist durch genau drei Angaben festgelegt — gib genau drei an.");
  const fall = fallVon(g);
  if (!fall) return fehler("Drei Winkel legen nur die Form fest, nicht die Größe — mindestens eine Seite muss dabei sein.");
  const d = { ...g } as Dreieck;
  const sch: Schritt[] = [];

  if (fall === "SSS") {
    const [a, b, c] = [d.a, d.b, d.c];
    const [x, y] = [Math.max(a, b, c), a + b + c - Math.max(a, b, c)];
    if (x >= y) return { ...fehler(`Die längste Seite (${zs(x)}) muss kürzer sein als die beiden anderen zusammen (${zs(y)}) — sonst klappt das Dreieck nicht zu.`, fall), hinweis: "Dreiecksungleichung" };
    for (const w of ["alpha", "beta"] as Winkel[]) {
      const s = GEGENUEBER[w], [p, q] = SEITEN.filter(k => k !== s);
      d[w] = acosG((d[p] ** 2 + d[q] ** 2 - d[s] ** 2) / (2 * d[p] * d[q]));
      sch.push({
        text: `Kosinussatz nach ${ZEICHEN[w]} umgestellt`,
        rechnung: `cos ${ZEICHEN[w]} = (${p}² + ${q}² − ${s}²) / (2·${p}·${q}) = (${zs(d[p])}² + ${zs(d[q])}² − ${zs(d[s])}²) / (2·${zs(d[p])}·${zs(d[q])}) = ${z(cosG(d[w]), 4)}  ⇒  ${ZEICHEN[w]} = ${zw(d[w])}`,
      });
    }
    d.gamma = 180 - d.alpha - d.beta;
    sch.push({ text: "Winkelsumme 180°", rechnung: `γ = 180° − ${zw(d.alpha)} − ${zw(d.beta)} = ${zw(d.gamma)}` });
    return { fall, dreiecke: [d], schritte: [sch] };
  }

  if (fall === "SWS") {
    const s = SEITEN.find(k => g[k] === undefined)!, w = GEGENUEBER[s], [p, q] = SEITEN.filter(k => k !== s);
    d[s] = Math.sqrt(d[p] ** 2 + d[q] ** 2 - 2 * d[p] * d[q] * cosG(d[w]));
    sch.push({
      text: `Kosinussatz für die Seite ${s} gegenüber von ${ZEICHEN[w]}`,
      rechnung: `${s}² = ${p}² + ${q}² − 2·${p}·${q}·cos ${ZEICHEN[w]} = ${zs(d[p])}² + ${zs(d[q])}² − 2·${zs(d[p])}·${zs(d[q])}·cos ${zw(d[w])} = ${zs(d[s] ** 2)}  ⇒  ${s} = ${zs(d[s])}`,
    });
    // den Winkel gegenüber der kürzeren Seite: der ist sicher spitz, der Sinussatz also eindeutig
    const k = d[p] <= d[q] ? p : q, kw = GEGENUEBER[k];
    d[kw] = asinG((d[k] * sinG(d[w])) / d[s]);
    sch.push({
      text: `Sinussatz für ${ZEICHEN[kw]} (gegenüber der kürzeren Seite ${k}, also sicher spitz)`,
      rechnung: `sin ${ZEICHEN[kw]} = ${k} · sin ${ZEICHEN[w]} / ${s} = ${zs(d[k])} · sin ${zw(d[w])} / ${zs(d[s])} = ${z(sinG(d[kw]), 4)}  ⇒  ${ZEICHEN[kw]} = ${zw(d[kw])}`,
    });
    const r = WINKEL.find(x => x !== w && x !== kw)!;
    d[r] = 180 - d[w] - d[kw];
    sch.push({ text: "Winkelsumme 180°", rechnung: `${ZEICHEN[r]} = 180° − ${zw(d[w])} − ${zw(d[kw])} = ${zw(d[r])}` });
    return { fall, dreiecke: [d], schritte: [sch] };
  }

  if (fall === "SSW") {
    const w = WINKEL.find(x => g[x] !== undefined)!, s2 = GEGENUEBER[w];
    const s1 = SEITEN.find(k => k !== s2 && g[k] !== undefined)!, w1 = GEGENUEBER[s1];
    const rest = WINKEL.find(x => x !== w && x !== w1)!, s3 = GEGENUEBER[rest];
    const sinW1 = (d[s1] * sinG(d[w])) / d[s2];
    const anfang: Schritt = {
      text: `Sinussatz: ${s1} und ${s2} mit ihren Gegenwinkeln`,
      rechnung: `sin ${ZEICHEN[w1]} = ${s1} · sin ${ZEICHEN[w]} / ${s2} = ${zs(d[s1])} · sin ${zw(d[w])} / ${zs(d[s2])} = ${z(sinW1, 4)}`,
    };
    if (sinW1 > 1 + 1e-9) {
      return {
        fall, dreiecke: [], schritte: [[anfang]],
        hinweis: `sin ${ZEICHEN[w1]} wäre größer als 1 — das gibt es nicht. Die Seite ${s2} ist zu kurz, um die gegenüberliegende Seite zu erreichen: es gibt kein Dreieck.`,
      };
    }
    const kandidaten = sinW1 > 1 - 1e-9 ? [90] : [asinG(sinW1), 180 - asinG(sinW1)];
    const dreiecke: Dreieck[] = [], schritte: Schritt[][] = [];
    kandidaten.forEach((x, i) => {
      if (d[w] + x >= 180 - 1e-9) return;
      const e = { ...d, [w1]: x } as Dreieck;
      e[rest] = 180 - d[w] - x;
      e[s3] = (d[s2] * sinG(e[rest])) / sinG(d[w]);
      schritte.push([
        anfang,
        {
          text: kandidaten.length === 1 ? `sin = 1 heißt genau 90°` : i === 0 ? `erste Lösung: der spitze Winkel` : `zweite Lösung: sin(180° − x) = sin x`,
          rechnung: i === 0 ? `${ZEICHEN[w1]} = ${zw(x)}` : `${ZEICHEN[w1]} = 180° − ${zw(kandidaten[0])} = ${zw(x)}`,
        },
        { text: "Winkelsumme 180°", rechnung: `${ZEICHEN[rest]} = 180° − ${zw(d[w])} − ${zw(x)} = ${zw(e[rest])}` },
        {
          text: `Sinussatz für die dritte Seite ${s3}`,
          rechnung: `${s3} = ${s2} · sin ${ZEICHEN[rest]} / sin ${ZEICHEN[w]} = ${zs(d[s2])} · sin ${zw(e[rest])} / sin ${zw(d[w])} = ${zs(e[s3])}`,
        },
      ]);
      dreiecke.push(e);
    });
    const hinweis = dreiecke.length === 2
      ? `Zwei Dreiecke! Der gegebene Winkel ${ZEICHEN[w]} liegt der kürzeren Seite ${s2} gegenüber (${zs(d[s2])} < ${zs(d[s1])}). Der Sinus hat zwischen 0° und 180° zwei Winkel mit demselben Wert: ${zw(kandidaten[0])} und ${zw(kandidaten[1])}. Beide passen.`
      : dreiecke.length === 1 && kandidaten.length === 2
        ? `Nur eine Lösung: ${ZEICHEN[w]} liegt der längeren (oder gleich langen) Seite ${s2} gegenüber. Der stumpfe Kandidat ${zw(kandidaten[1])} passt zusammen mit ${zw(d[w])} nicht mehr unter 180°.`
        : dreiecke.length === 1 ? `Genau ein Dreieck — ${ZEICHEN[w1]} ist ein rechter Winkel.`
          : `Kein Dreieck: ${ZEICHEN[w]} ist schon so groß, dass kein zweiter Winkel mehr passt.`;
    return { fall, dreiecke, schritte, hinweis };
  }

  // eine Seite, zwei Winkel
  const fehlt = WINKEL.find(x => g[x] === undefined)!, [w1, w2] = WINKEL.filter(x => x !== fehlt);
  if (d[w1] + d[w2] >= 180) return fehler(`${ZEICHEN[w1]} + ${ZEICHEN[w2]} = ${zw(d[w1] + d[w2])} — für ${ZEICHEN[fehlt]} bleibt nichts übrig.`, fall);
  d[fehlt] = 180 - d[w1] - d[w2];
  sch.push({ text: "Winkelsumme 180°", rechnung: `${ZEICHEN[fehlt]} = 180° − ${zw(d[w1])} − ${zw(d[w2])} = ${zw(d[fehlt])}` });
  const s = SEITEN.find(k => g[k] !== undefined)!, ws = GEGENUEBER[s];
  for (const k of SEITEN.filter(x => x !== s)) {
    const wk = GEGENUEBER[k];
    d[k] = (d[s] * sinG(d[wk])) / sinG(d[ws]);
    sch.push({
      text: `Sinussatz für ${k}`,
      rechnung: `${k} = ${s} · sin ${ZEICHEN[wk]} / sin ${ZEICHEN[ws]} = ${zs(d[s])} · sin ${zw(d[wk])} / sin ${zw(d[ws])} = ${zs(d[k])}`,
    });
  }
  return { fall, dreiecke: [d], schritte: [sch] };
}

/**
 * Rechtwinkliges Dreieck (γ = 90°, c Hypotenuse) aus zwei Angaben — mit sin,
 * cos und tan als Seitenverhältnisse statt der allgemeinen Sätze.
 */
export function loeseRechtwinklig(g: Gegeben): Loesung {
  const fall: Fall = "rechtwinklig";
  const k = (["a", "b", "c", "alpha", "beta"] as Groesse[]).filter(x => g[x] !== undefined);
  if (k.length !== 2) return fehler("Neben dem rechten Winkel braucht es genau zwei Angaben.", fall);
  if (!k.some(istSeite)) return fehler("Zwei Winkel legen nur die Form fest — mindestens eine Seite muss dabei sein.", fall);
  for (const x of k) if (!(g[x]! > 0)) return fehler(`${ZEICHEN[x]} muss größer als 0 sein.`, fall);
  for (const x of ["alpha", "beta"] as Winkel[]) if (g[x] !== undefined && g[x]! >= 90) return fehler(`${ZEICHEN[x]} muss kleiner als 90° sein — der rechte Winkel ist schon γ.`, fall);
  if (g.c !== undefined && ((g.a ?? 0) >= g.c || (g.b ?? 0) >= g.c)) return fehler("Die Hypotenuse c ist die längste Seite — eine Kathete kann nicht länger sein.", fall);
  const d = { ...g, gamma: 90 } as Dreieck;
  const sch: Schritt[] = [];

  if (k.every(istSeite)) {
    if (d.c === undefined) {
      d.c = Math.hypot(d.a, d.b);
      sch.push({ text: "Pythagoras", rechnung: `c² = a² + b² = ${zs(d.a)}² + ${zs(d.b)}² = ${zs(d.c ** 2)}  ⇒  c = ${zs(d.c)}` });
      d.alpha = atanG(d.a / d.b);
      sch.push({ text: "Tangens: Gegenkathete durch Ankathete", rechnung: `tan α = a / b = ${zs(d.a)} / ${zs(d.b)} = ${z(d.a / d.b, 4)}  ⇒  α = ${zw(d.alpha)}` });
    } else if (d.a === undefined) {
      d.a = Math.sqrt(d.c ** 2 - d.b ** 2);
      sch.push({ text: "Pythagoras", rechnung: `a² = c² − b² = ${zs(d.c)}² − ${zs(d.b)}² = ${zs(d.a ** 2)}  ⇒  a = ${zs(d.a)}` });
      d.alpha = acosG(d.b / d.c);
      sch.push({ text: "Kosinus: Ankathete durch Hypotenuse", rechnung: `cos α = b / c = ${zs(d.b)} / ${zs(d.c)} = ${z(d.b / d.c, 4)}  ⇒  α = ${zw(d.alpha)}` });
    } else {
      d.b = Math.sqrt(d.c ** 2 - d.a ** 2);
      sch.push({ text: "Pythagoras", rechnung: `b² = c² − a² = ${zs(d.c)}² − ${zs(d.a)}² = ${zs(d.b ** 2)}  ⇒  b = ${zs(d.b)}` });
      d.alpha = asinG(d.a / d.c);
      sch.push({ text: "Sinus: Gegenkathete durch Hypotenuse", rechnung: `sin α = a / c = ${zs(d.a)} / ${zs(d.c)} = ${z(d.a / d.c, 4)}  ⇒  α = ${zw(d.alpha)}` });
    }
    d.beta = 90 - d.alpha;
    sch.push({ text: "Winkelsumme: α + β = 90°", rechnung: `β = 90° − ${zw(d.alpha)} = ${zw(d.beta)}` });
    return { fall, dreiecke: [d], schritte: [sch] };
  }

  if (d.alpha === undefined) {
    d.alpha = 90 - d.beta;
    sch.push({ text: "Winkelsumme: α + β = 90°", rechnung: `α = 90° − ${zw(d.beta)} = ${zw(d.alpha)}` });
  } else {
    d.beta = 90 - d.alpha;
    sch.push({ text: "Winkelsumme: α + β = 90°", rechnung: `β = 90° − ${zw(d.alpha)} = ${zw(d.beta)}` });
  }
  const α = zw(d.alpha);
  if (g.a !== undefined) {
    d.c = d.a / sinG(d.alpha);
    d.b = d.a / tanG(d.alpha);
    sch.push({ text: "sin α = a / c, nach c umgestellt", rechnung: `c = a / sin α = ${zs(d.a)} / sin ${α} = ${zs(d.c)}` });
    sch.push({ text: "tan α = a / b, nach b umgestellt", rechnung: `b = a / tan α = ${zs(d.a)} / tan ${α} = ${zs(d.b)}` });
  } else if (g.b !== undefined) {
    d.a = d.b * tanG(d.alpha);
    d.c = d.b / cosG(d.alpha);
    sch.push({ text: "tan α = a / b, nach a umgestellt", rechnung: `a = b · tan α = ${zs(d.b)} · tan ${α} = ${zs(d.a)}` });
    sch.push({ text: "cos α = b / c, nach c umgestellt", rechnung: `c = b / cos α = ${zs(d.b)} / cos ${α} = ${zs(d.c)}` });
  } else {
    d.a = d.c * sinG(d.alpha);
    d.b = d.c * cosG(d.alpha);
    sch.push({ text: "sin α = a / c, nach a umgestellt", rechnung: `a = c · sin α = ${zs(d.c)} · sin ${α} = ${zs(d.a)}` });
    sch.push({ text: "cos α = b / c, nach b umgestellt", rechnung: `b = c · cos α = ${zs(d.c)} · cos ${α} = ${zs(d.b)}` });
  }
  return { fall, dreiecke: [d], schritte: [sch] };
}

/* ───────────────────────────────────────────── Lage der Ecken zum Zeichnen ── */

export type Punkt = { x: number; y: number };

/**
 * Ecken in Dreieckseinheiten: die erste Ecke der Reihe im Ursprung, die zweite
 * auf der x-Achse, die dritte oben. Für den SsW-Fall kommt die Ecke mit dem
 * gegebenen Winkel in den Ursprung — dann wandert nur die Ecke auf der Achse,
 * und der Kreis um die dritte Ecke zeigt beide Lösungen.
 */
export function ecken(d: Dreieck, reihe: Winkel[] = ["alpha", "beta", "gamma"]): Record<"A" | "B" | "C", Punkt> {
  const [p, q, r] = reihe;
  return {
    [ECKE[p]]: { x: 0, y: 0 },
    [ECKE[q]]: { x: d[GEGENUEBER[r]], y: 0 },
    [ECKE[r]]: { x: d[GEGENUEBER[q]] * cosG(d[p]), y: d[GEGENUEBER[q]] * sinG(d[p]) },
  } as Record<"A" | "B" | "C", Punkt>;
}

/* ──────────────────────────────────────────────────────────── Aufgaben ── */

export type AufgabenArt = "rechtwinklig" | "SSS" | "SWS" | "WSW" | "SSW";
export const AUFGABEN_ARTEN: { id: AufgabenArt; label: string }[] = [
  { id: "rechtwinklig", label: "📐 rechtwinklig" },
  { id: "SSS", label: "SSS" },
  { id: "SWS", label: "SWS" },
  { id: "WSW", label: "WSW / WWS" },
  { id: "SSW", label: "SsW (0, 1 oder 2 Lösungen)" },
];

export type DreieckAufgabe = {
  art: AufgabenArt;
  gegeben: Gegeben;
  gesucht: Groesse[];
  loesung: Loesung;
};

type Zufall = () => number;
const ganz = (r: Zufall, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const zehntel = (x: number) => Math.round(x * 10) / 10;
const wahl = <T,>(r: Zufall, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];

function zufallsDreieck(r: Zufall): Dreieck {
  const alpha = ganz(r, 30, 100), beta = ganz(r, 25, 155 - alpha), gamma = 180 - alpha - beta;
  const c = ganz(r, 40, 120) / 10;
  const k = c / sinG(gamma);
  return { a: zehntel(k * sinG(alpha)), b: zehntel(k * sinG(beta)), c, alpha, beta, gamma };
}

/** Eine lösbare (oder beim SsW-Fall absichtlich auch mal unlösbare) Aufgabe. */
export function erzeugeAufgabe(art: AufgabenArt, r: Zufall = Math.random): DreieckAufgabe {
  let gegeben: Gegeben;
  if (art === "rechtwinklig") {
    const alpha = ganz(r, 20, 70), c = ganz(r, 40, 150) / 10;
    const voll = { a: zehntel(c * sinG(alpha)), b: zehntel(c * cosG(alpha)), c, alpha, beta: 90 - alpha };
    const paare: Groesse[][] = [["a", "b"], ["a", "c"], ["b", "c"], ["a", "alpha"], ["b", "alpha"], ["c", "alpha"], ["a", "beta"], ["c", "beta"]];
    const p = wahl(r, paare);
    gegeben = Object.fromEntries(p.map(k => [k, voll[k as keyof typeof voll]]));
    const loesung = loeseRechtwinklig(gegeben);
    return { art, gegeben, gesucht: (["a", "b", "c", "alpha", "beta"] as Groesse[]).filter(k => !p.includes(k)), loesung };
  }
  const d = zufallsDreieck(r);
  if (art === "SSS") gegeben = { a: d.a, b: d.b, c: d.c };
  else if (art === "SWS") {
    const w = wahl(r, WINKEL), [p, q] = SEITEN.filter(k => k !== GEGENUEBER[w]);
    gegeben = { [p]: d[p], [q]: d[q], [w]: d[w] };
  } else if (art === "WSW") {
    const s = wahl(r, SEITEN), ws = r() < 0.5
      ? WINKEL.filter(w => w !== GEGENUEBER[s]) // WSW: die beiden anliegenden
      : [GEGENUEBER[s], wahl(r, WINKEL.filter(w => w !== GEGENUEBER[s]))]; // WWS
    gegeben = { [s]: d[s], [ws[0]]: d[ws[0]], [ws[1]]: d[ws[1]] };
  } else {
    // SsW: gegebener Winkel w, gegenüber s2, daneben s1. Zwei Lösungen, wenn s1·sin w < s2 < s1.
    const w = wahl(r, WINKEL), s2 = GEGENUEBER[w], s1 = wahl(r, SEITEN.filter(k => k !== s2));
    const ww = ganz(r, 25, 60), l1 = ganz(r, 60, 120) / 10, h = l1 * sinG(ww);
    const x = r(), l2 = x < 0.5 ? zehntel(h + (l1 - h) * (0.25 + x)) // zwei Lösungen
      : x < 0.85 ? zehntel(l1 * (1.1 + (x - 0.5))) // eine
        : zehntel(h * (0.6 + (x - 0.85) * 2)); // keine
    gegeben = { [w]: ww, [s1]: l1, [s2]: Math.max(0.1, l2) };
  }
  const loesung = loese(gegeben);
  return { art, gegeben, gesucht: GROESSEN.filter(k => gegeben[k] === undefined), loesung };
}

/** Wie genau eine Eingabe sein muss — gerundete Zwischenwerte dürfen etwas abweichen. */
export const toleranz = (g: Groesse, soll: number) => (istSeite(g) ? Math.max(0.06, soll * 0.015) : 0.6);
export const passt = (g: Groesse, ist: number, soll: number) => Math.abs(ist - soll) <= toleranz(g, soll);

/* ─────────────────────────────────────────────── Anwendungen (Szenarien) ── */

export type SzenarioArt = "turm" | "leiter" | "fluss" | "peilung" | "wanderung" | "strasse" | "berg" | "dach" | "schatten";
export const SZENARIO_ARTEN: { id: SzenarioArt; icon: string; label: string }[] = [
  { id: "turm", icon: "🗼", label: "Turmhöhe" },
  { id: "leiter", icon: "🪜", label: "Leiter" },
  { id: "fluss", icon: "🌊", label: "Flussbreite" },
  { id: "peilung", icon: "🚢", label: "Schiff anpeilen" },
  { id: "wanderung", icon: "🥾", label: "Wanderweg planen" },
  { id: "strasse", icon: "⛰️", label: "Steigung" },
  { id: "berg", icon: "🏔️", label: "Doppelpeilung" },
  { id: "dach", icon: "🏠", label: "Dach" },
  { id: "schatten", icon: "☀️", label: "Sonnenstand" },
];

export type Gesuchtes = { key: string; label: string; einheit: string; wert: number; tol: number };
export type Szenario = {
  art: SzenarioArt;
  titel: string;
  text: string;
  /** Zahlen für die Zeichnung */
  p: Record<string, number>;
  gesucht: Gesuchtes[];
  hinweise: string[];
  loesung: string[];
};

const m = (x: number, n = 1) => z(x, n) + " m";

export function erzeugeSzenario(art: SzenarioArt, r: Zufall = Math.random): Szenario {
  const g = (key: string, label: string, einheit: string, wert: number, tol?: number): Gesuchtes =>
    ({ key, label, einheit, wert, tol: tol ?? (einheit === "°" ? 0.6 : Math.max(0.06, Math.abs(wert) * 0.015)) });

  switch (art) {
    case "turm": {
      const d = ganz(r, 20, 90), a = ganz(r, 18, 58), auge = 1.6, h = d * tanG(a) + auge;
      return {
        art, titel: "Wie hoch ist der Kirchturm?", p: { d, a, auge, h },
        text: `Mia steht ${d} m vom Fuß des Kirchturms entfernt. Sie peilt die Turmspitze mit einem Winkelmesser an und misst einen Höhenwinkel von ${a}°. Ihre Augen sind ${z(auge, 1)} m über dem Boden. Wie hoch ist der Turm?`,
        gesucht: [g("h", "Höhe des Turms", "m", h)],
        hinweise: [
          "Zeichne das rechtwinklige Dreieck: Augen — Turm auf Augenhöhe — Spitze.",
          `Der Abstand ${d} m ist die Ankathete des Winkels ${a}°, das gesuchte Stück die Gegenkathete → tan.`,
          "Die Augenhöhe nicht vergessen!",
        ],
        loesung: [`x = ${d} m · tan ${a}° = ${m(d * tanG(a), 2)}`, `h = ${m(d * tanG(a), 2)} + ${m(auge)} = ${m(h, 2)}`],
      };
    }
    case "leiter": {
      const L = ganz(r, 40, 90) / 10, a = ganz(r, 60, 78);
      return {
        art, titel: "Wie hoch reicht die Leiter?", p: { L, a },
        text: `Eine ${z(L, 1)} m lange Leiter lehnt an einer Hauswand. Sie steht in einem Winkel von ${a}° zum Boden (sicher sind 65° bis 75°). Wie hoch reicht sie an der Wand, und wie weit steht ihr Fuß von der Wand weg?`,
        gesucht: [g("h", "Höhe an der Wand", "m", L * sinG(a)), g("x", "Abstand des Fußes", "m", L * cosG(a))],
        hinweise: [
          "Die Leiter ist die Hypotenuse.",
          `Die Höhe liegt dem Winkel ${a}° gegenüber → sin; der Abstand liegt an → cos.`,
        ],
        loesung: [`h = ${z(L, 1)} m · sin ${a}° = ${m(L * sinG(a), 2)}`, `x = ${z(L, 1)} m · cos ${a}° = ${m(L * cosG(a), 2)}`,
          a < 65 || a > 75 ? "Die Leiter steht außerhalb von 65°–75° — nicht sicher!" : "Der Winkel liegt im sicheren Bereich."],
      };
    }
    case "fluss": {
      const s = ganz(r, 30, 80), b = ganz(r, 35, 70), w = s * tanG(b);
      return {
        art, titel: "Wie breit ist der Fluss?", p: { s, b, w },
        text: `Leon steht am Ufer genau gegenüber einem Baum am anderen Ufer (Punkt A). Er geht ${s} m am Ufer entlang bis zu Punkt B und peilt den Baum an: Zwischen Ufer und Blickrichtung misst er ${b}°. Wie breit ist der Fluss?`,
        gesucht: [g("w", "Breite des Flusses", "m", w)],
        hinweise: ["Bei A ist ein rechter Winkel (genau gegenüber).", `Der Weg ${s} m ist Ankathete von ${b}°, die Breite Gegenkathete → tan.`],
        loesung: [`Breite = ${s} m · tan ${b}° = ${m(w, 2)}`],
      };
    }
    case "peilung": {
      const s = ganz(r, 40, 120) / 10, a = ganz(r, 35, 80), b = ganz(r, 35, 80), c = 180 - a - b;
      const as = (s * sinG(b)) / sinG(c), bs = (s * sinG(a)) / sinG(c);
      return {
        art, titel: "Wo ist das Schiff? (Triangulieren)", p: { s, a, b },
        text: `Die Leuchttürme A und B stehen ${z(s, 1)} km voneinander entfernt an einer geraden Küste. Beide peilen ein Schiff an: In A misst man zwischen Küste und Schiff ${a}°, in B ${b}°. Wie weit ist das Schiff von A und von B entfernt, und wie weit ist es von der Küste weg?`,
        gesucht: [g("as", "Entfernung A → Schiff", "km", as), g("bs", "Entfernung B → Schiff", "km", bs), g("k", "Abstand zur Küste", "km", as * sinG(a))],
        hinweise: [
          `Dreieck A–B–Schiff: eine Seite (${z(s, 1)} km) und die beiden Winkel daran — WSW.`,
          `Winkel beim Schiff: 180° − ${a}° − ${b}° = ${c}°.`,
          "Sinussatz: AS / sin β = AB / sin γ.",
          "Der Abstand zur Küste ist die Höhe: AS · sin α.",
        ],
        loesung: [`γ = 180° − ${a}° − ${b}° = ${c}°`, `AS = ${z(s, 1)} · sin ${b}° / sin ${c}° = ${z(as, 2)} km`,
          `BS = ${z(s, 1)} · sin ${a}° / sin ${c}° = ${z(bs, 2)} km`, `Abstand = ${z(as, 2)} · sin ${a}° = ${z(as * sinG(a), 2)} km`],
      };
    }
    case "wanderung": {
      const a = ganz(r, 20, 60) / 10, b = ganz(r, 20, 60) / 10, d = ganz(r, 40, 130);
      const innen = 180 - d, e = Math.sqrt(a * a + b * b - 2 * a * b * cosG(innen));
      const phi = acosG((a * a + e * e - b * b) / (2 * a * e));
      return {
        art, titel: "Wie weit ist es zurück?", p: { a, b, d },
        text: `Eine Wandergruppe geht ${z(a, 1)} km geradeaus, biegt dann um ${d}° nach rechts ab und geht noch ${z(b, 1)} km. Wie weit ist sie jetzt Luftlinie vom Start entfernt? Und um wie viel Grad weicht die direkte Linie zum Ziel am Start von der ersten Wegrichtung ab?`,
        gesucht: [g("e", "Luftlinie zum Start", "km", e), g("phi", "Winkel am Start", "°", phi)],
        hinweise: [
          `Der Winkel im Dreieck am Knick ist nicht ${d}°, sondern 180° − ${d}° = ${innen}°.`,
          "Zwei Seiten und der Winkel dazwischen (SWS) → Kosinussatz.",
          "Den Winkel am Start wieder mit dem Kosinussatz (oder Sinussatz, wenn er sicher spitz ist).",
        ],
        loesung: [`Winkel am Knick: 180° − ${d}° = ${innen}°`,
          `e² = ${z(a, 1)}² + ${z(b, 1)}² − 2·${z(a, 1)}·${z(b, 1)}·cos ${innen}° = ${z(e * e, 2)}  ⇒  e = ${z(e, 2)} km`,
          `cos φ = (${z(a, 1)}² + ${z(e, 2)}² − ${z(b, 1)}²) / (2·${z(a, 1)}·${z(e, 2)}) = ${z(cosG(phi), 4)}  ⇒  φ = ${zw(phi)}`],
      };
    }
    case "strasse": {
      const p = ganz(r, 5, 25), L = ganz(r, 5, 30) / 10, a = atanG(p / 100), h = L * 1000 * sinG(a);
      return {
        art, titel: "Wie steil ist die Straße?", p: { p, L, a },
        text: `Ein Verkehrsschild warnt: ${p} % Steigung. ${p} % heißt: auf 100 m waagerecht geht es ${p} m nach oben. Wie groß ist der Steigungswinkel? Wie viele Höhenmeter schafft ein Radfahrer auf ${z(L, 1)} km Straße?`,
        gesucht: [g("a", "Steigungswinkel", "°", a, 0.3), g("h", "Höhenmeter", "m", h, Math.max(1, h * 0.015))],
        hinweise: [`tan α = Höhe / waagerecht = ${p} / 100.`, "Die Straße selbst ist die Hypotenuse — nicht die waagerechte Strecke!", "Höhe = Straßenlänge · sin α (in Metern rechnen)."],
        loesung: [`tan α = ${p} / 100  ⇒  α = ${zw(a)}`, `h = ${z(L * 1000, 0)} m · sin ${zw(a)} = ${m(h, 1)}`],
      };
    }
    case "berg": {
      const d = ganz(r, 20, 80) * 10, a = ganz(r, 10, 22), b = a + ganz(r, 8, 20);
      const h = (d * tanG(a) * tanG(b)) / (tanG(b) - tanG(a));
      return {
        art, titel: "Wie hoch ist der Berg?", p: { d, a, b, h },
        text: `Den Fuß des Berges kann man nicht erreichen. Vom Punkt P sieht man die Spitze unter ${a}°. Man geht ${d} m direkt auf den Berg zu bis Q und misst dort ${b}°. Wie hoch ist der Berg (über der Ebene)?`,
        gesucht: [g("h", "Höhe des Berges", "m", h, Math.max(1, h * 0.015))],
        hinweise: [
          `Dreieck P–Q–Spitze: bei Q innen 180° − ${b}° = ${180 - b}°, an der Spitze ${b}° − ${a}° = ${b - a}°.`,
          "Sinussatz liefert die Strecke Q → Spitze.",
          `Dann im rechtwinkligen Dreieck: h = QS · sin ${b}°.`,
        ],
        loesung: [`Winkel an der Spitze: ${b}° − ${a}° = ${b - a}°`,
          `QS = ${d} · sin ${a}° / sin ${b - a}° = ${m((d * sinG(a)) / sinG(b - a), 1)}`,
          `h = QS · sin ${b}° = ${m(h, 1)}`],
      };
    }
    case "dach": {
      const w = ganz(r, 70, 140) / 10, a = wahl(r, [30, 35, 38, 40, 45, 48, 50]);
      const sp = w / 2 / cosG(a), fh = (w / 2) * tanG(a);
      return {
        art, titel: "Wie lang werden die Sparren?", p: { w, a },
        text: `Ein Haus ist ${z(w, 1)} m breit und bekommt ein Satteldach mit ${a}° Dachneigung (beide Seiten gleich). Wie lang muss ein Sparren (vom Rand bis zum First) sein, und wie hoch liegt der First über der Decke?`,
        gesucht: [g("s", "Sparrenlänge", "m", sp), g("f", "Firsthöhe", "m", fh)],
        hinweise: ["Teile das Dach in der Mitte: zwei rechtwinklige Dreiecke.", `Halbe Breite = ${z(w / 2, 2)} m ist die Ankathete von ${a}°.`, "Sparren = Hypotenuse → cos; Firsthöhe = Gegenkathete → tan."],
        loesung: [`Sparren = ${z(w / 2, 2)} m / cos ${a}° = ${m(sp, 2)}`, `Firsthöhe = ${z(w / 2, 2)} m · tan ${a}° = ${m(fh, 2)}`],
      };
    }
    case "schatten": {
      const h = ganz(r, 50, 250) / 10, s = ganz(r, 30, 300) / 10, a = atanG(h / s);
      return {
        art, titel: "Wie hoch steht die Sonne?", p: { h, s, a },
        text: `Ein ${z(h, 1)} m hoher Fahnenmast wirft einen ${z(s, 1)} m langen Schatten auf den ebenen Schulhof. Unter welchem Winkel fällt das Sonnenlicht ein (Sonnenhöhe)?`,
        gesucht: [g("a", "Sonnenhöhe", "°", a, 0.4)],
        hinweise: ["Mast, Schatten und Lichtstrahl bilden ein rechtwinkliges Dreieck.", "Mast = Gegenkathete, Schatten = Ankathete → tan.", "Umkehrfunktion: tan⁻¹ (auf dem Taschenrechner oft »shift tan«)."],
        loesung: [`tan α = ${z(h, 1)} / ${z(s, 1)} = ${z(h / s, 4)}  ⇒  α = ${zw(a)}`,
          a > 60 ? "So hoch steht die Sonne in Deutschland nie — das wäre eher am Äquator." : a < 15 ? "Eine sehr tiefe Sonne — früher Morgen, Abend oder Winter." : "Eine typische Sonnenhöhe für unsere Breiten."],
      };
    }
  }
}
