/**
 * Schriftliche Rechenverfahren als Folge von Schnappschüssen: Was steht nach
 * jedem Schritt auf dem Rechenblatt, welche Spalte ist dran, wie stehen die
 * Walzen (eine je Stellenwert), und welche Ziffer »fliegt« gerade (Übertrag,
 * entbündelter Zehner, heruntergeholte Ziffer)?
 *
 * Addieren mit Übertrag, Subtrahieren durch Abziehen mit Entbündeln,
 * Multiplizieren (Teilprodukte, dann addieren) und Dividieren (wie oft passt …).
 * Nur natürliche Zahlen. Reine Rechnung, ohne React.
 */

export type Op = "+" | "−" | "·" | ":";
export type Ort = { r: number; c: number };
export type Zelle = Ort & { t: string; art: "zahl" | "zeichen" | "uebertrag" | "ergebnis" | "hilfe" | "teil"; durch?: boolean; neu?: boolean };
export type Strich = { r: number; c0: number; c1: number };
export type Schritt = {
  zellen: Zelle[];
  striche: Strich[];
  /** gerade bearbeitete Spalte(n) */
  spalten: number[];
  /** Ziffern der Walzen je Spalte (Ergebnis- bzw. Quotientenzeile) */
  stand: Record<number, number>;
  /** Die Walze, die sich in diesem Schritt dreht: von → bis (über 9 hinaus = Übertrag, unter 0 = Entbündeln) */
  walze?: { c: number; von: number; bis: number };
  flug?: { von: Ort; nach: Ort; t: string };
  text: string;
};
export type Ablauf = { op: Op; breite: number; hoehe: number; schritte: Schritt[]; ergebnis: string; /** Spalte der Einer im Ergebnis (für die Stellenwert-Farben) */ einer?: number };

const ziffern = (n: number) => String(n).split("").map(Number);
/** Spalte der Stelle `exp` bei rechtsbündiger Ausrichtung an Spalte `rechts` */
const sp = (rechts: number, exp: number) => rechts - exp;
const STELLE = ["Einer", "Zehner", "Hunderter", "Tausender", "Zehntausender", "Hunderttausender", "Millionen"];
export const stellenName = (exp: number) => STELLE[exp] ?? `10^${exp}`;

/** Zahl rechtsbündig als Zellen */
function zahlZellen(n: number | string, r: number, rechts: number, art: Zelle["art"] = "zahl"): Zelle[] {
  const s = String(n);
  return s.split("").map((t, i) => ({ r, c: rechts - (s.length - 1 - i), t, art }));
}

function klon(s: Schritt, extra: Partial<Schritt> = {}): Schritt {
  return { zellen: s.zellen.map(z => ({ ...z, neu: false })), striche: [...s.striche], spalten: [], stand: { ...s.stand }, text: "", ...extra };
}

// ── Addieren ─────────────────────────────────────────────────────────

export function addiere(zahlen: number[]): Ablauf {
  const summe = zahlen.reduce((a, b) => a + b, 0);
  const stellen = Math.max(String(summe).length, ...zahlen.map(z => String(z).length));
  const rechts = stellen; // Spalte 0 = Rechenzeichen
  const k = zahlen.length;
  const rU = k, rE = k + 1; // Übertragszeile, Ergebniszeile
  const start: Schritt = {
    zellen: [...zahlen.flatMap((z, i) => zahlZellen(z, i, rechts)), { r: k - 1, c: 0, t: "+", art: "zeichen" }],
    striche: [{ r: rU, c0: 0, c1: rechts }], spalten: [], stand: {},
    text: `Die Zahlen stehen stellengerecht untereinander: Einer unter Einern, Zehner unter Zehnern … Gerechnet wird von rechts nach links.`,
  };
  const schritte: Schritt[] = [start];
  let jetzt = start, uebertrag = 0;
  for (let e = 0; e < stellen; e++) {
    const c = sp(rechts, e);
    const z = zahlen.map(n => Math.floor(n / 10 ** e) % 10).filter((d, i) => d > 0 || 10 ** e <= zahlen[i]);
    const s = z.reduce((a, b) => a + b, 0) + uebertrag;
    if (s === 0 && 10 ** e > summe) break;
    const teile = [...z.map(String), ...(uebertrag ? [`${uebertrag} (Übertrag)`] : [])];
    const ziffer = s % 10, neuU = Math.floor(s / 10);
    const n = klon(jetzt, { spalten: [c] });
    // Die Walze startet beim Übertrag und dreht um jede Ziffer weiter; jede volle Runde über die 9 = ein Übertrag
    n.walze = { c, von: uebertrag, bis: s };
    n.stand[c] = ziffer;
    n.zellen.push({ r: rE, c, t: String(ziffer), art: "ergebnis", neu: true });
    if (neuU > 0 && e + 1 < stellen) {
      n.zellen.push({ r: rU, c: c - 1, t: String(neuU), art: "uebertrag", neu: true });
      n.flug = { von: { r: rE, c }, nach: { r: rU, c: c - 1 }, t: String(neuU) };
    } else if (neuU > 0) n.zellen.push({ r: rE, c: c - 1, t: String(neuU), art: "ergebnis", neu: true });
    n.text = `${stellenName(e)}: ${teile.join(" + ")} = ${s}. ` +
      (neuU ? `Schreibe ${ziffer}, ${neuU} ${neuU === 1 ? "Übertrag" : "Überträge"} zu den ${stellenName(e + 1)}n — die Walze ist ${neuU}-mal über die 9 gelaufen.` : `Schreibe ${ziffer}.`);
    if (neuU > 0 && e + 1 >= stellen) n.text += ` Der Übertrag ${neuU} kommt ganz vorn ins Ergebnis.`;
    schritte.push(n);
    jetzt = n; uebertrag = neuU;
  }
  const ende = klon(jetzt);
  ende.text = `Ergebnis: ${zahlen.join(" + ")} = ${summe}.`;
  schritte.push(ende);
  return { op: "+", breite: rechts + 1, hoehe: rE + 1, schritte, ergebnis: String(summe), einer: rechts };
}

