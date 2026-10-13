// Kinderatlas (Netz »Robinson Crusoe«): rechnet als Robinson, bunte Länder, Tiere/Pflanzen nach Wahl, Menü.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { vor } from "@/lib/karten/projektion";
import { baueStil, type Ebene } from "@/lib/karten/stil";
import { KINDER_EINTRAEGE, kinderPunkte } from "@/lib/karten/kinderatlas";
import KartenMenue from "@/components/karten/KartenMenue";

const quelle = { name: "NE", lizenz: "", url: "" };
const ebenen: Ebene[] = [
  { id: "welt-staaten", name: "Staaten", gruppe: "politisch", bereich: "welt", geometrie: "flaeche", quiz: true, bytes: 0, quelle },
  { id: "welt-hoehen", name: "Relief", gruppe: "topographisch", bereich: "welt", geometrie: "raster", quiz: false, bytes: 0,
    kachelUrl: "/karten/welt-hoehen/{z}/{x}/{y}.webp", quelle },
];

describe("Kinderatlas", () => {
  it("liegt im Robinson-Netz und holt Robinson-Daten und -Kacheln", () => {
    expect(vor([10, 60], "kinder")).toEqual(vor([10, 60], "robinson"));
    const st = baueStil({ stand: "", ebenen }, { ebenen: ["welt-staaten", "welt-hoehen"], beschriftung: true, projektion: "kinder" }, "topographisch");
    expect((st.sources["welt-staaten"] as { data: string }).data).toBe("/api/karten/ebenen/welt-staaten?projektion=robinson");

    // auch auf der topographischen Karte bunte Länder
    const flaeche = st.layers.find((l) => l.id === "welt-staaten:flaeche") as { paint: Record<string, unknown> };
    expect(JSON.stringify(flaeche.paint["fill-color"])).toContain("#ffd166");
    expect(st.layers.at(-1)!.id).toBe("kinder:bild");
  });

  it("lässt im Kinderatlas Relief, Gebirge und kleine Flüsse weg", () => {
    const st = baueStil({ stand: "", ebenen }, { ebenen: ["welt-staaten", "welt-hoehen"], beschriftung: true, projektion: "kinder" }, "topographisch");
    expect(st.layers.some((l) => l.id === "welt-hoehen:raster")).toBe(false);
  });

  it("zeigt nur, was gewählt ist", () => {
    const tiere = kinderPunkte(["tiere"], "kinder").features;
    expect(tiere.length).toBe(KINDER_EINTRAEGE.filter((e) => e.art === "tiere").length);
    expect(tiere.every((f) => f.properties!.art === "tiere")).toBe(true);
    expect(kinderPunkte([], "kinder").features).toHaveLength(0);
    // Bildstil: Illustration (SVG-Datei) oder niedliche Kachel
    const loewe = (stil?: "illustriert" | "niedlich") => kinderPunkte(["tiere"], "kinder", stil).features.find((f) => f.properties!.name === "Löwe")!;
    expect(String(loewe().properties!.bild)).toMatch(/^kindbild:loewe:#/);
    expect(String(loewe("niedlich").properties!.bild)).toMatch(/^kind:#/);
    // andere Netze: kein Kinderatlas
    const st = baueStil({ stand: "", ebenen }, { ebenen: ["welt-staaten"], beschriftung: true, projektion: "robinson" }, "politisch");
    expect(st.sources["kinder"]).toBeUndefined();
  });

  it("Menü: Tiere/Pflanzen nur im Kinderatlas", () => {
    const setKinderatlas = vi.fn();
    const { rerender } = render(<KartenMenue projektion="robinson" setProjektion={() => {}} kinderatlas={["tiere", "pflanzen"]} setKinderatlas={setKinderatlas} />);
    fireEvent.click(screen.getByLabelText("Kartenmenü"));
    expect(screen.getByLabelText(/Robinson Crusoe/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Kinderatlas" })).toBeNull();
    rerender(<KartenMenue projektion="kinder" setProjektion={() => {}} kinderatlas={["tiere", "pflanzen"]} setKinderatlas={setKinderatlas} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Pflanzen/ }));
    expect(setKinderatlas).toHaveBeenCalledWith(["tiere"]);
  });
});
