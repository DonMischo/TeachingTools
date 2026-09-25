/**
 * Dunkelheit und Licht: eine abgedunkelte Fläche über der Stadt, darüber
 * Lichtkegel (Laternen, Scheinwerfer, Warnwesten) mit additiver Mischung.
 */
import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { P } from "./geometrie";
import type { Stadt } from "./stadt";

function kreisTextur(): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const v = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  v.addColorStop(0, "rgba(255,255,255,1)");
  v.addColorStop(0.4, "rgba(255,255,255,0.45)");
  v.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = v;
  g.fillRect(0, 0, 128, 128);
  return Texture.from(c);
}

function kegelTextur(): Texture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  const v = g.createLinearGradient(0, 0, 256, 0);
  v.addColorStop(0, "rgba(255,255,255,0.9)");
  v.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = v;
  g.beginPath();
  g.moveTo(0, 56); g.lineTo(256, 0); g.lineTo(256, 128); g.lineTo(0, 72);
  g.closePath();
  g.fill();
  return Texture.from(c);
}

/** Laternen: die aus OSM, dazu alle 35 m eine an Straßen mit Gehweg (wechselnde Seiten). */
export function laternen(stadt: Stadt): P[] {
  const aus: P[] = stadt.karte.punkte.filter((p) => p.art === "laterne").map((p) => p.p);
  for (const s of stadt.strassen) {
    if (!s.gehwegBreite) continue;
    let rest = 17, seite = 1;
    for (let i = 0; i + 1 < s.linie.length; i++) {
      const [ax, ay] = s.linie[i], [bx, by] = s.linie[i + 1];
      const l = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / (l || 1), ny = (bx - ax) / (l || 1);
      let pos = rest;
      while (pos < l) {
        const f = pos / l, q = (s.breite / 2 + 0.5) * seite;
        aus.push([ax + (bx - ax) * f + nx * q, ay + (by - ay) * f + ny * q]);
        seite = -seite;
        pos += 35;
      }
      rest = pos - l;
    }
  }
  return aus;
}

/** Wie dunkel die Nacht wird — Kinder sollen noch Straßen erkennen. */
const TIEFE = 0.6;

export class Nacht {
  /** Über die Welt legen (Bildschirmmaße). */
  readonly dunkel = new Graphics();
  /** Gleiche Umrechnung wie die Welt; additiv gemischt. */
  readonly licht = new Container();
  private kreis = kreisTextur();
  private kegel = kegelTextur();
  private lampen: Sprite[] = [];
  private kegelPool: Sprite[] = [];
  private glanz: Sprite;

  constructor(lampenOrte: P[]) {
    this.licht.blendMode = "add";
    for (const [x, y] of lampenOrte) {
      const s = new Sprite(this.kreis);
      s.anchor.set(0.5);
      s.position.set(x, y);
      s.width = s.height = 16;
      s.tint = 0xffd28a;
      s.alpha = 0.55;
      this.licht.addChild(s);
      this.lampen.push(s);
    }
    this.glanz = new Sprite(this.kreis);
    this.glanz.anchor.set(0.5);
    this.glanz.width = this.glanz.height = 3;
    this.glanz.tint = 0xfff27a;
    this.licht.addChild(this.glanz);
  }

  /**
   * `hell` 0 = Nacht, 1 = Tag. `scheinwerfer`: Lage und Richtung aller Fahrzeuge;
   * `weste`: Wo leuchtet eine Warnweste (die eigene)?
   */
  stelle(hell: number, breite: number, hoehe: number, scheinwerfer: { x: number; y: number; w: number; laenge: number }[], weste: P | null) {
    const tiefe = (1 - hell) * TIEFE;
    this.dunkel.clear();
    this.licht.visible = tiefe > 0.05;
    if (tiefe <= 0.01) return;
    this.dunkel.rect(0, 0, breite, hoehe).fill({ color: 0x0a1030, alpha: tiefe });
    for (const l of this.lampen) l.alpha = 0.6 * (tiefe / TIEFE);
    while (this.kegelPool.length < scheinwerfer.length) {
      const k = new Sprite(this.kegel);
      k.anchor.set(0, 0.5);
      k.tint = 0xfff4d6;
      this.licht.addChild(k);
      this.kegelPool.push(k);
    }
    this.kegelPool.forEach((k, i) => {
      const f = scheinwerfer[i];
      k.visible = !!f;
      if (!f) return;
      k.position.set(f.x + Math.cos(f.w) * f.laenge / 2, f.y + Math.sin(f.w) * f.laenge / 2);
      k.rotation = f.w;
      k.width = 16; k.height = 7;
      k.alpha = 0.5 * (tiefe / TIEFE);
    });
    this.glanz.visible = !!weste;
    if (weste) { this.glanz.position.set(weste[0], weste[1]); this.glanz.alpha = 0.9; }
  }
}
