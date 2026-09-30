/**
 * Der Rundenmotor: eine Runde = zwei Jahre.
 *
 * Reihenfolge: Budget → Investitionen → Wirkungsgefüge → Eigendynamik
 * (Klima, Desinformation, Autokrat, Leviathan-Zone) → Bevölkerung →
 * Ereignisse → Wahl → Kipppunkte → Lebensqualität → Bilanz.
 * Alles ist deterministisch bei gleichem Seed und gleicher Verteilung.
 */
import { EREIGNIS, EREIGNISSE, anwenden, machtuebernahme, type Ereignis } from "./ereignisse";
import { BEREICH } from "./bereiche";
import { altAnteil, erwerbAnteil, gesamt, klemme, mio, n, zufall } from "./hilfen";
import { TYP } from "./laender";
import { REGELN } from "./regeln";
import {
  FOLGEN, GROESSEN, HEBEL, type Einstellungen, type Groesse, type Hebel, type Meldung,
  type Schnappschuss, type Schritt, type TypId, type Verteilung, type Werte, type Zone, type Zustand,
} from "./typen";

export const STARTJAHR = 2026;
export const MAX_KREDIT = 4;
const KIPPPUNKTE = [65, 78, 90];

/** Die feste Krisenkaskade der Stufe »Zusammenbruch«. */
export const ZUSAMMENBRUCH_DREHBUCH: { runde: number; ereignis: string }[] = [
  { runde: 2, ereignis: "bankenkrise" },
  { runde: 3, ereignis: "fakenews" },
  { runde: 4, ereignis: "deepfake" },
  { runde: 4, ereignis: "autokrat" },
  { runde: 5, ereignis: "gerichte" },
  { runde: 6, ereignis: "medienkauf" },
  { runde: 7, ereignis: "energiepreis" },
  { runde: 8, ereignis: "hitzewelle" },
  { runde: 9, ereignis: "schuldenkrise" },
  { runde: 10, ereignis: "proteste" },
];

const NEG_FAKTOR = { ruhig: 0.3, normal: 0.6, stuermisch: 1.2, zusammenbruch: 1 } as const;
const POS_FAKTOR = { ruhig: 1.2, normal: 1, stuermisch: 0.7, zusammenbruch: 0.5 } as const;
const MAX_NEG = { ruhig: 1, normal: 2, stuermisch: 3, zusammenbruch: 3 } as const;

export function kipppunkte(einst: Einstellungen): number[] {
  if (einst.krise === "ruhig") return [];
  if (einst.krise === "stuermisch" || einst.krise === "zusammenbruch") return KIPPPUNKTE.map((k) => k - 8);
  return KIPPPUNKTE;
}

// ── Leviathan ─────────────────────────────────────────────────────

export interface Leviathan {
  staat: number;
  gesellschaft: number;
  /** Staat minus Gesellschaft, −100…+100. */
  position: number;
  /** Halbe Breite des Korridors. */
  breite: number;
  zone: Zone;
}

export function leviathan(w: Werte): Leviathan {
  const staat = w.staatskapazitaet;
  const gesellschaft = (w.demokratie + w.zusammenhalt + (100 - w.desinformation)) / 3;
  const position = staat - gesellschaft;
  // Je stärker beide Seiten, desto enger der Korridor (»Rote Königin«).
  const breite = 15 - 7 * Math.min(staat, gesellschaft) / 100;
  const zone: Zone = staat < 25 || position < -breite ? "abwesend" : position > breite ? "despotisch" : "gefesselt";
  return { staat, gesellschaft, position, breite, zone };
}

// ── Budget ────────────────────────────────────────────────────────

export interface Budget {
  steuern: number;
  rohstoff: number;
  rente: number;
  zinsen: number;
  korrektur: number;
  wiederaufbau: number;
  gesamt: number;
}

export function budget(z: Zustand): Budget {
  const t = TYP[z.typ];
  const steuern = 3 + (z.w.wirtschaft / 100) * 14 * (erwerbAnteil(z.bev) / 0.6) * (0.7 + 0.3 * z.w.staatskapazitaet / 100);
  // Die Welt steigt langsam auf Erneuerbare um – Rohstoffeinnahmen schrumpfen.
  const rohstoff = t.rohstoff * 10 * Math.max(0.3, 1 - z.runde * 0.04);
  const rente = Math.max(0, z.bev.alt / z.bev.erwerb - 0.15) * 10;
  const zinsen = z.schulden * 0.08;
  const roh = steuern + rohstoff - rente - zinsen + z.apKorrektur;
  const wiederaufbau = z.status === "wiederaufbau" ? -Math.round(roh * 0.4) : 0;
  return {
    steuern, rohstoff, rente, zinsen, korrektur: z.apKorrektur, wiederaufbau,
    gesamt: Math.max(2, Math.round(roh + wiederaufbau)),
  };
}

