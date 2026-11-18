/** Lehrkraft-Knopf »Alles freischalten«: nur für Lehrkräfte, öffnet alle Stationen, ohne Fortschritt zu speichern. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const rolle = { wert: "teacher" };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { user_type: rolle.wert === "student" ? "student" : "teacher", role: rolle.wert }, ready: true }) }));

import Medien from "@/components/medien/Medien";
import { MEDIEN } from "@/lib/medien/medien";

Element.prototype.scrollIntoView = vi.fn();

const gesperrt = () => screen.getAllByRole("listitem").filter(b => (b as HTMLButtonElement).disabled).length;

describe("Geschichte der Medien: Alles freischalten (Lehrkraft)", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it("Lehrkraft schaltet alle Stationen frei — nur im Tab, der Fortschritt bleibt leer", () => {
    rolle.wert = "teacher";
    render(<Medien />);
    expect(gesperrt()).toBe(MEDIEN.length - 1);
    fireEvent.click(screen.getByRole("button", { name: /Alles freischalten/ }));
    expect(gesperrt()).toBe(0);
    expect(sessionStorage.getItem("hp_medien_alles_frei")).toBe("1");
    expect(JSON.parse(localStorage.getItem("hp_medien_fortschritt") ?? '{"geschafft":[]}').geschafft).toEqual([]);
  });

  it("Sitzung mit »Alle Stationen freischalten«: auch für Schüler alles offen, ohne eigenen Knopf", () => {
    rolle.wert = "student";
    render(<Medien sitzungFrei />);
    expect(gesperrt()).toBe(0);
    expect(screen.getByText(/Alles frei \(Sitzung\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Alles freischalten/ })).not.toBeInTheDocument();
  });

  it("Schüler sehen den Knopf nicht", () => {
    rolle.wert = "student";
    render(<Medien />);
    expect(screen.queryByRole("button", { name: /Alles freischalten/ })).not.toBeInTheDocument();
  });
});
