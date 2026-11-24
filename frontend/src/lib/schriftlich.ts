/**
 * Schriftliche Rechenverfahren als Folge von Schnappschüssen: Was steht nach
 * jedem Schritt auf dem Rechenblatt, welche Spalte ist dran, wie dreht die
 * Walze der Spalte, welche Ziffer »fliegt« (Übertrag, entbündelter Zehner,
 * heruntergeholte Ziffer) und welche Rechenkette mit Bögen steht daneben.
 *
 * Zeitlicher Ablauf eines Schritts (die Oberfläche hält sich daran):
 *   1. die Walze dreht (über 9 → 0 in Zeitlupe),
 *   2. Zellen mit `ab: "walze"` erscheinen, der Übertrag fliegt los,
 *   3. Zellen mit `ab: "flug"` (das Ziel des Flugs) erscheinen.
 *
 * Addieren mit Übertrag, Subtrahieren durch Ergänzen mit Übertrag (Standard)
 * oder Abziehen mit Entbündeln, Multiplizieren (Produkt → Zehner als Übertrag,
 * Einer schreiben; dann Teilprodukte addieren) und Dividieren (wie oft passt …,
 * mit Probe). Nur natürliche Zahlen. Reine Rechnung, ohne React.
 */

export type Op = "+" | "−" | "·" | ":";
export type Methode = "ergaenzen" | "entbuendeln";
export type Ort = { r: number; c: number };
export type Zelle = Ort & {
  t: string; art: "zahl" | "zeichen" | "uebertrag" | "ergebnis" | "hilfe" | "teil" | "komma";
  durch?: boolean; neu?: boolean;
  /** Periodenstrich über der Ziffer */
  strich?: boolean;
  /** erst nach der Walze bzw. nach dem Flug zeigen */
  ab?: "walze" | "flug";
};
export type Strich = { r: number; c0: number; c1: number };
/** Rechenkette mit Bögen (wie beim Größen-Umrechnen): Kasten —Bogen→ Kasten … */
export type Kette = { kaesten: string[]; boegen: { text: string; art: "plus" | "minus" | "mal" | "durch" }[]; titel?: string };
/** Eine Zahl zerfällt in Zehner (Übertrag) und Einer (schreiben) */
export type Zerlegung = { zahl: number; zehner: number; einer: number };
/** Subtrahieren: oben reicht nicht, ein Zehner wird geborgt — oben + 10 − unten = Ziffer, merke eins */
export type Borgen = { oben: number; mit: number; unten: number; ziffer: number };
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
  ketten?: Kette[];
  zerlegung?: Zerlegung;
  borgen?: Borgen;
  text: string;
};
export type Ablauf = {
  op: Op; breite: number; hoehe: number; schritte: Schritt[]; ergebnis: string;
  /** Spalte der Einer im Ergebnis (für die Stellenwert-Farben) */ einer?: number;
  /** Zeilen, in die Überträge geschrieben werden (für das Übungspapier) */ uebertragZeilen?: number[];
};

const ziffern = (n: number) => String(n).split("").map(Number);
/** Spalte der Stelle `exp` bei rechtsbündiger Ausrichtung an Spalte `rechts` */
const sp = (rechts: number, exp: number) => rechts - exp;
const STELLE = ["Einer", "Zehner", "Hunderter", "Tausender", "Zehntausender", "Hunderttausender", "Millionen"];
export const stellenName = (exp: number) => STELLE[exp] ?? `10^${exp}`;
const ziffer = (n: number, e: number) => Math.floor(n / 10 ** e) % 10;

/** Zahl rechtsbündig als Zellen */
function zahlZellen(n: number | string, r: number, rechts: number, art: Zelle["art"] = "zahl"): Zelle[] {
  const s = String(n);
  return s.split("").map((t, i) => ({ r, c: rechts - (s.length - 1 - i), t, art }));
}

function klon(s: Schritt, extra: Partial<Schritt> = {}): Schritt {
  return {
    zellen: s.zellen.map(z => ({ ...z, neu: false, ab: undefined })), striche: [...s.striche], spalten: [], stand: { ...s.stand }, text: "", ...extra,
  };
}

