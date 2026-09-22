/**
 * Der Stromkreis des Baukastens.
 *
 * Die Bauteile sind Teile wie alle anderen — sie hängen an der Wand, haben
 * Masse und fallen herunter, wenn man die Schraube löst. Elektrisch haben sie
 * zwei Anschlüsse, links und rechts, und ein **Kabel ist kein Bauteil**: was
 * es verbindet, ist derselbe Knoten. Mehr braucht es nicht, damit eine
 * Reihenschaltung eine Reihenschaltung ist.
 *
 * Gerechnet wird mit dem Netz aus `netz.ts` — demselben, das die Wärme trägt.
 * Hier steht nur, welches Bauteil welche Zweige stempelt:
 *
 * - Widerstand und Lämpchen: ein Leitwert.
 * - Batterie: eine Quelle, mit Innenwiderstand in Reihe — dann bricht die
 *   Klemmenspannung unter Last ein, und genau das soll man messen können.
 * - Schalter: geschlossen ein Draht (eine Quelle mit null Volt, deren Strom
 *   damit mit herausfällt), offen gar nichts.
 * - Motor: Ankerwiderstand und Gegenspannung k·ω in Reihe. Dieselbe Konstante
 *   steht im Moment M = k·I — deshalb *ist* ein Motor, den man dreht, ein
 *   Dynamo, ohne dass dafür ein zweites Bauteil nötig wäre.
 *
 * Vorzeichen, einmal für alles: **U = V(rechts) − V(links)**, und **I fließt
 * positiv von rechts nach links durch das Bauteil**. Ein Widerstand hat dann
 * beides gleichsinnig, und P = U·I ist positiv, solange er aufnimmt; eine
 * Batterie, die liefert, hat P < 0. Wer den abgegebenen Strom anzeigen will,
 * dreht das Zeichen — das tut die Anzeige, nicht die Rechnung.
 */
import { Knotenzaehler, loeseNetz, type Zweig } from "./netz";
import type { Aufbau, Teil } from "./modell";
import { istElektrisch, polAn } from "./teile";

/** Was ein Bauteil gerade tut. */
export interface Messung {
  /** Spannung über dem Bauteil in Volt: rechts minus links. */
  spannung: number;
  /** Strom in Ampere, positiv von rechts nach links durch das Bauteil. */
  strom: number;
  /** Leistung in Watt: positiv aufgenommen, negativ abgegeben. */
  leistung: number;
}

const LEER: Messung = { spannung: 0, strom: 0, leistung: 0 };
const wert = (t: Teil, k: string, ersatz: number) => t.werte[k] ?? ersatz;

export class Stromkreis {
  private teile: Teil[];
  /** Knotennummer je `${teilId}.${pol}`. */
  private knoten = new Map<string, number>();
  private anzahlKnoten = 0;
  /** Zusätzliche Knoten zwischen Quelle und Innenwiderstand beziehungsweise Anker. */
  private innen = new Map<string, number>();
  private messungen = new Map<string, Messung>();

  constructor(aufbau: Aufbau) {
    this.teile = aufbau.teile.filter(t => istElektrisch(t.art));
    const anschluesse = new Set(this.teile.flatMap(t => [`${t.id}.0`, `${t.id}.1`]));
    const zaehler = new Knotenzaehler();
    for (const a of anschluesse) zaehler.melde(a);
    for (const v of aufbau.verbinder) {
      if (v.art !== "kabel" || v.a.teil === null || v.b.teil === null) continue;
      const a = `${v.a.teil}.${polAn(v.a.punkt)}`, b = `${v.b.teil}.${polAn(v.b.punkt)}`;
      if (anschluesse.has(a) && anschluesse.has(b)) zaehler.verbinde(a, b);
    }
    // Masse ist der Minuspol der ersten Batterie — irgendein Punkt muss null
    // sein, und an den hängt man im Unterricht das schwarze Kabel.
    const masse = this.teile.find(t => t.art === "batterie");
    this.knoten = zaehler.nummern(masse ? `${masse.id}.0` : undefined);
    this.anzahlKnoten = new Set(this.knoten.values()).size;

    let naechster = this.anzahlKnoten;
    for (const t of this.teile) {
      if (t.art === "motor" || (t.art === "batterie" && wert(t, "innenwiderstand", 0) > 0)) {
        this.innen.set(t.id, naechster++);
      }
    }
    this.anzahlKnoten = naechster;
  }