// ── Subtrahieren (Abziehen mit Entbündeln) ───────────────────────────

export function subtrahiere(a: number, b: number): Ablauf {
  if (b > a) throw new Error("Minuend muss größer sein.");
  const stellen = String(a).length, rechts = stellen;
  const rH = 0, rA = 1, rB = 2, rE = 3;
  const oben = ziffern(a).reverse(); // je Stelle, wird beim Entbündeln verändert
  const start: Schritt = {
    zellen: [...zahlZellen(a, rA, rechts), ...zahlZellen(b, rB, rechts), { r: rB, c: 0, t: "−", art: "zeichen" }],
    striche: [{ r: rB, c0: 0, c1: rechts }], spalten: [], stand: {},
    text: "Stellengerecht untereinander schreiben. Von rechts nach links: oben minus unten. Reicht oben nicht, wird ein Bündel von links entbündelt.",
  };
  const schritte = [start];
  let jetzt = start;
  for (let e = 0; e < stellen; e++) {
    const c = sp(rechts, e), unten = Math.floor(b / 10 ** e) % 10;
    if (oben[e] < unten) {
      // Entbündeln: nächste Stelle links mit Ziffer > 0 suchen, dazwischen werden Nullen zu Neunen
      let j = e + 1;
      while (oben[j] === 0) j++;
      const n = klon(jetzt, { spalten: [c, sp(rechts, j)] });
      const durchstreichen = (exp: number, neu: number) => {
        const cc = sp(rechts, exp);
        n.zellen = n.zellen.map(z => (z.c === cc && (z.r === rA || z.r === rH) && !z.durch ? { ...z, durch: true } : z));
        n.zellen.push({ r: rH, c: cc, t: String(neu), art: "hilfe", neu: true });
      };
      oben[j] -= 1; durchstreichen(j, oben[j]);
      for (let m = j - 1; m > e; m--) { oben[m] = 9; durchstreichen(m, 9); }
      oben[e] += 10; durchstreichen(e, oben[e]);
      n.flug = { von: { r: rH, c: sp(rechts, j) }, nach: { r: rH, c }, t: "10" };
      n.text = `${stellenName(e)}: ${oben[e] - 10} − ${unten} geht nicht. Einen ${stellenName(j)} entbündeln (1 ${stellenName(j)} = 10 ${stellenName(j - 1)})` +
        (j > e + 1 ? ` (über die Nullen hinweg: jede wird zu 9)` : "") + `: jetzt ${oben[e]} ${stellenName(e)}.`;
      schritte.push(n); jetzt = n;
    }
    const d = oben[e] - unten;
    if (e > 0 && d === 0 && 10 ** e > a - b) { continue; }
    const n = klon(jetzt, { spalten: [c] });
    n.walze = { c, von: oben[e], bis: d }; // Walze steht auf der oberen Ziffer und dreht `unten`-mal zurück
    n.stand[c] = d;
    n.zellen.push({ r: rE, c, t: String(d), art: "ergebnis", neu: true });
    n.text = `${stellenName(e)}: ${oben[e]} − ${unten} = ${d}. Schreibe ${d}.`;
    schritte.push(n); jetzt = n;
  }
  const ende = klon(jetzt);
  ende.text = `Ergebnis: ${a} − ${b} = ${a - b}. Probe: ${a - b} + ${b} = ${a}.`;
  schritte.push(ende);
  return { op: "−", breite: rechts + 1, hoehe: rE + 1, schritte, ergebnis: String(a - b), einer: rechts };
}

