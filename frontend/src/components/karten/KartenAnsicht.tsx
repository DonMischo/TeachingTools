"use client";
/**
 * Die Kartenfläche: MapLibre mit dem Stil aus lib/karten/stil.ts.
 * Klick auf ein Objekt zeigt seinen Namen (wenn Namen an sind).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ebeneVonStilEbene, istKlickbar, istLauflicht, zeichneSymbol, type Katalog } from "@/lib/karten/stil";
import type { Ausschnitt } from "@/lib/karten/satz";
import type { StyleSpecification } from "maplibre-gl";
import PartikelFluss from "./PartikelFluss";
import { massstab, zeichneMassstab } from "@/lib/karten/massstab";
import { abstand, ausschnittVor, ausschnittZurueck, vor, zurueck, type Projektion } from "@/lib/karten/projektion";

/** Unter dieser Zoomstufe (ganze Welt) gilt kein einheitlicher Maßstab — dann keine Leiste */
const MASSSTAB_AB_ZOOM = 2.5;
/** Aktuelle Leiste: Meter je Pixel in der Kartenmitte, gemessen über echte Koordinaten (jedes Kartennetz) */
function leisteVon(m: MapLibreMap, p: Projektion) {
  if (m.getZoom() < MASSSTAB_AB_ZOOM) return null;
  const c = m.getCanvas(), x = c.clientWidth / 2, y = c.clientHeight / 2;
  const a = m.unproject([x - 50, y]), b = m.unproject([x + 50, y]);
  const pa = zurueck([a.lng, a.lat], p), pb = zurueck([b.lng, b.lat], p);
  return pa && pb ? massstab(abstand(pa, pb) / 100) : null;
}

export type Treffer = { ebene: string; id: string; name: string; eigenschaften: Record<string, unknown> };

/** Strichmuster, die nacheinander ein Wandern ergeben (Strich 3, Lücke 4) */
const LAUFLICHT: number[][] = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];

/** Deutschland mit etwas Rand */
const START: [[number, number], [number, number]] = [[5.6, 47.2], [15.3, 55.1]];

/** Liefert das Kartenbild als PNG-data-URL, sobald der aktuelle Stil fertig gezeichnet ist. */
export type KartenBild = () => Promise<string>;

