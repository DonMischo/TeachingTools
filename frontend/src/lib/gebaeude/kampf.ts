/**
 * Kleine Kämpfe der 3D-Welt: Bevor das Monster seine Frage stellt, gibt es
 * ein kurzes Geschicklichkeitsspiel. Es entscheidet nichts über die Aufgabe —
 * wer es verliert, bekommt nur einen Treffer ab — und lässt sich abschalten.
 *
 *   konter      Ring schrumpft; im grünen Bereich drücken
 *   ausweichen  nach einer Pause zeigt ein Pfeil die Richtung; schnell dorthin
 *   folge       eine Reihe Pfeiltasten in der richtigen Reihenfolge
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

export type KampfArt = "konter" | "ausweichen" | "folge";
export const KAMPF_ARTEN: KampfArt[] = ["konter", "ausweichen", "folge"];
export const KAMPF_NAME: Record<KampfArt, string> = { konter: "Konter", ausweichen: "Ausweichen", folge: "Kombo" };

export type Taste = "los" | "links" | "rechts" | "hoch" | "runter";
const RICHTUNGEN: Taste[] = ["links", "rechts", "hoch", "runter"];

/** Zeiten je Stufe (Sekunden; `konterHalb` als Anteil der Dauer) */
export const ZEITEN: Record<Exclude<Stufe, "aus">, {
  konterDauer: number; konterHalb: number; reaktion: number; folgeLaenge: number; folgeZeit: number;
  /** verzeiht zu frühes Drücken und falsche Tasten */
  nachsichtig: boolean;
}> = {
  leicht: { konterDauer: 2.4, konterHalb: 0.13, reaktion: 1.4, folgeLaenge: 3, folgeZeit: 5, nachsichtig: true },
  mittel: { konterDauer: 1.8, konterHalb: 0.09, reaktion: 0.9, folgeLaenge: 4, folgeZeit: 4, nachsichtig: false },
  schwer: { konterDauer: 1.3, konterHalb: 0.06, reaktion: 0.6, folgeLaenge: 5, folgeZeit: 3.2, nachsichtig: false },
};

/** Der Ring trifft den Kreis bei diesem Anteil der Dauer */
export const KONTER_ZIEL = 0.8;

export interface Kampf {
  art: KampfArt;
  /** vergangene Zeit und Gesamtdauer in Sekunden */
  t: number;
  dauer: number;
  /** konter: halbe Breite des Fensters um KONTER_ZIEL (Anteil der Dauer) */
  halb: number;
  /** ausweichen: ab dieser Zeit ist der Pfeil zu sehen */
  ab: number;
  richtung: "links" | "rechts";
  /** folge: die Tasten und wie viele schon stimmen */
  folge: Taste[];
  pos: number;
  nachsichtig: boolean;
  ergebnis: "gut" | "schlecht" | null;
  /** ausweichen: Reaktionszeit in Sekunden (nur bei Erfolg) */
  reaktion: number | null;
}

export function neuerKampf(art: KampfArt, stufe: Exclude<Stufe, "aus">, zufall: () => number = Math.random): Kampf {
  const Z = ZEITEN[stufe];
  const ab = art === "ausweichen" ? 0.6 + zufall() * 0.9 : 0;
  return {
    art, t: 0,
    dauer: art === "konter" ? Z.konterDauer : art === "ausweichen" ? ab + Z.reaktion : Z.folgeZeit,
    halb: Z.konterHalb, ab,
    richtung: zufall() < 0.5 ? "links" : "rechts",
    folge: art === "folge" ? Array.from({ length: Z.folgeLaenge }, () => RICHTUNGEN[Math.floor(zufall() * 4)]) : [],
    pos: 0, nachsichtig: Z.nachsichtig, ergebnis: null, reaktion: null,
  };
}

/** Zeit läuft: wer das Fenster verpasst, wird getroffen */
export function kampfSchritt(k: Kampf, dt: number): void {
  if (k.ergebnis) return;
  k.t += dt;
  const vorbei = k.art === "konter" ? k.t / k.dauer > KONTER_ZIEL + k.halb : k.t >= k.dauer;
  if (vorbei) k.ergebnis = "schlecht";
}

export function kampfEingabe(k: Kampf, taste: Taste): void {
  if (k.ergebnis) return;
  if (k.art === "konter") {
    if (taste !== "los") return;
    const daneben = Math.abs(k.t / k.dauer - KONTER_ZIEL) > k.halb;
    // zu früh: nachsichtig darf man es noch einmal versuchen
    if (daneben && k.nachsichtig && k.t / k.dauer < KONTER_ZIEL) return;
    k.ergebnis = daneben ? "schlecht" : "gut";
  } else if (k.art === "ausweichen") {
    if (taste !== "links" && taste !== "rechts") return;
    if (k.t < k.ab) { if (!k.nachsichtig) k.ergebnis = "schlecht"; return; }
    if (taste === k.richtung) { k.ergebnis = "gut"; k.reaktion = k.t - k.ab; }
    else k.ergebnis = "schlecht";
  } else {
    if (taste === "los") return;
    if (taste === k.folge[k.pos]) { k.pos++; if (k.pos >= k.folge.length) k.ergebnis = "gut"; }
    else if (!k.nachsichtig) k.ergebnis = "schlecht";
  }
}
