/**
 * Die Alltagsspiele der Prozentrechnung: Saftbar-Bestellungen gehen auf,
 * Handy-Angebote rechnen richtig, der Kiosk verliert keine Ware und kein Geld.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Spiele from "@/components/prozent/Spiele";
import { bewerte, erzeugeBestellung, mischung, rechenweg, type Stufe } from "@/lib/saftbar";
import { SIM_ONLY, annuitaet, bestes, erzeugeFall, handyKosten, kontoVerlauf, warten, MONATE } from "@/lib/handy";
import { PRODUKTE, FIXKOSTEN, bestellkosten, einkaufFuer, mengenrabatt, ereignisFuer, EREIGNISSE, kalkuliere, kaufWahrscheinlichkeit, leeresLager, leererPlan, neuerRuf, spieleWoche, EROEFFNUNG, SCHUELER, TAGE } from "@/lib/kiosk";

function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("Saftbar", () => {
  it("jede Bestellung geht mit ihrer Lösung genau auf", () => {
    const rnd = zufall(11);
    for (const stufe of [1, 2, 3] as Stufe[]) {
      for (let i = 0; i < 200; i++) {
        const b = erzeugeBestellung(stufe, rnd);
        const m = mischung(b.start, b.loesung);
        expect(m.ml).toBeCloseTo(b.ziel.ml);
        expect(m.prozent).toBeCloseTo(b.ziel.prozent);
        expect(b.ziel.ml).toBeLessThanOrEqual(b.kapazitaet);
        for (const ml of Object.values(b.loesung)) expect(ml).toBeGreaterThan(0);
        expect(bewerte(b, m).sterne).toBe(3);
        for (const s of rechenweg(b)) expect(s).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });

  it("zu viel Wasser schmeckt nach Wasser", () => {
    const b = erzeugeBestellung(1, zufall(2));
    const m = mischung(null, { ...b.loesung, wasser: (b.loesung.wasser ?? 0) + 100 });
    expect(bewerte(b, m).sterne).toBeLessThan(3);
  });
});

describe("Handy-Check", () => {
  it("Ratenformel", () => {
    expect(annuitaet(1200, 0, 12)).toBeCloseTo(100);
    // 1 000 € bei 12 % effektiv über 12 Monate: Gesamtzinsen gut 60 €
    const r = annuitaet(1000, 12, 12);
    expect(r * 12 - 1000).toBeGreaterThan(55);
    expect(r * 12 - 1000).toBeLessThan(70);
  });

  it("jeder Fall hat ein bezahlbares Angebot, Kosten und Konto passen zusammen", () => {
    const rnd = zufall(5);
    for (let i = 0; i < 200; i++) {
      const f = erzeugeFall(rnd);
      const top = bestes(f.auswertung)!;
      expect(top.machbar).toBe(true);
      const bar = f.auswertung.find(a => a.angebot.id === "bar")!;
      expect(bar.kosten).toBeLessThanOrEqual(f.handy.preis);
      for (const a of f.auswertung) {
        expect(a.kosten).toBeCloseTo(handyKosten(a.angebot));
        const k = kontoVerlauf(a.angebot, f.person);
        expect(k).toHaveLength(MONATE + 1);
        // nach 36 Monaten ist alles bezahlt: Ersparnis + Einkommen − SIM-only − Handykosten
        expect(k[MONATE]).toBeCloseTo(f.person.erspart + MONATE * (f.person.frei - SIM_ONLY) - a.kosten, 1);
        if (a.angebot.id !== "bar") expect(a.angebot.werbung.length).toBeGreaterThan(5);
      }
      const w = warten(f.handy, f.person);
      if (w) expect(w.preis).toBeLessThanOrEqual(f.handy.preis);
    }
  });
});

describe("Kiosk", () => {
  it("Kalkulation: Aufschlag, MwSt, auf 5 Cent gerundet", () => {
    const k = kalkuliere(1, 100, 19);
    expect(k.netto).toBe(2);
    expect(k.brutto).toBe(2.4);
    expect(k.echterAufschlag).toBeGreaterThan(100);
    expect(kalkuliere(0.32, 100, 7).brutto).toBe(0.7);
  });

  it("Mengenrabatt ab 100 und 200 Stück, Bestellkosten und Wochenbericht stimmen überein", () => {
    expect(mengenrabatt(99)).toBe(0);
    expect(mengenrabatt(100)).toBe(5);
    expect(mengenrabatt(250)).toBe(10);
    expect(einkaufFuer(200, 1)).toBe(180);
    const plan = leererPlan();
    plan.brezel.bestellen = 200;
    const b = spieleWoche(plan, leeresLager(), EREIGNISSE[0], zufall(3));
    expect(b.einkauf).toBeCloseTo(bestellkosten(plan, EREIGNISSE[0]), 2);
    expect(b.zeilen.find(z => z.id === "brezel")!.rabatt).toBe(10);
  });

  it("Kaufwahrscheinlichkeit: billiger kauft eher, Wucher kaum, bei Tante Emma bleibt die Bequemlichkeit", () => {
    const riegel = PRODUKTE.find(p => p.id === "riegel")!, normal = EREIGNISSE[0];
    const emma = EREIGNISSE.find(e => e.id === "tanteEmma")!;
    expect(kaufWahrscheinlichkeit(riegel, 0.8, normal)).toBeGreaterThan(kaufWahrscheinlichkeit(riegel, 1.2, normal));
    expect(kaufWahrscheinlichkeit(riegel, 0.8, normal)).toBeGreaterThan(0.9);
    expect(kaufWahrscheinlichkeit(riegel, kalkuliere(riegel.ek, 400, riegel.mwst).brutto, normal)).toBeLessThan(0.01);
    // Tante Emma ist billiger als dein Einkauf — wer bei dir zum üblichen Preis kauft, tut es aus Bequemlichkeit
    const q = kaufWahrscheinlichkeit(riegel, 1, emma);
    expect(q).toBeGreaterThan(0.2);
    expect(q).toBeLessThanOrEqual(0.3);
  });

  it("Schülerschaft: feste Zahl, Eröffnung lockt, Ruf zählt, Ausverkauf hat einen Tag", () => {
    const voll = Object.fromEntries(PRODUKTE.map(p => [p.id, { aufschlag: 100, bestellen: 5000 }])) as ReturnType<typeof leererPlan>;
    const summe = (b: ReturnType<typeof spieleWoche>) => b.zeilen.reduce((a, z) => a + z.verkauft, 0);
    const normal = spieleWoche(voll, leeresLager(), EREIGNISSE[0], zufall(1));
    for (const z of normal.zeilen) expect(z.leerAb).toBeNull();
    const wuensche = normal.zeilen.reduce((a, z) => a + z.gewollt + z.zuTeuer, 0);
    expect(wuensche).toBeLessThanOrEqual(SCHUELER * TAGE.length * 2);
    expect(summe(spieleWoche(voll, leeresLager(), EROEFFNUNG, zufall(1)))).toBeGreaterThan(summe(normal) * 1.3);
    expect(summe(spieleWoche(voll, leeresLager(), EREIGNISSE[0], zufall(1), 5))).toBeGreaterThan(summe(spieleWoche(voll, leeresLager(), EREIGNISSE[0], zufall(1), 1)));
    const knapp = leererPlan();
    knapp.broetchen.bestellen = 5;
    const b = spieleWoche(knapp, leeresLager(), EREIGNISSE[0], zufall(2)).zeilen.find(z => z.id === "broetchen")!;
    expect(b.leerAb).not.toBeNull();
    expect(b.verpasst).toBeGreaterThan(0);
    expect(neuerRuf(3, 5)).toBe(4);
  });

  it("eine Woche verliert keine Ware und rechnet den Gewinn richtig", () => {
    const rnd = zufall(9);
    let lager = leeresLager();
    for (let w = 1; w <= 8; w++) {
      const b = spieleWoche(leererPlan(), lager, ereignisFuer(w, rnd), rnd);
      for (const z of b.zeilen) {
        const p = PRODUKTE.find(x => x.id === z.id)!;
        expect(z.verkauft).toBeLessThanOrEqual(z.verfuegbar);
        expect(z.verkauft + z.verdorben + b.lager[z.id]).toBe(z.verfuegbar);
        if (p.frisch) expect(b.lager[z.id]).toBe(0);
      }
      expect(b.gewinn).toBeCloseTo(b.umsatz - b.steuer - b.einkauf - FIXKOSTEN, 1);
      lager = b.lager;
    }
  });

  it("Zufriedenheit: leere Regale und Wucherpreise kosten Sterne", () => {
    const e = EREIGNISSE[0];
    const plan = (aufschlag: number, faktor: number) => Object.fromEntries(PRODUKTE.map(p => [p.id, { aufschlag, bestellen: Math.round(p.basis * faktor) }])) as ReturnType<typeof leererPlan>;
    const fair = spieleWoche(plan(130, 3), leeresLager(), e, zufall(1)).zufriedenheit;
    const leer = spieleWoche(plan(130, 0.3), leeresLager(), e, zufall(1)).zufriedenheit;
    const teuer = spieleWoche(plan(260, 3), leeresLager(), e, zufall(1)).zufriedenheit;
    expect(fair.sterne).toBeGreaterThanOrEqual(4);
    expect(leer.sterne).toBeLessThan(fair.sterne);
    expect(teuer.sterne).toBeLessThan(fair.sterne);
    expect(leer.kommentare.some(k => /ausverkauft|keine|alles weg/.test(k.text))).toBe(true);
    expect(teuer.kommentare.some(k => /teuer|Wucher|Konkurrenz|Taschengeld/.test(k.text))).toBe(true);
    for (const zf of [fair, leer, teuer]) {
      expect(zf.sterne).toBeGreaterThanOrEqual(1);
      expect(zf.sterne).toBeLessThanOrEqual(5);
      expect(zf.kommentare.length).toBeGreaterThan(0);
      expect(zf.kommentare.length).toBeLessThanOrEqual(4);
      for (const k of zf.kommentare) expect(k.text).not.toMatch(/NaN|undefined/);
    }
  });

  it("mit vernünftigen Preisen lässt sich Geld verdienen", () => {
    const rnd = zufall(4);
    const plan = leererPlan();
    let summe = 0, lager = leeresLager();
    for (let w = 1; w <= 8; w++) {
      const b = spieleWoche(plan, lager, ereignisFuer(w, rnd), rnd);
      summe += b.gewinn; lager = b.lager;
    }
    expect(summe).toBeGreaterThan(0);
  });
});

describe("Spiele-Oberfläche", () => {
  it("Saftbar: eingießen und servieren", () => {
    render(<Spiele />);
    fireEvent.click(screen.getByRole("button", { name: "🧃 Saftbar" }));
    fireEvent.click(screen.getByRole("button", { name: /Saft \+ Wasser/ }));
    expect(screen.getByTestId("bestellung").textContent).toMatch(/ml/);
    fireEvent.click(screen.getAllByRole("button", { name: "+10 ml" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Servieren/ }));
    expect(screen.getByText(/So geht’s/)).toBeInTheDocument();
  });

  it("Handy-Check: wählen, rechnen, auflösen", () => {
    render(<Spiele />);
    fireEvent.click(screen.getByRole("button", { name: "📱 Handy-Check" }));
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Dieses nehmen" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /nachrechnen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Auflösen" }));
    expect(screen.getByRole("img", { name: /Kontostand/ })).toBeInTheDocument();
  });

  it("Kiosk: eine Woche öffnen", () => {
    render(<Spiele />);
    fireEvent.click(screen.getByRole("button", { name: "🏪 Mein Kiosk" }));
    fireEvent.click(screen.getByRole("button", { name: /Kiosk öffnen/ }));
    fireEvent.click(screen.getAllByTitle("Kalkulation zeigen")[0]);
    expect(screen.getByText(/Aufschlag =/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Woche öffnen/ }));
    expect(screen.getByText(/Mehrwertsteuer ans Finanzamt/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Nächste Woche/ }));
    expect(screen.queryByText(/Mehrwertsteuer ans Finanzamt/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Woche 1 ansehen/ }));
    expect(screen.getByText(/Rückblick Woche 1/)).toBeInTheDocument();
    expect(screen.getByText(/Mehrwertsteuer ans Finanzamt/)).toBeInTheDocument();
  });
});
