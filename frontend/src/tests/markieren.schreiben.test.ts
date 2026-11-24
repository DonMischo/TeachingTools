import { describe, expect, it } from "vitest";
import { SCHREIB_LEKTIONEN, richtigBis, stimmt, tastenFuer } from "@/lib/markieren/schreiben";
import { SPICKZETTEL, teile } from "@/lib/markieren/spickzettel";
import { MODI, challengeAufgaben } from "@/lib/markieren/aufgaben";

describe("Schreiben", () => {
  it("nennt für Alt-Gr-Zeichen beide Tasten", () => {
    expect(tastenFuer("@")).toEqual({ codes: ["AltRight", "KeyQ"], text: "[[AltGr]] + [[Q]]" });
    expect(tastenFuer("€")?.codes).toEqual(["AltRight", "KeyE"]);
  });
  it("nennt Umschalt für Großbuchstaben und Zeichen der Zahlenreihe", () => {
    expect(tastenFuer("A")?.codes).toContain("KeyA");
    expect(tastenFuer("A")?.text).toMatch(/Umschalt/);
    expect(tastenFuer("§")?.codes).toContain("Digit3");
    expect(tastenFuer("a")?.codes).toEqual(["KeyA"]);
  });
  it("jedes Zeichen jeder Abtipp-Lektion hat eine Tastenhilfe", () => {
    for (const l of SCHREIB_LEKTIONEN.filter(l => !l.vorgaben)) {
      for (const satz of l.saetze) for (const c of satz) expect(tastenFuer(c), `${l.id}: ${c}`).not.toBeNull();
    }
  });
  it("Rechtschreibung: Vorgabe und Lösung gleich lang verteilt und verschieden", () => {
    const r = SCHREIB_LEKTIONEN.find(l => l.vorgaben)!;
    expect(r.vorgaben!.length).toBe(r.saetze.length);
    r.saetze.forEach((s, i) => expect(stimmt(r.vorgaben![i], s)).toBe(false));
  });
  it("prüft genau, Rand-Leerzeichen zählen nicht", () => {
    expect(stimmt(" Halt! Stopp! ", "Halt! Stopp!")).toBe(true);
    expect(stimmt("halt! Stopp!", "Halt! Stopp!")).toBe(false);
    expect(richtigBis("Haxt", "Halt")).toBe(2);
  });
});

describe("Spickzettel", () => {
  it("zerlegt Kombinationen in Kappen und Text", () => {
    expect(teile("[[Strg]] + [[C]]")).toEqual([{ taste: true, text: "Strg" }, { taste: false, text: " + " }, { taste: true, text: "C" }]);
  });
  it("hat die Sonderzeichen-Gruppe", () => {
    expect(SPICKZETTEL.some(g => g.titel === "Sonderzeichen")).toBe(true);
  });
});

describe("Challenge Nur Tastatur", () => {
  it("würfelt nur Aufgaben ohne Mausgriffe", () => {
    expect(MODI.tastatur.typen).not.toContain("vonBis");
    expect(challengeAufgaben("tastatur")).toHaveLength(MODI.tastatur.anzahl);
  });
});

describe("Spickzettel-PDF", () => {
  it("passt auf eine A4-Seite", async () => {
    const { spickzettelPdf } = await import("@/lib/markieren/spickzettel");
    const doc = await spickzettelPdf();
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
