/**
 * Prüft Lage und Bild: Bindungslängen, Winkel und was in welcher
 * Darstellung gezeichnet wird.
 */
import { describe, expect, it } from "vitest";
import { ausName } from "@/lib/struktur/iupac";
import { lege } from "@/lib/struktur/layout";
import { zeichne, STANDARD } from "@/components/struktur/Formelbild";
import { legeGerade } from "@/lib/struktur/layout";

/** Die Skelettformel war früher der Standard — viele Prüfungen meinen sie. */
const SKELETT = { ...STANDARD, art: "skelett" } as const;

const mol = (name: string) => {
  const r = ausName(name);
  if (!r.ok) throw new Error(`${name}: ${r.fehler}`);
  return r.m;
};

/** Winkel ABC in Grad. */
const winkel = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
  const u = { x: a.x - b.x, y: a.y - b.y }, v = { x: c.x - b.x, y: c.y - b.y };
  const cos = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
};

describe("Lage", () => {
  it("legt jede Bindung gleich lang", () => {
    for (const name of ["Octan", "Cyclohexan", "2,3-Dimethylbutan", "Essigsäure", "Glycerin"]) {
      const m = mol(name);
      const { punkte } = lege(m);
      for (const b of m.bindungen) {
        const d = Math.hypot(punkte[b.a].x - punkte[b.b].x, punkte[b.a].y - punkte[b.b].y);
        expect(d, `${name}: Bindung ${b.a}–${b.b}`).toBeCloseTo(1, 1);
      }
    }
  });

  it("knickt die Kette im Zickzack statt sie gerade zu ziehen", () => {
    const m = mol("Pentan");
    const { punkte } = lege(m);
    // Der Winkel an jedem mittleren C liegt bei 120°, nicht bei 180°.
    for (let i = 1; i < 4; i++) {
      expect(winkel(punkte[i - 1], punkte[i], punkte[i + 1])).toBeCloseTo(120, 0);
    }
  });

  it("setzt die Reste in die Lücke, nicht auf die Kette", () => {
    const m = mol("Essigsäure");
    const { punkte } = lege(m);
    // An C1 treffen C2, =O und −OH zusammen: jeder Winkel deutlich über 90°.
    const [c1] = [0];
    const nachbarn = m.bindungen.flatMap(b => (b.a === c1 ? [b.b] : b.b === c1 ? [b.a] : []));
    expect(nachbarn).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        expect(winkel(punkte[nachbarn[i]], punkte[c1], punkte[nachbarn[j]])).toBeGreaterThan(90);
      }
    }
  });

  it("legt den Ring als regelmäßiges Sechseck", () => {
    const m = mol("Cyclohexan");
    const { punkte } = lege(m);
    for (let i = 0; i < 6; i++) {
      expect(winkel(punkte[(i + 5) % 6], punkte[i], punkte[(i + 1) % 6])).toBeCloseTo(120, 0);
    }
  });
});

