/**
 * Das Teilchenmodell als kleine Simulation.
 *
 * Jedes Teilchen ist in einem von drei Bewegungsarten:
 *  - »gitter«: es sitzt an einem Gitterplatz und schwingt nur — fester Stoff.
 *    Je näher am Schmelzpunkt, desto heftiger.
 *  - »fluessig«: frei, aber die Teilchen ziehen sich an und fallen nach unten.
 *  - »gas«: frei, ohne Anziehung, schnell — füllt den ganzen Raum.
 *
 * Welche Art gilt, sagt der Schmelz- und Siedepunkt des Stoffs bei der
 * örtlichen Temperatur. Beim Erstarren sucht sich ein Teilchen den nächsten
 * freien Gitterplatz, aber nur, wenn darunter Boden oder schon Kristall ist —
 * so wächst der Kristall von unten. Beim Schmelzen lösen sich die Plätze
 * nacheinander.
 *
 * Gemische: gleich gebaute Flüssigkeiten ziehen sich an und mischen sich,
 * ungleiche kaum — dann sinkt die dichtere nach unten. Lösliche Feststoffe
 * werden von den Lösemittelteilchen einzeln aus dem Gitter geholt, bis die
 * Lösung gesättigt ist.
 *
 * Reaktionen: treffen genug Edukt-Teilchen aufeinander und ist es heiß genug,
 * werden sie durch die Produkte ersetzt — Atom für Atom, nichts geht verloren.
 * Die frei werdende Wärme ist ein heißer Fleck, der die Nachbarn zündet.
 */
import { loestSichIn, mischbar, phaseVon, stoff, type Stoff } from "./stoffe";

export const BREITE = 640;
export const HOEHE = 360;

export type Bewegung = "gitter" | "fluessig" | "gas";

export type Teilchen = {
  id: number;
  /** Stelle in `szene.stoffe`. */
  s: number;
  /** Welche Form (bei Ionen: Kation 0, Anion 1). */
  form: number;
  x: number; y: number; vx: number; vy: number;
  /** Drehung des Teilchenbilds und ihre Geschwindigkeit. */
  phi: number; om: number;
  platz: string | null;
  /** Restzeit, bis es beim Schmelzen seinen Platz verlässt. */
  los: number;
  /** Will fest werden, findet aber noch keinen Platz — so lange schon. */
  warte: number;
  geloest: boolean;
  /** So lange schon kein Lösemittel mehr in der Nähe. */
  ohne: number;
  /** Links (0) oder rechts (1) der Trennwand. */
  seite: 0 | 1;
  bewegung: Bewegung;
  /** Wärme aus dem Brenner, 0–1 — nur zum Einfärben, damit man die Umwälzung sieht. */
  w: number;
};

export type Heiss = {
  x: number; y: number; r: number; dT: number; t: number; dauer: number;
  /** Wandert mit diesem Teilchen mit — heiße Produkte tragen die Flamme weiter. */
  folgt?: number;
};

export type Reaktion = {
  id: string;
  titel: string;
  gleichung: string;
  edukte: [string, number][];
  produkte: [string, number][];
  /** °C, ab der die Edukte reagieren (Aktivierung, Zündtemperatur). */
  start: number;
  /** Örtliche Erwärmung je Umsatz in K; negativ = es wird kalt. */
  waerme: number;
  /** Über dieser Temperatur zerfallen die Produkte wieder. */
  rueckAb?: number;
  /** Edukte links und rechts einer Trennwand. */
  getrennt?: boolean;
  /** Formelumsätze, die anfangs im Gefäß sind. */
  menge: number;
  /** Mehr von einem Edukt (Faktor) — Gas über einem Feststoff braucht Überschuss, sonst trifft es kaum. */
  extra?: Record<string, number>;
  text: string;
};

export type Szene = {
  stoffe: Stoff[];
  t: Teilchen[];
  /** Temperatur des Gefäßes in °C. */
  T: number;
  wand: boolean;
  heiss: Heiss[];
  plaetze: Map<string, number>;
  /** Gitterabstand. */
  a: number;
  reaktion: Reaktion | null;
  umsatz: number;
  rueck: number;
  nId: number;
};

export type Zufall = () => number;

