import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as apiModule from "@/lib/api";
import SchreibraumListPage from "@/app/schreibraum/page";
import { makeTeacher } from "./helpers";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/schreibraum",
}));

const mockTeacher = makeTeacher();
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

beforeEach(() => {
  vi.restoreAllMocks();
  mockAuth = null;
  mockPush.mockReset();
});

// Helper: render and wait until loading spinner gone
async function renderAndWait() {
  render(<SchreibraumListPage />);
  // Wait until "Laden…" disappears (loading: false) or auth gate shows
  await waitFor(() => expect(screen.queryByText("Laden…")).not.toBeInTheDocument(), { timeout: 3000 });
}

describe("SchreibraumList — auth gate", () => {
  it("shows login hint when not authenticated", async () => {
    render(<SchreibraumListPage />);
    expect(screen.getByText(/bitte anmelden/i)).toBeInTheDocument();
  });
});

describe("SchreibraumList — teacher view", () => {
  beforeEach(() => {
    mockAuth = { user_type: "teacher", teacher: mockTeacher };
  });

  it("loads and displays rooms", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([makeRoom()]);
    await renderAndWait();
    await waitFor(() => expect(screen.getByText("Testroom")).toBeInTheDocument());
    expect(screen.getByText("ABC123")).toBeInTheDocument();
  });

  it("shows 'Neuer Raum' button for teacher", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([]);
    await renderAndWait();
    expect(screen.getByRole("button", { name: /neuer raum/i })).toBeInTheDocument();
  });

  it("shows delete button for own rooms", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([makeRoom({ created_by: 1 })]);
    await renderAndWait();
    await waitFor(() => screen.getByText("Testroom"));
    expect(screen.getByRole("button", { name: "✕" })).toBeInTheDocument();
  });

  it("hides delete button for other teachers' rooms", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([makeRoom({ created_by: 99 })]);
    await renderAndWait();
    await waitFor(() => screen.getByText("Testroom"));
    expect(screen.queryByRole("button", { name: "✕" })).not.toBeInTheDocument();
  });

  it("shows create form when button is clicked", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([]);
    await renderAndWait();
    await userEvent.click(screen.getByRole("button", { name: /neuer raum/i }));
    expect(screen.getByPlaceholderText(/titel/i)).toBeInTheDocument();
  });

  it("calls create API and navigates on form submit", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([]);
    vi.spyOn(apiModule.api.schreibraum, "create").mockResolvedValue(makeRoom({ code: "XYZ999" }));
    await renderAndWait();
    await userEvent.click(screen.getByRole("button", { name: /neuer raum/i }));
    await userEvent.type(screen.getByPlaceholderText(/titel/i), "Mein Raum");
    await userEvent.click(screen.getByRole("button", { name: /^erstellen$/i }));
    await waitFor(() => expect(apiModule.api.schreibraum.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Mein Raum" })
    ));
    expect(mockPush).toHaveBeenCalledWith("/schreibraum/XYZ999");
  });

  it("calls delete API when delete button clicked and confirmed", async () => {
    vi.stubGlobal("confirm", () => true);
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([makeRoom()]);
    vi.spyOn(apiModule.api.schreibraum, "delete").mockResolvedValue(undefined);
    await renderAndWait();
    await waitFor(() => screen.getByText("Testroom"));
    await userEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(apiModule.api.schreibraum.delete).toHaveBeenCalledWith("room-1");
    await waitFor(() => expect(screen.queryByText("Testroom")).not.toBeInTheDocument());
  });

  it("shows empty state message when no rooms exist", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([]);
    await renderAndWait();
    await waitFor(() =>
      expect(screen.getByText(/erstelle deinen ersten raum/i)).toBeInTheDocument()
    );
  });

  it("shows mode label for add-line rooms", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([makeRoom({ mode: "add-line" })]);
    await renderAndWait();
    await waitFor(() => expect(screen.getByText(/zeile hinzufügen/i)).toBeInTheDocument());
  });

  it("shows temporary badge for non-permanent rooms", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([makeRoom({ is_permanent: false })]);
    await renderAndWait();
    await waitFor(() => expect(screen.getByText(/temporär/i)).toBeInTheDocument());
  });
});

describe("SchreibraumList — student view", () => {
  beforeEach(() => {
    mockAuth = { user_type: "student", student: mockStudent };
  });

  it("does NOT show 'Neuer Raum' button for students", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([]);
    await renderAndWait();
    expect(screen.queryByRole("button", { name: /neuer raum/i })).not.toBeInTheDocument();
  });

  it("shows empty state for students with no access", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([]);
    await renderAndWait();
    await waitFor(() =>
      expect(screen.getByText(/keinen zugang/i)).toBeInTheDocument()
    );
  });

  it("shows rooms the student has access to", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockResolvedValue([makeRoom({ title: "Schüler-Raum" })]);
    await renderAndWait();
    await waitFor(() => expect(screen.getByText("Schüler-Raum")).toBeInTheDocument());
  });
});

describe("SchreibraumList — error handling", () => {
  beforeEach(() => {
    mockAuth = { user_type: "teacher", teacher: mockTeacher };
  });

  it("shows error message when API fails", async () => {
    vi.spyOn(apiModule.api.schreibraum, "list").mockRejectedValue(new Error("Netzwerkfehler"));
    await renderAndWait();
    await waitFor(() => expect(screen.getByText("Netzwerkfehler")).toBeInTheDocument());
  });
});