/** Wie viel ein Aktionspunkt bewirkt: Korruption und schwacher Staat fressen mit. */
export function effizienz(z: Zustand): number {
  const zone = leviathan(z.w).zone;
  const zf = zone === "despotisch" ? 1.15 : zone === "abwesend" ? 0.85 : 1;
  return (1 - z.w.korruption / 300) * (0.7 + 0.3 * z.w.staatskapazitaet / 100) * zf;
}

/** Abnehmender Ertrag: 1 AP ≈ +5, 3 AP ≈ +12, 6 AP ≈ +18 (vor Effizienz). */
export const ertrag = (ap: number) => (6 * ap) / (1 + ap / 6);

/** Lernkurve: die ersten Anlagen sind teuer, jede weitere wird billiger. */
export const lernfaktor = (kumuliert: number) => 0.7 + 0.8 * (kumuliert / (kumuliert + 30));

// ── Neues Spiel ───────────────────────────────────────────────────

export function neuesSpiel(typ: TypId, einst: Einstellungen, seed = Date.now() % 2147483647, land?: string): Zustand {
  const t = TYP[typ];
  const z: Zustand = {
    typ, land: land?.trim() || t.landname, einst: { ...einst }, seed, rng: seed, runde: 0,
    w: { ...t.start }, bev: { ...t.bev }, lq: 0, lqSchock: 0, schulden: t.schulden, energieKumuliert: 0,
    regierung: { autokrat: t.autokrat, seit: 0, geschlossen: t.geschlossen },
    kipppunkte: [], gesperrt: {}, laufend: [], apKorrektur: 0,
    letzteFinanzkrise: -99, letzteKrise: -99, letzteKatastrophe: -99, deepfake: false,
    kritisch: 0, status: "laeuft", zusammenbruch: null, verlauf: [], meldungen: [], gewesen: [],
  };
  z.lq = lebensqualitaet(z);
  z.verlauf.push(schnappschuss(z, budget(z).gesamt));
  return z;
}

/** Woraus sich die Lebensqualität zusammensetzt (Klima geht umgekehrt ein). */
export const LQ_TEILE: [Groesse, number][] = [
  ["wirtschaft", 0.2], ["soziales", 0.2], ["zusammenhalt", 0.15], ["gleichheit", 0.1],
  ["klima", 0.1], ["vertrauen", 0.08], ["demokratie", 0.1], ["bildung", 0.07],
];

export function lebensqualitaet(z: Zustand): number {
  const basis = LQ_TEILE.reduce((s, [g, gew]) => s + gew * (g === "klima" ? 100 - z.w.klima : z.w[g]), 0);
  return klemme(basis + z.lqSchock);
}

function schnappschuss(z: Zustand, ap: number): Schnappschuss {
  const l = leviathan(z.w);
  return {
    runde: z.runde, jahr: STARTJAHR + 2 * z.runde, w: { ...z.w }, lq: z.lq, bev: { ...z.bev },
    position: l.position, zone: l.zone, ap, schulden: z.schulden, autokrat: z.regierung.autokrat,
    schleifen: aktiveSchleifen(z),
  };
}

// ── Eine Runde ────────────────────────────────────────────────────

export function leereVerteilung(): Verteilung {
  return { wirtschaft: 0, energie: 0, bildung: 0, soziales: 0, rechtsstaat: 0, familie: 0, kredit: 0 };
}

export function verteilt(v: Verteilung): number {
  return HEBEL.reduce((s, h) => s + v[h], 0);
}

