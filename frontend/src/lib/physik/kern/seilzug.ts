/**
 * Ein Seil über Rollen — als *eine* Bedingung mit *einer* Seilkraft.
 *
 * Das ist der Punkt, an dem mehrere Anläufe gescheitert sind. Ein Seil aus
 * vielen kurzen Gliedern dehnt sich unter Last wie Gummi (2 kg an 20 Gliedern:
 * aus 1 m wurden 1,86 m). Starre Abstandsgelenke Strang für Strang sind
 * statisch unbestimmt — der Löser verteilt die Kraft beliebig auf die Stränge
 * und die lose Rolle zeigte 25,2 N statt 21,5 N. Und bindet man das Seil an
 * den Kranz der Rolle, kann es nicht mehr durchrutschen: eine Atwoodsche
 * Fallmaschine blieb nach 15 cm stehen.
 *
 * Physikalisch ist ein Seil über reibungsfreie Rollen aber nur *eine* Aussage:
 *
 *     |P₀P₁| + |P₁P₂| + … + |Pₙ₋₁Pₙ| = L
 *
 * — eine Zwangsbedingung, ein Lagrange-Faktor, also eine Kraft im ganzen Seil.
 * Genau das steht hier: die Punkte Pₖ sitzen auf Körpern (die Enden am Haken,
 * die inneren in der Mitte je einer Rolle), und ein Stoß entlang der Bahn hält
 * die Summe. Daraus folgt der Flaschenzug von selbst: an einer losen Rolle
 * greift die Seilkraft über den Umweg zweimal an, also hebt halbe Kraft.
 *
 * Gerechnet wird nach dem Schritt des Lösers, auf den Geschwindigkeiten (mit
 * einem Baumgarte-Anteil gegen das Auseinanderlaufen). Das Seil zieht nur: der
 * aufsummierte Stoß bleibt ≥ 0, sonst wird es schlaff.
 *
 * Die inneren Punkte liegen in der *Mitte* der Rolle, nicht am Kranz. Die Bahn
 * ist dadurch um den Bogen und die Tangentenstücke länger als die wirkliche —
 * aber um einen festen Betrag, solange der Umschlingungswinkel bleibt, und nur
 * Änderungen der Länge wirken. Für den üblichen Fall (Seil kehrt um 180° um)
 * ist die Rechnung damit exakt.
 *
 * Entscheidend für die Genauigkeit ist die *wirksame* Masse: wer daran zieht,
 * zieht an allem, was mit dem Angriffspunkt starr zusammenhängt. Deshalb
 * rechnet ein Verbund aus verschraubten und verachsten Teilen hier als *ein*
 * Körper (Masse addiert, Trägheit um den gemeinsamen Schwerpunkt), und was an
 * der Wand festsitzt, zählt gar nicht mit. Rechnete man stattdessen mit der
 * Masse des einzelnen Teils, käme eine viel zu große wirksame Masse heraus und
 * das Seil zöge zu schwach — ein Meter Seil dehnte sich dann um 15 cm.
 */
import * as b2 from "./box2d/PhaserBox2D.js";
import type { b2BodyId } from "./box2d/PhaserBox2D.js";
import type { Punkt } from "../typen";

/** Ein Punkt der Seilbahn: ein Körper und die Stelle auf ihm. */
export interface Seilknoten {
  /**
   * Der Verbund, zu dem der Körper gehört — Punkte mit demselben Schlüssel
   * ziehen an derselben Masse. Bei einem einzelnen Teil ist das seine Id.
   */
  schluessel: string;
  koerper: b2BodyId;
  lokal: Punkt;
  /** Halbmesser, wenn der Knoten eine Rolle ist — dann dreht sie sich mit dem Seil. */
  rolle?: number;
  /** Alle Körper des Verbunds, einschließlich des eigenen. */
  verbund?: b2BodyId[];
  /** Ob der Punkt festliegt, obwohl der Löser den Körper für beweglich hält. */
  fest?: boolean;
}

/**
 * Durchgänge je Takt.
 *
 * Die Lage ändert sich während des Takts nicht, also trifft der erste Durchgang
 * die Lösung schon genau; der zweite fängt nur den Fall ab, dass das Seil dabei
 * schlaff geworden ist und der Stoß auf null zurückfällt.
 */
const DURCHGAENGE = 2;
/**
 * Wie kräftig eine zu lange Bahn zurückgeholt wird.
 *
 * Gerechnet wird nach dem Schritt, die Lage ist also schon mit der Schwerkraft
 * des Takts verrückt: ein hängendes Gewicht sackt um etwa g·Δt²/BEIWERT durch.
 * 0,8 heißt rund 3 mm — darüber bringt Erhöhen nichts mehr.
 */
const BEIWERT = 0.8;
/** Darunter gilt die Bahn als richtig lang. */
const SCHLUPF = 0.001;
/** Höchstes Tempo, mit dem nachgeholt wird — sonst schnellt ein verschobener Aufbau. */
const MAX_HOLEN = 3;

