import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import StufeTaskleiste from "@/components/maus/StufeTaskleiste";
import StufeProfil from "@/components/maus/StufeProfil";
import { Sperrbildschirm } from "@/components/maus/windows/Sperrbildschirm";
import { WindowsKontext } from "@/components/maus/windows/WindowsKontext";
import { STANDARD_AUSSEHEN, type Aussehen } from "@/lib/maus/windows";
import { istNachNameSortiert, nachNameSortiert } from "@/lib/maus/taskleiste";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";

afterEach(() => { vi.useRealTimers(); });

let stand: Aussehen = STANDARD_AUSSEHEN;

function Rahmen({ kind, start = STANDARD_AUSSEHEN, onFertig = () => {} }: {
  kind: "taskleiste" | "profil"; start?: Aussehen; onFertig?: (e: StufenErgebnis) => void;
}) {
  const [aussehen, setAussehen] = useState<Aussehen>(start);
  stand = aussehen;
  const Stufe = kind === "taskleiste" ? StufeTaskleiste : StufeProfil;
  return (
    <WindowsKontext.Provider value={{ aussehen, setAussehen, benutzer: "Mia", system: "windows" }}>
      <Stufe avatar="fox" onFertig={onFertig} onWeiter={() => {}} />
    </WindowsKontext.Provider>
  );
}

const q = (sel: string) => document.querySelector(sel) as HTMLElement;
const menuePunkt = (text: string) => screen.getAllByRole("menuitem").find(b => b.textContent?.includes(text))!;
const weiter = () => act(() => { vi.advanceTimersByTime(800); });

describe("Maus-Führerschein: Stufe Taskleiste & Start", () => {
  it("löst alle vier Aufgaben: anheften, lösen, ausrichten, sortieren", () => {
    vi.useFakeTimers();
    const onFertig = vi.fn();
    render(<Rahmen kind="taskleiste" onFertig={onFertig} />);

    // 1) Start öffnen, Rechtsklick auf Paint, anheften
    fireEvent.click(q("[data-start]"));
    fireEvent.contextMenu(q('[data-start-app="paint"]'));
    fireEvent.click(menuePunkt("An Taskleiste anheften"));
    expect(stand.taskleiste).toContain("paint");
    weiter();

    // 2) Rechtsklick auf Word in der Taskleiste, lösen
    fireEvent.contextMenu(q('[data-taskleiste="word"]'));
    fireEvent.click(menuePunkt("Von Taskleiste lösen"));
    expect(stand.taskleiste).not.toContain("word");
    weiter();

    // 3) Einstellungen › Taskleiste › Links
    fireEvent.click(q('[data-taskleiste="einstellungen"]'));
    fireEvent.click(q('[data-ausrichtung="links"]'));
    expect(stand.ausrichtung).toBe("links");
    weiter();

    // 4) Rechtsklick auf den freien Desktop, nach Namen sortieren
    fireEvent.click(screen.getByLabelText("Schließen"));
    fireEvent.contextMenu(screen.getByTestId("windows-desktop"));
    fireEvent.click(menuePunkt("Sortieren nach: Name"));
    expect(istNachNameSortiert(stand.desktop)).toBe(true);
    weiter();

    expect(onFertig).toHaveBeenCalledTimes(1);
    expect(onFertig.mock.calls[0][0].details[1]).toContain("0 Fehlversuche");
  });

  it("zählt eine falsch angeheftete App als Fehlversuch", () => {
    vi.useFakeTimers();
    render(<Rahmen kind="taskleiste" />);
    fireEvent.click(q("[data-start]"));
    fireEvent.contextMenu(q('[data-start-app="excel"]'));
    fireEvent.click(menuePunkt("An Taskleiste anheften"));
    expect(screen.getByText(/Das war nicht Paint/)).toBeInTheDocument();
  });

  it("löst Aufgabe 1 bis 3 auch über die Schalter in den Einstellungen", () => {
    vi.useFakeTimers();
    render(<Rahmen kind="taskleiste" />);
    fireEvent.click(q('[data-taskleiste="einstellungen"]'));
    fireEvent.click(q('[data-taskleiste-schalter="paint"]'));
    weiter();
    fireEvent.click(q('[data-taskleiste-schalter="word"]'));
    weiter();
    fireEvent.click(q('[data-ausrichtung="links"]'));
    expect(screen.getByText("Genau — die Taskleiste sitzt jetzt anders!")).toBeInTheDocument();
  });

  it("mischt einen schon sortierten Desktop zu Beginn", () => {
    render(<Rahmen kind="taskleiste" start={{ ...STANDARD_AUSSEHEN, desktop: nachNameSortiert(STANDARD_AUSSEHEN.desktop) }} />);
    expect(istNachNameSortiert(stand.desktop)).toBe(false);
  });
});

describe("Maus-Führerschein: Sperrbildschirm & Profil", () => {
  it("Klick → Anmeldung → »Anmelden« entsperrt, ohne Passwortfeld", () => {
    const onEntsperrt = vi.fn();
    render(<Sperrbildschirm aussehen={{ ...STANDARD_AUSSEHEN, begruessung: "Hallo Mia!" }} benutzer="Mia" onEntsperrt={onEntsperrt} />);
    expect(screen.getByText("Hallo Mia!")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sperrbildschirm"));
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByText("Mia")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("anmelden"));
    expect(onEntsperrt).toHaveBeenCalledTimes(1);
  });

  it("löst alle vier Aufgaben bis zum Sperren und Anmelden", () => {
    vi.useFakeTimers();
    const onFertig = vi.fn();
    render(<Rahmen kind="profil" onFertig={onFertig} />);
    fireEvent.click(q('[data-taskleiste="einstellungen"]'));
    fireEvent.click(q('[title="fox"]'));
    expect(stand.profilTier).toBe("fox");
    weiter();
    fireEvent.click(q('[data-einstellung-nav="sperrbildschirm"]'));
    fireEvent.click(q('[data-sperrbild="wald"]'));
    weiter();
    const feld = q('input[type="text"]') as HTMLInputElement;
    fireEvent.change(feld, { target: { value: "Moin!" } });
    fireEvent.keyDown(feld, { key: "Enter" });
    weiter();
    fireEvent.click(screen.getByLabelText("Schließen"));
    fireEvent.click(q("[data-start]"));
    fireEvent.click(q("[data-startmenue] > div:last-child > button"));
    fireEvent.click(screen.getByText("🔒 Sperren"));
    fireEvent.click(screen.getByTestId("sperrbildschirm"));
    fireEvent.click(screen.getByTestId("anmelden"));
    weiter();
    expect(onFertig).toHaveBeenCalledTimes(1);
  });
});
