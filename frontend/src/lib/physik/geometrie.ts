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
  // Die Probe wird länger, wenn man zieht — die Last hängt am gedehnten Ende.
  if (g.typ === "probe" && portId === "unten") {
    return { x: g.pos.x, y: g.pos.y - (g.werte.laenge ?? 0.2) - (s?.q ?? 0) };
  }
  if (portId === "koerper") return koerperOrt(g, s);
  if ((g.typ === "hebel" || g.typ === "waage") && (portId === "links" || portId === "rechts")) {
    return hebelArmOrt(g, portId, s?.q ?? g.werte.startneigung ?? 0);
  }
  return null;
}

// ── Was woran hängt ──────────────────────────────────────────────────────────

/**
 * Der Anschluss, mit dem ein Gerät *selbst* irgendwo eingehängt wird.
 *
 * Das ist der Unterschied zwischen einem Schaltplan und einem Vorbereitungs-
 * raum: ein Massestück, das man an einen Haken hängt, bleibt nicht liegen, wo
 * es lag, und bekommt eine Linie zum Haken gemalt — es *ist* dann dort.
 */
export const EIGENER_HAKEN: Record<string, string> = {
  massestueck: "oese",
  fadenpendel: "aufhaengung",
  federpendel: "aufhaengung",
  kraftmesser: "oben",
  flaschenzug: "zug",
};

/** Umriss eines Geräts in Weltkoordinaten — das, was man anfassen kann. */
export function umriss(g: Geraet, standard: { b: number; h: number }): { mitte: Punkt; b: number; h: number } {
  if (g.typ === "stativ") {
    const h = Math.max(0.1, g.werte.hoehe ?? 1.2);
    // Quer gedreht ist der Umriss entsprechend quer.
    const quer = Math.abs(Math.cos(g.winkel ?? 0)) < 0.5;
    return { mitte: g.pos, b: quer ? h : 0.08, h: quer ? 0.08 : h };
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

/** Das Ende des Stativarms — dort wird eingehängt. */
export const stativHaken = (g: Geraet): Punkt => stativTeile(g).haken;
