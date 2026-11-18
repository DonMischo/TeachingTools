/**
 * Stadtplan auf ein Canvas: Gelände, Viertel, Straßen (mit Brücken),
 * Häuser, Mauern mit Türmen und Toren, Bauwerke, Beschriftungen.
 * Läuft im Browser und in Tests (@napi-rs/canvas) — nur Canvas-2D-API.
 */
import { istWasser, type Gelaende } from "@/lib/gelaende/gelaende";
import { abstand, geschlossen, rechteck, schnitte, type P } from "./geometrie";
import type { Haus } from "./haeuser";
import { BAUTEN, OEPNV, STRASSEN, ZONEN, type Stadt, type StrassenArt } from "./modell";

type Ctx = CanvasRenderingContext2D;

/** Ausschnitt: Bildschirm = (Welt − Ursprung) · m */
export interface Ansicht { x0: number; y0: number; m: number }

export const zuBild = (a: Ansicht, p: P): P => ({ x: (p.x - a.x0) * a.m, y: (p.y - a.y0) * a.m });
export const zuWelt = (a: Ansicht, p: P): P => ({ x: p.x / a.m + a.x0, y: p.y / a.m + a.y0 });

export interface ZeichenOptionen {
  /** Geländebild n×n (aus gelaendeFarben) */
  gelaende: CanvasImageSource;
  /** nur das Wasser des Geländebilds (Rest durchsichtig) — kommt über die Viertel */
  wasser?: CanvasImageSource;
  haeuser: Haus[];
  /** Viertel farbig zeigen */
  zonen?: boolean;
  namen?: boolean;
  /** Bauwerke mit Symbol */
  symbole?: boolean;
  /** halbfertige Linie beim Zeichnen */
  vorschau?: { punkte: P[]; art: StrassenArt | "mauer" | "zone" };
  /** Kreise zum Hervorheben (Quiz, Prüfung) */
  marken?: { p: P; r: number; farbe: string }[];
  /** Nur Draufsicht ohne Beschriftung (für das Voxel-Farbbild) */
  nurBild?: boolean;
}

const REIHE: StrassenArt[] = ["kanal", "aquaedukt", "fernstrasse", "gasse", "neben", "haupt", "ring", "autobahn", "bahn", "bus", "tram", "sbahn", "ubahn"];

