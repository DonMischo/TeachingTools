/**
 * Kleinster Word-Export ohne eigene Bibliothek: ein .docx ist ein ZIP mit
 * ein paar XML-Dateien. Kann Überschriften, Absätze (fett/klein/grau),
 * Schreiblinien, Bilder (PNG) und Seitenumbrüche — genug für Arbeitsblätter.
 */
export type DocxBlock =
  | { art: "titel" | "ueberschrift"; text: string }
  | { art: "text"; text: string; fett?: boolean; klein?: boolean; grau?: boolean; mono?: boolean }
  | { art: "linie"; text: string }
  | { art: "bild"; png: Uint8Array; breite: number; hoehe: number }
  | { art: "umbruch" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function lauf(text: string, f: { fett?: boolean; groesse?: number; grau?: boolean; mono?: boolean } = {}) {
  const rpr = [
    f.mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : "",
    f.fett ? "<w:b/>" : "",
    f.grau ? '<w:color w:val="666666"/>' : "",
    f.groesse ? `<w:sz w:val="${f.groesse}"/><w:szCs w:val="${f.groesse}"/>` : "",
  ].join("");
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}
const absatz = (inhalt: string, nach = 120, vor = 0) => `<w:p><w:pPr><w:spacing w:before="${vor}" w:after="${nach}"/></w:pPr>${inhalt}</w:p>`;

const EMU = 9525; // pro Pixel bei 96 dpi
function bildXml(id: number, rel: string, breite: number, hoehe: number) {
  // höchstens 16 cm breit
  const max = 6048000, cx = Math.min(max, breite * EMU), cy = Math.round((cx / (breite * EMU)) * hoehe * EMU);
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Bild ${id}"/>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="bild${id}.png"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>
</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

export async function baueDocx(bloecke: DocxBlock[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const bilder: { rel: string; datei: string; png: Uint8Array }[] = [];
  const koerper = bloecke.map(b => {
    switch (b.art) {
      case "titel": return absatz(lauf(b.text, { fett: true, groesse: 36 }), 200);
      case "ueberschrift": return absatz(lauf(b.text, { fett: true, groesse: 28 }), 80, 240);
      case "text": return absatz(lauf(b.text, { fett: b.fett, grau: b.grau, mono: b.mono, groesse: b.klein ? 18 : undefined }));
      case "linie": return absatz(lauf(`${b.text} ________________________`), 160, 80);
      case "umbruch": return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      case "bild": {
        const n = bilder.length + 1, rel = `rIdBild${n}`;
        bilder.push({ rel, datei: `bild${n}.png`, png: b.png });
        return bildXml(n, rel, b.breite, b.hoehe);
      }
    }
  }).join("\n");

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${bilder.map(b => `<Relationship Id="${b.rel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${b.datei}"/>`).join("\n")}
</Relationships>`);
  for (const b of bilder) zip.file(`word/media/${b.datei}`, b.png);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
<w:body>
${koerper}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

/** SVG-Quelltext → PNG (doppelte Auflösung, weißer Hintergrund). Nur im Browser. */
export async function svgZuPng(svg: string, breite: number, hoehe: number): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, fehl) => { img.onload = () => ok(); img.onerror = () => fehl(new Error("SVG ließ sich nicht laden")); img.src = url; });
    const c = document.createElement("canvas");
    c.width = breite * 2; c.height = hoehe * 2;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((ok, fehl) => c.toBlob(b => (b ? ok(b) : fehl(new Error("PNG fehlgeschlagen"))), "image/png"));
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function herunterladen(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