/** Kette für eine Spaltensumme: 4 —+7→ 11 —+1 (Übertrag)→ 12 */
function summenKette(teile: number[], uebertrag: number, titel?: string): Kette {
  const kaesten = [String(teile[0] ?? 0)], boegen: Kette["boegen"] = [];
  let s = teile[0] ?? 0;
  for (const t of teile.slice(1)) { s += t; boegen.push({ text: `+ ${t}`, art: "plus" }); kaesten.push(String(s)); }
  if (uebertrag) { s += uebertrag; boegen.push({ text: `+ ${uebertrag} Übertrag`, art: "plus" }); kaesten.push(String(s)); }
  return { kaesten, boegen, titel };
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
    text: "Die Zahlen stehen stellengerecht untereinander: Einer unter Einern, Zehner unter Zehnern … Gerechnet wird von rechts nach links.",
  };
  const schritte: Schritt[] = [start];
  let jetzt = start, uebertrag = 0;
  for (let e = 0; e < stellen; e++) {
    const c = sp(rechts, e);
    const z = zahlen.filter(n => 10 ** e <= n || (e === 0)).map(n => ziffer(n, e));
    const s = z.reduce((a, b) => a + b, 0) + uebertrag;
    if (s === 0 && 10 ** e > summe) break;
    const einer = s % 10, zehner = Math.floor(s / 10);
    const n = klon(jetzt, { spalten: [c] });
    // Die Walze startet beim Übertrag und dreht um jede Ziffer weiter; jede volle Runde über die 9 = ein Übertrag
    n.walze = { c, von: uebertrag, bis: s };
    n.stand[c] = einer;
    n.ketten = [summenKette(z, uebertrag, stellenName(e))];
    const letzte = 10 ** (e + 1) > summe;
    n.zellen.push({ r: rE, c, t: String(einer), art: "ergebnis", neu: true, ab: "walze" });
    if (zehner > 0 && !letzte) {
      n.zerlegung = { zahl: s, zehner, einer };
      n.zellen.push({ r: rU, c: c - 1, t: String(zehner), art: "uebertrag", neu: true, ab: "flug" });
      n.flug = { von: { r: rE, c }, nach: { r: rU, c: c - 1 }, t: `+${zehner}` };
    } else if (zehner > 0) n.zellen.push({ r: rE, c: c - 1, t: String(zehner), art: "ergebnis", neu: true, ab: "walze" });
    n.text = `${stellenName(e)}: ${[...z.map(String), ...(uebertrag ? [`${uebertrag} (Übertrag)`] : [])].join(" + ")} = ${s}. ` +
      (zehner && !letzte ? `${s} = ${zehner} Zehner + ${einer} Einer: Schreibe ${einer}, ${zehner} wandert als Übertrag zu den ${stellenName(e + 1)}n — die Walze ist über die 9 gelaufen.` : `Schreibe ${zehner && letzte ? s : einer}.`);
    schritte.push(n);
    jetzt = n; uebertrag = zehner;
  }
  const ende = klon(jetzt);
  ende.text = `Ergebnis: ${zahlen.join(" + ")} = ${summe}.`;
  schritte.push(ende);
  return { op: "+", breite: rechts + 1, hoehe: rE + 1, schritte, ergebnis: String(summe), einer: rechts, uebertragZeilen: [rU] };
}

// ── Subtrahieren: Ergänzen mit Übertrag ──────────────────────────────