export function runde(alt: Zustand, v: Verteilung): Zustand {
  if (alt.status === "fertig" || alt.status === "zusammengebrochen") return alt;
  const z: Zustand = structuredClone(alt);
  const t = TYP[z.typ];
  const b = budget(z);
  const kredit = Math.max(0, Math.min(MAX_KREDIT, Math.round(v.kredit)));
  const verfuegbar = b.gesamt + kredit;
  const summe = verteilt(v);
  if (summe > verfuegbar) throw new Error(`Zu viele Aktionspunkte verteilt: ${summe} > ${verfuegbar}`);
  for (const h of HEBEL) if (v[h] > 0 && (z.gesperrt[h] ?? 0) > 0) throw new Error(`${h} ist gesperrt`);
  z.schulden = Math.max(0, z.schulden + kredit - (verfuegbar - summe));
  z.apKorrektur = 0;

  // Der Rechenweg: jede Veränderung wird mit Grund und Quelle mitgeschrieben.
  const start = { ...z.w };
  const schritte: Schritt[] = [];
  let schritt: Schritt;
  const beginne = (id: string, titel: string, erklaerung: string) => {
    schritt = { id, titel, erklaerung, beitraege: [] };
    schritte.push(schritt);
  };
  const d: Werte = Object.fromEntries(GROESSEN.map((g) => [g, 0])) as Werte;
  /** Beitrag in die Summe dieser Runde (wird gemeinsam mit Trägheit angewandt). */
  const plus = (nach: Groesse, wert: number, grund: string, von?: string, quelle?: string) => {
    if (Math.abs(wert) < 1e-9) return;
    d[nach] += wert;
    schritt.beitraege.push({ nach, wert, grund, von, quelle });
  };
  /** Führt eine Änderung direkt aus und schreibt den Unterschied mit. */
  const direkt = (grund: string, von: string | undefined, quelle: string | undefined, f: () => void) => {
    const vor = { ...z.w };
    f();
    for (const g of GROESSEN) {
      const diff = z.w[g] - vor[g];
      if (Math.abs(diff) > 1e-9) schritt.beitraege.push({ nach: g, wert: diff, grund, von, quelle });
    }
  };

  beginne("budget", "Haushalt", "Aus Steuern, Rohstoffen, Renten und Zinsen ergeben sich die Aktionspunkte dieser Runde.");
  schritt!.details = [
    `Steuern: 3 + Wirtschaft ${Math.round(z.w.wirtschaft)} × Erwerbstätige × Staatskapazität = ${b.steuern.toFixed(1)}`,
    ...(b.rohstoff > 0.05 ? [`Rohstoffe: + ${b.rohstoff.toFixed(1)}`] : []),
    ...(b.rente > 0.05 ? [`Renten (${Math.round((z.bev.alt / z.bev.erwerb) * 100)} Ältere je 100 Erwerbstätige): − ${b.rente.toFixed(1)}`] : []),
    ...(b.zinsen > 0.05 ? [`Zinsen auf ${alt.schulden} Schulden: − ${b.zinsen.toFixed(1)}`] : []),
    ...(b.korrektur ? [`Ereignisse der letzten Runde: ${b.korrektur > 0 ? "+" : "−"} ${Math.abs(b.korrektur)}`] : []),
    ...(b.wiederaufbau ? [`Wiederaufbau: − ${Math.abs(b.wiederaufbau)}`] : []),
    `= ${b.gesamt} Aktionspunkte${kredit ? ` + ${kredit} Kredit` : ""}; verteilt: ${summe}`,
  ];

  // 1. Investitionen mit abnehmendem Ertrag
  const eff = effizienz(z);
  beginne("investition", "Deine Investitionen",
    `Jeder Aktionspunkt wirkt zu ${Math.round(eff * 100)} % (Korruption und Staatskapazität). Jeder weitere Punkt bringt weniger, und je höher ein Bereich schon ist, desto weniger.`);
  for (const h of HEBEL) {
    if (v[h] <= 0) continue;
    let wert = ertrag(v[h]) * eff;
    let zusatz = "";
    if (h === "energie") {
      const lf = lernfaktor(z.energieKumuliert);
      wert *= lf;
      zusatz = `, Lernkurve × ${lf.toFixed(2)}`;
      z.energieKumuliert += v[h];
    }
    // Je höher ein Bereich schon ist, desto weniger bringt jeder weitere Punkt.
    wert *= Math.max(0.15, 1.1 - z.w[h] / 100);
    plus(h, wert, `${v[h]} Aktionspunkt${v[h] > 1 ? "e" : ""}${zusatz}`, "aktionspunkte", h === "energie" ? "way2022" : undefined);
  }
  const investiert = { ...d };

  // 2. Wirkungsgefüge (mit Verzögerung aus dem Verlauf)
  beginne("wirkung", "Wirkungsgefüge",
    "Jeder Bereich wirkt auf andere: über 50 schiebt er in Pfeilrichtung, unter 50 zieht er dagegen. Manche Wirkungen kommen erst Jahre später an.");
  for (const r of REGELN) {
    const idx = Math.max(0, z.verlauf.length - 1 - r.verzoegerung);
    const quelle = r.verzoegerung === 0 ? z.w : z.verlauf[idx].w;
    let x = n(quelle[r.von]);
    if (r.nurUeber50) x = Math.max(0, x);
    const k = r.von === "klima" && t.kueste ? 2 : 1;
    const wann = r.verzoegerung ? ` vor ${r.verzoegerung * 2} Jahren` : "";
    plus(r.nach, r.staerke * x * k, `${BEREICH[r.von].name}${wann} bei ${Math.round(quelle[r.von])}${k > 1 ? " (Küste: doppelt)" : ""}`, r.von, r.quelle);
  }
  // Arbeitslosigkeit kostet Vertrauen in die Institutionen (Algan 2017) – gemessen an der letzten Runde.
  const vorletzte = z.verlauf[z.verlauf.length - 2]?.w.wirtschaft ?? z.w.wirtschaft;
  const einbruch = Math.min(0, z.w.wirtschaft - vorletzte);
  plus("vertrauen", 0.35 * einbruch, `Wirtschaft ist um ${Math.round(-einbruch)} geschrumpft (Arbeitslosigkeit)`, "wirtschaft", "algan2017");

  // 3. Eigendynamik
  beginne("eigen", "Eigendynamik",
    "Was ohne dein Zutun passiert: Bereiche verfallen ohne Pflege, Werte kehren zur Mitte zurück, Klima und Desinformation haben eigenen Schwung.");
  for (const h of HEBEL) plus(h, -0.07 * (z.w[h] - 10), "Verfall ohne Pflege");
  for (const f of FOLGEN) if (f !== "klima") plus(f, -0.02 * (z.w[f] - 50), "kehrt langsam zur Mitte zurück");
  plus("wirtschaft", 0.5, "technischer Fortschritt");

  // Klima: eigene Emissionen minus Wende plus Welttrend, Kipppunkte schieben nach.
  plus("klima", t.klimaGewicht * (z.w.wirtschaft / 100) * (1 - z.w.energie / 100) * 5, "eigene Emissionen (Wirtschaft ohne Energiewende)", "wirtschaft", "armstrongMcKay2022");
  plus("klima", -t.klimaGewicht * (z.w.energie / 100) * 2.5, "Energiewende senkt Emissionen", "energie", "way2022");
  const welt = Math.max(0.2, 0.9 - 0.02 * z.runde) + (z.einst.krise === "stuermisch" ? 0.5 : 0);
  plus("klima", welt, "weltweiter Trend (die anderen Länder)", undefined, "armstrongMcKay2022");
  plus("klima", -0.6, "Natur nimmt einen Teil auf");
  plus("klima", 0.4 * z.kipppunkte.length, "überschrittene Kipppunkte heizen nach", undefined, "armstrongMcKay2022");

  // Desinformation wächst von selbst (Vosoughi), KI macht Fälschungen billig (WEF).
  plus("desinformation", 0.015 * z.w.desinformation, "Falschmeldungen verbreiten sich von selbst", "desinformation", "vosoughi2018");
  plus("desinformation", z.runde >= 3 ? 0.3 : 0.1, "KI macht Fälschungen billiger", undefined, "wef2025");

  // Autokrat: Demokratie und Pressefreiheit bröckeln, die Wirtschaft leidet langsam (Funke 2023).
  if (z.regierung.autokrat) {
    plus("demokratie", -1.5, "Autokrat baut Kontrollen ab", "autokrat", "vdem2026");
    plus("korruption", 1.5, "Autokrat: Vetternwirtschaft", "autokrat", "vdem2026");
    plus("desinformation", 1, "Autokrat: Staatspropaganda", "autokrat", "vdem2026");
    plus("staatskapazitaet", 1, "Autokrat setzt schnell durch", "autokrat", "korridor");
    if (z.runde - z.regierung.seit >= 1) plus("wirtschaft", -0.8, "populistische Wirtschaftspolitik", "autokrat", "funke2023");
  }

  // Leviathan-Zone
  const zone = leviathan(z.w).zone;
  if (zone === "gefesselt") {
    plus("wirtschaft", 1, "im Korridor: Staat und Gesellschaft im Gleichgewicht", "leviathan", "korridor");
    plus("vertrauen", 1, "im Korridor: Staat und Gesellschaft im Gleichgewicht", "leviathan", "korridor");
  }
  if (zone === "despotisch") plus("korruption", 1.5, "despotischer Staat: niemand kontrolliert", "leviathan", "korridor");

  // Laufende Wirkungen
  for (const l of z.laufend) for (const [g, x] of Object.entries(l.wirkung) as [Groesse, number][]) plus(g, x, `läuft noch nach: ${l.titel}`, l.id);
  z.laufend = z.laufend.map((l) => ({ ...l, runden: l.runden - 1 })).filter((l) => l.runden > 0);

  // Trägheit an den Rändern: Gesellschaften kippen selten ganz auf 0 oder 100.
  // Nur die Eigendynamik wird gedämpft, nicht die eigenen Investitionen.
  beginne("traegheit", "Trägheit und Grenzen",
    "Nahe 0 und 100 bremsen Gesellschaften: Was von selbst passiert, wirkt dort schwächer. Kein Wert fällt unter 0 oder steigt über 100, und über einem Kipppunkt bleibt die Klimalast.");
  const summeVorher = { ...z.w };
  for (const g of GROESSEN) {
    const rest = d[g] - investiert[g];
    const w = z.w[g];
    const daempf = rest > 0 ? Math.min(1, 2 * (100 - w) / 100) : Math.min(1, 2 * w / 100);
    z.w[g] = klemme(w + investiert[g] + rest * daempf);
  }
  for (const k of z.kipppunkte) z.w.klima = Math.max(z.w.klima, k);
  for (const g of GROESSEN) {
    const korrektur = z.w[g] - summeVorher[g] - d[g];
    if (Math.abs(korrektur) > 1e-9) {
      schritt!.beitraege.push({ nach: g, wert: korrektur, grund: korrektur > 0 && g === "klima" && z.kipppunkte.length ? "Kipppunkt: sinkt nicht mehr darunter" : "gebremst nahe 0 bzw. 100" });
    }
  }

  // 4. Bevölkerung (zwei Jahre)
  beginne("bevoelkerung", "Bevölkerung", "Geburten, Älterwerden, Sterbefälle und Wanderung in zwei Jahren.");
  schritt!.details = bevoelkerung(z);

  // Sperren laufen ab
  for (const h of HEBEL) if (z.gesperrt[h]) z.gesperrt[h] = Math.max(0, (z.gesperrt[h] ?? 0) - 1);

  z.runde += 1;

  // 5. Ereignisse
  beginne("ereignisse", "Ereignisse", "Schocks und gute Nachrichten. Die meisten werden wahrscheinlicher, wenn das Land sie »vorbereitet« hat, und ein Bereich federt sie ab.");
  const meldungen = z.meldungen;
  for (const e of ereignisseDerRunde(z)) {
    if (e.id === "autokrat" && z.regierung.autokrat) continue;
    direkt(`${e.icon} ${e.titel}`, e.id, e.quelle, () => { meldungen.push(anwenden(z, e)); });
  }

  // 6. Wahl alle zwei Runden (vier Jahre)
  beginne("wahl", "Wahl", z.runde % 2 === 0
    ? `Alle vier Jahre wird gewählt. ${z.regierung.autokrat ? `Chance auf Abwahl des Autokraten: ${Math.round(abwahlChance(z) * 100)} %.` : `Chance, dass ein Populist gewinnt: ${Math.round(populismusChance(z) * 100)} % – aus Vertrauen, Gleichheit, Desinformation, Krisen und Deepfakes.`}`
    : "In dieser Runde wird nicht gewählt.");
  if (z.runde % 2 === 0) {
    direkt("🗳️ Wahlergebnis", "wahl", "funke2016", () => {
      const m = wahl(z);
      if (m) meldungen.push(m);
    });
  }

  // 7. Kipppunkte
  for (const k of kipppunkte(z.einst)) {
    if (z.w.klima >= k && !z.kipppunkte.includes(k)) {
      z.kipppunkte.push(k);
      const e = EREIGNIS.kipppunkt;
      meldungen.push({ runde: z.runde, ereignis: e.id, titel: e.titel, text: e.text, icon: e.icon, quelle: e.quelle,
        folgen: `Die Klimalast kann nicht mehr unter ${k} sinken und steigt jede Runde etwas schneller.` });
    }
  }

  // 8. Lebensqualität, Bilanz
  for (const g of GROESSEN) z.w[g] = klemme(z.w[g]);
  z.lqSchock *= 0.5;
  z.lq = lebensqualitaet(z);
  z.verlauf.push(schnappschuss(z, b.gesamt));
  z.rechnung = {
    runde: z.runde, start, ende: { ...z.w }, schritte,
    lq: LQ_TEILE.map(([g, gewicht]) => ({ name: BEREICH[g].name, gewicht, wert: g === "klima" ? 100 - z.w.klima : z.w[g] })),
    lqSchock: z.lqSchock,
  };

  // 9. Zusammenbruch oder Ende
  if (z.status === "laeuft") {
    const kritisch = z.lq <= 12 || z.w.staatskapazitaet <= 5 || (z.w.vertrauen <= 5 && z.w.zusammenhalt <= 15);
    z.kritisch = kritisch ? z.kritisch + 1 : 0;
    if (z.kritisch >= 2) {
      z.status = "zusammengebrochen";
      z.zusammenbruch = z.runde;
      return z;
    }
  }
  if (z.runde >= z.einst.runden) z.status = "fertig";
  return z;
}

