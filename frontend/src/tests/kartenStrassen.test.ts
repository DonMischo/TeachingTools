// Straßenebenen: kleinere Straßen zeichnen dünner (darstellung.breite)
import { describe, expect, it } from "vitest";
import { baueStil, type Ebene } from "@/lib/karten/stil";

const quelle = { name: "BKG", lizenz: "", url: "" };
const strasse = (id: string, breite?: number): Ebene => ({ id, name: id, gruppe: "wirtschaft", bereich: "de", geometrie: "linie", quiz: false, bytes: 0, quelle,
  darstellung: { feld: "art", art: "kategorie", ...(breite ? { breite } : {}), werte: [{ wert: "x", text: "x", farbe: "#000000" }] } });

describe("Straßen", () => {
  it("skaliert die Strichstärke mit darstellung.breite, ohne Angabe bleibt sie wie bisher", () => {
    const ebenen = [strasse("de-kreisstrassen", 0.4), strasse("de-autobahnen")];
    const st = baueStil({ stand: "", ebenen }, { ebenen: ebenen.map((e) => e.id), beschriftung: false }, "topographisch");
    const breite = (id: string) => (st.layers.find((l) => l.id === `${id}:linie`)!.paint as Record<string, unknown>)["line-width"];
    expect(breite("de-autobahnen")).toEqual(["interpolate", ["linear"], ["zoom"], 4, 1.2, 9, 3]);
    expect(breite("de-kreisstrassen")).toEqual(["interpolate", ["linear"], ["zoom"], 4, 1.2 * 0.4, 9, 3 * 0.4]);
  });
});
