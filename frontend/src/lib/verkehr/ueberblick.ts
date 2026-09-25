/**
 * Überblick-Ebene (Taste M): Straßennamen entlang der Straßen, Abfahrtstafeln
 * über den Haltestellen, dazu die Minikarte unten links.
 */
import { Container, Graphics, Text } from "pixi.js";
import { beschriftung } from "./zeichnen";
import type { P } from "./geometrie";
import type { Halt, Stadt } from "./stadt";

/** Straßennamen: auf jedem längeren Stück die Mitte, gleiche Namen mindestens 120 m auseinander. */
export function strassenNamen(stadt: Stadt): Container {
  const c = new Container();
  const gesetzt: { name: string; p: P }[] = [];
  const stuecke: { name: string; a: P; b: P; l: number }[] = [];
  for (const s of stadt.strassen) {
    if (!s.name || s.art === "service") continue;
    for (let i = 0; i + 1 < s.linie.length; i++) {
      const a = s.linie[i], b = s.linie[i + 1];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > 35) stuecke.push({ name: s.name, a, b, l });
    }
  }
  stuecke.sort((x, y) => y.l - x.l);
  for (const st of stuecke) {
    const m: P = [(st.a[0] + st.b[0]) / 2, (st.a[1] + st.b[1]) / 2];
    if (gesetzt.some((g) => g.name === st.name && Math.hypot(g.p[0] - m[0], g.p[1] - m[1]) < 120)) continue;
    gesetzt.push({ name: st.name, p: m });
    const t = beschriftung(st.name, 0xffffff, 1.6);
    let w = Math.atan2(st.b[1] - st.a[1], st.b[0] - st.a[0]);
    if (w > Math.PI / 2) w -= Math.PI;
    if (w < -Math.PI / 2) w += Math.PI;
    t.rotation = w;
    t.position.set(m[0], m[1]);
    c.addChild(t);
  }
  return c;
}

/** Eine Tafel je Haltestelle; der Text wird von außen gesetzt. */
export function haltTafeln(halte: Halt[]): { c: Container; tafeln: { halt: Halt; text: Text; grund: Graphics }[] } {
  const c = new Container();
  const tafeln = halte.map((halt) => {
    const grund = new Graphics();
    const text = new Text({ text: "", style: { fontFamily: "monospace", fontSize: 40, fill: 0xffb000, lineHeight: 46 } });
    text.scale.set(0.025);
    grund.position.set(halt.p[0] + 2, halt.p[1] - 7);
    text.position.set(halt.p[0] + 2.3, halt.p[1] - 6.7);
    c.addChild(grund, text);
    return { halt, text, grund };
  });
  return { c, tafeln };
}

export function malTafel(t: { text: Text; grund: Graphics }, zeilen: string[]) {
  t.text.text = zeilen.join("\n");
  t.grund.clear();
  t.grund.roundRect(0, 0, t.text.width + 0.6, t.text.height + 0.6, 0.3).fill({ color: 0x111111, alpha: 0.88 }).stroke({ width: 0.1, color: 0x555555 });
}

/** Minikarte: Straßen und Gleise in Metern, stark verkleinert; die Figur bleibt in der Mitte. */
export class Minikarte {
  readonly c = new Container();
  private inhalt = new Container();
  private punkte = new Graphics();
  private maske = new Graphics();
  private rahmen = new Graphics();
  radius = 80;

  constructor(stadt: Stadt, schule: P) {
    const g = new Graphics();
    const r = stadt.karte.radius + 40;
    g.rect(-r, -r, 2 * r, 2 * r).fill(0x2c3b24);
    for (const h of stadt.karte.gebaeude) if (h.umriss.length >= 3) g.poly(h.umriss.flat()).fill(0x6b5f55);
    for (const gl of stadt.karte.gleise) {
      g.moveTo(gl.linie[0][0], gl.linie[0][1]);
      for (const p of gl.linie.slice(1)) g.lineTo(p[0], p[1]);
      g.stroke({ width: 4, color: 0x8a7f70 });
    }
    for (const s of stadt.strassen) {
      g.moveTo(s.linie[0][0], s.linie[0][1]);
      for (const p of s.linie.slice(1)) g.lineTo(p[0], p[1]);
      g.stroke({ width: s.art === "service" ? 3 : s.breite + 3, color: s.art === "service" ? 0x777777 : 0xd9d4c7, cap: "round", join: "round" });
    }
    g.circle(schule[0], schule[1], 10).fill(0xf4a261);
    this.inhalt.addChild(g, this.punkte);
    this.c.addChild(this.inhalt, this.rahmen);
    this.c.addChild(this.maske);
    this.inhalt.mask = this.maske;
  }

  /** Neu ausrichten: `mitte` in Metern, `ich` und andere als Punkte. */
  stelle(x: number, y: number, radius: number, massstab: number, punkte: { p: P; farbe: number; r: number }[]) {
    this.radius = radius;
    this.maske.clear().circle(0, 0, radius).fill(0xffffff);
    this.rahmen.clear().circle(0, 0, radius).stroke({ width: 3, color: 0xffffff, alpha: 0.85 });
    this.inhalt.scale.set(massstab);
    this.inhalt.position.set(-x * massstab, -y * massstab);
    this.punkte.clear();
    for (const p of punkte) this.punkte.circle(p.p[0], p.p[1], p.r / massstab).fill(p.farbe);
  }
}
