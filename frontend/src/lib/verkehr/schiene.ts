/**
 * Straßenbahn und Zug: fahren nach Fahrplan auf den echten Gleisen, halten am
 * (ausgedachten) Halt und fahren weiter. Die Lage hängt nur an der Uhr —
 * kein Abgleich zwischen den Rechnern nötig. Bahnen weichen nicht aus und
 * bremsen nicht für Menschen: genau das ist die Lektion.
 */
import type { P } from "./geometrie";
import { HALT_DAUER } from "./tueren";
import type { Halt, Stadt } from "./stadt";

export type Bahn = {
  art: "tram" | "zug";
  halt: Halt;
  /** Weg als Punktfolge, dazu die aufsummierten Längen. */
  weg: P[];
  laengen: number[];
  /** Wo auf dem Weg die Fahrzeugmitte beim Halt steht. */
  sHalt: number;
  /** Wagenlängen von vorn nach hinten. */
  wagen: number[];
  breite: number;
  tempo: number;
  takt: number;
  versatz: number;
  /** Türen je Wagen, Abstand von der Wagenmitte. */
  tuerLagen: number[];
  /** Seite der Türen zum Bahnsteig (+1 rechts in Fahrtrichtung). */
  seite: 1 | -1;
};

const BREMS = 1.1, ANFAHR = 0.9;

/**
 * Folgt dem Gleis vom Halt aus in beide Richtungen, jeweils mit der
 * geradesten Fortsetzung, bis zu `weit` Metern.
 */
