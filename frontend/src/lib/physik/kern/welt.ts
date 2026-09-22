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
import { endeInWelt, type Aufbau, type Ende, type Teil, type Verbinder } from "./modell";
import { Seilzug, type Seilknoten } from "./seilzug";
import { Stromkreis, type Messung } from "./strom";
import { Optik, istLeuchte, type Strahlstueck } from "./optik";
import { Waermenetz } from "./waerme";
import { formFlaeche, istElektrisch, oberflaeche, teilMasse, teilTyp } from "./teile";

export const TAKT = 1 / 60;
export const UNTERSCHRITTE = 8;
/**
 * Schneller dreht sich in dieser Welt nichts: 15π ≈ 47 rad/s, gut 450 Umdrehungen
 * je Minute.
 *
 * Die Grenze kommt aus Box2D und ist kein Schönheitsfehler: der Löser lässt
 * höchstens eine Vierteldrehung je Takt zu, sonst springen Körper durcheinander
 * hindurch — Zahnräder tun das schon weit darunter. Wer einen Motor so
 * auslegt, dass seine Leerlaufdrehzahl U/k darüber läge, sieht deshalb keinen
 * Leerlauf, sondern eine Maschine, die gegen eine unsichtbare Bremse arbeitet.
 * Die Voreinstellungen der Bauteile bleiben darunter.
 */
export const DREHZAHL_GRENZE = 0.25 * Math.PI * 60;
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
  /**
   * Offene Winde: ist das Seil ganz aufgewickelt, hängt die Last am Kranz und
   * wird mitgenommen. Die geschlossene hält sie an der Öffnung fest.
   */
  offen: boolean;
  /** Das Ende, an dem die Last hängt — für das Umhängen an den Kranz. */
  last: Ende;
  /** Ob schon an den Kranz umgehängt wurde. */
  amKranz?: boolean;
}

export class Welt {
  private id: b2WorldId;
  private koerper = new Map<string, b2BodyId>();
  private gelenke = new Map<string, b2JointId>();
  private verbinder = new Map<string, Verbinder>();
  private umdrehung = new Map<string, number>();
  private letzteLage = new Map<string, Punkt>();
  private tempo = new Map<string, { vx: number; vy: number }>();
  private wickel: Wickel[] = [];
  private seilzuege = new Map<string, Seilzug>();
  private kreis: Stromkreis;
  private waerme: Waermenetz;
  private optik: Optik;
  /** Was im laufenden Versuch an einem Teil verstellt wurde: Schalter, Spannung. */
  private bedienung = new Map<string, Record<string, number>>();
  /** Die Welle eines Motors: die Achse, über die er sein Moment abgibt. */
  private wellen = new Map<string, { verbinder: string; partner: string | null }>();
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

