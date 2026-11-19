import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Spielalgorithmen from "@/components/spielalgo/Spielalgorithmen";

describe("Spielalgorithmen", () => {
  it("zeigt jeden Reiter mit Steuerung und Erklärung", async () => {
    render(<Spielalgorithmen />);
    const reiter = screen.getAllByRole("tab");
    expect(reiter).toHaveLength(8);
    for (const tab of reiter) {
      await act(async () => { fireEvent.click(tab); });
      if (tab.textContent?.includes("Mehr")) {
        expect(screen.getByText("Regel-Labor")).toBeTruthy();
        continue;
      }
      expect(document.querySelector("[data-steuerung]") ?? document.querySelector("[data-wegsuche]")).toBeTruthy();
      expect(document.querySelector("section.card h3")?.textContent).toBeTruthy();
      // »Genauer hinschauen« mit Code und Stellschrauben
      expect(document.querySelector("[data-vertiefung] [data-code]")?.textContent?.length).toBeGreaterThan(100);
      expect(document.querySelector("[data-vertiefung] [data-stellschrauben]")).toBeTruthy();
    }
  });

  it("Growing Tree erscheint als fünfte Spalte und reagiert auf den Regler", async () => {
    render(<Spielalgorithmen vorgabe={{ reiter: "labyrinth" }} />);
    await act(async () => { fireEvent.click(screen.getByText("⏩ bis zum Ende")); });
    const kopf = () => [...document.querySelectorAll("[data-vergleich] thead th")].map(t => t.textContent);
    expect(kopf()).toContain("Eigen");
    const sack = () => document.querySelectorAll("[data-vergleich] tbody tr")[0].lastElementChild!.textContent;
    const vorher = sack();
    const regler = document.querySelector("[data-stellschrauben] input[type=range]") as HTMLInputElement;
    await act(async () => { fireEvent.change(regler, { target: { value: "0" } }); });
    await act(async () => { fireEvent.click(screen.getByText("⏩ bis zum Ende")); });
    expect(Number(sack())).toBeGreaterThan(Number(vorher)); // »wie Prim« hat mehr Sackgassen
  });

  it("»bis zum Ende« fertigt den Ablauf-Graphen und prüft ihn", async () => {
    render(<Spielalgorithmen vorgabe={{ reiter: "zyklus" }} />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0); // fester Reiter
    await act(async () => { fireEvent.click(screen.getByText("⏩ bis zum Ende")); });
    expect(document.querySelector("[data-pruefung]")?.textContent).toMatch(/lösbar – nur mit Schlüssel/);
    expect(document.querySelectorAll("[data-graph] circle").length).toBeGreaterThan(5);
  });

  it("BSP: Baum wächst bis zum Ende", async () => {
    render(<Spielalgorithmen vorgabe={{ reiter: "bsp" }} />);
    await act(async () => { fireEvent.click(screen.getByText("⏩ bis zum Ende")); });
    expect(document.querySelector("[data-notiz]")?.textContent).toMatch(/Gang zwischen/);
    expect(document.querySelectorAll("svg[aria-label='BSP-Baum'] circle").length).toBeGreaterThan(8);
  });
});