/** Ein Verbund, wie ihn die Bedingung sieht: eine Masse, eine Trägheit, ein Hebel. */
interface Anteil {
  koerper: b2BodyId[];
  /** Die Schwerpunkte der einzelnen Körper — für die Verteilung des Stoßes. */
  schwerpunkte: Punkt[];
  /** Der gemeinsame Schwerpunkt. */
  mitte: Punkt;
  invM: number;
  invI: number;
  jx: number;
  jy: number;
  jw: number;
}

/** Was sich während eines Takts nicht ändert: die Lage und alles, was daraus folgt. */
interface Gleichung {
  punkte: Punkt[];
  richtungen: Punkt[];
  anteile: Anteil[];
  K: number;
  holen: number;
}

export class Seilzug {
  /** Der aufsummierte Stoß des letzten Takts, in Ns. */
  private stoss = 0;
  private dt = 1 / 60;
  /** Länge der Stränge im letzten Takt — für die Drehung der Rollen. */
  private vorher: number[] = [];

  constructor(
    readonly verbinder: string,
    private knoten: Seilknoten[],
    public laenge: number,
  ) {}

  /** Die Bahn in Weltkoordinaten — auch für die Zeichnung. */
  bahn(): Punkt[] {
    return this.knoten.map(k => {
      const p = b2.b2Body_GetWorldPoint(k.koerper, new b2.b2Vec2(k.lokal.x, k.lokal.y));
      return { x: p.x, y: p.y };
    });
  }

  /** Die gerade gespannte Länge. */
  gespannt(): number {
    const p = this.bahn();
    let s = 0;
    for (let i = 0; i + 1 < p.length; i++) s += Math.hypot(p[i + 1].x - p[i].x, p[i + 1].y - p[i].y);
    return s;
  }

  /** Die Seilkraft in Newton — im ganzen Seil dieselbe. */
  get zug(): number {
    return this.stoss / this.dt;
  }

  /** Ein Takt: Bahn halten, dann die Rollen mitdrehen lassen. */
  rechne(dt: number) {
    this.dt = dt;
    this.stoss = 0;
    const gl = this.stelleAuf(dt);
    if (gl) for (let n = 0; n < DURCHGAENGE; n++) this.durchgang(gl);
    this.dreheRollen(dt);
  }

  /**
   * Stellt die Bedingung für diesen Takt auf: Bahn, Richtungen, wirksame Masse.
   *
   * Alles davon hängt nur an der Lage, und die ändert sich während des Takts
   * nicht mehr — die Durchgänge rechnen danach nur noch mit Geschwindigkeiten.
   */
  private stelleAuf(dt: number): Gleichung | null {
    const punkte = this.bahn();
    const n = punkte.length;
    const u: Punkt[] = [];
    let laenge = 0;
    for (let i = 0; i + 1 < n; i++) {
      const dx = punkte[i + 1].x - punkte[i].x, dy = punkte[i + 1].y - punkte[i].y;
      const l = Math.hypot(dx, dy);
      laenge += l;
      u.push(l > 1e-9 ? { x: dx / l, y: dy / l } : { x: 0, y: 0 });
    }

    // Die Richtung, in die ein Punkt die Bahn verlängert: ∂L/∂Pₖ.
    const richtungen: Punkt[] = [];
    for (let k = 0; k < n; k++) {
      const vor = k > 0 ? u[k - 1] : { x: 0, y: 0 };
      const nach = k < n - 1 ? u[k] : { x: 0, y: 0 };
      richtungen.push({ x: vor.x - nach.x, y: vor.y - nach.y });
    }

    // Punkte auf demselben Verbund zählen zusammen: eine Rolle, über die das
    // Seil zweimal läuft, hängt sonst an zu wenig Masse — und ein Flaschenzug,
    // dessen lose Rollen in einem Block sitzen, wäre viel zu weich.
    const anteile = new Map<string, Anteil>();
    for (let k = 0; k < n; k++) {
      const kn = this.knoten[k];
      let a = anteile.get(kn.schluessel);
      if (!a) {
        a = this.anteilVon(kn);
        anteile.set(kn.schluessel, a);
      }
      const d = richtungen[k];
      a.jx += d.x;
      a.jy += d.y;
      a.jw += (punkte[k].x - a.mitte.x) * d.y - (punkte[k].y - a.mitte.y) * d.x;
    }

    let K = 0;
    for (const a of anteile.values()) {
      K += a.invM * (a.jx * a.jx + a.jy * a.jy) + a.invI * a.jw * a.jw;
    }
    if (K <= 1e-12) return null;

    // Ist die Bahn zu lang, wird sie zurückgeholt. Ist sie zu kurz, hängt das
    // Seil durch — dann darf es sich frei bis zur vollen Länge strecken, und
    // zwar in diesem Takt um höchstens den Durchhang: sonst hinge eine Last am
    // schlaffen Seil, als wäre es straff.
    const fehler = laenge - this.laenge;
    const holen = fehler > SCHLUPF
      ? Math.min(MAX_HOLEN, (BEIWERT / dt) * (fehler - SCHLUPF))
      : Math.min(0, fehler / dt);

    return { punkte, richtungen, anteile: [...anteile.values()], K, holen };
  }

