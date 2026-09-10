/**
 * Tests for the student play page in-game phases.
 *
 * Contract:
 *  - question_preview event: question text shown, NO answer buttons
 *  - question_answering event: answer buttons appear; question text preserved from preview
 *  - Single-choice answer: sends immediately, shows "Antwort gesendet"
 *  - Multi-choice answer: buttons toggle, submit button appears, sends on submit
 *  - reveal event: shows ✅/❌ result, rank, and delta
 *  - finished event: shows final ranking
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "PLAY01" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    capuths: {
      joinSession: vi.fn().mockResolvedValue({ participant_id: 7, name: "Lena" }),
      getSession: vi.fn().mockResolvedValue({ team_mode: false }),
      listTeams: vi.fn().mockResolvedValue([]),
    },
    // Ohne Login holt die Seite vor dem Beitreten ein Gast-Token
    // (useGuestSession). Fehlt das hier, scheitert schon der Klick auf
    // "Beitreten" und es entsteht nie ein WebSocket.
    guest: {
      join: vi.fn().mockResolvedValue({ token: "gast-token", name: "Lena" }),
    },
  },
}));

class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  close = vi.fn();
  send = vi.fn();
  fire(payload: object) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}
let socket: MockWebSocket;
vi.stubGlobal("WebSocket", class extends MockWebSocket {
  constructor(..._a: unknown[]) {
    super();
    socket = this;
  }
});

import PlayPage from "@/app/play/[code]/page";

// ── helpers ───────────────────────────────────────────────────────────────────

async function mountAndJoin() {
  render(<PlayPage />);
  // hydrate
  await act(async () => {});
  // fill name and click Beitreten
  await userEvent.type(screen.getByPlaceholderText(/Dein Name/i), "Lena");
  await userEvent.click(screen.getByRole("button", { name: /Beitreten/i }));
  // simulate server joined response
  act(() => { socket.fire({ event: "joined", name: "Lena" }); });
  // now in waiting phase
}

const PREVIEW_MSG = {
  event: "question_preview",
  question_id: 1,
  question_idx: 0,
  total_questions: 2,
  question_text: "Was ist 2+2?",
  image_path: null,
  time_limit: 20,
  question_type: "single",
};

const ANSWERING_SINGLE = {
  event: "question_answering",
  question_id: 1,
  question_type: "single",
  time_limit: 20,
  answers: [
    { id: 10, text: "3", order: 0 },
    { id: 11, text: "4", order: 1 },
  ],
};

const ANSWERING_MULTI = {
  event: "question_answering",
  question_id: 2,
  question_type: "multi",
  time_limit: 20,
  answers: [
    { id: 20, text: "Mars", order: 0 },
    { id: 21, text: "Mond", order: 1 },
    { id: 22, text: "Venus", order: 2 },
  ],
};

const REVEAL_CORRECT = {
  event: "reveal",
  question_id: 1,
  correct_answer_ids: [11],
  answer_counts: { 10: 1, 11: 3 },
  ranking: [
    { pid: 7, name: "Lena", avatar: "cat", score: 1.2, delta: 1.2, rank: 1 },
  ],
};

const REVEAL_WRONG = {
  event: "reveal",
  question_id: 1,
  correct_answer_ids: [11],
  answer_counts: { 10: 2, 11: 1 },
  ranking: [
    { pid: 9, name: "Other", avatar: "dog", score: 1.2, delta: 1.2, rank: 1 },
    { pid: 7, name: "Lena", avatar: "cat", score: 0, delta: 0, rank: 2 },
  ],
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe("PlayPage – in-game phases", () => {
  beforeEach(() => {
    localStorage.clear();
    socket = undefined as unknown as MockWebSocket;
  });

  it("preview phase: shows question text", async () => {
    await mountAndJoin();
    act(() => { socket.fire(PREVIEW_MSG); });

    expect(screen.getByText("Was ist 2+2?")).toBeInTheDocument();
  });

  it("preview phase: no answer buttons shown", async () => {
    await mountAndJoin();
    act(() => { socket.fire(PREVIEW_MSG); });

    expect(screen.queryByRole("button", { name: "3" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "4" })).not.toBeInTheDocument();
  });

  it("answering phase: answer buttons appear after question_answering event", async () => {
    await mountAndJoin();
    act(() => { socket.fire(PREVIEW_MSG); });
    act(() => { socket.fire(ANSWERING_SINGLE); });

    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4" })).toBeInTheDocument();
  });

  it("answering phase: question text preserved from preview", async () => {
    await mountAndJoin();
    act(() => { socket.fire(PREVIEW_MSG); });
    act(() => { socket.fire(ANSWERING_SINGLE); });

    expect(screen.getByText("Was ist 2+2?")).toBeInTheDocument();
  });

  it("single-choice: clicking answer sends it immediately", async () => {
    await mountAndJoin();
    act(() => { socket.fire(PREVIEW_MSG); });
    act(() => { socket.fire(ANSWERING_SINGLE); });

    await userEvent.click(screen.getByRole("button", { name: "4" }));

    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ action: "answer", answer_ids: [11] })
    );
  });

  it("single-choice: shows 'Antwort gesendet' after answering", async () => {
    await mountAndJoin();
    act(() => { socket.fire(PREVIEW_MSG); });
    act(() => { socket.fire(ANSWERING_SINGLE); });

    await userEvent.click(screen.getByRole("button", { name: "4" }));
    act(() => { socket.fire({ event: "answer_received", is_correct: true }); });

    await waitFor(() =>
      expect(screen.getByText(/Antwort gesendet/i)).toBeInTheDocument()
    );
  });

  it("multi-choice: no immediate send on button click", async () => {
    await mountAndJoin();
    act(() => { socket.fire({ ...PREVIEW_MSG, question_type: "multi" }); });
    act(() => { socket.fire(ANSWERING_MULTI); });

    await userEvent.click(screen.getByRole("button", { name: "Mars" }));

    // send not called yet (need to press submit)
    expect(socket.send).not.toHaveBeenCalled();
  });

  it("multi-choice: submit button appears after selecting at least one answer", async () => {
    await mountAndJoin();
    act(() => { socket.fire({ ...PREVIEW_MSG, question_type: "multi" }); });
    act(() => { socket.fire(ANSWERING_MULTI); });

    await userEvent.click(screen.getByRole("button", { name: "Mars" }));

    expect(screen.getByRole("button", { name: /Antwort abschicken/i })).toBeInTheDocument();
  });

  it("multi-choice: submit sends selected answer ids", async () => {
    await mountAndJoin();
    act(() => { socket.fire({ ...PREVIEW_MSG, question_type: "multi" }); });
    act(() => { socket.fire(ANSWERING_MULTI); });

    await userEvent.click(screen.getByRole("button", { name: "Mars" }));
    await userEvent.click(screen.getByRole("button", { name: "Venus" }));
    await userEvent.click(screen.getByRole("button", { name: /Antwort abschicken/i }));

    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ action: "answer", answer_ids: [20, 22] })
    );
  });

  it("reveal: shows ✅ when student answered correctly", async () => {
    await mountAndJoin();
    act(() => { socket.fire(PREVIEW_MSG); });
    act(() => { socket.fire(ANSWERING_SINGLE); });
    await userEvent.click(screen.getByRole("button", { name: "4" }));
    act(() => { socket.fire({ event: "answer_received", is_correct: true }); });
    act(() => { socket.fire(REVEAL_CORRECT); });

    expect(screen.getByText("✅")).toBeInTheDocument();
  });

  it("reveal: shows ❌ when student answered incorrectly", async () => {
    await mountAndJoin();
    act(() => { socket.fire(PREVIEW_MSG); });
    act(() => { socket.fire(ANSWERING_SINGLE); });
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    act(() => { socket.fire({ event: "answer_received", is_correct: false }); });
    act(() => { socket.fire(REVEAL_WRONG); });

    expect(screen.getByText("❌")).toBeInTheDocument();
  });

  it("reveal: shows rank after ranking event", async () => {
    await mountAndJoin();
    act(() => { socket.fire(PREVIEW_MSG); });
    act(() => { socket.fire(ANSWERING_SINGLE); });
    await userEvent.click(screen.getByRole("button", { name: "4" }));
    act(() => { socket.fire({ event: "answer_received", is_correct: true }); });
    act(() => { socket.fire(REVEAL_CORRECT); });
    act(() => { socket.fire({ event: "ranking", ranking: [{ pid: 7, name: "Lena", avatar: "cat", score: 1.2, delta: 1.2, rank: 1 }] }); });

    expect(screen.getByText(/Platz 1/i)).toBeInTheDocument();
  });

  it("reveal: shows score delta after ranking event", async () => {
    await mountAndJoin();
    act(() => { socket.fire(PREVIEW_MSG); });
    act(() => { socket.fire(ANSWERING_SINGLE); });
    await userEvent.click(screen.getByRole("button", { name: "4" }));
    act(() => { socket.fire({ event: "answer_received", is_correct: true }); });
    act(() => { socket.fire(REVEAL_CORRECT); });
    act(() => { socket.fire({ event: "ranking", ranking: [{ pid: 7, name: "Lena", avatar: "cat", score: 1.2, delta: 1.2, rank: 1 }] }); });

    expect(screen.getByText(/\+1\.20/)).toBeInTheDocument();
  });

  it("finished phase: shows quiz title and points", async () => {
    await mountAndJoin();
    act(() => {
      socket.fire({
        event: "finished",
        points_awarded: 75,
        quiz_title: "Testquiz",
        final_ranking: [{ pid: 7, name: "Lena", avatar: "cat", score: 1.2, delta: 0, rank: 1 }],
      });
    });

    expect(screen.getByText("Testquiz")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
  });
});

describe("PlayPage – Verbindungsabriss", () => {
  beforeEach(() => {
    localStorage.clear();
    socket = undefined as unknown as MockWebSocket;
  });

  it("verbindet nach einem Abriss selbst neu und bekommt die erste Frage", async () => {
    // Handy im Warteraum gesperrt: die Verbindung reisst ab. Bisher blieb der
    // Warteraum stehen, und die Frage kam erst nach dem Neuladen an.
    await mountAndJoin();
    const first = socket;
    act(() => { first.onclose?.({ code: 1006 }); });

    await waitFor(() => expect(socket).not.toBe(first), { timeout: 2500 });
    act(() => { socket.fire(PREVIEW_MSG); });
    expect(screen.getByText("Was ist 2+2?")).toBeInTheDocument();
  });

  it("schickt ins Beitrittsformular, wenn es den Platz nicht mehr gibt", async () => {
    await mountAndJoin();
    act(() => { socket.onclose?.({ code: 4003 }); });

    expect(await screen.findByText(/Teilnahme gibt es nicht mehr/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Dein Name/i)).toBeInTheDocument();
  });

  it("verbindet nach dem Rauswurf nicht neu", async () => {
    await mountAndJoin();
    const first = socket;
    act(() => { first.fire({ event: "kicked" }); });
    act(() => { first.onclose?.({ code: 4000 }); });

    await new Promise((r) => setTimeout(r, 1200));
    expect(socket).toBe(first);
  });
});
