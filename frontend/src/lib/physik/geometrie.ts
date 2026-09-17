/**
 * Wo die beweglichen Teile eines Geräts gerade sind.
 *
 * Die meisten Anschlüsse sitzen fest am Gerät und drehen sich höchstens mit
 * ihm. Bei einem Pendel ist das anders: der Körper wandert, und mit ihm der
 * Punkt, an dem man etwas anhängen kann. Beim Hebel schwenken die Arme, auf
 * der schiefen Ebene rutscht die Kiste den Hang hinunter. Zeichnen, Anfassen
 * und das Auffinden von Anschlüssen müssen dieselbe Geometrie benutzen, sonst
 * hängt ein Massestück sichtbar neben dem Haken.
 *
 * Deshalb steht die Geometrie hier in der Bibliothek und nicht bei den
 * Zeichenroutinen: die Rechenwerke brauchen sie genauso.
 */
import type { Geraet, Punkt } from "./typen";

/** Ruhelänge der Feder — die Länge, um die herum sie schwingt. */
export const FEDER_RUHE = 0.25;

/** Ein Pendelkörper wächst mit der Masse, aber nur langsam (dritte Wurzel). */
export const koerperRadius = (masse: number) => 0.012 + 0.025 * Math.cbrt(Math.max(0.001, masse));

/** Die beiden Enden des Hebelbalkens, mitgeneigt. */
export function hebelArmOrt(g: Geraet, seite: "links" | "rechts", q: number): Punkt {
  const arm = seite === "links" ? -(g.werte.armLinks ?? 0.3) : (g.werte.armRechts ?? 0.3);
  // q > 0 heißt: die rechte Seite ist unten.
  return { x: g.pos.x + arm * Math.cos(q), y: g.pos.y - arm * Math.sin(q) };
}

/** Oberes und unteres Ende der schiefen Ebene. */
export function hangEnden(g: Geraet): { oben: Punkt; unten: Punkt } {
  const laenge = Math.max(0.05, g.werte.laenge ?? 1);
  const winkel = g.werte.winkel ?? Math.PI / 6;
  const halbX = (laenge / 2) * Math.cos(winkel);
  const halbY = (laenge / 2) * Math.sin(winkel);
  return {
    oben: { x: g.pos.x - halbX, y: g.pos.y + halbY },
    unten: { x: g.pos.x + halbX, y: g.pos.y - halbY },
  };
}

/** Wo die Kiste auf dem Hang steht, `weg` Meter vom oberen Ende aus. */
export function hangOrt(g: Geraet, weg: number): Punkt {
  const { oben } = hangEnden(g);
  const winkel = g.werte.winkel ?? Math.PI / 6;
  return { x: oben.x + weg * Math.cos(winkel), y: oben.y - weg * Math.sin(winkel) };
}

/**
 * Wo der schwingende Körper gerade ist — in Weltkoordinaten.
 *
 * Ohne laufenden Zustand steht er an seiner Startauslenkung; so sieht man
 * schon beim Einstellen, wo er losgelassen wird.
 */
export function koerperOrt(g: Geraet, s: { q: number } | undefined): Punkt | null {
  if (g.typ === "fadenpendel") {
    const laenge = g.werte.laenge ?? 1;
    const winkel = s?.q ?? g.werte.startwinkel ?? 0;
    return { x: g.pos.x + laenge * Math.sin(winkel), y: g.pos.y - laenge * Math.cos(winkel) };
  }
  if (g.typ === "federpendel") {
    const auslenkung = s?.q ?? g.werte.startauslenkung ?? 0;
    return { x: g.pos.x, y: g.pos.y - (FEDER_RUHE + auslenkung) };
  }
  if (g.typ === "schiefeebene") {
    return hangOrt(g, s?.q ?? g.werte.startweg ?? 0);
  }
  return null;
}

/**
 * Der Startwert, der sich ergibt, wenn man den Körper an diesen Weltpunkt
 * zieht. Beim Fadenpendel der Winkel, beim Federpendel die Auslenkung, auf
 * der schiefen Ebene der Weg vom oberen Ende.
 */
export function startWertAus(g: Geraet, welt: Punkt): number | null {
  if (g.typ === "fadenpendel") return Math.atan2(welt.x - g.pos.x, g.pos.y - welt.y);
  if (g.typ === "federpendel") return g.pos.y - FEDER_RUHE - welt.y;
  if (g.typ === "schiefeebene") {
    // Auf den Hang projizieren: nur der Anteil längs der Bahn zählt.
    const { oben } = hangEnden(g);
    const winkel = g.werte.winkel ?? Math.PI / 6;
    return (welt.x - oben.x) * Math.cos(winkel) - (welt.y - oben.y) * Math.sin(winkel);
  }
  return null;
}

