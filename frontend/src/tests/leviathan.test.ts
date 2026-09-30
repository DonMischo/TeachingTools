import { describe, expect, it } from "vitest";
import { EREIGNIS, EREIGNISSE } from "@/lib/leviathan/ereignisse";
import { LAENDERTYPEN } from "@/lib/leviathan/laender";
import {
  budget, leereVerteilung, leviathan, lernfaktor, neuesSpiel, runde, wiederaufbau, ZUSAMMENBRUCH_DREHBUCH,
} from "@/lib/leviathan/motor";
import { QUELLEN } from "@/lib/leviathan/quellen";
import { REGELN, SCHLEIFEN } from "@/lib/leviathan/regeln";
import { GROESSEN, HEBEL, STANDARD_EINSTELLUNGEN, type Einstellungen, type Verteilung, type Zustand } from "@/lib/leviathan/typen";

const gleich = (z: Zustand): Verteilung => {
  const v = leereVerteilung();
  const hs = HEBEL.filter((h) => !(z.gesperrt[h] ?? 0));
  for (let ap = budget(z).gesamt, i = 0; ap > 0; ap--, i++) v[hs[i % hs.length]]++;
  return v;
};

function spiele(typ: Parameters<typeof neuesSpiel>[0], einst: Partial<Einstellungen> = {}, seed = 42) {
  let z = neuesSpiel(typ, { ...STANDARD_EINSTELLUNGEN, ...einst }, seed);
  while (z.status === "laeuft") z = runde(z, gleich(z));
  return z;
}

describe("Leviathan – Daten", () => {
  it("jede Regel, jedes Ereignis und jede Schleife nennt eine bekannte Quelle", () => {
    for (const r of REGELN) expect(QUELLEN[r.quelle], r.quelle).toBeDefined();
    for (const e of EREIGNISSE) if (e.quelle) expect(QUELLEN[e.quelle], e.id).toBeDefined();
    for (const s of SCHLEIFEN) expect(QUELLEN[s.quelle], s.id).toBeDefined();
  });

  it("typische Ereignisse der Ländertypen gibt es wirklich", () => {
    for (const t of LAENDERTYPEN) for (const id of t.typisch) expect(EREIGNIS[id], `${t.id}: ${id}`).toBeDefined();
    for (const d of ZUSAMMENBRUCH_DREHBUCH) expect(EREIGNIS[d.ereignis]).toBeDefined();
  });

  it("es gibt mindestens acht Ländertypen mit gültigen Startwerten", () => {
    expect(LAENDERTYPEN.length).toBeGreaterThanOrEqual(8);
    for (const t of LAENDERTYPEN) for (const g of GROESSEN) {
      expect(t.start[g], `${t.id}.${g}`).toBeGreaterThanOrEqual(0);
      expect(t.start[g], `${t.id}.${g}`).toBeLessThanOrEqual(100);
    }
  });
});

describe("Leviathan – Anzeige", () => {
  it("die Startzonen passen zum Ländertyp", () => {
    const zone = (id: Parameters<typeof neuesSpiel>[0]) => leviathan(neuesSpiel(id, STANDARD_EINSTELLUNGEN, 1).w).zone;
    expect(zone("nordisch")).toBe("gefesselt");
    expect(zone("wahlautokratie")).toBe("despotisch");
    expect(zone("entwicklungsstaat")).toBe("despotisch");
    expect(zone("fragil")).toBe("abwesend");
  });

  it("der Korridor wird enger, je stärker Staat und Gesellschaft sind", () => {
    const w = { ...LAENDERTYPEN[0].start };
    const schwach = leviathan({ ...w, staatskapazitaet: 30, demokratie: 30, zusammenhalt: 30, desinformation: 70 });
    const stark = leviathan({ ...w, staatskapazitaet: 90, demokratie: 90, zusammenhalt: 90, desinformation: 10 });
    expect(stark.breite).toBeLessThan(schwach.breite);
  });
});

