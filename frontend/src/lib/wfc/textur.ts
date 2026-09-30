/**
 * Textur-Synthese nach P. F. Harrison (»Resynthesizer«, 2005) — portiert aus
 * SynTex.cs von Maxim Gumin, https://github.com/mxgmn/TextureSynthesis
 * (MIT-Lizenz, © mxgmn 2016). Die Beispielbilder dort sind nicht Teil der
 * Lizenz und werden hier nicht benutzt; unsere Proben sind eigene.
 *
 * Idee: Jedes Ausgabe-Pixel merkt sich, aus welchem Pixel der Probe es stammt
 * (»Herkunft«). Die Pixel werden in zufälliger Reihenfolge gefüllt. Kandidaten
 * für ein Pixel: Wo in der Probe würde es liegen, wenn es die Nachbarschaft
 * eines schon gefüllten Nachbarn fortsetzt? Dazu ein paar zufällige Stellen.
 * Gewählt wird der Kandidat, dessen Umgebung in der Probe am besten zur schon
 * gefüllten Umgebung passt. »Polieren« wiederholt das mit allen Nachbarn.
 * Die Ausgabe ist ringsum verbunden — das Ergebnis kachelt also nahtlos.
 */
import { zufallAus } from "@/lib/gebaeude/muster";

/** Bild aus Farben 0xRRGGBB */
export interface Bild { b: number; h: number; farben: Uint32Array }

export interface SyntheseOptionen {
  b: number; h: number;
  /** Nachbarschaft: verglichen wird ein (2N+1)×(2N+1)-Fenster */
  n: number;
  /** zusätzliche zufällige Kandidaten je Pixel */
  m: number;
  /** so viele Runden Nachbessern nach dem ersten Füllen */
  polieren: number;
  seed: number;
}

export interface SyntheseStand {
  /** je Ausgabe-Pixel die Stelle in der Probe (−1 = noch leer) */
  herkunft: Int32Array;
  runde: number;
  /** bearbeitete Pixel dieser Runde */
  fertig: number;
  gesamt: number;
}

/** Farbabstand wie im Original: je Kanal 1 + λ·Δ², multipliziert, negativer Logarithmus */
function abstand(c1: number, c2: number): number {
  const L = 1 / (20 * 65536);
  const dr = ((c1 >> 16) & 255) - ((c2 >> 16) & 255);
  const dg = ((c1 >> 8) & 255) - ((c2 >> 8) & 255);
  const db = (c1 & 255) - (c2 & 255);
  return -Math.log((1 + L * dr * dr) * (1 + L * dg * dg) * (1 + L * db * db));
}

/**
 * Schritt für Schritt: liefert alle `jeSchritt` Pixel den Stand (zum Zuschauen)
 * und am Ende die fertige Herkunft.
 */