/**
 * Anschlüsse, die mit dem beweglichen Teil mitwandern — oder null, wenn der
 * Anschluss fest am Gerät sitzt und die übliche Rechnung gilt.
 */
export function beweglicherPortOrt(
  g: Geraet,
  portId: string,
  s: { q: number } | undefined,
): Punkt | null {
  if (g.typ === "stativ" && portId === "haken") return stativHaken(g);
  if (g.typ === "drehpunkt" && portId === "spitze") {
    return { x: g.pos.x, y: g.pos.y + Math.max(0.03, g.werte.hoehe ?? 0.1) / 2 };
  }
  // Die Probe wird länger, wenn man zieht — die Last hängt am gedehnten Ende.
  if (g.typ === "probe" && portId === "unten") {
    return { x: g.pos.x, y: g.pos.y - (g.werte.laenge ?? 0.2) - (s?.q ?? 0) };
  }
  // Bretter, Klötze und Murmeln sind so groß, wie man sie eingestellt hat —
  // ihre Ober- und Unterkante wandert mit.
  if (g.typ === "brett" || g.typ === "klotz" || g.typ === "kugel") {
    const vorzeichen = portId === "oese" ? 1 : portId === "unten" ? -1 : 0;
    if (vorzeichen !== 0) {
      const h = g.typ === "brett" ? Math.max(0.005, g.werte.dicke ?? 0.02)
        : g.typ === "klotz" ? Math.max(0.02, g.werte.hoehe ?? 0.12)
        : Math.max(0.006, g.werte.durchmesser ?? 0.02);
      return gedreht(g.pos, { x: 0, y: (vorzeichen * h) / 2 }, g.winkel ?? 0);
    }
  }
  // Ein- und Ausgang einer Röhre sitzen an den Enden ihrer Achse.
  if (g.typ === "rohr" || g.typ === "kruemmer") {
    const achse = rohrWaende(g).achse;
    if (portId === "ein") return gedreht(g.pos, achse[0], g.winkel ?? 0);
    if (portId === "aus") return gedreht(g.pos, achse[achse.length - 1], g.winkel ?? 0);
  }
  // Die Ladefläche liegt auf der Wanne, deren Höhe von der Länge abhängt.
  if (g.typ === "wagen" && portId === "oben") {
    return gedreht(g.pos, { x: 0, y: wagenMasse(g).hoehe / 2 }, g.winkel ?? 0);
  }
    if (portId === "koerper") return koerperOrt(g, s);
  if ((g.typ === "hebel" || g.typ === "waage") && (portId === "links" || portId === "rechts")) {
    return hebelArmOrt(g, portId, s?.q ?? g.werte.startneigung ?? 0);
  }
  return null;
}

/**
 * Die beiden Wände und die Achse einer Röhre — in Gerätekoordinaten.
 *
 * Gezeichnet und gerechnet wird aus derselben Beschreibung: die Werkbank malt
 * die Linienzüge, der Löser legt sie als Kettenformen an. Liefe beides
 * getrennt, rollte die Murmel sichtbar neben dem Rohr her.
 *
 * Der Krümmer biegt sich um einen Mittelpunkt, der senkrecht über dem Eingang
 * liegt; der Eingang selbst sitzt im Ursprung. Damit heißt »Biegeradius« genau
 * das, was auf dem Bauteil stünde, und ein Viertelkreis führt die Murmel um
 * genau eine Rohrbreite herum.
 */
export function rohrWaende(g: Geraet): { waende: [Punkt[], Punkt[]]; achse: Punkt[] } {
  const weite = Math.max(0.01, g.werte.weite ?? 0.05);

  if (g.typ === "rohr") {
    const l = Math.max(0.05, g.werte.laenge ?? 0.4);
    return {
      achse: [{ x: -l / 2, y: 0 }, { x: l / 2, y: 0 }],
      waende: [
        [{ x: -l / 2, y: -weite / 2 }, { x: l / 2, y: -weite / 2 }],
        [{ x: -l / 2, y: weite / 2 }, { x: l / 2, y: weite / 2 }],
      ],
    };
  }

  const r = Math.max(0.03, g.werte.radius ?? 0.25);
  const spanne = Math.max(0.1, g.werte.bogen ?? Math.PI / 2);
  // Genug Stützstellen, dass die Murmel keine Kante spürt: alle 15 Grad eine.
  const teile = Math.max(6, Math.ceil(spanne / (Math.PI / 12)));
  const bahn = (abstand: number) => Array.from({ length: teile + 1 }, (_, i) => {
    const w = -Math.PI / 2 + (spanne * i) / teile;
    return { x: abstand * Math.cos(w), y: r + abstand * Math.sin(w) };
  });
  return {
    achse: bahn(r),
    waende: [bahn(Math.max(0.005, r - weite / 2)), bahn(r + weite / 2)],
  };
}

