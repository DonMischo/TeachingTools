import { describe, expect, it } from "vitest";
import { erzeuge } from "@/lib/gelaende/gelaende";
import { passendeWahl } from "@/lib/stadt/landschaft";
import { besetzung, geldBilanz, neueWelt, schritt, welteAlsText, welteAusText, type AufBau, type Welt } from "@/lib/stadt/aufbau";
import { HANDEL, handle, inBetrieb, kapazitaet, kaufpreis, setzeAuftrag, stilllegen, VERFALL_SCHRITTE, verfallen, verkaufspreis, wasserwege, wiederKosten } from "@/lib/stadt/aufbauHandel";
import { kosten } from "@/lib/stadt/aufbauRegeln";
import type { BauTyp } from "@/lib/stadt/modell";

const g = erzeuge(passendeWahl("europaeisch", 12));

function bau(w: Welt, b: BauTyp, i: number, j: number): AufBau {
  const x: AufBau = { id: w.naechsteId++, bau: b, i, j, w: 2, h: 2, faktor: 1, dreh: 0 };
  w.bauten.push(x); w.version.bauten++;
  return x;
}
/** genug Bürger und Handwerker, damit Kontor und Hafen Personal haben */
function leute(w: Welt) {
  for (const schicht of [1, 2]) w.haeuser.push({ i: 0, j: 0, dreh: 0, bewohner: 200, ziel: 200, versorgt: 1, hoehe: 8, s: 2, hof: 0, schicht, mangel: 0, tor: 0, bauer: false } as never);
  w.version.haeuser++;
}
/** zwei Wasserfelder am selben Gewässer, weit auseinander */
function wasserPaar(): [number, number] {
  const n = g.n, start = g.wasser.findIndex(x => x > 0);
  const gesehen = new Set([start]), q = [start];
  for (let k = 0; k < q.length; k++) {
    const c = q[k], i = c % n;
    for (const nb of [i > 0 ? c - 1 : -1, i < n - 1 ? c + 1 : -1, c - n, c + n]) if (nb >= 0 && nb < n * n && g.wasser[nb] && !gesehen.has(nb)) { gesehen.add(nb); q.push(nb); }
  }
  return [start, q[Math.min(q.length - 1, 400)]];
}

describe("Handel", () => {
  it("ohne Kontor geht nichts", () => {
    const w = neueWelt(g, "europaeisch", 12);
    setzeAuftrag(w, "ziegel", 5);
    expect(handle(g, w).menge).toBe(0);
  });

  it("Kontor kauft teurer ein als der Grundpreis und verkauft billiger", () => {
    const w = neueWelt(g, "europaeisch", 12);
    leute(w);
    bau(w, "hafenkontor", 5, 5);
    expect(kapazitaet(g, w).menge).toBe(HANDEL.jeKontor);
    w.taler = 1000; w.lager.ziegel = 0; w.lager.tuch = 50;
    setzeAuftrag(w, "ziegel", 3);
    setzeAuftrag(w, "tuch", -10);
    const s = handle(g, w);
    expect(s.je.ziegel).toBe(3);
    expect(s.je.tuch).toBe(-1); // Rest der Kapazität (4 − 3)
    expect(w.taler).toBeCloseTo(1000 - 3 * kaufpreis("ziegel") + verkaufspreis("tuch"));
    expect(kaufpreis("ziegel")).toBeGreaterThan(verkaufspreis("ziegel"));
  });

  it("Verladehafen am selben Fluss bringt Kähne dazu", () => {
    const w = neueWelt(g, "europaeisch", 12);
    leute(w);
    const [a, b] = wasserPaar();
    bau(w, "verladehafen", a % g.n, Math.floor(a / g.n));
    bau(w, "hafenkontor", b % g.n, Math.floor(b / g.n));
    const wege = wasserwege(g, w);
    expect(wege).toHaveLength(1);
    expect(wege[0].pfad.length).toBeGreaterThan(1);
    expect(kapazitaet(g, w).menge).toBe(HANDEL.jeKontor + HANDEL.jeHafen);
  });

  it("Aufträge überleben Speichern und Laden", () => {
    const w = neueWelt(g, "europaeisch", 12);
    setzeAuftrag(w, "tuch", -4);
    const x = bau(w, "schmiede", 3, 3);
    stilllegen(w, x.id);
    const w2 = welteAusText(welteAlsText(w), g, "europaeisch")!;
    expect(w2.handel).toEqual({ tuch: -4 });
    expect(w2.bauten.find(b => b.id === x.id)!.still).toBe(0);
  });
});

describe("Stilllegen", () => {
  it("kein Personal, kein Unterhalt, verfällt in 500 Schritten zur Ruine", () => {
    const w = neueWelt(g, "europaeisch", 12);
    leute(w);
    const x = bau(w, "schmiede", 3, 3);
    const vorher = geldBilanz(w).unterhalt;
    stilllegen(w, x.id);
    expect(besetzung(w).quote.get(x.id)).toBe(0);
    expect(geldBilanz(w).unterhalt).toBeLessThan(vorher);
    for (let t = 0; t < VERFALL_SCHRITTE / 2; t++) verfallen(w);
    expect(x.still).toBeCloseTo(0.5);
    const k = wiederKosten(w, x);
    expect(k.taler).toBe(Math.ceil(kosten("schmiede") * 0.5));
    for (let t = 0; t < VERFALL_SCHRITTE; t++) verfallen(w);
    expect(x.still).toBe(1);
    expect(wiederKosten(w, x).taler).toBe(kosten("schmiede"));
  });

  it("in Betrieb nehmen kostet den verfallenen Anteil", () => {
    const w = neueWelt(g, "europaeisch", 12);
    const x = bau(w, "schmiede", 3, 3);
    stilllegen(w, x.id);
    for (let t = 0; t < 100; t++) verfallen(w);
    w.taler = 0;
    expect(inBetrieb(w, x.id)).toMatch(/zu teuer/);
    w.taler = 10000; w.lager.holz = 500; w.lager.bretter = 500; w.lager.ziegel = 500;
    const k = wiederKosten(w, x);
    expect(inBetrieb(w, x.id)).toBeNull();
    expect(x.still).toBeUndefined();
    expect(w.taler).toBe(10000 - k.taler);
  });

  it("ein Schritt mit stillgelegtem Betrieb läuft durch", () => {
    const w = neueWelt(g, "europaeisch", 12);
    const x = bau(w, "schmiede", 3, 3);
    stilllegen(w, x.id);
    schritt(g, w);
    expect(x.still).toBeCloseTo(1 / VERFALL_SCHRITTE);
  });
});
