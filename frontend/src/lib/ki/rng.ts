/**
 * Zufall, der sich wiederholen lässt — die Grundlage beider Reiter der
 * KI-Werkstatt.
 *
 * Beide Hälften brauchen denselben Trick: derselbe Startwert (»Seed«) muss
 * dieselbe Folge ergeben. Im Sprachmodell entsteht daraus die Signatur eines
 * Textes, im Bilderteil das Rauschmuster. Genau so arbeiten die echten
 * Bildmodelle auch: der Seed steht am Anfang und legt jeden Würfelwurf fest —
 * gleicher Seed, gleiches Bild.
 */

/** Mulberry32 — kleiner, schneller Pseudozufall mit 32-Bit-Zustand. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a über eine Zahlenfolge — die Wortwahl wird zu einem Fingerabdruck. */
export function hash(zahlen: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const z of zahlen) {
    // Jede Zahl byteweise, damit 1,2 und 12 nicht denselben Abdruck ergeben.
    for (let s = 0; s < 32; s += 8) {
      h ^= (z >>> s) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h >>> 0;
}

/**
 * Der Fingerabdruck einer Wortwahl, lesbar geschrieben: »K7B-2M9«.
 *
 * Bewusst *nicht* »Seed« genannt, solange er hinten aus dem fertigen Text
 * herausfällt — ein Seed steht am Anfang. Erst im Bilderteil wird er wirklich
 * einer: dort startet er das Rauschen, und dann stimmt die Richtung wieder.
 */
export function signatur(ids: readonly number[]): string {
  const h = hash(ids).toString(36).toUpperCase().padStart(7, "0").slice(-6);
  return `${h.slice(0, 3)}-${h.slice(3)}`;
}

/** Dieselbe Signatur zurück in eine Zahl — der Startwert fürs Rauschen. */
export function seedAusSignatur(sig: string): number {
  const sauber = sig.replace(/-/g, "").toUpperCase();
  return hash([...sauber].map(c => c.charCodeAt(0)));
}
