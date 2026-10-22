/** Zahlen für Anzeigen: deutsches Komma, SI-Vorsatz, drei gültige Stellen. */

const VORSAETZE = [
  { f: 1e6, z: "M" }, { f: 1e3, z: "k" }, { f: 1, z: "" },
  { f: 1e-3, z: "m" }, { f: 1e-6, z: "µ" }, { f: 1e-9, z: "n" },
];

export function formatiere(wert: number, einheit: string, stellen = 3): string {
  if (!Number.isFinite(wert)) return `– ${einheit}`;
  const betrag = Math.abs(wert);
  // Darunter misst kein Schulgerät etwas — und ein offener Schalter soll 0 zeigen.
  if (betrag < 1e-9) return `0 ${einheit}`;
  const v = VORSAETZE.find(p => betrag >= p.f * 0.9995) ?? VORSAETZE[VORSAETZE.length - 1];
  const zahl = Number((wert / v.f).toPrecision(stellen));
  return `${zahl.toLocaleString("de-DE", { maximumFractionDigits: 6 })} ${v.z}${einheit}`;
}
