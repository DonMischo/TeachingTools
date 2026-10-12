/**
 * Atlas-Signaturen für Themenpunkte und -flächen (wie im Schulatlas): farbiges Grundzeichen in
 * der Legendenfarbe mit weißem Bildzeichen — Blitz für Wärmekraftwerke, Strahlenzeichen für
 * Kernkraft, Schlägel und Eisen für Bergbau, Flugzeug, Anker, Fabrik … Landwirtschaft (Wein,
 * Obst, Hopfen) als freies Bildzeichen in der Farbe, ohne Grundzeichen.
 *
 * MapLibre fordert die Bilder beim ersten Bedarf an (setMissingStyleImageResolver → zeichneSymbol):
 * Name »sig:<bild>:<grund>:<farbe>«. Gezeichnet wird doppelt so groß (pixelRatio 2, scharf).
 */
import type { Darstellung } from "./stil";

export type Grund = "quadrat" | "kreis" | "frei" | "hohl";
type Signatur = { bild: Bild; grund: Grund };

/** Je Ebene und Wert (darstellung.feld) das Zeichen; »*« gilt für alle übrigen Werte */
export const SIGNATUREN: Record<string, Record<string, Signatur>> = {
  "de-kraftwerke": {
    kernenergie: { bild: "atom", grund: "kreis" }, wasser: { bild: "welle", grund: "quadrat" }, "*": { bild: "blitz", grund: "quadrat" },
  },
  "de-bergbau": { historisch: { bild: "schlaegel", grund: "hohl" }, "*": { bild: "schlaegel", grund: "quadrat" } },
  "de-flughaefen": { "*": { bild: "flugzeug", grund: "kreis" } },
  "eu-haefen-flughaefen": { hafen: { bild: "anker", grund: "kreis" }, flughafen: { bild: "flugzeug", grund: "kreis" } },
  "us-industrie": {
    auto: { bild: "auto", grund: "quadrat" }, stahl: { bild: "traeger", grund: "quadrat" }, maschinen: { bild: "zahnrad", grund: "quadrat" },
    petrochemie: { bild: "bohrturm", grund: "quadrat" }, hightech: { bild: "chip", grund: "quadrat" },
    luftfahrt: { bild: "flugzeug", grund: "quadrat" }, dienstleistung: { bild: "dollar", grund: "quadrat" },
  },
  "de-industrie": { "*": { bild: "fabrik", grund: "quadrat" } },
  "de-sonderkulturen": { wein: { bild: "traube", grund: "frei" }, obst: { bild: "apfel", grund: "frei" }, hopfen: { bild: "hopfen", grund: "frei" } },
};
SIGNATUREN["eu-kraftwerke"] = SIGNATUREN["de-kraftwerke"];

export function signaturVon(ebene: string, wert: string | number): Signatur | null {
  const s = SIGNATUREN[ebene];
  return s ? s[String(wert)] ?? s["*"] ?? null : null;
}

export const signaturName = (s: Signatur, farbe: string) => `sig:${s.bild}:${s.grund}:${farbe}`;

/** MapLibre-Ausdruck »icon-image«: je Wert der Name des Zeichens */
export function signaturAusdruck(ebene: string, d: Darstellung): unknown[] | null {
  if (!SIGNATUREN[ebene]) return null;
  const faelle = d.werte.flatMap((w) => {
    const s = signaturVon(ebene, w.wert);
    return s ? [w.wert, signaturName(s, w.farbe)] : [];
  });
  return ["match", ["get", d.feld], ...faelle, ""];
}

/** Anzeigegröße in CSS-Pixeln (Bild doppelt so groß) */
export const SIGNATUR_PX = 22;

type Bild = "blitz" | "atom" | "welle" | "schlaegel" | "flugzeug" | "anker" | "fabrik" | "auto" | "traeger" | "zahnrad"
  | "bohrturm" | "chip" | "dollar" | "traube" | "apfel" | "hopfen";

