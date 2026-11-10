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

/**
 * Das Gefäß in Bildpunkten der Rechnung. Größer als die Leinwand, die es
 * zeigt — so werden die Kugeln auf dem Bildschirm kleiner und es passen mehr hinein.
 */
export const BREITE = 1000;
export const HOEHE = 560;
/** Wie viel Fläche gegenüber dem ersten Gefäß (640 × 360) — für die Mengen der Reaktionen. */
const FLAECHE = (BREITE * HOEHE) / (640 * 360);

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
  /** Eigene Temperatur in °C: Wärme kommt über Boden, Wände und Nachbarn. */
  temp: number;
  /** Eigener Zustand — wechselt erst, wenn genug Umwandlungswärme aufgenommen bzw. abgegeben ist. */
  phase: "fest" | "fluessig" | "gas";
  /**
   * Umwandlungswärme in Kelvin-Gleichwert: positiv auf dem Weg zum nächsten
   * Zustand (Schmelzen, Sieden), negativ auf dem Weg zurück (Erstarren,
   * Kondensieren). Solange sie sich füllt, bleibt die Temperatur am
   * Schmelz- bzw. Siedepunkt stehen — der Haltepunkt der Heizkurve.
   */
  umw: number;
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
  /** Belegte Gitterplätze: Schlüssel »Stoff:Zeile,Spalte« → Teilchen. Jeder Stoff hat sein eigenes Gitter. */
  plaetze: Map<string, number>;
  /** Oberkante der Trennwand (y); 0 = bis ganz oben. Bei der Destillation bleibt darüber ein Durchgang. */
  wandOben: number;
  /** Rechte Hälfte gekühlt (°C) — die Vorlage der Destillation; sonst null. */
  kuehler: number | null;
  /** Höhe eines Filters (y), der nur Flüssiges und Gelöstes durchlässt; sonst null. */
  filter: number | null;
  /** Halbdurchlässige Membran bei x: nur die genannten Stoffe kommen durch (und nichts Gelöstes). */
  membran: { x: number; durch: number[] } | null;
  /** Gasdruck aus den Stößen gegen die Wände, geglättet (Einheiten der Rechnung). */
  druck: number;
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

/**
 * Typische Geschwindigkeit eines Teilchens bei T (°C) in Bildpunkten je
 * Sekunde. Am absoluten Nullpunkt null — dann steht alles still.
 */
export const tempo = (T: number, masse: number): number =>
  Math.min(650, 150 * Math.sqrt(Math.max(0, K(T)) / 300) * (30 / masse) ** 0.25);

/** Der Zustand, den ein Teilchen bei T von selbst annimmt (ohne Umwandlungswärme). */
function phaseBei(s: Stoff, T: number): Teilchen["phase"] {
  const ph = phaseVon(s, T);
  if (ph === "gasförmig") return "gas";
  if (ph === "fest" || (ph === "zersetzt" && s.schmelz === null)) return "fest";
  return "fluessig";
}

/**
 * Umwandlungswärme im Kelvin-Gleichwert: Schmelzen nach der Regel von
 * Richards (L ≈ R·Tₛ, bei 3R Wärmekapazität ein Drittel von Tₛ), Sieden nach
 * Trouton (≈ 3,5·Tₛ). Beides ist hier auf die Hälfte bzw. ein Siebtel
 * gekürzt — sonst dauert das Schmelzen im Unterricht Minuten.
 */
const schmelzWaerme = (s: Stoff) => K(s.schmelz ?? 0) / 6;
const siedeWaerme = (s: Stoff) => K(s.siede ?? 0) / 2;

/** Wie gut der Stoff Wärme an Nachbarn weitergibt (je Sekunde). */
const leitung = (a: Stoff, b: Stoff, gas: boolean): number =>
  gas ? 0.8 : a.art === "metall" && b.art === "metall" ? 4 : 1.5;

/** Gitterabstand eines Stoffs: knapp ein Durchmesser — der Feststoff liegt dicht. */
const gitterAbstand = (s: Stoff): number => s.r * 2.04;

/**
 * Gitterplätze: Sechseckgitter, Zeile 0 liegt am Boden. Jeder Stoff hat sein
 * eigenes, passend zu seiner Kugelgröße — ein gemeinsames Gitter nach der
 * größten Kugel wäre für die kleineren zu weit: es gäbe weniger Plätze als
 * Teilchen, und die übrigen blieben flüssig.
 */
export function platzLage(sz: Szene, key: string): { x: number; y: number } {
  const [s, k, m] = key.split(/[:,]/).map(Number);
  const a = gitterAbstand(sz.stoffe[s]);
  return { x: a / 2 + (k % 2) * a / 2 + m * a, y: HOEHE - a / 2 - k * a * 0.866 };
}

/**
 * Liegt dort schon ein festes Teilchen eines anderen Stoffs? Die Gitter
 * dürfen sich nicht überlappen. Beim Auslegen (`alle`) zählt jedes Teilchen.
 */
function fremdBelegt(sz: Szene, s: number, x: number, y: number, alle = false): boolean {
  const r = sz.stoffe[s].r;
  for (const q of sz.t) {
    if (q.s === s || (!alle && q.bewegung !== "gitter")) continue;
    const rr = (r + sz.stoffe[q.s].r) * 0.9;
    if (Math.abs(q.x - x) < rr && Math.abs(q.y - y) < rr && Math.hypot(q.x - x, q.y - y) < rr) return true;
  }
  return false;
}

