/**
 * Die Bus-Szene gemalt: der Bus ohne Dach (Boden, Sitze, gelbe Stangen,
 * Fahrer, Sondernutzungsfläche), vor den Türen die Zonen wie auf dem
 * Schaubild — grün Fokus und Warten, rot schraffiert Frei halten — und die
 * Fahrgäste mit Sprechblasen. Alles in Bus-Koordinaten; der Container wird
 * wie der Bus gedreht und verschoben.
 */
import { Container, Graphics, Text } from "pixi.js";
import { AUSSEN_Y, BUS_B, TUER_W, tuerZonen, type Busszene, type Fahrgast, type Lage } from "./busszene";
import { zeichneFigur } from "./zeichnen";

const GRUEN = 0x3fae49, ROT = 0xd93b3b;

/** Eine Figur der Szene: Mensch, Kinderwagen oder Rollstuhl, mit Rucksack. */
function baueFahrgast(f: Fahrgast): Container & { rucksack?: Container } {
  const c = new Container() as Container & { rucksack?: Container };
  if (f.art === "kinderwagen") {
    const g = new Graphics();
    g.roundRect(-0.05, -0.28, 0.8, 0.56, 0.18).fill(0x3b6fb6).stroke({ width: 0.04, color: 0x1e3a66 });
    g.roundRect(0.45, -0.24, 0.28, 0.48, 0.14).fill(0x2a4f86);
    g.rect(-0.2, -0.24, 0.15, 0.48).fill(0x555555);
    c.addChild(g);
    const schieber = zeichneFigur(f.farbe);
    schieber.position.set(-0.45, 0);
    c.addChild(schieber);
    c.pivot.set(0.1, 0);
    return c;
  }
  if (f.art === "rollstuhl") {
    const g = new Graphics();
    g.roundRect(-0.35, -0.33, 0.7, 0.66, 0.1).fill(0x444c56);
    g.rect(-0.3, -0.38, 0.5, 0.08).fill(0x222222).rect(-0.3, 0.3, 0.5, 0.08).fill(0x222222);
    c.addChild(g);
    const fig = zeichneFigur(f.farbe);
    c.addChild(fig);
    return c;
  }
  const fig = zeichneFigur(f.farbe);
  if (f.art === "kind") fig.scale.set(0.8);
  if (f.art === "senior") {
    // Graue Haare, Gehstock
    const k = new Graphics().circle(0.02, 0, 0.15).fill(0xc8c8c8).circle(0.08, 0, 0.1).fill(0xe8b98f);
    fig.kopf.removeChildren();
    fig.kopf.addChild(k);
    fig.addChild(new Graphics().moveTo(0.1, 0.28).lineTo(0.4, 0.34).stroke({ width: 0.05, color: 0x6d4c41 }));
  }
  c.addChild(fig);
  const r = new Graphics().roundRect(-0.36, -0.18, 0.16, 0.36, 0.05).fill(0xe0a100).stroke({ width: 0.03, color: 0x8a6200 });
  fig.addChildAt(r, 0);
  c.rucksack = r;
  return c;
}

/** Sprechblase: weißer Kasten mit Text, darunter ein Zipfel. */
function baueBlase(): Container & { text: Text; grund: Graphics } {
  const c = new Container() as Container & { text: Text; grund: Graphics };
  const grund = new Graphics();
  const text = new Text({ text: "", style: { fontFamily: "system-ui, sans-serif", fontSize: 40, fontWeight: "700", fill: 0x111111 } });
  text.scale.set(0.27 / 40);
  text.anchor.set(0.5, 1);
  c.addChild(grund, text);
  c.text = text; c.grund = grund;
  return c;
}

export class BusBild {
  readonly c = new Container();
  private innen = new Graphics();
  private zonen = new Graphics();
  private tueren = new Graphics();
  private leute = new Container();
  private blasen = new Container();
  private figuren = new Map<string, Container & { rucksack?: Container }>();
  private schriften: Text[] = [];
  private blasenBilder = new Map<string, Container & { text: Text; grund: Graphics }>();

  constructor(sz: Busszene) {
    this.malInnen(sz);
    this.c.addChild(this.zonen, this.innen, this.tueren, this.leute, this.blasen);
  }

