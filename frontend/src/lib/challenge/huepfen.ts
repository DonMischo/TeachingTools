/** Hüpfen: Level-Generator (garantiert erreichbar) und Physik. Einheit = Kacheln, y wächst nach unten. */

export const VX = 6;       // Laufgeschwindigkeit
export const G = 42;       // Schwerkraft
export const VJ = 16;      // Absprunggeschwindigkeit -> Scheitel ca. 3,05 Kacheln
export const COYOTE = 0.1; // Sprung noch kurz nach dem Kantenschritt
export const MAX_ANSTIEG = 2;
export const MAX_LUECKE = 2;
export const HOEHE = 10;
export const GEGNER_BONUS = 2;
const BEWEGER_AB = 1000; // Index-Offset für bewegte Plattformen in Spieler.auf

export type Plattform = { x: number; y: number; w: number; cp: boolean };
export type Schluessel = { faktIndex: number; x: number; y: number };
/** Edelstein: (x, y) = Mittelpunkt; schwer = liegt auf einer kniffligen Stelle. */
export type Edelstein = { id: number; x: number; y: number; schwer: boolean };
/** Bewegte Plattform: Mitte (cx, cy) schwingt um (ax, ay) mit Periode per Sekunden. Nur Extra, nie auf dem sicheren Weg. */
export type Beweger = { cx: number; cy: number; ax: number; ay: number; w: number; per: number; ph: number };
/** Gegner patrouilliert auf plattformen[plat] zwischen a und b (Tempo v Kacheln/s). */
export type Gegner = { id: number; plat: number; a: number; b: number; v: number; ph: number };
export type Level = {
  breite: number; hoehe: number; plattformen: Plattform[]; schluessel: Schluessel[];
  /** Türplätze auf der letzten Plattform (Mitte, Boden); Platz i gehört zur i-ten Challenge. */
  tueren: { x: number; y: number }[];
  /** Zusätzliche feste Leisten (nur für Edelsteine). */
  leisten: Plattform[];
  beweger: Beweger[];
  gegner: Gegner[];
  edelsteine: Edelstein[];
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Level je Etappe aus Seed (Etappe + Fakten-Anzahl); Schlüssel und Türen liegen auf der festen, erreichbaren Kette. */
export function baueLevel(etappe: number, nFakten: number, nTueren: number): Level {
  const r = rng(etappe * 1000 + nFakten * 7 + 13);
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const plattformen: Plattform[] = [{ x: 0, y: 8, w: 5, cp: true }];
  const mitte = Math.max(nFakten, 3) + 2 + Math.min(etappe, 6) * 2;
  for (let i = 0; i < mitte; i++) {
    const v = plattformen[plattformen.length - 1];
    let y = v.y + ri(-MAX_ANSTIEG, 2);
    y = Math.min(8, Math.max(4, y));
    plattformen.push({ x: v.x + v.w + ri(1, MAX_LUECKE), y, w: ri(3, 5), cp: (i + 1) % 4 === 0 });
  }
  const v = plattformen[plattformen.length - 1];
  const wEnde = Math.max(5, nTueren * 2 + 2);
  const y = Math.min(8, Math.max(4, v.y + ri(-1, 1)));
  const ende: Plattform = { x: v.x + v.w + ri(1, MAX_LUECKE), y, w: wEnde, cp: true };
  plattformen.push(ende);

  // Schlüssel gleichmäßig über die Kette verteilt
  const keyPlat = new Set<number>();
  const schluessel: Schluessel[] = [];
  for (let i = 0; i < nFakten; i++) {
    const idx = 1 + Math.floor(((i + 0.5) * mitte) / nFakten);
    const p = plattformen[idx];
    keyPlat.add(idx);
    schluessel.push({ faktIndex: i, x: p.x + p.w / 2, y: p.y });
  }
  const tueren = Array.from({ length: nTueren }, (_, i) => ({ x: ende.x + 1.5 + 2 * i, y: ende.y }));

  // Extras (Edelsteine, Leisten, Beweger, Gegner) liegen abseits des sicheren Wegs.
  const edelsteine: Edelstein[] = [];
  const gem = (x: number, y: number, schwer: boolean) => edelsteine.push({ id: edelsteine.length, x, y, schwer });
  const leisten: Plattform[] = [];
  const beweger: Beweger[] = [];
  const gegner: Gegner[] = [];
  const leistenChance = Math.min(0.25 + 0.1 * etappe, 0.7);
  const rest = Array.from({ length: mitte - 1 }, (_, i) => i + 2);
  const ziehe = (k: number, pool: number[]) => {
    const out: number[] = [];
    for (let j = 0; j < k && pool.length; j++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  };
  const moverPlat = new Set(ziehe(Math.min(1 + etappe, 5), [...rest]));
  const gegnerPool = rest.filter((i) => !keyPlat.has(i) && !plattformen[i].cp && plattformen[i].w >= 4 && !moverPlat.has(i));
  const gegnerPlat = new Set(ziehe(Math.min(etappe, 6), gegnerPool));
  for (let i = 1; i < plattformen.length - 1; i++) {
    const p = plattformen[i], n = plattformen[i + 1];
    const luecke = n.x - (p.x + p.w);
    if (r() < 0.7) gem(p.x + p.w / 2 + (keyPlat.has(i) ? 1 : 0), p.y - 0.7, false);
    if (r() < 0.6) gem(p.x + p.w + luecke / 2, Math.min(p.y, n.y) - 2.4, true); // über der Grube
    if (i < plattformen.length - 2 && r() < leistenChance && !moverPlat.has(i)) {
      const ly = Math.max(2, p.y - 2);
      leisten.push({ x: p.x + 0.5, y: ly, w: 2, cp: false });
      gem(p.x + 1.5, ly - 0.7, true);
    }
    if (moverPlat.has(i)) {
      if (p.y >= 7 && i % 2 === 0) {
        const m: Beweger = { cx: p.x + p.w / 2, cy: p.y - 3, ax: 0, ay: 1.2, w: 2, per: 4.5, ph: r() };
        beweger.push(m);
        gem(m.cx, Math.max(0.9, m.cy - m.ay - 2.2), true);
      } else {
        const m: Beweger = { cx: p.x + p.w + luecke / 2, cy: Math.max(2.5, Math.min(p.y, n.y) - 2), ax: 1.2, ay: 0, w: 2, per: 5, ph: r() };
        beweger.push(m);
        gem(m.cx, m.cy - 2.2, true);
      }
    }
    if (gegnerPlat.has(i)) gegner.push({ id: gegner.length, plat: i, a: p.x + 0.7, b: p.x + p.w - 0.7, v: 1.2 + 0.3 * Math.min(etappe, 5), ph: r() });
  }
  return { breite: ende.x + ende.w + 3, hoehe: HOEHE, plattformen, schluessel, tueren, leisten, beweger, gegner, edelsteine };
}

/** Höchstzahl der Edelsteine (inkl. Gegner-Prämien) für den Zähler. */
export const edelsteineGesamt = (l: Level) => l.edelsteine.length + l.gegner.length * GEGNER_BONUS;

const tri = (u: number) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
export const gegnerX = (g: Gegner, t: number) => g.a + (g.b - g.a) * tri((t * g.v) / (2 * (g.b - g.a)) + g.ph);
export function bewegerFlaeche(m: Beweger, t: number): Plattform {
  const w = Math.sin(2 * Math.PI * (t / m.per + m.ph));
  return { x: m.cx + m.ax * w - m.w / 2, y: m.cy + m.ay * w, w: m.w, cp: false };
}

/** Prüft nur die Geometrie der Kette (Lücke, Anstieg); die Physik-Probe steht im Test. */
export function kettePasst(l: Level): boolean {
  return l.plattformen.every((p, i) => {
    if (i === 0) return true;
    const v = l.plattformen[i - 1];
    return p.x - (v.x + v.w) <= MAX_LUECKE && v.y - p.y <= MAX_ANSTIEG && p.y >= 3 && p.y < HOEHE;
  });
}

export type Spieler = { x: number; y: number; vy: number; auf: number; coyote: number; richtung: 1 | -1; cp: number; t: number };
export type Eingabe = { links: boolean; rechts: boolean; sprung: boolean };

export function startSpieler(l: Level): Spieler {
  const p = l.plattformen[0];
  return { x: p.x + 1, y: p.y, vy: 0, auf: 0, coyote: 0, richtung: 1, cp: 0, t: 0 };
}

/** Zurück zum letzten Kontrollpunkt, ohne Folgen. */
export function zumKontrollpunkt(s: Spieler, l: Level): Spieler {
  const p = l.plattformen[s.cp];
  return { ...s, x: p.x + Math.min(1, p.w / 2), y: p.y, vy: 0, auf: s.cp, coyote: 0 };
}

const stehtAuf = (p: Plattform, x: number) => x >= p.x - 0.2 && x <= p.x + p.w + 0.2;

/** Fläche zum Index: feste Kette, dann Leisten, ab 1000 bewegte Plattformen (zur Zeit t). */
function flaeche(l: Level, i: number, t: number): Plattform {
  if (i >= BEWEGER_AB) return bewegerFlaeche(l.beweger[i - BEWEGER_AB], t);
  return i < l.plattformen.length ? l.plattformen[i] : l.leisten[i - l.plattformen.length];
}

export function schritt(s: Spieler, e: Eingabe, dt: number, l: Level): Spieler {
  const dir = (e.rechts ? 1 : 0) - (e.links ? 1 : 0);
  const t1 = s.t + dt;
  const n: Spieler = { ...s, t: t1, richtung: dir ? (dir as 1 | -1) : s.richtung };
  n.x = Math.min(l.breite - 0.25, Math.max(0.25, s.x + dir * VX * dt));
  if (s.auf >= BEWEGER_AB) { // mitfahren
    const m = l.beweger[s.auf - BEWEGER_AB];
    n.x += bewegerFlaeche(m, t1).x - bewegerFlaeche(m, s.t).x;
  }
  if (e.sprung && (s.auf >= 0 || s.coyote > 0)) {
    n.vy = -VJ; n.auf = -1; n.coyote = 0;
  } else if (s.auf >= 0) {
    const p = flaeche(l, s.auf, t1);
    if (stehtAuf(p, n.x)) { n.y = p.y; n.vy = 0; return n; }
    n.auf = -1; n.coyote = COYOTE; n.vy = 0;
  } else {
    n.coyote = Math.max(0, s.coyote - dt);
  }
  n.vy = n.vy + G * dt;
  n.y = s.y + n.vy * dt;
  if (n.vy >= 0) {
    const alle = l.plattformen.length + l.leisten.length;
    const ids = [...Array.from({ length: alle }, (_, i) => i), ...l.beweger.map((_, k) => BEWEGER_AB + k)];
    for (const i of ids) {
      const p = flaeche(l, i, t1);
      const vorher = i >= BEWEGER_AB ? flaeche(l, i, s.t).y : p.y;
      if (stehtAuf(p, n.x) && s.y <= vorher + 0.15 && n.y >= p.y) {
        n.y = p.y; n.vy = 0; n.auf = i; n.coyote = 0;
        if (p.cp && i < l.plattformen.length) n.cp = i;
        break;
      }
    }
  }
  if (n.y > l.hoehe + 3) return zumKontrollpunkt(n, l); // Absturz
  return n;
}

export const naheSchluessel = (s: Spieler, k: Schluessel) => Math.abs(s.x - k.x) < 0.7 && s.y - k.y < 0.4 && s.y - k.y > -2;
export const naheTuer = (s: Spieler, t: { x: number; y: number }) => Math.abs(s.x - t.x) < 0.6 && Math.abs(s.y - t.y) < 0.2;
export const naheEdelstein = (s: Spieler, g: Edelstein) => Math.abs(s.x - g.x) < 0.7 && g.y > s.y - 1.7 && g.y < s.y + 0.2;

/** Begegnung mit einem Gegner: "besiegt" (von oben), "treffer" (seitlich/unten) oder null. */
export function gegnerBegegnung(s: Spieler, g: Gegner, l: Level): "besiegt" | "treffer" | null {
  const gy = l.plattformen[g.plat].y;
  if (Math.abs(s.x - gegnerX(g, s.t)) > 0.65 || s.y < gy - 0.9 || s.y > gy + 0.2) return null;
  return s.vy > 0 && s.y < gy - 0.35 ? "besiegt" : "treffer";
}

/** Welche Bilderfolge die Figur zeigt: Blickrichtung bleibt auch im Stand erhalten (erstes Frame dieser Richtung). */
export function figurBilder<F>(laufen: { links: F[]; rechts: F[] }, richtung: 1 | -1, laeuft: boolean): { frame: F; frames?: F[] } {
  const frames = richtung > 0 ? laufen.rechts : laufen.links;
  return laeuft ? { frame: frames[0], frames } : { frame: frames[0] };
}
