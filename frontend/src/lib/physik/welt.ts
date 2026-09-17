/**
 * Die Welt — Boden, Körper, Berührung.
 *
 * Unter dem Labor liegt ein Starrkörperlöser (planck, ein Box2D-Port). Er ist
 * **nicht** dafür da, die Schulversuche zu rechnen — das tun die analytischen
 * Modelle in `mechanik.ts`, weil nur sie eine Schwingungsdauer liefern, die
 * zur Formel passt. Er ist dafür da, dass Dinge fallen, liegenbleiben, sich
 * stapeln und einander umwerfen.
 *
 * Die Aufteilung folgt der Modelltreue:
 *
 * - **Schulbuch**: Geräte haben gar keinen Körper. Sie gehen durch alles
 *   hindurch, und das Pendel schwingt exakt nach 2π√(L/g).
 * - **Real**: das Pendel hängt als *richtiger* Körper an einem Drehgelenk.
 *   Damit tauscht es beim Stoß Impuls aus: der Klotz bekommt einen
 *   vernünftigen Schubs, das Pendel wird langsamer, und beim nächsten
 *   Durchgang stößt es erneut an.
 *
 * Der letzte Punkt war ein Fehler wert: zuerst war der Pendelkörper
 * *kinematisch* geführt. Ein kinematischer Körper hat in Box2D unendliche
 * Masse — er kann keine Energie abgeben und schleudert alles, was er trifft,
 * beim ersten Kontakt aus der Reichweite. Danach passierte nie wieder etwas.
 */
import * as planck from "planck";
import { koerperOrt, koerperRadius } from "./geometrie";
import type { MechanikZustand } from "./mechanik";
import { aufgeloest } from "./szene";
import type { Geraet, Modelltreue, Szene } from "./typen";

/** Lage und Tempo eines Körpers, in Weltkoordinaten. */
export interface WeltKoerper {
  x: number;
  y: number;
  winkel: number;
  vx: number;
  vy: number;
}

export type WeltZustand = Record<string, WeltKoerper>;

/** Ein Zusammenstoß — Anlass für einen Phänomen-Marker. */
export interface Stoss {
  a: string;
  b: string;
  ort: { x: number; y: number };
  /** Betrag der Relativgeschwindigkeit in m/s. */
  wucht: number;
}

/** Geräte, die als unbewegliches Mobiliar dastehen. */
const STEHT_FEST = new Set(["stativ", "schiefeebene", "hebel", "flaschenzug",
  "batterie", "widerstand", "lampe", "schalter", "voltmeter", "amperemeter", "signalgeber"]);

/** Geräte, die im realen Modell an einem Gelenk hängen und mitspielen. */
const AM_GELENK = new Set(["fadenpendel"]);

const KANTE = 60;

const pendelLaenge = (g: Geraet) => Math.max(0.01, g.werte.laenge ?? 1);

function bobOrt(g: Geraet, winkel: number) {
  const l = pendelLaenge(g);
  return { x: g.pos.x + l * Math.sin(winkel), y: g.pos.y - l * Math.cos(winkel) };
}

export class Welt {
  // Ohne »allowSleep: false« legen sich ruhende Körper schlafen, und der erste
  // Stoß bleibt oft der einzige, den man sieht. Bei einer Handvoll Körper
  // kostet Wachbleiben nichts.
  private welt = new planck.World({ gravity: new planck.Vec2(0, -9.81), allowSleep: false });
  private koerper = new Map<string, planck.Body>();
  private anker = new Map<string, planck.Body>();
  private bauart = new Map<string, string>();
  private startWerte = new Map<string, number>();
  private stoesse: Stoss[] = [];

