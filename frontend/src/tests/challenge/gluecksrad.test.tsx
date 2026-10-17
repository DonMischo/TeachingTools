import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { themeVon } from "@/lib/challenge/themes";
import Modus from "@/components/challenge/modi/Gluecksrad";
import { verteile } from "@/lib/challenge/gluecksrad";

const WORT = "Lass Anna lesen";
const brett = {
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "gluecksrad", deck: null,
  etappen: [{ nr: 1, titel: WORT, erledigt: false }],
  challenges: [
    { id: "c1", text: "Erste Frage?", image: null, formula: null, strength: 1, erledigt: false },
    { id: "c2", text: "Zweite Frage?", image: null, formula: null, strength: 1, erledigt: false },
  ],
  fakten: [
    { id: "f1", text: "Fakt Eins", image: null, formula: null, info: null },
    { id: "f2", text: "Fakt Zwei", image: null, formula: null, info: null },
  ],
};
const antwort = (extra = {}) => ({
  qualitaet: 0, treffer: false, komplett: false, kombo: false, schaden: 0, falsch_gewaehlt: 1,
  leben: 2, zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 2, ...extra,
});
const richtig = antwort({ qualitaet: 1, treffer: true, komplett: true, falsch_gewaehlt: 0, leben: 3 });

const baue = (b: typeof brett = brett) => {
  const lauf = { waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(richtig), deckSetzen: vi.fn(), spielWechseln: vi.fn(), spielwert: vi.fn(), hatBestenliste: false };
  const r = render(<Modus brett={b as never} theme={themeVon("wald")} skin="monster" lauf={lauf as never} zurKarte={() => {}} />);
  return { lauf, u: userEvent.setup(), ...r };
};
const verdeckt = () => screen.queryAllByLabelText("verdeckt").length;
const loese = async (u: ReturnType<typeof userEvent.setup>, fakt: string) => {
  await u.click(screen.getByText(fakt));
  await u.click(screen.getByRole("button", { name: "Prüfen" }));
};

describe("Glücksrad", () => {
  it("die Wand verdeckt den Etappentitel, die Frage steht offen da", () => {
    baue();
    expect(verdeckt()).toBe(13); // alle Buchstaben von »Lass Anna lesen«
    expect(screen.getByText("Erste Frage?")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Drehen" })).toBeNull();
  });

  it("eine richtige Antwort deckt genau ihren Anteil auf, alle zusammen das ganze Wort", async () => {
    const { lauf, u } = baue();
    const anteil = verteile(WORT, ["c1", "c2"]);
    await loese(u, "Fakt Eins");
    expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false);
    const nachEins = [...WORT].filter((z) => /\p{L}/u.test(z) && !anteil.c1.includes(z.toLowerCase())).length;
    await waitFor(() => expect(verdeckt()).toBe(nachEins));
    expect(screen.getByText(/🪙 100/)).toBeTruthy();
    expect(screen.getByText("Zweite Frage?")).toBeTruthy();
    await loese(u, "Fakt Zwei");
    await waitFor(() => expect(verdeckt()).toBe(0));
    expect(screen.getByText(/Das Rätselwort: »Lass Anna lesen«/)).toBeTruthy();
  });

  it("falsche Antwort deckt nichts auf; der Galgen wächst mit den verlorenen Leben", async () => {
    const { lauf, u, rerender } = baue();
    lauf.antworte.mockResolvedValueOnce(antwort());
    expect(screen.getByRole("img", { name: "Galgen: 0 von 6 Teilen" })).toBeTruthy();
    await loese(u, "Fakt Eins");
    expect(await screen.findByText(/zwei Teile mehr am Galgen/)).toBeTruthy();
    expect(verdeckt()).toBe(13);
    // das neue Brett vom Server bringt das verlorene Leben
    rerender(<Modus brett={{ ...brett, leben: 2 } as never} theme={themeVon("wald")} skin="monster" lauf={lauf as never} zurKarte={() => {}} />);
    expect(screen.getByRole("img", { name: "Galgen: 2 von 6 Teilen" })).toBeTruthy();
  });

  it("schon erledigte Fragen zeigen ihre Buchstaben beim Laden", () => {
    baue({ ...brett, challenges: [{ ...brett.challenges[0], erledigt: true }, brett.challenges[1]] });
    const anteil = verteile(WORT, ["c1", "c2"]);
    expect(verdeckt()).toBe([...WORT].filter((z) => /\p{L}/u.test(z) && !anteil.c1.includes(z.toLowerCase())).length);
    expect(screen.getByText("Zweite Frage?")).toBeTruthy();
  });
});
