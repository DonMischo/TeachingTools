/**
 * Klikk: der Feed kippt nach Verweildauer, fremde Apps landen als Werbung im
 * Feed, Schweigen zählt, Jonas' Ausgang hängt an den eigenen Nachrichten, und
 * der Datenspiegel zeigt nur, was wirklich passiert ist.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { naechster, stufeFuer } from "@/lib/klikk/feed";
import { POSTS } from "@/lib/klikk/posts";
import { istGewaehlt } from "@/lib/klikk/geschichte";
import {
  agbAkzeptiert, aufgabe, gesehen, loeseAufgabe, nacht, neuerStand, oeffneApp, oeffneChat, onboardingFertig,
  profil, recht, schlafen, schreibeJonas, shopAnsehen, starte, waehle,
} from "@/lib/klikk/motor";
import { erkenntnisse, warnsignale } from "@/lib/klikk/profil";
import { jonasWoche } from "@/components/klikk/JonasSicht";
import Klikk from "@/components/klikk/Klikk";
import type { ChatId, Stand } from "@/lib/klikk/typen";
import { challengePosten, ergaenze, umfrage, werbungKlick } from "@/lib/klikk/motor";
import { TRENDS } from "@/lib/klikk/trends";
import { nachweis } from "@/components/klikk/PostMedien";
import Werbeseite from "@/components/klikk/Werbeseite";
import { ZEICHNUNGEN } from "@/components/pcbau/zeichnungen";
import { MONSTER } from "@/lib/angriffe/monster";
import { ELEMENTE } from "@/lib/angriffe/effekte";
import { KLASSEN, TIERE } from "@/components/gebaeude/avatar";

function angemeldet(mitteilungen = true): Stand {
  let s = starte(neuerStand(7));
  s = profil(s, "testi", 16, 14);
  s = agbAkzeptiert(s, 3);
  s = recht(s, "kontakte", true);
  s = recht(s, "mitteilungen", mitteilungen);
  s = recht(s, "standort", false);
  s = recht(s, "mikrofon", false);
  return onboardingFertig(s);
}

/** Bis Mitternacht vorspulen (über das Feed-Ansehen), dann schlafen ohne nachzusehen. */
function tagZuEnde(s: Stand): Stand {
  s = schlafen(s);
  return s.phase === "nacht" ? nacht(s, false) : s;
}

function wahlId(s: Stand, chat: ChatId, id: string) {
  return s.chats[chat].find(n => n.wahl?.id === id)!.id;
}

/** Bis zur Uhrzeit des Ereignisses Zeit vergehen lassen (Hausaufgaben falsch lösen kostet 2 Min.). */
function bis(s: Stand, uhr: number): Stand {
  while (s.uhr < uhr) s = loeseAufgabe(s, -1);
  return s;
}

describe("Feed-Algorithmus", () => {
  it("wer bei Fitness hängen bleibt, bekommt Stufe 3 und fast nur noch Fitness", () => {
    let s = angemeldet();
    expect(stufeFuer(s, "fitness")).toBe(1);
    for (let i = 0; i < 40; i++) {
      const e = naechster(s);
      const lang = e.art === "post" && e.post.thema === "fitness";
      s = gesehen(s, e, lang ? 20000 : 500, lang);
    }
    expect(stufeFuer(s, "fitness")).toBe(3);
    const letzte = s.gesehen.slice(-15).map(id => POSTS.find(p => p.id === id)).filter(Boolean);
    expect(letzte.filter(p => p!.thema === "fitness").length).toBeGreaterThan(letzte.length / 2);
    expect(s.gesehen.some(id => POSTS.find(p => p.id === id)?.stufe === 3)).toBe(true);
  });

  it("Trend des Tages kommt zuerst, jeder fünfte Eintrag ist Werbung", () => {
    let s = angemeldet();
    const erst = naechster(s);
    expect(erst.art === "post" && erst.post.id).toBe("tr-spiegel");
    for (let i = 0; i < 4; i++) s = gesehen(s, naechster(s), 1000, false);
    expect(naechster(s).art).toBe("werbung");
  });

  it("was im Sneaker-Shop angesehen wurde, kommt als Werbung in Klikk an — mit echtem Grund", () => {
    let s = angemeldet();
    s = shopAnsehen(s, "jordan");
    for (let i = 0; i < 4; i++) s = gesehen(s, naechster(s), 1000, false);
    const w = naechster(s);
    expect(w.art === "werbung" && w.werbung.id).toBe("sneaker");
    if (w.art === "werbung") expect(w.werbung.grund(s)).toContain("Jumpman Retro");
    expect(s.spur.some(x => x.app === "sneakr" && x.an === "AdKit")).toBe(true);
  });
});

