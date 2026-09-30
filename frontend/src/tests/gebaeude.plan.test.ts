import { describe, expect, it } from "vitest";
import { abstaende, bauePlan, begehbar, weg } from "@/lib/gebaeude/plan";
import { abschnitte, seedAus, stationsObjekt } from "@/lib/gebaeude/exitgame";
import { istObjekt } from "@/lib/gebaeude/objekte";
import type { ExitGameSlide } from "@/lib/api";

describe("Gebäudeplan", () => {
  it.each([[[3]], [[2, 5, 1]], [[8, 8]], [[0, 4]]])("baut Stockwerke mit %j Zimmern", zimmer => {
    for (const seed of [1, 2, 3, 99]) {
      const plan = bauePlan(zimmer, seed);
      expect(plan.stockwerke).toHaveLength(zimmer.length);
      plan.stockwerke.forEach((st, i) => {
        expect(st.raeume).toHaveLength(zimmer[i]);
        const d = abstaende(plan.R, st, st.start);
        // alles erreichbar, auch Treppe und jedes Zimmer
        expect(st.boden.every((b, j) => !b || d[j] >= 0)).toBe(true);
        expect(d[st.ziel[1] * plan.R + st.ziel[0]]).toBeGreaterThan(0);
        const orte = new Set<string>([`${st.ziel}`, `${st.start}`]);
        for (const r of st.raeume) {
          // Sackgasse: genau ein Nachbar offen, und der ist die Tür
          const offen = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => begehbar(plan.R, st, [r.x + dx, r.y + dy]));
          expect(offen).toHaveLength(1);
          expect([r.x + offen[0][0], r.y + offen[0][1]]).toEqual(r.tuer);
          orte.add(`${r.x},${r.y}`);
        }
        // keine zwei Dinge am selben Ort
        expect(orte.size).toBe(zimmer[i] + 2);
        // Zimmer 1 liegt nicht weiter weg als das letzte
        if (st.raeume.length > 1) {
          const dist = st.raeume.map(r => d[r.y * plan.R + r.x]);
          expect(dist[0]).toBeLessThanOrEqual(dist[dist.length - 1]);
        }
        // das Stockwerk darüber beginnt über der Treppe
        if (i > 0) expect(st.start).toEqual(plan.stockwerke[i - 1].ziel);
      });
    }
  });

  it.each([[[3, 4, 2]], [[6]], [[0, 5]]])("Ebene: Abschnitte nebeneinander, Tür am rechten Rand (%j)", zimmer => {
    for (const seed of [1, 2, 3, 42]) {
      const plan = bauePlan(zimmer, seed, "ebene");
      expect(plan.flach).toBe(true);
      plan.stockwerke.forEach((st, i) => {
        expect(st.raeume).toHaveLength(zimmer[i]);
        // Ausgang in der rechten Spalte, erreichbar, kein Zimmer
        expect(st.ziel[0]).toBe(plan.R - 2);
        const d = abstaende(plan.R, st, st.start);
        expect(d[st.ziel[1] * plan.R + st.ziel[0]]).toBeGreaterThan(0);
        expect(st.raeume.some(r => r.x === st.ziel[0] && r.y === st.ziel[1])).toBe(false);
        expect(st.raeume.some(r => r.x === st.start[0] && r.y === st.start[1])).toBe(false);
        for (const r of st.raeume) {
          const offen = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => begehbar(plan.R, st, [r.x + dx, r.y + dy]));
          expect(offen).toHaveLength(1);
        }
        // der nächste Abschnitt beginnt links in derselben Zeile
        if (i > 0) expect(st.start).toEqual([1, plan.stockwerke[i - 1].ziel[1]]);
      });
    }
  });

  it.each([[[3, 4, 2]], [[6]], [[1, 1]]])("Verlies: Säle, Gänge, Türen, Treppe im fernsten Saal (%j)", zimmer => {
    for (const seed of [1, 2, 7, 42]) {
      const plan = bauePlan(zimmer, seed, "verlies");
      plan.stockwerke.forEach((st, i) => {
        expect(st.raeume).toHaveLength(zimmer[i]);
        const d = abstaende(plan.R, st, st.start);
        // alles begehbare hängt zusammen, jeder Saal und die Treppe sind erreichbar
        expect(st.boden.every((b, j) => !b || d[j] >= 0)).toBe(true);
        for (const r of st.raeume) {
          expect(r.flaeche).toHaveLength(25);
          expect(r.flaeche!.every(([x, y]) => begehbar(plan.R, st, [x, y]))).toBe(true);
          expect(begehbar(plan.R, st, r.tuer)).toBe(true);
          expect(d[r.y * plan.R + r.x]).toBeLessThanOrEqual(d[st.ziel[1] * plan.R + st.ziel[0]]);
        }
        // die nächste Ebene beginnt unter der Treppe
        if (i > 0) expect(st.start).toEqual(plan.stockwerke[i - 1].ziel);
      });
    }
  });

  it("gleicher Seed, gleiches Haus", () => {
    expect(bauePlan([4, 4], 7)).toEqual(bauePlan([4, 4], 7));
    expect(bauePlan([4, 4], 7)).not.toEqual(bauePlan([4, 4], 8));
  });

  it("findet den Weg zu jedem Zimmer", () => {
    const plan = bauePlan([5], 3);
    const st = plan.stockwerke[0];
    for (const r of st.raeume) {
      const w = weg(plan.R, st, st.start, [r.x, r.y]);
      expect(w.at(-1)).toEqual([r.x, r.y]);
      expect(w.at(-2)).toEqual(r.tuer);
      w.forEach(p => expect(begehbar(plan.R, st, p)).toBe(true));
    }
    expect(weg(plan.R, st, st.start, [0, 0])).toEqual([]);
  });
});

