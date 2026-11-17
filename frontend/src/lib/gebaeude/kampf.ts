/**
 * Kleine Kämpfe der 3D-Welt: Bevor das Monster seine Frage stellt, gibt es
 * ein kurzes Geschicklichkeitsspiel. Es entscheidet nichts über die Aufgabe —
 * wer es verliert, bekommt nur einen Treffer ab — und lässt sich abschalten.
 *
 * An den Stationen, reihum:
 *   konter      Ring schrumpft; im grünen Bereich drücken
 *   ausweichen  nach einer Pause zeigt ein Pfeil die Richtung; schnell dorthin
 *   folge       eine Reihe Pfeiltasten in der richtigen Reihenfolge
 *   block       Schild halten, bis die Kraft im grünen Bereich ist, dann loslassen
 *   ziel        Schwachstellen leuchten nacheinander auf einer der vier Seiten auf
 * Beim Boss am Tor, abwechselnd:
 *   runen       Runen leuchten in einer Reihenfolge auf — nachmachen
 *   kraft       Kräftemessen: im Takt drücken (wer nur hämmert, dem geht die Puste aus)
 * Beim Erz: `taktTreffer` — ein Hieb im richtigen Moment zählt doppelt.
 *
 * Die Stufe bestimmt die Zeiten: wie breit das Fenster ist, wie lange man
 * reagieren darf, wie lang die Folge ist. Reine Rechnung ohne Zeichnen.
 */

export type Stufe = "aus" | "leicht" | "mittel" | "schwer";
export const STUFEN: { id: Stufe; name: string }[] = [
  { id: "aus", name: "Aus" }, { id: "leicht", name: "Leicht" }, { id: "mittel", name: "Mittel" }, { id: "schwer", name: "Schwer" },
];
export function istStufe(x: unknown): x is Stufe {
  return STUFEN.some(s => s.id === x);
}

export type KampfArt = "konter" | "ausweichen" | "folge" | "block" | "ziel" | "runen" | "kraft";
/** an den Stationen, reihum */
export const KAMPF_ARTEN: KampfArt[] = ["konter", "ausweichen", "folge", "block", "ziel"];
/** beim Boss am Tor, abwechselnd */
export const BOSS_ARTEN: KampfArt[] = ["runen", "kraft"];
export const KAMPF_NAME: Record<KampfArt, string> = {
  konter: "Konter", ausweichen: "Ausweichen", folge: "Kombo", block: "Schildblock", ziel: "Schwachstelle", runen: "Runen", kraft: "Kräftemessen",
};

export type Taste = "los" | "links" | "rechts" | "hoch" | "runter";
const RICHTUNGEN: Taste[] = ["links", "rechts", "hoch", "runter"];

type Scharf = Exclude<Stufe, "aus">;

/** Zeiten je Stufe (Sekunden; `…Halb` als Anteil) */
export const ZEITEN: Record<Scharf, {
  konterDauer: number; konterHalb: number; reaktion: number; folgeLaenge: number; folgeZeit: number;
  /** Schildblock: so lange lädt der Schild bis ganz voll, halbe Breite des Fensters */
  ladeZeit: number; blockHalb: number;
  /** Schwachstelle: nötige Treffer, so lange leuchtet eine */
  zielNoetig: number; zielFade: number;
  /** Runen: Länge der Reihe, Zeit je Rune beim Zeigen */
  runenLaenge: number; runenZeig: number;
  /** Kräftemessen: Schub je Druck, Zug des Bosses je Sekunde */
  kraftStoss: number; kraftZug: number;
  /** Erz-Takt: Dauer einer Schwingung hin und zurück, halbe Breite des Fensters */
  taktDauer: number; taktHalb: number;
  /** verzeiht zu frühes Drücken und falsche Tasten */
  nachsichtig: boolean;
}> = {
  leicht: {
    konterDauer: 2.4, konterHalb: 0.13, reaktion: 1.4, folgeLaenge: 3, folgeZeit: 5, ladeZeit: 1.8, blockHalb: 0.15,
    zielNoetig: 3, zielFade: 1.5, runenLaenge: 3, runenZeig: 0.8, kraftStoss: 0.12, kraftZug: 0.09, taktDauer: 1.8, taktHalb: 0.17, nachsichtig: true,
  },
  mittel: {
    konterDauer: 1.8, konterHalb: 0.09, reaktion: 0.9, folgeLaenge: 4, folgeZeit: 4, ladeZeit: 1.4, blockHalb: 0.1,
    zielNoetig: 4, zielFade: 1.0, runenLaenge: 4, runenZeig: 0.6, kraftStoss: 0.1, kraftZug: 0.12, taktDauer: 1.3, taktHalb: 0.12, nachsichtig: false,
  },
  schwer: {
    konterDauer: 1.3, konterHalb: 0.06, reaktion: 0.6, folgeLaenge: 5, folgeZeit: 3.2, ladeZeit: 1.1, blockHalb: 0.07,
    zielNoetig: 5, zielFade: 0.7, runenLaenge: 5, runenZeig: 0.45, kraftStoss: 0.09, kraftZug: 0.15, taktDauer: 0.95, taktHalb: 0.08, nachsichtig: false,
  },
};