describe("Woche", () => {
  it("ohne Mitteilungs-Erlaubnis gibt es keine Benachrichtigungen", () => {
    expect(angemeldet(false).pushes).toHaveLength(0);
    expect(bis(angemeldet(true), 15 * 60 + 30).pushes.length).toBeGreaterThan(0);
  });

  it("Hausaufgaben: Handy zwischendurch kostet 5 Minuten extra", () => {
    let s = angemeldet();
    s = loeseAufgabe(s, aufgabe(s).loesung);
    expect(s.uhr).toBe(14 * 60 + 9);
    s = oeffneApp(s, "klikk");
    expect(s.unterbrechungen).toBe(1);
    const vor = s.uhr;
    s = loeseAufgabe(s, aufgabe(s).loesung);
    expect(s.uhr).toBe(vor + 5 + 9);
  });

  it("nachts nachsehen kostet Schlaf und bringt die Nachteule", () => {
    let a = schlafen(bis(angemeldet(), 22 * 60));
    expect(a.phase).toBe("nacht");
    const ruhig = nacht(a, false), wach = nacht(a, true);
    expect(wach.schlaf[0]).toBeLessThan(ruhig.schlaf[0]);
    expect(wach.abzeichen).toContain("nachteule");
    expect(wach.streak).toBe(13);
    expect(ruhig.streak).toBe(0);
    a = ruhig;
    expect(a.chats.lea.some(n => n.text.includes("streak ist weg"))).toBe(true);
  });

  it("unbeantwortet heißt geschwiegen; gelesenes Schweigen taucht bei Jonas auf", () => {
    let s = bis(angemeldet(), 15 * 60 + 15);
    s = oeffneChat(s, "klasse");
    s = tagZuEnde(s);
    expect(istGewaehlt(s, "bus")).toBe("still");
    const zeilen = jonasWoche({ ...s, flags: { ...s.flags, jonasAusgang: 0 } });
    expect(zeilen.some(z => z.art === "still")).toBe(true);
  });

  it("wer nichts tut: Jonas bleibt Freitag zu Hause, Mo bricht sich den Arm", () => {
    let s = angemeldet();
    while (s.tag < 4) s = tagZuEnde(s);
    expect(s.flags.jonasAusgang).toBe(0);
    expect(s.flags.moVerletzt).toBe(true);
    expect(s.morgen.join(" ")).toContain("Platz bleibt leer");
    s = tagZuEnde(s);
    expect(s.phase).toBe("jonas");
  });

  it("wer Jonas schreibt, Mo widerspricht und zu Frau Yilmaz geht, ändert den Freitag", () => {
    let s = angemeldet();
    s = tagZuEnde(s);
    s = schreibeJonas(s, "j1");
    s = schreibeJonas(s, "j2");
    s = tagZuEnde(s);
    s = bis(s, 18 * 60);
    s = waehle(s, "mo", wahlId(s, "mo", "gleis"), "stopp");
    s = schreibeJonas(s, "j4");
    s = tagZuEnde(s);
    expect(s.chats.mo.some(n => n.text.includes("lass ich"))).toBe(true);
    s = tagZuEnde(s);
    expect(s.flags.jonasAusgang).toBe(2);
    expect(s.flags.moVerletzt).toBe(false);
    expect(s.morgen.join(" ")).toContain("Frau Yilmaz");
  });

  it("Warnsignale zählen nur, wenn man bei Jonas nachschaut", () => {
    let s = angemeldet();
    s = tagZuEnde(s);
    s = bis(s, 19 * 60 + 5);
    expect(warnsignale(s).find(x => x.id === "bild")).toMatchObject({ sichtbar: true, bemerkt: undefined });
    s = oeffneChat(s, "jonas");
    expect(warnsignale(s).find(x => x.id === "bild")?.bemerkt).toBeTruthy();
  });
});

