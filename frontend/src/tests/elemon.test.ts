import { describe, expect, it } from "vitest";
import { ARTEN, ATTACKEN, lernliste, wirkung } from "@/lib/klikk/elemon/daten";
import { erfahrung, fangChance, kiZug, maxKp, neuerKampf, neuesElemon, runde, type Kampf, type Zug } from "@/lib/klikk/elemon/kampf";
import { ENERGIE_MAX, ENERGIE_MINUTEN, GEBIETE, ITEMS, beleben, itemEinloesen, kartenRest, qrItem, qrLesen, energieAuffuellen, kampfEnde, neuerElemonStand, starten, wildesElemon } from "@/lib/klikk/elemon/spiel";
import { AUFGABEN, elemonAktion, elternUmZeit, neuerStand } from "@/lib/klikk/motor";

const seite = (name: string, ...team: [string, number][]) => ({ name, team: team.map(([a, s]) => neuesElemon(a, s)), aktiv: 0 });

describe("Elemon-Daten", () => {
  it("jede Art hat ein Modell und lernt nur bekannte Attacken", () => {
    for (const a of ARTEN) for (const [, id] of lernliste(a)) expect(ATTACKEN[id], `${a.id}: ${id}`).toBeDefined();
    expect(new Set(ARTEN.map(a => a.id)).size).toBe(ARTEN.length);
  });
  it("Typentabelle: Wasser löscht Feuer, Feuer prallt an Wasser ab, Doppeltypen multiplizieren", () => {
    expect(wirkung("wasser", ["feuer"])).toBe(2);
    expect(wirkung("feuer", ["wasser"])).toBe(0.5);
    expect(wirkung("eis", ["pflanzen", "wind"])).toBe(4);
    expect(wirkung(null, ["feuer"])).toBe(1);
  });
  it("Gebiete nennen nur vorhandene Arten", () => {
    const ids = new Set(ARTEN.map(a => a.id));
    for (const g of GEBIETE) for (const id of [...g.wild, ...g.arena.team.map(t => t[0]), ...g.trainer.flatMap(t => t.team.map(x => x[0]))]) expect(ids.has(id), id).toBe(true);
  });
});

describe("Elemon-Kampf", () => {
  it("ist deterministisch: gleiche Züge, gleiches Ergebnis — wie bei einem Duell auf zwei Handys", () => {
    const k = neuerKampf(seite("a", ["fox", 10], ["koala", 9]), seite("b", ["turtle", 10]), false, 1234);
    const zuege: [Zug, Zug][] = [[{ art: "angriff", nr: 1 }, { art: "angriff", nr: 1 }], [{ art: "angriff", nr: 2 }, { art: "angriff", nr: 0 }]];
    const spielen = () => zuege.reduce<{ k: Kampf; ev: unknown[] }>((acc, [a, b]) => {
      const r = runde(acc.k, a, b);
      return { k: r.kampf, ev: [...acc.ev, ...r.ereignisse] };
    }, { k, ev: [] });
    expect(spielen()).toEqual(spielen());
  });

  it("wer schneller ist, schlägt zuerst; ein K.o. holt das nächste Elemon von selbst", () => {
    const a = seite("a", ["dragon_evolved", 30]);
    const b = seite("b", ["duck", 3], ["bee", 3]);
    const { kampf, ereignisse } = runde(neuerKampf(a, b, false, 7), { art: "angriff", nr: 0 }, { art: "angriff", nr: 0 });
    expect(ereignisse[0]).toMatchObject({ typ: "angriff", seite: "a" });
    expect(ereignisse).toContainEqual({ typ: "ko", seite: "b", nr: 0 });
    expect(ereignisse).toContainEqual({ typ: "wechsel", seite: "b", nr: 1 });
    expect(kampf.b.aktiv).toBe(1);
    expect(kampf.ende).toBeUndefined();
  });

  it("Käfig: ein geschwächtes, leicht fangbares Elemon bleibt meistens drin", () => {
    let gefangen = 0;
    for (let seed = 0; seed < 200; seed++) {
      const b = seite("b", ["duck", 3]);
      b.team[0].kp = 1;
      const r = runde(neuerKampf(seite("a", ["fox", 5]), b, true, seed), { art: "kaefig" }, { art: "angriff", nr: 0 });
      if (r.kampf.ende?.gefangen) gefangen++;
    }
    expect(gefangen).toBeGreaterThan(150);
  });

  it("Käfig und Flucht gibt es nur bei wilden Elemon", () => {
    const r = runde(neuerKampf(seite("a", ["fox", 5]), seite("b", ["duck", 3]), false, 1), { art: "kaefig" }, { art: "angriff", nr: 0 });
    expect(r.ereignisse.some(e => e.typ === "kaefig")).toBe(false);
  });

  it("Aufgeben beendet sofort", () => {
    const r = runde(neuerKampf(seite("a", ["fox", 5]), seite("b", ["duck", 3]), false, 1), { art: "angriff", nr: 0 }, { art: "aufgeben" });
    expect(r.kampf.ende).toEqual({ sieger: "a" });
  });

  it("die KI heilt sich, wenn sie schwach ist und es kann", () => {
    const k = neuerKampf(seite("a", ["fox", 10]), seite("b", ["sloth", 10]), false, 1);
    k.b.team[0].kp = 3;
    expect(kiZug(k)).toEqual({ art: "angriff", nr: k.b.team[0].attacken.indexOf("heilung1") });
  });

  it("Erfahrung bringt Stufen und neue Attacken (höchstens vier)", () => {
    const fuchs = neuesElemon("fox", 9);
    const { team, aufstiege } = erfahrung([fuchs], [neuesElemon("duck", 20)]);
    expect(team[0].stufe).toBeGreaterThan(9);
    expect(team[0].attacken).toContain("feuer2");
    expect(team[0].attacken.length).toBeLessThanOrEqual(4);
    expect(aufstiege[0].gelernt).toContain("feuer2");
    expect(team[0].kp).toBeLessThanOrEqual(maxKp(team[0]));
  });
});