    this.kreis = new Stromkreis(aufbau);
    this.waerme = new Waermenetz(aufbau);
    this.optik = new Optik(aufbau);
    // Ein Motor gibt sein Moment über die Achse ab, die an ihm sitzt — das
    // Gehäuse hält dagegen. Ohne Achse dreht er ins Leere.
    for (const t of aufbau.teile.filter(x => x.art === "motor")) {
      const achse = aufbau.verbinder.find(v => v.art === "achse" && (v.a.teil === t.id || v.b.teil === t.id));
      if (achse) {
        const partner = achse.a.teil === t.id ? achse.b.teil : achse.a.teil;
        this.wellen.set(t.id, { verbinder: achse.id, partner });
      }
    }
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
    // Ein Kabel hält nichts: es ist elektrisch ein Gleichheitszeichen und
    // mechanisch ein Stück Litze, das durchhängt.
    if (v.art === "kabel") { this.verbinder.set(v.id, v); return; }
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
    } else if (v.art === "seil" && (v.ueber?.length ?? 0) > 0) {
      this.baueSeilzug(v);
      this.verbinder.set(v.id, v);
      return;
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
          ablauf: pa, offen: (v.werte.wickelt ?? 0) < 1.5, last: eB,
        });
      }
    }
    this.gelenke.set(v.id, joint);
    this.verbinder.set(v.id, v);
  }

  /**
   * Ein Seil, das über Rollen läuft.
   *
   * Kein Gelenk des Lösers, sondern eine eigene Bedingung über die ganze Bahn
   * — warum, steht in `seilzug.ts`. Die inneren Punkte sind die Mitten der
   * Rollen; ihr Halbmesser sagt nur, wie schnell sie sich mitdrehen.
   */
  private baueSeilzug(v: Verbinder) {
    const eA = v.a;
    // Eine Winde am Anfang: das Seil verlässt die Trommel an einer festen
    // Stelle im Raum, genau wie beim geraden Seil — nur dass die Bahn danach
    // noch über Rollen läuft. Liefe der erste Punkt mit der Trommel herum,
    // würde der erste Strang beim Drehen länger und kürzer und die Last stiege
    // mehr, als die Winde eingeholt hat.
    const wickelt = (v.werte.wickelt ?? 0) >= 0.5 && eA.teil !== null
      && Math.hypot(eA.punkt.x, eA.punkt.y) > 0.005;
    const ablauf = endeInWelt(this.aufbau, eA);

    const knoten: Seilknoten[] = [];
    const enden = [v.a, ...(v.ueber ?? []), v.b];
    for (const [i, e] of enden.entries()) {
      const koerper = this.koerperVon(e.teil);
      if (!koerper) return;
      if (i === 0 && wickelt) {
        knoten.push({ schluessel: "wand", koerper: this.wand, lokal: ablauf });
        continue;
      }
      const innen = i > 0 && i < enden.length - 1;
      const teil = e.teil === null ? undefined : this.aufbau.teile.find(t => t.id === e.teil);
      const durchmesser = teil?.werte.durchmesser ?? 0;
      const verbund = e.teil === null ? null : this.verbundFuer(e.teil, endeInWelt(this.aufbau, e));
      knoten.push({
        schluessel: verbund ? verbund.teile.join("+") : "wand",
        koerper,
        lokal: e.punkt,
        rolle: innen && durchmesser > 0 && this.drehtFrei(e.teil) ? durchmesser / 2 : undefined,
        verbund: verbund?.teile.map(id => this.koerper.get(id)).filter((k): k is b2BodyId => !!k),
        fest: verbund?.fest ?? false,
      });
    }
    const zug = new Seilzug(v.id, knoten, 1);
    zug.laenge = (v.werte.laenge ?? 0) > 0 ? v.werte.laenge! : zug.gespannt();
    this.seilzuege.set(v.id, zug);

    if (wickelt) {
      this.wickel.push({
        verbinder: v.id, trommel: eA.teil!, radius: Math.hypot(eA.punkt.x, eA.punkt.y),
        laenge0: zug.laenge, winkel0: this.umdrehung.get(eA.teil!) ?? 0,
        richtung: (v.werte.wickelrichtung ?? 1) >= 0 ? 1 : -1,
        ablauf, offen: (v.werte.wickelt ?? 0) < 1.5, last: v.b,
      });
    }
  }

  /**
   * Ob eine Scheibe sich überhaupt drehen kann.
   *
   * Eine festgeschraubte Scheibe ist keine Rolle, sondern ein Poller: das Seil
   * rutscht darüber, sie steht. Ihr trotzdem Takt für Takt eine Drehung
   * aufzuzwingen, hieße gegen die Schraube zu rechnen — der Löser müsste jedes
   * Mal wieder zurückholen, was die Zeichnung hineingedreht hat.
   */
  private drehtFrei(teil: string | null): boolean {
    return teil !== null
      && !this.aufbau.verbinder.some(v => v.art === "schraube" && (v.a.teil === teil || v.b.teil === teil));
  }

  /**
   * Was an einem Punkt starr zusammenhängt — und ob es überhaupt nachgeben kann.
   *
   * Wer am Haken eines Flaschenzugblocks zieht, zieht am ganzen Block: für die
   * Seilbahn ist verschraubtes Zeug *ein* Körper mit einer Masse. Eine Achse
   * zählt dazu, wenn sie genau an diesem Punkt sitzt — dann kann sich das Teil
   * darum nur drehen, und der Punkt selbst sitzt so fest wie angeschweißt.
   * Weiter weg zählt sie nicht: sonst gälte ein Hebel an der Wand als
   * unverrückbar, und ein Seil könnte ihn nicht mehr herumziehen.
   */
  private verbundFuer(teil: string, punkt: Punkt): { teile: string[]; fest: boolean } {
    const NAH = 0.01;
    const starr = (v: Verbinder, ende: Verbinder["a"]) =>
      v.art === "schraube"
      || (v.art === "achse" && Math.hypot(
        endeInWelt(this.aufbau, ende).x - punkt.x, endeInWelt(this.aufbau, ende).y - punkt.y) < NAH);

    const teile = new Set([teil]);
    let fest = false;
    for (const naechstes of teile) {
      for (const v of this.aufbau.verbinder) {
        if (v.art !== "achse" && v.art !== "schraube") continue;
        const [hier, dort] = v.a.teil === naechstes ? [v.a, v.b] : v.b.teil === naechstes ? [v.b, v.a] : [null, null];
        if (!hier || !starr(v, hier)) continue;
        if (dort!.teil === null) fest = true;
        else teile.add(dort!.teil);
      }
    }
    return { teile: [...teile].sort(), fest };
  }

  private winkelVon(teil: string | null): number {
    if (teil === null) return 0;
    return this.aufbau.teile.find(t => t.id === teil)?.winkel ?? 0;
  }

  /** Ein Takt: Brüche prüfen, rechnen, Ereignisse einsammeln, Drehungen aufsummieren. */
  schritt() {
    if (this.zerstoert) return;
    // Zuerst, was nachgibt — mit den Kräften des letzten Takts. Danach greift
    // `wickle` an die Gelenke, und Box2D vergisst dabei ihren Impuls: gefragt
    // man sie hinterher, meldeten sie null Newton und nichts risse je.
    this.pruefeAusloeser();
    this.wickle();
    this.treibeMotoren();
    // Licht braucht keine Zeit: die Bahnen werden bei jedem Takt neu verfolgt,
    // und wo ein Strahl endet, steht schon die nächste Wärmequelle.
    this.optik.rechne(id => {
      const z = this.zustand(id);
      const t = this.aufbau.teile.find(x => x.id === id)!;
      return z ? { pos: { x: z.x, y: z.y }, winkel: z.winkel } : { pos: t.pos, winkel: t.winkel };
    }, id => this.lichtleistung(id));
    this.sammleWaerme();
    this.waerme.rechne(TAKT, id => this.waermequellen.get(id) ?? 0);
    b2.b2World_Step(this.id, TAKT, UNTERSCHRITTE);
    // Die Seile über Rollen danach: der Löser hat die Schwerkraft schon in den
    // Geschwindigkeiten, und die Bahn hält sie im selben Takt wieder auf.
    for (const zug of this.seilzuege.values()) zug.rechne(TAKT);
    this.zeit += TAKT;

    // Gemessen wird das Tempo aus dem zurückgelegten Weg, nicht aus dem, was
    // der Löser als Geschwindigkeit führt.
    //
    // Box2D verschiebt einen Körper auch über die Lagekorrektur seiner
    // Bedingungen und nimmt die dafür nötige Geschwindigkeit hinterher wieder
    // heraus. Eine Winde, die ihr Seil einholt, hebt die Last deshalb sichtbar
    // um 15 cm je Sekunde, während `b2Body_GetLinearVelocity` 2,6 cm/s meldet.
    // Ein Messschreiber, der das anzeigte, würde lügen; Weg durch Zeit ist
    // ohnehin das, was man im Versuch selbst messen würde.
    for (const [id, body] of this.koerper) {
      this.umdrehung.set(id, (this.umdrehung.get(id) ?? 0) + b2.b2Body_GetAngularVelocity(body) * TAKT);
      const p = b2.b2Body_GetPosition(body);
      const vorher = this.letzteLage.get(id);
      if (vorher) this.tempo.set(id, { vx: (p.x - vorher.x) / TAKT, vy: (p.y - vorher.y) / TAKT });
      this.letzteLage.set(id, { x: p.x, y: p.y });
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
      const laenge = this.seillaenge(w.verbinder);
      if (laenge === undefined) continue;
      // Ganz aufgewickelt: bei der offenen Winde hängt die Last von jetzt an
      // am Kranz und fährt mit herum, statt an der Öffnung stehenzubleiben.
      if (w.offen && !w.amKranz && laenge <= w.radius + 1e-6) {
        this.hefteAnDenKranz(w);
        continue;
      }
      if (w.amKranz) continue;

      // Erst ablesen, dann verstellen: `SetLengthRange` setzt den gespeicherten
      // Impuls des Gelenks zurück, und danach meldet es null Newton.
      const kraft = this.kraft(w.verbinder);
      const zug = this.seilzuege.get(w.verbinder);
      if (zug) zug.laenge = laenge;
      else b2.b2DistanceJoint_SetLengthRange(this.gelenke.get(w.verbinder)!, 0, laenge);

      // Was am Seil hängt, hält die Trommel auf: das Moment ist Seilkraft mal
      // Halbmesser. Ein zu schwacher Motor kommt damit nicht mehr hoch.
      const trommel = this.koerper.get(w.trommel);
      if (trommel && kraft) b2.b2Body_ApplyTorque(trommel, -w.richtung * kraft.betrag * w.radius, true);
    }
  }

  /**
   * Rechnet den Stromkreis und lässt die Motoren ihr Moment abgeben.
   *
   * Der Kreis wird in jedem Takt neu gelöst, weil sich etwas geändert haben
   * kann: ein Schalter, die Spannung — und vor allem die Drehzahl, aus der die
   * Gegenspannung folgt. Das ist die ganze Kopplung zwischen Strom und
   * Mechanik, und sie läuft in beide Richtungen: wer die Welle festhält, treibt
   * den Strom hoch; wer sie dreht, macht aus dem Motor einen Dynamo.
   */
  private treibeMotoren() {
    if (this.kreis.leer) return;
    this.kreis.rechne(id => this.bedienung.get(id) ?? {}, id => this.wellendrehzahl(id));

    for (const [id, welle] of this.wellen) {
      const teil = this.aufbau.teile.find(t => t.id === id);
      const gehaeuse = this.koerper.get(id);
      if (!teil || !gehaeuse) continue;
      const moment = this.kreis.moment(teil);
      if (!moment) continue;
      const angetrieben = welle.partner === null ? this.wand : this.koerper.get(welle.partner);
      if (angetrieben) b2.b2Body_ApplyTorque(angetrieben, moment, true);
      b2.b2Body_ApplyTorque(gehaeuse, -moment, true);
    }
  }

  /**
   * Wo gerade Wärme entsteht, in Watt.
   *
   * Zwei Quellen, und beide sind Unterrichtsstoff: der elektrische Widerstand
   * und die Reibung. Am Motor zählt nur der Anteil im Anker — der Rest verlässt
   * ihn als Drehmoment und wird zu Hubarbeit, nicht zu Wärme.
   */
  private sammleWaerme() {
    this.waermequellen.clear();
    const zu = (id: string | null | undefined, w: number) => {
      if (id && w > 0) this.waermequellen.set(id, (this.waermequellen.get(id) ?? 0) + w);
    };

    for (const t of this.aufbau.teile) {
      // Was ein Strahl irgendwo abgibt, wird dort zu Wärme — Brennglas und
      // Sonnenkollektor brauchen dafür keinen eigenen Fall.
      zu(t.id, this.optik.aufgenommen(t.id));
      if (!istElektrisch(t.art)) continue;
      const m = this.kreis.messung(t.id);
      if (t.art === "widerstand") zu(t.id, Math.abs(m.leistung));
      // Eine Leuchte behält nur, was nicht als Licht hinausgeht.
      else if (istLeuchte(t.art)) zu(t.id, Math.abs(m.leistung) - this.lichtleistung(t.id));
      else if (t.art === "motor") zu(t.id, m.strom ** 2 * Math.max(1e-6, t.werte.widerstand ?? 1));
      else if (t.art === "batterie") zu(t.id, m.strom ** 2 * (t.werte.innenwiderstand ?? 0));
    }

    for (const [id, v] of this.verbinder) {
      if (v.art !== "achse" || (v.werte.reibung ?? 0) <= 0 || (v.werte.motorMoment ?? 0) > 0) continue;
      const gelenk = this.gelenke.get(id);
      if (!gelenk || !b2.b2Joint_IsValid(gelenk)) continue;
      const a = this.koerperVon(v.a.teil), b = this.koerperVon(v.b.teil);
      if (!a || !b) continue;
      const omega = b2.b2Body_GetAngularVelocity(b) - b2.b2Body_GetAngularVelocity(a);
      // Reibungsarbeit ist Moment mal Winkelgeschwindigkeit; sie verteilt sich
      // auf beide Seiten des Lagers.
      const leistung = Math.abs(b2.b2RevoluteJoint_GetMotorTorque(gelenk)) * Math.abs(omega);
      // Auf die Teile verteilen, die es *gibt*: sitzt das Lager an der Wand,
      // bekommt das eine Teil alles. Sonst verschwände die halbe Wärme.
      const enden = [v.a.teil, v.b.teil].filter((x): x is string => x !== null);
      for (const teil of enden) zu(teil, leistung / enden.length);
    }
  }

  /** Wie viel Licht eine Leuchte gerade abgibt, in Watt. */
  private lichtleistung(id: string): number {
    const t = this.aufbau.teile.find(x => x.id === id);
    if (!t || !istLeuchte(t.art)) return 0;
    return Math.abs(this.kreis.messung(id).leistung) * Math.min(1, Math.max(0, t.werte.wirkungsgrad ?? 0));
  }

  /** Alle Strahlstücke des Augenblicks — zum Zeichnen. */
  strahlen(): Strahlstueck[] {
    return this.optik.strahlen();
  }

  /** Wie viel Strahlungsleistung ein Teil gerade aufnimmt, in Watt. */
  strahlung(teil: string): number {
    return this.optik.aufgenommen(teil);
  }

  /** Die Temperatur eines Teils in Kelvin. */
  temperatur(teil: string): number {
    return this.waerme.temperatur(teil);
  }

  /** Wie weit ein Teil über der Umgebung liegt, in Kelvin. */
  uebertemperatur(teil: string): number {
    return this.waerme.uebertemperatur(teil);
  }

  /** Die gespeicherte Wärme eines Teils über der Umgebung, in Joule. */
  waermemenge(teil: string): number {
    return this.waerme.waermemenge(teil);
  }

  /** Wie schnell sich die Welle eines Motors gegen sein Gehäuse dreht, in 1/s. */
  private wellendrehzahl(motor: string): number {
    const welle = this.wellen.get(motor);
    if (!welle) return 0;
    const gehaeuse = this.koerper.get(motor);
    const angetrieben = welle.partner === null ? this.wand : this.koerper.get(welle.partner);
    if (!gehaeuse || !angetrieben) return 0;
    return b2.b2Body_GetAngularVelocity(angetrieben) - b2.b2Body_GetAngularVelocity(gehaeuse);
  }

  /** Was gerade wo an Wärme anfällt, in Watt. */
  private waermequellen = new Map<string, number>();

  /** Was der Stromkreis an einem Bauteil misst. */
  stromMessung(teil: string): Messung {
    return this.kreis.messung(teil);
  }

  /** Stellt ein Bedienelement eines Teils im laufenden Versuch um. */
  setzeTeilWert(teil: string, werte: Record<string, number>) {
    this.bedienung.set(teil, { ...(this.bedienung.get(teil) ?? {}), ...werte });
  }

  /**
   * Hängt das Seil einer offenen Winde an den Kranz der Trommel um.
   *
   * Bis hierher zog ein Gelenk zwischen einem festen Punkt im Raum und der
   * Last; jetzt sitzt das Ende auf der Trommel und dreht mit. Das Gelenk lässt
   * sich in Box2D nicht umhängen, also wird es neu gebaut — einmal, und dann
   * nie wieder.
   */
  private hefteAnDenKranz(w: Wickel) {
    const trommel = this.koerper.get(w.trommel);
    const last = this.koerperVon(w.last.teil);
    const alt = this.gelenke.get(w.verbinder);
    w.amKranz = true;
    if (!trommel || !last) return;
    if (alt && b2.b2Joint_IsValid(alt)) b2.b2DestroyJoint(alt);
    this.seilzuege.delete(w.verbinder);

    const v = this.verbinder.get(w.verbinder);
    const d = b2.b2DefaultDistanceJointDef();
    d.bodyIdA = trommel;
    d.localAnchorA = vec({ x: 0, y: w.radius });
    d.localAnchorB = vec(w.last.teil === null ? w.last.punkt : w.last.punkt);
    d.bodyIdB = last;
    // Kurz und straff: die Last hängt am Kranz, nicht mehr an einem Seil.
    d.length = 0.01;
    d.enableSpring = true;
    d.hertz = 0;
    d.enableLimit = true;
    d.minLength = 0;
    d.maxLength = 0.01;
    const neu = b2.b2CreateDistanceJoint(this.id, d);
    this.gelenke.set(w.verbinder, neu);
    if (v) this.verbinder.set(w.verbinder, v);
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
    const roh = b2.b2Body_GetLinearVelocity(body);
    const v = this.tempo.get(id) ?? { vx: roh.x, vy: roh.y };
    return {
      x: p.x, y: p.y,
      winkel: b2.b2Rot_GetAngle(b2.b2Body_GetRotation(body)),
      vx: v.vx, vy: v.vy,
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
    const zug = this.seilzuege.get(verbinderId);
    if (zug) {
      // Die Richtung ist die des ersten Strangs — dort, wo das Seil anfasst.
      const bahn = zug.bahn();
      const dx = bahn[1].x - bahn[0].x, dy = bahn[1].y - bahn[0].y;
      const l = Math.max(1e-9, Math.hypot(dx, dy));
      return { betrag: zug.zug, x: (zug.zug * dx) / l, y: (zug.zug * dy) / l, moment: 0 };
    }
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

  /** Die ganze Bahn eines Seils über Rollen — für die Zeichnung. */
  seilBahn(verbinderId: string): Punkt[] | undefined {
    return this.seilzuege.get(verbinderId)?.bahn();
  }

  /** Die Länge, die ein Seil gerade freigibt — beim Wickeln ändert sie sich. */
  seillaenge(verbinderId: string): number | undefined {
    if (!this.haelt(verbinderId)) return undefined;
    const w = this.wickel.find(x => x.verbinder === verbinderId);
    if (!w) return undefined;
    const gedreht = (this.umdrehung.get(w.trommel) ?? 0) - w.winkel0;
    // Kürzer als der Halbmesser kann es nicht werden: dann liegt die Last an
    // der Trommel an.
    return Math.min(w.laenge0 + 5, Math.max(w.radius, w.laenge0 - w.richtung * w.radius * gedreht));
  }

  /** Ob ein Verbinder noch hält. */
  haelt(verbinderId: string): boolean {
    if (this.seilzuege.has(verbinderId)) return true;
    const j = this.gelenke.get(verbinderId);
    return !!j && b2.b2Joint_IsValid(j);
  }

  /** Löst einen Verbinder — der Auslöser. */
  loese(verbinderId: string) {
    const j = this.gelenke.get(verbinderId);
    if (!this.seilzuege.has(verbinderId) && (!j || !b2.b2Joint_IsValid(j))) return;
    const ort = this.verbinderOrt(verbinderId);
    if (j && b2.b2Joint_IsValid(j)) b2.b2DestroyJoint(j);
    this.seilzuege.delete(verbinderId);
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

  /** Gibt einem Teil Schwung — die Kurbel, mit der man einen Dynamo anwirft. */
  gibDrehung(id: string, omega: number) {
    const body = this.koerper.get(id);
    if (body) b2.b2Body_SetAngularVelocity(body, omega);
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

  /** Massenträgheitsmoment eines Teils um seinen Schwerpunkt, in kg·m². */
  traegheit(id: string): number {
    const body = this.koerper.get(id);
    return body ? b2.b2Body_GetInertiaTensor(body) : 0;
  }

  /** Gibt den Platz im Löser frei. Danach ist die Welt nicht mehr zu gebrauchen. */
  zerstoere() {
    if (this.zerstoert) return;
    this.lasse();
    b2.b2DestroyWorld(this.id);
    this.zerstoert = true;
  }
}
