/**
 * Der Forschungsstand darf beim Öffnen niemals verloren gehen.
 *
 * Der Fehler, der hier festgehalten wird: Laden und Speichern liefen im selben
 * Durchgang los. Der Ladevorgang stellte den Stand nur in die Warteschlange,
 * setzte die Marke »geladen« aber sofort — und der Speicher-Effekt schrieb
 * darauf den noch leeren Anfangsstand über den gespeicherten. Unter StrictMode
 * (im Entwicklungsmodus montiert React zweimal) las der zweite Ladevorgang
 * genau diese Leere zurück, und die Forschung war endgültig weg.
 *
 * Dazu der Schlüsselwechsel (ein Gast meldet sich an, `gast-CODE` wird zu
 * `konto-…`): der Stand des einen Platzes darf nicht auf dem anderen landen.
 */
import { StrictMode } from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  LEERER_FORTSCHRITT,
  ladeFortschritt,
  mitEintrag,
  speichereFortschritt,
  useForschung,
  type Fortschritt,
} from "@/components/sonnensystem/fortschritt";

beforeEach(() => localStorage.clear());

const SCHLUESSEL = "pruefung";

const gespeicherterStand: Fortschritt = {
  ...LEERER_FORTSCHRITT,
  erforscht: ["jupiter", "mars"],
  erledigt: ["scan-jupiter"],
};

describe("useForschung", () => {
  it("behält den gespeicherten Stand beim Öffnen", () => {
    speichereFortschritt(SCHLUESSEL, gespeicherterStand);

    renderHook(() => useForschung(SCHLUESSEL));

    expect(ladeFortschritt(SCHLUESSEL).erforscht).toEqual(["jupiter", "mars"]);
  });

  it("behält ihn auch unter StrictMode, das zweimal montiert", () => {
    speichereFortschritt(SCHLUESSEL, gespeicherterStand);

    const { result } = renderHook(() => useForschung(SCHLUESSEL), { wrapper: StrictMode });

    expect(ladeFortschritt(SCHLUESSEL).erforscht).toEqual(["jupiter", "mars"]);
    expect(result.current.fortschritt.erforscht).toEqual(["jupiter", "mars"]);
    expect(result.current.fortschritt.erledigt).toEqual(["scan-jupiter"]);
  });

  it("schreibt Änderungen weiter fort", () => {
    speichereFortschritt(SCHLUESSEL, gespeicherterStand);
    const { result } = renderHook(() => useForschung(SCHLUESSEL), { wrapper: StrictMode });

    act(() => result.current.aendere(f => ({ ...f, erforscht: mitEintrag(f.erforscht, "saturn") })));

    expect(ladeFortschritt(SCHLUESSEL).erforscht).toEqual(["jupiter", "mars", "saturn"]);
  });

  it("hält die Plätze beim Schlüsselwechsel auseinander", () => {
    speichereFortschritt("gast-ABC", gespeicherterStand);
    speichereFortschritt("konto-7", { ...LEERER_FORTSCHRITT, erforscht: ["venus"] });

    const { result, rerender } = renderHook(({ s }: { s: string }) => useForschung(s), {
      wrapper: StrictMode,
      initialProps: { s: "gast-ABC" },
    });
    rerender({ s: "konto-7" });

    expect(result.current.fortschritt.erforscht).toEqual(["venus"]);
    expect(ladeFortschritt("konto-7").erforscht).toEqual(["venus"]);
    expect(ladeFortschritt("gast-ABC").erforscht).toEqual(["jupiter", "mars"]);
  });
});
