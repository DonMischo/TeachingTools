/**
 * Die Welt des Versuchs — ein einziger Löser für alles, was sich bewegt.
 *
 * Box2D v3 (als reiner JS-Port eingebunden, siehe `box2d/`). Die Welt wird
 * beim Start eines Versuchs *einmal* aus dem festgehaltenen Aufbau gebaut und
 * danach nur noch gerechnet. Im Bauen gibt es keine Welt; deshalb braucht es
 * hier kein Nachführen, kein Abgleichen und keine Sonderfälle dafür, dass
 * jemand während des Laufens ein Brett verschiebt — das geht nicht.
 *
 * Was die Probe mit dem Löser gezeigt hat und hier festgeschrieben ist:
 *
 * - **60 Hz, 8 Unterschritte.** Die Schwingungsdauer eines 1-m-Pendels weicht
 *   dabei um 0,003 % von 2π√(L/g) ab; 240 Hz brächten nichts außer Last.
 * - **Kein Schlaf.** Ruhende Körper schlafen in Box2D ein, und ein Seil, das
 *   man kürzt, weckt die Last daran nicht — die Winde drehte, die Last blieb
 *   liegen.
 * - **Ein Seil ist ein Abstandsgelenk mit Feder 0 Hz und Höchstlänge.** Es
 *   zieht, drückt aber nicht: geht die Last nach oben, wird es schlaff.
 * - **Winkel werden aufsummiert.** Box2D liefert sie nur zwischen −π und π;
 *   eine Trommel, die dreimal herumgedreht ist, stünde sonst wieder bei null.
 * - **Welten werden zerstört.** Der Port hält höchstens 32 gleichzeitig, und
 *   ist kein Platz mehr frei, schlägt das Anlegen *still* fehl.
 */
import * as b2 from "./box2d/PhaserBox2D.js";
import type { b2BodyId, b2JointId, b2ShapeDef, b2WorldId } from "./box2d/PhaserBox2D.js";
import type { Punkt } from "../typen";
import { endeInWelt, type Aufbau, type Teil, type Verbinder } from "./modell";
import { formFlaeche, oberflaeche, teilMasse, teilTyp } from "./teile";

export const TAKT = 1 / 60;
/**
 * Wie steif ein Seil über Rollen ist, in Hertz.
 *
 * Hoch genug, dass es sich unter Last kaum längt, niedrig genug, dass der
 * Löser bei acht Unterschritten nicht zittert.
 */
const SEIL_HERTZ = 30;
export const UNTERSCHRITTE = 8;
const G = 9.81;

/** Lage und Bewegung eines Teils. */
export interface TeilZustand {
  x: number;
  y: number;
  winkel: number;
  vx: number;
  vy: number;
  omega: number;
  /** Aufsummierte Drehung in rad — über ±π hinaus. */
  umdrehung: number;
}

/** Etwas, das im Versuch passiert und eine Erklärung verdient. */
export type Ereignis =
  | { art: "stoss"; a: string; b: string; ort: Punkt; tempo: number; t: number }
  | { art: "bruch"; verbinder: string; kraft: number; ort: Punkt; t: number }
  | { art: "geloest"; verbinder: string; ort: Punkt; t: number };

const vec = (p: Punkt) => new b2.b2Vec2(p.x, p.y);

/**
 * Ein Seil, das sich auf ein Teil aufwickelt.
 *
 * Die Winde: das Seilende sitzt am Rand der Trommel, also greift die Last mit
 * genau diesem Hebelarm am Motor an — und die freie Seillänge folgt dem
 * Drehwinkel, L = L₀ − r · Δθ. Beides zusammen macht erst eine Winde daraus;
 * mit dem Seilende in der Mitte gäbe es kein Drehmoment.
 */
/**
 * Ein Seil, das über Rollen läuft.
 *
 * Gebaut aus einem starren Abschnitt je Abschnitt des Wegs. Zusammen sind sie
 * ein Seil, weil ihre Längen zusammen fest bleiben: was der eine Abschnitt
 * länger wird, wird der andere kürzer. Genau das ist ein Flaschenzug — und es
 * kommt von selbst heraus, dass eine lose Rolle die Kraft halbiert.
 *
 * Gegen ein Seil aus Gliedern hat das den Vorteil, dass es nicht dehnt:
 * eine Kette aus zwanzig Gliedern zog sich unter 2 kg auf das Doppelte.
 */
interface Rollenzug {
  verbinder: string;
  abschnitte: b2JointId[];
  gesamt: number;
}

