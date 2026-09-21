/**
 * Der Messschreiber als Oberfläche.
 *
 * Geprüft wird, was ein Schüler davon hat: dass die angekreuzte Größe wirklich
 * als Kurve dasteht, dass die Spanne beschriftet ist, und dass nicht mehr als
 * drei Kurven auf einmal gehen — mehr halten die Farben nicht auseinander.
 */
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import Schreiber from "@/components/physik/baukasten/Schreiber";
import { messgroessen } from "@/lib/physik/kern/messen";
import { fuegeTeilHinzu, neuerAufbau, type Aufbau } from "@/lib/physik/kern/modell";
import { standardWerteTeil } from "@/lib/physik/kern/teile";
import { Messbus } from "@/lib/physik/messbus";

function aufbauMitGewicht(): Aufbau {
  return fuegeTeilHinzu(neuerAufbau(), "massestueck", { x: 0, y: 2 }, standardWerteTeil("massestueck")).aufbau;
}

/** Ein Bus, in dem ein Gewicht zwei Sekunden lang fällt. */
function gefallen(aufbau: Aufbau): Messbus {
  const bus = new Messbus();
  const id = aufbau.teile[0].id;
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    bus.schreibe(t, [[`${id}.y`, 2 - 0.5 * 9.81 * t * t], [`${id}.v`, 9.81 * t]]);
  }
  return bus;
}

function Wirt({ aufbau, bus, start = [] as string[] }: { aufbau: Aufbau; bus: Messbus | null; start?: string[] }) {
  const [gewaehlt, setGewaehlt] = useState<string[]>(start);
  return (
    <Schreiber groessen={messgroessen(aufbau)} bus={bus} gewaehlt={gewaehlt} onGewaehlt={setGewaehlt} takt={0} />
  );
}

describe("Der Messschreiber", () => {
  it("sagt, dass ohnehin alles aufgezeichnet wird, solange nichts gewählt ist", () => {
    const a = aufbauMitGewicht();
    const { getByLabelText } = render(<Wirt aufbau={a} bus={gefallen(a)} />);
    expect(getByLabelText("Messschreiber").textContent).toMatch(/aufgezeichnet wird ohnehin alles/);
  });

  it("zeichnet die angekreuzte Größe als Kurve, mit ihrer Spanne beschriftet", () => {
    const a = aufbauMitGewicht();
    const { getByLabelText, getByRole, container } = render(<Wirt aufbau={a} bus={gefallen(a)} />);

    act(() => { fireEvent.click(getByLabelText("Höhe")); });

    const bild = getByRole("img");
    expect(bild.getAttribute("aria-label")).toMatch(/Massestück 1 Höhe/);
    const pfad = container.querySelector("path");
    expect(pfad?.getAttribute("d")?.length).toBeGreaterThan(100);
    // Von 2 m fällt es in zwei Sekunden weit unter null — beides steht am Rand,
    // und die Zeitachse reicht bis 2 s.
    expect(bild.textContent).toMatch(/2 m/);
    expect(bild.textContent).toMatch(/-17,6 m/);
    expect(bild.textContent).toMatch(/2\.0 s/);
    expect(getByRole("button", { name: /CSV/ })).toBeInTheDocument();
  });

  it("lässt höchstens drei Kurven zu", () => {
    const a = aufbauMitGewicht();
    const { getByLabelText } = render(<Wirt aufbau={a} bus={gefallen(a)} />);
    for (const name of ["Höhe", "Ort waagerecht", "Geschwindigkeit"]) {
      act(() => { fireEvent.click(getByLabelText(name)); });
    }
    expect(getByLabelText("Messschreiber").textContent).toMatch(/3\/3/);
    // Die vierte lässt sich nicht mehr ankreuzen, die dritte aber abwählen.
    expect(getByLabelText("Lageenergie")).toBeDisabled();
    expect(getByLabelText("Geschwindigkeit")).not.toBeDisabled();
  });

  it("kommt ohne Aufzeichnung aus, ohne zu zerbrechen", () => {
    const a = aufbauMitGewicht();
    const { getByLabelText } = render(<Wirt aufbau={a} bus={null} start={[`${a.teile[0].id}.y`]} />);
    expect(getByLabelText("Messschreiber").textContent).toMatch(/Noch nichts aufgezeichnet/);
  });
});
