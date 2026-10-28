/**
 * Mein Kiosk — Kalkulation zum Ausprobieren. Je Woche: Ware einkaufen,
 * Aufschlag festlegen, Woche laufen lassen. Frisches verdirbt, Ereignisse
 * ändern Nachfrage und Einkaufspreise.
 *
 * Kundschaft: eine feste Schülerschaft. Jeden Schultag entscheidet jede und
 * jeder per Zufall, ob sie zum Kiosk geht (wer kein Pausenbrot dabei hat,
 * öfter), ob sie etwas essen und/oder trinken will, und ob ihr der Preis
 * recht ist (Kaufwahrscheinlichkeit, verglichen mit der Konkurrenz). Ist die
 * Ware alle, geht sie leer aus. Der Ruf (aus den Sternen der Vorwochen)
 * bestimmt, wie viele überhaupt kommen.
 *
 * Kalkulation wie im Einzelhandel:
 *   Einkaufspreis (netto) + Aufschlag % = Verkaufspreis netto
 *   + Mehrwertsteuer (7 % Lebensmittel, 19 % Getränke) = Verkaufspreis brutto,
 *   auf 5 Cent gerundet. Die Mehrwertsteuer gehört dem Finanzamt.
 */
import { euro } from "./prozent";

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
  /** Beliebtheit: Gewicht bei der Wahl unter Essen bzw. Getränken */
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
export const SCHUELER = 600;
/** Anteil, der kein Pausenbrot von zu Hause mitbringt */
export const OHNE_BROT = 0.4;
export const START_RUF = 3;
export const TAGE = ["Mo", "Di", "Mi", "Do", "Fr"] as const;

/** Wer wie oft kommt und was will — je Schultag */
const GRUPPEN: { anteil: number; besuch: number; essen: number; trinken: number; vorliebe: Partial<Record<ProduktId, number>> }[] = [
  { anteil: OHNE_BROT, besuch: 0.4, essen: 0.85, trinken: 0.45, vorliebe: { broetchen: 1.5, brezel: 1.2 } },
  { anteil: 1 - OHNE_BROT, besuch: 0.1, essen: 0.35, trinken: 0.65, vorliebe: { riegel: 1.8, obst: 1.4, broetchen: 0.4, brezel: 0.7 } },
];

export type Ereignis = {
  id: string; titel: string; text: string;
  nachfrage?: Partial<Record<ProduktId | "getraenke" | "alle", number>>;
  ek?: Partial<Record<ProduktId, number>>;
  markt?: Partial<Record<ProduktId, number>>;
};