interface Wickel {
  verbinder: string;
  trommel: string;
  radius: number;
  laenge0: number;
  winkel0: number;
  /** Ob Linksdrehung aufwickelt (+1) oder abwickelt (−1). */
  richtung: number;
  /** Wo das Seil die Trommel verlässt — fest im Raum, nicht mitdrehend. */
  ablauf: Punkt;
}

export class Welt {
  private id: b2WorldId;
  private koerper = new Map<string, b2BodyId>();
  private gelenke = new Map<string, b2JointId>();
  private verbinder = new Map<string, Verbinder>();
  private umdrehung = new Map<string, number>();
  private wickel: Wickel[] = [];
  /** Seile aus Gliedern: die Körper in ihrer Reihenfolge, Anfang zuerst. */
  private ketten = new Map<string, b2BodyId[]>();
  private rollenzuege: Rollenzug[] = [];
  private naechsteGruppe = -1;
  private anfangsWinkel = new Map<string, number>();
  private wand: b2BodyId;
  private hand: b2JointId | null = null;
  private ereignisse: Ereignis[] = [];
  private zeit = 0;
  private zerstoert = false;

  constructor(private aufbau: Aufbau) {
    b2.b2CreateWorldArray();
    const def = b2.b2DefaultWorldDef();
    def.gravity = new b2.b2Vec2(0, -G);
    def.enableSleep = false;
    def.enableContinuous = true;
    this.id = b2.b2CreateWorld(def);
    if (!b2.b2World_IsValid(this.id)) throw new Error("Box2D hat keinen Platz für eine weitere Welt.");
    // Unterhalb davon zählt ein Aufprall nicht als Ereignis: Aufliegen und
    // leises Rollen sollen keine Marker hinterlassen.
    b2.b2World_SetHitEventThreshold(this.id, 0.3);

    // Die Wand ist ein Körper ohne Gestalt — nur ein fester Punkt für Gelenke.
    const wandDef = b2.b2DefaultBodyDef();
    wandDef.type = b2.b2BodyType.b2_staticBody;
    wandDef.userData = "wand";
    this.wand = b2.b2CreateBody(this.id, wandDef);

    this.baueBoden();
    for (const t of aufbau.teile) this.baueTeil(t);
    for (const v of aufbau.verbinder) this.baueVerbinder(v);
  }

  private baueBoden() {
    const def = b2.b2DefaultBodyDef();
    def.type = b2.b2BodyType.b2_staticBody;
    def.position = new b2.b2Vec2(0, -0.5);
    def.userData = "boden";
    const boden = b2.b2CreateBody(this.id, def);
    const form = b2.b2DefaultShapeDef();
    form.friction = 0.6;
    form.enableHitEvents = true;
    b2.b2CreatePolygonShape(boden, form, b2.b2MakeBox(100, 0.5));
  }

  private baueTeil(t: Teil) {
    const typ = teilTyp(t.art);
    if (!typ) return;
    const def = b2.b2DefaultBodyDef();
    def.type = b2.b2BodyType.b2_dynamicBody;
    def.position = vec(t.pos);
    def.rotation = b2.b2MakeRot(t.winkel);
    def.userData = t.id;
    // Kleine, schnelle Teile tunneln sonst durch dünne Wände.
    def.isBullet = t.art === "kugel";
    const body = b2.b2CreateBody(this.id, def);

    // Die Dichte in der Ebene wird so gewählt, dass die Masse stimmt: die
    // Werkbank ist zweidimensional, Massen sind es nicht.
    const formen = typ.formen(t);
    const flaeche = formen.reduce((s, f) => s + formFlaeche(f), 0);
    const { reibung, sprung } = oberflaeche(t);
    const formDef = (): b2ShapeDef => {
      const d = b2.b2DefaultShapeDef();
      d.density = teilMasse(t) / Math.max(1e-9, flaeche);
      d.friction = reibung;
      d.restitution = sprung;
      d.enableHitEvents = true;
      return d;
    };
    for (const f of formen) {
      if (f.art === "kasten") {
        b2.b2CreatePolygonShape(body, formDef(), b2.b2MakeOffsetBox(f.b / 2, f.h / 2, vec(f.mitte), f.winkel ?? 0));
      } else if (f.art === "kreis") {
        b2.b2CreateCircleShape(body, formDef(), { center: vec(f.mitte), radius: f.r });
      } else {
        b2.b2CreateCapsuleShape(body, formDef(), { center1: vec(f.a), center2: vec(f.b), radius: f.r });
      }
    }
    this.koerper.set(t.id, body);
    this.umdrehung.set(t.id, t.winkel);
    this.anfangsWinkel.set(t.id, t.winkel);
  }

