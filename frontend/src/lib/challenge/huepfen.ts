/** Hüpfen: Level-Generator (garantiert erreichbar) und Physik. Einheit = Kacheln, y wächst nach unten. */

export const VX = 6;       // Laufgeschwindigkeit
export const G = 42;       // Schwerkraft
export const VJ = 16;      // Absprunggeschwindigkeit -> Scheitel ca. 3,05 Kacheln
export const COYOTE = 0.1; // Sprung noch kurz nach dem Kantenschritt
export const MAX_ANSTIEG = 2;
export const MAX_LUECKE = 2;
export const HOEHE = 10;

export type Plattform = { x: number; y: number; w: number; cp: boolean };
export type Schluessel = { faktIndex: number; x: number; y: number };
export type Level = {
  breite: number; hoehe: number; plattformen: Plattform[]; schluessel: Schluessel[];
  /** Türplätze auf der letzten Plattform (Mitte, Boden); Platz i gehört zur i-ten Challenge. */
  tueren: { x: number; y: number }[];
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

/** Level je Etappe aus Seed (Etappe + Fakten-Anzahl); jeder Schlüssel liegt auf einer eigenen, erreichbaren Plattform. */
export function baueLevel(etappe: number, nFakten: number, nTueren: number): Level {
  const r = rng(etappe * 1000 + nFakten * 7 + 13);
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const plattformen: Plattform[] = [{ x: 0, y: 8, w: 5, cp: true }];
  const mitte = Math.max(nFakten, 3);
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

  const schluessel: Schluessel[] = [];
  for (let i = 0; i < nFakten; i++) {
    const p = plattformen[i + 1];
    schluessel.push({ faktIndex: i, x: p.x + p.w / 2, y: p.y });
  }
  const tueren = Array.from({ length: nTueren }, (_, i) => ({ x: ende.x + 1.5 + 2 * i, y: ende.y }));
  return { breite: ende.x + ende.w + 3, hoehe: HOEHE, plattformen, schluessel, tueren };
}

/** Prüft nur die Geometrie der Kette (Lücke, Anstieg); die Physik-Probe steht im Test. */
export function kettePasst(l: Level): boolean {
  return l.plattformen.every((p, i) => {
    if (i === 0) return true;
    const v = l.plattformen[i - 1];
    return p.x - (v.x + v.w) <= MAX_LUECKE && v.y - p.y <= MAX_ANSTIEG && p.y >= 3 && p.y < HOEHE;
  });
}

export type Spieler = { x: number; y: number; vy: number; auf: number; coyote: number; richtung: 1 | -1; cp: number };
export type Eingabe = { links: boolean; rechts: boolean; sprung: boolean };

export function startSpieler(l: Level): Spieler {
  const p = l.plattformen[0];
  return { x: p.x + 1, y: p.y, vy: 0, auf: 0, coyote: 0, richtung: 1, cp: 0 };
}

const stehtAuf = (p: Plattform, x: number) => x >= p.x - 0.2 && x <= p.x + p.w + 0.2;

export function schritt(s: Spieler, e: Eingabe, dt: number, l: Level): Spieler {
  const dir = (e.rechts ? 1 : 0) - (e.links ? 1 : 0);
  const n: Spieler = { ...s, richtung: dir ? (dir as 1 | -1) : s.richtung };
  n.x = Math.min(l.breite - 0.25, Math.max(0.25, s.x + dir * VX * dt));
  if (e.sprung && (s.auf >= 0 || s.coyote > 0)) {
    n.vy = -VJ; n.auf = -1; n.coyote = 0;
  } else if (s.auf >= 0) {
    if (stehtAuf(l.plattformen[s.auf], n.x)) { n.y = l.plattformen[s.auf].y; n.vy = 0; return n; }
    n.auf = -1; n.coyote = COYOTE; n.vy = 0;
  } else {
    n.coyote = Math.max(0, s.coyote - dt);
  }
  n.vy = n.vy + G * dt;
  n.y = s.y + n.vy * dt;
  if (n.vy >= 0) {
    for (let i = 0; i < l.plattformen.length; i++) {
      const p = l.plattformen[i];
      if (stehtAuf(p, n.x) && s.y <= p.y + 0.001 && n.y >= p.y) {
        n.y = p.y; n.vy = 0; n.auf = i; n.coyote = 0;
        if (p.cp) n.cp = i;
        break;
      }
    }
  }
  if (n.y > l.hoehe + 3) { // Absturz: zurück zum letzten Kontrollpunkt, ohne Folgen
    const p = l.plattformen[n.cp];
    return { ...n, x: p.x + Math.min(1, p.w / 2), y: p.y, vy: 0, auf: n.cp, coyote: 0 };
  }
  return n;
}

export const naheSchluessel = (s: Spieler, k: Schluessel) => Math.abs(s.x - k.x) < 0.7 && s.y - k.y < 0.4 && s.y - k.y > -2;
export const naheTuer = (s: Spieler, t: { x: number; y: number }) => Math.abs(s.x - t.x) < 0.6 && Math.abs(s.y - t.y) < 0.2;
