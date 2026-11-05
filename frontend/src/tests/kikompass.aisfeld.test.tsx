import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const einstellungen = vi.fn();
vi.mock("@/lib/api", () => ({ api: { toolSessions: { einstellungen: (...a: unknown[]) => einstellungen(...a) } } }));

import { StationAnsicht } from "@/components/kikompass/StationAnsicht";
import { STATIONEN } from "@/lib/kikompass/stationen";

const LINK = "https://chat.example.org/lernumgebung/xyz";
const SITZUNG = { code: "ABC123", tool_slug: "kikompass", allow_guests: false, status: "open", ref_id: null, ref_title: null, settings: { andere: 1 } as Record<string, unknown> };
const station = STATIONEN.find(s => s.id === "r-ki-irrt")!;

function zeige(props: Partial<Parameters<typeof StationAnsicht>[0]> = {}) {
  render(<StationAnsicht station={station} stand={undefined} onChange={() => {}} onZurueck={() => {}} {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /AIS\.chat/ }));
}

describe("AIS.chat-Link direkt in der Station teilen", () => {
  beforeEach(() => einstellungen.mockReset());

  it("Lehrkraft teilt den Link für alle Stationen, andere Einstellungen bleiben", async () => {
    const onSitzung = vi.fn();
    einstellungen.mockImplementation(async (_code: string, settings: Record<string, unknown>) => ({ ...SITZUNG, settings }));
    zeige({ lehrkraft: true, sitzung: SITZUNG, onSitzung });
    fireEvent.change(screen.getByLabelText("AIS.chat-Link"), { target: { value: LINK } });
    fireEvent.click(screen.getByRole("button", { name: "Teilen" }));
    await waitFor(() => expect(einstellungen).toHaveBeenCalledWith("ABC123", {
      andere: 1, ais: { standard: LINK, stationen: {}, anzeige: "beides" },
    }));
    expect(onSitzung).toHaveBeenCalled();
  });

  it("»nur für diese Station« speichert einen Stationslink", async () => {
    einstellungen.mockImplementation(async (_c: string, settings: Record<string, unknown>) => ({ ...SITZUNG, settings }));
    zeige({ lehrkraft: true, sitzung: SITZUNG, onSitzung: () => {} });
    fireEvent.change(screen.getByLabelText("AIS.chat-Link"), { target: { value: LINK } });
    fireEvent.click(screen.getByLabelText("nur für diese Station"));
    fireEvent.click(screen.getByRole("button", { name: "Teilen" }));
    await waitFor(() => expect(einstellungen).toHaveBeenCalledWith("ABC123", expect.objectContaining({
      ais: { standard: null, stationen: { "r-ki-irrt": LINK }, anzeige: "beides" },
    })));
  });

  it("ungültiger Link lässt sich nicht teilen", () => {
    zeige({ lehrkraft: true, sitzung: SITZUNG, onSitzung: () => {} });
    fireEvent.change(screen.getByLabelText("AIS.chat-Link"), { target: { value: "javascript:alert(1)" } });
    expect(screen.getByRole("button", { name: "Teilen" })).toBeDisabled();
  });

  it("Lernende sehen kein Eingabefeld", () => {
    zeige({ sitzung: SITZUNG, onSitzung: () => {} });
    expect(screen.queryByLabelText("AIS.chat-Link")).toBeNull();
  });
});

describe("Link wieder entfernen", () => {
  beforeEach(() => einstellungen.mockReset());

  it("entfernt den Link für alle Stationen", async () => {
    einstellungen.mockImplementation(async (_c: string, settings: Record<string, unknown>) => ({ ...SITZUNG, settings }));
    const mitLink = { ...SITZUNG, settings: { ais: { standard: LINK, stationen: {}, anzeige: "beides" } } };
    zeige({ lehrkraft: true, sitzung: mitLink, onSitzung: () => {} });
    fireEvent.click(screen.getByRole("button", { name: /Link ändern/ }));
    fireEvent.click(screen.getByRole("button", { name: /Link für alle entfernen/ }));
    await waitFor(() => expect(einstellungen).toHaveBeenCalledWith("ABC123", {
      ais: { standard: null, stationen: {}, anzeige: "beides" },
    }));
  });
});