  /** Der Körper hinter einem Verbinderende — die Wand, wenn es kein Teil ist. */
  private koerperVon(teil: string | null): b2BodyId | undefined {
    return teil === null ? this.wand : this.koerper.get(teil);
  }

  private baueVerbinder(v: Verbinder) {
    // Die Wand kommt immer zuerst. Box2D dreht bei einem Motor das *zweite*
    // Ende gegen das erste: baute man die Achse in der Reihenfolge, in der
    // geklickt wurde, liefe der Motor je nach Klickreihenfolge andersherum —
    // beim Anklicken des Teils vor der Wand drehte sich rechnerisch die Wand.
    const [eA, eB] = v.b.teil === null ? [v.b, v.a] : [v.a, v.b];
    const a = this.koerperVon(eA.teil), b = this.koerperVon(eB.teil);
    if (!a || !b) return;
    // Beide Enden sitzen bei einer Achse oder Schraube am selben Punkt: dem
    // des ersten Endes. Liegt das zweite beim Bauen ein Stück daneben, gilt das erste.
    const pa = endeInWelt(this.aufbau, eA), pb = endeInWelt(this.aufbau, eB);
    const lokalA = b2.b2Body_GetLocalPoint(a, vec(pa));
    let joint: b2JointId;

    if (v.art === "achse") {
      const d = b2.b2DefaultRevoluteJointDef();
      d.bodyIdA = a; d.bodyIdB = b;
      d.localAnchorA = lokalA;
      d.localAnchorB = b2.b2Body_GetLocalPoint(b, vec(pa));
      // Reibung in der Achse ist ein Motor, der auf Stillstand zielt und
      // höchstens so viel Moment aufbringt, wie die Reibung hergibt.
      const moment = v.werte.motorMoment ?? 0;
      const reibung = v.werte.reibung ?? 0;
      if (moment > 0 || reibung > 0) {
        d.enableMotor = true;
        d.motorSpeed = moment > 0 ? (v.werte.drehzahl ?? 0) : 0;
        d.maxMotorTorque = moment > 0 ? moment : reibung;
      }
      joint = b2.b2CreateRevoluteJoint(this.id, d);
    } else if (v.art === "schraube") {
      const d = b2.b2DefaultWeldJointDef();
      d.bodyIdA = a; d.bodyIdB = b;
      d.localAnchorA = lokalA;
      d.localAnchorB = b2.b2Body_GetLocalPoint(b, vec(pa));
      d.referenceAngle = this.winkelVon(eB.teil) - this.winkelVon(eA.teil);
      joint = b2.b2CreateWeldJoint(this.id, d);
    } else if (v.art === "seil" && (v.werte.glieder ?? 0) >= 2) {
      joint = this.baueKette(v, a, b, pa, pb);
    } else if (v.art === "seil" && (v.ueber?.length ?? 0) > 0) {
      joint = this.baueRollenzug(v, a, b, pa, pb);
    } else {
      // Feder und Seil verbinden zwei verschiedene Punkte.
      const d = b2.b2DefaultDistanceJointDef();
      d.bodyIdA = a; d.bodyIdB = b;
      d.localAnchorA = lokalA;
      d.localAnchorB = b2.b2Body_GetLocalPoint(b, vec(pb));
      const abstand = Math.max(0.001, Math.hypot(pb.x - pa.x, pb.y - pa.y));
      const laenge = (v.werte.laenge ?? 0) > 0 ? v.werte.laenge! : abstand;
      d.length = laenge;
      d.enableSpring = true;
      if (v.art === "seil") {
        // Ein Seil: keine Federkraft, nur eine Höchstlänge. Es zieht, drückt nie.
        d.hertz = 0;
        d.enableLimit = true;
        d.minLength = 0;
        d.maxLength = laenge;
      } else {
        // Box2D will eine Eigenfrequenz, der Unterricht eine Federkonstante.
        // Umgerechnet über die wirksame Masse der beiden Enden.
        const k = Math.max(0.01, v.werte.federkonstante ?? 20);
        const mA = v.a.teil === null ? Infinity : b2.b2Body_GetMass(a);
        const mB = v.b.teil === null ? Infinity : b2.b2Body_GetMass(b);
        const mWirk = !isFinite(mA) ? mB : !isFinite(mB) ? mA : (mA * mB) / (mA + mB);
        d.hertz = Math.sqrt(k / Math.max(1e-6, mWirk)) / (2 * Math.PI);
        d.dampingRatio = v.werte.daempfung ?? 0;
      }
      // Eine Winde: das Seil verlässt die Trommel an einer festen Stelle im
      // Raum — dem Ablaufpunkt — und nicht an einem Punkt, der mitdreht. Sonst
      // könnte der Löser das kürzer werdende Seil einfach dadurch erfüllen,
      // dass er die Trommel weiterdreht: eine Längengrenze ist starr, ein
      // Motor nur so stark wie sein Moment. Die Trommel bekommt stattdessen
      // das Moment der Seilkraft zu spüren, F · r.
      const wickelt = v.art === "seil" && (v.werte.wickelt ?? 0) >= 0.5 && eA.teil !== null
        && Math.hypot(eA.punkt.x, eA.punkt.y) > 0.005;
      if (wickelt) {
        d.bodyIdA = this.wand;
        d.localAnchorA = vec(pa);
      }
      joint = b2.b2CreateDistanceJoint(this.id, d);
      if (wickelt) {
        this.wickel.push({
          verbinder: v.id, trommel: eA.teil!, radius: Math.hypot(eA.punkt.x, eA.punkt.y),
          laenge0: laenge, winkel0: this.umdrehung.get(eA.teil!) ?? 0,
          richtung: (v.werte.wickelrichtung ?? 1) >= 0 ? 1 : -1,
          ablauf: pa,
        });
      }
    }
    this.gelenke.set(v.id, joint);
    this.verbinder.set(v.id, v);
  }

