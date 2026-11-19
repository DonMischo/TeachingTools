import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  ANFRAGEN, EINSTELLUNGEN, PRIVAT_AUFGABEN, RECHT_ENTZIEHEN, START_WERTE, SZENARIEN,
  istWisch, storeTreffer, urteilFuer, type HandySystem,
} from "@/lib/maus/mobil";
import {
  SYSTEME, appName, appsFuer, arbeitsflaeche, echtesSystem, fuerSystem, hinweisFremd,
} from "@/lib/maus/system";
import { baueDateisystem, pfadText } from "@/lib/maus/dateisystem";
import { TEILE, HOECHST, GRENZEN, merkePunkte, punkteAuf, sterneAusAltstand } from "@/lib/maus/ergebnis";
import { MausKontext } from "@/components/maus/MausKontext";
import { WindowsKontext } from "@/components/maus/windows/WindowsKontext";
import { WindowsDesktop } from "@/components/maus/windows/WindowsDesktop";
import { STANDARD_AUSSEHEN } from "@/lib/maus/windows";
import StufeRisiken from "@/components/maus/mobil/StufeRisiken";
import StufePrivatsphaere from "@/components/maus/mobil/StufePrivatsphaere";
import StufeBerechtigungen from "@/components/maus/mobil/StufeBerechtigungen";
import StufeFenster from "@/components/maus/StufeFenster";
import { ausrichtungName, uebersetzer } from "@/components/maus/systemText";

const HANDYS: HandySystem[] = ["android", "ios"];

function mitHandy(handy: HandySystem, kind: React.ReactNode) {
  return <MausKontext.Provider value={{ pruefung: false, hilfe: false, handy, setHandy: () => {} }}>{kind}</MausKontext.Provider>;
}

describe("Teil 4 · Daten", () => {
  it("zählt wie die anderen Teile und bleibt unter der Gesamtgrenze", () => {
    expect(TEILE[4]).toEqual(["handy", "appstore", "berechtigungen", "privatsphaere", "risiken"]);
    const summe = Object.values(HOECHST).reduce((s, n) => s + n, 0);
    expect(summe).toBeLessThanOrEqual(GRENZEN.gesamt);
  });

  for (const h of HANDYS) {
    it(`${h}: jeder Aufgaben-Weg führt über echte Menüpunkte, und keine Aufgabe ist am Anfang schon gelöst`, () => {
      for (const a of [...PRIVAT_AUFGABEN[h], RECHT_ENTZIEHEN[h]]) {
        expect(a.pfad[0]).toBe("start");
        for (let i = 0; i + 1 < a.pfad.length; i++) {
          const zeilen = EINSTELLUNGEN[h][a.pfad[i]].zeilen;
          expect(zeilen.some(z => z.art === "link" && z.ziel === a.pfad[i + 1]), `${a.id}: ${a.pfad[i]} → ${a.pfad[i + 1]}`).toBe(true);
        }
        expect(a.geschafft(START_WERTE[h]), a.id).toBe(false);
      }
    });

    it(`${h}: jede Berechtigungsfrage hat mindestens eine lösende Antwort`, () => {
      for (const f of ANFRAGEN[h]) {
        expect(f.antworten.some(a => a.urteil === "gut" || a.urteil === "ok"), f.id).toBe(true);
      }
    });
  }

  it("gibt beim Standort mit »Genau« an nur »ok« statt »gut«", () => {
    const wetter = ANFRAGEN.android.find(a => a.id === "wetter")!;
    const erlauben = wetter.antworten[0];
    expect(urteilFuer(wetter, erlauben, true).urteil).toBe("ok");
    expect(urteilFuer(wetter, erlauben, false).urteil).toBe("gut");
  });

  it("jedes Risiko-Szenario hat genau eine sichere Antwort", () => {
    for (const s of SZENARIEN) expect(s.optionen.filter(o => o.gut).length, s.id).toBe(1);
  });

  it("findet im Store drei Mal-Apps, darunter genau eine passende", () => {
    const t = storeTreffer("malen");
    expect(t).toHaveLength(3);
    expect(t.filter(a => a.urteil.passt).map(a => a.id)).toEqual(["malblock"]);
    expect(storeTreffer("ma")).toEqual([]);
  });

  it("erkennt einen Wisch von oben nach unten nur, wenn er oben beginnt", () => {
    expect(istWisch({ x: 0.5, y: 0.02 }, { x: 0.5, y: 0.4 }, "runter", { oben: 0.12 })).toBe(true);
    expect(istWisch({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.9 }, "runter", { oben: 0.12 })).toBe(false);
    expect(istWisch({ x: 0.2, y: 0.02 }, { x: 0.2, y: 0.4 }, "runter", { oben: 0.12, rechts: 0.5 })).toBe(false);
    expect(istWisch({ x: 0.5, y: 0.97 }, { x: 0.5, y: 0.5 }, "hoch", { unten: 0.12 })).toBe(true);
  });
});

