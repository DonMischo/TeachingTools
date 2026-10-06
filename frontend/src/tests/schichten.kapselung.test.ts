import { describe, expect, it } from "vitest";
import { crc32, hex, internetSumme, ipText, lies16, text } from "@/lib/schichten/bytes";
import { MSS, TLS_MAX, alleRahmenInTokio, auspacken, dnsAnfrage, packe, pruefe, rahmen } from "@/lib/schichten/kapselung";
import { KNOTEN, LEITUNGEN, leitungsLaenge, ttlAuf, zeitbedarf } from "@/lib/schichten/route";

const FOTO = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 7919) & 0xff);

describe("Kapselung", () => {
  it("ein kurzer Text passt in einen Datensatz und ein Segment", () => {
    const r = packe(text("Hallo Tokio!"), "text", 12);
    expect(r.datensaetze).toHaveLength(1);
    expect(r.segmente).toHaveLength(1);
    const f = rahmen(r, 1, 0);
    // 14 Ethernet + 20 IP + 20 TCP + Nutzlast + 4 FCS
    expect(f.bytes.length).toBe(14 + 20 + 20 + r.strom.length + 4);
    expect(f.bytes[54]).toBe(0x17); // TLS: Anwendungsdaten
  });

  it("zerlegt große Inhalte in TLS-Datensätze und TCP-Segmente", () => {
    const r = packe(FOTO, "jpeg", 5_000_000);
    expect(r.datensaetze.length).toBe(Math.ceil(r.http.length / TLS_MAX));
    expect(r.segmente.length).toBe(Math.ceil(r.strom.length / MSS));
    expect(r.segmente.every((s, i) => i === r.segmente.length - 1 || s.nutzlast.length === MSS)).toBe(true);
    expect(r.segmente[1].seq - r.segmente[0].seq).toBe(MSS);
  });

  it("jede Prüfsumme stimmt auf jeder Leitung", () => {
    const r = packe(FOTO, "jpeg", 5_000_000);
    for (let l = 0; l < LEITUNGEN.length; l++) {
      for (const nr of [1, 2, r.segmente.length]) expect(pruefe(rahmen(r, nr, l).bytes)).toEqual({ fcs: true, ip: true, tcp: true });
    }
  });

  it("Router: neue MACs, TTL sinkt, NAT tauscht Absender — das Ziel bleibt", () => {
    const r = packe(FOTO, "jpeg", 5_000_000);
    const wlan = rahmen(r, 1, 0), draussen = rahmen(r, 1, 1), tokio = rahmen(r, 1, LEITUNGEN.length - 1);
    expect(ipText(wlan.bytes.subarray(26, 30))).toBe("192.168.178.23");
    expect(ipText(draussen.bytes.subarray(26, 30))).toBe("198.51.100.23");
    expect(ipText(tokio.bytes.subarray(30, 34))).toBe("203.0.113.7");
    expect(wlan.bytes[22]).toBe(64);
    expect(tokio.bytes[22]).toBe(ttlAuf(LEITUNGEN.length - 1));
    expect(tokio.bytes[22]).toBe(64 - KNOTEN.filter(k => k.router).length);
    expect(hex(wlan.bytes.subarray(0, 6))).not.toBe(hex(draussen.bytes.subarray(0, 6)));
    expect(lies16(wlan.bytes, 34)).not.toBe(lies16(draussen.bytes, 34));
    // Die Nutzlast reist unverändert
    expect(hex(wlan.bytes.subarray(54, -4))).toBe(hex(tokio.bytes.subarray(54, -4)));
  });

  it("färbt jedes Byte genau einem Bereich zu", () => {
    const r = packe(FOTO, "jpeg", 5_000_000);
    for (const nr of [1, 12, r.segmente.length]) {
      const f = rahmen(r, nr, 3);
      const belegt = new Uint8Array(f.bytes.length);
      for (const b of f.bereiche) for (let i = b.von; i < b.von + b.laenge; i++) belegt[i]++;
      expect(Array.from(belegt).every(v => v === 1)).toBe(true);
    }
  });

  it("Tokio setzt den Inhalt auch aus vertauschten Rahmen wieder zusammen", () => {
    const r = packe(FOTO, "jpeg", 5_000_000);
    const rahmenListe = alleRahmenInTokio(r).reverse();
    const a = auspacken(r, rahmenListe);
    expect(a.kopf).toContain("Content-Length: 100000");
    expect(hex(a.inhalt!)).toBe(hex(FOTO));
  });

  it("ein gekipptes Bit fällt der Ethernet-Prüfsumme auf; mit neuer FCS dem TCP; mit allen neuen dem TLS-Siegel", () => {
    const r = packe(FOTO, "jpeg", 5_000_000);
    const b = rahmen(r, 3, 4).bytes.slice();
    b[200] ^= 0x04;
    expect(pruefe(b)).toEqual({ fcs: false, ip: true, tcp: false });

    // Wer die FCS neu rechnet, scheitert an TCP
    const neueFcs = (x: Uint8Array) => { const c = crc32(x.subarray(0, x.length - 4)); x.set([c & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff, c >>> 24], x.length - 4); };
    neueFcs(b);
    expect(pruefe(b).fcs).toBe(true);
    expect(pruefe(b).tcp).toBe(false);

    // Auch mit neuer TCP-Prüfsumme bleibt das TLS-Siegel
    b[50] = b[51] = 0;
    const pseudo = new Uint8Array(12);
    pseudo.set(b.subarray(26, 34), 0);
    pseudo[9] = 6;
    pseudo[10] = ((b.length - 38) >> 8) & 0xff;
    pseudo[11] = (b.length - 38) & 0xff;
    const s = internetSumme(pseudo, b.subarray(34, b.length - 4));
    b[50] = s >> 8; b[51] = s & 0xff;
    neueFcs(b);
    expect(pruefe(b)).toEqual({ fcs: true, ip: true, tcp: true });
    const liste = alleRahmenInTokio(r);
    liste[2] = b;
    expect(auspacken(r, liste).http).toBeNull();
  });

  it("baut eine DNS-Anfrage nach RFC 1035", () => {
    const d = dnsAnfrage("tokio.katzenpost.example");
    expect(hex(d.subarray(0, 12))).toBe("1a 2b 01 00 00 01 00 00 00 00 00 00");
    expect(d[12]).toBe(5);
    expect(new TextDecoder().decode(d.subarray(13, 18))).toBe("tokio");
    expect(hex(d.subarray(-4))).toBe("00 01 00 01");
  });
});

