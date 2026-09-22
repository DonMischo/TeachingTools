"use client";
/**
 * Die Bühne: zeichnet den Aufbau mit PixiJS (WebGL).
 *
 * Sie kennt keinen Zustand außer dem, was ihr je Bild übergeben wird — dem
 * Aufbau, der Lage der Teile (aus dem Aufbau oder aus der Welt) und dem, was
 * gerade ausgewählt ist. Rechnen, Treffen und Bauen geschehen woanders; so
 * lässt sich das alles ohne Grafikkarte prüfen, und die Bühne bleibt dumm.
 *
 * Gezeichnet wird in Bildpunkten, umgerechnet über `zumBild` — Meter treffen
 * nirgends sonst auf Pixel.
 */
import type { Application, Graphics } from "pixi.js";
import { verbinderEnden, verbinderWeg, zumBild, type Lage } from "@/lib/physik/kern/bearbeiten";
import { weltpunkt, type Aufbau, type Teil, type Verbinder } from "@/lib/physik/kern/modell";
import { istElektrisch, oberflaeche, pole, teilTyp, type Form } from "@/lib/physik/kern/teile";
import { feststoff } from "@/lib/physik/material";
import type { Blick, Punkt } from "@/lib/physik/typen";

export interface Auswahl { art: "teil" | "verbinder"; id: string }

export interface Bild {
  aufbau: Aufbau;
  lage: Lage;
  blick: Blick;
  auswahl: Auswahl | null;
  schwebt: Auswahl | null;
  /** Was gerade gesetzt wird: ein Seil, das man aufzieht, oder ein Teil am Zeiger. */
  vorschau:
    | { art: "spannen"; verbinder: "seil" | "feder"; von: Punkt; ueber: Punkt[]; bis: Punkt }
    | { art: "teil"; teil: Teil }
    | null;
  /** Verbinder, die im Versuch gelöst wurden oder gebrochen sind — sie fehlen. */
  geloest: Set<string>;
  /** Im Versuch die freie Länge eines Seils — bei einer Winde ändert sie sich. */
  seillaenge?: (id: string) => number | undefined;
  /** Der Ablaufpunkt einer Winde: dort verlässt das Seil die Trommel. */
  seilAblauf?: (id: string) => Punkt | undefined;
  /** Im Versuch die Bahn eines Seils über Rollen — sie liegt, wie der Löser sie hält. */
  seilBahn?: (id: string) => Punkt[] | undefined;
  /** Wie hell ein Lämpchen brennt: 0 aus, 1 bei Nennleistung. */
  leuchten?: (id: string) => number;
}

const FARBE = {
  wand: 0x1c2535,
  loch: 0x0d131d,
  lochRand: 0x2b3648,
  boden: 0x3a3f4a,
  bodenKante: 0x8b93a3,
  auswahl: 0x38bdf8,
  schweben: 0xf8fafc,
  schatten: 0x000000,
  seil: 0xd6b98c,
  kabel: 0xb91c1c,
  klemme: 0xd4a017,
  glut: 0xfde68a,
  feder: 0xcbd5e1,
  stahl: 0xa8b3c2,
  vorschau: 0x4ade80,
};

const farbe = (hex: string) => Number.parseInt(hex.replace("#", ""), 16);

/** Hellt eine Farbe auf (a > 0) oder dunkelt sie ab (a < 0). */
function toene(c: number, a: number): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const f = (x: number) => Math.round(a >= 0 ? x + (255 - x) * a : x * (1 + a));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

export class Buehne {
  private constructor(
    private app: Application,
    private wand: Graphics,
    private teile: Graphics,
    private oben: Graphics,
  ) {}

