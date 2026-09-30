/**
 * Verlies-Karten: Säle, Gänge, Türen — wie das Beispiel »Verlies« im
 * Regel-Labor, aber so gebaut, dass jede Ebene genau passt:
 *
 *  1. Säle (3×3 Kreuzungen) zufällig verteilt, mit mindestens einer Kreuzung
 *     Abstand. Auf Ebene 2 und tiefer liegt der erste Saal genau unter der
 *     Treppe der Ebene darüber — dort kommt man an.
 *  2. Zwischen den Sälen gräbt ein Backtracker ein Labyrinth.
 *  3. Jeder Saal bekommt eine Tür zum Gang, manche eine zweite (Rundwege).
 *  4. Sackgassen verschwinden, bis nur Gänge bleiben, die zu Türen führen.
 *  5. Der Saal, der vom Ankunftssaal am weitesten weg liegt, hat die Treppe.
 *
 * Ergebnis ist ein gewöhnliches `Stockwerk` — das Gebäude zeichnet es wie
 * jedes andere, die Säle nur größer (`flaeche`).
 */
import { zufall } from "@/lib/regeln/maschine";
import type { Punkt, Raum, Stockwerk } from "./plan";

const KANTEN: Punkt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

interface Saal { ci: number; cj: number }

/** Rasterfeld einer Kreuzung (Gitterkoordinate i → 2i+1) */
const ras = (i: number) => 2 * i + 1;

