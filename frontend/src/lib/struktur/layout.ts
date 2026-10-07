/**
 * Koordinaten fürs Zeichnen — in zwei Anordnungen:
 *
 *   `legeGerade`  die Schulform: die Hauptkette liegt waagerecht auf einer
 *                 Linie, Abzweigungen gehen senkrecht nach oben oder unten.
 *                 Alle Atome sitzen auf einem Gitter, deshalb kann sich
 *                 nichts überdecken.
 *   `lege`        die Winkelform: Zickzack mit 120°, wie die Bindungen
 *                 wirklich stehen. Zeigt die Geometrie, wird aber schnell
 *                 unübersichtlich.
 *
 * Ringe liegen in beiden Fällen als regelmäßiges Vieleck — ein Sechsring
 * lässt sich nicht auf eine Linie legen.
 *
 * Gerechnet wird in »Bindungslängen«; die Größe in Pixeln entscheidet erst
 * das Bauteil.
 */
import { nachbarn, type Molekuel } from "./molekuel";

export type Punkt = { x: number; y: number };
export type Lage = { punkte: Punkt[]; breite: number; hoehe: number };

/** Zickzack: 30° nach oben, 30° nach unten — der Winkel an jedem C ist 120°. */
const DX = Math.cos(Math.PI / 6);
const DY = Math.sin(Math.PI / 6);

/** Die Atome der Hauptkette, nach ihrer Nummer. */
const hauptkette = (m: Molekuel): number[] =>
  m.atome.map((a, i) => ({ a, i })).filter(x => x.a.kette !== undefined)
    .sort((x, y) => x.a.kette! - y.a.kette!).map(x => x.i);

/** Vier Richtungen auf dem Gitter: oben, unten, rechts, links. */
const GITTER: Punkt[] = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];

/**
 * Schulform: Hauptkette waagerecht, Abzweigungen senkrecht.
 *
 * Jedes Atom bekommt einen eigenen Gitterplatz — ein belegter Platz wird nie
 * ein zweites Mal vergeben, deshalb kann sich nichts überdecken. Ein Rest
 * wächst in die Richtung weiter, in die er begonnen hat: der zweite
 * Kohlenstoff einer Ethylgruppe steht also über dem ersten, nicht daneben.
 */
export function legeGerade(m: Molekuel): Lage {
  if (m.ring.length >= 3) return lege(m); // Ringe bleiben Vielecke

  const p: (Punkt | null)[] = m.atome.map(() => null);
  const belegt = new Set<string>();
  const schluessel = (q: Punkt) => `${Math.round(q.x)},${Math.round(q.y)}`;
  const setze = (i: number, q: Punkt) => { p[i] = q; belegt.add(schluessel(q)); };
  /** Womit das Atom gesetzt wurde — Reste wachsen so geradeaus weiter. */
  const herkunft: (Punkt | null)[] = m.atome.map(() => null);

  hauptkette(m).forEach((i, k) => setze(i, { x: k, y: 0 }));

  for (let runde = 0; runde < m.atome.length; runde++) {
    let offen = false;
    for (let i = 0; i < m.atome.length; i++) {
      if (p[i]) continue;
      const anker = nachbarn(m, i).find(n => p[n]);
      if (anker === undefined) { offen = true; continue; }
      const a = p[anker]!;
      // Erst weiter in der bisherigen Richtung, dann nach oben, unten, zur Seite.
      const weiter = herkunft[anker];
      const richtungen = weiter ? [weiter, ...GITTER] : GITTER;
      const frei = richtungen.find(d => !belegt.has(schluessel({ x: a.x + d.x, y: a.y + d.y })));
      // Alles dicht? Dann weiter draußen weitersuchen, statt aufeinanderzusetzen.
      const d = frei ?? GITTER.map(g => ({ x: g.x * 2, y: g.y * 2 }))
        .find(g => !belegt.has(schluessel({ x: a.x + g.x, y: a.y + g.y }))) ?? GITTER[0];
      setze(i, { x: a.x + d.x, y: a.y + d.y });
      herkunft[i] = { x: Math.sign(d.x), y: Math.sign(d.y) };
    }
    if (!offen) break;
  }

  return rahme(p.map(q => q ?? { x: 0, y: 0 }));
}

