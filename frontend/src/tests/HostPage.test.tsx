/**
 * Tests for the host/beamer page game flow.
 *
 * Contract:
 *  - Preview phase: question visible, NO answer choices rendered
 *  - Answering phase: answer choices rendered, countdown visible
 *  - Revealed phase: ranking list visible, correct answers highlighted
 *  - Finished phase: final ranking visible
 *  - Teacher controls: correct action sent for each phase
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "HOST01" }),
}));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: () => <div data-testid="qrcode" />,
}));

// fetch mock for /server-ip
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ ip: "192.168.1.100" }),
}));

class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  close = vi.fn();
  send = vi.fn();
  dispatchMsg(payload: object) {
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

import * as apiModule from "@/lib/api";
import HostPage from "@/app/games/caputh/host/[code]/page";

// ── helpers ───────────────────────────────────────────────────────────────────

const PREVIEW = {
  event: "question_preview",
  question_id: 1,
  question_idx: 0,
  total_questions: 2,
  question_text: "Was ist 2+2?",
  image_path: null,
  time_limit: 20,
  question_type: "single",
};

const ANSWERING = {
  event: "question_answering",
  question_id: 1,
  question_type: "single",
  time_limit: 20,
  answers: [
    { id: 10, text: "3", order: 0 },
    { id: 11, text: "4", order: 1 },
  ],
};

const REVEAL = {
  event: "reveal",
  question_id: 1,
  correct_answer_ids: [11],
  answer_counts: { 10: 1, 11: 3 },
  ranking: [
    { pid: 1, name: "Lena", avatar: "cat", score: 1.2, delta: 1.2, rank: 1 },
    { pid: 2, name: "Milo", avatar: "dog", score: 1.01, delta: 1.01, rank: 2 },
  ],
  is_last: false,
};

const FINISHED = {
  event: "finished",
  points_awarded: 42,
  quiz_title: "Testquiz",
  final_ranking: [
    { pid: 1, name: "Lena", avatar: "cat", score: 2.2, delta: 0, rank: 1 },
  ],
};

function openSocket() {
  act(() => { socket.onopen?.(); });
}

function send(payload: object) {
  act(() => { socket.dispatchMsg(payload); });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("HostPage – game flow", () => {
  beforeEach(() => {
    socket = undefined as unknown as MockWebSocket;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows connecting message before socket opens", () => {
    render(<HostPage />);
    expect(screen.getByText(/Verbinde/i)).toBeInTheDocument();
  });

  it("shows waiting room with join code after connection + state event", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 0 });

    expect(screen.getAllByText("HOST01").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Caputh starten/i })).toBeInTheDocument();
  });

  it("Lobby zeigt den Gaeste-Schalter direkt am QR", async () => {
    // Der Schalter steckte vorher nur im QR-Overlay hinter einem kleinen Knopf
    // und war auf der Lobby-Ansicht, die die Lehrkraft anschaut, nicht zu sehen.
    const status = vi.spyOn(apiModule.api.guest, "status")
      .mockResolvedValue({ allow_guests: false, guest_epoch: 0 });

    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 0 });

    expect(await screen.findByRole("button", { name: /Gäste erlauben/ })).toBeInTheDocument();
    expect(status).toHaveBeenCalledWith("caputh", "HOST01");
  });

  it("preview phase: shows question text, no answer choices", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 1 });
    send(PREVIEW);

    expect(screen.getByText("Was ist 2+2?")).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    expect(screen.queryByText("4")).not.toBeInTheDocument();
  });

  it("preview phase: shows 'Antworten zeigen' button", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 1 });
    send(PREVIEW);

    expect(screen.getByRole("button", { name: /Antworten zeigen/i })).toBeInTheDocument();
  });

  it("preview phase: 'Antworten zeigen' sends show_answers action", async () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 1 });
    send(PREVIEW);

    const btn = screen.getByRole("button", { name: /Antworten zeigen/i });
    await userEvent.click(btn);

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ action: "show_answers" }));
  });

  it("answering phase: shows answer choices after question_answering event", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 1 });
    send(PREVIEW);
    send(ANSWERING);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("answering phase: shows countdown timer", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 1 });
    send(PREVIEW);
    send(ANSWERING);

    // countdown displays the initial time_limit value (20s)
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("answering phase: 'Jetzt auflösen' sends next action", async () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 1 });
    send(PREVIEW);
    send(ANSWERING);

    const btn = screen.getByRole("button", { name: /auflösen/i });
    await userEvent.click(btn);

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ action: "next" }));
  });

  it("revealed phase: shows ranking after 'ranking' server event", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 2 });
    send(PREVIEW);
    send(ANSWERING);
    send(REVEAL);
    send({ event: "ranking", is_last: false, ranking: REVEAL.ranking });

    expect(screen.getByText("Lena")).toBeInTheDocument();
    expect(screen.getByText("Milo")).toBeInTheDocument();
  });

  it("revealed phase: shows 'Nächste Frage' after ranking event when not last", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 1 });
    send(PREVIEW);
    send(ANSWERING);
    send(REVEAL);
    send({ event: "ranking", is_last: false, ranking: REVEAL.ranking });

    expect(screen.getByRole("button", { name: /Nächste Frage/i })).toBeInTheDocument();
  });

  it("revealed phase: shows 'Quiz beenden' after ranking event when last", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 1 });
    send(PREVIEW);
    send(ANSWERING);
    send({ ...REVEAL, is_last: true });
    send({ event: "ranking", is_last: true, ranking: REVEAL.ranking });

    expect(screen.getByRole("button", { name: /Caputh beenden/i })).toBeInTheDocument();
  });

  it("finished phase: shows final ranking and points", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 1 });
    send(FINISHED);

    expect(screen.getByText("Testquiz")).toBeInTheDocument();
    expect(screen.getByText(/42 Hauspunkte/)).toBeInTheDocument();
    expect(screen.getByText("Lena")).toBeInTheDocument();
  });
});

describe("HostPage – Lobby und Verbindung", () => {
  beforeEach(() => {
    socket = undefined as unknown as MockWebSocket;
  });

  it("zeigt einen Gast, der neu verbindet, nur einmal", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 0 });
    const lena = { event: "participant_joined", participant_id: 5, name: "Lena", avatar: "cat", count: 1 };
    send(lena);
    send(lena); // derselbe Gast nach dem Neuladen

    expect(screen.getAllByText("Lena")).toHaveLength(1);
  });

  it("nach dem Neuladen stehen die schon Beigetretenen wieder in der Lobby", () => {
    render(<HostPage />);
    openSocket();
    send({ event: "state", status: "waiting", participant_count: 1,
           participants: [{ id: 5, name: "Lena", avatar: "cat" }] });

    expect(screen.getByText("Lena")).toBeInTheDocument();
  });

  it("sagt bei abgewiesener Verbindung, woran es liegt", () => {
    render(<HostPage />);
    act(() => { socket.onclose?.({ code: 4003 }); });

    expect(screen.getByText(/Keine Berechtigung/)).toBeInTheDocument();
  });

  it("verbindet nach einem Abriss selbst neu", async () => {
    render(<HostPage />);
    openSocket();
    const first = socket;
    act(() => { first.onclose?.({ code: 1006 }); });

    await waitFor(() => expect(socket).not.toBe(first), { timeout: 2500 });
  });
});