  /**
   * Ein Seil aus Gliedern — eines, das sich über eine Rolle legen kann.
   *
   * Ein Abstandsgelenk zieht immer geradewegs von einem Punkt zum anderen; es
   * kann nicht über etwas *laufen*. Für einen Flaschenzug braucht es ein Seil
   * mit Gestalt: viele kurze Glieder, gelenkig aneinander, die sich auf die
   * Rolle legen und sie über die Reibung mitnehmen.
   *
   * Die Glieder sind in einer eigenen Stoßgruppe: sonst verheddert sich das
   * Seil in sich selbst, statt zu hängen.
   */
  private baueKette(v: Verbinder, a: b2BodyId, b: b2BodyId, pa: Punkt, pb: Punkt): b2JointId {
    const anzahl = Math.min(80, Math.max(2, Math.round(v.werte.glieder ?? 0)));
    // Der Weg des Seils: von Ende zu Ende, über alles, worüber es laufen soll.
    const weg = [pa, ...(v.ueber ?? []).map(e => endeInWelt(this.aufbau, e)), pb];
    const strecken = weg.slice(1).map((p, i) => Math.hypot(p.x - weg[i].x, p.y - weg[i].y));
    const abstand = Math.max(0.01, strecken.reduce((s, x) => s + x, 0));
    const laenge = (v.werte.laenge ?? 0) > 0 ? v.werte.laenge! : abstand;
    const glied = laenge / anzahl;
    const masse = Math.max(0.002, (v.werte.masseProMeter ?? 0.15) * glied);
    const gruppe = this.naechsteGruppe--;

    /** Der Punkt nach s Metern entlang des Wegs; danach geradeaus weiter. */
    const amWeg = (s: number): Punkt => {
      let rest = Math.max(0, s);
      for (let i = 0; i < strecken.length; i++) {
        if (rest <= strecken[i] || i === strecken.length - 1) {
          const t = strecken[i] === 0 ? 0 : rest / strecken[i];
          return {
            x: weg[i].x + (weg[i + 1].x - weg[i].x) * t,
            y: weg[i].y + (weg[i + 1].y - weg[i].y) * t,
          };
        }
        rest -= strecken[i];
      }
      return weg[weg.length - 1];
    };
    const knick = (s: number) => {
      const vor = amWeg(Math.max(0, s - glied / 2)), nach = amWeg(s + glied / 2);
      return Math.atan2(nach.y - vor.y, nach.x - vor.x);
    };

    const koerper: b2BodyId[] = [];
    for (let i = 0; i < anzahl; i++) {
      const mitte = amWeg(glied * (i + 0.5));
      const def = b2.b2DefaultBodyDef();
      def.type = b2.b2BodyType.b2_dynamicBody;
      def.position = vec(mitte);
      def.rotation = b2.b2MakeRot(knick(glied * (i + 0.5)));
      def.userData = v.id;
      const glieder = b2.b2CreateBody(this.id, def);
      const dicke = Math.min(0.012, glied * 0.35);
      const form = b2.b2DefaultShapeDef();
      form.density = masse / Math.max(1e-9, Math.PI * dicke * dicke + 2 * dicke * glied);
      form.friction = 0.5;
      form.restitution = 0;
      form.filter.groupIndex = gruppe;
      b2.b2CreateCapsuleShape(glieder, form, {
        center1: new b2.b2Vec2(-glied / 2 + dicke, 0),
        center2: new b2.b2Vec2(glied / 2 - dicke, 0),
        radius: dicke,
      });
      koerper.push(glieder);
    }

    /** Verbindet zwei Körper gelenkig an einem Weltpunkt. */
    const gelenk = (x: b2BodyId, y: b2BodyId, punkt: Punkt) => {
      const d = b2.b2DefaultRevoluteJointDef();
      d.bodyIdA = x; d.bodyIdB = y;
      d.localAnchorA = b2.b2Body_GetLocalPoint(x, vec(punkt));
      d.localAnchorB = b2.b2Body_GetLocalPoint(y, vec(punkt));
      return b2.b2CreateRevoluteJoint(this.id, d);
    };

    const erstes = gelenk(a, koerper[0], pa);
    for (let i = 1; i < koerper.length; i++) gelenk(koerper[i - 1], koerper[i], amWeg(glied * i));
    gelenk(koerper[koerper.length - 1], b, pb);
    this.ketten.set(v.id, koerper);
    return erstes;
  }

