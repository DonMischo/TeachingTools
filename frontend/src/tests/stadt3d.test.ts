import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { erzeuge, hoeheBei } from "@/lib/gelaende/gelaende";
import { haeuser } from "@/lib/stadt/haeuser";
import { wachse } from "@/lib/stadt/wachstum";
import { baueStadtSzene } from "@/components/stadt/drei/szene";

const g = erzeuge({ art: "flusstal", seed: 12, fluss: true, relief: 1 });
const s = wachse("europaeisch", g, 12)[2].stadt;
const hs = haeuser(s, g, 1);

describe("3D-Stadt", () => {
  it("jedes Haus wird eine Instanz, Wahrzeichen und Bäume stehen", () => {
    const sz = baueStadtSzene(g, s, hs, null, null, null, 1);
    const inst: THREE.InstancedMesh[] = [];
    sz.gruppe.traverse(o => { if ((o as THREE.InstancedMesh).isInstancedMesh) inst.push(o as THREE.InstancedMesh); });
    expect(inst.some(m => m.count === hs.length)).toBe(true);
    expect(inst.reduce((a, m) => a + m.count, 0)).toBeGreaterThan(hs.length * 2);
    sz.entsorge();
  });

  it("Laufen: Boden folgt dem Gelände, Häuser und Fluss halten auf", () => {
    const sz = baueStadtSzene(g, s, hs, null, null, null, 1);
    const h2 = g.breite / 2;
    const h = hs[10];
    expect(sz.frei(h.c.x - h2, h.c.y - h2)).toBe(false);
    const p = { x: 300, y: 300 };
    expect(sz.boden(p.x - h2, p.y - h2)).toBeCloseTo(hoeheBei(g, p.x, p.y), 3);
    const fluss = g.flussLinie[Math.floor(g.flussLinie.length / 2)];
    const strasseNah = s.strassen.some(st => st.punkte.some(q => Math.hypot(q.x - fluss.x, q.y - fluss.y) < 20));
    if (!strasseNah) expect(sz.frei(fluss.x - h2, fluss.y - h2)).toBe(false);
    sz.entsorge();
  });
});
