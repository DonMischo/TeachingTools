/**
 * Die Welt — Boden, Körper, Berührung.
 *
 * Bis hierher war der Aufbau eine Sammlung von Geräten, die einander nicht
 * wahrnahmen: nichts stand auf etwas, nichts stieß an etwas. Genau das fehlte,
 * um einen Parcours zu bauen, bei dem eines das nächste anstößt.
 *
 * Deshalb liegt unter dem Labor jetzt ein Starrkörperlöser (planck, ein
 * Box2D-Port). Er ist **nicht** dafür da, die Schulversuche zu rechnen — das
 * tun weiterhin die analytischen Modelle in `mechanik.ts`, weil nur sie eine
 * Schwingungsdauer liefern, die zur Formel passt. Er ist dafür da, dass Dinge
 * fallen, liegenbleiben, sich stapeln und einander umwerfen.
 *
 * Die Aufteilung folgt der Modelltreue:
 *
 * - **Schulbuch**: Geräte sind ideal und gehen durcheinander hindurch. Das
 *   Pendel schwingt exakt nach 2π√(L/g), ungestört von allem anderen.
 * - **Real**: die Körper der Geräte stoßen mit, geben Energie ab und ändern
 *   dadurch den Verlauf.
 *
 * Frei herumliegende Massestücke fallen und stapeln sich in beiden Fällen —
 * dass ein Gewicht zu Boden fällt, ist keine Idealisierung.
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
  /** Die beiden beteiligten Geräte. */
  a: string;
  b: string;
  /** Wo es passiert ist. */
  ort: { x: number; y: number };
  /** Wie heftig, als Betrag der Relativgeschwindigkeit in m/s. */
  wucht: number;
}

/** Geräte, die als unbewegliches Mobiliar dastehen. */
const STEHT_FEST = new Set(["stativ", "schiefeebene", "hebel", "flaschenzug",
  "batterie", "widerstand", "lampe", "schalter", "voltmeter", "amperemeter", "signalgeber"]);

/** Geräte, deren Körper eine analytische Rechnung führt. */
const GEFUEHRT = new Set(["fadenpendel", "federpendel", "schiefeebene"]);

const KANTE = 60;

function groesseVon(g: Geraet): { b: number; h: number } {
  if (g.typ === "massestueck") {
    const r = koerperRadius(g.werte.masse ?? 0.1);
    return { b: r * 2, h: r * 2 };
  }
  if (g.typ === "stativ") return { b: 0.16, h: Math.max(0.1, g.werte.hoehe ?? 1.2) };
  return { b: 0.12, h: 0.12 };
}

/**
 * Hält die planck-Welt im Gleichtakt mit der Szene.
 *
 * Die Welt lebt zwischen den Schritten weiter — ein Körper, der rollt, soll
 * weiterrollen. Also wird sie nicht jedes Bild neu gebaut, sondern
 * nachgeführt: neue Geräte bekommen einen Körper, weggeräumte verlieren ihn.
 */
export class Welt {
  // Ohne »allowSleep: false« legen sich ruhende Körper schlafen. Ein Pendel,
  // das sie danach wieder anstößt, weckt sie zwar — aber der erste Stoß bleibt
  // dann oft der einzige, den man sieht. Bei einer Handvoll Körper kostet
  // Wachbleiben nichts.
  private welt = new planck.World({ gravity: new planck.Vec2(0, -9.81), allowSleep: false });
  private koerper = new Map<string, planck.Body>();
  private bauart = new Map<string, string>();
  private stoesse: Stoss[] = [];