function linie(ctx: Ctx, a: Ansicht, l: P[]) {
  ctx.beginPath();
  l.forEach((p, i) => { const q = zuBild(a, p); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
}

function poly(ctx: Ctx, a: Ansicht, l: P[]) {
  linie(ctx, a, l);
  ctx.closePath();
}

export function zeichneKarte(ctx: Ctx, W: number, H: number, a: Ansicht, g: Gelaende, s: Stadt, o: ZeichenOptionen) {
  ctx.save();
  ctx.fillStyle = "#7aa25a";
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  const o0 = zuBild(a, { x: 0, y: 0 });
  ctx.drawImage(o.gelaende, o0.x, o0.y, g.breite * a.m, g.breite * a.m);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Lichtung: In Vierteln steht kein Wald, dort sind Gärten und Wiesen
  ctx.fillStyle = "rgba(170,190,128,0.75)";
  for (const z of s.zonen) if (z.typ !== "parkplatz") { poly(ctx, a, z.poly); ctx.fill(); }

  // Viertel
  for (const z of s.zonen) {
    const art = ZONEN[z.typ];
    poly(ctx, a, z.poly);
    ctx.globalAlpha = o.zonen ? 0.42 : z.typ === "park" ? 0.55 : z.typ === "parkplatz" ? 0.75 : 0.16;
    ctx.fillStyle = art.farbe;
    ctx.fill();
    if (o.zonen) { ctx.globalAlpha = 0.8; ctx.strokeStyle = art.farbe; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  if (o.wasser) ctx.drawImage(o.wasser, o0.x, o0.y, g.breite * a.m, g.breite * a.m);

  // Brücken: unter den Straßen, wo sie Wasser queren
  ctx.strokeStyle = "#5b4630";
  for (const st of s.strassen) {
    if (st.art === "aquaedukt" || st.art === "ubahn" || st.art === "kanal") continue;
    const b = STRASSEN[st.art].breite;
    for (let i = 0; i + 1 < st.punkte.length; i++) {
      const p = st.punkte[i], q = st.punkte[i + 1], d = abstand(p, q), k = Math.max(1, Math.ceil(d / 6));
      for (let t = 0; t < k; t++) {
        const u = { x: p.x + (q.x - p.x) * (t + 0.5) / k, y: p.y + (q.y - p.y) * (t + 0.5) / k };
        if (!istWasser(g, u.x, u.y)) continue;
        ctx.lineWidth = Math.max(3, (b + 6) * a.m);
        linie(ctx, a, [{ x: p.x + (q.x - p.x) * t / k, y: p.y + (q.y - p.y) * t / k }, { x: p.x + (q.x - p.x) * (t + 1) / k, y: p.y + (q.y - p.y) * (t + 1) / k }]);
        ctx.stroke();
      }
    }
  }

  // Straßen: erst alle Ränder, dann die Flächen
  for (const pass of [0, 1]) for (const art of REIHE) {
    const st = STRASSEN[art];
    for (const s1 of s.strassen) {
      if (s1.art !== art) continue;
      linie(ctx, a, s1.punkte);
      if (art === "bahn") {
        if (pass === 0) { ctx.strokeStyle = "#2b2b2b"; ctx.lineWidth = Math.max(2.5, 5 * a.m); ctx.setLineDash([]); ctx.stroke(); }
        else { ctx.strokeStyle = "#f4f4f4"; ctx.lineWidth = Math.max(1, 2.4 * a.m); ctx.setLineDash([Math.max(3, 12 * a.m), Math.max(3, 12 * a.m)]); ctx.stroke(); ctx.setLineDash([]); }
        continue;
      }
      if (OEPNV.includes(art)) {
        // Linien nur im zweiten Durchgang, über den Straßen; U-Bahn gestrichelt (unter der Erde)
        if (pass === 1) {
          ctx.strokeStyle = st.farbe; ctx.lineWidth = Math.max(2, st.breite * 1.6 * a.m);
          if (art === "ubahn" || art === "bus") ctx.setLineDash([Math.max(3, 14 * a.m), Math.max(2, 7 * a.m)]);
          ctx.stroke(); ctx.setLineDash([]);
        }
        continue;
      }
      if (art === "aquaedukt") {
        if (pass === 1) {
          ctx.strokeStyle = st.rand; ctx.lineWidth = Math.max(2, st.breite * a.m); ctx.setLineDash([Math.max(2, 6 * a.m), Math.max(1, 3 * a.m)]); ctx.stroke(); ctx.setLineDash([]);
        }
        continue;
      }
      ctx.strokeStyle = pass ? st.farbe : st.rand;
      ctx.lineWidth = Math.max(pass ? 1 : 2, (st.breite + (pass ? 0 : 2.5)) * a.m);
      ctx.stroke();
    }
  }

  // Häuser
  for (const h of o.haeuser) {
    poly(ctx, a, h.ecken);
    ctx.fillStyle = h.dach;
    ctx.fill();
    if (a.m > 0.45) { ctx.strokeStyle = "rgba(60,40,30,.45)"; ctx.lineWidth = 0.6; ctx.stroke(); }
  }

  // Mauern mit Türmen und Toren
  for (const m of s.mauern) {
    const ring = geschlossen(m);
    linie(ctx, a, ring);
    ctx.strokeStyle = "#5e5348";
    ctx.lineWidth = Math.max(2.5, 6 * a.m);
    ctx.stroke();
    ctx.strokeStyle = "#a59886";
    ctx.lineWidth = Math.max(1, 2.5 * a.m);
    ctx.stroke();
    ctx.fillStyle = "#5e5348";
    const tr = Math.max(2.5, 7 * a.m);
    for (let i = 0; i + 1 < ring.length; i++) {
      const p = ring[i], q = ring[i + 1], L = abstand(p, q);
      for (let d = 0; d < L; d += 70) {
        const t = zuBild(a, { x: p.x + (q.x - p.x) * d / L, y: p.y + (q.y - p.y) * d / L });
        ctx.fillRect(t.x - tr / 2, t.y - tr / 2, tr, tr);
      }
    }
    // Tore, wo Straßen die Mauer queren
    for (const st of s.strassen) {
      if (st.art === "gasse" || st.art === "neben" || st.art === "bahn" || st.art === "aquaedukt" || st.art === "ring") continue;
      for (const t of schnitte(st.punkte, ring)) {
        const q = zuBild(a, t), r = Math.max(4, 10 * a.m);
        ctx.fillStyle = "#4b4239";
        ctx.fillRect(q.x - r / 2, q.y - r / 2, r, r);
      }
    }
  }

  // Bauwerke
  for (const b of s.bauten) {
    const art = BAUTEN[b.typ];
    if (b.typ === "tor") continue;
    const ecken = rechteck(b, art.b, art.h, b.dreh ?? 0);
    ctx.beginPath();
    if (b.typ === "amphitheater" || b.typ === "theater") {
      const c = zuBild(a, b);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(b.dreh ?? 0);
      if (b.typ === "amphitheater") ctx.ellipse(0, 0, art.b / 2 * a.m, art.h / 2 * a.m, 0, 0, Math.PI * 2);
      else { ctx.moveTo(-art.b / 2 * a.m, art.h / 4 * a.m); ctx.arc(0, art.h / 4 * a.m, art.b / 2 * a.m, Math.PI, 0); ctx.closePath(); }
      ctx.restore();
    } else poly(ctx, a, ecken);
    ctx.fillStyle = art.farbe;
    ctx.fill();
    ctx.strokeStyle = "rgba(50,40,30,.7)";
    ctx.lineWidth = Math.max(1, 1.5 * a.m);
    ctx.stroke();
    if (b.typ === "amphitheater") {
      const c = zuBild(a, b);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, art.b * 0.28 * a.m, art.h * 0.24 * a.m, b.dreh ?? 0, 0, Math.PI * 2);
      ctx.fillStyle = "#e9d8b4";
      ctx.fill();
    }
  }
  for (const b of s.bauten) if (b.typ === "tor") {
    const q = zuBild(a, b), r = Math.max(5, 12 * a.m);
    ctx.fillStyle = "#4b4239";
    ctx.fillRect(q.x - r / 2, q.y - r / 2, r, r);
  }

  if (!o.nurBild) {
    if (o.symbole !== false) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const b of s.bauten) {
        if (b.typ === "tor") continue;
        const art = BAUTEN[b.typ];
        const q = zuBild(a, b);
        const gr = Math.max(13, Math.min(30, Math.max(art.b, art.h) * a.m * 0.55));
        ctx.font = `${gr}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
        ctx.fillText(art.icon, q.x, q.y + 1);
      }
    }
    if (o.namen !== false) for (const n of s.namen ?? []) {
      const q = zuBild(a, n);
      ctx.font = `bold ${Math.max(11, Math.min(16, 14 * a.m + 6))}px system-ui,sans-serif`;
      ctx.textAlign = "left";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.strokeText(n.text, q.x, q.y);
      ctx.fillStyle = "#3a2f25";
      ctx.fillText(n.text, q.x, q.y);
    }
    if (o.vorschau && o.vorschau.punkte.length) {
      const v = o.vorschau;
      linie(ctx, a, v.punkte);
      if (v.art === "mauer" || v.art === "zone") ctx.closePath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = v.art === "mauer" ? "#5e5348" : v.art === "zone" ? "#7c3aed" : "#c2410c";
      ctx.lineWidth = v.art === "mauer" || v.art === "zone" ? 3 : Math.max(2, STRASSEN[v.art].breite * a.m);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of v.punkte) { const q = zuBild(a, p); ctx.fillStyle = "#c2410c"; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); }
    }
    for (const mk of o.marken ?? []) {
      const q = zuBild(a, mk.p);
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(10, mk.r * a.m), 0, Math.PI * 2);
      ctx.strokeStyle = mk.farbe;
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}