export const REAKTIONEN: Reaktion[] = [
  { id: "knallgas", titel: "Knallgas", gleichung: "2 H₂ + O₂ → 2 H₂O", edukte: [["h2", 2], ["o2", 1]], produkte: [["h2o", 2]], start: 560, waerme: 1800, menge: 28,
    text: "Wasserstoff und Sauerstoff liegen bei Raumtemperatur friedlich nebeneinander. Erst ein Funke (oder über 560 °C) bringt genug Energie — dann zündet jede Reaktion die Nachbarn: eine Explosion. Danach kondensiert das Wasser." },
  { id: "chlorknallgas", titel: "Chlorknallgas", gleichung: "H₂ + Cl₂ → 2 HCl", edukte: [["h2", 1], ["cl2", 1]], produkte: [["hcl", 2]], start: 400, waerme: 1300, menge: 36,
    text: "Wie Knallgas, nur mit Chlor. In der Wirklichkeit reicht schon helles Licht als Zünder." },
  { id: "methan", titel: "Erdgas verbrennt", gleichung: "CH₄ + 2 O₂ → CO₂ + 2 H₂O", edukte: [["ch4", 1], ["o2", 2]], produkte: [["co2", 1], ["h2o", 2]], start: 600, waerme: 1500, menge: 20,
    text: "Die Verbrennung im Gasherd: aus Methan und Sauerstoff werden Kohlenstoffdioxid und Wasser. Ohne Zündung passiert nichts." },
  { id: "kohle", titel: "Kohlenstoff verbrennt", gleichung: "C + O₂ → CO₂", edukte: [["c", 1], ["o2", 1]], produkte: [["co2", 1]], start: 700, waerme: 1200, menge: 30, extra: { o2: 3 },
    text: "Die Kohle reagiert nur an der Oberfläche — dort, wo Sauerstoff hinkommt. Das Gas CO₂ fliegt davon, die Kohle wird weniger." },
  { id: "magnesium", titel: "Magnesium verbrennt", gleichung: "2 Mg + O₂ → 2 MgO", edukte: [["mg", 2], ["o2", 1]], produkte: [["mgo", 2]], start: 650, waerme: 2500, menge: 22, extra: { o2: 3 },
    text: "Magnesium brennt mit grellweißem Licht. Aus Metall und Gas wird ein weißes Pulver — ein Ionengitter aus Mg²⁺ und O²⁻." },
  { id: "kupfer", titel: "Kupfer oxidiert", gleichung: "2 Cu + O₂ → 2 CuO", edukte: [["cu", 2], ["o2", 1]], produkte: [["cuo", 2]], start: 300, waerme: 400, menge: 22, extra: { o2: 3 },
    text: "Kupferblech in der Flamme wird schwarz: an der Oberfläche entsteht Kupferoxid. Darunter bleibt Kupfer — der Sauerstoff kommt nicht hin." },
  { id: "eisensulfid", titel: "Eisen und Schwefel", gleichung: "Fe + S → FeS", edukte: [["fe", 1], ["s", 1]], produkte: [["fes", 1]], start: 500, waerme: 900, menge: 30,
    text: "Ein Gemenge aus Eisen- und Schwefelpulver: mit dem Magneten wieder trennbar. Einmal angezündet, glüht es von selbst durch — danach ist es ein neuer Stoff, Eisensulfid. (Schwefel als einzelne Atome gezählt, eigentlich S₈-Ringe.)" },
  { id: "natriumchlorid", titel: "Natrium und Chlor", gleichung: "2 Na + Cl₂ → 2 NaCl", edukte: [["na", 2], ["cl2", 1]], produkte: [["nacl", 2]], start: 100, waerme: 1500, menge: 18, extra: { cl2: 2.5 },
    text: "Ein weiches Metall und ein giftiges Gas werden zu Kochsalz. Natrium gibt je ein Elektron ab, Chlor nimmt es auf — es entsteht ein Ionengitter." },
  { id: "salmiak", titel: "Salmiak-Nebel", gleichung: "NH₃ + HCl → NH₄Cl", edukte: [["nh3", 1], ["hcl", 1]], produkte: [["nh4cl", 1]], start: -100, waerme: 250, getrennt: true, menge: 24,
    text: "Zwei Gase hinter einer Wand. Wand weg: wo sie sich treffen, entsteht sofort weißer Rauch aus festem Salmiak — schon bei Raumtemperatur." },
  { id: "haber", titel: "Ammoniak-Synthese", gleichung: "N₂ + 3 H₂ ⇌ 2 NH₃", edukte: [["n2", 1], ["h2", 3]], produkte: [["nh3", 2]], start: 400, waerme: 200, rueckAb: 700, menge: 10,
    text: "Das Haber-Bosch-Verfahren, vereinfacht: ab etwa 400 °C (in Wahrheit mit Katalysator und hohem Druck) bildet sich Ammoniak. Wird es zu heiß, zerfällt es wieder — ein Gleichgewicht." },
  { id: "kalk", titel: "Kalk brennen", gleichung: "CaCO₃ → CaO + CO₂", edukte: [["caco3", 1]], produkte: [["cao", 1], ["co2", 1]], start: 825, waerme: -300, menge: 24,
    text: "Kalkstein zerfällt beim starken Erhitzen in Branntkalk und Kohlenstoffdioxid. Das kostet Energie (endotherm): ohne Hitze von außen hört es sofort auf." },
];

