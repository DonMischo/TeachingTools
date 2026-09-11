import { describe, it, expect } from "vitest";
import { bildAusDaten, istText, groesseGleich } from "@/lib/maus/screenshot";

function bilddatei(name = "foto.png") {
  return new File(["x"], name, { type: "image/png" });
}

describe("Maus-Führerschein: Bildschirmfoto-Logik", () => {
  it("findet ein Bild unter items", () => {
    const datei = bilddatei();
    const daten = { items: [{ kind: "file", type: "image/png", getAsFile: () => datei }] };
    expect(bildAusDaten(daten)).toBe(datei);
  });

  it("findet ein Bild unter files, wenn keine items passen", () => {
    const datei = bilddatei();
    const daten = { files: [datei] };
    expect(bildAusDaten(daten)).toBe(datei);
  });

  it("ignoriert Text-Items bei items und findet kein Bild", () => {
    const daten = { items: [{ kind: "string", type: "text/plain" }] };
    expect(bildAusDaten(daten)).toBeNull();
  });

  it("erkennt reinen Text", () => {
    const daten = { items: [{ kind: "string", type: "text/plain" }] };
    expect(istText(daten)).toBe(true);
  });

  it("Text ist kein Text, wenn auch ein Bild dabei ist", () => {
    const datei = bilddatei();
    const daten = { items: [
      { kind: "string", type: "text/plain" },
      { kind: "file", type: "image/png", getAsFile: () => datei },
    ] };
    expect(istText(daten)).toBe(false);
  });

  it("leere Daten sind weder Bild noch Text", () => {
    expect(bildAusDaten({})).toBeNull();
    expect(istText({})).toBe(false);
  });

  it("vergleicht Bildmaße", () => {
    expect(groesseGleich({ width: 100, height: 50 }, { width: 100, height: 50 })).toBe(true);
    expect(groesseGleich({ width: 100, height: 50 }, { width: 200, height: 50 })).toBe(false);
  });

  it("ein getAsFile, das null liefert, zählt nicht als Bild", () => {
    const daten = { items: [{ kind: "file", type: "image/png", getAsFile: () => null }] };
    expect(bildAusDaten(daten)).toBeNull();
  });
});