/** Nach dem Zusammenbruch weiterspielen – mit wenigen Aktionspunkten. */
export function wiederaufbau(alt: Zustand): Zustand {
  if (alt.status !== "zusammengebrochen" || alt.runde >= alt.einst.runden) return alt;
  return { ...structuredClone(alt), status: "wiederaufbau", kritisch: 0 };
}

function bevoelkerung(z: Zustand): string[] {
  const t = TYP[z.typ];
  const b = z.bev;
  const jungAnteil = b.jung / gesamt(b);
  const geburten = 0.0213 * b.tfr * (b.erwerb + 0.25 * b.jung);
  const erwachsen = b.jung * 0.1 * (1.2 - jungAnteil);
  const rente = b.erwerb * 0.044 * (0.4 + 3 * altAnteil(b));
  const hitze = z.w.klima > 60 ? 1 + (z.w.klima - 60) / 200 : 1;
  const todAlt = b.alt * 0.13 * (1.15 - z.w.soziales / 200) * hitze;
  const todJung = b.jung * t.jungSterb * (1 - z.w.soziales / 100);
  const todErwerb = b.erwerb * 0.004;
  // Wer wirtschaftlich stark ist und integriert, zieht Menschen an.
  const wanderung = b.erwerb * 0.004 * (n(z.w.wirtschaft) + 0.5 * n(z.w.familie));
  b.jung = Math.max(0.01, b.jung + geburten - erwachsen - todJung);
  b.erwerb = Math.max(0.01, b.erwerb + erwachsen - rente - todErwerb + wanderung);
  b.alt = Math.max(0.01, b.alt + rente - todAlt);
  // Geburtenrate folgt der Bildung mit Verzögerung (Lutz 2014).
  const ziel = 1.15 + 6 * Math.exp(-z.w.bildung / 22) + t.tfrKorrektur + 0.3 * n(z.w.familie);
  const tfrAlt = b.tfr;
  b.tfr = Math.max(0.6, b.tfr + (ziel - b.tfr) * 0.15);
  const m = (x: number) => mio(x);
  return [
    `Geburten: ${tfrAlt.toFixed(2)} Kinder je Frau → ${m(geburten)}`,
    `Erwachsen geworden: ${m(erwachsen)} · in Rente gegangen: ${m(rente)}`,
    `Gestorben: ${m(todAlt + todJung + todErwerb)}${hitze > 1 ? " (Hitze erhöht die Sterblichkeit der Alten)" : ""}`,
    `Wanderung: ${wanderung >= 0 ? "+" : "−"} ${m(Math.abs(wanderung))} (Wirtschaft und Integration ziehen an)`,
    `Geburtenrate strebt mit Bildung ${Math.round(z.w.bildung)} zu ${ziel.toFixed(2)} → jetzt ${b.tfr.toFixed(2)} (Lutz 2014)`,
    `Bevölkerung: ${m(gesamt(b))} – davon ${Math.round(altAnteil(b) * 100)} % über 65`,
  ];
}