export function subtrahiereErgaenzen(a: number, b: number): Ablauf {
  if (b > a) throw new Error("Minuend muss größer sein.");
  const diff = a - b;
  const stellen = String(a).length, rechts = stellen;
  const rA = 0, rB = 1, rU = 2, rE = 3;
  const start: Schritt = {
    zellen: [...zahlZellen(a, rA, rechts), ...zahlZellen(b, rB, rechts), { r: rB, c: 0, t: "−", art: "zeichen" }],
    striche: [{ r: rU, c0: 0, c1: rechts }], spalten: [], stand: {},
    text: "Stellengerecht untereinander schreiben. Gerechnet wird von rechts nach links durch Ergänzen: unten plus wie viel ergibt oben? Reicht oben nicht, ergänzt man bis zur nächsten Zehnerzahl und schreibt einen Übertrag — genau wie beim Addieren.",
  };
  const schritte = [start];
  let jetzt = start, uebertrag = 0;
  for (let e = 0; e < stellen; e++) {
    const c = sp(rechts, e), o = ziffer(a, e), u = ziffer(b, e);
    const unten = u + uebertrag;
    const ziel = unten > o ? o + 10 : o;
    const d = ziel - unten, neuU = unten > o ? 1 : 0;
    const fuehrendeNull = e > 0 && 10 ** e > diff;
    const n = klon(jetzt, { spalten: [c] });
    // Die Walze startet auf der oberen Ziffer und dreht `unten`-mal zurück (7 − 1: 7 → 6).
    // Reicht oben nicht, dreht sie über 0 hinaus auf 9 — das ist das Borgen — und bleibt auf der Ziffer stehen, die geschrieben wird.
    n.walze = { c, von: o, bis: o - unten };
    n.ketten = [{ titel: stellenName(e), kaesten: uebertrag ? [String(u), String(unten), String(ziel)] : [String(unten), String(ziel)],
      boegen: [...(uebertrag ? [{ text: `+ ${uebertrag} Übertrag`, art: "plus" as const }] : []), { text: `+ ${d}`, art: "plus" as const }] }];
    if (!fuehrendeNull) { n.stand[c] = d; n.zellen.push({ r: rE, c, t: String(d), art: "ergebnis", neu: true, ab: "walze" }); }
    if (neuU) {
      n.borgen = { oben: o, mit: ziel, unten, ziffer: d };
      n.zellen.push({ r: rU, c: c - 1, t: "1", art: "uebertrag", neu: true, ab: "flug" });
      n.flug = { von: { r: rE, c }, nach: { r: rU, c: c - 1 }, t: "+1" };
    }
    const vorher = uebertrag ? `Unten ${u} + ${uebertrag} gemerkt = ${unten}. ` : "";
    n.text = `${stellenName(e)}: ${vorher}` +
      (neuU ? `${o} − ${unten} geht nicht (${unten} + ? = ${o} geht nicht). Einen Zehner borgen: aus ${o} wird ${ziel}. ${ziel} − ${unten} = ${d} (${unten} + ${d} = ${ziel}). Schreibe ${d} — merke eins für die ${stellenName(e + 1)}.`
        : `${o} − ${unten} = ${d} (${unten} + ${d} = ${o}). ${fuehrendeNull ? "Eine führende Null schreibt man nicht." : `Schreibe ${d}.`}`);
    schritte.push(n); jetzt = n; uebertrag = neuU;
  }
  const ende = klon(jetzt);
  ende.ketten = [{ titel: "Probe", kaesten: [String(diff), String(a)], boegen: [{ text: `+ ${b}`, art: "plus" }] }];
  ende.text = `Ergebnis: ${a} − ${b} = ${diff}. Probe: ${diff} + ${b} = ${a}.`;
  schritte.push(ende);
  return { op: "−", breite: rechts + 1, hoehe: rE + 1, schritte, ergebnis: String(diff), einer: rechts, uebertragZeilen: [rU] };
}

// ── Multiplizieren ───────────────────────────────────────────────────

