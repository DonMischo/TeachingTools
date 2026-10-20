/**
 * Ausgangs-Querschnitte für »Gesteine & Verwitterung« — je Gestein eine
 * Landschaft mit ihren typischen Formen, beschriftet:
 *   Kalk     Bach → Ponor (Schluckloch), Trockental, Lösungs- und Einsturzdoline,
 *            Tropfsteinhöhle, Höhlenbach, Karstquelle über Ton
 *   Gips     Bachschwinde, Schlotten, Gipshöhle mit Laugdecke, Erdfall
 *   Granit   Kuppe wie der Brocken mit Bankung und Klüften → Wollsäcke
 *   Sandstein Tafelberg, Schlucht, Felsnadel mit weicher Schicht
 *   Schiefer Grat und Schutthalden, Basalt Decke mit Säulen und Blockhalde,
 *   Löss     Hohlweg, Terrassen, Runse; Ton Quellhorizont und Rutschung;
 *   Sand     Wanderdünen und bewachsene Graudüne
 */
import { perlin, zufallsquelle } from "./rauschen";
import {
  BASALT, BODEN, GIPS, GRANIT, GRUS, KALK, LOESS, LUFT, SAND, SANDSTEIN, SCHIEFER, SCHUTT, SINTER, STOFFE, TON,
  leereWirkung, type Gestein, type Querschnitt,
} from "./verwitterung";

export interface Phase { klima: string; schritte: number; titel: string; text: string }

/** Erdgeschichte zum Abspielen (nur wo eine Abfolge die Form erklärt) */
export const PHASEN: Partial<Record<Gestein, Phase[]>> = {
  granit: [
    { klima: "tropen", schritte: 300, titel: "Tertiär: feucht und warm", text: "Wasser dringt in die Klüfte, die Feldspäte zersetzen sich zu Ton, der Granit zerfällt zu Grus — tief im Untergrund. Die Ecken der Blöcke werden von mehreren Seiten angegriffen und runden sich: Wollsäcke im Grus." },
    { klima: "eiszeit", schritte: 450, titel: "Eiszeit: Frost und Schmelzwasser", text: "Ohne schützende Pflanzen spülen Schmelzwasser und Bodenfließen den lockeren Grus fort. Die harten, gerundeten Kerne bleiben liegen und rutschen nach: Felsburgen und Blockmeere entstehen." },
    { klima: "mittel", schritte: 150, titel: "Heute", text: "Wald wächst auf dem Grus, die Wollsäcke liegen frei — so sieht es am Brocken, im Fichtelgebirge (Luisenburg) oder an den Greifensteinen aus." },
  ],
  kalk: [
    { klima: "mittel", schritte: 1500, titel: "Verkarstung des gehobenen Rückens", text: "Regenwasser mit Kohlensäure sickert in die Klüfte und löst Kalk. Wo mehr Wasser fließt, wird mehr gelöst — die Wege weiten sich und ziehen noch mehr Wasser an. Über dem Ton fließt das Karstwasser seitlich zu Quellen am Hang; dort wachsen Röhren und Höhlen. Gesättigtes Sickerwasser bildet in den Höhlen Tropfsteine, zu weite Decken brechen ein — Dolinen entstehen." },
  ],
};

interface Bau {
  W: number; H: number; stoff: Uint8Array; riss: Float32Array; haerte: Float32Array; eltern: Uint8Array;
  marken: { text: string; x: number; y: number }[]; quellen: { x: number; y: number; staerke: number }[];
}

const ellipse = (b: Bau, cx: number, cy: number, rx: number, ry: number, m: number, rauh = 0, seed = 1) => {
  const r = perlin(seed);
  for (let j = Math.floor(cy - ry * 1.4); j <= cy + ry * 1.4; j++) for (let i = Math.floor(cx - rx * 1.4); i <= cx + rx * 1.4; i++) {
    if (i < 0 || j < 0 || i >= b.W || j >= b.H) continue;
    const d = ((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2;
    if (d < 1 + rauh * r(i / 6, j / 6)) { b.stoff[j * b.W + i] = m; b.riss[j * b.W + i] = 0; }
  }
};

/** Gang entlang eines Linienzugs mit Höhe h (Boden flach, Decke gewölbt) */
const gang = (b: Bau, pts: [number, number][], h: number, seed = 2) => {
  const r = perlin(seed);
  for (let s = 0; s + 1 < pts.length; s++) {
    const [x0, y0] = pts[s], [x1, y1] = pts[s + 1];
    const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) + Math.abs(y1 - y0)));
    for (let t = 0; t <= n; t++) {
      const x = Math.round(x0 + (x1 - x0) * t / n), y = y0 + (y1 - y0) * t / n;
      const hh = h * (0.8 + 0.4 * r(x / 12, s));
      for (let j = Math.round(y - hh); j <= Math.round(y); j++) for (let dx = -1; dx <= 1; dx++) {
        const i = x + dx;
        if (i >= 0 && j >= 0 && i < b.W && j < b.H) { b.stoff[j * b.W + i] = LUFT; b.riss[j * b.W + i] = 0; }
      }
    }
  }
};

