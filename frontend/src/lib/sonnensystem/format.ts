/** Zahlen, wie sie im Unterricht gelesen werden: deutsch, gerundet, mit Einheit. */

export function zahl(x: number, stellen = 0): string {
  return x.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
}

/** Drei gültige Ziffern — 0,0057 bleibt lesbar, 24,79 wird 24,8. */
export function gerundet(x: number): string {
  if (x === 0) return "0";
  const stellen = Math.max(0, 2 - Math.floor(Math.log10(Math.abs(x))));
  return zahl(x, Math.min(stellen, 4));
}

export function km(x: number): string {
  if (x >= 1e9) return `${zahl(x / 1e9, 2)} Mrd. km`;
  if (x >= 1e6) return `${zahl(x / 1e6, 1)} Mio. km`;
  return `${zahl(x)} km`;
}

const HOCH = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** 5,97 · 10²⁴ */
export function zehnerpotenz(x: number, stellen = 2): string {
  const exp = Math.floor(Math.log10(x));
  const mantisse = x / 10 ** exp;
  const hoch = String(exp).split("").map(c => (c === "-" ? "⁻" : HOCH[Number(c)])).join("");
  return `${zahl(mantisse, stellen)} · 10${hoch}`;
}

/** Eine Zeitspanne in Sekunden, so grob wie sinnvoll: »8 min 20 s«, »4 h 10 min«. */
export function dauer(sekunden: number): string {
  const s = Math.round(sekunden);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  const tage = sekunden / 86_400;
  if (tage < 365.25 * 2) return `${zahl(tage, tage < 10 ? 1 : 0)} Tage`;
  return `${zahl(tage / 365.25, tage < 365.25 * 100 ? 1 : 0)} Jahre`;
}

/** Tage als Tag-/Jahreslänge: »9 h 56 min«, »224,7 Tage«, »11,9 Jahre«. */
export function tage(t: number): string {
  const a = Math.abs(t);
  if (a < 2) {
    const minuten = Math.round(a * 24 * 60);
    return `${Math.floor(minuten / 60)} h ${minuten % 60} min`;
  }
  if (a < 800) return `${zahl(a, a < 100 ? 1 : 0)} Tage`;
  return `${zahl(a / 365.25, 1)} Jahre`;
}

/** Wie viel mal so viel wie auf der Erde — »× 11,2«, »× 0,38«. */
export function malErde(wert: number, erde: number): string {
  return `× ${gerundet(wert / erde)}`;
}