export function multipliziere(a: number, b: number): Ablauf {
  const za = String(a), zb = String(b);
  const la = za.length, lb = zb.length;
  const produkt = a * b;
  const endeVon = (j: number) => la + 1 + j; // Teilprodukt j endet unter der j-ten Ziffer von b
  const teile = zb.split("").map(Number).map(d => a * d);
  const links = Math.min(0, ...teile.map((t, j) => endeVon(j) - String(t).length + 1), endeVon(lb - 1) - String(produkt).length + 1);
  const off = 1 - links; // eine Spalte Rand für das Pluszeichen
  const C = (c: number) => c + off;
  const rU = (j: number) => 1 + 2 * j, rT = (j: number) => 2 + 2 * j; // Übertragszeile über jedem Teilprodukt
  const rUs = 1 + 2 * lb, rE = 2 + 2 * lb;
  const start: Schritt = {
    zellen: [...zahlZellen(a, 0, C(la - 1)), { r: 0, c: C(la), t: "·", art: "zeichen" }, ...zahlZellen(b, 0, C(la + lb))],
    striche: [{ r: 0, c0: 0, c1: C(la + lb) }], spalten: [], stand: {},
    text: `Jede Ziffer von ${b} wird mit ${a} malgenommen — von links nach rechts. Jedes Teilprodukt endet genau unter seiner Ziffer. In jeder Stelle: Produkt bilden, Übertrag dazu, Einer schreiben, Zehner als Übertrag weitergeben.`,
  };
  const schritte = [start];
  let jetzt = start;
  const ra = za.split("").map(Number).reverse();
  zb.split("").map(Number).forEach((d, j) => {
    const rechts = C(endeVon(j));
    let u = 0;
    for (let e = 0; e < la; e++) {
      const col = rechts - e, p0 = ra[e] * d, p = p0 + u;
      const letzte = e === la - 1;
      // 1. Produkt
      const s1 = klon(jetzt, { spalten: [C(la - 1 - e), C(la + 1 + j)] });
      s1.ketten = [{ titel: `${stellenName(e)} · ${d}`, kaesten: [String(ra[e]), String(p0)], boegen: [{ text: `· ${d}`, art: "mal" }] }];
      s1.text = `${ra[e]} · ${d} = ${p0}.${u ? ` Dazu kommt gleich der Übertrag ${u}.` : ""}`;
      schritte.push(s1); jetzt = s1;
      // 2. Übertrag dazu (nur wenn einer da ist) — langsam, mit der Walze
      if (u) {
        const s2 = klon(jetzt, { spalten: [col] });
        s2.zellen = s2.zellen.map(z => (z.r === rU(j) && z.c === col ? { ...z, durch: true } : z));
        s2.walze = { c: col, von: p0, bis: p };
        s2.stand[col] = p % 10;
        s2.ketten = [{ titel: "plus Übertrag", kaesten: [String(ra[e]), String(p0), String(p)], boegen: [{ text: `· ${d}`, art: "mal" }, { text: `+ ${u} Übertrag`, art: "plus" }] }];
        s2.text = `Übertrag dazu: ${p0} + ${u} = ${p}.`;
        schritte.push(s2); jetzt = s2;
      }
      // 3. Zerlegen: Einer schreiben, Zehner als Übertrag
      const einer = p % 10, zehner = Math.floor(p / 10);
      const s3 = klon(jetzt, { spalten: [col] });
      s3.stand[col] = einer;
      if (letzte) {
        s3.zellen.push(...zahlZellen(p, rT(j), col, "teil").map(z => ({ ...z, neu: true, ab: "walze" as const })));
        s3.text = `Letzte Stelle: ${p} ganz hinschreiben.`;
      } else {
        s3.zellen.push({ r: rT(j), c: col, t: String(einer), art: "teil", neu: true, ab: "walze" });
        if (zehner) {
          s3.zerlegung = { zahl: p, zehner, einer };
          s3.zellen.push({ r: rU(j), c: col - 1, t: String(zehner), art: "uebertrag", neu: true, ab: "flug" });
          s3.flug = { von: { r: rT(j), c: col }, nach: { r: rU(j), c: col - 1 }, t: `+${zehner}` };
          s3.text = `${p} = ${zehner} Zehner + ${einer} Einer: Schreibe ${einer}, ${zehner} wandert als Übertrag eine Stelle nach links.`;
        } else s3.text = `${p} hat keine Zehner: Schreibe ${einer}, kein Übertrag.`;
      }
      schritte.push(s3); jetzt = s3; u = zehner;
    }
  });
  if (lb > 1) {
    const n = klon(jetzt);
    n.striche.push({ r: rUs, c0: 0, c1: C(la + lb) });
    n.zellen.push({ r: rT(lb - 1), c: 0, t: "+", art: "zeichen", neu: true });
    n.text = "Jetzt die Teilprodukte stellengerecht addieren — wie beim schriftlichen Addieren.";
    schritte.push(n); jetzt = n;
    const rechts = C(endeVon(lb - 1));
    const werte = teile.map((t, j) => t * 10 ** (lb - 1 - j));
    let u = 0;
    for (let e = 0; 10 ** e <= produkt; e++) {
      const col = rechts - e;
      const z = werte.filter(w => 10 ** e <= w).map(w => ziffer(w, e));
      const s = z.reduce((x, y) => x + y, 0) + u;
      const m = klon(jetzt, { spalten: [col] });
      const einer = s % 10, zehner = Math.floor(s / 10), letzte = 10 ** (e + 1) > produkt;
      m.walze = { c: col, von: u, bis: s };
      m.stand[col] = einer;
      m.ketten = [summenKette(z.length ? z : [0], u, stellenName(e))];
      m.zellen.push({ r: rE, c: col, t: String(letzte ? s : einer), art: "ergebnis", neu: true, ab: "walze" });
      if (letzte && zehner) m.zellen = m.zellen.map(x => (x.r === rE && x.c === col && x.neu ? { ...x, t: String(einer) } : x)).concat({ r: rE, c: col - 1, t: String(zehner), art: "ergebnis", neu: true, ab: "walze" });
      if (zehner && !letzte) {
        m.zerlegung = { zahl: s, zehner, einer };
        m.zellen.push({ r: rUs, c: col - 1, t: String(zehner), art: "uebertrag", neu: true, ab: "flug" });
        m.flug = { von: { r: rE, c: col }, nach: { r: rUs, c: col - 1 }, t: `+${zehner}` };
      }
      m.text = `${stellenName(e)}: zusammen ${s}. Schreibe ${letzte ? s : einer}${zehner && !letzte ? `, Übertrag ${zehner}` : ""}.`;
      schritte.push(m); jetzt = m; u = zehner;
    }
  } else {
    jetzt.zellen = jetzt.zellen.map(z => (z.art === "teil" ? { ...z, art: "ergebnis" } : z));
  }
  const ende = klon(jetzt);
  ende.text = `Ergebnis: ${a} · ${b} = ${produkt}.`;
  return { op: "·", breite: C(la + lb) + 1, hoehe: lb > 1 ? rE + 1 : rT(0) + 1, schritte: [...schritte, ende], ergebnis: String(produkt), einer: C(endeVon(lb - 1)),
    uebertragZeilen: [...Array.from({ length: lb }, (_, j) => rU(j)), ...(lb > 1 ? [rUs] : [])] };
}

