/**
 * PC-Werkstatt: Die Gerätedaten passen zusammen, ein richtiger Bau startet,
 * typische Fehler führen zur passenden Meldung, und der Tipp-Knopf führt
 * Schritt für Schritt zu einem fertigen Gerät.
 */
import { describe, expect, it } from "vitest";
import { GERAETE } from "@/lib/pcbau/geraete";
import {
  ausbauen, einbauen, einschalten, hindernis, istDrin, kabel, kabelAbziehen, kabelDrin, kabelKnoten, komplett, port, stecken, steckenAnKnoten, teil, tipp, vollstaendig,
} from "@/lib/pcbau/logik";
import { LEER, type Bau, type Bedingung, type Geraet } from "@/lib/pcbau/typen";

const geraet = (id: string) => GERAETE.find(g => g.id === id)!;
const ohne = (g: Geraet, bau: Bau, id: string): Bau => kabel(g, id) ? kabelAbziehen(bau, id) : ausbauen(g, bau, id);
const falsch = (g: Geraet, bau: Bau, id: string): Bau => {
  const f = (teil(g, id) ?? kabel(g, id))!.frage!;
  return { ...bau, antworten: { ...bau.antworten, [id]: f.optionen.findIndex(o => !o.richtig) } };
};

describe("Gerätedaten", () => {
  for (const g of GERAETE) {
    it(`${g.name}: Verweise stimmen und IDs sind eindeutig`, () => {
      const ids = [...g.teile.map(t => t.id), ...g.kabel.map(k => k.id)];
      expect(new Set(ids).size).toBe(ids.length);
      const ports = g.teile.flatMap(t => t.ports ?? []).map(p => p.id);
      expect(new Set(ports).size).toBe(ports.length);
      for (const t of g.teile) {
        for (const b of [...(t.braucht ?? []), ...(t.auf ? [t.auf] : [])]) expect(teil(g, b), `${t.id} → ${b}`).toBeTruthy();
        if (t.frage) expect(t.frage.optionen.filter(o => o.richtig)).toHaveLength(1);
      }
      for (const k of g.kabel) {
        for (const p of k.enden.flat()) expect(port(g, p), `${k.id} → ${p}`).toBeTruthy();
        for (const s of kabelKnoten(g, k)) expect(teil(g, s)?.schema, `${k.id} → ${s}`).toBeTruthy();
        if (k.frage) expect(k.frage.optionen.filter(o => o.richtig)).toHaveLength(1);
      }
      for (const v of g.verbindungen) {
        expect(teil(g, v.von)?.schema, v.von).toBeTruthy();
        expect(teil(g, v.nach)?.schema, v.nach).toBeTruthy();
      }
      const ref = (b: Bedingung) => "fehlt" in b ? [b.fehlt] : "drin" in b ? [b.drin] : "falsch" in b ? [b.falsch] : "teilweise" in b ? b.teilweise : b.keins;
      for (const p of g.pruefungen) for (const b of p.wenn) for (const id of ref(b)) expect(ids, id).toContain(id);
    });
  }
});

describe("Zusammenbauen", () => {
  for (const g of GERAETE.filter(x => x.bauen)) {
    it(`${g.name}: komplett gebaut startet ohne Warnung, leer bleibt aus`, () => {
      const bau = komplett(g);
      expect(vollstaendig(g, bau)).toBe(true);
      expect(einschalten(g, bau)).toEqual({ stufe: "ok", warnungen: [] });
      expect(einschalten(g, LEER).stufe).toBe("aus");
    });

    it(`${g.name}: dem Tipp-Knopf folgen ergibt ein fertiges Gerät`, () => {
      let bau = LEER;
      for (let i = 0; i < 50; i++) {
        const t = tipp(g, bau);
        if (!t) break;
        const richtig = (teil(g, t.id) ?? kabel(g, t.id))?.frage?.optionen.findIndex(o => o.richtig);
        if (t.art === "teil") bau = einbauen(g, bau, t.id, richtig);
        else {
          for (const ende of kabel(g, t.id)!.enden) {
            const r = ende.map(p => stecken(g, bau, t.id, p)).find(x => x.ok);
            expect(r, `${t.id}`).toBeTruthy();
            bau = r!.bau;
          }
          if (richtig !== undefined) bau = { ...bau, antworten: { ...bau.antworten, [t.id]: richtig } };
        }
      }
      expect(vollstaendig(g, bau)).toBe(true);
      expect(einschalten(g, bau).stufe).toBe("ok");
    });

    it(`${g.name}: jedes nötige Teil fehlt → kein normaler Start`, () => {
      const voll = komplett(g);
      for (const t of g.teile.filter(x => !x.fest && !x.optional)) {
        expect(einschalten(g, ausbauen(g, voll, t.id)).stufe, t.id).not.toBe("ok");
      }
    });
  }

  it("PC: ohne RAM lange Pieptöne, CPU gedrückt = kaputt, RAM falsch = Warnung", () => {
    const g = geraet("pc");
    const voll = komplett(g);
    const r = einschalten(g, ausbauen(g, voll, "ram"));
    expect(r.stufe === "fehler" && r.pruefung.piep).toBe("L L L");
    expect(einschalten(g, falsch(g, voll, "cpu")).stufe).toBe("kaputt");
    const w = einschalten(g, falsch(g, voll, "ram"));
    expect(w.stufe === "ok" && w.warnungen.map(x => x.titel)).toEqual(["Speicher nur einkanalig"]);
    expect(einschalten(g, ohne(g, voll, "front")).stufe).toBe("aus");
  });

  it("386: halbe Speicherbank, P8/P9 vertauscht, Diskette an B:", () => {
    const g = geraet("pc386");
    const voll = komplett(g);
    const halb = ausbauen(g, ausbauen(g, voll, "simm3"), "simm4");
    const r = einschalten(g, halb);
    expect(r.stufe === "fehler" && r.pruefung.titel).toBe("Speicherfehler");
    expect(einschalten(g, falsch(g, voll, "p8p9")).stufe).toBe("kaputt");
    const w = einschalten(g, falsch(g, voll, "floppy"));
    expect(w.stufe === "ok" && w.warnungen).toHaveLength(1);
  });

  it("Pi: ohne Karte Bootloader, kopiert statt geschrieben, Tastatur passt in jede USB-Buchse", () => {
    const g = geraet("pi");
    const voll = komplett(g);
    expect(einschalten(g, ausbauen(g, voll, "sdkarte")).stufe).toBe("fehler");
    expect(einschalten(g, falsch(g, voll, "sdkarte")).stufe).toBe("fehler");
    const ohneTast = ohne(g, voll, "usbtast");
    for (const p of ["usb2a", "usb3b"]) {
      const s = stecken(g, stecken(g, ohneTast, "usbtast", "tast").bau, "usbtast", p);
      expect(s.ok && s.fertig).toBe(true);
    }
  });
});

