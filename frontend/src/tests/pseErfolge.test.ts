/**
 * Prüft Punkte, Sterne und Erfolge der PSE-Rallye.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  ERFOLGE, erreicht, ladeStand, LEERER_STAND, nachAntwort, nachRunde,
  neueErfolge, PUNKTE_JE_RUNDE, speichereStand, sterneFuer, type Stand,
} from "@/lib/pse/erfolge";

beforeEach(() => localStorage.removeItem("hp_pse_rallye"));

describe("Sterne", () => {
  it("gibt drei Sterne erst, wenn fast alles auf Anhieb saß", () => {
    expect(sterneFuer(PUNKTE_JE_RUNDE, PUNKTE_JE_RUNDE)).toBe(3);
    expect(sterneFuer(27, 30)).toBe(3);
    expect(sterneFuer(26, 30)).toBe(2);
    expect(sterneFuer(21, 30)).toBe(2);
    expect(sterneFuer(20, 30)).toBe(1);
    expect(sterneFuer(14, 30)).toBe(0);
    expect(sterneFuer(0, 0)).toBe(0);
  });
});

describe("Stand fortschreiben", () => {
  it("zählt Punkte, Art und gefundenes Element", () => {
    const s = nachAntwort(LEERER_STAND, "masse", 26, 3, true);
    expect(s.punkte).toBe(3);
    expect(s.richtig.masse).toBe(1);
    expect(s.sofort).toBe(1);
    expect(s.gefunden).toEqual([26]);
  });

  it("zählt dasselbe Element nicht zweimal als gefunden", () => {
    let s = nachAntwort(LEERER_STAND, "name", 8, 3, true);
    s = nachAntwort(s, "symbol", 8, 2, false);
    expect(s.gefunden).toEqual([8]);
    expect(s.punkte).toBe(5);
  });

  it("merkt sich die längste Serie, auch wenn die laufende abreißt", () => {
    let s = LEERER_STAND;
    for (const z of [1, 2, 3, 4]) s = nachAntwort(s, "name", z, 3, true);
    expect(s.serie).toBe(4);
    s = nachAntwort(s, "name", 5, 1, false); // Fehlversuch
    expect(s.serie).toBe(4);
    s = nachAntwort(s, "name", 6, 3, true);
    expect(s.serie).toBe(4);
  });

  it("zählt Runden, Sterne und Glanzrunden je Bereich", () => {
    let s = nachRunde(LEERER_STAND, "schule", 3);
    s = nachRunde(s, "schule", 2);
    s = nachRunde(s, "alle", 3);
    expect(s.runden).toBe(3);
    expect(s.sterne).toBe(8);
    expect(s.dreiSterne).toEqual({ schule: 1, alle: 1 });
  });
});

describe("Erfolge", () => {
  it("hat durchweg saubere Einträge und eindeutige Kennungen", () => {
    expect(new Set(ERFOLGE.map(e => e.id)).size).toBe(ERFOLGE.length);
    for (const e of ERFOLGE) {
      expect(e.ziel).toBeGreaterThan(0);
      expect(e.name.length).toBeGreaterThan(3);
      expect(e.text.length).toBeGreaterThan(10);
      expect(e.icon.length).toBeGreaterThan(0);
      // Ein frischer Stand darf keinen Erfolg schon erfüllen.
      expect(erreicht(e, LEERER_STAND), e.id).toBe(false);
    }
  });

  it("vergibt den ersten Erfolg nach der ersten Runde", () => {
    const s = nachRunde(LEERER_STAND, "schule", 1);
    expect(neueErfolge(s).map(e => e.id)).toContain("erste-runde");
  });

  it("meldet einen Erfolg nur einmal", () => {
    let s = nachRunde(LEERER_STAND, "schule", 1);
    const neu = neueErfolge(s);
    s = { ...s, erfolge: neu.map(e => e.id) };
    expect(neueErfolge(s).map(e => e.id)).not.toContain("erste-runde");
  });

  it("erkennt »Alles gefragt«, wenn jede Art dreimal saß", () => {
    const s: Stand = {
      ...LEERER_STAND,
      richtig: { ordnungszahl: 3, masse: 3, name: 3, symbol: 3, gruppenname: 3, gruppePeriode: 3 },
    };
    expect(neueErfolge(s).map(e => e.id)).toContain("alle-arten");
    const fast: Stand = { ...s, richtig: { ...s.richtig, gruppePeriode: 2 } };
    expect(neueErfolge(fast).map(e => e.id)).not.toContain("alle-arten");
  });

  it("ist nur mit allen 118 Elementen vollständig", () => {
    const fast: Stand = { ...LEERER_STAND, gefunden: [...Array(117).keys()].map(i => i + 1) };
    expect(neueErfolge(fast).map(e => e.id)).not.toContain("sammler-alle");
    const ganz: Stand = { ...LEERER_STAND, gefunden: [...Array(118).keys()].map(i => i + 1) };
    expect(neueErfolge(ganz).map(e => e.id)).toContain("sammler-alle");
  });
});

describe("Speichern", () => {
  it("liest zurück, was geschrieben wurde", () => {
    const s = nachAntwort(LEERER_STAND, "name", 26, 3, true);
    speichereStand(s);
    expect(ladeStand()).toEqual(s);
  });

  it("gibt bei Unsinn im Speicher einen leeren Stand", () => {
    localStorage.setItem("hp_pse_rallye", "{kein json");
    expect(ladeStand()).toEqual(LEERER_STAND);
    localStorage.removeItem("hp_pse_rallye");
    expect(ladeStand()).toEqual(LEERER_STAND);
  });
});
