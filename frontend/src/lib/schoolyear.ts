/** Mirrors api/schoolyear.py — Stichtag 1. August starts a new school year. */
export function getSchoolYearStart(d: Date = new Date()): number {
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; // getMonth() is 0-indexed, 7 = August
}

export function getSchoolYearLabel(d: Date = new Date()): string {
  const start = getSchoolYearStart(d);
  return `${start}/${start + 1}`;
}

/**
 * ISO-8601-Kalenderwoche: Wochen beginnen montags, Woche 1 enthält den ersten
 * Donnerstag des Jahres.
 */
export function isoWoche(d: Date = new Date()): number {
  const donnerstag = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const ersterDonnerstag = new Date(donnerstag.getFullYear(), 0, 4);
  ersterDonnerstag.setDate(ersterDonnerstag.getDate() + 3 - ((ersterDonnerstag.getDay() + 6) % 7));
  return 1 + Math.round((donnerstag.getTime() - ersterDonnerstag.getTime()) / (7 * 86_400_000));
}

/**
 * A/B-Woche: ungerade Kalenderwochen sind A, gerade B.
 *
 * Eine einzige Stelle, weil zwei Anzeigen dasselbe behaupten müssen — der
 * Kalender am Wochenrand und die Uhr in der Startseiten-Slideshow. Stünde die
 * Regel zweimal da, zeigte irgendwann die eine A und die andere B.
 */
export function abWoche(woche: number = isoWoche()): "A" | "B" {
  return woche % 2 === 1 ? "A" : "B";
}
