/**
 * Licht im Baukasten: Strahlen, die irgendwo ankommen.
 *
 * Optik ist der einzige Bereich ohne eigene Zeitachse — ein Strahl braucht
 * keine Sekunde, er ist da. Gerechnet wird deshalb nicht »ein Takt Licht«,
 * sondern bei jedem Takt die ganze Bahn neu: vom Strahler los, durch Linsen
 * gebrochen, an Spiegeln geworfen, bis sie auf etwas Undurchsichtiges trifft.
 * Dort endet der Strahl und gibt seine Leistung ab — **und genau dort hängt die
 * Optik an der Wärme**. Ein Brennglas, das ein Brett anwärmt, ist keine eigene
 * Fallunterscheidung, sondern fällt aus beidem zusammen heraus.
 *
 * Die Linse ist die dünne Linse des Schulbuchs: ein Strahl, der sie in der
 * Höhe h über der Achse trifft, wird um h/f zur Achse hin abgelenkt. Das ist
 * paraxial gedacht und weit außen entsprechend ungenau — dafür kommt die
 * Brennweite heraus, die auf dem Glas steht, und die Abbildungsgleichung
 * 1/g + 1/b = 1/f stimmt.
 */
import type { Punkt } from "../typen";
import type { Aufbau, Teil } from "./modell";
import { teilTyp, type Form } from "./teile";

/** Wie oft ein Strahl gebrochen oder geworfen werden darf, ehe er aufgibt. */
const UMWEGE = 12;
/** Wie weit ein Strahl läuft, der nirgends ankommt, in Metern. */
const WEIT = 30;
/** Näher als das gilt als »derselbe Punkt« — sonst trifft ein Strahl seine Linse erneut. */
const RAUS = 1e-4;

/** Die optischen Teile: sie lenken Licht um, statt es zu schlucken. */
export const OPTISCHE_ARTEN = new Set(["linse", "spiegel"]);
/** Teile, die Licht aussenden. */
export const LEUCHTENDE_ARTEN = new Set(["strahler", "lampe"]);
export const istOptisch = (art: string) => OPTISCHE_ARTEN.has(art);
export const istLeuchte = (art: string) => LEUCHTENDE_ARTEN.has(art);

/** Ein Stück Strahlbahn, wie es gezeichnet wird. */
export interface Strahlstueck {
  von: Punkt;
  nach: Punkt;
  /** Leistung in Watt — daraus wird die Helligkeit. */
  leistung: number;
}

export interface Lage {
  pos: Punkt;
  winkel: number;
}

const dreh = (p: Punkt, c: number, s: number): Punkt => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
const nachLokal = (p: Punkt, l: Lage): Punkt =>
  dreh({ x: p.x - l.pos.x, y: p.y - l.pos.y }, Math.cos(-l.winkel), Math.sin(-l.winkel));
const nachWelt = (p: Punkt, l: Lage): Punkt => {
  const d = dreh(p, Math.cos(l.winkel), Math.sin(l.winkel));
  return { x: d.x + l.pos.x, y: d.y + l.pos.y };
};

/**
 * Wo ein Strahl eine Gestalt trifft — im Koordinatensystem des Teils.
 *
 * Die Kapsel wird dabei wie ein Kasten gleicher Ausdehnung behandelt. Für die
 * Frage, ob eine Stange den Strahl abfängt, genügt das; ihre runden Enden
 * würden den Schattenrand um Millimeter verschieben.
 */
