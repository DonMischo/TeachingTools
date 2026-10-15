/** Hüpfen: Level-Generator (garantiert erreichbar) und Physik. Einheit = Kacheln, y wächst nach unten. */
import { rng } from "@/lib/challenge/zufall";

export const VX = 6;       // Laufgeschwindigkeit
export const G = 42;       // Schwerkraft
export const VJ = 16;      // Absprunggeschwindigkeit -> Scheitel ca. 3,05 Kacheln
export const COYOTE = 0.1; // Sprung noch kurz nach dem Kantenschritt
export const PUFFER = 0.12; // zu früh gedrückter Sprung zählt noch beim Aufsetzen
export const VJ_KURZ = 9;   // Loslassen im Aufstieg kappt die Geschwindigkeit hierauf (kurzer Hüpfer)
export const VJ_POGO = 20;  // Pogo-Stab: Scheitel ca. 4,8 Kacheln
export const BESCHL = 55;       // Beschleunigung am Boden
export const BESCHL_LUFT = 38;  // in der Luft
export const REIBUNG = 45;      // Abbremsen am Boden ohne Eingabe
export const REIBUNG_LUFT = 8;
export const V_FALL = 22;       // Höchstes Fall-Tempo (Fallen mit Kontrolle)
export const MAX_ANSTIEG = 2;
export const MAX_ABSTIEG = 3;
export const MAX_LUECKE = 2;
/** Sichtbare Höhe des Spielfelds in Kacheln; die Welt (Level.hoehe) ist deutlich höher. */
export const VIEW_H = 11;
export const GEGNER_BONUS = 2;
/** Tore: halbe Breite der Sperre und Höhe der Sperrsäule über dem Boden (nicht zu überspringen, auch nicht mit Pogo). */
export const TOR_HALB = 0.85;
export const TOR_HOCH = 9;
const BEWEGER_AB = 1000; // Index-Offset für bewegte Plattformen in Spieler.auf

export type Plattform = { x: number; y: number; w: number; cp: boolean };
export type Schluessel = { faktIndex: number; x: number; y: number };
/** Edelstein: (x, y) = Mittelpunkt; schwer = liegt auf einer kniffligen Stelle. */
export type Edelstein = { id: number; x: number; y: number; schwer: boolean; pogo?: boolean };
/** Bewegte Plattform: Mitte (cx, cy) schwingt um (ax, ay) mit Periode per Sekunden. Nur Extra, nie auf dem sicheren Weg. */
export type Beweger = { cx: number; cy: number; ax: number; ay: number; w: number; per: number; ph: number };
/** Gegner patrouilliert auf plattformen[plat] zwischen a und b (Tempo v Kacheln/s). */
export type Gegner = { id: number; plat: number; a: number; b: number; v: number; ph: number };
/** Tor i gehört zur i-ten Challenge und steht in der Mitte von plattformen[plat]. */
export type Tor = { x: number; y: number; plat: number };
export type Level = {
  stil: Stil;
  breite: number; hoehe: number; plattformen: Plattform[]; schluessel: Schluessel[];
  /** Tore entlang des Wegs, nach dem Schlüsselbereich; Platz i gehört zur i-ten Challenge. */
  tueren: Tor[];
  /** Zielfahne auf der letzten Plattform. */
  ziel: { x: number; y: number };
  /** Zusätzliche feste Leisten (nur für Edelsteine). */
  leisten: Plattform[];
  beweger: Beweger[];
  gegner: Gegner[];
  edelsteine: Edelstein[];
  /** Pogo-Stab (wie bei Keen): höherer Sprung, holt Edelsteine, die sonst unerreichbar sind. null = keiner in diesem Level. */
  pogo: { x: number; y: number } | null;
};

