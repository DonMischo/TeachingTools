import { describe, expect, it } from "vitest";
import {
  boden, kennzahlen, mhw, neuesProfil, schritt, sturmflut, wasserstand, wellen, wellenhoehe,
  type Profil, type Wetter,
} from "@/lib/kueste/profil";
import { anwenden } from "@/lib/kueste/massnahmen";
import { begriffe } from "@/lib/kueste/begriffe";
import {
  aufspuelen, buhneSetzen, deckwerkSetzen, hakenLaenge, laengsSchritt, neueKueste, KLIFF_ZELLEN,
} from "@/lib/kueste/laengs";

const STURM: Wetter = { bft: 9, auflandig: true, regen: false, frost: false };
const RUHE: Wetter = { bft: 3, auflandig: true, regen: false, frost: false };
const WIND: Wetter = { bft: 6, auflandig: true, regen: false, frost: false };

function lauf(p: Profil, w: Wetter, stunden: number) {
  for (let h = 0; h < stunden; h++) schritt(p, w, 1);
}
const summe = (a: Float64Array) => a.reduce((s, v) => s + v, 0);
/** Sand über der mittleren Hochwasserlinie (m³ je m Küste) */
function sandOben(p: Profil) {
  let s = 0;
  for (let i = 0; i < p.n; i++) s += Math.max(0, Math.min(p.sand[i], boden(p, i) - mhw(p)));
  return s;
}

describe("Flachküste", () => {
  it("Sturm trägt Sand vom Strand ab — nichts geht verloren außer dem, was weggetragen wird", () => {
    const p = neuesProfil("flach");
    const vorher = summe(p.sand), oben = sandOben(p);
    sturmflut(p, 0.8);
    lauf(p, STURM, 48);
    expect(sandOben(p)).toBeLessThan(oben - 5);
    expect(p.bilanz.weggetragen).toBeGreaterThan(0);
    expect(summe(p.sand)).toBeCloseTo(vorher - p.bilanz.weggetragen, 3);
  });

  it("ruhiges Wetter bringt Sand an den Strand zurück", () => {
    const p = neuesProfil("flach");
    sturmflut(p, 0.8);
    lauf(p, STURM, 48);
    const nachSturm = sandOben(p);
    lauf(p, RUHE, 24 * 60);
    expect(sandOben(p)).toBeGreaterThan(nachSturm + 2);
  });

  it("auflandiger Wind weht Sand in die Düne", () => {
    const p = neuesProfil("flach");
    const k = kennzahlen(p).kroneX;
    const duene = summe(p.sand.slice(k - 25, k + 1));
    lauf(p, WIND, 24 * 20);
    expect(p.bilanz.angeweht).toBeGreaterThan(1);
    expect(summe(p.sand.slice(k - 25, k + 1))).toBeGreaterThan(duene);
  });

  it("eine Vorstrandaufspülung lässt die Wellen früher brechen", () => {
    const p = neuesProfil("flach");
    const W = wasserstand(p, WIND), H0 = wellenhoehe(p, WIND);
    const vorher = wellen(p, W, H0);
    expect(anwenden(p, "vorstrand").ok).toBe(true);
    const nachher = wellen(p, W, H0);
    expect(nachher.amUfer).toBeLessThan(vorher.amUfer);
    expect(nachher.brecher).toBeLessThan(vorher.brecher);
    expect(p.kosten).toBeGreaterThan(0);
  });

  it("eine Strandaufspülung macht den Strand breiter", () => {
    const p = neuesProfil("flach");
    sturmflut(p, 1);
    lauf(p, STURM, 30);
    const schmal = kennzahlen(p).strand;
    anwenden(p, "strand");
    expect(kennzahlen(p).strand).toBeGreaterThan(schmal);
    expect(p.bilanz.aufgespuelt).toBeGreaterThan(50);
  });

  it("ein Deckwerk hält, aber der Strand davor verliert Sand", () => {
    const ohne = neuesProfil("flach"), mit = neuesProfil("flach");
    anwenden(mit, "deckwerk");
    for (const p of [ohne, mit]) { sturmflut(p, 1); lauf(p, STURM, 30); }
    const dw = Array.from(mit.schutz).indexOf(1);
    // Hinter dem Deckwerk bleibt die Düne stehen …
    expect(summe(mit.sand.slice(dw + 10))).toBeGreaterThanOrEqual(summe(ohne.sand.slice(dw + 10)) - 2);
    // … davor liegt weniger Sand als ohne Deckwerk.
    expect(summe(mit.sand.slice(dw - 10, dw))).toBeLessThan(summe(ohne.sand.slice(dw - 10, dw)));
  });

  it("zeigt die Begriffe aus dem Profil", () => {
    const p = neuesProfil("flach");
    const ids = begriffe(p, wasserstand(p, WIND), wellenhoehe(p, WIND)).map(b => b.id);
    for (const id of ["mhw", "mnw", "riff", "brecher", "spuel", "strand", "duene"]) expect(ids).toContain(id);
  });
});