function trefferAufForm(f: Form, p: Punkt, d: Punkt): number | null {
  if (f.art === "kreis") {
    const mx = p.x - f.mitte.x, my = p.y - f.mitte.y;
    const b = 2 * (mx * d.x + my * d.y);
    const c = mx * mx + my * my - f.r * f.r;
    const unter = b * b - 4 * c;
    if (unter < 0) return null;
    const wurzel = Math.sqrt(unter);
    for (const t of [(-b - wurzel) / 2, (-b + wurzel) / 2]) if (t > RAUS) return t;
    return null;
  }

  const [b, h, mitte, winkel] = f.art === "kasten"
    ? [f.b, f.h, f.mitte, f.winkel ?? 0]
    : [Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y) + 2 * f.r, 2 * f.r,
      { x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 }, Math.atan2(f.b.y - f.a.y, f.b.x - f.a.x)];

  const c0 = Math.cos(-winkel), s0 = Math.sin(-winkel);
  const q = dreh({ x: p.x - mitte.x, y: p.y - mitte.y }, c0, s0);
  const r = dreh(d, c0, s0);

  let nah = -Infinity, fern = Infinity;
  for (const [o, richtung, halb] of [[q.x, r.x, b / 2], [q.y, r.y, h / 2]] as const) {
    if (Math.abs(richtung) < 1e-12) {
      if (Math.abs(o) > halb) return null;
      continue;
    }
    const t1 = (-halb - o) / richtung, t2 = (halb - o) / richtung;
    nah = Math.max(nah, Math.min(t1, t2));
    fern = Math.min(fern, Math.max(t1, t2));
  }
  if (nah > fern || fern < RAUS) return null;
  return nah > RAUS ? nah : fern;
}

/** Die Strecke, die eine Linse oder ein Spiegel einnimmt — in Teilkoordinaten. */
function flaeche(t: Teil): [Punkt, Punkt] {
  const halb = Math.max(0.01, (t.werte.durchmesser ?? 0.1) / 2);
  return [{ x: 0, y: -halb }, { x: 0, y: halb }];
}

/** Wo ein Strahl eine Strecke trifft: Abstand und Höhe auf ihr. */
function trefferAufStrecke(p: Punkt, d: Punkt, a: Punkt, b: Punkt): { t: number; hoehe: number } | null {
  const ex = b.x - a.x, ey = b.y - a.y;
  const nenner = d.x * ey - d.y * ex;
  if (Math.abs(nenner) < 1e-12) return null;
  const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / nenner;
  const u = ((a.x - p.x) * d.y - (a.y - p.y) * d.x) / nenner;
  if (t <= RAUS || u < 0 || u > 1) return null;
  const laenge = Math.hypot(ex, ey);
  return { t, hoehe: (u - 0.5) * laenge };
}

export class Optik {
  private bahnen: Strahlstueck[] = [];
  private aufnahme = new Map<string, number>();

  constructor(private aufbau: Aufbau) {}

  /**
   * Verfolgt alle Strahlen neu.
   *
   * `leistung` sagt, wie viel Licht eine Leuchte gerade abgibt — beim Lämpchen
   * und beim Strahler ist das ihre elektrische Leistung. Ohne Strom ist es
   * dunkel, und das ist die zweite Brücke: Optik hängt am Stromkreis.
   */
  rechne(lage: (id: string) => Lage, leistung: (id: string) => number) {
    this.bahnen = [];
    this.aufnahme.clear();
    for (const quelle of this.aufbau.teile) {
      if (!istLeuchte(quelle.art)) continue;
      const p = leistung(quelle.id);
      if (p <= 1e-6) continue;
      for (const [start, richtung, anteil] of this.strahlenVon(quelle, lage(quelle.id), p)) {
        this.verfolge(start, richtung, anteil, lage, quelle.id);
      }
    }
  }

  /** Die Strahlen, mit denen eine Leuchte anfängt. */
  private strahlenVon(t: Teil, l: Lage, leistung: number): [Punkt, Punkt, number][] {
    const aus: [Punkt, Punkt, number][] = [];
    if (t.art === "lampe") {
      // Ein Lämpchen strahlt rundum; in der Ebene verteilt sich seine Leistung
      // auf den Umfang, nicht auf die Kugelfläche.
      const n = 16;
      for (let i = 0; i < n; i++) {
        const w = l.winkel + (i / n) * 2 * Math.PI;
        aus.push([l.pos, { x: Math.cos(w), y: Math.sin(w) }, leistung / n]);
      }
      return aus;
    }
    const n = Math.max(1, Math.round(t.werte.strahlen ?? 5));
    const breite = t.werte.breite ?? 0.06;
    const oeffnung = t.werte.oeffnung ?? 0;
    for (let i = 0; i < n; i++) {
      const anteil = n === 1 ? 0 : i / (n - 1) - 0.5;
      const start = nachWelt({ x: 0, y: anteil * breite }, l);
      const w = l.winkel + anteil * oeffnung;
      aus.push([start, { x: Math.cos(w), y: Math.sin(w) }, leistung / n]);
    }
    return aus;
  }

