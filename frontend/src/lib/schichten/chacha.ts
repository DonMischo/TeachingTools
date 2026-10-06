/**
 * ChaCha20-Poly1305 (RFC 8439) — dieselbe Verschlüsselung, die TLS 1.3 auf
 * Handys ohne AES-Hardware benutzt. Hier in reinem TypeScript, weil
 * crypto.subtle nur über https läuft und ChaCha20 dort ohnehin fehlt.
 * Für den Unterricht, nicht für echte Geheimnisse.
 */

const rotl = (v: number, n: number) => ((v << n) | (v >>> (32 - n))) >>> 0;

function viertel(s: Uint32Array, a: number, b: number, c: number, d: number) {
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 7);
}

const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Ein 64-Byte-Schlüsselstromblock. */
export function chachaBlock(schluessel: Uint8Array, zaehler: number, nonce: Uint8Array): Uint8Array {
  const s = new Uint32Array(16);
  s[0] = 0x61707865; s[1] = 0x3320646e; s[2] = 0x79622d32; s[3] = 0x6b206574;
  for (let i = 0; i < 8; i++) s[4 + i] = le32(schluessel, i * 4);
  s[12] = zaehler >>> 0;
  for (let i = 0; i < 3; i++) s[13 + i] = le32(nonce, i * 4);
  const w = s.slice();
  for (let r = 0; r < 10; r++) {
    viertel(w, 0, 4, 8, 12); viertel(w, 1, 5, 9, 13); viertel(w, 2, 6, 10, 14); viertel(w, 3, 7, 11, 15);
    viertel(w, 0, 5, 10, 15); viertel(w, 1, 6, 11, 12); viertel(w, 2, 7, 8, 13); viertel(w, 3, 4, 9, 14);
  }
  const aus = new Uint8Array(64);
  for (let i = 0; i < 16; i++) {
    const v = (w[i] + s[i]) >>> 0;
    aus[i * 4] = v & 0xff; aus[i * 4 + 1] = (v >>> 8) & 0xff; aus[i * 4 + 2] = (v >>> 16) & 0xff; aus[i * 4 + 3] = v >>> 24;
  }
  return aus;
}

/** Ver- und Entschlüsseln sind dasselbe: XOR mit dem Schlüsselstrom. */
export function chacha20(schluessel: Uint8Array, zaehler: number, nonce: Uint8Array, daten: Uint8Array): Uint8Array {
  const aus = new Uint8Array(daten.length);
  for (let o = 0; o < daten.length; o += 64) {
    const k = chachaBlock(schluessel, zaehler + o / 64, nonce);
    const n = Math.min(64, daten.length - o);
    for (let i = 0; i < n; i++) aus[o + i] = daten[o + i] ^ k[i];
  }
  return aus;
}

// BigInt() statt BigInt-Literalen: das Projekt übersetzt für ein Ziel vor ES2020
const B = BigInt;
const P = (B(1) << B(130)) - B(5);
const MASKE_R = B("0x0ffffffc0ffffffc0ffffffc0fffffff");
const MASKE_128 = (B(1) << B(128)) - B(1);

function zahlLE(b: Uint8Array, o: number, n: number): bigint {
  let v = B(0);
  for (let i = n - 1; i >= 0; i--) v = (v << B(8)) | B(b[o + i]);
  return v;
}

/** Poly1305-Prüfsiegel (16 Byte) über eine Nachricht mit 32-Byte-Einmalschlüssel. */
export function poly1305(einmal: Uint8Array, nachricht: Uint8Array): Uint8Array {
  const r = zahlLE(einmal, 0, 16) & MASKE_R;
  const s = zahlLE(einmal, 16, 16);
  let a = B(0);
  for (let o = 0; o < nachricht.length; o += 16) {
    const n = Math.min(16, nachricht.length - o);
    const block = zahlLE(nachricht, o, n) | (B(1) << B(8 * n));
    a = ((a + block) * r) % P;
  }
  a = (a + s) & MASKE_128;
  const aus = new Uint8Array(16);
  for (let i = 0; i < 16; i++) { aus[i] = Number(a & B(0xff)); a >>= B(8); }
  return aus;
}

function polyEingabe(aad: Uint8Array, geheim: Uint8Array): Uint8Array {
  const pad = (n: number) => (16 - (n % 16)) % 16;
  const m = new Uint8Array(aad.length + pad(aad.length) + geheim.length + pad(geheim.length) + 16);
  m.set(aad, 0);
  const o = aad.length + pad(aad.length);
  m.set(geheim, o);
  const l = o + geheim.length + pad(geheim.length);
  const dv = new DataView(m.buffer);
  dv.setUint32(l, aad.length, true);
  dv.setUint32(l + 8, geheim.length, true);
  return m;
}

/** AEAD-Verschlüsselung: Geheimtext + 16 Byte Siegel. `aad` wird nur mitgesiegelt, nicht verschlüsselt. */
export function versiegeln(schluessel: Uint8Array, nonce: Uint8Array, klar: Uint8Array, aad: Uint8Array = new Uint8Array(0)): Uint8Array {
  const einmal = chachaBlock(schluessel, 0, nonce).slice(0, 32);
  const geheim = chacha20(schluessel, 1, nonce, klar);
  const siegel = poly1305(einmal, polyEingabe(aad, geheim));
  const aus = new Uint8Array(geheim.length + 16);
  aus.set(geheim);
  aus.set(siegel, geheim.length);
  return aus;
}

/** Entschlüsseln mit Prüfung des Siegels; null, wenn unterwegs auch nur ein Bit kippte. */
export function oeffnen(schluessel: Uint8Array, nonce: Uint8Array, versiegelt: Uint8Array, aad: Uint8Array = new Uint8Array(0)): Uint8Array | null {
  if (versiegelt.length < 16) return null;
  const geheim = versiegelt.subarray(0, versiegelt.length - 16);
  const siegel = versiegelt.subarray(versiegelt.length - 16);
  const einmal = chachaBlock(schluessel, 0, nonce).slice(0, 32);
  const soll = poly1305(einmal, polyEingabe(aad, geheim));
  let diff = 0;
  for (let i = 0; i < 16; i++) diff |= soll[i] ^ siegel[i];
  return diff ? null : chacha20(schluessel, 1, nonce, geheim);
}
