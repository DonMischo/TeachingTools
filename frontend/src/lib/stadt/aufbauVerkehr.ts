/**
 * Verkehr im Aufbau: Ochsenkarren bringen Getreide von den Bauernhöfen zum Markt, Fußgänger gehen von ihren
 * Häusern zu Markt, Kirche und Brunnen. Alle laufen auf dem Wegenetz (auch über Brücken). Nur Anzeige —
 * die Versorgung rechnet aufbau.ts; die Figuren zeigen, wo was hinfließt und wo es eng wird.
 */
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { ANBIETER, type Gut } from "./aufbauRegeln";
import { HAUPT, STRASSE, zufahrt, type Welt } from "./aufbau";

/**
 * Wegweiser: für jedes Straßenfeld das Nachbarfeld, das dem nächsten Ziel näher liegt (Breitensuche ab allen
 * Zielen). -1 = nicht verbunden, Zielfelder zeigen auf sich selbst.
 */
export function wegweiser(w: Welt, ziele: number[]): Int32Array {
  const n = w.n, next = new Int32Array(n * n).fill(-1);
  const ist = (k: number) => w.feld[k] === STRASSE || w.feld[k] === HAUPT;
  const schlange: number[] = [];
  for (const z of ziele) if (z >= 0 && next[z] === -1) { next[z] = z; schlange.push(z); }
  for (let q = 0; q < schlange.length; q++) {
    const k = schlange[q], i = k % n;
    for (const nb of [i > 0 ? k - 1 : -1, i < n - 1 ? k + 1 : -1, k - n, k + n]) {
      if (nb < 0 || nb >= n * n || next[nb] !== -1 || !ist(nb)) continue;
      next[nb] = k;
      schlange.push(nb);
    }
  }
  return next;
}

/** Zielfelder (Zufahrten) aller Gebäude, die ein Gut anbieten */
export function zieleFuer(w: Welt, gut: Gut): number[] {
  return w.bauten.filter(b => ANBIETER[b.bau]?.some(a => a.gut === gut)).map(b => {
    const t = zufahrt(b.i, b.j, b.w, b.h, b.dreh);
    return t.i >= 0 && t.j >= 0 && t.i < w.n && t.j < w.n ? t.j * w.n + t.i : -1;
  });
}

/** Weg von start entlang des Wegweisers bis zum Ziel (Felder); leer, wenn nicht verbunden */
export function pfad(next: Int32Array, start: number, max = 900): number[] {
  if (start < 0 || next[start] === -1) return [];
  const aus = [start];
  let k = start;
  while (next[k] !== k && aus.length < max) { k = next[k]; if (k < 0) return []; aus.push(k); }
  return aus;
}

export interface Wanderer {
  art: "karren" | "fuss";
  pfad: number[];
  /** Lage auf dem Pfad (Feld-Index als Kommazahl) */
  pos: number;
  /** 1 = hin, -1 = zurück */
  richtung: 1 | -1;
  /** Pause am Ziel bzw. zu Hause (Sekunden) */
  warte: number;
  /** Geschwindigkeit in Feldern je Sekunde */
  tempo: number;
  farbe: number;
}

const FARBEN_FUSS = [0x8a3b2c, 0x2f5d8a, 0x4f7a3a, 0x7a5a2f, 0x6b4f7a, 0xb08a3a];

/**
 * Figuren für die Welt: ein Karren je drei Höfe mit Weg zum Markt (höchstens 40), ein Fußgänger je 50
 * Stadtbewohner (höchstens 140). Gleicher Stand → gleiche Figuren.
 */
export function erzeugeVerkehr(w: Welt): Wanderer[] {
  const z = zufallsquelle(w.seed + w.haeuser.length * 7 + w.bauten.length);
  const aus: Wanderer[] = [];
  const zumMarkt = wegweiser(w, zieleFuer(w, "nahrung"));
  const hoefe = w.haeuser.filter(h => h.bauer && zumMarkt[h.tor] !== -1);
  const karren = Math.min(40, Math.ceil(hoefe.length / 3));
  for (let k = 0; k < karren; k++) {
    const h = hoefe[Math.floor(z() * hoefe.length)];
    const p = pfad(zumMarkt, h.tor);
    if (p.length < 3) continue;
    aus.push({ art: "karren", pfad: p, pos: z() * (p.length - 1), richtung: z() > 0.5 ? 1 : -1, warte: 0, tempo: 0.6 + z() * 0.2, farbe: 0x7a5a3a });
  }
  const ziele: Gut[] = ["nahrung", "glaube", "wasser"];
  const weiser = ziele.map(gut => wegweiser(w, zieleFuer(w, gut)));
  const stadt = w.haeuser.filter(h => !h.bauer);
  const fuss = Math.min(140, Math.ceil(stadt.reduce((a, h) => a + h.bewohner, 0) / 50));
  for (let k = 0; k < fuss && stadt.length; k++) {
    const h = stadt[Math.floor(z() * stadt.length)];
    const p = pfad(weiser[Math.floor(z() * weiser.length)], h.tor);
    if (p.length < 2) continue;
    aus.push({ art: "fuss", pfad: p, pos: z() * (p.length - 1), richtung: z() > 0.5 ? 1 : -1, warte: z() * 3, tempo: 0.9 + z() * 0.5, farbe: FARBEN_FUSS[Math.floor(z() * FARBEN_FUSS.length)] });
  }
  return aus;
}

/** Figuren um dt Sekunden weiterbewegen: hin, kurz warten, zurück, kurz warten … */
export function bewege(liste: Wanderer[], dt: number) {
  for (const f of liste) {
    if (f.warte > 0) { f.warte -= dt; continue; }
    f.pos += f.richtung * f.tempo * dt;
    const ende = f.pfad.length - 1;
    if (f.pos >= ende) { f.pos = ende; f.richtung = -1; f.warte = f.art === "karren" ? 4 : 2; }
    else if (f.pos <= 0) { f.pos = 0; f.richtung = 1; f.warte = f.art === "karren" ? 6 : 3; }
  }
}
