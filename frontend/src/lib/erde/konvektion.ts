/**
 * Mantelkonvektion — ein echter Strömungslöser für zähes Gestein.
 *
 * Der Mantel ist so zäh, dass Trägheit keine Rolle spielt (Prandtl-Zahl
 * ≈ 10²³): In jedem Augenblick halten sich Auftrieb und Reibung genau die
 * Waage. Dimensionslos (Länge = Manteldicke, Zeit = d²/κ, ΔT = 1) gilt
 *
 *     ∇⁴ψ = Ra · ∂T/∂x            (Stokes, Boussinesq-Näherung)
 *     ∂T/∂t + u·∇T = ∇²T + H       (Wärme: Mitführung, Leitung, Zerfallswärme)
 *
 * mit der Stromfunktion ψ (u = ∂ψ/∂z, w = −∂ψ/∂x, z nach oben) und der
 * Rayleigh-Zahl Ra = ρ g α ΔT d³ / (κ η) — sie ist klein, wenn das Gestein
 * zäh ist. Unter Ra ≈ 657 leitet der Mantel nur Wärme; darüber setzt
 * Konvektion ein. Der echte Mantel liegt bei 10⁷–10⁸.
 *
 * Ränder: rundum reibungsfrei (ψ = ∇²ψ = 0). Dafür ist die Doppel-Sinus-Reihe
 * die exakte Lösung der Stokes-Gleichung — ein Rechenschritt, kein Iterieren.
 * Unten heizt der Kern (T = 1) oder nicht (isoliert), oben ist es kalt (T = 0);
 * wo ein Kontinent aufliegt, deckt er den Mantel zu (kein Wärmefluss nach oben).
 */

export interface KonvektionsOptionen {
  nx: number;
  nz: number;
  /** Breite zu Höhe. */
  seiten: number;
  ra: number;
  /** Heizt der Kern von unten? Sonst ist der Boden isolierend. */
  kernHeizt: boolean;
  /** Zerfallswärme im Mantel (dimensionslos, 0 = aus). */
  zerfall: number;
  /** Kontinent als Deckel: [von, bis] in Anteilen der Breite, oder null. */
  deckel: [number, number] | null;
}

export const STANDARD: KonvektionsOptionen = {
  nx: 120, nz: 48, seiten: 2.5, ra: 1e6, kernHeizt: true, zerfall: 0, deckel: null,
};

/** Grobe Umrechnung in die echte Erde (d = 2900 km, κ = 10⁻⁶ m²/s). */
export const JAHRE_JE_ZEITEINHEIT = (2.9e6 ** 2) / 1e-6 / 3.156e7;

/** Die Viskosität, die zu einer Rayleigh-Zahl gehört (ρ=4000, g=10, α=2·10⁻⁵, ΔT=2500 K). */
export function viskositaetAusRa(ra: number): number {
  return (4000 * 10 * 2e-5 * 2500 * 2.9e6 ** 3) / 1e-6 / ra;
}

/** Tempo-Regler 0–100 → Anteil des stabilen Zeitschritts je Bild, logarithmisch 0,02–2. */
export function tempoAusStufe(stufe: number): number {
  return 0.02 * 100 ** (stufe / 100);
}

function sinusMatrix(n: number): Float64Array {
  // S[m·(n+1) + i] = sin(m π i / n) für m, i in 1..n-1
  const s = new Float64Array((n + 1) * (n + 1));
  for (let m = 1; m < n; m++) for (let i = 1; i < n; i++) s[m * (n + 1) + i] = Math.sin((m * Math.PI * i) / n);
  return s;
}

export class Konvektion {
  readonly nx: number;
  readonly nz: number;
  readonly dx: number;
  readonly dz: number;
  opt: KonvektionsOptionen;
  /** Temperatur an den Knoten (nx+1)·(nz+1), Zeile j = Höhe. */
  T: Float64Array;
  psi: Float64Array;
  u: Float64Array;
  w: Float64Array;
  zeit = 0;
  private sx: Float64Array;
  private sz: Float64Array;
  private hilf: Float64Array;
  private hilf2: Float64Array;
  private tNeu: Float64Array;

  constructor(opt: Partial<KonvektionsOptionen> = {}, zufall: () => number = Math.random) {
    this.opt = { ...STANDARD, ...opt };
    this.nx = this.opt.nx;
    this.nz = this.opt.nz;
    this.dx = this.opt.seiten / this.nx;
    this.dz = 1 / this.nz;
    const n = (this.nx + 1) * (this.nz + 1);
    this.T = new Float64Array(n);
    this.psi = new Float64Array(n);
    this.u = new Float64Array(n);
    this.w = new Float64Array(n);
    this.hilf = new Float64Array(n);
    this.hilf2 = new Float64Array(n);
    this.tNeu = new Float64Array(n);
    this.sx = sinusMatrix(this.nx);
    this.sz = sinusMatrix(this.nz);
    this.anfang(zufall);
  }