/** Verschiebt alles in den positiven Bereich und misst die Ausdehnung. */
function rahme(punkte: Punkt[]): Lage {
  const xs = punkte.map(q => q.x), ys = punkte.map(q => q.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return {
    punkte: punkte.map(q => ({ x: q.x - minX, y: q.y - minY })),
    breite: Math.max(...xs) - minX,
    hoehe: Math.max(...ys) - minY,
  };
}

export function lege(m: Molekuel): Lage {
  const p: (Punkt | null)[] = m.atome.map(() => null);

  if (m.ring.length >= 3) {
    // Ring als regelmäßiges Vieleck, erste Ecke oben: beim Sechseck ergibt das
    // die übliche Lage mit je einer Ecke oben und unten.
    const n = m.ring.length;
    const r = 0.5 / Math.sin(Math.PI / n);
    m.ring.forEach((idx, i) => {
      const w = (2 * Math.PI * i) / n - Math.PI / 2;
      p[idx] = { x: r * Math.cos(w), y: r * Math.sin(w) };
    });
  } else {
    // Offene Kette im Zickzack.
    hauptkette(m).forEach((i, k) => { p[i] = { x: k * DX, y: k % 2 ? DY : 0 }; });
  }

  // Alles Übrige hängt an einem schon gelegten Atom. Mehrfach durchgehen,
  // weil Reste selbst wieder Ketten sind (Propyl hängt am Propyl-Anfang).
  for (let runde = 0; runde < m.atome.length; runde++) {
    let offen = false;
    for (let i = 0; i < m.atome.length; i++) {
      if (p[i]) continue;
      const anker = nachbarn(m, i).find(n => p[n]);
      if (anker === undefined) { offen = true; continue; }
      p[i] = neuerPunkt(m, p, i, anker);
    }
    if (!offen) break;
  }
  // Was jetzt noch fehlt, hängt an nichts — kommt nicht vor, schadet aber auch nicht.
  return rahme(p.map(x => x ?? { x: 0, y: 0 }));
}

/**
 * Setzt ein Atom neben seinen Anker — in die größte Lücke zwischen dessen
 * schon vorhandenen Bindungen.
 *
 * Entscheidend ist der Winkel, nicht der Abstand: ein C mit zwei Bindungen
 * soll die dritte in die Winkelhalbierende der großen Lücke bekommen (also
 * rund 120°), nicht irgendwohin, wo zufällig Platz ist. Der Abstand zu den
 * übrigen Atomen entscheidet nur bei gleich großen Lücken.
 */
function neuerPunkt(m: Molekuel, p: (Punkt | null)[], i: number, anker: number): Punkt {
  const a = p[anker]!;
  const alle = nachbarn(m, anker);
  const belegt = alle
    .flatMap(n => (p[n] && n !== i ? [Math.atan2(p[n]!.y - a.y, p[n]!.x - a.x)] : []));
  const andere = p.filter((q): q is Punkt => q !== null && q !== a);

  // Der Zielwinkel richtet sich danach, wie viele Bindungen das Ankeratom am
  // Ende hat: bei dreien 120°, bei vieren 90°. Würde man nur die größte Lücke
  // nehmen, säße die zweite Bindung gegenüber der ersten (180°) — dann bleiben
  // für die dritte nur noch 90°.
  const ideal = (2 * Math.PI) / Math.max(2, alle.length);

  const richtung = (w: number): Punkt => ({ x: a.x + Math.cos(w), y: a.y + Math.sin(w) });
  const abstandZu = (q: Punkt): number =>
    andere.length ? Math.min(...andere.map(r => Math.hypot(r.x - q.x, r.y - q.y))) : Infinity;
  const luecke = (w: number): number =>
    belegt.length
      ? Math.min(...belegt.map(b => Math.abs(Math.atan2(Math.sin(w - b), Math.cos(w - b)))))
      : Math.PI;

  if (!belegt.length) return richtung(0);

  // Zuerst die Winkel genau einen Idealschritt neben einer vorhandenen Bindung.
  const kandidaten = belegt.flatMap(b => [b + ideal, b - ideal]).filter(w => luecke(w) > ideal - 0.12);
  if (kandidaten.length) {
    return richtung(kandidaten.reduce((best, w) => (abstandZu(richtung(w)) > abstandZu(richtung(best)) ? w : best)));
  }

  // Sonst: die größte Lücke, die noch da ist.
  let beste = 0, bestLuecke = -1;
  for (let k = 0; k < 72; k++) {
    const w = (2 * Math.PI * k) / 72;
    if (luecke(w) > bestLuecke) { bestLuecke = luecke(w); beste = w; }
  }
  return richtung(beste);
}
