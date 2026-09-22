/**
 * Das Wärmenetz — dasselbe Netz wie der Stromkreis, mit anderen Namen.
 *
 * Temperatur statt Spannung, Wärmestrom statt Strom, Wärmeleitwert statt
 * Leitwert, Wärmekapazität statt Kapazität. Wer den Stromkreis verstanden hat,
 * hat das hier verstanden; und weil `netz.ts` von Bauteilen nichts weiß, war
 * für diese Phase kein neuer Löser nötig, sondern nur eine Übersetzung.
 *
 * Gerechnet wird in **Übertemperatur**: Knoten 0 ist die Umgebung und liegt
 * fest bei null. Was der Löser ausgibt, ist also ΔT über Raumtemperatur — die
 * absolute Temperatur kommt erst bei der Anzeige dazu. Das erspart eine
 * Quelle, die sonst in jedem Netz stünde.
 *
 * Die Trägheit steckt im Begleitmodell des Kondensators: eine Wärmekapazität C
 * wird für einen Takt zu einem Leitwert C/Δt gegen die Umgebung und einer
 * Quelle, die C/Δt · ΔT(vorher) einspeist. Das ist das implizite Euler-
 * Verfahren — es bleibt auch dann stabil, wenn ein kleines Teil mit großer
 * Leistung geheizt wird, und genau dort würde ein explizites davonlaufen.
 */
import { loeseNetz, type Zweig } from "./netz";
import { feststoff } from "../material";
import type { Aufbau, Teil } from "./modell";
import { istElektrisch, teilMasse, teilTyp } from "./teile";

/** Raumtemperatur in Kelvin — worauf sich alles einpendelt. */
export const UMGEBUNG = 293.15;

/**
 * Wärmeübergang an ruhende Luft, in W/(m²·K).
 *
 * Freie Konvektion an einem Körper im Zimmer liegt bei 5 bis 25; zehn ist der
 * Wert, mit dem man im Unterricht rechnet.
 */
const LUFT = 10;

/**
 * Wärmeleitwert einer Schraub- oder Achsverbindung, in W/K.
 *
 * Abgeschätzt wie eine Stahlbrücke von einem Quadratzentimeter über einen
 * Zentimeter: λ·A/L = 50 · 1e-4 / 0,01 = 0,5 W/K. Seil, Feder und Kabel leiten
 * dagegen so wenig, dass sie hier gar nicht vorkommen.
 */
const KONTAKT = 0.5;

/** Spezifische Wärmekapazität eines Teils in J/(kg·K). */
function spezifischeWaerme(t: Teil): number {
  // Messing beim Massestück, Gehäusekunststoff bei den elektrischen Bauteilen —
  // beides hat keine Werkstoffwahl, also steht die Zahl hier.
  if (t.art === "massestueck") return 380;
  if (istElektrisch(t.art)) return 1000;
  return feststoff(t.werte.stoff ?? 0).waerme;
}

/**
 * Die Oberfläche eines Teils in m², abgeschätzt als Würfel gleichen Volumens.
 *
 * Genauer wäre es, jede Gestalt abzuwickeln; für die Frage, wie schnell etwas
 * auskühlt, hängt das Ergebnis aber viel stärker an der Konvektionszahl, die
 * ohnehin nur auf ein Vielfaches genau bekannt ist.
 */
function oberflaecheM2(t: Teil): number {
  const v = Math.max(1e-9, teilTyp(t.art)?.volumen(t) ?? 1e-6);
  return 6 * Math.cbrt(v) ** 2;
}

export class Waermenetz {
  private teile: Teil[];
  private nr = new Map<string, number>();
  /** Übertemperatur über der Umgebung, je Teil in Kelvin. */
  private ueber = new Map<string, number>();
  private kapazitaet = new Map<string, number>();
  private anLuft = new Map<string, number>();
  private kontakte: [number, number][] = [];

  constructor(aufbau: Aufbau) {
    this.teile = aufbau.teile;
    this.teile.forEach((t, i) => {
      this.nr.set(t.id, i + 1);
      this.ueber.set(t.id, 0);
      this.kapazitaet.set(t.id, Math.max(1e-3, teilMasse(t) * spezifischeWaerme(t)));
      this.anLuft.set(t.id, LUFT * oberflaecheM2(t));
    });
    for (const v of aufbau.verbinder) {
      if (v.art !== "schraube" && v.art !== "achse") continue;
      const a = v.a.teil === null ? 0 : this.nr.get(v.a.teil);
      const b = v.b.teil === null ? 0 : this.nr.get(v.b.teil);
      // Die Wand ist Knoten 0: was an ihr festgeschraubt ist, gibt dorthin ab.
      if (a !== undefined && b !== undefined && a !== b) this.kontakte.push([a, b]);
    }
  }

  /**
   * Ein Takt.
   *
   * `leistung` sagt, wie viel Wärme in einem Teil gerade entsteht — in Watt,
   * und nur das, was wirklich in Wärme übergeht: am Widerstand die ganze
   * elektrische Leistung, am Motor nur der Anteil im Anker, denn der Rest
   * verlässt ihn als Drehmoment.
   */
  rechne(dt: number, leistung: (id: string) => number) {
    if (!this.teile.length) return;
    const zweige: Zweig[] = [];
    for (const t of this.teile) {
      const k = this.nr.get(t.id)!;
      const c = this.kapazitaet.get(t.id)! / dt;
      zweige.push({ art: "leitwert", a: 0, b: k, wert: c });
      zweige.push({ art: "strom", a: 0, b: k, wert: c * (this.ueber.get(t.id) ?? 0) });
      zweige.push({ art: "leitwert", a: 0, b: k, wert: this.anLuft.get(t.id)! });
      const p = leistung(t.id);
      if (p > 0) zweige.push({ art: "strom", a: 0, b: k, wert: p });
    }
    for (const [a, b] of this.kontakte) zweige.push({ art: "leitwert", a, b, wert: KONTAKT });

    const l = loeseNetz({ knoten: this.teile.length + 1, zweige });
    for (const t of this.teile) this.ueber.set(t.id, l.potenzial[this.nr.get(t.id)!] ?? 0);
  }

  /** Die Temperatur eines Teils in Kelvin. */
  temperatur(teil: string): number {
    return UMGEBUNG + (this.ueber.get(teil) ?? 0);
  }

  /** Wie weit ein Teil über der Umgebung liegt, in Kelvin. */
  uebertemperatur(teil: string): number {
    return this.ueber.get(teil) ?? 0;
  }

  /** Die gespeicherte Wärme eines Teils über der Umgebung, in Joule. */
  waermemenge(teil: string): number {
    return (this.kapazitaet.get(teil) ?? 0) * (this.ueber.get(teil) ?? 0);
  }

  /** Die Wärmekapazität eines Teils in J/K — Masse mal spezifischer Wärme. */
  kapazitaetVon(teil: string): number {
    return this.kapazitaet.get(teil) ?? 0;
  }
}