// ── Multiplizieren ───────────────────────────────────────────────────

export function multipliziere(a: number, b: number): Ablauf {
  const za = String(a), zb = String(b);
  const la = za.length, lb = zb.length;
  const produkt = a * b;
  // Zeile 0: a · b; Teilprodukt j endet unter der j-ten Ziffer von b (deutsche Schreibweise, links beginnen)
  const endeVon = (j: number) => la + 1 + j;
  const teile = zb.split("").map(Number).map(d => a * d);
  const links = Math.min(0, ...teile.map((t, j) => endeVon(j) - String(t).length + 1), endeVon(lb - 1) - String(produkt).length + 1);
  const off = -links; // alles um off nach rechts schieben
  const C = (c: number) => c + off;
  const rT = (j: number) => 1 + j, rU = lb + 1, rE = lb + 2;
  const start: Schritt = {
    zellen: [...zahlZellen(a, 0, C(la - 1)), { r: 0, c: C(la), t: "·", art: "zeichen" }, ...zahlZellen(b, 0, C(la + lb))],
    striche: [{ r: 0, c0: C(0) - off, c1: C(la + lb) }], spalten: [], stand: {},
    text: `Jede Ziffer von ${b} wird einzeln mit ${a} malgenommen (Teilprodukte), von links nach rechts. Jedes Teilprodukt endet genau unter seiner Ziffer.`,
  };
  const schritte = [start];
  let jetzt = start;
  const ra = za.split("").map(Number).reverse();
  zb.split("").map(Number).forEach((d, j) => {
    const rechts = C(endeVon(j));
    let u = 0;
    for (let e = 0; e < la; e++) {
      const p = ra[e] * d + u, ziffer = p % 10, neuU = Math.floor(p / 10);
      const n = klon(jetzt, { spalten: [C(la - 1 - e), C(la + 1 + j)] });
      n.zellen.push({ r: rT(j), c: rechts - e, t: String(e === la - 1 ? p : ziffer), art: "teil", neu: true });
      if (e === la - 1 && p >= 10) n.zellen = n.zellen.map(z => (z.r === rT(j) && z.c === rechts - e && z.neu ? { ...z, t: String(ziffer) } : z)).concat({ r: rT(j), c: rechts - e - 1, t: String(neuU), art: "teil", neu: true });
      n.walze = { c: rechts - e, von: u, bis: p };
      n.text = `${ra[e]} · ${d}${u ? ` + ${u} (gemerkt)` : ""} = ${p}. ` + (e === la - 1 ? `Alles hinschreiben: ${p}.` : neuU ? `Schreibe ${ziffer}, merke ${neuU}.` : `Schreibe ${ziffer}.`);
      if (neuU && e < la - 1) n.flug = { von: { r: rT(j), c: rechts - e }, nach: { r: rT(j), c: rechts - e - 1 }, t: `+${neuU}` };
      schritte.push(n); jetzt = n; u = neuU;
    }
  });
  // Teilprodukte addieren
  const n = klon(jetzt, { spalten: [] });
  if (lb > 1) {
    n.striche.push({ r: rU, c0: 0, c1: C(la + lb) });
    n.zellen.push({ r: lb, c: 0, t: "+", art: "zeichen", neu: true });
  }
  n.text = lb > 1 ? "Jetzt die Teilprodukte stellengerecht addieren." : "Nur eine Ziffer: Das Teilprodukt ist schon das Ergebnis.";
  schritte.push(n); jetzt = n;
  if (lb > 1) {
    const rechts = C(endeVon(lb - 1));
    const werte = teile.map((t, j) => t * 10 ** (lb - 1 - j));
    let u = 0;
    for (let e = 0; 10 ** e <= produkt; e++) {
      const s = werte.reduce((acc, w) => acc + (Math.floor(w / 10 ** e) % 10), 0) + u;
      const m = klon(jetzt, { spalten: [rechts - e] });
      m.zellen.push({ r: rE, c: rechts - e, t: String(s % 10), art: "ergebnis", neu: true });
      const neuU = Math.floor(s / 10);
      if (neuU && 10 ** (e + 1) <= produkt) {
        m.zellen.push({ r: rU, c: rechts - e - 1, t: String(neuU), art: "uebertrag", neu: true });
        m.flug = { von: { r: rE, c: rechts - e }, nach: { r: rU, c: rechts - e - 1 }, t: String(neuU) };
      }
      m.walze = { c: rechts - e, von: u, bis: s };
      m.stand[rechts - e] = s % 10;
      m.text = `${stellenName(e)}: zusammen ${s}. Schreibe ${s % 10}${neuU ? `, Übertrag ${neuU}` : ""}.`;
      schritte.push(m); jetzt = m; u = neuU;
    }
  } else {
    jetzt.zellen = jetzt.zellen.map(z => (z.art === "teil" ? { ...z, art: "ergebnis" } : z));
    jetzt.zellen.filter(z => z.art === "ergebnis").forEach(z => { jetzt.stand[z.c] = Number(z.t); });
  }
  const ende = klon(jetzt);
  ende.text = `Ergebnis: ${a} · ${b} = ${produkt}.`;
  schritte.push(ende);
  const breite = C(la + lb) + 1;
  return { op: "·", breite, hoehe: lb > 1 ? rE + 1 : lb + 1, schritte, ergebnis: String(produkt), einer: C(endeVon(lb - 1)) };
}