  private malInnen(sz: Busszene) {
    const L = sz.l, g = this.innen, l = L.laenge / 2, b = BUS_B / 2;
    // Karosserie und Boden (beim Gelenkbus zwei Wagenteile)
    const teile = L.gelenk ? [[-l, L.gelenk.x0], [L.gelenk.x1, l]] : [[-l, l]];
    for (const [a, e] of teile) g.roundRect(a, -b, e - a, BUS_B, 0.3).fill(0xf2f2f2).stroke({ width: 0.08, color: 0x9aa0a6 });
    g.roundRect(-l + 0.12, -b + 0.12, L.laenge - 0.24, BUS_B - 0.24, 0.2).fill(0x8e9aa6);
    // Rillen im Boden
    for (let x = -l + 0.4; x < l - 0.3; x += 0.5) g.moveTo(x, -b + 0.15).lineTo(x, b - 0.15).stroke({ width: 0.015, color: 0x7d8894 });
    // Gelenk: Faltenbalg außen, drinnen die Drehscheibe
    if (L.gelenk) {
      const { x0, x1 } = L.gelenk;
      for (let x = x0; x <= x1 + 0.01; x += 0.1) {
        g.moveTo(x, -b).lineTo(x, -b + 0.14).stroke({ width: 0.035, color: 0x333333 });
        g.moveTo(x, b - 0.14).lineTo(x, b).stroke({ width: 0.035, color: 0x333333 });
      }
      g.circle((x0 + x1) / 2, 0, 0.95).fill(0x6f7a85).stroke({ width: 0.05, color: 0x4a535c });
      g.circle((x0 + x1) / 2, 0, 0.6).stroke({ width: 0.03, color: 0x4a535c });
    }
    // Sondernutzungsflächen: blau mit Rollstuhl und Kinderwagen
    for (const f of L.snf) {
      g.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0).fill(0x2f6db3);
      const sym = new Text({ text: "♿ 👶", style: { fontSize: 48, fill: 0xffffff } });
      sym.anchor.set(0.5);
      sym.scale.set(0.4 / 48);
      sym.position.set((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2);
      this.c.addChild(sym);
      this.schriften.push(sym);
    }
    // Fahrerplatz: Trennwand, Sitz, Lenkrad
    const F = L.fahrer;
    g.rect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0).fill(0x5b6670);
    g.rect(F.x0, F.y1 - 0.06, F.x1 - F.x0 - 0.3, 0.06).fill(0x2d3338);
    g.roundRect(L.fahrerSitz[0] - 0.4, -0.9, 0.5, 0.55, 0.1).fill(0x1f2429);
    g.circle(L.fahrerSitz[0] + 0.4, -0.62, 0.22).stroke({ width: 0.06, color: 0x111111 });
    // Frontscheibe, Heck
    g.roundRect(l - 0.14, -b + 0.2, 0.1, BUS_B - 0.4, 0.05).fill(0x9fd3ff);
    // Sitze
    for (const s of sz.sitze) {
      g.roundRect(s.p[0] - 0.2, s.p[1] - 0.2, 0.4, 0.4, 0.07).fill(s.vorrang ? 0xe07b24 : 0x2657a6).stroke({ width: 0.025, color: 0x163560 });
      g.roundRect(s.p[0] - 0.24, s.p[1] - 0.2, 0.1, 0.4, 0.04).fill(s.vorrang ? 0xb45e17 : 0x1c4486);
    }
    // Stangen
    for (const [x, y] of L.stangen) g.circle(x, y, 0.06).fill(0xffd21f).stroke({ width: 0.02, color: 0x9a7a00 });
  }

  /** Jedes Bild: Türen, Zonen, Leute, Blasen. `ich`: wo die Spielfigur steht (für die Zonen). */
  male(sz: Busszene, phase: Lage["phase"], t: number, rampe: number | null, zeigeZonen: boolean) {
    const L = sz.l;
    const offen = phase === "aussteigen" || phase === "einsteigen";
    // Türen: zu = dunkle Flügel, offen = Lücke mit gelber Kante
    const tg = this.tueren.clear();
    for (const x of L.tuerX) {
      if (offen) {
        tg.rect(x - TUER_W / 2, AUSSEN_Y - 0.14, TUER_W, 0.14).fill(0x8e9aa6);
        tg.rect(x - TUER_W / 2 - 0.08, AUSSEN_Y - 0.2, 0.08, 0.3).fill(0x444444).rect(x + TUER_W / 2, AUSSEN_Y - 0.2, 0.08, 0.3).fill(0x444444);
        tg.moveTo(x - TUER_W / 2, AUSSEN_Y + 0.02).lineTo(x + TUER_W / 2, AUSSEN_Y + 0.02).stroke({ width: 0.05, color: 0xffd21f });
      } else {
        tg.rect(x - TUER_W / 2, AUSSEN_Y - 0.12, TUER_W, 0.12).fill(0x3c4650);
        tg.moveTo(x, AUSSEN_Y - 0.12).lineTo(x, AUSSEN_Y).stroke({ width: 0.03, color: 0x9aa0a6 });
      }
    }
    if (rampe !== null) tg.rect(L.tuerX[rampe] - 0.45, AUSSEN_Y, 0.9, 0.9).fill(0x9aa0a6).stroke({ width: 0.03, color: 0x555555 });

    // Zonen wie auf dem Schaubild
    const z = this.zonen.clear();
    if (zeigeZonen && phase !== "faehrt") {
      for (let i = 0; i < L.tuerX.length; i++) {
        const zo = tuerZonen(i, L);
        const [mx, my] = zo.freiMitte;
        // Frei halten: Fächer, rot schraffiert (beim Aussteigen kräftig)
        const a0 = Math.PI / 2 - zo.freiBreite, a1 = Math.PI / 2 + zo.freiBreite;
        const alpha = phase === "aussteigen" ? 0.35 : 0.15;
        z.moveTo(mx, my).arc(mx, my, zo.freiR, a0, a1).lineTo(mx, my).fill({ color: ROT, alpha: alpha * 0.6 }).stroke({ width: 0.03, color: ROT, alpha: alpha * 2 });
        for (let k = -6; k <= 6; k++) {
          const x = mx + k * 0.3;
          z.moveTo(x - 0.8, my + 0.6).lineTo(x + 0.8, my + 2.4).stroke({ width: 0.02, color: ROT, alpha });
        }
        // Warten: zwei grüne Halbkreise seitlich
        for (const [wx, wy] of zo.warten) {
          z.moveTo(wx - zo.wartenR, wy - 0.25).arc(wx, wy - 0.25, zo.wartenR, 0, Math.PI).lineTo(wx - zo.wartenR, wy - 0.25)
            .fill({ color: GRUEN, alpha: 0.22 }).stroke({ width: 0.04, color: GRUEN, alpha: 0.8 });
        }
        // Fokus: grünes Feld direkt vor der Tür (beim Einsteigen kräftig)
        const f = zo.fokus;
        z.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0).fill({ color: GRUEN, alpha: phase === "einsteigen" ? 0.55 : 0.25 });
        z.moveTo((f.x0 + f.x1) / 2, f.y1 - 0.12).lineTo((f.x0 + f.x1) / 2, f.y0 + 0.15).stroke({ width: 0.06, color: 0x114411, alpha: 0.8 });
        z.moveTo((f.x0 + f.x1) / 2 - 0.12, f.y0 + 0.3).lineTo((f.x0 + f.x1) / 2, f.y0 + 0.15).lineTo((f.x0 + f.x1) / 2 + 0.12, f.y0 + 0.3).stroke({ width: 0.06, color: 0x114411, alpha: 0.8 });
      }
    }

    // Fahrgäste
    const da = new Set<string>();
    for (const f of [...sz.fahrgaeste, sz.fahrer]) {
      da.add(f.id);
      let fig = this.figuren.get(f.id);
      if (!fig) { fig = f.id === "fahrer" ? zeichneFigur(f.farbe) : baueFahrgast(f); this.figuren.set(f.id, fig); this.leute.addChild(fig); }
      fig.position.set(f.x, f.y);
      if (f.sitz !== null) fig.rotation = 0;
      else if (f.winkel !== undefined && f.weg.length) fig.rotation = f.winkel;
      if (fig.rucksack) fig.rucksack.visible = f.rucksack && f.sitz === null;
      // Sprechblase
      let bl = this.blasenBilder.get(f.id);
      const zeigt = !!f.ruf && f.ruf.bis > t;
      if (zeigt && !bl) { bl = baueBlase(); this.blasenBilder.set(f.id, bl); this.blasen.addChild(bl); }
      if (bl) {
        bl.visible = zeigt;
        if (zeigt && bl.text.text !== f.ruf!.text) {
          bl.text.text = f.ruf!.text;
          const w = bl.text.width + 0.3, h = bl.text.height + 0.16;
          bl.grund.clear().roundRect(-w / 2, -h - 0.02, w, h, 0.12).fill(0xffffff).stroke({ width: 0.03, color: 0x333333 })
            .moveTo(-0.1, -0.03).lineTo(0, 0.18).lineTo(0.1, -0.03).fill(0xffffff);
          bl.text.position.set(0, -0.1);
        }
        bl.position.set(f.x, f.y - 0.45);
      }
    }
    for (const [id, fig] of this.figuren) if (!da.has(id)) { fig.destroy(); this.figuren.delete(id); }
    for (const [id, bl] of this.blasenBilder) if (!da.has(id)) { bl.destroy(); this.blasenBilder.delete(id); }
  }

  /** Gespiegelte Szene (Steig links): Schrift und Blasen wieder lesbar machen. */
  spiegel(seite: 1 | -1) {
    for (const bl of this.blasenBilder.values()) bl.scale.y = seite;
    for (const t of this.schriften) t.scale.y = Math.abs(t.scale.y) * seite;
  }

  destroy() { this.c.destroy({ children: true }); }
}
