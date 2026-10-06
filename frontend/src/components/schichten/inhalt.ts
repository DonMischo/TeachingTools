/**
 * Was Lena verschickt: ein gezeichnetes Katzenfoto, ein eigenes Foto (bleibt
 * im Browser) oder ein Text. Fotos werden wirklich als JPEG komprimiert —
 * die Rohgröße sind die unkomprimierten Pixel (3 Byte je Pixel).
 */
import { text } from "@/lib/schichten/bytes";

export interface Inhalt {
  bytes: Uint8Array;
  art: "jpeg" | "text";
  roh: number;
  url: string | null;
  name: string;
  breite?: number;
  hoehe?: number;
}

const MAX = 1600;

function alsJpeg(c: HTMLCanvasElement, name: string): Promise<Inhalt> {
  return new Promise((ok, fehler) => {
    c.toBlob(async b => {
      if (!b) return fehler(new Error("JPEG nicht möglich"));
      ok({
        bytes: new Uint8Array(await b.arrayBuffer()), art: "jpeg", roh: c.width * c.height * 3,
        url: URL.createObjectURL(b), name, breite: c.width, hoehe: c.height,
      });
    }, "image/jpeg", 0.85);
  });
}

/** Ein »Foto« einer Katze: Verlauf, Fell-Rauschen, Emoji — genug Details, dass JPEG etwas zu tun hat. */
export function katzenFoto(): Promise<Inhalt> {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 1200;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, "#f6d7a7");
  g.addColorStop(0.6, "#d9a066");
  g.addColorStop(1, "#7a4e2d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  // Sofa-Streifen und Licht
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(120,70,40,${0.06 + (i % 3) * 0.03})`;
    ctx.fillRect(0, 760 + i * 32, c.width, 14);
  }
  ctx.font = "900px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🐈", 800, 650);
  // Fotorauschen wie bei einer Handykamera
  const bild = ctx.getImageData(0, 0, c.width, c.height);
  let s = 12345;
  for (let i = 0; i < bild.data.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const r = ((s >> 16) & 31) - 16;
    bild.data[i] += r; bild.data[i + 1] += r; bild.data[i + 2] += r;
  }
  ctx.putImageData(bild, 0, 0);
  return alsJpeg(c, "katze.jpg");
}

export function fotoAusDatei(datei: File): Promise<Inhalt> {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * f);
      c.height = Math.round(img.height * f);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      alsJpeg(c, datei.name.replace(/\.[^.]+$/, "") + ".jpg").then(ok, fehler);
    };
    img.onerror = () => fehler(new Error("Bild nicht lesbar"));
    img.src = url;
  });
}

export function textInhalt(s: string): Inhalt {
  return { bytes: text(s), art: "text", roh: s.length, url: null, name: "nachricht.txt" };
}
