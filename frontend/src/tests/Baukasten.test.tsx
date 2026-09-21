/**
 * Der Baukasten als Oberfläche: bauen, befestigen, rückgängig, Versuch.
 *
 * Die Bühne (WebGL) gibt es in jsdom nicht — genau wie in einem Browser ohne
 * WebGL. Der Baukasten muss dann trotzdem bedienbar bleiben; geprüft wird,
 * was im Inspektor und im Speicher ankommt.
 */
import { StrictMode } from "react";
import { beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import Baukasten from "@/components/physik/baukasten/Baukasten";
import { fuegeTeilHinzu, neuerAufbau } from "@/lib/physik/kern/modell";
import { aufbauAusJSON } from "@/lib/physik/kern/speicher";
import { standardWerteTeil } from "@/lib/physik/kern/teile";

vi.mock("@/components/physik/baukasten/buehne", async original => ({
  ...(await original<typeof import("@/components/physik/baukasten/buehne")>()),
  Buehne: { erzeuge: async () => null },
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
beforeEach(() => localStorage.clear());

const SCHLUESSEL = "pruefung";
const ABLAGE = `physik-baukasten-v1:${SCHLUESSEL}`;
const gespeichert = () => aufbauAusJSON(localStorage.getItem(ABLAGE) ?? "");

/**
 * Tippt auf die Werkbank. Die Bühne ist 800 × 520 Pixel groß und zeigt um
 * (0 | 0,7) mit 320 Pixeln je Meter — die Mitte der Werkbank ist also genau
 * dieser Weltpunkt.
 */
function tippe(werkbank: HTMLElement, x = 400, y = 260) {
  act(() => {
    fireEvent.pointerDown(werkbank, { clientX: x, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(werkbank, { clientX: x, clientY: y, pointerId: 1 });
  });
}

describe("Baukasten", () => {
  it("behält einen gespeicherten Aufbau beim Öffnen, auch unter StrictMode", () => {
    const { aufbau } = fuegeTeilHinzu(neuerAufbau(), "brett", { x: 0, y: 1 }, standardWerteTeil("brett"));
    localStorage.setItem(ABLAGE, JSON.stringify(aufbau));
    render(<StrictMode><Baukasten speicherSchluessel={SCHLUESSEL} /></StrictMode>);
    expect(gespeichert().teile).toHaveLength(1);
  });

  it("stellt ein Teil dorthin, wo man tippt, und zeigt seine Masse", () => {
    const { getByLabelText, getByText } = render(<Baukasten speicherSchluessel={SCHLUESSEL} />);
    act(() => getByLabelText("Klotz hinstellen").click());
    tippe(getByLabelText("Werkbank"));

    const teile = gespeichert().teile;
    expect(teile).toHaveLength(1);
    expect(teile[0].pos.x).toBeCloseTo(0, 6);
    expect(teile[0].pos.y).toBeCloseTo(0.7, 6);
    // 10 cm Holzwürfel: 0,001 m³ · 600 kg/m³ = 600 g, aus dem Werkstoff berechnet.
    expect(getByText("aus Holz")).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/600\s*g/);
  });

  it("macht das Hinstellen rückgängig und wieder", () => {
    const { getByLabelText, getByRole } = render(<Baukasten speicherSchluessel={SCHLUESSEL} />);
    act(() => getByLabelText("Murmel hinstellen").click());
    tippe(getByLabelText("Werkbank"));
    expect(gespeichert().teile).toHaveLength(1);

    act(() => getByRole("button", { name: /Rückgängig/ }).click());
    expect(gespeichert().teile).toHaveLength(0);
    act(() => getByRole("button", { name: /Wiederholen/ }).click());
    expect(gespeichert().teile).toHaveLength(1);
  });

  it("setzt mit der Achse ein Teil drehbar an die Wand", () => {
    const { getByLabelText, getByText } = render(<Baukasten speicherSchluessel={SCHLUESSEL} />);
    act(() => getByLabelText("Brett hinstellen").click());
    tippe(getByLabelText("Werkbank"));
    act(() => getByLabelText("Achse setzen").click());
    tippe(getByLabelText("Werkbank"));

    const v = gespeichert().verbinder;
    expect(v).toHaveLength(1);
    expect(v[0].art).toBe("achse");
    expect(v[0].b.teil).toBeNull();
    expect(getByText("an der Wand")).toBeInTheDocument();
  });

  it("schaltet mit »An die Wand« und »Drehbar« um, statt Stifte zu stapeln", () => {
    const { getByLabelText, getByRole } = render(<Baukasten speicherSchluessel={SCHLUESSEL} />);
    act(() => getByLabelText("Brett hinstellen").click());
    tippe(getByLabelText("Werkbank"));
    const fest = () => getByRole("button", { name: /An die Wand/ });
    const drehbar = () => getByRole("button", { name: /Drehbar/ });

    act(() => fest().click());
    act(() => fest().click());
    // Zweimal getippt: an und wieder aus — nicht zwei Schrauben.
    expect(gespeichert().verbinder).toHaveLength(0);

    act(() => fest().click());
    act(() => drehbar().click());
    expect(gespeichert().verbinder.map(v => v.art)).toEqual(["achse"]);
    expect(drehbar()).toHaveAttribute("aria-pressed", "true");
    expect(fest()).toHaveAttribute("aria-pressed", "false");
  });

  it("fügt einen Bauplan dort ein, wo man tippt", () => {
    const { getByLabelText } = render(<Baukasten speicherSchluessel={SCHLUESSEL} />);
    act(() => getByLabelText("Pendel einfügen").click());
    tippe(getByLabelText("Werkbank"));

    const a = gespeichert();
    expect(a.teile).toHaveLength(1);
    expect(a.verbinder[0].art).toBe("seil");
    // Der Haken sitzt auf dem Tippunkt (0 | 0,7), das Gewicht hängt darunter.
    const haken = a.verbinder[0].a.teil === null ? a.verbinder[0].a : a.verbinder[0].b;
    expect(haken.punkt.y).toBeCloseTo(0.7, 6);
    expect(a.teile[0].pos.y).toBeCloseTo(-0.3, 6);
  });

  it("sichert den Aufbau als eigenen Bauplan und stellt ihn wieder hin", () => {
    const { getByLabelText, queryByLabelText } = render(<Baukasten speicherSchluessel={SCHLUESSEL} />);
    act(() => getByLabelText("Klotz hinstellen").click());
    tippe(getByLabelText("Werkbank"));

    act(() => {
      fireEvent.change(getByLabelText("Name für den Bauplan"), { target: { value: "Mein Klotz" } });
    });
    act(() => getByLabelText("Aufbau als Bauplan sichern").click());

    // Er steht jetzt im Schrank und lässt sich ein zweites Mal hinstellen.
    act(() => getByLabelText("Mein Klotz einfügen").click());
    tippe(getByLabelText("Werkbank"), 500, 260);
    expect(gespeichert().teile).toHaveLength(2);

    // Und wieder löschen: dann ist er aus dem Schrank verschwunden.
    act(() => getByLabelText("Mein Klotz löschen").click());
    expect(queryByLabelText("Mein Klotz einfügen")).toBeNull();
  });

  it("meldet es, wenn man eine Achse ins Leere setzt", () => {
    const { getByLabelText, getByRole } = render(<Baukasten speicherSchluessel={SCHLUESSEL} />);
    act(() => getByLabelText("Achse setzen").click());
    tippe(getByLabelText("Werkbank"));
    expect(getByRole("alert").textContent).toMatch(/nichts/);
    expect(gespeichert().verbinder).toHaveLength(0);
  });

  it("schließt im Versuch den Schrank und lässt den Aufbau unangetastet", () => {
    const { aufbau } = fuegeTeilHinzu(neuerAufbau(), "klotz", { x: 0, y: 1 }, standardWerteTeil("klotz"));
    localStorage.setItem(ABLAGE, JSON.stringify(aufbau));
    const { getByLabelText, getByRole } = render(<Baukasten speicherSchluessel={SCHLUESSEL} />);

    act(() => getByRole("button", { name: /^🧪 Versuch$/ }).click());
    expect(getByLabelText("Brett hinstellen")).toBeDisabled();
    // Gespeichert bleibt der Aufbau: der Klotz schwebt dort, wo er hingestellt wurde.
    expect(gespeichert().teile[0].pos.y).toBe(1);

    act(() => getByRole("button", { name: /^🛠️ Bauen$/ }).click());
    expect(getByLabelText("Brett hinstellen")).not.toBeDisabled();
  });

  it("zeigt im Versuch die Messwerte mit Formel und die Kraft im Seil", () => {
    let a = fuegeTeilHinzu(neuerAufbau(), "massestueck", { x: 0, y: 0.7 }, { masse: 1 }).aufbau;
    a = { ...a, verbinder: [{ id: "v1", art: "seil", a: { teil: null, punkt: { x: 0, y: 1.2 } }, b: { teil: "t1", punkt: { x: 0, y: 0 } }, werte: { laenge: 0 } }] };
    localStorage.setItem(ABLAGE, JSON.stringify(a));
    const { getByLabelText, getByRole, getByText } = render(<Baukasten speicherSchluessel={SCHLUESSEL} />);

    act(() => getByRole("button", { name: /^🧪 Versuch$/ }).click());
    act(() => getByRole("button", { name: /Anhalten/ }).click());
    // Das Seil läuft genau über das Gewicht — angetippt wird trotzdem das Gewicht.
    tippe(getByLabelText("Werkbank"));
    expect(getByText("E_kin = ½ · m · v²")).toBeInTheDocument();
    expect(getByText("E_pot = m · g · h")).toBeInTheDocument();

    // Das Seil selbst, in der Mitte zwischen Wand und Gewicht (0,25 m höher).
    tippe(getByLabelText("Werkbank"), 400, 260 - 0.25 * 320);
    expect(getByText("Seilkraft")).toBeInTheDocument();
    expect(getByRole("button", { name: /Lösen/ })).toBeInTheDocument();
  });
});
