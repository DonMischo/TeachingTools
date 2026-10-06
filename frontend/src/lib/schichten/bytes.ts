/** Byte-Werkzeuge für das Schichtenmodell: Prüfsummen, Hex, Bits. */

export function verbinde(...teile: Uint8Array[]): Uint8Array {
  const aus = new Uint8Array(teile.reduce((s, t) => s + t.length, 0));
  let o = 0;
  for (const t of teile) { aus.set(t, o); o += t.length; }
  return aus;
}

export function schreibe16(b: Uint8Array, o: number, v: number) {
  b[o] = (v >>> 8) & 0xff;
  b[o + 1] = v & 0xff;
}

export function schreibe32(b: Uint8Array, o: number, v: number) {
  b[o] = (v >>> 24) & 0xff;
  b[o + 1] = (v >>> 16) & 0xff;
  b[o + 2] = (v >>> 8) & 0xff;
  b[o + 3] = v & 0xff;
}

export const lies16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
export const lies32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

export const hex2 = (v: number) => v.toString(16).padStart(2, "0");
export const hex = (b: Uint8Array, trenner = " ") => Array.from(b, hex2).join(trenner);
export const bits = (v: number) => v.toString(2).padStart(8, "0");

export function ausHex(s: string): Uint8Array {
  const t = s.replace(/[^0-9a-f]/gi, "");
  return Uint8Array.from({ length: t.length / 2 }, (_, i) => parseInt(t.slice(i * 2, i * 2 + 2), 16));
}

export const text = (s: string) => new TextEncoder().encode(s);

/** Internet-Prüfsumme (RFC 1071): Einerkomplement der Einerkomplement-Summe aller 16-Bit-Wörter. */
export function internetSumme(...teile: Uint8Array[]): number {
  let s = 0;
  for (const b of teile) {
    for (let i = 0; i + 1 < b.length; i += 2) s += (b[i] << 8) | b[i + 1];
    if (b.length & 1) s += b[b.length - 1] << 8;
  }
  while (s > 0xffff) s = (s & 0xffff) + (s >>> 16);
  return ~s & 0xffff;
}

const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 wie in der Ethernet-Prüfsumme (FCS). */
export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABELLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export const ipText = (b: Uint8Array) => Array.from(b).join(".");
export const ipBytes = (s: string) => Uint8Array.from(s.split(".").map(Number));
export const macText = (b: Uint8Array) => hex(b, ":");
export const macBytes = (s: string) => ausHex(s);