  constructor() {
    const boden = this.welt.createBody();
    // Der Boden bekommt einen Namen, damit ein Aufschlag darauf als Ereignis
    // zählt — »das Gewicht kommt unten an« ist im Parcours ein Phänomen. Ohne
    // Namen fielen diese Berührungen stillschweigend unter den Tisch, und ein
    // Pendel, das über den Boden schleift, bremste unerklärlich ab.
    boden.setUserData("boden");
    boden.createFixture(new planck.Edge(new planck.Vec2(-KANTE, 0), new planck.Vec2(KANTE, 0)), {
      friction: 0.6,
    });

    this.welt.on("begin-contact", kontakt => {
      const koerperA = kontakt.getFixtureA().getBody();
      const koerperB = kontakt.getFixtureB().getBody();
      const a = koerperA.getUserData() as string | null;
      const b = koerperB.getUserData() as string | null;
      if (!a || !b) return;
      const va = koerperA.getLinearVelocity();
      const vb = koerperB.getLinearVelocity();
      const ort = koerperA.getPosition();
      this.stoesse.push({
        a, b,
        ort: { x: ort.x, y: ort.y },
        wucht: Math.hypot(va.x - vb.x, va.y - vb.y),
      });
    });
  }

  /** Welche Bauart ein Gerät gerade braucht — ändert sie sich, wird neu gebaut. */
  private artVon(g: Geraet, treue: Modelltreue, haengt: boolean): string | null {
    // Was eingehängt ist, ist Teil seines Wirts und kein eigener Körper.
    if (haengt) return null;
    const real = (g.treue ?? treue) === "real";
    if (AM_GELENK.has(g.typ)) return real ? "gelenk" : null;
    if (STEHT_FEST.has(g.typ)) return "statisch";
    if (g.typ === "massestueck") return "frei";
    return null;
  }

  private entferne(id: string) {
    const body = this.koerper.get(id);
    if (body) this.welt.destroyBody(body);
    const anker = this.anker.get(id);
    if (anker) this.welt.destroyBody(anker);
    this.koerper.delete(id);
    this.anker.delete(id);
    this.bauart.delete(id);
    this.startWerte.delete(id);
  }

  /** Bringt die Welt auf den Stand der Szene. */
  synchronisiere(szene: Szene, mechanik: MechanikZustand) {
    const sicht = aufgeloest(szene, mechanik);
    const gewollt = new Map<string, { g: Geraet; art: string }>();

    for (const g of sicht.geraete) {
      const haengt = g.typ === "massestueck"
        && szene.verbindungen.some(v => v.von.geraet === g.id || v.nach.geraet === g.id);
      const art = this.artVon(g, szene.treue, haengt);
      if (art) gewollt.set(g.id, { g, art });
    }

    for (const id of [...this.koerper.keys()]) {
      const soll = gewollt.get(id);
      if (!soll || this.bauart.get(id) !== soll.art) this.entferne(id);
    }

    for (const [id, { g, art }] of gewollt) {
      if (this.koerper.has(id)) {
        this.fuehreNach(id, g, art);
        continue;
      }
      this.baue(id, g, art, mechanik);
    }
  }

  private baue(id: string, g: Geraet, art: string, mechanik: MechanikZustand) {
    if (art === "gelenk") {
      // Ein echter Körper an einem Drehgelenk: er schwingt, stößt an, gibt
      // dabei Energie ab und wird selbst langsamer.
      const start = g.werte.startwinkel ?? 0;
      const anker = this.welt.createBody({ position: new planck.Vec2(g.pos.x, g.pos.y) });
      const ort = bobOrt(g, start);
      const bob = this.welt.createBody({
        type: "dynamic",
        position: new planck.Vec2(ort.x, ort.y),
        linearDamping: g.werte.daempfung ?? 0,
      });
      bob.setUserData(id);
      const r = koerperRadius(g.werte.masse ?? 0.2);
      bob.createFixture(new planck.Circle(r), {
        density: Math.max(0.001, g.werte.masse ?? 0.2) / (Math.PI * r * r),
        friction: 0.4,
        restitution: 0.2,
      });
      this.welt.createJoint(new planck.RevoluteJoint({}, anker, bob, new planck.Vec2(g.pos.x, g.pos.y)));
      this.anker.set(id, anker);
      this.koerper.set(id, bob);
      this.bauart.set(id, art);
      this.startWerte.set(id, start);
      return;
    }

    const ort = art === "gefuehrt" ? (koerperOrt(g, mechanik[id]) ?? g.pos) : g.pos;
    const body = this.welt.createBody({
      type: art === "frei" ? "dynamic" : "kinematic",
      position: new planck.Vec2(ort.x, ort.y),
    });
    body.setUserData(id);
    const r = g.typ === "massestueck" ? koerperRadius(g.werte.masse ?? 0.1) : 0.06;
    const hoehe = g.typ === "stativ" ? Math.max(0.1, g.werte.hoehe ?? 1.2) / 2 : r;
    const masse = Math.max(0.001, g.werte.masse ?? 0.2);
    body.createFixture(new planck.Box(r, hoehe), {
      density: masse / Math.max(1e-6, 4 * r * hoehe),
      friction: 0.5,
      restitution: 0.05,
    });
    this.koerper.set(id, body);
    this.bauart.set(id, art);
  }