  /**
   * Legt die Bühne in einem Element an — oder null, wenn der Browser kein
   * WebGL kann (und in der Testumgebung). Pixi wird erst hier geladen: auf
   * dem Server gibt es kein Fenster, in das es sich einhängen könnte.
   */
  static async erzeuge(el: HTMLElement, breite: number, hoehe: number): Promise<Buehne | null> {
    try {
      const PIXI = await import("pixi.js");
      const app = new PIXI.Application();
      await app.init({
        width: Math.max(1, breite), height: Math.max(1, hoehe),
        antialias: true, backgroundColor: FARBE.wand,
        resolution: window.devicePixelRatio || 1, autoDensity: true,
        preference: "webgl",
      });
      el.appendChild(app.canvas);
      app.canvas.style.display = "block";
      const wand = new PIXI.Graphics(), teile = new PIXI.Graphics(), oben = new PIXI.Graphics();
      app.stage.addChild(wand, teile, oben);
      // Gezeichnet wird auf Anforderung, nicht im eigenen Takt.
      app.ticker.stop();
      return new Buehne(app, wand, teile, oben);
    } catch {
      return null;
    }
  }

  groesse(breite: number, hoehe: number) {
    this.app.renderer.resize(Math.max(1, breite), Math.max(1, hoehe));
  }

  zerstoere() {
    this.app.destroy(true, { children: true });
  }

  zeichne(bild: Bild) {
    this.zeichneWand(bild.blick);
    this.teile.clear();
    this.oben.clear();

    const { aufbau, lage, blick } = bild;
    // Erst die Schatten aller Teile, dann die Teile — sonst fiele der Schatten
    // des oberen auf das untere Teil und sähe aus wie ein Loch darin.
    for (const t of aufbau.teile) this.zeichneTeil(t, lage, blick, "schatten");
    for (const t of aufbau.teile) this.zeichneTeil(t, lage, blick, "koerper", bild.leuchten?.(t.id) ?? 0);

    for (const v of aufbau.verbinder) {
      if (bild.geloest.has(v.id)) continue;
      this.zeichneVerbinder(v, aufbau, lage, blick, bild.seillaenge?.(v.id), bild.seilAblauf?.(v.id), bild.seilBahn?.(v.id));
    }

    // Hervorhebungen obendrauf.
    for (const [a, c, breite] of [[bild.schwebt, FARBE.schweben, 1.5], [bild.auswahl, FARBE.auswahl, 2.5]] as const) {
      if (!a) continue;
      if (a.art === "teil") {
        const t = aufbau.teile.find(x => x.id === a.id);
        if (t) this.umrande(t, lage, blick, c, breite);
      } else {
        const v = aufbau.verbinder.find(x => x.id === a.id);
        if (v) {
          const [p] = verbinderEnden(aufbau, v, lage).map(q => zumBild(q, blick));
          this.oben.circle(p.x, p.y, 10).stroke({ width: breite, color: c });
        }
      }
    }

    const vs = bild.vorschau;
    if (vs?.art === "spannen") {
      const weg = [vs.von, ...vs.ueber, vs.bis].map(p => zumBild(p, blick));
      const a = weg[0];
      if (vs.verbinder === "feder") {
        this.feder(this.oben, a, weg[weg.length - 1], FARBE.vorschau, 0.8);
      } else {
        this.oben.moveTo(a.x, a.y);
        for (const p of weg.slice(1)) this.oben.lineTo(p.x, p.y);
        this.oben.stroke({ width: 2, color: FARBE.vorschau, alpha: 0.8, join: "round" });
        // Jede Rolle, über die es schon läuft, bekommt einen Punkt.
        for (const p of weg.slice(1, -1)) this.oben.circle(p.x, p.y, 4).stroke({ width: 2, color: FARBE.vorschau });
      }
      this.oben.circle(a.x, a.y, 4).fill({ color: FARBE.vorschau });
    } else if (vs?.art === "teil") {
      this.umrande(vs.teil, t => ({ pos: t.pos, winkel: t.winkel }), blick, FARBE.vorschau, 1.5);
    }

    this.app.render();
  }

  // ── Die Lochwand ────────────────────────────────────────────────────────────

