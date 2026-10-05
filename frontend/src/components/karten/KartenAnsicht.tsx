"use client";
/**
 * Die Kartenfläche: MapLibre mit dem Stil aus lib/karten/stil.ts.
 * Klick auf ein Objekt zeigt seinen Namen (wenn Namen an sind).
 */
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ebeneVonStilEbene, istKlickbar, istLauflicht, zeichneSymbol, type Katalog } from "@/lib/karten/stil";
import type { Ausschnitt } from "@/lib/karten/satz";
import type { StyleSpecification } from "maplibre-gl";
import PartikelFluss from "./PartikelFluss";

export type Treffer = { ebene: string; id: string; name: string; eigenschaften: Record<string, unknown> };

/** Strichmuster, die nacheinander ein Wandern ergeben (Strich 3, Lücke 4) */
const LAUFLICHT: number[][] = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];

/** Deutschland mit etwas Rand */
const START: [[number, number], [number, number]] = [[5.6, 47.2], [15.3, 55.1]];

/** Liefert das Kartenbild als PNG-data-URL, sobald der aktuelle Stil fertig gezeichnet ist. */
export type KartenBild = () => Promise<string>;

export default function KartenAnsicht({ stil, katalog, namenZeigen, onKlick, ziel, onAusschnitt, bildRef, gastToken, fundort, blick, partikel }: {
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
  /** Diesen Punkt ins Bild holen (ohne Namen, z. B. das gefragte Objekt beim Üben) */
  blick?: [number, number] | null;
  /** Partikelfluss über Wind/Strömungen (nur diese Ebenen, im gewählten Monat) */
  partikel?: { ebenen: string[]; monat: string } | null;
}) {
  const behaelter = useRef<HTMLDivElement>(null);
  const karte = useRef<MapLibreMap | null>(null);
  const popup = useRef<Popup | null>(null);
  const [bereit, setBereit] = useState(false);
  // Die Ereignis-Handler hängen einmal an der Karte; die aktuellen Props liest der Handler über Refs
  const aktuell = useRef({ namenZeigen, onKlick, onAusschnitt, gastToken, katalog });
  aktuell.current = { namenZeigen, onKlick, onAusschnitt, gastToken, katalog };
  // Angeklickte Strömung bzw. Windgürtel bleibt hervorgehoben (feature-state »aktiv«)
  const hervor = useRef<{ source: string; id: string } | null>(null);
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
        if (hervor.current) m!.removeFeatureState(hervor.current, "aktiv");
        hervor.current = null;
        if (!treffer.length) return;
        aktuell.current.onKlick?.(treffer);
        const t = treffer[0];
        if (aktuell.current.katalog.ebenen.find((x) => x.id === t.ebene)?.monate) {
          hervor.current = { source: t.ebene, id: t.id };
          m!.setFeatureState(hervor.current, { aktiv: true });
        }
        if (aktuell.current.namenZeigen && t.name) {
          const zusatz = t.eigenschaften.info ? ` — ${t.eigenschaften.info}` : t.eigenschaften.hoehe ? ` (${t.eigenschaften.hoehe} m)`
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

  // Lauflicht: das Strichmuster der »:fluss«-Ebenen wandert in Linienrichtung (Wind, Strömungen)
  useEffect(() => {
    const m = karte.current;
    if (!bereit || !m) return;
    const ebenen = (stil.layers ?? []).map((l) => l.id).filter(istLauflicht);
    if (!ebenen.length) return;
    let schritt = 0;
    const uhr = setInterval(() => {
      if (document.hidden) return;
      schritt = (schritt + 1) % LAUFLICHT.length;
      for (const id of ebenen) if (m.getLayer(id)) m.setPaintProperty(id, "line-dasharray", LAUFLICHT[schritt]);
    }, 80);
    return () => clearInterval(uhr);
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

  useEffect(() => {
    const m = karte.current;
    if (!bereit || !m || !blick) return;
    // Nur schwenken, wenn der Punkt nicht schon gut zu sehen ist (Rand: 10 % je Seite)
    const p = m.project(blick), { width, height } = m.getCanvas().getBoundingClientRect();
    if (p.x < width * 0.1 || p.x > width * 0.9 || p.y < height * 0.1 || p.y > height * 0.9) m.easeTo({ center: blick, duration: 600 });
  }, [blick, bereit]);

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
      {bereit && karte.current && partikel && <PartikelFluss karte={karte.current} ebenen={partikel.ebenen} monat={partikel.monat} />}
      <div className="absolute bottom-0 right-0 bg-white/80 text-[10px] text-neutral-700 px-1.5 py-0.5 rounded-tl">
        {quellen.map((q, i) => (
          <span key={q.name}>{i > 0 && " · "}<a href={q.url} target="_blank" rel="noreferrer" className="hover:underline">{q.name}</a></span>
        ))}
      </div>
    </div>
  );
}