export type Stil = "treppe" | "tal" | "tuerme" | "inseln" | "hoehle" | "zickzack";
export const STILE: Stil[] = ["treppe", "tal", "tuerme", "inseln", "hoehle", "zickzack"];
export const STIL_NAMEN: Record<Stil, string> = { treppe: "Treppe", tal: "Tal", tuerme: "Türme", inseln: "Inseln", hoehle: "Höhle", zickzack: "Zickzack" };
type Muster = "streu" | "bogen" | "spur" | "versteckt";
// Breite [min,max], Lücke [min,max], Gem-Muster, Zusatz-Beweger je Etappe
const STIL: Record<Stil, { w: [number, number]; g: [number, number]; muster: Muster; beweger: number; leisten: number }> = {
  treppe: { w: [3, 5], g: [1, 2], muster: "spur", beweger: 0, leisten: 1 },
  tal: { w: [3, 6], g: [1, 2], muster: "bogen", beweger: 0, leisten: 1 },
  tuerme: { w: [3, 3], g: [1, 2], muster: "versteckt", beweger: 0, leisten: 2 },
  inseln: { w: [2, 4], g: [1, 2], muster: "bogen", beweger: 2, leisten: 0.5 },
  hoehle: { w: [5, 8], g: [1, 2], muster: "spur", beweger: 0, leisten: 0 },
  zickzack: { w: [3, 4], g: [1, 2], muster: "streu", beweger: 0, leisten: 1 },
};

/**
 * Level aus Etappe, Zufallswert und Stil (aus dem Seed, wenn nicht angegeben).
 * Aufbau: Start, Schlüsselbereich (alle Schlüssel!), dann je Tor eine Torplattform und ein Hüpfabschnitt, am Ende Zielfahne.
 * Abschnitte (Turm, Schacht, Treppe ...) liegen in eigenen, getrennten x-Bereichen, damit kein Tor zu umgehen ist.
 * Schlüssel und Tore liegen auf der festen, erreichbaren Kette; Extras (Leisten, Beweger, Edelsteine) abseits davon.
 */
