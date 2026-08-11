import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as apiModule from "@/lib/api";
import BarometerPage from "@/app/tools/barometer/page";
import { renderWithProviders } from "./helpers";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockAuth: any = null;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: mockAuth }),
}));

// Gating is deterministic via the hook mock; toggle mockCan per test.
let mockCan: (slug: string, cap: string) => boolean = () => true;
vi.mock("@/hooks/useAvailability", () => ({
  useAvailability: () => ({ can: (s: string, c: string) => mockCan(s, c), ready: true }),
}));

const makeSession = (o: Partial<apiModule.BarometerSessionSummary> = {}): apiModule.BarometerSessionSummary => ({
  id: 1, code: "ABC", title: "Stimmung", status: "active", question_count: 3,
  created_at: "2026-01-01T10:00:00Z", shared: false, created_by: 1, created_by_name: "Anna Müller", ...o,
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockPush.mockReset();
  mockAuth = { role: "teacher", user_type: "teacher", teacher: { id: 1 } };
  mockCan = () => true;
  vi.spyOn(apiModule.api.barometer, "list").mockResolvedValue([]);
});

describe("BarometerPage", () => {
  it("shows a teacher-only notice for students", () => {
    mockAuth = { role: "student", user_type: "student" };
    renderWithProviders(<BarometerPage />);
    expect(screen.getByText(/nur für lehrkräfte/i)).toBeInTheDocument();
  });

  it("lists existing surveys", async () => {
    vi.spyOn(apiModule.api.barometer, "list").mockResolvedValue([makeSession({ title: "Wochenfeedback" })]);
    renderWithProviders(<BarometerPage />);
    await waitFor(() => expect(screen.getByText("Wochenfeedback")).toBeInTheDocument());
  });

  it("shows the create button when host is allowed", () => {
    renderWithProviders(<BarometerPage />);
    expect(screen.getByRole("button", { name: /neue umfrage/i })).toBeInTheDocument();
  });

  it("hides the create button when host is denied by availability", () => {
    mockCan = () => false;
    renderWithProviders(<BarometerPage />);
    expect(screen.queryByRole("button", { name: /neue umfrage/i })).not.toBeInTheDocument();
  });

  it("opens the create form when the button is clicked", async () => {
    renderWithProviders(<BarometerPage />);
    await userEvent.click(screen.getByRole("button", { name: /neue umfrage/i }));
    expect(screen.getByPlaceholderText(/titel der umfrage/i)).toBeInTheDocument();
  });
});