  private zeichneWand(blick: Blick) {
    const g = this.wand;
    g.clear();
    // Löcher alle 5 cm, beim Herauszoomen dünner gesät — sonst wird aus der
    // Lochwand ein graues Rauschen.
    const stufen = [0.05, 0.1, 0.2, 0.5, 1];
    const abstand = stufen.find(s => s * blick.skala >= 16) ?? 2;
    const r = Math.max(1.2, Math.min(3, abstand * blick.skala * 0.08));
    const links = blick.mitte.x - blick.breite / 2 / blick.skala;
    const rechts = blick.mitte.x + blick.breite / 2 / blick.skala;
    const unten = Math.max(0, blick.mitte.y - blick.hoehe / 2 / blick.skala);
    const obenY = blick.mitte.y + blick.hoehe / 2 / blick.skala;
    for (let x = Math.ceil(links / abstand) * abstand; x <= rechts; x += abstand) {
      for (let y = Math.ceil(unten / abstand) * abstand; y <= obenY; y += abstand) {
        const p = zumBild({ x, y }, blick);
        g.circle(p.x, p.y, r);
      }
    }
    g.fill({ color: FARBE.loch });

    // Der Boden: y = 0. Darauf landet, was fällt.
    const boden = zumBild({ x: 0, y: 0 }, blick).y;
    if (boden < blick.hoehe) {
      g.rect(0, boden, blick.breite, blick.hoehe - boden).fill({ color: FARBE.boden });
      g.moveTo(0, boden).lineTo(blick.breite, boden).stroke({ width: 2, color: FARBE.bodenKante });
    }
  }

  // ── Teile ───────────────────────────────────────────────────────────────────

  /** Die Umrisse einer Form in Bildpunkten. */
  private umrissPunkte(f: Form, t: Teil, lage: Lage, blick: Blick): Punkt[] {
    const l = lage(t);
    const teil = { ...t, pos: l.pos, winkel: l.winkel };
    const bild = (p: Punkt) => zumBild(weltpunkt(teil, p), blick);
    if (f.art === "kasten") {
      const { x, y } = f.mitte, hb = f.b / 2, hh = f.h / 2;
      const c = Math.cos(f.winkel ?? 0), s = Math.sin(f.winkel ?? 0);
      return [{ x: -hb, y: -hh }, { x: hb, y: -hh }, { x: hb, y: hh }, { x: -hb, y: hh }]
        .map(p => bild({ x: x + p.x * c - p.y * s, y: y + p.x * s + p.y * c }));
    }
    if (f.art === "kreis") {
      return Array.from({ length: 28 }, (_, i) => {
        const w = (i / 28) * Math.PI * 2;
        return bild({ x: f.mitte.x + f.r * Math.cos(w), y: f.mitte.y + f.r * Math.sin(w) });
      });
    }
    // Kapsel: zwei Halbkreise um die Enden.
    const w0 = Math.atan2(f.b.y - f.a.y, f.b.x - f.a.x);
    const bogen = (m: Punkt, von: number) => Array.from({ length: 13 }, (_, i) => {
      const w = von + (i / 12) * Math.PI;
      return bild({ x: m.x + f.r * Math.cos(w), y: m.y + f.r * Math.sin(w) });
    });
    return [...bogen(f.b, w0 - Math.PI / 2), ...bogen(f.a, w0 + Math.PI / 2)];
  }

