/**
 * Seitenformat der Kartenfläche: »frei« = so hoch wie der Bildschirm erlaubt; bei A4 hat die
 * Karte genau das Verhältnis des freien Platzes auf Seite 1 des Arbeitsblatts (unter Titel,
 * Name/Klasse und Aufgabe), damit sie im Export die Seite füllt. Das Blatt ist immer hochkant:
 * »A4 quer« ist dieselbe Fläche, um 90° gedreht (der Server dreht Querformat-Karten beim Export).
 * Maße: KARTENFLAECHE_CM in api/karten_export.py.
 */
export type Seite = "frei" | "a4-hoch" | "a4-quer";

export const SEITEN: { id: Seite; name: string; text: string; verhaeltnis?: number }[] = [
  { id: "frei", name: "Bildschirm", text: "So groß wie das Fenster" },
  // 176 × 223 mm (1,5-cm-Ränder, Kopf mit zwei Zeilen Aufgabe und Quellenzeile abgezogen)
  { id: "a4-hoch", name: "A4 hoch", text: "Füllt Seite 1 im Hochformat", verhaeltnis: 0.79 },
  // dieselbe Fläche quer gelegt: 223 × 176 mm, auf dem Blatt um 90° gedreht
  { id: "a4-quer", name: "A4 quer", text: "Füllt Seite 1 quer (gedreht)", verhaeltnis: 1.27 },
];

export const verhaeltnisVon = (s: Seite | undefined) => SEITEN.find((x) => x.id === s)?.verhaeltnis;
