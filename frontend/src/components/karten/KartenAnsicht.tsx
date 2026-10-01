"use client";
/**
 * Die Kartenfläche: MapLibre mit dem Stil aus lib/karten/stil.ts.
 * Klick auf ein Objekt zeigt seinen Namen (wenn Namen an sind).
 */
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { KLICK_EBENEN, zeichneSymbol, type Katalog } from "@/lib/karten/stil";
import type { StyleSpecification } from "maplibre-gl";

export type Treffer = { ebene: string; id: string; name: string; eigenschaften: Record<string, unknown> };

/** Deutschland mit etwas Rand */
const START: [[number, number], [number, number]] = [[5.6, 47.2], [15.3, 55.1]];

export default function KartenAnsicht({ stil, katalog, namenZeigen, onKlick }: {
  stil: StyleSpecification;
  katalog: Katalog;
  namenZeigen: boolean;
  onKlick?: (t: Treffer) => void;
}) {
  const behaelter = useRef<HTMLDivElement>(null);
  const karte = useRef<MapLibreMap | null>(null);
  const popup = useRef<Popup | null>(null);
  const [bereit, setBereit] = useState(false);
  // Die Ereignis-Handler hängen einmal an der Karte; die aktuellen Props liest der Handler über Refs
  const aktuell = useRef({ namenZeigen, onKlick });
  aktuell.current = { namenZeigen, onKlick };
  const ersterStil = useRef(stil);

  useEffect(() => {
    let weg = false;
    let m: MapLibreMap | null = null;
    import("maplibre-gl").then((maplibre) => {
      if (weg || !behaelter.current) return;
      m = new maplibre.Map({
        container: behaelter.current,
        style: ersterStil.current,
        bounds: START,
        maxBounds: [[-20, 33], [40, 70]],
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        // Für den PDF-Druck muss das Bild nach dem Zeichnen lesbar bleiben
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      m.touchZoomRotate.disableRotation();
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      m.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
      m.on("styleimagemissing", (e) => {
        const bild = zeichneSymbol(e.id);
        if (bild && !m!.hasImage(e.id)) m!.addImage(e.id, bild, { pixelRatio: 1 });
      });
      const klickbar = () => Object.keys(KLICK_EBENEN).filter((l) => m!.getLayer(l));
      m.on("mousemove", (e) => {
        const t = m!.queryRenderedFeatures(e.point, { layers: klickbar() });
        m!.getCanvas().style.cursor = t.length ? "pointer" : "";
      });
      m.on("click", (e) => {
        const [f] = m!.queryRenderedFeatures(e.point, { layers: klickbar() }) as MapGeoJSONFeature[];
        popup.current?.remove();
        if (!f) return;
        const t: Treffer = {
          ebene: KLICK_EBENEN[f.layer.id], id: String(f.properties.id), name: String(f.properties.name ?? ""),
          eigenschaften: f.properties,
        };
        aktuell.current.onKlick?.(t);
        if (aktuell.current.namenZeigen && t.name) {
          const zusatz = t.eigenschaften.hoehe ? ` (${t.eigenschaften.hoehe} m)`
            : t.eigenschaften.ew ? ` (${Number(t.eigenschaften.ew).toLocaleString("de-DE")} Einw.)` : "";
          popup.current = new maplibre.Popup({ closeButton: false, offset: 8 })
            .setLngLat(e.lngLat).setText(t.name + zusatz).addTo(m!);
        }
      });
      m.on("load", () => setBereit(true));
      karte.current = m;
    });
    return () => { weg = true; m?.remove(); karte.current = null; setBereit(false); };
  }, []);

  // Neuer Stil: MapLibre gleicht nur die Unterschiede ab (Quellen bleiben geladen)
  useEffect(() => {
    if (bereit) karte.current?.setStyle(stil);
  }, [stil, bereit]);

  const quellen = [...new Map(katalog.ebenen.map((e) => [e.quelle.name, e.quelle])).values()];
  return (
    <div className="relative w-full h-[72vh] min-h-[420px] rounded-2xl overflow-hidden border border-[var(--border)]">
      {/* Kein absolute/inset: maplibre-gl.css setzt .maplibregl-map auf position: relative */}
      <div ref={behaelter} className="w-full h-full" data-karte />
      <div className="absolute bottom-0 right-0 bg-white/80 text-[10px] text-neutral-700 px-1.5 py-0.5 rounded-tl">
        {quellen.map((q, i) => (
          <span key={q.name}>{i > 0 && " · "}<a href={q.url} target="_blank" rel="noreferrer" className="hover:underline">{q.name}</a></span>
        ))}
      </div>
    </div>
  );
}
