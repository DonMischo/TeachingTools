// Atlas-Signaturen: Punkte als Zeichen statt Kreise, Flächen mit Zeichen am Namenspunkt, Legende ohne Canvas.
import { describe, expect, it } from "vitest";
import { baueStil, type Ebene } from "@/lib/karten/stil";
import { signaturAusdruck, signaturUrl, signaturVon } from "@/lib/karten/signaturen";

const quelle = { name: "OPSD", lizenz: "", url: "" };
const kraftwerke: Ebene = { id: "de-kraftwerke", name: "Kraftwerke", gruppe: "wirtschaft", bereich: "de", geometrie: "punkt", quiz: false, bytes: 0, quelle,
  darstellung: { feld: "art", art: "kategorie", groesse: { feld: "leistung", max: 4000 },
    werte: [{ wert: "braunkohle", text: "Braunkohle", farbe: "#8b5a2b" }, { wert: "kernenergie", text: "Kernenergie", farbe: "#e41a1c" }] } };
const industrie: Ebene = { id: "de-industrie", name: "Industrie", gruppe: "wirtschaft", bereich: "de", geometrie: "flaeche", quiz: false, bytes: 0, quelle,
  darstellung: { feld: "art", art: "kategorie", werte: [{ wert: "industrie", text: "Industrie", farbe: "#b2182b" }] } };

describe("Atlas-Signaturen", () => {
  it("wählt je Wert das Zeichen: Blitz für Kohle, Strahlenzeichen für Kernkraft, Rest fällt auf »*«", () => {
    expect(signaturVon("de-kraftwerke", "braunkohle")).toEqual({ bild: "blitz", grund: "quadrat" });
    expect(signaturVon("eu-kraftwerke", "kernenergie")).toEqual({ bild: "atom", grund: "kreis" });
    expect(signaturVon("de-bergbau", "historisch")?.grund).toBe("hohl");
    expect(signaturVon("welt-staedte", "x")).toBeNull();
    expect(signaturAusdruck("de-kraftwerke", kraftwerke.darstellung!)).toEqual(
      ["match", ["get", "art"], "braunkohle", "sig:blitz:quadrat:#8b5a2b", "kernenergie", "sig:atom:kreis:#e41a1c", ""]);
  });

  it("Stil: Kraftwerke als Symbol mit Größe nach Leistung, Industrieflächen mit Zeichen am Namenspunkt", () => {
    const st = baueStil({ stand: "", ebenen: [kraftwerke, industrie] }, { ebenen: ["de-kraftwerke", "de-industrie"], beschriftung: false }, "topographisch");
    const punkt = st.layers.find((l) => l.id === "de-kraftwerke:punkt")!;
    expect(punkt.type).toBe("symbol");
    expect((punkt.layout as Record<string, unknown>)["icon-image"]).toEqual(signaturAusdruck("de-kraftwerke", kraftwerke.darstellung!));
    const zeichen = st.layers.find((l) => l.id === "de-industrie:zeichen")!;
    expect((zeichen as { source: string }).source).toBe("de-industrie:namen");
  });

  it("Legende fällt ohne Canvas (jsdom) auf das Farbfeld zurück", () => {
    expect(signaturUrl("de-kraftwerke", "braunkohle", "#8b5a2b")).toBeNull();
  });
});
