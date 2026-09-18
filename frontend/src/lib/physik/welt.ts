/**
 * Die Welt — Boden, Körper, Berührung.
 *
 * Unter dem Labor liegt ein Starrkörperlöser (planck, ein Box2D-Port). Er ist
 * **nicht** dafür da, die Schulversuche zu rechnen — das tun die analytischen
 * Modelle in `mechanik.ts`, weil nur sie eine Schwingungsdauer liefern, die
 * zur Formel passt. Er ist dafür da, dass Dinge fallen, liegenbleiben, sich
 * stapeln und einander umwerfen.
 *
 * **Jedes Gerät nimmt Raum ein.** Wie es das tut, hängt davon ab, wer es
 * bewegt:
 *
 * - *frei* — lose Teile (Gewichte, Murmeln, Klötze, Bretter, der Wagen).
 *   Sie sind echte Körper, auch wenn sie irgendwo hängen: die Verbindung wird
 *   zum Gelenk. Ein Brett auf einem Drehpunkt ist so eine Wippe, auf die man
 *   ein Gewicht fallen lassen kann, und was auf dem anderen Ende liegt, fliegt.
 * - *statisch* — Geräte, die dastehen: Stativ, Drehpunkt, Rampe, Rohr, das
 *   Abschussgerät, die Bauteile des Stromkreises.
 * - *folgt* — was ein analytisches Modell bewegt (Hebelbalken, Last an der
 *   Feder, Kiste auf der Rampe). Es bekommt eine Oberfläche, die dem Modell
 *   folgt, aber nur im realen Modell. Im Schulbuch gehen bewegte Geräte durch
 *   alles hindurch, damit die Messung die Formel trifft.
 * - *gelenk* — das Fadenpendel im realen Modell: ein echter Körper an einem
 *   Drehgelenk. Zuerst war er kinematisch geführt; ein kinematischer Körper
 *   hat unendliche Masse und schleuderte alles, was er traf, aus der
 *   Reichweite. Danach passierte nie wieder etwas.
 *
 * Was miteinander verbunden ist, stößt nicht aneinander. Sonst bliebe das
 * Pendel an der Stange seines eigenen Stativs hängen und das Brett schabte
 * am eigenen Drehpunkt.
 */
import * as planck from "planck";
import { EIGENER_HAKEN, hangEnden, hangOrt, koerperRadius, ROHRE, rohrWaende, stativTeile, umriss, wagenMasse } from "./geometrie";
import { geraetTyp, portVon } from "./katalog";
import { gesamtMasse, type MechanikZustand } from "./mechanik";
import { feststoff, masseKasten, masseKugel } from "./material";
import { aufgeloest, portOrt, treueVon, wirtKette } from "./szene";
import type { Geraet, Punkt, Szene, Verbindung } from "./typen";

