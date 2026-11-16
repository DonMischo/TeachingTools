/** Umfrage-Einstellungen: Gastfenster-Umrechnung, Formular und anonymer Beitritt. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { gastAufteilen, gastMinuten, gastMinutenGueltig } from "@/lib/barometer";
import { UmfrageEinstellungen } from "@/components/barometer/UmfrageEinstellungen";

describe("Gastfenster-Helfer", () => {
  it("rechnet Einheiten in Minuten um", () => {
    expect(gastMinuten(2, "h")).toBe(120);
    expect(gastMinuten(30, "d")).toBe(43200);
    expect(gastMinuten(0, "h")).toBeNaN();
  });
  it("teilt Minuten in die größte glatte Einheit", () => {
    expect(gastAufteilen(2880)).toEqual({ zahl: 2, einheit: "d" });
    expect(gastAufteilen(180)).toEqual({ zahl: 3, einheit: "h" });
    expect(gastAufteilen(90)).toEqual({ zahl: 90, einheit: "min" });
  });
  it("prüft den Bereich 60 Minuten bis 30 Tage", () => {
    expect(gastMinutenGueltig(null)).toBe(true);
    expect(gastMinutenGueltig(0)).toBe(true);
    expect(gastMinutenGueltig(59)).toBe(false);
    expect(gastMinutenGueltig(43201)).toBe(false);
    expect(gastMinutenGueltig(NaN)).toBe(false);
  });
});

describe("UmfrageEinstellungen", () => {
  it("meldet Schulvorgabe, eigene Dauer und bis geschlossen", async () => {
    const user = userEvent.setup();
    const onMin = vi.fn();
    render(<UmfrageEinstellungen anonymous={false} onAnonymous={() => {}} guestMinutes={null} onGuestMinutes={onMin} />);
    const wahl = screen.getByLabelText("Dauer des Gastzugangs");
    await user.selectOptions(wahl, "eigen");
    expect(onMin).toHaveBeenLastCalledWith(120);
    await user.selectOptions(screen.getByLabelText("Einheit"), "d");
    expect(onMin).toHaveBeenLastCalledWith(2 * 1440);
    await user.selectOptions(wahl, "offen");
    expect(onMin).toHaveBeenLastCalledWith(0);
    await user.selectOptions(wahl, "standard");
    expect(onMin).toHaveBeenLastCalledWith(null);
  });

  it("zeigt eine gespeicherte Dauer in Tagen", () => {
    render(<UmfrageEinstellungen anonymous onAnonymous={() => {}} guestMinutes={7 * 1440} onGuestMinutes={() => {}} />);
    expect((screen.getByLabelText("Dauer") as HTMLInputElement).value).toBe("7");
    expect((screen.getByLabelText("Einheit") as HTMLSelectElement).value).toBe("d");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });
});

// ── Spielerseite: anonymer Gast ohne Namensformular ─────────────────────────

vi.mock("next/navigation", () => ({ useParams: () => ({ code: "ANON01" }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: null }) }));
vi.mock("@/hooks/useLiveSocket", () => ({ useLiveSocket: () => ({ send: vi.fn() }) }));
const mockGet = vi.fn();
const mockJoin = vi.fn();
vi.mock("@/lib/api", async (orig) => {
  const real = await orig<typeof import("@/lib/api")>();
  return {
    ...real,
    api: { ...real.api,
      barometer: { get: (...a: unknown[]) => mockGet(...a) },
      guest: { join: (...a: unknown[]) => mockJoin(...a) },
    },
  };
});

import BarometerPlayPage from "@/app/play/barometer/[code]/page";

describe("Umfrage-Spielerseite", () => {
  beforeEach(() => {
    localStorage.clear();
    mockGet.mockReset();
    mockJoin.mockReset();
    mockJoin.mockResolvedValue({ token: "t", name: "Anonym", expires_in_minutes: 90 });
  });

  it("anonym: tritt ohne Namensformular bei", async () => {
    mockGet.mockResolvedValue({ anonymous: true });
    render(<BarometerPlayPage />);
    await waitFor(() => expect(mockJoin).toHaveBeenCalledWith("ANON01", "barometer", "Anonym"));
    expect(screen.queryByPlaceholderText("Dein Name")).toBeNull();
  });

  it("nicht anonym: zeigt das Namensformular", async () => {
    mockGet.mockResolvedValue({ anonymous: false });
    render(<BarometerPlayPage />);
    expect(await screen.findByPlaceholderText("Dein Name")).toBeTruthy();
    expect(mockJoin).not.toHaveBeenCalled();
  });
});
