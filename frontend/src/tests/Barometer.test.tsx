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

  it("shows the Vorlage select for a choice question and fills options from the Geschlecht preset", async () => {
    renderWithProviders(<BarometerPage />);
    await userEvent.click(screen.getByRole("button", { name: /neue umfrage/i }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /fragetyp/i }), "choice");
    expect(screen.getByRole("combobox", { name: /vorlage/i })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /vorlage/i }), "geschlecht");
    expect(screen.getByDisplayValue("männlich")).toBeInTheDocument();
    expect(screen.getByDisplayValue("weiblich")).toBeInTheDocument();
    expect(screen.getByDisplayValue("divers")).toBeInTheDocument();
    expect(screen.getByDisplayValue("keine Angabe")).toBeInTheDocument();
  });

  it("creates a self-mode session with a choice question and its options", async () => {
    const createSpy = vi.spyOn(apiModule.api.barometer, "create").mockResolvedValue({
      id: 1, code: "XYZ", title: "Test", status: "active", current_question_idx: 0,
      results_visible: false, shared: false, mode: "self", results_public: false, questions: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    renderWithProviders(<BarometerPage />);
    await userEvent.click(screen.getByRole("button", { name: /neue umfrage/i }));
    await userEvent.click(screen.getByRole("button", { name: /selbst ausfüllen/i }));
    await userEvent.type(screen.getByPlaceholderText(/titel der umfrage/i), "Test");
    await userEvent.type(screen.getByPlaceholderText(/^frage/i), "Welches Geschlecht?");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /fragetyp/i }), "choice");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /vorlage/i }), "geschlecht");
    await userEvent.click(screen.getByRole("button", { name: /^starten$/i }));
    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      mode: "self",
      questions: expect.arrayContaining([
        expect.objectContaining({
          kind: "choice",
          options: ["männlich", "weiblich", "divers", "keine Angabe"],
        }),
      ]),
    }));
  });

  it("creates a block with two statements sharing a block id, intro on the first, same_slide on the second", async () => {
    const createSpy = vi.spyOn(apiModule.api.barometer, "create").mockResolvedValue({
      id: 1, code: "BLK", title: "Test", status: "active", current_question_idx: 0,
      results_visible: false, shared: false, mode: "self", results_public: false, questions: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    renderWithProviders(<BarometerPage />);
    await userEvent.click(screen.getByRole("button", { name: /neue umfrage/i }));
    await userEvent.type(screen.getByPlaceholderText(/titel der umfrage/i), "Test");
    await userEvent.click(screen.getByRole("button", { name: /\+ aussagen-block/i }));
    await userEvent.type(
      screen.getByPlaceholderText(/überschrift, z\. b\./i),
      "Wie sehr stimmst du zu?"
    );
    await userEvent.type(screen.getByPlaceholderText("Aussage 1"), "Der Unterricht macht Spaß");
    await userEvent.type(screen.getByPlaceholderText("Aussage 2"), "Ich fühle mich wohl");
    await userEvent.click(screen.getByRole("button", { name: /^starten$/i }));
    await waitFor(() => expect(createSpy).toHaveBeenCalled());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = createSpy.mock.calls[0][0];
    const questions = body.questions;
    expect(questions).toHaveLength(2);
    expect(questions[0].kind).toBe("scale");
    expect(questions[1].kind).toBe("scale");
    expect(questions[0].block).toBeTruthy();
    expect(questions[0].block).toBe(questions[1].block);
    expect(questions[0].intro).toBe("Wie sehr stimmst du zu?");
    expect(questions[1].intro).toBeFalsy();
    expect(questions[1].same_slide).toBe(true);
  });

  it("sends show_if when a follow-up question's condition is enabled and configured", async () => {
    const createSpy = vi.spyOn(apiModule.api.barometer, "create").mockResolvedValue({
      id: 1, code: "COND", title: "Test", status: "active", current_question_idx: 0,
      results_visible: false, shared: false, mode: "self", results_public: false, questions: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    renderWithProviders(<BarometerPage />);
    await userEvent.click(screen.getByRole("button", { name: /neue umfrage/i }));
    await userEvent.type(screen.getByPlaceholderText(/titel der umfrage/i), "Test");

    // First question: choice with the "Ja / Nein" preset
    await userEvent.type(screen.getByPlaceholderText(/^frage/i), "Machst du im Sportverein mit?");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /fragetyp/i }), "choice");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /vorlage/i }), "ja-nein");

    // Second question: a follow-up text question
    await userEvent.click(screen.getByRole("button", { name: /\+ frage hinzufügen/i }));
    const kindSelects = screen.getAllByRole("combobox", { name: /fragetyp/i });
    await userEvent.selectOptions(kindSelects[1], "text");
    const questionTexts = screen.getAllByPlaceholderText(/^frage/i);
    await userEvent.type(questionTexts[1], "Welcher Verein?");

    // Enable the condition on the second card
    const conditionCheckboxes = screen.getAllByRole("checkbox", { name: /nur zeigen, wenn/i });
    await userEvent.click(conditionCheckboxes[conditionCheckboxes.length - 1]);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /bedingung frage/i }),
      screen.getByRole("option", { name: /frage 1/i })
    );

    const yesCheckboxes = screen.getAllByRole("checkbox", { name: "Ja" });
    await userEvent.click(yesCheckboxes[yesCheckboxes.length - 1]);

    await userEvent.click(screen.getByRole("button", { name: /^starten$/i }));
    await waitFor(() => expect(createSpy).toHaveBeenCalled());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = createSpy.mock.calls[0][0];
    expect(body.questions[1].show_if).toEqual({ question: 0, options: [0] });
  });
});