/** Lage und Tempo eines Körpers, in Weltkoordinaten. */
export interface WeltKoerper {
  x: number;
  y: number;
  winkel: number;
  vx: number;
  vy: number;
  /** Ein freier Körper: seine Lage kommt aus dem Löser, nicht aus dem Aufbau. */
  frei?: boolean;
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

/** Lose Teile: echte Körper, auch wenn sie hängen oder aufliegen. */
const LOSE = new Set(["massestueck", "kugel", "klotz", "brett", "wagen"]);

/**
 * Geräte, deren Bewegung ein analytisches Modell rechnet.
 *
 * Was an ihnen hängt, gehört ihnen: das Modell bestimmt, wo es ist. Der
 * Kraftmesser gehört nicht dazu — er zeigt nur an. Was darunter hängt, ist
 * ein echter Körper und pendelt, wenn man es anstößt.
 */
const ANALYTISCH = new Set(["fadenpendel", "federpendel", "hebel", "waage", "flaschenzug", "probe", "schiefeebene"]);

/** Geräte, deren Balken sich nach dem Modell neigt. */
const BALKEN = new Set(["hebel", "waage"]);

/** Nichts zum Anstoßen: ein Faden, ein Draht. */
const OHNE_KOERPER = new Set(["probe"]);

const KANTE = 60;
const WAND = { friction: 0.5, restitution: 0.1 };

const pendelLaenge = (g: Geraet) => Math.max(0.01, g.werte.laenge ?? 1);

function bobOrt(g: Geraet, winkel: number) {
  const l = pendelLaenge(g);
  return { x: g.pos.x + l * Math.sin(winkel), y: g.pos.y - l * Math.cos(winkel) };
}

/** Wo die Kiste auf der Rampe sitzt: auf der Bahn, nicht halb darin. */
function kistenOrt(g: Geraet, weg: number): { mitte: Punkt; winkel: number; r: number } {
  const w = g.werte.winkel ?? Math.PI / 6;
  const r = koerperRadius(g.werte.masse ?? 0.5);
  const p = hangOrt(g, weg);
  return { mitte: { x: p.x + r * Math.sin(w), y: p.y + r * Math.cos(w) }, winkel: -w, r };
}

/** Kleinster Winkelunterschied, damit ein geführter Balken nicht einmal herumdreht. */
const winkelDifferenz = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Der Anschluss, mit dem ein Gerät eingehängt ist — und woran. */
function aufhaengung(szene: Szene, g: Geraet): { v: Verbindung; wirt: string; port: string } | null {
  const eigener = EIGENER_HAKEN[g.typ];
  if (!eigener) return null;
  const v = szene.verbindungen.find(x =>
    (x.von.geraet === g.id && x.von.port === eigener) || (x.nach.geraet === g.id && x.nach.port === eigener));
  if (!v) return null;
  const dort = v.von.geraet === g.id ? v.nach : v.von;
  return { v, wirt: dort.geraet, port: dort.port };
}

/**
 * Zusammenhängende Aufbauten, als Nummern.
 *
 * Box2D kennt Gruppen mit negativer Nummer: was darin liegt, stößt nie
 * aneinander. Genau das braucht ein Aufbau — nur fremde Teile sollen sich
 * berühren.
 */
function gruppen(szene: Szene): Map<string, number> {
  const eltern = new Map(szene.geraete.map(g => [g.id, g.id]));
  const wurzel = (id: string): string => {
    let w = id;
    while (eltern.get(w) !== w) w = eltern.get(w)!;
    return w;
  };
  for (const v of szene.verbindungen) {
    const a = wurzel(v.von.geraet), b = wurzel(v.nach.geraet);
    if (a !== b && eltern.has(a) && eltern.has(b)) eltern.set(a, b);
  }
  const nummer = new Map<string, number>();
  const aus = new Map<string, number>();
  for (const g of szene.geraete) {
    const w = wurzel(g.id);
    if (!nummer.has(w)) nummer.set(w, -(nummer.size + 1));
    aus.set(g.id, nummer.get(w)!);
  }
  return aus;
}

interface Gelenk {
  joint: planck.Joint;
  a: planck.Body;
  b: planck.Body;
}

export class Welt {
  // Ohne »allowSleep: false« legen sich ruhende Körper schlafen, und der erste
  // Stoß bleibt oft der einzige, den man sieht. Bei einer Handvoll Körper
  // kostet Wachbleiben nichts.
  private welt = new planck.World({ gravity: new planck.Vec2(0, -9.81), allowSleep: false });
  private koerper = new Map<string, planck.Body>();
  private anker = new Map<string, planck.Body>();
  // Räder, die Kiste der Rampe — alles, was mit seinem Gerät verschwinden muss.
  private beiwerk = new Map<string, planck.Body[]>();
  private bauart = new Map<string, string>();
  private startWerte = new Map<string, number>();
  private gruppe = new Map<string, number>();
  private gelenke = new Map<string, Gelenk>();
  private stoesse: Stoss[] = [];
  private boden: planck.Body;
  // Die Hand im Versuch: ein Federgriff, der den Körper zum Zeiger zieht.
  private hand: planck.MouseJoint | null = null;

