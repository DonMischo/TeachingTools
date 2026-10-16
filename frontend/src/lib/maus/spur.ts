/**
 * »Spur« — ein Tier mit gedrückter Maustaste einen Weg entlangziehen.
 *
 * Ein Weg ist eine Folge von Punkten im gleichen Abstand (Zeichenfläche
 * 800×400). Der Fortschritt ist der Index des weitesten erreichten Punkts.
 *
 * Abkürzen geht nicht: gesucht wird der nächste Wegpunkt nur in einem Fenster
 * um den bisherigen Fortschritt. Wer bei den Schleifen quer über die Kreuzung
 * zieht, landet zwar *nahe am Weg*, aber nicht nahe an der Stelle, an der er
 * gerade ist — und gilt als draußen.
 *
 * Eine schnelle Bewegung liefert Mauspunkte weit auseinander. Deshalb wird die
 * Strecke zwischen zwei Ereignissen in kleine Schritte zerlegt; sonst spränge
 * ein zügiges Kind über das Suchfenster hinaus und flöge ungerecht raus.
 */

export type Punkt = { x: number; y: number };
export type Spur = { id: string; titel: string; halbbreite: number; punkte: Punkt[] };

export const ABSTAND = 5;
/** Suchfenster in Wegpunkten — 60 Einheiten vor und zurück. */
export const SUCHFENSTER = 12;
/** So nah am Ende gilt der Weg als geschafft. */
export const ZIEL_NAEHE = 3;
export const ABSCHNITTE = 4;

/** Einen Linienzug in gleich lange Stücke teilen. */
export function abtasten(roh: Punkt[], abstand = ABSTAND): Punkt[] {
  if (roh.length === 0) return [];
  const aus: Punkt[] = [roh[0]];
  let rest = 0;
  for (let i = 1; i < roh.length; i++) {
    const a = roh[i - 1];
    const b = roh[i];
    const laenge = Math.hypot(b.x - a.x, b.y - a.y);
    let d = abstand - rest;
    while (d <= laenge) {
      const t = d / laenge;
      aus.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      d += abstand;
    }
    rest = laenge - (d - abstand);
  }
  const letzter = roh[roh.length - 1];
  const zuletzt = aus[aus.length - 1];
  if (Math.hypot(letzter.x - zuletzt.x, letzter.y - zuletzt.y) > abstand / 2) aus.push(letzter);
  return aus;
}

function kurve(f: (t: number) => Punkt, n = 600): Punkt[] {
  return abtasten(Array.from({ length: n + 1 }, (_, i) => f(i / n)));
}

export const SPUREN: Spur[] = [
  {
    id: "gerade", titel: "Gerade Straße", halbbreite: 40,
    punkte: abtasten([{ x: 70, y: 200 }, { x: 730, y: 200 }]),
  },
  {
    id: "huegel", titel: "Über den Hügel", halbbreite: 34,
    punkte: kurve(t => ({ x: 70 + 660 * t, y: 200 - 110 * Math.sin(2 * Math.PI * t) })),
  },
  {
    id: "zickzack", titel: "Zickzack", halbbreite: 28,
    punkte: abtasten([
      { x: 70, y: 320 }, { x: 235, y: 90 }, { x: 400, y: 320 }, { x: 565, y: 90 }, { x: 730, y: 320 },
    ]),
  },
  {
    // Eine Radkurve mit Schlaufen: x = rθ − d·sin θ mit d > r.
    id: "schleifen", titel: "Zwei Schleifen", halbbreite: 24,
    punkte: kurve(t => {
      const th = t * 4 * Math.PI;
      return { x: 90 + 49 * th - 80 * Math.sin(th), y: 200 + 110 * Math.cos(th) };
    }, 1200),
  },
];

/** Der Pfad als SVG-`d`. */
export function pfad(punkte: Punkt[]): string {
  return punkte.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

/**
 * Den Zeiger von `von` nach `nach` bewegen. Liefert den neuen Fortschritt —
 * oder `draussen`, sobald ein Zwischenschritt den Weg verlässt.
 */
export function bewege(
  punkte: Punkt[], halbbreite: number, index: number, von: Punkt, nach: Punkt,
): { index: number; draussen: boolean } {
  const schritte = Math.max(1, Math.ceil(Math.hypot(nach.x - von.x, nach.y - von.y) / ABSTAND));
  for (let s = 1; s <= schritte; s++) {
    const p = { x: von.x + (nach.x - von.x) * (s / schritte), y: von.y + (nach.y - von.y) * (s / schritte) };
    const lo = Math.max(0, index - SUCHFENSTER);
    const hi = Math.min(punkte.length - 1, index + SUCHFENSTER);
    let bester = index;
    let dist = Infinity;
    for (let j = lo; j <= hi; j++) {
      const d = Math.hypot(punkte[j].x - p.x, punkte[j].y - p.y);
      if (d < dist) { dist = d; bester = j; }
    }
    if (dist > halbbreite) return { index, draussen: true };
    index = Math.max(index, bester);
  }
  return { index, draussen: false };
}

export function geschafft(punkte: Punkt[], index: number): boolean {
  return index >= punkte.length - 1 - ZIEL_NAEHE;
}

/** Der letzte erreichte Rastpunkt — dorthin springt das Tier nach dem Rausfliegen. */
export function rastpunkt(punkte: Punkt[], index: number): number {
  const stueck = Math.floor((punkte.length - 1) / ABSCHNITTE);
  return Math.floor(index / stueck) * stueck;
}

/** Darf man das Tier hier greifen? Etwas großzügiger als der Weg selbst. */
export function greifbar(tier: Punkt, zeiger: Punkt, halbbreite: number): boolean {
  return Math.hypot(tier.x - zeiger.x, tier.y - zeiger.y) <= halbbreite + 20;
}

/** 1000 je Weg, Abzug fürs Rausfliegen und Loslassen, geschafft ist geschafft. */
export function spurPunkte(raus: number, losgelassen: number): number {
  return Math.max(200, 1000 - 150 * raus - 100 * losgelassen);
}
