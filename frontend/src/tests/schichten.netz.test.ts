import { describe, expect, it } from "vitest";
import { DNS, ROUTER, ZIELE, begruendung, besterEintrag, frageDns, nachbarn, passt, router } from "@/lib/schichten/netz";

describe("Spielnetz: Routing", () => {
  it("passt vergleicht die vorderen Bits", () => {
    expect(passt("203.0.113.7", "203.0.113.0/25")).toBe(true);
    expect(passt("203.0.113.200", "203.0.113.0/25")).toBe(false);
    expect(passt("203.0.113.200", "203.0.113.128/25")).toBe(true);
    expect(passt("8.8.8.8", "0.0.0.0/0")).toBe(true);
  });

  it("jeder Tabelleneintrag führt zu einem Nachbarn", () => {
    for (const r of ROUTER) for (const e of r.tabelle) if (e.nach !== "lokal") expect(nachbarn(r.id)).toContain(e.nach);
  });

  it("jedes Ziel ist vom Heimrouter aus ohne Schleife erreichbar", () => {
    for (const z of ZIELE) {
      let jetzt = "heim";
      const besucht = new Set<string>();
      while (true) {
        expect(besucht.has(jetzt)).toBe(false);
        besucht.add(jetzt);
        const e = besterEintrag(router(jetzt), z.ip)!;
        if (e.nach === "lokal") break;
        jetzt = e.nach;
      }
      expect(jetzt).toBe(z.router);
    }
  });

  it("jeder Weg hat mindestens eine Falle: ein gröberer Treffer zeigt woandershin", () => {
    for (const z of ZIELE) {
      let jetzt = "heim", fallen = 0;
      while (true) {
        const r = router(jetzt);
        const e = besterEintrag(r, z.ip)!;
        if (r.tabelle.some(x => x !== e && x.nach !== e.nach && passt(z.ip, x.netz))) fallen++;
        if (e.nach === "lokal") break;
        jetzt = e.nach;
      }
      expect(fallen, z.ort).toBeGreaterThanOrEqual(2);
    }
  });

  it("verlangt unterwegs den längsten Treffer (Präfix schlägt Standardroute)", () => {
    expect(besterEintrag(router("fra"), "203.0.113.7")!.nach).toBe("ist");
    expect(besterEintrag(router("sin"), "203.0.113.7")!.nach).toBe("tyo");
    expect(besterEintrag(router("sin"), "203.0.113.200")!.nach).toBe("hkg");
    expect(begruendung(router("fra"), "203.0.113.7", "msk")).toContain("genauer");
    expect(begruendung(router("fra"), "203.0.113.7", "erf")).toContain("kein Eintrag");
  });
});

describe("Spielnetz: DNS", () => {
  it("Root → .example → Zone liefert die Adresse jedes Ziels", () => {
    for (const z of ZIELE) {
      const a = frageDns(DNS.find(d => d.art === "root")!, z);
      expect(a.art).toBe("verweis");
      if (a.art !== "verweis") continue;
      const b = frageDns(a.server, z);
      expect(b.art).toBe("verweis");
      if (b.art !== "verweis") continue;
      const c = frageDns(b.server, z);
      expect(c).toMatchObject({ art: "antwort", ip: z.ip });
    }
  });

  it("falsche Server sagen, wofür sie zuständig sind", () => {
    expect(frageDns(DNS.find(d => d.id === "tld-jp")!, ZIELE[0]).art).toBe("falsch");
    expect(frageDns(DNS.find(d => d.id === "ns-hund")!, ZIELE[0]).art).toBe("falsch");
  });
});