// ── Dividieren ───────────────────────────────────────────────────────

/**
 * Schriftlich dividieren. Mit `nachkomma` (höchstens so viele Stellen nach dem
 * Komma) wird nicht mit Rest aufgehört, sondern es werden Nullen angehängt —
 * so wird aus einem Bruch eine Dezimalzahl. Kommt ein Rest zum zweiten Mal,
 * wiederholt sich alles: periodisch (die Periode bekommt einen Strich).
 */
export function dividiere(a: number, b: number, opts: { nachkomma?: number } = {}): Ablauf {
  if (b <= 0) throw new Error("Durch 0 teilt man nicht.");
  const za = String(a), la = za.length, lb = String(b).length;
  const q = Math.floor(a / b), rest = a % b;
  // Vorab: wie viele Nachkommastellen braucht es, und wo beginnt eine Periode?
  const nachDigits: number[] = [];
  let periodeAb: number | null = null;
  if (opts.nachkomma) {
    const gesehen = new Map<number, number>();
    let r = rest;
    while (r !== 0 && nachDigits.length < opts.nachkomma) {
      if (gesehen.has(r)) { periodeAb = gesehen.get(r)!; break; }
      gesehen.set(r, nachDigits.length);
      r *= 10; nachDigits.push(Math.floor(r / b)); r %= b;
    }
  }
  const nk = nachDigits.length;
  const ziffern = za + "0".repeat(nk); // angehängte Nullen
  const O = 1; // eine Spalte Rand links für das Minuszeichen
  const cDurch = O + la + nk;
  const cQ = cDurch + 1 + lb + 1; // erste Spalte des Quotienten (nach »= «)
  const start: Schritt = {
    zellen: [...zahlZellen(a, 0, O + la - 1), { r: 0, c: cDurch, t: ":", art: "zeichen" }, ...zahlZellen(b, 0, cDurch + lb), { r: 0, c: cDurch + lb + 1, t: "=", art: "zeichen" }],
    striche: [], spalten: [], stand: {},
    text: nk
      ? `${a} : ${b} als Dezimalzahl: Von links beginnen. Geht es mit den Ziffern von ${a} nicht mehr weiter, schreiben wir ein Komma und hängen Nullen an.`
      : `Von links beginnen: so viele Ziffern von ${a} nehmen, bis ${b} hineinpasst.`,
  };
  if (nk) start.zellen.push({ r: 0, c: O + la, t: ",", art: "komma" });
  const schritte = [start];
  let jetzt = start;
  let i = 0, teil = 0;
  do { teil = teil * 10 + Number(ziffern[i]); i++; } while (teil < b && i < la);
  let zeile = 1, qStelle = 0;
  const qZellen: Zelle[] = [];
  for (;;) {
    const ende = O + i - 1; // Spalte, bis zu der die Teilzahl reicht
    const k = Math.floor(teil / b), m = k * b, r = teil - m;
    // 1. Wie oft passt b hinein? Die Walze zählt hoch
    const n = klon(jetzt, { spalten: [ende] });
    n.walze = { c: cQ + qStelle, von: 0, bis: k };
    n.stand[cQ + qStelle] = k;
    const qz: Zelle = { r: 0, c: cQ + qStelle, t: String(k), art: "ergebnis", neu: true, ab: "walze" };
    n.zellen.push(qz); qZellen.push(qz);
    n.ketten = [
      { titel: "Wie oft passt es?", kaesten: [String(teil), String(k)], boegen: [{ text: `: ${b}`, art: "durch" }] },
      { titel: "Probe im Kopf", kaesten: [String(k), String(m)], boegen: [{ text: `· ${b}`, art: "mal" }] },
    ];
    n.text = `Wie oft passt ${b} in ${teil}? ${k}-mal, denn ${k} · ${b} = ${m}${k < 9 ? ` und ${k + 1} · ${b} = ${(k + 1) * b} wäre zu viel` : ""}. Schreibe ${k} ins Ergebnis.`;
    schritte.push(n); jetzt = n;
    // 2. Malnehmen und abziehen
    const n2 = klon(jetzt, { spalten: [ende] });
    n2.zellen.push(...zahlZellen(m, zeile, ende, "teil").map(z => ({ ...z, neu: true })), { r: zeile, c: ende - String(m).length, t: "−", art: "zeichen" });
    n2.striche.push({ r: zeile, c0: ende - String(Math.max(m, teil)).length + 1, c1: ende });
    n2.zellen.push(...zahlZellen(r, zeile + 1, ende).map(z => ({ ...z, neu: true, ab: "walze" as const })));
    n2.ketten = [
      { titel: "malnehmen", kaesten: [String(k), String(m)], boegen: [{ text: `· ${b}`, art: "mal" }] },
      { titel: "abziehen", kaesten: [String(teil), String(r)], boegen: [{ text: `− ${m}`, art: "minus" }] },
    ];
    n2.text = `${k} · ${b} = ${m} darunter schreiben und abziehen: ${teil} − ${m} = ${r}.`;
    schritte.push(n2); jetzt = n2;
    zeile += 2; qStelle++;
    if (i >= la + nk || (i >= la && r === 0)) break;
    // 3. Nächste Ziffer herunterholen — nach dem Komma eine angehängte Null
    const n3 = klon(jetzt, { spalten: [O + i] });
    const null_ = i >= la;
    if (null_) {
      n3.zellen.push({ r: 0, c: O + i, t: "0", art: "zahl", neu: true });
      if (i === la) n3.zellen.push({ r: 0, c: cQ + qStelle, t: ",", art: "komma", neu: true });
    }
    n3.zellen.push({ r: zeile - 1, c: O + i, t: ziffern[i], art: "zahl", neu: true, ab: "flug" });
    n3.flug = { von: { r: 0, c: O + i }, nach: { r: zeile - 1, c: O + i }, t: ziffern[i] };
    teil = r * 10 + Number(ziffern[i]);
    n3.ketten = [{ titel: null_ ? "Null anhängen" : "herunterholen", kaesten: [String(r), String(teil)], boegen: [{ text: `· 10 + ${ziffern[i]}`, art: "plus" }] }];
    n3.text = null_
      ? `${i === la ? `Die Ziffern von ${a} sind aufgebraucht, aber es bleibt Rest ${r}. Also: Komma ins Ergebnis und eine Null anhängen` : `Wieder eine Null anhängen`} — weiter mit ${teil}.`
      : `Die nächste Ziffer ${ziffern[i]} herunterholen: weiter mit ${teil}.`;
    schritte.push(n3); jetzt = n3;
    i++;
  }
  const fertig = klon(jetzt);
  let ergebnis: string;
  if (nk) {
    // Periode markieren: die letzten (nk − periodeAb) Ziffern
    const ganzStellen = qZellen.length - nk;
    const dez = `${q},${nachDigits.join("")}`;
    if (periodeAb !== null) {
      const ab = ganzStellen + periodeAb;
      fertig.zellen = fertig.zellen.map(z => (z.r === 0 && z.art === "ergebnis" && z.c >= cQ + ab ? { ...z, strich: true } : z));
      const p = nachDigits.slice(periodeAb).join("");
      ergebnis = `${q},${nachDigits.slice(0, periodeAb).join("")}${p} (Periode ${p})`;
      fertig.text = `Der Rest ${(() => { let r = rest; for (let x = 0; x < periodeAb; x++) r = (r * 10) % b; return r; })()} kam schon einmal vor — ab hier wiederholt sich alles. ${a} : ${b} = ${q},${nachDigits.slice(0, periodeAb).join("")}${p} mit Periode ${p} (Strich darüber).`;
    } else if (nk >= (opts.nachkomma ?? 0) && nk > 0 && (() => { let r = rest; for (let x = 0; x < nk; x++) r = (r * 10) % b; return r !== 0; })()) {
      ergebnis = `${dez}…`;
      fertig.text = `Nach ${nk} Nachkommastellen hören wir auf: ${a} : ${b} ≈ ${dez}…`;
    } else {
      ergebnis = dez;
      fertig.ketten = [{ titel: "Probe", kaesten: [dez, String(a)], boegen: [{ text: `· ${b}`, art: "mal" }] }];
      fertig.text = `Der Rest ist 0 — fertig: ${a} : ${b} = ${dez}. Probe: ${dez} · ${b} = ${a}.`;
    }
  } else {
    // Rest: »R« und jede Ziffer des Rests in ihrem eigenen Kästchen
    if (rest) fertig.zellen.push({ r: 0, c: cQ + qStelle + 1, t: "R", art: "zeichen", neu: true },
      ...zahlZellen(rest, 0, cQ + qStelle + 1 + String(rest).length, "ergebnis").map(z => ({ ...z, neu: true })));
    fertig.ketten = [{ titel: "Probe", kaesten: rest ? [String(q), String(q * b), String(a)] : [String(q), String(a)],
      boegen: rest ? [{ text: `· ${b}`, art: "mal" }, { text: `+ ${rest}`, art: "plus" }] : [{ text: `· ${b}`, art: "mal" }] }];
    fertig.text = `Ergebnis: ${a} : ${b} = ${q}${rest ? ` Rest ${rest}` : ""}. Probe: ${q} · ${b}${rest ? ` + ${rest}` : ""} = ${a}.`;
    ergebnis = `${q}${rest ? ` R ${rest}` : ""}`;
  }
  schritte.push(fertig);
  const hoehe = Math.max(...fertig.zellen.map(z => z.r)) + 1;
  return { op: ":", breite: cQ + qStelle + 2 + (nk ? 0 : String(rest).length + 1), hoehe, schritte, ergebnis };
}