  private zeichneTeil(t: Teil, lage: Lage, blick: Blick, was: "schatten" | "koerper", glut = 0) {
    const typ = teilTyp(t.art);
    if (!typ) return;
    const g = this.teile;
    const flach = (ps: Punkt[]) => ps.flatMap(p => [p.x, p.y]);

    for (const f of typ.formen(t)) {
      const ps = this.umrissPunkte(f, t, lage, blick);
      if (was === "schatten") {
        // Ein weicher Schatten auf der Wand: dasselbe Teil, versetzt und blass.
        const versatz = Math.max(2, Math.min(7, 0.012 * blick.skala));
        g.poly(flach(ps.map(p => ({ x: p.x + versatz, y: p.y + versatz * 1.3 })))).fill({ color: FARBE.schatten, alpha: 0.28 });
        continue;
      }

      const { farbe: hex } = oberflaeche(t);
      const grund = farbe(hex);
      const stoffName = t.art === "massestueck" ? "Messing" : feststoff(t.werte.stoff ?? 0).name;
      const glas = stoffName === "Glas";
      g.poly(flach(ps)).fill({ color: grund, alpha: glas ? 0.4 : 1 });

      // Licht von oben links: eine helle Kante oben, eine dunkle unten.
      const l = lage(t);
      const oberkante = this.kante(f, t, l, blick, "oben");
      const unterkante = this.kante(f, t, l, blick, "unten");
      if (oberkante) g.moveTo(oberkante[0].x, oberkante[0].y).lineTo(oberkante[1].x, oberkante[1].y)
        .stroke({ width: 2, color: toene(grund, 0.45), alpha: glas ? 0.9 : 0.8 });
      if (unterkante) g.moveTo(unterkante[0].x, unterkante[0].y).lineTo(unterkante[1].x, unterkante[1].y)
        .stroke({ width: 2, color: toene(grund, -0.35), alpha: 0.8 });

      // Holz hat Maserung — ein paar Linien längs des Bretts.
      if (stoffName === "Holz" && f.art === "kasten") this.maserung(g, f, t, l, blick, grund);

      // Runde Teile bekommen einen Glanzpunkt, Scheiben eine Nabe.
      if (f.art === "kreis") {
        const m = zumBild(weltpunkt({ ...t, pos: l.pos, winkel: l.winkel }, f.mitte), blick);
        const r = f.r * blick.skala;
        g.circle(m.x - r * 0.35, m.y - r * 0.35, Math.max(1, r * 0.22)).fill({ color: 0xffffff, alpha: glas ? 0.7 : 0.35 });
        if (t.art === "scheibe") {
          // Eine Speiche zeigt, dass sie sich dreht.
          const e = zumBild(weltpunkt({ ...t, pos: l.pos, winkel: l.winkel }, { x: f.r * 0.8, y: 0 }), blick);
          g.moveTo(m.x, m.y).lineTo(e.x, e.y).stroke({ width: 2, color: toene(grund, -0.4) });
          g.circle(m.x, m.y, Math.max(2, r * 0.12)).fill({ color: toene(grund, -0.3) });
        }
      }

      g.poly(flach(ps)).stroke({ width: 1, color: toene(grund, -0.55), alpha: 0.9 });
    }

    if (was === "koerper" && istElektrisch(t.art)) this.zeichneBauteil(t, lage(t), blick, glut);

    // Das Massestück trägt eine Öse oben.
    if (was === "koerper" && t.art === "massestueck") {
      const l = lage(t);
      const s = typ.formen(t)[0] as Extract<Form, { art: "kasten" }>;
      const oese = zumBild(weltpunkt({ ...t, pos: l.pos, winkel: l.winkel }, { x: 0, y: s.h / 2 + s.h * 0.12 }), blick);
      g.circle(oese.x, oese.y, Math.max(2, s.h * 0.12 * blick.skala)).stroke({ width: 1.5, color: 0x8a6d12 });
    }
  }

