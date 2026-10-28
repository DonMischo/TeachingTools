/**
 * Prozent- und Zinsrechnung — reine Rechnung, ohne Oberfläche.
 *
 * Begriffe wie im Unterricht: Grundwert G (das Ganze, 100 %), Prozentwert W
 * (der Anteil), Prozentsatz p (in %). Zinsen sind dieselbe Rechnung mit Zeit:
 * Kapital K = G, Zinssatz p, Zinsen Z = W.
 */
import { zahl } from "@/lib/groessen";

export type Gesucht = "W" | "G" | "p";

export const runde = (x: number, stellen = 2) => {
  const f = 10 ** stellen;
  return Math.round((x + Number.EPSILON) * f) / f;
};

/** Zahl auf Deutsch, höchstens `nk` Nachkommastellen, ohne Rechenrauschen. */
export const z = (x: number, nk = 2) => zahl(runde(x, nk));

/** Geldbetrag immer mit zwei Nachkommastellen. */
export function euro(x: number): string {
  const r = runde(x, 2);
  const [g, n] = Math.abs(r).toFixed(2).split(".");
  return (r < 0 ? "−" : "") + zahl(Number(g)) + "," + n + " €";
}

/** Die dritte Größe aus zweien. */
export function loese(gesucht: Gesucht, w: { G: number; W: number; p: number }): number {
  if (gesucht === "W") return (w.G * w.p) / 100;
  if (gesucht === "G") return (w.W * 100) / w.p;
  return (w.W / w.G) * 100;
}