const K = (T: number) => T + 273.15;

/** Typische Geschwindigkeit eines Teilchens bei T (°C) in Bildpunkten je Sekunde. */
export const tempo = (T: number, masse: number): number =>
  Math.max(4, Math.min(650, 150 * Math.sqrt(Math.max(0, K(T)) / 300) * (30 / masse) ** 0.25));

/** Gitterplätze: Sechseckgitter, Zeile 0 liegt am Boden. */
export function platzLage(a: number, key: string): { x: number; y: number } {
  const [k, m] = key.split(",").map(Number);
  return { x: a / 2 + (k % 2) * a / 2 + m * a, y: HOEHE - a / 2 - k * a * 0.866 };
}

function freieGitterplaetze(sz: Szene, x0: number, x1: number): string[] {
  const aus: string[] = [];
  for (let k = 0; HOEHE - sz.a / 2 - k * sz.a * 0.866 > sz.a / 2; k++) {
    for (let m = 0; ; m++) {
      const key = `${k},${m}`;
      const p = platzLage(sz.a, key);
      if (p.x > BREITE - sz.a / 2) break;
      if (p.x < x0 + sz.a / 2 || p.x > x1 - sz.a / 2 || sz.plaetze.has(key)) continue;
      aus.push(key);
    }
  }
  return aus;
}

const gauss = (z: Zufall) => (z() + z() + z() - 1.5) * 2;

function neuesTeilchen(sz: Szene, s: number, form: number, x: number, y: number, seite: 0 | 1, z: Zufall): Teilchen {
  const st = sz.stoffe[s];
  const v = tempo(sz.T, st.masse), w = z() * Math.PI * 2;
  return {
    id: sz.nId++, s, form, x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, phi: z() * Math.PI * 2, om: 0,
    platz: null, los: 0, warte: 0, geloest: false, ohne: 0, seite, bewegung: "gas", w: 0,
  };
}

/** Legt Teilchen aus: Feststoffe ins Gitter, Flüssigkeiten unten hin, Gase irgendwohin. */
function lege(sz: Szene, liste: { s: number; form: number }[], x0: number, x1: number, seite: 0 | 1, z: Zufall) {
  const frei = freieGitterplaetze(sz, x0, x1);
  // Ionen sollen sich im Gitter abwechseln: die Form richtet sich nach dem
  // Platz, solange von ihr noch welche übrig sind — die Summe bleibt gleich.
  const rest = new Map<string, number>();
  for (const { s, form } of liste) rest.set(`${s}:${form}`, (rest.get(`${s}:${form}`) ?? 0) + 1);
  let i = 0;
  for (const eintrag of liste) {
    const { s } = eintrag;
    let { form } = eintrag;
    const ph = phaseVon(sz.stoffe[s], sz.T);
    if (sz.stoffe[s].formen.length === 2 && ph !== "gasförmig" && i < frei.length) {
      const [k, m] = frei[i].split(",").map(Number);
      const will = (m + Math.floor(k / 2)) % 2;
      if ((rest.get(`${s}:${will}`) ?? 0) > 0) form = will;
      else if ((rest.get(`${s}:${form}`) ?? 0) <= 0) form = 1 - form;
    }
    rest.set(`${s}:${form}`, (rest.get(`${s}:${form}`) ?? 0) - 1);
    if (ph === "gasförmig" || i >= frei.length) {
      const r = sz.stoffe[s].r;
      sz.t.push(neuesTeilchen(sz, s, form, x0 + r + z() * (x1 - x0 - 2 * r), r + z() * (HOEHE * 0.6), seite, z));
      continue;
    }
    const key = frei[i++];
    const p = platzLage(sz.a, key);
    const t = neuesTeilchen(sz, s, form, p.x, p.y, seite, z);
    t.vx *= 0.2; t.vy *= 0.2;
    if (ph === "fest" || (ph === "zersetzt" && sz.stoffe[s].schmelz === null)) {
      t.platz = key; sz.plaetze.set(key, t.id); t.bewegung = "gitter"; t.los = 0.5;
    } else t.bewegung = "fluessig";
    sz.t.push(t);
  }
}

const mischeReihe = <T,>(a: T[], z: Zufall): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(z() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};