export function baueLevel(etappe: number, nFakten: number, nTueren: number, seed = 1, stilWahl?: Stil): Level {
  const r = rng(Math.imul(seed >>> 0, 0x9e3779b1) ^ (etappe * 1000 + 13));
  const stil: Stil = stilWahl ?? STILE[Math.floor(r() * STILE.length)];
  const S = STIL[stil];
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const gMax = S.g[1], gMin = Math.min(gMax, S.g[0] + (etappe >= 3 ? 1 : 0));
  const luecke = () => ri(gMin, gMax);
  const em = Math.min(etappe, 3);

  // --- Kette (y zunächst relativ, wird unten in die Welt verschoben); dy > 0 = hinauf
  const pl: Plattform[] = [{ x: 0, y: 0, w: 5, cp: true }];
  const anh = (dy: number, w: number, gap = luecke()) => {
    const v = pl[pl.length - 1];
    pl.push({ x: v.x + v.w + gap, y: v.y - dy, w, cp: false });
  };
  const breit = () => ri(S.w[0], S.w[1]);
  const flach = (n: number) => { for (let i = 0; i < n; i++) anh(ri(-1, 1), breit()); };
  const treppeHoch = (n: number) => { for (let i = 0; i < n; i++) anh(r() < 0.7 ? 2 : 1, breit()); };
  const treppeRunter = (n: number) => { for (let i = 0; i < n; i++) anh(-ri(2, MAX_ABSTIEG), breit()); };
  const zig = (n: number) => { for (let i = 0; i < n; i++) anh(i % 2 === 0 ? ri(1, 2) : -ri(1, 2), breit()); };
  const inselHoch = (n: number) => { for (let i = 0; i < n; i++) anh(ri(1, 2), ri(2, 3), 2); };
  // Turm/Schacht: Kehrtreppe zwischen links (L) und rechts (R) im eigenen x-Bereich; endet rechts, damit es nach rechts weitergeht
  const kehre = (paare: number, hoch: boolean) => {
    const w = 3, tg = luecke();
    const dy = () => (hoch ? (r() < 0.75 ? 2 : 1) : -ri(2, MAX_ABSTIEG));
    anh(dy(), w);
    const lx = pl[pl.length - 1].x;
    for (let i = 0; i < paare * 2 - 1; i++) {
      const v = pl[pl.length - 1];
      pl.push({ x: i % 2 === 0 ? lx + w + tg : lx, y: v.y - dy(), w, cp: false });
    }
  };
  const turm = (p: number) => kehre(p, true);
  const schacht = (p: number) => kehre(p, false);

  const m = 2 + em;
  const rezept: Record<Stil, { k: (() => void)[]; g: (() => void)[] }> = {
    treppe: {
      k: [() => treppeHoch(6), () => flach(2), () => treppeRunter(3), () => flach(2), () => treppeHoch(4)],
      g: [() => treppeHoch(m), () => { treppeRunter(m - 1); flach(1); }],
    },
    tal: {
      k: [() => schacht(3), () => flach(3), () => turm(3), () => flach(2)],
      g: [() => { treppeRunter(2); flach(m - 1); treppeHoch(2); }, () => { treppeRunter(1); flach(m); treppeHoch(1); }],
    },
    tuerme: {
      k: [() => turm(3), () => flach(1), () => schacht(2), () => turm(3)],
      g: [() => turm(1 + (em > 1 ? 1 : 0)), () => { flach(1); schacht(1); }],
    },
    inseln: {
      k: [() => inselHoch(5), () => flach(2), () => inselHoch(4), () => flach(2)],
      g: [() => inselHoch(m), () => flach(m), () => { treppeRunter(1); flach(m - 1); }],
    },
    hoehle: {
      k: [() => schacht(3), () => flach(3), () => schacht(2), () => flach(3)],
      g: [() => { flach(m - 1); treppeHoch(3); }, () => { flach(m); treppeHoch(2); }],
    },
    zickzack: {
      k: [() => zig(3), () => turm(3), () => schacht(2), () => zig(3)],
      g: [() => zig(m + 1), () => { turm(1); flach(1); }, () => { schacht(1); zig(2); }],
    },
  };

  const kZiel = Math.max(nFakten, 3) + 5;
  for (let j = 0; pl.length - 1 < kZiel; j++) rezept[stil].k[j % rezept[stil].k.length]();
  const kLetzte = pl.length - 1;
  const tuerPlat: number[] = [];
  for (let d = 0; d < nTueren; d++) {
    anh(ri(-1, 1), 6); // Torplattform: Tor in der Mitte
    tuerPlat.push(pl.length - 1);
    rezept[stil].g[d % rezept[stil].g.length]();
  }
  flach(2);
  anh(ri(-1, 1), 5); // Ziel

  // In die Welt verschieben: oben 7 Kacheln Luft, unten 4
  const minY = Math.min(...pl.map((p) => p.y)), maxY = Math.max(...pl.map((p) => p.y));
  const plattformen = pl.map((p) => ({ ...p, y: p.y - minY + 7 }));
  const hoehe = maxY - minY + 7 + 4;
  const n = plattformen.length, ende = plattformen[n - 1];
  // Kontrollpunkte: Start, hinter jedem Tor, Ziel, sonst alle drei Plattformen (auch in Türmen und Schächten)
  const istTor = new Set(tuerPlat);
  let seit = 0;
  for (let i = 1; i < n; i++) {
    const nachTor = istTor.has(i - 1);
    seit++;
    if (!istTor.has(i) && (nachTor || i === n - 1 || seit >= 3)) { plattformen[i].cp = true; seit = 0; }
  }

  // Schlüssel gleichmäßig über den Schlüsselbereich verteilt
  const keyPlat = new Set<number>();
  const schluessel: Schluessel[] = [];
  for (let i = 0; i < nFakten; i++) {
    const idx = 1 + Math.floor(((i + 0.5) * kLetzte) / nFakten);
    const p = plattformen[idx];
    keyPlat.add(idx);
    schluessel.push({ faktIndex: i, x: p.x + p.w / 2, y: p.y });
  }
  const tueren: Tor[] = tuerPlat.map((idx) => ({ x: plattformen[idx].x + plattformen[idx].w / 2, y: plattformen[idx].y, plat: idx }));
  const ziel = { x: ende.x + ende.w / 2, y: ende.y };

  // Extras (Edelsteine, Leisten, Beweger, Gegner) liegen abseits des sicheren Wegs und abseits der Tore.
  const sperr = new Set<number>();
  for (const t of tuerPlat) { sperr.add(t - 1); sperr.add(t); sperr.add(t + 1); }
  const edelsteine: Edelstein[] = [];
  const gem = (x: number, y: number, schwer: boolean) => edelsteine.push({ id: edelsteine.length, x, y, schwer });
  const leisten: Plattform[] = [];
  const beweger: Beweger[] = [];
  const gegner: Gegner[] = [];
  const muster: Muster = r() < 0.35 ? (["streu", "bogen", "spur", "versteckt"] as Muster[])[ri(0, 3)] : S.muster;
  const leistenChance = Math.min((0.25 + 0.1 * etappe) * S.leisten, 0.85);
  const rest = Array.from({ length: n - 3 }, (_, i) => i + 2).filter((i) => !sperr.has(i));
  const ziehe = (k: number, pool: number[]) => {
    const out: number[] = [];
    for (let j = 0; j < k && pool.length; j++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  };
  // Liegt im Kasten schon eine andere Kettenplattform?
  const belegt = (ausser: number, x0: number, x1: number, y0: number, y1: number) =>
    plattformen.some((q, j) => j !== ausser && q.x < x1 && q.x + q.w > x0 && q.y > y0 && q.y < y1);
  const moverPlat = new Set(ziehe(Math.min(1 + etappe + S.beweger, 7), [...rest]));
  const gegnerPool = rest.filter((i) => !keyPlat.has(i) && !plattformen[i].cp && plattformen[i].w >= 3 && !moverPlat.has(i));
  const gegnerPlat = new Set(ziehe(Math.min(etappe + (nTueren > 0 ? 1 : 0), 6), gegnerPool));
  for (let i = 1; i < n - 1; i++) {
    if (istTor.has(i)) continue;
    const p = plattformen[i], nx = plattformen[i + 1];
    const gx = nx.x >= p.x + p.w ? (p.x + p.w + nx.x) / 2 : (nx.x + nx.w + p.x) / 2, gy = Math.min(p.y, nx.y);
    const mitteX = p.x + p.w / 2 + (keyPlat.has(i) ? 1 : 0);
    if (muster === "spur") {
      for (let k = 0; k < Math.min(3, p.w - 1); k++) if (r() < 0.8) gem(p.x + 0.8 + k * 1.1, p.y - 0.7, false);
    } else if (muster === "bogen") {
      if (r() < 0.5) gem(mitteX, p.y - 0.7, false);
      if (r() < 0.8 && !istTor.has(i + 1)) { gem(gx - 0.9, gy - 1.2, false); gem(gx, gy - 2.4, true); gem(gx + 0.9, gy - 1.2, false); }
    } else if (muster === "versteckt") {
      if (r() < 0.4) gem(mitteX, p.y - 0.7, false);
    } else {
      if (r() < 0.7) gem(mitteX, p.y - 0.7, false);
      if (r() < 0.6 && !istTor.has(i + 1)) gem(gx, gy - 2.4, true);
    }
    const leisteOk = !sperr.has(i) && i < n - 2 && !moverPlat.has(i);
    const ly = p.y - 2;
    if (leisteOk && (r() < leistenChance || (muster === "versteckt" && i % 2 === 0)) && !belegt(i, p.x + 0.3, p.x + 2.7, ly - 1.2, ly + 1.2)) {
      leisten.push({ x: p.x + 0.5, y: ly, w: 2, cp: false });
      gem(p.x + 1.5, ly - 0.7, true);
      if (stil === "tuerme" && !belegt(i, p.x + 0.3, p.x + 2.7, ly - 3.2, ly - 0.8)) { // zweite Leiste darüber
        leisten.push({ x: p.x + 0.5, y: ly - 2, w: 2, cp: false });
        gem(p.x + 1.5, ly - 2.7, true);
      }
    }
    if (moverPlat.has(i)) {
      if (stil === "tuerme" || Math.abs(nx.y - p.y) >= 2) { // Aufzug in der Lücke
        const mv: Beweger = { cx: gx, cy: Math.max(3, gy - 1.5), ax: 0, ay: 1.8, w: 2, per: 4.5, ph: r() };
        beweger.push(mv);
        gem(mv.cx, Math.max(0.9, mv.cy - mv.ay - 2.2), true);
      } else {
        const mv: Beweger = { cx: gx, cy: Math.max(2.5, gy - 2), ax: stil === "inseln" ? 1.6 : 1.2, ay: 0, w: 2, per: 4 + r() * 2, ph: r() };
        beweger.push(mv);
        gem(mv.cx, mv.cy - 2.2, true);
      }
    }
    if (gegnerPlat.has(i)) gegner.push({ id: gegner.length, plat: i, a: p.x + 0.7, b: p.x + p.w - 0.7, v: 1.2 + 0.3 * Math.min(etappe, 5) + r() * 0.4, ph: r() });
  }
  if (!edelsteine.length) gem(plattformen[1].x + plattformen[1].w / 2, plattformen[1].y - 0.7, false);
  // Pogo-Stab auf der zweiten Plattform; Hochsprung-Edelsteine nur über freien Plattformen (keine andere Plattform in der Spalte)
  let pogo: Level["pogo"] = null;
  const hoch = plattformen.map((p, i) => ({ p, i })).filter(({ p, i }) => i >= 2 && i < n - 1 && !sperr.has(i) && p.y >= 7.5 && !moverPlat.has(i)
    && !belegt(i, p.x + p.w / 2 - 1.5, p.x + p.w / 2 + 1.5, -1e9, 1e9)
    && !beweger.some((mv) => Math.abs(mv.cx - (p.x + p.w / 2)) < 3.5));
  if (hoch.length) {
    pogo = { x: plattformen[1].x + 0.9, y: plattformen[1].y - 0.7 };
    for (const { p } of ziehe(Math.min(1 + etappe, 4), hoch.map((_, k) => k)).map((k) => hoch[k])) {
      edelsteine.push({ id: edelsteine.length, x: p.x + p.w / 2, y: p.y - 6, schwer: true, pogo: true });
    }
  }
  return { stil, breite: ende.x + ende.w + 3, hoehe, plattformen, schluessel, tueren, ziel, leisten, beweger, gegner, edelsteine, pogo };
}


/** Höchstzahl der Edelsteine (inkl. Gegner-Prämien) für den Zähler. */
export const edelsteineGesamt = (l: Level) => l.edelsteine.length + l.gegner.length * GEGNER_BONUS;

const tri = (u: number) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
export const gegnerX = (g: Gegner, t: number) => g.a + (g.b - g.a) * tri((t * g.v) / (2 * (g.b - g.a)) + g.ph);
export function bewegerFlaeche(m: Beweger, t: number): Plattform {
  const w = Math.sin(2 * Math.PI * (t / m.per + m.ph));
  return { x: m.cx + m.ax * w - m.w / 2, y: m.cy + m.ay * w, w: m.w, cp: false };
}

export type Spieler = {
  x: number; y: number; vy: number; auf: number; coyote: number; richtung: 1 | -1; cp: number; t: number;
  vx: number; puffer: number; sprungVorher: boolean; pogo: boolean;
  /** Zählt Landungen mit Tempo hoch (Landestaub). */
  landung: number;
};
export type Eingabe = { links: boolean; rechts: boolean; sprung: boolean };

export function startSpieler(l: Level): Spieler {
  const p = l.plattformen[0];
  return { x: p.x + 1, y: p.y, vy: 0, auf: 0, coyote: 0, richtung: 1, cp: 0, t: 0, vx: 0, puffer: 0, sprungVorher: false, pogo: false, landung: 0 };
}

/** Zurück zum letzten Kontrollpunkt, ohne Folgen. */
export function zumKontrollpunkt(s: Spieler, l: Level): Spieler {
  const p = l.plattformen[s.cp];
  return { ...s, x: p.x + Math.min(1, p.w / 2), y: p.y, vy: 0, vx: 0, puffer: 0, auf: s.cp, coyote: 0 };
}

const stehtAuf = (p: Plattform, x: number) => x >= p.x - 0.2 && x <= p.x + p.w + 0.2;

/** Fläche zum Index: feste Kette, dann Leisten, ab 1000 bewegte Plattformen (zur Zeit t). */
function flaeche(l: Level, i: number, t: number): Plattform {
  if (i >= BEWEGER_AB) return bewegerFlaeche(l.beweger[i - BEWEGER_AB], t);
  return i < l.plattformen.length ? l.plattformen[i] : l.leisten[i - l.plattformen.length];
}

/** zu[i] = Tor i ist geschlossen und sperrt den Weg (Spalte der Breite 2*TOR_HALB, TOR_HOCH hoch über dem Boden und alles darunter). */
export function schritt(s: Spieler, e: Eingabe, dt: number, l: Level, zu?: readonly boolean[]): Spieler {
  const dir = (e.rechts ? 1 : 0) - (e.links ? 1 : 0);
  const t1 = s.t + dt;
  const n: Spieler = { ...s, t: t1, richtung: dir ? (dir as 1 | -1) : s.richtung, sprungVorher: e.sprung };
  // Beschleunigung und Reibung statt Sofortgeschwindigkeit
  const boden = s.auf >= 0;
  const ziel = dir * VX;
  const a = (dir ? (boden ? BESCHL : BESCHL_LUFT) : (boden ? REIBUNG : REIBUNG_LUFT)) * dt;
  n.vx = s.vx + Math.max(-a, Math.min(a, ziel - s.vx));
  n.x = Math.min(l.breite - 0.25, Math.max(0.25, s.x + n.vx * dt));
  if (n.x !== s.x + n.vx * dt) n.vx = 0;
  if (s.auf >= BEWEGER_AB) { // mitfahren
    const m = l.beweger[s.auf - BEWEGER_AB];
    n.x += bewegerFlaeche(m, t1).x - bewegerFlaeche(m, s.t).x;
  }
  if (zu) {
    l.tueren.forEach((d, i) => {
      if (!zu[i] || s.y <= d.y - TOR_HOCH || Math.abs(n.x - d.x) >= TOR_HALB) return;
      n.x = s.x >= d.x ? d.x + TOR_HALB : d.x - TOR_HALB; n.vx = 0;
    });
  }
  // Sprungpuffer: frisch gedrückt merkt sich der Sprung; mit Pogo-Stab springt gehaltenes Springen immer wieder
  n.puffer = e.sprung && !s.sprungVorher ? PUFFER : Math.max(0, s.puffer - dt);
  const will = n.puffer > 0 || (s.pogo && e.sprung);
  if (will && (s.auf >= 0 || s.coyote > 0)) {
    n.vy = -(s.pogo ? VJ_POGO : VJ); n.auf = -1; n.coyote = 0; n.puffer = 0;
  } else if (s.auf >= 0) {
    const p = flaeche(l, s.auf, t1);
    if (stehtAuf(p, n.x)) { n.y = p.y; n.vy = 0; return n; }
    n.auf = -1; n.coyote = COYOTE; n.vy = 0;
  } else {
    n.coyote = Math.max(0, s.coyote - dt);
    if (!e.sprung && s.vy < -VJ_KURZ) n.vy = -VJ_KURZ; // variable Sprunghöhe: kurz tippen = kleiner Sprung
  }
  n.vy = Math.min(V_FALL, n.vy + G * dt);
  n.y = s.y + n.vy * dt;
  if (n.vy >= 0) {
    const alle = l.plattformen.length + l.leisten.length;
    const ids = [...Array.from({ length: alle }, (_, i) => i), ...l.beweger.map((_, k) => BEWEGER_AB + k)];
    for (const i of ids) {
      const p = flaeche(l, i, t1);
      const vorher = i >= BEWEGER_AB ? flaeche(l, i, s.t).y : p.y;
      if (stehtAuf(p, n.x) && s.y <= vorher + 0.15 && n.y >= p.y) {
        if (n.vy > 7) n.landung = s.landung + 1;
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
/** Berührt die Figur das (geschlossene) Tor, steht sie davor oder springt dagegen. */
export const naheTuer = (s: Spieler, t: { x: number; y: number }) => Math.abs(s.x - t.x) < TOR_HALB + 0.35 && s.y <= t.y + 0.2 && s.y > t.y - 3;
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

export const nahePogo = (s: Spieler, p: { x: number; y: number }) => Math.abs(s.x - p.x) < 0.7 && s.y - p.y < 0.9 && s.y - p.y > -1.5;

/** Sterne für die Etappenbilanz (reine Spielwertung). */
export const sterne = (n: number, max: number) => (max <= 0 ? 0 : n >= max * 0.9 ? 3 : n >= max * 0.6 ? 2 : n >= max * 0.25 ? 1 : 0);
