/** Reine Spiellogik des Kartenspiels: Booster-Draft, Nachziehstapel, Hand, Ablage, Energie, Sterne. */

export const HAND = 5;
export const ENERGIE = 3;
export const BOOSTER = 5;
/** So oft wird eine Karte höchstens angeboten (einmal abgelehnt → kommt noch einmal). */
export const ANGEBOTE = 2;

export function zufall(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
export function mische<T>(liste: T[], rnd: () => number): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Höchstgröße des Decks: alle Fakten. Wer weniger nimmt, sagt »Fertig« — kleiner darf das Deck
 * nicht erzwungen werden, sonst fehlt womöglich ein nötiger Fakt (der Client kennt die Ablenker nicht).
 */
export function deckZiel(n: number): number {
  return Math.max(1, n);
}

export type Draft = { schlange: string[]; angebot: string[]; deck: string[]; runde: number; gesehen: Record<string, number> };

export function draftStart(ids: string[], seed: number): Draft {
  return naechster({ schlange: mische(ids, zufall(seed)), angebot: [], deck: [], runde: 0, gesehen: {} });
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
  const rest = [...d.schlange, ...mische(zurueck, zufall(seed + d.runde + 1))];
  return naechster({ ...d, schlange: rest, angebot: [], deck: [...d.deck, ...genommen], runde: d.runde + 1 });
}
/** Genau eine Karte nehmen (wie draftNimm mit einer). */
export const draftWahl = (d: Draft, id: string, seed: number): Draft => draftNimm(d, [id], seed);

export type Kampf = { zug: number; nachzieh: string[]; hand: string[]; ablage: string[]; stapel: string[]; energie: number; max: number };

/** `max`: Energie je Zug — 3, plus eine je Truhe auf dem Weg. */
export function kampfStart(deck: string[], seed: number, max = ENERGIE): Kampf {
  return zieheKarten({ zug: 1, nachzieh: mische(deck, zufall(seed)), hand: [], ablage: [], stapel: [], energie: max, max }, HAND, seed);
}
/** Zieht n Karten; leerer Stapel → Ablage mischen. */
export function zieheKarten(k: Kampf, n: number, seed: number): Kampf {
  let { nachzieh, ablage } = k;
  const hand = [...k.hand];
  for (let i = 0; i < n; i++) {
    if (!nachzieh.length) {
      if (!ablage.length) break;
      nachzieh = mische(ablage, zufall(seed + k.zug * 31 + i)); ablage = [];
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
/** Zug beenden: Hand auf die Ablage, neue Hand ziehen, Energie voll. Der Kombo-Stapel bleibt liegen. */
export function zugBeenden(k: Kampf, seed: number): Kampf {
  const leer: Kampf = { ...k, ablage: [...k.ablage, ...k.hand], hand: [], zug: k.zug + 1, energie: k.max };
  return zieheKarten(leer, HAND, seed);
}

export type Seltenheit = "gewoehnlich" | "selten" | "episch";
/** Rein zufällig aus der ID – darf nie etwas über Lösung oder Kombo verraten. */
export function seltenheit(id: string): Seltenheit {
  const r = hash(id) % 10;
  return r < 6 ? "gewoehnlich" : r < 9 ? "selten" : "episch";
}
export const ICONS = ["⚔️", "🛡️", "📜", "🔮", "⭐", "🧪", "🗝️", "🔥"];
export const icon = (id: string) => ICONS[hash(id + "i") % ICONS.length];

/** Sterne je Etappe: viele Züge, wenige Sterne. n = Anzahl Challenges der Etappe. */
export function sterne(zuege: number, n: number): number {
  return zuege <= n + 1 ? 3 : zuege <= 2 * n + 2 ? 2 : 1;
}

export type Raststelle = "kampf" | "truhe" | "lager";
/** Knotenart aus Seed und Knoten-ID; der Startknoten und die Etappenanzahl sind immer Kämpfe. */
export function knotenArt(seed: number, id: number): Raststelle {
  if (id === 0) return "kampf";
  const r = hash(`${seed}:${id}`) % 6;
  return r === 0 ? "truhe" : r === 1 ? "lager" : "kampf";
}
