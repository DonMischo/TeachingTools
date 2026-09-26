import { describe, expect, it } from "vitest";
import { stadt } from "@/lib/verkehr/stadt";
import { baueAnlagen } from "@/lib/verkehr/ampeln";
import { baueKreuzungen, VorfahrtWaechter, type Arm, type Kreuzung } from "@/lib/verkehr/vorfahrt";
import { baueSchilder } from "@/lib/verkehr/schilder";
import { RadWaechter } from "@/lib/verkehr/radregeln";

const s = stadt();
const anlagen = baueAnlagen(s);
const kreuzungen = baueKreuzungen(s, anlagen);

/** Radfahrer kommt über `arm` auf die Kreuzung zu (Abstand d), mit Blick zur Mitte. */
const aufArm = (k: Kreuzung, arm: Arm, d: number) => ({
  x: k.p[0] + Math.cos(arm.winkel) * d, y: k.p[1] + Math.sin(arm.winkel) * d, winkel: arm.winkel + Math.PI,
});
/** Ein Auto auf `arm`, 12 m vor der Mitte, flott unterwegs zur Kreuzung. */
const autoAuf = (k: Kreuzung, arm: Arm) => ({ ...aufArm(k, arm, 12), tempo: 8 });

/** Fährt den Radfahrer von 20 m bis in die Mitte; `halt` = kurz anhalten, `schaut` = umschauen. */
function fahre(w: VorfahrtWaechter, k: Kreuzung, arm: Arm, autos: () => ReturnType<typeof autoAuf>[], opt: { halt?: boolean; schaut?: boolean } = {}) {
  const alle: string[] = [];
  let t = 0;
  for (let d = 20; d >= 0; d -= 0.5, t += 0.1) {
    const halt = opt.halt && d === 8;
    const l = { ...aufArm(k, arm, d), tempo: halt ? 0 : 5, t, schaut: !!opt.schaut && d < 15 && d > 10 };
    alle.push(...w.pruefe(l, d < 9 ? autos() : []).meldungen);
  }
  return alle;
}

describe("Vorfahrt an Kreuzungen", () => {
  it("findet Kreuzungen mit allen Regeln", () => {
    const regeln = new Set(kreuzungen.flatMap((k) => k.arme.map((a) => a.regel)));
    expect(kreuzungen.length).toBeGreaterThan(200);
    for (const r of ["ampel", "vorfahrt", "warten", "stopp", "rechtsVorLinks"]) expect(regeln, r).toContain(r);
  });

  it("die größere Straße hat Vorfahrt, die kleinere wartet", () => {
    const k = kreuzungen.find((k) => k.arme.some((a) => a.strasse.art === "secondary" && a.regel === "vorfahrt") && k.arme.some((a) => a.strasse.art === "residential"))!;
    expect(k.arme.find((a) => a.strasse.art === "residential")!.regel).toBe("warten");
  });

  it("Vorfahrt genommen: Auto auf der Vorfahrtstraße, Rad aus der Seitenstraße", () => {
    const k = kreuzungen.find((k) => k.arme.some((a) => a.regel === "warten") && k.arme.some((a) => a.regel === "vorfahrt"))!;
    const neben = k.arme.find((a) => a.regel === "warten")!, haupt = k.arme.find((a) => a.regel === "vorfahrt")!;
    expect(fahre(new VorfahrtWaechter(kreuzungen), k, neben, () => [autoAuf(k, haupt)], { schaut: true })).toContain("radVorfahrt");
  });

  it("gewartet und geschaut: Karma; ohne Schauen: Hinweis-Abzug", () => {
    const k = kreuzungen.find((k) => k.arme.some((a) => a.regel === "warten") && k.arme.some((a) => a.regel === "vorfahrt"))!;
    const neben = k.arme.find((a) => a.regel === "warten")!, haupt = k.arme.find((a) => a.regel === "vorfahrt")!;
    // Das Auto kommt, während man wartet — und ist durch, wenn man fährt
    const w = new VorfahrtWaechter(kreuzungen);
    const alle: string[] = [];
    let t = 0;
    for (let d = 20; d >= 0; d -= 0.5, t += 0.1) {
      const l = { ...aufArm(k, neben, d), tempo: 5, t, schaut: d < 15 };
      alle.push(...w.pruefe(l, d > 10 ? [autoAuf(k, haupt)] : []).meldungen);
    }
    expect(alle).toContain("radVorfahrtGut");
    expect(fahre(new VorfahrtWaechter(kreuzungen), k, neben, () => [])).toContain("radNichtGeschaut");
  });

  it("auf der Vorfahrtstraße gibt es nichts zu melden", () => {
    const k = kreuzungen.find((k) => k.arme.some((a) => a.regel === "warten") && k.arme.some((a) => a.regel === "vorfahrt"))!;
    const neben = k.arme.find((a) => a.regel === "warten")!, haupt = k.arme.find((a) => a.regel === "vorfahrt")!;
    expect(fahre(new VorfahrtWaechter(kreuzungen), k, haupt, () => [autoAuf(k, neben)])).toEqual([]);
  });

  it("rechts vor links: nur das Auto von rechts hat Vorfahrt", () => {
    const k = kreuzungen.find((k) => k.arme.length === 4 && k.arme.every((a) => a.regel === "rechtsVorLinks"))!;
    const ich = k.arme[0];
    const w = new VorfahrtWaechter(kreuzungen);
    const rechts = k.arme.find((a) => w.vorrang(k, ich, ich.winkel + Math.PI, [autoAuf(k, a)]).length > 0)!;
    expect(rechts).toBeDefined();
    // rechts = Fahrtrichtung + 90° (y nach Süden)
    const fahrt = ich.winkel + Math.PI;
    expect(Math.cos(rechts.winkel - (fahrt + Math.PI / 2))).toBeGreaterThan(0.7);
    const andere = k.arme.filter((a) => a !== ich && a !== rechts);
    expect(andere.every((a) => w.vorrang(k, ich, fahrt, [autoAuf(k, a)]).length === 0)).toBe(true);
    expect(fahre(w, k, ich, () => [autoAuf(k, rechts)], { schaut: true })).toContain("radVorfahrt");
  });

  it("am Stoppschild ganz anhalten", () => {
    const k = kreuzungen.find((k) => k.arme.some((a) => a.regel === "stopp"))!;
    const arm = k.arme.find((a) => a.regel === "stopp")!;
    expect(fahre(new VorfahrtWaechter(kreuzungen), k, arm, () => [], { schaut: true })).toContain("radStopp");
    expect(fahre(new VorfahrtWaechter(kreuzungen), k, arm, () => [], { schaut: true, halt: true })).not.toContain("radStopp");
  });

  it("stellt Vorfahrtstraße und Vorfahrt gewähren auf, nicht an jeder Einfahrt", () => {
    const schilder = baueSchilder(s, kreuzungen);
    const n = (art: string) => schilder.filter((x) => x.art === art).length;
    expect(n("vorfahrtstrasse")).toBeGreaterThan(20);
    expect(n("vorfahrtAchten")).toBeGreaterThan(40);
    expect(n("gehRadGetrennt")).toBeGreaterThan(0);
    expect(n("radfrei")).toBeGreaterThan(0);
    expect(schilder.length).toBeLessThan(4000);
  });
});

