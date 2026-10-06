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
    expect(screen.getByText(/Nur Zeichen aus der ASCII-Tabelle/)).toBeInTheDocument();
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

  it("jede Missionsstufe hat einen Arbeitsauftrag mit Ziel und Wissen", () => {
    render(<Mission modell="osi" niveau="einsteiger" />);
    expect(screen.getByText(/Deine Aufgabe/)).toBeInTheDocument();
    expect(screen.getByText(/Fertig, wenn/)).toBeInTheDocument();
    expect(screen.getByText(/Warum genau 8 Zeichen/)).toBeInTheDocument();
  });

  it("Experte: ASCII in Hex", () => {
    render(<Mission modell="osi" niveau="experte" />);
    fireEvent.change(screen.getByLabelText("Wort mit 8 Zeichen"), { target: { value: "Katze 42" } });
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    "Katze 42".split("").forEach((z, i) => fireEvent.change(screen.getByLabelText(`Code für Zeichen ${i + 1}`), { target: { value: z.charCodeAt(0).toString(16) } }));
    fireEvent.click(screen.getByRole("button", { name: /Prüfen/ }));
    expect(screen.getByLabelText("Bit 128 von Zeichen 1")).toBeInTheDocument();
  });

  it("Einsteiger: Routingtabelle zeigt, welche Zeilen passen", () => {
    render(<Routing ziel={ZIELE[0]} niveau="einsteiger" fertig={() => {}} fehler={() => {}} />);
    expect(screen.getByText("passt?")).toBeInTheDocument();
    expect(screen.queryByText(/Bits zeigen/)).toBeNull();
  });

  it("Punkte und Sterne: fehlerfreie ASCII-Stufe bringt 1000, Binär-Rechner kostet den dritten Stern", () => {
    render(<Mission modell="osi" niveau="einsteiger" />);
    fireEvent.change(screen.getByLabelText("Wort mit 8 Zeichen"), { target: { value: "Katze 42" } });
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    "Katze 42".split("").forEach((z, i) => fireEvent.change(screen.getByLabelText(`Code für Zeichen ${i + 1}`), { target: { value: String(z.charCodeAt(0)) } }));
    fireEvent.click(screen.getByRole("button", { name: /Prüfen/ }));
    expect(screen.getByLabelText("Punktestand").textContent).toContain("1.000");
    expect(screen.getByRole("status").textContent).toContain("+1.000 Punkte ⭐⭐⭐");

    // Bits mit Binär-Rechner: Ziel steht drin, »übernehmen« füllt die Zeile
    fireEvent.click(screen.getByLabelText("Binär-Rechner für Zeichen 1"));
    expect(screen.getByText(/ZIEL = 75 \(K\)/)).toBeInTheDocument();
    for (let i = 0; i < 8; i++) {
      fireEvent.click(screen.getByLabelText(`Binär-Rechner für Zeichen ${i + 1}`));
      const c = "Katze 42".charCodeAt(i);
      [128, 64, 32, 16, 8, 4, 2, 1].forEach((s, k) => { if (c & s) fireEvent.click(screen.getByLabelText(`Bit ${7 - k} mit dem Stellenwert ${s}`)); });
      fireEvent.click(screen.getByRole("button", { name: /In Zeile/ }));
    }
    fireEvent.click(screen.getByRole("button", { name: /Prüfen/ }));
    expect(screen.getByRole("status").textContent).toContain("+900 Punkte ⭐⭐☆");
    expect(screen.getByLabelText("Punktestand").textContent).toContain("1.900");
    // viele Klicks — im vollen, parallelen Testlauf braucht das deutlich länger als allein
  }, 60_000);

  it("Fehlersuche zählt für den Erfolg »Fehlerjäger«", () => {
    localStorage.removeItem("hp_schichten_erfolge");
    render(<Fehlersuche modell="osi" />);
    fireEvent.click(screen.getByRole("button", { name: /^1 Bitübertragung/ }));
    const s = JSON.parse(localStorage.getItem("hp_schichten_erfolge") ?? "{}");
    expect(typeof s.fehlersucheRichtig).toBe("number");
  });
});
