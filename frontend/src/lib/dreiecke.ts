/**
 * Rechnung zum Dreieck für die Sim »dreiecke« (Klasse 5–8): Seiten, Winkel,
 * Einordnung nach Seiten und Winkeln, besondere Punkte (Höhenschnittpunkt,
 * Schwerpunkt, Umkreis, Inkreis) und das Einrasten beim Ziehen einer Ecke.
 * Koordinaten wie in der Skizze: y zeigt nach unten. Seite a liegt gegenüber
 * von A (also BC), b gegenüber von B, c gegenüber von C.
 */
import type { Pt } from "@/lib/geometrie/skizze";

export type Dreieck = [Pt, Pt, Pt];

export const RAD = Math.PI / 180;
export const abstand = (p: Pt, q: Pt) => Math.hypot(q.x - p.x, q.y - p.y);
export const mitte = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const minus = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });
const plus = (p: Pt, q: Pt): Pt => ({ x: p.x + q.x, y: p.y + q.y });
const mal = (p: Pt, k: number): Pt => ({ x: p.x * k, y: p.y * k });
const kreuz = (p: Pt, q: Pt) => p.x * q.y - p.y * q.x;
const skalar = (p: Pt, q: Pt) => p.x * q.x + p.y * q.y;

/** a = |BC|, b = |CA|, c = |AB| */
export function seitenLaengen([A, B, C]: Dreieck) {
  return { a: abstand(B, C), b: abstand(C, A), c: abstand(A, B) };
}

/** Innenwinkel in Grad (Kosinussatz, numerisch stabil über atan2). */
export function innenwinkel([A, B, C]: Dreieck) {
  const w = (p: Pt, q: Pt, r: Pt) => {
    const u = minus(q, p), v = minus(r, p);
    return Math.abs(Math.atan2(kreuz(u, v), skalar(u, v))) / RAD;
  };
  return { alpha: w(A, B, C), beta: w(B, C, A), gamma: w(C, A, B) };
}

export const umfang = (d: Dreieck) => { const s = seitenLaengen(d); return s.a + s.b + s.c; };
export const flaeche = ([A, B, C]: Dreieck) => Math.abs(kreuz(minus(B, A), minus(C, A))) / 2;

export type NachSeiten = "unregelmaessig" | "gleichschenklig" | "gleichseitig";
export type NachWinkeln = "spitzwinklig" | "rechtwinklig" | "stumpfwinklig";
export const SEITEN_NAMEN: Record<NachSeiten, string> = { unregelmaessig: "unregelmäßig", gleichschenklig: "gleichschenklig", gleichseitig: "gleichseitig" };
export const WINKEL_NAMEN: Record<NachWinkeln, string> = { spitzwinklig: "spitzwinklig", rechtwinklig: "rechtwinklig", stumpfwinklig: "stumpfwinklig" };

/** Gleich heißt: auf eine Nachkommastelle gerundet gleich (so wie die Anzeige). */
const gleich = (x: number, y: number) => Math.abs(x - y) < 0.05;

export function nachSeiten(d: Dreieck): NachSeiten {
  const { a, b, c } = seitenLaengen(d);
  const n = [gleich(a, b), gleich(b, c), gleich(c, a)].filter(Boolean).length;
  return n >= 2 ? "gleichseitig" : n === 1 ? "gleichschenklig" : "unregelmaessig";
}

/** Rechtwinklig, wenn der größte Winkel auf ganze Grad gerundet 90° ist. */
export function nachWinkeln(d: Dreieck): NachWinkeln {
  const { alpha, beta, gamma } = innenwinkel(d);
  const g = Math.round(Math.max(alpha, beta, gamma));
  return g === 90 ? "rechtwinklig" : g > 90 ? "stumpfwinklig" : "spitzwinklig";
}

/**
 * Dreieck aus c, α und β: A links, B rechts auf derselben Höhe, C darüber.
 * `A` legt die Lage fest.
 */
export function ausWinkeln(c: number, alpha: number, beta: number, A: Pt = { x: 0, y: 0 }): Dreieck {
  const b = c * Math.sin(beta * RAD) / Math.sin((alpha + beta) * RAD);
  return [A, { x: A.x + c, y: A.y }, { x: A.x + b * Math.cos(alpha * RAD), y: A.y - b * Math.sin(alpha * RAD) }];
}

/** Dreieck aus drei Seiten (SSS): A links, B rechts, C darüber. */
export function ausSeiten(a: number, b: number, c: number, A: Pt = { x: 0, y: 0 }): Dreieck {
  const x = (b * b + c * c - a * a) / (2 * c);
  return [A, { x: A.x + c, y: A.y }, { x: A.x + x, y: A.y - Math.sqrt(Math.max(0, b * b - x * x)) }];
}

