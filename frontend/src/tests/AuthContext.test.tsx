import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import * as apiModule from "@/lib/api";
import { makeTeacher } from "./helpers";

function AuthDisplay() {
  const { auth, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{auth ? `logged-in:${auth.teacher?.last_name ?? auth.student?.nachname}` : "logged-out"}</p>
      <p data-testid="role">{auth?.role ?? "none"}</p>
      <button onClick={() => login("Anna Müller", "secret")}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

const mockTeacher = makeTeacher();
const mockMeTeacher = { user_type: "teacher" as const, teacher: mockTeacher };

beforeEach(() => {
  vi.restoreAllMocks();
  // Default: /me returns 401 (not logged in)
  vi.spyOn(apiModule.api.auth, "me").mockRejectedValue(new Error("401"));
  vi.spyOn(apiModule.api.auth, "logout").mockResolvedValue(undefined);
});

describe("AuthContext", () => {
  it("starts in a logged-out state when /me fails", async () => {
    await act(async () => {
      render(<AuthProvider><AuthDisplay /></AuthProvider>);
    });
    expect(screen.getByTestId("status")).toHaveTextContent("logged-out");
  });

  it("becomes logged in after a successful login + /me", async () => {
    vi.spyOn(apiModule.api.auth, "login").mockResolvedValue({
      access_token: "tok123",
      token_type: "bearer",
      teacher: mockTeacher,
    });
    vi.spyOn(apiModule.api.auth, "me").mockResolvedValue(mockMeTeacher);

    await act(async () => { render(<AuthProvider><AuthDisplay /></AuthProvider>); });
    await act(async () => { await userEvent.click(screen.getByText("login")); });

    expect(screen.getByTestId("status")).toHaveTextContent("logged-in:Müller");
    expect(screen.getByTestId("role")).toHaveTextContent("teacher");
  });

  it("restores session from /me on mount", async () => {
    vi.spyOn(apiModule.api.auth, "me").mockResolvedValue(mockMeTeacher);

    await act(async () => { render(<AuthProvider><AuthDisplay /></AuthProvider>); });

    expect(screen.getByTestId("status")).toHaveTextContent("logged-in:Müller");
  });

  it("returns to logged-out state after logout", async () => {
    vi.spyOn(apiModule.api.auth, "login").mockResolvedValue({
      access_token: "tok123",
      token_type: "bearer",
      teacher: mockTeacher,
    });
    vi.spyOn(apiModule.api.auth, "me")
      .mockResolvedValueOnce(mockMeTeacher)  // mount
      .mockResolvedValueOnce(mockMeTeacher); // after login

    await act(async () => { render(<AuthProvider><AuthDisplay /></AuthProvider>); });
    await act(async () => { await userEvent.click(screen.getByText("login")); });
    await act(async () => { await userEvent.click(screen.getByText("logout")); });

    expect(screen.getByTestId("status")).toHaveTextContent("logged-out");
  });
});