/** Ein Rohr ist so breit, wie seine Wände reichen — mitgedreht. */
function rohrUmriss(g: Geraet): Umriss {
  const punkte = rohrWaende(g).waende.flat().map(p => gedreht(g.pos, p, g.winkel ?? 0));
  const xs = punkte.map(p => p.x), ys = punkte.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  return {
    mitte: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
    b: Math.max(0.03, x1 - x0),
    h: Math.max(0.03, y1 - y0),
    schonGedreht: true,
  };
}

/** Aufbau eines Versuchswagens: Wanne, Räder, Höhe über dem Boden. */
export function wagenMasse(g: Geraet) {
  const laenge = Math.max(0.06, g.werte.laenge ?? 0.16);
  const rad = Math.max(0.015, g.werte.radgroesse ?? 0.06);
  const hoehe = Math.max(0.025, laenge * 0.3);
  return {
    laenge, rad, hoehe,
    /** Höhe der Wannenmitte über dem Boden. */
    stand: rad / 2 + hoehe / 2,
    /** Wo die beiden Achsen sitzen, bezogen auf die Wannenmitte. */
    achsen: [-(laenge / 2 - rad / 2), laenge / 2 - rad / 2].map(x => ({ x, y: -hoehe / 2 })),
  };
}

// ── Was woran hängt ──────────────────────────────────────────────────────────

/**
 * Der Anschluss, mit dem ein Gerät *selbst* irgendwo eingehängt wird.
 *
 * Das ist der Unterschied zwischen einem Schaltplan und einem Vorbereitungs-
 * raum: ein Massestück, das man an einen Haken hängt, bleibt nicht liegen, wo
 * es lag, und bekommt eine Linie zum Haken gemalt — es *ist* dann dort.
 */
/** Woran ein Gerät das nächste trägt — die Gegenrichtung zu EIGENER_HAKEN. */
export const TRAEGER_PORT: Record<string, string> = {
  stativ: "haken",
  drehpunkt: "spitze",
  massestueck: "unten",
  kraftmesser: "unten",
  fadenpendel: "koerper",
  federpendel: "koerper",
  probe: "unten",
  flaschenzug: "last",
  brett: "unten",
  klotz: "unten",
  kugel: "unten",
  // Rohre werden aneinandergereiht: das nächste hängt am Ausgang des vorigen.
  rohr: "aus",
  kruemmer: "aus",
  wagen: "oben",
};

export const EIGENER_HAKEN: Record<string, string> = {
  massestueck: "oese",
  hebel: "achse",
  waage: "achse",
  fadenpendel: "aufhaengung",
  federpendel: "aufhaengung",
  kraftmesser: "oben",
  flaschenzug: "zug",
  brett: "oese",
  klotz: "oese",
  kugel: "oese",
  rohr: "ein",
  kruemmer: "ein",
};

/** Was ein Gerät auf der Werkbank einnimmt. */
export interface Umriss {
  mitte: Punkt;
  b: number;
  h: number;
  /**
   * Die Maße gelten bereits in der Weltlage und dürfen nicht noch einmal
   * gedreht werden. Das brauchen Geräte, die kein Rechteck sind — ein
   * Krümmer etwa, dessen Umriss aus seinen Wänden berechnet wird.
   */
  schonGedreht?: boolean;
}

/**
 * Umriss eines Geräts — das, was man anfassen kann.
 *
 * Angegeben wird das **ungedrehte** Gerät. Früher vertauschte diese Funktion
 * bei Vierteldrehung Breite und Höhe, damit der achsenparallele Treffertest
 * stimmte. Das ging nur bei genau 90° auf: bei 30° lag der Griff neben dem
 * Bild. Jetzt dreht der Treffertest den Finger ins Gerät hinein, und die
 * Zeichnung dreht die Leinwand — beide arbeiten mit demselben Maß.
 */
