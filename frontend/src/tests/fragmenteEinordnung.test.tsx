import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Einordnung, OrtWahl, ortAus, ortText, ortWert } from "@/components/fragmente/Einordnung";

const kategorien = [
  { klasse: 5, einheiten: [{ id: "k5-t1", titel: "Daten" }] },
  { klasse: 6, einheiten: [{ id: "k6-t2", titel: "Brüche" }] },
];

describe("Einordnung", () => {
  it("wandelt Ort und Auswahlwert hin und zurück", () => {
    expect(ortWert({ klasse: 6, einheit: "k6-t2" })).toBe("6|k6-t2");
    expect(ortAus("6|k6-t2")).toEqual({ klasse: 6, einheit: "k6-t2" });
    expect(ortAus("5|")).toEqual({ klasse: 5, einheit: null });
    expect(ortAus("")).toEqual({ klasse: null, einheit: null });
    expect(ortText(kategorien, { klasse: 6, einheit: "k6-t2" })).toBe("Kl. 6 · Brüche");
    expect(ortText(kategorien, { klasse: null, einheit: null })).toBe("");
  });

  it("bietet Klassen und Einheiten an und fehlt ohne Kategorien", () => {
    const aendern = vi.fn();
    const { unmount } = render(
      <Einordnung.Provider value={{ kategorien, vorgabe: { klasse: null, einheit: null } }}>
        <OrtWahl wert={{ klasse: null, einheit: null }} onChange={aendern} />
      </Einordnung.Provider>);
    fireEvent.change(screen.getByLabelText("Klasse und Unterrichtseinheit"), { target: { value: "5|k5-t1" } });
    expect(aendern).toHaveBeenCalledWith({ klasse: 5, einheit: "k5-t1" });
    unmount();
    render(<OrtWahl wert={{ klasse: null, einheit: null }} onChange={aendern} />);
    expect(screen.queryByLabelText("Klasse und Unterrichtseinheit")).toBeNull();
  });
});
