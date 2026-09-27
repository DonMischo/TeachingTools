import { describe, expect, it } from "vitest";
import {
  TIDE_STUNDEN,
  ORTE,
  springFaktor,
  pegel,
  phase,
  extremwerte,
  uhrzeit,
} from "@/lib/kueste/gezeiten";

describe("pegel", () => {
  it("ist bei Stunde 0 gleich +hub/2 * springFaktor(0) (Springtide-Hochwasser)", () => {
    const hub = 3.0;
    expect(pegel(hub, 0)).toBeCloseTo((hub / 2) * springFaktor(0), 5);
    expect(pegel(hub, 0)).toBeCloseTo((hub / 2) * 1.2, 5);
  });

  it("ist bei TIDE_STUNDEN/2 ungefähr -hub/2 * springFaktor an dieser Stelle", () => {
    const hub = 3.0;
    const stunde = TIDE_STUNDEN / 2;
    const erwartet = -(hub / 2) * springFaktor(stunde / 24);
    expect(pegel(hub, stunde)).toBeCloseTo(erwartet, 5);
  });
});

describe("extremwerte", () => {
  it("wechselt sich zwischen HW und NW ab, mit Abstand TIDE_STUNDEN zwischen zwei HW", () => {
    const hub = 3.0;
    const werte = extremwerte(hub, 0, 48);

    const hws = werte.filter((w) => w.art === "HW");
    const nws = werte.filter((w) => w.art === "NW");
    expect(hws.length).toBeGreaterThanOrEqual(3);
    expect(nws.length).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < werte.length - 1; i++) {
      expect(werte[i].art).not.toBe(werte[i + 1].art);
    }

    for (let i = 0; i < hws.length - 1; i++) {
      expect(hws[i + 1].stunde - hws[i].stunde).toBeCloseTo(TIDE_STUNDEN, 5);
    }
  });

  it("das Hochwasser an Tag 2 ist ca. 50 Minuten später (Uhrzeit) als an Tag 1", () => {
    const hub = 3.0;
    const werte = extremwerte(hub, 0, 48).filter((w) => w.art === "HW");

    // Erstes HW an Tag 1 (nahe Stunde 0) und das HW ca. 24h später
    const hwTag1 = werte.find((w) => w.stunde >= 0 && w.stunde < 24)!;
    const hwTag2 = werte.find((w) => w.stunde >= hwTag1.stunde + 20 && w.stunde <= hwTag1.stunde + 28)!;

    expect(hwTag1).toBeDefined();
    expect(hwTag2).toBeDefined();

    const uhrzeitDifferenzStunden = (hwTag2.stunde - hwTag1.stunde) % 24;
    const differenzMinuten = uhrzeitDifferenzStunden * 60;
    expect(differenzMinuten).toBeGreaterThan(40);
    expect(differenzMinuten).toBeLessThan(60);
  });
});

describe("Ostsee-Orte", () => {
  it("haben einen Tidenhub kleiner als 0.3 m", () => {
    const ostseeOrte = ORTE.filter((o) => o.meer === "Ostsee");
    expect(ostseeOrte.length).toBeGreaterThan(0);
    for (const ort of ostseeOrte) {
      expect(ort.hub).toBeLessThan(0.3);
    }
  });
});

describe("phase", () => {
  it("ist 'Flut' kurz nach einem Niedrigwasser", () => {
    const hub = 3.0;
    const nwStunde = TIDE_STUNDEN / 2;
    expect(phase(hub, nwStunde + 1)).toBe("Flut");
  });

  it("ist 'Ebbe' kurz nach einem Hochwasser", () => {
    const hub = 3.0;
    const hwStunde = TIDE_STUNDEN;
    expect(phase(hub, hwStunde + 1)).toBe("Ebbe");
  });
});

describe("uhrzeit", () => {
  it("formatiert Stunde 0 als 'Tag 1, 00:00'", () => {
    expect(uhrzeit(0)).toBe("Tag 1, 00:00");
  });

  it("formatiert Stunde 25.5 als 'Tag 2, 01:30'", () => {
    expect(uhrzeit(25.5)).toBe("Tag 2, 01:30");
  });
});
