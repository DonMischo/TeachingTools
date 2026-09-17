/**
 * Rechnerei des Oszilloskops — ohne Leinwand, damit sie prüfbar bleibt.
 *
 * Der Auslöser (Trigger) ist der Grund, warum ein Oszilloskop überhaupt
 * lesbar ist. Entscheidend dabei ist, *wie* ausgelöst wird: gesucht wird
 * nicht die jüngste Flanke, sondern die jüngste, **hinter die noch ein
 * volles Zeitfenster passt**.
 *
 * Der Unterschied ist nicht akademisch. Hängt das Bild an der jüngsten
 * Flanke, bleibt nur der Rest einer Periode zum Zeichnen übrig — die Kurve
 * quetscht sich als Stummel an den linken Rand und flackert, weil dieser
 * Rest mit jedem Bild eine andere Länge hat. Verankert am passenden Abstand
 * füllt der Durchlauf den Schirm und steht still.
 *
 * Beide Kanäle bekommen dasselbe Fenster. Sonst laufen sie mit eigenem
 * Zeitursprung nebeneinanderher und man kann die Kurven nicht mehr
 * aufeinander beziehen — wozu sonst zwei Kanäle.
 */

export interface Verlauf {
  t: number[];
  v: number[];
}

/** Der dargestellte Zeitbereich. Immer genau `dauer` breit. */
export interface Fenster {
  t0: number;
  t1: number;
}

/**
 * Index der letzten steigenden Flanke durch `pegel` — oder 0, wenn es keine
 * gibt. Gesucht wird von hinten.
 */
export function flankenIndex(v: number[], pegel: number): number {
  for (let i = v.length - 1; i > 0; i--) {
    if (v[i - 1] < pegel && v[i] >= pegel) return i;
  }
  return 0;
}

/**
 * Wertebereich mit etwas Luft — nie auf einen Punkt zusammengefallen, sonst
 * teilt die Achsenrechnung durch null und der Schirm bleibt leer.
 */
export function spanne(v: number[]): { min: number; max: number } {
  if (!v.length) return { min: -1, max: 1 };
  let min = Infinity, max = -Infinity;
  for (const x of v) {
    if (!Number.isFinite(x)) continue;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: -1, max: 1 };
  const luft = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
  return { min: min - luft, max: max + luft };
}

/**
 * Das Zeitfenster, das gezeichnet wird.
 *
 * Ohne Auslöser: die letzten `dauer` Sekunden, das Neueste rechts am Rand.
 * Mit Auslöser: verankert an der jüngsten steigenden Flanke, hinter die noch
 * ein volles Fenster passt — dadurch steht das Bild.
 */
export function zeitfenster(
  verlauf: Verlauf | undefined,
  dauer: number,
  pegel: number | null,
): Fenster {
  if (!verlauf?.t.length) return { t0: 0, t1: dauer };

  const ende = verlauf.t[verlauf.t.length - 1];
  const spaetesterStart = ende - dauer;

  if (pegel !== null) {
    for (let i = verlauf.t.length - 1; i > 0; i--) {
      if (verlauf.t[i] > spaetesterStart) continue;
      if (verlauf.v[i - 1] < pegel && verlauf.v[i] >= pegel) {
        return { t0: verlauf.t[i], t1: verlauf.t[i] + dauer };
      }
    }
    // Noch keine passende Flanke aufgezeichnet — dann eben ungetriggert.
  }

  return { t0: spaetesterStart, t1: ende };
}

/** Die Messwerte innerhalb eines Zeitfensters. */
export function imFenster(verlauf: Verlauf | undefined, f: Fenster): Verlauf {
  if (!verlauf?.t.length) return { t: [], v: [] };
  let von = 0;
  while (von < verlauf.t.length && verlauf.t[von] < f.t0) von++;
  let bis = von;
  while (bis < verlauf.t.length && verlauf.t[bis] <= f.t1) bis++;
  return { t: verlauf.t.slice(von, bis), v: verlauf.v.slice(von, bis) };
}

/**
 * Wert je Rasterfeld — die Angabe, ohne die man vom Schirm nichts ablesen
 * kann. Entspricht dem »Volt/Div« am echten Gerät.
 */
export const jeFeld = (min: number, max: number, zeilen: number) => (max - min) / zeilen;

/**
 * Die nächste Stufe einer 1-2-5-Folge (…, 0,1, 0,2, 0,5, 1, 2, 5, 10, …).
 *
 * So rastet der Empfindlichkeitsknopf an einem echten Oszilloskop: nicht
 * stufenlos, sondern in Schritten, die man ablesen kann. Gebraucht wird das,
 * sobald die Höhe nicht mehr automatisch mitwächst — und das wiederum
 * braucht, wer eine Dämpfung zeigen will. Bei mitwachsender Höhe füllt die
 * Schwingung immer den Schirm, und genau das Abklingen sieht man dann nicht.
 */
export function stufe(wert: number, richtung: 1 | -1): number {
  const sicher = wert > 0 && Number.isFinite(wert) ? wert : 1;
  const dekade = Math.pow(10, Math.floor(Math.log10(sicher)));
  const mantisse = sicher / dekade;
  const folge = [1, 2, 5];

  // Die Stufe finden, auf der wir gerade stehen (oder die nächstniedrigere).
  let i = 0;
  while (i < folge.length - 1 && mantisse >= folge[i + 1] - 1e-9) i++;

  const flach = folge.indexOf(folge[i]) + Math.round(Math.log10(dekade)) * folge.length;
  const naechste = flach + richtung;
  const stelle = ((naechste % folge.length) + folge.length) % folge.length;
  const exponent = Math.floor(naechste / folge.length);
  return folge[stelle] * Math.pow(10, exponent);
}
