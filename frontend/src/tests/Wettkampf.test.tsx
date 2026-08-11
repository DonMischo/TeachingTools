import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as apiModule from "@/lib/api";
import WettkampfListPage from "@/app/tools/wettkampf/page";
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

let mockCan: (slug: string, cap: string) => boolean = () => true;
vi.mock("@/hooks/useAvailability", () => ({
  useAvailability: () => ({ can: (s: string, c: string) => mockCan(s, c), ready: true }),
}));

const makeWettkampf = (o: Partial<apiModule.WettkampfOut> = {}): apiModule.WettkampfOut => ({
  id: 1, title: "Schachturnier", description: null, type: "knockout", status: "draft",
  max_points: 100, trostpreis_points: 0, rewarded_places: null, scoring_system: "",
  win_points: 3, draw_points: 1, loss_points: 0, ranking_mode: "overall",
  created_at: "2026-01-01T10:00:00Z", stages: [], participants: [], ...o,
});

beforeEach(() => {
  vi.restoreAllMocks();
  mockPush.mockReset();
  mockAuth = { role: "teacher", user_type: "teacher", teacher: { id: 1 } };
  mockCan = () => true;
  vi.spyOn(apiModule.api.wettkampf, "list").mockResolvedValue([]);
});

describe("WettkampfListPage", () => {
  it("lists competitions", async () => {
    vi.spyOn(apiModule.api.wettkampf, "list").mockResolvedValue([makeWettkampf({ title: "Vorlesewettbewerb" })]);
    renderWithProviders(<WettkampfListPage />);
    await waitFor(() => expect(screen.getByText("Vorlesewettbewerb")).toBeInTheDocument());
  });

  it("shows the empty state when there are no competitions", async () => {
    renderWithProviders(<WettkampfListPage />);
    await waitFor(() => expect(screen.getByText(/noch keine wettkämpfe/i)).toBeInTheDocument());
  });

  it("shows the create button when create is allowed", () => {
    renderWithProviders(<WettkampfListPage />);
    expect(screen.getByRole("button", { name: /neuer wettkampf/i })).toBeInTheDocument();
  });

  it("hides the create button when create is denied by availability", () => {
    mockCan = () => false;
    renderWithProviders(<WettkampfListPage />);
    expect(screen.queryByRole("button", { name: /neuer wettkampf/i })).not.toBeInTheDocument();
  });

  it("navigates to the new-competition page on click", async () => {
    renderWithProviders(<WettkampfListPage />);
    await userEvent.click(screen.getByRole("button", { name: /neuer wettkampf/i }));
    expect(mockPush).toHaveBeenCalledWith("/tools/wettkampf/new");
  });
});