describe("Radwege: getrennt, gemeinsam, Radfahrer frei", () => {
  const stelle = (art: string) => {
    for (const w of s.karte.wege) {
      if (w.art !== art) continue;
      const [a, b] = w.linie;
      const p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const u = s.untergrund(p[0], p[1]);
      if (u.art === "gehweg" && u.rad) return { x: p[0], y: p[1], winkel: Math.atan2(b[1] - a[1], b[0] - a[0]), u };
    }
    throw new Error(art);
  };
  const fahre = (st: ReturnType<typeof stelle>, tempo: number, extra = {}) => {
    const w = new RadWaechter(s, anlagen);
    const alle: string[] = [];
    for (let t = 0; t < 8; t += 0.1) alle.push(...w.pruefe({ ...st, tempo, t, alter: 14, dunkel: false, lichtOk: true, ...extra }).meldungen);
    return alle;
  };

  it("unterscheidet die Wegarten", () => {
    expect(stelle("geh_rad").u).toEqual({ art: "gehweg", rad: "gemeinsam" });
    expect(stelle("geh_rad_getrennt").u).toEqual({ art: "gehweg", rad: "getrennt" });
    expect(stelle("geh_radfrei").u).toEqual({ art: "gehweg", rad: "frei" });
  });

  it("auf dem gemeinsamen und getrennten Weg darf man mit 14 fahren", () => {
    const g = fahre(stelle("geh_rad"), 4);
    expect(g).not.toContain("radGehweg");
    expect(g).toContain("radGemeinsamGut");
    expect(fahre(stelle("geh_rad_getrennt"), 5)).toContain("radwegGut");
  });

  it("Radfahrer frei: nur Schritttempo", () => {
    expect(fahre(stelle("geh_radfrei"), 5)).toContain("radSchritt");
    expect(fahre(stelle("geh_radfrei"), 1.8)).not.toContain("radSchritt");
    expect(fahre(stelle("geh_radfrei"), 1.8)).not.toContain("radGehweg");
  });

  it("zu dicht an Fußgängern vorbei — außer man hat geklingelt", () => {
    const st = stelle("geh_rad");
    const nah = [{ x: st.x + 0.8, y: st.y }];
    expect(fahre(st, 4, { passanten: nah, seitKlingeln: 99 })).toContain("radRuecksicht");
    expect(fahre(st, 4, { passanten: nah, seitKlingeln: 1 })).not.toContain("radRuecksicht");
  });
});
