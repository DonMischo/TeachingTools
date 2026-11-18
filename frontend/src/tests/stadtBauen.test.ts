import { describe, expect, it } from "vitest";
import { erzeuge } from "@/lib/gelaende/gelaende";
import { haeuser } from "@/lib/stadt/haeuser";
import { besterPunkt, baubar } from "@/lib/stadt/hilfen";
import { STILE } from "@/lib/stadt/modell";
import { BAUPLAENE, eignungsRaster, kapazitaet, lageRegeln, leererStand, pruefeOrt, schritt, stadtAus, stufeVon, type BauStand } from "@/lib/stadt/bauen";
import { zurLinie } from "@/lib/stadt/geometrie";
import type { Stil } from "@/lib/stadt/modell";
import { flussAbstand } from "@/lib/stadt/standort";

const g = erzeuge({ art: "flusstal", seed: 12, fluss: true, relief: 1 });
const markt = besterPunkt(g, 600, p => (baubar(g, p, 5) ? -Math.abs(flussAbstand(g, p) - 250) : -1e9))!;
const laufe = (s: BauStand, n: number) => { for (let i = 0; i < n; i++) s = schritt(g, "europaeisch", s); return s; };

describe("Bau-Modus", () => {
  it("jeder Bauplan kann die Pflicht-Orte seiner Stufen auch anbieten", () => {
    for (const s of STILE) {
      const p = BAUPLAENE[s.id];
      p.stufen.forEach((st, k) => {
        for (const b of st.braucht) expect(p.orte.some(o => o.bau === b && o.stufe <= k), `${s.id}: ${b}`).toBe(true);
      });
      expect(p.stufen[0].ab).toBe(0);
    }
  });

  it("Lageregeln: Mühle nur am Wasser, steiler Markt wirkt schwächer", () => {
    const fern = besterPunkt(g, 300, p => (baubar(g, p, 10) ? flussAbstand(g, p) : -1e9))!;
    expect(pruefeOrt(g, "europaeisch", "muehle", fern, [{ bau: "markt", p: markt }]).erlaubt).toBe(false);
    expect(pruefeOrt(g, "europaeisch", "markt", markt, []).faktor).toBe(1);
    const steil = besterPunkt(g, 300, p => (baubar(g, p, 45) && !baubar(g, p, 9) ? -Math.abs(flussAbstand(g, p) - 250) : -1e9))!;
    expect(pruefeOrt(g, "europaeisch", "markt", steil, []).faktor).toBeLessThan(1);
  });

  it("ohne die Pflicht-Orte stockt das Wachstum vor der nächsten Stufe", () => {
    const nurMarkt = laufe({ ...leererStand(), orte: [{ bau: "markt", p: markt }] }, 300);
    expect(stufeVon(BAUPLAENE.europaeisch, nurMarkt.einwohner)).toBe(0);
    expect(kapazitaet(g, "europaeisch", { ...leererStand(), orte: [{ bau: "markt", p: markt }, { bau: "kirche", p: markt }, { bau: "rathaus", p: markt }] }).gedeckelt).toBe(true);
    const burg = g.berg ?? { x: markt.x + 300, y: markt.y };
    const mitBurg = laufe({ ...leererStand(), orte: [{ bau: "markt", p: markt }, { bau: "burg", p: burg }] }, 300);
    expect(stufeVon(BAUPLAENE.europaeisch, mitBurg.einwohner)).toBe(1);
  });

  it("aus Orten und Einwohnern entsteht eine Stadt mit Häusern, immer gleich", () => {
    const stand: BauStand = { orte: [{ bau: "markt", p: markt }], einwohner: 3000, tick: 0 };
    const a = stadtAus(g, "europaeisch", stand, 12);
    const b = stadtAus(g, "europaeisch", stand, 12);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(haeuser(a, g, 1).length).toBeGreaterThan(80);
    const gross = stadtAus(g, "europaeisch", { ...stand, einwohner: 12000 }, 12);
    expect(haeuser(gross, g, 1).length).toBeGreaterThan(haeuser(a, g, 1).length);
  });

  it("jeder Stadttyp baut aus seinem ersten Ort eine Stadt", () => {
    for (const s of STILE) {
      const b = BAUPLAENE[s.id].zentrum ?? BAUPLAENE[s.id].stufen[0].braucht[0];
      const st = stadtAus(g, s.id, { orte: [{ bau: b, p: markt }], einwohner: 2500, tick: 0 }, 3);
      expect(haeuser(st, g, 1).length, s.id).toBeGreaterThan(20);
    }
  });

  it("stehen alle Pflichtbauten gut, erreicht jede Stadt die nächste Stufe (auch die römische)", () => {
    const forum = besterPunkt(g, 600, p => pruefeOrt(g, "roemisch", "forum", p, []).faktor - Math.abs(flussAbstand(g, p) - 400) / 1e4)!;
    expect(pruefeOrt(g, "roemisch", "forum", forum, []).faktor).toBe(1);
    const tempel = { x: forum.x + 60, y: forum.y };
    let st: BauStand = { ...leererStand(), orte: [{ bau: "forum", p: forum }, { bau: "tempel", p: tempel }] };
    for (let k = 0; k < 400; k++) st = schritt(g, "roemisch", st);
    expect(stufeVon(BAUPLAENE.roemisch, st.einwohner)).toBe(1);
  });

  it("Lageregeln stehen vorab als Text bereit, die Eignungskarte zeigt gute und verbotene Felder", () => {
    for (const s of ["europaeisch", "hafen"] as Stil[]) for (const o of BAUPLAENE[s].orte) expect(lageRegeln(s, o.bau).soll.every(t => t.length > 5)).toBe(true);
    const e = eignungsRaster(g, "europaeisch", "muehle", [{ bau: "markt", p: markt }], 40);
    expect(e.some(x => x === 1)).toBe(true);
    expect(e.some(x => x === 0)).toBe(true);
  });

  it("zwei Bahnhöfe: eine Bahn durch beide, jeder mit eigenem Viertel", () => {
    const b1 = { x: markt.x + 500, y: markt.y + 300 }, b2 = { x: markt.x - 600, y: markt.y + 500 };
    const st = stadtAus(g, "europaeisch", { orte: [{ bau: "markt", p: markt }, { bau: "bahnhof", p: b1 }, { bau: "bahnhof", p: b2 }], einwohner: 20000, tick: 0 }, 2);
    const bahn = st.strassen.filter(x => x.art === "bahn");
    expect(bahn.length).toBe(1);
    expect(zurLinie(b1, bahn[0].punkte).d).toBeLessThan(40);
    expect(zurLinie(b2, bahn[0].punkte).d).toBeLessThan(40);
    expect(st.zonen.filter(z => z.typ === "gruenderzeit").length).toBe(2);
  });
});
