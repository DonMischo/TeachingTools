/**
 * Mantelströmung im Querschnitt des Wilson-Zyklus: derselbe Löser wie in
 * »Aufbau der Erde« (Stokes + Wärme), hier über die oberen 720 km.
 *
 * Die Plattentektonik steuert ihn: Die abtauchende Platte kühlt den Mantel
 * und zieht ihn mit in die Tiefe (Plattenzug), unter Rücken und Plume steigt
 * heißes Gestein auf. Springt die Zeit, stellt sich die Strömung um.
 */
import { Konvektion } from "@/lib/erde/konvektion";
import { mantelFarbe } from "@/lib/erde/farben";
import { ANFANG_RIFT, AUFBRUCH, abtauchendePlatte, rueckenAktiv, rueckenX } from "@/lib/wilson/modell";
import { X_MAX, X_MIN } from "./zeichnen";

const TIEFE = 720;
const SEITEN = (X_MAX - X_MIN) / TIEFE;
/** Stützstellen der gestauchten Tiefenachse innerhalb des Löser-Gebiets (km). */
const STUECKE = [0, 15, 160, TIEFE];

export class WilsonMantel {
  readonly k = new Konvektion({ nx: 240, nz: 24, seiten: SEITEN, ra: 6e4, kernHeizt: false, zerfall: 8 });
  private teilchen = Array.from({ length: 700 }, () => this.irgendwo());
  private bild: HTMLCanvasElement | null = null;
  private zuletzt = -1;

  private irgendwo() {
    return { x: Math.random() * SEITEN, z: Math.random() };
  }

  /** Gestein um (x, Tiefe) in km zur Temperatur `ziel` ziehen. */
  private ziehe(x: number, tiefe: number, radius: number, ziel: number, staerke: number) {
    const { k } = this;
    const xs = (x - X_MIN) / TIEFE, zs = 1 - tiefe / TIEFE, rs = radius / TIEFE;
    const i0 = Math.max(1, Math.floor((xs - 2 * rs) / k.dx)), i1 = Math.min(k.nx - 1, Math.ceil((xs + 2 * rs) / k.dx));
    const j0 = Math.max(1, Math.floor((zs - 2 * rs) / k.dz)), j1 = Math.min(k.nz - 1, Math.ceil((zs + 2 * rs) / k.dz));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d2 = ((i * k.dx - xs) ** 2 + (j * k.dz - zs) ** 2) / (rs * rs);
      if (d2 > 4) continue;
      const n = k.idx(i, j);
      k.T[n] += (ziel - k.T[n]) * staerke * Math.exp(-d2);
    }
  }

  private antreiben(t: number) {
    const pl = abtauchendePlatte(t);
    if (pl) {
      for (const teil of [pl.haengt, pl.sinkt]) {
        for (let i = 0; i < teil.length; i += 2) {
          const p = teil[i], h = p.dick / 2;
          if (h < 5) continue;
          this.ziehe(p.x - Math.sin(p.winkel) * h, p.z + Math.cos(p.winkel) * h, Math.max(35, h), 0, 0.25);
        }
      }
    }
    if (rueckenAktiv(t) && t >= AUFBRUCH) for (let z = 120; z <= 660; z += 60) this.ziehe(rueckenX(t), z, 50, 1, 0.05);
    if (t < AUFBRUCH + 50) {
      const kopf = t < ANFANG_RIFT ? 700 - 520 * (t / ANFANG_RIFT) : 180;
      const st = t < AUFBRUCH ? 1 : Math.max(0, 1 - (t - AUFBRUCH) / 50);
      this.ziehe(0, kopf, 70, 1.15, 0.15 * st);
      for (let z = kopf + 50; z <= 700; z += 50) this.ziehe(0, z, 35, 1.1, 0.08 * st);
    }
  }

  /** Ein Bild weiter; nach einem Zeitsprung rechnet er ein paar Schritte vor. */
  schritt(t: number) {
    const n = this.zuletzt < 0 || Math.abs(t - this.zuletzt) > 15 ? 30 : 1;
    this.zuletzt = t;
    for (let s = 0; s < n; s++) {
      this.antreiben(t);
      const dt = this.k.zeitschritt() * 0.6;
      this.k.schritt(dt);
      for (const p of this.teilchen) {
        const [u, w] = this.k.geschwindigkeit(p.x, p.z);
        p.x += u * dt; p.z += w * dt;
        if (p.x < 0 || p.x > SEITEN || p.z < 0 || p.z > 1 || Math.random() < 0.003) Object.assign(p, this.irgendwo());
      }
    }
  }

  /** Temperaturfeld und mitschwimmende Körnchen in die gestauchte Tiefenachse zeichnen. */
  zeichne(ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (z: number) => number) {
    const { k } = this;
    const B = k.nx + 1, H = k.nz + 1;
    if (!this.bild) { this.bild = document.createElement("canvas"); this.bild.width = B; this.bild.height = H; }
    const hctx = this.bild.getContext("2d")!;
    const daten = hctx.createImageData(B, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < B; i++) {
      const f = mantelFarbe(Math.min(1, Math.max(0, k.T[j * B + i])));
      const p = ((H - 1 - j) * B + i) * 4;
      daten.data[p] = f[0] * 255; daten.data[p + 1] = f[1] * 255; daten.data[p + 2] = f[2] * 255; daten.data[p + 3] = 255;
    }
    hctx.putImageData(daten, 0, 0);
    ctx.imageSmoothingEnabled = true;
    // Zeile r des Bildes liegt in der Tiefe r/nz · 720 km (Pixelmitte bei r + 0,5).
    const zeile = (z: number) => (z / TIEFE) * k.nz + 0.5;
    for (let s = 1; s < STUECKE.length; s++) {
      const za = STUECKE[s - 1], zb = STUECKE[s];
      ctx.drawImage(this.bild, 0.5, zeile(za), k.nx, zeile(zb) - zeile(za), X(X_MIN), Y(za), X(X_MAX) - X(X_MIN), Y(zb) - Y(za));
    }
    ctx.fillStyle = "rgba(255,240,210,0.6)";
    for (const p of this.teilchen) ctx.fillRect(X(X_MIN + p.x * TIEFE) - 1, Y((1 - p.z) * TIEFE) - 1, 2, 2);
  }
}
