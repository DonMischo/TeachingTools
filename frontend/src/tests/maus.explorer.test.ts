import { describe, it, expect } from "vitest";
import {
  anfangsStand, ausschneiden, einfuegen, istFalscherZielordner, klick, kopieren, leeren, loeschen,
  neuerOrdner, oeffnen, sichtbareDateien, strgKlick, umbenennen, umschaltKlick,
  verschieben, zurueck,
} from "@/lib/maus/explorer";

describe("Explorer: Markieren", () => {
  it("Klick markiert genau ein Element", () => {
    let s = anfangsStand();
    s = klick(s, "mathe");
    expect(s.auswahl).toEqual(["mathe"]);
    s = klick(s, "deutsch");
    expect(s.auswahl).toEqual(["deutsch"]);
  });

  it("Strg+Klick schaltet einzelne Elemente dazu und weg", () => {
    let s = anfangsStand();
    s = klick(s, "mathe");
    s = strgKlick(s, "deutsch");
    s = strgKlick(s, "englisch");
    expect(s.auswahl.sort()).toEqual(["deutsch", "englisch", "mathe"].sort());
    s = strgKlick(s, "deutsch");
    expect(s.auswahl.sort()).toEqual(["englisch", "mathe"].sort());
  });

  it("Umschalt+Klick markiert den Bereich in Anzeige-Reihenfolge", () => {
    let s = anfangsStand();
    const ids = sichtbareDateien(s).map(d => d.id);
    s = klick(s, ids[1]);
    s = umschaltKlick(s, ids[4]);
    expect(s.auswahl).toEqual(ids.slice(1, 5));
  });

  it("Umschalt+Klick funktioniert auch rückwärts", () => {
    let s = anfangsStand();
    const ids = sichtbareDateien(s).map(d => d.id);
    s = klick(s, ids[4]);
    s = umschaltKlick(s, ids[1]);
    expect(s.auswahl).toEqual(ids.slice(1, 5));
  });

  it("zeigt alphabetisch — die vier Fächer liegen nicht nebeneinander", () => {
    const ids = sichtbareDateien(anfangsStand()).map(d => d.id);
    expect(ids).toEqual([
      "deutsch", "einkaufsliste", "englisch", "ferien", "geburtstag", "klassenfoto", "mathe", "schullied", "technik",
    ]);
  });

  it("ohne Anker verhält sich Umschalt+Klick wie ein normaler Klick", () => {
    let s = anfangsStand();
    s = umschaltKlick(s, "mathe");
    expect(s.auswahl).toEqual(["mathe"]);
  });

  it("Klick auf freie Fläche leert die Auswahl", () => {
    let s = anfangsStand();
    s = klick(s, "mathe");
    s = leeren(s);
    expect(s.auswahl).toEqual([]);
    expect(s.anker).toBeNull();
  });
});

describe("Explorer: Neuer Ordner und Umbenennen", () => {
  it("legt einen neuen, ausgewählten Ordner an", () => {
    let s = anfangsStand();
    s = neuerOrdner(s);
    const neu = s.dateien.find(d => d.name === "Neuer Ordner");
    expect(neu?.art).toBe("ordner");
    expect(s.auswahl).toEqual([neu!.id]);
  });

  it("vergibt bei mehrfachem Anlegen unterschiedliche Namen", () => {
    let s = anfangsStand();
    s = neuerOrdner(s);
    s = neuerOrdner(s);
    const namen = s.dateien.filter(d => d.art === "ordner").map(d => d.name).sort();
    expect(namen).toEqual(["Neuer Ordner", "Neuer Ordner (2)"]);
  });

  it("benennt ein Element um", () => {
    let s = anfangsStand();
    s = neuerOrdner(s);
    const id = s.auswahl[0];
    const r = umbenennen(s, id, "Schule");
    expect(r.fehler).toBeUndefined();
    expect(r.stand.dateien.find(d => d.id === id)?.name).toBe("Schule");
  });

  it("lehnt einen leeren Namen ab", () => {
    let s = anfangsStand();
    const r = umbenennen(s, "mathe", "   ");
    expect(r.fehler).toBe("leer");
    expect(r.stand.dateien.find(d => d.id === "mathe")?.name).toBe("Mathe.docx");
  });

  it("lehnt einen bereits vergebenen Namen im selben Ordner ab", () => {
    let s = anfangsStand();
    const r = umbenennen(s, "mathe", "Deutsch.docx");
    expect(r.fehler).toBe("vergeben");
  });

  it("F2 ohne Auswahl (unbekannte id) ändert nichts", () => {
    const s = anfangsStand();
    const r = umbenennen(s, "nix-da", "Irgendwas");
    expect(r.fehler).toBe("leer");
    expect(r.stand).toBe(s);
  });
});

