/**
 * Zeichnet das Küstenprofil auf ein Canvas: Himmel, Wetter, Wasser mit
 * laufenden Wellen, Brandung und Spülsaum, die Bodenschichten, Bewuchs,
 * Bauwerke, Häuser und die Beschriftung.
 *
 * Die Farben sind bewusst »natürlich« und hängen nicht am Farbschema —
 * es ist ein Bild wie im Schulbuch.
 */
import {
  BEWUCHS, SCHUTZ, auflauf, boden, hinterPegel, krone, mhw, mnw,
  type Profil, type Wellen, type Wetter,
} from "@/lib/kueste/profil";
import { zonenAbstand, type Begriff } from "@/lib/kueste/begriffe";

export interface Ausschnitt { x0: number; x1: number; z0: number; z1: number }

export const AUSSCHNITT: Record<Profil["art"], Ausschnitt> = {
  flach: { x0: 60, x1: 360, z0: -9, z1: 15 },
  steil: { x0: 120, x1: 300, z0: -8, z1: 46 },
  marsch: { x0: 110, x1: 400, z0: -5, z1: 10.5 },
};

export interface Bild {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  a: Ausschnitt;
}

export const X = (b: Bild, x: number) => ((x - b.a.x0) / (b.a.x1 - b.a.x0)) * b.w;
export const Z = (b: Bild, z: number) => b.h - ((z - b.a.z0) / (b.a.z1 - b.a.z0)) * b.h;

export interface Szene {
  p: Profil;
  wetter: Wetter;
  W: number;
  H0: number;
  wl: Wellen;
  /** Sekunden Echtzeit — für Wellen, Wolken, Regen */
  t: number;
  /** Zeitraffer so schnell, dass die Tide flimmern würde */
  schnell: boolean;
  begriffe: Begriff[] | null;
  markiert: string | null;
  /** Sekunden seit dem letzten Kliffabbruch (für die Staubwolke) */
  abbruchAlter: number;
  quizTreffer: QuizTreffer | null;
}

const FARBE = {
  fels: { flach: "#a08f73", steil: "#ece7d8", marsch: "#6f5c45" },
  felsLinie: { flach: "#8a7a60", steil: "#cfc8b4", marsch: "#5d4c38" },
  sand: "#e6cf93",
  sandNass: "#c9b27a",
  klei: "#6d583b",
  kern: "#dcc68d",
  gras: "#5d9b3c",
  wasser: "rgba(40,120,190,0.62)",
  wasserHell: "rgba(120,190,235,0.9)",
};

export function himmel(b: Bild, s: Pick<Szene, "wetter" | "t">) {
  const { ctx, w, h } = b;
  const sturm = Math.min(1, Math.max(0, (s.wetter.bft - 5) / 5));
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const oben = mix([120, 180, 230], [95, 105, 120], sturm);
  const unten = mix([215, 235, 248], [160, 168, 178], sturm);
  g.addColorStop(0, rgb(oben));
  g.addColorStop(1, rgb(unten));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Wolken ziehen mit dem Wind — auflandig nach rechts, ablandig nach links
  const richtung = s.wetter.auflandig ? 1 : -1;
  const tempo = 4 + s.wetter.bft * 7;
  const anzahl = 3 + Math.round(sturm * 5);
  ctx.fillStyle = sturm > 0.4 ? "rgba(90,95,105,0.55)" : "rgba(255,255,255,0.8)";
  for (let k = 0; k < anzahl; k++) {
    const breite = w * (0.12 + ((k * 37) % 10) / 60);
    const x = (((k * 211 + richtung * s.t * tempo) % (w + breite * 2)) + w + breite * 2) % (w + breite * 2) - breite;
    const y = h * (0.05 + ((k * 53) % 17) / 100);
    wolke(ctx, x, y, breite);
  }
  if (s.wetter.regen || s.wetter.frost) {
    ctx.strokeStyle = s.wetter.frost ? "rgba(255,255,255,0.85)" : "rgba(210,225,240,0.55)";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    const schraeg = richtung * (2 + s.wetter.bft);
    for (let k = 0; k < 90; k++) {
      const x = ((k * 97.3 + s.t * (60 + s.wetter.bft * 10) * 0.3 * richtung) % w + w) % w;
      const y = ((k * 57.1 + s.t * (s.wetter.frost ? 40 : 420)) % h + h) % h;
      if (s.wetter.frost) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + schraeg, y + 10); ctx.stroke(); }
    }
  }
}

