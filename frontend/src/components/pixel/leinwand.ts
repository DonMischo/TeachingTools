/**
 * Pixel-Studio im Browser: Canvas-Helfer für PNG, Vorschau, Sprite-Sheet, Download und Bild-Import.
 * Andere Werkzeuge, die ein gespeichertes Projekt zeigen wollen, nehmen `bildCanvas`.
 */
import { zusammensetzen, type Projekt } from "@/lib/pixel/dokument";
import { spriteSheet } from "@/lib/pixel/export";

export function rgbaCanvas(rgba: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
  return c;
}

/** ein Bild des Projekts als Canvas, um `zoom` vergrößert (ohne Weichzeichnen) */
export function bildCanvas(p: Projekt, bild: number, zoom = 1): HTMLCanvasElement {
  const roh = rgbaCanvas(zusammensetzen(p, bild), p.breite, p.hoehe);
  if (zoom === 1) return roh;
  const c = document.createElement("canvas");
  c.width = p.breite * zoom; c.height = p.hoehe * zoom;
  const ctx = c.getContext("2d");
  if (ctx) { ctx.imageSmoothingEnabled = false; ctx.drawImage(roh, 0, 0, c.width, c.height); }
  return c;
}

export const pngVon = (p: Projekt, bild: number, zoom = 1) => bildCanvas(p, bild, zoom).toDataURL("image/png");

/** kleines Vorschaubild für die Bibliothek: Bild 1, höchstens 96 px */
export function vorschauPng(p: Projekt): string {
  const s = Math.max(p.breite, p.hoehe), zoom = Math.max(1, Math.floor(96 / s));
  if (s * zoom <= 96) return pngVon(p, 0, zoom);
  const roh = bildCanvas(p, 0), f = 96 / s, c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(p.breite * f)); c.height = Math.max(1, Math.round(p.hoehe * f));
  const ctx = c.getContext("2d");
  if (ctx) { ctx.imageSmoothingEnabled = false; ctx.drawImage(roh, 0, 0, c.width, c.height); }
  return c.toDataURL("image/png");
}

export function sheetPng(p: Projekt, spalten: number, zoom = 1): { png: string; json: string } {
  const s = spriteSheet(p, spalten), c = document.createElement("canvas");
  c.width = s.breite * zoom; c.height = s.hoehe * zoom;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    s.bilder.forEach((b, k) => ctx.drawImage(bildCanvas(p, k), b.x * zoom, b.y * zoom, b.w * zoom, b.h * zoom));
  }
  const json = { ...s, breite: s.breite * zoom, hoehe: s.hoehe * zoom, bilder: s.bilder.map(b => ({ ...b, x: b.x * zoom, y: b.y * zoom, w: b.w * zoom, h: b.h * zoom })) };
  return { png: c.toDataURL("image/png"), json: JSON.stringify(json, null, 1) };
}

export function herunterladen(name: string, inhalt: string | Blob) {
  const url = typeof inhalt === "string" ? inhalt : URL.createObjectURL(inhalt);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  if (typeof inhalt !== "string") setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Bilddatei lesen; zu große Bilder werden auf höchstens `max` px verkleinert */
export function bildDateiLesen(datei: File, max = 256): Promise<{ rgba: Uint8ClampedArray; w: number; h: number }> {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(datei), img = new Image();
    img.onload = () => {
      const f = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * f)), h = Math.max(1, Math.round(img.height * f));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      ok({ rgba: ctx.getImageData(0, 0, w, h).data, w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error("Bild konnte nicht gelesen werden")); };
    img.src = url;
  });
}

/** Dateiname aus dem Projektnamen */
export const dateiname = (name: string) => (name.trim() || "pixel").replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 60);
