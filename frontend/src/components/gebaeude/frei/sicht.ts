/**
 * Sicht in der Draufsicht: Welche Felder sieht die Figur von ihrem Feld aus? Strahlen über das Raster
 * (Wandfelder halten den Blick auf, Wasser und der Tempel auf dem Vorplatz nicht); die Wand selbst, auf die der Blick trifft, ist sichtbar.
 * Gesehenes bleibt gedämpft (»erkundet«), Ungesehenes schwarz. Ergebnis als Textur für durchsicht.ts.
 */
import * as THREE from "three";
import { WAND, ZELLE, type FreiEbene } from "@/lib/gebaeude/frei";

/** so weit (Felder) reicht der Blick */
const WEIT = 22;
const HELL = 255, ERKUNDET = 70;

export interface Sicht {
  textur: THREE.DataTexture;
  groesse: THREE.Vector2;
  /** neu berechnen, wenn die Figur ein anderes Feld betritt; gibt true zurück, wenn sich etwas änderte */
  aktualisiere: (x: number, z: number) => boolean;
}

export function neueSicht(e: FreiEbene): Sicht {
  const daten = new Uint8Array(e.b * e.h * 4);
  const erkundet = new Uint8Array(e.b * e.h);
  const textur = new THREE.DataTexture(daten, e.b, e.h);
  textur.magFilter = THREE.LinearFilter;
  textur.minFilter = THREE.LinearFilter;
  textur.needsUpdate = true;
  // der Tempel auf dem Vorplatz ist ein Bauwerk im Freien, keine Mauer zwischen Räumen: man sieht ihn ganz
  const k = e.vorplatz?.kern;
  const imKern = (x: number, y: number) => !!k && x >= k.x && x < k.x + k.b && y >= k.y && y < k.y + k.h;
  const sperrt = (x: number, y: number) => x < 0 || y < 0 || x >= e.b || y >= e.h
    || (e.art[y * e.b + x] === WAND && !e.wasser?.[y * e.b + x] && !imKern(x, y));
  let zuletzt = -1;
  const sichtbar = new Uint8Array(e.b * e.h);

  const aktualisiere = (wx: number, wz: number) => {
    const px = Math.floor(wx / ZELLE), py = Math.floor(wz / ZELLE);
    const hier = py * e.b + px;
    if (hier === zuletzt) return false;
    zuletzt = hier;
    sichtbar.fill(0);
    const ax = wx / ZELLE, ay = wz / ZELLE;
    for (let ty = Math.max(0, py - WEIT); ty <= Math.min(e.h - 1, py + WEIT); ty++) {
      for (let tx = Math.max(0, px - WEIT); tx <= Math.min(e.b - 1, px + WEIT); tx++) {
        const bx = tx + 0.5, by = ty + 0.5, lang = Math.hypot(bx - ax, by - ay);
        if (lang > WEIT) continue;
        const n = Math.ceil(lang / 0.3);
        let frei = true;
        for (let k = 1; k < n; k++) {
          const cx = Math.floor(ax + ((bx - ax) * k) / n), cy = Math.floor(ay + ((by - ay) * k) / n);
          if ((cx !== tx || cy !== ty) && sperrt(cx, cy)) { frei = false; break; }
        }
        if (frei) sichtbar[ty * e.b + tx] = 1;
      }
    }
    for (let i = 0; i < sichtbar.length; i++) {
      if (sichtbar[i]) erkundet[i] = 1;
      const v = sichtbar[i] ? HELL : erkundet[i] ? ERKUNDET : 0;
      daten[i * 4] = daten[i * 4 + 1] = daten[i * 4 + 2] = v;
      daten[i * 4 + 3] = 255;
    }
    textur.needsUpdate = true;
    return true;
  };
  return { textur, groesse: new THREE.Vector2(e.b * ZELLE, e.h * ZELLE), aktualisiere };
}
