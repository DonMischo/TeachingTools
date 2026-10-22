/**
 * Schaltzeichen nach DIN EN 60617 auf ein Canvas.
 *
 * Jedes Bauteil wird in seinem eigenen Koordinatensystem gezeichnet: x läuft
 * von `a` (0) nach `b` (L), y quer dazu; »links von der Laufrichtung« ist −y.
 * Das Symbol sitzt in der Mitte, die Zuleitungen füllen den Rest und tragen die
 * Farbe ihres Potenzials. `r` ist ein Rasterschritt in Pixeln.
 */
import { anschluesse, type Bauteil, type Punkt } from "./modell";
import type { Messung } from "./simulation";
import { LED_FARBEN } from "./teile";

export interface Farben {
  linie: string;
  text: string;
  flaeche: string;
  akzent: string;
  neutral: string;
}

export interface Zeichenzustand {
  messung?: Messung;
  werte: Record<string, number>;
  /** Farbe je Anschluss (Reihenfolge wie `anschluesse`). */
  pinFarben?: string[];
  ausgewaehlt?: boolean;
}

/** Leuchtfarben der LED, passend zu `LED_FARBEN`. */
export const LED_RGB = ["#ff3b30", "#ffcc00", "#34c759", "#3b82f6", "#f5f5f5"];

const PLUS = [34, 197, 94], MINUS = [239, 68, 68];

