import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import StufeExplorer from "@/components/maus/StufeExplorer";

/** Neuen Ordner anlegen und doppelklickend öffnen. */
function inSchule() {
  render(<StufeExplorer avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
  fireEvent.click(screen.getByTitle("Neuer Ordner"));
  fireEvent.doubleClick(screen.getByText(/Neuer Ordner/, { selector: "button *, button" }).closest("button")!);
  expect(within(screen.getByTestId("adressleiste")).getByText("Neuer Ordner")).toBeInTheDocument();
}

describe("Maus-Führerschein: Explorer-Navigation", () => {
  it("»Dokumente« in der Seitenleiste führt aus dem Unterordner zurück", () => {
    inSchule();
    fireEvent.click(document.querySelector('[data-nav="dokumente"]')!);
    expect(within(screen.getByTestId("adressleiste")).queryByText("Neuer Ordner")).not.toBeInTheDocument();
  });

  it("»Dokumente« in der Adressleiste führt zurück", () => {
    inSchule();
    fireEvent.click(document.querySelector('[data-pfad="dokumente"]')!);
    expect(within(screen.getByTestId("adressleiste")).queryByText("Neuer Ordner")).not.toBeInTheDocument();
  });
});
