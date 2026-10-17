import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const stand = vi.hoisted(() => ({ pfad: "/play/simulation/ABC", auth: null as null | { user_type: string } }));
vi.mock("next/navigation", () => ({ usePathname: () => stand.pfad }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: stand.auth, ready: true }) }));

import { LehrkraftLeiste, SelbstSpielenKnopf, istSpielerseite, zurueckZiel } from "@/components/LehrkraftSpielt";

describe("Lehrkraft spielt mit", () => {
  beforeEach(() => {
    stand.pfad = "/play/simulation/ABC";
    stand.auth = null;
    window.history.replaceState(null, "", "/");
  });

  it("zurueckZiel lässt nur Pfade dieser Seite durch", () => {
    expect(zurueckZiel("/aktivitaeten/bingo/host/X1")).toBe("/aktivitaeten/bingo/host/X1");
    for (const boes of [null, "", "https://fremd.de", "//fremd.de", "/\\fremd.de", "javascript:alert(1)"])
      expect(zurueckZiel(boes)).toBe("/aktivitaeten");
  });

  it("erkennt die Spielerseiten", () => {
    expect(istSpielerseite("/play/X1")).toBe(true);
    expect(istSpielerseite("/aktivitaeten/lueckentext/play/X1")).toBe(true);
    expect(istSpielerseite("/play")).toBe(false);
    expect(istSpielerseite("/aktivitaeten/bingo/host/X1")).toBe(false);
  });

  it("der Knopf öffnet die Spielerseite und merkt sich die Steuerung", () => {
    window.history.replaceState(null, "", "/aktivitaeten/bingo/host/X1");
    render(<SelbstSpielenKnopf href="/play/bingo/X1" />);
    expect(screen.getByRole("link", { name: /Selbst mitspielen/ }).getAttribute("href"))
      .toBe("/play/bingo/X1?zurueck=%2Faktivitaeten%2Fbingo%2Fhost%2FX1");
  });

  it("die Leiste führt eine Lehrkraft zurück zur Steuerung", () => {
    stand.auth = { user_type: "teacher" };
    window.history.replaceState(null, "", "/play/bingo/X1?zurueck=%2Faktivitaeten%2Fbingo%2Fhost%2FX1");
    render(<LehrkraftLeiste />);
    expect(screen.getByRole("link", { name: /Steuerung/ }).getAttribute("href")).toBe("/aktivitaeten/bingo/host/X1");
  });

  it("ohne Rückweg geht es zu den Aktivitäten", () => {
    stand.auth = { user_type: "teacher" };
    render(<LehrkraftLeiste />);
    expect(screen.getByRole("link", { name: /Steuerung/ }).getAttribute("href")).toBe("/aktivitaeten");
  });

  it("Schüler, Gäste und Seiten außerhalb des Spiels sehen keine Leiste", () => {
    stand.auth = { user_type: "student" };
    const { container, rerender } = render(<LehrkraftLeiste />);
    expect(container.innerHTML).toBe("");
    stand.auth = null;
    rerender(<LehrkraftLeiste />);
    expect(container.innerHTML).toBe("");
    stand.auth = { user_type: "teacher" };
    stand.pfad = "/aktivitaeten";
    rerender(<LehrkraftLeiste />);
    expect(container.innerHTML).toBe("");
  });
});