describe("Route", () => {
  it("ist rund 20 000 km lang, einfache Laufzeit rund 100 ms", () => {
    const summe = LEITUNGEN.reduce((s, _, i) => s + leitungsLaenge(i), 0);
    expect(summe).toBeGreaterThan(17_000);
    expect(summe).toBeLessThan(23_000);
    const z = zeitbedarf(215, 313_000);
    expect(z.einwegMs).toBeGreaterThan(80);
    expect(z.einwegMs).toBeLessThan(130);
    expect(z.gesamtMs).toBeGreaterThan(500);
    expect(z.gesamtMs).toBeLessThan(2500);
  });
});

describe("Rahmen aus eigenen Werten", () => {
  it("hat gültige Prüfsummen und die Nutzlast an Byte 54", async () => {
    const { baueRahmen: baue } = await import("@/lib/schichten/kapselung");
    const r = baue({ nutzlast: text("Tokio!:)"), seq: 1004, quellIp: "192.168.178.23", zielIp: "203.0.113.7", quellPort: 52814, zielPort: 443, ttl: 64, vonMac: "5a:3c:91:2e:47:b8", nachMac: "dc:39:6f:a1:08:42" });
    expect(pruefe(r.bytes)).toEqual({ fcs: true, ip: true, tcp: true });
    expect(new TextDecoder().decode(r.bytes.subarray(54, 62))).toBe("Tokio!:)");
    expect(lies16(r.bytes, 36)).toBe(443);
  });
});
