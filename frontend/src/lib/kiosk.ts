/**
 * Mein Kiosk — Kalkulation zum Ausprobieren. Je Woche: Ware einkaufen,
 * Aufschlag festlegen, Woche laufen lassen. Die Kundschaft reagiert auf den
 * Preis, Frisches verdirbt, Ereignisse ändern Nachfrage und Einkaufspreise.
 *
 * Kalkulation wie im Einzelhandel:
 *   Einkaufspreis (netto) + Aufschlag % = Verkaufspreis netto
 *   + Mehrwertsteuer (7 % Lebensmittel, 19 % Getränke) = Verkaufspreis brutto,
 *   auf 5 Cent gerundet. Die Mehrwertsteuer gehört dem Finanzamt.
 */
type Rnd = () => number;
const cent = (x: number) => Math.round(x * 100) / 100;

export type ProduktId = "broetchen" | "brezel" | "riegel" | "obst" | "schorle" | "kakao" | "wasser";

export type Produkt = {
  id: ProduktId; name: string; emoji: string;
  /** Einkaufspreis netto je Stück */
  ek: number;
  mwst: 7 | 19;
  /** üblicher Bruttopreis bei der Konkurrenz */
  markt: number;
  /** Nachfrage pro Woche zum Marktpreis */
  basis: number;
  /** verdirbt am Wochenende */
  frisch: boolean;
  getraenk: boolean;
};

export const PRODUKTE: Produkt[] = [
  { id: "broetchen", name: "Käsebrötchen", emoji: "🥪", ek: 0.62, mwst: 7, markt: 1.6, basis: 110, frisch: true, getraenk: false },
  { id: "brezel", name: "Brezel", emoji: "🥨", ek: 0.32, mwst: 7, markt: 0.9, basis: 120, frisch: true, getraenk: false },
  { id: "obst", name: "Obstbecher", emoji: "🍓", ek: 0.85, mwst: 7, markt: 2.0, basis: 45, frisch: true, getraenk: false },
  { id: "riegel", name: "Müsliriegel", emoji: "🍫", ek: 0.38, mwst: 7, markt: 1.0, basis: 70, frisch: false, getraenk: false },
  // Getränke kosten 19 % — außer Milchgetränke (mind. 75 % Milch): 7 %
  { id: "schorle", name: "Apfelschorle", emoji: "🧃", ek: 0.48, mwst: 19, markt: 1.3, basis: 90, frisch: false, getraenk: true },
  { id: "kakao", name: "Kakao", emoji: "🥛", ek: 0.42, mwst: 7, markt: 1.1, basis: 60, frisch: false, getraenk: true },
  { id: "wasser", name: "Wasser", emoji: "💧", ek: 0.22, mwst: 19, markt: 0.8, basis: 70, frisch: false, getraenk: true },
];

export const FIXKOSTEN = 30; // Standmiete und Strom pro Woche
export const START_KASSE = 200;
export const WOCHEN = 8;
/** Wie stark die Kundschaft auf den Preis reagiert (Preiselastizität) */
const ELASTIZITAET = 2;

export type Ereignis = {
  id: string; titel: string; text: string;
  nachfrage?: Partial<Record<ProduktId | "getraenke" | "alle", number>>;
  ek?: Partial<Record<ProduktId, number>>;
  markt?: Partial<Record<ProduktId, number>>;
};

export const EREIGNISSE: Ereignis[] = [
  { id: "normal", titel: "Ganz normale Woche", text: "Nichts Besonderes los." },
  { id: "hitze", titel: "☀️ Hitzewelle", text: "Über 30 Grad — alle wollen etwas zu trinken.", nachfrage: { getraenke: 1.6, obst: 1.3, kakao: 0.6 } },
  { id: "wandertag", titel: "🥾 Wandertag", text: "Am Mittwoch ist die halbe Schule unterwegs.", nachfrage: { alle: 0.7 } },
  { id: "baecker", titel: "🥐 Bäckerei-Aktion", text: "Die Bäckerei gegenüber verkauft Brötchen und Brezeln 20 % billiger.", markt: { broetchen: 0.8, brezel: 0.8 } },
  { id: "lieferant", titel: "🚚 Lieferant erhöht Preise", text: "Käse wird teurer: Käsebrötchen kosten im Einkauf 15 % mehr.", ek: { broetchen: 1.15 } },
  { id: "kakaoTeuer", titel: "🌧️ Schlechte Kakaoernte", text: "Kakao kostet im Einkauf 25 % mehr.", ek: { kakao: 1.25, riegel: 1.1 } },
  { id: "sportfest", titel: "🏃 Sportfest", text: "Viele Gäste auf dem Schulhof — Riegel und Getränke gehen weg.", nachfrage: { alle: 1.3, riegel: 1.6, getraenke: 1.3 } },
  { id: "kalt", titel: "❄️ Kälteeinbruch", text: "Bitterkalt: Kakao ist gefragt, Schorle kaum.", nachfrage: { kakao: 1.8, schorle: 0.6, wasser: 0.7, obst: 0.7 } },
  { id: "gesund", titel: "🥗 Gesundheitswoche", text: "Die Schule wirbt für gesunde Pausen.", nachfrage: { obst: 1.8, wasser: 1.4, riegel: 0.7 } },
];

