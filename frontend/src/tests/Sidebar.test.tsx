import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import * as apiModule from "@/lib/api";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const mockTeacher: apiModule.TeacherOut = {
  id: 1,
  first_name: "Anna",
  last_name: "Müller",
  active: true,
  role: "teacher",
};

function renderSidebar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Sidebar />
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(apiModule.api.auth, "me").mockRejectedValue(new Error("401"));
  vi.spyOn(apiModule.api.auth, "logout").mockResolvedValue(undefined);
});

describe("Sidebar — navigation", () => {
  it("shows nav links", async () => {
    await act(async () => { renderSidebar(); });
    expect(screen.getByTitle("Hauspokal")).toBeInTheDocument();
    expect(screen.getByTitle("Klassen")).toBeInTheDocument();
  });

  it("hides admin link when not logged in as admin", async () => {
    await act(async () => { renderSidebar(); });
    expect(screen.queryByTitle("Admin")).not.toBeInTheDocument();
  });

  it("shows admin link for admin users", async () => {
    vi.spyOn(apiModule.api.auth, "me").mockResolvedValue({
      user_type: "teacher",
      teacher: { ...mockTeacher, role: "admin" },
    });
    await act(async () => { renderSidebar(); });
    expect(screen.getByTitle("Admin")).toBeInTheDocument();
  });
});

describe("Sidebar — login flyout", () => {
  it("opens login form when key button is clicked", async () => {
    await act(async () => { renderSidebar(); });
    await userEvent.click(screen.getByTitle("Login"));
    expect(screen.getByPlaceholderText(/benutzername/i)).toBeInTheDocument();
  });

  it("calls login API and shows teacher name on success", async () => {
    vi.spyOn(apiModule.api.auth, "login").mockResolvedValue({
      access_token: "tok",
      token_type: "bearer",
      teacher: mockTeacher,
    });
    vi.spyOn(apiModule.api.auth, "me")
      .mockRejectedValueOnce(new Error("401"))  // on mount: not logged in
      .mockResolvedValueOnce({ user_type: "teacher", teacher: mockTeacher }); // after login

    await act(async () => { renderSidebar(); });
    await userEvent.click(screen.getByTitle("Login"));
    await userEvent.type(screen.getByPlaceholderText(/benutzername/i), "anna");
    await userEvent.type(screen.getByPlaceholderText(/passwort/i), "secret");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /einloggen/i }));
    });

    await waitFor(() => expect(screen.getByTitle(/Anna Müller/i)).toBeInTheDocument());
  });

  it("shows error when login fails", async () => {
    vi.spyOn(apiModule.api.auth, "login").mockRejectedValue(new Error("Unauthorized"));
    await act(async () => { renderSidebar(); });
    await userEvent.click(screen.getByTitle("Login"));
    await userEvent.type(screen.getByPlaceholderText(/benutzername/i), "nobody");
    await userEvent.type(screen.getByPlaceholderText(/passwort/i), "wrong");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /einloggen/i }));
    });
    await waitFor(() => expect(screen.getByText(/fehlgeschlagen/i)).toBeInTheDocument());
  });

  it("logs out and clears session", async () => {
    vi.spyOn(apiModule.api.auth, "me").mockResolvedValue({
      user_type: "teacher",
      teacher: mockTeacher,
    });
    await act(async () => { renderSidebar(); });
    // Open login flyout (shows user icon when logged in)
    const userBtn = screen.getByTitle(/Anna Müller/i);
    await userEvent.click(userBtn);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /logout/i }));
    });
    await waitFor(() => expect(screen.getByTitle("Login")).toBeInTheDocument());
  });
});
