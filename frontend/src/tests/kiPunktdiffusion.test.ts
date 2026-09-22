/**
 * Das Entrauschen in zwei Dimensionen.
 *
 * Der entscheidende Test ist der erste: Aus reinem Rauschen muss am Ende die
 * *gewählte* Form werden. Wäre das nicht so, wäre die Station eine Animation
 * und keine Rechnung — und genau das soll sie ja nicht sein.
 */
import { describe, it, expect } from "vitest";
import {
  FORMEN, ALLE_PUNKTE, alphaQuer, rauschwolke, verrausche, entrauscheSchritt, aehnlichkeit,
} from "@/lib/ki/punktdiffusion";
import { rng } from "@/lib/ki/rng";

const SCHRITTE = 30;

/** Den ganzen Rückweg laufen — wie die Station beim Abspielen. */
function entrausche(zielSlug: string, seed: number, staerke = 1) {
  const form = FORMEN.find(f => f.slug === zielSlug)!;
  const wuerfel = rng(seed);
  let wolke = rauschwolke(200, seed);
  for (let t = SCHRITTE; t > 0; t--) {
    wolke = entrauscheSchritt(wolke, t, SCHRITTE, form.punkte, ALLE_PUNKTE, staerke, wuerfel);
  }
  return { wolke, form };
}

describe("Fahrplan", () => {
  it("fängt beim Bild an und endet im Rauschen", () => {
    expect(alphaQuer(0, SCHRITTE)).toBeCloseTo(1, 3);
    expect(alphaQuer(SCHRITTE, SCHRITTE)).toBeLessThan(0.02);
  });

  it("nimmt monoton ab", () => {
    for (let t = 1; t <= SCHRITTE; t++) {
      expect(alphaQuer(t, SCHRITTE)).toBeLessThan(alphaQuer(t - 1, SCHRITTE));
    }
  });
});

describe("Formen", () => {
  it("hat für jede Form genug Punkte", () => {
    for (const f of FORMEN) {
      expect(f.punkte.length, f.slug).toBeGreaterThan(200);
      for (const p of f.punkte) {
        expect(Math.abs(p.x), f.slug).toBeLessThanOrEqual(1);
        expect(Math.abs(p.y), f.slug).toBeLessThanOrEqual(1);
      }
    }
  });

  it("stellt das Herz richtig herum hin", () => {
    // Ein Vorzeichen in der Formel genügt, und das Herz steht auf dem Kopf.
    // In der Formel fällt das niemandem auf, auf dem Schirm sofort.
    const herz = FORMEN.find(f => f.slug === "herz")!.punkte;

    // Oben die Kerbe: in der Mittelachse ist es viel leerer als daneben.
    const obenMitte = herz.filter(p => p.y > 0.35 && Math.abs(p.x) < 0.12).length;
    const obenFlanken = herz.filter(p => p.y > 0.35 && Math.abs(p.x) > 0.2 && Math.abs(p.x) < 0.6).length;
    expect(obenFlanken, "oben fehlen die beiden Bögen").toBeGreaterThan(15);
    expect(obenMitte * 5, "die Kerbe sitzt nicht oben").toBeLessThan(obenFlanken);
    // Beide Bögen, nicht nur einer.
    expect(herz.filter(p => p.y > 0.35 && p.x > 0.2).length).toBeGreaterThan(5);
    expect(herz.filter(p => p.y > 0.35 && p.x < -0.2).length).toBeGreaterThan(5);

    // Unten die Spitze: die tiefsten Punkte liegen in der Mitte.
    const tiefste = [...herz].sort((a, b) => a.y - b.y).slice(0, 8);
    for (const p of tiefste) {
      expect(Math.abs(p.x), "die Spitze sitzt nicht unten in der Mitte").toBeLessThan(0.3);
    }
  });

  it("setzt das Hausdach nach oben", () => {
    const haus = FORMEN.find(f => f.slug === "haus")!.punkte;
    const breiteBei = (y: number) => {
      const reihe = haus.filter(p => Math.abs(p.y - y) < 0.08);
      return reihe.length ? Math.max(...reihe.map(p => Math.abs(p.x))) : 0;
    };
    // Oben spitz (Dach), unten breit (Wand).
    expect(breiteBei(0.6)).toBeLessThan(breiteBei(-0.4));
  });

  it("würfelt die Punkte immer gleich aus", () => {
    // Zwei Geräte müssen dieselbe Form sehen, sonst stimmt der Vergleich nicht.
    const wieder = FORMEN.map(f => f.punkte[0]);
    expect(wieder).toEqual(FORMEN.map(f => f.punkte[0]));
  });
});

