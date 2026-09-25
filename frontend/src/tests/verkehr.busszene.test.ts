import { describe, expect, it } from "vitest";
import { AUSSEN_Y, Busszene, drin, imFreiraum, inWartezone, TUER_X, tuerZonen, type Lage, type SzenenMeldung } from "@/lib/verkehr/busszene";
import { HALT, tuerPhase } from "@/lib/verkehr/tueren";

const DT = 0.05;

/** Einen ganzen Halt abspielen; `jeTakt` darf den Spieler steuern. */
function halt(sz: Busszene, t0: number, fuellung: number, jeTakt?: (t: number, phase: Lage["phase"]) => void, name = "h1") {
  const meldungen: SzenenMeldung[] = [];
  const hinweise = new Set<string>();
  let eingestiegen: number | undefined;
  const ende = HALT.oeffnen + HALT.aussteigen + HALT.einsteigen + HALT.schliessen + 3;
  for (let a = 0; a < ende; a += DT) {
    const phase = a < ende - 3 ? tuerPhase(a) : "faehrt";
    jeTakt?.(t0 + a, phase);
    const r = sz.schritt({ t: t0 + a, dt: DT, phase, halt: name, beschleunigung: 0, fuellung });
    meldungen.push(...r.meldungen);
    if (r.hinweis) hinweise.add(r.hinweis);
    if (r.eingestiegen !== undefined) eingestiegen = r.eingestiegen;
  }
  return { meldungen, hinweise, eingestiegen };
}

describe("Bus-Szene: Zonen wie auf dem Schaubild", () => {
  it("hat drei Türen: vorn beim Fahrer, Mitte, hinten", () => {
    expect(TUER_X).toHaveLength(3);
    expect(TUER_X[0]).toBeGreaterThan(4);
  });
  it("trennt Warten (seitlich) und Freihalten (vor der Tür)", () => {
    const z = tuerZonen(1);
    expect(imFreiraum(1, TUER_X[1], AUSSEN_Y + 1)).toBe(true);
    expect(inWartezone(1, z.warten[0][0], z.warten[0][1])).toBe(true);
    expect(imFreiraum(1, z.warten[0][0], z.warten[0][1])).toBe(false);
  });
});

describe("Bus-Szene: Fahrgäste", () => {
  it("lässt Leute aus- und einsteigen", () => {
    const sz = new Busszene(7, 0.5, 0);
    const vorher = sz.fahrgaeste.filter((f) => f.zustand === "drin").length;
    expect(vorher).toBeGreaterThan(10);
    halt(sz, 0, 0.5);
    // Niemand steckt in einer Wand oder draußen im Weg herum
    const drinnen = sz.fahrgaeste.filter((f) => drin(f.x, f.y));
    expect(drinnen.length).toBeGreaterThan(5);
    expect(sz.fahrgaeste.every((f) => f.zustand === "drin")).toBe(true);
  });

  it("setzt Leute auf Sitze und belegt jeden Sitz höchstens einmal", () => {
    const sz = new Busszene(3, 0.8, 0);
    const belegt = sz.sitze.filter((s) => s.belegt).map((s) => s.belegt);
    expect(new Set(belegt).size).toBe(belegt.length);
    for (const f of sz.fahrgaeste.filter((f) => f.sitz !== null)) expect(sz.sitze[f.sitz!].belegt).toBe(f.id);
  });
});

describe("Bus-Szene: der Spieler", () => {
  it("wird gelobt, wer seitlich wartet und danach einsteigt", () => {
    const sz = new Busszene(11, 0.3, 0);
    sz.mitIch = true;
    const w = tuerZonen(1).warten[0];
    Object.assign(sz.ich, { x: w[0], y: w[1] });
    let bilder = 0;
    const { meldungen } = halt(sz, 0, 0.3, (t, phase) => {
      // Ein Bild nach dem Öffnen zum Einsteigen: an die Tür, E
      if (phase === "einsteigen" && ++bilder === 2) { sz.ich.x = TUER_X[1]; sz.ich.y = AUSSEN_Y + 0.4; sz.aktion(t); }
    });
    expect(sz.ich.drin).toBe(true);
    expect(meldungen).toContain("gutEingestiegen");
    expect(meldungen).not.toContain("tuerBlockiert");
  });

  it("meldet, wer vor der Tür steht, während andere aussteigen — und schiebt ihn", () => {
    // Samen suchen, bei dem an der Mitteltür jemand aussteigt
    for (let samen = 1; samen < 40; samen++) {
      const sz = new Busszene(samen, 0.9, 0);
      sz.mitIch = true;
      Object.assign(sz.ich, { x: TUER_X[1], y: AUSSEN_Y + 0.7 });
      const { meldungen } = halt(sz, 0, 0.9);
      if (!meldungen.includes("tuerBlockiert")) continue;
      expect(Math.hypot(sz.ich.x - TUER_X[1], sz.ich.y - (AUSSEN_Y + 0.7))).toBeGreaterThan(0.2);
      return;
    }
    throw new Error("nie blockiert");
  });

  it("fällt beim Bremsen, wer frei steht — nicht, wer sitzt", () => {
    const sz = new Busszene(5, 0.1, 0);
    sz.mitIch = true;
    // Frei im Bereich vor der Mitteltür, keine Stange nah
    Object.assign(sz.ich, { x: 0.4, y: 0.45 });
    expect(sz.haeltSich(sz.ich)).toBe(false);
    const r = sz.schritt({ t: 1, dt: DT, phase: "faehrt", halt: null, beschleunigung: 3, fuellung: 0.1 });
    expect(r.meldungen).toContain("nichtFestgehalten");
    const sitzend = new Busszene(5, 0.1, 0);
    sitzend.mitIch = true;
    const frei = sitzend.sitze.find((s) => !s.belegt)!;
    Object.assign(sitzend.ich, { x: frei.p[0], y: 0 });
    sitzend.aktion(0);
    expect(sitzend.ich.sitz).not.toBeNull();
    expect(sitzend.schritt({ t: 1, dt: DT, phase: "faehrt", halt: null, beschleunigung: 3, fuellung: 0.1 }).meldungen).not.toContain("nichtFestgehalten");
  });

  it("belohnt, wer für eine ältere Dame aufsteht", () => {
    for (let samen = 1; samen < 80; samen++) {
      const sz = new Busszene(samen, 1, 0);
      sz.mitIch = true;
      // Der Spieler sitzt schon (Bus voll)
      const s = sz.sitze.find((x) => x.belegt)!;
      const f = sz.fahrgaeste.find((x) => x.id === s.belegt)!;
      f.zustand = "weg"; s.belegt = "ich"; sz.ich.sitz = s.id; sz.ich.x = s.p[0]; sz.ich.y = s.p[1];
      let angeboten: SzenenMeldung | null = null;
      halt(sz, 0, 1, (t) => {
        const senior = sz.fahrgaeste.find((x) => x.art === "senior" && x.zustand === "drin" && x.sitz === null);
        if (senior && !angeboten) angeboten = sz.aktion(t);
      });
      if (!angeboten) continue;
      expect(angeboten).toBe("platzAngeboten");
      expect(sz.ich.sitz).toBeNull();
      return;
    }
    throw new Error("keine ältere Dame ohne Sitz gefunden");
  });

  it("nimmt den Rucksack ab — im Bus gibt das Punkte", () => {
    const sz = new Busszene(2, 0.5, 0);
    Object.assign(sz.ich, { x: 0.4, y: 0.4 });
    expect(sz.rucksack()).toBe("rucksackAb");
    expect(sz.ich.rucksack).toBe(false);
  });
});
