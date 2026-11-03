/**
 * Netz (Abwicklung) der Körper als reine Rechnung, stufenlos zwischen
 * flach (t = 0) und zugeklappt (t = 1). Die 3D-Ansicht malt diese Punkte,
 * das Schrägbild-Netz nimmt den flachen Zustand.
 *
 * Polyeder: Die Grundfläche bleibt liegen, alle anderen Flächen hängen wie ein
 * Baum an ihr und klappen um ihre Scharnierkante. Zylinder und Kegel rollen
 * ihren Mantel ab; die Kreise klappen an einem Punkt des Mantels heraus.
 */
import { add, dot, einheit, kantenVon, kreuz, mal, normale, sub, type Polyeder, type Rund, type V3 } from "@/lib/koerper";

/** Drehung um die Achse durch `a` mit Richtung `u` (Länge 1) um `w` (Bogenmaß), nach Rodrigues. */
type Abb = (p: V3) => V3;
export function drehung(a: V3, u: V3, w: number): Abb {
  const c = Math.cos(w), s = Math.sin(w);
  return p => {
    const v = sub(p, a);
    const r = add(add(mal(v, c), mal(kreuz(u, v), s)), mal(u, dot(u, v) * (1 - c)));
    return add(a, r);
  };
}

export type NetzFlaeche = { teil: string; pts: V3[] };

/** Polyeder-Netz: Flächen mit ihren Punkten beim Klappstand t. */
export function faltePolyeder(p: Polyeder, t: number): NetzFlaeche[] {
  const kanten = kantenVon(p);
  const wurzel = Math.max(0, p.flaechen.findIndex(f => f.teil === "G"));
  const abb: (Abb | null)[] = p.flaechen.map(() => null);
  abb[wurzel] = q => q;
  const n = p.flaechen.map(f => normale(f.idx.map(i => p.ecken[i])));
  const reihe = [wurzel];
  while (reihe.length) {
    const eltern = reihe.shift()!;
    for (const k of kanten) {
      if (!k.flaechen.includes(eltern)) continue;
      const kind = k.flaechen.find(f => f !== eltern);
      if (kind === undefined || abb[kind]) continue;
      // Um die gemeinsame Kante so weit drehen, bis das Kind neben dem Elternteil in dessen Ebene liegt.
      const a = p.ecken[k.a], u = einheit(sub(p.ecken[k.b], a));
      const delta = Math.acos(Math.max(-1, Math.min(1, dot(n[eltern], n[kind]))));
      const probe = drehung([0, 0, 0], u, delta)(n[kind]);
      const vz = dot(probe, n[eltern]) > 0.999 ? 1 : -1;
      const dreh = drehung(a, u, vz * delta * (1 - t));
      const oben = abb[eltern]!;
      abb[kind] = q => oben(dreh(q));
      reihe.push(kind);
    }
  }
  return p.flaechen.map((f, i) => ({ teil: f.teil, pts: f.idx.map(j => (abb[i] ?? (q => q))(p.ecken[j])) }));
}

export type RundNetz = {
  /** Mantel als Gitter: Zeilen von unten nach oben, je Zeile die Punkte quer über die Breite. */
  mantel: V3[][];
  kreise: NetzFlaeche[];
  /** Ebene des flachen Netzes: Ursprung und zwei Richtungen (für die 2D-Zeichnung) */
  ebene: { o: V3; x: V3; y: V3 };
};

const SCHRITTE = 64;

function kreis(m: V3, r: number, abb: Abb): V3[] {
  return Array.from({ length: SCHRITTE }, (_, i) => {
    const w = (i / SCHRITTE) * 2 * Math.PI;
    return abb([m[0] + r * Math.sin(w), m[1], m[2] + r * Math.cos(w)]);
  });
}

/** Zylinder (r1 = r2), Kegel (r2 = 0) und Kegelstumpf beim Klappstand t. Die vordere Mantellinie bleibt stehen. */
export function rolleRund(k: Rund, t: number): RundNetz {
  const { r1, r2, h } = k;
  const zu = Math.max(1e-4, t);
  if (Math.abs(r1 - r2) < 1e-9) {
    // Zylinder: das Mantelblatt wird mit dem Krümmungsradius r/t gerollt.
    const R = r1 / zu;
    const zeile = (y: number) => Array.from({ length: SCHRITTE + 1 }, (_, i) => {
      const bogen = (i / SCHRITTE - 0.5) * 2 * Math.PI * r1, w = bogen / R;
      return [R * Math.sin(w), y, r1 - R * (1 - Math.cos(w))] as V3;
    });
    const ab = (1 - t) * Math.PI / 2;
    return {
      mantel: [zeile(0), zeile(h)],
      kreise: [
        { teil: "G", pts: kreis([0, 0, 0], r1, drehung([0, 0, r1], [-1, 0, 0], ab)) },
        { teil: "D", pts: kreis([0, h, 0], r1, drehung([0, h, r1], [1, 0, 0], ab)) },
      ],
      ebene: { o: [0, 0, r1], x: [1, 0, 0], y: [0, -1, 0] },
    };
  }
  // Kegel und Stumpf: Spitze A (beim Stumpf gedacht), vordere Mantellinie von A nach B bleibt fest.
  const H = r2 > 0 ? h * r1 / (r1 - r2) : h;
  const A: V3 = [0, H, 0], B: V3 = [0, 0, r1];
  const S = Math.hypot(H, r1), sOben = S * r2 / r1;
  const g = einheit(sub(B, A));
  const n0 = einheit([0, r1, H]);
  const e: V3 = [1, 0, 0];
  const a0 = Math.asin(r1 / S);
  const alpha = a0 + (1 - t) * (Math.PI / 2 - a0);
  const achse = einheit(add(mal(g, Math.cos(alpha)), mal(n0, -Math.sin(alpha))));
  const m = einheit(sub(g, mal(achse, Math.cos(alpha))));
  const phi = 2 * Math.PI * r1 / S;
  const punkt = (d: number, psi: number): V3 => {
    const th = psi / Math.sin(alpha);
    const rad = add(mal(m, Math.cos(th)), mal(e, Math.sin(th)));
    return add(A, mal(add(mal(achse, Math.cos(alpha)), mal(rad, Math.sin(alpha))), d));
  };
  const zeile = (d: number) => Array.from({ length: SCHRITTE + 1 }, (_, i) => punkt(d, (i / SCHRITTE - 0.5) * phi));
  // Grundkreis klappt an B um die Tangente e, bis er in der Ebene des Mantels jenseits von B liegt.
  const klapp = (P: V3, von: V3, nach: V3): Abb => {
    const w = Math.acos(Math.max(-1, Math.min(1, dot(von, nach))));
    const u = einheit(kreuz(von, nach));
    return drehung(P, laengeNull(u) ? e : u, w * (1 - t));
  };
  const kreise: NetzFlaeche[] = [{ teil: "G", pts: kreis([0, 0, 0], r1, klapp(B, [0, 0, -1], g)) }];
  if (r2 > 0) {
    const B2: V3 = [0, h, r2];
    kreise.push({ teil: "D", pts: kreis([0, h, 0], r2, klapp(B2, [0, 0, -1], mal(g, -1))) });
  }
  return { mantel: [zeile(S), zeile(sOben)], kreise, ebene: { o: A, x: e, y: g } };
}

const laengeNull = (u: V3) => Math.abs(u[0]) + Math.abs(u[1]) + Math.abs(u[2]) < 1e-9;
