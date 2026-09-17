/**
 * Das Labor darf einen gespeicherten Aufbau niemals beim Öffnen verlieren.
 *
 * Der Fehler, der hier festgehalten wird: Laden und Speichern liefen im selben
 * Durchgang los, und der Speicher-Effekt schrieb die noch leere Anfangsszene
 * über den gespeicherten Aufbau. Unter StrictMode (das Standalone-Bündel läuft
 * darin) montiert React zweimal — der zweite Ladevorgang las dann den eben
 * gelöschten Stand und der Aufbau war endgültig weg.
 */
import { StrictMode } from "react";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import PhysikLabor from "@/components/physik/PhysikLabor";
import { alsJSON, ausJSON, neueSzene, stelle, verbinde } from "@/lib/physik/szene";

beforeAll(() => {
  // jsdom kennt beides nicht; die Werkbank kommt ohne sie aus.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
});

beforeEach(() => localStorage.clear());

const SCHLUESSEL = "pruefung";
const ABLAGE = `physik-aufbau-v1:${SCHLUESSEL}`;

function gespeicherterAufbau() {
  let s = stelle(neueSzene(), "stativ", { x: 0, y: 0 });
  s = stelle(s, "massestueck", { x: 0, y: 1 });
  return verbinde(s, { geraet: s.geraete[0].id, port: "haken" }, { geraet: s.geraete[1].id, port: "oese" });
}

describe("PhysikLabor", () => {
  it("behält den gespeicherten Aufbau beim Öffnen", () => {
    localStorage.setItem(ABLAGE, alsJSON(gespeicherterAufbau()));

    render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);

    const nachher = ausJSON(localStorage.getItem(ABLAGE)!);
    expect(nachher.geraete).toHaveLength(2);
    expect(nachher.verbindungen).toHaveLength(1);
  });

  it("behält ihn auch unter StrictMode, das zweimal montiert", () => {
    localStorage.setItem(ABLAGE, alsJSON(gespeicherterAufbau()));

    render(
      <StrictMode>
        <PhysikLabor speicherSchluessel={SCHLUESSEL} />
      </StrictMode>,
    );

    const nachher = ausJSON(localStorage.getItem(ABLAGE)!);
    expect(nachher.geraete).toHaveLength(2);
    expect(nachher.verbindungen).toHaveLength(1);
  });

  it("zeigt den geladenen Aufbau auch an", () => {
    localStorage.setItem(ABLAGE, alsJSON(gespeicherterAufbau()));

    const { getByLabelText } = render(
      <StrictMode>
        <PhysikLabor speicherSchluessel={SCHLUESSEL} />
      </StrictMode>,
    );

    // Der Titel kommt aus der geladenen Szene, nicht aus der leeren Voreinstellung.
    expect(getByLabelText("Name des Aufbaus")).toHaveValue("Neuer Aufbau");
    expect(document.body.textContent).not.toContain("Der Tisch ist leer");
  });
});
