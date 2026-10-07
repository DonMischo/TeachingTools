/**
 * Räumliche Koordinaten für das Kugel-Stab-Modell.
 *
 * Die Flächenformeln lassen die Winkel weg; hier sind sie der Punkt. Welche
 * Form ein Atom hat, folgt aus der Zahl seiner Elektronenwolken — bindende
 * wie freie (VSEPR, Valenzschalen-Elektronenpaar-Abstoßung):
 *
 *   4 Wolken  Tetraeder   109,5°   gesättigtes C, O im Wasser, N im Ammoniak
 *   3 Wolken  Dreieck     120°     C an einer Doppelbindung
 *   2 Wolken  Gerade      180°     C an einer Dreifachbindung
 *
 * Eine Doppel- oder Dreifachbindung zählt als **eine** Wolke — deshalb ist
 * Ethen flach und Ethin gerade.
 *
 * Wasserstoff steht hier als eigenes Atom da: im Modell kann man ihn nicht
 * weglassen. Gerechnet wird in Ångström (1 Å = 0,1 nm).
 */
import { hZahl, nachbarn, paare, type Molekuel } from "./molekuel";

export type Vektor = { x: number; y: number; z: number };

export type RaumAtom = {
  el: string;
  pos: Vektor;
  /** Index im ursprünglichen Molekül; die ergänzten H haben keinen. */
  quelle?: number;
};

export type RaumBindung = { a: number; b: number; grad: 1 | 2 | 3 };

export type Raummodell = {
  atome: RaumAtom[];
  bindungen: RaumBindung[];
};

/** Bindungslängen in Ångström, nach Bindungspartnern und Grad. */
const LAENGEN: Record<string, number> = {
  "C-C": 1.54, "C=C": 1.34, "C#C": 1.20,
  "C-H": 1.09, "O-H": 0.96, "N-H": 1.01, "S-H": 1.34,
  "C-O": 1.43, "C=O": 1.23, "C-N": 1.47, "C=N": 1.28, "C#N": 1.16,
  "C-F": 1.35, "C-Cl": 1.77, "C-Br": 1.94, "C-I": 2.14,
  "N-O": 1.40, "N=O": 1.21, "O-O": 1.48,
};

const GRADZEICHEN = { 1: "-", 2: "=", 3: "#" } as const;

export function bindungslaenge(a: string, b: string, grad: 1 | 2 | 3): number {
  const z = GRADZEICHEN[grad];
  return LAENGEN[`${a}${z}${b}`] ?? LAENGEN[`${b}${z}${a}`] ?? (grad === 1 ? 1.5 : grad === 2 ? 1.3 : 1.2);
}

/** Radius der Kugel im Modell (willkürlich klein gehalten, damit Stäbe sichtbar bleiben). */
export const RADIUS: Record<string, number> = {
  H: 0.27, C: 0.40, N: 0.39, O: 0.38, S: 0.46, P: 0.46,
  F: 0.33, Cl: 0.42, Br: 0.47, I: 0.52,
};

/** CPK-Farben, wie in der Gleichungswaage — nur C und H abweichend fürs Modell. */
export const RAUMFARBE: Record<string, string> = {
  H: "#f3f4f6", C: "#404654", N: "#3050f8", O: "#ff2d2d", S: "#e8d21c",
  P: "#ff8000", F: "#7ecb45", Cl: "#3bc93b", Br: "#a62929", I: "#940094",
};

const laenge = (v: Vektor) => Math.hypot(v.x, v.y, v.z);
const mal = (v: Vektor, s: number): Vektor => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const plus = (a: Vektor, b: Vektor): Vektor => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const minus = (a: Vektor, b: Vektor): Vektor => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const kreuz = (a: Vektor, b: Vektor): Vektor => ({
  x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x,
});
const einheit = (v: Vektor): Vektor => { const l = laenge(v) || 1; return mal(v, 1 / l); };

