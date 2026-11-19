/** Erfolge der Minispiele in der 3D-Welt: Zählung und Übersicht /erfolge. */
import { beforeEach, describe, expect, it } from "vitest";
import { ERFOLGE, LEER, erreichte, ladeErfolge, nachSpiel, speichereErfolge, type KampfStand } from "@/lib/gebaeude/erfolge";
import { lieseAlle } from "@/lib/erfolge/register";

const spiel = (s: KampfStand, gut: boolean, art: Parameters<typeof nachSpiel>[1]["art"], extra: Partial<Parameters<typeof nachSpiel>[1]> = {}) =>
  nachSpiel(s, { gut, art, reaktion: null, stufe: "mittel", sammeln: false, ...extra });

describe("Minispiel-Erfolge", () => {
  beforeEach(() => localStorage.clear());

  it("erster Sieg, Serie, Comeback und Allrounder", () => {
    let s = spiel(LEER, true, "konter");
    expect(erreichte(s).has("erster-sieg")).toBe(true);
    s = spiel(s, false, "konter");
    expect(s.serie).toBe(0);
    s = spiel(s, true, "konter");
    expect(s.comeback).toBe(1);
    for (const a of ["ausweichen", "folge", "block", "ziel", "runen", "kraft"] as const) s = spiel(s, true, a);
    expect(s.besteSerie).toBe(7);
    expect(erreichte(s).has("allrounder")).toBe(true);
    expect(erreichte(s).has("serie")).toBe(true);
  });

  it("Sammelspiele zählen getrennt und brechen keine Kampfserie", () => {
    let s = spiel(LEER, true, "konter");
    for (let i = 0; i < 10; i++) s = spiel(s, i % 2 === 0, "folge", { sammeln: true });
    expect(s.gesammelt).toBe(5);
    expect(s.siege.folge).toBeUndefined();
    expect(s.serie).toBe(1);
  });

  it("Blitzreflex und Hartgesotten", () => {
    let s = spiel(LEER, true, "ausweichen", { reaktion: 0.3 });
    expect(erreichte(s).has("reflex")).toBe(true);
    for (let i = 0; i < 10; i++) s = spiel(s, true, "block", { stufe: "schwer" });
    expect(erreichte(s).has("schwer")).toBe(true);
  });

  it("steht in der Übersicht /erfolge, mit Fortschritt aus dem Speicher", () => {
    speichereErfolge(spiel(spiel(LEER, true, "block"), true, "block"));
    expect(ladeErfolge().siege.block).toBe(2);
    const w = lieseAlle().find(x => x.slug === "taskcrawler")!;
    expect(w.link).toBe("/play");
    expect(w.erfolge).toHaveLength(ERFOLGE.length);
    expect(w.erfolge.find(e => e.id === "block")).toMatchObject({ wert: 2, ziel: 5, erreicht: false });
    expect(w.erfolge.find(e => e.id === "erster-sieg")?.erreicht).toBe(true);
  });
});
