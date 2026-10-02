// Siedlungsfilter: Voreinstellung nur große Städte; Ortsteile anhaken schaltet die Datei der kleinen Orte zu.
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import SiedlungsFilter from "@/components/karten/SiedlungsFilter";
import { erlaubteWerte, type Ebene } from "@/lib/karten/stil";
import type { SatzInhalt } from "@/lib/karten/satz";

const WERTE = [
  { wert: "grossstadt", text: "Großstädte", standard: true },
  { wert: "kleinstadt", text: "Kleinstädte", standard: false },
  { wert: "ortsteil", text: "Ortsteile", standard: false },
];
const ebene = (id: string, vorhanden: string[]): Ebene => ({
  id, name: id, gruppe: "politisch", bereich: "de", geometrie: "punkt", quiz: true, bytes: 0,
  quelle: { name: "", lizenz: "", url: "" }, filter: { feld: "rang", werte: WERTE, vorhanden },
});
const STAEDTE = ebene("de-staedte", ["grossstadt", "kleinstadt"]);
const ORTE = ebene("de-orte", ["ortsteil"]);

let zuletzt: SatzInhalt | null = null;
function Test() {
  const [inhalt, setInhalt] = useState<SatzInhalt>({ art: "politisch", region: "deutschland", ebenen: ["de-staedte"], beschriftung: true, ausschnitt: null, auswahl: {} });
  zuletzt = inhalt;
  return <SiedlungsFilter ebenen={[STAEDTE, ORTE]} inhalt={inhalt} setInhalt={setInhalt} />;
}

describe("Siedlungsfilter", () => {
  it("Voreinstellung: nur Standardklassen; Datei ohne Standard zeigt alle ihre Klassen", () => {
    expect(erlaubteWerte(STAEDTE, undefined)).toEqual(["grossstadt"]);
    expect(erlaubteWerte(ORTE, undefined)).toEqual(["ortsteil"]);
  });

  it("Ortsteile anhaken schaltet de-orte zu, abhaken wieder ab", () => {
    render(<Test />);
    expect((screen.getByLabelText("Großstädte") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Ortsteile") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByLabelText("Ortsteile"));
    expect(zuletzt!.ebenen).toContain("de-orte");
    expect(zuletzt!.filter?.["de-orte"]).toEqual(["ortsteil"]);
    fireEvent.click(screen.getByLabelText("Kleinstädte"));
    expect(zuletzt!.filter?.["de-staedte"]).toEqual(["grossstadt", "kleinstadt"]);
    fireEvent.click(screen.getByLabelText("Ortsteile"));
    expect(zuletzt!.ebenen).not.toContain("de-orte");
  });
});
