/**
 * Die realistische Ansicht: dieselbe Schaltung, gezeichnet wie der
 * Schülerexperimentierkasten — Batterie, Lämpchen in der Fassung, Widerstand
 * mit Farbringen, Motor mit Propeller, Glassicherung, Messgeräte mit Anzeige.
 *
 * Gleiches Koordinatensystem wie `zeichnen.ts`: x von `a` (0) nach `b` (L),
 * »links« ist −y, `r` ist ein Rasterschritt in Pixeln. Was aus der Ebene
 * herausragt (Glaskolben, Propeller, LED-Kuppel), sitzt auf der linken Seite.
 */
import type { Bauteil, Punkt } from "./modell";
import { farbringe } from "./farbringe";
import { LED_RGB, type Farben, type Zeichenzustand } from "./zeichnen";

const METALL = "#b8bcc4", METALL_DUNKEL = "#6b7280", EISEN = "#5b6170";

export function zeichneRealistisch(
  ctx: CanvasRenderingContext2D, t: Bauteil, px: (p: Punkt) => [number, number], r: number,
  z: Zeichenzustand, f: Farben,
) {
  const [ax, ay] = px(t.a), [bx, by] = px(t.b);
  const L = Math.hypot(bx - ax, by - ay);
  if (L < 1) return;
  const winkel = Math.atan2(by - ay, bx - ax);
  const pf = z.pinFarben ?? [];
  const fa = pf[0] ?? METALL_DUNKEL, fb = pf[1] ?? METALL_DUNKEL;
  const m = L / 2;
  const w = z.werte, mess = z.messung;

  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(winkel);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (z.ausgewaehlt) {
    ctx.strokeStyle = f.akzent; ctx.globalAlpha = 0.35; ctx.lineWidth = r * 1.8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0);
    if (t.art === "umschalter" || t.art === "trafo") { ctx.moveTo(L, 0); ctx.lineTo(L, -2 * r); }
    if (t.art === "trafo") { ctx.moveTo(0, 0); ctx.lineTo(0, -2 * r); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  const linie = (x1: number, y1: number, x2: number, y2: number, farbe: string, breite: number) => {
    ctx.strokeStyle = farbe; ctx.lineWidth = breite;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  /** Anschlussdrähte bis an den Körper (m−h … m+h). */
  const beine = (h: number, breite = 3) => {
    linie(0, 0, Math.max(0, m - h), 0, fa, breite);
    linie(Math.min(L, m + h), 0, L, 0, fb, breite);
  };
  const kasten = (x: number, y: number, b: number, h: number, rad: number, fuellung: string | CanvasGradient, rand = "rgba(0,0,0,0.55)") => {
    ctx.beginPath(); ctx.roundRect(x, y, b, h, rad);
    ctx.fillStyle = fuellung; ctx.fill();
    ctx.strokeStyle = rand; ctx.lineWidth = 1.5; ctx.stroke();
  };
  /** Senkrechter Glanzverlauf über eine Höhe — macht aus Rechtecken Zylinder. */
  const zylinder = (y: number, h: number, hell: string, dunkel: string) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, dunkel); g.addColorStop(0.3, hell); g.addColorStop(1, dunkel);
    return g;
  };
  /** Wie weit Text zurückgedreht werden muss, um aufrecht zu stehen (in aufrechten Gehäusen: gar nicht). */
  let textDreh = winkel;
  const schrift = (text: string, x: number, y: number, groesse: number, farbe: string, schnitt = "bold") => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-textDreh);
    ctx.fillStyle = farbe; ctx.font = `${schnitt} ${groesse}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0); ctx.restore();
  };
  const glow = (x: number, y: number, rad: number, farbe: string, staerke: number) => {
    if (staerke < 0.02) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    ctx.globalAlpha = Math.min(0.95, staerke);
    g.addColorStop(0, farbe); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  };
  /** Gehäuse von Netzgerät und Messgerät stehen immer aufrecht; die Leitung läuft darunter durch. */
  const aufrecht = () => {
    linie(0, 0, m, 0, fa, 3); linie(m, 0, L, 0, fb, 3);
    ctx.translate(m, 0); ctx.rotate(-winkel); ctx.translate(-m, 0);
    textDreh = 0;
  };
  const buchse = (x: number, y: number, farbe: string) => {
    ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = farbe; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.08, 0, Math.PI * 2); ctx.fillStyle = "#111"; ctx.fill();
  };

  switch (t.art) {
    case "batterie": {
      const h = Math.min(1.4 * r, m * 0.9), d = 0.9 * r;
      beine(h + 0.15 * r);
      // Pluskappe bei b
      kasten(m + h, -0.22 * r, 0.18 * r, 0.44 * r, 2, METALL);
      kasten(m - h, -d / 2, 2 * h, d, d / 3, zylinder(-d / 2, d, "#3f3f46", "#111114"));
      // Farbband am Pluspol
      ctx.save(); ctx.beginPath(); ctx.roundRect(m - h, -d / 2, 2 * h, d, d / 3); ctx.clip();
      ctx.fillStyle = zylinder(-d / 2, d, "#fbbf24", "#a16207"); ctx.fillRect(m + h * 0.35, -d / 2, h * 0.65, d);
      ctx.restore();
      schrift(`${Number(w.spannung.toPrecision(3)).toLocaleString("de-DE")} V`, m - h * 0.3, 0, r * 0.45, "#f5f5f5");
      schrift("+", m + h * 0.68, 0, r * 0.55, "#111");
      schrift("−", m - h * 0.82, 0, r * 0.55, "#f5f5f5");
      break;
    }
    case "wechselquelle": {
      const b = 2.6 * r, h = 1.7 * r;
      aufrecht();
      kasten(m - b / 2, -h / 2, b, h, 5, zylinder(-h / 2, h, "#e5e7eb", "#9ca3af"));
      kasten(m - b * 0.32, -h * 0.36, b * 0.64, h * 0.38, 3, "#1f3b2c", "#0b1a12");
      schrift(`${Number(w.spannung.toPrecision(3)).toLocaleString("de-DE")} V ~`, m, -h * 0.17, r * 0.4, "#86efac", "600");
      buchse(m - b / 2 + 0.4 * r, h * 0.22, "#111"); buchse(m + b / 2 - 0.4 * r, h * 0.22, "#dc2626");
      schrift(`${Number(w.frequenz.toPrecision(3)).toLocaleString("de-DE")} Hz`, m, h * 0.24, r * 0.32, "#374151", "600");
      break;
    }
    case "widerstand": {
      const h = Math.min(1.1 * r, m * 0.8), d = 0.55 * r;
      beine(h, 2.5);
      kasten(m - h, -d / 2, 2 * h, d, d / 2, zylinder(-d / 2, d, "#f0dcb4", "#b89b6a"));
      const ringe = farbringe(w.widerstand);
      const lage = [0.28, 0.43, 0.58, 0.82];
      ctx.save(); ctx.beginPath(); ctx.roundRect(m - h, -d / 2, 2 * h, d, d / 2); ctx.clip();
      ringe.forEach((ring, k) => {
        ctx.fillStyle = ring.farbe;
        ctx.fillRect(m - h + 2 * h * lage[k] - r * 0.07, -d / 2, r * 0.14, d);
      });
      ctx.restore();
      break;
    }
    case "lampe": {
      const h = 0.55 * r;
      beine(h);
      const hell = mess?.kaputt ? 0 : Math.min(1.5, mess?.helligkeit ?? 0);
      // Fassung auf dem Leitungsstück, Glaskolben links davon
      const kolbenY = -1.15 * r, kr = 0.72 * r;
      glow(m, kolbenY, kr * 3.2, "rgba(255,214,102,1)", hell * 0.75);
      kasten(m - h, -0.35 * r, 2 * h, 0.7 * r, 3, zylinder(-0.35 * r, 0.7 * r, METALL, METALL_DUNKEL));
      for (let k = 1; k < 4; k++) linie(m - h + (2 * h * k) / 4, -0.35 * r, m - h + (2 * h * k) / 4, 0.35 * r, "rgba(0,0,0,0.25)", 1);
      ctx.beginPath(); ctx.arc(m, kolbenY, kr, 0, Math.PI * 2);
      ctx.fillStyle = hell > 0.02 ? `rgba(255,236,150,${0.25 + 0.6 * Math.min(1, hell)})` : mess?.kaputt ? "rgba(80,80,80,0.55)" : "rgba(220,235,255,0.22)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.65)"; ctx.lineWidth = 1.5; ctx.stroke();
      // Glühwendel zwischen den Haltedrähten
      const fw = mess?.kaputt ? "#555" : hell > 0.02 ? "#fff7cc" : "#7c6f5a";
      linie(m - 0.3 * r, -0.35 * r, m - 0.3 * r, kolbenY + 0.05 * r, METALL_DUNKEL, 1.2);
      linie(m + 0.3 * r, -0.35 * r, m + 0.3 * r, kolbenY + 0.05 * r, METALL_DUNKEL, 1.2);
      ctx.strokeStyle = fw; ctx.lineWidth = hell > 0.02 ? 2 : 1.3; ctx.beginPath();
      const zacken = 7;
      for (let k = 0; k <= zacken; k++) {
        if (mess?.kaputt && k === 4) { ctx.stroke(); ctx.beginPath(); continue; }
        const x = m - 0.3 * r + (0.6 * r * k) / zacken, y = kolbenY + 0.05 * r + (k % 2 ? -0.12 * r : 0.05 * r);
        if (k === 0 || (mess?.kaputt && k === 5)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Glanzlicht
      ctx.beginPath(); ctx.arc(m - kr * 0.35, kolbenY - kr * 0.35, kr * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fill();
      break;
    }
    case "motor": {
      const h = Math.min(1.1 * r, m * 0.8), d = 1.1 * r;
      beine(h);
      kasten(m - h, -d / 2, 2 * h, d, 5, zylinder(-d / 2, d, "#d1d5db", "#6b7280"));
      linie(m - h * 0.5, -d / 2, m - h * 0.5, d / 2, "rgba(0,0,0,0.3)", 1);
      linie(m + h * 0.5, -d / 2, m + h * 0.5, d / 2, "rgba(0,0,0,0.3)", 1);
      schrift("M", m, 0, r * 0.55, "#111");
      // Welle und Propeller, von vorn gesehen
      linie(m, -d / 2, m, -d / 2 - 0.45 * r, METALL_DUNKEL, 3);
      const cx = m, cy = -d / 2 - 1.15 * r, phi = (mess?.winkel ?? 0) * 0.05;
      const omega = Math.abs(mess?.drehzahl ?? 0);
      if (omega > 30) {
        // schnell: verwischte Scheibe
        ctx.beginPath(); ctx.arc(cx, cy, 0.95 * r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239,68,68,${Math.min(0.35, omega / 1200)})`; ctx.fill();
      }
      for (let k = 0; k < 3; k++) {
        const a = phi + (k * 2 * Math.PI) / 3;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0.5 * r, 0, 0.48 * r, 0.17 * r, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444"; ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(cx, cy, 0.15 * r, 0, Math.PI * 2); ctx.fillStyle = METALL; ctx.fill();
      break;
    }
    case "schalter":
    case "umschalter": {
      const um = t.art === "umschalter";
      const dreh = um ? Math.max(r * 0.8, L - 2.2 * r) : m - Math.min(r, m * 0.8);
      const k = um ? L - 0.8 * r : m + Math.min(r, m * 0.8);
      linie(0, 0, dreh, 0, fa, 3);
      linie(k, 0, L, 0, fb, 3);
      if (um) linie(k, -2 * r, L, -2 * r, pf[2] ?? METALL_DUNKEL, 3);
      // Grundplatte
      const oben = um ? -2.45 * r : -0.45 * r;
      kasten(dreh - 0.45 * r, oben, k - dreh + 0.9 * r, 0.45 * r - oben + 0.45 * r, 4, "#2f3a4a");
      // Kontaktklemmen
      const klemme = (x: number, y: number) => kasten(x - 0.16 * r, y - 0.28 * r, 0.32 * r, 0.56 * r, 2, METALL);
      klemme(k, 0); if (um) klemme(k, -2 * r);
      // Hebel mit Griff
      const zu = um ? ((w.stellung ?? 0) >= 0.5 ? -2 * r : 0) : (w.geschlossen ?? 0) >= 0.5 ? 0 : null;
      const ex = zu === null ? dreh + (k - dreh) * 0.82 : k, ey = zu === null ? -(k - dreh) * 0.57 : zu;
      linie(dreh, 0, ex, ey, METALL, 4);
      ctx.beginPath(); ctx.arc(dreh, 0, r * 0.2, 0, Math.PI * 2); ctx.fillStyle = METALL_DUNKEL; ctx.fill();
      const gx = dreh + (ex - dreh) * 0.62, gy = ey * 0.62;
      ctx.beginPath(); ctx.arc(gx, gy, r * 0.22, 0, Math.PI * 2); ctx.fillStyle = "#111"; ctx.fill();
      break;
    }
    case "sicherung": {
      const h = Math.min(1.1 * r, m * 0.8), d = 0.5 * r;
      beine(h);
      const kaputt = !!mess?.kaputt;
      // Glasrohr
      ctx.beginPath(); ctx.roundRect(m - h * 0.75, -d / 2, 1.5 * h, d, 3);
      ctx.fillStyle = kaputt ? "rgba(60,50,40,0.7)" : "rgba(220,235,255,0.25)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.stroke();
      // Schmelzdraht
      if (kaputt) {
        linie(m - h * 0.75, 0, m - 0.25 * r, 0.06 * r, "#9ca3af", 1.2);
        linie(m + 0.2 * r, -0.08 * r, m + h * 0.75, 0, "#9ca3af", 1.2);
      } else linie(m - h * 0.75, 0, m + h * 0.75, 0, "#d1d5db", 1.2);
      // Kappen
      kasten(m - h, -d / 2 - 1, h * 0.28, d + 2, 2, zylinder(-d / 2, d, METALL, METALL_DUNKEL));
      kasten(m + h * 0.72, -d / 2 - 1, h * 0.28, d + 2, 2, zylinder(-d / 2, d, METALL, METALL_DUNKEL));
      break;
    }
    case "diode": {
      const h = Math.min(0.8 * r, m * 0.8), d = 0.42 * r;
      beine(h, 2);
      kasten(m - h, -d / 2, 2 * h, d, 2, zylinder(-d / 2, d, "#3f3f46", "#0a0a0a"));
      ctx.fillStyle = "#d1d5db"; ctx.fillRect(m + h * 0.55, -d / 2, h * 0.22, d);
      break;
    }
    case "led": {
      const hell = mess?.kaputt ? 0 : Math.min(1.5, mess?.helligkeit ?? 0);
      const farbe = LED_RGB[Math.round(w.farbe ?? 0)] ?? LED_RGB[0];
      // Beine kommen aus dem Sockel; die Anode (a) ist länger
      const sockelY = -0.55 * r, kx = m;
      linie(0, 0, kx - 0.2 * r, 0, fa, 2.5); linie(kx - 0.2 * r, 0, kx - 0.2 * r, sockelY, METALL, 2);
      linie(kx + 0.2 * r, 0, L, 0, fb, 2.5); linie(kx + 0.2 * r, 0, kx + 0.2 * r, sockelY, METALL, 2);
      const domY = sockelY - 0.65 * r;
      glow(kx, domY, r * 2.4, farbe, hell * 0.85);
      ctx.beginPath();
      ctx.moveTo(kx - 0.45 * r, sockelY); ctx.lineTo(kx - 0.45 * r, domY); ctx.arc(kx, domY, 0.45 * r, Math.PI, 0); ctx.lineTo(kx + 0.45 * r, sockelY);
      ctx.closePath();
      ctx.globalAlpha = hell > 0.02 ? 0.95 : 0.55;
      ctx.fillStyle = mess?.kaputt ? "#3a3a3a" : farbe; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1; ctx.stroke();
      kasten(kx - 0.55 * r, sockelY - 0.08 * r, 1.1 * r, 0.16 * r, 1, mess?.kaputt ? "#3a3a3a" : farbe);
      if (hell > 0.02) {
        ctx.beginPath(); ctx.arc(kx, domY, 0.2 * r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, hell * 0.7)})`; ctx.fill();
      }
      if (mess?.kaputt) schrift("✕", kx, domY, r * 0.55, "#ef4444");
      break;
    }
    case "kondensator": {
      const h = Math.min(0.8 * r, m * 0.8), d = 1.0 * r;
      beine(h, 2.5);
      kasten(m - h, -d / 2, 2 * h, d, 4, zylinder(-d / 2, d, "#3b82f6", "#1e3a8a"));
      ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillRect(m - h + 2, -d / 2 + 2, h * 0.3, d - 4);
      schrift("−", m - h + h * 0.15 + 1, 0, r * 0.4, "#1e3a8a");
      break;
    }
    case "spule": {
      const h = Math.min(1.1 * r, m * 0.8), d = 1.1 * r;
      beine(h + 0.1 * r);
      kasten(m - h - 0.1 * r, -d / 2 - 0.15 * r, 0.22 * r, d + 0.3 * r, 2, "#374151");
      kasten(m + h - 0.12 * r, -d / 2 - 0.15 * r, 0.22 * r, d + 0.3 * r, 2, "#374151");
      kasten(m - h + 0.1 * r, -d / 2, 2 * h - 0.2 * r, d, 2, zylinder(-d / 2, d, "#e3965a", "#8a4a1c"));
      for (let x = m - h + 0.2 * r; x < m + h - 0.15 * r; x += 0.16 * r) linie(x, -d / 2, x, d / 2, "rgba(80,40,10,0.45)", 1);
      break;
    }
    case "trafo": {
      // Eisenkern als geschlossener Rahmen zwischen den Spulen
      const oben = -1.95 * r, unten = -0.05 * r, dicke = 0.32 * r;
      ctx.strokeStyle = EISEN; ctx.lineWidth = dicke;
      ctx.strokeRect(0, oben + dicke / 2, L, unten - oben - dicke);
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
      ctx.strokeRect(-dicke / 2, oben, L + dicke, unten - oben);
      const spule = (x: number, fo: string, fu: string, n: number) => {
        linie(x, 0, x, -0.35 * r, fo, 3); linie(x, -1.65 * r, x, -2 * r, fu, 3);
        kasten(x - 0.55 * r, -1.65 * r, 1.1 * r, 1.3 * r, 3, zylinder(-1.65 * r, 1.3 * r, "#e3965a", "#8a4a1c"));
        for (let y = -1.55 * r; y < -0.4 * r; y += 0.14 * r) linie(x - 0.55 * r, y, x + 0.55 * r, y, "rgba(80,40,10,0.45)", 1);
        schrift(String(Math.round(n)), x, -2.45 * r, r * 0.45, f.text);
      };
      spule(0, fa, fb, w.windungen1);
      spule(L, pf[2] ?? METALL_DUNKEL, pf[3] ?? METALL_DUNKEL, w.windungen2);
      break;
    }
    case "amperemeter":
    case "voltmeter": {
      const b = 2.6 * r, h = 1.9 * r;
      aufrecht();
      kasten(m - b / 2, -h / 2, b, h, 6, "#facc15");
      kasten(m - b / 2 + 0.15 * r, -h / 2 + 0.15 * r, b - 0.3 * r, h - 0.3 * r, 4, "#1f2937");
      kasten(m - b / 2 + 0.3 * r, -h / 2 + 0.3 * r, b - 0.6 * r, 0.75 * r, 2, "#a7c4a0", "#4b5a48");
      schrift(z.anzeigeText ?? "", m, -h / 2 + 0.68 * r, r * 0.45, "#111", "700");
      schrift(t.art === "amperemeter" ? "A" : "V", m, h * 0.12, r * 0.4, "#e5e7eb");
      buchse(m - b / 2 + 0.45 * r, h * 0.22, "#111"); buchse(m + b / 2 - 0.45 * r, h * 0.22, "#dc2626");
      break;
    }
  }
  ctx.restore();
}