function freieGitterplaetze(sz: Szene, s: number, x0: number, x1: number): string[] {
  const a = gitterAbstand(sz.stoffe[s]);
  const aus: string[] = [];
  for (let k = 0; HOEHE - a / 2 - k * a * 0.866 > a / 2; k++) {
    for (let m = 0; ; m++) {
      const key = `${s}:${k},${m}`;
      const p = platzLage(sz, key);
      if (p.x > BREITE - a / 2) break;
      if (p.x < x0 + a / 2 || p.x > x1 - a / 2 || sz.plaetze.has(key)) continue;
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
    platz: null, los: 0, warte: 0, geloest: false, ohne: 0, seite, bewegung: "gas",
    temp: sz.T, phase: phaseBei(st, sz.T), umw: 0,
  };
}

/** Legt Teilchen aus: Feststoffe ins Gitter, Flüssigkeiten unten hin, Gase irgendwohin. */
function lege(sz: Szene, liste: { s: number; form: number }[], x0: number, x1: number, seite: 0 | 1, z: Zufall) {
  // Freie Plätze je Stoff, von unten nach oben; ein Zeiger je Stoff.
  const frei = new Map<number, string[]>(), zeiger = new Map<number, number>();
  const naechsterPlatz = (s: number): string | null => {
    if (!frei.has(s)) { frei.set(s, freieGitterplaetze(sz, s, x0, x1)); zeiger.set(s, 0); }
    const liste = frei.get(s)!;
    let i = zeiger.get(s)!;
    while (i < liste.length) {
      const key = liste[i++];
      const p = platzLage(sz, key);
      if (!fremdBelegt(sz, s, p.x, p.y, true)) { zeiger.set(s, i); return key; }
    }
    zeiger.set(s, i);
    return null;
  };
  // Ionen sollen sich im Gitter abwechseln: die Form richtet sich nach dem
  // Platz, solange von ihr noch welche übrig sind — die Summe bleibt gleich.
  const rest = new Map<string, number>();
  for (const { s, form } of liste) rest.set(`${s}:${form}`, (rest.get(`${s}:${form}`) ?? 0) + 1);
  for (const eintrag of liste) {
    const { s } = eintrag;
    let { form } = eintrag;
    const ph = phaseVon(sz.stoffe[s], sz.T);
    const key = ph === "gasförmig" ? null : naechsterPlatz(s);
    if (sz.stoffe[s].formen.length === 2 && key) {
      const [, k, m] = key.split(/[:,]/).map(Number);
      const will = (m + Math.floor(k / 2)) % 2;
      if ((rest.get(`${s}:${will}`) ?? 0) > 0) form = will;
      else if ((rest.get(`${s}:${form}`) ?? 0) <= 0) form = 1 - form;
    }
    rest.set(`${s}:${form}`, (rest.get(`${s}:${form}`) ?? 0) - 1);
    if (!key) {
      const r = sz.stoffe[s].r;
      sz.t.push(neuesTeilchen(sz, s, form, x0 + r + z() * (x1 - x0 - 2 * r), r + z() * (HOEHE * 0.6), seite, z));
      continue;
    }
    const p = platzLage(sz, key);
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
  return {
    stoffe, t: [], T, wand: false, heiss: [], plaetze: new Map(), wandOben: 0, kuehler: null, filter: null, membran: null, druck: 0,
    reaktion: null, umsatz: 0, rueck: 0, nId: 1,
  };
}

const anzahl = (s: Stoff, anteil: number) =>
  Math.round(Math.max(60, Math.min(520, (BREITE * HOEHE * 0.3 * anteil) / (4 * s.r * s.r))) / s.formen.length) * s.formen.length;

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
    return Array.from({ length: Math.round(n * r.menge * (r.extra?.[id] ?? 1) * FLAECHE) * st.formen.length }, (_, i) => ({ s, form: i % st.formen.length }));
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

export type Trennung = {
  id: string;
  art: "destillation" | "filtration";
  titel: string;
  /** Stoff und Anteil am Gefäß (wie beim Mischen). */
  stoffe: [string, number][];
  /** Diese Stoffe liegen gelöst vor. */
  geloest?: string[];
  /** Bis hierhin heizen — dann trennt es sich. */
  ziel: number;
  text: string;
};

export const TRENNUNGEN: Trennung[] = [
  { id: "wein", art: "destillation", titel: "Wein → Alkohol", stoffe: [["h2o", 0.3], ["ethanol", 0.2]], ziel: 95,
    text: "Wasser und Ethanol sind gemischt. Ethanol siedet bei 78 °C, Wasser erst bei 100 °C: dazwischen siedet das Ethanol, steigt über die Wand, kühlt in der Vorlage ab und kondensiert. Das meiste Wasser bleibt im Kolben — etwas verdunstet aber mit: das Destillat ist angereichert, nicht rein. Für mehr Alkohol destilliert man es ein zweites Mal." },
  { id: "salzwasser-d", art: "destillation", titel: "Salzwasser → reines Wasser", stoffe: [["h2o", 0.4], ["nacl", 0.06]], geloest: ["nacl"], ziel: 105,
    text: "Über 100 °C verdampft das Wasser, die gelösten Salzteilchen nicht. In der Vorlage sammelt sich reines Wasser (destilliertes Wasser); im Kolben bleibt das Salz zurück und kristallisiert, sobald das Wasser fehlt." },
  { id: "erdoel", art: "destillation", titel: "Benzin aus Erdöl", stoffe: [["hexan", 0.22], ["octan", 0.22]], ziel: 95,
    text: "Kürzere Ketten haben schwächere Van-der-Waals-Kräfte und sieden früher: Hexan bei 69 °C, Octan bei 126 °C. Bei 95 °C geht nur das Hexan über — so trennt die Raffinerie Erdöl in Fraktionen." },
  { id: "sand", art: "filtration", titel: "Sand + Wasser", stoffe: [["sio2", 0.08], ["h2o", 0.22]], ziel: 20,
    text: "Die Wasserteilchen passen durch die Poren des Filters, die festen Sandkörner nicht — sie bleiben als Filterkuchen liegen. Unten kommt klares Wasser an (Filtrat)." },
  { id: "salzwasser-f", art: "filtration", titel: "Salzwasser", stoffe: [["h2o", 0.24], ["nacl", 0.04]], geloest: ["nacl"], ziel: 20,
    text: "Gelöstes Salz läuft mit durch: die Salzteilchen schwimmen einzeln zwischen den Wasserteilchen und sind so klein wie diese. Eine Lösung lässt sich nicht filtrieren — dafür braucht es Eindampfen oder Destillieren." },
  { id: "sand-salz", art: "filtration", titel: "Sand + Salzwasser", stoffe: [["sio2", 0.06], ["h2o", 0.22], ["nacl", 0.03]], geloest: ["nacl"], ziel: 20,
    text: "Der Filter hält den Sand zurück, das Salzwasser läuft durch. Um auch das Salz zu bekommen, dampft man das Filtrat anschließend ein." },
];

/**
 * Gasdruck in hPa: so geeicht, dass Stickstoff bei 20 °C im vollen Gefäß
 * etwa Normaldruck zeigt. Ein Modell — die Zahl soll Vergleiche erlauben,
 * keine Messung ersetzen.
 */
export const druckHpa = (sz: Szene): number => sz.druck * DRUCK_EICHUNG;
const DRUCK_EICHUNG = 3.1;

export type Diffusion = {
  id: string;
  titel: string;
  /** Lösemittel bzw. Gas, das den Raum füllt, und der Stoff, der wandert. */
  traeger: string;
  wandert: string;
  /** Osmose: Membran in der Mitte, das Gelöste rechts. */
  membran?: boolean;
  T: number;
  text: string;
};

export const DIFFUSIONEN: Diffusion[] = [
  { id: "tinte", titel: "Farbstoff in Wasser", traeger: "h2o", wandert: "kmno4", T: 20,
    text: "Ein Tropfen Farbstoff breitet sich im Wasser aus, ohne Umrühren. Kein Teilchen »will« dorthin, wo weniger sind — jedes stößt zufällig herum. Aber wo viele sind, wandern mehr hinaus als hinein: so gleicht sich das Konzentrationsgefälle aus. Warm geht es schneller, weil die Teilchen schneller sind." },
  { id: "duft", titel: "Duftstoff in Luft", traeger: "n2", wandert: "nh3", T: 20,
    text: "Ammoniak riecht man bald im ganzen Raum: In Gasen sind die Teilchen weit auseinander und schnell — Diffusion geht dort viel schneller als in Flüssigkeiten." },
  { id: "osmose", titel: "Osmose (Zuckerwasser)", traeger: "h2o", wandert: "zucker", membran: true, T: 20,
    text: "Die Membran in der Mitte lässt Wasserteilchen durch, Zuckerteilchen nicht. Rechts sind zwischen den Wasserteilchen Zuckerteilchen — dort treffen weniger Wasserteilchen von rechts auf die Membran als von links. Netto wandert Wasser nach rechts, und der Pegel rechts steigt, bis sein Gewicht dagegenhält (osmotischer Druck). So nehmen Pflanzenwurzeln Wasser auf." },
];

export function diffusionsSzene(d: Diffusion, T: number, z: Zufall = Math.random): Szene {
  const traeger = stoff(d.traeger), wandert = stoff(d.wandert);
  const sz = leereSzene([traeger, wandert], T);
  const gas = phaseVon(traeger, T) === "gasförmig";
  // Gas dünn: in Luft sind die Teilchen weit auseinander, sonst wäre die freie Weglänge zu kurz.
  const n = anzahl(traeger, gas ? 0.15 : 0.75);
  lege(sz, Array.from({ length: n }, () => ({ s: 0, form: 0 })), 0, BREITE, 0, z);
  // Gemischt flüssig, nicht im Gitter.
  for (const p of sz.t) if (p.platz) { sz.plaetze.delete(p.platz); p.platz = null; p.bewegung = "fluessig"; }
  // Ein Teil der Trägerteilchen wird zum wandernden Stoff — so liegt nichts übereinander.
  const wahl = (p: Teilchen) => d.membran ? p.x > BREITE / 2 + 2 * traeger.r
    : gas ? p.x < BREITE * 0.2
    : Math.hypot(p.x - BREITE * 0.15, p.y - (HOEHE - 60)) < 70;
  const kandidaten = sz.t.filter(wahl);
  const zahl = d.membran ? Math.round(kandidaten.length * 0.25) : kandidaten.length;
  for (const p of mischeReihe(kandidaten, z).slice(0, zahl)) {
    p.s = 1;
    p.form = Math.floor(z() * wandert.formen.length);
    p.phase = gas ? "gas" : "fluessig";
    p.geloest = !gas;
  }
  if (d.membran) sz.membran = { x: BREITE / 2, durch: [0] };
  return sz;
}

/** Anteil eines Stoffs in senkrechten Streifen von links nach rechts — das Konzentrationsprofil. */
export function profil(sz: Szene, s: number, streifen = 20): number[] {
  const alle = new Array(streifen).fill(0), davon = new Array(streifen).fill(0);
  for (const p of sz.t) {
    const k = Math.min(streifen - 1, Math.floor(p.x / BREITE * streifen));
    alle[k]++;
    if (p.s === s) davon[k]++;
  }
  return davon.map((d, k) => (alle[k] ? d / alle[k] : 0));
}

/** Pegel der Flüssigkeit links und rechts (Höhe über dem Boden in Bildpunkten). */
export function pegel(sz: Szene): [number, number] {
  const seite = (links: boolean) => {
    const ys = sz.t.filter(p => p.bewegung !== "gas" && (p.x < BREITE / 2) === links).map(p => p.y).sort((a, b) => a - b);
    if (!ys.length) return 0;
    return HOEHE - ys[Math.floor(ys.length * 0.05)];
  };
  return [seite(true), seite(false)];
}

export function trennSzene(t: Trennung, T: number, z: Zufall = Math.random): Szene {
  const sz = leereSzene(t.stoffe.map(([id]) => stoff(id)), T);
  const liste = mischeReihe(t.stoffe.flatMap(([id, anteil], s) => {
    const st = sz.stoffe[s];
    return Array.from({ length: anzahl(st, anteil) }, (_, i) => ({ s, form: i % st.formen.length }));
  }), z);
  const loese = (p: Teilchen) => {
    if (!t.geloest?.includes(sz.stoffe[p.s].id)) return;
    if (p.platz) sz.plaetze.delete(p.platz);
    p.platz = null; p.geloest = true; p.bewegung = "fluessig";
  };
  if (t.art === "destillation") {
    // Links der Kolben (geheizt), rechts die Vorlage (gekühlt); oben ein Durchgang.
    sz.wand = true;
    sz.wandOben = HOEHE * 0.3;
    sz.kuehler = 5;
    lege(sz, liste, 0, BREITE / 2 - 3, 0, z);
    // Gemischt, nicht geschichtet: die Plätze gelten nur als Startlage.
    for (const p of sz.t) {
      if (phaseVon(sz.stoffe[p.s], T) !== "fest" && p.platz) { sz.plaetze.delete(p.platz); p.platz = null; p.bewegung = "fluessig"; }
      loese(p);
    }
  } else {
    // Ein Filter quer durchs Gefäß; das Gemisch liegt locker darüber und fällt darauf.
    sz.filter = HOEHE * 0.55;
    const rmax = Math.max(...sz.stoffe.map(x => x.r));
    const a = rmax * 2.15, plaetze: [number, number][] = [];
    for (let y = sz.filter - a; y > a / 2; y -= a * 0.87) {
      for (let x = a / 2; x < BREITE - a / 2; x += a) plaetze.push([x, y]);
    }
    liste.slice(0, plaetze.length).forEach(({ s, form }, i) => {
      const p = neuesTeilchen(sz, s, form, plaetze[i][0], plaetze[i][1], 0, z);
      p.vx *= 0.1; p.vy *= 0.1;
      p.bewegung = "fluessig";
      sz.t.push(p);
      loese(p);
    });
  }
  return sz;
}

/** Wie viele Teilchen je Stoff links/rechts (Destillation) bzw. über/unter dem Filter liegen. */
export function verteilung(sz: Szene): [number[], number[]] {
  const a = sz.stoffe.map(() => 0), b = sz.stoffe.map(() => 0);
  for (const p of sz.t) {
    const zweite = sz.filter !== null ? p.y > sz.filter : p.x > BREITE / 2;
    (zweite ? b : a)[p.s] += 1 / sz.stoffe[p.s].formen.length;
  }
  return [a.map(Math.round), b.map(Math.round)];
}

/** Örtliche Temperatur: Gefäß plus heiße Flecken. */
export function ortsTemperatur(sz: Szene, x: number, y: number): number {
  let T = sz.kuehler !== null && x > BREITE / 2 ? sz.kuehler : sz.T;
  for (const h of sz.heiss) {
    const d = Math.hypot(x - h.x, y - h.y);
    if (d < h.r) T += h.dT * (1 - h.t / h.dauer) * (1 - d / h.r);
  }
  return T;
}

/** Erwärmt (dT > 0) oder kühlt die Teilchen um (x, y) — die Wärme verteilt sich dann von selbst. */
export function waermeZufuehren(sz: Szene, x: number, y: number, dT: number, radius = 30): number {
  let zahl = 0;
  for (const p of sz.t) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > radius) continue;
    p.temp = Math.max(-273.15, p.temp + dT * (1 - 0.5 * d / radius));
    zahl++;
  }
  return zahl;
}