function gleisweg(stadt: Stadt, art: "tram" | "bahn", halt: Halt, weit = 500): P[] {
  const key = (p: P) => `${p[0]},${p[1]}`;
  const nachbarn = new Map<string, P[]>();
  for (const g of stadt.karte.gleise) if (g.art === art)
    for (let i = 0; i + 1 < g.linie.length; i++) {
      const a = g.linie[i], b = g.linie[i + 1];
      (nachbarn.get(key(a)) ?? nachbarn.set(key(a), []).get(key(a))!).push(b);
      (nachbarn.get(key(b)) ?? nachbarn.set(key(b), []).get(key(b))!).push(a);
    }
  // Das Gleisstück, auf dem der Halt liegt.
  let best: { a: P; b: P; d: number } | null = null;
  for (const [k, liste] of nachbarn) {
    const a = k.split(",").map(Number) as P;
    for (const b of liste) {
      const m: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const d = Math.hypot(m[0] - halt.p[0], m[1] - halt.p[1]);
      if (!best || d < best.d) best = { a, b, d };
    }
  }
  if (!best) return [];
  const folge = (von: P, nach: P) => {
    const punkte: P[] = [nach];
    let laenge = 0, vor = von, jetzt = nach;
    while (laenge < weit) {
      const w = Math.atan2(jetzt[1] - vor[1], jetzt[0] - vor[0]);
      const weiter = (nachbarn.get(key(jetzt)) ?? []).filter((p) => key(p) !== key(vor));
      if (!weiter.length) break;
      let naechst = weiter[0], knick = Infinity;
      for (const p of weiter) {
        const d = Math.abs(((Math.atan2(p[1] - jetzt[1], p[0] - jetzt[0]) - w + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        if (d < knick) { knick = d; naechst = p; }
      }
      if (knick > Math.PI / 3) break;
      laenge += Math.hypot(naechst[0] - jetzt[0], naechst[1] - jetzt[1]);
      punkte.push(naechst);
      vor = jetzt; jetzt = naechst;
    }
    return punkte;
  };
  const vorwaerts = folge(best.a, best.b);
  const rueckwaerts = folge(best.b, best.a);
  return [...rueckwaerts.reverse(), ...vorwaerts];
}

function laengenVon(weg: P[]): number[] {
  const l = [0];
  for (let i = 1; i < weg.length; i++) l.push(l[i - 1] + Math.hypot(weg[i][0] - weg[i - 1][0], weg[i][1] - weg[i - 1][1]));
  return l;
}

/** Punkt und Richtung bei Weglänge `s` (außerhalb wird verlängert). */
export function aufWeg(b: Pick<Bahn, "weg" | "laengen">, s: number): { p: P; winkel: number } {
  const { weg, laengen } = b;
  let i = 1;
  while (i < weg.length - 1 && laengen[i] < s) i++;
  const a = weg[i - 1], z = weg[i];
  const l = laengen[i] - laengen[i - 1] || 1;
  const f = (s - laengen[i - 1]) / l;
  return { p: [a[0] + (z[0] - a[0]) * f, a[1] + (z[1] - a[1]) * f], winkel: Math.atan2(z[1] - a[1], z[0] - a[0]) };
}

export function baueBahnen(stadt: Stadt): Bahn[] {
  const bahnen: Bahn[] = [];
  for (const halt of stadt.halte) {
    if (halt.art !== "tramhalt" && halt.art !== "bahnhalt") continue;
    const tram = halt.art === "tramhalt";
    const weg = gleisweg(stadt, tram ? "tram" : "bahn", halt);
    if (weg.length < 2) continue;
    const laengen = laengenVon(weg);
    // Mitte des Halts auf dem Weg
    let sHalt = 0, dMin = Infinity;
    for (let s = 0; s <= laengen[laengen.length - 1]; s += 1) {
      const { p } = aufWeg({ weg, laengen }, s);
      const d = Math.hypot(p[0] - halt.p[0], p[1] - halt.p[1]);
      if (d < dMin) { dMin = d; sHalt = s; }
    }
    // Bahnsteig liegt links oder rechts vom Gleis — die Türen gehen dorthin auf.
    const { winkel } = aufWeg({ weg, laengen }, sHalt);
    const steig = stadt.bahnsteige.find((b) => b.some((p) => Math.hypot(p[0] - halt.p[0], p[1] - halt.p[1]) < 40));
    let seite: 1 | -1 = 1;
    if (steig) {
      const mx = steig.reduce((a, p) => a + p[0], 0) / steig.length, my = steig.reduce((a, p) => a + p[1], 0) / steig.length;
      seite = -(mx - halt.p[0]) * Math.sin(winkel) + (my - halt.p[1]) * Math.cos(winkel) >= 0 ? 1 : -1;
    }
    const wagen = tram ? [10, 10, 10] : [17, 17, 17];
    // Der Zug soll mittig am Bahnsteig stehen; `s` zählt aber die Mitte des vordersten Wagens.
    const sSpitze = sHalt + (wagen.reduce((x, l) => x + l + 0.4, -0.4)) / 2 - wagen[0] / 2;
    bahnen.push(tram
      ? { art: "tram", halt, weg, laengen, sHalt: sSpitze, wagen, breite: 2.3, tempo: 11, takt: 150, versatz: 20, tuerLagen: [-2.5, 2.5], seite }
      : { art: "zug", halt, weg, laengen, sHalt: sSpitze, wagen, breite: 2.9, tempo: 17, takt: 210, versatz: 90, tuerLagen: [-5, 5], seite });
  }
  return bahnen;
}

export type BahnStand = {
  /** Weglänge der Zugspitze-Mitte (vorderster Wagen). */
  s: number;
  tempo: number;
  /** Sekunden seit dem Stillstand am Halt, sonst null. */
  haltAlter: number | null;
  sichtbar: boolean;
};

/**
 * Fahrplan: anfahren mit Reisetempo, am Halt bremsen, halten, anfahren,
 * hinausfahren, bis zum nächsten Takt nicht da sein.
 */
export function bahnStand(b: Bahn, t: number): BahnStand {
  const gesamt = b.laengen[b.laengen.length - 1];
  const v = b.tempo;
  const bremsweg = (v * v) / (2 * BREMS);
  const tBremsen = v / BREMS;
  const s0 = -b.wagen.reduce((a, l) => a + l, 0); // hinter dem Wegende hereinkommen
  const tAnfahrt = Math.max(0, (b.sHalt - bremsweg - s0) / v);
  const tAnkunft = tAnfahrt + tBremsen;
  const tAb = tAnkunft + HALT_DAUER;
  const u = (((t + b.versatz) % b.takt) + b.takt) % b.takt;
  let s: number, tempo: number, haltAlter: number | null = null;
  if (u < tAnfahrt) { s = s0 + v * u; tempo = v; }
  else if (u < tAnkunft) { const a = u - tAnfahrt; s = b.sHalt - bremsweg + v * a - (BREMS * a * a) / 2; tempo = v - BREMS * a; }
  else if (u < tAb) { s = b.sHalt; tempo = 0; haltAlter = u - tAnkunft; }
  else {
    const a = u - tAb, tHoch = v / ANFAHR;
    s = a < tHoch ? b.sHalt + (ANFAHR * a * a) / 2 : b.sHalt + (v * tHoch) / 2 + v * (a - tHoch);
    tempo = Math.min(v, ANFAHR * a);
  }
  return { s, tempo, haltAlter, sichtbar: s < gesamt + 5 };
}

/** Die Wagen einer Bahn zum Stand: Mitte, Richtung, Länge — vorn zuerst. */
export function wagenLagen(b: Bahn, stand: BahnStand): { p: P; winkel: number; laenge: number }[] {
  const aus: { p: P; winkel: number; laenge: number }[] = [];
  let s = stand.s;
  for (const l of b.wagen) {
    const vorn = aufWeg(b, s + l / 2), hinten = aufWeg(b, s - l / 2);
    aus.push({
      p: [(vorn.p[0] + hinten.p[0]) / 2, (vorn.p[1] + hinten.p[1]) / 2],
      winkel: Math.atan2(vorn.p[1] - hinten.p[1], vorn.p[0] - hinten.p[0]),
      laenge: l,
    });
    s -= l + 0.4;
  }
  return aus;
}