  idx(i: number, j: number) { return j * (this.nx + 1) + i; }

  /** Warm unten, kalt oben, dazu ein wenig Zufall, damit etwas anfängt. */
  anfang(zufall: () => number = Math.random) {
    for (let j = 0; j <= this.nz; j++) {
      const z = j / this.nz;
      for (let i = 0; i <= this.nx; i++) {
        const x = i * this.dx;
        const grund = this.opt.kernHeizt ? 1 - z : 0.5;
        const stoer = 0.05 * Math.sin(Math.PI * z) * (Math.cos((Math.PI * x) / this.opt.seiten) + (zufall() - 0.5));
        this.T[this.idx(i, j)] = grund + stoer;
      }
    }
    this.raender();
    this.zeit = 0;
    this.stokes();
  }

  /** Ein heißer Fleck (Plume-Kopf) an der Stelle x, z. */
  heizeFleck(x: number, z: number, staerke = 0.4, radius = 0.08) {
    for (let j = 1; j < this.nz; j++) for (let i = 0; i <= this.nx; i++) {
      const d2 = (i * this.dx - x) ** 2 + (j * this.dz - z) ** 2;
      const k = this.idx(i, j);
      this.T[k] = Math.min(1.2, Math.max(-0.1, this.T[k] + staerke * Math.exp(-d2 / (radius * radius))));
    }
  }

  private unterDeckel(i: number) {
    const d = this.opt.deckel;
    if (!d) return false;
    const f = i / this.nx;
    return f >= d[0] && f <= d[1];
  }

  private raender() {
    const { nx, nz, T } = this;
    for (let j = 0; j <= nz; j++) {
      T[this.idx(0, j)] = T[this.idx(1, j)];
      T[this.idx(nx, j)] = T[this.idx(nx - 1, j)];
    }
    for (let i = 0; i <= nx; i++) {
      T[this.idx(i, 0)] = this.opt.kernHeizt ? 1 : T[this.idx(i, 1)];
      T[this.idx(i, nz)] = this.unterDeckel(i) ? T[this.idx(i, nz - 1)] : 0;
    }
  }