export const EREIGNISSE: Ereignis[] = [
  { id: "normal", titel: "Ganz normale Woche", text: "Nichts Besonderes los." },
  { id: "grippe", titel: "🤧 Grippewelle", text: "Ein Viertel der Schule liegt krank im Bett — weniger Kundschaft, aber Frisches verdirbt genauso.", nachfrage: { alle: 0.75 } },
  { id: "tanteEmma", titel: "🏪 Superrabatt bei Tante Emma", text: "Der Laden an der Ecke verkauft Müsliriegel für 0,35 € und Kakao für 0,40 € — billiger, als du sie selbst einkaufst. Mithalten geht nicht: lieber wenig bestellen.", markt: { riegel: 0.35, kakao: 0.4 / 1.1 } },
  { id: "hitze", titel: "☀️ Hitzewelle", text: "Über 30 Grad — alle wollen etwas zu trinken.", nachfrage: { getraenke: 1.6, obst: 1.3, kakao: 0.6 } },
  { id: "wandertag", titel: "🥾 Wandertag", text: "Am Mittwoch ist die halbe Schule unterwegs.", nachfrage: { alle: 0.7 } },
  { id: "baecker", titel: "🥐 Bäckerei-Aktion", text: "Die Bäckerei gegenüber verkauft Brötchen und Brezeln 20 % billiger.", markt: { broetchen: 0.8, brezel: 0.8 } },
  { id: "lieferant", titel: "🚚 Lieferant erhöht Preise", text: "Käse wird teurer: Käsebrötchen kosten im Einkauf 15 % mehr.", ek: { broetchen: 1.15 } },
  { id: "kakaoTeuer", titel: "🌧️ Schlechte Kakaoernte", text: "Kakao kostet im Einkauf 25 % mehr.", ek: { kakao: 1.25, riegel: 1.1 } },
  { id: "sportfest", titel: "🏃 Sportfest", text: "Viele Gäste auf dem Schulhof — Riegel und Getränke gehen weg.", nachfrage: { alle: 1.3, riegel: 1.6, getraenke: 1.3 } },
  { id: "kalt", titel: "❄️ Kälteeinbruch", text: "Bitterkalt: Kakao ist gefragt, Schorle kaum.", nachfrage: { kakao: 1.8, schorle: 0.6, wasser: 0.7, obst: 0.7 } },
  { id: "gesund", titel: "🥗 Gesundheitswoche", text: "Die Schule wirbt für gesunde Pausen.", nachfrage: { obst: 1.8, wasser: 1.4, riegel: 0.7 } },
  { id: "grosshandel", titel: "🏷️ Großhandel-Aktion", text: "Müsliriegel und Apfelschorle kosten im Einkauf 30 % weniger — gut zum Vorrat anlegen, sie verderben nicht.", ek: { riegel: 0.7, schorle: 0.7 } },
  { id: "backstube", titel: "🥨 Backstube hat zu viel", text: "Dein Bäcker-Lieferant gibt Brezeln und Käsebrötchen 25 % billiger ab.", ek: { brezel: 0.75, broetchen: 0.75 } },
];

/** Mengenrabatt beim Lieferanten je Ware und Bestellung (größte Stufe zuerst) */
export const RABATT_STUFEN = [{ ab: 200, prozent: 10 }, { ab: 100, prozent: 5 }] as const;
export const mengenrabatt = (stueck: number) => RABATT_STUFEN.find(s => stueck >= s.ab)?.prozent ?? 0;
/** Einkaufskosten einer Bestellung: Stückzahl · Einkaufspreis − Mengenrabatt */
export const einkaufFuer = (stueck: number, ek: number) => cent(stueck * ek * (1 - mengenrabatt(stueck) / 100));

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

const L = (r: number) => 1 / (1 + Math.exp((r - 1.2) / 0.1));
/**
 * Wahrscheinlichkeit, dass jemand, der die Ware will, sie zu diesem Preis kauft.
 * Bis etwas über dem Konkurrenzpreis kauft man noch am Kiosk (kein Weg),
 * ab 30 % teurer kaum noch. Ist die Konkurrenz nur diese Woche billig, bleibt
 * ein Teil aus Bequemlichkeit trotzdem — gemessen am üblichen Preis.
 */
export function kaufWahrscheinlichkeit(p: Produkt, brutto: number, e: Ereignis): number {
  return Math.max(L(brutto / marktJetzt(p, e)), 0.3 * L(brutto / p.markt));
}

/** Mehr Sterne → mehr Kundschaft: Ruf 1 → 76 %, Ruf 3 → 100 %, Ruf 5 → 124 % */
export const rufFaktor = (ruf: number) => 1 + 0.12 * (ruf - 3);
/** Der Ruf folgt den Sternen, aber mit Gedächtnis */
export const neuerRuf = (ruf: number, sterne: number) => Math.round((0.5 * ruf + 0.5 * sterne) * 10) / 10;

