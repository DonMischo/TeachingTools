/**
 * Pixel-Studio: Modifier — Effekte je Ebene, die die Pixel nicht verändern. Sie wirken beim Zeichnen
 * jedes Bildes (also auch über die ganze Animation) und lassen sich jederzeit ändern, ausschalten oder
 * einbacken (`einbacken` in werkzeuge.ts). Reihenfolge = Liste von oben nach unten.
 */

export type Modifier =
  | { id: string; art: "farbe"; an: boolean; farbton: number; saettigung: number; helligkeit: number; kontrast: number; deckkraft: number }
  | { id: string; art: "umriss"; an: boolean; lage: "aussen" | "innen"; farbe: string; breite: number; deckkraft: number };

export const neuerModifier = (art: Modifier["art"], id: string): Modifier => art === "farbe"
  ? { id, art, an: true, farbton: 0, saettigung: 0, helligkeit: 0, kontrast: 0, deckkraft: 100 }
  : { id, art, an: true, lage: "aussen", farbe: "#1a1c2c", breite: 1, deckkraft: 100 };

function rgbZuHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslZuRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
export { rgbZuHsl, hslZuRgb };

const hex = (h: string): [number, number, number] => { const v = parseInt(h.replace("#", "").slice(0, 6), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

/** Farbe eines Pixels nach dem Farb-Modifier */
export function farbeAendern(r: number, g: number, b: number, m: { farbton: number; saettigung: number; helligkeit: number; kontrast: number }): [number, number, number] {
  let [h, s, l] = rgbZuHsl(r, g, b);
  h += m.farbton;
  s = Math.max(0, Math.min(1, s * (1 + m.saettigung / 100)));
  l = Math.max(0, Math.min(1, m.helligkeit >= 0 ? l + (1 - l) * m.helligkeit / 100 : l * (1 + m.helligkeit / 100)));
  let [nr, ng, nb] = hslZuRgb(h, s, l);
  if (m.kontrast) {
    const c = m.kontrast * 2.55, f = (259 * (c + 255)) / (255 * (259 - c));
    [nr, ng, nb] = [nr, ng, nb].map(v => (v - 128) * f + 128) as [number, number, number];
  }
  return [nr, ng, nb].map(v => Math.max(0, Math.min(255, Math.round(v)))) as [number, number, number];
}

/** Ring um die belegten Pixel (außen) bzw. Saum innen, `breite` Pixel breit (8er-Nachbarschaft) */
export function umrissMaske(belegt: Uint8Array, w: number, h: number, breite: number, innen: boolean): Uint8Array {
  // innen: Abstand zu Leerem; außen: Abstand zu Belegtem — beides schrittweise wachsen lassen
  const quelle = innen ? belegt.map(v => v ? 0 : 1) : belegt.slice();
  let front = quelle.slice();
  const ring = new Uint8Array(belegt.length);
  for (let s = 0; s < breite; s++) {
    const neu = front.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (front[i]) continue;
      let nah = false;
      for (let dy = -1; dy <= 1 && !nah; dy++) for (let dx = -1; dx <= 1; dx++) {
        const a = x + dx, b = y + dy;
        // außerhalb des Bildes gilt innen als leer (Rand bekommt Saum), außen als nichts
        if (a < 0 || b < 0 || a >= w || b >= h) { if (innen) { nah = true; break; } continue; }
        if (front[b * w + a]) { nah = true; break; }
      }
      if (nah) { neu[i] = 1; ring[i] = 1; }
    }
    front = neu;
  }
  return ring;
}

/** Modifier auf ein RGBA-Bild einer Ebene anwenden (an Ort und Stelle) */
export function modifierAnwenden(rgba: Uint8ClampedArray, w: number, h: number, mods: Modifier[]) {
  for (const m of mods) {
    if (!m.an) continue;
    if (m.art === "farbe") {
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        if (!rgba[o + 3]) continue;
        const [r, g, b] = farbeAendern(rgba[o], rgba[o + 1], rgba[o + 2], m);
        rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b;
        rgba[o + 3] = Math.round(rgba[o + 3] * m.deckkraft / 100);
      }
    } else {
      const belegt = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) belegt[i] = rgba[i * 4 + 3] >= 128 ? 1 : 0;
      const ring = umrissMaske(belegt, w, h, Math.max(1, Math.min(8, m.breite)), m.lage === "innen");
      const [r, g, b] = hex(m.farbe), a = m.deckkraft / 100;
      for (let i = 0; i < w * h; i++) {
        if (!ring[i]) continue;
        const o = i * 4, da = rgba[o + 3] / 255, na = a + da * (1 - a);
        rgba[o] = (r * a + rgba[o] * da * (1 - a)) / (na || 1);
        rgba[o + 1] = (g * a + rgba[o + 1] * da * (1 - a)) / (na || 1);
        rgba[o + 2] = (b * a + rgba[o + 2] * da * (1 - a)) / (na || 1);
        rgba[o + 3] = na * 255;
      }
    }
  }
}

/**
 * Farbrampe (»Hue Shifter«): aus einer Grundfarbe n hellere und n dunklere Töne. Hell wandert der
 * Farbton Richtung Gelb, dunkel Richtung Blau/Violett — so wirken Schatten und Licht lebendiger als
 * bloßes Abdunkeln.
 */
export function farbrampe(grund: string, n = 2, schritt = 0.13, drehung = 12): string[] {
  const [h, s, l] = rgbZuHsl(...hex(grund));
  const zu = (ziel: number, k: number) => { let d = ((ziel - h + 540) % 360) - 180; d = Math.sign(d) * Math.min(Math.abs(d), drehung * k); return h + d; };
  const aus: string[] = [];
  for (let k = -n; k <= n; k++) {
    const nl = Math.max(0.04, Math.min(0.96, l + k * schritt));
    const nh = k < 0 ? zu(250, -k) : k > 0 ? zu(55, k) : h;
    const ns = Math.max(0, Math.min(1, s + (k < 0 ? 0.05 : -0.04) * Math.abs(k)));
    const [r, g, b] = hslZuRgb(nh, ns, nl);
    aus.push("#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join(""));
  }
  return aus;
}
