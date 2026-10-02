"use client";
/**
 * Die Kartenfläche: MapLibre mit dem Stil aus lib/karten/stil.ts.
 * Klick auf ein Objekt zeigt seinen Namen (wenn Namen an sind).
 */
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ebeneVonStilEbene, istKlickbar, zeichneSymbol, type Katalog } from "@/lib/karten/stil";
import type { Ausschnitt } from "@/lib/karten/satz";
import type { StyleSpecification } from "maplibre-gl";

export type Treffer = { ebene: string; id: string; name: string; eigenschaften: Record<string, unknown> };

/** Deutschland mit etwas Rand */
const START: [[number, number], [number, number]] = [[5.6, 47.2], [15.3, 55.1]];

/** Liefert das Kartenbild als PNG-data-URL, sobald der aktuelle Stil fertig gezeichnet ist. */
export type KartenBild = () => Promise<string>;

export default function KartenAnsicht({ stil, katalog, namenZeigen, onKlick, ziel, onAusschnitt, bildRef, gastToken, fundort }: {
  stil: StyleSpecification;
  katalog: Katalog;
  namenZeigen: boolean;
  /** Alle Objekte unter dem Klick, oberstes zuerst */
  onKlick?: (treffer: Treffer[]) => void;
  /** Dorthin springen, sobald sich das Objekt ändert (geladener Kartensatz) */
  ziel?: Ausschnitt | null;
  /** Meldet den sichtbaren Ausschnitt nach jedem Verschieben/Zoomen */
  onAusschnitt?: (a: Ausschnitt) => void;
  /** Für den Export: hier hinterlegt die Karte ihre Bild-Funktion */
  bildRef?: { current: KartenBild | null };
  /** Kartenquiz für Gäste: Token für die Ebenen-Anfragen an /api (Gäste haben kein Cookie) */
  gastToken?: string | null;
  /** Suchtreffer: hinfliegen und mit Namen markieren */
  fundort?: { punkt: [number, number]; text: string; zoom: number } | null;
}) {
  const behaelter = useRef<HTMLDivElement>(null);
  const karte = useRef<MapLibreMap | null>(null);
  const popup = useRef<Popup | null>(null);
  const [bereit, setBereit] = useState(false);
  // Die Ereignis-Handler hängen einmal an der Karte; die aktuellen Props liest der Handler über Refs
  const aktuell = useRef({ namenZeigen, onKlick, onAusschnitt, gastToken });
  aktuell.current = { namenZeigen, onKlick, onAusschnitt, gastToken };
  const ersterStil = useRef(stil);
  // Wird nach jedem Stilwechsel erst erfüllt, wenn die Karte wieder ruht (alles gezeichnet)
  const gezeichnet = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let weg = false;
    let m: MapLibreMap | null = null;
    import("maplibre-gl").then((maplibre) => {
      if (weg || !behaelter.current) return;
      // Eigene Kopie des Workers (scripts/copy-maplibre-worker.mjs): webpack verbiegt den Standardpfad
      maplibre.setWorkerUrl("/karten/maplibre/maplibre-gl-worker.mjs");
      m = new maplibre.Map({
        container: behaelter.current,
        style: ersterStil.current,
        bounds: START,
        // Kein maxBounds über die ganze Welt: MapLibre stürzt dann beim Start ab (_calcMatrices)
        renderWorldCopies: false,
        minZoom: 0.5,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        // Für den PDF-Druck muss das Bild nach dem Zeichnen lesbar bleiben
        canvasContextAttributes: { preserveDrawingBuffer: true },
        transformRequest: (url) => {
          const token = aktuell.current.gastToken;
          return token && url.includes("/api/") ? { url, headers: { Authorization: `Bearer ${token}` } } : { url };
        },
      });
      m.touchZoomRotate.disableRotation();
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      m.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
      m.on("styleimagemissing", (e) => {
        const bild = zeichneSymbol(e.id);
        if (bild && !m!.hasImage(e.id)) m!.addImage(e.id, bild, { pixelRatio: 1 });
      });
      const klickbar = () => m!.getLayersOrder().filter(istKlickbar);
      m.on("mousemove", (e) => {
        const t = m!.queryRenderedFeatures(e.point, { layers: klickbar() });
        m!.getCanvas().style.cursor = t.length ? "pointer" : "";
      });
      m.on("click", (e) => {
        // Ein paar Pixel Spielraum: Flüsse sind dünn
        const r = 5;
        const box: [[number, number], [number, number]] = [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]];
        const gefunden = m!.queryRenderedFeatures(box, { layers: klickbar() }) as MapGeoJSONFeature[];
        popup.current?.remove();
        const treffer: Treffer[] = gefunden.map((f) => ({
          ebene: ebeneVonStilEbene(f.layer.id), id: String(f.properties.id), name: String(f.properties.name ?? ""),
          eigenschaften: f.properties,
        }));
        if (!treffer.length) return;
        aktuell.current.onKlick?.(treffer);
        const t = treffer[0];
        if (aktuell.current.namenZeigen && t.name) {
          const zusatz = t.eigenschaften.hoehe ? ` (${t.eigenschaften.hoehe} m)`
            : t.eigenschaften.ew ? ` (${Number(t.eigenschaften.ew).toLocaleString("de-DE")} Einw.)` : "";
          popup.current = new maplibre.Popup({ closeButton: false, offset: 8 })
            .setLngLat(e.lngLat).setText(t.name + zusatz).addTo(m!);
        }
      });
      m.on("load", () => setBereit(true));
      m.on("moveend", () => {
        const b = m!.getBounds();
        aktuell.current.onAusschnitt?.({ west: b.getWest(), sued: b.getSouth(), ost: b.getEast(), nord: b.getNorth() });
      });
      m.on("error", (e) => console.error("Karte:", e.error?.message ?? e));
      karte.current = m;
      // Prüf-Hook für Browser-Tests (Quellen/Ebenen abfragen)
      (window as unknown as { __karte?: MapLibreMap }).__karte = m;
    });
    return () => { weg = true; m?.remove(); karte.current = null; setBereit(false); };
  }, []);

  // Neuer Stil: MapLibre gleicht nur die Unterschiede ab (Quellen bleiben geladen)
  useEffect(() => {
    const m = karte.current;
    if (!bereit || !m) return;
    gezeichnet.current = new Promise((fertig) => m.once("idle", () => fertig()));
    m.setStyle(stil);
    m.triggerRepaint(); // ändert der neue Stil nichts, käme sonst kein »idle«
  }, [stil, bereit]);

  useEffect(() => {
    if (!bildRef) return;
    bildRef.current = async () => {
      await gezeichnet.current;
      return karte.current!.getCanvas().toDataURL("image/png");
    };
    return () => { bildRef.current = null; };
  }, [bildRef]);

  useEffect(() => {
    if (bereit && ziel) karte.current?.fitBounds([[ziel.west, ziel.sued], [ziel.ost, ziel.nord]], { duration: 0 });
  }, [ziel, bereit]);

  const fundPopup = useRef<Popup | null>(null);
  useEffect(() => {
    const m = karte.current;
    if (!bereit || !m || !fundort) return;
    m.flyTo({ center: fundort.punkt, zoom: Math.max(m.getZoom(), fundort.zoom) });
    import("maplibre-gl").then(({ Popup: P }) => {
      fundPopup.current?.remove();
      fundPopup.current = new P({ closeButton: true, offset: 10 }).setLngLat(fundort.punkt).setText(`📍 ${fundort.text}`).addTo(m);
    });
  }, [fundort, bereit]);

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