  /**
   * Führt einen vorhandenen Körper nach.
   *
   * Der Anker wandert mit dem Stativ mit, und wenn jemand den Startwinkel
   * verstellt (am Regler oder durch Ziehen), wird das Pendel dorthin gesetzt
   * und neu losgelassen — sonst bliebe es im realen Modell unbeeindruckt.
   */
  private fuehreNach(id: string, g: Geraet, art: string) {
    if (art !== "gelenk") return;
    const anker = this.anker.get(id);
    const bob = this.koerper.get(id);
    if (!anker || !bob) return;

    anker.setPosition(new planck.Vec2(g.pos.x, g.pos.y));
    bob.setLinearDamping(g.werte.daempfung ?? 0);

    const start = g.werte.startwinkel ?? 0;
    if (this.startWerte.get(id) !== start) {
      this.startWerte.set(id, start);
      const ort = bobOrt(g, start);
      bob.setPosition(new planck.Vec2(ort.x, ort.y));
      bob.setLinearVelocity(new planck.Vec2(0, 0));
      bob.setAngularVelocity(0);
    }
  }

  /** Ein Zeitschritt. */
  schritt(_szene: Szene, _mechanik: MechanikZustand, dt: number) {
    this.stoesse = [];
    this.welt.step(dt);
  }

  /**
   * Der Schwingerzustand, den der Löser erzeugt hat.
   *
   * Im realen Modell führt nicht mehr die Differentialgleichung, sondern das
   * Gelenk. Damit Anzeige, Signale und Inspektor unverändert weiterarbeiten,
   * wird der Winkel aus der Lage des Körpers zurückgerechnet.
   */
  abgeleitet(szene: Szene, mechanik: MechanikZustand): MechanikZustand {
    const aus: MechanikZustand = {};
    const sicht = aufgeloest(szene, mechanik);

    for (const g of sicht.geraete) {
      if (this.bauart.get(g.id) !== "gelenk") continue;
      const bob = this.koerper.get(g.id);
      if (!bob) continue;
      const p = bob.getPosition();
      const v = bob.getLinearVelocity();
      const laenge = pendelLaenge(g);
      const winkel = Math.atan2(p.x - g.pos.x, g.pos.y - p.y);
      // Die Bahngeschwindigkeit auf die Tangente projizieren.
      const tempo = (v.x * Math.cos(winkel) + v.y * Math.sin(winkel)) / laenge;
      aus[g.id] = { q: winkel, v: tempo, start: g.werte.startwinkel ?? 0 };
    }

    return aus;
  }

  /**
   * Setzt einen Körper an einen Punkt — das Ziehen mit der Hand.
   *
   * Die Geschwindigkeit wird dabei genullt: was man festhält, fliegt nicht.
   */
  setzeOrt(id: string, pos: { x: number; y: number }) {
    const body = this.koerper.get(id);
    if (!body) return;
    body.setPosition(new planck.Vec2(pos.x, pos.y));
    body.setLinearVelocity(new planck.Vec2(0, 0));
    body.setAwake(true);
  }

  zustand(): WeltZustand {
    const stand: WeltZustand = {};
    for (const [id, body] of this.koerper) {
      const p = body.getPosition();
      const v = body.getLinearVelocity();
      stand[id] = { x: p.x, y: p.y, winkel: body.getAngle(), vx: v.x, vy: v.y };
    }
    return stand;
  }

  /** Die Zusammenstöße des letzten Schritts. */
  ereignisse(): Stoss[] {
    return this.stoesse;
  }

  /** Setzt alle Körper auf ihren Platz in der Szene zurück. */
  zuruecksetzen(szene: Szene, mechanik: MechanikZustand) {
    for (const id of [...this.koerper.keys()]) this.entferne(id);
    this.stoesse = [];
    this.synchronisiere(szene, mechanik);
  }
}