  /**
   * Ein Seil über Rollen: je Wegabschnitt ein starrer Zug.
   *
   * Nachgeführt wird nur der letzte Abschnitt: seine Höchstlänge ist, was von
   * der Gesamtlänge übrig bleibt. Damit ist das Seil unstreckbar, ohne dass
   * jeder Abschnitt einzeln daran zerren müsste.
   */
  private baueRollenzug(v: Verbinder, a: b2BodyId, b: b2BodyId, pa: Punkt, pb: Punkt): b2JointId {
    const stuetzen = (v.ueber ?? []).map(e => ({ ende: e, punkt: endeInWelt(this.aufbau, e) }));
    const stationen: { koerper: b2BodyId; punkt: Punkt }[] = [
      { koerper: a, punkt: pa },
      ...stuetzen.map(s => ({ koerper: this.koerperVon(s.ende.teil) ?? this.wand, punkt: s.punkt })),
      { koerper: b, punkt: pb },
    ];

    const abschnitte: b2JointId[] = [];
    let gesamt = 0;
    for (let i = 1; i < stationen.length; i++) {
      const von = stationen[i - 1], nach = stationen[i];
      const laenge = Math.max(0.01, Math.hypot(nach.punkt.x - von.punkt.x, nach.punkt.y - von.punkt.y));
      // Das Stück *über* die Rolle verbindet zwei Punkte desselben Körpers.
      // Es kann seine Länge nie ändern und zieht an nichts; als Abschnitt
      // mitgeführt bekäme es einen Anteil an der Dehnung, der den tragenden
      // Strängen fehlt — die lose Rolle zeigte dann 16 statt 21,5 N.
      if (von.koerper === nach.koerper) continue;
      gesamt += laenge;
      const d = b2.b2DefaultDistanceJointDef();
      d.bodyIdA = von.koerper; d.bodyIdB = nach.koerper;
      d.localAnchorA = b2.b2Body_GetLocalPoint(von.koerper, vec(von.punkt));
      d.localAnchorB = b2.b2Body_GetLocalPoint(nach.koerper, vec(nach.punkt));
      d.length = laenge;
      // Jeder Abschnitt ist eine gleich steife Feder, und die Ruhelängen
      // werden je Takt so nachgeführt, dass alle gleich weit gedehnt sind.
      // Mit starren Abschnitten wäre das Seil überbestimmt: der Löser dürfte
      // den einen Strang stärker belasten als den anderen, und die halbe
      // Kraft an der losen Rolle käme nie heraus (gemessen 25 statt 21,5 N).
      d.enableSpring = true;
      d.hertz = SEIL_HERTZ;
      d.dampingRatio = 1;
      d.enableLimit = true;
      d.minLength = 0;
      d.maxLength = laenge * 1.5;
      abschnitte.push(b2.b2CreateDistanceJoint(this.id, d));
    }
    const vorgabe = (v.werte.laenge ?? 0) > 0 ? v.werte.laenge! : gesamt;
    this.rollenzuege.push({ verbinder: v.id, abschnitte, gesamt: vorgabe });
    return abschnitte[0];
  }