/** Irgendein Vektor senkrecht zu v. */
function senkrecht(v: Vektor): Vektor {
  const hilf: Vektor = Math.abs(v.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  return einheit(kreuz(v, hilf));
}

/**
 * Die Richtungen um ein Atom, wenn eine davon schon feststeht.
 *
 * `rein` zeigt vom Atom zum Nachbarn, von dem es gesetzt wurde. Die übrigen
 * verteilen sich auf dem Kegel um die Gegenrichtung — bei vier Wolken mit
 * 109,5°, bei dreien in einer Ebene mit 120°, bei zweien geradeaus.
 *
 * `normale` steht senkrecht auf der Ebene, in der das Atom liegen soll. Sie
 * wandert von Bindung zu Bindung weiter: nur so liegen beide Kohlenstoffe
 * eines Alkens mit allen vier H in **einer** Ebene, und nur so bleibt der
 * Benzolring flach.
 */
function richtungen(wolken: number, rein: Vektor | null, normale: Vektor | null): Vektor[] {
  if (!rein) {
    // Erstes Atom: feste Ausgangslage, damit das Bild reproduzierbar ist.
    if (wolken >= 4) {
      const t = 1 / Math.sqrt(3);
      return [
        { x: t, y: t, z: t }, { x: t, y: -t, z: -t },
        { x: -t, y: t, z: -t }, { x: -t, y: -t, z: t },
      ];
    }
    if (wolken === 3) {
      return [0, 120, 240].map(g => ({
        x: Math.cos((g * Math.PI) / 180), y: Math.sin((g * Math.PI) / 180), z: 0,
      }));
    }
    return [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }];
  }

  const achse = einheit(mal(rein, -1)); // vom Nachbarn weg
  if (wolken <= 2) return [achse];

  // Winkel zur Achse: 180° − Bindungswinkel.
  const winkel = wolken >= 4 ? (109.47 * Math.PI) / 180 : (120 * Math.PI) / 180;
  // In der Ebene senkrecht zur Achse — sofern die Normale nicht selbst
  // entlang der Achse zeigt, dann ist jede Richtung gleich gut.
  const quer = normale ? kreuz(normale, achse) : null;
  const u = quer && laenge(quer) > 0.15 ? einheit(quer) : senkrecht(achse);
  const v = einheit(kreuz(achse, u));

  // Die übrigen Richtungen liegen auf einem Kegel um die Achse und sind darauf
  // gleichmäßig verteilt. Bei drei Wolken sind es zwei gegenüberliegende —
  // zusammen mit der Achse ergibt das die Ebene, in der ein Alken flach liegt.
  const anzahl = wolken - 1;
  return Array.from({ length: anzahl }, (_, k) => {
    const phi = (2 * Math.PI * k) / anzahl;
    return einheit(plus(
      mal(achse, -Math.cos(winkel)),
      mal(plus(mal(u, Math.cos(phi)), mal(v, Math.sin(phi))), Math.sin(winkel)),
    ));
  });
}

/** Elektronenwolken um ein Atom: Nachbarn (Mehrfachbindung zählt einfach) plus freie Paare. */
function wolkenZahl(m: Molekuel, i: number): number {
  return nachbarn(m, i).length + hZahl(m, i) + Math.round(paare(m, i));
}

/**
 * Baut das räumliche Modell. Ringe werden zuerst gelegt — als ebenes Vieleck,
 * wenn der Ring Doppelbindungen trägt (Benzol ist flach), sonst leicht
 * gewellt wie der Sessel des Cyclohexans.
 */
