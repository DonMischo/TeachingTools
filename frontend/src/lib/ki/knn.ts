/**
 * Erkennen durch Vergleichen — der nächste Nachbar.
 *
 * Das einfachste lernende Verfahren, das es gibt, und es ist ein echtes: Man
 * merkt sich Beispiele. Kommt etwas Neues, sucht man das ähnlichste Beispiel
 * und sagt dessen Namen.
 *
 * »Ähnlich« heißt dabei etwas sehr Stumpfes: Die Bilder werden Kästchen für
 * Kästchen verglichen, und die Unterschiede werden zusammengezählt. Das Bild
 * ist für den Rechner nichts als eine Reihe von 256 Zahlen — dieselbe
 * Erkenntnis wie beim Zerlegen im Sprachmodell-Reiter, nur für Bilder.
 *
 * Was man daran lernt, ist genau das, was bei großen Bild-Erkennern auch gilt:
 *   • Mit einem Beispiel je Klasse ist das Verfahren zittrig.
 *   • Es kennt *nur*, was man ihm gezeigt hat — nichts sonst.
 *   • Es hat keine Ahnung, was ein Kreis ist. Es vergleicht Kästchen.
 */

/** Ein gezeichnetes Bild: 16×16 Kästchen, 0 = leer, 1 = gemalt. */
export const KANTE = 16;
export type Bild = number[];

export type Beispiel = { id: number; klasse: string; bild: Bild };

export function leeresBild(): Bild {
  return new Array(KANTE * KANTE).fill(0);
}

export function istLeer(bild: Bild): boolean {
  return !bild.some(v => v > 0);
}

/**
 * Der Abstand zweier Bilder: die Summe der Unterschiede je Kästchen.
 *
 * Vorher wird jedes Bild in die Mitte gerückt, damit dieselbe Form links oben
 * und rechts unten als dasselbe gilt — sonst erkennt das Verfahren vor allem,
 * *wo* gemalt wurde, und nicht *was*.
 */
export function abstand(a: Bild, b: Bild): number {
  const x = zentriere(a);
  const y = zentriere(b);
  let summe = 0;
  for (let i = 0; i < x.length; i++) summe += Math.abs(x[i] - y[i]);
  return summe;
}

/** Die Zeichnung in die Mitte des Feldes schieben. */
export function zentriere(bild: Bild): Bild {
  let minX = KANTE;
  let maxX = -1;
  let minY = KANTE;
  let maxY = -1;
  for (let y = 0; y < KANTE; y++) {
    for (let x = 0; x < KANTE; x++) {
      if (bild[y * KANTE + x] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return bild;
  const dx = Math.round((KANTE - 1 - maxX - minX) / 2);
  const dy = Math.round((KANTE - 1 - maxY - minY) / 2);
  if (dx === 0 && dy === 0) return bild;
  const out = leeresBild();
  for (let y = 0; y < KANTE; y++) {
    for (let x = 0; x < KANTE; x++) {
      const zx = x + dx;
      const zy = y + dy;
      if (zx >= 0 && zx < KANTE && zy >= 0 && zy < KANTE) {
        out[zy * KANTE + zx] = bild[y * KANTE + x];
      }
    }
  }
  return out;
}

export type Urteil = {
  klasse: string;
  /** Wie sicher (0–1) — aus dem Abstandsverhältnis der beiden besten Klassen. */
  sicherheit: number;
  /** Das ähnlichste gespeicherte Beispiel, zum Danebenlegen. */
  naechstes: Beispiel;
  /** Alle Beispiele nach Abstand, für die Erklärung. */
  rangliste: { beispiel: Beispiel; abstand: number }[];
};

/**
 * Das ähnlichste Beispiel suchen und dessen Namen sagen.
 *
 * Die Sicherheit ist bewusst schlicht gerechnet: Wie deutlich ist der beste
 * Treffer besser als der beste Treffer einer *anderen* Klasse? Liegen beide
 * gleich nah, ist sich das Verfahren zu Recht unsicher — und sagt das auch.
 */
export function erkenne(beispiele: readonly Beispiel[], bild: Bild): Urteil | null {
  if (!beispiele.length || istLeer(bild)) return null;
  const rangliste = beispiele
    .map(beispiel => ({ beispiel, abstand: abstand(beispiel.bild, bild) }))
    .sort((a, b) => a.abstand - b.abstand);

  const bester = rangliste[0];
  const andere = rangliste.find(r => r.beispiel.klasse !== bester.beispiel.klasse);
  const sicherheit = !andere
    ? 1
    : Math.max(0, Math.min(1, (andere.abstand - bester.abstand) / Math.max(1, andere.abstand)));

  return {
    klasse: bester.beispiel.klasse,
    sicherheit,
    naechstes: bester.beispiel,
    rangliste: rangliste.slice(0, 5),
  };
}