/** Grün für positiv, Rot für negativ, `neutral` bei null — wie bei Falstad. */
export function potenzialFarbe(v: number, vmax: number, neutral: string): string {
  const t = Math.max(-1, Math.min(1, v / Math.max(1e-9, vmax)));
  const n = hexRgb(neutral);
  const ziel = t >= 0 ? PLUS : MINUS;
  const k = Math.abs(t);
  const c = n.map((x, i) => Math.round(x + (ziel[i] - x) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function hexRgb(farbe: string): number[] {
  const h = farbe.trim();
  if (h.startsWith("#") && (h.length === 7 || h.length === 4)) {
    const v = h.length === 4 ? h.slice(1).split("").map(c => c + c).join("") : h.slice(1);
    return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16));
  }
  const m = h.match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? m.slice(0, 3).map(Number) : [128, 128, 128];
}

/** Wo im Bauteil Strom fließt, fürs Punktebild: Strecken in Rasterkoordinaten. */
export function strompfade(t: Bauteil, m: Messung | undefined, werte: Record<string, number>): { von: Punkt; nach: Punkt; strom: number }[] {
  const i = m?.strom ?? 0;
  const pins = anschluesse(t);
  if (t.art === "umschalter") return [{ von: pins[0], nach: pins[(werte.stellung ?? 0) >= 0.5 ? 2 : 1], strom: i }];
  if (t.art === "trafo") return [{ von: pins[0], nach: pins[1], strom: i }, { von: pins[2], nach: pins[3], strom: m?.strom2 ?? 0 }];
  return [{ von: t.a, nach: t.b, strom: i }];
}

export function zeichneBauteil(
  ctx: CanvasRenderingContext2D, t: Bauteil, px: (p: Punkt) => [number, number], r: number,
  z: Zeichenzustand, f: Farben,
) {
  const [ax, ay] = px(t.a), [bx, by] = px(t.b);
  const L = Math.hypot(bx - ax, by - ay);
  if (L < 1) return;
  const pf = z.pinFarben ?? [];
  const fa = pf[0] ?? f.linie, fb = pf[1] ?? f.linie;
  const m = L / 2;
  const w = z.werte, mess = z.messung;

  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(Math.atan2(by - ay, bx - ax));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (z.ausgewaehlt) {
    ctx.strokeStyle = f.akzent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = r * 1.4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0);
    if (t.art === "umschalter" || t.art === "trafo") { ctx.moveTo(L, 0); ctx.lineTo(L, -2 * r); }
    if (t.art === "trafo") { ctx.moveTo(0, 0); ctx.lineTo(0, -2 * r); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const linie = (x1: number, y1: number, x2: number, y2: number, farbe = f.linie, breite = 2) => {
    ctx.strokeStyle = farbe; ctx.lineWidth = breite;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  /** Zuleitungen bis an den Körper, der von m−h bis m+h reicht. */
  const zuleitung = (h: number) => {
    linie(0, 0, Math.max(0, m - h), 0, fa, 3);
    linie(Math.min(L, m + h), 0, L, 0, fb, 3);
  };
  const kreis = (radius: number, fuellung?: string) => {
    ctx.beginPath(); ctx.arc(m, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = fuellung ?? f.flaeche; ctx.fill();
    ctx.strokeStyle = f.linie; ctx.lineWidth = 2; ctx.stroke();
  };
  const schrift = (text: string, x: number, y: number, groesse: number) => {
    ctx.save();
    ctx.translate(x, y);
    // Schrift bleibt aufrecht, egal wie das Bauteil liegt.
    ctx.rotate(-Math.atan2(by - ay, bx - ax));
    ctx.fillStyle = f.text;
    ctx.font = `bold ${groesse}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  const kontakt = (x: number, y: number) => {
    ctx.beginPath(); ctx.arc(x, y, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = f.linie; ctx.fill();
  };

  switch (t.art) {
    case "widerstand": {
      const h = Math.min(r, m * 0.8);
      zuleitung(h);
      ctx.fillStyle = f.flaeche; ctx.fillRect(m - h, -0.35 * r, 2 * h, 0.7 * r);
      ctx.strokeStyle = f.linie; ctx.lineWidth = 2; ctx.strokeRect(m - h, -0.35 * r, 2 * h, 0.7 * r);
      break;
    }
    case "lampe": {
      const rad = 0.6 * r;
      zuleitung(rad);
      const hell = mess?.helligkeit ?? 0;
      if (hell > 0.01) {
        const g = ctx.createRadialGradient(m, 0, 0, m, 0, rad * 3);
        g.addColorStop(0, `rgba(255,220,90,${Math.min(0.9, hell * 0.8)})`);
        g.addColorStop(1, "rgba(255,220,90,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m, 0, rad * 3, 0, Math.PI * 2); ctx.fill();
      }
      kreis(rad, hell > 0.01 ? `rgba(255,230,120,${Math.min(1, 0.25 + hell)})` : undefined);
      const k = rad * Math.SQRT1_2;
      linie(m - k, -k, m + k, k); linie(m - k, k, m + k, -k);
      if (mess?.kaputt) linie(m - rad * 1.3, -rad * 1.3, m + rad * 1.3, rad * 1.3, "#ef4444", 3);
      break;
    }
    case "motor":
    case "amperemeter":
    case "voltmeter":
    case "wechselquelle": {
      const rad = 0.75 * r;
      zuleitung(rad);
      kreis(rad);
      if (t.art === "wechselquelle") {
        ctx.strokeStyle = f.linie; ctx.lineWidth = 2; ctx.beginPath();
        for (let k = 0; k <= 20; k++) {
          const x = m - rad * 0.6 + (k / 20) * rad * 1.2;
          const y = -Math.sin((k / 20) * Math.PI * 2) * rad * 0.35;
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      } else {
        schrift(t.art === "motor" ? "M" : t.art === "amperemeter" ? "A" : "V", m, 0, r * 0.75);
      }
      if (t.art === "motor") {
        // Langsamer gezeigt als gerechnet: echte 60 Umdrehungen je Sekunde sähen still aus.
        const phi = (mess?.winkel ?? 0) * 0.05;
        ctx.save(); ctx.translate(m, 0); ctx.rotate(phi);
        ctx.fillStyle = f.akzent; ctx.beginPath(); ctx.arc(rad * 0.75, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "batterie": {
      const s = 0.18 * r;
      zuleitung(s);
      linie(m - s, -0.4 * r, m - s, 0.4 * r, f.linie, 5);
      linie(m + s, -0.85 * r, m + s, 0.85 * r, f.linie, 2);
      schrift("+", m + s + 0.45 * r, -0.75 * r, r * 0.6);
      break;
    }
    case "kondensator": {
      const s = 0.18 * r;
      zuleitung(s);
      linie(m - s, -0.75 * r, m - s, 0.75 * r, f.linie, 3);
      linie(m + s, -0.75 * r, m + s, 0.75 * r, f.linie, 3);
      break;
    }
    case "schalter": {
      const h = Math.min(r, m * 0.8);
      zuleitung(h);
      if ((w.geschlossen ?? 0) >= 0.5) linie(m - h, 0, m + h, 0, f.linie, 3);
      else linie(m - h, 0, m + h * 0.85, -0.9 * r, f.linie, 3);
      kontakt(m - h, 0); kontakt(m + h, 0);
      break;
    }
    case "umschalter": {
      const fc = pf[2] ?? f.linie;
      const dreh = Math.max(r * 0.8, L - 2.2 * r);
      const k = L - 0.8 * r;
      linie(0, 0, dreh, 0, fa, 3);
      linie(k, 0, L, 0, fb, 3);
      linie(k, -2 * r, L, -2 * r, fc, 3);
      const oben = (w.stellung ?? 0) >= 0.5;
      linie(dreh, 0, k, oben ? -2 * r : 0, f.linie, 3);
      kontakt(dreh, 0); kontakt(k, 0); kontakt(k, -2 * r);
      break;
    }
    case "sicherung": {
      const h = Math.min(0.8 * r, m * 0.8);
      zuleitung(h);
      ctx.fillStyle = f.flaeche; ctx.fillRect(m - h, -0.25 * r, 2 * h, 0.5 * r);
      ctx.strokeStyle = f.linie; ctx.lineWidth = 2; ctx.strokeRect(m - h, -0.25 * r, 2 * h, 0.5 * r);
      if (mess?.kaputt) {
        linie(m - h, 0, m - 0.2 * r, 0, "#ef4444", 2);
        linie(m + 0.2 * r, 0, m + h, 0, "#ef4444", 2);
      } else linie(m - h, 0, m + h, 0);
      break;
    }
    case "diode":
    case "led": {
      const s = 0.5 * r;
      zuleitung(s);
      const led = t.art === "led";
      const hell = led && !mess?.kaputt ? (mess?.helligkeit ?? 0) : 0;
      const farbe = LED_RGB[Math.round(w.farbe ?? 0)] ?? LED_RGB[0];
      if (hell > 0.02) {
        const g = ctx.createRadialGradient(m, 0, 0, m, 0, r * 1.6);
        ctx.globalAlpha = Math.min(0.9, hell * 0.8);
        g.addColorStop(0, farbe); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m, 0, r * 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath(); ctx.moveTo(m - s, -s); ctx.lineTo(m + s, 0); ctx.lineTo(m - s, s); ctx.closePath();
      ctx.fillStyle = led ? (hell > 0.02 ? farbe : f.flaeche) : f.linie; ctx.fill();
      ctx.strokeStyle = f.linie; ctx.lineWidth = 2; ctx.stroke();
      linie(m + s, -s, m + s, s, f.linie, 3);
      if (led) {
        for (const dx of [-0.1, 0.35]) {
          const x0 = m + dx * r, y0 = -0.65 * r, x1 = x0 + 0.4 * r, y1 = y0 - 0.4 * r;
          linie(x0, y0, x1, y1, led && hell > 0.02 ? farbe : f.linie, 1.5);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 0.18 * r, y1 + 0.02 * r); ctx.lineTo(x1 - 0.02 * r, y1 + 0.18 * r); ctx.closePath();
          ctx.fillStyle = led && hell > 0.02 ? farbe : f.linie; ctx.fill();
        }
        if (mess?.kaputt) linie(m - s * 1.4, -s * 1.4, m + s * 1.4, s * 1.4, "#ef4444", 3);
      }
      break;
    }
    case "spule": {
      const h = Math.min(r, m * 0.8);
      zuleitung(h);
      ctx.strokeStyle = f.linie; ctx.lineWidth = 2.5; ctx.beginPath();
      const boegen = 4, bw = (2 * h) / boegen;
      for (let k = 0; k < boegen; k++) ctx.arc(m - h + bw * (k + 0.5), 0, bw / 2, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case "trafo": {
      const fc = pf[2] ?? f.linie, fd = pf[3] ?? f.linie;
      const spule = (x: number, richtung: 1 | -1) => {
        ctx.strokeStyle = f.linie; ctx.lineWidth = 2.5; ctx.beginPath();
        const boegen = 4, oben = -1.7 * r, unten = -0.3 * r, bh = (unten - oben) / boegen;
        for (let k = 0; k < boegen; k++) {
          const yc = unten - bh * (k + 0.5);
          ctx.arc(x, yc, bh / 2, Math.PI / 2, -Math.PI / 2, richtung === -1);
        }
        ctx.stroke();
      };
      linie(0, 0, 0, -0.3 * r, fa, 3); linie(0, -1.7 * r, 0, -2 * r, fb, 3);
      linie(L, 0, L, -0.3 * r, fc, 3); linie(L, -1.7 * r, L, -2 * r, fd, 3);
      spule(0, 1);
      spule(L, -1);
      linie(m - 0.12 * r, -1.9 * r, m - 0.12 * r, -0.1 * r, f.linie, 2);
      linie(m + 0.12 * r, -1.9 * r, m + 0.12 * r, -0.1 * r, f.linie, 2);
      schrift(String(Math.round(w.windungen1 ?? 0)), 0.9 * r, -2.4 * r, r * 0.5);
      schrift(String(Math.round(w.windungen2 ?? 0)), L - 0.9 * r, -2.4 * r, r * 0.5);
      break;
    }
  }
  ctx.restore();
}

/** Beschriftung neben einem Bauteil: aufrecht, auf der rechten Seite der Laufrichtung. */
export function zeichneBeschriftung(
  ctx: CanvasRenderingContext2D, t: Bauteil, px: (p: Punkt) => [number, number], r: number, text: string, f: Farben,
) {
  if (!text) return;
  const [ax, ay] = px(t.a), [bx, by] = px(t.b);
  const L = Math.hypot(bx - ax, by - ay) || 1;
  // rechts von der Laufrichtung, Trafo und Umschalter haben links ihre zweite Seite
  const nx = -(by - ay) / L, ny = (bx - ax) / L;
  const abstand = t.art === "trafo" ? 0.7 * r : 1.25 * r;
  const x = (ax + bx) / 2 + nx * abstand, y = (ay + by) / 2 + ny * abstand;
  ctx.font = `600 ${Math.round(r * 0.55)}px system-ui, sans-serif`;
  // Senkrechte Bauteile: Text beginnt neben dem Symbol statt mittig darüber
  const seitlich = Math.abs(nx) > 0.7 ? Math.sign(nx) : 0;
  ctx.textAlign = seitlich > 0 ? "left" : seitlich < 0 ? "right" : "center";
  ctx.textBaseline = "middle";
  const breite = ctx.measureText(text).width;
  const links = seitlich > 0 ? x : seitlich < 0 ? x - breite : x - breite / 2;
  ctx.fillStyle = f.flaeche; ctx.globalAlpha = 0.85;
  ctx.fillRect(links - 3, y - r * 0.35, breite + 6, r * 0.7);
  ctx.globalAlpha = 1;
  ctx.fillStyle = f.text;
  ctx.fillText(text, x, y);
}

/** Punkte auf einer Strecke, um `phase` Pixel verschoben. */
export function zeichnePunkte(
  ctx: CanvasRenderingContext2D, von: [number, number], nach: [number, number], phase: number, abstand: number, farbe: string, radius: number,
) {
  const dx = nach[0] - von[0], dy = nach[1] - von[1];
  const L = Math.hypot(dx, dy);
  if (L < 1) return;
  const start = ((phase % abstand) + abstand) % abstand;
  ctx.fillStyle = farbe;
  ctx.beginPath();
  for (let s = start; s < L; s += abstand) {
    const x = von[0] + (dx * s) / L, y = von[1] + (dy * s) / L;
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** Text für die Beschriftung aus den Werten (Messgeräte bekommen ihren Messwert von außen). */
export function wertText(t: Bauteil, w: Record<string, number>, fmt: (v: number, e: string) => string): string {
  switch (t.art) {
    case "batterie": return fmt(w.spannung, "V");
    case "wechselquelle": return `${fmt(w.spannung, "V")} ~ ${fmt(w.frequenz, "Hz")}`;
    case "widerstand": return fmt(w.widerstand, "Ω");
    case "lampe": return `${fmt(w.nennspannung, "V")} / ${fmt(w.nennleistung, "W")}`;
    case "sicherung": return fmt(w.nennstrom, "A");
    case "kondensator": return fmt(w.kapazitaet, "F");
    case "spule": return fmt(w.induktivitaet, "H");
    case "led": return `LED ${LED_FARBEN[Math.round(w.farbe ?? 0)]?.name ?? ""}`;
    default: return "";
  }
}
