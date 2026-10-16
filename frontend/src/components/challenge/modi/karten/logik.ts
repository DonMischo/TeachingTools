/** Reine Spiellogik des Kartenspiels: Booster-Draft, Nachziehstapel, Hand, Ablage, Energie, Sterne. */
import { hashText, mische, rng } from "@/lib/challenge/zufall";

export const HAND = 5;
/** Karten, die am Zugende nachgezogen werden (mindestens bis HAND, höchstens HAND_MAX auf der Hand). */
export const NACHZIEHEN = 2;
export const HAND_MAX = 10;
export const ENERGIE = 3;
export const BOOSTER = 5;
/** So oft wird eine Karte höchstens angeboten (einmal abgelehnt → kommt noch einmal). */
export const ANGEBOTE = 2;


export type Draft = { schlange: string[]; angebot: string[]; deck: string[]; runde: number; gesehen: Record<string, number> };

export function draftStart(ids: string[], seed: number): Draft {
  return naechster({ schlange: mische(ids, rng(seed)), angebot: [], deck: [], runde: 0, gesehen: {} });
}
function naechster(d: Draft): Draft {
  const angebot = d.schlange.slice(0, BOOSTER);
  const gesehen = { ...d.gesehen };
  for (const id of angebot) gesehen[id] = (gesehen[id] ?? 0) + 1;
  return { ...d, angebot, schlange: d.schlange.slice(BOOSTER), gesehen };
}
/** Beliebig viele Karten aus dem Booster nehmen; Abgelehntes kommt später noch einmal (höchstens ANGEBOTE-mal). */
export function draftNimm(d: Draft, ids: string[], seed: number): Draft {
  const genommen = d.angebot.filter((x) => ids.includes(x));
  const zurueck = d.angebot.filter((x) => !ids.includes(x) && (d.gesehen[x] ?? 0) < ANGEBOTE);
  const rest = [...d.schlange, ...mische(zurueck, rng(seed + d.runde + 1))];
  return naechster({ ...d, schlange: rest, angebot: [], deck: [...d.deck, ...genommen], runde: d.runde + 1 });
}

export type Kampf = { zug: number; nachzieh: string[]; hand: string[]; ablage: string[]; stapel: string[]; energie: number; max: number };

/** `max`: Energie je Zug — 3, plus eine je Truhe auf dem Weg. */
export function kampfStart(deck: string[], seed: number, max = ENERGIE): Kampf {
  return zieheKarten({ zug: 1, nachzieh: mische(deck, rng(seed)), hand: [], ablage: [], stapel: [], energie: max, max }, HAND, seed);
}
/** Zieht n Karten; leerer Stapel → Ablage mischen. */
export function zieheKarten(k: Kampf, n: number, seed: number): Kampf {
  let { nachzieh, ablage } = k;
  const hand = [...k.hand];
  for (let i = 0; i < n; i++) {
    if (!nachzieh.length) {
      if (!ablage.length) break;
      nachzieh = mische(ablage, rng(seed + k.zug * 31 + i)); ablage = [];
    }
    hand.push(nachzieh[0]); nachzieh = nachzieh.slice(1);
  }
  return { ...k, nachzieh, ablage, hand };
}
/** Karte von der Hand auf den Kombo-Stapel; kostet 1 Energie. */
export function stapeln(k: Kampf, id: string): Kampf {
  if (k.energie < 1 || !k.hand.includes(id)) return k;
  return { ...k, hand: k.hand.filter((x) => x !== id), stapel: [...k.stapel, id], energie: k.energie - 1 };
}
/** Karte vom Stapel zurück in die Hand; Energie kommt zurück. */
export function zuruecknehmen(k: Kampf, id: string): Kampf {
  if (!k.stapel.includes(id)) return k;
  return { ...k, stapel: k.stapel.filter((x) => x !== id), hand: [...k.hand, id], energie: Math.min(k.max, k.energie + 1) };
}
export function alleZurueck(k: Kampf): Kampf {
  return k.stapel.reduce((s, id) => zuruecknehmen(s, id), k);
}
/** Gespielte Karten wandern auf die Ablage. */
export function ausgespielt(k: Kampf): Kampf {
  return { ...k, ablage: [...k.ablage, ...k.stapel], stapel: [] };
}
/** Zug beenden: Hand bleibt, Energie voll, NACHZIEHEN Karten (mindestens bis HAND, höchstens bis HAND_MAX). Der Kombo-Stapel bleibt liegen. */
export function zugBeenden(k: Kampf, seed: number): Kampf {
  const n = Math.min(Math.max(NACHZIEHEN, HAND - k.hand.length), HAND_MAX - k.hand.length);
  return zieheKarten({ ...k, zug: k.zug + 1, energie: k.max }, Math.max(0, n), seed);
}
/** Handkarten abwerfen und ebenso viele nachziehen (kostenlos). */
export function abwerfen(k: Kampf, ids: string[], seed: number): Kampf {
  const weg = k.hand.filter((x) => ids.includes(x));
  if (!weg.length) return k;
  return zieheKarten({ ...k, hand: k.hand.filter((x) => !weg.includes(x)), ablage: [...k.ablage, ...weg] }, weg.length, seed);
}
/** Ablage unter den Nachziehstapel mischen. */
export function mischen(k: Kampf, seed: number): Kampf {
  if (!k.ablage.length) return k;
  return { ...k, nachzieh: mische([...k.nachzieh, ...k.ablage], rng(seed + k.zug * 17)), ablage: [] };
}

export type Seltenheit = "gewoehnlich" | "selten" | "episch";
/** Rein zufällig aus der ID – darf nie etwas über Lösung oder Kombo verraten. */
export function seltenheit(id: string): Seltenheit {
  const r = hashText(id) % 10;
  return r < 6 ? "gewoehnlich" : r < 9 ? "selten" : "episch";
}
export const ICONS = ["⚔️", "🛡️", "📜", "🔮", "⭐", "🧪", "🗝️", "🔥"];
export const icon = (id: string) => ICONS[hashText(id + "i") % ICONS.length];

/** Sterne je Etappe: viele Züge, wenige Sterne. n = Anzahl Challenges der Etappe. */
export function sterne(zuege: number, n: number): number {
  return zuege <= n + 1 ? 3 : zuege <= 2 * n + 2 ? 2 : 1;
}

export type Raststelle = "kampf" | "truhe" | "lager";
/** Knotenart aus Seed und Knoten-ID; der Startknoten und die Etappenanzahl sind immer Kämpfe. */
export function knotenArt(seed: number, id: number): Raststelle {
  if (id === 0) return "kampf";
  const r = hashText(`${seed}:${id}`) % 6;
  return r === 0 ? "truhe" : r === 1 ? "lager" : "kampf";
}
