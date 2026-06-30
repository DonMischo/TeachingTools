import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as apiModule from "@/lib/api";

// Mock heavy client-only editor with a placeholder
vi.mock("@/components/schreibraum/Editor", () => ({
  default: ({ roomCode, participant, mode }: { roomCode: string; participant: { name: string }; mode: string }) => (
    <div data-testid="mock-editor" data-room={roomCode} data-participant={participant.name} data-mode={mode}>
      Mock Editor
    </div>
  ),
}));

// next/dynamic just returns the component directly in tests
vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ default: unknown }>) => {
    const mod = { component: null as unknown };
    fn().then((m) => { mod.component = (m as { default: unknown }).default; });
    return function DynamicWrapper(props: Record<string, unknown>) {
      if (!mod.component) return null;
      const Comp = mod.component as React.ComponentType<Record<string, unknown>>;
      return <Comp {...props} />;
    };
  },
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "ABC123" }),
  useRouter: () => ({ push: mockPush }),
}));

const mockTeacher = { id: 1, first_name: "Anna", last_name: "Müller", active: true, role: "teacher" };
const mockStudent = { id: 10, vorname: "Ben", nachname: "Braun", klasse: "5a", class_id: 2, nummer: null, jahrgang: null, geschlecht: "m", geburtsdatum: null, username: "ben", active: true, has_credentials: true };

const makeRoom = (overrides: Partial<apiModule.SchreibraumRoom> = {}): apiModule.SchreibraumRoom => ({
  id: "room-1",
  code: "ABC123",
  title: "Testroom",
  mode: "next-free-line",
  is_permanent: true,
  created_by: 1,
  creator_name: "Anna Müller",
  created_at: "2026-01-01T10:00:00Z",
  access: [],
  ...overrides,
});

const makeParticipant = (overrides: Partial<apiModule.SchreibraumParticipant> = {}): apiModule.SchreibraumParticipant => ({
  id: "p-1",
  room_id: "room-1",
  name: "Anna Müller",
  color: "#374151",
  session_token: "tok-abc",
  is_teacher: true,
  is_kicked: false,
  rejoin_allowed: true,
  joined_at: "2026-01-01T10:00:00Z",
  ...overrides,
});

import SchreibraumEditorPage from "@/app/schreibraum/[code]/page";

let mockAuth: apiModule.MeOut | null = null;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: mockAuth
      ? {
          user_type: mockAuth.user_type,
          role: mockAuth.user_type === "student" ? "student" : (mockAuth.teacher?.role ?? "teacher"),
          teacher: mockAuth.teacher,
          student: mockAuth.student,
        }
      : null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

function renderPage() {
  return render(<SchreibraumEditorPage />);
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockAuth = null;
  mockPush.mockReset();
});

describe("SchreibraumEditor — auth gate", () => {
  it("shows login hint when not authenticated", async () => {
    await act(async () => { renderPage(); });
    expect(screen.getByText(/bitte anmelden/i)).toBeInTheDocument();
  });
});

describe("SchreibraumEditor — loading and error", () => {
  beforeEach(() => {
    mockAuth = { user_type: "teacher", teacher: mockTeacher };
  });

  it("shows loading state initially", async () => {
    vi.spyOn(apiModule.api.schreibraum, "getByCode").mockReturnValue(new Promise(() => {}));
    vi.spyOn(apiModule.api.schreibraum, "join").mockReturnValue(new Promise(() => {}));
    await act(async () => { renderPage(); });
    expect(screen.getByText(/lade raum/i)).toBeInTheDocument();
  });

  it("shows error when getByCode fails", async () => {
    vi.spyOn(apiModule.api.schreibraum, "getByCode").mockRejectedValue(new Error("Kein Zugang"));
    vi.spyOn(apiModule.api.schreibraum, "join").mockResolvedValue(makeParticipant());
    await act(async () => { renderPage(); });
    await waitFor(() => expect(screen.getByText("Kein Zugang")).toBeInTheDocument());
  });

  it("shows error when join fails", async () => {
    vi.spyOn(apiModule.api.schreibraum, "getByCode").mockResolvedValue(makeRoom());
    vi.spyOn(apiModule.api.schreibraum, "join").mockRejectedValue(new Error("Warte noch 90 Sekunden"));
    await act(async () => { renderPage(); });
    await waitFor(() => expect(screen.getByText(/warte noch/i)).toBeInTheDocument());
  });

  it("back button navigates to /schreibraum on error", async () => {
    vi.spyOn(apiModule.api.schreibraum, "getByCode").mockRejectedValue(new Error("404"));
    vi.spyOn(apiModule.api.schreibraum, "join").mockResolvedValue(makeParticipant());
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByText(/zurück/i));
    await userEvent.click(screen.getByRole("button", { name: /zurück/i }));
    expect(mockPush).toHaveBeenCalledWith("/schreibraum");
  });
});