/** Einkaufspreis in dieser Woche (mit Ereignis). */
export const ekJetzt = (p: Produkt, e: Ereignis) => cent(p.ek * (e.ek?.[p.id] ?? 1));
export const marktJetzt = (p: Produkt, e: Ereignis) => cent(p.markt * (e.markt?.[p.id] ?? 1));

/** Kalkulation: aus Einkaufspreis und Aufschlag den Bruttopreis (auf 5 Cent gerundet). */
export function kalkuliere(ek: number, aufschlag: number, mwst: number) {
  const netto = ek * (1 + aufschlag / 100);
  const steuer = netto * (mwst / 100);
  const brutto = Math.max(0.05, Math.round(((netto + steuer) * 100) / 5) * 5 / 100);
  // nach dem Runden: was bleibt wirklich als Aufschlag?
  const nettoGerundet = brutto / (1 + mwst / 100);
  return { netto: cent(netto), steuer: cent(steuer), brutto: cent(brutto), echterAufschlag: ((nettoGerundet - ek) / ek) * 100 };
}

export function nachfrage(p: Produkt, brutto: number, e: Ereignis, rnd: Rnd = Math.random): number {
  const n = e.nachfrage ?? {};
  const faktor = (n.alle ?? 1) * (p.getraenk ? n.getraenke ?? 1 : 1) * (n[p.id] ?? 1);
  const preis = (marktJetzt(p, e) / brutto) ** ELASTIZITAET;
  const rauschen = 0.85 + rnd() * 0.3;
  return Math.max(0, Math.round(p.basis * faktor * Math.min(preis, 3) * rauschen));
}

export type Plan = Record<ProduktId, { aufschlag: number; bestellen: number }>;
export type Lager = Record<ProduktId, number>;

export type Zeile = {
  id: ProduktId; brutto: number; ek: number; bestellt: number; verfuegbar: number;
  gewollt: number; verkauft: number; verpasst: number; verdorben: number;
  umsatz: number; steuer: number; einkauf: number;
};
export type Wochenbericht = {
  zeilen: Zeile[];
  umsatz: number; steuer: number; einkauf: number; verderbWert: number; fix: number; gewinn: number;
  lager: Lager;
};

export function spieleWoche(plan: Plan, lager: Lager, e: Ereignis, rnd: Rnd = Math.random, produkte = PRODUKTE): Wochenbericht {
  const zeilen: Zeile[] = [];
  const neu = { ...lager };
  for (const p of produkte) {
    const { aufschlag, bestellen } = plan[p.id];
    const ek = ekJetzt(p, e);
    const { brutto } = kalkuliere(ek, aufschlag, p.mwst);
    const verfuegbar = lager[p.id] + bestellen;
    const gewollt = nachfrage(p, brutto, e, rnd);
    const verkauft = Math.min(gewollt, verfuegbar);
    const rest = verfuegbar - verkauft;
    const verdorben = p.frisch ? rest : 0;
    neu[p.id] = p.frisch ? 0 : rest;
    const umsatz = cent(verkauft * brutto);
    const steuer = cent((umsatz * p.mwst) / (100 + p.mwst));
    zeilen.push({ id: p.id, brutto, ek, bestellt: bestellen, verfuegbar, gewollt, verkauft, verpasst: gewollt - verkauft, verdorben, umsatz, steuer, einkauf: cent(bestellen * ek) });
  }
  const sum = (f: (z: Zeile) => number) => cent(zeilen.reduce((a, z) => a + f(z), 0));
  const umsatz = sum(z => z.umsatz), steuer = sum(z => z.steuer), einkauf = sum(z => z.einkauf);
  const verderbWert = sum(z => z.verdorben * z.ek);
  return { zeilen, umsatz, steuer, einkauf, verderbWert, fix: FIXKOSTEN, gewinn: cent(umsatz - steuer - einkauf - FIXKOSTEN), lager: neu };
}

/** Kosten der Bestellung für diese Woche. */
export const bestellkosten = (plan: Plan, e: Ereignis, produkte = PRODUKTE) =>
  cent(produkte.reduce((a, p) => a + plan[p.id].bestellen * ekJetzt(p, e), 0));

export const leererPlan = (): Plan =>
  Object.fromEntries(PRODUKTE.map(p => [p.id, { aufschlag: 100, bestellen: Math.round(p.basis / 20) * 10 }])) as Plan;
export const leeresLager = (): Lager => Object.fromEntries(PRODUKTE.map(p => [p.id, 0])) as Lager;

/** Ein Ereignis für die Woche; die erste Woche ist immer normal. */
export function ereignisFuer(woche: number, rnd: Rnd = Math.random): Ereignis {
  if (woche === 1) return EREIGNISSE[0];
  return rnd() < 0.3 ? EREIGNISSE[0] : EREIGNISSE[1 + Math.floor(rnd() * (EREIGNISSE.length - 1))];
}