type Wunschliste = { p: Produkt; rate: number }[];
/** je Gruppe, für Essen und Trinken: wie wahrscheinlich bei einem Besuch welche Ware gewollt wird */
function wuensche(e: Ereignis, produkte: Produkt[]) {
  const n = e.nachfrage ?? {};
  return GRUPPEN.map(g => {
    const art = (getraenk: boolean): Wunschliste => {
      const auswahl = produkte.filter(p => p.getraenk === getraenk);
      const gew = auswahl.map(p => p.basis * (g.vorliebe[p.id] ?? 1));
      const summe = gew.reduce((a, b) => a + b, 0);
      const liste = auswahl.map((p, i) => ({
        p, rate: (getraenk ? g.trinken : g.essen) * (gew[i] / summe) * (getraenk ? n.getraenke ?? 1 : 1) * (n[p.id] ?? 1),
      }));
      const ges = liste.reduce((a, w) => a + w.rate, 0);
      if (ges > 0.98) for (const w of liste) w.rate *= 0.98 / ges;
      return liste;
    };
    return { besuch: g.besuch, anzahl: Math.round(SCHUELER * g.anteil), listen: [art(false), art(true)] };
  });
}

export type Plan = Record<ProduktId, { aufschlag: number; bestellen: number }>;
export type Lager = Record<ProduktId, number>;

export type Zeile = {
  /** ek = Listenpreis; rabatt = Mengenrabatt in % auf diese Bestellung */
  id: ProduktId; brutto: number; ek: number; rabatt: number; bestellt: number; verfuegbar: number;
  /** zuTeuer: wollten, fanden den Preis zu hoch · gewollt: hätten zu dem Preis gekauft */
  zuTeuer: number; gewollt: number; verkauft: number; verpasst: number; verdorben: number;
  /** Schultag (0 = Mo), ab dem die Ware alle war */
  leerAb: number | null;
  umsatz: number; steuer: number; einkauf: number;
};
export type Kommentar = { wer: string; sterne: number; text: string };
export type Zufriedenheit = {
  /** 1 bis 5 in halben Sternen */
  sterne: number;
  /** Anteil der Kundschaft, die bekam, was sie wollte (0–1) */
  bedient: number;
  /** Preis im Schnitt im Verhältnis zur Konkurrenz (1 = gleich teuer) */
  preisVerhaeltnis: number;
  kommentare: Kommentar[];
};
export type Wochenbericht = {
  zeilen: Zeile[];
  umsatz: number; steuer: number; einkauf: number; verderbWert: number; fix: number; gewinn: number;
  lager: Lager;
  zufriedenheit: Zufriedenheit;
};

const klemme = (x: number) => Math.min(1, Math.max(0, x));
const VORNAMEN = ["Mia", "Ben", "Emil", "Lina", "Noah", "Ida", "Paul", "Ella", "Finn", "Mila", "Jonas", "Lea", "Karl", "Nele", "Tom", "Zoe"];

/**
 * Kundenzufriedenheit aus Verfügbarkeit (wer leer ausging) und Preisen
 * (verglichen mit der Konkurrenz, gewichtet nach üblicher Nachfrage).
 * Dazu bis zu vier Kommentare: Ärger über Ausverkauftes und Wucherpreise
 * zuerst, dann Lob.
 */