export function verliesStockwerk(n: number, start: Punkt | null, zimmer: number, seed: number): Stockwerk | null {
  const R = 2 * n + 1;
  const rng = zufall(seed);
  const boden = new Array<boolean>(R * R).fill(false);
  const setze = (x: number, y: number) => { boden[y * R + x] = true; };
  const offen = (x: number, y: number) => x >= 0 && y >= 0 && x < R && y < R && boden[y * R + x];

  // ── 1. Säle ──
  const saele: Saal[] = [];
  const passt = (ci: number, cj: number) =>
    ci >= 1 && cj >= 1 && ci <= n - 2 && cj <= n - 2 && saele.every(s => Math.abs(s.ci - ci) >= 4 || Math.abs(s.cj - cj) >= 4);
  if (start) {
    const ci = (start[0] - 1) / 2, cj = (start[1] - 1) / 2;
    if (!passt(ci, cj)) return null;
    saele.push({ ci, cj });
  }
  const noetig = zimmer + 2; // Stationen + Ankunft + Treppe
  for (let versuch = 0; versuch < 800 && saele.length < noetig; versuch++) {
    const ci = 1 + Math.floor(rng() * (n - 2)), cj = 1 + Math.floor(rng() * (n - 2));
    if (passt(ci, cj)) saele.push({ ci, cj });
  }
  if (saele.length < noetig) return null;
  const imSaal = new Uint8Array(n * n);
  const flaechen: Punkt[][] = saele.map((s, k) => {
    const f: Punkt[] = [];
    for (let y = ras(s.cj - 1); y <= ras(s.cj + 1); y++) {
      for (let x = ras(s.ci - 1); x <= ras(s.ci + 1); x++) { setze(x, y); f.push([x, y]); }
    }
    for (let j = s.cj - 1; j <= s.cj + 1; j++) for (let i = s.ci - 1; i <= s.ci + 1; i++) imSaal[j * n + i] = k + 1;
    return f;
  });

  // ── 2. Gänge: Backtracker über alle Kreuzungen außerhalb der Säle ──
  const besucht = new Uint8Array(n * n);
  for (let j0 = 0; j0 < n; j0++) for (let i0 = 0; i0 < n; i0++) {
    if (imSaal[j0 * n + i0] || besucht[j0 * n + i0]) continue;
    const stapel: Punkt[] = [[i0, j0]];
    besucht[j0 * n + i0] = 1;
    setze(ras(i0), ras(j0));
    while (stapel.length) {
      const [i, j] = stapel[stapel.length - 1];
      const frei = KANTEN.map(([di, dj]) => [i + di, j + dj] as Punkt)
        .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !imSaal[b * n + a] && !besucht[b * n + a]);
      if (!frei.length) { stapel.pop(); continue; }
      const [a, b] = frei[Math.floor(rng() * frei.length)];
      besucht[b * n + a] = 1;
      setze(ras(a), ras(b));
      setze(i + a + 1, j + b + 1); // Durchgang dazwischen
      stapel.push([a, b]);
    }
  }

  // ── 3. Türen ──
  const tueren: Punkt[] = [];
  const tuerVon: Punkt[] = saele.map(s => {
    const kandidaten: Punkt[] = [];
    for (let d = -1; d <= 1; d++) {
      for (const [ri, rj, ai, aj] of [
        [s.ci + d, s.cj - 1, s.ci + d, s.cj - 2], [s.ci + d, s.cj + 1, s.ci + d, s.cj + 2],
        [s.ci - 1, s.cj + d, s.ci - 2, s.cj + d], [s.ci + 1, s.cj + d, s.ci + 2, s.cj + d],
      ]) {
        if (ai < 0 || aj < 0 || ai >= n || aj >= n || imSaal[aj * n + ai]) continue;
        kandidaten.push([ri + ai + 1, rj + aj + 1]); // Wandfeld zwischen Saal- und Gangkreuzung
      }
    }
    if (!kandidaten.length) return [-1, -1] as Punkt;
    const t = kandidaten[Math.floor(rng() * kandidaten.length)];
    tueren.push(t);
    setze(t[0], t[1]);
    if (kandidaten.length > 1 && rng() < 0.3) {
      const t2 = kandidaten[Math.floor(rng() * kandidaten.length)];
      tueren.push(t2);
      setze(t2[0], t2[1]);
    }
    return t;
  });
  if (tuerVon.some(t => t[0] < 0)) return null;

  // ── 4. Sackgassen weg: Gangkreuzungen mit nur einem offenen Nachbarn ──
  // Das Feld vor einer Tür bleibt immer — sonst verlöre ein Saal seinen Zugang.
  const tuerFeld = new Set(tueren.map(t => `${t}`));
  for (let geaendert = true; geaendert;) {
    geaendert = false;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (imSaal[j * n + i]) continue;
      const x = ras(i), y = ras(j);
      if (!offen(x, y)) continue;
      const nb = KANTEN.filter(([dx, dy]) => offen(x + dx, y + dy));
      if (nb.length > 1 || nb.some(([dx, dy]) => tuerFeld.has(`${x + dx},${y + dy}`))) continue;
      boden[y * R + x] = false;
      for (const [dx, dy] of nb) boden[(y + dy) * R + x + dx] = false;
      geaendert = true;
    }
  }

  // ── 5. Alles erreichbar? Treppe in den fernsten Saal ──
  const mitte = (s: Saal): Punkt => [ras(s.ci), ras(s.cj)];
  const anfang = mitte(saele[0]);
  const d = new Int32Array(R * R).fill(-1);
  d[anfang[1] * R + anfang[0]] = 0;
  const schlange: Punkt[] = [anfang];
  for (let k = 0; k < schlange.length; k++) {
    const [x, y] = schlange[k];
    for (const [dx, dy] of KANTEN) {
      if (offen(x + dx, y + dy) && d[(y + dy) * R + x + dx] < 0) {
        d[(y + dy) * R + x + dx] = d[y * R + x] + 1;
        schlange.push([x + dx, y + dy]);
      }
    }
  }
  if (saele.some(s => { const [x, y] = mitte(s); return d[y * R + x] < 0; })) return null;

  const reihenfolge = saele.map((s, k) => ({ k, d: d[ras(s.cj) * R + ras(s.ci)] })).slice(1).sort((a, b) => a.d - b.d);
  const treppe = reihenfolge.pop()!;
  const raeume: Raum[] = reihenfolge.slice(0, zimmer).map(({ k }) => {
    const [x, y] = mitte(saele[k]);
    return { x, y, tuer: tuerVon[k], flaeche: flaechen[k] };
  });
  return { boden, start: anfang, ziel: mitte(saele[treppe.k]), raeume };
}
