/**
 * Vertrag zwischen Karten und Baukästen (TT-Weltenwerkstatt/docs/karten-vertrag.md, Abschnitt 5):
 * Erreichbarkeit, Mindestmaße, Wanddicken, Durchgänge, Seeds.
 */
import { describe, expect, it } from "vitest";
import { DURCHGANG, PLATZ, WAND, baueFreiPlan, freiAbstaende, type FreiEbene, type KartenArt } from "@/lib/gebaeude/frei";
import { wandDickeBei, zuEng } from "@/lib/gebaeude/karte";
import { BRUECKE_LANG } from "@/lib/gebaeude/lichtung";

const NEU: KartenArt[] = ["lichtung", "bach", "hoehle", "hoehlebach", "saal", "burgsaal", "tempel"];
const SEEDS = [1, 3, 8, 21, 42];
const ZIMMER = [1, 2, 5, 8];

const karten = new Map<string, FreiEbene[]>();
function alle(art: KartenArt): FreiEbene[] {
  if (!karten.has(art)) karten.set(art, SEEDS.flatMap(s => baueFreiPlan(ZIMMER, s, ZIMMER.map(() => art)).ebenen));
  return karten.get(art)!;
}

describe("Karten aus den Spielalgorithmen", () => {
  for (const art of NEU) {
    describe(art, () => {
      it("genau so viele Stationen wie Aufgaben, alle und das Ziel vom Start erreichbar", () => {
        alle(art).forEach((e, i) => {
          expect(e.raeume.length).toBe(ZIMMER[i % ZIMMER.length]);
          const d = freiAbstaende(e, e.start);
          for (const [x, y] of [e.ziel, ...e.raeume.map(r => [r.x, r.y] as [number, number])]) expect(d[y * e.b + x]).toBeGreaterThan(0);
        });
      });

      it("gleicher Seed, gleiche Karte", () => {
        const a = baueFreiPlan([3], 11, [art]).ebenen[0], b = baueFreiPlan([3], 11, [art]).ebenen[0];
        expect(Array.from(a.art)).toEqual(Array.from(b.art));
        expect(a.saele).toEqual(b.saele);
        expect(a.seed).toBe(b.seed);
      });

      it("liefert Ablauf, Säle und Wanddicken", () => {
        for (const e of alle(art)) {
          expect(e.ablauf?.knoten.length).toBe(e.saele?.filter(s => s.art !== "vorplatz").length);
          expect(e.saele?.filter(s => s.art === "station").length).toBe(e.raeume.length);
          expect(e.wanddicke?.length).toBe(e.b * e.h);
        }
      });

      it("1–2 Hallen ohne Aufgabe je Ebene, als Sackgasse abseits des Wegs zwischen Start und Ziel", () => {
        for (const e of alle(art)) {
          const hallen = e.saele!.filter(s => s.art === "halle");
          expect(hallen.length).toBeGreaterThanOrEqual(1);
          const sack = e.ablauf!.knoten.filter(k => k.id > 1 && e.ablauf!.kanten.filter(x => x.a === k.id || x.b === k.id).length === 1);
          expect(sack.length).toBeGreaterThanOrEqual(1);
          for (const k of sack) expect(e.saele![e.ablauf!.saal[k.id]].art).toBe("halle");
        }
      });

      if (art !== "lichtung" && art !== "bach") {
        it("kein Gang schmaler als 3 Felder", () => {
          // Türen sind absichtlich 2 Felder breit
          for (const e of alle(art)) expect(zuEng(e, 3).filter(i => e.art[i] !== DURCHGANG)).toEqual([]);
        });
      }
    });
  }

  describe("Gebäude", () => {
    for (const art of ["saal", "burgsaal", "tempel"] as KartenArt[]) {
      const wand = art === "tempel" ? 2 : 1;
      it(`${art}: Säle gerade, ≥ 8 × 8 Felder, ganz Platz`, () => {
        for (const e of alle(art)) for (const s of e.saele!.filter(q => q.art !== "vorplatz")) {
          expect(s.b % 2 + s.h % 2 + s.x % 2 + s.y % 2).toBe(0);
          expect(Math.min(s.b, s.h)).toBeGreaterThanOrEqual(8);
          for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.b; x++) expect(e.art[y * e.b + x]).toBe(PLATZ);
        }
      });

      it(`${art}: Wand um jeden Saal mindestens ${wand} Feld(er) dick, außer an Durchgängen`, () => {
        for (const e of alle(art)) for (const s of e.saele!) {
          const kante: [number, number, number, number][] = [];
          for (let x = s.x; x < s.x + s.b; x++) kante.push([x, s.y - 1, 0, -1], [x, s.y + s.h, 0, 1]);
          for (let y = s.y; y < s.y + s.h; y++) kante.push([s.x - 1, y, -1, 0], [s.x + s.b, y, 1, 0]);
          for (const [x, y, dx, dy] of kante) {
            if (e.art[y * e.b + x] === DURCHGANG) continue;
            expect(e.art[y * e.b + x]).toBe(WAND);
            expect(wandDickeBei(e, x, y, dx, dy)).toBeGreaterThanOrEqual(wand);
            expect(e.wanddicke![y * e.b + x]).toBeGreaterThanOrEqual(wand);
          }
        }
      });

      it(`${art}: Durchgänge 2 Felder breit, auf gerade Felder ausgerichtet, Saal auf der einen, Gang auf der anderen Seite`, () => {
        for (const e of alle(art)) {
          expect(e.durchgaenge!.length).toBeGreaterThanOrEqual(2 * (e.saele!.length - 1));
          for (const t of e.durchgaenge!) {
            expect(t.breite).toBe(2);
            expect(t.tiefe).toBe(wand);
            expect(t.dx ? t.y % 2 : t.x % 2).toBe(0);
            const ax = Math.abs(t.dx), ay = Math.abs(t.dy);
            for (let w = 0; w < 2; w++) {
              const x = t.x + ay * w, y = t.y + ax * w;
              for (let q = 0; q < t.tiefe; q++) expect(e.art[(y + ay * q) * e.b + x + ax * q]).toBe(DURCHGANG);
              const vor = (y - ay) * e.b + x - ax, nach = (y + ay * t.tiefe) * e.b + x + ax * t.tiefe;
              const [saal, gang] = t.dx > 0 || t.dy > 0 ? [vor, nach] : [nach, vor];
              expect(e.art[saal]).toBe(PLATZ);
              expect(e.art[gang]).toBe(1);
            }
          }
        }
      });
    }

    it("tempel: Vorplatz unter freiem Himmel ≥ 17 × 33 Felder, Ankunft davor, genau ein Gang hinaus", () => {
      for (const e of alle("tempel")) {
        const v = e.vorplatz!;
        expect(v.platz.b).toBeGreaterThanOrEqual(17);
        expect(v.platz.h).toBeGreaterThanOrEqual(33);
        const [sx, sy] = e.start;
        expect(sx >= v.platz.x && sx < v.platz.x + v.platz.b && sy > v.kern.y + v.kern.h && sy < v.platz.y + v.platz.h).toBe(true);
        const nr = e.saele!.findIndex(s => s.art === "vorplatz");
        expect(e.durchgaenge!.filter(t => t.saal === nr).length).toBe(1);
        for (let y = v.platz.y; y < v.platz.y + v.platz.h; y++) for (let x = v.platz.x; x < v.platz.x + v.platz.b; x++) {
          const imKern = x >= v.kern.x && x < v.kern.x + v.kern.b && y >= v.kern.y && y < v.kern.y + v.kern.h;
          expect(e.art[y * e.b + x]).toBe(imKern ? WAND : PLATZ);
        }
      }
    });

    it("Höhen je Stil", () => {
      expect(baueFreiPlan([2], 1, ["tempel"]).ebenen[0].hoehe).toBe(6);
      expect(baueFreiPlan([2], 1, ["burgsaal"]).ebenen[0].hoehe).toBe(6);
      expect(baueFreiPlan([2], 1, ["saal"]).ebenen[0].hoehe).toBe(4.05);
      expect(baueFreiPlan([2], 1, ["hoehle"]).ebenen[0].hoehe).toBe(8);
      expect(baueFreiPlan([2], 1, ["bach"]).ebenen[0].hoehe).toBeUndefined();
    });
  });

  describe("Höhle", () => {
    it("Hallen an den Stationen mindestens 7 × 7 Felder frei", () => {
      for (const art of ["hoehle", "hoehlebach"] as KartenArt[]) for (const e of alle(art)) {
        for (const [x, y] of [e.start, e.ziel, ...e.raeume.map(r => [r.x, r.y] as [number, number])]) {
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) expect(e.art[(y + dy) * e.b + x + dx]).not.toBe(WAND);
        }
      }
    });

    it("Ziel ist ein Tor in der Wand: 3 Felder breit, 4 Felder Fels dahinter, davor begehbar", () => {
      for (const art of ["hoehle", "hoehlebach"] as KartenArt[]) for (const e of alle(art)) {
        const t = e.tor!;
        expect(t).toBeDefined();
        for (let s = -1; s <= 1; s++) {
          const x = t.x + t.dy * s, y = t.y + t.dx * s;
          expect(wandDickeBei(e, x, y, t.dx, t.dy)).toBeGreaterThanOrEqual(4);
          expect(e.art[(y - t.dy) * e.b + x - t.dx]).not.toBe(WAND);
        }
      }
    });
  });

  describe("Quelle in der Höhle", () => {
    it("der Bach entspringt an einer geraden Felswand von 4 Feldern, davor 3 Felder Becken", () => {
      for (const e of alle("hoehlebach")) {
        const q = e.quelle!;
        expect(q).toBeDefined();
        const px = -q.dy, py = q.dx;
        // Felder der Wand: von der Kantenmitte einen halben Schritt zurück, quer 4 Felder
        for (let k = -2; k <= 1; k++) {
          const x = Math.floor(q.x - q.dx * 0.5 + px * (k + 0.5)), y = Math.floor(q.y - q.dy * 0.5 + py * (k + 0.5));
          expect(e.art[y * e.b + x]).toBe(WAND);
          expect(e.wasser![y * e.b + x]).toBe(0);
          for (let m = 1; m <= 3; m++) expect(e.wasser![(y + q.dy * m) * e.b + x + q.dx * m]).toBe(1);
        }
      }
    });
  });

  describe("Bach", () => {
    it("an jeder Brücke läuft der Pfad 7 Felder geradeaus über das Wasser", () => {
      let n = 0;
      for (const art of ["bach", "hoehlebach"] as KartenArt[]) for (const e of alle(art)) for (const b of e.bruecken ?? []) {
        n++;
        expect(b.lang).toBe(BRUECKE_LANG);
        const ux = Math.cos(b.winkel), uy = Math.sin(b.winkel);
        for (let t = -3; t <= 3; t += 0.5) {
          const x = Math.floor(b.x + ux * t), y = Math.floor(b.y + uy * t);
          expect(e.art[y * e.b + x]).not.toBe(WAND);
        }
      }
      expect(n).toBeGreaterThan(5);
    });

    it("Wasser ist nicht begehbar, außer unter Brücken", () => {
      for (const e of alle("bach")) {
        const w = e.wasser!;
        for (let i = 0; i < w.length; i++) {
          if (!w[i] || e.art[i] === WAND) continue;
          const x = i % e.b + 0.5, y = Math.floor(i / e.b) + 0.5;
          expect(e.bruecken!.some(b => Math.hypot(b.x - x, b.y - y) < BRUECKE_LANG / 2 + 1.5)).toBe(true);
        }
      }
    });
  });
});