// ── Subtrahieren (Abziehen mit Entbündeln) ───────────────────────────

/** Alternative zum Ergänzen: oben minus unten, fehlt etwas, wird links entbündelt. */
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
    n.zellen.push({ r: rE, c, t: String(d), art: "ergebnis", neu: true, ab: "walze" });
    n.text = `${stellenName(e)}: ${oben[e]} − ${unten} = ${d}. Schreibe ${d}.`;
    schritte.push(n); jetzt = n;
  }
  const ende = klon(jetzt);
  ende.text = `Ergebnis: ${a} − ${b} = ${a - b}. Probe: ${a - b} + ${b} = ${a}.`;
  schritte.push(ende);
  return { op: "−", breite: rechts + 1, hoehe: rE + 1, schritte, ergebnis: String(a - b), einer: rechts };
}

export function rechne(op: Op, a: number, b: number, methode: Methode = "ergaenzen"): Ablauf {
  return op === "+" ? addiere([a, b]) : op === "−" ? (methode === "ergaenzen" ? subtrahiereErgaenzen(a, b) : subtrahiere(a, b))
    : op === "·" ? multipliziere(a, b) : dividiere(a, b);
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
    // nur Überträge in eine Spalte, in der schon eine Zahl steht — sonst fehlte im falschen Ergebnis eine ganze Stelle
    for (let e = 0; 10 ** (e + 1) <= Math.max(a, b); e++) {
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
      return { falsch, exp: abweichung(a - b, falsch), grund: `Bei den ${stellenName(e)}n: ${o} − ${u} geht nicht. Statt mit Übertrag zu rechnen (bzw. zu entbündeln), wurde einfach ${u} − ${o} gerechnet.` };
    }
  }
  return null;
}
