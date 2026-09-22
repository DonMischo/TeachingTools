/**
 * Kalenderwoche und A/B-Woche.
 *
 * Die Regel steht seit der Uhr-Folie nur noch an einer Stelle: Kalenderrand und
 * Flurbildschirm müssen dieselbe Woche behaupten, sonst glaubt die halbe Schule
 * an A und die andere an B.
 */
import { describe, it, expect } from "vitest";
import { isoWoche, abWoche } from "@/lib/schoolyear";

describe("isoWoche", () => {
  it("zählt nach ISO-8601 — Woche 1 ist die mit dem ersten Donnerstag", () => {
    // 1. Januar 2026 ist ein Donnerstag, gehört also schon zu Woche 1.
    expect(isoWoche(new Date(2026, 0, 1))).toBe(1);
    // 1. Januar 2027 ist ein Freitag; der Montag davor liegt noch in Woche 53.
    expect(isoWoche(new Date(2026, 11, 28))).toBe(53);
  });

  it("wechselt am Montag, nicht am Sonntag", () => {
    expect(isoWoche(new Date(2026, 8, 20))).toBe(38); // Sonntag
    expect(isoWoche(new Date(2026, 8, 21))).toBe(39); // Montag darauf
  });
});

describe("abWoche", () => {
  it("nennt ungerade Wochen A und gerade B", () => {
    expect(abWoche(39)).toBe("A");
    expect(abWoche(40)).toBe("B");
  });

  it("nimmt ohne Angabe die laufende Woche", () => {
    expect(abWoche()).toBe(abWoche(isoWoche(new Date())));
  });
});