export function bewerteKiosk(zeilen: Zeile[], e: Ereignis, rnd: Rnd = Math.random, produkte = PRODUKTE): Zufriedenheit {
  const P = Object.fromEntries(produkte.map(p => [p.id, p])) as Record<ProduktId, Produkt>;
  const gewollt = zeilen.reduce((a, z) => a + z.gewollt, 0);
  const bedient = gewollt ? zeilen.reduce((a, z) => a + z.verkauft, 0) / gewollt : 1;
  const gewicht = zeilen.reduce((a, z) => a + P[z.id].basis, 0);
  const preisVerhaeltnis = zeilen.reduce((a, z) => a + P[z.id].basis * (z.brutto / marktJetzt(P[z.id], e)), 0) / gewicht;
  // halb leer ausgegangen = 0, alle bedient = 1; 50 % teurer = 0, 10 % billiger = 1
  // gewichtetes geometrisches Mittel: leere Regale lassen sich nicht mit Billigpreisen wettmachen
  const a = klemme((bedient - 0.5) / 0.5), pr = klemme((1.5 - preisVerhaeltnis) / 0.6);
  const gesamt = (0.05 + 0.95 * a) ** 0.55 * (0.05 + 0.95 * pr) ** 0.45;
  const sterne = Math.round((1 + 4 * gesamt) * 2) / 2;

  const namen = [...VORNAMEN].sort(() => rnd() - 0.5);
  const wer = (i: number) => `${namen[i % namen.length]}, ${5 + Math.floor(rnd() * 6)}${"abc"[Math.floor(rnd() * 3)]}`;
  const waehle = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const aerger: { gewicht: number; sterne: number; text: string }[] = [];
  const lob: { sterne: number; text: string }[] = [];
  for (const z of zeilen) {
    const p = P[z.id], markt = marktJetzt(p, e), r = z.brutto / markt;
    const leer = z.gewollt ? z.verpasst / z.gewollt : 0;
    if (leer > 0.1) {
      aerger.push({
        gewicht: leer + 0.5, sterne: leer > 0.4 ? 1 : 2,
        text: waehle([
          `${p.name}? Schon in der ersten Pause alle! 😠`,
          `${p.name} war wieder ausverkauft. Dann geh ich halt zur Bäckerei.`,
          `Hab extra Geld für ${p.name} mitgebracht — alles weg. 🙄`,
        ]),
      });
    }
    if (r > 1.2) {
      aerger.push({
        gewicht: r - 1, sterne: r > 1.4 ? 1 : 2,
        text: waehle([
          `${euro(z.brutto)} für ${p.name}? Bei der Konkurrenz kostet das ${euro(markt)}. 💸`,
          `${p.name} ist viel zu teuer geworden. Wucher!`,
          `Für ${euro(z.brutto)} kauf ich ${p.name} nicht. Mein Taschengeld reicht so nicht.`,
        ]),
      });
    } else if (leer <= 0.1 && z.verkauft > 0) {
      if (r < 0.9) lob.push({ sterne: 5, text: waehle([`${p.name} für nur ${euro(z.brutto)} — da komm ich jeden Tag! 😍`, `${p.name} so günstig wie nirgends sonst. 👍`]) });
      else lob.push({ sterne: 4, text: waehle([`${p.name} gab's immer, Preis passt.`, `Fairer Preis für ${p.name}. 🙂`]) });
    }
  }
  aerger.sort((a, b) => b.gewicht - a.gewicht);
  const auswahl = [...aerger.slice(0, 3), ...lob.sort(() => rnd() - 0.5)].slice(0, 4);
  if (!auswahl.length) auswahl.push({ sterne: 3, text: "Ganz okay, nichts Besonderes." });
  return { sterne, bedient, preisVerhaeltnis, kommentare: auswahl.map((k, i) => ({ wer: wer(i), sterne: k.sterne, text: k.text })) };
}