export function umriss(g: Geraet, standard: { b: number; h: number }): Umriss {
  if (g.typ === "stativ") {
    return { mitte: g.pos, b: 0.08, h: Math.max(0.1, g.werte.hoehe ?? 1.2) };
  }
  if (g.typ === "brett") {
    return {
      mitte: g.pos,
      b: Math.max(0.05, g.werte.laenge ?? 0.5),
      h: Math.max(0.005, g.werte.dicke ?? 0.02),
    };
  }
  if (g.typ === "klotz") {
    return {
      mitte: g.pos,
      b: Math.max(0.02, g.werte.breite ?? 0.12),
      h: Math.max(0.02, g.werte.hoehe ?? 0.12),
    };
  }
  if (g.typ === "kugel") {
    const d = Math.max(0.006, g.werte.durchmesser ?? 0.02);
    return { mitte: g.pos, b: d, h: d };
  }
  if (g.typ === "rohr" || g.typ === "kruemmer") return rohrUmriss(g);
  if (g.typ === "wagen") {
    const w = wagenMasse(g);
    return { mitte: g.pos, b: w.laenge, h: w.hoehe };
  }
  return { mitte: g.pos, b: standard.b, h: standard.h };
}

/**
 * Die Höhe, auf der ein Gerät stehen muss, damit es auf dem Boden aufsitzt —
 * oder null, wenn es frei schwebt. Ein Stativ, das in der Luft steht, ist kein
 * Stativ.
 */
export function bodenHoehe(g: Geraet): number | null {
  // Gedreht steht es nicht mehr auf dem Boden, sondern ragt zur Seite —
  // dann wird es auch nicht auf Bodenhöhe gezwungen.
  if (Math.abs(g.winkel ?? 0) > 0.01) return null;
  if (g.typ === "stativ") return Math.max(0.1, g.werte.hoehe ?? 1.2) / 2;
  if (g.typ === "drehpunkt") return Math.max(0.03, g.werte.hoehe ?? 0.1) / 2;
  if (g.typ === "schiefeebene") {
    const laenge = Math.max(0.05, g.werte.laenge ?? 1);
    return (laenge / 2) * Math.sin(g.werte.winkel ?? 0);
  }
  return null;
}

/** Einen Punkt am Gerät in die Welt drehen. */
export function gedreht(basis: Punkt, lokal: Punkt, winkel: number): Punkt {
  const c = Math.cos(winkel), s = Math.sin(winkel);
  return { x: basis.x + lokal.x * c - lokal.y * s, y: basis.y + lokal.x * s + lokal.y * c };
}

/**
 * Fuß, Kopf und Haken eines Stativs — mitgedreht.
 *
 * Gedreht ist es kein Ständer mehr, sondern ein Ausleger: damit lässt sich
 * etwas seitlich abspannen oder ein Pendel von der Seite aufhängen.
 */
export function stativTeile(g: Geraet): { fuss: Punkt; kopf: Punkt; haken: Punkt } {
  const h = Math.max(0.1, g.werte.hoehe ?? 1.2);
  const a = g.werte.armLaenge ?? 0.35;
  const w = g.winkel ?? 0;
  return {
    fuss: gedreht(g.pos, { x: 0, y: -h / 2 }, w),
    kopf: gedreht(g.pos, { x: 0, y: h / 2 }, w),
    haken: gedreht(g.pos, { x: a, y: h / 2 }, w),
  };
}

/**
 * Die Höhe, auf der ein frisch aus dem Schrank genommenes Gerät liegt.
 *
 * Auf dem Boden, nicht darüber: ein Gewicht, das erst herunterfällt, löst
 * einen Aufschlag aus und hinterlässt einen Marker, den niemand bestellt hat.
 */
export function ablageHoehe(typ: string, werte: Record<string, number>): number | null {
  if (typ === "massestueck") return koerperRadius(werte.masse ?? 0.1);
  if (typ === "kugel") return Math.max(0.006, werte.durchmesser ?? 0.02) / 2;
  if (typ === "klotz") return Math.max(0.02, werte.hoehe ?? 0.12) / 2;
  if (typ === "brett") return Math.max(0.005, werte.dicke ?? 0.02) / 2;
  if (typ === "wagen") {
    const rad = Math.max(0.015, werte.radgroesse ?? 0.06);
    return rad / 2 + Math.max(0.025, Math.max(0.06, werte.laenge ?? 0.16) * 0.3) / 2;
  }
  return null;
}

/** Das Ende des Stativarms — dort wird eingehängt. */
export const stativHaken = (g: Geraet): Punkt => stativTeile(g).haken;
