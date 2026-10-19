/**
 * Häuser entlang der Straßen: jede Straße wird abgeschritten, links und
 * rechts entsteht je nach Viertel ein Haus (Altstadt schmal und dicht,
 * Vorort mit Abstand, Plattenbau lang). Häuser auf Wasser, Straßen oder
 * Bauwerken fallen weg. Deterministisch, damit das Bild nicht flackert.
 */
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { istWasser, type Gelaende } from "@/lib/gelaende/gelaende";
import { abstand, inPoly, rechteck, type P } from "./geometrie";
import { BAUTEN, STRASSEN, ZONEN, type HausArt, type Stadt, type ZonenTyp } from "./modell";

export interface Haus { ecken: P[]; c: P; hoehe: number; dach: string; zone: ZonenTyp }

/** welches Viertel an p gilt (das zuletzt eingetragene gewinnt) */
export function zoneBei(s: Stadt, p: P): ZonenTyp | null {
  for (let i = s.zonen.length - 1; i >= 0; i--) if (inPoly(p, s.zonen[i].poly)) return s.zonen[i].typ;
  return null;
}

/** Viertel, wenn keins gemalt ist: in der Mauer Altstadt bzw. Insulae, sonst je nach Stil */
export function standardZone(s: Stadt, p: P): ZonenTyp {
  const inMauer = s.mauern.some(m => inPoly(p, m));
  if (s.stil === "roemisch") return inMauer ? "insulae" : "suburbium";
  if (s.stil === "europaeisch") return inMauer ? "altstadt" : "vorstadt";
  return "kleinstadt";
}

class Belegung {
  private m = new Map<number, P[][]>();
  constructor(private z = 24) {}
  private keys(ecken: P[]) {
    const xs = ecken.map(p => p.x), ys = ecken.map(p => p.y);
    const out: number[] = [];
    for (let i = Math.floor(Math.min(...xs) / this.z); i <= Math.floor(Math.max(...xs) / this.z); i++)
      for (let j = Math.floor(Math.min(...ys) / this.z); j <= Math.floor(Math.max(...ys) / this.z); j++) out.push(i * 100003 + j);
    return out;
  }
  frei(ecken: P[]): boolean {
    for (const k of this.keys(ecken)) for (const o of this.m.get(k) ?? []) if (ueberlappt(ecken, o)) return false;
    return true;
  }
  add(ecken: P[]) {
    for (const k of this.keys(ecken)) { let l = this.m.get(k); if (!l) this.m.set(k, (l = [])); l.push(ecken); }
  }
}

/** Trennachsen-Test für zwei konvexe Vierecke */
function ueberlappt(a: P[], b: P[]): boolean {
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const nx = q.y - p.y, ny = p.x - q.x;
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (const v of a) { const d = v.x * nx + v.y * ny; amin = Math.min(amin, d); amax = Math.max(amax, d); }
    for (const v of b) { const d = v.x * nx + v.y * ny; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
    if (amax <= bmin || bmax <= amin) return false;
  }
  return true;
}

const zwischen = (z: () => number, [a, b]: readonly [number, number]) => a + (b - a) * z();

export function haeuser(s: Stadt, g: Gelaende, seed = 1): Haus[] {
  const z = zufallsquelle(seed);
  const beleg = new Belegung();
  const aus: Haus[] = [];
  // Straßen und Bauwerke als Hindernisse eintragen
  for (const st of s.strassen) {
    const b = STRASSEN[st.art].breite;
    for (let i = 0; i + 1 < st.punkte.length; i++) {
      const a = st.punkte[i], c = st.punkte[i + 1];
      const l = abstand(a, c);
      if (l < 0.1) continue;
      beleg.add(rechteck({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }, l + b, b + 1, Math.atan2(c.y - a.y, c.x - a.x)));
    }
  }
  for (const b of s.bauten) { const art = BAUTEN[b.typ]; beleg.add(rechteck(b, art.b + 4, art.h + 4, b.dreh ?? 0)); }
  for (const m of s.mauern) for (let i = 0; i < m.length; i++) {
    const a = m[i], c = m[(i + 1) % m.length], l = abstand(a, c);
    if (l > 0.1) beleg.add(rechteck({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }, l + 4, 5, Math.atan2(c.y - a.y, c.x - a.x)));
  }

  const ohneHaeuser = new Set(["autobahn", "bahn", "aquaedukt", "fernstrasse"]);
  for (const st of s.strassen) {
    const sb = STRASSEN[st.art].breite;
    const fern = st.art === "fernstrasse";
    if (ohneHaeuser.has(st.art) && !fern) continue;
    for (let i = 0; i + 1 < st.punkte.length; i++) {
      const a = st.punkte[i], c = st.punkte[i + 1];
      const l = abstand(a, c);
      if (l < 4) continue;
      const ux = (c.x - a.x) / l, uy = (c.y - a.y) / l;
      const w = Math.atan2(uy, ux);
      for (const seite of [1, -1]) {
        let t = z() * 4;
        while (t < l) {
          const m0 = { x: a.x + ux * t, y: a.y + uy * t };
          const probe = { x: m0.x - uy * seite * (sb / 2 + 8), y: m0.y + ux * seite * (sb / 2 + 8) };
          const zt = zoneBei(s, probe) ?? (fern ? null : standardZone(s, probe));
          // Fernstraßen bekommen nur innerhalb eines Viertels Häuser
          const art: HausArt | null = zt ? ZONEN[zt].haus : null;
          if (!art || !zt) { t += 20; continue; }
          const hb = zwischen(z, art.breite), ht = zwischen(z, art.tiefe);
          const ab = sb / 2 + 1.5 + (art.abseits ?? 0);
          const mitte = { x: m0.x + ux * hb / 2 - uy * seite * (ab + ht / 2), y: m0.y + uy * hb / 2 + ux * seite * (ab + ht / 2) };
          const ecken = rechteck(mitte, hb, ht, w);
          if (!ecken.some(e => istWasser(g, e.x, e.y)) && mitte.x > 0 && mitte.y > 0 && mitte.x < g.breite && mitte.y < g.breite && beleg.frei(ecken)) {
            beleg.add(ecken);
            aus.push({ ecken, c: mitte, hoehe: zwischen(z, art.hoehe), dach: art.dach, zone: zt });
          }
          t += hb + art.luecke + 0.5;
        }
      }
    }
  }
  return aus;
}