  constructor() {
    const boden = this.welt.createBody();
    boden.createFixture(new planck.Edge(new planck.Vec2(-KANTE, 0), new planck.Vec2(KANTE, 0)), {
      friction: 0.6,
    });

    this.welt.on("begin-contact", kontakt => {
      const a = kontakt.getFixtureA().getBody().getUserData() as string | null;
      const b = kontakt.getFixtureB().getBody().getUserData() as string | null;
      if (!a || !b) return;
      const va = kontakt.getFixtureA().getBody().getLinearVelocity();
      const vb = kontakt.getFixtureB().getBody().getLinearVelocity();
      const ort = kontakt.getFixtureA().getBody().getPosition();
      this.stoesse.push({
        a, b,
        ort: { x: ort.x, y: ort.y },
        wucht: Math.hypot(va.x - vb.x, va.y - vb.y),
      });
    });
  }

  /** Welche Bauart ein Gerät gerade hat — ändert sie sich, wird neu gebaut. */
  private artVon(g: Geraet, treue: Modelltreue, haengt: boolean): string | null {
    // Was eingehängt ist, ist Teil seines Wirts und kein eigener Körper.
    if (haengt) return null;
    if (GEFUEHRT.has(g.typ)) return treue === "real" ? "gefuehrt-fest" : null;
    if (STEHT_FEST.has(g.typ)) return "statisch";
    if (g.typ === "massestueck") return "frei";
    return null;
  }

  /** Bringt die Welt auf den Stand der Szene. */
  synchronisiere(szene: Szene, mechanik: MechanikZustand) {
    const sicht = aufgeloest(szene, mechanik);
    const gewollt = new Map<string, { g: Geraet; art: string }>();

    for (const g of sicht.geraete) {
      const haengt = szene.verbindungen.some(v => v.von.geraet === g.id || v.nach.geraet === g.id)
        && g.typ === "massestueck";
      const art = this.artVon(g, szene.treue, haengt);
      if (art) gewollt.set(g.id, { g, art });
    }

    for (const [id, body] of this.koerper) {
      const soll = gewollt.get(id);
      if (!soll || this.bauart.get(id) !== soll.art) {
        this.welt.destroyBody(body);
        this.koerper.delete(id);
        this.bauart.delete(id);
      }
    }

    for (const [id, { g, art }] of gewollt) {
      if (this.koerper.has(id)) continue;
      const ort = art === "gefuehrt-fest" ? (koerperOrt(g, mechanik[g.id]) ?? g.pos) : g.pos;
      const body = this.welt.createBody({
        type: art === "frei" ? "dynamic" : "kinematic",
        position: new planck.Vec2(ort.x, ort.y),
      });
      body.setUserData(id);
      const { b, h } = groesseVon(g);
      const masse = Math.max(0.001, g.werte.masse ?? 0.2);
      body.createFixture(new planck.Box(b / 2, h / 2), {
        density: masse / Math.max(1e-6, b * h),
        friction: 0.5,
        restitution: 0.05,
      });
      this.koerper.set(id, body);
      this.bauart.set(id, art);
    }
  }

  /**
   * Ein Zeitschritt.
   *
   * Geführte Körper werden vorher auf ihre gerechnete Lage gesetzt und
   * bekommen die passende Geschwindigkeit — dadurch stoßen sie richtig an,
   * ohne dass der Löser ihre Bahn verändert.
   */
  schritt(szene: Szene, mechanik: MechanikZustand, dt: number) {
    this.stoesse = [];
    const sicht = aufgeloest(szene, mechanik);

    for (const g of sicht.geraete) {
      const body = this.koerper.get(g.id);
      if (!body || this.bauart.get(g.id) !== "gefuehrt-fest") continue;
      const ziel = koerperOrt(g, mechanik[g.id]);
      if (!ziel) continue;
      const jetzt = body.getPosition();
      body.setLinearVelocity(new planck.Vec2((ziel.x - jetzt.x) / dt, (ziel.y - jetzt.y) / dt));
    }

    this.welt.step(dt);
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

  /** Setzt alle freien Körper auf ihren Platz in der Szene zurück. */
  zuruecksetzen(szene: Szene, mechanik: MechanikZustand) {
    for (const body of this.koerper.values()) this.welt.destroyBody(body);
    this.koerper.clear();
    this.bauart.clear();
    this.stoesse = [];
    this.synchronisiere(szene, mechanik);
  }
}
