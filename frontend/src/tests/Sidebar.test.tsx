import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import * as apiModule from "@/lib/api";
import { makeTeacher } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const mockTeacher = makeTeacher();

const mockStudent: apiModule.StudentOut = {
  id: 1,
  nummer: null,
  nachname: "Schmidt",
  vorname: "Ben",
  display_name: "Ben S.",
  klasse: "5a",
  class_id: 1,
  jahrgang: 5,
  geschlecht: "m",
  geburtsdatum: null,
  username: "ben",
  active: true,
  alias: null,
  nta: [],
  has_credentials: true,
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

/** Ohne Anmeldung steht statt der Leiste nur dieser Knopf in der Ecke. */
function anmeldeKnopf() {
  return screen.getByRole("button", { name: /anmelden/i });
}

/** Angemeldet als Lehrkraft — sonst gibt es gar keine Leiste zu prüfen. */
function alsLehrkraft() {
  vi.spyOn(apiModule.api.auth, "me").mockResolvedValue({
    user_type: "teacher",
    teacher: mockTeacher,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(apiModule.api.auth, "me").mockRejectedValue(new Error("401"));
  vi.spyOn(apiModule.api.auth, "logout").mockResolvedValue(undefined);
});

describe("Sidebar — navigation", () => {
  it("shows nav links", async () => {
    alsLehrkraft();
    await act(async () => { renderSidebar(); });
    await waitFor(() => expect(screen.getByTitle("News")).toBeInTheDocument());
    expect(screen.getByTitle("Aktivitäten")).toBeInTheDocument();
    expect(screen.getByTitle("Tools")).toBeInTheDocument();
  });

  it("führt die Erfolge als eigenen Eintrag", async () => {
    alsLehrkraft();
    await act(async () => { renderSidebar(); });
    await waitFor(() => expect(screen.getByTitle("Erfolge")).toBeInTheDocument());
    expect(screen.getByTitle("Erfolge").closest("a")).toHaveAttribute("href", "/erfolge");
  });

  it("hides admin link when not logged in as admin", async () => {
    alsLehrkraft();
    await act(async () => { renderSidebar(); });
    await waitFor(() => expect(screen.getByTitle("Aktivitäten")).toBeInTheDocument());
    expect(screen.queryByTitle("Admin")).not.toBeInTheDocument();
  });

  it("zeigt Gästen gar keine Leiste, nur den Anmelde-Knopf", async () => {
    // Jeder Eintrag führte einen Gast ohnehin nur an die Anmeldung, und der
    // Flurbildschirm soll die Slideshow zeigen statt einer Navigation, die
    // niemand bedienen kann.
    await act(async () => { renderSidebar(); });
    await waitFor(() => expect(anmeldeKnopf()).toBeInTheDocument());
    expect(screen.queryByTitle("News")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Aktivitäten")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Tools")).not.toBeInTheDocument();
  });

  it("shows admin link for admin users", async () => {
    vi.spyOn(apiModule.api.auth, "me").mockResolvedValue({
      user_type: "teacher",
      teacher: { ...mockTeacher, role: "admin" },
    });
    // Der Admin-Status kommt seit den Nutzungsrechten aus /admin-access/me,
    // nicht mehr aus teacher.role — ohne diese Antwort bleibt das Icon aus.
    vi.spyOn(apiModule.api.adminAccess, "me").mockResolvedValue({ is_admin: true, features: [] });
    await act(async () => { renderSidebar(); });
    await waitFor(() => expect(screen.getByTitle("Admin")).toBeInTheDocument());
  });

  it("shows admin link for a teacher granted a single admin feature", async () => {
    vi.spyOn(apiModule.api.auth, "me").mockResolvedValue({
      user_type: "teacher",
      teacher: mockTeacher,
    });
    vi.spyOn(apiModule.api.adminAccess, "me").mockResolvedValue({
      is_admin: false, features: ["klassen"],
    });
    await act(async () => { renderSidebar(); });
    await waitFor(() => expect(screen.getByTitle("Admin")).toBeInTheDocument());
  });

  it("hides admin link from a teacher without any admin feature", async () => {
    vi.spyOn(apiModule.api.auth, "me").mockResolvedValue({
      user_type: "teacher",
      teacher: mockTeacher,
    });
    vi.spyOn(apiModule.api.adminAccess, "me").mockResolvedValue({ is_admin: false, features: [] });
    await act(async () => { renderSidebar(); });
    await waitFor(() => expect(screen.getByTitle(/Anna Müller/i)).toBeInTheDocument());
    expect(screen.queryByTitle("Admin")).not.toBeInTheDocument();
  });

  it("hides Tools link for students", async () => {
    vi.spyOn(apiModule.api.auth, "me").mockResolvedValue({
      user_type: "student",
      student: mockStudent,
    });
    await act(async () => { renderSidebar(); });
    await waitFor(() => expect(screen.getByTitle(/Ben Schmidt/i)).toBeInTheDocument());
    expect(screen.getByTitle("Aktivitäten")).toBeInTheDocument();
    expect(screen.queryByTitle("Tools")).not.toBeInTheDocument();
  });
});

describe("Sidebar — login flyout", () => {
  it("opens login form when key button is clicked", async () => {
    await act(async () => { renderSidebar(); });
    await userEvent.click(anmeldeKnopf());
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
    await userEvent.click(anmeldeKnopf());
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
    await userEvent.click(anmeldeKnopf());
    await userEvent.type(screen.getByPlaceholderText(/benutzername/i), "nobody");
    await userEvent.type(screen.getByPlaceholderText(/passwort/i), "wrong");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /einloggen/i }));
    });
    await waitFor(() => expect(screen.getByText(/fehlgeschlagen/i)).toBeInTheDocument());
  });

  it("logs out and clears session", async () => {
    alsLehrkraft();
    await act(async () => { renderSidebar(); });
    // Open login flyout (shows user icon when logged in)
    const userBtn = await screen.findByTitle(/Anna Müller/i);
    await userEvent.click(userBtn);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /logout/i }));
    });
    // Nach dem Abmelden bleibt vom Sidebar nur der Knopf in der Ecke.
    await waitFor(() => expect(anmeldeKnopf()).toBeInTheDocument());
    expect(screen.queryByTitle("Aktivitäten")).not.toBeInTheDocument();
  });
});