export function ggt(a: number, b: number): number {
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** p % als gekürzter Bruch (nur für ganze und halbe Prozente). */
export function alsBruch(p: number): { zaehler: number; nenner: number } | null {
  const zehntel = Math.round(p * 10);
  if (Math.abs(zehntel - p * 10) > 1e-9) return null;
  const t = ggt(zehntel, 1000);
  return { zaehler: zehntel / t, nenner: 1000 / t };
}

/* ───────────────────────────────────────────────────────── Dreisatz ── */

/** Eine Zeile im Dreisatz: links Prozent, rechts der Wert. */
export type DreisatzZeile = { prozent: number; wert: number };
export type DreisatzSchritt = { op: ":" | "·"; zahl: number };

/**
 * Der Dreisatz in drei Zeilen — immer über »1«:
 *   W gesucht: 100 % ≙ G  → 1 % ≙ G/100   → p % ≙ W
 *   G gesucht: p % ≙ W    → 1 % ≙ W/p     → 100 % ≙ G
 *   p gesucht: 100 % ≙ G  → (100/G) % ≙ 1 → (W·100/G) % ≙ W
 */
export function dreisatz(gesucht: Gesucht, w: { G: number; W: number; p: number }) {
  if (gesucht === "W") {
    const zeilen: DreisatzZeile[] = [{ prozent: 100, wert: w.G }, { prozent: 1, wert: w.G / 100 }, { prozent: w.p, wert: (w.G * w.p) / 100 }];
    const schritte: DreisatzSchritt[] = [{ op: ":", zahl: 100 }, { op: "·", zahl: w.p }];
    return { zeilen, schritte };
  }
  if (gesucht === "G") {
    const zeilen: DreisatzZeile[] = [{ prozent: w.p, wert: w.W }, { prozent: 1, wert: w.W / w.p }, { prozent: 100, wert: (w.W * 100) / w.p }];
    const schritte: DreisatzSchritt[] = [{ op: ":", zahl: w.p }, { op: "·", zahl: 100 }];
    return { zeilen, schritte };
  }
  const zeilen: DreisatzZeile[] = [{ prozent: 100, wert: w.G }, { prozent: 100 / w.G, wert: 1 }, { prozent: (w.W * 100) / w.G, wert: w.W }];
  const schritte: DreisatzSchritt[] = [{ op: ":", zahl: w.G }, { op: "·", zahl: w.W }];
  return { zeilen, schritte };
}

/* ─────────────────────────────────────────────────────────── Zinsen ── */

/** Zinsen nach der deutschen kaufmännischen Methode: Jahr = 360 Tage, Monat = 30 Tage. */
export const zinsen = (K: number, p: number, tage = 360) => (K * p) / 100 * (tage / 360);

/** Kapital nach jedem Jahr mit Zinseszins: [K0, K1, …, Kn]. */
export function zinseszins(K0: number, p: number, n: number): number[] {
  const q = 1 + p / 100;
  return Array.from({ length: n + 1 }, (_, i) => K0 * q ** i);
}

/** Nach wie vielen Jahren verdoppelt sich das Kapital (aufgerundet)? */
export const verdopplung = (p: number) => (p > 0 ? Math.ceil(Math.log(2) / Math.log(1 + p / 100)) : Infinity);

/* ───────────────────────────────────────────────────────── Eingaben ── */

/** »12,5«, »12.5«, »1 200«, »48 €«, »15 %« → Zahl; sonst null. */
export function leseZahl(s: string): number | null {
  const t = s.replace(/[€%\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^-?\d*\.?\d+$/.test(t)) return null;
  return Number(t);
}

/* ─────────────────────────────────────────────────────────── Aufgaben ── */

export type AufgabenArt = "prozentwert" | "grundwert" | "prozentsatz" | "vermehrt" | "vermindert" | "zinsen" | "zinseszins";
export type Stufe = 1 | 2 | 3;

export const AUFGABEN_ARTEN: { id: AufgabenArt; label: string }[] = [
  { id: "prozentwert", label: "Prozentwert W" },
  { id: "grundwert", label: "Grundwert G" },
  { id: "prozentsatz", label: "Prozentsatz p" },
  { id: "vermehrt", label: "Erhöhen" },
  { id: "vermindert", label: "Rabatt / Senken" },
  { id: "zinsen", label: "Zinsen" },
  { id: "zinseszins", label: "Zinseszins" },
];

export type Aufgabe = {
  art: AufgabenArt;
  text: string;
  loesung: number;
  einheit: "€" | "%" | "" | string;
  /** Lösungsweg, Zeile für Zeile */
  weg: string[];
  /** erlaubte Abweichung beim Prüfen */
  toleranz: number;
};

type Rnd = () => number;
const wahl = <T,>(rnd: Rnd, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const ganz = (rnd: Rnd, a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

/** Prozentsätze je Stufe: erst die Merkprozente, dann ganze, dann krumme. */
function prozentsatz(rnd: Rnd, stufe: Stufe): number {
  if (stufe === 1) return wahl(rnd, [10, 20, 25, 50, 75, 5, 1, 30, 40]);
  if (stufe === 2) return wahl(rnd, [2, 3, 4, 6, 8, 12, 15, 16, 18, 24, 35, 45, 60, 65, 80, 85, 90]);
  return wahl(rnd, [2.5, 7.5, 12.5, 17.5, 19, 7, 13, 33, 1.5, 3.5, 4.5, 37.5]);
}

/** Ein Grundwert, für den p % eine »schöne« Zahl ergibt (ganz, bei Geld höchstens Cent). */
function grundwertZu(rnd: Rnd, p: number, stufe: Stufe, ganzzahlig: boolean, min = 20, bis?: number): number {
  const bruch = alsBruch(p)!;
  // G · zaehler / nenner soll ganz sein → G Vielfaches des Nenners
  const schritt = ganzzahlig ? bruch.nenner : Math.max(1, bruch.nenner / 100);
  const max = bis ?? Math.max(4 * min, stufe === 1 ? 400 : stufe === 2 ? 1200 : 5000);
  const von = Math.max(1, Math.ceil(min / schritt));
  const G = ganz(rnd, von, Math.max(von, Math.floor(max / schritt))) * schritt;
  return ganzzahlig ? Math.round(G) : runde(G, 2);
}

/** Satz zu »p % von G« über Leute oder Dinge, die man zählt. */
const MENSCHEN: ((G: string, p: string) => string)[] = [
  (G, p) => `Von den ${G} Schülerinnen und Schülern einer Schule kommen ${p} mit dem Bus.`,
  (G, p) => `Beim Sportfest waren ${G} Gäste. ${p} davon haben ein Getränk gekauft.`,
  (G, p) => `Der Sportverein hat ${G} Mitglieder, ${p} davon spielen Fußball.`,
  (G, p) => `In der Lostrommel liegen ${G} Lose. ${p} davon sind Gewinne.`,
  (G, p) => `Im Stadtpark stehen ${G} Bäume, ${p} davon sind Linden.`,
];
/** Dinge mit einer Preisspanne, damit kein Fahrrad 20 € und keine Jacke 900 € kostet. */
const DINGE = [
  { ding: "Eine Jacke", was: "kostet", min: 40, max: 250 },
  { ding: "Ein Fahrrad", was: "kostet", min: 200, max: 1500 },
  { ding: "Ein Tablet", was: "kostet", min: 150, max: 900 },
  { ding: "Ein Paar Turnschuhe", was: "kostet", min: 40, max: 200 },
  { ding: "Eine Klassenfahrt", was: "kostet pro Person", min: 100, max: 600 },
  { ding: "Ein Konzertticket", was: "kostet", min: 25, max: 160 },
];
const NAMEN = ["Mila", "Jonas", "Emre", "Lea", "Noah", "Sofia", "Ben", "Aylin"];

function dreisatzWeg(gesucht: Gesucht, w: { G: number; W: number; p: number }, einheit: string): string[] {
  const { zeilen, schritte } = dreisatz(gesucht, w);
  const e = (wert: number) => (!einheit ? "" : wert === 1 && einheit === "Punkte" ? " Punkt" : " " + einheit);
  const zeile = (r: DreisatzZeile) => `${ca(r.prozent)} % ≙ ${ca(r.wert)}${e(r.wert)}`;
  return [
    zeile(zeilen[0]),
    `${schritte[0].op} ${z(schritte[0].zahl, 4)} auf beiden Seiten:  ${zeile(zeilen[1])}`,
    `${schritte[1].op} ${z(schritte[1].zahl, 4)} auf beiden Seiten:  ${zeile(zeilen[2])}`,
  ];
}

/** Auf 4 Stellen gerundet, mit »≈«, wenn dabei etwas verloren geht. */
export const ca = (x: number) => (Math.abs(runde(x, 4) - x) > 1e-9 ? "≈ " : "") + z(x, 4);

export function erzeugeAufgabe(art: AufgabenArt, stufe: Stufe, rnd: Rnd = Math.random): Aufgabe {
  const name = wahl(rnd, NAMEN);
  switch (art) {
    case "prozentwert": {
      const p = prozentsatz(rnd, stufe);
      if (rnd() < 0.5) {
        const m = wahl(rnd, MENSCHEN), G = grundwertZu(rnd, p, stufe, true, 20, 2000), W = (G * p) / 100;
        return {
          art, einheit: "", loesung: W, toleranz: 0.01,
          text: `${m(z(G), `${z(p)} %`)} Wie viele sind das?`,
          weg: [`Gegeben: G = ${z(G)}, p = ${z(p)} %. Gesucht: W.`, ...dreisatzWeg("W", { G, W, p }, ""), `Formel: W = G · p : 100 = ${z(G)} · ${z(p)} : 100 = ${z(W)}`],
        };
      }
      const d = wahl(rnd, DINGE), G = grundwertZu(rnd, p, stufe, stufe < 3, d.min, d.max), W = (G * p) / 100;
      return {
        art, einheit: "€", loesung: W, toleranz: 0.011,
        text: `${d.ding} ${d.was} ${euro(G)}. ${name} bekommt ${z(p)} % Rabatt. Wie viel Euro spart ${name}?`,
        weg: [`Gegeben: G = ${euro(G)}, p = ${z(p)} %. Gesucht: W (die Ersparnis).`, ...dreisatzWeg("W", { G, W, p }, "€"), `Formel: W = G · p : 100 = ${euro(W)}`],
      };
    }
    case "grundwert": {
      const p = prozentsatz(rnd, stufe);
      const handy = rnd() >= 0.5;
      const G = grundwertZu(rnd, p, stufe, true, handy ? 100 : 20, handy ? 1200 : 1500), W = (G * p) / 100;
      if (!handy) {
        return {
          art, einheit: "", loesung: G, toleranz: 0.01,
          text: `${z(W)} Kinder einer Schule haben bei der Umfrage »Ja« angekreuzt. Das sind ${z(p)} % aller Kinder. Wie viele Kinder hat die Schule?`,
          weg: [`Gegeben: W = ${z(W)}, p = ${z(p)} %. Gesucht: G (alle = 100 %).`, ...dreisatzWeg("G", { G, W, p }, ""), `Formel: G = W · 100 : p = ${z(W)} · 100 : ${z(p)} = ${z(G)}`],
        };
      }
      return {
        art, einheit: "€", loesung: G, toleranz: 0.011,
        text: `${name} hat schon ${euro(W)} gespart. Das sind ${z(p)} % des Preises für ein neues Handy. Wie viel kostet das Handy?`,
        weg: [`Gegeben: W = ${euro(W)}, p = ${z(p)} %. Gesucht: G (der ganze Preis).`, ...dreisatzWeg("G", { G, W, p }, "€"), `Formel: G = W · 100 : p = ${euro(G)}`],
      };
    }
    case "prozentsatz": {
      const p = stufe === 1 ? wahl(rnd, [10, 20, 25, 50, 75, 40, 60, 80]) : stufe === 2 ? ganz(rnd, 1, 19) * 5 : wahl(rnd, [12.5, 37.5, 62.5, 87.5, 2.5, 7.5, 17.5, 35, 45, 85, 95]);
      // eine Klassenarbeit hat selten mehr als 120 Punkte
      const G = grundwertZu(rnd, p, stufe, true, 20, 120), W = (G * p) / 100;
      return {
        art, einheit: "%", loesung: p, toleranz: 0.051,
        text: `In der Mathearbeit konnte man ${z(G)} Punkte holen. ${name} hat ${z(W)} Punkte. Wie viel Prozent sind das?`,
        weg: [`Gegeben: G = ${z(G)}, W = ${z(W)}. Gesucht: p.`, ...dreisatzWeg("p", { G, W, p }, "Punkte"), `Formel: p = W : G · 100 = ${z(W)} : ${z(G)} · 100 = ${z(p)} %`],
      };
    }
    case "vermehrt": {
      const p = stufe === 1 ? wahl(rnd, [10, 20, 25, 50]) : stufe === 2 ? wahl(rnd, [5, 8, 12, 15, 30, 19]) : wahl(rnd, [2.5, 7, 19, 3.5, 12.5]);
      const d = wahl(rnd, DINGE);
      const G = grundwertZu(rnd, p, stufe, false, d.min, d.max), neu = G * (1 + p / 100);
      const q = 1 + p / 100;
      if (stufe === 3 && rnd() < 0.5) {
        return {
          art, einheit: "€", loesung: G, toleranz: 0.011,
          text: `Der Preis für ${d.ding.replace(/^Ein(e)? /, (_, e) => (e ? "eine " : "ein "))} wurde um ${z(p)} % erhöht und beträgt jetzt ${euro(neu)}. Wie hoch war er vorher?`,
          weg: [`Vorher = 100 %, jetzt = ${z(100 + p)} % ≙ ${euro(neu)}.`, `1 % ≙ ${euro(neu)} : ${z(100 + p)} = ${z(neu / (100 + p), 4)} €`, `100 % ≙ ${euro(G)}`, `Mit Faktor: ${euro(neu)} : ${z(q, 4)} = ${euro(G)}`],
        };
      }
      return {
        art, einheit: "€", loesung: neu, toleranz: 0.011,
        text: `${d.ding} ${d.was} ${euro(G)}. Der Preis steigt um ${z(p)} %. Wie viel kostet das jetzt?`,
        weg: [`Neu = 100 % + ${z(p)} % = ${z(100 + p)} % von ${euro(G)}.`, `Erhöhung: ${euro(G)} · ${z(p)} : 100 = ${euro(neu - G)}`, `Neuer Preis: ${euro(G)} + ${euro(neu - G)} = ${euro(neu)}`, `Kurz mit Faktor: ${euro(G)} · ${z(q, 4)} = ${euro(neu)}`],
      };
    }
    case "vermindert": {
      const p = stufe === 1 ? wahl(rnd, [10, 20, 25, 50]) : stufe === 2 ? wahl(rnd, [5, 15, 30, 40, 35, 12]) : wahl(rnd, [2.5, 3, 7.5, 12.5, 33]);
      const d = wahl(rnd, DINGE);
      const G = grundwertZu(rnd, p, stufe, false, d.min, d.max), neu = G * (1 - p / 100);
      const q = 1 - p / 100;
      if (stufe === 3 && rnd() < 0.5) {
        return {
          art, einheit: "€", loesung: G, toleranz: 0.011,
          text: `Nach ${z(p)} % Rabatt kostet ${d.ding.replace(/^E/, "e")} nur noch ${euro(neu)}. Wie viel hat das vorher gekostet?`,
          weg: [`Vorher = 100 %, nach dem Rabatt = ${z(100 - p)} % ≙ ${euro(neu)}.`, `1 % ≙ ${euro(neu)} : ${z(100 - p)} = ${z(neu / (100 - p), 4)} €`, `100 % ≙ ${euro(G)}`, `Mit Faktor: ${euro(neu)} : ${z(q, 4)} = ${euro(G)}`],
        };
      }
      return {
        art, einheit: "€", loesung: neu, toleranz: 0.011,
        text: `${d.ding} ${d.was} ${euro(G)}. Im Schlussverkauf gibt es ${z(p)} % Rabatt. Was kostet das jetzt?`,
        weg: [`Neu = 100 % − ${z(p)} % = ${z(100 - p)} % von ${euro(G)}.`, `Rabatt: ${euro(G)} · ${z(p)} : 100 = ${euro(G - neu)}`, `Neuer Preis: ${euro(G)} − ${euro(G - neu)} = ${euro(neu)}`, `Kurz mit Faktor: ${euro(G)} · ${z(q, 4)} = ${euro(neu)}`],
      };
    }
    case "zinsen": {
      const p = stufe === 1 ? wahl(rnd, [1, 2, 3, 4, 5]) : wahl(rnd, [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 6]);
      const K = stufe === 1 ? ganz(rnd, 1, 20) * 100 : ganz(rnd, 2, 60) * 100;
      if (stufe === 1) {
        const Z = zinsen(K, p);
        return {
          art, einheit: "€", loesung: Z, toleranz: 0.011,
          text: `${name} legt ${euro(K)} für ein Jahr zu einem Zinssatz von ${z(p)} % an. Wie viele Zinsen gibt es nach einem Jahr?`,
          weg: [`Kapital K = ${euro(K)} (= 100 %), Zinssatz p = ${z(p)} %.`, `Jahreszinsen Z = K · p : 100 = ${euro(K)} · ${z(p)} : 100 = ${euro(Z)}`],
        };
      }
      if (stufe === 2) {
        const m = wahl(rnd, [3, 4, 6, 8, 9]);
        const Z = zinsen(K, p, m * 30);
        return {
          art, einheit: "€", loesung: Z, toleranz: 0.011,
          text: `Auf einem Sparkonto liegen ${euro(K)} zu ${z(p)} % Zinsen im Jahr. Wie viele Zinsen gibt es für ${m} Monate?`,
          weg: [`Jahreszinsen: ${euro(K)} · ${z(p)} : 100 = ${euro(zinsen(K, p))}`, `Ein Monat: ${euro(zinsen(K, p))} : 12 = ${z(zinsen(K, p) / 12, 4)} €`, `${m} Monate: · ${m} = ${euro(Z)}`, `Formel: Z = K · p : 100 · m : 12`],
        };
      }
      const t = wahl(rnd, [45, 72, 90, 100, 120, 150, 200, 270]);
      const Z = zinsen(K, p, t);
      return {
        art, einheit: "€", loesung: Z, toleranz: 0.011,
        text: `Ein Kredit über ${euro(K)} läuft ${t} Tage zu ${z(p)} % Jahreszins. Wie viele Zinsen fallen an? (1 Jahr = 360 Tage)`,
        weg: [`Jahreszinsen: ${euro(K)} · ${z(p)} : 100 = ${euro(zinsen(K, p))}`, `Ein Tag: ${euro(zinsen(K, p))} : 360 = ${z(zinsen(K, p) / 360, 5)} €`, `${t} Tage: · ${t} = ${euro(Z)}`, `Formel: Z = K · p : 100 · t : 360`],
      };
    }
    case "zinseszins": {
      const p = stufe === 1 ? wahl(rnd, [2, 5, 10]) : wahl(rnd, [1.5, 2, 2.5, 3, 4, 6]);
      const n = stufe === 1 ? 2 : stufe === 2 ? ganz(rnd, 3, 5) : ganz(rnd, 6, 15);
      const K0 = ganz(rnd, 1, stufe === 1 ? 10 : 50) * 100;
      const reihe = zinseszins(K0, p, n);
      const q = 1 + p / 100;
      return {
        art, einheit: "€", loesung: reihe[n], toleranz: Math.max(0.011, reihe[n] * 0.001),
        text: `${name} legt ${euro(K0)} zu ${z(p)} % Zinsen an. Die Zinsen bleiben jedes Jahr auf dem Konto und werden mitverzinst. Wie viel Geld ist nach ${n} Jahren auf dem Konto?`,
        weg: [
          `Jedes Jahr: Kapital · ${z(q, 4)} (100 % + ${z(p)} %).`,
          ...reihe.slice(1, 6).map((k, i) => `nach ${i + 1} Jahr${i ? "en" : ""}: ${euro(k)}`),
          ...(n > 5 ? ["…"] : []),
          `Formel: K${n} = K0 · q^n = ${euro(K0)} · ${z(q, 4)}^${n} = ${euro(reihe[n])}`,
        ],
      };
    }
  }
}

export function pruefe(a: Aufgabe, eingabe: string): boolean | null {
  const x = leseZahl(eingabe);
  if (x === null) return null;
  return Math.abs(x - a.loesung) <= a.toleranz;
}

/* ─────────────────────────────────────────────────────────── Spiel ── */

/**
 * Wertung im Prozent-Blitz — so, dass blindes Klicken sich nicht lohnt:
 * - richtig: 10 + Serienbonus (bis 10); falsch: doppelt so viel abziehen (−20)
 * - »geklickt, bevor man lesen konnte« (unter SCHNELL_MS nach dem Erscheinen):
 *   richtig gibt nur die Hälfte, falsch kostet dreifach (−30)
 * - jede weitere hastige Antwort in Folge sperrt die nächste Aufgabe länger
 *   (SPERRE_JE je Mal, höchstens SPERRE_MAX); eine überlegte Antwort setzt das zurück.
 */
export const BLITZ = { punkte: 10, schnellMs: 500, sperreJe: 600, sperreMax: 3000 } as const;

export function blitzWertung(ok: boolean, ms: number, serie: number, hastig: number) {
  const schnell = ms < BLITZ.schnellMs;
  const neueSerie = ok ? serie + 1 : 0;
  const voll = BLITZ.punkte + Math.min(neueSerie - 1, 5) * 2;
  const plus = ok ? (schnell ? Math.floor(voll / 2) : voll) : -(schnell ? 3 : 2) * BLITZ.punkte;
  const neuHastig = schnell ? hastig + 1 : 0;
  const sperre = Math.min(BLITZ.sperreMax, neuHastig * BLITZ.sperreJe);
  return { plus, neueSerie, schnell, hastig: neuHastig, sperre };
}

export type Runde =
  | { art: "schaetzen"; p: number; bild: "kreis" | "streifen" | "feld"; optionen: number[]; richtig: number; erklaerung: string }
  | { art: "kopf"; frage: string; optionen: string[]; richtig: number; erklaerung: string }
  | { art: "schnaeppchen"; frage: string; optionen: string[]; preise: number[]; richtig: number; erklaerung: string };

function mische<T>(rnd: Rnd, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Vier Antworten, eine davon richtig; Rückgabe: Liste + Index der richtigen. */
function vierAus<T>(rnd: Rnd, richtig: T, falsche: T[]): { optionen: T[]; richtig: number } {
  const optionen = mische(rnd, [richtig, ...falsche.slice(0, 3)]);
  return { optionen, richtig: optionen.indexOf(richtig) };
}

export function erzeugeRunde(rnd: Rnd = Math.random): Runde {
  const r = rnd();
  if (r < 0.34) {
    const p = ganz(rnd, 1, 19) * 5;
    const falsche = new Set<number>();
    while (falsche.size < 3) {
      const f = ganz(rnd, 1, 19) * 5;
      if (Math.abs(f - p) >= 15) falsche.add(f);
    }
    const { optionen, richtig } = vierAus(rnd, p, [...falsche]);
    const bild = wahl(rnd, ["kreis", "streifen", "feld"] as const);
    return { art: "schaetzen", p, bild, optionen, richtig, erklaerung: `Gefärbt sind ${p} % — ${p >= 50 ? "mehr als die Hälfte" : p >= 25 ? "zwischen einem Viertel und der Hälfte" : "weniger als ein Viertel"}.` };
  }
  if (r < 0.67) {
    const [p, G] = wahl(rnd, [
      [10, wahl(rnd, [30, 70, 250, 480, 1200])], [50, wahl(rnd, [36, 90, 140, 512])], [25, wahl(rnd, [40, 84, 200, 360])],
      [75, wahl(rnd, [40, 80, 120, 400])], [20, wahl(rnd, [35, 60, 150, 450])], [1, wahl(rnd, [300, 700, 2500])],
      [5, wahl(rnd, [60, 80, 300, 420])], [200, wahl(rnd, [7, 15, 45])], [150, wahl(rnd, [20, 40, 60])], [12.5, wahl(rnd, [16, 40, 80])],
      [30, wahl(rnd, [20, 50, 90])], [15, wahl(rnd, [20, 40, 60, 200])],
    ] as [number, number][]);
    const W = (G * p) / 100;
    const kandidaten = [G / p, (G * p) / 10, G - p, W * 10, W / 10, W * 2, W + 5, G / 2].filter(x => x > 0 && Math.abs(x - W) > 1e-9);
    const falsche = [...new Set(kandidaten.map(x => z(x)))].filter(s => s !== z(W));
    const { optionen, richtig } = vierAus(rnd, z(W), mische(rnd, falsche));
    return { art: "kopf", frage: `${z(p)} % von ${z(G)}`, optionen, richtig, erklaerung: merkweg(p, G) };
  }
  const P = ganz(rnd, 4, 30) * 10;
  const varianten = [
    () => { const rp = wahl(rnd, [10, 20, 25, 30, 40, 50]); return { t: `${euro(P)} mit ${rp} % Rabatt`, preis: P * (1 - rp / 100) }; },
    () => { const x = wahl(rnd, [5, 10, 15, 20, 25, 30]); return { t: `${euro(P)} minus ${euro(x)}`, preis: P - x }; },
    () => { const P2 = P + wahl(rnd, [-30, -20, -10, 10, 20, 30]); const rp = wahl(rnd, [10, 20, 25, 50]); return { t: `${euro(P2)} mit ${rp} % Rabatt`, preis: P2 * (1 - rp / 100) }; },
    () => { const P2 = P - wahl(rnd, [10, 20, 30]); return { t: `${euro(P2)} ohne Rabatt`, preis: P2 }; },
  ];
  let a = wahl(rnd, varianten)(), b = wahl(rnd, varianten)();
  for (let i = 0; Math.abs(a.preis - b.preis) < 1 && i < 20; i++) b = wahl(rnd, varianten)();
  if (Math.abs(a.preis - b.preis) < 1) b = { t: `${euro(a.preis + 5)} ohne Rabatt`, preis: a.preis + 5 };
  const richtig = a.preis < b.preis ? 0 : 1;
  return {
    art: "schnaeppchen", frage: "Welches Angebot ist günstiger?",
    optionen: [a.t, b.t], preise: [a.preis, b.preis], richtig,
    erklaerung: `${a.t} = ${euro(a.preis)}, ${b.t} = ${euro(b.preis)}.`,
  };
}

/** Der schnellste Kopfrechenweg für die Merkprozente. */
export function merkweg(p: number, G: number): string {
  const W = z((G * p) / 100);
  const wege: Record<number, string> = {
    50: `50 % ist die Hälfte: ${z(G)} : 2 = ${W}`,
    25: `25 % ist ein Viertel: ${z(G)} : 4 = ${W}`,
    75: `75 % sind drei Viertel: ${z(G)} : 4 · 3 = ${W}`,
    10: `10 % ist ein Zehntel: ${z(G)} : 10 = ${W}`,
    20: `20 % ist ein Fünftel: ${z(G)} : 5 = ${W}`,
    1: `1 % ist ein Hundertstel: ${z(G)} : 100 = ${W}`,
    5: `5 % ist die Hälfte von 10 %: ${z(G / 10)} : 2 = ${W}`,
    200: `200 % ist das Doppelte: ${z(G)} · 2 = ${W}`,
    150: `150 % = 100 % + 50 %: ${z(G)} + ${z(G / 2)} = ${W}`,
    12.5: `12,5 % ist ein Achtel: ${z(G)} : 8 = ${W}`,
    30: `30 % = 3 · 10 %: ${z(G / 10)} · 3 = ${W}`,
    15: `15 % = 10 % + 5 %: ${z(G / 10)} + ${z(G / 20)} = ${W}`,
  };
  return wege[p] ?? `${z(p)} % von ${z(G)} = ${z(G)} · ${z(p)} : 100 = ${W}`;
}
