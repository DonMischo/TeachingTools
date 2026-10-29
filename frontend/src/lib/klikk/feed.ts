/**
 * Der Feed-Algorithmus: misst, wo jemand hängen bleibt, und gibt mehr davon —
 * je stärker das Interesse, desto tiefer geht es ins Thema (Stufe 2/3).
 */
import { POSTS, WERBUNG, type Post, type Werbung } from "./posts";
import type { Stand, Thema } from "./typen";

/** Pseudozufall aus einer Zahl (mulberry32) — gleicher Seed, gleicher Feed. */
export function zufall(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Interesse je Thema: Verweildauer zählt viel, Likes etwas mehr. */
export function interesse(s: Stand): Record<Thema, number> {
  const r = {} as Record<Thema, number>;
  for (const t of Object.keys(themenListe) as Thema[]) {
    r[t] = 1 + (s.verweil[t] ?? 0) / 4000 + (s.gelikt[t] ?? 0) * 2;
  }
  return r;
}
const themenListe: Record<Thema, true> = {
  fitness: true, beauty: true, gaming: true, tiere: true, musik: true, mode: true, essen: true, comedy: true, news: true, trend: true,
};

/** Wie tief der Feed in ein Thema geht: Anteil am Gesamtinteresse. */
export function stufeFuer(s: Stand, t: Thema): 1 | 2 | 3 {
  const w = interesse(s);
  const summe = Object.values(w).reduce((a, b) => a + b, 0);
  const anteil = w[t] / summe;
  return anteil > 0.3 ? 3 : anteil > 0.17 ? 2 : 1;
}

export type FeedEintrag = { art: "post"; post: Post } | { art: "werbung"; werbung: Werbung };

/** Der nächste Beitrag. Jeder fünfte ist Werbung; Trends des Tages zuerst. */
export function naechster(s: Stand): FeedEintrag {
  const r = zufall(s.seed + s.gesehen.length * 7919);
  const trend = POSTS.find(x => x.tag === s.tag && !s.gesehen.includes(x.id));
  if (trend) return { art: "post", post: trend };

  if (s.gesehen.length % 5 === 4) {
    const gezielt = WERBUNG.filter(w => w.passt(s) && w.id !== "tarif");
    const passend = gezielt.length ? gezielt : WERBUNG.filter(w => w.passt(s));
    // Die gezielteste zuerst: die noch nicht gezeigte, sonst irgendeine passende
    const neu = passend.filter(w => !s.werbung.some(x => x.id === w.id));
    const wahl = (neu.length ? neu : passend)[Math.floor(r() * (neu.length ? neu.length : passend.length))];
    return { art: "werbung", werbung: wahl };
  }

  const w = interesse(s);
  const kandidaten = POSTS.filter(x => x.tag === undefined && x.stufe <= stufeFuer(s, x.thema));
  const frische = kandidaten.filter(x => !s.gesehen.slice(-6).includes(x.id));
  const pool = frische.length ? frische : kandidaten;
  // Gewicht ^1.6 lässt starke Interessen überproportional wachsen; tiefe Stufen ziehen mehr
  const gewicht = (x: Post) => Math.pow(w[x.thema], 1.6) * (x.stufe === 3 ? 1.6 : x.stufe === 2 ? 1.3 : 1);
  const summe = pool.reduce((a, x) => a + gewicht(x), 0);
  let z = r() * summe;
  for (const x of pool) {
    z -= gewicht(x);
    if (z <= 0) return { art: "post", post: x };
  }
  return { art: "post", post: pool[pool.length - 1] };
}