// ── Dividieren ───────────────────────────────────────────────────────

export function dividiere(a: number, b: number): Ablauf {
  if (b <= 0) throw new Error("Durch 0 teilt man nicht.");
  const za = String(a), la = za.length, lb = String(b).length;
  const q = Math.floor(a / b), rest = a % b;
  const O = 1; // eine Spalte Rand links für das Minuszeichen
  const cQ = O + la + 1 + lb + 1; // erste Spalte des Quotienten (nach »= «)
  const start: Schritt = {
    zellen: [...zahlZellen(a, 0, O + la - 1), { r: 0, c: O + la, t: ":", art: "zeichen" }, ...zahlZellen(b, 0, O + la + lb), { r: 0, c: O + la + lb + 1, t: "=", art: "zeichen" }],
    striche: [], spalten: [], stand: {},
    text: `Von links beginnen: so viele Ziffern von ${a} nehmen, bis ${b} hineinpasst.`,
  };
  const schritte = [start];
  let jetzt = start;
  // erste Teilzahl
  let i = 0, teil = 0;
  do { teil = teil * 10 + Number(za[i]); i++; } while (teil < b && i < la);
  let zeile = 1, qStelle = 0;
  for (;;) {
    const ende = O + i - 1; // Spalte, bis zu der die Teilzahl reicht
    const k = Math.floor(teil / b), m = k * b, r = teil - m;
    const n = klon(jetzt, { spalten: [ende] });
    n.walze = { c: cQ + qStelle, von: 0, bis: k }; // die Quotienten-Walze zählt hoch: 1·b, 2·b, … bis es nicht mehr passt
    n.stand[cQ + qStelle] = k;
    n.zellen.push({ r: 0, c: cQ + qStelle, t: String(k), art: "ergebnis", neu: true });
    const vielfache = Array.from({ length: Math.min(k + 1, 10) }, (_, x) => `${x + 1} · ${b} = ${(x + 1) * b}`);
    n.text = `Wie oft passt ${b} in ${teil}? ${k}-mal (${vielfache.slice(0, k + 1).join(", ")}${k + 1 <= 9 ? " — zu viel" : ""}). Schreibe ${k} ins Ergebnis.`;
    schritte.push(n); jetzt = n;
    const n2 = klon(jetzt, { spalten: [ende] });
    n2.zellen.push(...zahlZellen(m, zeile, ende, "teil").map(z => ({ ...z, neu: true })), { r: zeile, c: ende - String(m).length, t: "−", art: "zeichen" });
    n2.striche.push({ r: zeile, c0: ende - String(Math.max(m, teil)).length + 1, c1: ende });
    n2.zellen.push(...zahlZellen(r, zeile + 1, ende).map(z => ({ ...z, neu: true })));
    n2.text = `${k} · ${b} = ${m} darunter schreiben und abziehen: ${teil} − ${m} = ${r}.`;
    schritte.push(n2); jetzt = n2;
    zeile += 2; qStelle++;
    if (i >= la) break;
    // nächste Ziffer herunterholen
    const n3 = klon(jetzt, { spalten: [O + i] });
    n3.zellen.push({ r: zeile - 1, c: O + i, t: za[i], art: "zahl", neu: true });
    n3.flug = { von: { r: 0, c: O + i }, nach: { r: zeile - 1, c: O + i }, t: za[i] };
    teil = r * 10 + Number(za[i]);
    n3.text = `Die nächste Ziffer ${za[i]} herunterholen: weiter mit ${teil}.`;
    schritte.push(n3); jetzt = n3;
    i++;
  }
  const fertig = klon(jetzt);
  if (rest) fertig.zellen.push({ r: 0, c: cQ + qStelle + 1, t: `R ${rest}`, art: "ergebnis", neu: true });
  fertig.text = `Ergebnis: ${a} : ${b} = ${q}${rest ? ` Rest ${rest}` : ""}. Probe: ${q} · ${b}${rest ? ` + ${rest}` : ""} = ${a}.`;
  schritte.push(fertig);
  const hoehe = Math.max(...fertig.zellen.map(z => z.r)) + 1;
  return { op: ":", breite: cQ + qStelle + 3, hoehe, schritte, ergebnis: `${q}${rest ? ` R ${rest}` : ""}` };
}

