import { describe, expect, it } from "vitest";
import { ausHex, crc32, hex, internetSumme, text } from "@/lib/schichten/bytes";
import { chacha20, chachaBlock, oeffnen, poly1305, versiegeln } from "@/lib/schichten/chacha";

const SCHLUESSEL = Uint8Array.from({ length: 32 }, (_, i) => i);
const SONNENCREME = "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.";

describe("Prüfsummen", () => {
  it("CRC-32 wie Ethernet (Prüfwert »123456789«)", () => {
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
  });

  it("Internet-Prüfsumme nach RFC 1071, Beispiel-Kopf ergibt nachgerechnet null", () => {
    // IPv4-Kopf aus Wikipedia mit eingetragener Prüfsumme b861
    const kopf = ausHex("4500 0073 0000 4000 4011 b861 c0a8 0001 c0a8 00c7");
    expect(internetSumme(kopf)).toBe(0);
    kopf[10] = kopf[11] = 0;
    expect(internetSumme(kopf)).toBe(0xb861);
  });
});

describe("ChaCha20-Poly1305 (RFC 8439)", () => {
  it("Blockfunktion 2.3.2", () => {
    const b = chachaBlock(SCHLUESSEL, 1, ausHex("000000090000004a00000000"));
    expect(hex(b.slice(0, 16))).toBe("10 f1 e7 e4 d1 3b 59 15 50 0f dd 1f a3 20 71 c4");
  });

  it("Verschlüsselung 2.4.2", () => {
    const g = chacha20(SCHLUESSEL, 1, ausHex("000000000000004a00000000"), text(SONNENCREME));
    expect(hex(g.slice(0, 16))).toBe("6e 2e 35 9a 25 68 f9 80 41 ba 07 28 dd 0d 69 81");
  });

  it("Poly1305 2.5.2", () => {
    const k = ausHex("85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b");
    expect(hex(poly1305(k, text("Cryptographic Forum Research Group")))).toBe("a8 06 1d c1 30 51 36 c6 c2 2b 8b af 0c 01 27 a9");
  });

  it("AEAD 2.8.2 — Siegel stimmt, gekipptes Bit fällt auf", () => {
    const k = Uint8Array.from({ length: 32 }, (_, i) => 0x80 + i);
    const nonce = ausHex("07000000 4041424344454647");
    const aad = ausHex("50515253c0c1c2c3c4c5c6c7");
    const v = versiegeln(k, nonce, text(SONNENCREME), aad);
    expect(hex(v.slice(0, 16))).toBe("d3 1a 8d 34 64 8e 60 db 7b 86 af bc 53 ef 7e c2");
    expect(hex(v.slice(-16))).toBe("1a e1 0b 59 4f 09 e2 6a 7e 90 2e cb d0 60 06 91");
    expect(new TextDecoder().decode(oeffnen(k, nonce, v, aad)!)).toBe(SONNENCREME);
    v[5] ^= 1;
    expect(oeffnen(k, nonce, v, aad)).toBeNull();
  });
});
