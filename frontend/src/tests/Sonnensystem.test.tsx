/**
 * Die Simulation »Sonnensystem« von außen. jsdom kann kein WebGL: die beiden
 * 3D-Reiter zeigen dann ihren Hinweis, alles andere muss trotzdem gehen.
 * Die Rechnung dahinter prüft sonnensystem.test.ts.
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, within } from "@testing-library/react";
import Sonnensystem from "@/components/sonnensystem/Sonnensystem";
import { HOECHSTTEMPO, ScanKarte } from "@/components/sonnensystem/Flug";
import { sichtweiteFuerLicht } from "@/components/sonnensystem/Entfernungen";
import { FLUG_ABSTANDSTEILER, FLUG_KM_JE_EINHEIT } from "@/lib/sonnensystem/massstab";
import { KM_JE_AE, LICHT_KM_S } from "@/lib/sonnensystem/daten";
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

  it("sperrt Galeriebilder bis zum Scan und vergleicht danach Hubble und Webb", () => {
    const { unmount } = render(<Sonnensystem />);
    reiter(/Galerie/);
    expect(screen.queryByRole("button", { name: /Säulen der Schöpfung/ })).toBeNull();
    expect(screen.getAllByText("Scanne Pluto").length).toBeGreaterThan(0);
    unmount();

    localStorage.setItem("sonnensystem-forschung-v1:geraet", JSON.stringify({ erforscht: ["pluto"], erledigt: [] }));
    render(<Sonnensystem />);
    reiter(/Galerie/);
    fireEvent.click(screen.getAllByRole("button", { name: /Säulen der Schöpfung/ })[0]);
    const dialog = screen.getByRole("dialog", { name: "Säulen der Schöpfung" });
    expect(within(dialog).getAllByRole("img")).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: /Vergleichen mit James-Webb/ }));
    expect(within(dialog).getAllByRole("img")).toHaveLength(2);
    localStorage.clear();
  });

  it("lässt Lehrkräfte die ganze Galerie aufdecken und nach Planet samt Monden filtern", () => {
    render(<Sonnensystem lehrkraft />);
    reiter(/Galerie/);
    fireEvent.click(screen.getByLabelText(/Alle zeigen/));
    fireEvent.change(screen.getByLabelText("Nach Himmelskörper filtern"), { target: { value: "saturn" } });
    expect(screen.getByRole("button", { name: /Das Sechseck am Nordpol/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Die Fontänen von Enceladus/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ingenuity/ })).toBeNull();
  });

  it("zeigt im Kodex Gescanntes mit Daten und den Rest nur mit Namen", () => {
    localStorage.setItem("sonnensystem-forschung-v1:geraet", JSON.stringify({ erforscht: ["jupiter"], erledigt: [] }));
    render(<Sonnensystem />);
    reiter(/Kodex/);
    expect(screen.getByRole("heading", { name: "Jupiter" })).toBeInTheDocument();
    expect(screen.getAllByText(/noch nicht gescannt/).length).toBe(Object.keys(KOERPER_NACH_ID).length - 1);
    fireEvent.click(screen.getByRole("button", { name: /Erfolge/ }));
    expect(screen.getByText("Erster Kontakt").closest("div")!.parentElement!.textContent).toMatch(/erreicht/);
    localStorage.clear();
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

describe("Flug und Lichtlauf", () => {
  it("begrenzt den Flug auf die 100-fache Lichtgeschwindigkeit", () => {
    expect((HOECHSTTEMPO * FLUG_KM_JE_EINHEIT * FLUG_ABSTANDSTEILER) / LICHT_KM_S).toBeCloseTo(100, 6);
  });

  it("zeigt beim Lichtlauf immer bis 5 % hinter den nächsten Planeten", () => {
    const au = (id: string) => KOERPER_NACH_ID[id].bahn!.a * KM_JE_AE;
    expect(sichtweiteFuerLicht(0)).toBeCloseTo(au("merkur") * 1.05, -3);
    expect(sichtweiteFuerLicht(au("erde") + 1)).toBeCloseTo(au("mars") * 1.05, -3);
    expect(sichtweiteFuerLicht(au("pluto") * 2)).toBeCloseTo(au("pluto") * 1.05, -3);
  });

  it("lässt die Sonne im Größenvergleich stehen, wenn die Planeten scrollen", () => {
    render(<Sonnensystem />);
    reiter(/Größen/);
    const sonne = screen.getByRole("button", { name: "Sonne" });
    const merkur = screen.getByRole("button", { name: /^Merkur/ });
    const scroller = merkur.closest(".overflow-x-auto");
    expect(scroller).not.toBeNull();
    expect(scroller!.contains(sonne)).toBe(false);
    expect(screen.getByText("10 px")).toBeInTheDocument();
  });
});