export function rechne(op: Op, a: number, b: number): Ablauf {
  return op === "+" ? addiere([a, b]) : op === "−" ? subtrahiere(a, b) : op === "·" ? multipliziere(a, b) : dividiere(a, b);
}

// ── Aufgaben ─────────────────────────────────────────────────────────

export type Zufall = () => number;
const zz = (r: Zufall, x: number, y: number) => x + Math.floor(r() * (y - x + 1));

export function aufgabe(op: Op, stufe: 1 | 2 | 3, r: Zufall = Math.random): { a: number; b: number } {
  const gross = stufe === 1 ? 999 : stufe === 2 ? 9999 : 99999;
  if (op === "+") return { a: zz(r, 10, gross), b: zz(r, 10, gross) };
  if (op === "−") { const a = zz(r, 100, gross); return { a, b: zz(r, 10, a) }; }
  if (op === "·") return { a: zz(r, stufe === 1 ? 12 : 100, stufe === 3 ? 9999 : 999), b: zz(r, 2, stufe === 1 ? 9 : stufe === 2 ? 99 : 999) };
  const b = zz(r, 2, stufe === 3 ? 25 : 9);
  return { a: zz(r, b * 10, stufe === 1 ? 999 : gross), b };
}

export function loesung(op: Op, a: number, b: number): { wert: number; rest: number } {
  if (op === "+") return { wert: a + b, rest: 0 };
  if (op === "−") return { wert: a - b, rest: 0 };
  if (op === "·") return { wert: a * b, rest: 0 };
  return { wert: Math.floor(a / b), rest: a % b };
}

/**
 * Fehlerdetektiv: richtiges Ergebnis mit einem typischen Fehler — beim
 * Addieren/Multiplizieren Übertrag vergessen, beim Subtrahieren das
 * Entbündeln vergessen (kleinere von größerer Ziffer abgezogen). Liefert das
 * falsche Ergebnis und die Stelle (exp) der ersten falschen Ziffer, oder null.
 */
/** Stelle der ersten (von rechts) abweichenden Ziffer */
export function abweichung(x: number, y: number): number {
  for (let e = 0; e < 16; e++) if (Math.floor(x / 10 ** e) % 10 !== Math.floor(y / 10 ** e) % 10) return e;
  return -1;
}

export function mitFehler(op: "+" | "−", a: number, b: number): { falsch: number; exp: number; grund: string } | null {
  if (op === "+") {
    for (let e = 0; 10 ** (e + 1) <= Math.max(a, b) * 10; e++) {
      const s = (Math.floor(a / 10 ** e) % 10) + (Math.floor(b / 10 ** e) % 10);
      if (s >= 10 && 10 ** (e + 1) <= a + b) {
        // Übertrag dieser Stelle vergessen: nächste Stelle um 1 zu klein (falls dort selbst kein Übertrag entsteht)
        const falsch = a + b - 10 ** (e + 1);
        return { falsch, exp: abweichung(a + b, falsch), grund: `Bei den ${stellenName(e)}n entsteht ein Übertrag (${s}) — der wurde bei den ${stellenName(e + 1)}n vergessen.` };
      }
    }
    return null;
  }
  // Subtraktion: in der ersten Spalte mit oben < unten »unten − oben« gerechnet und nicht entbündelt
  for (let e = 0; 10 ** e <= a; e++) {
    const o = Math.floor(a / 10 ** e) % 10, u = Math.floor(b / 10 ** e) % 10;
    if (o < u) {
      const falsch = a - b + (u - o) * 10 ** e - (10 + o - u) * 10 ** e + 10 ** (e + 1);
      return { falsch, exp: abweichung(a - b, falsch), grund: `Bei den ${stellenName(e)}n: ${o} − ${u} geht nicht. Statt zu entbündeln wurde ${u} − ${o} gerechnet.` };
    }
  }
  return null;
}
