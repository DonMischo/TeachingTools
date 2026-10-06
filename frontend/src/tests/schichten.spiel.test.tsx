import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Fehlersuche from "@/components/schichten/Fehlersuche";
import Mission from "@/components/schichten/spiel/Mission";
import Routing from "@/components/schichten/spiel/Routing";
import DnsJagd from "@/components/schichten/spiel/DnsJagd";
import { ZIELE } from "@/lib/schichten/netz";

describe("Schichtenmodell — Anwenden", () => {
  it("Mission: Wort mit 8 Zeichen, dann ASCII prüfen", () => {
    render(<Mission modell="osi" />);
    const los = screen.getByRole("button", { name: /Los geht/ });
    expect(los).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Wort mit 8 Zeichen"), { target: { value: "Katze 42" } });
    fireEvent.click(los);
    "Katze 42".split("").forEach((z, i) => fireEvent.change(screen.getByLabelText(`Code für Zeichen ${i + 1}`), { target: { value: String(z.charCodeAt(0)) } }));
    fireEvent.click(screen.getByRole("button", { name: /Prüfen/ }));
    // weiter zu den Bits: die Stellenwert-Knöpfe sind da
    expect(screen.getByLabelText("Bit 128 von Zeichen 1")).toBeInTheDocument();
  });

  it("Mission: Umlaute sind gesperrt", () => {
    render(<Mission modell="osi" />);
    fireEvent.change(screen.getByLabelText("Wort mit 8 Zeichen"), { target: { value: "Grüße!!!" } });
    expect(screen.getByRole("button", { name: /Los geht/ })).toBeDisabled();
    expect(screen.getByText(/keine Umlaute/)).toBeInTheDocument();
  });

  it("Routing: falsche Wahl wird begründet, richtige Wahl zieht weiter", () => {
    const { container } = render(<Routing ziel={ZIELE[0]} fertig={() => {}} fehler={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /direkt zustellen/ }));
    expect(screen.getByText(/passt nicht/)).toBeInTheDocument();
    const erfurt = Array.from(container.querySelectorAll("g")).find(g => g.textContent?.endsWith("Anbieter Erfurt"))!;
    fireEvent.click(erfurt);
    expect(screen.getByText(/weiter nach Anbieter Erfurt/)).toBeInTheDocument();
    expect(screen.getByText("63")).toBeInTheDocument();
  });

  it("DNS-Jagd: erst Root, sonst Hinweis", () => {
    const { container } = render(<DnsJagd ziel={ZIELE[0]} fertig={() => {}} fehler={() => {}} />);
    const knoten = (ip: string) => Array.from(container.querySelectorAll("g")).find(g => g.getAttribute("transform") && g.textContent?.startsWith(ip))!;
    fireEvent.click(knoten("192.0.2.10"));
    expect(screen.getByText(/Am Anfang kennt der Resolver/)).toBeInTheDocument();
    fireEvent.click(knoten("198.41.0.4"));
    expect(screen.getByText(/frag einen|zuständig/)).toBeInTheDocument();
    fireEvent.click(knoten("192.0.2.10"));
    fireEvent.click(knoten("192.0.2.53"));
    expect(screen.getByText(/Gefunden/)).toBeInTheDocument();
  });

  it("Fehlersuche: Werkzeug ausführen und Schicht tippen", () => {
    render(<Fehlersuche modell="tcpip" />);
    fireEvent.click(screen.getAllByRole("button", { name: /^> / })[0]);
    expect(document.querySelector("pre")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Transport" }));
    expect(screen.getByText(/Richtig|Nicht ganz/)).toBeInTheDocument();
  });
});
