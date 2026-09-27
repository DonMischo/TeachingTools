/**
 * Küstenlängsstrom in der Draufsicht — ein Ein-Linien-Modell.
 *
 * Laufen die Wellen schräg auf den Strand, schieben sie den Sand bei jedem
 * Auflaufen schräg hinauf; zurück fließt das Wasser gerade hinab. So
 * wandert jedes Korn im Zickzack den Strand entlang (Strandversetzung).
 * Die Transportmenge folgt der bekannten Faustformel
 *     Q = K · H^2,5 · sin(2 · Einfallswinkel)
 * und die Uferlinie verschiebt sich, wo mehr Sand herausgeht als hereinkommt.
 *
 * Links liegt ein Kliff (Sandquelle), rechts endet die Küste an einer
 * Bucht (Bodden): dort wächst ein Haken ins Wasser — wie am Darßer Ort oder
 * am Bug von Rügen. Buhnen halten den Sand auf ihrer Luvseite fest, dahinter
 * (im Lee) fehlt er. Ein Deckwerk am Kliff stoppt die Quelle.
 */

export const ZELLEN = 100;
/** Breite einer Zelle in m (2 km Küste) */
export const DXL = 20;
export const KLIFF_ZELLEN = 22;
/** Tiefe, bis zu der der Sand bewegt wird, plus Strandhöhe (m) */
const D = 8;
const K_Q = 1.5;
/** Kliffrückgang je Stunde je m² Wellenhöhe bei schmalem Strand */
const K_KLIFF = 6e-5;
const KLIFF_HOEHE = 40;
const DUENE_HOEHE = 8;
/** Anteil Sand im Kliffmaterial, der am Strand bleibt */
const SANDANTEIL = 0.3;
/** Breite der Brandungszone, in der der Sand wandert (m) */
const BRANDUNG = 50;

export interface Buhne { f: number; spitze: number }
export interface Haus { i: number; y: number; name: string; weg?: boolean }

export interface Laengs {
  /** Uferlinie: Abstand von der Bezugslinie im Land (m) */
  y: Float64Array;
  /** Kliffkante bzw. Dünenfuß */
  land: Float64Array;
  deckwerk: Uint8Array;
  buhnen: Buhne[];
  haeuser: Haus[];
  /** Sand, der am rechten Ende in den Haken gewandert ist (m³) */
  haken: number;
  /** Sand, den das Kliff geliefert hat (m³) */
  geliefert: number;
  stunde: number;
  kosten: number;
  meldungen: string[];
}

export function neueKueste(): Laengs {
  const y = new Float64Array(ZELLEN), land = new Float64Array(ZELLEN);
  for (let i = 0; i < ZELLEN; i++) {
    land[i] = 100;
    // Vor dem Kliff ein schmaler Blockstrand, sonst 40 m Sandstrand
    y[i] = i < KLIFF_ZELLEN ? 110 : 140 - 30 * Math.max(0, (KLIFF_ZELLEN + 3 - i) / 3);
  }
  return {
    y, land, deckwerk: new Uint8Array(ZELLEN), buhnen: [],
    haeuser: [
      { i: 38, y: 88, name: "Ferienhaus" },
      { i: 55, y: 85, name: "Strandcafé" },
      { i: 72, y: 88, name: "Fischerhaus" },
      { i: 88, y: 86, name: "Rettungsturm" },
    ],
    haken: 0, geliefert: 0, stunde: 0, kosten: 0, meldungen: [],
  };
}

export function istKliff(i: number) { return i < KLIFF_ZELLEN; }

