import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StufeSuche from "@/components/maus/StufeSuche";

describe("Maus-Führerschein: Suche", () => {
  it("öffnet das Startmenü, findet Paint und zeigt danach Aufgabe 2", () => {
    render(<StufeSuche avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);

    fireEvent.click(document.querySelector("[data-start]")!);
    expect(document.querySelector("[data-startmenue]")).toBeInTheDocument();

    const eingabe = screen.getByTestId("startmenue-suche");
    fireEvent.change(eingabe, { target: { value: "paint" } });

    const treffer = document.querySelector('[data-treffer="app:paint"]') as HTMLElement;
    expect(treffer).toBeTruthy();
    fireEvent.click(treffer);

    expect(screen.getAllByText(/Referat Planeten/).length).toBeGreaterThan(0);
  });

  it("zählt eine falsche Auswahl als Fehlversuch", () => {
    render(<StufeSuche avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);

    fireEvent.click(document.querySelector("[data-start]")!);
    const eingabe = screen.getByTestId("startmenue-suche");
    fireEvent.change(eingabe, { target: { value: "rechner" } });

    const treffer = document.querySelector('[data-treffer="app:rechner"]') as HTMLElement;
    fireEvent.click(treffer);

    expect(screen.getByText(/nochmal/)).toBeInTheDocument();
  });
});
