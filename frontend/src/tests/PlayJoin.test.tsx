/**
 * Tests for the PlayPage join form.
 * Key scenario: avatar starts null (SSR), useEffect sets it (client hydration).
 * Clicks must work AFTER hydration, not just on initial render.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── next/navigation mock ──────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "TEST01" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// ── api mock ──────────────────────────────────────────────────────────────────
const mockJoinSession = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    capuths: {
      joinSession: (...args: unknown[]) => mockJoinSession(...args),
    },
  },
}));

// ── WebSocket mock ────────────────────────────────────────────────────────────
class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  close = vi.fn();
  send = vi.fn();
}
let lastSocket: MockWebSocket;
vi.stubGlobal("WebSocket", class extends MockWebSocket {
  constructor(..._args: unknown[]) {
    super();
    lastSocket = this;
  }
});

// ── import after mocks ────────────────────────────────────────────────────────
import PlayPage from "@/app/play/[code]/page";

describe("PlayPage – join form", () => {
  beforeEach(() => {
    localStorage.clear();
    mockJoinSession.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function renderAndHydrate() {
    let result: ReturnType<typeof render>;
    await act(async () => {
      result = render(<PlayPage />);
    });
    return result!;
  }

  it("renders the join form after hydration", async () => {
    await renderAndHydrate();
    expect(screen.getByPlaceholderText("Dein Name…")).toBeInTheDocument();
    expect(screen.getByText(/Beitreten/)).toBeInTheDocument();
  });

  it("avatar picker has buttons after hydration", async () => {
    await renderAndHydrate();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(1);
  });

  it("clicking an avatar after hydration updates the selection", async () => {
    const user = userEvent.setup();
    await renderAndHydrate();
    const catBtn = screen.getByTitle("cat");
    await user.click(catBtn);
    expect(catBtn.querySelector(".avatar-check")).toBeTruthy();
  });

  it("clicking a different avatar moves the checkmark", async () => {
    const user = userEvent.setup();
    await renderAndHydrate();
    await user.click(screen.getByTitle("cat"));
    await user.click(screen.getByTitle("dog"));
    expect(screen.getByTitle("dog").querySelector(".avatar-check")).toBeTruthy();
    expect(screen.getByTitle("cat").querySelector(".avatar-check")).toBeNull();
  });

  it("shows error and does not call API when name is empty", async () => {
    const user = userEvent.setup();
    await renderAndHydrate();
    await user.click(screen.getByText(/Beitreten/));
    expect(mockJoinSession).not.toHaveBeenCalled();
    expect(screen.getByText(/Namen/)).toBeInTheDocument();
  });

  it("calls joinSession with name and selected avatar", async () => {
    const user = userEvent.setup();
    mockJoinSession.mockResolvedValue({ participant_id: 1, name: "Test" });
    await renderAndHydrate();
    await user.click(screen.getByTitle("cat"));
    await user.type(screen.getByPlaceholderText("Dein Name…"), "Test");
    await user.click(screen.getByText(/Beitreten/));
    expect(mockJoinSession).toHaveBeenCalledWith("TEST01", "Test", "cat");
  });

  it("shows error message when joinSession fails", async () => {
    const user = userEvent.setup();
    mockJoinSession.mockRejectedValue(new Error("Session nicht gefunden"));
    await renderAndHydrate();
    await user.type(screen.getByPlaceholderText("Dein Name…"), "Test");
    await user.click(screen.getByText(/Beitreten/));
    await waitFor(() =>
      expect(screen.getByText("Session nicht gefunden")).toBeInTheDocument()
    );
  });
});