function wolke(ctx: CanvasRenderingContext2D, x: number, y: number, breite: number) {
  const r = breite / 4;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.3, r, 0, Math.PI * 2);
  ctx.arc(x + r * 1.1, y, r * 1.3, 0, Math.PI * 2);
  ctx.arc(x + r * 2.3, y + r * 0.35, r, 0, Math.PI * 2);
  ctx.fill();
}

function mix(a: number[], c: number[], t: number) { return a.map((v, i) => v + (c[i] - v) * t); }
function rgb(c: number[]) { return `rgb(${c.map(Math.round).join(",")})`; }

/** Spaltenbereich, der im Bild liegt */
function spalten(b: Bild, p: Profil) {
  return { von: Math.max(0, Math.floor(b.a.x0)), bis: Math.min(p.n - 1, Math.ceil(b.a.x1)) };
}

function schicht(b: Bild, p: Profil, unten: (i: number) => number, oben: (i: number) => number, farbe: string, rand?: string) {
  const { ctx } = b;
  const { von, bis } = spalten(b, p);
  ctx.beginPath();
  ctx.moveTo(X(b, von), Z(b, oben(von)));
  for (let i = von + 1; i <= bis; i++) ctx.lineTo(X(b, i), Z(b, oben(i)));
  for (let i = bis; i >= von; i--) ctx.lineTo(X(b, i), Z(b, unten(i)));
  ctx.closePath();
  ctx.fillStyle = farbe;
  ctx.fill();
  if (rand) {
    ctx.beginPath();
    ctx.moveTo(X(b, von), Z(b, oben(von)));
    for (let i = von + 1; i <= bis; i++) ctx.lineTo(X(b, i), Z(b, oben(i)));
    ctx.strokeStyle = rand;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function boden_(b: Bild, s: Szene) {
  const { p } = s;
  const { ctx } = b;
  const felsFarbe = FARBE.fels[p.art];
  schicht(b, p, () => b.a.z0 - 1, i => p.fels[i], felsFarbe, FARBE.felsLinie[p.art]);

  // Schichtung im Kliff und Findlinge im Mergel
  if (p.art === "steil") {
    ctx.save();
    ctx.strokeStyle = "rgba(160,150,125,0.35)";
    ctx.lineWidth = 1;
    const { von, bis } = spalten(b, p);
    for (let z = 4; z < 40; z += 5) {
      ctx.beginPath();
      let an = false;
      for (let i = von; i <= bis; i++) {
        if (p.fels[i] > z + 0.5) {
          if (!an) { ctx.moveTo(X(b, i), Z(b, z + Math.sin(i * 0.2) * 0.3)); an = true; }
          else ctx.lineTo(X(b, i), Z(b, z + Math.sin(i * 0.2) * 0.3));
        } else an = false;
      }
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(120,120,120,0.35)";
    for (let i = von; i <= bis; i += 5) {
      if (p.fels[i] < 10) continue;
      const z = 3 + ((i * 7919) % 31);
      if (z < p.fels[i] - 1) { ctx.beginPath(); ctx.arc(X(b, i), Z(b, z), 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  schicht(b, p, i => p.fels[i], i => p.fels[i] + p.sand[i], p.art === "marsch" ? "#8c7a5c" : FARBE.sand);

  // Deich: Sandkern mit Kleidecke
  if (p.deich.some(v => v > 0.05)) {
    const basis = (i: number) => p.fels[i] + p.sand[i];
    schicht(b, p, basis, i => basis(i) + p.deich[i], FARBE.klei);
    schicht(b, p, basis, i => basis(i) + Math.max(0, p.deich[i] - 1.3), FARBE.kern);
  }
}

function bewuchs(b: Bild, s: Szene) {
  const { p } = s;
  const { ctx } = b;
  const { von, bis } = spalten(b, p);
  const px = b.w / (b.a.x1 - b.a.x0);
  for (let i = von; i <= bis; i++) {
    const x = X(b, i), y = Z(b, boden(p, i));
    const art = p.bewuchs[i];
    if (art === BEWUCHS.STRANDHAFER && i % 2 === 0) {
      ctx.strokeStyle = "#7a9a3a";
      ctx.lineWidth = 1.2;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + k * 3 + Math.sin(s.t * 2 + i) * s.wetter.bft * 0.3, y - 9 - (i % 3) * 2); ctx.stroke();
      }
    } else if (art === BEWUCHS.SALZWIESE) {
      ctx.strokeStyle = i % 4 === 0 ? "#9b5c8f" : "#6a9a4a";
      ctx.lineWidth = Math.max(1, px);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 4); ctx.stroke();
    } else if (art === BEWUCHS.GRAS) {
      ctx.strokeStyle = FARBE.gras;
      ctx.lineWidth = Math.max(2, px);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 2.5); ctx.stroke();
      if (p.art === "steil" && i % 9 === 4 && boden(p, i) > 30) baum(ctx, x, y, 1 + (i % 3) * 0.15);
    }
  }
}

function baum(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#6b4a2b";
  ctx.fillRect(x - 1.5 * s, y - 10 * s, 3 * s, 10 * s);
  ctx.fillStyle = "#3f7a3a";
  ctx.beginPath(); ctx.arc(x, y - 16 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#4f8f45";
  ctx.beginPath(); ctx.arc(x - 3 * s, y - 19 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
}

function bauwerke(b: Bild, s: Szene) {
  const { p } = s;
  const { ctx } = b;
  const { von, bis } = spalten(b, p);
  const px = b.w / (b.a.x1 - b.a.x0);
  for (let i = von; i <= bis; i++) {
    const x = X(b, i), y = Z(b, boden(p, i));
    if (p.schutz[i] === SCHUTZ.DECKWERK) {
      ctx.fillStyle = i % 2 ? "#8e9296" : "#a4a8ac";
      ctx.strokeStyle = "#5f6367";
      const r = Math.max(3, px * 0.9);
      ctx.beginPath(); ctx.arc(x, y - r * 0.6, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (p.schutz[i] === SCHUTZ.LAHNUNG && i % 8 === 0) {
      ctx.strokeStyle = "#6b4a2b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, Z(b, boden(p, i) + 1.1)); ctx.stroke();
      ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 3, Z(b, boden(p, i) + 0.6)); ctx.lineTo(x + 3, Z(b, boden(p, i) + 0.7)); ctx.stroke();
    } else if (p.schutz[i] === SCHUTZ.ZAUN) {
      ctx.strokeStyle = "#7a5a33"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 4, y - 6); ctx.lineTo(x + 4, y - 7); ctx.stroke();
    }
    if (p.bloecke[i] > 0.3 && i % 2 === 0) {
      const anz = Math.min(3, Math.round(p.bloecke[i]));
      for (let k = 0; k < anz; k++) {
        const r = 2.5 + ((i * 13 + k * 7) % 4);
        ctx.fillStyle = k % 2 ? "#8b8f94" : "#a2a5a8";
        ctx.beginPath(); ctx.ellipse(x + k * 4 - 4, y - r * 0.7, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function objekte(b: Bild, s: Szene) {
  const { p } = s;
  const { ctx } = b;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const o of p.objekte) {
    if (o.zerstoert) continue;
    const i = Math.round(o.x);
    if (i < b.a.x0 || i > b.a.x1) continue;
    const x = X(b, o.x), y = Z(b, boden(p, i));
    if (o.art === "leuchtturm") {
      const hoehe = Math.min(70, b.h * 0.2), breite = 12;
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k % 2 ? "#ffffff" : "#c8322a";
        const t0 = k / 5, t1 = (k + 1) / 5;
        ctx.beginPath();
        ctx.moveTo(x - breite / 2 + t0 * 3, y - t0 * hoehe);
        ctx.lineTo(x + breite / 2 - t0 * 3, y - t0 * hoehe);
        ctx.lineTo(x + breite / 2 - t1 * 3, y - t1 * hoehe);
        ctx.lineTo(x - breite / 2 + t1 * 3, y - t1 * hoehe);
        ctx.fill();
      }
      ctx.fillStyle = "#333"; ctx.fillRect(x - 5, y - hoehe - 8, 10, 8);
      ctx.fillStyle = Math.sin(s.t * 3) > 0 ? "#ffe066" : "#b8a24a";
      ctx.fillRect(x - 3, y - hoehe - 7, 6, 5);
      continue;
    }
    if (o.art === "burgwall") {
      ctx.fillStyle = "#6f8f45";
      ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.quadraticCurveTo(x, y - 22, x + 16, y); ctx.fill();
      ctx.strokeStyle = "#6b4a2b"; ctx.lineWidth = 2;
      for (let k = -8; k <= 8; k += 4) { ctx.beginPath(); ctx.moveTo(x + k, y - 12); ctx.lineTo(x + k, y - 22); ctx.stroke(); }
      continue;
    }
    const zeichen = o.art === "hotel" ? "🏨" : o.art === "haus" ? "🏠" : o.art === "schaf" ? "🐑" : p.merker.gesperrt ? "🚧" : "🚶";
    ctx.font = `${o.art === "hotel" ? 30 : 22}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.fillText(zeichen, x, y + 2);
  }
}

/** Wasserlinie mit laufenden Wellen: Phase wächst mit der lokalen Wellenlänge */
function wasser(b: Bild, s: Szene) {
  const { p, W, wl } = s;
  const { ctx } = b;
  const { von } = spalten(b, p);
  const bis = Math.min(wl.ufer, Math.ceil(b.a.x1));
  const T = 5 + Math.min(5, s.H0);
  const omega = (2 * Math.PI) / T;
  const oberflaeche: number[] = [];
  let phase = 0;
  for (let i = 0; i <= bis && i < p.n; i++) {
    const tiefe = Math.max(0.2, W - boden(p, i));
    const lambda = Math.min(1.56 * T * T, T * Math.sqrt(9.81 * tiefe));
    phase += (2 * Math.PI) / lambda;
    if (i >= von) oberflaeche[i] = W + (wl.H[i] / 2) * Math.sin(phase - omega * s.t);
  }

  // Wasserkörper
  if (bis > von) {
    ctx.beginPath();
    ctx.moveTo(X(b, von), Z(b, oberflaeche[von]));
    for (let i = von + 1; i < bis; i++) ctx.lineTo(X(b, i), Z(b, oberflaeche[i]));
    ctx.lineTo(X(b, bis), Z(b, W));
    for (let i = bis; i >= von; i--) ctx.lineTo(X(b, i), Z(b, Math.min(boden(p, i), W)));
    ctx.closePath();
    const g = ctx.createLinearGradient(0, Z(b, W), 0, b.h);
    g.addColorStop(0, "rgba(70,150,210,0.72)");
    g.addColorStop(1, "rgba(20,70,130,0.85)");
    ctx.fillStyle = g;
    ctx.fill();

    // Oberfläche
    ctx.beginPath();
    ctx.moveTo(X(b, von), Z(b, oberflaeche[von]));
    for (let i = von + 1; i < bis; i++) ctx.lineTo(X(b, i), Z(b, oberflaeche[i]));
    ctx.strokeStyle = FARBE.wasserHell;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Schaum, wo die Wellen brechen und Kraft verlieren
    for (let i = Math.max(von + 1, 1); i < bis; i++) {
      const verlust = wl.H[i - 1] - wl.H[i];
      if (verlust <= 0.004) continue;
      const kamm = oberflaeche[i] - W;
      if (kamm < wl.H[i] * 0.15) continue;
      const staerke = Math.min(1, verlust * 25);
      ctx.fillStyle = `rgba(255,255,255,${0.35 + staerke * 0.6})`;
      const r = 1.5 + staerke * 3 + (wl.brecher >= 0 && Math.abs(i - wl.brecher) < 8 ? 2 : 0);
      ctx.beginPath(); ctx.arc(X(b, i), Z(b, oberflaeche[i]), r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Spülsaum: die auslaufende Welle schwappt den Strand hinauf und zurück
  const R = auflauf(wl, s.H0);
  const hoch = W + R * Math.pow(Math.max(0, Math.sin(omega * s.t * 0.5)), 2);
  let j = wl.ufer;
  while (j < p.n - 1 && boden(p, j) < hoch && j - wl.ufer < 60) j++;
  if (j > wl.ufer) {
    ctx.beginPath();
    ctx.moveTo(X(b, wl.ufer), Z(b, W));
    for (let i = wl.ufer; i <= j; i++) ctx.lineTo(X(b, i), Z(b, boden(p, i) + 0.12));
    for (let i = j; i >= wl.ufer; i--) ctx.lineTo(X(b, i), Z(b, boden(p, i)));
    ctx.closePath();
    ctx.fillStyle = "rgba(235,248,255,0.8)";
    ctx.fill();
  }

  // Wasser hinter Düne oder Deich
  const k = krone(p, wl.ufer);
  const L = wl.ufer >= p.n ? -Infinity : hinterPegel(p, k);
  if (Number.isFinite(L) && k >= 0) {
    // Zusammenhängende Senken als Flächen, sonst entstehen Streifen
    ctx.fillStyle = "rgba(60,130,190,0.7)";
    let i = k + 1;
    while (i < p.n) {
      if (boden(p, i) >= L) { i++; continue; }
      const a = i;
      while (i < p.n && boden(p, i) < L) i++;
      ctx.beginPath();
      ctx.moveTo(X(b, a - 0.5), Z(b, L));
      for (let j = a; j < i; j++) ctx.lineTo(X(b, j), Z(b, boden(p, j)));
      ctx.lineTo(X(b, i - 0.5), Z(b, L));
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Im schnellen Zeitraffer: statt flimmernder Tide der Bereich zwischen MNW und MHW */
function tideBand(b: Bild, s: Szene) {
  const { p } = s;
  if (p.hub < 0.5) return;
  const { ctx } = b;
  const y1 = Z(b, mhw(p)), y0 = Z(b, mnw(p));
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, y1, X(b, s.wl.ufer), y0 - y1);
}

function linien(b: Bild, s: Szene) {
  const { p } = s;
  const { ctx } = b;
  if (p.hub < 0.5) return;
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(20,70,160,0.8)";
  const bisX = X(b, Math.min(p.n - 1, s.wl.ufer + 5));
  for (const z of [mhw(p), mnw(p)]) {
    ctx.beginPath(); ctx.moveTo(0, Z(b, z)); ctx.lineTo(bisX, Z(b, z)); ctx.stroke();
  }
  ctx.restore();
}

function kliff(b: Bild, s: Szene) {
  const { p, W } = s;
  if (p.art !== "steil") return;
  const { ctx } = b;
  let kante = -1;
  for (let i = 1; i < p.n; i++) if (p.fels[i] - p.fels[i - 1] > 3) { kante = i; break; }
  if (kante < 0) return;
  const fuss = Math.max(W, p.fels[kante - 1]);
  const x = X(b, kante);
  const px = b.w / (b.a.x1 - b.a.x0);
  // Hohlkehle als dunkle Kerbe
  if (p.kehle > 0.05) {
    const tief = p.kehle * px * 1.6;
    ctx.fillStyle = "rgba(70,62,50,0.85)";
    ctx.beginPath();
    ctx.moveTo(x, Z(b, fuss - 0.2));
    ctx.quadraticCurveTo(x + tief * 1.6, Z(b, fuss + 0.8), x, Z(b, fuss + 2.2));
    ctx.fill();
  }
  // Risse: je mürber die Wand, desto mehr
  const risse = Math.round(Math.min(1, p.verwitterung) * 6);
  ctx.strokeStyle = "rgba(90,80,65,0.7)";
  ctx.lineWidth = 1.2;
  const oben = boden(p, kante);
  for (let k = 0; k < risse; k++) {
    const rx = x + (4 + k * 6) * Math.max(1, px * 0.6);
    ctx.beginPath();
    ctx.moveTo(rx, Z(b, oben));
    ctx.lineTo(rx + 3, Z(b, oben - 3 - k));
    ctx.lineTo(rx - 1, Z(b, oben - 6 - k * 1.5));
    ctx.stroke();
  }
  // Staub und fallende Brocken nach einem Abbruch
  if (p.abbruch && s.abbruchAlter < 2.5) {
    const a = s.abbruchAlter;
    const x0 = X(b, p.abbruch.x0 - 6), x1 = X(b, p.abbruch.x1);
    for (let k = 0; k < 30; k++) {
      const fx = x0 + ((k * 37) % 100) / 100 * (x1 - x0);
      const start = Z(b, 38 - (k % 7) * 3);
      const y = Math.min(Z(b, fuss), start + 0.5 * 900 * a * a * (0.6 + (k % 5) / 10));
      ctx.fillStyle = k % 3 ? "#d8d2c0" : "#9a9488";
      ctx.fillRect(fx - 3, y - 3, 6, 6);
    }
    ctx.fillStyle = `rgba(230,225,210,${Math.max(0, 0.6 - a * 0.24)})`;
    ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, Z(b, fuss + 4), 30 + a * 40, 18 + a * 20, 0, 0, Math.PI * 2); ctx.fill();
  }
}

export function schilder(b: Bild, s: Pick<Szene, "begriffe" | "markiert" | "W">) {
  if (!s.begriffe) return;
  const { ctx } = b;
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const belegt: { x0: number; x1: number; y: number }[] = [];
  const sortiert = [...s.begriffe].sort((a, c) => a.x - c.x);
  for (const be of sortiert) {
    const ax = X(b, be.x), ay = Z(b, be.z);
    const linie = be.id === "mhw" || be.id === "mnw" || be.id === "mw";
    if (!linie && (ax < -5 || ax > b.w + 5)) continue;
    const unterWasser = be.z < s.W - 0.3 && !linie;
    const breite = ctx.measureText(be.name).width + 12;
    let lx = Math.max(4, Math.min(b.w - breite - 4, ax - breite / 2));
    let ly = linie ? ay - 10 : unterWasser ? Math.min(b.h - 14, ay + 34) : Math.max(14, ay - 38);
    if (linie) lx = 6;
    for (let n = 0; n < 8; n++) {
      const kollision = belegt.some(q => lx < q.x1 && lx + breite > q.x0 && Math.abs(q.y - ly) < 20);
      if (!kollision) break;
      ly += unterWasser ? 20 : -20;
    }
    belegt.push({ x0: lx, x1: lx + breite, y: ly });
    const hervor = s.markiert === be.id;
    // Die Trefferzone als Oval zeigen, wenn der Begriff ausgewählt ist
    if (hervor && be.rx && be.rz) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "#f59e0b";
      ctx.fillStyle = "rgba(245,158,11,0.12)";
      ctx.lineWidth = 2;
      const zx = X(b, be.zx ?? be.x), zy = Z(b, be.zz ?? be.z);
      ctx.beginPath();
      ctx.ellipse(zx, zy, Math.abs(X(b, (be.zx ?? be.x) + be.rx) - zx), Math.abs(Z(b, (be.zz ?? be.z) + be.rz) - zy), 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (!linie) {
      ctx.strokeStyle = hervor ? "#f59e0b" : "rgba(30,30,30,0.75)";
      ctx.lineWidth = hervor ? 2.5 : 1.2;
      ctx.beginPath(); ctx.moveTo(lx + breite / 2, ly + (unterWasser ? -9 : 9)); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.fillStyle = hervor ? "#f59e0b" : "#222";
      ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = hervor ? "#fde68a" : "rgba(255,255,255,0.92)";
    ctx.strokeStyle = hervor ? "#f59e0b" : "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    rundRechteck(ctx, lx, ly - 9, breite, 18, 5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = linie ? "#14469a" : "#1f2937";
    ctx.fillText(be.name, lx + 6, ly);
  }
}

function rundRechteck(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function massstab(b: Bild) {
  const { ctx } = b;
  const meter = 50;
  const laenge = X(b, b.a.x0 + meter);
  const y = b.h - 12, x = b.w - 12 - laenge;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + laenge, y); ctx.stroke();
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${meter} m  (Höhe überzeichnet)`, x + laenge, y - 3);
}

/** Nach einer Quizantwort: die Zone des gesuchten Begriffs grün (richtig) oder rot umranden */
export interface QuizTreffer { x: number; z: number; ok: boolean; rx?: number; rz?: number; zx?: number; zz?: number }

export function trefferZeigen(b: Bild, t: QuizTreffer) {
  const { ctx } = b;
  const mx = t.zx ?? t.x, mz = t.zz ?? t.z;
  const ax = X(b, mx), ay = Z(b, mz);
  ctx.save();
  ctx.strokeStyle = t.ok ? "#16a34a" : "#dc2626";
  ctx.fillStyle = t.ok ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(ax, ay, Math.max(14, Math.abs(X(b, mx + (t.rx ?? 0)) - ax)), Math.max(14, Math.abs(Z(b, mz + (t.rz ?? 0)) - ay)), 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function welt(b: Bild, mx: number, my: number) {
  return { x: b.a.x0 + (mx / b.w) * (b.a.x1 - b.a.x0), z: b.a.z1 - (my / b.h) * (b.a.z1 - b.a.z0) };
}

/** Liegt der Klick in der Zone dieses Begriffs oder nah an seinem Schildpunkt? */
export function trifft(b: Bild, be: Begriff, mx: number, my: number) {
  const { x, z } = welt(b, mx, my);
  return Math.hypot(X(b, be.x) - mx, Z(b, be.z) - my) < 26 || zonenAbstand(be, x, z) <= 1;
}

/**
 * Welcher Begriff liegt unter dem Klick (zum Nachlesen)? Liegen mehrere
 * Zonen übereinander, gewinnt die kleinste — so bleibt ein Feuersteinband
 * in der großen Kreide-Zone anwählbar. Im Quiz zählt dagegen `trifft`:
 * jeder Klick in die Zone des gesuchten Begriffs ist richtig.
 */
export function trefferBei(b: Bild, liste: Begriff[], mx: number, my: number): Begriff | null {
  let best: Begriff | null = null, flaeche = Infinity;
  for (const be of liste) {
    if (!trifft(b, be, mx, my)) continue;
    const f = (be.rx ?? 3) * (be.rz ?? 1);
    if (f < flaeche) { flaeche = f; best = be; }
  }
  return best;
}

export function zeichne(b: Bild, s: Szene) {
  b.ctx.clearRect(0, 0, b.w, b.h);
  himmel(b, s);
  boden_(b, s);
  bewuchs(b, s);
  kliff(b, s);
  if (s.schnell) tideBand(b, s);
  wasser(b, s);
  bauwerke(b, s);
  objekte(b, s);
  linien(b, s);
  schilder(b, s);
  if (s.quizTreffer) trefferZeigen(b, s.quizTreffer);
  massstab(b);
}
