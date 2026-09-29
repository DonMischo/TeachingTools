/**
 * Was in einem Zimmer steht. Das Gebäude zeichnet es, der Inhalt (Exitgame,
 * Demo, später Verkehr/Rock your Life) sucht es aus.
 */
export const OBJEKTE = [
  "pult", "computer", "kuckucksuhr", "globus", "regal", "mikroskop",
  "tafel", "laborbank", "tresor", "teleskop", "kalender", "waage", "abakus",
] as const;

export type Objekt = (typeof OBJEKTE)[number];

export const OBJEKT_NAME: Record<Objekt, string> = {
  pult: "Schreibtisch", computer: "Computer", kuckucksuhr: "Kuckucksuhr", globus: "Globus",
  regal: "Bücherregal", mikroskop: "Mikroskop", tafel: "Tafel", laborbank: "Labortisch",
  tresor: "Tresor", teleskop: "Teleskop", kalender: "Wandkalender", waage: "Waage", abakus: "Abakus",
};

export function istObjekt(x: unknown): x is Objekt {
  return typeof x === "string" && (OBJEKTE as readonly string[]).includes(x);
}