/** Bildzeichen im Einheitsquadrat (0–1), mit der aktuellen Füll- und Strichfarbe */
const BILDER: Record<Bild, (g: CanvasRenderingContext2D, loch: Loch) => void> = {
  blitz(g) { poly(g, [[0.58, 0.06], [0.24, 0.56], [0.47, 0.56], [0.38, 0.94], [0.76, 0.42], [0.53, 0.42], [0.66, 0.06]]); g.fill(); },
  atom(g) {
    // Strahlenzeichen: Punkt in der Mitte, drei Flügel
    g.beginPath(); g.arc(0.5, 0.5, 0.09, 0, Math.PI * 2); g.fill();
    for (const mitte of [-90, 30, 150]) {
      const a = ((mitte - 30) * Math.PI) / 180, b = ((mitte + 30) * Math.PI) / 180;
      g.beginPath(); g.arc(0.5, 0.5, 0.42, a, b); g.arc(0.5, 0.5, 0.15, b, a, true); g.closePath(); g.fill();
    }
  },
  welle(g) {
    g.lineWidth = 0.09; g.lineCap = "round";
    for (const y of [0.3, 0.5, 0.7]) {
      g.beginPath(); g.moveTo(0.14, y);
      g.bezierCurveTo(0.3, y - 0.12, 0.38, y + 0.12, 0.5, y); g.bezierCurveTo(0.62, y - 0.12, 0.7, y + 0.12, 0.86, y); g.stroke();
    }
  },
  schlaegel(g) {
    // Schlägel und Eisen: zwei gekreuzte Stiele, oben je ein Kopf
    g.lineWidth = 0.09; g.lineCap = "round";
    for (const s of [1, -1]) {
      g.save(); g.translate(0.5, 0.5); g.rotate((s * Math.PI) / 4);
      g.beginPath(); g.moveTo(0, -0.12); g.lineTo(0, 0.4); g.stroke();
      if (s > 0) g.fillRect(-0.2, -0.38, 0.4, 0.17); // Schlägel: breiter Hammerkopf
      else { poly(g, [[-0.24, -0.26], [0.14, -0.38], [0.14, -0.2], [-0.24, -0.2]]); g.fill(); } // Eisen: Spitzhacke
      g.restore();
    }
  },
  flugzeug(g) {
    poly(g, [[0.5, 0.06], [0.56, 0.14], [0.56, 0.38], [0.92, 0.58], [0.92, 0.66], [0.56, 0.55], [0.56, 0.78], [0.68, 0.88], [0.68, 0.94],
      [0.5, 0.89], [0.32, 0.94], [0.32, 0.88], [0.44, 0.78], [0.44, 0.55], [0.08, 0.66], [0.08, 0.58], [0.44, 0.38], [0.44, 0.14]]);
    g.fill();
  },
  anker(g) {
    g.lineWidth = 0.085; g.lineCap = "round";
    g.beginPath(); g.arc(0.5, 0.17, 0.08, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(0.5, 0.25); g.lineTo(0.5, 0.86); g.moveTo(0.3, 0.36); g.lineTo(0.7, 0.36); g.stroke();
    g.beginPath(); g.arc(0.5, 0.52, 0.34, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
    poly(g, [[0.12, 0.6], [0.24, 0.7], [0.13, 0.75]]); g.fill();
    poly(g, [[0.88, 0.6], [0.76, 0.7], [0.87, 0.75]]); g.fill();
  },
  fabrik(g) {
    // Sheddach mit Schornstein
    poly(g, [[0.1, 0.9], [0.1, 0.5], [0.33, 0.34], [0.33, 0.5], [0.56, 0.34], [0.56, 0.5], [0.72, 0.4], [0.72, 0.1], [0.86, 0.1], [0.86, 0.9]]);
    g.fill();
  },
  auto(g, loch) {
    poly(g, [[0.06, 0.7], [0.06, 0.52], [0.2, 0.48], [0.32, 0.3], [0.68, 0.3], [0.8, 0.48], [0.94, 0.52], [0.94, 0.7]]); g.fill();
    loch(() => { g.beginPath(); g.arc(0.27, 0.72, 0.13, 0, Math.PI * 2); g.moveTo(0.86, 0.72); g.arc(0.73, 0.72, 0.13, 0, Math.PI * 2); g.fill(); });
    g.beginPath(); g.arc(0.27, 0.72, 0.08, 0, Math.PI * 2); g.moveTo(0.81, 0.72); g.arc(0.73, 0.72, 0.08, 0, Math.PI * 2); g.fill();
  },
  traeger(g) {
    // Doppel-T-Träger (Eisen und Stahl)
    poly(g, [[0.16, 0.14], [0.84, 0.14], [0.84, 0.3], [0.58, 0.3], [0.58, 0.7], [0.84, 0.7], [0.84, 0.86], [0.16, 0.86], [0.16, 0.7],
      [0.42, 0.7], [0.42, 0.3], [0.16, 0.3]]);
    g.fill();
  },
  zahnrad(g, loch) {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 0.3 : 0.42, a = (i / 16) * Math.PI * 2;
      const a0 = a - Math.PI / 16, a1 = a + Math.PI / 16;
      g.lineTo(0.5 + r * Math.cos(a0), 0.5 + r * Math.sin(a0)); g.lineTo(0.5 + r * Math.cos(a1), 0.5 + r * Math.sin(a1));
    }
    g.closePath(); g.fill();
    loch(() => { g.beginPath(); g.arc(0.5, 0.5, 0.13, 0, Math.PI * 2); g.fill(); });
  },
  bohrturm(g) {
    // Bohrturm (Erdöl): Gittermast
    g.lineWidth = 0.07; g.lineJoin = "round";
    g.beginPath(); g.moveTo(0.22, 0.92); g.lineTo(0.5, 0.08); g.lineTo(0.78, 0.92);
    g.moveTo(0.33, 0.6); g.lineTo(0.67, 0.6); g.moveTo(0.41, 0.35); g.lineTo(0.59, 0.35);
    g.moveTo(0.33, 0.6); g.lineTo(0.59, 0.35); g.moveTo(0.67, 0.6); g.lineTo(0.41, 0.35);
    g.moveTo(0.14, 0.92); g.lineTo(0.86, 0.92); g.stroke();
  },
  chip(g) {
    g.fillRect(0.28, 0.28, 0.44, 0.44);
    for (const t of [0.36, 0.5, 0.64]) {
      g.fillRect(t - 0.035, 0.12, 0.07, 0.16); g.fillRect(t - 0.035, 0.72, 0.07, 0.16);
      g.fillRect(0.12, t - 0.035, 0.16, 0.07); g.fillRect(0.72, t - 0.035, 0.16, 0.07);
    }
  },
  dollar(g) {
    g.font = "bold 0.8px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", 0.5, 0.54);
  },
  traube(g) {
    for (const [x, y] of [[0.3, 0.38], [0.5, 0.38], [0.7, 0.38], [0.4, 0.56], [0.6, 0.56], [0.5, 0.74]]) {
      g.beginPath(); g.arc(x, y, 0.11, 0, Math.PI * 2); g.fill();
    }
    g.lineWidth = 0.07; g.lineCap = "round"; g.beginPath(); g.moveTo(0.5, 0.27); g.lineTo(0.58, 0.08); g.stroke();
  },
  apfel(g) {
    g.beginPath(); g.arc(0.38, 0.58, 0.27, 0, Math.PI * 2); g.arc(0.62, 0.58, 0.27, 0, Math.PI * 2); g.fill();
    g.lineWidth = 0.07; g.lineCap = "round"; g.beginPath(); g.moveTo(0.5, 0.32); g.lineTo(0.54, 0.1); g.stroke();
    g.beginPath(); g.ellipse(0.68, 0.18, 0.12, 0.06, -0.5, 0, Math.PI * 2); g.fill();
  },
  hopfen(g) {
    // Hopfendolde: übereinanderliegende Schuppen
    for (const [x, y, r] of [[0.5, 0.82, 0.1], [0.38, 0.66, 0.12], [0.62, 0.66, 0.12], [0.5, 0.5, 0.14], [0.36, 0.36, 0.11], [0.64, 0.36, 0.11]]) {
      g.beginPath(); g.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2); g.fill();
    }
    g.lineWidth = 0.07; g.lineCap = "round"; g.beginPath(); g.moveTo(0.5, 0.26); g.lineTo(0.5, 0.06); g.stroke();
  },
};