function leereSzene(stoffe: Stoff[], T: number): Szene {
  const rmax = Math.max(...stoffe.map(s => s.r));
  return { stoffe, t: [], T, wand: false, heiss: [], plaetze: new Map(), a: rmax * 2.04, reaktion: null, umsatz: 0, rueck: 0, nId: 1 };
}

const anzahl = (s: Stoff, anteil: number) =>
  Math.round(Math.max(40, Math.min(240, (BREITE * HOEHE * 0.3 * anteil) / (4 * s.r * s.r))) / s.formen.length) * s.formen.length;

export function einzelSzene(id: string, T: number, z: Zufall = Math.random): Szene {
  const s = stoff(id);
  const sz = leereSzene([s], T);
  const n = anzahl(s, 1);
  lege(sz, Array.from({ length: n }, (_, i) => ({ s: 0, form: i % s.formen.length })), 0, BREITE, 0, z);
  return sz;
}

export function mischSzene(a: string, b: string, T: number, z: Zufall = Math.random): Szene {
  const A = stoff(a), B = stoff(b);
  const sz = leereSzene([A, B], T);
  sz.wand = true;
  for (const [s, st] of [[0, A], [1, B]] as const) {
    // Ein Feststoff als kleiner Klumpen, damit die Flüssigkeit ihn umspülen kann.
    const ph = phaseVon(st, T);
    const n = anzahl(st, ph === "fest" ? 0.25 : ph === "gasförmig" ? 0.5 : 0.6);
    lege(sz, Array.from({ length: n }, (_, i) => ({ s, form: i % st.formen.length })),
      s === 0 ? 0 : BREITE / 2 + 3, s === 0 ? BREITE / 2 - 3 : BREITE, s, z);
  }
  return sz;
}

export function reaktionsSzene(r: Reaktion, T: number, z: Zufall = Math.random): Szene {
  const ids = [...new Set([...r.edukte, ...r.produkte].map(([id]) => id))];
  const sz = leereSzene(ids.map(stoff), T);
  sz.reaktion = r;
  const teile = (id: string, n: number) => {
    const s = ids.indexOf(id), st = sz.stoffe[s];
    return Array.from({ length: Math.round(n * r.menge * (r.extra?.[id] ?? 1)) * st.formen.length }, (_, i) => ({ s, form: i % st.formen.length }));
  };
  if (r.getrennt) {
    sz.wand = true;
    lege(sz, teile(...r.edukte[0]), 0, BREITE / 2 - 3, 0, z);
    lege(sz, teile(...r.edukte[1]), BREITE / 2 + 3, BREITE, 1, z);
  } else {
    // Feststoffe zuerst, damit sie unten liegen; gemischt, damit es ein Gemenge ist.
    const alle = mischeReihe(r.edukte.flatMap(([id, n]) => teile(id, n)), z);
    const fest = alle.filter(t => phaseVon(sz.stoffe[t.s], T) !== "gasförmig");
    lege(sz, [...fest, ...alle.filter(t => !fest.includes(t))], 0, BREITE, 0, z);
  }
  return sz;
}

/** Örtliche Temperatur: Gefäß plus heiße Flecken. */
export function ortsTemperatur(sz: Szene, x: number, y: number): number {
  let T = sz.T;
  for (const h of sz.heiss) {
    const d = Math.hypot(x - h.x, y - h.y);
    if (d < h.r) T += h.dT * (1 - h.t / h.dauer) * (1 - d / h.r);
  }
  return T;
}

export function zuende(sz: Szene, x: number, y: number, dT = 1800): void {
  sz.heiss.push({ x, y, r: 110, dT, t: 0, dauer: 1 });
}

/**
 * Wo der Funke hin soll: an die Oberfläche eines festen Edukts, falls eins
 * da ist (dort trifft das Gas auf den Feststoff), sonst in die Mitte.
 */
export function zuendStelle(sz: Szene): { x: number; y: number } {
  const edukte = new Set((sz.reaktion?.edukte ?? []).map(([id]) => sz.stoffe.findIndex(s => s.id === id)));
  const fest = sz.t.filter(p => edukte.has(p.s) && p.bewegung === "gitter");
  if (!fest.length) return { x: BREITE / 2, y: HOEHE / 2 };
  const p = fest.reduce((a, b) => Math.hypot(b.x - BREITE / 2, b.y - HOEHE / 2) < Math.hypot(a.x - BREITE / 2, a.y - HOEHE / 2) ? b : a);
  return { x: p.x, y: p.y };
}

/** Wie viele Atome jedes Elements im Gefäß sind — bleibt bei jeder Reaktion gleich. */
export function atomZahl(sz: Szene): Record<string, number> {
  const z: Record<string, number> = {};
  for (const t of sz.t) for (const [sym] of sz.stoffe[t.s].formen[t.form].atome) z[sym] = (z[sym] ?? 0) + 1;
  return z;
}

