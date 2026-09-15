/**
 * Die Simulation »Sonnensystem« von außen. jsdom kann kein WebGL: die beiden
 * 3D-Reiter zeigen dann ihren Hinweis, alles andere muss trotzdem gehen.
 * Die Rechnung dahinter prüft sonnensystem.test.ts.
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, within } from "@testing-library/react";
import Sonnensystem from "@/components/sonnensystem/Sonnensystem";
import { ScanKarte } from "@/components/sonnensystem/Flug";
import { KOERPER_NACH_ID } from "@/lib/sonnensystem/daten";
import { AUFTRAEGE } from "@/lib/sonnensystem/auftraege";

const reiter = (name: RegExp) => fireEvent.click(screen.getByRole("tab", { name }));

describe("Sonnensystem", () => {
  it("fällt ohne WebGL auf einen Hinweis zurück, statt abzustürzen", async () => {
    render(<Sonnensystem />);
    // three.js wird erst hier nachgeladen — unter Last dauert das länger als 1 s.
    expect(await screen.findByText(/kann kein WebGL/, undefined, { timeout: 10_000 })).toBeInTheDocument();
  });

  it("öffnet aus dem Größenvergleich den Steckbrief und springt zu einem Mond und zurück", () => {
    render(<Sonnensystem />);
    reiter(/Größen/);
    fireEvent.click(screen.getByRole("button", { name: /^Jupiter/ }));

    const brief = screen.getByRole("complementary", { name: "Steckbrief Jupiter" });
    expect(within(brief).getByText(/Große Rote Fleck ist ein Wirbelsturm/)).toBeInTheDocument();
    expect(within(brief).getByText("(× 11,0 Erde)")).toBeInTheDocument();

    fireEvent.click(within(brief).getByRole("button", { name: /^Io/ }));
    const io = screen.getByRole("complementary", { name: "Steckbrief Io" });
    expect(within(io).getByText("Mond von Jupiter")).toBeInTheDocument();

    fireEvent.click(within(io).getByRole("button", { name: /zurück zu Jupiter/ }));
    expect(screen.getByRole("complementary", { name: "Steckbrief Jupiter" })).toBeInTheDocument();
  });

  it("rechnet in den Entfernungen die Lichtlaufzeit bis Neptun aus", () => {
    render(<Sonnensystem />);
    reiter(/Entfernungen/);
    const zeile = screen.getByRole("button", { name: "Neptun" }).closest("tr")!;
    expect(within(zeile).getByText("4 h 10 min")).toBeInTheDocument();
    expect(within(zeile).getByText("4,50 Mrd. km")).toBeInTheDocument();
  });

  it("vergleicht in der Galerie Hubble und Webb nebeneinander", () => {
    render(<Sonnensystem />);
    reiter(/Galerie/);
    fireEvent.click(screen.getAllByRole("button", { name: /Säulen der Schöpfung/ })[0]);
    const dialog = screen.getByRole("dialog", { name: "Säulen der Schöpfung" });
    expect(within(dialog).getAllByRole("img")).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: /Vergleichen mit James-Webb/ }));
    expect(within(dialog).getAllByRole("img")).toHaveLength(2);
  });
});

describe("Scan-Karte", () => {
  it("lässt nach einer falschen Antwort erneut raten und meldet erst die richtige", () => {
    const auftrag = AUFTRAEGE.find(a => a.ziel === "enceladus")!;
    const geloest = vi.fn();
    render(
      <ScanKarte koerper={KOERPER_NACH_ID.enceladus} anzahl={3} auftrag={auftrag}
        onGeloest={geloest} onSteckbrief={() => {}} onSchliessen={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Jupiter" }));
    expect(screen.getByText(/Die Antwort steht im Steckbrief/)).toBeInTheDocument();
    expect(geloest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Saturn" }));
    expect(geloest).toHaveBeenCalledWith(auftrag.id);
    expect(screen.getByText(/Richtig!/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nächster Auftrag" })).toBeInTheDocument();
  });
});
