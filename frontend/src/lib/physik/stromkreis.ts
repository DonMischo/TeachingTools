/**
 * Der Stromkreis — Knotenpotenzialverfahren (MNA).
 *
 * Anders als die Mechanik lässt sich ein Stromkreis nicht Bauteil für Bauteil
 * rechnen: durch eine Reihenschaltung fließt überall derselbe Strom, und was
 * er ist, entscheidet der ganze Kreis gemeinsam. Also wird ein
 * Gleichungssystem aufgestellt und gelöst — ein Unbekanntes je Knoten, eines
 * je Spannungsquelle.
 *
 * Ein **Kabel ist kein Bauteil**: zwei verbundene Strom-Anschlüsse sind
 * derselbe Knoten. Das fällt aus der Werkbank heraus, ohne dass dafür etwas
 * gebaut werden musste.
 *
 * Das Verfahren ist dasselbe, mit dem später die Wärmeleitung gerechnet wird
 * (Temperatur statt Spannung, Wärmestrom statt Strom) — deshalb steht es hier
 * allgemein und nicht in den Bauteilen.
 */
import { geraetTyp } from "./katalog";
import type { Geraet, Szene } from "./typen";

/**
 * Ein winziger Leitwert von jedem Knoten gegen Masse.
 *
 * Er haelt die Matrix loesbar, wenn ein Zweig in der Luft haengt — ohne ihn
 * ist sie singulaer, sobald jemand ein Bauteil nur einseitig anschliesst.
 * Klein genug, dass er das Ergebnis nicht verfaelscht: bei Schulwiderstaenden
 * (1 Ohm bis 10 kOhm) liegen die echten Leitwerte um Groessenordnungen
 * darueber.
 */
const STUETZE = 1e-12;

/** Die beiden elektrischen Anschlüsse eines Bauteils, in Reihenfolge. */
export function stromPorts(typ: string): [string, string] | null {
  const ports = (geraetTyp(typ)?.ports ?? []).filter(p => p.art === "strom");
  return ports.length >= 2 ? [ports[0].id, ports[1].id] : null;
}

/** Ob ein Schalter gerade durchlässt. */
const geschlossen = (g: Geraet) => (g.werte.geschlossen ?? 1) >= 0.5;

/**
 * Welcher Anschluss zu welchem Knoten gehört.
 *
 * Verbundene Anschlüsse sind elektrisch derselbe Punkt — das ist die ganze
 * Bedeutung eines Kabels.
 */
export function knotenZuordnung(szene: Szene): Map<string, number> {
  const eltern = new Map<string, string>();
  const schluessel = (geraet: string, port: string) => `${geraet}.${port}`;

  const finde = (x: string): string => {
    const p = eltern.get(x);
    if (p === undefined || p === x) return x;
    const wurzel = finde(p);
    eltern.set(x, wurzel);
    return wurzel;
  };
  const eine = (a: string, b: string) => {
    const wa = finde(a), wb = finde(b);
    if (wa !== wb) eltern.set(wa, wb);
  };

  for (const g of szene.geraete) {
    for (const p of geraetTyp(g.typ)?.ports ?? []) {
      if (p.art === "strom") eltern.set(schluessel(g.id, p.id), schluessel(g.id, p.id));
    }
  }
  for (const v of szene.verbindungen) {
    const a = schluessel(v.von.geraet, v.von.port);
    const b = schluessel(v.nach.geraet, v.nach.port);
    if (eltern.has(a) && eltern.has(b)) eine(a, b);
  }

  const nummer = new Map<string, number>();
  const wurzeln = new Map<string, number>();
  for (const k of eltern.keys()) {
    const w = finde(k);
    if (!wurzeln.has(w)) wurzeln.set(w, wurzeln.size);
    nummer.set(k, wurzeln.get(w)!);
  }
  return nummer;
}

/** Das Ergebnis: Potenziale und Ströme. */
export interface Stromkreis {
  /** Potenzial je Knoten in Volt, Masse ist 0. */
  potenzial: number[];
  /** Strom durch ein Bauteil in Ampere, positiv vom ersten zum zweiten Anschluss. */
  strom: Map<string, number>;
  /** Knotennummer eines Anschlusses, oder -1. */
  knoten: (geraet: string, port: string) => number;
}

/** Gauss mit Spaltenpivotsuche. Gibt null zurück, wenn nichts zu lösen ist. */
export function loeseLGS(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (!n) return [];
  const M = A.map((zeile, i) => [...zeile, b[i]]);

  for (let spalte = 0; spalte < n; spalte++) {
    let beste = spalte;
    for (let i = spalte + 1; i < n; i++) {
      if (Math.abs(M[i][spalte]) > Math.abs(M[beste][spalte])) beste = i;
    }
    if (Math.abs(M[beste][spalte]) < 1e-14) return null;
    [M[spalte], M[beste]] = [M[beste], M[spalte]];

    for (let i = 0; i < n; i++) {
      if (i === spalte) continue;
      const faktor = M[i][spalte] / M[spalte][spalte];
      if (!faktor) continue;
      for (let j = spalte; j <= n; j++) M[i][j] -= faktor * M[spalte][j];
    }
  }

  const x = new Array<number>(n);
  for (let i = 0; i < n; i++) x[i] = M[i][n] / M[i][i];
  return x.every(Number.isFinite) ? x : null;
}

/**
 * Löst den Stromkreis der Szene.
 *
 * Im realen Modell bekommt die Batterie ihren Innenwiderstand — dann bricht
 * die Klemmenspannung unter Last ein, und genau das ist der Unterschied, den
 * man messen soll.
 */