describe("Explorer: Verschieben, Ausschneiden, Einfügen", () => {
  function mitSchulordner() {
    let s = anfangsStand();
    s = neuerOrdner(s);
    const ordnerId = s.auswahl[0];
    s = umbenennen(s, ordnerId, "Schule").stand;
    return { s, ordnerId };
  }

  it("verschiebt mehrere Dateien per Ziehen in einen Ordner", () => {
    let { s, ordnerId } = mitSchulordner();
    s = verschieben(s, ["mathe", "deutsch", "englisch"], ordnerId);
    expect(s.dateien.find(d => d.id === "mathe")?.parent).toBe(ordnerId);
    expect(s.dateien.find(d => d.id === "deutsch")?.parent).toBe(ordnerId);
    expect(s.dateien.find(d => d.id === "englisch")?.parent).toBe(ordnerId);
    // aus der Wurzel verschwunden
    expect(sichtbareDateien(s).map(d => d.id)).not.toContain("mathe");
  });

  it("Strg+X dann Strg+V verschiebt in den geöffneten Ordner", () => {
    let { s, ordnerId } = mitSchulordner();
    s = strgKlick(klick(s, "mathe"), "deutsch");
    s = ausschneiden(s);
    s = oeffnen(s, ordnerId);
    s = einfuegen(s);
    const drin = sichtbareDateien(s).map(d => d.id).sort();
    expect(drin).toEqual(["deutsch", "mathe"]);
    // Zwischenablage ist nach dem Einfügen (Ausschneiden) verbraucht.
    expect(s.zwischenablage).toBeNull();
  });

  it("Kopieren+Einfügen erzeugt eine Kopie mit eigener id, Original bleibt", () => {
    let s = anfangsStand();
    s = klick(s, "mathe");
    s = kopieren(s);
    s = neuerOrdner(s);
    const ordnerId = s.auswahl[0];
    s = oeffnen(s, ordnerId);
    s = einfuegen(s);
    expect(sichtbareDateien(s)).toHaveLength(1);
    expect(sichtbareDateien(s)[0].id).not.toBe("mathe");
    expect(sichtbareDateien(s)[0].name).toBe("Mathe.docx");
    s = zurueck(s);
    expect(s.dateien.some(d => d.id === "mathe")).toBe(true);
  });

  it("Einfügen ohne Zwischenablage ändert nichts", () => {
    const s = anfangsStand();
    expect(einfuegen(s)).toBe(s);
  });
});

describe("Explorer: Löschen, Öffnen, Zurück", () => {
  it("löscht die Auswahl und zählt sie im Papierkorb", () => {
    let s = anfangsStand();
    s = strgKlick(klick(s, "mathe"), "deutsch");
    s = loeschen(s);
    expect(s.papierkorb).toBe(2);
    expect(sichtbareDateien(s).map(d => d.id)).not.toContain("mathe");
    expect(s.auswahl).toEqual([]);
  });

  it("Doppelklick öffnet einen Ordner, Zurück verlässt ihn wieder", () => {
    let s = anfangsStand();
    s = neuerOrdner(s);
    const ordnerId = s.auswahl[0];
    s = oeffnen(s, ordnerId);
    expect(s.aktuellerOrdner).toBe(ordnerId);
    expect(sichtbareDateien(s)).toEqual([]);
    s = zurueck(s);
    expect(s.aktuellerOrdner).toBe("");
  });

  it("Öffnen einer nicht existierenden id ändert nichts", () => {
    const s = anfangsStand();
    expect(oeffnen(s, "mathe")).toBe(s); // Mathe ist kein Ordner
  });

  it("Zurück an der Wurzel ändert nichts", () => {
    const s = anfangsStand();
    expect(zurueck(s)).toBe(s);
  });
});

describe("Explorer: falscher Zielordner", () => {
  it("erkennt eine Ablage außerhalb des Schulordners", () => {
    expect(istFalscherZielordner("", "schule-1")).toBe(true);
    expect(istFalscherZielordner("anderer-ordner", "schule-1")).toBe(true);
  });

  it("erkennt die richtige Ablage im Schulordner", () => {
    expect(istFalscherZielordner("schule-1", "schule-1")).toBe(false);
  });

  it("ohne bekannten Schulordner gibt es noch keinen Fehler", () => {
    expect(istFalscherZielordner("irgendwo", null)).toBe(false);
  });
});

describe("Explorer: Anzeige-Reihenfolge", () => {
  it("zeigt Ordner vor Dateien", () => {
    let s = anfangsStand();
    s = neuerOrdner(s);
    const sichtbar = sichtbareDateien(s);
    expect(sichtbar[0].art).toBe("ordner");
  });
});