  /**
   * Hält die Gesamtlänge eines Seils über Rollen fest — und die Spannung gleich.
   *
   * Alle Abschnitte bekommen dieselbe Dehnung: die überschüssige Länge wird
   * gleichmäßig von ihren Ruhelängen abgezogen. Gleiche Feder, gleiche
   * Dehnung, gleiche Kraft — das ist das Seil, das über eine Rolle läuft.
   */
  private fuehreRollenzuege() {
    for (const r of this.rollenzuege) {
      if (r.abschnitte.some(j => !b2.b2Joint_IsValid(j))) continue;
      const jetzt = r.abschnitte.map(j => b2.b2DistanceJoint_GetCurrentLength(j));
      const summe = jetzt.reduce((s, x) => s + x, 0);
      // Nur ziehen, nie drücken: ist das Seil kürzer als seine Länge, hängt es
      // durch und tut gar nichts. Ohne diese Schranke stemmten die Abschnitte
      // die lose Rolle nach oben, und die Kraft im Strang war zu klein.
      const zuviel = Math.max(0, (summe - r.gesamt) / r.abschnitte.length);
      r.abschnitte.forEach((j, i) => {
        b2.b2DistanceJoint_SetLength(j, Math.max(0.005, jetzt[i] - zuviel));
        b2.b2DistanceJoint_SetLengthRange(j, 0, Math.max(0.01, r.gesamt));
      });
    }
  }

  /** Die Punkte eines Seils — aus Gliedern oder über Rollen. */
  seilPunkte(verbinderId: string): Punkt[] | undefined {
    const ueber = this.verbinder.get(verbinderId)?.ueber;
    if (ueber?.length && !this.ketten.has(verbinderId)) {
      const enden = this.verbinderEnden(verbinderId);
      if (!enden) return undefined;
      const stuetzen = ueber.map(e => {
        const k = this.koerperVon(e.teil);
        if (!k || e.teil === null) return e.punkt;
        const p = b2.b2Body_GetWorldPoint(k, vec(e.punkt));
        return { x: p.x, y: p.y };
      });
      return [enden[0], ...stuetzen, enden[1]];
    }
    const koerper = this.ketten.get(verbinderId);
    if (!koerper) return undefined;
    const v = this.verbinder.get(verbinderId);
    const punkte = koerper.map(k => {
      const p = b2.b2Body_GetPosition(k);
      return { x: p.x, y: p.y };
    });
    // Anfang und Ende sitzen an den Teilen, nicht in der Mitte des ersten Glieds.
    if (v) {
      const [a, b] = this.verbinderEnden(verbinderId) ?? [];
      if (a) punkte.unshift(a);
      if (b) punkte.push(b);
    }
    return punkte;
  }

  private winkelVon(teil: string | null): number {
    if (teil === null) return 0;
    return this.aufbau.teile.find(t => t.id === teil)?.winkel ?? 0;
  }

  /** Ein Takt: Brüche prüfen, rechnen, Ereignisse einsammeln, Drehungen aufsummieren. */
  schritt() {
    if (this.zerstoert) return;
    this.wickle();
    this.fuehreRollenzuege();
    this.pruefeAusloeser();
    b2.b2World_Step(this.id, TAKT, UNTERSCHRITTE);
    this.zeit += TAKT;

    for (const [id, body] of this.koerper) {
      this.umdrehung.set(id, (this.umdrehung.get(id) ?? 0) + b2.b2Body_GetAngularVelocity(body) * TAKT);
    }

    const stoesse = b2.b2World_GetContactEvents(this.id);
    for (let i = 0; i < stoesse.hitCount; i++) {
      const e = stoesse.hitEvents[i];
      const a = b2.b2Body_GetUserData(b2.b2Shape_GetBody(e.shapeIdA)) as string;
      const b = b2.b2Body_GetUserData(b2.b2Shape_GetBody(e.shapeIdB)) as string;
      this.ereignisse.push({ art: "stoss", a, b, ort: { x: e.pointX, y: e.pointY }, tempo: e.approachSpeed, t: this.zeit });
    }
  }

/**
   * Führt die Länge wickelnder Seile nach.
   *
   * Der Drehwinkel wird aufsummiert geführt — Box2D liefert ihn nur zwischen
   * −π und π, und eine Trommel dreht sich viele Male.
   */
  private wickle() {
    for (const w of this.wickel) {
      const joint = this.gelenke.get(w.verbinder);
      if (!joint || !b2.b2Joint_IsValid(joint)) continue;
      const gedreht = (this.umdrehung.get(w.trommel) ?? 0) - w.winkel0;
      const laenge = Math.min(w.laenge0 + 5, Math.max(0.02, w.laenge0 - w.richtung * w.radius * gedreht));
      b2.b2DistanceJoint_SetLengthRange(joint, 0, laenge);

      // Was am Seil hängt, hält die Trommel auf: das Moment ist Seilkraft mal
      // Halbmesser. Ein zu schwacher Motor kommt damit nicht mehr hoch.
      const trommel = this.koerper.get(w.trommel);
      const kraft = this.kraft(w.verbinder);
      if (trommel && kraft) b2.b2Body_ApplyTorque(trommel, -w.richtung * kraft.betrag * w.radius, true);
    }
  }

