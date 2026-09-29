import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { bauePlan } from "@/lib/gebaeude/plan";
import { OBJEKTE } from "@/lib/gebaeude/objekte";
import { baueStock, ortAmStrahl, welt } from "@/components/gebaeude/szene";

/** Kamera wie im Gebäude: orthografisch, schräg von oben auf `ziel` */
function kamera(ziel: THREE.Vector3) {
  const k = new THREE.OrthographicCamera(-9.5, 9.5, 9.5, -9.5, -200, 400);
  const a = Math.PI / 4;
  k.position.set(ziel.x + Math.cos(a) * 50, ziel.y + 42, ziel.z + Math.sin(a) * 50);
  k.lookAt(ziel);
  k.updateMatrixWorld();
  k.updateProjectionMatrix();
  return k;
}

function klickAuf(stock: THREE.Object3D, k: THREE.Camera, punkt: THREE.Vector3) {
  const ndc = punkt.clone().project(k);
  const z = new THREE.Raycaster();
  z.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), k);
  return ortAmStrahl(stock, z);
}

describe("Klick im Gebäude", () => {
  const plan = bauePlan([OBJEKTE.length], 5);
  const st = plan.stockwerke[0];
  const stock = baueStock(plan, 0, {
    zustaende: st.raeume.map(() => "offen"), zielOffen: false, zielArt: "treppe", unten: false, objekte: [...OBJEKTE],
  });
  stock.updateMatrixWorld(true);

  it("trifft jedes Zimmer über sein Schild und über sein Objekt", () => {
    st.raeume.forEach((r, k) => {
      const mitte = new THREE.Vector3(welt(r.x), 0, welt(r.y));
      const cam = kamera(mitte);
      // Schild schwebt über dem Zimmer
      expect(klickAuf(stock, cam, mitte.clone().setY(2.3))).toEqual({ art: "raum", raum: k });
      // das Objekt (Computer, Kuckucksuhr …) etwa in halber Höhe
      expect(klickAuf(stock, cam, mitte.clone().setY(0.8))).toEqual({ art: "raum", raum: k });
    });
  });

  it("trifft die Treppe und lässt leere Flure dem Boden", () => {
    const t = new THREE.Vector3(welt(st.ziel[0]), 1, welt(st.ziel[1]));
    expect(klickAuf(stock, kamera(t), t)).toEqual({ art: "ziel" });
    const flur = new THREE.Vector3(welt(st.start[0]), 0.25, welt(st.start[1]));
    expect(klickAuf(stock, kamera(flur), flur)).toBeNull();
  });
});
