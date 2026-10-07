/**
 * Arbeitsblatt-Export: Das Blatt ist immer A4 hochkant. Eine Karte im Querformat kommt um 90°
 * gegen den Uhrzeigersinn gedreht darauf (Norden zeigt nach links) — man dreht das Blatt nach
 * rechts und liest sie quer, Titel und Aufgabe bleiben aufrecht.
 */

/** Muss die Karte gedreht werden? Nur echtes Querformat. */
export const mussDrehen = (breite: number, hoehe: number) => breite > hoehe;

/** Breite und Höhe aus dem PNG-Kopf (IHDR, Byte 16–23) — ohne das Bild zu laden. */
export function pngGroesse(dataUrl: string): { breite: number; hoehe: number } | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]{32})/.exec(dataUrl);
  if (!m) return null;
  const b = Uint8Array.from(atob(m[1]), (z) => z.charCodeAt(0));
  const zahl = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  return { breite: zahl(16), hoehe: zahl(20) };
}

/** Dreht ein PNG (data-URL) um 90° gegen den Uhrzeigersinn, wenn es breiter als hoch ist. */
export function hochkant(dataUrl: string): Promise<string> {
  const g = pngGroesse(dataUrl);
  if (!g || !mussDrehen(g.breite, g.hoehe)) return Promise.resolve(dataUrl);
  return new Promise((ok, fehler) => {
    const bild = new Image();
    bild.onload = () => {
      const { width: b, height: h } = bild;
      if (!mussDrehen(b, h)) return ok(dataUrl);
      const c = document.createElement("canvas");
      c.width = h;
      c.height = b;
      const ctx = c.getContext("2d");
      if (!ctx) return ok(dataUrl);
      // (x, y) → (y, b − x): die Oberkante der Karte wird zur linken Kante
      ctx.translate(0, b);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(bild, 0, 0);
      ok(c.toDataURL("image/png"));
    };
    bild.onerror = () => fehler(new Error("Kartenbild nicht lesbar"));
    bild.src = dataUrl;
  });
}
