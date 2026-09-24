/**
 * Was die Verkehrs-Simulation über die Leitung schickt, und die Schnittstelle,
 * über die das Spielfeld mit dem Live-Raum spricht. Ohne Sitzung (Lehrkraft
 * probiert allein) gibt es einen Solo-Raum, der dieselbe Schnittstelle bedient.
 */
import type { Fahrzeug } from "./autos";
import type { GestenId } from "./gesten";

export type FremderSpieler = {
  key: string; name: string; x: number; y: number; w: number; farbe: number; punkte: number;
  strafeBis: number; karmaBis: number; hand: number; mitfahrt: boolean; lehrkraft: boolean;
  verstoesse: Record<string, number>;
};

/** Ein Fahrzeug, wie es der Taktgeber verschickt: [id, art, farbe, x, y, winkel, tempo, haltSeit, haltRi]. */
export type Gepackt = [number, 0 | 1, number, number, number, number, number, number, number];

const r2 = (v: number) => Math.round(v * 100) / 100;

export function packe(f: Fahrzeug): Gepackt {
  return [f.id, f.art === "bus" ? 1 : 0, f.farbe, r2(f.x), r2(f.y), r2(f.winkel), r2(f.tempo), f.haltSeit ?? -1, f.haltRi ?? -1];
}

/** Aus dem Paket ein Fahrzeug, das zum Zeichnen, für Türen und Unfälle reicht. */
export function entpacke(g: Gepackt, bus: { laenge: number; breite: number }): Fahrzeug {
  const [id, art, farbe, x, y, winkel, tempo, haltSeit, haltRi] = g;
  return {
    id, art: art ? "bus" : "auto", farbe, x, y, winkel, tempo,
    laenge: art ? bus.laenge : 4.4, breite: art ? bus.breite : 1.8,
    kante: 0, s: 0, naechste: null, hupe: 0, wartetBis: 0,
    haltSeit: haltSeit >= 0 ? haltSeit : null, haltRi: haltRi >= 0 ? haltRi : undefined,
  };
}

/** Kürzester Weg zwischen zwei Winkeln — damit ein Auto beim Glätten nicht einmal herumdreht. */
export function winkelZu(von: number, nach: number, f: number): number {
  const d = ((nach - von + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return von + d * f;
}

/** Die Schnittstelle zum Live-Raum. Wird jedes Bild gelesen, darf also nichts neu rendern. */
export type Netz = {
  /** Gemeinsame Uhr in Sekunden. */
  uhr(): number;
  /** Rechnet dieser Browser die Autos? */
  taktgeber(): boolean;
  /** Mein Schlüssel im Raum (null solo / noch nicht verbunden). */
  ich(): string | null;
  andere(): FremderSpieler[];
  /** Neueste Fahrzeugliste des Taktgebers (null, solange keine da ist). */
  fahrzeuge(): Gepackt[] | null;
  taster(): Map<number, number>;
  beleidigungen(): boolean;
  /** Gesten anderer: neueste je Spieler. */
  gesten(): Map<string, { id: GestenId; t: number }>;
  /** Eigene Strafe (Polizei), vom Server verhängt. */
  strafe(): { bis: number; karmaBis: number } | null;

  sendeIch(x: number, y: number, w: number, mitfahrt: boolean, farbe: number): void;
  sendeGeste(id: GestenId): void;
  sendeTaster(anlage: number): void;
  sendeVerkehr(f: Gepackt[]): void;
  sendeMeldung(id: string, punkte: number): void;
};

/** Allein spielen: eigene Uhr, eigener Verkehr, Beleidigung bestraft sich selbst. */
export function soloNetz(): Netz {
  const taster = new Map<number, number>();
  let strafe: { bis: number; karmaBis: number } | null = null;
  const uhr = () => Date.now() / 1000;
  return {
    uhr, taktgeber: () => true, ich: () => null, andere: () => [], fahrzeuge: () => null,
    taster: () => taster, beleidigungen: () => true, gesten: () => new Map(), strafe: () => strafe,
    sendeIch() {},
    sendeGeste(id) { if (id === "schimpfen") { const t = uhr(); strafe = { bis: t + 8, karmaBis: t + 60 }; } },
    sendeTaster(anlage) { const t = uhr(); if (t - (taster.get(anlage) ?? 0) > 25) taster.set(anlage, t); },
    sendeVerkehr() {},
    sendeMeldung() {},
  };
}