export function baueRaum(m: Molekuel): Raummodell {
  const atome: RaumAtom[] = m.atome.map(a => ({ el: a.el, pos: { x: 0, y: 0, z: 0 } }));
  m.atome.forEach((_, i) => { atome[i].quelle = i; });
  const gesetzt = m.atome.map(() => false);
  // Die Ebene, in der ein Atom liegen soll — als Normale, von Bindung zu
  // Bindung weitergereicht. Zu Beginn die xy-Ebene.
  const normalen: (Vektor | null)[] = m.atome.map(() => ({ x: 0, y: 0, z: 1 }));
  const bindungen: RaumBindung[] = m.bindungen.map(b => ({ a: b.a, b: b.b, grad: b.grad }));

  if (m.ring.length >= 3) {
    const n = m.ring.length;
    const flach = m.bindungen.some(b =>
      b.grad > 1 && m.ring.includes(b.a) && m.ring.includes(b.b));
    // Radius so, dass die Ringbindungen etwa 1,4 Å lang sind.
    const r = (flach ? 1.40 : 1.54) / (2 * Math.sin(Math.PI / n));
    m.ring.forEach((idx, k) => {
      const w = (2 * Math.PI * k) / n;
      atome[idx].pos = {
        x: r * Math.cos(w), y: r * Math.sin(w),
        z: flach ? 0 : (k % 2 ? 0.25 : -0.25),
      };
      gesetzt[idx] = true;
    });
  } else {
    gesetzt[0] = true;
  }

  // Von den gesetzten Atomen aus nach außen wachsen.
  const schlange = m.atome.map((_, i) => i).filter(i => gesetzt[i]);
  for (let kopf = 0; kopf < schlange.length; kopf++) {
    const i = schlange[kopf];
    const offen = nachbarn(m, i).filter(n => !gesetzt[n]);
    const h = hZahl(m, i);
    if (!offen.length && !h) continue;

    const schonDa = nachbarn(m, i).filter(n => gesetzt[n]);
    const rein = schonDa.length ? einheit(minus(atome[schonDa[0]].pos, atome[i].pos)) : null;
    // Zwei bekannte Nachbarn spannen die Ebene selbst auf (Ringatome);
    // sonst gilt die vom Nachbarn geerbte.
    const normale = schonDa.length > 1
      ? einheit(kreuz(minus(atome[schonDa[0]].pos, atome[i].pos), minus(atome[schonDa[1]].pos, atome[i].pos)))
      : normalen[i];

    let frei = richtungen(wolkenZahl(m, i), rein, normale);
    // Schon besetzte Richtungen (weitere bekannte Nachbarn) nicht neu vergeben.
    for (const n of schonDa.slice(1)) {
      const weg = einheit(minus(atome[n].pos, atome[i].pos));
      let beste = 0, naechst = -2;
      frei.forEach((d, k) => {
        const p = d.x * weg.x + d.y * weg.y + d.z * weg.z;
        if (p > naechst) { naechst = p; beste = k; }
      });
      frei = frei.filter((_, k) => k !== beste);
    }

    let k = 0;
    for (const n of offen) {
      const grad = m.bindungen.find(b =>
        (b.a === i && b.b === n) || (b.a === n && b.b === i))!.grad;
      const d = frei[k++] ?? senkrecht(rein ?? { x: 0, y: 0, z: 1 });
      atome[n].pos = plus(atome[i].pos, mal(d, bindungslaenge(m.atome[i].el, m.atome[n].el, grad)));
      gesetzt[n] = true;
      normalen[n] = normale;
      schlange.push(n);
    }
    for (let j = 0; j < h; j++) {
      const d = frei[k++] ?? senkrecht(rein ?? { x: 0, y: 0, z: 1 });
      atome.push({
        el: "H",
        pos: plus(atome[i].pos, mal(d, bindungslaenge(m.atome[i].el, "H", 1))),
      });
      bindungen.push({ a: i, b: atome.length - 1, grad: 1 });
    }
  }

  // Schwerpunkt in den Ursprung, damit sich das Modell um seine Mitte dreht.
  const mitte = atome.reduce((s, a) => plus(s, a.pos), { x: 0, y: 0, z: 0 });
  const versatz = mal(mitte, -1 / Math.max(1, atome.length));
  for (const a of atome) a.pos = plus(a.pos, versatz);

  return { atome, bindungen };
}

/** Der Bindungswinkel a–b–c in Grad — fürs Prüfen und zum Anzeigen. */
export function winkel(modell: Raummodell, a: number, b: number, c: number): number {
  const u = einheit(minus(modell.atome[a].pos, modell.atome[b].pos));
  const v = einheit(minus(modell.atome[c].pos, modell.atome[b].pos));
  return (Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y + u.z * v.z))) * 180) / Math.PI;
}
