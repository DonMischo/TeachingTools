/**
 * Das Labor darf einen gespeicherten Aufbau niemals beim Öffnen verlieren.
 *
 * Der Fehler, der hier festgehalten wird: Laden und Speichern liefen im selben
 * Durchgang los, und der Speicher-Effekt schrieb die noch leere Anfangsszene
 * über den gespeicherten Aufbau. Unter StrictMode (das Standalone-Bündel läuft
 * darin) montiert React zweimal — der zweite Ladevorgang las dann den eben
 * gelöschten Stand und der Aufbau war endgültig weg.
 */
import { StrictMode } from "react";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";
import PhysikLabor from "@/components/physik/PhysikLabor";
import { alsJSON, ausJSON, neueSzene, stelle, verbinde } from "@/lib/physik/szene";

beforeAll(() => {
  // jsdom kennt beides nicht; die Werkbank kommt ohne sie aus.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // Eine Leinwand, die alles klaglos entgegennimmt: gezeichnet wird in jsdom
  // ohnehin nichts, geprüft wird, was danach im Text steht.
  const leinwand = new Proxy({}, { get: () => () => {}, set: () => true });
  HTMLCanvasElement.prototype.getContext = (() => leinwand) as unknown as HTMLCanvasElement["getContext"];
});

beforeEach(() => localStorage.clear());

const SCHLUESSEL = "pruefung";
const ABLAGE = `physik-aufbau-v1:${SCHLUESSEL}`;

function gespeicherterAufbau() {
  let s = stelle(neueSzene(), "stativ", { x: 0, y: 0 });
  s = stelle(s, "massestueck", { x: 0, y: 1 });
  return verbinde(s, { geraet: s.geraete[0].id, port: "haken" }, { geraet: s.geraete[1].id, port: "oese" });
}

/**
 * Die Uhr läuft über requestAnimationFrame. In jsdom (und in einem
 * verborgenen Fenster) feuert das nicht von selbst, also werden die Bilder
 * hier von Hand durchgeschoben.
 */
function mitBildern() {
  // cancelAnimationFrame muss hier wirklich abbestellen: sonst liefe ein vor
  // dem Anhalten angemeldetes Bild noch einmal, meldete sich dabei neu an —
  // und das Anhalten waere gar nicht pruefbar.
  let naechste = 1;
  const offen = new Map<number, FrameRequestCallback>();
  const echtesRAF = globalThis.requestAnimationFrame;
  const echtesCAF = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = naechste++;
    offen.set(id, cb);
    return id;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => { offen.delete(id); }) as typeof cancelAnimationFrame;

  let uhr = performance.now();
  return {
    bilder(n: number) {
      for (let i = 0; i < n; i++) {
        const dran = [...offen.values()];
        offen.clear();
        uhr += 50; // 50 ms je Bild — reichlich Simulationsschritte je Runde
        act(() => dran.forEach(cb => cb(uhr)));
      }
    },
    zurueck() {
      globalThis.requestAnimationFrame = echtesRAF;
      globalThis.cancelAnimationFrame = echtesCAF;
    },
  };
}

describe("PhysikLabor", () => {
  it("behält den gespeicherten Aufbau beim Öffnen", () => {
    localStorage.setItem(ABLAGE, alsJSON(gespeicherterAufbau()));

    render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);

    const nachher = ausJSON(localStorage.getItem(ABLAGE)!);
    expect(nachher.geraete).toHaveLength(2);
    expect(nachher.verbindungen).toHaveLength(1);
  });

  it("behält ihn auch unter StrictMode, das zweimal montiert", () => {
    localStorage.setItem(ABLAGE, alsJSON(gespeicherterAufbau()));

    render(
      <StrictMode>
        <PhysikLabor speicherSchluessel={SCHLUESSEL} />
      </StrictMode>,
    );

    const nachher = ausJSON(localStorage.getItem(ABLAGE)!);
    expect(nachher.geraete).toHaveLength(2);
    expect(nachher.verbindungen).toHaveLength(1);
  });

  it("zeigt den geladenen Aufbau auch an", () => {
    localStorage.setItem(ABLAGE, alsJSON(gespeicherterAufbau()));

    const { getByLabelText } = render(
      <StrictMode>
        <PhysikLabor speicherSchluessel={SCHLUESSEL} />
      </StrictMode>,
    );

    // Der Titel kommt aus der geladenen Szene, nicht aus der leeren Voreinstellung.
    expect(getByLabelText("Name des Aufbaus")).toHaveValue("Neuer Aufbau");
    expect(document.body.textContent).not.toContain("Der Tisch ist leer");
  });
});

