import { describe, it, expect } from "vitest";
import {
  starteRegen, spawn, schritt, tippe, vorbei, naechstesZeichen, stufe, LEBEN_START,
} from "@/lib/tippen/wortregen";
import {
  starteJagd, jagdStart, jagdTreffer, jagdVorbei, jagdZiel, langsamste, schnitt, zieleFuer,
} from "@/lib/tippen/tastenjagd";
import { woerterFuer, silbeFuer, nachschub } from "@/lib/tippen/woerter";
import { zeichenBis, LEKTIONEN } from "@/lib/tippen/lektionen";

/** Zufall mit fester Folge — damit die Tests nicht würfeln. */
function festerZufall(werte: number[]) {
  let i = 0;
  return () => werte[i++ % werte.length];
}

describe("Wortregen", () => {
  it("fängt ein Wort, wenn es fertig getippt ist", () => {
    let r = spawn(starteRegen(), "das", 0.5);
    r = tippe(r, "d");
    r = tippe(r, "a");
    expect(r.woerter).toHaveLength(1);
    r = tippe(r, "s");
    expect(r.woerter).toHaveLength(0);
    expect(r.gefangen).toBe(1);
    expect(r.punkte).toBe(3);
    expect(r.fehler).toBe(0);
  });

  it("bleibt bei einem begonnenen Wort, auch wenn ein anderes passen würde", () => {
    let r = spawn(spawn(starteRegen(), "dose", 0.3), "das", 0.6);
    r = tippe(r, "d");           // trifft beide Anfänge — eines wird aktiv
    const aktiv = r.aktiv;
    r = tippe(r, "x");           // Fehlgriff
    expect(r.aktiv).toBe(aktiv); // kein heimlicher Wechsel
    expect(r.fehler).toBe(1);
  });

  it("nimmt das unterste Wort zuerst, solange keines begonnen ist", () => {
    let r = spawn(spawn(starteRegen(), "dose", 0.3), "das", 0.6);
    r = schritt(r, 1000, 0.1);            // beide fallen gleich weit
    r = { ...r, woerter: r.woerter.map(w => (w.wort === "das" ? { ...w, y: 0.8 } : w)) };
    r = tippe(r, "d");
    expect(r.woerter.find(w => w.id === r.aktiv)?.wort).toBe("das");
  });

  it("kostet ein Leben, wenn ein Wort unten ankommt", () => {
    let r = spawn(starteRegen(), "das", 0.5);
    r = schritt(r, 20000, 0.1); // weit über die Bahn hinaus
    expect(r.woerter).toHaveLength(0);
    expect(r.verpasst).toBe(1);
    expect(r.leben).toBe(LEBEN_START - 1);
  });

  it("vergisst das aktive Wort, wenn es durchrutscht", () => {
    let r = spawn(starteRegen(), "das", 0.5);
    r = tippe(r, "d");
    expect(r.aktiv).not.toBeNull();
    r = schritt(r, 20000, 0.1);
    expect(r.aktiv).toBeNull();
  });

  it("endet, wenn die Leben aufgebraucht sind", () => {
    let r = starteRegen();
    for (let i = 0; i < LEBEN_START; i++) {
      r = schritt(spawn(r, "das", 0.5), 20000, 0.1);
    }
    expect(vorbei(r)).toBe(true);
    // Danach ändert nichts mehr etwas.
    const eingefroren = tippe(schritt(r, 1000, 0.1), "d");
    expect(eingefroren).toEqual(r);
  });

  it("ein Fehlgriff kostet kein Leben", () => {
    let r = spawn(starteRegen(), "das", 0.5);
    r = tippe(r, "q");
    expect(r.leben).toBe(LEBEN_START);
    expect(r.fehler).toBe(1);
    expect(r.anschlaege).toBe(1);
  });

  it("nennt das nächste Zeichen für die Tastaturanzeige", () => {
    let r = spawn(starteRegen(), "das", 0.5);
    expect(naechstesZeichen(r)).toBe("d");
    r = tippe(r, "d");
    expect(naechstesZeichen(r)).toBe("a");
    expect(naechstesZeichen(starteRegen())).toBeUndefined();
  });

  it("wird mit der Zeit schneller und dichter", () => {
    const anfang = stufe(0);
    const spaeter = stufe(3 * 60000);
    expect(spaeter.tempo).toBeGreaterThan(anfang.tempo);
    expect(spaeter.abstandMs).toBeLessThan(anfang.abstandMs);
    expect(spaeter.abstandMs).toBeGreaterThanOrEqual(900); // Untergrenze hält
  });
});

