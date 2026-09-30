import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Zeitlupe from "@/components/leviathan/Zeitlupe";
import { leereVerteilung, neuesSpiel, runde } from "@/lib/leviathan/motor";
import { standBei, takte } from "@/lib/leviathan/zeitlupe";
import { GROESSEN, STANDARD_EINSTELLUNGEN } from "@/lib/leviathan/typen";

const z = runde(neuesSpiel("industrie", STANDARD_EINSTELLUNGEN, 3), { ...leereVerteilung(), bildung: 3, rechtsstaat: 2 });

describe("Zeitlupe – Takte", () => {
  it("jede Investition ist ein Takt, samt ihrer Programme", () => {
    const ts = takte(z.rechnung!);
    const invest = ts.filter((t) => t.schritt === "investition");
    expect(invest.map((t) => t.fokus)).toEqual(["bildung", "rechtsstaat"]);
    expect(invest[0].beitraege.some((b) => b.nach === "desinformation")).toBe(true);
    expect(ts[0].schritt).toBe("budget");
    expect(ts[ts.length - 1].schritt).toBe("lq");
  });

  it("nach dem letzten Takt stehen genau die Endwerte da", () => {
    const ts = takte(z.rechnung!);
    const ende = standBei(z.rechnung!, ts, ts.length - 1, 1);
    for (const g of GROESSEN) expect(ende[g]).toBeCloseTo(z.w[g], 6);
  });
});

describe("Zeitlupe – Ansicht", () => {
  it("lässt sich Takt für Takt durchgehen und das Tempo wählen", () => {
    let tempo = "mittel";
    render(<Zeitlupe z={z} tempo="mittel" onTempo={(t) => { tempo = t; }} />);
    expect(screen.getByText(/Takt 1 von/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nächster Takt" }));
    expect(screen.getByText(/Takt 2 von/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Aktionspunkte in Bildung/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /langsam/ }));
    expect(tempo).toBe("langsam");
  });
});
