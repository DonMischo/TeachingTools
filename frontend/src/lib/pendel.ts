/**
 * Ideales Fadenpendel: Punktmasse an masselosem Faden, keine Reibung.
 * Kleine Auslenkung: φ(t) = φ₀ · cos(ω t), ω = √(g/L), T = 2π √(L/g).
 * Große Auslenkung: φ'' = −(g/L) sin φ, numerisch mit Runge-Kutta (RK4).
 * Winkel in Bogenmaß, Länge in m, Zeit in s.
 */

export const ORTSFAKTOREN = [
  { id: "erde", name: "Erde", g: 9.81 },
  { id: "mond", name: "Mond", g: 1.62 },
  { id: "mars", name: "Mars", g: 3.71 },
  { id: "jupiter", name: "Jupiter", g: 24.79 },
] as const;

export const omega = (L: number, g: number) => Math.sqrt(g / L);
export const periode = (L: number, g: number) => 2 * Math.PI * Math.sqrt(L / g);
export const frequenz = (L: number, g: number) => 1 / periode(L, g);

/** Näherung für die Periode bei großer Amplitude (Reihe bis φ₀⁴) */
export const periodeGross = (L: number, g: number, phi0: number) =>
  periode(L, g) * (1 + phi0 ** 2 / 16 + (11 * phi0 ** 4) / 3072);

/** Lösung für kleine Winkel */
export const winkelKlein = (t: number, phi0: number, L: number, g: number) => phi0 * Math.cos(omega(L, g) * t);

/**
 * Pendel simulieren: φ'' = −(g/L)·sin φ − 2δ·φ' (δ = Dämpfung in 1/s, 0 = ideal).
 * `linear`: sin φ ≈ φ (kleine Winkel). Liefert Abtastwerte alle dt Sekunden.
 */
export function simuliere(phi0: number, L: number, g: number, dauer: number, dt = 0.002, daempfung = 0, linear = false): { t: number; phi: number; w: number }[] {
  const k = g / L;
  const f = (phi: number, w: number): [number, number] => [w, -k * (linear ? phi : Math.sin(phi)) - 2 * daempfung * w];
  let phi = phi0, w = 0;
  const aus = [{ t: 0, phi, w }];
  const schritte = Math.round(dauer / dt);
  for (let i = 1; i <= schritte; i++) {
    const [a1, b1] = f(phi, w);
    const [a2, b2] = f(phi + (dt / 2) * a1, w + (dt / 2) * b1);
    const [a3, b3] = f(phi + (dt / 2) * a2, w + (dt / 2) * b2);
    const [a4, b4] = f(phi + dt * a3, w + dt * b3);
    phi += (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    w += (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    aus.push({ t: i * dt, phi, w });
  }
  return aus;
}

/** Periode aus einer Simulation: Zeit zwischen zwei Durchgängen durch die Ruhelage in gleicher Richtung */
export function gemessenePeriode(werte: { t: number; phi: number }[]): number | null {
  const nullen: number[] = [];
  for (let i = 1; i < werte.length; i++) {
    const a = werte[i - 1], b = werte[i];
    if (a.phi > 0 && b.phi <= 0) nullen.push(a.t + (a.phi / (a.phi - b.phi)) * (b.t - a.t));
  }
  return nullen.length >= 2 ? nullen[1] - nullen[0] : null;
}

/** Gedämpft: Hüllkurve der Amplitude φ₀·e^(−δt) und Periode T_d = 2π / √(ω² − δ²) (null = Kriechfall, keine Schwingung) */
export const huelle = (phi0: number, daempfung: number, t: number) => phi0 * Math.exp(-daempfung * t);
export function periodeGedaempft(L: number, g: number, daempfung: number): number | null {
  const wd2 = g / L - daempfung ** 2;
  return wd2 > 0 ? (2 * Math.PI) / Math.sqrt(wd2) : null;
}
/** Zeit, bis die Amplitude auf die Hälfte gefallen ist */
export const halbwertszeit = (daempfung: number) => (daempfung > 0 ? Math.LN2 / daempfung : Infinity);

/** Höchstgeschwindigkeit im tiefsten Punkt (Energieerhaltung) */
export const vMax = (L: number, g: number, phi0: number) => Math.sqrt(2 * g * L * (1 - Math.cos(phi0)));

export const grad = (rad: number) => (rad * 180) / Math.PI;
export const rad = (deg: number) => (deg * Math.PI) / 180;
