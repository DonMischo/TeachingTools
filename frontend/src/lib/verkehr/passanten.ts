/**
 * Fußgänger (Passanten) als Statisten: Sie laufen auf Gehwegen und Fußwegen
 * rund um die eigene Figur, biegen an Kreuzungen ab, warten am Bordstein,
 * wenn ein Auto kommt, weichen aus, wenn jemand klingelt, und schimpfen, wenn
 * ein Rad zu dicht und zu schnell vorbeifährt. Jedes Gerät rechnet seine
 * eigenen — sie sind Kulisse, keine Mitspieler. Kein Pixi.
 */
import type { P } from "./geometrie";
import type { Stadt } from "./stadt";
import type { AutoLage } from "./vorfahrt";

export type Passant = {
  id: number; x: number; y: number; winkel: number; tempo: number;
  /** Weg: Linie und Richtung, Ziel ist Stützpunkt `i`. */
  linie: number; i: number; schritt: 1 | -1;
  /** Seitlicher Versatz beim Ausweichen (Meter) und bis wann. */
  seite: number; weichtBis: number;
  wartet: number;
  ruf?: { text: string; bis: number };
};

const ZELLE = 50;
const RUFE = ["He! Klingeln!", "Pass doch auf!", "Langsam!", "Das ist ein Gehweg!"];

export class Passanten {
  readonly liste: Passant[] = [];
  private linien: P[][] = [];
  private raster = new Map<string, { l: number; i: number }[]>();
  private enden = new Map<string, { l: number; ende: 0 | 1 }[]>();
  private naechsteId = 1;

  constructor(private stadt: Stadt, private rnd: () => number = Math.random) {
    // Gehwege neben den Straßen (links und rechts versetzt) und die Fußwege
    for (const s of stadt.strassen) {
      if (!s.gehwegBreite) continue;
      const d = s.breite / 2 + s.gehwegBreite / 2;
      this.linien.push(versetzt(s.linie, d), versetzt(s.linie, -d));
    }
    for (const w of stadt.karte.wege) {
      if (w.art === "geh" || w.art === "geh_rad" || w.art === "geh_radfrei" || w.art === "feldweg") this.linien.push(w.linie);
      // Getrennter Weg: Fußgänger auf ihrer Hälfte (gegenüber der Radhälfte)
      else if (w.art === "geh_rad_getrennt") this.linien.push(versetzt(w.linie, -0.85 * stadt.radSeite(w.linie)));
    }
    this.linien.forEach((linie, l) => {
      linie.forEach((p, i) => {
        const k = zelle(p);
        let e = this.raster.get(k);
        if (!e) { e = []; this.raster.set(k, e); }
        e.push({ l, i });
      });
      for (const ende of [0, 1] as const) {
        const k = zelle(linie[ende ? linie.length - 1 : 0]);
        let e = this.enden.get(k);
        if (!e) { e = []; this.enden.set(k, e); }
        e.push({ l, ende });
      }
    });
  }

  /** Einen neuen Passanten irgendwo 35–90 m von `um` entfernt auf einen Weg stellen. */
  private setze(um: P): boolean {
    for (let versuch = 0; versuch < 12; versuch++) {
      const w = this.rnd() * Math.PI * 2, r = 35 + this.rnd() * 55;
      const e = this.raster.get(zelle([um[0] + Math.cos(w) * r, um[1] + Math.sin(w) * r]));
      if (!e?.length) continue;
      const { l, i } = e[Math.floor(this.rnd() * e.length)];
      const p = this.linien[l][i];
      if (this.stadt.untergrund(p[0], p[1]).art === "haus") continue;
      const schritt: 1 | -1 = i === 0 ? 1 : i === this.linien[l].length - 1 ? -1 : this.rnd() < 0.5 ? 1 : -1;
      this.liste.push({
        id: this.naechsteId++, x: p[0], y: p[1], winkel: 0, tempo: 1.1 + this.rnd() * 0.5,
        linie: l, i: i + schritt, schritt, seite: 0, weichtBis: -Infinity, wartet: 0,
      });
      return true;
    }
    return false;
  }

