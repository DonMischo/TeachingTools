import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import Abakus from "@/components/simulationen/Abakus";
import Bildformate from "@/components/simulationen/Bildformate";
import Binaerrechner from "@/components/simulationen/Binaerrechner";
import Tippen from "@/components/tippen/Tippen";
import MausFuehrerschein from "@/components/maus/MausFuehrerschein";
import KiWerkstatt from "@/components/ki/KiWerkstatt";
import Kueste from "@/components/kueste/Kueste";
import WilsonZyklus from "@/components/wilson/WilsonZyklus";
import RegelLabor from "@/components/regeln/RegelLabor";
import { STATIONEN, RAETSEL } from "@/lib/regeln/lehrgang";

vi.mock("@/hooks/useAvailability", () => ({
  useAvailability: () => ({ can: () => true, ready: true }),
}));

// Die Werkbank zeichnet auf ein Canvas (jsdom hat keinen 2D-Kontext) — hier nur ein Platzhalter.
vi.mock("@/components/regeln/Werkbank", () => ({ default: () => <div data-testid="werkbank" /> }));

// Die Küsten-Ansicht misst sich mit einem ResizeObserver, den jsdom nicht kennt.
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

// Sonnensystem und ErdAufbau: bewusst ohne Render-Test — beide ziehen three.js/WebGL
// nach, das in jsdom nicht läuft. Die Sperre ist dort dieselbe wie überall (wahl + Leiste ausblenden).

describe("Simulationen mit festem Reiter (Exitgame-Stationen)", () => {
  it("Abakus: Stellenwert fest, keine Umschaltung", () => {
    render(<Abakus vorgabe={{ reiter: "place" }} />);
    expect(screen.queryByRole("button", { name: "Alle gleich" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stellenwert" })).not.toBeInTheDocument();
  });
  it("Abakus frei: Umschaltung da", () => {
    render(<Abakus />);
    expect(screen.getByRole("button", { name: "Stellenwert" })).toBeInTheDocument();
  });

  it("Bildformate: PGM fest, keine Formatwahl", () => {
    render(<Bildformate vorgabe={{ reiter: "P2" }} />);
    expect(screen.queryByText("PBM")).not.toBeInTheDocument();
    expect(screen.queryByText("PPM")).not.toBeInTheDocument();
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toMatch(/^P2/);
  });
  it("Bildformate frei: Formatwahl da", () => {
    render(<Bildformate />);
    expect(screen.getByText("PBM")).toBeInTheDocument();
    expect(screen.getByText("PPM")).toBeInTheDocument();
  });

  it("Binärrechner: Zahl voreingestellt", () => {
    const { container } = render(<Binaerrechner vorgabe={{ zahl: 42 }} />);
    expect(container.textContent).toMatch(/42/);
  });

  it("Tippen: Wortregen fest, keine Modus-Leiste", () => {
    render(<Tippen vorgabe={{ reiter: "wortregen" }} />);
    expect(screen.queryByRole("tab", { name: /Lektionen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Tastenjagd/ })).not.toBeInTheDocument();
  });
  it("Tippen frei: Modus-Leiste da", () => {
    render(<Tippen />);
    expect(screen.getByRole("tab", { name: /Wortregen/ })).toBeInTheDocument();
  });

  it("Maus-Führerschein: Stufe fest, keine Stufenleiste", () => {
    renderWithProviders(<MausFuehrerschein vorgabe={{ reiter: "doppelklick" }} />);
    expect(screen.queryByRole("tab", { name: /Rechtsklick/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
  it("Maus-Führerschein frei: Stufenleiste da", () => {
    renderWithProviders(<MausFuehrerschein />);
    expect(screen.getByRole("tab", { name: /Rechtsklick/ })).toBeInTheDocument();
  });

  it("KI-Werkstatt: Reiter fest, keine Reiterleiste", () => {
    render(<KiWerkstatt vorgabe={{ reiter: "lernen" }} />);
    expect(screen.queryByRole("button", { name: /Sprachmodell/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Echt oder KI/ })).not.toBeInTheDocument();
  });
  it("KI-Werkstatt frei: Reiterleiste da", () => {
    render(<KiWerkstatt />);
    expect(screen.getByRole("button", { name: /Echt oder KI/ })).toBeInTheDocument();
  });

  it("Küste: Gezeiten fest, keine Reiterleiste", () => {
    render(<Kueste vorgabe={{ reiter: "gezeiten" }} />);
    expect(screen.queryByRole("button", { name: /Querschnitt/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Wissen/ })).not.toBeInTheDocument();
  });
  it("Küste frei: Reiterleiste da", () => {
    render(<Kueste />);
    expect(screen.getByRole("button", { name: /Gezeiten/ })).toBeInTheDocument();
  });

  it("Wilson-Zyklus: Wissen fest, keine Reiterleiste", () => {
    render(<WilsonZyklus vorgabe={{ reiter: "wissen" }} />);
    expect(screen.queryByRole("button", { name: /Welche Phase/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Querschnitt/ })).not.toBeInTheDocument();
  });
  it("Wilson-Zyklus frei: Reiterleiste da", () => {
    render(<WilsonZyklus />);
    expect(screen.getByRole("button", { name: /Welche Phase/ })).toBeInTheDocument();
  });

  it("Regel-Labor: Rätsel fest, weder Reiter- noch Rätselwahl", () => {
    render(<RegelLabor vorgabe={{ reiter: "raetsel", raetsel: RAETSEL[1].id }} />);
    expect(screen.queryByRole("button", { name: /Freies Labor/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: RAETSEL[0].titel })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: RAETSEL[1].titel })).toBeInTheDocument();
  });
  it("Regel-Labor: Station fest, keine Stationswahl", () => {
    render(<RegelLabor vorgabe={{ reiter: "lehrgang", station: STATIONEN[2].id }} />);
    expect(screen.queryByRole("button", { name: STATIONEN[0].titel })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: STATIONEN[2].titel })).toBeInTheDocument();
  });
  it("Regel-Labor frei: Reiterleiste da", () => {
    render(<RegelLabor />);
    expect(screen.getByRole("button", { name: /Freies Labor/ })).toBeInTheDocument();
  });
});