  /**
   * Das Sinnbild eines elektrischen Bauteils — wie im Schaltplan, nur auf dem Gehäuse.
   *
   * Der Kasten allein sähe bei allen gleich aus; erst die beiden Klemmen und
   * das Zeichen darin sagen, was man vor sich hat. Das Lämpchen glüht nach
   * seiner Leistung, der Schalter zeigt seine Stellung — beides liest man im
   * Versuch lieber an der Wand ab als in einer Tabelle.
   */
  private zeichneBauteil(t: Teil, l: { pos: Punkt; winkel: number }, blick: Blick, glut: number) {
    const g = this.teile;
    const form = teilTyp(t.art)?.formen(t)[0];
    if (form?.art !== "kasten") return;
    const teil = { ...t, pos: l.pos, winkel: l.winkel };
    const bild = (x: number, y: number) => zumBild(weltpunkt(teil, { x, y }), blick);
    const s = blick.skala;
    const [links, rechts] = pole(t);

    if (t.art === "lampe" && glut > 0) {
      const m = bild(0, 0);
      const r = (form.b / 2) * s;
      for (const [f, a] of [[2.2, 0.16], [1.5, 0.3], [1, 0.75]] as const) {
        g.circle(m.x, m.y, r * f).fill({ color: FARBE.glut, alpha: a * Math.min(1, glut) });
      }
    }

    // Die Klemmen: dort steckt das Kabel.
    for (const p of [links, rechts]) {
      const k = bild(p.x, p.y);
      g.circle(k.x, k.y, Math.max(2, 0.008 * s)).fill({ color: FARBE.klemme }).stroke({ width: 1, color: 0x7c5c00 });
    }

    const strich = { width: Math.max(1.5, 0.004 * s), color: 0xe2e8f0 } as const;
    const linie = (punkte: [number, number][]) => {
      const ps = punkte.map(([x, y]) => bild(x, y));
      g.moveTo(ps[0].x, ps[0].y);
      for (const p of ps.slice(1)) g.lineTo(p.x, p.y);
      g.stroke({ ...strich, join: "round", cap: "round" });
    };
    const h = form.h / 2, b = form.b / 2;

    if (t.art === "batterie") {
      // Lang und kurz: der lange Strich ist der Pluspol, und der sitzt rechts.
      linie([[-0.02, -h * 0.55], [-0.02, h * 0.55]]);
      linie([[0.02, -h * 0.8], [0.02, h * 0.8]]);
      linie([[b * 0.55, h * 0.45], [b * 0.75, h * 0.45]]);
      linie([[b * 0.65, h * 0.35], [b * 0.65, h * 0.55]]);
    } else if (t.art === "widerstand") {
      const zacken: [number, number][] = [[-b * 0.6, 0]];
      for (let i = 0; i < 6; i++) zacken.push([-b * 0.6 + (b * 1.2 * (i + 0.5)) / 6, (i % 2 ? -1 : 1) * h * 0.55]);
      zacken.push([b * 0.6, 0]);
      linie(zacken);
    } else if (t.art === "lampe") {
      const m = bild(0, 0);
      g.circle(m.x, m.y, Math.max(3, b * 0.6 * s)).stroke(strich);
      linie([[-b * 0.42, -h * 0.42], [b * 0.42, h * 0.42]]);
      linie([[-b * 0.42, h * 0.42], [b * 0.42, -h * 0.42]]);
    } else if (t.art === "schalter") {
      const zu = (t.werte.geschlossen ?? 1) >= 0.5;
      linie([[-b, 0], [-b * 0.5, 0]]);
      linie([[b * 0.5, 0], [b, 0]]);
      linie([[-b * 0.5, 0], zu ? [b * 0.5, 0] : [b * 0.35, h * 0.9]]);
    } else if (t.art === "motor") {
      const m = bild(0, 0);
      g.circle(m.x, m.y, Math.max(4, h * 0.7 * s)).stroke(strich);
      // Ein »M« im Kreis, wie im Schaltplan.
      linie([[-h * 0.3, -h * 0.35], [-h * 0.3, h * 0.35], [0, -h * 0.05], [h * 0.3, h * 0.35], [h * 0.3, -h * 0.35]]);
    }
  }

  /** Die obere oder untere Kante eines Kastens — für Licht und Schatten. */
  private kante(f: Form, t: Teil, l: { pos: Punkt; winkel: number }, blick: Blick, seite: "oben" | "unten"): [Punkt, Punkt] | null {
    if (f.art !== "kasten") return null;
    const y = f.mitte.y + (seite === "oben" ? f.h / 2 : -f.h / 2);
    const teil = { ...t, pos: l.pos, winkel: l.winkel };
    return [
      zumBild(weltpunkt(teil, { x: f.mitte.x - f.b / 2, y }), blick),
      zumBild(weltpunkt(teil, { x: f.mitte.x + f.b / 2, y }), blick),
    ];
  }