export default function KartenAnsicht({ stil, katalog, namenZeigen, onKlick, ziel, onAusschnitt, bildRef, gastToken, fundort, blick, partikel, projektion = "equalearth", menue }: {
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
  /** Kartennetz des Stils — für alles, was hier in echten Koordinaten ankommt */
  projektion?: Projektion;
  /** Bedienelemente oben links auf der Karte (☰-Menü) */
  menue?: ReactNode;
}) {
  const behaelter = useRef<HTMLDivElement>(null);
  const karte = useRef<MapLibreMap | null>(null);
  const popup = useRef<Popup | null>(null);
  const [bereit, setBereit] = useState(false);
  // Die Ereignis-Handler hängen einmal an der Karte; die aktuellen Props liest der Handler über Refs
  const aktuell = useRef({ namenZeigen, onKlick, onAusschnitt, gastToken, katalog, projektion });
  aktuell.current = { namenZeigen, onKlick, onAusschnitt, gastToken, katalog, projektion };
  // Angeklickte Strömung bzw. Windgürtel bleibt hervorgehoben (feature-state »aktiv«)
  const hervor = useRef<{ source: string; id: string } | null>(null);
  const ersterStil = useRef(stil);
  const massstabRef = useRef<HTMLCanvasElement>(null);
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
      // Maßstabsleiste (schwarz-weiß) bei jeder Bewegung neu zeichnen
      const leiste = () => {
        const c = massstabRef.current;
        if (!c) return;
        const dpr = window.devicePixelRatio || 1;
        c.width = 240 * dpr; c.height = 44 * dpr;
        const g = c.getContext("2d")!;
        g.clearRect(0, 0, c.width, c.height);
        const l = leisteVon(m!, aktuell.current.projektion);
        if (l) zeichneMassstab(g, l, 12 * dpr, 38 * dpr, dpr);
      };
      m.on("move", leiste);
      m.on("load", leiste);
      m.on("load", () => setBereit(true));
      m.on("moveend", () => {
        const b = m!.getBounds();
        aktuell.current.onAusschnitt?.(ausschnittZurueck({ west: b.getWest(), sued: b.getSouth(), ost: b.getEast(), nord: b.getNorth() },
          aktuell.current.projektion));
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
    // Fertig, sobald »idle« kommt — oder alle Kacheln da sind (Lauflicht/Partikel halten die Karte sonst nie still)
    gezeichnet.current = new Promise((fertig) => {
      let erledigt = false;
      const ende = () => { if (!erledigt) { erledigt = true; fertig(); } };
      m.once("idle", ende);
      const pruefe = () => { if (erledigt) return; if (m.isStyleLoaded() && m.areTilesLoaded()) ende(); else setTimeout(pruefe, 150); };
      setTimeout(pruefe, 300);
    });
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
      // Kartenbild plus Maßstabsleiste (die Leiste gehört zur Karte, auch auf dem Arbeitsblatt)
      const m = karte.current!, quelle = m.getCanvas();
      const bild = document.createElement("canvas");
      bild.width = quelle.width; bild.height = quelle.height;
      const g = bild.getContext("2d")!;
      g.drawImage(quelle, 0, 0);
      const l = leisteVon(m, aktuell.current.projektion), s = quelle.width / quelle.clientWidth;
      if (l) zeichneMassstab(g, l, 18 * s, quelle.height - 14 * s, s);
      return bild.toDataURL("image/png");
    };
    return () => { bildRef.current = null; };
  }, [bildRef]);

  useEffect(() => {
    if (!bereit || !ziel) return;
    const z = ausschnittVor(ziel, projektion);
    karte.current?.fitBounds([[z.west, z.sued], [z.ost, z.nord]], { duration: 0 });
  }, [ziel, bereit, projektion]);

  useEffect(() => {
    const m = karte.current;
    if (!bereit || !m || !blick) return;
    // Nur schwenken, wenn der Punkt nicht schon gut zu sehen ist (Rand: 10 % je Seite)
    const ort = vor(blick, projektion);
    const p = m.project(ort), { width, height } = m.getCanvas().getBoundingClientRect();
    if (p.x < width * 0.1 || p.x > width * 0.9 || p.y < height * 0.1 || p.y > height * 0.9) m.easeTo({ center: ort, duration: 600 });
  }, [blick, bereit, projektion]);

  const fundPopup = useRef<Popup | null>(null);
  useEffect(() => {
    const m = karte.current;
    if (!bereit || !m || !fundort) return;
    const ort = vor(fundort.punkt, projektion);
    m.flyTo({ center: ort, zoom: Math.max(m.getZoom(), fundort.zoom) });
    import("maplibre-gl").then(({ Popup: P }) => {
      fundPopup.current?.remove();
      fundPopup.current = new P({ closeButton: true, offset: 10 }).setLngLat(ort).setText(`📍 ${fundort.text}`).addTo(m);
    });
  }, [fundort, bereit, projektion]);

  // Nur Quellen der Ebenen, die gerade gezeichnet werden (Bildquellen heißen »<ebene>-0« …)
  const sichtbar = new Set(Object.keys(stil.sources).map((k) => k.replace(/-\d+$/, "")));
  const quellen = [...new Map(katalog.ebenen.filter((e) => sichtbar.has(e.id)).map((e) => [e.quelle.name, e.quelle])).values()];
  return (
    <div className="flex flex-col gap-1 w-full">
    <div className="relative w-full h-[72vh] min-h-[420px] rounded-2xl overflow-hidden border border-[var(--border)]">
      {/* Kein absolute/inset: maplibre-gl.css setzt .maplibregl-map auf position: relative */}
      <div ref={behaelter} className="w-full h-full" data-karte />
      <canvas ref={massstabRef} aria-label="Maßstab" className="absolute left-1.5 bottom-1.5 pointer-events-none" style={{ width: 240, height: 44 }} />
      {bereit && karte.current && partikel && <PartikelFluss karte={karte.current} ebenen={partikel.ebenen} monat={partikel.monat} projektion={projektion} />}
      {menue && <div className="absolute left-2 top-2 z-10">{menue}</div>}
    </div>
      {/* Quellenangaben unter der Karte (Namensnennung nach Lizenz) */}
      <p className="text-[11px] leading-snug text-[var(--text-muted)] px-1" aria-label="Quellen">
        Quellen: {quellen.map((q, i) => (
          <span key={q.name}>{i > 0 && " · "}{q.url
            ? <a href={q.url} target="_blank" rel="noreferrer" className="hover:underline">{q.name}</a> : q.name}
            {q.lizenz && q.lizenz !== "eigene Daten" ? ` (${q.lizenz})` : ""}</span>
        ))}
      </p>
    </div>
  );
}