function ereignisseDerRunde(z: Zustand): Ereignis[] {
  const krise = z.einst.krise;
  const aus = new Set(z.einst.aus);
  const fest = [
    ...z.einst.drehbuch,
    ...(krise === "zusammenbruch" ? ZUSAMMENBRUCH_DREHBUCH : []),
  ].filter((d) => d.runde === z.runde && EREIGNIS[d.ereignis]).map((d) => EREIGNIS[d.ereignis]);

  const typisch = new Set(TYP[z.typ].typisch);
  const neg: Ereignis[] = [];
  const pos: Ereignis[] = [];
  // Feste Reihenfolge, damit gleiche Seeds gleiche Spiele ergeben.
  for (const e of EREIGNISSE) {
    if (e.nurDrehbuch || e.p <= 0 || aus.has(e.id)) continue;
    if (e.ab && z.runde < e.ab) continue;
    if (e.einmalig && z.gewesen.includes(e.id)) continue;
    if (fest.includes(e)) continue;
    let p = e.p * (e.wenn ? e.wenn(z) : 1) * (typisch.has(e.id) ? 2 : 1);
    if (e.id === "putsch" && leviathan(z.w).zone === "abwesend") p *= 2;
    p *= e.positiv ? POS_FAKTOR[krise] : NEG_FAKTOR[krise];
    if (p > 0 && zufall(z) < Math.min(0.9, p)) (e.positiv ? pos : neg).push(e);
  }
  // Höchstens so viele Schocks wie die Stufe erlaubt, dazu höchstens eine gute Nachricht.
  const gezogen = [...mischen(z, neg).slice(0, MAX_NEG[krise]), ...mischen(z, pos).slice(0, 1)];
  return [...fest, ...gezogen];
}