  /** Masse, Trägheit und Schwerpunkt eines Verbunds — wie bei einem Körper. */
  private anteilVon(kn: Seilknoten): Anteil {
    const koerper = kn.verbund?.length ? kn.verbund : [kn.koerper];
    const schwerpunkte: Punkt[] = [];
    const massen: number[] = [];
    let M = 0, sx = 0, sy = 0;
    let beweglich = !kn.fest;
    for (const b of koerper) {
      const c = b2.b2Body_GetWorldCenterOfMass(b);
      schwerpunkte.push({ x: c.x, y: c.y });
      const m = b2.b2Body_GetType(b) === b2.b2BodyType.b2_dynamicBody ? b2.b2Body_GetMass(b) : 0;
      if (m <= 0) beweglich = false;
      massen.push(m);
      M += m;
      sx += m * c.x;
      sy += m * c.y;
    }
    if (!beweglich || M <= 0) {
      const c = schwerpunkte[0] ?? { x: 0, y: 0 };
      return { koerper, schwerpunkte, mitte: c, invM: 0, invI: 0, jx: 0, jy: 0, jw: 0 };
    }
    const mitte = { x: sx / M, y: sy / M };
    // Steinerscher Satz: die Trägheit des Verbunds um seinen Schwerpunkt.
    let I = 0;
    for (const [i, b] of koerper.entries()) {
      const dx = schwerpunkte[i].x - mitte.x, dy = schwerpunkte[i].y - mitte.y;
      I += b2.b2Body_GetInertiaTensor(b) + massen[i] * (dx * dx + dy * dy);
    }
    return { koerper, schwerpunkte, mitte, invM: 1 / M, invI: I > 0 ? 1 / I : 0, jx: 0, jy: 0, jw: 0 };
  }

  private durchgang(gl: Gleichung) {
    // Wie schnell die Bahn gerade länger wird — Punkt für Punkt, jeder mit der
    // Geschwindigkeit seines eigenen Körpers an genau dieser Stelle.
    let aenderung = 0;
    for (const [k, d] of gl.richtungen.entries()) {
      const b = this.knoten[k].koerper;
      const v = b2.b2Body_GetLinearVelocity(b);
      const w = b2.b2Body_GetAngularVelocity(b);
      const c = b2.b2Body_GetWorldCenterOfMass(b);
      aenderung += d.x * (v.x - w * (gl.punkte[k].y - c.y)) + d.y * (v.y + w * (gl.punkte[k].x - c.x));
    }

    // Ein Seil zieht und drückt nicht: der aufsummierte Stoß bleibt ≥ 0.
    const neu = Math.max(0, this.stoss + (aenderung + gl.holen) / gl.K);
    const schritt = neu - this.stoss;
    this.stoss = neu;
    if (schritt === 0) return;

    for (const a of gl.anteile) {
      if (a.invM === 0 && a.invI === 0) continue;
      // Der Verbund bewegt sich wie ein Körper: sein Schwerpunkt verschiebt
      // sich, er dreht sich, und jedes Teil folgt daraus.
      const dvx = -schritt * a.invM * a.jx;
      const dvy = -schritt * a.invM * a.jy;
      const dw = -schritt * a.invI * a.jw;
      for (const [i, b] of a.koerper.entries()) {
        const rx = a.schwerpunkte[i].x - a.mitte.x, ry = a.schwerpunkte[i].y - a.mitte.y;
        const v = b2.b2Body_GetLinearVelocity(b);
        b2.b2Body_SetLinearVelocity(b, new b2.b2Vec2(v.x + dvx - dw * ry, v.y + dvy + dw * rx));
        b2.b2Body_SetAngularVelocity(b, b2.b2Body_GetAngularVelocity(b) + dw);
      }
    }
  }

  /**
   * Die Rollen drehen sich, weil Seil über sie läuft.
   *
   * Angegriffen wird in der Mitte, also erzeugt das Seil rechnerisch kein
   * Moment an der Rolle — sie stünde still, während das Seil durchläuft. Die
   * Drehung wird deshalb aus dem Durchlauf gesetzt: ω = v/r, die Richtung aus
   * der Lage der beiden Nachbarpunkte.
   */
  private dreheRollen(dt: number) {
    const p = this.bahn();
    const laengen: number[] = [];
    for (let i = 0; i + 1 < p.length; i++) laengen.push(Math.hypot(p[i + 1].x - p[i].x, p[i + 1].y - p[i].y));

    for (let k = 1; k + 1 < p.length; k++) {
      const r = this.knoten[k].rolle;
      if (!r || !this.vorher.length) continue;
      const tempo = (laengen[k] - this.vorher[k]) / dt;
      const ax = p[k].x - p[k - 1].x, ay = p[k].y - p[k - 1].y;
      const bx = p[k + 1].x - p[k - 1].x, by = p[k + 1].y - p[k - 1].y;
      const seite = Math.sign(ax * by - ay * bx) || 1;
      b2.b2Body_SetAngularVelocity(this.knoten[k].koerper, (seite * tempo) / r);
    }
    this.vorher = laengen;
  }
}
