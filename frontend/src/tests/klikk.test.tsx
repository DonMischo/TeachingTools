/**
 * Klikk: der Feed kippt nach Verweildauer, fremde Apps landen als Werbung im
 * Feed, Schweigen zählt, Jonas' Ausgang hängt an den eigenen Nachrichten, und
 * der Datenspiegel zeigt nur, was wirklich passiert ist.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { naechster, stufeFuer } from "@/lib/klikk/feed";
import { POSTS } from "@/lib/klikk/posts";
import { istGewaehlt, taeterPunkte } from "@/lib/klikk/geschichte";
import {
  agbAkzeptiert, aufgabe, gesehen, loeseAufgabe, nacht, neuerStand, oeffneApp, oeffneChat, onboardingFertig,
  profil, recht, schlafen, schreibeJonas, shopAnsehen, starte, waehle, weiterAktivitaet,
} from "@/lib/klikk/motor";
import { erkenntnisse, warnsignale } from "@/lib/klikk/profil";
import { jonasWoche } from "@/components/klikk/JonasSicht";
import Klikk from "@/components/klikk/Klikk";
import type { ChatId, Stand } from "@/lib/klikk/typen";
import { challengePosten, ergaenze, losgehen, posten, umfrage, werbungKlick } from "@/lib/klikk/motor";
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
  if (s.phase === "nacht") s = nacht(s, false);
  // Morgens direkt los zur Schule
  return s.phase === "morgen" ? losgehen(s) : s;
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

describe("Freizeit", () => {
  it("Lesen: Seiten kosten Zeit, ein Blick aufs Handy kostet Wiedereinstieg, der Lesestand bleibt", async () => {
    const { starteAktivitaet, weiterAktivitaet, beendeAktivitaet } = await import("@/lib/klikk/motor");
    let s = starteAktivitaet(angemeldet(), "lesen", "kasse");
    s = weiterAktivitaet(s);
    expect(s.uhr).toBe(14 * 60 + 6);
    s = oeffneApp(s, "klikk");
    expect(s.aktivitaet?.unterbrochen).toBe(1);
    const vor = s.uhr;
    s = weiterAktivitaet(s);
    expect(s.uhr).toBe(vor + 3 + 6);
    s = beendeAktivitaet(s);
    expect(s.lesestand.kasse).toBe(2);
    expect(s.freizeit[0]).toMatchObject({ art: "lesen", unterbrochen: 1 });
    s = starteAktivitaet(s, "lesen", "kasse");
    expect(s.aktivitaet?.schritt).toBe(2);
    for (let i = 0; i < 4; i++) s = weiterAktivitaet(s);
    expect(s.aktivitaet).toBeNull();
    expect(s.flags.gelesen_kasse).toBe(true);
  });

  it("Verein: wer das Training verpasst, bekommt eine Nachricht vom Trainer", async () => {
    const { vereinWaehlen, starteAktivitaet } = await import("@/lib/klikk/motor");
    let s = vereinWaehlen(angemeldet(), "fussball");
    s = tagZuEnde(s);
    expect(starteAktivitaet(s, "verein", "fussball").aktivitaet?.art).toBe("verein");
    s = bis(s, 16 * 60 + 30);
    expect(s.chats.verein.at(-1)?.text).toContain("wo warst du");
    expect(starteAktivitaet(s, "verein", "fussball").aktivitaet).toBeNull();
  });

  it("Familie gibt es nur zur passenden Zeit", async () => {
    const { familieJetzt } = await import("@/lib/klikk/freizeit");
    const s = angemeldet();
    expect(familieJetzt(s).map(f => f.id)).not.toContain("essen");
    expect(familieJetzt(bis(s, 18 * 60 + 40)).map(f => f.id)).toContain("essen");
  });
});

describe("Krisenfälle", () => {
  it("wer beim Mobbing mitmacht und es abstreitet, landet in der Klassenkonferenz – mit Verbreiten auch bei der Polizei", () => {
    let s = bis(angemeldet(), 15 * 60 + 15);
    s = waehle(s, "klasse", wahlId(s, "klasse", "bus"), "weiter");
    s = tagZuEnde(s);
    s = bis(s, 15 * 60 + 45);
    s = waehle(s, "klasse", wahlId(s, "klasse", "account"), "folgen");
    while (s.tag < 4) s = tagZuEnde(s);
    s = bis(s, 14 * 60 + 15);
    s = waehle(s, "yilmaz", wahlId(s, "yilmaz", "gespraech"), "leugnen");
    expect(s.chats.yilmaz.at(-1)?.text).toContain("Klassenkonferenz");
    expect(s.flags.polizeiTaeter).toBe(true);
    expect(s.chats.mama.at(-1)?.text).toContain("strafmündig");
  });

  it("Emmas Foto weiterleiten: am Freitag ist das Handy bei der Polizei", () => {
    let s = angemeldet();
    while (s.tag < 3) s = tagZuEnde(s);
    s = bis(s, 20 * 60 + 20);
    s = waehle(s, "klasse", wahlId(s, "klasse", "emmaFoto"), "weiter");
    s = tagZuEnde(s);
    expect(s.flags.handyWeg).toBe(true);
    expect(s.morgen.join(" ")).toContain("§ 201a");
    expect(schlafen(s).phase).toBe("jonas"); // kein Handy, das um 23:40 leuchtet
  });

  it("Lea: ein »😂 same« kostet die Freundschaft – reden rettet sie", () => {
    let s = angemeldet();
    while (s.tag < 2) s = tagZuEnde(s);
    s = bis(s, 21 * 60 + 5);
    s = waehle(s, "lea", wahlId(s, "lea", "leaKoerper"), "witz");
    s = tagZuEnde(s);
    s = bis(s, 19 * 60 + 20);
    expect(s.chats.lea.some(n => n.text === "Lea hat dich blockiert.")).toBe(true);
    const frage = s.chats.lea.find(n => n.wahl?.id === "leaStreit")!;
    const geredet = tagZuEnde(waehle(s, "lea", frage.id, "reden"));
    const geschwiegen = tagZuEnde(s);
    expect(geredet.flags.leaVersoehnt).toBe(true);
    expect(geschwiegen.morgen.join(" ")).toContain("nicht von allein");
    expect(erkenntnisse(geredet)).toBeTruthy();
  });
});

describe("Klasse, Kommentare, Nachahmer", () => {
  it("generierte Namen passen zur Server-Prüfung", async () => {
    const { namensVorschlaege, NAME_MUSTER } = await import("@/lib/klikk/klasse");
    for (let i = 0; i < 50; i++) for (const n of namensVorschlaege(i)) expect(n).toMatch(NAME_MUSTER);
  });

  it("Mo macht ein gefaktes gefährliches Video nach – und weiß nicht, dass es gefaked war", () => {
    let s = angemeldet();
    while (s.tag < 3) s = tagZuEnde(s);
    s = challengePosten(s, "dach", true);
    expect(s.chats.mo.at(-1)?.text).toContain("dein #DachSprung-video");
    s = bis(s, s.uhr + 125);
    expect(s.chats.klasse.some(n => n.text.includes("MO hat #DachSprung nachgemacht"))).toBe(true);
    s = tagZuEnde(s);
    expect(s.morgen.join(" ")).toContain("Mo wusste das nicht");
    // Nur einmal
    expect(challengePosten(s, "gleis", false).flags.moKopie).toBe(true);
  });

  it("Kommentare unter eigenen Beiträgen kommen mit der Zeit; melden, blockieren, antworten", async () => {
    const { kommentarAktion } = await import("@/lib/klikk/motor");
    let s = posten(angemeldet(), "selfie");
    expect(s.eigenePosts).toHaveLength(1);
    s = bis(s, s.uhr + 90);
    const p = s.eigenePosts[0];
    expect(p.kommentare.every(k => k.gemeldet)).toBe(true);
    s = kommentarAktion(s, p.id, 0, "blockieren");
    expect(s.blockiert).toContain(p.kommentare[0].von);
    s = kommentarAktion(s, p.id, 1, "antworten", "Danke 🥰");
    expect(s.eigenePosts[0].kommentare[1].antwort).toBe("Danke 🥰");
  });

  it("Faktencheck und Teilen werden gezählt und landen in der Wochen-Zusammenfassung", async () => {
    const { faktencheck, teilen } = await import("@/lib/klikk/motor");
    const { wocheWerte } = await import("@/lib/klikk/profil");
    let s = faktencheck(angemeldet(), "wi11", "fake", true);
    s = teilen(s, "ne4", true);
    expect(s.checks.wi11.richtig).toBe(true);
    const w = wocheWerte(s);
    expect(w.fakes_erkannt).toBe(1);
    expect(w.ungeprueft_geteilt).toBe(1);
    expect(Object.keys(w).length).toBeLessThanOrEqual(60);
  });
});

describe("Einstellungen und Familie", () => {
  it("Limit sperrt das Handy; eigenes Limit lässt sich ignorieren, das der strengen Eltern nicht", async () => {
    const { einstellen, gesperrt, limitUmgehen } = await import("@/lib/klikk/motor");
    let s = einstellen(angemeldet(), { eltern: "locker", proTag: 60, sperreAb: null, verein: null, vereinTage: null, vereinUm: null });
    for (let i = 0; i < 31; i++) s = gesehen(s, naechster(s), 500, false);
    expect(gesperrt(s)).toBe("limit");
    s = limitUmgehen(s);
    expect(gesperrt(s)).toBeNull();
    expect(s.limitIgnoriert).toBe(1);

    let streng = einstellen(angemeldet(), { eltern: "streng", proTag: null, sperreAb: null, verein: null, vereinTage: null, vereinUm: null });
    streng = bis(streng, 21 * 60 + 5);
    expect(gesperrt(streng)).toBe("elternSperre");
    expect(gesperrt(limitUmgehen(streng))).toBe("elternSperre");
    expect(schlafen(streng).phase).toBe("morgen"); // kein Handy um 23:40, gleich der nächste Morgen
  });

  it("strenge Eltern: nach einem Nein ist Schluss – die Familiensache startet von selbst", () => {
    let s = angemeldet();
    s = { ...s, eltern: "streng" };
    s = bis(s, 16 * 60 + 45);
    s = waehle(s, "mama", wahlId(s, "mama", "bitte_einkaufen"), "nein");
    expect(s.famErzwungen).toBeNull();
    s = tagZuEnde(s);
    s = bis(s, 17 * 60 + 55);
    s = waehle(s, "mama", wahlId(s, "mama", "bitte_aufraeumen"), "nein");
    s = loeseAufgabe(s, -1);
    expect(s.aktivitaet).toMatchObject({ art: "familie", id: "aufraeumen" });
  });

  it("Tracking aus: AdKit bekommt nichts, Werbung aus anderen Apps fällt weg; stumm und Fokus filtern", async () => {
    const { handyEinstellung, starteAktivitaet } = await import("@/lib/klikk/motor");
    let s = handyEinstellung(angemeldet(), "tracking", true);
    s = shopAnsehen(s, "jordan");
    expect(s.spur.some(x => x.app === "sneakr")).toBe(false);
    for (let i = 0; i < 4; i++) s = gesehen(s, naechster(s), 500, false);
    const w = naechster(s);
    expect(w.art === "werbung" && w.werbung.id).not.toBe("sneaker");

    let leise = handyEinstellung(angemeldet(), "stumm", "chats");
    leise = bis(leise, 15 * 60 + 20);
    expect(leise.pushes.some(p => p.app === "chats")).toBe(false);

    let fokus = handyEinstellung(angemeldet(), "fokus", true);
    fokus = starteAktivitaet(fokus, "lesen", "offline");
    for (let i = 0; i < 6; i++) fokus = weiterAktivitaet(fokus);
    expect(fokus.pushes.filter(p => p.app === "chats")).toHaveLength(0);
    expect(Number(fokus.flags.fokusGefiltert)).toBeGreaterThan(0);
  });

  it("eigener Trainingsplan und Absagen", async () => {
    const { einstellen, vereinAbsagen } = await import("@/lib/klikk/motor");
    const { vereinHeute } = await import("@/lib/klikk/freizeit");
    let s = einstellen(angemeldet(), { eltern: "locker", proTag: null, sperreAb: null, verein: "band", vereinTage: [0], vereinUm: 15 * 60 });
    expect(vereinHeute(s)?.verein.um).toBe(15 * 60);
    s = vereinAbsagen(s);
    expect(s.chats.verein.at(-1)?.text).toContain("Bescheid");
    s = bis(s, 16 * 60);
    expect(s.chats.verein.some(n => n.text.includes("wo warst du"))).toBe(false);
  });
});

describe("Perspektivwechsel, KI-Fake, Werbedeal, Samstag, Erfolge", () => {
  it("Opfer-Rollen haben Szenen mit Erzählen-Option und ein Ende je nach Weg", async () => {
    const { ROLLEN, SCHAM_GEDANKEN } = await import("@/lib/klikk/opfer");
    expect(SCHAM_GEDANKEN.length).toBeGreaterThanOrEqual(20);
    for (const r of ROLLEN) {
      expect(r.szenen.some(sz => sz.optionen.some(o => o.erzaehlen))).toBe(true);
      expect(r.ende([]).text).not.toEqual(r.ende([{ wem: "Mama", tag: 0 }]).text);
    }
  });

  it("über das KI-Bild lachen kostet Leas Freundschaft", () => {
    let s = angemeldet();
    while (s.tag < 2) s = tagZuEnde(s);
    s = bis(s, 18 * 60 + 35);
    s = waehle(s, "klasse", wahlId(s, "klasse", "deepfake"), "lachen");
    s = tagZuEnde(s);
    s = bis(s, 19 * 60 + 20);
    expect(s.chats.lea.some(n => n.text.includes("ki-bild"))).toBe(true);
  });

  it("ab 200 Followern meldet sich eine Marke – bezahlt wird nie", () => {
    let s = { ...angemeldet(), follower: 210 };
    s = loeseAufgabe(s, -1);
    const frage = s.chats.marke.find(n => n.wahl?.id === "deal")!;
    s = waehle(s, "marke", frage.id, "verstecken");
    s = tagZuEnde(s);
    s = bis(s, 14 * 60 + 5);
    expect(s.chats.marke.at(-1)?.text).toContain("nicht möglich");
  });

  it("mit Bonus-Samstag geht es nach Freitag weiter, ohne Hausaufgaben, ab 10 Uhr", async () => {
    const { einstellen } = await import("@/lib/klikk/motor");
    let s = einstellen(angemeldet(), { eltern: "locker", proTag: null, sperreAb: null, verein: null, vereinTage: null, vereinUm: null, samstag: true });
    while (s.tag < 4) s = tagZuEnde(s);
    s = tagZuEnde(s);
    expect(s.phase).toBe("woche");
    expect(s.tag).toBe(5);
    expect(s.uhr).toBe(10 * 60);
    expect(tagZuEnde(s).phase).toBe("jonas");
  });

  it("gute und schlechte Erfolge", async () => {
    const { KLIKK_ERFOLGE } = await import("@/lib/klikk/erfolge");
    const s = { ...angemeldet(), agbSekunden: 90, nachtOeffnungen: [{ tag: 0, uhr: 1400 }, { tag: 1, uhr: 1410 }] };
    const erreicht = KLIKK_ERFOLGE.filter(e => e.erreicht(s)).map(e => e.id);
    expect(erreicht).toEqual(expect.arrayContaining(["agb", "nachteule"]));
    expect(KLIKK_ERFOLGE.some(e => !e.gut) && KLIKK_ERFOLGE.some(e => e.gut)).toBe(true);
  });
});

describe("Morgen und Hygiene, Tim", () => {
  it("der Tag beginnt mit dem Wecker; Duschen hebt die Hygiene, zu spät kommen wird gemeldet", async () => {
    const { morgenSache } = await import("@/lib/klikk/motor");
    let s = schlafen(bis(angemeldet(), 22 * 60));
    s = nacht(s, false);
    expect(s.phase).toBe("morgen");
    expect(s.uhr).toBe(6 * 60 + 30);
    const vorher = s.hygiene;
    s = morgenSache(s, "duschen");
    expect(s.hygiene).toBeGreaterThan(vorher);
    for (let i = 0; i < 30; i++) s = gesehen(s, naechster(s), 500, false); // im Bett scrollen
    s = losgehen(s);
    expect(s.uhr).toBe(14 * 60);
    expect(s.morgen.join(" ")).toContain("zu spät");
  });

  it("ohne Duschen sinkt die Hygiene, und die Klasse merkt es", () => {
    let s = angemeldet();
    while (s.tag < 3) s = tagZuEnde(s);
    expect(s.hygiene).toBeLessThan(25);
    expect(s.morgen.join(" ")).toContain("Nase");
  });

  it("über Tim lästern zählt als Mitmachen; nachfragen zeigt den Grund", () => {
    let s = tagZuEnde(angemeldet());
    s = bis(s, 15 * 60 + 10);
    const mit = waehle(s, "klasse", wahlId(s, "klasse", "tim"), "mitmachen");
    expect(taeterPunkte(mit)).toBe(2);
    let gefragt = waehle(s, "klasse", wahlId(s, "klasse", "tim"), "fragen");
    gefragt = bis(tagZuEnde(gefragt), 16 * 60 + 5);
    expect(gefragt.chats.tim.some(n => n.text.includes("waschmaschine"))).toBe(true);
  });
});

describe("Quiz und Teilen", () => {
  it("das Quiz-Ergebnis folgt den Antworten", async () => {
    const { quizTyp } = await import("@/components/klikk/Apps");
    expect(quizTyp({ laune: "allein", aendern: "nichts" }).emoji).toBe("🌧️");
    expect(quizTyp({ aendern: "koerper", laune: "gut" }).emoji).toBe("🪞");
    expect(quizTyp({ laune: "gut", aendern: "nichts", schlaf: "frueh" }).emoji).toBe("☀️");
  });

  it("ein geteiltes Spielergebnis wird ein eigener Beitrag", async () => {
    const { spielTeilen } = await import("@/lib/klikk/motor");
    const s = spielTeilen(angemeldet(), "sprung", 812);
    expect(s.eigenePosts[0]).toMatchObject({ art: "spiel", spiel: "sprung", punkte: 812 });
  });
});