  constructor() {
    const boden = this.welt.createBody();
    this.boden = boden;
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

      // Der Berührpunkt, nicht der Mittelpunkt eines der beiden Körper: beim
      // Aufschlag ist einer davon der Boden, und dessen Mittelpunkt liegt im
      // Ursprung — der Marker landete dadurch weit weg vom Geschehen.
      const manifold = kontakt.getWorldManifold(null);
      const treffer = manifold?.points?.[0];
      const ersatz = (a === "boden" ? koerperB : koerperA).getPosition();
      this.stoesse.push({
        a, b,
        ort: treffer ? { x: treffer.x, y: treffer.y } : { x: ersatz.x, y: ersatz.y },
        wucht: Math.hypot(va.x - vb.x, va.y - vb.y),
      });
    });
  }

  /**
   * Welche Bauart ein Gerät gerade braucht — ändert sie sich, wird neu gebaut.
   *
   * Die Reihenfolge der Fragen ist die Reihenfolge der Zuständigkeit: erst,
   * ob ein Modell das Gerät führt, dann, ob es lose ist, zuletzt steht es.
   */
  private artVon(szene: Szene, g: Geraet): string | null {
    const real = treueVon(szene, g) === "real";
    if (g.typ === "fadenpendel") return real ? "gelenk" : null;
    if (OHNE_KOERPER.has(g.typ)) return null;

    // Wem gehört es? Dem nächsten Modell in der Kette, an der es hängt.
    const besitzer = wirtKette(szene, g.id).find(w => ANALYTISCH.has(w.typ));
    if (besitzer) {
      // Am Fadenpendel ist der Pendelkörper selbst die Last — ein zweiter
      // Körper an derselben Stelle stieße gegen den ersten.
      if (besitzer.typ === "fadenpendel") return null;
      return real ? "folgt" : null;
    }

    if (LOSE.has(g.typ)) {
      // Festgeschraubt ist es Mobiliar — eine Rampe, ein Anschlag.
      if ((g.typ === "brett" || g.typ === "klotz") && (g.werte.fest ?? 0) >= 0.5) return "statisch";
      return "frei";
    }
    if (BALKEN.has(g.typ)) return real ? "folgt" : null;
    // Eine Rohrbahn steht, auch wenn ihre Teile aneinander eingerastet sind.
    if (ROHRE.has(g.typ)) return "statisch";
    // Wer an einem Stativ hängt (Kraftmesser, Federpendel), folgt seinem Haken.
    return aufhaengung(szene, g) ? "folgt" : "statisch";
  }

  private entferne(id: string) {
    const body = this.koerper.get(id);
    if (this.hand && body && this.hand.getBodyB() === body) this.lasse();
    if (body) this.welt.destroyBody(body);
    const anker = this.anker.get(id);
    if (anker) this.welt.destroyBody(anker);
    for (const teil of this.beiwerk.get(id) ?? []) this.welt.destroyBody(teil);
    this.koerper.delete(id);
    this.anker.delete(id);
    this.beiwerk.delete(id);
    this.bauart.delete(id);
    this.startWerte.delete(id);
    this.gruppe.delete(id);
  }

  /** Bringt die Welt auf den Stand der Szene. */
  synchronisiere(szene: Szene, mechanik: MechanikZustand) {
    const sicht = aufgeloest(szene, mechanik);
    const gewollt = new Map<string, { g: Geraet; art: string }>();

    for (const g of sicht.geraete) {
      let art = this.artVon(szene, g);
      // Die Masse steckt in der Bauart: haengt jemand ein Gewicht an oder ab,
      // aendert sich die Kennung und der Koerper wird mit der neuen Masse und
      // der neuen Groesse neu gebaut.
      if (art === "gelenk") art = `gelenk:${gesamtMasse(szene, g).toFixed(4)}`;
      // Maße, Werkstoff und Lage stecken in der Kennung: ändert man sie, wird
      // der Körper mit den neuen Eigenschaften neu gebaut.
      if (art && !art.startsWith("gelenk")) {
        art = `${art}:${g.typ}:${JSON.stringify(g.werte)}:${(g.winkel ?? 0).toFixed(3)}`;
      }
      if (art) gewollt.set(g.id, { g, art });
    }

    // Wird ein Körper neu gebaut, übernimmt der neue Lage und Schwung des
    // alten. Sonst spränge die Last einer gerissenen Probe an den Platz, an dem
    // man sie einst hingestellt hat, statt von dort zu fallen, wo sie hing.
    const erbe = new Map<string, { p: planck.Vec2; w: number; v: planck.Vec2 }>();
    for (const id of [...this.koerper.keys()]) {
      const soll = gewollt.get(id);
      if (!soll || this.bauart.get(id) !== soll.art) {
        const alt = this.koerper.get(id)!;
        if (soll && !this.bauart.get(id)?.startsWith("gelenk")) {
          erbe.set(id, { p: alt.getPosition().clone(), w: alt.getAngle(), v: alt.getLinearVelocity().clone() });
        }
        this.entferne(id);
      }
    }

    for (const [id, { g, art }] of gewollt) {
      if (this.koerper.has(id)) {
        this.fuehreNach(id, g, art);
        continue;
      }
      this.baue(id, g, art, szene);
      const vorher = erbe.get(id);
      const neu = this.koerper.get(id);
      if (vorher && neu && neu.isDynamic()) {
        neu.setTransform(vorher.p, vorher.w);
        neu.setLinearVelocity(vorher.v);
      }
    }

    this.gruppiere(szene);
    this.verbinde(szene, sicht, mechanik);
  }

  /** Setzt die Stoßgruppen neu, wenn sich Verbindungen geändert haben. */
  private gruppiere(szene: Szene) {
    const soll = gruppen(szene);
    for (const [id, body] of this.koerper) {
      const nummer = soll.get(id) ?? 0;
      if (this.gruppe.get(id) === nummer) continue;
      this.gruppe.set(id, nummer);
      for (const teil of [body, ...(this.beiwerk.get(id) ?? [])]) {
        for (let f = teil.getFixtureList(); f; f = f.getNext()) f.setFilterGroupIndex(nummer);
      }
    }
  }

  /**
   * Aus Verbindungen werden Gelenke.
   *
   * Nur für lose Teile — was ein Modell führt, braucht kein Gelenk. Worauf man
   * etwas stellt (Lager, Ladefläche, Waagschale), dort sitzt es fest; ein
   * Drehlager lässt es kippen; an einem Haken hängt es und pendelt. Ein Stapel
   * Schlitzgewichte ist fest verbunden, sonst schlackerte er wie eine Kette.
   */
  private verbinde(szene: Szene, sicht: Szene, mechanik: MechanikZustand) {
    const gewollt = new Set<string>();

    for (const g of szene.geraete) {
      const kind = this.koerper.get(g.id);
      if (!kind || !kind.isDynamic() || this.bauart.get(g.id)?.startsWith("gelenk")) continue;
      const h = aufhaengung(szene, g);
      if (!h) continue;
      const wirt = this.koerper.get(h.wirt);
      if (!wirt) continue;
      gewollt.add(h.v.id);

      const alt = this.gelenke.get(h.v.id);
      if (alt && alt.a === wirt && alt.b === kind) continue;
      if (alt) this.loese(h.v.id);

      const wirtGeraet = sicht.geraete.find(x => x.id === h.wirt)!;
      const anschluss = portOrt(wirtGeraet, h.port, mechanik[h.wirt]) ?? wirtGeraet.pos;
      const punkt = new planck.Vec2(anschluss.x, anschluss.y);
      const port = portVon(wirtGeraet.typ, h.port);
      const stapel = g.typ === "massestueck" && wirtGeraet.typ === "massestueck";

      const joint = !port?.dreh && (port?.traegt || stapel)
        ? this.welt.createJoint(new planck.WeldJoint({}, wirt, kind, punkt))
        : this.welt.createJoint(new planck.RevoluteJoint({}, wirt, kind, punkt));
      if (joint) this.gelenke.set(h.v.id, { joint, a: wirt, b: kind });
    }

    for (const id of [...this.gelenke.keys()]) if (!gewollt.has(id)) this.loese(id);
  }

  /** Löst ein Gelenk — falls seine Körper noch leben, sonst ist es schon weg. */
  private loese(vid: string) {
    const gelenk = this.gelenke.get(vid);
    this.gelenke.delete(vid);
    if (!gelenk) return;
    const lebt = (b: planck.Body) => [...this.koerper.values()].includes(b);
    if (lebt(gelenk.a) && lebt(gelenk.b)) this.welt.destroyJoint(gelenk.joint);
  }

  private baue(id: string, g: Geraet, art: string, szene: Szene) {
    if (art.startsWith("gelenk")) {
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
      // Groesse und Masse kommen von dem, was angehaengt ist. Ohne Gewicht ist
      // der Koerper winzig und leicht — ein blosser Faden wirft nichts um, und
      // das ist richtig so.
      const masse = gesamtMasse(szene, g);
      const r = koerperRadius(masse);
      bob.createFixture(new planck.Circle(r), {
        density: masse / (Math.PI * r * r),
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

    const typ = art.startsWith("frei") ? "dynamic" : art.startsWith("folgt") ? "kinematic" : "static";
    const balken = BALKEN.has(g.typ);
    const body = this.welt.createBody({
      type: typ,
      position: new planck.Vec2(g.pos.x, g.pos.y),
      angle: balken ? -(g.werte.startneigung ?? 0) : (g.winkel ?? 0),
    });
    body.setUserData(id);
    this.koerper.set(id, body);
    this.bauart.set(id, art);
    this.formen(id, g, body, szene);
  }

  /** Die Gestalt eines Geräts — so, wie die Werkbank es zeichnet. */
  private formen(id: string, g: Geraet, body: planck.Body, szene: Szene) {
    const kasten = (b: number, h: number, mitte = new planck.Vec2(0, 0), winkel = 0) =>
      new planck.Box(b / 2, h / 2, mitte, winkel);

    // Ein Rohr ist kein Klotz, sondern zwei Wände mit Luft dazwischen. Als
    // Kettenform liegen sie dem Löser genau so vor, wie die Werkbank sie malt.
    if (ROHRE.has(g.typ)) {
      for (const wand of rohrWaende(g).waende) {
        body.createFixture(new planck.Chain(wand.map(p => new planck.Vec2(p.x, p.y)), false), {
          friction: 0.25,
          restitution: 0.1,
        });
      }
      return;
    }

    // Der Versuchswagen: eine Wanne auf zwei frei drehenden Rädern. Die Räder
    // sind eigene Körper an Drehgelenken — nur dann rollt er wirklich, statt
    // auf dem Boden zu schleifen. Festgezurrte Ladung ist ein eigener Körper
    // und sitzt mit einem Gelenk auf der Wanne; ihre Masse trägt sie selbst.
    if (g.typ === "wagen") {
      const w = wagenMasse(g);
      const leer = Math.max(0.01, g.werte.masse ?? 0.5);
      body.setLinearDamping(Math.max(0, g.werte.rollreibung ?? 0.05));
      body.createFixture(kasten(w.laenge, w.hoehe), {
        density: leer / (w.laenge * w.hoehe),
        friction: 0.4,
        restitution: 0.05,
      });
      const raeder: planck.Body[] = [];
      for (const achse of w.achsen) {
        const mitte = new planck.Vec2(g.pos.x + achse.x, g.pos.y + achse.y);
        const rad = this.welt.createBody({ type: "dynamic", position: mitte });
        // Ohne Namen zählt die Berührung Rad–Boden nicht als Ereignis; sonst
        // hinterließe jedes rollende Rad im Parcours einen Marker.
        rad.createFixture(new planck.Circle(w.rad / 2), {
          density: 600,
          friction: 0.9,
          restitution: 0.05,
        });
        this.welt.createJoint(new planck.RevoluteJoint({}, body, rad, mitte));
        raeder.push(rad);
      }
      this.beiwerk.set(id, raeder);
      return;
    }

    // Murmeln sind rund und rollen — als Kasten täten sie es nicht.
    if (g.typ === "kugel") {
      const stoff = feststoff(g.werte.stoff ?? 2);
      const r = Math.max(0.003, (g.werte.durchmesser ?? 0.02) / 2);
      body.createFixture(new planck.Circle(r), {
        density: masseKugel(stoff, r * 2) / (Math.PI * r * r),
        friction: stoff.reibung,
        restitution: stoff.sprung,
      });
      return;
    }

    if (g.typ === "brett" || g.typ === "klotz") {
      const stoff = feststoff(g.werte.stoff ?? 0);
      const b = g.typ === "brett"
        ? Math.max(0.05, g.werte.laenge ?? 0.5) : Math.max(0.02, g.werte.breite ?? 0.12);
      const h = g.typ === "brett"
        ? Math.max(0.005, g.werte.dicke ?? 0.02) : Math.max(0.02, g.werte.hoehe ?? 0.12);
      body.createFixture(kasten(b, h), {
        density: masseKasten(stoff, b, h) / (b * h),
        friction: stoff.reibung,
        restitution: stoff.sprung,
      });
      return;
    }

    if (g.typ === "massestueck") {
      const r = koerperRadius(g.werte.masse ?? 0.1);
      body.createFixture(kasten(2 * r, 2 * r), {
        density: Math.max(0.001, g.werte.masse ?? 0.1) / (4 * r * r),
        friction: 0.5,
        restitution: 0.05,
      });
      return;
    }

    // Das Stativ ist Fuß, Stange und Ausleger — kein Kasten. Als Kasten stünde
    // es jedem im Weg, der neben der Stange vorbeirollt.
    if (g.typ === "stativ") {
      const t = stativTeile(g);
      const w = g.winkel ?? 0;
      const lokal = (p: Punkt) => {
        const dx = p.x - g.pos.x, dy = p.y - g.pos.y;
        return new planck.Vec2(dx * Math.cos(-w) - dy * Math.sin(-w), dx * Math.sin(-w) + dy * Math.cos(-w));
      };
      const fuss = lokal(t.fuss), kopf = lokal(t.kopf), haken = lokal(t.haken);
      const stange = (a: planck.Vec2, b: planck.Vec2, dicke: number) => kasten(
        Math.hypot(b.x - a.x, b.y - a.y), dicke,
        new planck.Vec2((a.x + b.x) / 2, (a.y + b.y) / 2), Math.atan2(b.y - a.y, b.x - a.x));
      body.createFixture(stange(fuss, kopf, 0.02), WAND);
      body.createFixture(stange(kopf, haken, 0.015), WAND);
      body.createFixture(kasten(0.2, 0.02, new planck.Vec2(fuss.x, fuss.y + 0.01)), WAND);
      return;
    }

    // Der Drehpunkt ist ein Keil, die schiefe Ebene eine Rampe: beides Dreiecke,
    // an denen eine Murmel hinunterrollt.
    if (g.typ === "drehpunkt") {
      const h = Math.max(0.03, g.werte.hoehe ?? 0.1);
      body.createFixture(new planck.Polygon([
        new planck.Vec2(0, h / 2), new planck.Vec2(-h * 0.8, -h / 2), new planck.Vec2(h * 0.8, -h / 2),
      ]), WAND);
      return;
    }
    if (g.typ === "schiefeebene") {
      const { oben, unten } = hangEnden(g);
      const lokal = (p: Punkt) => new planck.Vec2(p.x - g.pos.x, p.y - g.pos.y);
      body.createFixture(new planck.Polygon([
        lokal(oben), lokal({ x: oben.x, y: unten.y }), lokal(unten),
      ]), { friction: Math.max(0, g.werte.reibungszahl ?? 0.2), restitution: 0.05 });
      // Die Kiste folgt dem Modell — im realen Modell mit Oberfläche.
      if (treueVon(szene, g) === "real") {
        const k = kistenOrt(g, g.werte.startweg ?? 0);
        const kiste = this.welt.createBody({
          type: "kinematic", position: new planck.Vec2(k.mitte.x, k.mitte.y), angle: k.winkel,
        });
        kiste.setUserData(id);
        kiste.createFixture(kasten(2 * k.r, 2 * k.r), WAND);
        this.beiwerk.set(id, [kiste]);
      }
      return;
    }

    // Hebel und Waage: der Balken, so lang wie beide Arme zusammen.
    if (BALKEN.has(g.typ)) {
      const links = g.werte.armLinks ?? 0.3, rechts = g.werte.armRechts ?? 0.3;
      body.createFixture(kasten(links + rechts, 0.025, new planck.Vec2((rechts - links) / 2, 0)), WAND);
      return;
    }

    // Alles andere nimmt den Platz ein, den es auf der Werkbank hat.
    const t = geraetTyp(g.typ);
    const u = umriss(g, t?.groesse ?? { b: 0.1, h: 0.1 });
    body.createFixture(kasten(u.b, u.h, new planck.Vec2(u.mitte.x - g.pos.x, u.mitte.y - g.pos.y)), WAND);
  }

  /**
   * Führt einen vorhandenen Körper nach.
   *
   * Der Anker wandert mit dem Stativ mit, und wenn jemand den Startwinkel
   * verstellt (am Regler oder durch Ziehen), wird das Pendel dorthin gesetzt
   * und neu losgelassen — sonst bliebe es im realen Modell unbeeindruckt.
   */
  private fuehreNach(id: string, g: Geraet, art: string) {
    if (!art.startsWith("gelenk")) {
      // Verschiebt man eine Rampe oder ein Rohr, muss der Körper mit. Sonst
      // bliebe die Wand, an der die Murmel abprallt, am alten Platz stehen,
      // während das Bild längst woanders ist.
      const fest = this.koerper.get(id);
      if (!fest || !art.startsWith("statisch")) return;
      const p = fest.getPosition(), w = g.winkel ?? 0;
      if (Math.abs(p.x - g.pos.x) > 1e-9 || Math.abs(p.y - g.pos.y) > 1e-9
        || Math.abs(fest.getAngle() - w) > 1e-9) {
        fest.setTransform(new planck.Vec2(g.pos.x, g.pos.y), w);
      }
      return;
    }
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

  /**
   * Ein Zeitschritt.
   *
   * Was einem Modell folgt, wird vorher auf Kurs gebracht — nicht versetzt,
   * sondern mit genau dem Tempo angeschoben, das es in diesem Schritt ans Ziel
   * bringt. Nur so gibt ein Hebelbalken, der hochschnellt, einer Murmel auch
   * wirklich Schwung mit.
   */
  schritt(szene: Szene, mechanik: MechanikZustand, dt: number) {
    this.stoesse = [];
    const sicht = aufgeloest(szene, mechanik);
    const fuehre = (body: planck.Body, ziel: Punkt, winkel: number) => {
      const p = body.getPosition();
      body.setLinearVelocity(new planck.Vec2((ziel.x - p.x) / dt, (ziel.y - p.y) / dt));
      body.setAngularVelocity(winkelDifferenz(winkel, body.getAngle()) / dt);
    };

    for (const g of sicht.geraete) {
      const body = this.koerper.get(g.id);
      if (body && this.bauart.get(g.id)?.startsWith("folgt")) {
        const winkel = BALKEN.has(g.typ)
          ? -(mechanik[g.id]?.q ?? g.werte.startneigung ?? 0)
          : (g.winkel ?? 0);
        fuehre(body, g.pos, winkel);
      }
      if (g.typ === "schiefeebene") {
        const kiste = this.beiwerk.get(g.id)?.[0];
        if (kiste) {
          const k = kistenOrt(g, mechanik[g.id]?.q ?? g.werte.startweg ?? 0);
          fuehre(kiste, k.mitte, k.winkel);
        }
      }
    }

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
      if (!this.bauart.get(g.id)?.startsWith("gelenk")) continue;
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
   * Alles, was mit einem Gerät starr zusammenhängt: seine Räder und alles, was
   * daraufgeschweißt ist. Wer einen beladenen Wagen anschiebt, schiebt die
   * Ladung mit; bekäme nur die Wanne das Tempo, hielte die festgezurrte Last
   * sie sofort wieder fest.
   */
  private verbund(id: string): planck.Body[] {
    const start = this.koerper.get(id);
    if (!start) return [];
    const gesehen = new Set<planck.Body>([start, ...(this.beiwerk.get(id) ?? [])]);
    const offen = [start];
    while (offen.length) {
      const body = offen.pop()!;
      for (let j = body.getJointList(); j; j = j.next ?? null) {
        if (j.joint?.getType() !== "weld-joint") continue;
        const anderer = j.other;
        if (!anderer || gesehen.has(anderer) || !anderer.isDynamic()) continue;
        gesehen.add(anderer);
        offen.push(anderer);
      }
    }
    return [...gesehen];
  }

  /**
   * Setzt einen Körper an einen Punkt — das Ziehen mit der Hand.
   *
   * Die Geschwindigkeit wird dabei genullt: was man festhält, fliegt nicht.
   */
  setzeOrt(id: string, pos: { x: number; y: number }) {
    const body = this.koerper.get(id);
    if (!body) return;
    // Räder und anderes Beiwerk wandern um dasselbe Stück mit. Ohne das
    // bleiben sie am alten Platz zurück, und die Gelenke reißen den Wagen
    // beim nächsten Schritt wieder dorthin.
    const alt = body.getPosition();
    const um = new planck.Vec2(pos.x - alt.x, pos.y - alt.y);
    for (const teil of this.verbund(id)) {
      const p = teil.getPosition();
      teil.setPosition(new planck.Vec2(p.x + um.x, p.y + um.y));
      teil.setLinearVelocity(new planck.Vec2(0, 0));
      teil.setAwake(true);
    }
  }

  /**
   * Gibt einem Körper ein Tempo — der Abschuss, der Schubs an den Wagen.
   *
   * Das Beiwerk bekommt dasselbe Tempo. Ein Wagen, dessen Räder stehen
   * blieben, wurde von seinen eigenen Gelenken sofort wieder abgebremst und
   * rollte kürzer als ein Klotz, der bloß rutscht.
   */
  gibTempo(id: string, vx: number, vy: number) {
    for (const teil of this.verbund(id)) {
      teil.setLinearVelocity(new planck.Vec2(vx, vy));
      teil.setAwake(true);
    }
  }

  zustand(): WeltZustand {
    const stand: WeltZustand = {};
    for (const [id, body] of this.koerper) {
      const p = body.getPosition();
      const v = body.getLinearVelocity();
      stand[id] = {
        x: p.x, y: p.y, winkel: body.getAngle(), vx: v.x, vy: v.y,
        frei: body.isDynamic() && !this.bauart.get(id)?.startsWith("gelenk"),
      };
    }
    return stand;
  }

  /** Die Zusammenstöße des letzten Schritts. */
  ereignisse(): Stoss[] {
    return this.stoesse;
  }

  /** Ob ein Gerät gerade einen beweglichen Körper hat, den man greifen kann. */
  greifbar(id: string): boolean {
    return this.koerper.get(id)?.isDynamic() ?? false;
  }

  /**
   * Greift einen Körper im laufenden Versuch.
   *
   * Nicht durch Versetzen, sondern mit einem Federgriff: der Körper wird zum
   * Zeiger *gezogen* und bleibt dabei ein Körper unter anderen. Er schiebt,
   * was im Weg liegt, pendelt am Haken, wenn er hängt, und fliegt beim
   * Loslassen mit dem Schwung weiter, den die Hand ihm gegeben hat.
   */
  greife(id: string, punkt: { x: number; y: number }): boolean {
    this.lasse();
    const body = this.koerper.get(id);
    if (!body || !body.isDynamic()) return false;
    const masse = Math.max(0.01, body.getMass());
    this.hand = this.welt.createJoint(new planck.MouseJoint({
      maxForce: 300 * masse * 9.81,
      frequencyHz: 6,
      dampingRatio: 0.8,
    }, this.boden, body, new planck.Vec2(punkt.x, punkt.y)));
    body.setAwake(true);
    return true;
  }

  /** Führt die Hand zum Zeiger. */
  ziehe(punkt: { x: number; y: number }) {
    this.hand?.setTarget(new planck.Vec2(punkt.x, punkt.y));
  }

  /** Lässt los — der Körper behält seinen Schwung. */
  lasse() {
    if (this.hand) this.welt.destroyJoint(this.hand);
    this.hand = null;
  }

  /** Räumt die Welt leer — im Bauen gibt es nichts, das sich bewegt. */
  leere() {
    this.lasse();
    for (const id of [...this.koerper.keys()]) this.entferne(id);
    this.gelenke.clear();
    this.stoesse = [];
  }

  /** Setzt alle Körper auf ihren Platz in der Szene zurück. */
  zuruecksetzen(szene: Szene, mechanik: MechanikZustand) {
    this.leere();
    this.synchronisiere(szene, mechanik);
  }
}
