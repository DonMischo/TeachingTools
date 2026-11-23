import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { neuesSpiel } from "@/lib/leben/motor";
import { offenePunkte } from "@/lib/leben/notizen";
import { SCHRITTE, tutorialHaken, hakenOffen } from "@/components/leben/Tutorial";
import { IchApp } from "@/components/leben/IchApp";
import type { Spielstand } from "@/lib/leben/typen";

function spiel(): Spielstand {
  return neuesSpiel({ name: "Testi Muster", geburtstag: "2010-03-04", avatar: "🙂", farbe: "#f00", kirche: false, seed: 7, zeugnis: { abschluss: "RSA", noten: { Deutsch: 2, Mathematik: 3 } }, herkunft: { eltern: "land", elternEinkommen: "mittel", kindergeld: "weiter" } });
}

describe("Übung Uhr und Geld", () => {
  it("braucht beide Haken, dann geht es weiter", () => {
    const i = SCHRITTE.findIndex((x) => x.haken);
    let s = spiel();
    s.flags.tutorial = i;
    expect(hakenOffen(s, "uhr")).toBe(true);
    s = tutorialHaken(s, "uhr")!;
    expect(s.flags.tutorial).toBe(i);
    expect(tutorialHaken(s, "uhr")).toBeNull();
    s = tutorialHaken(s, "geld")!;
    expect(s.flags.tutorial).toBe(i + 1);
    expect(s.flags.tut_uhr).toBeUndefined();
  });
  it("ohne Übung passiert nichts", () => {
    expect(tutorialHaken(spiel(), "uhr")).toBeNull();
  });
});

describe("Notizblock", () => {
  it("listet offene Bewerbungen und Anträge, Zusage zuerst", () => {
    const s = spiel();
    s.bewerbungen.push({ uid: 1, beruf: "x", betrieb: "Bäckerei Beispiel", tag: s.tag, status: "versendet", naechsterTag: s.tag + 7, qualitaet: 0.5 });
    s.bewerbungen.push({ uid: 2, beruf: "y", betrieb: "Firma Muster", tag: s.tag, status: "zusage", naechsterTag: s.tag + 14, qualitaet: 0.5 });
    s.antraege.push({ uid: 3, art: "wohngeld", gestellt: s.tag, status: "eingereicht", antwortTag: s.tag + 30 });
    const p = offenePunkte(s);
    expect(p[0].text).toMatch(/Firma Muster.*Zusage/);
    expect(p.some((x) => x.gruppe === "antrag" && /Wohngeld/.test(x.text))).toBe(true);
  });
});

describe("Charakterbogen", () => {
  it("zeigt Personalien und Schule", () => {
    render(<IchApp s={spiel()} tu={() => {}} />);
    const bogen = screen.getByTestId("charakterbogen");
    expect(bogen.textContent).toMatch(/Steuer-ID/);
    expect(bogen.textContent).toMatch(/Girokonto/);
  });
});