describe("Datenspiegel", () => {
  it("findet die Alterslüge, die Kontakte und die AGB-Lesezeit — mit Belegen", () => {
    const e = erkenntnisse(angemeldet());
    const titel = e.map(x => x.titel);
    expect(titel).toEqual(expect.arrayContaining(["Alter", "Soziales Netz", "Nutzungsbedingungen"]));
    expect(e.find(x => x.titel === "Nutzungsbedingungen")!.belege[0]).toContain("3 Sekunden");
    expect(titel).not.toContain("Orte");
  });
});

describe("Oberfläche", () => {
  it("startet mit dem Einschalten und zeigt dann die Anmeldung", async () => {
    localStorage.clear();
    render(<Klikk />);
    await act(async () => {});
    fireEvent.click(screen.getByText(/Handy einschalten/));
    expect(screen.getByText("Registrieren")).toBeTruthy();
  });
});

describe("Beiträge mit echten Inhalten", () => {
  it("jedes Foto hat Urheber und Lizenz, jedes PC-Teil, Monster, Element und jeder Avatar existiert", () => {
    for (const p of POSTS) {
      const m = p.medien;
      if (!m) continue;
      if (m.art === "foto") expect(nachweis(m)?.lizenz, p.id).toBeTruthy();
      if (m.art === "pc") for (const t of m.teile) expect(ZEICHNUNGEN[t], `${p.id}: ${t}`).toBeTruthy();
      if (m.art === "clip") {
        const c = m.clip;
        if (c.art === "monster") expect(MONSTER[c.monster as keyof typeof MONSTER], p.id).toBeTruthy();
        if (c.art === "zauber") {
          expect(MONSTER[c.gegner as keyof typeof MONSTER], p.id).toBeTruthy();
          expect(ELEMENTE.some(e => e.id === c.element), p.id).toBe(true);
        }
        if (c.art !== "monster" && c.figur !== "ich") {
          const f = c.figur;
          expect(f.tier ? TIERE.some(t => t.id === f.tier) : KLASSEN.some(k => k.id === f.klasse), p.id).toBe(true);
        }
      }
    }
    expect(new Set(POSTS.map(p => p.id)).size).toBe(POSTS.length);
  });

  it("Nachrichten über tödliche Challenges kommen erst, wenn sie passiert sind", () => {
    let s = angemeldet();
    for (let i = 0; i < 80; i++) s = gesehen(s, naechster(s), 1000, false);
    expect(s.gesehen).not.toContain("ne6");
  });
});