  /** Ob überhaupt etwas Elektrisches dasteht. */
  get leer(): boolean {
    return this.teile.length === 0;
  }

  private nr(teil: string, pol: 0 | 1): number {
    return this.knoten.get(`${teil}.${pol}`) ?? -1;
  }

  /**
   * Rechnet den Kreis neu.
   *
   * Die Werte kommen von außen, weil sich im Versuch etwas an ihnen ändern
   * darf: der Schalter wird umgelegt, die Spannung hochgedreht. Und die
   * Drehzahl kommt aus der Mechanik — das ist die ganze Kopplung.
   */
  rechne(werte: (id: string) => Record<string, number>, drehzahl: (id: string) => number) {
    this.messungen.clear();
    if (this.leer) return;

    const zweige: Zweig[] = [];
    const ohmsch: { teil: string; ohm: number }[] = [];
    /** Bauteile, deren Strom aus dem Zweigstrom einer Quelle abfällt. */
    const ueberQuelle: string[] = [];

    for (const t of this.teile) {
      const v = { ...t.werte, ...werte(t.id) };
      const links = this.nr(t.id, 0), rechts = this.nr(t.id, 1);
      if (links < 0 || rechts < 0) continue;

      if (t.art === "widerstand" || t.art === "lampe") {
        const ohm = Math.max(1e-6, v.widerstand ?? 1);
        zweige.push({ art: "leitwert", a: links, b: rechts, wert: 1 / ohm });
        ohmsch.push({ teil: t.id, ohm });
      } else if (t.art === "schalter") {
        if ((v.geschlossen ?? 1) >= 0.5) {
          zweige.push({ art: "quelle", a: rechts, b: links, wert: 0, id: t.id });
          ueberQuelle.push(t.id);
        }
      } else if (t.art === "batterie") {
        const zwischen = this.innen.get(t.id);
        const ri = v.innenwiderstand ?? 0;
        if (ri > 0 && zwischen !== undefined) {
          zweige.push({ art: "leitwert", a: rechts, b: zwischen, wert: 1 / ri });
          zweige.push({ art: "quelle", a: zwischen, b: links, wert: v.spannung ?? 0, id: t.id });
        } else {
          zweige.push({ art: "quelle", a: rechts, b: links, wert: v.spannung ?? 0, id: t.id });
        }
        ueberQuelle.push(t.id);
      } else if (t.art === "motor") {
        const zwischen = this.innen.get(t.id)!;
        const ra = Math.max(1e-6, v.widerstand ?? 1);
        zweige.push({ art: "leitwert", a: rechts, b: zwischen, wert: 1 / ra });
        zweige.push({ art: "quelle", a: zwischen, b: links, wert: (v.konstante ?? 0) * drehzahl(t.id), id: t.id });
        ueberQuelle.push(t.id);
      }
    }

    const loesung = loeseNetz({ knoten: this.anzahlKnoten, zweige });
    const spannung = (teil: string) =>
      (loesung.potenzial[this.nr(teil, 1)] ?? 0) - (loesung.potenzial[this.nr(teil, 0)] ?? 0);

    for (const teil of ueberQuelle) {
      const u = spannung(teil), i = loesung.strom.get(teil) ?? 0;
      this.messungen.set(teil, { spannung: u, strom: i, leistung: u * i });
    }
    for (const { teil, ohm } of ohmsch) {
      const u = spannung(teil);
      this.messungen.set(teil, { spannung: u, strom: u / ohm, leistung: (u * u) / ohm });
    }
  }

  messung(teil: string): Messung {
    return this.messungen.get(teil) ?? LEER;
  }

  /**
   * Das Moment, das ein Motor abgibt, in Newtonmetern.
   *
   * M = k · I, dieselbe Konstante wie in der Gegenspannung. Wer die Welle von
   * Hand dreht, bekommt daraus von selbst die Bremskraft eines Dynamos.
   */
  moment(t: Teil): number {
    if (t.art !== "motor") return 0;
    return wert(t, "konstante", 0) * this.messung(t.id).strom;
  }
}