describe("Oszilloskop im Labor", () => {
  it("bietet die Signale der aufgestellten Geräte als Kanäle an", () => {
    let s = stelle(neueSzene(), "signalgeber", { x: 0, y: 0.5 });
    s = stelle(s, "kraftmesser", { x: 0.4, y: 0.5 });
    localStorage.setItem(ABLAGE, alsJSON(s));

    const { getByLabelText } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);

    const kanal1 = getByLabelText("Kanal 1") as HTMLSelectElement;
    const beschriftungen = [...kanal1.options].map(o => o.textContent);
    expect(beschriftungen).toContain("Funktionsgenerator · Spannung");
    expect(beschriftungen).toContain("Kraftmesser · Kraft");
  });

  it("legt das erste Signal von selbst auf Kanal 1", () => {
    localStorage.setItem(ABLAGE, alsJSON(stelle(neueSzene(), "signalgeber", { x: 0, y: 0.5 })));

    const { getByLabelText } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);

    expect((getByLabelText("Kanal 1") as HTMLSelectElement).value).not.toBe("");
  });

  it("sagt es, wenn es nichts zu messen gibt", () => {
    const { getByText } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);
    expect(getByText(/Noch nichts zu messen/)).toBeInTheDocument();
  });
});

describe("Messkette im Labor", () => {
  it("zeigt die Spannung des Generators auf Kanal 1 an", () => {
    localStorage.setItem(ABLAGE, alsJSON(stelle(neueSzene(), "signalgeber", { x: 0, y: 0.5 })));
    const uhr = mitBildern();
    try {
      const { getByRole } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);
      const kanal = getByRole("group", { name: "Kanal 1 Einstellung" });

      // Vor dem ersten Bild steht noch nichts da.
      expect(kanal.textContent).toContain("—");

      uhr.bilder(10);

      // Danach eine echte Spannung — der Wert geht durch Rechenwerk, Messbus
      // und Oszilloskop und kommt als Text mit Einheit wieder heraus.
      expect(kanal.textContent).toMatch(/-?\d+(,\d+)?\s*[munk]?V/);
    } finally {
      uhr.zurueck();
    }
  });

  it("hält die Uhr an, wenn man sie anhält", () => {
    localStorage.setItem(ABLAGE, alsJSON(stelle(neueSzene(), "signalgeber", { x: 0, y: 0.5 })));
    const uhr = mitBildern();
    try {
      const { getByRole } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);
      uhr.bilder(10);
      const kanal = getByRole("group", { name: "Kanal 1 Einstellung" });

      act(() => getByRole("button", { name: /Anhalten/ }).click());
      uhr.bilder(5);
      const stehengeblieben = kanal.textContent;
      uhr.bilder(5);

      expect(kanal.textContent).toBe(stehengeblieben);
    } finally {
      uhr.zurueck();
    }
  });
});

describe("Pendel im Labor", () => {
  it("legt den Pendelwinkel als Signal aufs Oszilloskop — in Grad, nicht im Bogenmaß", () => {
    localStorage.setItem(ABLAGE, alsJSON(stelle(neueSzene(), "fadenpendel", { x: 0, y: 1.2 })));
    const uhr = mitBildern();
    try {
      const { getByLabelText, getByRole } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);
      const kanal1 = getByLabelText("Kanal 1") as HTMLSelectElement;
      expect([...kanal1.options].map(o => o.textContent)).toContain("Fadenpendel · Winkel");

      uhr.bilder(10);

      // Gespeichert wird rad, angezeigt Grad — die Regel des Labors.
      expect(getByRole("group", { name: "Kanal 1 Einstellung" }).textContent).toMatch(/-?\d+(,\d+)?\s*°/);
    } finally {
      uhr.zurueck();
    }
  });

  it("lässt das Pendel wirklich schwingen", () => {
    localStorage.setItem(ABLAGE, alsJSON(stelle(neueSzene(), "fadenpendel", { x: 0, y: 1.2 })));
    const uhr = mitBildern();
    try {
      const { getByRole } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);
      const kanal = getByRole("group", { name: "Kanal 1 Einstellung" });

      uhr.bilder(2);
      const frueh = kanal.textContent;
      // Ein Fadenpendel mit 1 m braucht rund 2 s je Schwingung; nach gut
      // einer halben Sekunde steht es sicher woanders.
      uhr.bilder(12);

      expect(kanal.textContent).not.toBe(frueh);
    } finally {
      uhr.zurueck();
    }
  });
});