describe("Steilküste", () => {
  it("die Brandung frisst eine Hohlkehle, dann bricht das Kliff ab und liegt als Halde davor", () => {
    const p = neuesProfil("steil");
    const kante = kennzahlen(p).kante;
    let t = 0;
    while (kennzahlen(p).kante === kante && t < 24 * 365 * 3) { schritt(p, STURM, 1); t++; }
    expect(kennzahlen(p).kante).toBeGreaterThan(kante);
    expect(p.bilanz.kliff).toBeGreaterThan(10);
    expect(p.meldungen.some(m => m.text.startsWith("Kliffabbruch"))).toBe(true);
    expect(begriffe(p, 0, 1).map(b => b.id)).toContain("halde");
  });

  it("ein Deckwerk am Kliffuß verhindert die Hohlkehle", () => {
    const p = neuesProfil("steil");
    // Halde vorher abräumen lassen, damit die Brandung die Wand erreicht
    lauf(p, STURM, 24 * 60);
    p.kehle = 0;
    anwenden(p, "deckwerk");
    lauf(p, STURM, 24 * 30);
    expect(p.kehle).toBe(0);
  });

  it("zeigt Kliff, Hohlkehle, Blockstrand und Abrasionsplattform", () => {
    const p = neuesProfil("steil");
    const ids = begriffe(p, 0, 1).map(b => b.id);
    for (const id of ["kliff", "kehle", "block", "plattform", "mw"]) expect(ids).toContain(id);
  });
});

describe("Marschküste mit Deich", () => {
  const ORKAN: Wetter = { bft: 11, auflandig: true, regen: true, frost: false };

  it("eine schwere Sturmflut bricht den alten Deich und flutet den Koog", () => {
    const p = neuesProfil("marsch");
    // Sturmflut zum Hochwasser: Stunde 0 ist Hochwasser, der Scheitel liegt 15 h später → nahe HW bei 12,4·1
    p.stunde = 12.42 * 2 - 15;
    sturmflut(p, 1);
    lauf(p, ORKAN, 30);
    expect(p.deichGebrochen).toBe(true);
    expect(p.objekte.some(o => o.nass)).toBe(true);
    expect(p.schaden).toBeGreaterThan(0);
  });

  it("der verstärkte Deich hält dieselbe Sturmflut", () => {
    const p = neuesProfil("marsch");
    anwenden(p, "deich");
    p.stunde = 12.42 * 2 - 15;
    sturmflut(p, 1);
    lauf(p, ORKAN, 30);
    expect(p.deichGebrochen).toBe(false);
    expect(p.objekte.filter(o => o.art === "haus").every(o => !o.nass)).toBe(true);
  });

  it("zwischen Lahnungen wächst eine Salzwiese", () => {
    const p = neuesProfil("marsch");
    anwenden(p, "lahnung");
    const lz = Array.from(p.schutz).indexOf(2);
    const vorher = boden(p, lz + 40);
    lauf(p, RUHE, 24 * 365);
    expect(boden(p, lz + 40)).toBeGreaterThan(vorher + 0.03);
  });

  it("zeigt die Teile des Deichs", () => {
    const p = neuesProfil("marsch");
    const ids = begriffe(p, 0, 1).map(b => b.id);
    for (const id of ["watt", "wattpriel", "vorland", "aussen", "kronen", "binnen", "klei", "kern", "koog"]) expect(ids).toContain(id);
  });
});

describe("Küstenlängsstrom", () => {
  const jahr = (k: ReturnType<typeof neueKueste>, winkel = 25, H = 1.2) => {
    for (let h = 0; h < 8766; h += 6) laengsSchritt(k, H, winkel, 6);
  };

  it("schräge Wellen tragen Sand zum Haken, das Kliff liefert nach", () => {
    const k = neueKueste();
    jahr(k);
    expect(hakenLaenge(k)).toBeGreaterThan(10);
    expect(k.geliefert).toBeGreaterThan(0);
  });

  it("eine Buhne fängt Sand im Luv, im Lee fehlt er", () => {
    const ohne = neueKueste(), mit = neueKueste();
    buhneSetzen(mit, 50);
    jahr(ohne); jahr(mit);
    expect(mit.y[49]).toBeGreaterThan(ohne.y[49] + 1);
    expect(mit.y[51]).toBeLessThan(ohne.y[51] - 1);
  });

  it("ein Deckwerk am Kliff stoppt den Nachschub", () => {
    const ohne = neueKueste(), mit = neueKueste();
    for (let i = 0; i < KLIFF_ZELLEN; i += 5) deckwerkSetzen(mit, i + 2);
    jahr(ohne); jahr(mit);
    expect(mit.geliefert).toBeLessThan(ohne.geliefert * 0.2);
  });

  it("eine Aufspülung verbreitert den Strand und kostet Geld", () => {
    const k = neueKueste();
    const vorher = k.y[60];
    expect(aufspuelen(k, 60)).toBeGreaterThan(0);
    expect(k.y[60]).toBeGreaterThan(vorher + 20);
    expect(k.kosten).toBeGreaterThan(0);
  });
});