describe("Elemon-Spielstand", () => {
  it("Energie füllt sich mit der Spielzeit bis zum Maximum", () => {
    const e = { ...neuerElemonStand(), energie: 1, energieAb: 0 };
    expect(energieAuffuellen(e, ENERGIE_MINUTEN * 2 + 5).energie).toBe(3);
    expect(energieAuffuellen(e, 10_000).energie).toBe(ENERGIE_MAX);
  });
  it("gefangene Elemon kommen ins Team, ab sechs ins Lager; Niederlage kostet Münzen und heilt", () => {
    let e = starten(neuerElemonStand(), "fox");
    for (let i = 0; i < 6; i++) e = kampfEnde(e, e.team, { art: "gefangen", elemon: neuesElemon("duck", 3) }).stand;
    expect(e.team).toHaveLength(6);
    expect(e.lager).toHaveLength(1);
    e.team[0].kp = 0;
    const r = kampfEnde({ ...e, muenzen: 100 }, e.team, { art: "niederlage" });
    expect(r.verlust).toBe(10);
    expect(r.stand.team[0].kp).toBe(maxKp(r.stand.team[0]));
  });
  it("wilde Elemon kommen aus dem Gebiet und in dessen Stufen", () => {
    const g = GEBIETE[0];
    for (let w = 1; w < 50; w++) {
      const x = wildesElemon(g, w, false);
      expect(g.wild).toContain(x.art);
      expect(x.stufe).toBeGreaterThanOrEqual(g.stufen[0]);
      expect(x.stufe).toBeLessThanOrEqual(g.stufen[1]);
    }
  });
  it("elemonAktion kostet Spielzeit und meldet an AdKit, außer Tracking ist aus", () => {
    const s = neuerStand(1);
    const n = elemonAktion(s, e => starten(e, "koala"), 5, "Kampf im Stadtpark");
    expect(n.elemon?.team[0].art).toBe("koala");
    expect(n.uhr).toBe(s.uhr + 5);
    expect(n.spur.at(-1)).toMatchObject({ app: "elemon", an: "AdKit" });
    const ohne = elemonAktion({ ...s, trackingAus: true }, e => e, 0, "x");
    expect(ohne.spur.some(x => x.app === "elemon")).toBe(false);
  });

  it("Eltern um Extra-Zeit: Hausaufgaben und Mithilfe zählen, einmal pro Tag", () => {
    const basis = elemonAktion(neuerStand(1), e => ({ ...starten(e, "fox"), energie: 0 }));
    const fleissig = elternUmZeit({ ...basis, eltern: "locker", hausaufgabenStand: AUFGABEN, famZusagen: ["oma"] });
    expect(fleissig.elemon!.energie).toBe(3);
    expect(fleissig.chats.mama.at(-1)!.text).toMatch(/geschafft/);
    expect(elternUmZeit(fleissig)).toBe(fleissig);

    const faul = elternUmZeit({ ...basis, eltern: "streng", hausaufgabenStand: 0, famAbgelehnt: 2 });
    expect(faul.elemon!.energie).toBe(0);
    expect(faul.elemon!.elternAntwort).toMatchObject({ ja: false });
    expect(faul.chats.mama.at(-1)!.text).toMatch(/Hausaufgaben/);
  });

  it("Eltern-Sperre: die Klasse schreibt trotzdem — »nie erreichbar«, einmal am Tag", () => {
    const s = { ...neuerStand(1), phase: "woche" as const, uhr: 17 * 60, limit: { proTag: 30, sperreAb: null, vonEltern: true }, handyMinuten: [40] };
    const n = elemonAktion(s, e => e, 5);
    const texte = n.chats.klasse.map(m => m.text);
    expect(texte).toContain("Nie erreichbar 🙄");
    expect(elemonAktion(n, e => e, 5).chats.klasse).toHaveLength(n.chats.klasse.length);
    // ohne Eltern-Sperre kein Spott
    expect(elemonAktion({ ...s, limit: { ...s.limit, vonEltern: false } }, e => e, 5).chats.klasse.map(m => m.text)).not.toContain("Nie erreichbar 🙄");
  });

  it("Nein der Eltern: die Klasse spottet im Klassenchat", () => {
    const basis = elemonAktion(neuerStand(1), e => ({ ...starten(e, "fox"), energie: 0 }));
    const n = elternUmZeit({ ...basis, eltern: "streng", hausaufgabenStand: 0 });
    expect(n.chats.klasse.at(-1)!.text).toMatch(/wegen Mami/);
  });

  it("ein K.o. beendet die Runde: das neue Elemon schlägt nicht sofort zu", () => {
    const a = seite("a", ["dragon_evolved", 30]);
    const b = seite("b", ["duck", 3], ["bee", 3]);
    const { ereignisse } = runde(neuerKampf(a, b, false, 7), { art: "angriff", nr: 0 }, { art: "angriff", nr: 0 });
    const nachWechsel = ereignisse.slice(ereignisse.findIndex(x => x.typ === "wechsel"));
    expect(nachWechsel.some(x => x.typ === "angriff")).toBe(false);
  });

  it("Fangen: junge Elemon gehen leicht in den Käfig, seltene starke bleiben schwer", () => {
    expect(fangChance(neuesElemon("duck", 3))).toBeGreaterThan(0.7);
    expect(fangChance(neuesElemon("hedgehog", 4))).toBeGreaterThan(0.6);
    expect(fangChance(neuesElemon("dragon_evolved", 25))).toBeLessThan(0.15);
  });

  it("Item-Karten: Menge laut Karte, danach ist genau diese Karte gesperrt; Beleber weckt mit halben KP", () => {
    expect(qrLesen(qrItem("trank", 3, 2))).toEqual({ art: "item", item: "trank", menge: 3, nr: 2 });
    expect(qrLesen(qrItem("goldkaefig", 1, ITEMS.goldkaefig.maxKarten + 1))).toBeNull();
    let e = starten(neuerElemonStand(), "fox");
    e = itemEinloesen(e, "trank", 3, 2, 1000);
    expect(e.traenke).toBe(2 + 3);
    expect(itemEinloesen(e, "trank", 3, 2, 2000).traenke).toBe(5);
    expect(itemEinloesen(e, "trank", 3, 3, 2000).traenke).toBe(8);
    expect(kartenRest(e, "trank-2", 1000 + ITEMS.trank.sperreMin * 60_000)).toBe(0);
    e = itemEinloesen(e, "beleber", 1, 1, 1000);
    e.team[0].kp = 0;
    const wach = beleben(e, 0);
    expect(wach.team[0].kp).toBe(Math.ceil(maxKp(wach.team[0]) / 2));
    expect(wach.beleber).toBe(0);
  });
});