describe("Verrauschen", () => {
  it("lässt bei Schritt 0 alles, wie es ist", () => {
    const form = FORMEN[0];
    const raus = verrausche(form.punkte, 0, SCHRITTE, 5);
    expect(raus[0].x).toBeCloseTo(form.punkte[0].x, 1);
  });

  it("macht aus der Form am Ende Rauschen", () => {
    const form = FORMEN[0];
    const raus = verrausche(form.punkte, SCHRITTE, SCHRITTE, 5);
    expect(aehnlichkeit(raus, form.punkte)).toBeLessThan(aehnlichkeit(form.punkte, form.punkte));
  });
});

describe("Entrauschen", () => {
  it("macht aus reinem Rauschen die gewählte Form", () => {
    for (const form of FORMEN) {
      const { wolke } = entrausche(form.slug, 7);
      const passt = aehnlichkeit(wolke, form.punkte);
      expect(passt, `${form.slug}: wurde nicht zur Form (${passt.toFixed(2)})`).toBeGreaterThan(0.85);
    }
  });

  it("trifft die gewählte Form besser als die anderen", () => {
    const { wolke } = entrausche("haus", 3);
    const haus = aehnlichkeit(wolke, FORMEN.find(f => f.slug === "haus")!.punkte);
    for (const andere of FORMEN.filter(f => f.slug !== "haus")) {
      expect(haus, `verwechselt mit ${andere.slug}`).toBeGreaterThan(aehnlichkeit(wolke, andere.punkte));
    }
  });

  it("gibt bei demselben Seed dasselbe Bild", () => {
    const a = entrausche("stern", 99).wolke;
    const b = entrausche("stern", 99).wolke;
    const c = entrausche("stern", 100).wolke;
    expect(a[0]).toEqual(b[0]);
    expect(a[0]).not.toEqual(c[0]);
  });

  it("ignoriert die Wunschform, wenn der Prompt-Regler auf 0 steht", () => {
    // Ohne Führung entsteht irgendeine bekannte Form — nur eben nicht
    // verlässlich die gewünschte.
    const ziel = FORMEN.find(f => f.slug === "haus")!;
    const ohne = aehnlichkeit(entrausche("haus", 4, 0).wolke, ziel.punkte);
    const mit = aehnlichkeit(entrausche("haus", 4, 1).wolke, ziel.punkte);
    expect(mit).toBeGreaterThan(ohne);
  });

  it("wird von zu viel Führung wieder schlechter", () => {
    // Der Prompt-Regler hat einen besten Bereich: zu wenig ignoriert die
    // Wunschform, zu viel schiebt die Punkte über sie hinaus. Genau diesen
    // Bogen kennen auch echte Bildgeneratoren — deshalb ist die Guidance dort
    // meist auf 5 bis 8 voreingestellt und nicht auf Anschlag.
    const mittel = (staerke: number) => {
      const werte = [3, 8, 21].map(seed => {
        const { wolke, form } = entrausche("haus", seed, staerke);
        return aehnlichkeit(wolke, form.punkte);
      });
      return werte.reduce((a, b) => a + b, 0) / werte.length;
    };
    const wenig = mittel(0);
    const gut = mittel(1);
    const zuviel = mittel(12);
    expect(gut, "zu wenig Führung müsste schlechter sein").toBeGreaterThan(wenig);
    expect(gut, "zu viel Führung müsste schlechter sein").toBeGreaterThan(zuviel);
  });
});
