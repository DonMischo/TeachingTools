/**
 * Prüft das gerenderte Periodensystem: Raster, Suche, Steckbrief und der
 * Weg in die Gleichungswaage.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Periodensystem from "@/components/pse/Periodensystem";

/** Klickt die Kachel an — die Kacheln tragen ihren Namen im title. */
const oeffne = (name: string) => {
  render(<Periodensystem />);
  fireEvent.click(screen.getByTitle(new RegExp(`^${name} —`)));
};

describe("Periodensystem", () => {
  it("zeigt alle 118 Elemente als Felder", () => {
    render(<Periodensystem />);
    // Jede Kachel trägt ihren Namen im title; die Kategorieknöpfe nicht.
    expect(screen.getAllByTitle(/—/)).toHaveLength(118);
  });

  it("öffnet den Steckbrief mit Kenndaten", () => {
    oeffne("Eisen");
    // »Übergangsmetalle« steht auch auf dem Filterknopf — hier zählt der Kopf des Steckbriefs.
    const kopf = screen.getByRole("heading", { name: "Eisen" }).parentElement!;
    expect(within(kopf).getByText("Übergangsmetalle")).toBeInTheDocument();
    expect(within(kopf).getByText(/4\. Periode/)).toBeInTheDocument();
    // Schmelzpunkt 1811 K = 1538 °C
    expect(screen.getByText("1538 °C")).toBeInTheDocument();
    // Die Genauigkeit der Quelle bleibt stehen: 55,84 u, nicht 55,840 u.
    expect(screen.getByText("55,84 u")).toBeInTheDocument();
  });

  it("gibt die Dichte von Gasen in g/l an", () => {
    oeffne("Wasserstoff");
    // PubChem nennt 0,00008988 g/cm³ — das sind 0,0899 g/l.
    expect(screen.getByText("0,0899 g/l")).toBeInTheDocument();
  });

  it("zeigt das Foto der Stoffprobe mit Lizenz und Urheber", () => {
    oeffne("Kupfer");
    expect(screen.getByAltText("Stoffprobe Kupfer")).toBeInTheDocument();
    expect(screen.getByText(/Foto:.*CC BY/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wikimedia Commons" })).toHaveAttribute(
      "href", expect.stringContaining("commons.wikimedia.org"));
  });

  it("verlinkt jede Reaktion in den Chemiemodus der Gleichungswaage", () => {
    oeffne("Natrium");
    const link = screen.getByRole("link", { name: /Natrium in Wasser/ });
    expect(link).toHaveAttribute("href",
      "/simulationen/gleichungswaage?reaktion=Na%20%2B%20H2O%20-%3E%20NaOH%20%2B%20H2");
    // Die Gleichung steht unausgeglichen da — sie soll ja ausgeglichen werden.
    expect(within(link).getByText("Na + H2O → NaOH + H2")).toBeInTheDocument();
  });

  it("blendet beim Suchen alles andere zurück", () => {
    render(<Periodensystem />);
    fireEvent.change(screen.getByPlaceholderText(/Suchen/), { target: { value: "Gold" } });
    expect(screen.getByTitle(/^Gold —/).className).not.toMatch(/opacity-40/);
    expect(screen.getByTitle(/^Silber —/).className).toMatch(/opacity-40/);
  });

  it("filtert nach Kategorie", () => {
    render(<Periodensystem />);
    fireEvent.click(screen.getByRole("button", { name: "Edelgase" }));
    expect(screen.getByTitle(/^Neon —/).className).not.toMatch(/opacity-40/);
    expect(screen.getByTitle(/^Eisen —/).className).toMatch(/opacity-40/);
  });

  it("kommt ohne Steckbrieftext aus, wenn es keinen gibt", () => {
    oeffne("Dubnium");
    expect(screen.getByRole("heading", { name: "Dubnium" })).toBeInTheDocument();
    expect(screen.queryByText("Typische Reaktionen")).not.toBeInTheDocument();
  });
});