/** Transport über die Grenze links von Zelle f (m³/h), positiv = nach rechts */
export function transport(k: Laengs, H: number, winkelGrad: number): Float64Array {
  const a = (winkelGrad * Math.PI) / 180;
  const Q = new Float64Array(ZELLEN + 1);
  const h = K_Q * Math.pow(Math.max(0, H), 2.5);
  for (let f = 0; f <= ZELLEN; f++) {
    const l = Math.max(0, f - 1), r = Math.min(ZELLEN - 1, f);
    const phi = Math.atan((k.y[r] - k.y[l]) / DXL);
    Q[f] = h * Math.sin(2 * (a - phi));
  }
  // Ränder: links kommt nichts herein; rechts geht es in den Haken, nie zurück.
  if (Q[0] > 0) Q[0] = 0;
  if (Q[ZELLEN] < 0) Q[ZELLEN] = 0;
  // Buhnen sperren den Teil der Brandungszone, der landwärts ihrer Spitze liegt.
  for (const b of k.buhnen) {
    const luv = Q[b.f] > 0 ? b.f - 1 : b.f;
    const gesperrt = Math.max(0, Math.min(1, (b.spitze - k.y[Math.max(0, Math.min(ZELLEN - 1, luv))]) / BRANDUNG));
    Q[b.f] *= 1 - gesperrt;
  }
  return Q;
}

/** Zeitschritt dt in Stunden (≤ 24 für Stabilität) */
export function laengsSchritt(k: Laengs, H: number, winkelGrad: number, dt: number) {
  const Q = transport(k, H, winkelGrad);
  for (let i = 0; i < ZELLEN; i++) k.y[i] -= ((Q[i + 1] - Q[i]) * dt) / (D * DXL);
  k.haken += Math.max(0, Q[ZELLEN]) * dt;

  for (let i = 0; i < ZELLEN; i++) {
    const breite = k.y[i] - k.land[i];
    if (k.deckwerk[i]) {
      // Die Mauer hält die Linie — davor bleibt kein Strand.
      if (k.y[i] < k.land[i]) k.y[i] = k.land[i];
      continue;
    }
    if (istKliff(i)) {
      if (breite < 15) {
        const r = K_KLIFF * H * H * (1 - Math.max(0, breite) / 15) * dt;
        k.land[i] -= r;
        const sand = r * KLIFF_HOEHE * SANDANTEIL;
        k.y[i] += sand / D;
        k.geliefert += sand * DXL;
      }
    } else if (breite < 2) {
      // Kein Strand mehr: die Wellen nagen an der Düne
      const r = 2 - breite;
      k.land[i] -= r;
      k.y[i] += (r * DUENE_HOEHE) / D;
    }
  }

  for (const h of k.haeuser) {
    if (!h.weg && k.land[h.i] < h.y + 3) {
      h.weg = true;
      k.meldungen.push(`${h.name} ist verloren — die Düne davor ist weggespült.`);
    }
  }
  k.stunde += dt;
}

export function buhneSetzen(k: Laengs, zelle: number) {
  const f = Math.max(1, Math.min(ZELLEN - 1, Math.round(zelle)));
  if (k.buhnen.some(b => b.f === f)) return false;
  k.buhnen.push({ f, spitze: Math.max(k.y[f - 1], k.y[f]) + 40 });
  k.kosten += 0.3;
  return true;
}

export function deckwerkSetzen(k: Laengs, zelle: number) {
  const i = Math.max(0, Math.min(ZELLEN - 1, Math.round(zelle)));
  for (let j = Math.max(0, i - 2); j <= Math.min(ZELLEN - 1, i + 2); j++) {
    if (!k.deckwerk[j]) { k.deckwerk[j] = 1; k.kosten += 0.3; }
  }
}

/** 30 m Strand auf 100 m Länge aufspülen */
export function aufspuelen(k: Laengs, zelle: number) {
  const i0 = Math.round(zelle);
  let vol = 0;
  for (let j = i0 - 4; j <= i0 + 4; j++) {
    if (j < 0 || j >= ZELLEN) continue;
    const dy = 30 * Math.exp(-((j - i0) ** 2) / 6);
    k.y[j] += dy;
    vol += dy * D * DXL;
  }
  k.kosten += (vol * 5) / 1e6;
  return vol;
}

export function entfernen(k: Laengs, zelle: number) {
  const f = Math.round(zelle);
  k.buhnen = k.buhnen.filter(b => Math.abs(b.f - f) > 1);
  for (let j = Math.max(0, f - 2); j <= Math.min(ZELLEN - 1, f + 2); j++) k.deckwerk[j] = 0;
}

/** Länge des Hakens (m): der Sand baut einen 60 m breiten, 8 m tiefen Damm */
export function hakenLaenge(k: Laengs) { return k.haken / (8 * 60); }
