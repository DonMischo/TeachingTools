/** Gesten der Figur: ein Kreis mit Emoji über dem Kopf, 2 s lang. */

export type GestenId = "laecheln" | "hand" | "danke" | "schimpfen";

export type Geste = { id: GestenId; emoji: string; name: string; taste: string; beleidigung?: boolean };

export const GESTEN: Geste[] = [
  { id: "laecheln", emoji: "😊", name: "Lächeln", taste: "1" },
  { id: "hand", emoji: "✋", name: "Hand raus — ich will über die Straße", taste: "2" },
  { id: "danke", emoji: "👋", name: "Danke winken", taste: "3" },
  { id: "schimpfen", emoji: "🤬", name: "Schimpfen", taste: "4", beleidigung: true },
];

export const GESTE_DAUER = 2;

/** Deckkraft einer Geste `alter` Sekunden nach dem Zeigen — die letzte halbe Sekunde blendet sie aus. */
export function gestenDeckkraft(alter: number): number {
  if (alter < 0 || alter >= GESTE_DAUER) return 0;
  return Math.min(1, (GESTE_DAUER - alter) / 0.5);
}

export function gesteZuTaste(code: string): Geste | undefined {
  return GESTEN.find((g) => code === `Digit${g.taste}` || code === `Numpad${g.taste}`);
}
