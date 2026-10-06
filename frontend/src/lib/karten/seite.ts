/**
 * Seitenformat der Kartenfläche: »frei« = so hoch wie der Bildschirm erlaubt; bei A4 hat die
 * Karte genau das Verhältnis des freien Platzes auf Seite 1 des Arbeitsblatts (unter Titel,
 * Name/Klasse und Aufgabe), damit sie im Export die Seite füllt. Breiten in api/karten_export.py.
 */
export type Seite = "frei" | "a4-hoch" | "a4-quer";

export const SEITEN: { id: Seite; name: string; text: string; verhaeltnis?: number }[] = [
  { id: "frei", name: "Bildschirm", text: "So groß wie das Fenster" },
  // 170 × 195 mm (Satzspiegel 2-cm-Ränder, Kopf und Quellenzeile abgezogen, etwas Luft für längere Aufgaben)
  { id: "a4-hoch", name: "A4 hoch", text: "Füllt Seite 1 im Hochformat", verhaeltnis: 0.87 },
  // 257 × 117 mm
  { id: "a4-quer", name: "A4 quer", text: "Füllt Seite 1 im Querformat", verhaeltnis: 2.2 },
];

export const verhaeltnisVon = (s: Seite | undefined) => SEITEN.find((x) => x.id === s)?.verhaeltnis;