/** Der Ring trifft den Kreis bei diesem Anteil der Dauer; der Schild ist bei dieser Ladung richtig */
export const KONTER_ZIEL = 0.8;
export const BLOCK_ZIEL = 0.8;

export interface Kampf {
  art: KampfArt;
  /** vergangene Zeit und Gesamtdauer in Sekunden */
  t: number;
  dauer: number;
  /** zählt hoch, sobald sich etwas Sichtbares ändert (außer dem, was stetig läuft) */
  stand: number;
  /** konter/block: halbe Breite des Fensters */
  halb: number;
  /** ausweichen: ab dieser Zeit ist der Pfeil zu sehen */
  ab: number;
  richtung: "links" | "rechts";
  /** folge/runen: die Tasten und wie viele schon stimmen; ziel: Treffer bisher */
  folge: Taste[];
  pos: number;
  /** block: Schild oben?, Ladung 0…1 */
  haelt: boolean;
  ladung: number;
  ladeZeit: number;
  /** ziel: leuchtende Seite (null = gerade keine), seit wann, nötige Treffer, Leuchtdauer */
  ziel: Taste | null;
  zielSeit: number;
  noetig: number;
  fade: number;
  /** runen: zeigen oder eingeben; welche Rune leuchtet gerade (−1 = keine) */
  phase: "zeigen" | "eingeben";
  zeig: number;
  zeigt: number;
  /** kraft: Balken 0…1 (1 = gewonnen), Puste 0…1 */
  kraft: number;
  ausdauer: number;
  stoss: number;
  zug: number;
  nachsichtig: boolean;
  ergebnis: "gut" | "schlecht" | null;
  /** ausweichen: Reaktionszeit in Sekunden (nur bei Erfolg) */
  reaktion: number | null;
  zufall: () => number;
}

export function neuerKampf(art: KampfArt, stufe: Scharf, zufall: () => number = Math.random): Kampf {
  const Z = ZEITEN[stufe];
  const ab = art === "ausweichen" ? 0.6 + zufall() * 0.9 : 0;
  const richtung = zufall() < 0.5 ? "links" : "rechts";
  const laenge = art === "folge" ? Z.folgeLaenge : art === "runen" ? Z.runenLaenge : 0;
  const folge = Array.from({ length: laenge }, () => RICHTUNGEN[Math.floor(zufall() * 4)]);
  const dauer = art === "konter" ? Z.konterDauer : art === "ausweichen" ? ab + Z.reaktion : art === "folge" ? Z.folgeZeit
    : art === "block" ? 7 : art === "ziel" ? Z.zielNoetig * (Z.zielFade + 0.5) + (Z.nachsichtig ? 5 : 1.5)
    : art === "runen" ? laenge * Z.runenZeig + 0.4 + laenge * 1.8 : 9;
  return {
    art, t: 0, dauer, stand: 0, halb: art === "block" ? Z.blockHalb : Z.konterHalb, ab, richtung, folge, pos: 0,
    haelt: false, ladung: 0, ladeZeit: Z.ladeZeit,
    ziel: null, zielSeit: 0.5, noetig: Z.zielNoetig, fade: Z.zielFade,
    phase: art === "runen" ? "zeigen" : "eingeben", zeig: Z.runenZeig, zeigt: -1,
    kraft: 0.5, ausdauer: 1, stoss: Z.kraftStoss, zug: Z.kraftZug,
    nachsichtig: Z.nachsichtig, ergebnis: null, reaktion: null, zufall,
  };
}

const ende = (k: Kampf, e: "gut" | "schlecht") => { k.ergebnis = e; k.stand++; };

