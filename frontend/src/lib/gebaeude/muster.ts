/**
 * Oberflächenmuster der Gebäude-Stile, auf ein Canvas gemalt: grau (die Farbe
 * kommt später vom Material), 256×256 und nahtlos kachelbar. Ohne three.js,
 * damit auch der Reiter »Textur« im Wellenfunktionskollaps sie nutzen kann.
 */

export type Muster =
  | "fels" | "erde" | "stein" | "holz" | "parkett" | "marmor" | "teppich"
  | "fachwerk" | "metall" | "eis" | "tapete" | "sand" | "beton" | "putz" | "glut";

const GROESSE = 256;

/** fester Zufall, damit ein Muster bei jedem Laden gleich aussieht */
export function zufallAus(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Malen = (c: CanvasRenderingContext2D, z: () => number) => void;
const G = GROESSE;
const grau = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`;

/** Flecken in verschiedenen Helligkeiten (Grundlage für Stein, Erde, Sand …) */
function flecken(c: CanvasRenderingContext2D, z: () => number, n: number, r: [number, number], hell: [number, number], a = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = z() * G, y = z() * G, rr = r[0] + z() * (r[1] - r[0]);
    c.fillStyle = grau(Math.round(hell[0] + z() * (hell[1] - hell[0])), a);
    // auch über den Rand, damit die Kachel nahtlos ist
    for (const dx of [-G, 0, G]) for (const dy of [-G, 0, G]) {
      c.beginPath(); c.arc(x + dx, y + dy, rr, 0, Math.PI * 2); c.fill();
    }
  }
}

function risse(c: CanvasRenderingContext2D, z: () => number, n: number, farbe: string, breite: number) {
  c.strokeStyle = farbe; c.lineWidth = breite;
  for (let i = 0; i < n; i++) {
    let x = z() * G, y = z() * G;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (z() - 0.5) * 40; y += (z() - 0.5) * 40; c.lineTo(x, y); }
    c.stroke();
  }
}

/** Mauerwerk: Reihen versetzter Blöcke mit Fugen */
function bloecke(c: CanvasRenderingContext2D, z: () => number, reihen: number, jeReihe: number, fuge: number, grund: number) {
  const h = G / reihen, b = G / jeReihe;
  c.fillStyle = grau(grund - 90); c.fillRect(0, 0, G, G);
  for (let r = 0; r < reihen; r++) {
    const versatz = r % 2 ? b / 2 : 0;
    for (let k = -1; k <= jeReihe; k++) {
      c.fillStyle = grau(Math.round(grund - 25 + z() * 30));
      c.fillRect(k * b + versatz + fuge / 2, r * h + fuge / 2, b - fuge, h - fuge);
    }
  }
}

export const MALER: Record<Muster, Malen> = {
  fels: (c, z) => {
    c.fillStyle = grau(215); c.fillRect(0, 0, G, G);
    flecken(c, z, 70, [10, 40], [150, 255], 0.35);
    flecken(c, z, 200, [2, 6], [90, 160], 0.4);
    risse(c, z, 10, grau(80, 0.6), 2);
  },
  erde: (c, z) => {
    c.fillStyle = grau(220); c.fillRect(0, 0, G, G);
    flecken(c, z, 90, [6, 26], [160, 250], 0.35);
    flecken(c, z, 400, [1, 3], [100, 170], 0.6); // Steinchen
  },
  stein: (c, z) => {
    bloecke(c, z, 4, 2, 6, 245);
    flecken(c, z, 160, [2, 8], [150, 255], 0.2);
  },
  holz: (c, z) => {
    // Dielen: 4 Bretter, Maserung längs, versetzte Stöße
    const b = G / 4;
    for (let k = 0; k < 4; k++) {
      c.fillStyle = grau(Math.round(205 + z() * 40)); c.fillRect(0, k * b, G, b);
      c.strokeStyle = grau(150, 0.35); c.lineWidth = 1.2;
      for (let m = 0; m < 7; m++) {
        const y = k * b + 4 + z() * (b - 8);
        c.beginPath(); c.moveTo(0, y);
        for (let x = 0; x <= G; x += 32) c.lineTo(x, y + Math.sin(x / 30 + m) * 2);
        c.stroke();
      }
      c.fillStyle = grau(90); c.fillRect(0, k * b, G, 2);
      c.fillRect(((k * 0.37) % 1) * G, k * b, 3, b);
    }
  },
  parkett: (c, z) => {
    // Fischgrät aus kleinen Brettchen
    c.fillStyle = grau(120); c.fillRect(0, 0, G, G);
    const l = 64, w = 16;
    for (let y = -l; y < G + l; y += w * 2) for (let x = -l; x < G + l; x += l) {
      for (const [dx, dy, quer] of [[0, 0, false], [l / 2, w, true]] as const) {
        c.fillStyle = grau(Math.round(200 + z() * 45));
        if (quer) c.fillRect(x + dx + 1, y + dy + 1, w - 2, l - 2);
        else c.fillRect(x + dx + 1, y + dy + 1, l - 2, w - 2);
      }
    }
  },
  marmor: (c, z) => {
    c.fillStyle = grau(250); c.fillRect(0, 0, G, G);
    flecken(c, z, 30, [20, 50], [225, 250], 0.25);
    c.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      c.strokeStyle = grau(Math.round(150 + z() * 50), 0.55);
      let x = z() * G, y = 0;
      c.beginPath(); c.moveTo(x, y);
      while (y < G) { y += 12; x += (z() - 0.5) * 22; c.lineTo(x, y); }
      c.stroke();
    }
    // große Platten
    c.fillStyle = grau(170); c.fillRect(0, 0, G, 2); c.fillRect(0, 0, 2, G);
  },
  teppich: (c, z) => {
    // 70er: Kreise in Ringen auf Flor
    c.fillStyle = grau(230); c.fillRect(0, 0, G, G);
    for (let y = 32; y < G; y += 64) for (let x = 32; x < G; x += 64) {
      for (const [r, v] of [[28, 170], [20, 245], [12, 190], [5, 245]] as const) {
        c.fillStyle = grau(v); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    }
    flecken(c, z, 900, [0.6, 1.4], [150, 255], 0.35);
  },
  fachwerk: (c, z) => {
    c.fillStyle = grau(250); c.fillRect(0, 0, G, G);
    flecken(c, z, 60, [4, 14], [225, 250], 0.3);
    c.fillStyle = grau(60);
    const b = 14;
    c.fillRect(0, 0, b, G); c.fillRect(G / 2 - b / 2, 0, b, G); // Ständer
    c.fillRect(0, G - b, G, b); c.fillRect(0, G / 2 - b / 2, G, b); // Riegel
    c.strokeStyle = grau(60); c.lineWidth = b;
    c.beginPath(); c.moveTo(b, G / 2); c.lineTo(G / 2, 0); c.stroke(); // Streben
    c.beginPath(); c.moveTo(G / 2, G); c.lineTo(G, G / 2); c.stroke();
  },
  metall: (c, z) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      c.fillStyle = grau(Math.round(215 + z() * 30)); c.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
      c.fillStyle = grau(150);
      for (const [nx, ny] of [[10, 10], [118, 10], [10, 118], [118, 118]]) {
        c.beginPath(); c.arc(x * 128 + nx, y * 128 + ny, 3, 0, Math.PI * 2); c.fill();
      }
    }
    c.fillStyle = grau(110); c.fillRect(0, 0, G, 2); c.fillRect(0, 128, G, 2); c.fillRect(0, 0, 2, G); c.fillRect(128, 0, 2, G);
    c.strokeStyle = grau(255, 0.15); c.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const y = z() * G; c.beginPath(); c.moveTo(0, y); c.lineTo(G, y); c.stroke(); }
  },
  eis: (c, z) => {
    c.fillStyle = grau(245); c.fillRect(0, 0, G, G);
    flecken(c, z, 40, [15, 45], [215, 255], 0.3);
    risse(c, z, 14, grau(255, 0.9), 1.5);
    risse(c, z, 8, grau(170, 0.5), 1);
  },
  tapete: (c, z) => {
    // Streifen und Lilien (Damast)
    c.fillStyle = grau(215); c.fillRect(0, 0, G, G);
    c.fillStyle = grau(245, 0.5);
    for (let x = 0; x < G; x += 64) c.fillRect(x, 0, 8, G);
    c.fillStyle = grau(255, 0.55);
    for (let y = 32; y < G; y += 64) for (let x = 32; x < G; x += 64) {
      const s = (y / 64) % 2 ? 32 : 0;
      c.beginPath(); c.ellipse((x + s) % G, y, 7, 14, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse((x + s) % G - 9, y + 6, 4, 9, -0.6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse((x + s) % G + 9, y + 6, 4, 9, 0.6, 0, Math.PI * 2); c.fill();
    }
    flecken(c, z, 60, [2, 5], [180, 230], 0.15);
  },
  sand: (c, z) => {
    c.fillStyle = grau(235); c.fillRect(0, 0, G, G);
    c.strokeStyle = grau(200, 0.5); c.lineWidth = 3;
    for (let y = 8; y < G; y += 22) {
      c.beginPath();
      for (let x = 0; x <= G; x += 8) c.lineTo(x, y + Math.sin((x / G) * Math.PI * 4 + y) * 5);
      c.stroke();
    }
    flecken(c, z, 800, [0.6, 1.5], [170, 255], 0.5);
  },
  beton: (c, z) => {
    c.fillStyle = grau(235); c.fillRect(0, 0, G, G);
    flecken(c, z, 50, [10, 40], [210, 250], 0.2);
    flecken(c, z, 300, [0.8, 2], [140, 190], 0.5); // Poren
    c.fillStyle = grau(170); c.fillRect(0, 0, G, 2); c.fillRect(0, 0, 2, G); // Schalungsfugen
    for (const [x, y] of [[40, 40], [216, 40], [40, 216], [216, 216]]) {
      c.fillStyle = grau(160); c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
    }
  },
  glut: (c, z) => {
    // schwarz mit glühenden Rissen (leuchtet selbst, kommt also nicht grau):
    // breit dunkelrot, darüber schmal orange-gelb — über den Rand fortgesetzt, damit es nahtlos kachelt
    c.fillStyle = "#000"; c.fillRect(0, 0, G, G);
    const risse: [number, number][][] = [];
    for (let i = 0; i < 5; i++) {
      let x = z() * G, y = z() * G;
      const r: [number, number][] = [[x, y]];
      for (let k = 0; k < 7; k++) { x += (z() - 0.5) * 60; y += (z() - 0.5) * 60; r.push([x, y]); }
      risse.push(r);
    }
    for (const [farbe, breite] of [["rgba(153,27,27,0.55)", 9], ["rgba(234,88,12,0.9)", 3.5], ["rgba(253,224,71,0.9)", 1.2]] as const) {
      c.strokeStyle = farbe; c.lineWidth = breite; c.lineCap = "round"; c.lineJoin = "round";
      for (const r of risse) for (const dx of [-G, 0, G]) for (const dy of [-G, 0, G]) {
        c.beginPath();
        r.forEach(([x, y], k) => (k ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy)));
        c.stroke();
      }
    }
  },
  putz: (c, z) => {
    c.fillStyle = grau(245); c.fillRect(0, 0, G, G);
    flecken(c, z, 120, [3, 12], [215, 255], 0.25);
  },
};

export const MUSTER_NAME: Record<Muster, string> = {
  fels: "Fels", erde: "Erde", stein: "Mauerwerk", holz: "Dielen", parkett: "Fischgrät-Parkett",
  marmor: "Marmor", teppich: "70er-Teppich", fachwerk: "Fachwerk", metall: "Metallplatten",
  eis: "Eis", tapete: "Damast-Tapete", sand: "Sand", beton: "Beton", putz: "Putz", glut: "Glutrisse",
};

/** Die Größe der gemalten Kachel in Pixeln */
export const MUSTER_GROESSE = GROESSE;

/** Muster auf ein Canvas der Größe MUSTER_GROESSE malen (fester Zufall je Muster) */
export function maleMuster(m: Muster, ctx: CanvasRenderingContext2D) {
  MALER[m](ctx, zufallAus([...m].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7)));
}

/**
 * Diese Muster sind unregelmäßig (Fels, Erde, Sand, Eis) — für sie lohnt die
 * Textur-Synthese: aus einer kleinen Probe wächst eine größere, natürlich
 * wirkende Fläche ohne sichtbare Wiederholung. Muster mit geraden Linien
 * (Mauerwerk, Fachwerk, Parkett …) bleiben gemalt; die Synthese würde ihre
 * Fugen zerreißen.
 */
export const MUSTER_SYNTHESE: Muster[] = ["fels", "erde", "sand", "eis"];

/** Das Muster klein gerechnet als Probe (RGBA), null ohne Canvas */
export function musterProbe(m: Muster, groesse = 64): { b: number; h: number; daten: Uint8ClampedArray } | null {
  if (typeof document === "undefined") return null;
  const gross = document.createElement("canvas");
  const g = gross.getContext("2d");
  const klein = document.createElement("canvas");
  const k = klein.getContext("2d");
  if (!g || !k) return null;
  gross.width = gross.height = GROESSE;
  maleMuster(m, g);
  klein.width = klein.height = groesse;
  k.drawImage(gross, 0, 0, groesse, groesse);
  return { b: groesse, h: groesse, daten: k.getImageData(0, 0, groesse, groesse).data };
}
