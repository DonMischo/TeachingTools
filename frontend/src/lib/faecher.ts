/**
 * Fächer für die Werkzeug-Übersichten — Voreinstellung je Slug, Farben, Filter.
 *
 * Ein Admin kann die Fächer eines Werkzeugs von Hand ändern (schulweit, in
 * school_settings.tool_faecher); dann gilt seine Liste statt der
 * Voreinstellung. Beliebige eigene Fächer sind erlaubt.
 */

/** Bekannte Fächer mit fester Farbe, in der Reihenfolge der Filterleiste. */
export const FAECHER: { name: string; farbe: string }[] = [
  { name: "Mathematik", farbe: "#8b5cf6" },
  { name: "Physik", farbe: "#0ea5e9" },
  { name: "Chemie", farbe: "#14b8a6" },
  { name: "Biologie", farbe: "#22c55e" },
  { name: "Geografie", farbe: "#ea580c" },
  { name: "Astronomie", farbe: "#6366f1" },
  { name: "Informatik", farbe: "#06b6d4" },
  { name: "Wirtschaft und Recht", farbe: "#e11d48" },
  { name: "Sozialkunde", farbe: "#f59e0b" },
  { name: "Verkehrserziehung", farbe: "#eab308" },
];

/** Voreinstellung: welche Fächer ein Werkzeug hat, solange niemand sie ändert. */
export const STANDARD_FAECHER: Record<string, string[]> = {
  karten: ["Geografie", "Geschichte", "Sozialkunde", "Wirtschaft und Recht"],
  gleichungswaage: ["Mathematik", "Physik", "Chemie"],
  bildformate: ["Informatik"],
  vierecke: ["Mathematik"],
  binaerrechner: ["Informatik", "Mathematik"],
  funktionen: ["Mathematik"],
  ki: ["Informatik"],
  sonnensystem: ["Physik", "Astronomie", "Geografie"],
  leben: ["Wirtschaft und Recht", "Sozialkunde"],
  leviathan: ["Sozialkunde", "Wirtschaft und Recht", "Geografie"],
  kueste: ["Geografie"],
  erdaufbau: ["Geografie", "Physik"],
  wilson: ["Geografie"],
  algo: ["Informatik"],
  regeln: ["Informatik", "Mathematik"],
  wfc: ["Informatik", "Mathematik"],
  stadt: ["Geografie", "Geschichte"],
  erosion: ["Geografie", "Physik"],
  vulkan: ["Geografie", "Chemie", "Physik"],
  diagramme: ["Informatik"],
  dla: ["Physik", "Chemie", "Mathematik", "Biologie", "Informatik"],
  schichten: ["Informatik"],
  pse: ["Chemie"],
  atommodelle: ["Chemie", "Physik"],
  strukturformeln: ["Chemie"],
  verkehr: ["Verkehrserziehung"],
  abacus: ["Mathematik"],
  rechenregeln: ["Mathematik"],
  groessen: ["Mathematik", "Physik"],
  rechenzeichen: ["Mathematik"],
  tippen: ["Informatik"],
  maus: ["Informatik"],
};

/** Die gültigen Fächer eines Werkzeugs: von Hand gesetzt, sonst Voreinstellung. */
export function faecherFuer(slug: string, vonHand: Record<string, string[]> | undefined): string[] {
  return vonHand?.[slug] ?? STANDARD_FAECHER[slug] ?? [];
}

export function istVonHand(slug: string, vonHand: Record<string, string[]> | undefined): boolean {
  return !!vonHand && slug in vonHand;
}

/** Feste Farbe für bekannte Fächer, sonst eine aus dem Namen abgeleitete. */
export function fachFarbe(name: string): string {
  const bekannt = FAECHER.find(f => f.name.toLowerCase() === name.toLowerCase());
  if (bekannt) return bekannt.farbe;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h}, 60%, 50%)`;
}

/** Filter: leer = alles; sonst passt, wer mindestens eines der gewählten Fächer hat. */
export function passtZumFach(faecher: string[], gewaehlt: string[]): boolean {
  if (gewaehlt.length === 0) return true;
  const klein = new Set(faecher.map(f => f.toLowerCase()));
  return gewaehlt.some(g => klein.has(g.toLowerCase()));
}

/** Alle vorkommenden Fächer: erst die bekannten in fester Reihenfolge, dann eigene. */
export function alleFaecher(listen: string[][]): string[] {
  const da = new Map<string, string>();
  for (const l of listen) for (const f of l) if (!da.has(f.toLowerCase())) da.set(f.toLowerCase(), f);
  const bekannt = FAECHER.map(f => f.name).filter(n => da.has(n.toLowerCase()));
  const eigene = [...da.values()].filter(n => !FAECHER.some(f => f.name.toLowerCase() === n.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "de"));
  return [...bekannt, ...eigene];
}