describe("TaskCrawler als Gebäude", () => {
  const s = (id: string, type: ExitGameSlide["type"]): ExitGameSlide => ({ id, type });

  it("teilt die Folien an den Türen in Stockwerke", () => {
    const slides = [s("a", "explanation"), s("b", "task"), s("t1", "door"), s("c", "task"), s("t2", "door"), s("d", "explanation")];
    expect(abschnitte(slides)).toEqual([
      { raeume: [0, 1], tuer: 2 },
      { raeume: [3], tuer: 4 },
      { raeume: [5], tuer: null },
    ]);
  });

  it("endet hinter der letzten Tür, wenn danach nichts kommt", () => {
    expect(abschnitte([s("a", "task"), s("t", "door")])).toEqual([{ raeume: [0], tuer: 1 }]);
    expect(abschnitte([s("a", "task")])).toEqual([{ raeume: [0], tuer: null }]);
  });

  it("macht aus dem Code einen festen Seed", () => {
    expect(seedAus("ABC123")).toBe(seedAus("ABC123"));
    expect(seedAus("ABC123")).not.toBe(seedAus("ABC124"));
  });

  it("sucht für jede Station ein passendes Objekt aus", () => {
    const task = { kind: "input" as const, accept: ["5"] };
    // Angabe im JSON gewinnt, Unsinn wird ignoriert
    expect(stationsObjekt({ id: "a", type: "task", task, station: "kuckucksuhr" })).toBe("kuckucksuhr");
    expect(istObjekt(stationsObjekt({ id: "a", type: "task", task, station: "toaster" }))).toBe(true);
    // Werkzeug bestimmt das Objekt
    expect(stationsObjekt({ id: "a", type: "task", task: { ...task, sim: { tool: "gleichungswaage" } } })).toBe("waage");
    expect(stationsObjekt({ id: "a", type: "task", tasks: [task, { ...task, sim: { tool: "sonnensystem" } }] })).toBe("teleskop");
    expect(stationsObjekt({ id: "a", type: "task", task: { kind: "timeline" } })).toBe("kalender");
    expect(stationsObjekt({ id: "a", type: "task", task: { ...task, sim: { tool: "ki" } } })).toBe("kikern");
    // sonst reihum, aber fest je Folie — und nicht überall Tafel und Schreibtisch
    expect(stationsObjekt({ id: "x7", type: "task", task })).toBe(stationsObjekt({ id: "x7", type: "task", task }));
    const ids = Array.from({ length: 30 }, (_, i) => `folie-${i}`);
    expect(new Set(ids.map(id => stationsObjekt({ id, type: "explanation" }))).size).toBeGreaterThanOrEqual(5);
    expect(new Set(ids.map(id => stationsObjekt({ id, type: "task", task }))).size).toBeGreaterThanOrEqual(6);
  });
});
