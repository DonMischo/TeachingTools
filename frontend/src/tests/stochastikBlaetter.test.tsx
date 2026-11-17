/**
 * Daten und Stochastik: jedes Blatt öffnet ohne Fehler, Niveau-Filter blendet
 * R/G-Inhalte aus, Übungen zählen in die Erfolge, feste Reiter (TaskCrawler)
 * zeigen keine Reiterleiste.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Stochastik from "@/components/stochastik/Stochastik";
import { LEKTIONEN } from "@/lib/stochastik/lektionen";
import { SPEICHER, lade } from "@/lib/stochastik/erfolge";

beforeEach(() => localStorage.removeItem(SPEICHER));

describe("Stochastik-Blätter", () => {
  it("öffnet jede Lektion, Üben, Spiele und Erfolge", () => {
    render(<Stochastik />);
    for (const l of LEKTIONEN) {
      fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`^${l.icon} ${l.label}`) })[0]);
      expect(screen.getByRole("heading", { level: 2, name: new RegExp(l.label) })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "✍️ Üben" }));
    expect(screen.getByTestId("aufgabe")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "🎮 Spiele" }));
    expect(screen.getByText("Kenngrößen-Blitz")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "🏆 Erfolge" }));
    // einmal in der Liste, einmal in der Meldung »Erfolg erreicht«
    expect(screen.getAllByText("Rundgang").length).toBe(2);
    expect(screen.getByRole("status").textContent).toContain("Rundgang");
    // alle zwölf Lektionen geöffnet → Erfolg »Rundgang«
    expect(lade().besucht).toHaveLength(LEKTIONEN.length);
  });

  it("Hauptschulniveau blendet Quartile und Boxplot aus", () => {
    render(<Stochastik />);
    fireEvent.click(screen.getAllByRole("button", { name: /^📏 Kenngrößen/ })[0]);
    expect(screen.getAllByText(/Quartile/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /^H · / }));
    expect(screen.queryByRole("img", { name: "Boxplot" })).toBeNull();
    expect(screen.getByText(/gehört zum Realschul- und Gymnasialniveau/)).toBeTruthy();
  });

  it("Rückgriff springt zur früheren Lektion", () => {
    render(<Stochastik />);
    fireEvent.click(screen.getAllByRole("button", { name: /^🌳 Baumdiagramm/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: /kennst du aus Kl\. 5\/6: 🎲 Zufallsexperimente/ }));
    expect(screen.getByRole("heading", { level: 2, name: /Zufallsexperimente/ })).toBeTruthy();
  });

  it("Erfassen zählt die Urliste in die Strichliste", () => {
    render(<Stochastik />);
    fireEvent.click(screen.getByRole("button", { name: "⏩ Alle zählen" }));
    const tab = screen.getAllByRole("table")[0];
    expect(within(tab).getByText("Summe")).toBeTruthy();
    expect(within(tab).getByText("24")).toBeTruthy();
  });

  it("fester Reiter: keine Reiterleiste", () => {
    render(<Stochastik vorgabe={{ reiter: "vierfelder" }} />);
    expect(screen.getByRole("heading", { level: 2, name: /Vierfeldertafel/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^📋 Daten erfassen/ })).toBeNull();
  });
});
