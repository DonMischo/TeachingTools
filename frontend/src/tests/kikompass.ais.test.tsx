import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AIS_LEER, aisAus, linkFuer, mitAis, sichererLink, zuGross } from "@/lib/kikompass/ais";
import { STATIONEN } from "@/lib/kikompass/stationen";
import { StationAnsicht } from "@/components/kikompass/StationAnsicht";
import { AisZugang } from "@/components/kikompass/AisZugang";

const LINK = "https://chat.example.org/lernumgebung/abc123";

describe("AIS.chat-Links aus den Sitzungseinstellungen", () => {
  it("lässt nur http(s)-Links durch", () => {
    expect(sichererLink(LINK)).toBe(LINK);
    expect(sichererLink("  " + LINK + "  ")).toBe(LINK);
    expect(sichererLink("javascript:alert(1)")).toBeNull();
    expect(sichererLink("data:text/html,hallo")).toBeNull();
    expect(sichererLink("https://a.org/x y")).toBeNull();
    expect(sichererLink("kein link")).toBeNull();
    expect(sichererLink(42)).toBeNull();
    expect(sichererLink("https://a.org/" + "x".repeat(600))).toBeNull();
  });

  it("verwirft ungültige Links und unbekannte Stationen", () => {
    const ais = aisAus({ ais: {
      standard: "javascript:alert(1)",
      stationen: { "r-ki-irrt": LINK, "gibt-es-nicht": LINK, "a-erster-prompt": "ftp://x" },
      anzeige: "quatsch",
    } });
    expect(ais).toEqual({ standard: null, stationen: { "r-ki-irrt": LINK }, anzeige: "beides" });
    expect(aisAus(undefined)).toEqual(AIS_LEER);
  });

  it("nimmt den Stationslink, sonst den für alle", () => {
    const ais = { standard: "https://a.org/alle", stationen: { "r-ki-irrt": LINK }, anzeige: "link" as const };
    expect(linkFuer(ais, "r-ki-irrt")).toBe(LINK);
    expect(linkFuer(ais, "r-fair")).toBe("https://a.org/alle");
    expect(linkFuer(AIS_LEER, "r-fair")).toBeNull();
  });

  it("behält die übrigen Einstellungen und erkennt zu große", () => {
    expect(mitAis({ andere: 1 }, AIS_LEER)).toEqual({ andere: 1, ais: AIS_LEER });
    const viele = Object.fromEntries(STATIONEN.map(s => [s.id, "https://a.org/" + "x".repeat(400)]));
    expect(zuGross(mitAis({}, { ...AIS_LEER, stationen: viele }))).toBe(true);
    expect(zuGross(mitAis({}, { ...AIS_LEER, standard: LINK }))).toBe(false);
  });
});

describe("Anzeige", () => {
  it("zeigt Link, QR oder beides", () => {
    const { rerender, container } = render(<AisZugang ais={{ standard: LINK, stationen: {}, anzeige: "link" }} />);
    expect(screen.getByRole("link", { name: /AIS.chat öffnen/ })).toHaveAttribute("href", LINK);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<AisZugang ais={{ standard: LINK, stationen: {}, anzeige: "qr" }} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
    rerender(<AisZugang ais={AIS_LEER} />);
    expect(container.textContent).toBe("");
  });

  it("zeigt den Stationslink im AIS.chat-Schritt", () => {
    const station = STATIONEN.find(s => s.id === "r-ki-irrt")!;
    render(<StationAnsicht station={station} stand={undefined} onChange={() => {}} onZurueck={() => {}}
      ais={{ standard: "https://a.org/alle", stationen: { "r-ki-irrt": LINK }, anzeige: "beides" }} />);
    fireEvent.click(screen.getByRole("button", { name: /AIS\.chat/ }));
    expect(screen.getByRole("link", { name: /AIS.chat öffnen/ })).toHaveAttribute("href", LINK);
  });

  it("ohne Link bleibt der Hinweis auf die Lehrkraft", () => {
    const station = STATIONEN.find(s => s.id === "r-ki-irrt")!;
    render(<StationAnsicht station={station} stand={undefined} onChange={() => {}} onZurueck={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /AIS\.chat/ }));
    expect(screen.getByText(/Deine Lehrkraft zeigt dir einen QR-Code/)).toBeInTheDocument();
  });
});