/** Teilchen je Stoff (bei Ionen: Formeleinheiten). */
export function stoffZahl(sz: Szene): number[] {
  const z = sz.stoffe.map(() => 0);
  for (const t of sz.t) z[t.s] += 1 / sz.stoffe[t.s].formen.length;
  return z.map(Math.round);
}

export type Ereignis = { x: number; y: number; waerme: number };

/** Will das Teilchen bei T fest sein? */
const willFest = (st: Stoff, T: number) => {
  const ph = phaseVon(st, T);
  return ph === "fest" || (ph === "zersetzt" && st.schmelz === null);
};

function gitterplatzFuer(sz: Szene, p: Teilchen): string | null {
  const a = sz.a;
  const k0 = Math.round((HOEHE - a / 2 - p.y) / (a * 0.866));
  let best: string | null = null, bestD = a * 1.3;
  for (let k = Math.max(0, k0 - 1); k <= k0 + 1; k++) {
    const m0 = Math.round((p.x - a / 2 - (k % 2) * a / 2) / a);
    for (let m = m0 - 1; m <= m0 + 1; m++) {
      if (m < 0) continue;
      const key = `${k},${m}`;
      if (sz.plaetze.has(key)) continue;
      const q = platzLage(a, key);
      if (q.x > BREITE - a / 2 || q.y < a / 2) continue;
      if (sz.wand && (p.seite === 0 ? q.x > BREITE / 2 - a / 2 : q.x < BREITE / 2 + a / 2)) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) { best = key; bestD = d; }
    }
  }
  return best;
}

