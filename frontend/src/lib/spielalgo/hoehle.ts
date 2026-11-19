/**
 * Höhlen aus einem Zellautomaten: Erst wird zufällig Fels verteilt, dann
 * schaut jede Zelle auf ihre acht Nachbarn. Mit vielen Fels-Nachbarn wird
 * sie Fels (»Geburt«) oder bleibt es (»Überleben«), sonst wird sie frei.
 * Nach wenigen Runden werden aus dem Rauschen runde Höhlen.
 *
 * Die klassische Regel ist B5678/S45678: Fels entsteht bei 5+ Fels-Nachbarn
 * und bleibt bei 4+. Zellen außerhalb des Rasters zählen als Fels.
 */

export interface Hoehle {
  b: number;
  h: number;
  /** 1 = Fels, 0 = frei */
  z: Uint8Array;
  generation: number;
  /** Höhlennummer je freier Zelle (−1 = Fels), nach `regionen` */
  region: Int32Array | null;
}

export interface HoehlenOptionen {
  b: number;
  h: number;
  /** Anteil Fels am Anfang (0..1) */
  fels: number;
  /** Anzahl Fels-Nachbarn, bei denen freie Zellen zu Fels werden */
  geburt: number[];
  /** Anzahl Fels-Nachbarn, bei denen Fels Fels bleibt */
  ueberleben: number[];
  runden: number;
  /** am Ende nur die größte Höhle behalten */
  groessteBehalten: boolean;
}

export const HOEHLE_STANDARD: HoehlenOptionen = {
  b: 80, h: 56, fels: 0.45, geburt: [5, 6, 7, 8], ueberleben: [4, 5, 6, 7, 8], runden: 5, groessteBehalten: true,
};

export function neueHoehle(b: number, h: number, fels: number, rng: () => number): Hoehle {
  const z = new Uint8Array(b * h);
  for (let i = 0; i < z.length; i++) z[i] = rng() < fels ? 1 : 0;
  return { b, h, z, generation: 0, region: null };
}

export function felsNachbarn(hz: Hoehle, x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const a = x + dx, b = y + dy;
    if (a < 0 || b < 0 || a >= hz.b || b >= hz.h || hz.z[b * hz.b + a]) n++;
  }
  return n;
}

/** Eine Runde für alle Zellen gleichzeitig; gibt die Zahl der Änderungen zurück. */
export function runde(hz: Hoehle, geburt: number[], ueberleben: number[]): number {
  const neu = new Uint8Array(hz.z.length);
  const B = new Set(geburt), S = new Set(ueberleben);
  let wechsel = 0;
  for (let y = 0; y < hz.h; y++) for (let x = 0; x < hz.b; x++) {
    const i = y * hz.b + x, n = felsNachbarn(hz, x, y);
    neu[i] = (hz.z[i] ? S.has(n) : B.has(n)) ? 1 : 0;
    if (neu[i] !== hz.z[i]) wechsel++;
  }
  hz.z = neu;
  hz.generation++;
  hz.region = null;
  return wechsel;
}

/** Zusammenhängende freie Bereiche (4er-Nachbarschaft), größte zuerst nummeriert. */
export function regionen(hz: Hoehle): number[] {
  const { b, h, z } = hz;
  const roh = new Int32Array(b * h).fill(-1);
  const groessen: number[] = [];
  for (let s = 0; s < z.length; s++) {
    if (z[s] || roh[s] >= 0) continue;
    const nr = groessen.length;
    roh[s] = nr;
    const st = [s];
    let n = 0;
    while (st.length) {
      const i = st.pop()!;
      n++;
      const x = i % b, y = (i / b) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < b - 1 ? i + 1 : -1, y > 0 ? i - b : -1, y < h - 1 ? i + b : -1]) {
        if (j >= 0 && !z[j] && roh[j] < 0) { roh[j] = nr; st.push(j); }
      }
    }
    groessen.push(n);
  }
  // nach Größe umnummerieren
  const ordnung = groessen.map((_, i) => i).sort((a, b) => groessen[b] - groessen[a]);
  const neuNr = new Int32Array(groessen.length);
  ordnung.forEach((alt, neu) => { neuNr[alt] = neu; });
  hz.region = roh.map(r => (r < 0 ? -1 : neuNr[r]));
  return ordnung.map(i => groessen[i]);
}

/** Alles außer der größten Höhle mit Fels füllen; gibt die gefüllten Zellen zurück. */
export function nurGroesste(hz: Hoehle): number {
  if (!hz.region) regionen(hz);
  let gefuellt = 0;
  for (let i = 0; i < hz.z.length; i++) if (hz.region![i] > 0) { hz.z[i] = 1; hz.region![i] = -1; gefuellt++; }
  return gefuellt;
}

export const anteilFrei = (hz: Hoehle) => hz.z.reduce((s, v) => s + (v ? 0 : 1), 0) / hz.z.length;

export function* erzeugeHoehle(stand: { hz: Hoehle }, o: HoehlenOptionen, rng: () => number): Generator<string> {
  stand.hz = neueHoehle(o.b, o.h, o.fels, rng);
  yield `Zufall: ${Math.round(o.fels * 100)} % der Zellen sind Fels. Noch sieht das aus wie Fernsehrauschen.`;
  for (let r = 1; r <= o.runden; r++) {
    const w = runde(stand.hz, o.geburt, o.ueberleben);
    yield `Runde ${r}: ${w} Zellen haben gewechselt, ${Math.round(anteilFrei(stand.hz) * 100)} % frei.`;
    if (w === 0) break;
  }
  const g = regionen(stand.hz);
  yield `${g.length} getrennte Höhlen gefunden (Farben). Die größte hat ${g[0] ?? 0} Felder.`;
  if (o.groessteBehalten && g.length > 1) {
    const n = nurGroesste(stand.hz);
    yield `Kleine Höhlen zugeschüttet (${n} Felder): Jetzt ist jede freie Stelle von jeder anderen aus erreichbar.`;
  }
}
