/**
 * Die Oberfläche der Rechenregeln — dass die drei Reiter das anzeigen, was
 * die Rechnung sagt, und dass Antippen wirklich nur *einen* Schritt macht.
 *
 * Die Rechnung selbst steht in rechenregeln.test.ts; hier geht es um das
 * Zusammenspiel: getippt wird auf Bauteile, geprüft wird der Text.
 */
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen, within } from "@testing-library/react";
import Rechenregeln from "@/components/simulationen/Rechenregeln";

/** Der Term über der Bühne — die Zeile, die sich Schritt für Schritt neu schreibt. */
function termzeile(c: HTMLElement): string {
  return within(c).getByLabelText("Term").textContent!.trim();
}

const eigenerTerm = (c: HTMLElement, term: string) => {
  fireEvent.change(within(c).getByLabelText("Eigener Term"), { target: { value: term } });
  fireEvent.click(within(c).getByText("Übernehmen"));
};

describe("Obstkorb", () => {
  it("startet mit einem Term und sagt, welche Rechnung dran ist", () => {
    const { container } = render(<Rechenregeln />);
    expect(termzeile(container)).toBe("2 + 3 · 4");
    expect(screen.getByText(/als Nächstes: 3 · 4 — Punkt vor Strich/)).toBeTruthy();
  });

  it("rechnet pro Klick genau einen Schritt und schreibt den Term neu", () => {
    const { container } = render(<Rechenregeln />);
    fireEvent.click(screen.getByText("▶︎ Schritt"));
    expect(termzeile(container)).toBe("2 + 12");
    fireEvent.click(screen.getByText("▶︎ Schritt"));
    expect(termzeile(container)).toBe("14");
    expect(screen.getByText(/2 \+ 3 · 4 = 14/)).toBeTruthy();
  });

  it("nennt am Ende, was von links nach rechts herausgekommen wäre", () => {
    render(<Rechenregeln />);
    fireEvent.click(screen.getByText("▶︎ Schritt"));
    fireEvent.click(screen.getByText("▶︎ Schritt"));
    expect(screen.getByText(/von links nach rechts rechnet, kommt auf 20/)).toBeTruthy();
  });

  it("nimmt den Schritt auf »zurück« wieder weg", () => {
    const { container } = render(<Rechenregeln />);
    fireEvent.click(screen.getByText("▶︎ Schritt"));
    fireEvent.click(screen.getByText("↶ zurück"));
    expect(termzeile(container)).toBe("2 + 3 · 4");
  });

  it("weist eine zu früh angetippte Rechnung ab und sagt den Grund", () => {
    const { container } = render(<Rechenregeln />);
    eigenerTerm(container, "2 · 3 + (4 + 1)");
    // Die Rechnung außerhalb der Klammer steht als erste Karte da.
    fireEvent.click(screen.getByText("2 · 3"));
    expect(screen.getByText(/Klammer zuerst: erst 4 \+ 1/)).toBeTruthy();
    expect(termzeile(container)).toBe("2 · 3 + (4 + 1)");
  });

  it("zeichnet Körbe für ein Produkt und eine Kiste um die Klammer", () => {
    const { container } = render(<Rechenregeln />);
    eigenerTerm(container, "(2 + 3) · 4");
    expect(screen.getByText("📦 Kiste")).toBeTruthy();
    fireEvent.click(screen.getByText("▶︎ Schritt"));
    expect(termzeile(container)).toBe("5 · 4");
    expect(screen.getAllByText("je 4")).toHaveLength(5); // fünf Körbe mit je vier
  });

  it("würfelt auf »Neue Aufgabe« eine andere Aufgabe", () => {
    const { container } = render(<Rechenregeln />);
    fireEvent.click(screen.getByText("🎲 Neue Aufgabe"));
    expect(termzeile(container)).not.toBe("2 + 3 · 4");
  });

  it("sagt bei einem kaputten Term, was fehlt", () => {
    const { container } = render(<Rechenregeln />);
    eigenerTerm(container, "2 + (3");
    expect(screen.getByText(/Klammer wurde nicht geschlossen/)).toBeTruthy();
    expect(termzeile(container)).toBe("2 + 3 · 4");
  });
});

