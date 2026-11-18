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

beforeEach(() => { localStorage.removeItem(SPEICHER); localStorage.removeItem("hp_stochastik_lektionen_zu"); });

describe("Stochastik-Blätter", () => {
  it("öffnet jede Lektion, Üben, Spiele und Erfolge", () => {
    render(<Stochastik />);
    for (const l of LEKTIONEN) {
      fireEvent.click(within(screen.getByRole("navigation", { name: "Lektionen" })).getByRole("button", { name: new RegExp(l.label) }));
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
    fireEvent.click(within(screen.getByRole("navigation", { name: "Lektionen" })).getByRole("button", { name: /Kenngrößen/ }));
    expect(screen.getAllByText(/Quartile/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /^H · / }));
    expect(screen.queryByRole("img", { name: "Boxplot" })).toBeNull();
    expect(screen.getByText(/gehört zum Realschul- und Gymnasialniveau/)).toBeTruthy();
  });

  it("Rückgriff springt zur früheren Lektion", () => {
    render(<Stochastik />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Lektionen" })).getByRole("button", { name: /Baumdiagramm/ }));
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

  it("eigene Daten: Merkmale anlegen, Fertig, per Klick zählen", () => {
    render(<Stochastik />);
    fireEvent.click(screen.getByRole("button", { name: "✏️ Eigene Daten" }));
    fireEvent.change(screen.getByLabelText("Neues Merkmal"), { target: { value: "gelb" } });
    fireEvent.click(screen.getByRole("button", { name: "＋ Hinzufügen" }));
    fireEvent.click(screen.getByRole("button", { name: /Fertig – jetzt zählen/ }));
    fireEvent.click(screen.getByRole("button", { name: /＋ gelb/ }));
    fireEvent.click(screen.getByRole("button", { name: /＋ gelb/ }));
    fireEvent.click(screen.getByRole("button", { name: /＋ Obst/ }));
    const tab = screen.getAllByRole("table")[0];
    const zeile = within(tab).getByText("gelb").closest("tr")!;
    expect(within(zeile).getByText("2")).toBeTruthy();
    expect(within(tab).getByText("3")).toBeTruthy();
    // dieselben Daten im Blatt Diagramme
    fireEvent.click(within(screen.getByRole("navigation", { name: "Lektionen" })).getByRole("button", { name: /Diagramme/ }));
    fireEvent.click(screen.getByRole("button", { name: "✏️ Eigene Daten" }));
    expect(screen.getByRole("button", { name: /＋ gelb 2/ })).toBeTruthy();
  });

  it("Lektionen lassen sich einklappen und mit ◂ ▸ durchblättern", () => {
    render(<Stochastik />);
    fireEvent.click(screen.getByRole("button", { name: /Lektionen einklappen/ }));
    expect(screen.queryByRole("navigation", { name: "Lektionen" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nächste Lektion" }));
    expect(screen.getByRole("heading", { level: 2, name: /Diagramme/ })).toBeTruthy();
    expect(localStorage.getItem("hp_stochastik_lektionen_zu")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: /Alle Lektionen/ }));
    expect(screen.getByRole("navigation", { name: "Lektionen" })).toBeTruthy();
  });

  it("fester Reiter: keine Reiterleiste", () => {
    render(<Stochastik vorgabe={{ reiter: "vierfelder" }} />);
    expect(screen.getByRole("heading", { level: 2, name: /Vierfeldertafel/ })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Lektionen" })).toBeNull();
  });
});