describe("Betriebssysteme", () => {
  it("ersetzt fehlende Apps und benennt um", () => {
    expect(fuerSystem(["explorer", "edge", "word", "firefox"], "ubuntu")).toEqual(["explorer", "writer", "firefox"]);
    expect(appName("explorer", "macos")).toBe("Finder");
    expect(appName("word", "ubuntu")).toBe("LibreOffice Writer");
    expect(appsFuer("ubuntu").edge).toBeUndefined();
    expect(appsFuer("macos").irfanview).toBeUndefined();
    expect(fuerSystem(["irfanview", "reader"], "macos")).toEqual(["reader"]);
  });

  it("legt die Fensterfläche je nach Leiste und Dock fest", () => {
    expect(arbeitsflaeche("windows")).toEqual({ x: 0, y: 0, w: 900, h: 458 });
    expect(arbeitsflaeche("ubuntu").x).toBe(60);
    expect(arbeitsflaeche("ubuntu", true).x).toBe(0);
    expect(arbeitsflaeche("macos").y).toBe(25);
  });

  it("erkennt das echte System und erklärt Kürzel am fremden", () => {
    expect(echtesSystem("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(echtesSystem("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("macos");
    expect(echtesSystem("Mozilla/5.0 (X11; Linux x86_64)")).toBe("ubuntu");
    expect(echtesSystem("Mozilla/5.0 (X11; CrOS x86_64)")).toBeNull();
    expect(hinweisFremd("windows", "windows")).toBeNull();
    expect(hinweisFremd("macos", "windows")).toMatch(/Strg/);
    expect(SYSTEME.macos.kuerzel.kopieren).toBe("[[⌘]]+[[C]]");
  });

  it("baut das Dateisystem mit den Namen des Systems", () => {
    const u = baueDateisystem("Mia", true, "ubuntu");
    expect(pfadText(u, "dokumente", "ubuntu")).toBe("/home/mia/Dokumente");
    expect(pfadText(u, "usb", "ubuntu")).toBe("/media/mia/USB-Stick");
    expect(u.desktop.name).toBe("Schreibtisch");
    const m = baueDateisystem("Mia", false, "macos");
    expect(pfadText(m, "videos", "macos")).toBe("Macintosh HD › Benutzer › mia › Filme");
    const w = baueDateisystem("Mia", false);
    expect(w.desktop.name).toBe("Desktop");
  });

  it("zeichnet Ubuntu mit »Aktivitäten« und Dock, macOS mit Menüleiste", () => {
    for (const system of ["ubuntu", "macos"] as const) {
      const { unmount } = render(
        <WindowsKontext.Provider value={{ aussehen: STANDARD_AUSSEHEN, setAussehen: () => {}, benutzer: "Mia", system }}>
          <WindowsDesktop />
        </WindowsKontext.Provider>,
      );
      expect(screen.getByTestId("windows-desktop").dataset.system).toBe(system);
      expect(document.querySelector("[data-start]")).toBeTruthy();
      expect(document.querySelector("[data-suche]")).toBeTruthy();
      if (system === "ubuntu") {
        expect(screen.getByText("Aktivitäten")).toBeInTheDocument();
        expect(document.querySelector('[data-taskleiste="edge"]')).toBeNull();
      } else {
        expect(screen.getByText("Ablage")).toBeInTheDocument();
        expect(document.querySelector('[data-taskleiste="explorer"]')!.getAttribute("aria-label")).toBe("Finder");
      }
      unmount();
    }
  });
});

describe("Texte je System", () => {
  it("überträgt Windows-Begriffe mit passendem Artikel", () => {
    expect(uebersetzer("ubuntu")("Klick unten in der Taskleiste auf den Explorer.")).toBe("Klick links im Dock auf den Dateimanager.");
    expect(uebersetzer("macos")("Tipp: Einstellungen › Konten › Profilbild.")).toBe("Tipp: Systemeinstellungen › Benutzer & Gruppen.");
    expect(uebersetzer("macos")("Von Taskleiste lösen")).toBe("Aus dem Dock entfernen");
    expect(uebersetzer("windows")("die Taskleiste")).toBe("die Taskleiste");
    expect(ausrichtungName("mitte", "ubuntu")).toBe("Links");
    expect(ausrichtungName("links", "macos")).toBe("Links");
  });

  it("macOS: Fensterknöpfe links vor dem Titel, rot zuerst", () => {
    render(
      <WindowsKontext.Provider value={{ aussehen: STANDARD_AUSSEHEN, setAussehen: () => {}, benutzer: "Mia", system: "macos" }}>
        <StufeFenster avatar="cat" onFertig={() => {}} onWeiter={() => {}} />
      </WindowsKontext.Provider>,
    );
    const leiste = screen.getByRole("button", { name: "Minimieren" }).closest(".cursor-grab")!;
    expect(leiste.textContent).toContain("Notizen – TextEdit");
    const knoepfe = [...leiste.querySelectorAll("button")].map(b => b.getAttribute("aria-label"));
    expect(knoepfe).toEqual(["Schließen", "Minimieren", "Maximieren"]);
    expect(leiste.firstElementChild!.contains(leiste.querySelector('[aria-label="Schließen"]'))).toBe(true);
  });
});

describe("Teil 4 · Stufen", () => {
  it("Risiken: falsche Wahl zählt, richtige erklärt — nach allen Lagen kommt die Hilfe", () => {
    const onFertig = vi.fn();
    render(mitHandy("ios", <StufeRisiken avatar="cat" onFertig={onFertig} onWeiter={() => {}} />));
    for (const s of SZENARIEN) {
      const falsch = s.optionen.findIndex(o => !o.gut);
      fireEvent.click(document.querySelector(`[data-option="${falsch}"]`)!);
      expect(document.querySelector("[data-erklaerung]")!.textContent).toContain("❌");
      fireEvent.click(document.querySelector(`[data-option="${s.optionen.findIndex(o => o.gut)}"]`)!);
      fireEvent.click(screen.getByRole("button", { name: /Nächste Nachricht|Fertig/ }));
    }
    expect(onFertig).toHaveBeenCalledTimes(1);
    expect(onFertig.mock.calls[0][0].details[1]).toMatch(/10 Fehlversuche/);
    expect(document.querySelector("[data-hilfe]")!.textContent).toContain("116 111");
  });

  it("Privatsphäre (Android): Displaysperre auf PIN löst die erste Aufgabe, »Wischen« zählt als Fehler", () => {
    vi.useFakeTimers();
    render(mitHandy("android", <StufePrivatsphaere avatar="cat" onFertig={() => {}} onWeiter={() => {}} />));
    fireEvent.click(document.querySelector('[data-zeile="Sicherheit und Datenschutz"]')!);
    fireEvent.click(document.querySelector('[data-zeile="Displaysperre"]')!);
    fireEvent.click(document.querySelector('[data-option="Keine"]')!);
    expect(screen.getByText(/nicht geschützt/)).toBeInTheDocument();
    fireEvent.click(document.querySelector('[data-zeile="Displaysperre"]')!);
    fireEvent.click(document.querySelector('[data-option="PIN"]')!);
    expect(screen.getByText(/sicherer/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(800); });
    expect(document.querySelector("[data-seite]")!.getAttribute("data-seite")).toBe("start");
    vi.useRealTimers();
  });

  it("Berechtigungen (iOS): Taschenlampe will Kontakte — »Nicht erlauben« ist richtig", () => {
    render(mitHandy("ios", <StufeBerechtigungen avatar="cat" onFertig={() => {}} onWeiter={() => {}} />));
    fireEvent.click(document.querySelector('[data-antwort="Vollen Zugriff erlauben"]')!);
    expect(document.querySelector("[data-erklaerung]")!.textContent).toMatch(/braucht keine Kontakte/);
    expect(screen.queryByRole("button", { name: /Nächste Frage/ })).toBeNull();
    fireEvent.click(document.querySelector('[data-antwort="Nicht erlauben"]')!);
    fireEvent.click(screen.getByRole("button", { name: /Nächste Frage/ }));
    expect(screen.getAllByText(/Oma/).length).toBeGreaterThan(0);
  });
});

describe("Sterne je System", () => {
  it("hält Computer- und Handy-Stufen je System getrennt, Klickspiele gelten überall", () => {
    let je = merkePunkte({}, "explorer", "windows", "android", 900);
    je = merkePunkte(je, "risiken", "ubuntu", "ios", 700);
    je = merkePunkte(je, "klick", "windows", "android", 5000);
    expect(punkteAuf(je, "explorer", "windows", "ios")).toBe(900);
    expect(punkteAuf(je, "explorer", "macos", "android")).toBe(0);
    expect(punkteAuf(je, "risiken", "windows", "ios")).toBe(700);
    expect(punkteAuf(je, "risiken", "ubuntu", "android")).toBe(0);
    expect(punkteAuf(je, "klick", "macos", "ios")).toBe(5000);
  });

  it("behält den Bestwert und übernimmt einen alten Stand fürs zuletzt gewählte System", () => {
    const je = merkePunkte(merkePunkte({}, "apps", "macos", "android", 800), "apps", "macos", "android", 300);
    expect(punkteAuf(je, "apps", "macos", "android")).toBe(800);
    const alt = sterneAusAltstand({ apps: { punkte: 600, dauerMs: 1, details: [] } }, "ubuntu", "android");
    expect(punkteAuf(alt, "apps", "ubuntu", "android")).toBe(600);
    expect(punkteAuf(alt, "apps", "windows", "android")).toBe(0);
  });
});