export function loeseStromkreis(szene: Szene): Stromkreis {
  const zuordnung = knotenZuordnung(szene);
  const knoten = (geraet: string, port: string) => zuordnung.get(`${geraet}.${port}`) ?? -1;
  const anzahlKnoten = new Set(zuordnung.values()).size;

  const leer: Stromkreis = { potenzial: new Array(anzahlKnoten).fill(0), strom: new Map(), knoten };
  if (!anzahlKnoten) return leer;

  // Widerstände und Spannungsquellen einsammeln. Zusätzliche Knoten entstehen
  // nur für den Innenwiderstand einer Batterie.
  let naechsterKnoten = anzahlKnoten;
  const widerstaende: { a: number; b: number; wert: number }[] = [];
  // `vorzeichen` dreht den gemeldeten Strom in die Richtung, die jemand
  // ablesen will: bei der Batterie der abgegebene Strom, beim Amperemeter der
  // Strom vom ersten zum zweiten Anschluss.
  const quellen: { a: number; b: number; wert: number; geraet: string; vorzeichen: 1 | -1 }[] = [];

  for (const g of szene.geraete) {
    const ports = stromPorts(g.typ);
    if (!ports) continue;
    const a = knoten(g.id, ports[0]), b = knoten(g.id, ports[1]);
    if (a < 0 || b < 0) continue;
    const real = (g.treue ?? szene.treue) === "real";

    switch (g.typ) {
      case "widerstand":
      case "lampe":
        widerstaende.push({ a, b, wert: Math.max(1e-6, g.werte.widerstand ?? 1) });
        break;

      case "batterie": {
        const innen = real ? (g.werte.innenwiderstand ?? 0) : 0;
        if (innen > 0) {
          const zwischen = naechsterKnoten++;
          quellen.push({ a, b: zwischen, wert: g.werte.spannung ?? 0, geraet: g.id, vorzeichen: -1 });
          widerstaende.push({ a: zwischen, b, wert: innen });
        } else {
          quellen.push({ a, b, wert: g.werte.spannung ?? 0, geraet: g.id, vorzeichen: -1 });
        }
        break;
      }

      // Ein geschlossener Schalter und ein Amperemeter sind beide ein Draht —
      // als Quelle mit null Volt gestempelt, damit ihr Strom mit herausfällt.
      case "amperemeter":
        quellen.push({ a, b, wert: 0, geraet: g.id, vorzeichen: 1 });
        break;
      case "schalter":
        if (geschlossen(g)) quellen.push({ a, b, wert: 0, geraet: g.id, vorzeichen: 1 });
        break;

      // Das ideale Voltmeter lässt keinen Strom durch und wird nicht gestempelt.
      case "voltmeter":
        break;
    }
  }

  if (!quellen.length) return { ...leer, potenzial: new Array(naechsterKnoten).fill(0) };

  // Masse ist der Minuspol der ersten Quelle — irgendein Punkt muss null sein.
  const masse = quellen[0].b;
  const gesamtKnoten = naechsterKnoten;
  const index = (k: number) => (k === masse ? -1 : k < masse ? k : k - 1);
  const n = gesamtKnoten - 1;
  const groesse = n + quellen.length;

  const A = Array.from({ length: groesse }, () => new Array(groesse).fill(0));
  const rechts = new Array(groesse).fill(0);

  for (let k = 0; k < gesamtKnoten; k++) {
    const i = index(k);
    if (i >= 0) A[i][i] += STUETZE;
  }

  for (const { a, b, wert } of widerstaende) {
    const leit = 1 / wert;
    const ia = index(a), ib = index(b);
    if (ia >= 0) A[ia][ia] += leit;
    if (ib >= 0) A[ib][ib] += leit;
    if (ia >= 0 && ib >= 0) { A[ia][ib] -= leit; A[ib][ia] -= leit; }
  }

  quellen.forEach((q, k) => {
    const zeile = n + k;
    const ia = index(q.a), ib = index(q.b);
    if (ia >= 0) { A[ia][zeile] += 1; A[zeile][ia] += 1; }
    if (ib >= 0) { A[ib][zeile] -= 1; A[zeile][ib] -= 1; }
    rechts[zeile] = q.wert;
  });

  const loesung = loeseLGS(A, rechts);
  if (!loesung) return { ...leer, potenzial: new Array(gesamtKnoten).fill(0) };

  const potenzial = new Array(gesamtKnoten).fill(0);
  for (let k = 0; k < gesamtKnoten; k++) {
    const i = index(k);
    potenzial[k] = i >= 0 ? loesung[i] : 0;
  }

  const strom = new Map<string, number>();
  quellen.forEach((q, k) => {
    strom.set(q.geraet, q.vorzeichen * loesung[n + k]);
  });
  for (const g of szene.geraete) {
    const ports = stromPorts(g.typ);
    if (!ports || (g.typ !== "widerstand" && g.typ !== "lampe")) continue;
    const a = knoten(g.id, ports[0]), b = knoten(g.id, ports[1]);
    if (a < 0 || b < 0) continue;
    strom.set(g.id, (potenzial[a] - potenzial[b]) / Math.max(1e-6, g.werte.widerstand ?? 1));
  }

  return { potenzial, strom, knoten };
}

/** Die Spannung über einem Bauteil, in Volt. */
export function bauteilSpannung(kreis: Stromkreis, g: Geraet): number {
  const ports = stromPorts(g.typ);
  if (!ports) return 0;
  const a = kreis.knoten(g.id, ports[0]), b = kreis.knoten(g.id, ports[1]);
  if (a < 0 || b < 0) return 0;
  return (kreis.potenzial[a] ?? 0) - (kreis.potenzial[b] ?? 0);
}
