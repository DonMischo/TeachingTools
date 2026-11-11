/**
 * Quadratische Funktionen — reine Rechnung, ohne Oberfläche.
 *
 * Schreibweise wie im Tafelwerk der Schule:
 *   Scheitelpunktform  y = a(x + d)² + e   ⟹  S(−d | e)
 *   Normalform         y = ax² + bx + c
 * Eine Gerade ist eine Normalform mit a = 0.
 *
 * Für die Oberfläche gibt es Terme als farbige Stücke (Rolle a, d, e, b, c …)
 * und Rechenwege als Zeilen. Dazu die Aufgaben-Generatoren für »Üben« und die
 * Prüfungsaufgaben sowie die Wurfbahn des Spiels Korbwurf.
 */

export type SPF = { a: number; d: number; e: number };
export type NF = { a: number; b: number; c: number };
export type Punkt = { x: number; y: number };

/** Rechenrauschen weg (0,1 + 0,2), −0 wird 0. */
export const glatt = (x: number) => {
  const r = Math.round(x * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
};

/** Zahl auf Deutsch mit echtem Minuszeichen, höchstens `nk` Nachkommastellen. */
export function zahl(x: number, nk = 3): string {
  const f = 10 ** nk;
  let r = Math.round((x + (x >= 0 ? Number.EPSILON : -Number.EPSILON)) * f) / f;
  if (Object.is(r, -0)) r = 0;
  const s = Math.abs(r).toString().replace(".", ",");
  return (r < 0 ? "−" : "") + s;
}

/** »12,5«, »−3«, »-0.5«, »½« → Zahl; leer oder Unsinn → null. */
export function leseZahl(s: string): number | null {
  const t = s.trim().replace(/[−–]/g, "-").replace(",", ".").replace(/\s/g, "");
  if (t === "½") return 0.5;
  if (t === "-½") return -0.5;
  const bruch = /^(-?\d+)\/(\d+)$/.exec(t);
  if (bruch) return Number(bruch[1]) / Number(bruch[2]);
  if (!/^-?\d*\.?\d+$/.test(t)) return null;
  return Number(t);
}

/* ─────────────────────────────────────────────── Formen umrechnen ── */

export const wert = (f: NF, x: number) => glatt(f.a * x * x + f.b * x + f.c);
export const spfWert = (s: SPF, x: number) => glatt(s.a * (x + s.d) ** 2 + s.e);
export const spfZuNf = ({ a, d, e }: SPF): NF => ({ a, b: glatt(2 * a * d), c: glatt(a * d * d + e) });
export const nfZuSpf = ({ a, b, c }: NF): SPF => ({ a, d: glatt(b / (2 * a)), e: glatt(c - (b * b) / (4 * a)) });
export const scheitel = (s: SPF): Punkt => ({ x: glatt(-s.d), y: s.e });

/** Öffnung und Form zum Faktor a. */
export function steckbrief(a: number): { oeffnung: "oben" | "unten"; form: "gestreckt" | "normal" | "gestaucht" } {
  const b = Math.abs(a);
  return { oeffnung: a > 0 ? "oben" : "unten", form: b > 1 + 1e-9 ? "gestreckt" : b < 1 - 1e-9 ? "gestaucht" : "normal" };
}

/* ────────────────────────────────────────────── Terme als Stücke ── */

export type Rolle = "a" | "b" | "c" | "d" | "e" | "x" | "p" | "q";
export type Stueck = { t: string; r?: Rolle };

/** Vorzeichen + Betrag als Stück: »+ 3«, »− 0,5«. */
const glied = (v: number, r?: Rolle): Stueck => ({ t: `${v < 0 ? "−" : "+"} ${zahl(Math.abs(v))}`, r });

/** y = a(x + d)² + e; Faktor 1 und Summand 0 fallen weg. */
export function spfStuecke(s: SPF, links = "y = "): Stueck[] {
  const o: Stueck[] = links ? [{ t: links }] : [];
  if (s.a === -1) o.push({ t: "−", r: "a" });
  else if (s.a !== 1) o.push({ t: zahl(s.a), r: "a" });
  if (s.d === 0) o.push({ t: "x²", r: "x" });
  else o.push({ t: "(" }, { t: "x", r: "x" }, { t: " " }, glied(s.d, "d"), { t: ")²" });
  if (s.e !== 0) o.push({ t: " " }, glied(s.e, "e"));
  return o;
}

/** y = ax² + bx + c; mit a = 0 eine Gerade. */
export function nfStuecke(f: NF, links = "y = "): Stueck[] {
  const o: Stueck[] = links ? [{ t: links }] : [];
  const teile: [number, string, Rolle][] = [[f.a, "x²", "a"], [f.b, "x", "b"], [f.c, "", "c"]];
  let erstes = true;
  for (const [v, x, r] of teile) {
    if (v === 0) continue;
    const betrag = Math.abs(v) === 1 && x ? "" : zahl(Math.abs(v));
    const vz = erstes ? (v < 0 ? "−" : "") : v < 0 ? " − " : " + ";
    o.push({ t: vz + betrag, r });
    if (x) o.push({ t: x, r: "x" });
    erstes = false;
  }
  if (erstes) o.push({ t: "0", r: "c" });
  return o;
}

export const text = (st: Stueck[]) => st.map(s => s.t).join("").replace(/\s+/g, " ").trim();
export const spfText = (s: SPF, links = "y = ") => text(spfStuecke(s, links));
export const nfText = (f: NF, links = "y = ") => text(nfStuecke(f, links));

/** »(x + 3)« bzw. »(x − 3)« */
export const klammer = (d: number) => `(x ${d < 0 ? "−" : "+"} ${zahl(Math.abs(d))})`;
/** Zahl in Klammern, wenn negativ: »(−3)« */
export const kl = (v: number) => (v < 0 ? `(${zahl(v)})` : zahl(v));

/* ─────────────────────────────────────── Klammern quadrieren (Bögen) ── */

export type Bogen = { nr: 1 | 2 | 3 | 4; von: string; zu: string; produkt: string; ergebnis: Stueck };

/**
 * (x + p)(x + q) mit vier Bögen: vorne·vorne, vorne·hinten, hinten·vorne,
 * hinten·hinten. p = q ergibt (x + p)², q = −p die dritte Formel.
 */
export function boegen(p: number, q: number) {
  const bg: Bogen[] = [
    { nr: 1, von: "x", zu: "x", produkt: "x · x", ergebnis: { t: "x²", r: "x" } },
    { nr: 2, von: "x", zu: zahl(q), produkt: `x · ${kl(q)}`, ergebnis: glied(q) },
    { nr: 3, von: zahl(p), zu: "x", produkt: `${kl(p)} · x`, ergebnis: glied(p) },
    { nr: 4, von: zahl(p), zu: zahl(q), produkt: `${kl(p)} · ${kl(q)}`, ergebnis: glied(glatt(p * q)) },
  ];
  const ergebnis: NF = { a: 1, b: glatt(p + q), c: glatt(p * q) };
  const formel = p === q ? (p > 0 ? 1 : 2) : p === -q ? 3 : 0;
  return { bg, ergebnis, formel: formel as 0 | 1 | 2 | 3 };
}

/* ───────────────────────────────────────────────────── Rechenwege ── */

/** Scheitelpunktform → Normalform: binomische Formel, mit a ausmultiplizieren, zusammenfassen. */
export function ausmultiplizieren(s: SPF): string[] {
  const { a, d, e } = s;
  const nf = spfZuNf(s);
  const z: string[] = [spfText(s)];
  if (d === 0) {
    z.push(nfText(nf));
    return z;
  }
  const binom = `x² ${d < 0 ? "−" : "+"} ${zahl(Math.abs(2 * d))}x + ${zahl(d * d)}`;
  const fa = a === 1 ? "" : a === -1 ? "−" : `${zahl(a)} · `;
  z.push(`y = ${fa}(${binom})${e ? ` ${e < 0 ? "−" : "+"} ${zahl(Math.abs(e))}` : ""}   | ${d > 0 ? "1." : "2."} binomische Formel`);
  if (a !== 1) {
    const aus = nfText({ a, b: glatt(2 * a * d), c: glatt(a * d * d) }, "");
    z.push(`y = ${aus}${e ? ` ${e < 0 ? "−" : "+"} ${zahl(Math.abs(e))}` : ""}   | mit ${kl(a)} ausmultiplizieren`);
  }
  z.push(`${nfText(nf)}   | zusammenfassen`);
  return z;
}

/** Normalform → Scheitelpunktform per quadratischer Ergänzung. */
export function ergaenzen(f: NF): string[] {
  const { a, b, c } = f;
  const spf = nfZuSpf(f);
  const z: string[] = [nfText(f)];
  const ba = glatt(b / a);
  const d = glatt(ba / 2);
  const cTxt = c ? ` ${c < 0 ? "−" : "+"} ${zahl(Math.abs(c))}` : "";
  const fa = a === 1 ? "" : a === -1 ? "−" : zahl(a);
  const inner = nfText({ a: 1, b: ba, c: 0 }, "");
  if (a !== 1) z.push(`y = ${fa}(${inner})${cTxt}   | ${kl(a)} ausklammern (nur aus den x-Gliedern)`);
  z.push(`d = ${zahl(ba)} : 2 = ${zahl(d)},   d² = ${zahl(d * d)}   | halbe Zahl vor x`);
  z.push(`y = ${fa}(${inner} + ${zahl(d * d)} − ${zahl(d * d)})${cTxt}   | + d² − d² ergänzen`);
  z.push(`y = ${fa}(${klammer(d)}² − ${zahl(d * d)})${cTxt}   | Binom rückwärts`);
  if (a !== 1) z.push(`y = ${fa}${klammer(d)}² ${glied(glatt(-a * d * d)).t}${cTxt}   | −d² mit ${kl(a)} herausholen`);
  z.push(`${spfText(spf)}   | zusammenfassen  ⟹  S(${zahl(-spf.d)} | ${zahl(spf.e)})`);
  return z;
}

export type PQ = { p: number; q: number; D: number; xs: number[]; schritte: string[] };

/** Nullstellen von ax² + bx + c (a ≠ 0) mit der p-q-Formel samt Rechenweg. */
export function pqFormel(f: NF, links = "f(x)"): PQ {
  const z: string[] = [`${links} = 0:   ${nfText(f, "")} = 0`];
  const p = glatt(f.b / f.a), q = glatt(f.c / f.a);
  if (f.a !== 1) z.push(`${nfText({ a: 1, b: p, c: q }, "")} = 0   | : ${kl(f.a)}`);
  z.push(`p = ${zahl(p)},   q = ${zahl(q)}`);
  const h = glatt(-p / 2);
  const D = glatt(h * h - q);
  z.push(`D = (p/2)² − q = ${kl(glatt(p / 2))}² − ${kl(q)} = ${zahl(D)}`);
  let xs: number[] = [];
  if (D < -1e-9) z.push("D < 0  ⟹  keine Nullstelle (keine Wurzel aus einer negativen Zahl)");
  else if (Math.abs(D) <= 1e-9) {
    xs = [h];
    z.push(`D = 0  ⟹  genau eine Nullstelle:  x = −p/2 = ${zahl(h)}`);
  } else {
    const w = Math.sqrt(D);
    xs = [glatt(h - w), glatt(h + w)];
    z.push(`x = −p/2 ± √D = ${zahl(h)} ± √${zahl(D)} = ${zahl(h)} ± ${zahl(w)}`);
    z.push(`x₁ = ${zahl(xs[0])},   x₂ = ${zahl(xs[1])}`);
  }
  return { p, q, D, xs, schritte: z };
}

/** Schnittpunkte zweier Funktionen (Parabel oder Gerade) mit Rechenweg. */
export function schnitt(f: NF, g: NF): { punkte: Punkt[]; schritte: string[]; gleich: boolean } {
  const diff: NF = { a: glatt(f.a - g.a), b: glatt(f.b - g.b), c: glatt(f.c - g.c) };
  const z = [`Gleichsetzen:  ${nfText(f, "")} = ${nfText(g, "")}`, `Alles nach links:  ${nfText(diff, "")} = 0`];
  if (diff.a === 0 && diff.b === 0) {
    z.push(diff.c === 0 ? "Beide Graphen sind gleich – unendlich viele gemeinsame Punkte." : "Widerspruch – kein Schnittpunkt.");
    return { punkte: [], schritte: z, gleich: diff.c === 0 };
  }
  let xs: number[];
  if (diff.a === 0) {
    const x = glatt(-diff.c / diff.b);
    z.push(`${zahl(diff.b)}x = ${zahl(-diff.c)}   ⟹   x = ${zahl(x)}`);
    xs = [x];
  } else {
    const r = pqFormel(diff, "");
    z.push(...r.schritte.slice(1));
    xs = r.xs;
  }
  const punkte = xs.map(x => ({ x, y: wert(g, x) }));
  if (punkte.length) z.push(`y einsetzen:  ${punkte.map((s, i) => `S${punkte.length > 1 ? i + 1 : ""}(${zahl(s.x)} | ${zahl(s.y)})`).join(",  ")}`);
  return { punkte, schritte: z, gleich: false };
}

/* ─────────────────────────────────────────────────── Zufall ── */

export type Zufall = () => number;
export const ganz = (r: Zufall, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
export const eins = <T,>(r: Zufall, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
/** Ganze Zahl ≠ 0 im Bereich. */
const nichtNull = (r: Zufall, a: number, b: number) => { let v = 0; while (v === 0) v = ganz(r, a, b); return v; };

/* ─────────────────────────────────────────────────── Üben ── */

export type Feld =
  | { key: string; label: string; art: "zahl"; wert: number | null; tol: number }
  | { key: string; label: string; art: "wahl"; optionen: string[]; richtig: number };

/** Was die Aufgabe zeichnet: Kurven (Normalform), markierte Punkte, Ausschnitt. */
export type GraphSpec = {
  kurven: { f: NF; farbe?: string; name?: string; gestrichelt?: boolean }[];
  punkte?: (Punkt & { label?: string })[];
  bereich: { x0: number; x1: number; y0: number; y1: number };
};

export type UebArt =
  | "ablesen" | "beschreiben" | "form" | "graph" | "werte"
  | "quadrieren" | "spfNf" | "nfSpf" | "nullstellen" | "schnitt";
export type Stufe = 1 | 2 | 3;

export const UEB_ARTEN: { id: UebArt; label: string; gruppe: "grund" | "rechnen" }[] = [
  { id: "ablesen", label: "📍 S ablesen", gruppe: "grund" },
  { id: "beschreiben", label: "↕️ Verschiebung", gruppe: "grund" },
  { id: "form", label: "🔀 Faktor a deuten", gruppe: "grund" },
  { id: "graph", label: "👀 Term zum Graphen", gruppe: "grund" },
  { id: "werte", label: "🧮 Werte & Punktprobe", gruppe: "grund" },
  { id: "quadrieren", label: "🌈 Klammern quadrieren", gruppe: "rechnen" },
  { id: "spfNf", label: "➡️ SPF → Normalform", gruppe: "rechnen" },
  { id: "nfSpf", label: "🧩 Quadr. Ergänzung", gruppe: "rechnen" },
  { id: "nullstellen", label: "🎯 Nullstellen (p-q)", gruppe: "rechnen" },
  { id: "schnitt", label: "✖️ Schnittpunkte", gruppe: "rechnen" },
];

export type UebAufgabe = {
  art: UebArt;
  frage: string;
  /** Term, der groß und farbig gesetzt wird */
  term?: Stueck[];
  graph?: GraphSpec;
  felder: Feld[];
  tipps: string[];
  weg: string[];
  /** die Funktion(en) hinter der Aufgabe – für Lösungsgraph und Tests */
  f?: NF;
  g?: NF;
};

const zf = (key: string, label: string, w: number | null, tol = 0.011): Feld => ({ key, label, art: "zahl", wert: w === null ? null : glatt(w), tol });
const wf = (key: string, label: string, optionen: string[], richtig: string): Feld => {
  const i = optionen.indexOf(richtig);
  if (i < 0) throw new Error(`»${richtig}« fehlt`);
  return { key, label, art: "wahl", optionen, richtig: i };
};

/** Eingabe zum Feld prüfen; leeres Feld passt, wenn es nichts gibt (wert null). */
export function feldStimmt(f: Feld, eingabe: string | undefined): boolean {
  const e = (eingabe ?? "").trim();
  if (f.art === "wahl") return e !== "" && Number(e) === f.richtig;
  if (f.wert === null) return e === "" || /^[-–—]$|^(keine?|nichts|x)$/i.test(e);
  const x = leseZahl(e);
  return x !== null && Math.abs(x - f.wert) <= f.tol;
}

export const feldLoesung = (f: Feld) =>
  f.art === "wahl" ? `${f.label}: ${f.optionen[f.richtig]}` : `${f.label} = ${f.wert === null ? "–" : zahl(f.wert)}`;

/** Ausschnitt um einen Scheitelpunkt, so dass die Parabel sichtbar Raum hat. */
function bereichUm(s: SPF): GraphSpec["bereich"] {
  const S = scheitel(s);
  const x0 = Math.floor(Math.min(-1, S.x - 4)), x1 = Math.ceil(Math.max(1, S.x + 4));
  const oben = s.a > 0;
  const y0 = Math.floor(oben ? Math.min(-1, S.y - 1) : Math.min(-1, S.y - 7));
  const y1 = Math.ceil(oben ? Math.max(1, S.y + 7) : Math.max(1, S.y + 1));
  return { x0, x1, y0, y1 };
}

function zufallsSpf(r: Zufall, st: Stufe): SPF {
  const a = st === 1 ? 1 : st === 2 ? eins(r, [1, -1]) : eins(r, [2, -2, 0.5, -0.5, 3, -1]);
  return { a, d: ganz(r, -4, 4), e: ganz(r, -4, 4) };
}

export function erzeugeUebung(art: UebArt, st: Stufe, r: Zufall = Math.random): UebAufgabe {
  switch (art) {
    case "ablesen": {
      const s = st === 1
        ? (r() < 0.5 ? { a: 1, d: 0, e: nichtNull(r, -5, 5) } : { a: 1, d: nichtNull(r, -5, 5), e: 0 })
        : zufallsSpf(r, st);
      const S = scheitel(s);
      return {
        art, frage: "Gib den Scheitelpunkt S an.", term: spfStuecke(s),
        felder: [zf("xs", "x-Koordinate von S", S.x), zf("ys", "y-Koordinate von S", S.y)],
        tipps: ["Scheitelpunktform: y = a(x + d)² + e  ⟹  S(−d | e).", `Hier ist d = ${zahl(s.d)} und e = ${zahl(s.e)}.`],
        weg: [`d = ${zahl(s.d)}, e = ${zahl(s.e)}`, `S(−d | e) = S(${zahl(S.x)} | ${zahl(S.y)})`],
      };
    }
    case "beschreiben": {
      const s: SPF = { a: st === 3 ? eins(r, [1, -1, 2]) : 1, d: st === 1 && r() < 0.5 ? 0 : nichtNull(r, -6, 6), e: st === 1 && r() < 0.5 ? nichtNull(r, -6, 6) : ganz(r, -6, 6) };
      if (s.d === 0 && s.e === 0) s.e = 2;
      const lr = s.d > 0 ? "links" : s.d < 0 ? "rechts" : "gar nicht";
      const ou = s.e > 0 ? "oben" : s.e < 0 ? "unten" : "gar nicht";
      return {
        art, frage: "Wie geht der Graph aus der Normalparabel y = x² hervor?", term: spfStuecke(s),
        felder: [
          wf("lr", "Links/rechts", ["links", "rechts", "gar nicht"], lr), zf("lrw", "um wie viel? (0, wenn gar nicht)", Math.abs(s.d)),
          wf("ou", "Oben/unten", ["oben", "unten", "gar nicht"], ou), zf("ouw", "um wie viel? (0, wenn gar nicht)", Math.abs(s.e)),
        ],
        tipps: ["d in der Klammer verschiebt andersherum: + nach links, − nach rechts.", "e hinten verschiebt wie gedacht: + nach oben, − nach unten."],
        weg: [`d = ${zahl(s.d)}  ⟹  ${s.d ? `${zahl(Math.abs(s.d))} nach ${lr}` : "nicht nach links/rechts"}`, `e = ${zahl(s.e)}  ⟹  ${s.e ? `${zahl(Math.abs(s.e))} nach ${ou}` : "nicht nach oben/unten"}`],
      };
    }
    case "form": {
      const a = st === 1 ? eins(r, [2, 3, 0.5, 1, -1]) : eins(r, [2, -2, 0.5, -0.5, 4, -0.25, 1.5, -3, 1, -1]);
      const s: SPF = { a, d: st === 1 ? 0 : ganz(r, -3, 3), e: st === 1 ? 0 : ganz(r, -3, 3) };
      const k = steckbrief(a);
      return {
        art, frage: "Ist die Parabel nach oben oder unten geöffnet – und wie ist sie geformt?", term: spfStuecke(s),
        felder: [wf("oe", "Öffnung", ["oben", "unten"], k.oeffnung), wf("fo", "Form", ["gestreckt", "normal", "gestaucht"], k.form)],
        tipps: ["Nur a zählt: das Vorzeichen sagt die Öffnung.", "Betrag von a: größer als 1 → schmal (gestreckt), kleiner als 1 → breit (gestaucht)."],
        weg: [`a = ${zahl(a)}`, `${a > 0 ? "a > 0 → nach oben" : "a < 0 → nach unten"}`, `|a| = ${zahl(Math.abs(a))} → ${k.form}`],
      };
    }
    case "graph": {
      const s: SPF = st === 1 ? { a: 1, d: ganz(r, -3, 3), e: ganz(r, -3, 3) } : st === 2 ? { a: eins(r, [1, -1]), d: ganz(r, -3, 3), e: ganz(r, -3, 3) } : { a: eins(r, [2, -2, 0.5, -0.5]), d: ganz(r, -3, 3), e: ganz(r, -3, 3) };
      const S = scheitel(s);
      return {
        art, frage: "Lies den Funktionsterm y = a(x + d)² + e aus dem Graphen ab.",
        graph: { kurven: [{ f: spfZuNf(s) }], punkte: [{ ...S, label: "S" }], bereich: bereichUm(s) },
        felder: [zf("a", "a", s.a), zf("d", "d", s.d), zf("e", "e", s.e)],
        tipps: ["Lies zuerst S ab. Dann ist d = −x_S und e = y_S.", "a: Geh vom Scheitel 1 nach rechts – um wie viel geht es hoch (oder runter)?"],
        weg: [`S(${zahl(S.x)} | ${zahl(S.y)})  ⟹  d = ${zahl(s.d)}, e = ${zahl(s.e)}`, `1 nach rechts → ${zahl(s.a)} ${s.a > 0 ? "hoch" : "runter"}  ⟹  a = ${zahl(s.a)}`, spfText(s)],
        f: spfZuNf(s),
      };
    }
    case "werte": {
      const s = zufallsSpf(r, st);
      const f = spfZuNf(s);
      const x0 = ganz(r, -4, 4);
      const y0 = wert(f, x0);
      if (r() < 0.5) {
        return {
          art, frage: `Berechne den Funktionswert an der Stelle x = ${zahl(x0)}.`, term: r() < 0.5 ? spfStuecke(s) : nfStuecke(f),
          felder: [zf("y", `f(${zahl(x0)})`, y0)],
          tipps: ["x durch die Zahl ersetzen – negative Zahlen in Klammern!", "Reihenfolge: Klammer, hoch 2, mal, plus/minus."],
          weg: [`f(${zahl(x0)}) = ${spfText(s, "").replace(/x/g, kl(x0))}`, `= ${zahl(y0)}`],
        };
      }
      const liegt = r() < 0.5;
      const yP = liegt ? y0 : glatt(y0 + eins(r, [1, -1, 2, -2]));
      return {
        art, frage: `Liegt der Punkt P(${zahl(x0)} | ${zahl(yP)}) auf dem Graphen?`, term: spfStuecke(s),
        felder: [wf("ja", "P liegt auf dem Graphen", ["ja", "nein"], liegt ? "ja" : "nein")],
        tipps: ["Punktprobe: x von P einsetzen und schauen, ob der y-Wert von P herauskommt."],
        weg: [`f(${zahl(x0)}) = ${zahl(y0)}`, liegt ? `= y von P  ⟹  ja` : `≠ ${zahl(yP)}  ⟹  nein`],
      };
    }
    case "quadrieren": {
      const p = nichtNull(r, -9, 9);
      const fall = st === 1 ? 1 + Math.floor(r() * 2) : eins(r, [1, 2, 3]);
      const pp = fall === 2 ? -Math.abs(p) : Math.abs(p);
      const qq = fall === 3 ? -pp : pp;
      const k = st === 3 ? eins(r, [1, 2, 3]) : 1;
      // (k·x + pp)(k·x + qq)
      const nf: NF = { a: k * k, b: glatt(k * (pp + qq)), c: glatt(pp * qq) };
      const vorne = k === 1 ? "x" : `${k}x`;
      const t = fall === 3 ? `(${vorne} + ${zahl(pp)})(${vorne} − ${zahl(pp)})` : `(${vorne} ${pp < 0 ? "−" : "+"} ${zahl(Math.abs(pp))})²`;
      return {
        art, frage: `Multipliziere aus: ${t} = a·x² + b·x + c`, term: [{ t }],
        felder: [zf("a", "a", nf.a), zf("b", "b", nf.b), zf("c", "c", nf.c)],
        tipps: ["Vier Bögen: vorne·vorne, vorne·hinten, hinten·vorne, hinten·hinten.", fall === 3 ? "3. binomische Formel: die Mitte hebt sich auf." : `${fall}. binomische Formel: erstes Quadrat ${fall === 1 ? "+" : "−"} doppeltes Produkt + zweites Quadrat.`],
        weg: [`${vorne}·${vorne} = ${zahl(k * k)}x²`, `${vorne}·${kl(qq)} + ${kl(pp)}·${vorne} = ${zahl(nf.b)}x`, `${kl(pp)}·${kl(qq)} = ${zahl(nf.c)}`, nfText(nf, `${t} = `)],
      };
    }
    case "spfNf": {
      const s = zufallsSpf(r, st);
      if (s.d === 0) s.d = eins(r, [2, -3]);
      const f = spfZuNf(s);
      return {
        art, frage: "Forme in die Normalform y = ax² + bx + c um.", term: spfStuecke(s),
        felder: [zf("a", "a", f.a), zf("b", "b", f.b), zf("c", "c", f.c)],
        tipps: ["Klammer quadrieren (binomische Formel), dann mit a ausmultiplizieren, dann e dazuzählen.", `(x ${s.d < 0 ? "−" : "+"} ${zahl(Math.abs(s.d))})² = x² ${s.d < 0 ? "−" : "+"} ${zahl(Math.abs(2 * s.d))}x + ${zahl(s.d * s.d)}`],
        weg: ausmultiplizieren(s), f,
      };
    }
    case "nfSpf": {
      const a = st === 3 ? eins(r, [2, -1, -2, 3]) : 1;
      const d = st === 2 ? glatt(eins(r, [1, -1]) * (ganz(r, 0, 3) + 0.5)) : nichtNull(r, -5, 5);
      const s: SPF = { a, d, e: ganz(r, -6, 6) };
      const f = spfZuNf(s);
      const S = scheitel(s);
      return {
        art, frage: "Bring den Term mit quadratischer Ergänzung in die Scheitelpunktform und gib S an.", term: nfStuecke(f),
        felder: [zf("xs", "x-Koordinate von S", S.x), zf("ys", "y-Koordinate von S", S.y)],
        tipps: [a !== 1 ? `Erst ${zahl(a)} aus den x-Gliedern ausklammern.` : "Halbe Zahl vor x: das ist d.", "Ergänzen: + d² − d², dann Binom rückwärts.", "Kontrolle: x_S = −b/(2a)."],
        weg: ergaenzen(f), f,
      };
    }
    case "nullstellen": {
      let f: NF;
      if (st === 1) {
        const x1 = ganz(r, -6, 5), x2 = ganz(r, x1 + 1, 7);
        f = { a: 1, b: glatt(-(x1 + x2)), c: glatt(x1 * x2) };
      } else {
        const fall = eins(r, ["zwei", "zwei", "eine", "keine"] as const);
        const a = st === 3 ? eins(r, [2, -1, 0.5, -2]) : 1;
        if (fall === "zwei") {
          const x1 = ganz(r, -6, 4), x2 = ganz(r, x1 + 1, 6);
          f = { a, b: glatt(-a * (x1 + x2)), c: glatt(a * x1 * x2) };
        } else if (fall === "eine") {
          const x0 = nichtNull(r, -5, 5);
          f = { a, b: glatt(-2 * a * x0), c: glatt(a * x0 * x0) };
        } else {
          f = spfZuNf({ a, d: ganz(r, -3, 3), e: (a > 0 ? 1 : -1) * ganz(r, 1, 5) });
        }
      }
      const pq = pqFormel(f);
      const n = pq.xs.length;
      return {
        art, frage: "Berechne die Nullstellen (p-q-Formel). Gibt es keine, lass die Felder leer.", term: nfStuecke(f, "f(x) = "),
        felder: [
          wf("n", "Anzahl Nullstellen", ["0", "1", "2"], String(n)),
          zf("x1", "x₁ (kleinere)", n ? pq.xs[0] : null),
          zf("x2", "x₂ (größere; bei einer Nullstelle dieselbe)", n ? pq.xs[n - 1] : null),
        ],
        tipps: [f.a !== 1 ? `Erst durch ${zahl(f.a)} teilen, damit vor x² eine 1 steht.` : "p ablesen (Zahl vor x), q ablesen (Zahl allein) – mit Vorzeichen.", "D = (p/2)² − q entscheidet: > 0 zwei, = 0 eine, < 0 keine."],
        weg: pq.schritte, f,
      };
    }
    case "schnitt": {
      const x1 = ganz(r, -4, 2), x2 = ganz(r, x1 + 1, 5);
      const s = zufallsSpf(r, st === 3 ? 2 : st);
      const f = spfZuNf(s);
      let g: NF;
      const fall = st === 3 ? eins(r, ["zwei", "zwei", "beruehrt", "keine"] as const) : "zwei";
      if (fall === "zwei") {
        const m = glatt((wert(f, x2) - wert(f, x1)) / (x2 - x1));
        g = { a: 0, b: m, c: glatt(wert(f, x1) - m * x1) };
      } else if (fall === "beruehrt") {
        // Tangente an der Stelle x1: Steigung 2a·x1 + b
        const m = glatt(2 * f.a * x1 + f.b);
        g = { a: 0, b: m, c: glatt(wert(f, x1) - m * x1) };
      } else {
        // waagerecht unter dem tiefsten (bzw. über dem höchsten) Punkt – trifft sicher nicht
        g = { a: 0, b: 0, c: glatt(f.a > 0 ? s.e - ganz(r, 1, 3) : s.e + ganz(r, 1, 3)) };
      }
      const r_ = schnitt(f, g);
      const n = r_.punkte.length;
      const P = r_.punkte;
      return {
        art, frage: "Berechne die Schnittpunkte von Parabel f und Gerade g. Gibt es weniger als zwei, lass Felder leer.",
        term: [...nfStuecke(f, "f(x) = "), { t: "     " }, ...nfStuecke(g, "g(x) = ")],
        felder: [
          wf("n", "Anzahl Schnittpunkte", ["0", "1", "2"], String(n)),
          zf("x1", "S₁: x", n ? P[0].x : null), zf("y1", "S₁: y", n ? P[0].y : null),
          zf("x2", "S₂: x", n > 1 ? P[1].x : null), zf("y2", "S₂: y", n > 1 ? P[1].y : null),
        ],
        tipps: ["Gleichsetzen: f(x) = g(x), dann alles auf eine Seite.", "Mit p-q die x-Werte, dann y mit g ausrechnen (die Gerade ist leichter)."],
        weg: r_.schritte, f, g,
      };
    }
  }
}

/* ───────────────────────────────────────── Prüfungsaufgaben ── */

export type Teil = { frage: string; felder: Feld[]; loesung: string[]; be: number };
export type Pruefung = { art: PruefArt; titel: string; kontext: string; funktion: string; graph?: GraphSpec; teile: Teil[] };
export type PruefArt = "bruecke" | "basketball" | "brunnen" | "gewinn" | "zaun" | "rampe";

export const PRUEF_ARTEN: { id: PruefArt; icon: string; label: string }[] = [
  { id: "bruecke", icon: "🌉", label: "Brückenbogen" },
  { id: "basketball", icon: "🏀", label: "Basketball" },
  { id: "brunnen", icon: "⛲", label: "Springbrunnen" },
  { id: "gewinn", icon: "💶", label: "Gewinn" },
  { id: "zaun", icon: "🐑", label: "Gehege" },
  { id: "rampe", icon: "🛹", label: "Wasserstrahl & Rampe" },
];

const m = (x: number) => `${zahl(x, 2)} m`;

export function erzeugePruefung(art: PruefArt, r: Zufall = Math.random): Pruefung {
  switch (art) {
    case "bruecke": {
      // nur Paare, bei denen a = −h/w² eine kurze Dezimalzahl ist
      const [w, h] = eins(r, [[20, 8], [20, 10], [20, 12], [25, 10], [25, 15], [30, 9], [40, 8], [40, 12], [40, 16]] as const);
      const s: SPF = { a: glatt(-h / (w * w)), d: -w, e: h };
      const f = spfZuNf(s);
      const xs = eins(r, [5, 10, 15].filter(v => v < w));
      const breite = eins(r, [8, 10, 12]);
      const hSchiff = spfWert(s, w - breite / 2);
      return {
        art, titel: "Brückenbogen",
        kontext: `Eine Brücke überspannt einen Fluss mit einem parabelförmigen Bogen. Legt man den linken Fußpunkt in den Ursprung (x und y in Metern), beschreibt die Funktion f mit f(x) = ${zahl(s.a, 5)}(x − ${w})² + ${h} den Bogen.`,
        funktion: spfText(s, "f(x) = "),
        graph: { kurven: [{ f }], bereich: { x0: -2, x1: 2 * w + 2, y0: -1, y1: h + 3 } },
        teile: [
          { frage: "Gib den Scheitelpunkt an. Wie hoch ist der Bogen?", be: 2, felder: [zf("xs", "x_S", w), zf("ys", "Höhe in m", h)],
            loesung: [`S(−d | e) = S(${w} | ${h}) – der Bogen ist ${h} m hoch.`] },
          { frage: "Wie weit ist der Bogen am Boden gespannt (Abstand der Fußpunkte)?", be: 3, felder: [zf("sp", "Spannweite in m", 2 * w, 0.05)],
            loesung: [`Nullstellen: ${zahl(s.a, 5)}(x − ${w})² + ${h} = 0`, `(x − ${w})² = ${w * w}  ⟹  x − ${w} = ±${w}`, `x₁ = 0, x₂ = ${2 * w}  ⟹  Spannweite ${2 * w} m`] },
          { frage: `Wie hoch ist der Bogen ${xs} m vom linken Fußpunkt entfernt?`, be: 2, felder: [zf("hx", `f(${xs}) in m`, spfWert(s, xs), 0.05)],
            loesung: [`f(${xs}) = ${zahl(s.a, 5)}·(${xs} − ${w})² + ${h} = ${m(spfWert(s, xs))}`] },
          { frage: `Ein ${breite} m breites Boot fährt genau in der Mitte durch. Wie hoch darf es höchstens sein?`, be: 3, felder: [zf("hb", "Höhe in m", hSchiff, 0.05)],
            loesung: [`Die Bootskante liegt ${breite / 2} m neben der Mitte: x = ${w} − ${breite / 2} = ${w - breite / 2}`, `f(${w - breite / 2}) = ${m(hSchiff)}  ⟹  höchstens ${m(hSchiff)}`] },
        ],
      };
    }
    case "basketball": {
      const a = eins(r, [-0.2, -0.25, -0.3]);
      const xs = eins(r, [2.5, 3, 3.5]);
      const korbX = eins(r, [5.5, 6, 6.5].filter(k => k > xs + 2));
      // Bahn so wählen, dass sie durch den Korb (korbX | 3,05) geht
      const ys = glatt(3.05 - a * (korbX - xs) ** 2);
      const s: SPF = { a, d: glatt(-xs), e: ys };
      const f = spfZuNf(s);
      const h0 = spfWert(s, 0);
      const ziel = eins(r, [1, 1.5, 2]);
      return {
        art, titel: "Basketball-Wurf",
        kontext: `Die Flugbahn eines Basketballs wird durch f(x) = ${spfText(s, "").replace("y = ", "")} beschrieben (x: waagerechter Abstand zum Werfer, y: Höhe, beides in m). Der Korb hängt in 3,05 m Höhe.`,
        funktion: spfText(s, "f(x) = "),
        graph: { kurven: [{ f }], punkte: [{ x: korbX, y: 3.05, label: "Korb" }], bereich: { x0: -0.5, x1: 8, y0: 0, y1: Math.ceil(ys + 1) } },
        teile: [
          { frage: "In welcher Höhe verlässt der Ball die Hand (x = 0)?", be: 2, felder: [zf("h0", "f(0) in m", h0, 0.02)], loesung: [`f(0) = ${zahl(a)}·(0 − ${zahl(xs)})² + ${zahl(ys)} = ${m(h0)}`] },
          { frage: "Wie hoch fliegt der Ball höchstens, und in welchem Abstand?", be: 2, felder: [zf("xs", "Abstand in m", xs), zf("ys", "Höhe in m", ys, 0.02)], loesung: [`S(${zahl(xs)} | ${zahl(ys)})  ⟹  ${m(ys)} hoch, ${m(xs)} vom Werfer entfernt`] },
          { frage: "In welchem Abstand vom Werfer erreicht der Ball auf dem Weg nach unten die Korbhöhe 3,05 m?", be: 4, felder: [zf("k", "Abstand in m", korbX, 0.03)],
            loesung: [`${zahl(a)}(x − ${zahl(xs)})² + ${zahl(ys)} = 3,05`, `(x − ${zahl(xs)})² = ${zahl((3.05 - ys) / a, 3)}`, `x − ${zahl(xs)} = ±${zahl(korbX - xs)}  ⟹  auf dem Weg nach unten x = ${zahl(korbX)} m`] },
          { frage: `Wie hoch ist der Ball ${zahl(ziel)} m vor dem Korb (x = ${zahl(korbX - ziel)})?`, be: 2, felder: [zf("hz", "Höhe in m", spfWert(s, korbX - ziel), 0.02)], loesung: [`f(${zahl(korbX - ziel)}) = ${m(spfWert(s, korbX - ziel))}`] },
        ],
      };
    }
    case "brunnen": {
      // die Düse muss über dem Wasser liegen: f(0) = a·xs² + ys > 0
      const [a, xs, ys] = eins(r, ([[-0.5, 1, 2], [-0.5, 2, 3], [-0.5, 1.5, 2.5], [-1, 1, 2], [-1, 1, 3], [-1, 1.5, 3], [-1, 1.5, 4], [-2, 1, 3], [-2, 1, 4]] as const));
      const s: SPF = { a, d: -xs, e: ys };
      const f = spfZuNf(s);
      const n = pqFormel(f).xs;
      return {
        art, titel: "Springbrunnen",
        kontext: `Ein Wasserstrahl kommt aus einer Düse am Beckenrand. Seine Bahn ist f(x) = ${nfText(f, "")} (x: Abstand zur Düse, y: Höhe über dem Wasser, in m).`,
        funktion: nfText(f, "f(x) = "),
        graph: { kurven: [{ f }], bereich: { x0: -0.5, x1: Math.ceil(n[1] + 0.5), y0: -0.5, y1: Math.ceil(ys + 1) } },
        teile: [
          { frage: "In welcher Höhe liegt die Düse?", be: 1, felder: [zf("c", "f(0) in m", f.c, 0.02)], loesung: [`f(0) = c = ${m(f.c)}`] },
          { frage: "Forme in die Scheitelpunktform um. Wie hoch steigt der Strahl, und wo?", be: 4, felder: [zf("xs", "Abstand in m", xs, 0.02), zf("ys", "Höhe in m", ys, 0.02)], loesung: ergaenzen(f) },
          { frage: "In welcher Entfernung von der Düse trifft der Strahl auf das Wasser?", be: 3, felder: [zf("x2", "Entfernung in m", n[1], 0.03)], loesung: [...pqFormel(f).schritte, `Nur die positive Lösung passt: ${m(n[1])}`] },
        ],
      };
    }
    case "gewinn": {
      const a = eins(r, [-1, -2]);
      const x1 = eins(r, [5, 10, 15]), x2 = eins(r, [35, 40, 45, 50]);
      const f: NF = { a, b: glatt(-a * (x1 + x2)), c: glatt(a * x1 * x2) };
      const s = nfZuSpf(f);
      const xt = eins(r, [20, 25, 30]);
      return {
        art, titel: "Gewinn eines Schulkiosks",
        kontext: `Der Schülerkiosk verkauft selbstgemachte Waffeln. Für einen Preis von x Cent pro Stück rechnet die Kiosk-AG mit dem Wochengewinn G(x) = ${nfText(f, "")} (in Cent).`,
        funktion: nfText(f, "G(x) = "),
        graph: { kurven: [{ f }], bereich: { x0: 0, x1: x2 + 5, y0: Math.floor(f.c / 100) * 100 - 100, y1: Math.ceil(s.e / 100) * 100 + 100 } },
        teile: [
          { frage: "Zwischen welchen Preisen macht der Kiosk Gewinn? (Nullstellen)", be: 4, felder: [zf("x1", "von x =", x1), zf("x2", "bis x =", x2)], loesung: [...pqFormel(f, "G(x)").schritte, `Gewinn zwischen ${x1} ct und ${x2} ct`] },
          { frage: "Bei welchem Preis ist der Gewinn am größten, und wie groß ist er?", be: 3, felder: [zf("xs", "Preis in ct", -s.d), zf("ys", "Gewinn in ct", s.e, 0.5)], loesung: [...ergaenzen(f).slice(1), `Höchster Gewinn ${zahl(s.e)} ct bei ${zahl(-s.d)} ct`] },
          { frage: `Wie groß ist der Gewinn bei einem Preis von ${xt} ct?`, be: 1, felder: [zf("gt", `G(${xt})`, wert(f, xt), 0.5)], loesung: [`G(${xt}) = ${zahl(wert(f, xt))} ct`] },
        ],
      };
    }
    case "zaun": {
      const L = eins(r, [20, 24, 30, 36, 40]);
      const f: NF = { a: -2, b: L, c: 0 };
      const s = nfZuSpf(f);
      const xt = eins(r, [3, 4, 5]);
      return {
        art, titel: "Gehege an der Mauer",
        kontext: `Mit ${L} m Zaun soll an einer Mauer ein rechteckiges Schafgehege abgesteckt werden; die Mauer bildet eine Seite. Die beiden Seiten senkrecht zur Mauer sind je x m lang.`,
        funktion: "A(x) = x · (" + L + " − 2x)",
        graph: { kurven: [{ f }], bereich: { x0: -1, x1: L / 2 + 1, y0: -5, y1: Math.ceil(s.e / 10) * 10 + 10 } },
        teile: [
          { frage: `Begründe A(x) = x · (${L} − 2x) und forme in die Normalform um.`, be: 3, felder: [zf("a", "a", -2), zf("b", "b", L), zf("c", "c", 0)], loesung: [`Seite parallel zur Mauer: ${L} − 2x`, `A(x) = x · (${L} − 2x) = −2x² + ${L}x`] },
          { frage: "Für welches x ist die Fläche am größten? Wie groß ist sie?", be: 4, felder: [zf("x", "x in m", -s.d), zf("A", "Fläche in m²", s.e)], loesung: [...ergaenzen(f).slice(1), `x = ${zahl(-s.d)} m, A = ${zahl(s.e)} m²`] },
          { frage: `Wie groß ist die Fläche für x = ${xt} m?`, be: 1, felder: [zf("At", "A in m²", wert(f, xt))], loesung: [`A(${xt}) = ${xt} · (${L} − ${2 * xt}) = ${zahl(wert(f, xt))} m²`] },
        ],
      };
    }
    case "rampe": {
      const a = eins(r, [-0.5, -0.25]);
      const xs = eins(r, [2, 3]), ys = eins(r, [4, 5]);
      const s: SPF = { a, d: -xs, e: ys };
      const f = spfZuNf(s);
      // Rampe als Gerade durch zwei Punkte der Parabel mit ganzzahligem x
      const xA = xs + eins(r, [1, 2]), xB = xA + 2;
      const mm = glatt((wert(f, xB) - wert(f, xA)) / (xB - xA));
      const g: NF = { a: 0, b: mm, c: glatt(wert(f, xA) - mm * xA) };
      const sp = schnitt(f, g).punkte;
      return {
        art, titel: "Wasserstrahl und Rampe",
        kontext: `Ein Wasserstrahl folgt f(x) = ${nfText(f, "")}, eine gerade Rampe verläuft entlang g(x) = ${nfText(g, "")} (x und y in m).`,
        funktion: nfText(f, "f(x) = "),
        graph: { kurven: [{ f }, { f: g, farbe: "#2563eb" }], punkte: sp.map((p, i) => ({ ...p, label: `S${i + 1}` })), bereich: { x0: -1, x1: xB + 2, y0: -1, y1: ys + 2 } },
        teile: [
          { frage: "Wie hoch steigt der Strahl höchstens?", be: 2, felder: [zf("ys", "Höhe in m", ys, 0.02)], loesung: ergaenzen(f) },
          { frage: "Berechne die Schnittpunkte von Strahl und Rampe.", be: 5, felder: [zf("x1", "S₁: x", sp[0].x), zf("y1", "S₁: y", sp[0].y), zf("x2", "S₂: x", sp[1].x), zf("y2", "S₂: y", sp[1].y)], loesung: schnitt(f, g).schritte },
        ],
      };
    }
  }
}

/* ─────────────────────────────────────────────── Spiel Korbwurf ── */

export const KORB_HOEHE = 3.05;
export const ABWURF: Punkt = { x: 0, y: 2 };

export type Hindernis = { x0: number; x1: number; y0: number; y1: number; name: string };
export type Level = { korbX: number; hindernisse: Hindernis[]; decke?: number; text: string };

export const LEVELS: Level[] = [
  { korbX: 4, hindernisse: [], text: "Freier Wurf aus 4 m." },
  { korbX: 5.5, hindernisse: [], text: "Etwas weiter weg." },
  { korbX: 4.5, hindernisse: [{ x0: 1.2, x1: 1.6, y0: 0, y1: 2.9, name: "Verteidiger" }], text: "Ein Verteidiger springt hoch – über ihn hinweg!" },
  { korbX: 6.5, hindernisse: [], decke: 5, text: "Halle mit niedriger Decke (5 m)." },
  { korbX: 5, hindernisse: [{ x0: 1, x1: 1.4, y0: 0, y1: 3.2, name: "Center" }], decke: 5.2, text: "Großer Center und niedrige Decke." },
  { korbX: 7, hindernisse: [{ x0: 3, x1: 3.4, y0: 0, y1: 3.4, name: "Verteidiger" }], text: "Dreier-Distanz mit Block in der Mitte." },
  { korbX: 3.5, hindernisse: [], decke: 4, text: "Kurz, aber die Decke hängt tief (4 m)." },
  { korbX: 6, hindernisse: [{ x0: 1.5, x1: 1.9, y0: 0, y1: 3.4, name: "Center" }, { x0: 4.2, x1: 4.6, y0: 0, y1: 3.6, name: "Springer" }], decke: 6, text: "Zwei Verteidiger – hoch und weit." },
];

/** Bahn durch den Abwurfpunkt mit Scheitel S: a so, dass f(ABWURF.x) = ABWURF.y. */
export function wurfbahn(S: Punkt): SPF | null {
  const dx = ABWURF.x - S.x;
  if (Math.abs(dx) < 1e-6 || S.y <= ABWURF.y) return null;
  // a ungerundet lassen, sonst trifft die Bahn die Hand nur ungefähr
  return { a: (ABWURF.y - S.y) / (dx * dx), d: glatt(-S.x), e: glatt(S.y) };
}

export type Wurf = { treffer: boolean; grund: string; ende: number };

/** Fliegt die Bahn durch den Korb? Prüft Hindernisse und Decke auf dem Weg dorthin. */
export function wirf(s: SPF, lv: Level): Wurf {
  const S = scheitel(s);
  for (let x = 0; x <= lv.korbX; x += 0.02) {
    const y = spfWert(s, x);
    if (lv.decke !== undefined && y > lv.decke) return { treffer: false, grund: "an die Decke", ende: x };
    for (const h of lv.hindernisse) if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return { treffer: false, grund: `vom ${h.name} geblockt`, ende: x };
    if (y < 0) return { treffer: false, grund: "zu kurz – auf dem Boden", ende: x };
  }
  const yk = spfWert(s, lv.korbX);
  if (S.x >= lv.korbX) return { treffer: false, grund: "noch im Steigen am Korb – der Ball muss von oben kommen", ende: lv.korbX };
  if (Math.abs(yk - KORB_HOEHE) <= 0.18) return { treffer: true, grund: "Korb!", ende: lv.korbX };
  return { treffer: false, grund: yk > KORB_HOEHE ? "zu hoch – über den Korb" : "zu tief – unter den Ring", ende: lv.korbX + 1.5 };
}
