import { describe, it, expect, vi } from "vitest";
import { getIde, loadProject, type SnapIde } from "@/lib/snapBridge";

/**
 * Snap! meldet einen fehlgeschlagenen Ladevorgang nicht zurück: `loadProjectXML`
 * arbeitet über Animationsframes und bricht bei einem offenen Dialog still ab.
 * Die Brücke muss das erkennen — sonst speichert die Tool-Seite anschließend
 * das alte Projekt unter dem neuen Namen und überschreibt fremde Arbeit.
 */

const XML = (name: string) => `<project name="${name}" app="Snap! 12" version="2"></project>`;

/** IDE-Attrappe: übernimmt den Projektnamen aus dem XML nach `delay` ms. */
function fakeIde(opts: { delay?: number; laedt?: boolean } = {}): SnapIde {
  const { delay = 0, laedt = true } = opts;
  let name = "Vorheriges Projekt";
  return {
    getProjectName: () => name,
    setProjectName: (n: string) => { name = n; },
    getProjectXML: () => XML(name),
    loadProjectXML: (xml: string) => {
      if (!laedt) return; // stiller Fehlschlag, genau wie bei offenem Dialog
      const geladen = xml.match(/name="([^"]*)"/)![1];
      setTimeout(() => { name = geladen; }, delay);
    },
    newProject: () => { name = ""; },
    unsavedChanges: () => false,
  };
}

describe("loadProject", () => {
  it("wartet, bis das Projekt wirklich in der IDE steht", async () => {
    const ide = fakeIde({ delay: 250 });
    await loadProject(ide, XML("Quadrat"), "Quadrat aus Hauspokal");
    expect(ide.getProjectName()).toBe("Quadrat aus Hauspokal");
  });

  it("meldet einen stillen Fehlschlag als Fehler", async () => {
    vi.useFakeTimers();
    const ide = fakeIde({ laedt: false });
    const p = loadProject(ide, XML("Quadrat"), "Titel").catch(e => e);
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    expect(await p).toBeInstanceOf(Error);
    // Der Titel darf gerade nicht gesetzt sein — sonst sähe die Seite ein
    // geladenes Projekt, wo noch das alte steht.
    expect(ide.getProjectName()).not.toBe("Titel");
  });

  it("erkennt den erwarteten Namen auch mit XML-Entities", async () => {
    const ide = fakeIde({ delay: 50 });
    // Snap! liefert den Namen entschlüsselt zurück ("Karte & Weg").
    const xml = '<project name="Karte &amp; Weg" app="Snap! 12"></project>';
    const eigen: SnapIde = {
      ...ide,
      loadProjectXML: () => { setTimeout(() => eigen.setProjectName("Karte & Weg"), 50); },
    };
    await loadProject(eigen, xml, "Endtitel");
    expect(eigen.getProjectName()).toBe("Endtitel");
  });
});

describe("getIde", () => {
  it("liefert null, solange Snap! nicht hochgefahren ist", () => {
    expect(getIde(null)).toBeNull();
    expect(getIde({ contentWindow: {} } as unknown as HTMLIFrameElement)).toBeNull();
    expect(getIde({ contentWindow: { world: { children: [] } } } as unknown as HTMLIFrameElement)).toBeNull();
  });

  it("liefert die IDE, sobald world.children[0] die API trägt", () => {
    const ide = fakeIde();
    const frame = { contentWindow: { world: { children: [ide] } } } as unknown as HTMLIFrameElement;
    expect(getIde(frame)).toBe(ide);
  });
});
