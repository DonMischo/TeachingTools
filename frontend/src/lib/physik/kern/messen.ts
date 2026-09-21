/**
 * Was sich an einem Aufbau messen lässt — und wie es auf den Messbus kommt.
 *
 * Im Baukasten gibt es keine Geräte mehr, die ihre eigenen Messwerte melden;
 * es gibt Teile und Verbinder, und der Löser weiß über jedes davon alles.
 * Diese Datei sagt, *was davon eine Messgröße ist*: die Höhe eines Gewichts,
 * die Kraft in einem Seil, das Moment in einer Achse, die Energie in einem
 * schwingenden Pendel. Jede Größe trägt ihre Einheit und, wo es eine gibt,
 * die Formel dahinter — denn im Unterricht ist die Formel die halbe Messung.
 *
 * Gelesen wird über `lies(welt)`; dadurch hängt hier nichts am Löser selbst,
 * und dieselbe Liste dient dem Auswählen, dem Aufzeichnen und dem Anzeigen.
 *
 * Aufgezeichnet wird alles auf einmal, nicht erst nach dem Ankreuzen: wer
 * einen Versuch laufen lässt, weiß vorher selten, welche Kurve er hinterher
 * sehen will — und ein zweiter Lauf ist nie ganz derselbe.
 */
import { G, grad, type AnzeigeEinheit, type Einheit } from "../einheiten";
import { Messbus, signalId, type SignalId } from "../messbus";
import type { Aufbau, Teil, Verbinder } from "./modell";
import { teilMasse, teilTyp } from "./teile";
import type { Welt } from "./welt";

export interface Messgroesse {
  id: SignalId;
  /** Woher der Wert kommt: »Massestück 2«, »Seil 1«. */
  quelle: string;
  /** Was gemessen wird: »Höhe«, »Seilkraft«. */
  name: string;
  einheit: Einheit;
  anzeige?: AnzeigeEinheit;
  /** Die Formel dahinter, wenn es eine gibt. */
  formel?: string;
  lies: (w: Welt) => number | undefined;
}

/**
 * Teile und Verbinder haben keine Namen, nur Kennungen.
 *
 * Für die Liste zählt deshalb je Art durch: »Massestück 1«, »Massestück 2«.
 * Das ist das, was man auch auf dem Tisch sagen würde.
 */
function benenner() {
  const gezaehlt = new Map<string, number>();
  return (art: string, name: string) => {
    const n = (gezaehlt.get(art) ?? 0) + 1;
    gezaehlt.set(art, n);
    return `${name} ${n}`;
  };
}

/** Unter einem Tausendstel gilt als Ruhe — sonst zittert jedes liegende Teil. */
const still = (x: number) => (Math.abs(x) < 1e-3 ? 0 : x);

function fuerTeil(t: Teil, quelle: string): Messgroesse[] {
  const masse = teilMasse(t);
  const g = (schluessel: string, name: string, einheit: Einheit, lies: (w: Welt) => number | undefined,
    formel?: string, anzeige?: AnzeigeEinheit): Messgroesse =>
    ({ id: signalId(t.id, schluessel), quelle, name, einheit, anzeige, formel, lies });

  return [
    g("y", "Höhe", "m", w => w.zustand(t.id)?.y),
    g("x", "Ort waagerecht", "m", w => w.zustand(t.id)?.x),
    g("v", "Geschwindigkeit", "m/s", w => {
      const z = w.zustand(t.id);
      return z && still(Math.hypot(z.vx, z.vy));
    }),
    g("vy", "Geschwindigkeit senkrecht", "m/s", w => {
      const z = w.zustand(t.id);
      return z && still(z.vy);
    }),
    g("drehung", "Drehung", "rad", w => w.zustand(t.id)?.umdrehung, undefined, "grad"),
    g("omega", "Winkelgeschwindigkeit", "1/s", w => {
      const z = w.zustand(t.id);
      return z && still(z.omega);
    }),
    g("ekin", "Bewegungsenergie", "J", w => {
      const z = w.zustand(t.id);
      if (!z) return undefined;
      const v = still(Math.hypot(z.vx, z.vy)), omega = still(z.omega);
      return 0.5 * masse * v * v + 0.5 * w.traegheit(t.id) * omega * omega;
    }, "E = ½·m·v² + ½·J·ω²"),
    g("epot", "Lageenergie", "J", w => {
      const z = w.zustand(t.id);
      return z && masse * G * Math.max(0, z.y);
    }, "E = m·g·h"),
  ];
}