describe("Regeln beim Bauen", () => {
  const g = geraet("pc");

  it("Reihenfolge: CPU erst aufs Mainboard, Kühler erst auf die CPU", () => {
    expect(hindernis(g, LEER, "cpu")).toMatch(/Mainboard/);
    const mb = einbauen(g, LEER, "mainboard");
    expect(hindernis(g, mb, "kuehler")).toMatch(/Prozessor/);
    expect(hindernis(g, mb, "cpu")).toBeNull();
  });

  it("falscher Port sagt, was er ist; besetzter Port wird verweigert", () => {
    const bau = einbauen(g, einbauen(g, LEER, "mainboard"), "psu");
    const r = stecken(g, bau, "atx24", "psu_pcie");
    expect(r.ok).toBe(false);
    expect(r.meldung).toMatch(/Grafikkarte/);
    const a = stecken(g, bau, "atx24", "psu_24");
    expect(stecken(g, a.bau, "eps", "psu_24").meldung).toMatch(/schon/);
    expect(stecken(g, a.bau, "atx24", "mb_24").fertig).toBe(true);
  });

  it("Schaltplan: EPS-Kabel steckt man an den Prozessor-Kasten", () => {
    const ohneEps = kabelAbziehen(komplett(g), "eps");
    expect(steckenAnKnoten(g, ohneEps, "eps", "gpu").ok).toBe(false);
    const a = steckenAnKnoten(g, ohneEps, "eps", "psu");
    expect(steckenAnKnoten(g, a.bau, "eps", "cpu").fertig).toBe(true);
  });

  it("Mainboard ausbauen nimmt alles darauf und die Kabel daran mit", () => {
    const voll = komplett(g);
    const leer = ausbauen(g, voll, "mainboard");
    for (const id of ["cpu", "kuehler", "ram", "gpu", "m2"]) expect(istDrin(g, leer, id), id).toBe(false);
    expect(kabelDrin(leer, "atx24")).toBe(false);
    expect(leer.stecker.atx24).toEqual(["psu_24"]);
    expect(istDrin(g, leer, "psu")).toBe(true);
  });
});

describe("Oberfläche", () => {
  it("zeigt alle Geräte in allen Blättern und beiden Ansichten ohne Fehler", async () => {
    const { render, screen, fireEvent } = await import("@testing-library/react");
    const { default: PcWerkstatt } = await import("@/components/pcbau/PcWerkstatt");
    render(<PcWerkstatt />);
    for (const blatt of ["🔧 Bauen", "🔍 Erkennen"]) {
      fireEvent.click(screen.getByRole("button", { name: blatt }));
      fireEvent.click(screen.getByRole("button", { name: /Beides/ }));
      for (const g of GERAETE) {
        fireEvent.click(screen.getByRole("button", { name: new RegExp(g.name) }));
        expect(screen.getByRole("img", { name: `${g.name}, Realansicht` })).toBeTruthy();
        expect(screen.getByRole("img", { name: `${g.name}, Schaltplan` })).toBeTruthy();
      }
    }
    fireEvent.click(screen.getByRole("button", { name: /Damals/ }));
    expect(screen.getByText("Dauerspeicher")).toBeTruthy();
  });
});
