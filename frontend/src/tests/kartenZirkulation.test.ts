// Wind und Meeresströmungen: Stil mit Lauflicht und Pfeilen, Filter nach Monat.
import { describe, expect, it } from "vitest";
import { baueStil, istLauflicht, type Ebene } from "@/lib/karten/stil";

const WINDE: Ebene = {
  id: "welt-winde", name: "Windsysteme", gruppe: "topographisch", bereich: "welt", geometrie: "linie", quiz: true, bytes: 0, monate: true,
  quelle: { name: "TT", lizenz: "eigene Daten", url: "" },
  darstellung: { feld: "art", art: "kategorie", werte: [{ wert: "passat", text: "Passat", farbe: "#e07b00" }, { wert: "itc", text: "ITC", farbe: "#b91c1c" }] },
};

describe("Zirkulation im Kartenstil", () => {
  it("zeichnet Linie, Lauflicht, Pfeile und Gürtel — gefiltert nach dem gewählten Monat", () => {
    const stil = baueStil({ stand: "", ebenen: [WINDE] }, { ebenen: ["welt-winde"], beschriftung: true, filter: { "welt-winde": ["1"] } }, "topographisch");
    const ids = stil.layers.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(["welt-winde:linie", "welt-winde:gurt", "welt-winde:fluss", "welt-winde:pfeil"]));
    expect(ids.filter(istLauflicht)).toEqual(["welt-winde:fluss"]);
    const linie = stil.layers.find((l) => l.id === "welt-winde:linie") as { filter: unknown };
    expect(JSON.stringify(linie.filter)).toContain('",1,"');
    // Ohne Wahl: Juli
    const juli = baueStil({ stand: "", ebenen: [WINDE] }, { ebenen: ["welt-winde"], beschriftung: false }, "topographisch");
    expect(JSON.stringify(juli.layers.find((l) => l.id === "welt-winde:linie"))).toContain('",7,"');
  });
});
