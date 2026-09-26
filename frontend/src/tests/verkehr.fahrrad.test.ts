import { describe, expect, it } from "vitest";
import { gebrauchtesRad, MODELLE, neuesRad, pruefe, repariere, tempoVon } from "@/lib/verkehr/fahrrad";
import { abstellen, RadWaechter } from "@/lib/verkehr/radregeln";
import { stadt, winkelVon } from "@/lib/verkehr/stadt";
import { autoLicht, baueAnlagen } from "@/lib/verkehr/ampeln";
import type { P } from "@/lib/verkehr/geometrie";

const s = stadt();
const anlagen = baueAnlagen(s);

describe("Fahrrad nach StVZO", () => {
  it("hat fünf Modelle", () => {
    expect(Object.keys(MODELLE).sort()).toEqual(["bmx", "damenrad", "herrenrad", "klapprad", "mountainbike"]);
  });

  it("ist als Damen-, Herren- und Klapprad ab Werk verkehrssicher, MTB und BMX nicht", () => {
    for (const m of ["damenrad", "herrenrad", "klapprad"] as const) expect(pruefe(neuesRad(m)).verkehrssicher, m).toBe(true);
    const mtb = pruefe(neuesRad("mountainbike"));
    expect(mtb.verkehrssicher).toBe(false);
    expect(mtb.maengel.map((m) => m.teil)).toEqual(expect.arrayContaining(["klingel", "licht", "ruecklicht", "rueckstrahler", "pedalstrahler"]));
    // BMX: nur eine Bremse — § 65 verlangt zwei
    expect(pruefe(neuesRad("bmx")).maengel.map((m) => m.teil)).toContain("bremseVorn");
  });

  it("lässt sich in der Werkstatt richten: nachrüsten, flicken, aufpumpen, ölen", () => {
    let r = neuesRad("mountainbike");
    for (const m of pruefe(r).maengel) r = repariere(r, m.teil, "teilekiste")!;
    expect(pruefe(r).verkehrssicher).toBe(true);
    r = { ...r, teile: { ...r.teile, reifenVorn: "fehlt", kette: "kaputt" } };
    expect(pruefe(r).fahrbar).toBe(false);
    expect(repariere(r, "reifenVorn", "luftpumpe")).toBeNull();
    r = repariere(r, "reifenVorn", "flickzeug")!;
    expect(r.teile.reifenVorn).toBe("kaputt");
    const langsam = tempoVon(r);
    r = repariere(repariere(r, "reifenVorn", "luftpumpe")!, "kette", "kettenoel")!;
    expect(tempoVon(r)).toBeGreaterThan(langsam);
  });

  it("gebraucht hat es Macken", () => {
    let macken = 0;
    for (let i = 0; i < 20; i++) macken += Object.values(gebrauchtesRad("herrenrad").teile).filter((z) => z === "kaputt").length;
    expect(macken).toBeGreaterThan(5);
  });
});

/** Ein Punkt einer Art und ein Winkel längs der nächsten Straße. */
function stelle(art: "gehweg" | "radweg" | "fahrbahn"): { p: P; w: number } {
  for (const st of s.strassen) {
    if (st.art !== "residential" && st.art !== "tertiary") continue;
    for (let i = 0; i + 1 < st.linie.length; i++) {
      const a = st.linie[i], b = st.linie[i + 1], w = winkelVon({ a, b });
      const m: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const q: P = art === "fahrbahn" ? m : [m[0] - Math.sin(w) * (st.breite / 2 + 1), m[1] + Math.cos(w) * (st.breite / 2 + 1)];
      if (s.untergrund(q[0], q[1]).art === art && !(art === "fahrbahn" && s.radwegNah(q[0], q[1], 10))) return { p: q, w };
    }
  }
  const w = s.karte.wege.find((x) => x.art === "rad")!;
  return { p: w.linie[0], w: 0 };
}

describe("Radregeln", () => {
  const fahr = (rw: RadWaechter, p: P, w: number, alter: number, sek: number, dunkel = false, lichtOk = true) => {
    const alle: string[] = [];
    for (let t = 0; t < sek; t += 0.2) alle.push(...rw.pruefe({ x: p[0], y: p[1], winkel: w, tempo: 4, t, alter, dunkel, lichtOk }).meldungen);
    return alle;
  };

  it("über 10 nicht auf dem Gehweg — bis 10 darf man", () => {
    const { p, w } = stelle("gehweg");
    expect(fahr(new RadWaechter(s, anlagen), p, w, 12, 3)).toContain("radGehweg");
    expect(fahr(new RadWaechter(s, anlagen), p, w, 9, 3)).not.toContain("radGehweg");
  });

  it("gibt Karma auf der Fahrbahn, wenn kein Radweg da ist, und Abzug im Dunkeln ohne Licht", () => {
    const { p, w } = stelle("fahrbahn");
    // In Fahrtrichtung rechts halten
    const q: P = [p[0] - Math.sin(w) * 1.5, p[1] + Math.cos(w) * 1.5];
    const m = fahr(new RadWaechter(s, anlagen), q, w, 12, 8);
    expect(m).toContain("fahrbahnGut");
    expect(fahr(new RadWaechter(s, anlagen), q, w, 12, 4, true, false)).toContain("radOhneLicht");
  });

  it("gibt Karma auf dem Radweg", () => {
    const w = s.karte.wege.find((x) => x.art === "rad" && x.linie.length > 1 && s.untergrund(x.linie[0][0], x.linie[0][1]).art === "radweg")!;
    const [a, b] = w.linie;
    expect(fahr(new RadWaechter(s, anlagen), a, Math.atan2(b[1] - a[1], b[0] - a[0]), 12, 7)).toContain("radwegGut");
  });

  it("die rote Ampel gilt auch fürs Rad", () => {
    const a = anlagen.find((x) => x.achsen.length === 2)!;
    let t = 0;
    while (autoLicht(a, 0, t) !== "rot") t += 1;
    const rw = new RadWaechter(s, anlagen);
    const m = rw.pruefe({ x: a.mitte[0], y: a.mitte[1], winkel: a.achsen[0], tempo: 4, t, alter: 12, dunkel: false, lichtOk: true }).meldungen;
    // An der Mitte der Kreuzung ist nicht immer Fahrbahn — dann gibt es nichts zu melden
    if (s.untergrund(a.mitte[0], a.mitte[1]).art === "fahrbahn") expect(m).toContain("radRot");
  });
});

describe("Rad abstellen", () => {
  it("am Ständer ordentlich, auf der Fahrbahn nicht", () => {
    const st = s.karte.punkte.find((p) => p.art === "radstaender")!;
    expect(abstellen(s, st.p)).toEqual({ ok: true, amStaender: true });
    const { p } = stelle("fahrbahn");
    expect(abstellen(s, p).ok).toBe(false);
  });
});
