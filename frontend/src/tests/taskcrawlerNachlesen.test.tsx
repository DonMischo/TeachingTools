/**
 * Medien-Station im TaskCrawler (Vorgabe `station`), Krabbler-Sperre bis 45 s
 * mit letztem Erklärtext zum Nachlesen.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ExitGameSlide } from "@/lib/api";
import { sperrDauer } from "@/lib/krabbler";
import { letzteInfo } from "@/components/exitgame/FolienTeile";

vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()) }));
import Medien from "@/components/medien/Medien";

describe("Geschichte der Medien: Station als Vorgabe", () => {
  it("öffnet die Zeitreise am Telegrafen, obwohl er noch gesperrt wäre", () => {
    render(<Medien vorgabe={{ reiter: "zeitreise", station: "telegraf" }} />);
    expect(screen.getByRole("heading", { name: /Elektrischer Telegraf/ })).toBeInTheDocument();
    // Reiterleiste ist fest, nur die Zeitreise
    expect(screen.queryByRole("button", { name: /Flop-Museum/ })).not.toBeInTheDocument();
  });

  it("unbekannte Station: Anfang wie gewohnt", () => {
    render(<Medien vorgabe={{ station: "gibtsnicht" }} />);
    expect(screen.getByText(/Station 1 von/)).toBeInTheDocument();
  });
});

describe("Krabbler: Sperre und Nachlesen", () => {
  it("Sperre wächst um 5 s je Fehler bis höchstens 45 s", () => {
    expect([1, 2, 3, 8, 9, 20].map(sperrDauer)).toEqual([10_000, 15_000, 20_000, 45_000, 45_000, 45_000]);
  });

  it("letzteInfo: Erklärung bzw. Beispiel vor der Aufgabe, ohne Formel-Dollar", () => {
    const slides = [
      { id: "e1", type: "explanation", title: "Brüche", text: "Ein Bruch $\\frac{a}{b}$ teilt." },
      { id: "t1", type: "task", text: "Aufgabe 1" },
      { id: "b1", type: "example", text: "3/4 von 8 sind 6." },
      { id: "t2", type: "task" },
    ] as ExitGameSlide[];
    expect(letzteInfo(slides, "t1")).toBe("Brüche\n\nEin Bruch \\frac{a}{b} teilt.");
    expect(letzteInfo(slides, "t2")).toBe("3/4 von 8 sind 6.");
  });

  it("letzteInfo: ohne Erklärung davor die Station selbst (Info und Frage auf einer Folie)", () => {
    const slides = [
      { id: "t1", type: "task", title: "Der Telegraf", text: "Morse sendete $1844$ die erste Nachricht." },
      { id: "t2", type: "task" },
    ] as ExitGameSlide[];
    expect(letzteInfo(slides, "t1")).toBe("Der Telegraf\n\nMorse sendete 1844 die erste Nachricht.");
    expect(letzteInfo(slides, "t2")).toBe("Der Telegraf\n\nMorse sendete 1844 die erste Nachricht.");
    expect(letzteInfo([{ id: "t3", type: "task" }] as ExitGameSlide[], "t3")).toBeUndefined();
  });
});
