/**
 * Tests for the Lückentext student board.
 *
 * Contract:
 *  - Phone: tapping a gap opens the word bank as a sheet; picking a word fills
 *    the gap and submits it.
 *  - The sheet lists the words still up for grabs — a word that already solved
 *    a gap is gone, but only one tile of a word that occurs twice.
 *  - A wrong guess keeps its word in the sheet (it still belongs somewhere).
 *  - Multiple choice marks only the option that was picked, never all of them.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const CODE = "LT000001";

vi.mock("next/navigation", () => ({
  useParams: () => ({ code: CODE }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user_type: "student" } }),
}));

// Hoisted: vi.mock factories run before the module body.
const { BOARD, submitAttempt } = vi.hoisted(() => ({
  BOARD: {
    // "Wolke" sits in the bank twice — one per gap that needs it.
    text: "Es entsteht {{a}}, dann {{b}} und {{c}}, schließlich {{d}} und {{e}}.",
    gaps: [
      { id: "a", type: "word_bank", difficulty: "easy", hint: null, choices: null },
      { id: "b", type: "word_bank", difficulty: "easy", hint: null, choices: null },
      { id: "c", type: "word_bank", difficulty: "easy", hint: null, choices: null },
      { id: "d", type: "free_type", difficulty: "medium", hint: null, choices: null },
      { id: "e", type: "multiple_choice", difficulty: "hard", hint: null, choices: ["Regen", "Schnee"] },
    ],
    word_bank: ["Verdunstung", "Wolke", "Wolke", "Gezeiten"],
  },
  submitAttempt: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    lueckentexte: {
      sessionState: vi.fn().mockResolvedValue({ status: "active", board: BOARD }),
      joinSession: vi.fn(),
      submitAttempt: (...args: unknown[]) => submitAttempt(...args),
    },
  },
}));

import LueckentextPlayPage from "@/app/games/lueckentext/play/[code]/page";

/** Skips the join screen: a saved participant id makes the page rejoin itself. */
async function mountBoard() {
  localStorage.setItem(`lueckentext_${CODE}`, JSON.stringify({ name: "Lena", avatar: "cat", participantId: 7 }));
  render(<LueckentextPlayPage />);
  await waitFor(() => expect(screen.getAllByRole("button", { name: /Lücke/ }).length).toBe(3));
}

const gapButtons = () => screen.getAllByRole("button", { name: /Lücke/ });

/** jsdom applies no CSS, so the `lg:` sidebar is in the tree next to the sheet.
 *  The sheet is the one carrying the Schließen button — query inside it. */
function sheet(): HTMLElement {
  return screen.getByRole("button", { name: "Schließen" }).closest("div")!.parentElement!;
}

const sheetOpen = () => screen.queryByRole("button", { name: "Schließen" }) !== null;

const sheetWords = () =>
  within(sheet()).getAllByRole("button")
    .map((b) => b.textContent!.trim())
    .filter((t) => t !== "Schließen");

/** The bank is shuffled per player, so only the multiset is stable. */
const sorted = (a: string[]) => [...a].sort();

/** A doubled word is offered twice — either tile does. */
const pickWord = (word: string) => userEvent.click(within(sheet()).getAllByRole("button", { name: word })[0]);

beforeEach(() => {
  localStorage.clear();
  submitAttempt.mockReset();
  submitAttempt.mockResolvedValue({ match: "exact", revealed: false, hint: null, attempts: 1, solved: true });
});

describe("Wortbank auf dem Handy", () => {
  it("opens the word list when a gap is tapped and fills the gap on pick", async () => {
    await mountBoard();
    expect(sheetOpen()).toBe(false);

    await userEvent.click(gapButtons()[0]);
    expect(sorted(sheetWords())).toEqual(sorted(["Verdunstung", "Wolke", "Wolke", "Gezeiten"]));

    await pickWord("Verdunstung");

    expect(submitAttempt).toHaveBeenCalledWith(CODE, "a", 7, "Verdunstung");
    // Sheet closes, and the word is visible in the gap it went into.
    await waitFor(() => expect(sheetOpen()).toBe(false));
    expect(gapButtons()[0]).toHaveTextContent("Verdunstung");
  });

  it("drops a solved word from the list — but only one tile of a doubled word", async () => {
    await mountBoard();

    await userEvent.click(gapButtons()[1]);
    await pickWord("Wolke");
    await waitFor(() => expect(gapButtons()[1]).toHaveTextContent("Wolke"));

    await userEvent.click(gapButtons()[2]);
    // One "Wolke" is used up, the second is still there for the other gap.
    expect(sorted(sheetWords())).toEqual(sorted(["Verdunstung", "Wolke", "Gezeiten"]));
  });

  it("keeps a wrongly placed word in the list", async () => {
    await mountBoard();
    submitAttempt.mockResolvedValue({ match: "wrong", revealed: false, hint: null, attempts: 1, solved: false });

    await userEvent.click(gapButtons()[0]);
    await pickWord("Gezeiten");
    await waitFor(() => expect(gapButtons()[0]).toHaveTextContent("Gezeiten"));

    await userEvent.click(gapButtons()[1]);
    expect(sheetWords()).toContain("Gezeiten");
  });
});

describe("Multiple Choice", () => {
  it("marks only the option that was picked", async () => {
    await mountBoard();

    const regen = screen.getByRole("button", { name: "Regen" });
    const schnee = screen.getByRole("button", { name: "Schnee" });
    await userEvent.click(regen);

    await waitFor(() => expect(regen.className).toContain("border-green-500"));
    expect(schnee.className).not.toContain("border-green-500");
  });
});