/** Lotfußpunkt von p auf die Gerade durch a und b. */
export function lotfuss(p: Pt, a: Pt, b: Pt): Pt {
  const u = minus(b, a), t = skalar(minus(p, a), u) / (skalar(u, u) || 1);
  return plus(a, mal(u, t));
}

/** Schnitt der Geraden p + s·u und q + t·v (null, wenn parallel). */
export function schnitt(p: Pt, u: Pt, q: Pt, v: Pt): Pt | null {
  const n = kreuz(u, v);
  if (Math.abs(n) < 1e-12) return null;
  return plus(p, mal(u, kreuz(minus(q, p), v) / n));
}

const senkrecht = (u: Pt): Pt => ({ x: -u.y, y: u.x });

export const schwerpunktD = ([A, B, C]: Dreieck): Pt => ({ x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 });

export function hoehenschnitt([A, B, C]: Dreieck): Pt | null {
  return schnitt(A, senkrecht(minus(C, B)), B, senkrecht(minus(A, C)));
}

export function umkreis([A, B, C]: Dreieck): { m: Pt; r: number } | null {
  const m = schnitt(mitte(A, B), senkrecht(minus(B, A)), mitte(B, C), senkrecht(minus(C, B)));
  return m && { m, r: abstand(m, A) };
}

export function inkreis(d: Dreieck): { m: Pt; r: number } {
  const [A, B, C] = d, { a, b, c } = seitenLaengen(d), s = a + b + c || 1;
  const m = { x: (a * A.x + b * B.x + c * C.x) / s, y: (a * A.y + b * B.y + c * C.y) / s };
  return { m, r: 2 * flaeche(d) / s };
}

/** Wo die Winkelhalbierende von Ecke i die Gegenseite trifft (teilt sie im Verhältnis der anliegenden Seiten). */
export function winkelhalbierendeFuss(d: Dreieck, i: number): Pt {
  const P = d[i], Q = d[(i + 1) % 3], R = d[(i + 2) % 3];
  const q = abstand(P, Q), r = abstand(P, R);
  return plus(Q, mal(minus(R, Q), q / (q + r)));
}

/* ─────────────────────────────────────────────────────────── Einrasten ── */

type Kurve = { art: "gerade"; p: Pt; u: Pt } | { art: "kreis"; m: Pt; r: number };

function projiziere(k: Kurve, p: Pt): Pt {
  if (k.art === "gerade") return lotfuss(p, k.p, plus(k.p, k.u));
  const v = minus(p, k.m), l = Math.hypot(v.x, v.y) || 1;
  return plus(k.m, mal(v, k.r / l));
}

/**
 * Zieht man Ecke `i` nach `p`, rastet sie an besonderen Lagen ein: dort, wo
 * das Dreieck gleichseitig, gleichschenklig oder rechtwinklig wird (Thaleskreis,
 * Senkrechte, Mittelsenkrechte, Kreise um die anderen Ecken). Punkte, an denen
 * zwei Eigenschaften zusammenkommen, ziehen stärker.
 */
export function einrasten(d: Dreieck, i: number, p: Pt, fang = 0.3): Pt {
  const Q = d[(i + 1) % 3], R = d[(i + 2) % 3];
  const u = minus(R, Q), l = Math.hypot(u.x, u.y);
  if (l < 1e-6) return p;
  const n = mal(senkrecht(u), 1 / l), M = mitte(Q, R);
  const h3 = l * Math.sqrt(3) / 2;
  const punkte: Pt[] = [
    plus(M, mal(n, h3)), plus(M, mal(n, -h3)),               // gleichseitig
    plus(M, mal(n, l / 2)), plus(M, mal(n, -l / 2)),         // gleichschenklig-rechtwinklig, Spitze hier
    plus(Q, mal(n, l)), plus(Q, mal(n, -l)), plus(R, mal(n, l)), plus(R, mal(n, -l)), // rechter Winkel an Q bzw. R, gleichschenklig
  ];
  let best: Pt | null = null, bd = fang * 1.4;
  for (const q of punkte) { const e = abstand(p, q); if (e < bd) { bd = e; best = q; } }
  if (best) return best;
  const kurven: Kurve[] = [
    { art: "gerade", p: M, u: n },                     // Mittelsenkrechte: gleichschenklig mit Spitze hier
    { art: "kreis", m: M, r: l / 2 },                  // Thaleskreis: rechter Winkel hier
    { art: "gerade", p: Q, u: n }, { art: "gerade", p: R, u: n }, // rechter Winkel bei Q bzw. R
    { art: "kreis", m: Q, r: l }, { art: "kreis", m: R, r: l },   // gleichschenklig mit Spitze Q bzw. R
  ];
  bd = fang;
  for (const k of kurven) { const q = projiziere(k, p), e = abstand(p, q); if (e < bd) { bd = e; best = q; } }
  return best ?? p;
}