  private maserung(g: Graphics, f: Extract<Form, { art: "kasten" }>, t: Teil, l: { pos: Punkt; winkel: number }, blick: Blick, grund: number) {
    if (f.h * blick.skala < 6) return;
    const teil = { ...t, pos: l.pos, winkel: l.winkel };
    // Die Linien sitzen fest am Brett (aus der Id abgeleitet), damit sie beim
    // Neuzeichnen nicht flimmern.
    const saat = [...t.id].reduce((s, c) => s + c.charCodeAt(0), 0);
    for (let i = 1; i <= 3; i++) {
      const y = f.mitte.y - f.h / 2 + (f.h * i) / 4 + (((saat * i) % 7) - 3) * f.h * 0.02;
      const a = zumBild(weltpunkt(teil, { x: f.mitte.x - f.b / 2 * 0.95, y }), blick);
      const m = zumBild(weltpunkt(teil, { x: f.mitte.x, y: y + f.h * 0.06 * ((saat + i) % 2 ? 1 : -1) }), blick);
      const b = zumBild(weltpunkt(teil, { x: f.mitte.x + f.b / 2 * 0.95, y }), blick);
      g.moveTo(a.x, a.y).quadraticCurveTo(m.x, m.y, b.x, b.y).stroke({ width: 1, color: toene(grund, -0.25), alpha: 0.6 });
    }
  }

  private umrande(t: Teil, lage: Lage, blick: Blick, c: number, breite: number) {
    const typ = teilTyp(t.art);
    if (!typ) return;
    for (const f of typ.formen(t)) {
      const ps = this.umrissPunkte(f, t, lage, blick);
      this.oben.poly(ps.flatMap(p => [p.x, p.y])).stroke({ width: breite, color: c });
    }
  }

  // ── Verbinder ───────────────────────────────────────────────────────────────

