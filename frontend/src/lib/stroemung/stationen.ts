/** Die Reiter von »Druck & Strömung«: neun Stationen in drei Stufen und der Baukasten. */

export type Stufe = "druck" | "stroemung" | "technik" | "baukasten";

export const STUFEN: { id: Stufe; label: string }[] = [
  { id: "druck", label: "Kl. 7/8 · Druck" },
  { id: "stroemung", label: "Kl. 9/10 · Strömung" },
  { id: "technik", label: "Technik & Beruf" },
  { id: "baukasten", label: "Baukasten" },
];

export interface Station {
  id: string;
  stufe: Stufe;
  icon: string;
  titel: string;
  /** Was man dort sieht und ausprobiert. */
  kurz: string;
}

export const STATIONEN: Station[] = [
  { id: "tauchen", stufe: "druck", icon: "🤿", titel: "Tauchen", kurz: "Der Druck wächst mit der Tiefe — in Wasser, Salzwasser und Öl verschieden schnell. Und: Die Form des Gefäßes ist dem Bodendruck egal." },
  { id: "roehren", stufe: "druck", icon: "🗼", titel: "Wasserturm & Röhren", kurz: "Verbundene Gefäße gleichen ihre Spiegel aus. Ein Wasserturm versorgt ein Haus — oben kommt weniger Druck an als unten." },
  { id: "hydraulik", stufe: "druck", icon: "🏋️", titel: "Hydraulische Presse", kurz: "Kleine Kraft auf kleinem Kolben hebt große Last auf großem Kolben (Pascal) — dafür ist der Weg länger. Eine Luftblase macht die Bremse weich." },
  { id: "luftdruck", stufe: "druck", icon: "🥤", titel: "Luftdruck", kurz: "Warum der Strohhalm funktioniert, wie ein Saugheber läuft und weshalb keine Pumpe Wasser höher als etwa 10 m ansaugen kann." },
  { id: "rohrnetz", stufe: "stroemung", icon: "🚰", titel: "Rohrnetz", kurz: "Durchfluss, Rohrreibung, Reihe und parallel, Knotenregel — und warum ein doppelt so dickes Rohr 16-mal so viel durchlässt." },
  { id: "venturi", stufe: "stroemung", icon: "🌀", titel: "Venturi", kurz: "In der Engstelle fließt es schneller, und der Druck sinkt: Wasserstrahlpumpe, Zerstäuber, Bernoulli." },
  { id: "heizung", stufe: "technik", icon: "🔥", titel: "Heizkreis", kurz: "Umwälzpumpe, Kessel, drei Heizkörper, Thermostatventile — und der hydraulische Abgleich, damit auch der letzte Heizkörper warm wird." },
  { id: "hausanschluss", stufe: "technik", icon: "🏠", titel: "Hausanschluss", kurz: "Versorgungsdruck, Druckminderer, Stockwerke: Die Dusche oben wird schwach, wenn unten jemand spült." },
  { id: "druckluft", stufe: "technik", icon: "💨", titel: "Druckluft", kurz: "Kompressor, Kessel, Druckregler, Zylinder und Wegeventil — Pneumatik mit Schaltzeichen nach DIN ISO 1219." },
  { id: "baukasten", stufe: "baukasten", icon: "🧰", titel: "Baukasten", kurz: "Eigene Rohrnetze bauen: Behälter, Pumpen, Rohre, Ventile, Zylinder, Messgeräte — mit Wasser oder Luft." },
];
