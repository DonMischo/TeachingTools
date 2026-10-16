import { describe, it, expect } from "vitest";
import { baueAbschnitte, leereEingabe, schritt, startSpieler, torAmFuss, VX, VX_RENNEN, baueLevel, type Eingabe, type Level, type Spieler } from "@/lib/challenge/huepfen";
import { kettePasst, probe } from "./kette";

const DT = 1 / 60;
const nichts: Eingabe = { links: false, rechts: false, sprung: false };

describe("Hüpfen: Abschnitte", () => {
  it("alle Schlüssel im ersten Abschnitt, ein Tor je Abschnitt, am Ende der Zielabschnitt", () => {
    const a = baueAbschnitte(2, 4, 3, 7);
    expect(a).toHaveLength(4);
    expect(a[0].schluessel).toHaveLength(4);
    a.slice(1).forEach((l) => expect(l.schluessel).toHaveLength(0));
    a.slice(0, 3).forEach((l) => expect(l.tueren).toHaveLength(1));
    expect(a[3].tueren).toHaveLength(0);
    expect(baueAbschnitte(1, 3, 0, 1)).toHaveLength(1);
  });
  it("jeder Abschnitt hat eine erreichbare Kette (Probe ohne Rennen und Doppelsprung)", () => {
    // der Stil folgt aus dem Seed: 24 Seeds decken alle Stile ab
    for (let seed = 1; seed <= 24; seed++) for (const l of baueAbschnitte(2, 4, 3, seed)) {
      expect(kettePasst(l)).toBe(true);
      for (let i = 0; i < l.plattformen.length - 1; i++) expect(probe(l, i)).toBe(i + 1);
      expect(l.plattformen[0].cp).toBe(true); // eigene Fahne am Eingang
    }
  });
  it("torAmFuss: nur am Tor, offen/zu je nach Schloss", () => {
    const l = baueLevel(1, 3, 1, 2);
    const t = l.tueren[0];
    const am: Spieler = { ...startSpieler(l), x: t.x, y: t.y };
    expect(torAmFuss(startSpieler(l), l, [true])).toBeNull();
    expect(torAmFuss(am, l, [true])).toEqual({ index: 0, offen: false });
    expect(torAmFuss(am, l, [false])).toEqual({ index: 0, offen: true });
  });
});

describe("Hüpfen: Eingabe loslassen", () => {
  it("leereEingabe löscht alle Tasten und stoppt die waagrechte Bewegung", () => {
    const e: Eingabe = { links: true, rechts: true, sprung: true, runter: true, rennen: true };
    const s = { vx: 6 };
    leereEingabe(e, s);
    expect(e).toEqual({ links: false, rechts: false, sprung: false, runter: false, rennen: false });
    expect(s.vx).toBe(0);
  });
});

describe("Hüpfen: Rennen", () => {
  const l: Level = { ...baueLevel(1, 3, 1), leisten: [], beweger: [], gegner: [],
    plattformen: [{ x: 0, y: 8, w: 60, cp: true }] };
  const weite = (rennen: boolean) => {
    let s: Spieler = { ...startSpieler(l), x: 2 };
    for (let t = 0; t < 1; t += DT) s = schritt(s, { ...nichts, rechts: true, rennen }, DT, l); // Anlauf
    const x0 = s.x;
    s = schritt(s, { ...nichts, rechts: true, rennen, sprung: true }, DT, l);
    for (let t = 0; t < 2 && s.auf < 0; t += DT) s = schritt(s, { ...nichts, rechts: true, rennen }, DT, l);
    return s.x - x0;
  };
  it("der Sprung im Lauf ist deutlich weiter als der Gehsprung", () => {
    expect(VX_RENNEN).toBeGreaterThan(VX);
    expect(weite(true)).toBeGreaterThan(weite(false) * 1.3);
  });
});