describe("Eigene Challenge-Videos", () => {
  it("Risiko bringt Reichweite, echte Videos haben Folgen, gefakte nicht", () => {
    let s = angemeldet();
    while (s.tag < 3) s = tagZuEnde(s);
    const harmlos = challengePosten(s, "zitrone", false);
    const echt = challengePosten(s, "dach", false);
    const fake = challengePosten(s, "dach", true);
    expect(echt.videos[0].aufrufe).toBeGreaterThan(harmlos.videos[0].aufrufe * 5);
    expect(fake.videos[0].aufrufe).toBe(echt.videos[0].aufrufe);
    expect(echt.chats.mama.some(n => n.text.includes("Krankenhaus"))).toBe(true);
    expect(fake.chats.mama.some(n => n.text.includes("Krankenhaus"))).toBe(false);
    expect(tagZuEnde(echt).morgen.join(" ")).toContain("Krücken");
    // Zukünftige Trends gehen nicht, jeder Trend nur einmal
    expect(challengePosten(angemeldet(), "dach", false).videos).toHaveLength(0);
    expect(challengePosten(echt, "dach", false).videos).toHaveLength(1);
    expect(TRENDS.every(t => t.beschreibung.length > 0)).toBe(true);
  });

  it("#NoSleep48 kostet die ganze Nacht", () => {
    let s = angemeldet();
    while (s.tag < 2) s = tagZuEnde(s);
    s = tagZuEnde(challengePosten(s, "nosleep", false));
    expect(s.schlaf[2]).toBe(0);
  });
});

describe("Neue Fäden", () => {
  it("leon.16: wer das Foto schickt und es dann Mama zeigt, bekommt Hilfe statt Schuld", () => {
    let s = angemeldet();
    while (s.tag < 2) s = tagZuEnde(s);
    s = bis(s, 19 * 60 + 35);
    s = waehle(s, "leon", wahlId(s, "leon", "leon1"), "antworten");
    s = tagZuEnde(s);
    s = bis(s, 16 * 60 + 15);
    s = waehle(s, "leon", wahlId(s, "leon", "leon2"), "foto");
    s = bis(s, 21 * 60 + 50);
    expect(s.chats.leon.some(n => n.text.includes("sonst bekommt deine klasse"))).toBe(true);
    s = waehle(s, "leon", wahlId(s, "leon", "leon3"), "mama");
    expect(s.chats.mama.some(n => n.text.includes("NICHTS falsch"))).toBe(true);
    s = tagZuEnde(s);
    expect(s.morgen.join(" ")).toContain("34-jähriger Mann");
    expect(erkenntnisse(s).find(e => e.titel === "Kontakt mit Fremden")?.heikel).toBe(true);
  });

  it("die »anonyme« Umfrage landet als heikles Merkmal im Profil", () => {
    const s = umfrage(angemeldet(), "um2", "Gar nicht 😔");
    expect(erkenntnisse(s).find(e => e.titel === "Selbstbild")?.belege[0]).toContain("Gar nicht");
    expect(umfrage(s, "um2", "Sehr 😊").umfragen.um2).toBe("Gar nicht 😔");
  });

  it("Werbe-Klicks steigen nur auf, und alte Spielstände bekommen die neuen Felder", () => {
    let s = werbungKlick(angemeldet(), "pizza", "kasse");
    s = werbungKlick(s, "pizza", "seite");
    expect(s.werbungKlicks).toEqual([expect.objectContaining({ id: "pizza", stufe: "kasse" })]);
    const alt = { ...angemeldet() } as Partial<Stand>;
    delete alt.videos; delete alt.umfragen;
    const neu = ergaenze(alt as Stand);
    expect(neu.videos).toEqual([]);
    expect(neu.chats.leon).toEqual([]);
  });

  it("die Pizza-Seite führt bis zur Kasse und klappt dann ihre Tricks auf", () => {
    const setze = vi.fn();
    render(<Werbeseite id="pizza" s={recht(angemeldet(), "standort", true)} setze={setze} zu={() => {}} />);
    expect(screen.getByText(/dein Standort wurde erkannt/)).toBeTruthy();
    fireEvent.click(screen.getByText(/In den Warenkorb/));
    expect(screen.getByText(/•••• 4242/)).toBeTruthy();
    fireEvent.click(screen.getByText(/kostenpflichtig bestellen/));
    expect(screen.getByText(/hier wird nichts bestellt/)).toBeTruthy();
    expect(setze).toHaveBeenCalledTimes(3);
  });
});
