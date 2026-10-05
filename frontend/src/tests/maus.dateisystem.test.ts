import { describe, it, expect } from "vitest";
import { USB, ablegen, baueDateisystem, darfSpeichern, kinder, neueDatei, pfadText } from "@/lib/maus/dateisystem";

describe("Dateisystem: USB-Stick", () => {
  it("erscheint erst, wenn er eingesteckt ist", () => {
    expect(kinder(baueDateisystem("Mia"), "pc").map(k => k.id)).not.toContain("usb");
    expect(kinder(baueDateisystem("Mia", true), "pc").map(k => k.id)).toContain("usb");
  });

  it("hat den Laufwerksbuchstaben D: im Pfad", () => {
    const fs = baueDateisystem("Mia", true);
    expect(pfadText(fs, "usb")).toBe("D:");
    expect(pfadText(fs, "dokumente")).toBe(["C:", "Benutzer", "Mia", "Dokumente"].join(String.fromCharCode(92)));
  });

  it("darauf darf gespeichert werden, in Systemordnern nicht", () => {
    const fs = { ...baueDateisystem("Mia"), usb: USB };
    expect(darfSpeichern(fs, "usb")).toBe(true);
    expect(darfSpeichern(fs, "dokumente")).toBe(true);
    expect(darfSpeichern(fs, "c-windows")).toBe(false);
    expect(darfSpeichern(fs, "c")).toBe(false);
  });
});

describe("Dateisystem: Ablegen", () => {
  function mitDatei() {
    const { fs, id } = neueDatei(baueDateisystem("Mia", true), "dokumente", "Mein Tier.txt", "editor");
    return { fs, id };
  }

  it("kopiert auf den USB-Stick — die Datei bleibt in Dokumente", () => {
    const { fs, id } = mitDatei();
    const r = ablegen(fs, id, "usb");
    expect(r?.kopiert).toBe(true);
    expect(r!.fs[id].eltern).toBe("dokumente");
    expect(r!.fs[r!.id]).toMatchObject({ name: "Mein Tier.txt", eltern: "usb" });
  });

  it("verschiebt innerhalb desselben Laufwerks", () => {
    const { fs, id } = mitDatei();
    const r = ablegen(fs, id, "bilder");
    expect(r?.kopiert).toBe(false);
    expect(r!.fs[id].eltern).toBe("bilder");
  });

  it("tut nichts, wenn der Name im Ziel schon da ist oder das Ziel gesperrt ist", () => {
    const { fs, id } = mitDatei();
    const einmal = ablegen(fs, id, "usb")!;
    expect(ablegen(einmal.fs, id, "usb")).toBeNull();
    expect(ablegen(fs, id, "c-windows")).toBeNull();
    expect(ablegen(fs, id, "dokumente")).toBeNull();
  });
});