describe("Tastenjagd", () => {
  it("misst die Zeit bis zum richtigen Anschlag", () => {
    let j = jagdStart(starteJagd(["a", "b"]), 1000);
    j = jagdTreffer(j, "a", 1300);
    expect(j.zeiten).toEqual([{ zeichen: "a", ms: 300 }]);
    expect(jagdZiel(j)).toBe("b");
  });

  it("rückt bei einem Fehlgriff nicht vor — die Uhr läuft weiter", () => {
    let j = jagdStart(starteJagd(["a", "b"]), 1000);
    j = jagdTreffer(j, "x", 1200);
    expect(j.index).toBe(0);
    expect(j.fehler).toBe(1);
    j = jagdTreffer(j, "a", 1500);
    expect(j.zeiten[0].ms).toBe(500); // der Fehlgriff hat Zeit gekostet
  });

  it("mittelt mehrere Messungen derselben Taste", () => {
    let j = jagdStart(starteJagd(["a", "a"]), 0);
    j = jagdTreffer(j, "a", 100);
    j = jagdTreffer(j, "a", 400);
    expect(langsamste(j)).toEqual([{ zeichen: "a", ms: 200 }]);
    expect(schnitt(j)).toBe(200);
  });

  it("sortiert die zähesten Tasten nach vorn", () => {
    let j = jagdStart(starteJagd(["a", "b"]), 0);
    j = jagdTreffer(j, "a", 100);
    j = jagdTreffer(j, "b", 900);
    expect(langsamste(j).map(z => z.zeichen)).toEqual(["b", "a"]);
  });

  it("ist nach der letzten Taste vorbei und nimmt nichts mehr an", () => {
    let j = jagdStart(starteJagd(["a"]), 0);
    j = jagdTreffer(j, "a", 100);
    expect(jagdVorbei(j)).toBe(true);
    expect(jagdTreffer(j, "a", 200)).toEqual(j);
  });

  it("zieht Ziele nur aus dem erlaubten Vorrat, ohne Leerzeichen", () => {
    const ziele = zieleFuer("as ", 10, festerZufall([0, 0.9]));
    expect(ziele).toHaveLength(10);
    expect(new Set(ziele).size).toBeLessThanOrEqual(2);
    expect(ziele).not.toContain(" ");
  });
});

describe("Wortnachschub", () => {
  it("lässt nur Wörter durch, die sich aus dem Vorrat tippen lassen", () => {
    const vorrat = zeichenBis(0); // Grundstellung: a s d f j k l ö
    for (const wort of woerterFuer(vorrat)) {
      expect([...wort].every(c => vorrat.includes(c))).toBe(true);
    }
  });

  it("hat für den vollen Zeichenvorrat reichlich Wörter", () => {
    expect(woerterFuer(zeichenBis(LEKTIONEN.length - 1)).length).toBeGreaterThan(50);
  });

  it("führt keine Dubletten in der Wortliste", () => {
    const alle = woerterFuer(zeichenBis(LEKTIONEN.length - 1));
    expect(new Set(alle).size).toBe(alle.length);
  });

  it("weicht auf Silben aus, wenn es zu wenige echte Wörter gibt", () => {
    // Zwei Buchstaben ergeben kein Wort — es muss trotzdem etwas kommen.
    const nach = nachschub("fj", festerZufall([0.1, 0.4, 0.6, 0.2]));
    expect(nach.length).toBeGreaterThanOrEqual(3);
    expect([...nach].every(c => "fj".includes(c))).toBe(true);
  });

  it("baut Silben nur aus dem Vorrat, ohne Leerzeichen", () => {
    const silbe = silbeFuer("as ", 5, festerZufall([0, 0.9]));
    expect(silbe).toHaveLength(5);
    expect(silbe).not.toContain(" ");
  });
});

describe("Zeichenvorrat", () => {
  it("wächst mit jeder Lektion und enthält die Leertaste", () => {
    const erste = zeichenBis(0);
    const alle = zeichenBis(LEKTIONEN.length - 1);
    expect(erste).toContain(" ");
    expect(erste.length).toBeLessThan(alle.length);
    for (const c of erste) expect(alle).toContain(c);
  });

  it("enthält genau die Tasten der bisherigen Lektionen", () => {
    const zwei = zeichenBis(1);
    expect([...LEKTIONEN[1].neueZeichen].every(c => zwei.includes(c))).toBe(true);
    expect(zwei).not.toContain("q"); // kommt erst in Lektion 4
  });
});