  private zeichneVerbinder(
    v: Verbinder, aufbau: Aufbau, lage: Lage, blick: Blick, frei?: number, ablauf?: Punkt, bahn?: Punkt[],
  ) {
    if (v.art === "seil" && (v.ueber?.length ?? 0) > 0) {
      this.zeichneSeilUeberRollen(v, bahn ?? verbinderWeg(aufbau, v, lage), blick, frei);
      return;
    }
    const [roh, pb] = verbinderEnden(aufbau, v, lage);
    // Bei einer Winde läuft das Seil an einer festen Stelle von der Trommel —
    // gezeichnet wird, woran der Löser wirklich zieht.
    const pa = ablauf ?? roh;
    const a = zumBild(pa, blick), b = zumBild(pb, blick);
    const g = this.teile;

    if (v.art === "seil") {
      // Ein schlaffes Seil hängt durch — um so viel, wie es länger ist als der Abstand.
      const laenge = frei ?? ((v.werte.laenge ?? 0) > 0 ? v.werte.laenge : this.gespannt(aufbau, v));
      const abstand = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      const durchhang = Math.max(0, laenge - abstand) * 0.6 * blick.skala;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + durchhang };
      g.moveTo(a.x, a.y).quadraticCurveTo(m.x, m.y, b.x, b.y).stroke({ width: 2.5, color: FARBE.seil, cap: "round" });
      this.wandpunkt(g, v, a, b);
      return;
    }
    if (v.art === "kabel") {
      // Litze hängt durch; sie zieht nichts, also hängt sie so, wie sie liegt.
      const durchhang = Math.min(40, 0.18 * Math.hypot(b.x - a.x, b.y - a.y));
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + durchhang };
      g.moveTo(a.x, a.y).quadraticCurveTo(m.x, m.y, b.x, b.y)
        .stroke({ width: 2.5, color: FARBE.kabel, cap: "round" });
      for (const p of [a, b]) g.circle(p.x, p.y, 3).fill({ color: FARBE.klemme });
      return;
    }
    if (v.art === "feder") {
      this.feder(g, a, b, FARBE.feder, 1);
      this.wandpunkt(g, v, a, b);
      return;
    }

    // Achse und Schraube sitzen an einem Punkt.
    const zurWand = v.a.teil === null || v.b.teil === null;
    if (zurWand) g.circle(a.x, a.y, 7).fill({ color: FARBE.loch }).stroke({ width: 1, color: FARBE.lochRand });
    if (v.art === "achse") {
      g.circle(a.x, a.y, 5).fill({ color: FARBE.stahl }).stroke({ width: 1, color: 0x475569 });
      g.circle(a.x, a.y, 1.8).fill({ color: 0x1e293b });
    } else {
      g.circle(a.x, a.y, 4).fill({ color: 0x94a3b8 }).stroke({ width: 1, color: 0x334155 });
      g.moveTo(a.x - 2.5, a.y - 2.5).lineTo(a.x + 2.5, a.y + 2.5).stroke({ width: 1.2, color: 0x334155 });
      g.moveTo(a.x - 2.5, a.y + 2.5).lineTo(a.x + 2.5, a.y - 2.5).stroke({ width: 1.2, color: 0x334155 });
    }
  }

  /**
   * Ein Seil über Rollen: ein Zug von Strang zu Strang.
   *
   * Durchhang wird auf die Stränge verteilt, je nach ihrer Länge — sonst sähe
   * ein schlaffer Flaschenzug straff aus.
   */
  private zeichneSeilUeberRollen(v: Verbinder, weg: Punkt[], blick: Blick, frei?: number) {
    const g = this.teile;
    const laengen = weg.slice(1).map((p, i) => Math.hypot(p.x - weg[i].x, p.y - weg[i].y));
    const gespannt = laengen.reduce((a, b) => a + b, 0);
    const laenge = frei ?? ((v.werte.laenge ?? 0) > 0 ? v.werte.laenge : gespannt);
    const ueberschuss = Math.max(0, laenge - gespannt);

    const bild = weg.map(p => zumBild(p, blick));
    for (let i = 0; i + 1 < bild.length; i++) {
      const a = bild[i], b = bild[i + 1];
      const anteil = gespannt > 0 ? laengen[i] / gespannt : 0;
      const durchhang = ueberschuss * anteil * 0.6 * blick.skala;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + durchhang };
      g.moveTo(a.x, a.y).quadraticCurveTo(m.x, m.y, b.x, b.y).stroke({ width: 2.5, color: FARBE.seil, cap: "round" });
    }
    this.wandpunkt(g, v, bild[0], bild[bild.length - 1]);
  }

  /** Die Länge, auf die ein Seil beim Bauen gespannt war. */
  private gespannt(aufbau: Aufbau, v: Verbinder): number {
    const [a, b] = verbinderEnden(aufbau, v);
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  /** Wo ein Seil oder eine Feder an der Wand hängt, sitzt ein Haken im Loch. */
  private wandpunkt(g: Graphics, v: Verbinder, a: Punkt, b: Punkt) {
    for (const [ende, p] of [[v.a, a], [v.b, b]] as const) {
      if (ende.teil !== null) continue;
      g.circle(p.x, p.y, 6).fill({ color: FARBE.loch }).stroke({ width: 1, color: FARBE.lochRand });
      g.circle(p.x, p.y, 3).fill({ color: FARBE.stahl });
    }
  }

  private feder(g: Graphics, a: Punkt, b: Punkt, c: number, alpha: number) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const windungen = 10, breite = 6;
    g.moveTo(a.x, a.y);
    for (let i = 1; i < windungen * 2; i++) {
      const t = i / (windungen * 2);
      const s = i % 2 ? breite : -breite;
      g.lineTo(a.x + dx * t + nx * s, a.y + dy * t + ny * s);
    }
    g.lineTo(b.x, b.y).stroke({ width: 1.5, color: c, alpha, join: "round" });
  }
}
