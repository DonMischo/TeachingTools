/**
 * Die Uhr-Folie der Startseiten-Slideshow zeigt die A/B-Woche.
 *
 * Gewünscht war ausdrücklich dieselbe Angabe wie am Rand des Kalenders. Beide
 * fragen deshalb `lib/schoolyear` — dieser Test hält fest, dass die Zahl auf
 * dem Flurbildschirm wirklich ankommt, und `schoolyear.test.ts` hält fest, dass
 * sie stimmt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import { api } from "@/lib/api";
import { StartSlideshow } from "@/components/StartSlideshow";
import { abWoche, isoWoche } from "@/lib/schoolyear";
import type { SlideshowItem } from "@/lib/slideshow";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: null }) }));

const uhr: SlideshowItem = {
  id: 99, position: 0, kind: "clock", title: "Uhr", active: true, audience: "guest",
  duration_seconds: 3, media_type: null, file_url: null, original_filename: null, url: null,
  calendar_tags: [], calendar_categories: [], calendar_days_ahead: 14,
  slot_days: [], slot_start: null, slot_end: null, slot_from: null, slot_until: null,
  warnings: [], events: [], wochenspruch: null,
};

describe("Startseiten-Slideshow: Uhr", () => {
  beforeEach(() => vi.spyOn(api.slideshow, "public").mockResolvedValue([uhr]));
  afterEach(() => vi.restoreAllMocks());

  it("schreibt Kalenderwoche und A/B-Woche unter die Uhrzeit", async () => {
    renderWithProviders(<StartSlideshow />);
    const kw = isoWoche(new Date());

    const zeile = await screen.findByTestId("ab-woche");
    expect(zeile).toHaveTextContent(`KW ${kw}`);
    expect(zeile).toHaveTextContent(`${abWoche(kw)}-Woche`);
  });

  it("zeigt die Uhrzeit", async () => {
    renderWithProviders(<StartSlideshow />);
    await waitFor(() => expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument());
  });
});
