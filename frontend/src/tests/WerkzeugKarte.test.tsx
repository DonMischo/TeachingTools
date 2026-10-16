// Kachel der Übersichtsseiten: Link zum Werkzeug, beim Bearbeiten ohne Link.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WerkzeugKarte } from "@/components/WerkzeugKarte";

vi.mock("@/components/HelpButton", () => ({ default: () => null }));

const KARTE = { slug: "bingo", href: "/aktivitaeten/bingo", icon: "🎰", title: "Bingo", description: "Zahlen ziehen.", color: "#f00" };

describe("WerkzeugKarte", () => {
  it("verlinkt auf das Werkzeug und zeigt Titel und Beschreibung", () => {
    render(<WerkzeugKarte karte={KARTE} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/aktivitaeten/bingo");
    expect(screen.getByText("Bingo")).toBeInTheDocument();
    expect(screen.getByText("Zahlen ziehen.")).toBeInTheDocument();
  });

  it("ohne Link, aber mit Zusatzinhalt", () => {
    render(<WerkzeugKarte karte={KARTE} link={false}><span>Mathe</span></WerkzeugKarte>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Mathe")).toBeInTheDocument();
  });
});