/** Zeit läuft: wer das Fenster verpasst, wird getroffen */
export function kampfSchritt(k: Kampf, dt: number): void {
  if (k.ergebnis) return;
  k.t += dt;
  if (k.art === "konter") {
    if (k.t / k.dauer > KONTER_ZIEL + k.halb) ende(k, "schlecht");
    return;
  }
  if (k.art === "block") {
    if (k.haelt) k.ladung += dt / k.ladeZeit;
    // zu lange gehalten: der Schlag bricht durch
    if (k.ladung > BLOCK_ZIEL + k.halb) { ende(k, "schlecht"); return; }
  } else if (k.art === "ziel") {
    if (k.ziel === null && k.t >= k.zielSeit) {
      k.ziel = RICHTUNGEN[Math.floor(k.zufall() * 4)];
      k.zielSeit = k.t;
      k.stand++;
    } else if (k.ziel !== null && k.t - k.zielSeit > k.fade) {
      // verpasst: nachsichtig kommt einfach die nächste
      if (!k.nachsichtig) { ende(k, "schlecht"); return; }
      k.ziel = null; k.zielSeit = k.t + 0.3; k.stand++;
    }
  } else if (k.art === "runen" && k.phase === "zeigen") {
    const n = k.folge.length;
    if (k.t >= n * k.zeig + 0.4) { k.phase = "eingeben"; k.zeigt = -1; k.stand++; }
    else {
      // jede Rune leuchtet drei Viertel ihrer Zeit, dann kurz dunkel (gleiche hintereinander bleiben erkennbar)
      const i = Math.floor(k.t / k.zeig);
      const zeigt = i < n && k.t % k.zeig < k.zeig * 0.75 ? i : -1;
      if (zeigt !== k.zeigt) { k.zeigt = zeigt; k.stand++; }
    }
  } else if (k.art === "kraft") {
    k.kraft -= k.zug * dt;
    k.ausdauer = Math.min(1, k.ausdauer + 0.45 * dt);
    if (k.kraft <= 0) { k.kraft = 0; ende(k, "schlecht"); return; }
    // Zeit um: nur wer den Boss deutlich zurückgedrängt hat, gewinnt
    if (k.t >= k.dauer) { ende(k, k.kraft > 0.7 ? "gut" : "schlecht"); return; }
  }
  if (k.t >= k.dauer) ende(k, "schlecht");
}

export function kampfEingabe(k: Kampf, taste: Taste): void {
  if (k.ergebnis) return;
  if (k.art === "konter") {
    if (taste !== "los") return;
    const daneben = Math.abs(k.t / k.dauer - KONTER_ZIEL) > k.halb;
    // zu früh: nachsichtig darf man es noch einmal versuchen
    if (daneben && k.nachsichtig && k.t / k.dauer < KONTER_ZIEL) return;
    ende(k, daneben ? "schlecht" : "gut");
  } else if (k.art === "ausweichen") {
    if (taste !== "links" && taste !== "rechts") return;
    if (k.t < k.ab) { if (!k.nachsichtig) ende(k, "schlecht"); return; }
    if (taste === k.richtung) { k.reaktion = k.t - k.ab; ende(k, "gut"); }
    else ende(k, "schlecht");
  } else if (k.art === "folge") {
    if (taste === "los") return;
    if (taste === k.folge[k.pos]) { k.pos++; k.stand++; if (k.pos >= k.folge.length) ende(k, "gut"); }
    else if (!k.nachsichtig) ende(k, "schlecht");
  } else if (k.art === "block") {
    if (taste === "los" && !k.haelt) { k.haelt = true; k.stand++; }
  } else if (k.art === "ziel") {
    if (taste === "los" || k.ziel === null) return;
    if (taste === k.ziel) {
      k.pos++; k.ziel = null; k.zielSeit = k.t + 0.25; k.stand++;
      if (k.pos >= k.noetig) ende(k, "gut");
    } else if (!k.nachsichtig) ende(k, "schlecht");
  } else if (k.art === "runen") {
    if (taste === "los" || k.phase !== "eingeben") return;
    if (taste === k.folge[k.pos]) { k.pos++; k.stand++; if (k.pos >= k.folge.length) ende(k, "gut"); }
    else if (k.nachsichtig) { k.t = 0; k.pos = 0; k.phase = "zeigen"; k.zeigt = -1; k.stand++; } // noch einmal ansehen
    else ende(k, "schlecht");
  } else if (taste === "los") {
    // Kräftemessen: mit voller Puste schiebt ein Druck weit, außer Atem kaum
    k.kraft += k.stoss * (0.04 + 0.96 * k.ausdauer);
    k.ausdauer = Math.max(0, k.ausdauer - 0.2);
    if (k.kraft >= 1) { k.kraft = 1; ende(k, "gut"); }
  }
}

/** Schildblock: Taste losgelassen — im grünen Bereich prallt der Schlag ab */
export function kampfLoslassen(k: Kampf): void {
  if (k.ergebnis || k.art !== "block" || !k.haelt) return;
  k.haelt = false;
  k.stand++;
  if (Math.abs(k.ladung - BLOCK_ZIEL) <= k.halb) ende(k, "gut");
  else if (k.nachsichtig) k.ladung = 0; // zu früh: noch einmal
  else ende(k, "schlecht");
}

/** Erz-Takt: Wo steht der Zeiger (0…1…0) nach `t` Sekunden? */
export function taktStelle(t: number, stufe: Scharf): number {
  const p = (t / ZEITEN[stufe].taktDauer) % 1;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

/** Erz-Takt: Volltreffer, wenn der Zeiger in der Mitte steht — der Hieb zählt doppelt */
export function taktTreffer(t: number, stufe: Scharf): boolean {
  return Math.abs(taktStelle(t, stufe) - 0.5) <= ZEITEN[stufe].taktHalb;
}