  /** Löst ∇⁴ψ = Ra ∂T/∂x mit der Doppel-Sinus-Reihe, dann u und w. */
  stokes() {
    const { nx, nz, dx, dz, T, psi, u, w, hilf, hilf2, sx, sz } = this;
    const W = nx + 1;
    // Quelle ∂T/∂x im Inneren.
    hilf.fill(0);
    for (let j = 1; j < nz; j++) for (let i = 1; i < nx; i++) {
      hilf[j * W + i] = (T[j * W + i + 1] - T[j * W + i - 1]) / (2 * dx);
    }
    // Vorwärts in x (je Zeile) ...
    hilf2.fill(0);
    for (let j = 1; j < nz; j++) for (let m = 1; m < nx; m++) {
      let s = 0;
      const zm = m * (nx + 1);
      for (let i = 1; i < nx; i++) s += hilf[j * W + i] * sx[zm + i];
      hilf2[j * W + m] = (2 / nx) * s;
    }
    // ... und in z (je Spalte), dann teilen durch k⁴.
    const L = this.opt.seiten;
    for (let m = 1; m < nx; m++) {
      const kx = (m * Math.PI) / L;
      for (let n = 1; n < nz; n++) {
        let s = 0;
        const zn = n * (nz + 1);
        for (let j = 1; j < nz; j++) s += hilf2[j * W + m] * sz[zn + j];
        const kz = n * Math.PI;
        const k2 = kx * kx + kz * kz;
        hilf[n * W + m] = ((2 / nz) * s * this.opt.ra) / (k2 * k2);
      }
    }
    // Zurück: erst z, dann x.
    hilf2.fill(0);
    for (let m = 1; m < nx; m++) for (let j = 1; j < nz; j++) {
      let s = 0;
      for (let n = 1; n < nz; n++) s += hilf[n * W + m] * sz[n * (nz + 1) + j];
      hilf2[j * W + m] = s;
    }
    psi.fill(0);
    for (let j = 1; j < nz; j++) for (let i = 1; i < nx; i++) {
      let s = 0;
      for (let m = 1; m < nx; m++) s += hilf2[j * W + m] * sx[m * (nx + 1) + i];
      psi[j * W + i] = s;
    }
    // Geschwindigkeiten; am Rand ist die senkrechte Komponente null.
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const k = j * W + i;
      const jo = Math.min(nz, j + 1), ju = Math.max(0, j - 1);
      const ir = Math.min(nx, i + 1), il = Math.max(0, i - 1);
      u[k] = j === 0 || j === nz ? (j === 0 ? (psi[k + W] - psi[k]) / dz : (psi[k] - psi[k - W]) / dz)
        : (psi[jo * W + i] - psi[ju * W + i]) / ((jo - ju) * dz);
      w[k] = i === 0 || i === nx ? 0 : -(psi[j * W + ir] - psi[j * W + il]) / ((ir - il) * dx);
      if (j === 0 || j === nz) w[k] = 0;
      if (i === 0 || i === nx) u[k] = 0;
    }
  }

  /** Geschwindigkeit (u, w) an einem beliebigen Punkt, bilinear. */
  geschwindigkeit(x: number, z: number): [number, number] {
    return [this.lies(this.u, x, z), this.lies(this.w, x, z)];
  }

  temperatur(x: number, z: number): number {
    return this.lies(this.T, x, z);
  }

  private lies(f: Float64Array, x: number, z: number): number {
    const fx = Math.min(this.nx - 1e-9, Math.max(0, x / this.dx));
    const fz = Math.min(this.nz - 1e-9, Math.max(0, z / this.dz));
    const i = Math.floor(fx), j = Math.floor(fz);
    const a = fx - i, b = fz - j;
    const W = this.nx + 1;
    const k = j * W + i;
    return (1 - a) * (1 - b) * f[k] + a * (1 - b) * f[k + 1] + (1 - a) * b * f[k + W] + a * b * f[k + W + 1];
  }

  maxTempo(): number {
    let m = 0;
    for (let k = 0; k < this.u.length; k++) m = Math.max(m, Math.hypot(this.u[k], this.w[k]));
    return m;
  }

  /** Größter stabiler Zeitschritt. */
  zeitschritt(): number {
    const h = Math.min(this.dx, this.dz);
    return Math.min((h * h) / 4.2, (2 * h) / Math.max(1e-9, this.maxTempo()));
  }

  /** Ein Zeitschritt: mitführen (semi-Lagrange), leiten, heizen, Stokes. */
  schritt(dt = this.zeitschritt()) {
    const { nx, nz, dx, dz, T, tNeu } = this;
    const W = nx + 1;
    // Mitführen: woher kam das Teilchen, das jetzt hier ist?
    for (let j = 1; j < nz; j++) for (let i = 1; i < nx; i++) {
      const k = j * W + i;
      const x = i * dx, z = j * dz;
      const xm = x - 0.5 * dt * this.u[k], zm = z - 0.5 * dt * this.w[k];
      const [um, wm] = this.geschwindigkeit(xm, zm);
      tNeu[k] = this.temperatur(x - dt * um, z - dt * wm);
    }
    for (let j = 1; j < nz; j++) for (let i = 1; i < nx; i++) T[j * W + i] = tNeu[j * W + i];
    this.raender();
    // Wärmeleitung (explizit, in Teilschritten stabil) und Zerfallswärme.
    const h2 = Math.min(dx, dz) ** 2;
    const teile = Math.max(1, Math.ceil(dt / (h2 / 4.2)));
    const d = dt / teile;
    for (let s = 0; s < teile; s++) {
      for (let j = 1; j < nz; j++) for (let i = 1; i < nx; i++) {
        const k = j * W + i;
        const lap = (T[k + 1] - 2 * T[k] + T[k - 1]) / (dx * dx) + (T[k + W] - 2 * T[k] + T[k - W]) / (dz * dz);
        tNeu[k] = T[k] + d * (lap + this.opt.zerfall);
      }
      for (let j = 1; j < nz; j++) for (let i = 1; i < nx; i++) T[j * W + i] = tNeu[j * W + i];
      this.raender();
    }
    this.zeit += dt;
    this.stokes();
  }

  /**
   * Nusselt-Zahl: Wärmefluss durch die Oberfläche gegenüber reiner
   * Wärmeleitung (1 = keine Konvektion).
   */
  nusselt(): number {
    const { nx, nz, dz } = this;
    let q = 0, n = 0;
    for (let i = 0; i <= nx; i++) {
      if (this.unterDeckel(i)) continue;
      q += (this.T[this.idx(i, nz - 1)] - this.T[this.idx(i, nz)]) / dz;
      n++;
    }
    return n ? q / n : 0;
  }

  mittlereTemperatur(): number {
    let s = 0;
    for (let k = 0; k < this.T.length; k++) s += this.T[k];
    return s / this.T.length;
  }
}