/** Aussparung: in der Farbe des Grundzeichens füllen (ohne Grundzeichen: wirklich ausstanzen) */
type Loch = (zeichne: () => void) => void;

function poly(g: CanvasRenderingContext2D, punkte: number[][]) {
  g.beginPath();
  punkte.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

/** Zeichnet das Zeichen auf eine neue Leinwand (null ohne Canvas, z. B. in Tests). */
export function signaturLeinwand(name: string): HTMLCanvasElement | null {
  const [, bild, grund, farbe] = name.split(":") as [string, Bild, Grund, string];
  if (!BILDER[bild]) return null;
  const s = SIGNATUR_PX * 2, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  if (!g) return null;
  const rand = s * 0.06;
  g.lineJoin = "round";
  if (grund === "frei") {
    // Ohne Grundzeichen: weißer Saum, damit das Bild auf jeder Fläche lesbar bleibt
    g.save(); g.translate(rand, rand); g.scale(s - 2 * rand, s - 2 * rand);
    g.fillStyle = g.strokeStyle = "#ffffff"; g.shadowColor = "#ffffff"; g.shadowBlur = s * 0.08;
    const frei: Loch = () => {};
    BILDER[bild](g, frei); BILDER[bild](g, frei);
    g.restore();
  } else {
    g.fillStyle = grund === "hohl" ? "#ffffff" : farbe;
    g.strokeStyle = grund === "hohl" ? "#4b4b4b" : "#ffffff";
    g.lineWidth = s * 0.06;
    g.beginPath();
    if (grund === "kreis") g.arc(s / 2, s / 2, s / 2 - rand, 0, Math.PI * 2);
    else g.roundRect(rand, rand, s - 2 * rand, s - 2 * rand, s * 0.14);
    g.fill(); g.stroke();
  }
  const innen = grund === "frei" ? 0 : s * 0.2;
  g.save(); g.translate(rand + innen, rand + innen); g.scale(s - 2 * (rand + innen), s - 2 * (rand + innen));
  g.fillStyle = g.strokeStyle = grund === "frei" ? farbe : grund === "hohl" ? "#4b4b4b" : "#ffffff";
  const hinten = grund === "frei" ? null : grund === "hohl" ? "#ffffff" : farbe;
  const loch: Loch = (zeichne) => {
    g.save();
    if (hinten) g.fillStyle = hinten;
    else g.globalCompositeOperation = "destination-out";
    zeichne();
    g.restore();
  };
  BILDER[bild](g, loch);
  g.restore();
  return c;
}

/** Bild für MapLibre (addImage mit pixelRatio 2) */
export function zeichneSignatur(name: string): { width: number; height: number; data: Uint8ClampedArray } | null {
  const c = signaturLeinwand(name);
  return c ? { width: c.width, height: c.height, data: c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data } : null;
}

/** Für die Legende: Zeichen als data:-URL (null ohne Canvas) */
export function signaturUrl(ebene: string, wert: string | number, farbe: string): string | null {
  const s = signaturVon(ebene, wert);
  if (!s) return null;
  try {
    return signaturLeinwand(signaturName(s, farbe))?.toDataURL() ?? null;
  } catch {
    return null;
  }
}
