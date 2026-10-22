/** Schaltungen zum Loslegen. */
import type { Schaltung } from "./modell";

/** Batterie, Schalter, Lämpchen — der erste Stromkreis im Unterricht. */
export const START: Schaltung = {
  version: 1,
  bauteile: [
    { id: "b1", art: "batterie", a: { x: 4, y: 10 }, b: { x: 4, y: 4 }, werte: {} },
    { id: "b2", art: "schalter", a: { x: 8, y: 4 }, b: { x: 12, y: 4 }, werte: { geschlossen: 1 } },
    { id: "b3", art: "lampe", a: { x: 16, y: 4 }, b: { x: 16, y: 10 }, werte: {} },
  ],
  draehte: [
    { id: "d1", a: { x: 4, y: 4 }, b: { x: 8, y: 4 } },
    { id: "d2", a: { x: 12, y: 4 }, b: { x: 16, y: 4 } },
    { id: "d3", a: { x: 16, y: 10 }, b: { x: 4, y: 10 } },
  ],
};
