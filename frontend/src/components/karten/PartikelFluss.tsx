"use client";
/**
 * Partikelfluss über der Karte: Punkte mit Schweif treiben im Feld aus
 * lib/karten/partikel.ts — Meeresströmungen rot/blau (warm/kalt), Wind dunkel.
 * Eine Canvas-Ebene über MapLibre; beim Verschieben/Zoomen fangen die Schweife neu an.
 */
import { useEffect } from "react";
import type { Feature, FeatureCollection } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { baueFeld, startpunkt, wind, type Feld } from "@/lib/karten/partikel";
import { abstand, echt, vor, zurueck, type Projektion } from "@/lib/karten/projektion";

/** Je Ebene: Wirkradius des Felds (Grad), Partikelzahl, Tempo (Pixel je Bild) */
const ART: Record<string, { radius: number; anzahl: number; tempo: number; breite: number; leben: number; farbe: (warm: number) => string }> = {
  // Kräftig und mit dunklem Saum: auf hellem und dunklem Meer (Meeresboden) gut zu sehen
  // Dünne Stromfäden mit langem Schweif, eng an der Strömung; hell getönt: warm orange, kalt eisblau
  "welt-stroemungen": { radius: 2.5, anzahl: 3200, tempo: 0.7, breite: 1.3, leben: 180,
    farbe: (w) => (w > 0.5 ? "rgba(255,160,100,0.95)" : "rgba(110,200,255,0.95)") },
  "welt-winde": { radius: 11, anzahl: 1400, tempo: 1.4, breite: 1.2, leben: 90, farbe: () => "rgba(255,255,255,0.85)" },
};

type Partikel = { lon: number; lat: number; alter: number };

/** Etwas weniger als ein Viertel des Erdumfangs (m): dahinter liegt die Rückseite des Globus */
const VIERTELKREIS = 0.95 * (Math.PI / 2) * 6371008.8;

/** Linien aus Kartenkoordinaten (Equal Earth, Robinson …) zurück in echte Längen/Breiten */
function linienZurueck(f: Feature, p: Projektion): Feature {
  const g = f.geometry;
  const z = (l: number[][]) => l.map((q) => zurueck(q, p) ?? q);
  if (g?.type === "LineString") return { ...f, geometry: { ...g, coordinates: z(g.coordinates) } };
  if (g?.type === "MultiLineString") return { ...f, geometry: { ...g, coordinates: g.coordinates.map(z) } };
  return f;
}

export default function PartikelFluss({ karte, ebenen, monat, projektion = "equalearth" }: {
  karte: MapLibreMap; ebenen: string[]; monat: string; projektion?: Projektion;
}) {
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
    const neu = (feld: Feld, p: Partikel, leben: number) => {
      const s = startpunkt(feld);
      if (s) { p.lon = s[0]; p.lat = s[1]; }
      p.alter = Math.floor(Math.random() * leben);
    };
    // Daten aus der Kartenquelle (auch mit Gast-Token schon geladen); fehlt sie noch, sobald die Quelle meldet.
    // Nicht auf »idle« warten: das Lauflicht hält die Karte ständig in Bewegung.
    const laden = async () => {
      for (const id of ids) {
        if (felder.some((f) => f.id === id)) continue;
        const quelle = karte.getSource(id) as GeoJSONSource | undefined;
        if (!quelle) continue;
        const daten = (await quelle.getData().catch(() => null)) as FeatureCollection | null;
        if (!daten?.features || weg) continue;
        // Die Quelle liegt im Kartennetz vor — das Feld rechnet in echten Längen und Breiten
        const feld = baueFeld(!echt(projektion) ? daten.features.map((f) => linienZurueck(f, projektion)) : daten.features, monat, ART[id].radius);
        const teile = Array.from({ length: ART[id].anzahl }, () => { const p = { lon: 0, lat: 0, alter: 0 }; neu(feld, p, ART[id].leben); return p; });
        felder.push({ id, feld, teile });
      }
    };
    void laden();
    const quelleDa = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (e.sourceId && ids.includes(e.sourceId) && e.isSourceLoaded) void laden();
    };
    karte.on("sourcedata", quelleDa);

    const schritt = () => {
      if (weg) return;
      bild = requestAnimationFrame(schritt);
      if (document.hidden || !felder.length) return;
      // Schweife verblassen lassen
      g.globalCompositeOperation = "destination-in";
      // Langsam verblassende Schweife (Stromfäden)
      g.fillStyle = "rgba(0,0,0,0.97)";
      g.fillRect(0, 0, leinwand.width, leinwand.height);
      g.globalCompositeOperation = "source-over";
      const gradJePixel = 360 / (512 * 2 ** karte.getZoom());
      // Globus: Teilchen auf der Rückseite weiterwandern lassen, aber nicht zeichnen
      const mitte = karte.getCenter(), m: [number, number] = [mitte.lng, mitte.lat];
      const hinten = (lon: number, lat: number) => projektion === "globus" && abstand(m, [lon, lat]) > VIERTELKREIS;
      for (const { id, feld, teile } of felder) {
        const { tempo, farbe, breite, leben } = ART[id];
        // Ein Pfad je Farbe statt ein Strich je Partikel
        const pfade = new Map<string, Path2D>();
        for (const p of teile) {
          const [u, v, warm] = wind(feld, p.lon, p.lat);
          if (++p.alter > leben || Math.hypot(u, v) < 0.05) { neu(feld, p, leben); continue; }
          const k = Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
          const lon = p.lon + (u * tempo * gradJePixel) / k, lat = p.lat + v * tempo * gradJePixel;
          if (lon < -180 || lon > 180 || lat < -85 || lat > 85) { neu(feld, p, leben); continue; }
          if (hinten(p.lon, p.lat)) { p.lon = lon; p.lat = lat; continue; }
          const a = karte.project(vor([p.lon, p.lat], projektion)), b = karte.project(vor([lon, lat], projektion));
          const f = farbe(warm);
          let pfad = pfade.get(f);
          if (!pfad) pfade.set(f, (pfad = new Path2D()));
          pfad.moveTo(a.x, a.y); pfad.lineTo(b.x, b.y);
          p.lon = lon; p.lat = lat;
        }
        for (const [f, pfad] of pfade) {
          g.lineWidth = breite + 1; g.strokeStyle = "rgba(15,23,42,0.28)"; g.stroke(pfad);
          g.lineWidth = breite; g.strokeStyle = f; g.stroke(pfad);
        }
      }
    };
    bild = requestAnimationFrame(schritt);
    return () => {
      weg = true;
      cancelAnimationFrame(bild);
      karte.off("move", leeren); karte.off("resize", passend); karte.off("sourcedata", quelleDa);
      leinwand.remove();
    };
  }, [karte, schluessel, monat, projektion]);
  return null;
}