  private verfolge(start: Punkt, richtung: Punkt, leistung: number, lage: (id: string) => Lage, quelle: string) {
    let p = start, d = richtung, zuletzt = quelle;

    for (let schritt = 0; schritt < UMWEGE; schritt++) {
      let bestes: { t: number; teil: Teil; hoehe: number } | null = null;

      for (const t of this.aufbau.teile) {
        if (t.id === zuletzt || istLeuchte(t.art)) continue;
        const l = lage(t.id);
        const lp = nachLokal(p, l);
        const c = Math.cos(-l.winkel), s = Math.sin(-l.winkel);
        const ld = dreh(d, c, s);

        if (istOptisch(t.art)) {
          const [a, b] = flaeche(t);
          const treffer = trefferAufStrecke(lp, ld, a, b);
          if (treffer && (!bestes || treffer.t < bestes.t)) bestes = { t: treffer.t, teil: t, hoehe: treffer.hoehe };
          continue;
        }
        for (const f of teilTyp(t.art)?.formen(t) ?? []) {
          const tt = trefferAufForm(f, lp, ld);
          if (tt !== null && (!bestes || tt < bestes.t)) bestes = { t: tt, teil: t, hoehe: 0 };
        }
      }

      if (!bestes) {
        this.bahnen.push({ von: p, nach: { x: p.x + d.x * WEIT, y: p.y + d.y * WEIT }, leistung });
        return;
      }

      const ziel = { x: p.x + d.x * bestes.t, y: p.y + d.y * bestes.t };
      this.bahnen.push({ von: p, nach: ziel, leistung });

      const l = lage(bestes.teil.id);
      if (bestes.teil.art === "linse") {
        // Dünne Linse: die Ablenkung hängt nur von der Höhe über der Achse ab.
        const f = bestes.teil.werte.brennweite ?? 0.2;
        const ld = dreh(d, Math.cos(-l.winkel), Math.sin(-l.winkel));
        const vorwaerts = Math.sign(ld.x) || 1;
        const winkel = Math.atan2(ld.y * vorwaerts, ld.x * vorwaerts) - bestes.hoehe / (f || 1e-6);
        const neu = { x: Math.cos(winkel) * vorwaerts, y: Math.sin(winkel) * vorwaerts };
        d = dreh(neu, Math.cos(l.winkel), Math.sin(l.winkel));
      } else if (bestes.teil.art === "spiegel") {
        // Die Spiegelfläche liegt in der y-Achse des Teils, ihre Normale ist x.
        const n = dreh({ x: 1, y: 0 }, Math.cos(l.winkel), Math.sin(l.winkel));
        const skalar = 2 * (d.x * n.x + d.y * n.y);
        d = { x: d.x - skalar * n.x, y: d.y - skalar * n.y };
      } else {
        this.aufnahme.set(bestes.teil.id, (this.aufnahme.get(bestes.teil.id) ?? 0) + leistung);
        return;
      }
      p = ziel;
      zuletzt = bestes.teil.id;
    }
  }

  /** Alle Strahlstücke — zum Zeichnen. */
  strahlen(): Strahlstueck[] {
    return this.bahnen;
  }

  /** Wie viel Strahlungsleistung ein Teil gerade aufnimmt, in Watt. */
  aufgenommen(teil: string): number {
    return this.aufnahme.get(teil) ?? 0;
  }
}
