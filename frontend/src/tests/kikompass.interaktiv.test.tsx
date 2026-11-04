import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  EINSEITIG, FEHLERJAGD, SCHWAERZ_TEXT, SORTIERSPIELE, TESTFAELLE, TEXTPAARE, jagdWertung, promptAntwort,
  promptGuete, promptText, schwaerzWertung, sortWertung, wahrscheinlichkeitHund, type Beispiel,
} from "@/lib/kikompass/interaktiv";
import { STATIONEN } from "@/lib/kikompass/stationen";
import { Sortieren } from "@/components/kikompass/interaktiv/Sortieren";
import { Schwaerzen } from "@/components/kikompass/interaktiv/Schwaerzen";
import { HundOderWolf } from "@/components/kikompass/interaktiv/HundOderWolf";
import { PromptBaukasten } from "@/components/kikompass/interaktiv/PromptBaukasten";

const sagt = (daten: readonly Beispiel[], i: number) => (wahrscheinlichkeitHund(daten, TESTFAELLE[i]) >= 0.5 ? "hund" : "wolf");

describe("Daten der interaktiven Teile", () => {
  it("jede Sortierkarte zielt auf einen vorhandenen Korb", () => {
    for (const spiel of Object.values(SORTIERSPIELE)) {
      const koerbe = new Set(spiel.koerbe.map(k => k.id));
      for (const k of spiel.karten) expect(koerbe.has(k.ziel)).toBe(true);
    }
  });

  it("jede Station verweist nur auf vorhandene Sortierspiele", () => {
    for (const s of STATIONEN) for (const id of s.interaktiv ?? []) {
      if (id.startsWith("sortieren:")) expect(SORTIERSPIELE[id.slice(10)]).toBeDefined();
    }
  });

  it("wertet Sortieren, Schwärzen und Fehlerjagd", () => {
    const spiel = SORTIERSPIELE["ki-alltag"];
    const alleRichtig = Object.fromEntries(spiel.karten.map(k => [k.id, k.ziel]));
    expect(sortWertung(spiel, alleRichtig)).toEqual({ richtig: spiel.karten.length, gesamt: spiel.karten.length, fertig: true });
    expect(sortWertung(spiel, {}).fertig).toBe(false);

    const privat = new Set(SCHWAERZ_TEXT.flatMap((s, i) => (s.privat ? [i] : [])));
    expect(schwaerzWertung(privat)).toEqual({ gefunden: privat.size, privat: privat.size, zuviel: 0 });
    expect(schwaerzWertung(new Set([SCHWAERZ_TEXT.length - 1])).zuviel).toBe(1);

    const fehler = new Set(FEHLERJAGD.stuecke.flatMap((s, i) => (s.fehler ? [i] : [])));
    expect(fehler.size).toBeGreaterThanOrEqual(3);
    expect(jagdWertung(fehler)).toEqual({ gefunden: fehler.size, fehler: fehler.size, falschAlarm: 0 });
    expect(jagdWertung(new Set([0])).falschAlarm).toBe(1);
  });

  it("Prompt-Baukasten: jede Kombination hat eine Antwort, Störteile zählen nicht", () => {
    for (const r of [0, 1]) for (const k of [0, 1]) for (const f of [0, 1]) {
      const ids = new Set([r && "rolle", k && "kontext", f && "format"].filter(Boolean) as string[]);
      expect(promptAntwort(ids).length).toBeGreaterThan(50);
      expect(promptGuete(ids)).toBe(r + k + f);
    }
    expect(promptGuete(new Set(["bitte", "gut"]))).toBe(0);
    expect(promptText(new Set(["rolle", "format"]))).toMatch(/^Du bist .* Erkläre die Fotosynthese\. Antworte/);
  });

  it("Echt-oder-KI: jedes Paar hat Merkmale und eine Lösung", () => {
    for (const p of TEXTPAARE) {
      expect(["a", "b"]).toContain(p.ki);
      expect(p.merkmale.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("Hund oder Wolf (naiver Bayes)", () => {
  it("lernt mit einseitigen Daten »Schnee = Wolf« und liegt bei zwei Tieren falsch", () => {
    expect(TESTFAELLE.map((_, i) => sagt(EINSEITIG, i))).toEqual(["hund", "wolf", "wolf", "hund"]);
  });

  it("erkennt alle Testtiere, wenn vielfältige Beispiele ergänzt werden", () => {
    const vielfaeltig: Beispiel[] = [
      ...EINSEITIG,
      { tier: "hund", hintergrund: "schnee", halsband: true },
      { tier: "wolf", hintergrund: "wiese", halsband: false },
      { tier: "wolf", hintergrund: "wiese", halsband: false },
    ];
    expect(TESTFAELLE.map((_, i) => sagt(vielfaeltig, i))).toEqual(TESTFAELLE.map(t => t.wahr));
  });

  it("liefert Wahrscheinlichkeiten zwischen 0 und 1", () => {
    for (const t of TESTFAELLE) {
      const p = wahrscheinlichkeitHund(EINSEITIG, t);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });
});

describe("Interaktive Komponenten", () => {
  it("Sortieren: Karte antippen, Korb antippen, prüfen", () => {
    const spiel = { ...SORTIERSPIELE.datenschutz, karten: SORTIERSPIELE.datenschutz.karten.slice(0, 2) };
    render(<Sortieren spiel={spiel} />);
    fireEvent.click(screen.getByRole("button", { name: spiel.karten[0].text }));
    fireEvent.click(screen.getByRole("button", { name: /In »✅ darf rein« legen/ }));
    fireEvent.click(screen.getByRole("button", { name: spiel.karten[1].text }));
    fireEvent.click(screen.getByRole("button", { name: /In »✅ darf rein« legen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(screen.getByText("1 von 2 richtig")).toBeInTheDocument();
    expect(screen.getByText(/Damit kann man dich finden/)).toBeInTheDocument();
  });

  it("Schwärzen: alle privaten Stellen schwärzen ist perfekt", () => {
    render(<Schwaerzen />);
    SCHWAERZ_TEXT.forEach(s => { if (s.privat) fireEvent.click(screen.getByRole("button", { name: s.text })); });
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(screen.getByText(/Perfekt/)).toBeInTheDocument();
  });

  it("Hund oder Wolf: zeigt anfangs 2 von 4, ergänzte Beispiele ändern die Vorhersage", () => {
    render(<HundOderWolf />);
    expect(screen.getByText("2 von 4 richtig erkannt.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hund im Schnee$/ }));
    expect(screen.getByText("3 von 4 richtig erkannt.")).toBeInTheDocument();
  });

  it("Prompt-Baukasten: Bausteine verbessern die Güte", () => {
    render(<PromptBaukasten />);
    expect(screen.getByText(/Sehr ungenau/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Klasse 7/ }));
    expect(screen.getByText(/Schon besser/)).toBeInTheDocument();
    expect(screen.getByText(/grüne Farbstoff/)).toBeInTheDocument();
  });
});