describe("Bild", () => {
  it("beschriftet in der Skelettformel nur die Heteroatome", () => {
    const bild = zeichne(mol("Ethanol"), SKELETT);
    expect(bild.texte.map(t => t.text)).toEqual(["OH"]);
  });

  it("schreibt mit »alle H« auch die C-Atome aus", () => {
    const bild = zeichne(mol("Ethanol"), { ...SKELETT, alleH: true });
    expect(bild.texte.map(t => t.text).sort()).toEqual(["CH²", "CH³", "OH"].sort());
  });

  it("zeichnet in der Valenzstrichformel jedes H einzeln", () => {
    const bild = zeichne(mol("Methan"), { ...STANDARD, art: "gerade" });
    expect(bild.texte.filter(t => t.text === "H")).toHaveLength(4);
    // Vier C–H-Bindungen als Striche.
    expect(bild.striche).toHaveLength(4);
  });

  it("zeichnet die Doppelbindung als zwei Striche, die Dreifachbindung als drei", () => {
    expect(zeichne(mol("Ethen"), SKELETT).striche).toHaveLength(2);
    expect(zeichne(mol("Ethin"), SKELETT).striche).toHaveLength(3);
  });

  it("setzt freie Elektronenpaare als Punktepaare", () => {
    const ohne = zeichne(mol("Ethanol"), SKELETT).punkte.length;
    const mit = zeichne(mol("Ethanol"), { ...SKELETT, paare: true }).punkte.length;
    // Sauerstoff hat zwei freie Paare, also vier Punkte mehr.
    expect(mit - ohne).toBe(4);
  });

  it("lässt nichts aus dem Bild herausragen", () => {
    for (const name of ["Methan", "Ethanol", "Cyclohexan", "Essigsäure"]) {
      for (const art of ["skelett", "gerade", "winkel"] as const) {
        const b = zeichne(mol(name), { ...STANDARD, art, paare: true, alleH: true });
        const xs = [...b.striche.flatMap(s => [s.x1, s.x2]), ...b.texte.map(t => t.x), ...b.punkte.map(p => p.x)];
        const ys = [...b.striche.flatMap(s => [s.y1, s.y2]), ...b.texte.map(t => t.y), ...b.punkte.map(p => p.y)];
        expect(Math.min(...xs), `${name}/${art}`).toBeGreaterThanOrEqual(0);
        expect(Math.min(...ys), `${name}/${art}`).toBeGreaterThanOrEqual(0);
        expect(Math.max(...xs), `${name}/${art}`).toBeLessThanOrEqual(b.breite);
        expect(Math.max(...ys), `${name}/${art}`).toBeLessThanOrEqual(b.hoehe);
      }
    }
  });

  it("dreht das Bild, ohne die Bindungslängen zu ändern", () => {
    const gerade = zeichne(mol("Butan"), SKELETT);
    const gedreht = zeichne(mol("Butan"), { ...SKELETT, drehung: 90 });
    const laenge = (b: typeof gerade) =>
      b.striche.map(s => Math.round(Math.hypot(s.x2 - s.x1, s.y2 - s.y1)));
    expect(laenge(gedreht)).toEqual(laenge(gerade));
    // Gedreht ist das Bild hochkant statt quer.
    expect(gedreht.hoehe).toBeGreaterThan(gedreht.breite);
    expect(gerade.breite).toBeGreaterThan(gerade.hoehe);
  });
});

describe("Schulform (gerade)", () => {
  const BEISPIELE = ["Butan", "2,3-Dimethylbutan", "3-Ethylpentan", "Ethanol", "Essigsäure", "Propan-2-on", "Glycerin", "2-Chlorpropan"];

  it("legt die Hauptkette auf eine Linie", () => {
    for (const name of BEISPIELE) {
      const m = mol(name);
      const { punkte } = legeGerade(m);
      const kette = m.atome.map((a, i) => ({ a, i })).filter(x => x.a.kette !== undefined);
      const hoehen = new Set(kette.map(({ i }) => Math.round(punkte[i].y * 100)));
      expect(hoehen.size, `${name}: Kette auf ${hoehen.size} Höhen`).toBe(1);
    }
  });

  it("zieht jede Bindung waagerecht oder senkrecht", () => {
    for (const name of BEISPIELE) {
      const m = mol(name);
      const { punkte } = legeGerade(m);
      for (const b of m.bindungen) {
        const dx = Math.abs(punkte[b.a].x - punkte[b.b].x);
        const dy = Math.abs(punkte[b.a].y - punkte[b.b].y);
        expect(Math.min(dx, dy), `${name}: Bindung ${b.a}–${b.b} liegt schräg`).toBeCloseTo(0, 5);
      }
    }
  });

  it("gibt keinen Gitterplatz zweimal aus", () => {
    for (const name of BEISPIELE) {
      const { punkte } = legeGerade(mol(name));
      const plaetze = punkte.map(p => `${Math.round(p.x)},${Math.round(p.y)}`);
      expect(new Set(plaetze).size, `${name}: Atome liegen aufeinander`).toBe(plaetze.length);
    }
  });

  it("lässt keinen Strich durch einen Buchstaben laufen", () => {
    for (const name of BEISPIELE) {
      const b = zeichne(mol(name), { ...STANDARD, art: "gerade" });
      for (const t of b.texte) {
        // Schriftkasten grob abschätzen — etwas kleiner als beim Zeichnen,
        // damit die Prüfung nicht an der Luft daneben scheitert.
        const hb = t.text.length * (t.klein ? 4.6 : 5.6) + 1;
        const hh = (t.klein ? 15 : 18) * 0.42;
        for (const s of b.striche) {
          const treffer = schneidet(s, t.x, t.y, hb, hh);
          expect(treffer, `${name}: Strich kreuzt »${t.text}«`).toBe(false);
        }
      }
    }
  });

  it("hält die Beschriftungen auseinander", () => {
    for (const name of BEISPIELE) {
      const b = zeichne(mol(name), { ...STANDARD, art: "gerade" });
      for (let i = 0; i < b.texte.length; i++) {
        for (let j = i + 1; j < b.texte.length; j++) {
          const d = Math.hypot(b.texte[i].x - b.texte[j].x, b.texte[i].y - b.texte[j].y);
          expect(d, `${name}: »${b.texte[i].text}« und »${b.texte[j].text}« zu dicht`).toBeGreaterThan(18);
        }
      }
    }
  });
});