describe("Leviathan – Rundenmotor", () => {
  it("gleicher Seed und gleiche Züge ergeben dasselbe Spiel", () => {
    expect(spiele("polarisiert", {}, 7)).toEqual(spiele("polarisiert", {}, 7));
  });

  it("alle Werte bleiben zwischen 0 und 100", () => {
    for (const t of LAENDERTYPEN) {
      const z = spiele(t.id, { krise: "stuermisch" }, 3);
      for (const s of z.verlauf) for (const g of GROESSEN) {
        expect(s.w[g]).toBeGreaterThanOrEqual(0);
        expect(s.w[g]).toBeLessThanOrEqual(100);
      }
    }
  });

  it("wer mehr verteilt als da ist, oder in gesperrte Bereiche, bekommt einen Fehler", () => {
    const z = neuesSpiel("nordisch", STANDARD_EINSTELLUNGEN, 1);
    expect(() => runde(z, { ...leereVerteilung(), wirtschaft: budget(z).gesamt + 1 })).toThrow();
    const gesperrt = { ...z, gesperrt: { rechtsstaat: 2 } };
    expect(() => runde(gesperrt, { ...leereVerteilung(), rechtsstaat: 1 })).toThrow();
  });

  it("Kredit erlaubt mehr Aktionspunkte und erhöht die Schulden", () => {
    const z = neuesSpiel("industrie", STANDARD_EINSTELLUNGEN, 1);
    const n = runde(z, { ...leereVerteilung(), bildung: budget(z).gesamt + 3, kredit: 3 });
    expect(n.schulden).toBe(z.schulden + 3);
  });

  it("die Energiewende wird mit jeder Investition billiger", () => {
    expect(lernfaktor(40)).toBeGreaterThan(lernfaktor(10));
    expect(lernfaktor(10)).toBeGreaterThan(lernfaktor(0));
  });

  it("über einen Kipppunkt kommt die Klimalast nicht mehr zurück", () => {
    let z = neuesSpiel("industrie", { ...STANDARD_EINSTELLUNGEN, aus: EREIGNISSE.map((e) => e.id) }, 1);
    z = { ...z, w: { ...z.w, klima: 66 } };
    z = runde(z, leereVerteilung());
    expect(z.kipppunkte).toContain(65);
    for (let i = 0; i < 4; i++) {
      z = runde(z, { ...leereVerteilung(), energie: Math.min(budget(z).gesamt, 6) });
      expect(z.w.klima).toBeGreaterThanOrEqual(65);
    }
  });

  it("»Zusammenbruch« bringt spätestens in Runde 4 einen Autokraten an die Macht", () => {
    let z = neuesSpiel("nordisch", { ...STANDARD_EINSTELLUNGEN, krise: "zusammenbruch" }, 11);
    for (let i = 0; i < 4 && z.status === "laeuft"; i++) z = runde(z, gleich(z));
    expect(z.meldungen.some((m) => m.ereignis === "autokrat" || m.titel === "Autoritärer Präsident gewählt")).toBe(true);
  });

  it("abgeschaltete Ereignisse kommen nie vor, Drehbuch-Ereignisse immer", () => {
    const heikel = EREIGNISSE.filter((e) => e.heikel).map((e) => e.id);
    expect(heikel.length).toBeGreaterThan(0);
    for (let seed = 1; seed <= 25; seed++) {
      const z = spiele("fragil", { krise: "stuermisch", aus: heikel, drehbuch: [{ runde: 3, ereignis: "pandemie" }] }, seed);
      expect(z.meldungen.filter((m) => heikel.includes(m.ereignis))).toEqual([]);
      if (z.runde >= 3) expect(z.meldungen.some((m) => m.runde === 3 && m.ereignis === "pandemie")).toBe(true);
    }
  });

  it("nach dem Zusammenbruch geht es im Wiederaufbau mit weniger Aktionspunkten weiter", () => {
    let z: Zustand | null = null;
    for (let seed = 1; seed < 60 && !z; seed++) {
      const x = spiele("fragil", { krise: "zusammenbruch" }, seed);
      if (x.status === "zusammengebrochen" && x.runde < x.einst.runden) z = x;
    }
    expect(z).not.toBeNull();
    const vorher = budget({ ...z!, status: "laeuft" }).gesamt;
    const w = wiederaufbau(z!);
    expect(w.status).toBe("wiederaufbau");
    expect(budget(w).gesamt).toBeLessThanOrEqual(vorher);
    const weiter = runde(w, leereVerteilung());
    expect(weiter.runde).toBe(z!.runde + 1);
  });
});
