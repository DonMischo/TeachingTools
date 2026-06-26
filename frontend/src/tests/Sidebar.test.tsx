import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import * as apiModule from "@/lib/api";

const mockClass: apiModule.ClassOut = {
  id: 3,
  code: "5A",
  display_name: "Klasse 5A",
  symbol_emoji: "🐉",
  symbol_image: null,
  total_points: 10,
};

const mockTeacher: apiModule.TeacherOut = {
  id: 1,
  first_name: "Anna",
  last_name: "Müller",
  active: true,
  role: "teacher",
};

function renderSidebar(selectedClass: apiModule.ClassOut | null = mockClass) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(apiModule.api.teachers, "list").mockResolvedValue([mockTeacher]);
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Sidebar selectedClass={selectedClass} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function seedAuth(teacher = mockTeacher) {
  localStorage.setItem("hp_token", "test-token");
  localStorage.setItem("hp_teacher", JSON.stringify(teacher));
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Sidebar — unauthenticated", () => {
  it("shows a login form when no session exists", () => {
    renderSidebar();
    expect(screen.getByPlaceholderText(/vor-/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /einloggen/i })).toBeInTheDocument();
  });

  it("calls the auth API when the login form is submitted", async () => {
    const loginSpy = vi.spyOn(apiModule.api.auth, "login").mockResolvedValue({
      access_token: "tok",
      token_type: "bearer",
      teacher: mockTeacher,
    });
    renderSidebar();

    await userEvent.type(screen.getByPlaceholderText(/vor-/i), "Anna Müller");
    await userEvent.type(screen.getByPlaceholderText(/passwort/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /einloggen/i }));

    await waitFor(() => expect(loginSpy).toHaveBeenCalledWith("Anna Müller", "secret"));
  });

  it("shows an error when login fails", async () => {
    vi.spyOn(apiModule.api.auth, "login").mockRejectedValue(new Error("Unauthorized"));
    renderSidebar();

    await userEvent.type(screen.getByPlaceholderText(/vor-/i), "nobody");
    await userEvent.type(screen.getByPlaceholderText(/passwort/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /einloggen/i }));

    await waitFor(() => expect(screen.getByText(/fehlgeschlagen/i)).toBeInTheDocument());
  });
});

describe("Sidebar — authenticated", () => {
  it("shows the teacher name and a logout button when logged in", () => {
    seedAuth();
    renderSidebar();
    expect(screen.getByText(/Anna Müller/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("creates a positive transaction when the + button is clicked", async () => {
    seedAuth();
    const createSpy = vi.spyOn(apiModule.api.transactions, "create").mockResolvedValue({
      id: 1,
      ts: new Date().toISOString(),
      points: 5,
      reason: "",
      class_code: "5A",
      teacher_name: "Anna Müller",
    });
    renderSidebar();

    await userEvent.click(screen.getByRole("button", { name: /vergeben/i }));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ points: 5, class_id: 3 })
      )
    );
  });

  it("creates a negative transaction when the − button is clicked", async () => {
    seedAuth();
    const createSpy = vi.spyOn(apiModule.api.transactions, "create").mockResolvedValue({
      id: 2,
      ts: new Date().toISOString(),
      points: -5,
      reason: "",
      class_code: "5A",
      teacher_name: "Anna Müller",
    });
    renderSidebar();

    await userEvent.click(screen.getByRole("button", { name: /abziehen/i }));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ points: -5, class_id: 3 })
      )
    );
  });

  it("shows success feedback after a transaction is created", async () => {
    seedAuth();
    vi.spyOn(apiModule.api.transactions, "create").mockResolvedValue({
      id: 1,
      ts: new Date().toISOString(),
      points: 5,
      reason: "",
      class_code: "5A",
      teacher_name: "Anna Müller",
    });
    renderSidebar();

    await userEvent.click(screen.getByRole("button", { name: /vergeben/i }));

    await waitFor(() => expect(screen.getByText(/punkte für 5A/i)).toBeInTheDocument());
  });

  it("shows an error message when the API call fails", async () => {
    seedAuth();
    vi.spyOn(apiModule.api.transactions, "create").mockRejectedValue(new Error("Server error"));
    renderSidebar();

    await userEvent.click(screen.getByRole("button", { name: /vergeben/i }));

    await waitFor(() => expect(screen.getByText(/server error/i)).toBeInTheDocument());
  });

  it("does not submit when no class is selected", async () => {
    seedAuth();
    const createSpy = vi.spyOn(apiModule.api.transactions, "create");
    renderSidebar(null);

    await userEvent.click(screen.getByRole("button", { name: /vergeben/i }));

    expect(createSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/keine klasse/i)).toBeInTheDocument();
  });

  it("logs out and returns to the login form", async () => {
    seedAuth();
    renderSidebar();

    await userEvent.click(screen.getByRole("button", { name: /logout/i }));

    expect(screen.getByRole("button", { name: /einloggen/i })).toBeInTheDocument();
  });

  it("does not show the teacher selector for non-admin users", () => {
    seedAuth({ ...mockTeacher, role: "teacher" });
    renderSidebar();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows the teacher selector for admin users", async () => {
    seedAuth({ ...mockTeacher, role: "admin" });
    renderSidebar();
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
  });
});