function fuerVerbinder(v: Verbinder, quelle: string): Messgroesse[] {
  const g = (schluessel: string, name: string, einheit: Einheit, lies: (w: Welt) => number | undefined,
    formel?: string): Messgroesse =>
    ({ id: signalId(v.id, schluessel), quelle, name, einheit, formel, lies });

  const kraftName = v.art === "seil" ? "Seilkraft" : v.art === "feder" ? "Federkraft" : "Kraft im Lager";
  const groessen = [g("kraft", kraftName, "N", w => w.kraft(v.id)?.betrag)];
  if (v.art === "achse" || v.art === "schraube") {
    groessen.push(g("moment", "Drehmoment", "Nm", w => w.kraft(v.id)?.moment));
  }
  if (v.art === "seil" || v.art === "feder") {
    groessen.push(g("laenge", "Länge", "m", w => {
      const bahn = w.seilBahn(v.id);
      if (bahn) {
        let s = 0;
        for (let i = 0; i + 1 < bahn.length; i++) s += Math.hypot(bahn[i + 1].x - bahn[i].x, bahn[i + 1].y - bahn[i].y);
        return s;
      }
      const enden = w.verbinderEnden(v.id);
      return enden && Math.hypot(enden[1].x - enden[0].x, enden[1].y - enden[0].y);
    }));
  }
  return groessen;
}

/** Alles, was sich an diesem Aufbau messen lässt — in der Reihenfolge des Aufbaus. */
export function messgroessen(aufbau: Aufbau): Messgroesse[] {
  const nenne = benenner();
  const aus: Messgroesse[] = [];
  for (const t of aufbau.teile) {
    aus.push(...fuerTeil(t, nenne(t.art, teilTyp(t.art)?.name ?? t.art)));
  }
  for (const v of aufbau.verbinder) {
    aus.push(...fuerVerbinder(v, nenne(v.art, v.art[0].toUpperCase() + v.art.slice(1))));
  }
  return aus;
}

/** Wie oft je Sekunde ein Wert festgehalten wird. */
export const MESSTAKT = 1 / 30;

/**
 * Schreibt die Messgrößen eines Versuchs mit.
 *
 * Nicht bei jedem Rechenschritt: 60 Werte je Sekunde und Größe füllen den
 * Speicher viermal so schnell, ohne dass eine Kurve dadurch anders aussähe.
 * Was älter ist als der Vorrat, fällt vorn heraus — ein Labor, das eine
 * Schulstunde lang offensteht, soll den Browser nicht auffressen.
 */
export class Schreiber {
  readonly bus = new Messbus(4096);
  private naechste = 0;

  constructor(private readonly groessen: Messgroesse[]) {}

  /** Nimmt einen Punkt, wenn seit dem letzten genug Zeit vergangen ist. */
  nimmAuf(w: Welt) {
    // Auf einem festen Raster, nicht vom letzten Punkt aus: zwei Takte von je
    // 1/60 sind in Fließkomma um ein Haar kürzer als 1/30, und dann fiele jeder
    // dritte Punkt aus.
    if (w.t + 1e-9 < this.naechste) return;
    this.naechste += MESSTAKT;
    const werte: [SignalId, number][] = [];
    for (const m of this.groessen) {
      const x = m.lies(w);
      if (x !== undefined && Number.isFinite(x)) werte.push([m.id, x]);
    }
    this.bus.schreibe(w.t, werte);
  }
}

/** Die aufgezeichneten Größen als CSV — Zeit in der ersten Spalte. */
export function alsCsv(bus: Messbus, groessen: Messgroesse[]): string {
  const verlaeufe = groessen.map(m => bus.verlauf(m.id));
  const zeit = verlaeufe.find(v => v && v.t.length)?.t ?? [];
  const kopf = ["t (s)", ...groessen.map(m => {
    const einheit = m.anzeige === "grad" ? "°" : m.einheit;
    return `${m.quelle} ${m.name}${einheit ? ` (${einheit})` : ""}`;
  })];
  const zeilen = zeit.map((t, i) => [
    t.toFixed(3),
    ...verlaeufe.map((v, k) => {
      const roh = v?.v[i];
      if (roh === undefined) return "";
      return (groessen[k].anzeige === "grad" ? grad(roh) : roh).toFixed(6);
    }),
  ].join(";"));
  return [kopf.join(";"), ...zeilen].join("\n");
}