  /**
   * Was von selbst nachgibt: zu große Kraft, abgelaufene Zeit, gedrehter Arm.
   *
   * Der Winkel ist der des Teils am Anfang des Verbinders, aufsummiert. So
   * löst die Schlinge eines Trebuchets, wenn der Wurfarm weit genug herum ist
   * — und nicht, wenn eine Stoppuhr zufällig passt.
   */
  private pruefeAusloeser() {
    for (const [id, v] of this.verbinder) {
      const grenze = v.werte.bruchkraft ?? 0;
      if (grenze > 0) {
        const kraft = this.kraft(id);
        if (kraft && kraft.betrag > grenze) {
          const ort = this.verbinderOrt(id);
          this.loese(id);
          this.ereignisse.push({ art: "bruch", verbinder: id, kraft: kraft.betrag, ort, t: this.zeit });
          continue;
        }
      }
      const nach = v.werte.loestNach ?? 0;
      if (nach > 0 && this.zeit >= nach) { this.loese(id); continue; }
      const beiWinkel = v.werte.loestBeiWinkel ?? 0;
      if (beiWinkel !== 0 && v.a.teil !== null) {
        const gedreht = (this.umdrehung.get(v.a.teil) ?? 0) - (this.anfangsWinkel.get(v.a.teil) ?? 0);
        if (beiWinkel > 0 ? gedreht >= beiWinkel : gedreht <= beiWinkel) this.loese(id);
      }
    }
  }

  /** Nimmt die Ereignisse seit dem letzten Abholen. */
  holeEreignisse(): Ereignis[] {
    const aus = this.ereignisse;
    this.ereignisse = [];
    return aus;
  }

  get t() {
    return this.zeit;
  }

  zustand(id: string): TeilZustand | undefined {
    const body = this.koerper.get(id);
    if (!body) return undefined;
    const p = b2.b2Body_GetPosition(body);
    const v = b2.b2Body_GetLinearVelocity(body);
    return {
      x: p.x, y: p.y,
      winkel: b2.b2Rot_GetAngle(b2.b2Body_GetRotation(body)),
      vx: v.x, vy: v.y,
      omega: b2.b2Body_GetAngularVelocity(body),
      umdrehung: this.umdrehung.get(id) ?? 0,
    };
  }

  /** Alle Teile auf einmal — für die Zeichnung. */
  alle(): Record<string, TeilZustand> {
    const aus: Record<string, TeilZustand> = {};
    for (const id of this.koerper.keys()) aus[id] = this.zustand(id)!;
    return aus;
  }

  /**
   * Die Kraft, die ein Verbinder gerade überträgt, in Newton.
   *
   * Daraus wird der Kraftmesser: eine Feder, die anzeigt, was sie hält. Beim
   * Seil ist es die Seilkraft, bei der Achse die Lagerkraft.
   */
  kraft(verbinderId: string): { betrag: number; x: number; y: number; moment: number } | undefined {
    const j = this.gelenke.get(verbinderId);
    if (!j || !b2.b2Joint_IsValid(j)) return undefined;
    const f = b2.b2Joint_GetConstraintForce(j);
    return { betrag: Math.hypot(f.x, f.y), x: f.x, y: f.y, moment: b2.b2Joint_GetConstraintTorque(j) };
  }

  /** Wo ein Verbinder gerade sitzt — am Ende a. */
  verbinderOrt(verbinderId: string): Punkt {
    const v = this.verbinder.get(verbinderId);
    if (!v) return { x: 0, y: 0 };
    const body = this.koerperVon(v.a.teil);
    if (!body || v.a.teil === null) return v.a.punkt;
    const p = b2.b2Body_GetWorldPoint(body, vec(v.a.punkt));
    return { x: p.x, y: p.y };
  }

