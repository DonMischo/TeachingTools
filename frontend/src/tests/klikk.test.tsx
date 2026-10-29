/**
 * Klikk: der Feed kippt nach Verweildauer, fremde Apps landen als Werbung im
 * Feed, Schweigen zählt, Jonas' Ausgang hängt an den eigenen Nachrichten, und
 * der Datenspiegel zeigt nur, was wirklich passiert ist.
 */
import { describe, expect, it } from "vitest";
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
    expect(erst.art === "post" && erst.post.id).toBe("tr0");
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
