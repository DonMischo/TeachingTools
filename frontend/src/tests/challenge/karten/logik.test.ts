import { describe, it, expect } from "vitest";
import {
  draftNimm, draftStart, kampfStart, stapeln, zugBeenden, zieheKarten, abwerfen, mischen, ENERGIE, HAND, HAND_MAX, NACHZIEHEN, sterne, seltenheit,
} from "@/components/challenge/modi/karten/logik";
import { route } from "@/components/challenge/modi/karten/Etappenkarte";

const ids = Array.from({ length: 9 }, (_, i) => `f${i}`);

describe("Draft", () => {
  it("bietet jede Karte an, Abgelehntes höchstens zweimal, und endet", () => {
    let d = draftStart(ids, 7);
    const gesehen = new Set<string>();
    for (let i = 0; i < 50 && d.angebot.length; i++) { d.angebot.forEach((x) => gesehen.add(x)); d = draftNimm(d, [d.angebot[0]], 7); }
    expect(d.angebot).toHaveLength(0);
    expect(gesehen.size).toBe(ids.length);
    expect(Math.max(...Object.values(d.gesehen))).toBeLessThanOrEqual(2);
    expect(new Set(d.deck).size).toBe(d.deck.length);
  });
  it("nimmt mehrere Karten aus einem Booster", () => {
    const d = draftStart(ids, 7);
    const neu = draftNimm(d, d.angebot.slice(0, 3), 7);
    expect(neu.deck).toEqual(d.angebot.slice(0, 3));
    expect(neu.angebot.length).toBeGreaterThan(0);
  });
});

describe("Kampf", () => {
  it("zieht 5 Karten, Energie 3, leerer Stapel mischt die Ablage", () => {
    let k = kampfStart(ids, 3);
    expect(k.hand).toHaveLength(HAND); expect(k.nachzieh).toHaveLength(4); expect(k.energie).toBe(ENERGIE);
    k = zugBeenden(k, 3);
    expect(k.hand).toHaveLength(HAND + NACHZIEHEN); expect(k.nachzieh).toHaveLength(2); expect(k.ablage).toHaveLength(0);
    expect(k.hand.length + k.nachzieh.length + k.ablage.length).toBe(ids.length);
  });
  it("Zugende behält die Hand, zieht mindestens bis HAND und höchstens bis HAND_MAX", () => {
    const alle = Array.from({ length: 20 }, (_, i) => `g${i}`);
    let k = kampfStart(alle, 3);
    const hand = k.hand;
    k = zugBeenden(k, 3);
    expect(k.hand.slice(0, HAND)).toEqual(hand); expect(k.hand).toHaveLength(7);
    k = zugBeenden(zugBeenden(k, 3), 3);
    expect(k.hand).toHaveLength(HAND_MAX);
    expect(zugBeenden(k, 3).hand).toHaveLength(HAND_MAX);
    const wenig = { ...k, hand: k.hand.slice(0, 1) };
    expect(zugBeenden(wenig, 3).hand).toHaveLength(HAND);
  });
  it("Abwerfen legt auf die Ablage und zieht gleich viele nach", () => {
    let k = kampfStart(ids, 3);
    const weg = k.hand.slice(0, 2);
    k = abwerfen(k, weg, 5);
    expect(k.hand).toHaveLength(HAND); expect(k.ablage).toEqual(weg); expect(k.nachzieh).toHaveLength(2); expect(k.energie).toBe(ENERGIE);
  });
  it("Abwerfen mischt bei leerem Stapel die Ablage ein", () => {
    let k = kampfStart(ids.slice(0, 5), 3);
    k = abwerfen(k, k.hand.slice(0, 2), 5);
    expect(k.hand).toHaveLength(HAND); expect(k.hand.length + k.nachzieh.length + k.ablage.length).toBe(5);
  });
  it("Mischen fügt die Ablage in den Nachziehstapel", () => {
    let k = kampfStart(ids, 3);
    k = { ...k, ablage: [k.hand[0]], hand: k.hand.slice(1) };
    const m = mischen(k, 2);
    expect(m.ablage).toHaveLength(0); expect([...m.nachzieh].sort()).toEqual([...k.nachzieh, ...k.ablage].sort());
    expect(mischen(m, 2)).toBe(m);
  });
  it("Stapeln kostet 1 Energie und bei 0 geht nichts mehr", () => {
    let k = kampfStart(ids, 3);
    for (const id of k.hand.slice(0, 4)) k = stapeln(k, id);
    expect(k.stapel).toHaveLength(ENERGIE); expect(k.energie).toBe(0);
    expect(zieheKarten(k, 0, 1).hand).toHaveLength(HAND - ENERGIE);
  });
  it("Sterne sinken mit den Zügen, Seltenheit hängt nur von der ID ab", () => {
    expect(sterne(2, 2)).toBe(3); expect(sterne(6, 2)).toBe(2); expect(sterne(20, 2)).toBe(1);
    expect(seltenheit("a")).toBe(seltenheit("a"));
  });
});

describe("Etappenkarte", () => {
  it("der Weg beginnt am Start", () => {
    const { weg } = route(5, 4, 3);
    expect(weg[0]).toBe(0);
  });
});
