import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import * as apiModule from "@/lib/api";

// Component that exposes auth state to the test
function AuthDisplay() {
  const { auth, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{auth ? `logged-in:${auth.teacher.last_name}` : "logged-out"}</p>
      <button onClick={() => login("Anna Müller", "secret")}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

const mockTeacher = { id: 1, first_name: "Anna", last_name: "Müller", active: true, role: "teacher" };

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("AuthContext", () => {
  it("starts in a logged-out state when no token is stored", () => {
    render(<AuthProvider><AuthDisplay /></AuthProvider>);
    expect(screen.getByTestId("status")).toHaveTextContent("logged-out");
  });

  it("becomes logged in after a successful login call", async () => {
    vi.spyOn(apiModule.api.auth, "login").mockResolvedValue({
      access_token: "tok123",
      token_type: "bearer",
      teacher: mockTeacher,
    });

    render(<AuthProvider><AuthDisplay /></AuthProvider>);
    await userEvent.click(screen.getByText("login"));

    expect(screen.getByTestId("status")).toHaveTextContent("logged-in:Müller");
  });

  it("persists the token to localStorage on login", async () => {
    vi.spyOn(apiModule.api.auth, "login").mockResolvedValue({
      access_token: "tok123",
      token_type: "bearer",
      teacher: mockTeacher,
    });

    render(<AuthProvider><AuthDisplay /></AuthProvider>);
    await userEvent.click(screen.getByText("login"));

    expect(localStorage.getItem("hp_token")).toBe("tok123");
  });

  it("returns to logged-out state after logout", async () => {
    vi.spyOn(apiModule.api.auth, "login").mockResolvedValue({
      access_token: "tok123",
      token_type: "bearer",
      teacher: mockTeacher,
    });

    render(<AuthProvider><AuthDisplay /></AuthProvider>);
    await userEvent.click(screen.getByText("login"));
    await userEvent.click(screen.getByText("logout"));

    expect(screen.getByTestId("status")).toHaveTextContent("logged-out");
  });

  it("clears localStorage on logout", async () => {
    vi.spyOn(apiModule.api.auth, "login").mockResolvedValue({
      access_token: "tok123",
      token_type: "bearer",
      teacher: mockTeacher,
    });

    render(<AuthProvider><AuthDisplay /></AuthProvider>);
    await userEvent.click(screen.getByText("login"));
    await userEvent.click(screen.getByText("logout"));

    expect(localStorage.getItem("hp_token")).toBeNull();
  });

  it("restores session from localStorage on mount", () => {
    localStorage.setItem("hp_token", "existing_tok");
    localStorage.setItem("hp_teacher", JSON.stringify(mockTeacher));

    render(<AuthProvider><AuthDisplay /></AuthProvider>);

    expect(screen.getByTestId("status")).toHaveTextContent("logged-in:Müller");
  });
});
