"use client";
/**
 * Partikelfluss über der Karte: Punkte mit Schweif treiben im Feld aus
 * lib/karten/partikel.ts — Meeresströmungen rot/blau (warm/kalt), Wind dunkel.
 * Eine Canvas-Ebene über MapLibre; beim Verschieben/Zoomen fangen die Schweife neu an.
 */
import { useEffect } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { baueFeld, startpunkt, wind, type Feld } from "@/lib/karten/partikel";

/** Je Ebene: Wirkradius des Felds (Grad), Partikelzahl, Tempo (Pixel je Bild) */
const ART: Record<string, { radius: number; anzahl: number; tempo: number; breite: number; farbe: (warm: number) => string }> = {
  "welt-stroemungen": { radius: 4, anzahl: 1800, tempo: 0.8, breite: 1.8, farbe: (w) => (w > 0.5 ? "rgba(200,40,20,0.9)" : "rgba(20,70,190,0.9)") },
  "welt-winde": { radius: 11, anzahl: 1100, tempo: 1.4, breite: 1, farbe: () => "rgba(15,23,42,0.4)" },
};
const LEBEN = 90; // Bilder, dann neu geboren

type Partikel = { lon: number; lat: number; alter: number };

export default function PartikelFluss({ karte, ebenen, monat }: { karte: MapLibreMap; ebenen: string[]; monat: string }) {
  const schluessel = ebenen.filter((e) => ART[e]).join(",");
  useEffect(() => {
    if (!schluessel) return;
    let weg = false, bild = 0;
    const ids = schluessel.split(",");
    const leinwand = document.createElement("canvas");
    Object.assign(leinwand.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none" });
    karte.getCanvasContainer().appendChild(leinwand);
    const g = leinwand.getContext("2d")!;
    const passend = () => {
      const c = karte.getCanvas(), dpr = window.devicePixelRatio || 1;
      leinwand.width = c.clientWidth * dpr; leinwand.height = c.clientHeight * dpr;
      leinwand.style.width = `${c.clientWidth}px`; leinwand.style.height = `${c.clientHeight}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    passend();
    const leeren = () => g.clearRect(0, 0, leinwand.width, leinwand.height);
    karte.on("move", leeren);
    karte.on("resize", passend);

    const felder: { id: string; feld: Feld; teile: Partikel[] }[] = [];
    const neu = (feld: Feld, p: Partikel) => {
      const s = startpunkt(feld);
      if (s) { p.lon = s[0]; p.lat = s[1]; }
      p.alter = Math.floor(Math.random() * LEBEN);
    };
    // Daten aus der Kartenquelle (auch mit Gast-Token schon geladen); fehlt sie noch, beim nächsten »idle«
    const laden = async () => {
      for (const id of ids) {
        if (felder.some((f) => f.id === id)) continue;
        const quelle = karte.getSource(id) as GeoJSONSource | undefined;
        if (!quelle) continue;
        const daten = (await quelle.getData().catch(() => null)) as FeatureCollection | null;
        if (!daten?.features || weg) continue;
        const feld = baueFeld(daten.features, monat, ART[id].radius);
        const teile = Array.from({ length: ART[id].anzahl }, () => { const p = { lon: 0, lat: 0, alter: 0 }; neu(feld, p); return p; });
        felder.push({ id, feld, teile });
      }
    };
    void laden();
    karte.on("idle", laden);

    const schritt = () => {
      if (weg) return;
      bild = requestAnimationFrame(schritt);
      if (document.hidden || !felder.length) return;
      // Schweife verblassen lassen
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = "rgba(0,0,0,0.94)";
      g.fillRect(0, 0, leinwand.width, leinwand.height);
      g.globalCompositeOperation = "source-over";
      const gradJePixel = 360 / (512 * 2 ** karte.getZoom());
      for (const { id, feld, teile } of felder) {
        const { tempo, farbe, breite } = ART[id];
        // Ein Pfad je Farbe statt ein Strich je Partikel
        const pfade = new Map<string, Path2D>();
        for (const p of teile) {
          const [u, v, warm] = wind(feld, p.lon, p.lat);
          if (++p.alter > LEBEN || Math.hypot(u, v) < 0.05) { neu(feld, p); continue; }
          const k = Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
          const lon = p.lon + (u * tempo * gradJePixel) / k, lat = p.lat + v * tempo * gradJePixel;
          if (lon < -180 || lon > 180 || lat < -85 || lat > 85) { neu(feld, p); continue; }
          const a = karte.project([p.lon, p.lat]), b = karte.project([lon, lat]);
          const f = farbe(warm);
          let pfad = pfade.get(f);
          if (!pfad) pfade.set(f, (pfad = new Path2D()));
          pfad.moveTo(a.x, a.y); pfad.lineTo(b.x, b.y);
          p.lon = lon; p.lat = lat;
        }
        g.lineWidth = breite;
        for (const [f, pfad] of pfade) { g.strokeStyle = f; g.stroke(pfad); }
      }
    };
    bild = requestAnimationFrame(schritt);
    return () => {
      weg = true;
      cancelAnimationFrame(bild);
      karte.off("move", leeren); karte.off("resize", passend); karte.off("idle", laden);
      leinwand.remove();
    };
  }, [karte, schluessel, monat]);
  return null;
}
