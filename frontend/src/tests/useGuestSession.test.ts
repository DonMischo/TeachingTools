/**
 * Der Gastzugang muss sich erholen können.
 *
 * Der abgelaufene localStorage-Eintrag blieb früher für immer liegen. Weil die
 * Codes zustandsloser Werkzeuge absichtlich stabil sind (ein gedruckter QR soll
 * weiter gelten), war dasselbe Gerät danach dauerhaft ausgesperrt — auch wenn
 * die Lehrkraft erneut geteilt hatte. Dagegen gibt es hier Tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockGuestJoin = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { guest: { join: (...args: unknown[]) => mockGuestJoin(...args) } },
}));

import { useGuestSession } from "@/hooks/useGuestSession";

const KEY = "hp_guest_WAAGE1";

function storeSession(expiresAt: number) {
  localStorage.setItem(KEY, JSON.stringify({ token: "t", name: "Gast", expiresAt }));
}

describe("useGuestSession", () => {
  beforeEach(() => {
    localStorage.clear();
    mockGuestJoin.mockReset();
    mockGuestJoin.mockResolvedValue({ token: "frisch", name: "Gast", expires_in_minutes: 90 });
  });
  afterEach(() => vi.useRealTimers());

  it("fortsetzen: derselbe Name schickt das frühere Token mit, auch nach Ablauf", async () => {
    const { result } = renderHook(() => useGuestSession("WAAGE1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => { await result.current.join("exitgame", "Max", { fortsetzen: true }); });
    expect(mockGuestJoin).toHaveBeenLastCalledWith("WAAGE1", "exitgame", "Max", undefined);
    localStorage.removeItem(KEY); // Fenster abgelaufen und weggeworfen
    mockGuestJoin.mockResolvedValue({ token: "neu", name: "max", expires_in_minutes: 90 });
    await act(async () => { await result.current.join("exitgame", " max ", { fortsetzen: true }); });
    expect(mockGuestJoin).toHaveBeenLastCalledWith("WAAGE1", "exitgame", " max ", "frisch");
    await act(async () => { await result.current.join("exitgame", "Moritz", { fortsetzen: true }); });
    expect(mockGuestJoin).toHaveBeenLastCalledWith("WAAGE1", "exitgame", "Moritz", undefined);
  });

  it("nimmt ein laufendes Gastfenster aus dem Speicher an", async () => {
    storeSession(Date.now() + 30 * 60 * 1000);
    const { result } = renderHook(() => useGuestSession("WAAGE1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.token).toBe("t");
    expect(result.current.expired).toBe(false);
  });

  it("wirft ein beim Aufruf schon abgelaufenes Fenster weg statt zu sperren", async () => {
    // Der Fall aus der Praxis: nächste Stunde, derselbe stabile Code.
    storeSession(Date.now() - 60 * 1000);
    const { result } = renderHook(() => useGuestSession("WAAGE1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.expired).toBe(false);   // kein Sperrbildschirm
    expect(result.current.token).toBeNull();      // sondern: neu beitreten
    expect(localStorage.getItem(KEY)).toBeNull(); // Altlast ist weg
  });

  it("sperrt, wenn das Fenster während der Nutzung abläuft", async () => {
    vi.useFakeTimers();
    storeSession(Date.now() + 5_000);
    const { result } = renderHook(() => useGuestSession("WAAGE1"));
    await act(async () => {});
    expect(result.current.expired).toBe(false);

    await act(async () => { vi.advanceTimersByTime(5_001); });
    expect(result.current.expired).toBe(true);
  });

  it("lange Fenster (bis 30 Tage) laufen nicht sofort ab", async () => {
    // setTimeout kann höchstens 2^31-1 ms (~24,8 Tage) warten; darüber feuert
    // er sofort — der Gast sah direkt »Sitzung abgelaufen«.
    vi.useFakeTimers();
    const tag = 24 * 60 * 60_000;
    storeSession(Date.now() + 30 * tag);
    const { result } = renderHook(() => useGuestSession("WAAGE1"));
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(result.current.expired).toBe(false);
    await act(async () => { vi.advanceTimersByTime(25 * tag); });
    expect(result.current.expired).toBe(false);
    await act(async () => { vi.advanceTimersByTime(5 * tag); });
    expect(result.current.expired).toBe(true);
  });

  it("markExpired sperrt sofort (WS 4001 / REST 401)", async () => {
    storeSession(Date.now() + 30 * 60 * 1000);
    const { result } = renderHook(() => useGuestSession("WAAGE1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.markExpired());
    expect(result.current.expired).toBe(true);
  });

  it("rejoin verwirft den Eintrag und lädt die Seite neu", async () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, reload },
    });
    try {
      storeSession(Date.now() + 30 * 60 * 1000);
      const { result } = renderHook(() => useGuestSession("WAAGE1"));
      await waitFor(() => expect(result.current.loaded).toBe(true));
      act(() => result.current.markExpired());
      expect(result.current.expired).toBe(true);

      act(() => result.current.rejoin());

      expect(localStorage.getItem(KEY)).toBeNull();
      expect(result.current.expired).toBe(false);
      expect(reload).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("nimmt 90 Minuten an, wenn der Server die Fensterlänge nicht nennt", async () => {
    // Ein Backend, das die Zahl noch nicht mitschickt: ohne Rückfall wäre das
    // Ablaufdatum NaN — und damit sähe jeder Gast sofort »Sitzung abgelaufen«.
    mockGuestJoin.mockResolvedValue({ token: "frisch", name: "Gast" });
    const { result } = renderHook(() => useGuestSession("WAAGE1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => { await result.current.join("simulation", "Gast"); });

    expect(result.current.expired).toBe(false);
    expect(result.current.token).toBe("frisch");
  });

  it("join legt ein frisches Fenster an und hebt die Sperre auf", async () => {
    storeSession(Date.now() - 60 * 1000);
    const { result } = renderHook(() => useGuestSession("WAAGE1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.markExpired());

    await act(async () => { await result.current.join("simulation", "Gast"); });

    expect(mockGuestJoin).toHaveBeenCalledWith("WAAGE1", "simulation", "Gast");
    expect(result.current.token).toBe("frisch");
    expect(result.current.expired).toBe(false);
  });
});