  /** Am Ende eines Weges: den nächsten Weg in der Nähe nehmen (abbiegen), sonst umkehren. */
  private weiter(p: Passant) {
    const hier: P = [p.x, p.y];
    const moeglich: { l: number; ende: 0 | 1 }[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const e of this.enden.get(zelle([hier[0] + dx * ZELLE, hier[1] + dy * ZELLE])) ?? []) {
        if (e.l === p.linie) continue;
        const q = this.linien[e.l][e.ende ? this.linien[e.l].length - 1 : 0];
        if (Math.hypot(q[0] - hier[0], q[1] - hier[1]) < 9) moeglich.push(e);
      }
    }
    if (moeglich.length) {
      const e = moeglich[Math.floor(this.rnd() * moeglich.length)];
      p.linie = e.l;
      p.schritt = e.ende ? -1 : 1;
      p.i = e.ende ? this.linien[e.l].length - 1 : 0;
    } else {
      p.schritt = p.schritt === 1 ? -1 : 1;
      p.i += p.schritt;
    }
  }

  /**
   * Ein Schritt. `klingel`: wo und wann zuletzt geklingelt wurde; `rad`: der
   * eigene Radfahrer (für Rufe). Gibt die neuen Rufe zurück.
   */
  schritt(dt: number, t: number, um: P, anzahl: number, autos: AutoLage[],
    klingel: { x: number; y: number; t: number } | null, rad: { x: number; y: number; tempo: number } | null, ich: P | null): string[] {
    const rufe: string[] = [];
    // Wer zu weit weg ist, geht; es kommen neue dazu
    for (let i = this.liste.length - 1; i >= 0; i--)
      if (Math.hypot(this.liste[i].x - um[0], this.liste[i].y - um[1]) > 130) this.liste.splice(i, 1);
    let neu = 0;
    while (this.liste.length < anzahl && neu++ < 3) if (!this.setze(um)) break;
    while (this.liste.length > anzahl + 2) this.liste.pop();

    for (const p of this.liste) {
      if (p.ruf && p.ruf.bis < t) p.ruf = undefined;
      if (p.i < 0 || p.i >= this.linien[p.linie].length) this.weiter(p);
      const linie = this.linien[p.linie];
      const ziel = linie[Math.max(0, Math.min(linie.length - 1, p.i))];
      const dx = ziel[0] - p.x, dy = ziel[1] - p.y, d = Math.hypot(dx, dy);
      if (d < 0.3) { p.i += p.schritt; continue; }
      const w = Math.atan2(dy, dx);
      // Klingeln in der Nähe: zur Seite gehen
      if (klingel && t - klingel.t < 1.5 && Math.hypot(klingel.x - p.x, klingel.y - p.y) < 15 && p.weichtBis < t) p.weichtBis = t + 4;
      const seiteZiel = p.weichtBis > t ? 0.9 : 0;
      p.seite += Math.sign(seiteZiel - p.seite) * Math.min(Math.abs(seiteZiel - p.seite), dt * 1.5);
      // Zu dicht und zu schnell überholt: schimpfen
      if (rad && rad.tempo > 2.5 && (!klingel || t - klingel.t > 4) && Math.hypot(rad.x - p.x, rad.y - p.y) < 1.3 && !p.ruf) {
        p.ruf = { text: RUFE[Math.floor(this.rnd() * RUFE.length)], bis: t + 2.5 };
        rufe.push(p.ruf.text);
      }
      const v = p.tempo * dt;
      const nx = p.x + Math.cos(w) * Math.min(v, d), ny = p.y + Math.sin(w) * Math.min(v, d);
      // Vor der Fahrbahn: warten, bis kein Auto kommt (höchstens 25 s)
      if (this.stadt.untergrund(p.x, p.y).art !== "fahrbahn" && this.stadt.untergrund(nx, ny).art === "fahrbahn") {
        const kommt = autos.some((f) => f.tempo > 1 && Math.hypot(f.x - nx, f.y - ny) < 25
          && Math.cos(f.winkel - Math.atan2(ny - f.y, nx - f.x)) > 0.3);
        if (kommt && p.wartet < 25) { p.wartet += dt; p.winkel = w; continue; }
      }
      // Der eigenen Figur nicht in die Quere laufen
      if (ich && Math.hypot(ich[0] - nx, ich[1] - ny) < 0.6) { p.wartet += dt; if (p.weichtBis < t) p.weichtBis = t + 2; continue; }
      p.wartet = 0;
      p.x = nx; p.y = ny; p.winkel = w;
    }
    return rufe;
  }

  /** Wo man den Passanten zeichnet: mit dem seitlichen Ausweichen. */
  lage(p: Passant): P {
    return [p.x - Math.sin(p.winkel) * p.seite, p.y + Math.cos(p.winkel) * p.seite];
  }
}

const zelle = (p: P) => `${Math.floor(p[0] / ZELLE)},${Math.floor(p[1] / ZELLE)}`;

/** Linie seitlich versetzt (positiv = rechts in Laufrichtung, y nach Süden). */
function versetzt(punkte: P[], ab: number): P[] {
  return punkte.map((p, i) => {
    const a = punkte[Math.max(0, i - 1)], b = punkte[Math.min(punkte.length - 1, i + 1)];
    const w = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return [p[0] - Math.sin(w) * ab, p[1] + Math.cos(w) * ab];
  });
}
