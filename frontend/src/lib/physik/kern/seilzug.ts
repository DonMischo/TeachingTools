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
 * Gerechnet wird nach dem Schritt des Lösers, mit ein paar Durchgängen auf den
 * Geschwindigkeiten (Baumgarte-Anteil gegen das Auseinanderlaufen). Das Seil
 * zieht nur: der aufsummierte Stoß bleibt ≥ 0, sonst wird es schlaff.
 *
 * Die inneren Punkte liegen in der *Mitte* der Rolle, nicht am Kranz. Die Bahn
 * ist dadurch um den Bogen und die Tangentenstücke länger als die wirkliche —
 * aber um einen festen Betrag, solange der Umschlingungswinkel bleibt, und nur
 * Änderungen der Länge wirken. Für den üblichen Fall (Seil kehrt um 180° um)
 * ist die Rechnung damit exakt.
 */
import * as b2 from "./box2d/PhaserBox2D.js";
import type { b2BodyId } from "./box2d/PhaserBox2D.js";
import type { Punkt } from "../typen";

/** Ein Punkt der Seilbahn: ein Körper und die Stelle auf ihm. */
export interface Seilknoten {
  /** Teil-Id oder "wand" — nur zum Zusammenfassen mehrerer Punkte auf einem Körper. */
  schluessel: string;
  koerper: b2BodyId;
  lokal: Punkt;
  /** Halbmesser, wenn der Knoten eine Rolle ist — dann dreht sie sich mit dem Seil. */
  rolle?: number;
  /**
   * Ob der Körper festliegt, obwohl der Löser ihn für beweglich hält.
   *
   * Eine Rolle an einer Achse an der Wand kann sich nur drehen. Rechnete die
   * Bahn trotzdem mit ihrer Masse, käme eine viel zu große wirksame Masse
   * heraus — und das Seil zöge zu schwach. Ein Meter Seil dehnte sich dann um
   * 15 cm, ehe die Kraft stimmte.
   */
  fest?: boolean;
}

/** Durchgänge je Takt. Acht reichen: der Fehler der losen Rolle liegt dann unter 1 %. */
const DURCHGAENGE = 8;
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

interface Koerperanteil {
  koerper: b2BodyId;
  invM: number;
  invI: number;
  jx: number;
  jy: number;
  jw: number;
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
    for (let n = 0; n < DURCHGAENGE; n++) this.durchgang(dt);
    this.dreheRollen(dt);
  }

  private durchgang(dt: number) {
    const p = this.bahn();
    const n = p.length;
    const u: Punkt[] = [];
    let laenge = 0;
    for (let i = 0; i + 1 < n; i++) {
      const dx = p[i + 1].x - p[i].x, dy = p[i + 1].y - p[i].y;
      const l = Math.hypot(dx, dy);
      laenge += l;
      u.push(l > 1e-9 ? { x: dx / l, y: dy / l } : { x: 0, y: 0 });
    }

    // Die Richtung, in die ein Punkt die Bahn verlängert: ∂L/∂Pₖ.
    const richtung = (k: number): Punkt => {
      const vor = k > 0 ? u[k - 1] : { x: 0, y: 0 };
      const nach = k < n - 1 ? u[k] : { x: 0, y: 0 };
      return { x: vor.x - nach.x, y: vor.y - nach.y };
    };

    // Mehrere Punkte auf demselben Körper zählen zusammen — sonst rechnete
    // eine Rolle, über die das Seil zweimal läuft, mit zu wenig Masse.
    const anteile = new Map<string, Koerperanteil>();
    for (let k = 0; k < n; k++) {
      const kn = this.knoten[k];
      const d = richtung(k);
      const m = b2.b2Body_GetMass(kn.koerper);
      const traeg = b2.b2Body_GetInertiaTensor(kn.koerper);
      const statisch = kn.fest === true || b2.b2Body_GetType(kn.koerper) !== b2.b2BodyType.b2_dynamicBody;
      const c = b2.b2Body_GetWorldCenterOfMass(kn.koerper);
      const rx = p[k].x - c.x, ry = p[k].y - c.y;
      const vorhanden = anteile.get(kn.schluessel);
      const a = vorhanden ?? {
        koerper: kn.koerper,
        invM: statisch || m <= 0 ? 0 : 1 / m,
        invI: statisch || traeg <= 0 ? 0 : 1 / traeg,
        jx: 0, jy: 0, jw: 0,
      };
      a.jx += d.x; a.jy += d.y; a.jw += rx * d.y - ry * d.x;
      if (!vorhanden) anteile.set(kn.schluessel, a);
    }

    let K = 0, aenderung = 0;
    for (const a of anteile.values()) {
      K += a.invM * (a.jx * a.jx + a.jy * a.jy) + a.invI * a.jw * a.jw;
      const v = b2.b2Body_GetLinearVelocity(a.koerper);
      aenderung += a.jx * v.x + a.jy * v.y + a.jw * b2.b2Body_GetAngularVelocity(a.koerper);
    }
    if (K <= 1e-12) return;

    // Ist die Bahn zu lang, wird sie zurückgeholt. Ist sie zu kurz, hängt das
    // Seil durch — dann darf es sich frei bis zur vollen Länge strecken, und
    // zwar in diesem Takt um höchstens den Durchhang: sonst hinge eine Last am
    // schlaffen Seil, als wäre es straff.
    const fehler = laenge - this.laenge;
    const holen = fehler > SCHLUPF
      ? Math.min(MAX_HOLEN, (BEIWERT / dt) * (fehler - SCHLUPF))
      : Math.min(0, fehler / dt);
    const roh = (aenderung + holen) / K;
    // Ein Seil zieht und drückt nicht: der aufsummierte Stoß bleibt ≥ 0.
    const neu = Math.max(0, this.stoss + roh);
    const schritt = neu - this.stoss;
    this.stoss = neu;
    if (schritt === 0) return;

    for (const a of anteile.values()) {
      if (a.invM === 0 && a.invI === 0) continue;
      const v = b2.b2Body_GetLinearVelocity(a.koerper);
      b2.b2Body_SetLinearVelocity(a.koerper, new b2.b2Vec2(
        v.x - schritt * a.invM * a.jx,
        v.y - schritt * a.invM * a.jy,
      ));
      b2.b2Body_SetAngularVelocity(a.koerper, b2.b2Body_GetAngularVelocity(a.koerper) - schritt * a.invI * a.jw);
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
