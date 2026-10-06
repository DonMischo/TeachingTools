/**
 * Eine SVG-Zeichnung aus der Seite als Datei speichern: SVG, PNG oder PDF.
 *
 * Die Zeichnungen färben sich über CSS-Variablen des Themes (var(--accent) …).
 * Außerhalb der Seite gibt es die nicht — darum werden sie beim Kopieren durch
 * ihre aktuellen Werte ersetzt, und der Hintergrund kommt als Fläche dazu.
 */

/** Eigenständiges SVG: Variablen aufgelöst, Hintergrund, Schrift, feste Größe. */
export function standaloneSvg(svg: SVGSVGElement): { text: string; width: number; height: number } {
  const vb = svg.viewBox.baseVal;
  const width = vb.width, height = vb.height;
  const css = getComputedStyle(svg);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("font-family", "system-ui, 'Segoe UI', sans-serif");
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", String(vb.x)); bg.setAttribute("y", String(vb.y));
  bg.setAttribute("width", String(width)); bg.setAttribute("height", String(height));
  bg.setAttribute("fill", "var(--surface)");
  clone.insertBefore(bg, clone.firstChild);
  const text = new XMLSerializer()
    .serializeToString(clone)
    .replace(/var\((--[\w-]+)\)/g, (_, name: string) => css.getPropertyValue(name).trim() || "#000");
  return { text, width, height };
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Als Bild rastern; `scale` 3 reicht für scharfen Druck. */
async function toCanvas(svg: SVGSVGElement, scale = 3): Promise<HTMLCanvasElement> {
  const { text, width, height } = standaloneSvg(svg);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = fail; img.src = url; });
  } finally {
    URL.revokeObjectURL(url);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width * scale; canvas.height = height * scale;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function exportSvg(svg: SVGSVGElement, name: string) {
  download(new Blob([standaloneSvg(svg).text], { type: "image/svg+xml" }), `${name}.svg`);
}

export async function exportPng(svg: SVGSVGElement, name: string) {
  const canvas = await toCanvas(svg);
  const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, "image/png"));
  if (blob) download(blob, `${name}.png`);
}

/** A4 quer: Überschrift (die Terme), darunter die Zeichnung, eingepasst. */
export async function exportPdf(svg: SVGSVGElement, name: string, title: string) {
  const [{ jsPDF }, canvas] = await Promise.all([import("jspdf"), toCanvas(svg)]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const m = 12;
  doc.setFontSize(13);
  doc.text(title, m, m + 4, { maxWidth: pw - 2 * m });
  const top = m + 12;
  const f = Math.min((pw - 2 * m) / canvas.width, (ph - top - m) / canvas.height);
  const w = canvas.width * f, h = canvas.height * f;
  // JPEG statt PNG: das ungepackte PNG machte die Datei rund 7 MB groß.
  doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (pw - w) / 2, top, w, h);
  doc.save(`${name}.pdf`);
}