describe("Inspektor", () => {
  it("zeigt angehalten die Werte des angetippten Geräts mit Formel", () => {
    localStorage.setItem(ABLAGE, alsJSON(stelle(neueSzene(), "fadenpendel", { x: 0, y: 1.2 })));
    const uhr = mitBildern();
    try {
      const { getByRole, getByLabelText } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);
      uhr.bilder(6);

      // Gerät antippen und anhalten.
      act(() => getByLabelText("Fadenpendel auf den Tisch stellen").click());
      act(() => getByRole("button", { name: /Anhalten/ }).click());

      const text = document.body.textContent ?? "";
      expect(text).toContain("Lageenergie");
      expect(text).toContain("E_pot = m · g · h");
      expect(text).toContain("Schwingungsdauer");
    } finally {
      uhr.zurueck();
    }
  });

  it("sagt nichts, solange die Uhr läuft und nichts ausgewählt ist", () => {
    localStorage.setItem(ABLAGE, alsJSON(stelle(neueSzene(), "fadenpendel", { x: 0, y: 1.2 })));
    const uhr = mitBildern();
    try {
      render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);
      uhr.bilder(4);
      expect(document.body.textContent).not.toContain("E_pot = m · g · h");
    } finally {
      uhr.zurueck();
    }
  });
});

describe("Marker", () => {
  it("bietet das Setzen und das Anhalten bei Berührung an", () => {
    const { getByRole, getByText } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);
    expect(getByRole("button", { name: /Marker setzen/ })).toBeInTheDocument();
    expect(getByText(/Bei Berührung anhalten/)).toBeInTheDocument();
  });
});

describe("Marker bleiben stehen", () => {
  /** Pendel mit Klotz in der Bahn — im realen Modell stossen sie zusammen. */
  function mitStoss() {
    let s = stelle(neueSzene(), "fadenpendel", { x: 0, y: 1.2 });
    const pendel = s.geraete[0].id;
    s = { ...s, geraete: s.geraete.map(g => (g.id === pendel
      ? { ...g, werte: { laenge: 1.1, masse: 3, startwinkel: -1, daempfung: 0 } } : g)) };
    s = stelle(s, "massestueck", { x: 0.4, y: 0.09 });
    const klotz = s.geraete[1].id;
    s = { ...s, geraete: s.geraete.map(g => (g.id === klotz ? { ...g, werte: { masse: 20 } } : g)) };
    return { ...s, treue: "real" as const };
  }

  const anzahlMarker = (text: string) => Number(/🧹 (\d+) Marker/.exec(text)?.[1] ?? 0);

  it("hält »Messung neu« stand", () => {
    localStorage.setItem(ABLAGE, alsJSON(mitStoss()));
    const uhr = mitBildern();
    try {
      const { getByRole } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);

      // Lange genug laufen lassen, dass das Pendel den Klotz trifft.
      uhr.bilder(40);
      const vorher = anzahlMarker(document.body.textContent ?? "");
      expect(vorher).toBeGreaterThan(0);

      act(() => getByRole("button", { name: /Messung neu/ }).click());

      // Die Uhr faengt neu an — die festgehaltenen Ereignisse bleiben.
      expect(anzahlMarker(document.body.textContent ?? "")).toBe(vorher);
    } finally {
      uhr.zurueck();
    }
  });

  it("nimmt nach »Messung neu« weiter neue auf", () => {
    // Die Doppelgaenger-Pruefung verglich Zeiten vorzeichenbehaftet. Nach dem
    // Zuruecksetzen steht die Uhr wieder bei null, und jeder neue Stoss galt
    // als Wiederholung eines alten.
    localStorage.setItem(ABLAGE, alsJSON(mitStoss()));
    const uhr = mitBildern();
    try {
      const { getByRole } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);
      uhr.bilder(40);
      const vorher = anzahlMarker(document.body.textContent ?? "");

      act(() => getByRole("button", { name: /Messung neu/ }).click());
      uhr.bilder(40);

      expect(anzahlMarker(document.body.textContent ?? "")).toBeGreaterThan(vorher);
    } finally {
      uhr.zurueck();
    }
  });

  it("lässt sich mit »🧹 Marker« leeren", () => {
    localStorage.setItem(ABLAGE, alsJSON(mitStoss()));
    const uhr = mitBildern();
    try {
      const { getByRole, queryByRole } = render(<PhysikLabor speicherSchluessel={SCHLUESSEL} />);
      uhr.bilder(40);
      act(() => getByRole("button", { name: /Marker$/ }).click());
      expect(queryByRole("button", { name: /Marker$/ })).toBeNull();
    } finally {
      uhr.zurueck();
    }
  });
});