export function schritt(sz: Szene, dt: number, z: Zufall = Math.random): Ereignis[] {
  const n = sz.t.length;
  const st = sz.t.map(p => sz.stoffe[p.s]);
  const Tl = sz.t.map(p => ortsTemperatur(sz, p.x, p.y));
  const rhoMax = Math.max(...sz.stoffe.map(s => s.dichte));
  const fx = new Float64Array(n), fy = new Float64Array(n);
  // Dichte der flüssigen Nachbarschaft — daraus der Auftrieb.
  const umDichte = new Float64Array(n), umZahl = new Int32Array(n);
  const dichteVon = (p: Teilchen, s: Stoff) => (p.geloest ? 1 : s.dichte);
  const gleich = new Int32Array(n), stuetze = new Uint8Array(n), loeser = new Uint8Array(n), angriff = new Uint8Array(n);

  // Nicht mischbare Flüssigkeiten: jede bekommt ihre Schicht, die dichteste
  // unten. Im Teilchenbild verkeilen sich die Kugeln sonst wie Sand — echte
  // Flüssigkeiten schieben sich über den Druck untereinander.
  const schicht = new Map<number, [number, number]>();
  if (!sz.wand) {
    const zahl = new Map<number, number>();
    for (const p of sz.t) if (p.bewegung === "fluessig" && !p.geloest) zahl.set(p.s, (zahl.get(p.s) ?? 0) + 1);
    const fl = [...zahl.keys()];
    if (fl.some(a => fl.some(b => !mischbar(sz.stoffe[a], sz.stoffe[b])))) {
      let unten = HOEHE;
      for (const k of fl.sort((a, b) => sz.stoffe[b].dichte - sz.stoffe[a].dichte)) {
        const h = (zahl.get(k)! * (2 * sz.stoffe[k].r) ** 2 * 0.9) / BREITE;
        schicht.set(k, [unten - h, unten]);
        unten -= h;
      }
    }
  }

  // Paare: Abstoßung, Anziehung in Flüssigkeiten, Nachbarn zählen.
  for (let i = 0; i < n; i++) {
    const p = sz.t[i];
    for (let j = i + 1; j < n; j++) {
      const q = sz.t[j];
      const dx = q.x - p.x, dy = q.y - p.y;
      const rr = st[i].r + st[j].r;
      if (Math.abs(dx) > rr * 1.6 || Math.abs(dy) > rr * 1.6) continue;
      const d = Math.max(0.5, Math.hypot(dx, dy));
      if (d > rr * 1.6) continue;
      const ux = dx / d, uy = dy / d;
      const bi = p.bewegung, bj = q.bewegung;
      if (d < rr * 1.3) {
        if (p.s === q.s) { gleich[i]++; gleich[j]++; }
        if (bj === "gitter" && q.y > p.y - rr * 0.3) stuetze[i] = 1;
        if (bi === "gitter" && p.y > q.y - rr * 0.3) stuetze[j] = 1;
        // Lösemittel in der Nähe?
        if (bj === "fluessig" && !q.geloest && loestSichIn(st[i], st[j])) { loeser[i] = 1; if (bi === "gitter") angriff[i] = 1; }
        if (bi === "fluessig" && !p.geloest && loestSichIn(st[j], st[i])) { loeser[j] = 1; if (bj === "gitter") angriff[j] = 1; }
      }
      if (bi === "fluessig" && bj === "fluessig") {
        umDichte[i] += dichteVon(q, st[j]); umZahl[i]++;
        umDichte[j] += dichteVon(p, st[i]); umZahl[j]++;
      }
      if (bi === "gitter" && bj === "gitter") continue;
      let f = 0;
      // Beim Entmischen gleiten ungleiche Flüssigkeitsteilchen aneinander vorbei.
      if (d < rr) f = -2500 * (rr - d) * (schicht.size && p.s !== q.s && bi === "fluessig" && bj === "fluessig" ? 0.25 : 1);
      else if (bi !== "gas" && bj !== "gas") {
        let aff: number;
        if (p.s === q.s) aff = p.geloest || q.geloest ? 0.05 : 1;
        else if ((p.geloest && loestSichIn(st[i], st[j])) || (q.geloest && loestSichIn(st[j], st[i]))) aff = 1.2;
        else aff = mischbar(st[i], st[j]) ? 0.9 : 0.08;
        f = 420 * aff;
      }
      fx[i] += ux * f; fy[i] += uy * f;
      fx[j] -= ux * f; fy[j] -= uy * f;
    }
  }

  // Lösen: nur bis zur Sättigung.
  const geloest = sz.stoffe.map(() => 0), loesemittel = sz.stoffe.map(() => 0);
  for (const p of sz.t) if (p.geloest) geloest[p.s]++;
  sz.stoffe.forEach((s, k) => {
    if (!s.loeslichIn) return;
    loesemittel[k] = sz.t.filter(q => q.bewegung === "fluessig" && !q.geloest && loestSichIn(s, sz.stoffe[q.s])).length;
  });

  // Wie hoch die Flüssigkeit jedes Stoffs steht — so weit reicht die Umwälzströmung.
  const hoehe = sz.stoffe.map(() => 0);
  for (const p of sz.t) {
    if (p.bewegung === "fluessig") hoehe[p.s] += ((2 * sz.stoffe[p.s].r) ** 2 * 0.9) / (sz.wand ? BREITE / 2 : BREITE);
  }

  for (let i = 0; i < n; i++) {
    const p = sz.t[i], s = st[i], T = Tl[i];
    const band = p.bewegung === "fluessig" && !p.geloest ? schicht.get(p.s) : undefined;
    if (band) {
      if (p.y < band[0] - s.r) fy[i] += 900;
      else if (p.y > band[1] + s.r) fy[i] -= 900;
    }
    const fest = willFest(s, T) && !p.geloest;

    // Zustandswechsel.
    if (p.platz) {
      if (fest) p.los = 0.15 + z() * 0.7;
      else if ((p.los -= dt) <= 0) { sz.plaetze.delete(p.platz); p.platz = null; }
      if (p.platz && angriff[i] && geloest[p.s] < (s.loeslichkeit ?? 0) * loesemittel[p.s]
        && z() < dt * 0.8 * (1 + Math.max(0, T) / 50)) {
        sz.plaetze.delete(p.platz); p.platz = null; p.geloest = true; geloest[p.s]++;
      }
    } else if (fest) {
      p.warte += dt;
      const amBoden = p.y > HOEHE - sz.a * 0.9;
      if (amBoden || stuetze[i] || (p.warte > 1.5 && gleich[i] >= 2)) {
        const key = gitterplatzFuer(sz, p);
        if (key) { p.platz = key; sz.plaetze.set(key, p.id); p.warte = 0; p.los = 0.5; }
      }
    } else p.warte = 0;
    if (p.geloest) {
      p.ohne = loeser[i] ? 0 : p.ohne + dt;
      if (p.ohne > 0.8) { p.geloest = false; p.ohne = 0; }
    }
    p.bewegung = p.platz ? "gitter" : phaseVon(s, T) === "gasförmig" && !p.geloest ? "gas" : "fluessig";

    // Bewegung.
    const v0 = tempo(T, s.masse);
    if (p.bewegung === "gitter") {
      const q = platzLage(sz.a, p.platz!);
      const schmelzK = K(s.schmelz ?? s.zersetzt ?? 1000);
      const A = s.r * (0.05 + 0.4 * Math.min(1, K(T) / Math.max(50, schmelzK)));
      const sigma = A * Math.sqrt(2 * 12 * 600);
      p.vx += (600 * (q.x - p.x) - 12 * p.vx + fx[i] * 0.3) * dt + sigma * gauss(z) * Math.sqrt(dt);
      p.vy += (600 * (q.y - p.y) - 12 * p.vy + fy[i] * 0.3) * dt + sigma * gauss(z) * Math.sqrt(dt);
      p.om *= 0.9;
      // Im Kristall stehen alle Teilchen gleich ausgerichtet.
      p.phi -= Math.atan2(Math.sin(p.phi), Math.cos(p.phi)) * Math.min(1, 5 * dt);
    } else {
      const gas = p.bewegung === "gas";
      const dichte = p.geloest ? 1 : s.dichte;
      const g = gas ? 15 : 500 * (0.4 + 0.6 * Math.min(1, dichte / rhoMax));
      // Leichter als die Umgebung: steigt auf; schwerer: sinkt (Öl auf Wasser).
      const auftrieb = !gas && umZahl[i] ? 4000 * (umDichte[i] / umZahl[i] - dichte) / (umDichte[i] / umZahl[i]) : 0;
      if (gas) {
        p.vx += fx[i] * dt;
        p.vy += (fy[i] + g) * dt;
        const tempoJetzt = Math.hypot(p.vx, p.vy);
        if (tempoJetzt < 1) { const w = z() * Math.PI * 2; p.vx = Math.cos(w) * v0; p.vy = Math.sin(w) * v0; }
        else { const k = 1 + 0.03 * (v0 / tempoJetzt - 1); p.vx *= k; p.vy *= k; }
      } else {
        // Wärmebad: Reibung plus Zufallsstöße je Teilchen. Eine gemeinsame
        // Strömung wird so gedämpft — die Flüssigkeit schwappt nicht, sie zittert.
        // Je näher am Siedepunkt, desto heftiger.
        const reib = 4, vth = v0 * 0.35, stoss = vth * Math.sqrt(2 * reib * dt);
        // Konvektion: unten in der Mitte heizt der Brenner. Je näher am Siedepunkt, desto stärker.
        const oben = s.siede ?? s.zersetzt ?? (s.schmelz ?? 0) + 300;
        const stark = Math.max(0, Math.min(1, (T - (s.schmelz ?? -273)) / Math.max(1, oben - (s.schmelz ?? -273))));
        if (p.y > HOEHE - 3 * s.r && Math.abs(p.x - BREITE / 2) < BREITE * 0.2) p.w += (1 - p.w) * Math.min(1, 3 * dt);
        else p.w -= p.w * Math.min(1, 0.4 * dt);
        // Die Strömung: zwei Walzen in der Flüssigkeit (Stromfunktion
        // ψ = A·sin(2πx/b)·sin(πy/h)), oben und unten ohne Senkrechtanteil —
        // so bleibt die Oberfläche glatt. Als Auftriebskraft gerechnet, gäbe es
        // eine Fontäne, die die Oberfläche hochdrückt. Die Reibung zieht jedes
        // Teilchen zur Strömung hin.
        const [x0, x1] = sz.wand ? (p.seite === 0 ? [0, BREITE / 2] : [BREITE / 2, BREITE]) : [0, BREITE];
        const b = x1 - x0, h = Math.max(4 * s.r, hoehe[p.s]), oberkante = HOEHE - h;
        let ux = 0, uy = 0;
        if (p.y > oberkante && stark > 0) {
          const sx = (2 * Math.PI) / b, sy = Math.PI / h;
          // Geschwindigkeit in der Walzenmitte: bis 90 px/s.
          const A = (90 * stark) / sx;
          // uy < 0 heißt nach oben: in der Mitte (cos = −1) steigt es auf.
          ux = -A * sy * Math.sin(sx * (p.x - x0)) * Math.cos(sy * (p.y - oberkante));
          uy = A * sx * Math.cos(sx * (p.x - x0)) * Math.sin(sy * (p.y - oberkante));
        }
        p.vx += (fx[i] - reib * (p.vx - ux)) * dt + stoss * gauss(z);
        p.vy += (fy[i] + g - auftrieb - reib * (p.vy - uy)) * dt + stoss * gauss(z);
      }
      p.om += gauss(z) * (gas ? 8 : 3) * dt;
      p.om = Math.max(-8, Math.min(8, p.om * (gas ? 0.999 : 0.97)));
    }
    if (p.bewegung !== "fluessig") p.w = 0;
    p.x += p.vx * dt; p.y += p.vy * dt; p.phi += p.om * dt;

    // Wände.
    const r = s.r, e = p.bewegung === "gas" ? 1 : 0.3;
    let lo = r, hi = BREITE - r;
    if (sz.wand) { if (p.seite === 0) hi = BREITE / 2 - 3 - r; else lo = BREITE / 2 + 3 + r; }
    if (p.x < lo) { p.x = lo; p.vx = Math.abs(p.vx) * e; }
    if (p.x > hi) { p.x = hi; p.vx = -Math.abs(p.vx) * e; }
    if (p.y < r) { p.y = r; p.vy = Math.abs(p.vy) * e; }
    if (p.y > HOEHE - r) { p.y = HOEHE - r; p.vy = -Math.abs(p.vy) * e; }
  }

  const ereignisse = sz.reaktion ? reagiere(sz, dt, z) : [];

  const lage = new Map(sz.t.map(p => [p.id, p]));
  for (const h of sz.heiss) {
    h.t += dt;
    const p = h.folgt !== undefined ? lage.get(h.folgt) : undefined;
    if (p) { h.x = p.x; h.y = p.y; }
  }
  sz.heiss = sz.heiss.filter(h => h.t < h.dauer).slice(-150);
  return ereignisse;
}

