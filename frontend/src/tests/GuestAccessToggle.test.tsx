/**
 * »Gastzugang neu starten« am Host-Bildschirm.
 *
 * Ein gedruckter QR überlebt mehrere Klassen: der Code bleibt derselbe, damit
 * der Aushang weiter stimmt. Ohne diesen Knopf hätte die vorige Gruppe bis zum
 * Ende ihres Gastfensters weiter Zugang, während die nächste denselben Code
 * scannt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockStatus = vi.fn();
const mockSetAllowed = vi.fn();
const mockRestart = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    guest: {
      status: (...a: unknown[]) => mockStatus(...a),
      setAllowed: (...a: unknown[]) => mockSetAllowed(...a),
      restart: (...a: unknown[]) => mockRestart(...a),
    },
  },
}));

import { GuestAccessToggle } from "@/components/GuestAccessToggle";

describe("GuestAccessToggle", () => {
  beforeEach(() => {
    mockStatus.mockReset();
    mockSetAllowed.mockReset();
    mockRestart.mockReset();
    mockRestart.mockResolvedValue({ allow_guests: true, guest_epoch: 1, guest_minutes: 90 });
  });
  afterEach(() => vi.restoreAllMocks());

  it("zeigt »neu starten« nur, wenn Gäste erlaubt sind", async () => {
    mockStatus.mockResolvedValue({ allow_guests: false, guest_epoch: 0, guest_minutes: 90 });
    render(<GuestAccessToggle tool="simulation" code="WAAGE1" />);

    await waitFor(() => expect(screen.getByText("Gäste erlauben")).toBeInTheDocument());
    // Ohne Gastzugang gibt es keine Token, die man entziehen könnte.
    expect(screen.queryByText(/neu starten/)).not.toBeInTheDocument();
  });

  it("startet nach Rückfrage neu", async () => {
    const user = userEvent.setup();
    mockStatus.mockResolvedValue({ allow_guests: true, guest_epoch: 0, guest_minutes: 90 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<GuestAccessToggle tool="simulation" code="WAAGE1" />);

    await user.click(await screen.findByText("↺ neu starten"));

    await waitFor(() => expect(mockRestart).toHaveBeenCalledWith("simulation", "WAAGE1"));
    // Rückmeldung, dass es passiert ist — sonst klickt man zweimal.
    expect(await screen.findByText("↺ neu gestartet")).toBeInTheDocument();
  });

  it("bricht ab, wenn die Rückfrage verneint wird", async () => {
    const user = userEvent.setup();
    mockStatus.mockResolvedValue({ allow_guests: true, guest_epoch: 0, guest_minutes: 90 });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<GuestAccessToggle tool="simulation" code="WAAGE1" />);

    await user.click(await screen.findByText("↺ neu starten"));
    expect(mockRestart).not.toHaveBeenCalled();
  });

  it("schreibt die eingestellte Fensterlänge an den Schalter", async () => {
    // Die Zahl kommt vom Server (Admin › Gastzugang) — im Bauteil steht keine
    // feste 60, sonst löge der Hinweis nach der ersten Umstellung.
    mockStatus.mockResolvedValue({ allow_guests: true, guest_epoch: 0, guest_minutes: 90 });
    render(<GuestAccessToggle tool="simulation" code="WAAGE1" />);

    expect(await screen.findByText("90 Min.")).toBeInTheDocument();
  });

  it("wirft niemanden aus, wenn nur der Schalter umgelegt wird", async () => {
    const user = userEvent.setup();
    mockStatus.mockResolvedValue({ allow_guests: true, guest_epoch: 0, guest_minutes: 90 });
    mockSetAllowed.mockResolvedValue({ allow_guests: false, guest_epoch: 0, guest_minutes: 90 });
    render(<GuestAccessToggle tool="simulation" code="WAAGE1" />);

    await user.click(await screen.findByText("Gäste erlauben"));

    await waitFor(() => expect(mockSetAllowed).toHaveBeenCalledWith("simulation", "WAAGE1", false));
    expect(mockRestart).not.toHaveBeenCalled();
  });
});
