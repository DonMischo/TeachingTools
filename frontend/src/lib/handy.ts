/**
 * Handy-Check — was kostet ein Handy wirklich? Barzahlung, »0 %-Finanzierung«,
 * Ratenkauf mit Zinsen, »Handy für 1 € mit Vertrag« und Warten-und-Sparen,
 * jeweils mit Kleingedrucktem. Gerechnet wird, was das Handy selbst kostet
 * (ohne den Tarif, den man sowieso braucht) und wie das Konto über die Monate
 * aussieht.
 */
type Rnd = () => number;
const wahl = <T,>(rnd: Rnd, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const cent = (x: number) => Math.round(x * 100) / 100;

/** Ausgedachte Modelle — keine echten Marken. */
export const HANDYS = [
  { name: "Lumo Basic", emoji: "📱", preis: 199 },
  { name: "Pixo 8a", emoji: "📱", preis: 449 },
  { name: "Nova X", emoji: "📲", preis: 699 },
  { name: "Galaxis Pro", emoji: "📲", preis: 999 },
  { name: "Orbit 15 Max", emoji: "📲", preis: 1199 },
] as const;
export type Handy = (typeof HANDYS)[number];

export const PERSONEN = [
  { name: "Azubi im 1. Lehrjahr", emoji: "🧑‍🔧", erspart: [150, 250, 400], frei: [90, 120, 150] },
  { name: "Schülerin mit Minijob", emoji: "👩‍🎓", erspart: [100, 300, 500], frei: [40, 60, 80] },
  { name: "Student mit BAföG", emoji: "🧑‍💻", erspart: [200, 400, 700], frei: [50, 70, 100] },
  { name: "Berufseinsteigerin", emoji: "👩‍💼", erspart: [500, 900, 1300], frei: [150, 200, 250] },
] as const;

export type Person = { name: string; emoji: string; erspart: number; frei: number };

/** Tarif ohne Handy (SIM-only), monatlich kündbar — den braucht man in jedem Fall. */
export const SIM_ONLY = 9.99;
/** Wer wartet: Neupreis fällt nach einem Jahr um so viel. */
export const PREISFALL = 0.2;
/** Zeitraum für Konto und Vergleich */
export const MONATE = 36;

export type Angebot = {
  id: "bar" | "null" | "raten" | "vertrag";
  werbung: string;
  klein: string;
  /** sofort zu zahlen (Anzahlung, Gebühren, Barpreis) */
  sofort: number;
  raten: number;
  rate: number;
  /** Tarif pro Monat während der Laufzeit (Vertrag) bzw. SIM-only */
  tarif: number;
  laufzeit: number;
};

/** Monatsrate eines Ratenkredits mit effektivem Jahreszins (Annuität). */
export function annuitaet(betrag: number, effJahr: number, n: number): number {
  const i = (1 + effJahr / 100) ** (1 / 12) - 1;
  return i === 0 ? betrag / n : (betrag * i) / (1 - (1 + i) ** -n);
}

export function erzeugeAngebote(h: Handy, rnd: Rnd = Math.random): Angebot[] {
  const P = h.preis;
  const skonto = rnd() < 0.35 ? wahl(rnd, [3, 5]) : 0;
  const bar: Angebot = {
    id: "bar", sofort: cent(P * (1 - skonto / 100)), raten: 0, rate: 0, tarif: SIM_ONLY, laufzeit: 0,
    werbung: skonto ? `Sofort kaufen: ${skonto} % Rabatt bei Barzahlung!` : "Barpreis",
    klein: skonto ? `Statt ${P} € nur ${(P * (1 - skonto / 100)).toFixed(2).replace(".", ",")} € — Zahlung sofort, komplett.` : `${P} € auf einmal, sofort.`,
  };

  const gebuehr = wahl(rnd, [0, 19.99, 29.99, 39.99]);
  const schutz = rnd() < 0.4 ? wahl(rnd, [1.99, 2.49, 2.99]) : 0;
  const nullRate = Math.ceil((P / 24) * 100) / 100;
  const nullp: Angebot = {
    id: "null", sofort: gebuehr, raten: 24, rate: cent(nullRate + schutz), tarif: SIM_ONLY, laufzeit: 24,
    werbung: `0 % Finanzierung — nur ${fmt(nullRate)} € im Monat!`,
    klein: `24 Raten à ${fmt(nullRate)} €` + (gebuehr ? `, einmalige Bearbeitungsgebühr ${fmt(gebuehr)} €` : "")
      + (schutz ? `, Ratenschutz-Versicherung ${fmt(schutz)} € pro Monat (Pflicht)` : "") + ".",
  };

  const eff = wahl(rnd, [7.9, 9.9, 12.9, 14.9]);
  const n = wahl(rnd, [24, 36]);
  const rate = cent(annuitaet(P, eff, n));
  const raten: Angebot = {
    id: "raten", sofort: 0, raten: n, rate, tarif: SIM_ONLY, laufzeit: n,
    werbung: `Ohne Anzahlung — nur ${fmt(rate)} € im Monat!`,
    klein: `${n} Monatsraten, effektiver Jahreszins ${fmt(eff)} %.`,
  };

  // Vertrag: Tarifaufschlag deckt das Handy plus einen Gewinn des Anbieters
  const anz = P > 800 ? wahl(rnd, [49, 99]) : 1;
  const anschluss = 39.99;
  const aufschlag = ((P - anz) / 24) * wahl(rnd, [1.05, 1.15, 1.25, 1.35]);
  const tarif = Math.floor(SIM_ONLY + aufschlag) + 0.99;
  const vertrag: Angebot = {
    id: "vertrag", sofort: cent(anz + anschluss), raten: 0, rate: 0, tarif, laufzeit: 24,
    werbung: `${h.name} für nur ${anz} €*`,
    klein: `* nur mit Tarif für 24 Monate à ${fmt(tarif)} € (derselbe Tarif ohne Handy: ${fmt(SIM_ONLY)} €), einmaliger Anschlusspreis ${fmt(anschluss)} €.`,
  };
  return [bar, nullp, raten, vertrag];
}

const fmt = (x: number) => x.toFixed(2).replace(".", ",").replace(",00", "");

/** Was das Handy selbst kostet: alles, was man ohne Handy nicht zahlen würde. */
export function handyKosten(a: Angebot): number {
  return cent(a.sofort + a.raten * a.rate + a.laufzeit * (a.tarif - SIM_ONLY));
}

/** Kontostand am Ende jedes Monats, Index 0 = gleich nach dem Kauf. */
export function kontoVerlauf(a: Angebot, p: Person): number[] {
  const k = [p.erspart - a.sofort];
  for (let m = 1; m <= MONATE; m++) {
    const tarif = m <= a.laufzeit ? a.tarif : SIM_ONLY;
    const rate = m <= a.raten ? a.rate : 0;
    k.push(k[m - 1] + p.frei - tarif - rate);
  }
  return k.map(cent);
}

/** Warten und sparen: nach wie vielen Monaten reicht das Geld (mit Preisfall nach 12 Monaten)? */
export function warten(h: Handy, p: Person): { monate: number; preis: number } | null {
  let k = p.erspart;
  for (let m = 0; m <= MONATE; m++) {
    const preis = m >= 12 ? cent(h.preis * (1 - PREISFALL)) : h.preis;
    if (k >= preis) return { monate: m, preis };
    k += p.frei - SIM_ONLY;
  }
  return null;
}

export type Auswertung = {
  angebot: Angebot;
  kosten: number;
  aufpreis: number;
  aufpreisProzent: number;
  monatlich: number;
  minKonto: number;
  machbar: boolean;
};

export function werteAus(h: Handy, p: Person, angebote: Angebot[]): Auswertung[] {
  return angebote.map(a => {
    const kosten = handyKosten(a), konto = kontoVerlauf(a, p);
    const minKonto = Math.min(...konto);
    return {
      angebot: a, kosten, aufpreis: cent(kosten - h.preis), aufpreisProzent: ((kosten - h.preis) / h.preis) * 100,
      monatlich: cent(a.rate + a.tarif), minKonto, machbar: minKonto >= 0,
    };
  });
}

/** Das günstigste Angebot, das man sich leisten kann (Konto nie im Minus); null, wenn keins geht. */
export function bestes(aus: Auswertung[]): Auswertung | null {
  const ok = aus.filter(a => a.machbar);
  return ok.length ? ok.reduce((a, b) => (b.kosten < a.kosten ? b : a)) : null;
}

export function erzeugeFall(rnd: Rnd = Math.random) {
  // So lange würfeln, bis wenigstens ein Angebot bezahlbar ist.
  for (;;) {
    const h = wahl(rnd, HANDYS);
    const v = wahl(rnd, PERSONEN);
    const p: Person = { name: v.name, emoji: v.emoji, erspart: wahl(rnd, v.erspart), frei: wahl(rnd, v.frei) };
    const angebote = erzeugeAngebote(h, rnd);
    const aus = werteAus(h, p, angebote);
    if (bestes(aus)) return { handy: h, person: p, angebote, auswertung: aus };
  }
}