/** Edukte (oder rückwärts die Produkte) suchen sich Partner und werden ausgetauscht. */
function reagiere(sz: Szene, dt: number, z: Zufall): Ereignis[] {
  const r = sz.reaktion!;
  const aus: Ereignis[] = [];
  const weg = new Set<number>();
  const neu: Teilchen[] = [];
  const idx = (id: string) => sz.stoffe.findIndex(s => s.id === id);
  const rmax = Math.max(...sz.stoffe.map(s => s.r));

  const versuche = (von: [string, number][], zu: [string, number][], ab: number, rate: number, waerme: number, rueck: boolean) => {
    const braucht = new Map(von.map(([id, k]) => [idx(id), k * sz.stoffe[idx(id)].formen.length]));
    for (const p of mischeReihe(sz.t, z)) {
      if (weg.has(p.id) || !braucht.has(p.s)) continue;
      if (z() > dt * rate) continue;
      if (ortsTemperatur(sz, p.x, p.y) < ab) continue;
      const fehlt = new Map(braucht);
      fehlt.set(p.s, fehlt.get(p.s)! - 1);
      const genommen = [p];
      const nah = sz.t
        .filter(q => q !== p && !weg.has(q.id) && (!sz.wand || q.seite === p.seite) && (fehlt.get(q.s) ?? 0) > 0 && Math.hypot(q.x - p.x, q.y - p.y) < rmax * 10)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      for (const q of nah) {
        if ((fehlt.get(q.s) ?? 0) <= 0) continue;
        fehlt.set(q.s, fehlt.get(q.s)! - 1);
        genommen.push(q);
      }
      if ([...fehlt.values()].some(k => k > 0)) continue;
      // Umsetzen: Atome bleiben, die Teilchen wechseln.
      let cx = 0, cy = 0;
      for (const q of genommen) { weg.add(q.id); cx += q.x; cy += q.y; if (q.platz) sz.plaetze.delete(q.platz); }
      cx /= genommen.length; cy /= genommen.length;
      const Tneu = ortsTemperatur(sz, cx, cy) + Math.max(0, waerme);
      for (const [id, k] of zu) {
        const s = idx(id), st = sz.stoffe[s];
        for (let i = 0; i < k * st.formen.length; i++) {
          const w = z() * Math.PI * 2, rad = z() * rmax * 1.5;
          const t = neuesTeilchen(sz, s, i % st.formen.length,
            Math.max(st.r, Math.min(BREITE - st.r, cx + Math.cos(w) * rad)),
            Math.max(st.r, Math.min(HOEHE - st.r, cy + Math.sin(w) * rad)), genommen[0].seite, z);
          const v = tempo(Tneu, st.masse);
          t.vx = Math.cos(w) * v; t.vy = Math.sin(w) * v;
          neu.push(t);
          if (waerme > 0) sz.heiss.push({ x: t.x, y: t.y, r: 45, dT: waerme * 0.6, t: 0, dauer: 0.5, folgt: t.id });
        }
      }
      if (waerme !== 0) sz.heiss.push({ x: cx, y: cy, r: 120, dT: waerme, t: 0, dauer: 0.9 });
      aus.push({ x: cx, y: cy, waerme });
      if (rueck) sz.rueck++; else sz.umsatz++;
    }
  };

  versuche(r.edukte, r.produkte, r.start, 15, r.waerme, false);
  if (r.rueckAb !== undefined) versuche(r.produkte, r.edukte, r.rueckAb, 3, -Math.abs(r.waerme) / 2, true);
  if (weg.size || neu.length) sz.t = [...sz.t.filter(p => !weg.has(p.id)), ...neu];
  return aus;
}