export function* resynthese(probe: Bild, o: SyntheseOptionen, jeSchritt = 256): Generator<SyntheseStand, Int32Array> {
  const { b: SW, h: SH, farben: sample } = probe;
  const OW = o.b, OH = o.h, N = o.n, M = o.m;
  const zufall = zufallAus(o.seed);
  const ganz = (k: number) => Math.floor(zufall() * k);

  // Farben durchnummerieren; bei wenigen Farben die Abstände vorab rechnen
  const nummer = new Map<number, number>();
  const idx = new Int32Array(SW * SH);
  for (let j = 0; j < SW * SH; j++) {
    if (!nummer.has(sample[j])) nummer.set(sample[j], nummer.size);
    idx[j] = nummer.get(sample[j])!;
  }
  const C = nummer.size;
  let tabelle: Float64Array | null = null;
  if (C <= 1024) {
    const liste = [...nummer.keys()];
    tabelle = new Float64Array(C * C);
    for (let x = 0; x < C; x++) for (let y = 0; y < C; y++) tabelle[x * C + y] = abstand(liste[x], liste[y]);
  }

  const herkunft = new Int32Array(OW * OH).fill(-1);
  const reihe = new Int32Array(OW * OH);
  for (let i = 0; i < reihe.length; i++) {
    const j = ganz(i + 1);
    if (j !== i) reihe[i] = reihe[j];
    reihe[j] = i;
  }

  const nachbarn = new Int32Array(8);
  const kandidaten = new Int32Array(8 + M);
  const x = [0, 0, 0, 0], y = [0, 0, 0, 0];

  for (let runde = 0; runde <= o.polieren; runde++) {
    for (let zaehler = 0; zaehler < reihe.length; zaehler++) {
      const f = reihe[zaehler];
      const fx = f % OW, fy = (f - fx) / OW;
      const anzahl = runde > 0 ? Math.min(8, OW * OH - 1) : Math.min(8, zaehler);
      let gefunden = 0;

      if (anzahl > 0) {
        // die nächsten schon gefüllten Pixel, auf Quadraten wachsender Größe um f
        for (let radius = 1; gefunden < anzahl; radius++) {
          x[0] = fx - radius; y[0] = fy - radius;
          x[1] = fx - radius; y[1] = fy + radius;
          x[2] = fx + radius; y[2] = fy + radius;
          x[3] = fx + radius; y[3] = fy - radius;
          for (let k = 0; k < 2 * radius; k++) {
            for (let d = 0; d < 4; d++) {
              x[d] = (x[d] + 10 * OW) % OW;
              y[d] = (y[d] + 10 * OH) % OH;
              if (gefunden >= anzahl) continue;
              const p = x[d] + y[d] * OW;
              if (herkunft[p] !== -1) nachbarn[gefunden++] = p;
            }
            y[0]++; x[1]++; y[2]--; x[3]--;
          }
        }
        // Kandidat: die Probe so verschoben, wie f zum Nachbarn liegt
        for (let n = 0; n < anzahl; n++) {
          const nb = nachbarn[n], h = herkunft[nb];
          const cx = (h + ((f - nb) % OW) + 100 * SW) % SW;
          const cy = (Math.floor(h / SW) + Math.floor(f / OW) - Math.floor(nb / OW) + 100 * SH) % SH;
          kandidaten[n] = cx + cy * SW;
        }
      }
      for (let m = 0; m < M; m++) kandidaten[anzahl + m] = ganz(SW * SH);

      let best = -1e10, wahl = -1;
      for (let c = 0; c < anzahl + M; c++) {
        let summe = 1e-6 * zufall();
        const ix = kandidaten[c] % SW, iy = (kandidaten[c] - ix) / SW;
        for (let dy = -N; dy <= N; dy++) {
          let SY = iy + dy; if (SY < 0) SY += SH; else if (SY >= SH) SY -= SH;
          let FY = fy + dy; if (FY < 0) FY += OH; else if (FY >= OH) FY -= OH;
          for (let dx = -N; dx <= N; dx++) {
            if (dx === 0 && dy === 0) continue;
            let SX = ix + dx; if (SX < 0) SX += SW; else if (SX >= SW) SX -= SW;
            let FX = fx + dx; if (FX < 0) FX += OW; else if (FX >= OW) FX -= OW;
            const h = herkunft[FX + FY * OW];
            if (h === -1) continue;
            const S = SX + SY * SW;
            summe += tabelle ? tabelle[idx[h] * C + idx[S]] : abstand(sample[h], sample[S]);
          }
        }
        if (summe >= best) { best = summe; wahl = kandidaten[c]; }
      }
      herkunft[f] = wahl;
      if ((zaehler + 1) % jeSchritt === 0) yield { herkunft, runde, fertig: zaehler + 1, gesamt: reihe.length };
    }
  }
  return herkunft;
}

/** Ganz durchrechnen und die Farben des Ergebnisses liefern */
export function synthetisiere(probe: Bild, o: SyntheseOptionen): Uint32Array {
  const lauf = resynthese(probe, o, Number.MAX_SAFE_INTEGER);
  let r = lauf.next();
  while (!r.done) r = lauf.next();
  return farbenAus(probe, r.value);
}

export function farbenAus(probe: Bild, herkunft: Int32Array): Uint32Array {
  const aus = new Uint32Array(herkunft.length);
  for (let i = 0; i < herkunft.length; i++) aus[i] = herkunft[i] < 0 ? 0 : probe.farben[herkunft[i]];
  return aus;
}

/** Bild aus RGBA-Pixeldaten (z. B. getImageData) */
export function bildAus(daten: Uint8ClampedArray, b: number, h: number): Bild {
  const farben = new Uint32Array(b * h);
  for (let i = 0; i < b * h; i++) farben[i] = (daten[i * 4] << 16) | (daten[i * 4 + 1] << 8) | daten[i * 4 + 2];
  return { b, h, farben };
}

/** Farben in RGBA-Pixeldaten schreiben (leere Pixel dunkel) */
export function schreibePixel(farben: Uint32Array, herkunft: Int32Array | null, ziel: Uint8ClampedArray) {
  for (let i = 0; i < farben.length; i++) {
    const leer = herkunft !== null && herkunft[i] < 0;
    const c = farben[i];
    ziel[i * 4] = leer ? 17 : (c >> 16) & 255;
    ziel[i * 4 + 1] = leer ? 24 : (c >> 8) & 255;
    ziel[i * 4 + 2] = leer ? 39 : c & 255;
    ziel[i * 4 + 3] = 255;
  }
}

/** Einstellungen, mit denen die Gebäude ihre Fels-, Erd-, Sand- und Eisflächen erzeugen */
export const GEBAEUDE_SYNTHESE = { probe: 64, aus: 128, n: 2, m: 8, polieren: 1 } as const;
