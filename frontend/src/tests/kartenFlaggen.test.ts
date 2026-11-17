// Flaggen-Ebene und politische Färbung auf der Quizkarte
import { describe, expect, it } from "vitest";
import { baueStil, wendeSatzAn, type Ebene } from "@/lib/karten/stil";

const quelle = { name: "x", lizenz: "", url: "" };
const ebene = (id: string, geometrie: Ebene["geometrie"], bereich: Ebene["bereich"] = "de"): Ebene =>
  ({ id, name: id, gruppe: "politisch", bereich, geometrie, quiz: true, bytes: 0, quelle });

describe("Flaggen", () => {
  it("zeichnet je Objekt die Flagge aus ihrer Datei, klickbar und nach Größe sortiert", () => {
    const ebenen = [ebene("welt-flaggen", "punkt", "welt")];
    const st = baueStil({ stand: "", ebenen }, { ebenen: ["welt-flaggen"], beschriftung: false }, "politisch");
    const l = st.layers.find((x) => x.id === "welt-flaggen:symbol")!;
    expect(l.type).toBe("symbol");
    expect((l.layout as Record<string, unknown>)["icon-image"]).toEqual(["concat", "flagge:", ["get", "flagge"]]);
    expect((l.layout as Record<string, unknown>)["symbol-sort-key"]).toEqual(["get", "rang"]);
  });

  it("Bundesländer färben sich über »farbe« — das Kürzel fehlt auf der Quizkarte", () => {
    const ebenen = [ebene("de-laender", "flaeche")];
    const st = baueStil({ stand: "", ebenen }, { ebenen: ["de-laender"], beschriftung: false }, "politisch");
    const farbe = JSON.stringify((st.layers.find((x) => x.id === "de-laender:flaeche")!.paint as Record<string, unknown>)["fill-color"]);
    expect(farbe).toContain('["get","farbe"]');
    expect(farbe).not.toContain("kurz");
  });

  it("Marken auf Flaggen rücken über die Flagge", () => {
    const ebenen = [ebene("de-flaggen", "punkt")];
    const grund = baueStil({ stand: "", ebenen }, { ebenen: ["de-flaggen"], beschriftung: false }, "politisch");
    const st = wendeSatzAn(grund, { stand: "", ebenen }, { auswahl: {}, nummern: {}, bearbeiten: false, anker: { type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: [11, 51] }, properties: { marke: "1", ebene: "de-flaggen" } }] } });
    const daten = (st.sources.nummern as { data: GeoJSON.FeatureCollection }).data;
    expect(daten.features[0].properties).toMatchObject({ versatz: [0, -22], verschoben: false });
  });
});