/** Mittlere Temperatur der Teilchen eines Stoffs — das Thermometer im Stoff. */
export function stoffTemperatur(sz: Szene, s: number): number | null {
  const ps = sz.t.filter(p => p.s === s);
  return ps.length ? ps.reduce((a, p) => a + p.temp, 0) / ps.length : null;
}

/** Wie viele Teilchen eines Stoffs fest, flüssig und gasförmig sind. */
export function phasenZahl(sz: Szene, s: number): { fest: number; fluessig: number; gas: number } {
  const z = { fest: 0, fluessig: 0, gas: 0 };
  for (const p of sz.t) if (p.s === s) z[p.geloest ? "fluessig" : p.phase]++;
  return z;
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

/**
 * Der Zustand folgt der Temperatur nicht sofort: am Schmelz- bzw. Siedepunkt
 * bleibt die Temperatur stehen, und die überschüssige Wärme füllt erst die
 * Umwandlungswärme. Ist sie voll, wechselt der Zustand. Beim Abkühlen
 * umgekehrt: das Teilchen gibt die Wärme ab, bevor es erstarrt.
 */
function wandle(p: Teilchen, s: Stoff): void {
  const ziel = phaseBei(s, p.temp);
  const stufe = { fest: 0, fluessig: 1, gas: 2 } as const;
  if (ziel === p.phase) {
    // Halb geschmolzen und wieder kälter: die Wärme kommt zurück.
    if (p.umw > 0) {
      const grenze = p.phase === "fest" ? s.schmelz ?? s.siede ?? p.temp : s.siede ?? p.temp;
      const zurueck = Math.min(p.umw, Math.max(0, grenze - p.temp));
      p.umw -= zurueck; p.temp += zurueck;
    } else if (p.umw < 0) {
      const grenze = p.phase === "gas" ? s.siede ?? p.temp : s.schmelz ?? p.temp;
      const zurueck = Math.min(-p.umw, Math.max(0, p.temp - grenze));
      p.umw += zurueck; p.temp -= zurueck;
    }
    return;
  }
  const hoch = stufe[ziel] > stufe[p.phase];
  // Dampf unter dem Siedepunkt darf es geben (Verdunsten). Er kondensiert erst,
  // wenn er auf Flüssigkeit oder eine Wand trifft — das regelt `schritt`.
  if (!hoch && p.phase === "gas") return;
  // Die Grenze, an der die Umwandlung stattfindet, und wie viel Wärme sie braucht.
  let grenze: number, bedarf: number, naechste: Teilchen["phase"];
  if (hoch) {
    if (p.phase === "fest") {
      const sublimiert = s.schmelz === null || s.schmelz === s.siede;
      grenze = s.schmelz ?? s.zersetzt ?? p.temp;
      naechste = sublimiert && s.siede !== null ? "gas" : "fluessig";
      bedarf = schmelzWaerme(s) + (naechste === "gas" ? siedeWaerme(s) : 0);
    } else {
      grenze = s.siede ?? p.temp; naechste = "gas"; bedarf = siedeWaerme(s);
    }
    p.umw += p.temp - grenze;
    p.temp = grenze;
    if (p.umw >= bedarf) { p.phase = naechste; p.temp += p.umw - bedarf; p.umw = 0; }
  } else {
    if (p.phase === "gas") {
      const sublimiert = s.schmelz === s.siede;
      grenze = s.siede ?? p.temp;
      naechste = sublimiert ? "fest" : "fluessig";
      bedarf = siedeWaerme(s) + (sublimiert ? schmelzWaerme(s) : 0);
    } else {
      grenze = s.schmelz ?? p.temp; naechste = "fest"; bedarf = schmelzWaerme(s);
    }
    p.umw -= grenze - p.temp;
    p.temp = grenze;
    if (-p.umw >= bedarf) { p.phase = naechste; p.temp -= -p.umw - bedarf; p.umw = 0; }
  }
}

/** Der nächste freie Platz im Gitter des eigenen Stoffs; `weit` sucht im größeren Umkreis. */
function gitterplatzFuer(sz: Szene, p: Teilchen, weit: boolean): string | null {
  const a = gitterAbstand(sz.stoffe[p.s]);
  const R = weit ? 3 : 1;
  const k0 = Math.round((HOEHE - a / 2 - p.y) / (a * 0.866));
  let best: string | null = null, bestD = a * (weit ? 3.2 : 1.3);
  for (let k = Math.max(0, k0 - R); k <= k0 + R; k++) {
    const m0 = Math.round((p.x - a / 2 - (k % 2) * a / 2) / a);
    for (let m = m0 - R; m <= m0 + R; m++) {
      if (m < 0) continue;
      const key = `${p.s}:${k},${m}`;
      if (sz.plaetze.has(key)) continue;
      const q = platzLage(sz, key);
      if (q.x > BREITE - a / 2 || q.y < a / 2) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d >= bestD) continue;
      // Nicht durch die Trennwand und nicht durch den Filter hindurch.
      if (sz.wand && q.y + a / 2 > sz.wandOben && (p.x < BREITE / 2) !== (q.x < BREITE / 2)) continue;
      if (sz.wand && q.y + a / 2 > sz.wandOben && Math.abs(q.x - BREITE / 2) < a / 2 + 3) continue;
      if (sz.filter !== null && (p.y < sz.filter) !== (q.y < sz.filter)) continue;
      if (sz.filter !== null && Math.abs(q.y - sz.filter) < a / 2) continue;
      if (fremdBelegt(sz, p.s, q.x, q.y)) continue;
      best = key; bestD = d;
    }
  }
  return best;
}