const kluft = (b: Bau, i: number, j: number, v: number) => {
  if (i >= 0 && j >= 0 && i < b.W && j < b.H && b.stoff[j * b.W + i] !== LUFT) b.riss[j * b.W + i] = Math.max(b.riss[j * b.W + i], v);
};

/** Tropfstein: senkrechte Sinter-Säule von (x, y) aus, Richtung d (+1 nach unten) */
const tropfstein = (b: Bau, x: number, y: number, l: number, d: 1 | -1) => {
  for (let s = 0; s < l; s++) {
    const j = y + s * d;
    if (j < 0 || j >= b.H) break;
    const k = j * b.W + x;
    if (b.stoff[k] !== LUFT) break;
    b.stoff[k] = SINTER;
    if (s < l * 0.4 && x + 1 < b.W && b.stoff[k + 1] === LUFT) b.stoff[k + 1] = SINTER;
  }
};

/** `beispiel`: beim Kalk die fertige Karstlandschaft statt des unberührten Rückens */
export function querschnitt(g: Gestein, seed = 1, W = 400, H = 220, beispiel = false): Querschnitt {
  const z = zufallsquelle(seed);
  const r = perlin(seed);
  const N = W * H;
  const b: Bau = { W, H, stoff: new Uint8Array(N), riss: new Float32Array(N), haerte: new Float32Array(N).fill(1), eltern: new Uint8Array(N), marken: [], quellen: [] };
  const X = (f: number) => Math.round(f * W), Y = (f: number) => Math.round(f * H);
  const marke = (text: string, x: number, y: number) => b.marken.push({ text, x: Math.round(x), y: Math.round(y) });
  const ober = new Int16Array(W);
  /** Spalten füllen: Oberfläche o(x), Stoff je Tiefe */
  const fuellen = (o: (x: number) => number, m: (i: number, j: number, tief: number) => number) => {
    for (let i = 0; i < W; i++) {
      const oo = Math.max(3, Math.min(H - 4, Math.round(o(i / W))));
      ober[i] = oo;
      for (let j = oo; j < H; j++) b.stoff[j * W + i] = m(i, j, j - oo);
    }
  };
  const bodendecke = (dicke: number, nur?: (m: number) => boolean, p = 0.9) => {
    for (let i = 0; i < W; i++) for (let j = ober[i]; j < ober[i] + dicke && j < H; j++) {
      const k = j * W + i;
      if (b.stoff[k] !== LUFT && (!nur || nur(b.stoff[k])) && z() < p) b.stoff[k] = BODEN;
    }
  };

  switch (g) {
    case "kalk": {
      if (!beispiel) {
        // Gehobener Kalkrücken auf aufgewölbtem Ton/Mergel (Antiklinale): fast unberührt, nur Klüfte und Schichtfugen.
        // Höhlen, Dolinen, Quellen und Tropfsteine sollen erst durch das Wasser entstehen.
        const basis = (x: number) => H * (0.74 - 0.16 * (1 - ((x - 0.5) / 0.5) ** 2));
        fuellen(x => {
          const f = Math.abs(x - 0.5) / 0.5;
          if (f > 0.9) return H * 0.72; // Täler am Fuß: hier fließen die Flüsse (Vorfluter)
          return H * (0.12 + 0.56 * f ** 1.7) + 1.5 * r(x * 8, 2);
        }, (i, j) => (j > basis(i / W) ? TON : KALK));
        for (let k = 0; k < N; k++) if (b.stoff[k] === KALK) {
          const i = k % W, j = Math.floor(k / W);
          // Bänke parallel zur Aufwölbung, verschieden fest
          b.haerte[k] = 0.8 + 0.4 * (Math.sin((basis(i / W) - j) * 0.33) > 0 ? 1 : 0);
        }
        // Klüfte nur im Kalk; der Ton darunter ist plastisch und dicht
        for (let i = 6 + Math.floor(z() * 8); i < W; i += 12 + Math.floor(z() * 12)) for (let j = 0; j < H; j++) { const ii = i + Math.round(r(j / 30, i) * 2); if (j < basis(ii / W)) kluft(b, ii, j, 0.42 + 0.1 * z()); }
        for (let i = 0; i < W; i++) for (let n = 1; n < 14; n++) kluft(b, i, Math.round(basis(i / W) - n * 9), 0.3);
        bodendecke(2, m => m === KALK);
        marke("Gehobener Kalkrücken", X(0.5), ober[X(0.5)] - 10);
        marke("Klüfte und Schichtfugen", X(0.36), ober[X(0.36)] + 22);
        marke("Ton/Mergel (undurchlässig, aufgewölbt)", X(0.5), Y(0.86));
        marke("Tal", X(0.04), Y(0.66));
        marke("Tal", X(0.96), Y(0.66));
        break;
      }
      const tal = 0.84;
      fuellen(x => {
        if (x < 0.22) return H * (0.1 + x * 0.45); // Bachbett: gleichmäßiges Gefälle zum Ponor
        if (x > tal + 0.03) return H * 0.86;
        if (x > tal) return H * (0.25 + (x - tal) / 0.03 * 0.61);
        let o = H * 0.25 + 2 * r(x * 7, 2);
        o += H * 0.045 * Math.exp(-(((x - 0.36) / 0.06) ** 2)); // Trockental
        o += H * 0.05 * Math.exp(-(((x - 0.47) / 0.025) ** 2)); // Lösungsdoline
        o += H * 0.03 * Math.exp(-(((x - 0.71) / 0.03) ** 2)); // Senke über der Höhle: hier versickert das Wasser
        return o;
      }, (i, j) => {
        const x = i / W;
        if (j > H * 0.8) return TON;
        if (x < 0.2 + 0.03 * Math.sin(j * 0.05) && j < H * 0.45) return SCHIEFER;
        return KALK;
      });
      for (let k = 0; k < N; k++) if (b.stoff[k] === KALK) b.haerte[k] = 0.8 + 0.4 * (Math.sin(Math.floor(k / W) * 0.35) > 0 ? 1 : 0);
      // Klüfte und Schichtfugen
      for (let i = 18 + Math.floor(z() * 8); i < W; i += 16 + Math.floor(z() * 10)) for (let j = 0; j < H * 0.8; j++) kluft(b, i + Math.round(r(j / 30, i) * 2), j, 0.5);
      for (let j = Y(0.32); j < H * 0.8; j += 12) for (let i = X(0.2); i < W; i++) kluft(b, i, j, 0.3);
      // Ponor: Schacht vom Bachbett hinunter zum Höhlenbach
      const px = X(0.245);
      gang(b, [[px, Y(0.24)], [px + 2, Y(0.5)], [px + 1, Y(0.73)]], 3, 5);
      // Höhlenbach bis zur Karstquelle am Talhang, knapp über dem Ton
      gang(b, [[px, Y(0.735)], [X(0.38), Y(0.745)], [X(0.52), Y(0.755)], [X(0.66), Y(0.77)], [X(tal + 0.012), Y(0.79)]], 9, 7);
      // Tropfsteinhöhle über dem Gang, mit Verbindung nach unten
      const hx = X(0.57), hy = Y(0.53);
      ellipse(b, hx, hy, W * 0.06, H * 0.07, LUFT, 0.2, seed + 3);
      gang(b, [[hx + 6, hy + Math.round(H * 0.065)], [hx + 8, Y(0.74)]], 3, 9);
      for (let s = 0; s < 9; s++) {
        const x = hx - Math.round(W * 0.05) + Math.round((s / 8) * W * 0.1) + Math.round(z() * 3);
        let jo = hy; while (jo > 0 && b.stoff[(jo - 1) * W + x] === LUFT) jo--;
        let ju = hy; while (ju < H - 1 && b.stoff[(ju + 1) * W + x] === LUFT) ju++;
        if (s === 4) for (let j = jo; j <= ju; j++) b.stoff[j * W + x] = SINTER; // Säule
        else { tropfstein(b, x, jo, 3 + Math.floor(z() * 8), 1); tropfstein(b, x, ju, 2 + Math.floor(z() * 6), -1); }
      }
      // Höhle dicht unter der Oberfläche, deren Decke bald bricht
      const ex = X(0.71), ey = Y(0.35);
      ellipse(b, ex, ey, 9, 6, LUFT, 0.15, seed + 4);
      for (let j = ober[ex]; j < ey; j++) for (let i = ex - 12; i <= ex + 12; i++) kluft(b, i, j, 0.3);
      bodendecke(2, m => m === KALK || m === SCHIEFER);
      b.quellen.push({ x: 2, y: ober[2] - 2, staerke: 1 });
      marke("Bach", X(0.06), ober[X(0.06)] - 8);
      marke("Ponor (Schluckloch)", px, ober[px] - 10);
      marke("Trockental", X(0.36), ober[X(0.36)] - 8);
      marke("Lösungsdoline", X(0.47), ober[X(0.47)] - 8);
      marke("Doline über Höhle → Einsturz?", ex, ober[ex] - 8);
      marke("Tropfsteinhöhle (stabil)", hx, hy - H * 0.095);
      marke("Höhlenbach", X(0.43), Y(0.69));
      marke("Karstquelle", X(tal + 0.01), Y(0.75));
      marke("Ton (undurchlässig)", X(0.5), Y(0.9));
      marke("Schiefer (undurchlässig)", X(0.08), Y(0.35));
      break;
    }
    case "gips": {
      fuellen(x => (x < 0.18 ? H * (0.12 + x * 0.75) : H * 0.27 + 2 * r(x * 6, 3) + H * 0.04 * Math.exp(-(((x - 0.62) / 0.05) ** 2))),
        (i, j) => (j > H * 0.78 ? TON : i / W < 0.16 && j < H * 0.5 ? TON : GIPS));
      for (let i = 20; i < W; i += 18 + Math.floor(z() * 10)) for (let j = 0; j < H * 0.78; j++) kluft(b, i, j, 0.45);
      // Bachschwinde, Schlotten, Gipshöhle mit flacher Laugdecke, Erdfall-Hohlraum
      const sx = X(0.2);
      gang(b, [[sx, Y(0.26)], [sx + 3, Y(0.62)]], 3, 4);
      for (const x of [0.32, 0.41, 0.83]) gang(b, [[X(x), Y(0.38)], [X(x) + 1, Y(0.62)]], 2, 6 + x * 10);
      for (let j = Y(0.56); j <= Y(0.64); j++) for (let i = sx; i < X(0.78); i++) { b.stoff[j * W + i] = LUFT; b.riss[j * W + i] = 0; }
      const ex = X(0.62), ey = Y(0.44);
      ellipse(b, ex, ey, 7, 6, LUFT, 0.15, seed + 6);
      for (let j = ober[ex]; j < ey; j++) for (let i = ex - 18; i <= ex + 18; i++) kluft(b, i, j, 0.36);
      bodendecke(2, m => m === GIPS || m === TON);
      b.quellen.push({ x: 2, y: ober[2] - 2, staerke: 0.8 });
      marke("Bachschwinde", sx, ober[sx] - 8);
      marke("Schlotte", X(0.41), Y(0.47));
      marke("Gipshöhle (flache Laugdecke)", X(0.5), Y(0.53));
      marke("Hohlraum → Erdfall", ex, ober[ex] - 8);
      marke("Ton (undurchlässig)", X(0.5), Y(0.9));
      break;
    }
    case "granit": {
      fuellen(x => H * 0.1 + H * 0.66 * ((x - 0.5) / 0.5) ** 2 + 3 * r(x * 8, 4), () => GRANIT);
      // Klüfte: senkrecht leicht gekrümmt, dazu Bankung parallel zur Oberfläche (oben dicht, unten weit)
      for (let i = 10 + Math.floor(z() * 8); i < W; i += 20 + Math.floor(z() * 10)) for (let j = 0; j < H; j++) kluft(b, i + Math.round(r(j / 25, i) * 3), j, 0.45);
      const baenke = [7, 17, 29, 43, 59, 78, 100, 126];
      for (let i = 0; i < W; i++) for (const d of baenke) kluft(b, i, ober[i] + d + Math.round(r(i / 30, d) * 1.5), 0.45);
      marke("Granitkuppe (wie der Brocken)", X(0.5), ober[X(0.5)] - 10);
      marke("Bankung (parallel zur Oberfläche)", X(0.2), ober[X(0.2)] + 14);
      marke("Klüfte", X(0.72), ober[X(0.72)] + 30);
      break;
    }
    case "sandstein": {
      fuellen(x => {
        if (x < 0.5) return H * 0.2 + 2 * r(x * 6, 1) + H * 0.36 * Math.exp(-(((x - 0.27) / 0.012) ** 2)); // Schlucht
        if (x < 0.53) return H * (0.2 + (x - 0.5) / 0.03 * 0.52);
        if (Math.abs(x - 0.68) < 0.025) return H * 0.28; // Felsnadel
        return H * 0.72 + 3 * r(x * 6, 2);
      }, (i, j, tief) => (tief < 3 && j > H * 0.7 ? SAND : SANDSTEIN));
      for (let k = 0; k < N; k++) {
        const j = Math.floor(k / W);
        // harte und weiche Bänke; eine besonders weiche über dem Talboden
        b.haerte[k] = j > H * 0.62 && j < H * 0.68 ? 0.45 : Math.sin(j * 0.32) > 0.2 ? 1.5 : 0.7;
      }
      for (let i = 14 + Math.floor(z() * 8); i < W * 0.5; i += 22 + Math.floor(z() * 10)) for (let j = 0; j < H; j++) kluft(b, i, j, 0.42);
      for (let j = 0; j < H; j++) kluft(b, X(0.27), j, 0.5);
      bodendecke(2, m => m === SANDSTEIN, 0.6);
      marke("Tafelberg (Ebenheit)", X(0.12), ober[X(0.12)] - 8);
      marke("Schlucht entlang einer Kluft", X(0.27), Y(0.15));
      marke("Felsnadel", X(0.68), Y(0.24));
      marke("weiche Bank → Überhang", X(0.62), Y(0.66));
      marke("Felswand", X(0.515), Y(0.42));
      break;
    }
    case "schiefer": {
      fuellen(x => H * 0.1 + H * 0.62 * Math.min(1, Math.abs(x - 0.45) / 0.4) ** 1.3 + 3 * r(x * 10, 3), () => SCHIEFER);
      for (let i0 = -H; i0 < W; i0 += 4) for (let j = 0; j < H; j++) kluft(b, i0 + Math.round(j * 0.55), j, 0.38);
      // Schutthalden am Fuß
      for (const [cx, w] of [[0.1, 0.12], [0.85, 0.14]]) for (let i = X(cx - w); i < X(cx + w); i++) {
        if (i < 0 || i >= W) continue;
        const h = Math.round(H * 0.12 * (1 - Math.abs(i / W - cx) / w));
        for (let j = ober[i] - h; j < ober[i]; j++) if (j > 0) { b.stoff[j * W + i] = SCHUTT; b.eltern[j * W + i] = SCHIEFER; }
      }
      marke("Grat", X(0.45), Y(0.06));
      marke("Schutthalde (Plattenschutt)", X(0.85), Y(0.6));
      marke("Schieferung", X(0.4), Y(0.5));
      break;
    }
    case "basalt": {
      fuellen(x => (x < 0.62 ? H * 0.2 + 2 * r(x * 5, 4) : H * (0.48 + (x - 0.62) * 0.7) + 2 * r(x * 5, 5)),
        (i, j) => (j < H * 0.46 && i / W < 0.63 ? BASALT : SANDSTEIN));
      for (let i = 0; i < W * 0.63; i += 5 + Math.floor(z() * 2)) for (let j = 0; j < H * 0.46; j++) kluft(b, i, j, 0.42);
      for (let i = X(0.63); i < W; i++) {
        const h = Math.round(5 + 4 * z());
        for (let j = ober[i] - h; j < ober[i]; j++) if (j > 0 && z() < 0.85) { b.stoff[j * W + i] = SCHUTT; b.eltern[j * W + i] = BASALT; }
      }
      bodendecke(2, m => m === BASALT, 0.5);
      marke("Basaltdecke mit Säulen", X(0.3), Y(0.14));
      marke("Blockhalde (Blockmeer)", X(0.78), Y(0.52));
      marke("Buntsandstein darunter", X(0.3), Y(0.75));
      break;
    }
    case "loess": {
      fuellen(x => {
        let o = H * 0.28 + 2 * r(x * 4, 5);
        o += H * 0.2 * Math.exp(-(((x - 0.38) / 0.018) ** 2)); // Hohlweg
        if (x > 0.62) o = H * 0.28 + Math.floor((x - 0.62) / 0.06) * H * 0.07; // Terrassen
        o += H * 0.08 * Math.exp(-(((x - 0.12) / 0.012) ** 2)); // Runse
        return o;
      }, (i, j) => (j > H * 0.7 ? KALK : LOESS));
      bodendecke(2, m => m === LOESS);
      marke("Hohlweg", X(0.38), Y(0.22));
      marke("Lössterrassen", X(0.8), Y(0.3));
      marke("Erosionsrinne (Runse)", X(0.12), Y(0.24));
      marke("Kalk darunter", X(0.5), Y(0.82));
      break;
    }
    case "ton": {
      fuellen(x => (x < 0.25 ? H * 0.16 + 2 * r(x * 5, 6) : x < 0.85 ? H * (0.16 + (x - 0.25) * 1.0) + 3 * r(x * 5, 7) : H * 0.76),
        (i, j) => (j < H * 0.32 && i / W < 0.5 ? SANDSTEIN : TON));
      // Rutschscholle mit Abrisskante
      for (let i = X(0.46); i < X(0.56); i++) for (let j = ober[i] - 7; j < ober[i]; j++) if (j > 0) b.stoff[j * W + i] = TON;
      bodendecke(2, m => m === TON || m === SANDSTEIN);
      marke("Sandstein (durchlässig)", X(0.12), Y(0.2));
      marke("Quellhorizont", X(0.38), Y(0.28));
      marke("Rutschscholle", X(0.51), Y(0.38));
      marke("Ton (quillt, staut Wasser)", X(0.3), Y(0.7));
      break;
    }
    case "sand": {
      // Wanderdünen: flacher Luvhang (Westen), steiler Leehang (Osten); dazu eine alte, bewachsene Düne
      const duene = (x: number, c: number, w: number, h: number) => {
        const d = x - c;
        if (d < -w || d > w * 0.45) return 0;
        return d < 0 ? h * (1 + d / w) : h * (1 - d / (w * 0.45));
      };
      fuellen(x => H * 0.62 - H * (Math.max(duene(x, 0.3, 0.18, 0.28), duene(x, 0.62, 0.14, 0.2), duene(x, 0.88, 0.12, 0.24))) + 1.5 * r(x * 8, 8) + H * 0.05 * Math.exp(-(((x - 0.45) / 0.03) ** 2)),
        (i, j) => (j > H * 0.8 ? TON : SAND));
      for (let i = X(0.76); i < W; i++) for (let j = ober[i]; j < ober[i] + 2; j++) b.stoff[j * W + i] = BODEN;
      marke("Wanderdüne: Luv flach, Lee steil", X(0.3), Y(0.3));
      marke("Deflationsmulde", X(0.45), Y(0.6));
      marke("Graudüne (bewachsen)", X(0.88), Y(0.32));
      break;
    }
  }

  const { stoff, riss, haerte } = b;
  const nass = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    if (stoff[k] === LUFT) { riss[k] = 0; continue; }
    if (!b.eltern[k]) b.eltern[k] = stoff[k];
    nass[k] = STOFFE[stoff[k]].durch > 0.3 ? 0.2 : 0.05;
  }
  // Granit beginnt mit etwas Grus in den obersten Klüften
  if (g === "granit") for (let k = 0; k < N; k++) if (stoff[k] === GRANIT && riss[k] > 0.4 && z() < 0.02) stoff[k] = GRUS;
  return {
    W, H, zelle: 0.25, stoff, eltern: b.eltern, riss, nass, haerte, tropfen: [], jahr: 0, winter: false,
    wirkung: leereWirkung(), wirkungMittel: leereWirkung(), start: Uint8Array.from(stoff), zufall: z,
    marken: b.marken, quellen: b.quellen, ereignisse: [], stand: 0, gestein: g, fluss: new Float32Array(N), geloest: 0,
  };
}