function mischen<T>(z: Zustand, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(zufall(z) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wahrscheinlichkeit, dass ein Populist/Autokrat die Wahl gewinnt. */
export function populismusChance(z: Zustand): number {
  const w = z.w;
  let p = 0.01
    + Math.max(0, 45 - w.vertrauen) / 100 * 0.5
    + Math.max(0, 45 - w.gleichheit) / 100 * 0.2
    + Math.max(0, w.desinformation - 40) / 100 * 0.25
    + (z.runde - z.letzteFinanzkrise <= 3 ? 0.2 : 0)
    + (z.runde - z.letzteKrise <= 2 ? 0.05 : 0)
    + (z.deepfake ? 0.15 * (1 - w.bildung / 150) : 0);
  p *= Math.sqrt(NEG_FAKTOR[z.einst.krise]);
  return Math.max(0.01, Math.min(0.9, p));
}

/** Wahrscheinlichkeit, dass ein amtierender Autokrat abgewählt wird. */
export function abwahlChance(z: Zustand): number {
  const w = z.w;
  const p = 0.2 + w.zusammenhalt / 200 + w.bildung / 300 + w.rechtsstaat / 300 - w.desinformation / 250
    - (z.runde - z.regierung.seit) * 0.015;
  return Math.max(0.03, Math.min(0.7, p));
}

function wahl(z: Zustand): Meldung | null {
  const basis = { runde: z.runde, ereignis: "wahl", quelle: "funke2016" };
  const r = z.regierung;
  if (r.geschlossen) {
    if (z.w.demokratie < 40) return null;
    z.regierung = { ...r, geschlossen: false, autokrat: false };
    return { ...basis, titel: "Erste freie Wahl", icon: "🗳️", positiv: true,
      text: "Das Land öffnet sich: Zum ersten Mal gibt es eine Wahl mit echter Auswahl.", folgen: "Ab jetzt wird alle vier Jahre gewählt." };
  }
  if (r.autokrat && z.w.demokratie < 20) {
    return { ...basis, titel: "Wahl ohne Wahl", icon: "🗳️",
      text: "Die Wahl findet statt, aber die Opposition ist ausgeschlossen, die Medien sind gleichgeschaltet.",
      folgen: "Der Autokrat bleibt. Unter Demokratie 20 sind Wahlen nicht mehr frei." };
  }
  // Im Drehbuch »Zusammenbruch« ist die Wahl der Runde 4 schon entschieden.
  if (z.meldungen.some((m) => m.runde === z.runde && m.ereignis === "autokrat")) return null;
  const deepfake = z.deepfake;
  z.deepfake = false;
  const wurf = zufall(z);
  if (r.autokrat) {
    const p = abwahlChance(z);
    if (wurf < p) {
      z.regierung = { ...r, autokrat: false };
      z.w.demokratie = klemme(z.w.demokratie + 6);
      z.w.vertrauen = klemme(z.w.vertrauen + 5);
      return { ...basis, titel: "Autokrat abgewählt", icon: "🗳️", positiv: true,
        text: "Trotz ungleicher Bedingungen gewinnt ein breites Oppositionsbündnis.",
        folgen: `Demokratie +6, Vertrauen +5. (Chance war ${Math.round(p * 100)} %.)` };
    }
    return { ...basis, titel: "Autokrat im Amt bestätigt", icon: "🗳️",
      text: "Die Regierung gewinnt erneut – mit Hilfe der Staatsmedien.",
      folgen: `Chance auf Abwahl war ${Math.round(p * 100)} %.` };
  }
  const p = populismusChance(z);
  if (wurf < p) {
    const satz = machtuebernahme(z);
    const e = EREIGNIS.autokrat;
    return { ...basis, titel: e.titel, icon: e.icon, text: e.text, quelle: "funke2023",
      folgen: `${satz} (Chance war ${Math.round(p * 100)} %${deepfake ? ", ein Deepfake hat nachgeholfen" : ""}.)` };
  }
  return { ...basis, titel: "Wahl: Die Mitte hält", icon: "🗳️", positiv: true,
    text: "Die Regierung wird bestätigt oder demokratisch abgelöst.",
    folgen: `Ein Populist hätte mit ${Math.round(p * 100)} % gewonnen.` };
}

// ── Auswertung ────────────────────────────────────────────────────

function aktiveSchleifen(z: Zustand): string[] {
  const w = z.w;
  const s: string[] = [];
  if (z.runde - z.letzteFinanzkrise <= 4 && (z.regierung.autokrat || w.vertrauen < 35)) s.push("R1");
  if (w.gleichheit < 40 && w.vertrauen < 40 && w.korruption > 45) s.push("R2");
  if (w.desinformation > 60 && w.vertrauen < 40) s.push("R3");
  if ((z.regierung.autokrat || z.regierung.geschlossen) && w.demokratie < 35 && w.korruption > 45) s.push("R4");
  if (z.energieKumuliert > 20 && w.energie > 55) s.push("R5");
  if (z.kipppunkte.length > 0) s.push("R6");
  if (z.bev.tfr < 2.1 && altAnteil(z.bev) > 0.22) s.push("B1");
  if (w.bildung > 65 && w.desinformation < 35) s.push("B2");
  if (w.zusammenhalt > 65) s.push("B3");
  if (w.demokratie > 70 && leviathan(w).zone === "gefesselt") s.push("B4");
  return s;
}

export interface Auswertung {
  punkte: number;
  lqSchnitt: number;
  korridorRunden: number;
  nachhaltigkeit: number;
  durchgehalten: number;
  /** Runde mit dem größten Einbruch der Lebensqualität. */
  wendepunkt: { runde: number; jahr: number; minus: number; meldungen: Meldung[] } | null;
  /** Wie oft jede Schleife aktiv war. */
  schleifen: { id: string; runden: number }[];
}

export function auswertung(z: Zustand): Auswertung {
  const v = z.verlauf.slice(1);
  const lqSchnitt = v.length ? v.reduce((s, x) => s + x.lq, 0) / v.length : z.lq;
  const korridorRunden = v.filter((x) => x.zone === "gefesselt").length;
  const tfrOk = z.bev.tfr >= 1.6 && z.bev.tfr <= 2.6 ? 10 : 0;
  const nachhaltigkeit = Math.round((100 - z.w.klima) / 2 + Math.max(0, 30 - z.schulden) + tfrOk);
  const punkte = Math.round(v.reduce((s, x) => s + x.lq, 0) + 15 * korridorRunden + nachhaltigkeit);
  let wendepunkt: Auswertung["wendepunkt"] = null;
  for (let i = 1; i < z.verlauf.length; i++) {
    const minus = z.verlauf[i - 1].lq - z.verlauf[i].lq;
    if (minus > 2 && (!wendepunkt || minus > wendepunkt.minus)) {
      const r = z.verlauf[i].runde;
      wendepunkt = { runde: r, jahr: z.verlauf[i].jahr, minus, meldungen: z.meldungen.filter((m) => m.runde === r) };
    }
  }
  const zaehler = new Map<string, number>();
  for (const x of v) for (const id of x.schleifen) zaehler.set(id, (zaehler.get(id) ?? 0) + 1);
  return {
    punkte, lqSchnitt, korridorRunden, nachhaltigkeit,
    durchgehalten: z.zusammenbruch ?? z.runde,
    wendepunkt,
    schleifen: [...zaehler.entries()].map(([id, runden]) => ({ id, runden })).sort((a, b) => b.runden - a.runden),
  };
}

export const istHebel = (g: Groesse): g is Hebel => (HEBEL as Groesse[]).includes(g);

/** Einstellungen aus der Sitzung lesen – alles Unbekannte fällt auf den Standard zurück. */
export function einstellungenAus(roh: unknown): Einstellungen | null {
  if (!roh || typeof roh !== "object" || !("krise" in roh)) return null;
  const r = roh as Record<string, unknown>;
  const stufen = ["ruhig", "normal", "stuermisch", "zusammenbruch"];
  const runden = Number(r.runden);
  return {
    krise: stufen.includes(String(r.krise)) ? (r.krise as Einstellungen["krise"]) : "normal",
    runden: Number.isInteger(runden) && runden >= 4 && runden <= 20 ? runden : 12,
    sichtbar: r.sichtbar !== false,
    aus: Array.isArray(r.aus) ? r.aus.filter((x): x is string => typeof x === "string" && !!EREIGNIS[x]) : [],
    drehbuch: Array.isArray(r.drehbuch)
      ? r.drehbuch.filter((d): d is { runde: number; ereignis: string } =>
          !!d && typeof d === "object" && Number.isInteger((d as { runde: unknown }).runde) && !!EREIGNIS[(d as { ereignis: string }).ereignis])
      : [],
  };
}