describe("Rechenzug", () => {
  const zeigeZug = () => {
    const r = render(<Rechenregeln />);
    fireEvent.click(screen.getByText("🚂 Rechenzug"));
    return r;
  };

  it("kuppelt die Punktrechnung zu einem Block", () => {
    zeigeZug();
    expect(screen.getByText("Am Anfang")).toBeTruthy();
    expect(screen.getAllByText(/3 · 4 \+ 5 = 17/)).toHaveLength(2); // Anfang und Jetzt
    expect(screen.getAllByText(/^Block \d$/)).toHaveLength(2);
    expect(screen.getByText("fest")).toBeTruthy();
    expect(screen.getByText("lose")).toBeTruthy();
  });

  it("lässt zwei Blöcke tauschen und meldet, dass das Ergebnis bleibt", () => {
    zeigeZug();
    fireEvent.click(screen.getByText("Block 1"));
    fireEvent.click(screen.getByText("Block 2"));
    expect(screen.getByText(/5 \+ 3 · 4 = 17/)).toBeTruthy();
    expect(screen.getByText(/Gleich geblieben/)).toBeTruthy();
  });

  it("zeigt am Minus, dass Vertauschen dort nicht geht", () => {
    const { container } = zeigeZug();
    eigenerTerm(container, "8 − 3");
    fireEvent.click(screen.getByText("8"));
    fireEvent.click(screen.getByText("3"));
    expect(screen.getByText(/3 − 8 = −5/)).toBeTruthy();
    expect(screen.getByText(/Jetzt kommt −5 heraus statt 5/)).toBeTruthy();
  });

  it("nennt beim Teilen das Teilen als Grund, nicht das Minus", () => {
    const { container } = zeigeZug();
    eigenerTerm(container, "12 : 4 + 1");
    fireEvent.click(screen.getByText("12"));
    fireEvent.click(screen.getByText("4"));
    expect(screen.getByText(/Beim Teilen zählt die Reihenfolge/)).toBeTruthy();
  });

  it("erklärt einen Faktor, der auf den Platz eines Summanden fährt", () => {
    const { container } = zeigeZug();
    eigenerTerm(container, "2 + 3 · 4");
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByText("3"));
    expect(screen.getByText(/3 \+ 2 · 4 = 11/)).toBeTruthy();
    expect(screen.getByText(/ein Faktor ist kein Summand/)).toBeTruthy();
  });

  it("würfelt auf »Neue Aufgabe« einen anderen Zug", () => {
    zeigeZug();
    const start = () => screen.getByText("Am Anfang").parentElement!.textContent;
    const vorher = start();
    fireEvent.click(screen.getByText("🎲 Neue Aufgabe"));
    expect(start()).not.toBe(vorher);
  });

  it("fährt nicht mit Klammern", () => {
    const { container } = zeigeZug();
    eigenerTerm(container, "(3 + 4) · 5");
    expect(screen.getByText(/ohne Klammern/)).toBeTruthy();
  });
});

describe("Stufenzahlen", () => {
  const zeigeStufen = () => {
    const r = render(<Rechenregeln />);
    fireEvent.click(screen.getByText("🎚️ Stufenzahlen"));
    return r;
  };

  it("zerlegt 3 · 40 in Kern und Rutsche", () => {
    zeigeStufen();
    expect(screen.getByText(/3 · 40 =/)).toBeTruthy();
    expect(screen.getByText("3 · 4 = 12")).toBeTruthy();
    expect(screen.getByText(/1 Stelle nach links/)).toBeTruthy();
  });

  it("rechnet eigene Zahlen und zählt die Nullen zusammen", () => {
    zeigeStufen();
    fireEvent.change(screen.getByLabelText("erster Faktor"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("zweiter Faktor"), { target: { value: "500" } });
    expect(screen.getByText(/20 · 500 =/)).toBeTruthy();
    expect(screen.getByText("2 · 5 = 10")).toBeTruthy();
    expect(screen.getByText(/3 Stellen nach links/)).toBeTruthy();
  });

  it("legt den zweiten Faktor auf die gewählte Stufenzahl fest", () => {
    zeigeStufen();
    fireEvent.click(screen.getByText("· 100"));
    expect((screen.getByLabelText("zweiter Faktor") as HTMLInputElement).value).toBe("100");
    expect(screen.getByText(/2 Stellen nach links/)).toBeTruthy();
  });

  it("rechnet bei einer reinen Stufenzahl gar nichts aus, sondern rutscht nur", () => {
    zeigeStufen();
    fireEvent.change(screen.getByLabelText("erster Faktor"), { target: { value: "34" } });
    fireEvent.change(screen.getByLabelText("zweiter Faktor"), { target: { value: "10" } });
    expect(screen.getByText(/mal 1 ändert nichts/)).toBeTruthy();
    expect(screen.queryByText("34 · 1 = 34")).toBeNull();
    expect(screen.getByText(/34 · 10 =/)).toBeTruthy();
  });

  it("kommt ohne Nullen ohne Rutsche aus", () => {
    zeigeStufen();
    fireEvent.change(screen.getByLabelText("zweiter Faktor"), { target: { value: "4" } });
    expect(screen.getByText(/Keine Null abgetrennt/)).toBeTruthy();
  });
});