/** Kreuzt die Strecke das Rechteck um (cx, cy)? Abgetastet, das reicht hier. */
function schneidet(s: { x1: number; y1: number; x2: number; y2: number },
  cx: number, cy: number, hb: number, hh: number): boolean {
  for (let k = 0; k <= 40; k++) {
    const x = s.x1 + ((s.x2 - s.x1) * k) / 40;
    const y = s.y1 + ((s.y2 - s.y1) * k) / 40;
    if (Math.abs(x - cx) < hb && Math.abs(y - cy) < hh) return true;
  }
  return false;
}

describe("Schulform: alles gerade", () => {
  /** Verzweigte Fälle, bei denen Abzweigungen um Platz konkurrieren. */
  const ENG = [
    "2,3-Dimethylbutan", "2,2-Dimethylpropan", "3,4-Diethyl-5,5-Dimethyloctan",
    "2-Methylpropan", "3-Ethylpentan", "Propan-1,2,3-triol", "Butan-2-on",
    // Ein Kettenatom mit zwei Resten zwingt den Nachbarn auf dieselbe Seite —
    // dort stiessen die H-Atome vorher aneinander.
    "2,3,3-Trimethylpentan", "2,3,3-Trimethylbutan", "2,2,3,3-Tetramethylbutan",
    "2,3,4-Trimethylpentan",
  ];

  it("stellt jedes H-Atom gerade neben sein Atom, nie schräg", () => {
    for (const name of ENG) {
      const b = zeichne(mol(name), { ...STANDARD, art: "gerade" });
      for (const s of b.striche) {
        const dx = Math.abs(s.x2 - s.x1), dy = Math.abs(s.y2 - s.y1);
        expect(Math.min(dx, dy), `${name}: schräger Strich`).toBeLessThan(0.5);
      }
    }
  });

  it("hält auch in den engen Fällen die Beschriftungen auseinander", () => {
    for (const name of ENG) {
      const b = zeichne(mol(name), { ...STANDARD, art: "gerade" });
      for (let i = 0; i < b.texte.length; i++) {
        for (let j = i + 1; j < b.texte.length; j++) {
          const d = Math.hypot(b.texte[i].x - b.texte[j].x, b.texte[i].y - b.texte[j].y);
          expect(d, `${name}: »${b.texte[i].text}« und »${b.texte[j].text}« zu dicht`).toBeGreaterThan(18);
        }
      }
    }
  });

  it("lässt auch in den engen Fällen keinen Strich durch einen Buchstaben laufen", () => {
    for (const name of ENG) {
      const b = zeichne(mol(name), { ...STANDARD, art: "gerade" });
      for (const t of b.texte) {
        const hb = t.text.length * (t.klein ? 4.6 : 5.6) + 1;
        const hh = (t.klein ? 15 : 18) * 0.42;
        for (const s of b.striche) {
          expect(schneidet(s, t.x, t.y, hb, hh), `${name}: Strich kreuzt »${t.text}«`).toBe(false);
        }
      }
    }
  });

  it("setzt Abzweigungen benachbarter Kettenatome auf verschiedene Seiten", () => {
    const m = mol("2,3-Dimethylbutan");
    const { punkte } = legeGerade(m);
    const zweige = m.atome
      .map((a, i) => ({ a, i }))
      .filter(x => x.a.kette === undefined)
      .map(x => Math.sign(punkte[x.i].y - punkte[0].y));
    expect(zweige.sort()).toEqual([-1, 1]);
  });
});