  /** Beide Enden eines Verbinders in der Welt — für Seil und Feder. */
  verbinderEnden(verbinderId: string): [Punkt, Punkt] | undefined {
    const v = this.verbinder.get(verbinderId);
    if (!v) return undefined;
    const ende = (e: Verbinder["a"]) => {
      const body = this.koerperVon(e.teil);
      if (!body || e.teil === null) return e.punkt;
      const p = b2.b2Body_GetWorldPoint(body, vec(e.punkt));
      return { x: p.x, y: p.y };
    };
    return [ende(v.a), ende(v.b)];
  }

  /** Wo ein wickelndes Seil die Trommel verlässt — für die Zeichnung. */
  seilAblauf(verbinderId: string): Punkt | undefined {
    return this.wickel.find(x => x.verbinder === verbinderId)?.ablauf;
  }

  /** Die Länge, die ein Seil gerade freigibt — beim Wickeln ändert sie sich. */
  seillaenge(verbinderId: string): number | undefined {
    const joint = this.gelenke.get(verbinderId);
    if (!joint || !b2.b2Joint_IsValid(joint)) return undefined;
    const w = this.wickel.find(x => x.verbinder === verbinderId);
    if (!w) return undefined;
    const gedreht = (this.umdrehung.get(w.trommel) ?? 0) - w.winkel0;
    return Math.min(w.laenge0 + 5, Math.max(0.02, w.laenge0 - w.richtung * w.radius * gedreht));
  }

  /** Ob ein Verbinder noch hält. */
  haelt(verbinderId: string): boolean {
    const j = this.gelenke.get(verbinderId);
    return !!j && b2.b2Joint_IsValid(j);
  }

  /** Löst einen Verbinder — der Auslöser. */
  loese(verbinderId: string) {
    const j = this.gelenke.get(verbinderId);
    if (!j || !b2.b2Joint_IsValid(j)) return;
    const ort = this.verbinderOrt(verbinderId);
    b2.b2DestroyJoint(j);
    this.gelenke.delete(verbinderId);
    this.verbinder.delete(verbinderId);
    this.ereignisse.push({ art: "geloest", verbinder: verbinderId, ort, t: this.zeit });
  }

  /** Stellt die Drehzahl eines Achsmotors ein, in rad/s. */
  setzeDrehzahl(verbinderId: string, drehzahl: number) {
    const j = this.gelenke.get(verbinderId);
    if (!j || !b2.b2Joint_IsValid(j)) return;
    b2.b2RevoluteJoint_SetMotorSpeed(j, drehzahl);
  }

  /** Gibt einem Teil ein Tempo — ein Schubs, ein Abschuss. */
  gibTempo(id: string, vx: number, vy: number) {
    const body = this.koerper.get(id);
    if (body) b2.b2Body_SetLinearVelocity(body, new b2.b2Vec2(vx, vy));
  }

  /**
   * Die Hand: ein Federgriff, der das Teil zum Zeiger zieht.
   *
   * Das Teil bleibt dabei ein Körper unter anderen — es schiebt, was im Weg
   * liegt, pendelt am Haken und fliegt beim Loslassen mit Schwung weiter.
   */
  greife(id: string, punkt: Punkt): boolean {
    this.lasse();
    const body = this.koerper.get(id);
    if (!body) return false;
    const d = b2.b2DefaultMouseJointDef();
    d.bodyIdA = this.wand;
    d.bodyIdB = body;
    d.target = vec(punkt);
    d.hertz = 6;
    d.dampingRatio = 0.8;
    d.maxForce = 300 * Math.max(0.01, b2.b2Body_GetMass(body)) * G;
    this.hand = b2.b2CreateMouseJoint(this.id, d);
    return true;
  }

  ziehe(punkt: Punkt) {
    if (this.hand && b2.b2Joint_IsValid(this.hand)) b2.b2MouseJoint_SetTarget(this.hand, vec(punkt));
  }

  lasse() {
    if (this.hand && b2.b2Joint_IsValid(this.hand)) b2.b2DestroyJoint(this.hand);
    this.hand = null;
  }

  /** Masse eines Teils, wie der Löser sie sieht — zum Gegenprüfen. */
  masse(id: string): number {
    const body = this.koerper.get(id);
    return body ? b2.b2Body_GetMass(body) : 0;
  }

  /** Gibt den Platz im Löser frei. Danach ist die Welt nicht mehr zu gebrauchen. */
  zerstoere() {
    if (this.zerstoert) return;
    this.lasse();
    b2.b2DestroyWorld(this.id);
    this.zerstoert = true;
  }
}