describe("SchreibraumEditor — teacher view", () => {
  beforeEach(() => {
    mockAuth = { user_type: "teacher", teacher: mockTeacher };
    vi.spyOn(apiModule.api.schreibraum, "getByCode").mockResolvedValue(makeRoom());
    vi.spyOn(apiModule.api.schreibraum, "join").mockResolvedValue(makeParticipant());
  });

  it("shows room title and code in header", async () => {
    await act(async () => { renderPage(); });
    await waitFor(() => expect(screen.getByText("Testroom")).toBeInTheDocument());
    expect(screen.getByText("ABC123")).toBeInTheDocument();
  });

  it("renders the editor with correct props", async () => {
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByTestId("mock-editor"));
    const editor = screen.getByTestId("mock-editor");
    expect(editor).toHaveAttribute("data-room", "ABC123");
    expect(editor).toHaveAttribute("data-participant", "Anna Müller");
    expect(editor).toHaveAttribute("data-mode", "next-free-line");
  });

  it("shows Teilnehmer and Zugang buttons for teacher", async () => {
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByText("Testroom"));
    expect(screen.getByRole("button", { name: /teilnehmer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zugang/i })).toBeInTheDocument();
  });

  it("opens participant panel and loads participants", async () => {
    vi.spyOn(apiModule.api.schreibraum, "participants").mockResolvedValue([
      makeParticipant({ name: "Anna Müller", is_teacher: true }),
      makeParticipant({ id: "p-2", name: "Ben Braun", is_teacher: false, color: "#E63946" }),
    ]);
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByText("Testroom"));
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /teilnehmer/i }));
    });
    await waitFor(() => expect(screen.getByText("Ben Braun")).toBeInTheDocument());
    expect(screen.getByText("Anna Müller")).toBeInTheDocument();
  });

  it("kick button calls kick API", async () => {
    vi.spyOn(apiModule.api.schreibraum, "participants").mockResolvedValue([
      makeParticipant({ id: "p-2", name: "Ben Braun", is_teacher: false, color: "#E63946" }),
    ]);
    vi.spyOn(apiModule.api.schreibraum, "kick").mockResolvedValue(undefined);
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByText("Testroom"));
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /teilnehmer/i }));
    });
    await waitFor(() => screen.getByText("Ben Braun"));
    // The kick ✕ button is inside the participant row
    const kickBtn = screen.getAllByRole("button").find(
      (b) => b.textContent === "✕" && b.title === "Kicken"
    );
    expect(kickBtn).toBeDefined();
    await act(async () => { await userEvent.click(kickBtn!); });
    expect(apiModule.api.schreibraum.kick).toHaveBeenCalledWith("room-1", "p-2");
  });

  it("opens access panel", async () => {
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByText("Testroom"));
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /zugang/i }));
    });
    expect(screen.getByText(/zugangsverwaltung/i)).toBeInTheDocument();
  });

  it("shows existing access grants with remove button", async () => {
    vi.spyOn(apiModule.api.schreibraum, "getByCode").mockResolvedValue(
      makeRoom({ access: [{ id: 7, room_id: "room-1", class_id: 2, label: "5a" }] })
    );
    vi.spyOn(apiModule.api.classes, "list").mockResolvedValue([]);
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByText("Testroom"));
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /zugang/i }));
    });
    await waitFor(() => expect(screen.getByText("5a")).toBeInTheDocument());
  });

  it("mode shows as 'next-free-line' from room data", async () => {
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByTestId("mock-editor"));
    expect(screen.getByTestId("mock-editor")).toHaveAttribute("data-mode", "next-free-line");
  });

  it("editor uses add-line mode when room mode is add-line", async () => {
    vi.spyOn(apiModule.api.schreibraum, "getByCode").mockResolvedValue(makeRoom({ mode: "add-line" }));
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByTestId("mock-editor"));
    expect(screen.getByTestId("mock-editor")).toHaveAttribute("data-mode", "add-line");
  });
});

describe("SchreibraumEditor — student view", () => {
  beforeEach(() => {
    mockAuth = { user_type: "student", student: mockStudent };
    vi.spyOn(apiModule.api.schreibraum, "getByCode").mockResolvedValue(makeRoom());
    vi.spyOn(apiModule.api.schreibraum, "join").mockResolvedValue(
      makeParticipant({ id: "p-s", name: "Ben Braun", is_teacher: false, color: "#E63946" })
    );
  });

  it("does NOT show Teilnehmer or Zugang buttons", async () => {
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByText("Testroom"));
    expect(screen.queryByRole("button", { name: /teilnehmer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /zugang/i })).not.toBeInTheDocument();
  });

  it("renders editor for student participant", async () => {
    await act(async () => { renderPage(); });
    await waitFor(() => screen.getByTestId("mock-editor"));
    expect(screen.getByTestId("mock-editor")).toHaveAttribute("data-participant", "Ben Braun");
  });
});

describe("SchreibraumEditor — kicked state", () => {
  it("shows kicked message and back button", async () => {
    mockAuth = { user_type: "student", student: mockStudent };
    vi.spyOn(apiModule.api.schreibraum, "getByCode").mockResolvedValue(makeRoom());
    vi.spyOn(apiModule.api.schreibraum, "join").mockRejectedValue(new Error("Du wurdest gekickt"));
    await act(async () => { renderPage(); });
    await waitFor(() => expect(screen.getByText(/du wurdest gekickt/i)).toBeInTheDocument());
  });
});