export function spieleWoche(plan: Plan, lager: Lager, e: Ereignis, rnd: Rnd = Math.random, ruf = START_RUF, produkte = PRODUKTE): Wochenbericht {
  type Stand = { brutto: number; ek: number; quote: number; bestand: number; zuTeuer: number; gewollt: number; verkauft: number; leerAb: number | null };
  const st = {} as Record<ProduktId, Stand>;
  for (const p of produkte) {
    const ek = ekJetzt(p, e), { brutto } = kalkuliere(ek, plan[p.id].aufschlag, p.mwst);
    st[p.id] = { brutto, ek, quote: kaufWahrscheinlichkeit(p, brutto, e), bestand: lager[p.id] + plan[p.id].bestellen, zuTeuer: 0, gewollt: 0, verkauft: 0, leerAb: null };
  }
  const kommen = (e.nachfrage?.alle ?? 1) * rufFaktor(ruf);
  const gruppen = wuensche(e, produkte);
  for (let tag = 0; tag < TAGE.length; tag++) {
    for (const g of gruppen) {
      const besuch = Math.min(0.95, g.besuch * kommen);
      for (let i = 0; i < g.anzahl; i++) {
        if (rnd() >= besuch) continue;
        for (const liste of g.listen) {
          let u = rnd(), w: Produkt | null = null;
          for (const x of liste) { if (u < x.rate) { w = x.p; break; } u -= x.rate; }
          if (!w) continue;
          const z = st[w.id];
          if (rnd() >= z.quote) { z.zuTeuer++; continue; }
          z.gewollt++;
          if (z.bestand > 0) { z.bestand--; z.verkauft++; } else if (z.leerAb === null) z.leerAb = tag;
        }
      }
    }
  }

  const zeilen: Zeile[] = [];
  const neu = { ...lager };
  for (const p of produkte) {
    const { bestellen } = plan[p.id];
    const { brutto, ek, zuTeuer, gewollt, verkauft, leerAb } = st[p.id];
    const verfuegbar = lager[p.id] + bestellen;
    const rest = verfuegbar - verkauft;
    const verdorben = p.frisch ? rest : 0;
    neu[p.id] = p.frisch ? 0 : rest;
    const umsatz = cent(verkauft * brutto);
    const steuer = cent((umsatz * p.mwst) / (100 + p.mwst));
    zeilen.push({
      id: p.id, brutto, ek, rabatt: mengenrabatt(bestellen), bestellt: bestellen, verfuegbar, zuTeuer, gewollt, verkauft, verpasst: gewollt - verkauft,
      verdorben, leerAb, umsatz, steuer, einkauf: einkaufFuer(bestellen, ek),
    });
  }
  const sum = (f: (z: Zeile) => number) => cent(zeilen.reduce((a, z) => a + f(z), 0));
  const umsatz = sum(z => z.umsatz), steuer = sum(z => z.steuer), einkauf = sum(z => z.einkauf);
  const verderbWert = sum(z => z.verdorben * z.ek * (1 - z.rabatt / 100));
  return {
    zeilen, umsatz, steuer, einkauf, verderbWert, fix: FIXKOSTEN, gewinn: cent(umsatz - steuer - einkauf - FIXKOSTEN), lager: neu,
    zufriedenheit: bewerteKiosk(zeilen, e, rnd, produkte),
  };
}

/** Kosten der Bestellung für diese Woche. */
export const bestellkosten = (plan: Plan, e: Ereignis, produkte = PRODUKTE) =>
  cent(produkte.reduce((a, p) => a + einkaufFuer(plan[p.id].bestellen, ekJetzt(p, e)), 0));

export const leererPlan = (): Plan =>
  Object.fromEntries(PRODUKTE.map(p => [p.id, { aufschlag: 100, bestellen: Math.round(p.basis / 20) * 10 }])) as Plan;
export const leeresLager = (): Lager => Object.fromEntries(PRODUKTE.map(p => [p.id, 0])) as Lager;

/** Erste Woche: alle wollen den neuen Kiosk ausprobieren */
export const EROEFFNUNG: Ereignis = {
  id: "eroeffnung", titel: "🎉 Neueröffnung",
  text: "Alle wollen den neuen Kiosk ausprobieren — diese Woche kommen viel mehr als sonst. Das bleibt nicht so: danach entscheidet dein Ruf.",
  nachfrage: { alle: 1.6 },
};

/** Ein Ereignis für die Woche; die erste ist die Eröffnung. */
export function ereignisFuer(woche: number, rnd: Rnd = Math.random): Ereignis {
  if (woche === 1) return EROEFFNUNG;
  return rnd() < 0.3 ? EREIGNISSE[0] : EREIGNISSE[1 + Math.floor(rnd() * (EREIGNISSE.length - 1))];
}