/**
 * Flüssigkeitsteilchen stoßen auf leicht verschiedene Abstände — sonst packen
 * sich gleich große Kugeln von selbst sechseckig wie ein Kristall. Gezeichnet
 * werden alle Kugeln eines Stoffs gleich groß.
 */
const stossGroesse = (p: Teilchen): number =>
  p.bewegung === "fluessig" ? 0.78 + 0.44 * ((p.id * 0.6180339887) % 1) : 1;

export function schritt(sz: Szene, dt: number, z: Zufall = Math.random): Ereignis[] {
  const n = sz.t.length;
  const st = sz.t.map(p => sz.stoffe[p.s]);
  // Wärme vom Gefäß: über den Boden (Heizplatte, in der Mitte der Brenner),
  // schwächer über die Wände und kaum über die Luft. Heiße Flecken
  // (Funke, Flamme) und die gekühlte Vorlage geben ihre Temperatur stark ab.
  for (const p of sz.t) {
    const r = sz.stoffe[p.s].r;
    let rate = 0.4;
    if (p.y > HOEHE - 2.5 * r) rate = Math.abs(p.x - (sz.wand ? BREITE / 4 : BREITE / 2)) < BREITE * 0.2 ? 6 : 3;
    else if (p.x < 2.5 * r || p.x > BREITE - 2.5 * r || p.y < 2.5 * r) rate = 1.5;
    if (sz.kuehler !== null && p.x > BREITE / 2) rate = Math.max(rate, 2.5);
    if (sz.heiss.some(h => Math.hypot(p.x - h.x, p.y - h.y) < h.r)) rate = 10;
    p.temp += (ortsTemperatur(sz, p.x, p.y) - p.temp) * Math.min(1, rate * dt);
  }
  const dTemp = new Float64Array(n);
  const rhoMax = Math.max(...sz.stoffe.map(s => s.dichte));
  const fx = new Float64Array(n), fy = new Float64Array(n);
  // Dichte der flüssigen Nachbarschaft — daraus der Auftrieb.
  const umDichte = new Float64Array(n), umZahl = new Int32Array(n);
  const dichteVon = (p: Teilchen, s: Stoff) => (p.geloest ? 1 : s.dichte);
  // Gas mitten in einer Flüssigkeit: eine Blase, die aufsteigt.
  const nass = new Uint8Array(n);
  // Wie viele flüssige oder feste Nachbarn — wenige heißt: an der Oberfläche.
  const nachbarnDicht = new Int32Array(n);
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

  // Paare: Abstoßung, Anziehung in Flüssigkeiten, Nachbarn zählen. Gesucht
  // wird nur in den Nachbarzellen eines Rasters — bei 500 Teilchen sonst
  // 125 000 Paare je Schritt.
  const zelle = Math.max(...sz.stoffe.map(x => x.r)) * 2 * 1.6 * 1.14;
  const nx = Math.ceil(BREITE / zelle) + 1, ny = Math.ceil(HOEHE / zelle) + 1;
  const kopf = new Int32Array(nx * ny).fill(-1), weiter = new Int32Array(n);
  const zx = (x: number) => Math.max(0, Math.min(nx - 1, Math.floor(x / zelle)));
  const zy = (y: number) => Math.max(0, Math.min(ny - 1, Math.floor(y / zelle)));
  for (let i = 0; i < n; i++) {
    const c = zy(sz.t[i].y) * nx + zx(sz.t[i].x);
    weiter[i] = kopf[c]; kopf[c] = i;
  }
  const groesse = sz.t.map(stossGroesse);
  for (let i = 0; i < n; i++) {
    const p = sz.t[i];
    const cx = zx(p.x), cy = zy(p.y);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const ex = cx + ox, ey = cy + oy;
    if (ex < 0 || ey < 0 || ex >= nx || ey >= ny) continue;
    for (let j = kopf[ey * nx + ex]; j !== -1; j = weiter[j]) {
      if (j <= i) continue;
      const q = sz.t[j];
      const dx = q.x - p.x, dy = q.y - p.y;
      const rr = st[i].r * groesse[i] + st[j].r * groesse[j];
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
      if (d < rr * 1.15) {
        // Wärmeleitung: wer sich berührt, gleicht seine Temperatur an.
        const k = Math.min(0.12, leitung(st[i], st[j], bi === "gas" || bj === "gas") * dt) * (q.temp - p.temp);
        dTemp[i] += k; dTemp[j] -= k;
      }
      if (d < rr * 1.3) {
        if (bi !== "gas") nachbarnDicht[j]++;
        if (bj !== "gas") nachbarnDicht[i]++;
        if (bi === "gas" && bj === "fluessig") nass[i] = 1;
        if (bj === "gas" && bi === "fluessig") nass[j] = 1;
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
  }

  // Temperatur übernehmen und Zustand nachführen — mit Umwandlungswärme.
  const Tl: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = sz.t[i], s = st[i];
    p.temp = Math.max(-273.15, p.temp + dTemp[i]);
    if (p.geloest) { p.umw = 0; Tl.push(p.temp); continue; }
    wandle(p, s);
    Tl.push(p.temp);
  }

  // Lösen: nur bis zur Sättigung.
  const geloest = sz.stoffe.map(() => 0), loesemittel = sz.stoffe.map(() => 0);
  for (const p of sz.t) if (p.geloest) geloest[p.s]++;
  sz.stoffe.forEach((s, k) => {
    if (!s.loeslichIn) return;
    loesemittel[k] = sz.t.filter(q => q.bewegung === "fluessig" && !q.geloest && loestSichIn(s, sz.stoffe[q.s])).length;
  });

  // Örtliche Sättigung (Noyes-Whitney): gelöst wird umso schneller, je weiter
  // die Lösung direkt am Kristall von der Sättigung entfernt ist, (cₛ − c)/cₛ.
  // Um den Kristall sammelt sich gelöster Stoff und bremst; erst wenn er
  // wegdiffundiert oder umgerührt wird, geht es weiter. Dieses
  // Konzentrationsgefälle treibt das Lösen an.
  const untersaettigung = (i: number): number => {
    const p = sz.t[i], s = st[i], radius = 4 * s.r;
    let geloestHier = 0, loeserHier = 0;
    const cx = zx(p.x), cy = zy(p.y), w = Math.ceil(radius / zelle);
    for (let ey = cy - w; ey <= cy + w; ey++) for (let ex = cx - w; ex <= cx + w; ex++) {
      if (ex < 0 || ey < 0 || ex >= nx || ey >= ny) continue;
      for (let j = kopf[ey * nx + ex]; j !== -1; j = weiter[j]) {
        const q = sz.t[j];
        if (Math.hypot(q.x - p.x, q.y - p.y) > radius) continue;
        if (q.geloest && q.s === p.s) geloestHier++;
        else if (q.bewegung === "fluessig" && !q.geloest && loestSichIn(s, st[j])) loeserHier++;
      }
    }
    const cs = s.loeslichkeit ?? 0;
    return cs > 0 ? Math.max(0, 1 - geloestHier / Math.max(1, loeserHier) / cs) : 0;
  };

  // Wie hoch die Flüssigkeit jedes Stoffs steht — so weit reicht die Umwälzströmung.
  const hoehe = sz.stoffe.map(() => 0);
  for (const p of sz.t) {
    if (p.bewegung === "fluessig") hoehe[p.s] += ((2 * sz.stoffe[p.s].r) ** 2 * 0.9) / (sz.wand ? BREITE / 2 : BREITE);
  }

  // Kinetische Gastheorie: Die Wandstöße der Gasteilchen ergeben den Druck,
  // im Mittel p·A = ½·Σ m·v² (in der Ebene). Direkt gezählte Stöße rauschen
  // zu stark, das Mittel ist dieselbe Physik.
  let energie = 0;
  // Osmose: wo auf einer Seite der Membran mehr gelöst ist, wird das
  // Lösemittel an der Membran dorthin gezogen (Triebkraft nach van 't Hoff,
  // proportional zum Konzentrationsunterschied und zur Temperatur). Der
  // steigende Pegel drückt zurück, bis beides gleich ist.
  let osmose = 0;
  if (sz.membran) {
    const c = [0, 0], fl = [0, 0];
    for (const q of sz.t) {
      if (q.bewegung === "gas") continue;
      const k = q.x < sz.membran.x ? 0 : 1;
      fl[k]++;
      if (q.geloest) c[k]++;
    }
    osmose = (c[1] / Math.max(1, fl[1]) - c[0] / Math.max(1, fl[0])) * 6000 * Math.max(0, K(sz.T)) / 293;
  }
  for (let i = 0; i < n; i++) {
    const p = sz.t[i], s = st[i], T = Tl[i];
    if (osmose && sz.membran && !p.geloest && p.bewegung === "fluessig" && sz.membran.durch.includes(p.s)
      && Math.abs(p.x - sz.membran.x) < 4 * s.r) fx[i] += osmose;
    const band = p.bewegung === "fluessig" && !p.geloest ? schicht.get(p.s) : undefined;
    if (band) {
      if (p.y < band[0] - s.r) fy[i] += 900;
      else if (p.y > band[1] + s.r) fy[i] -= 900;
    }
    // Verdunsten: an der Oberfläche entkommt ab und zu ein Teilchen, auch weit
    // unter dem Siedepunkt — umso öfter, je wärmer (Clausius-Clapeyron mit der
    // Regel von Trouton, L/R ≈ 10,5·Tₛ). Dampf kondensiert, wo er auf
    // Flüssigkeit, Feststoff oder Wand trifft. So stellt sich über jeder
    // Flüssigkeit ein Dampfdruck ein.
    if (s.siede !== null && T < s.siede && !p.geloest && p.umw === 0) {
      if (p.phase === "fluessig" && !p.platz && nachbarnDicht[i] <= 3) {
        const rate = 0.6 * Math.exp(-10.5 * (K(s.siede) / Math.max(1, K(T)) - 1));
        if (z() < rate * dt) p.phase = "gas";
      } else if (p.phase === "gas") {
        const anWand = p.x < 1.3 * s.r || p.x > BREITE - 1.3 * s.r || p.y < 1.3 * s.r || p.y > HOEHE - 1.3 * s.r;
        if ((nachbarnDicht[i] > 0 && z() < 6 * dt) || (anWand && z() < 1.5 * dt)) p.phase = "fluessig";
      }
    }
    const fest = p.phase === "fest" && !p.geloest;

    // Zustandswechsel.
    if (p.platz) {
      if (!fest) { sz.plaetze.delete(p.platz); p.platz = null; }
      if (p.platz && angriff[i] && geloest[p.s] < (s.loeslichkeit ?? 0) * loesemittel[p.s]
        && z() < dt * 2.5 * (1 + Math.max(0, T) / 50) * untersaettigung(i)) {
        sz.plaetze.delete(p.platz); p.platz = null; p.geloest = true; geloest[p.s]++;
      }
    } else if (fest) {
      p.warte += dt;
      const a = gitterAbstand(s);
      const amBoden = p.y > HOEHE - a * 0.9
        || (sz.filter !== null && p.y < sz.filter && p.y > sz.filter - a * 1.1);
      if (amBoden || stuetze[i] || (p.warte > 1.5 && gleich[i] >= 2)) {
        const key = gitterplatzFuer(sz, p, p.warte > 3);
        if (key) { p.platz = key; sz.plaetze.set(key, p.id); p.warte = 0; p.los = 0.5; }
      }
    } else p.warte = 0;
    if (p.geloest) {
      p.ohne = loeser[i] ? 0 : p.ohne + dt;
      if (p.ohne > 0.8) { p.geloest = false; p.ohne = 0; p.phase = phaseBei(s, p.temp); }
    }
    p.bewegung = p.platz ? "gitter" : p.phase === "gas" && !p.geloest ? "gas" : "fluessig";

    // Bewegung.
    const v0 = tempo(T, s.masse);
    if (p.bewegung === "gitter") {
      const q = platzLage(sz, p.platz!);
      const schmelzK = K(s.schmelz ?? s.zersetzt ?? 1000);
      // Schwingungsweite wächst mit √T (die Energie mit T): am absoluten
      // Nullpunkt null, am Schmelzpunkt etwa ein Zehntel des Abstands
      // (Lindemann-Kriterium, hier etwas weniger) — mehr, und der Kristall sähe flüssig aus.
      const A = s.r * 0.115 * Math.sqrt(Math.max(0, K(T)) / Math.max(50, schmelzK));
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
        // Eine Gasblase in der Flüssigkeit steigt auf — so verlässt der Dampf beim Sieden die Flüssigkeit.
        p.vy += (fy[i] + g - (nass[i] ? 2500 : 0)) * dt;
        const tempoJetzt = Math.hypot(p.vx, p.vy);
        if (tempoJetzt < 1) { const w = z() * Math.PI * 2; p.vx = Math.cos(w) * v0; p.vy = Math.sin(w) * v0; }
        else { const k = 1 + 0.03 * (v0 / tempoJetzt - 1); p.vx *= k; p.vy *= k; }
      } else {
        // Wärmebad: Reibung plus Zufallsstöße je Teilchen. Eine gemeinsame
        // Strömung wird so gedämpft — die Flüssigkeit schwappt nicht, sie zittert.
        // Je näher am Siedepunkt, desto heftiger.
        // Zähigkeit: kalte Flüssigkeiten sind zäh, warme dünnflüssig (Wasser bei
        // 80 °C viermal dünner als bei 5 °C) — darum diffundiert es warm viel schneller.
        const reib = 4 * Math.min(3, (293 / Math.max(150, K(T))) ** 2), vth = v0 * 0.35, stoss = vth * Math.sqrt(2 * reib * dt);
        // Konvektion: unten in der Mitte heizt der Brenner. Je näher am Siedepunkt, desto stärker.
        const oben = s.siede ?? s.zersetzt ?? (s.schmelz ?? 0) + 300;
        const stark = Math.max(0, Math.min(1, (T - (s.schmelz ?? -273)) / Math.max(1, oben - (s.schmelz ?? -273))));
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
      p.om += gauss(z) * (gas ? 8 : 3) * Math.sqrt(Math.max(0, K(T)) / 300) * dt;
      p.om = Math.max(-8, Math.min(8, p.om * (gas ? 0.999 : 0.97)));
    }
    const altX = p.x, altY = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt; p.phi += p.om * dt;

    // Wände.
    const r = s.r, e = p.bewegung === "gas" ? 1 : 0.3;
    if (p.bewegung === "gas") energie += s.masse * (p.vx * p.vx + p.vy * p.vy);
    if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx) * e; }
    if (p.x > BREITE - r) { p.x = BREITE - r; p.vx = -Math.abs(p.vx) * e; }
    if (p.y < r) { p.y = r; p.vy = Math.abs(p.vy) * e; }
    if (p.y > HOEHE - r) { p.y = HOEHE - r; p.vy = -Math.abs(p.vy) * e; }
    // Membran: das Lösemittel kommt durch, Gelöstes und andere Stoffe nicht.
    if (sz.membran && (p.geloest || !sz.membran.durch.includes(p.s))) {
      const mx = sz.membran.x;
      if (altX < mx && p.x > mx - r) { p.x = mx - r; p.vx = -Math.abs(p.vx) * e; }
      if (altX >= mx && p.x < mx + r) { p.x = mx + r; p.vx = Math.abs(p.vx) * e; }
    }
    // Trennwand: bei der Destillation nur bis `wandOben` — darüber ist der Durchgang.
    if (sz.wand && p.y + r > sz.wandOben) {
      if (altX < BREITE / 2 && p.x > BREITE / 2 - 3 - r) { p.x = BREITE / 2 - 3 - r; p.vx = -Math.abs(p.vx) * e; }
      if (altX >= BREITE / 2 && p.x < BREITE / 2 + 3 + r) { p.x = BREITE / 2 + 3 + r; p.vx = Math.abs(p.vx) * e; }
    }
    // Filter: Flüssiges und Gelöstes läuft durch, Feststoffe bleiben liegen.
    // Was durch ist, kommt nicht wieder hoch (außer als Gas).
    if (sz.filter !== null) {
      const durch = p.bewegung === "gas" || (p.bewegung === "fluessig" && (p.geloest || p.phase !== "fest"));
      if (altY < sz.filter && !durch && p.y + r > sz.filter) { p.y = sz.filter - r; p.vy = -Math.abs(p.vy) * 0.2; }
      if (altY >= sz.filter && p.bewegung !== "gas" && p.y - r < sz.filter) { p.y = sz.filter + r; p.vy = Math.abs(p.vy) * 0.2; }
    }
    p.seite = p.x < BREITE / 2 ? 0 : 1;
  }

  const ereignisse = sz.reaktion ? reagiere(sz, dt, z) : [];

  // Druck geglättet über etwa eine Sekunde.
  const a = Math.min(1, dt);
  sz.druck = sz.druck * (1 - a) + a * energie / 2 / (BREITE * HOEHE);
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
      if (p.temp < ab) continue;
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
      const Tneu = genommen.reduce((a, q) => a + q.temp, 0) / genommen.length + waerme;
      for (const [id, k] of zu) {
        const s = idx(id), st = sz.stoffe[s];
        for (let i = 0; i < k * st.formen.length; i++) {
          const w = z() * Math.PI * 2, rad = z() * rmax * 1.5;
          const t = neuesTeilchen(sz, s, i % st.formen.length,
            Math.max(st.r, Math.min(BREITE - st.r, cx + Math.cos(w) * rad)),
            Math.max(st.r, Math.min(HOEHE - st.r, cy + Math.sin(w) * rad)), genommen[0].seite, z);
          t.temp = Math.max(-273.15, Tneu);
          t.phase = phaseBei(st, t.temp);
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

