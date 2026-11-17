"use client";
/**
 * Die Kartenfläche: MapLibre mit dem Stil aus lib/karten/stil.ts.
 * Klick auf ein Objekt zeigt seinen Namen (wenn Namen an sind).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Map as MapLibreMap, MapGeoJSONFeature, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ebeneVonStilEbene, istKlickbar, istLauflicht, ladeFlagge, zeichneSymbol, type Katalog } from "@/lib/karten/stil";
import { ladeKindBild } from "@/lib/karten/kinderatlas";
import type { Ausschnitt } from "@/lib/karten/satz";
import type { StyleSpecification } from "maplibre-gl";
import PartikelFluss from "./PartikelFluss";
import { massstab, zeichneMassstab } from "@/lib/karten/massstab";
import { abstand, ausschnittVor, ausschnittZurueck, vor, zurueck, type Projektion } from "@/lib/karten/projektion";
import { verhaeltnisVon, type Seite } from "@/lib/karten/seite";

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
const START: Ausschnitt = { west: 5.6, sued: 47.2, ost: 15.3, nord: 55.1 };
const BROCKEN: [number, number] = [10.6155, 51.7991];

// Web-Mercator-Höhe einer Breite — so rechnet MapLibre die Bildhöhe (auch für die Schein-Koordinaten der Netze)
const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const breite = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

/**
 * Startansicht: ganz Deutschland, der Brocken genau in der Mitte. Der Ausschnitt
 * wird dafür um den Brocken herum symmetrisch gemacht (in Bildhöhe, nicht in
 * Grad) — dann liegt die Mitte von fitBounds auf dem Brocken.
 */
export function startKamera(projektion: Projektion) {
  const z = ausschnittVor(START, projektion);
  const [x, lat] = vor(BROCKEN, projektion);
  const y = merc(lat);
  const halbB = Math.max(x - z.west, z.ost - x);
  const halbH = Math.max(y - merc(z.sued), merc(z.nord) - y);
  return {
    mitte: [x, lat] as [number, number],
    rahmen: [[x - halbB, breite(y - halbH)], [x + halbB, breite(y + halbH)]] as [[number, number], [number, number]],
  };
}

/** Liefert das Kartenbild als PNG-data-URL, sobald der aktuelle Stil fertig gezeichnet ist. */
export type KartenBild = () => Promise<string>;

export default function KartenAnsicht({ stil, katalog, namenZeigen, onKlick, ziel, onAusschnitt, bildRef, gastToken, fundort, blick, fokus, partikel, projektion = "equalearth", menue, legende, seite, ueberlagerung }: {
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
  /** Hinfliegen und heranzoomen (Quiz: angetipptes Objekt); `n` zählt hoch, damit derselbe Punkt erneut wirkt */
  fokus?: { punkt: [number, number]; n: number } | null;
  /** Unten über der Karte (Quiz: Antwortfeld zum angetippten Objekt) */
  ueberlagerung?: ReactNode;
  /** Partikelfluss über Wind/Strömungen (nur diese Ebenen, im gewählten Monat) */
  partikel?: { ebenen: string[]; monat: string } | null;
  /** Kartennetz des Stils — für alles, was hier in echten Koordinaten ankommt */
  projektion?: Projektion;
  /** Bedienelemente oben links auf der Karte (☰-Menü) */
  menue?: ReactNode;
  /** Legende: Knopf oben links, klappt als Seitenleiste über der Karte auf (leer/null = kein Knopf) */
  legende?: ReactNode;
  /** A4-Seitenverhältnis der Kartenfläche (lib/karten/seite.ts) */
  seite?: Seite;
}) {
  const behaelter = useRef<HTMLDivElement>(null);
  const karte = useRef<MapLibreMap | null>(null);
  const popup = useRef<Popup | null>(null);
  const [bereit, setBereit] = useState(false);
  const [legendeAuf, setLegendeAuf] = useState(true);
  const [legendeRechts, setLegendeRechts] = useState(false);
  const verhaeltnis = verhaeltnisVon(seite);
  // Die Ereignis-Handler hängen einmal an der Karte; die aktuellen Props liest der Handler über Refs
  const aktuell = useRef({ namenZeigen, onKlick, onAusschnitt, gastToken, katalog, projektion });
  aktuell.current = { namenZeigen, onKlick, onAusschnitt, gastToken, katalog, projektion };
  // Angeklickte Strömung bzw. Windgürtel bleibt hervorgehoben (feature-state »aktiv«)
  const hervor = useRef<{ source: string; id: string } | null>(null);
  const ersterStil = useRef(stil);
  const druckbar = useRef(bildRef);
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
        // Start: ganz Deutschland, der Brocken (Harz) in der Mitte — gleich unten nach dem Anlegen
        center: vor(BROCKEN, aktuell.current.projektion), zoom: 5,
        // Kein maxBounds über die ganze Welt: MapLibre stürzt dann beim Start ab (_calcMatrices)
        renderWorldCopies: false,
        minZoom: 0.5,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        // Für den PDF-Druck muss das Bild nach dem Zeichnen lesbar bleiben — kostet bei jedem Bild,
        // darum nur, wo gedruckt wird
        canvasContextAttributes: { preserveDrawingBuffer: Boolean(druckbar.current) },
        transformRequest: (url) => {
          const token = aktuell.current.gastToken;
          return token && url.includes("/api/") ? { url, headers: { Authorization: `Bearer ${token}` } } : { url };
        },
      });
      // ohne gewählte Region gleich auf Deutschland um den Brocken — sonst passt `ziel` gleich ein
      if (!ziel) m.fitBounds(startKamera(aktuell.current.projektion).rahmen, { duration: 0 });
      m.touchZoomRotate.disableRotation();
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      // Symbole erst bei Bedarf zeichnen — seit MapLibre 6 nur noch über den Resolver
      // (ein »styleimagemissing«-Listener kann das Bild nicht mehr nachliefern)
      m.setMissingStyleImageResolver(async (id) => {
        // Kinderatlas-Illustrationen und Flaggen kommen als Datei (lädt asynchron)
        if (id.startsWith("kindbild:") || id.startsWith("flagge:")) {
          const bild = await (id.startsWith("flagge:") ? ladeFlagge(id) : ladeKindBild(id));
          if (bild && !m!.hasImage(id)) m!.addImage(id, bild, { pixelRatio: bild.pixelRatio });
          return;
        }
        const bild = zeichneSymbol(id);
        if (bild && !m!.hasImage(id)) m!.addImage(id, bild, { pixelRatio: bild.pixelRatio ?? 1 });
      });
      const klickbar = () => m!.getLayersOrder().filter(istKlickbar);
      // Zeiger über Klickbarem: höchstens einmal je Bild prüfen — die Abfrage über großen Flächen
      // ist teuer und hielt bei jeder Mausbewegung den Hauptthread auf (Klicks kamen verspätet an)
      let zeiger: { x: number; y: number } | null = null;
      m.on("mousemove", (e) => {
        const frei = zeiger === null;
        zeiger = e.point;
        if (!frei) return;
        requestAnimationFrame(() => {
          const p = zeiger;
          zeiger = null;
          if (!p || !karte.current) return;
          const t = m!.queryRenderedFeatures([p.x, p.y], { layers: klickbar() });
          m!.getCanvas().style.cursor = t.length ? "pointer" : "";
        });
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

  // Ausschnitt der Region (oder Deutschland) einpassen: beim Regionswechsel, nach dem Wechsel des
  // Seitenformats und per Knopf »⤢«, wenn man sich verzoomt hat
  const einpassen = (dauer = 0) => {
    const m = karte.current;
    if (!m) return;
    m.resize();
    const z = ziel ? ausschnittVor(ziel, projektion) : null;
    // Globus: Weltausschnitte passen nicht als Rechteck auf die Kugel — die Kugel füllt dann die Höhe
    if (projektion === "globus" && z && z.ost - z.west > 90) {
      const radius = 0.45 * m.getContainer().clientHeight;
      m.easeTo({ center: [(z.west + z.ost) / 2, Math.max(-50, Math.min(50, (z.sued + z.nord) / 2))],
        zoom: Math.log2((radius * 2 * Math.PI) / 512), duration: dauer });
      return;
    }
    m.fitBounds(z ? [[z.west, z.sued], [z.ost, z.nord]] : startKamera(projektion).rahmen, { duration: dauer });
  };
  useEffect(() => {
    if (bereit && ziel) einpassen();
  }, [ziel, bereit, projektion]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (bereit) einpassen();
  }, [seite]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = karte.current;
    if (!bereit || !m || !blick) return;
    // Nur schwenken, wenn der Punkt nicht schon gut zu sehen ist (Rand: 10 % je Seite)
    const ort = vor(blick, projektion);
    const p = m.project(ort), { width, height } = m.getCanvas().getBoundingClientRect();
    if (p.x < width * 0.1 || p.x > width * 0.9 || p.y < height * 0.1 || p.y > height * 0.9) m.easeTo({ center: ort, duration: 600 });
  }, [blick, bereit, projektion]);

  useEffect(() => {
    const m = karte.current;
    if (!bereit || !m || !fokus) return;
    // Mindestens anderthalb Stufen näher als der ganze Ausschnitt — weiter hineingezoomt bleibt es dabei
    const z = ziel ? ausschnittVor(ziel, projektion) : null;
    const basis = (z && m.cameraForBounds([[z.west, z.sued], [z.ost, z.nord]])?.zoom) ?? m.getZoom();
    m.flyTo({ center: vor(fokus.punkt, projektion), zoom: Math.min(m.getMaxZoom(), Math.max(m.getZoom(), basis + 1.5)), duration: 700 });
  }, [fokus, bereit]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="relative rounded-2xl overflow-hidden border border-line mx-auto w-full"
      style={{
        // A4: festes Verhältnis, aber nie höher als das Fenster (dann schmaler)
        ...(verhaeltnis
        ? { aspectRatio: String(verhaeltnis), maxWidth: `calc(85vh * ${verhaeltnis})` }
        : { height: "72vh", minHeight: 420 }),
        // Globus: dunkler Weltraum um die Kugel
        ...(projektion === "globus" && { background: "radial-gradient(circle, #1e293b, #020617)" }) }}>
      {/* Kein absolute/inset: maplibre-gl.css setzt .maplibregl-map auf position: relative */}
      <div ref={behaelter} className="w-full h-full" data-karte />
      <canvas ref={massstabRef} aria-label="Maßstab" className="absolute left-1.5 bottom-1.5 pointer-events-none" style={{ width: 240, height: 44 }} />
      {bereit && karte.current && partikel && <PartikelFluss karte={karte.current} ebenen={partikel.ebenen} monat={partikel.monat} projektion={projektion} />}
      {menue && <div className="absolute left-2 top-2 z-20">{menue}</div>}
      {legende && (
        <button onClick={() => setLegendeAuf((x) => !x)} aria-label="Legende" aria-expanded={legendeAuf} title="Legende ein-/ausblenden"
          className={`absolute ${menue ? "left-[52px]" : "left-2"} top-2 z-20 h-9 px-3 rounded-lg border border-black/20 shadow-sm text-sm font-bold ${
            legendeAuf ? "bg-neutral-800 text-white" : "bg-white/95 text-neutral-800"}`}>🗂️ Legende</button>
      )}
      {legende && legendeAuf && (
        <div className={`absolute top-[52px] bottom-14 ${legendeRechts ? "right-12" : "left-2"} z-10 w-64 max-w-[calc(100%-4rem)] overflow-y-auto
          rounded-xl bg-surface border border-line shadow-lg p-3 flex flex-col gap-3 text-sm`} aria-label="Legende">
          <div className="flex items-center justify-between gap-2">
            <span className="font-black">Legende</span>
            <span className="flex gap-1">
              <button onClick={() => setLegendeRechts((x) => !x)} title={legendeRechts ? "Nach links" : "Nach rechts"}
                aria-label="Legende auf die andere Seite" className="px-1.5 rounded text-muted hover:text-fg">⇄</button>
              <button onClick={() => setLegendeAuf(false)} aria-label="Legende schließen" className="px-1.5 rounded text-muted hover:text-fg">✕</button>
            </span>
          </div>
          {legende}
        </div>
      )}
      {ueberlagerung && <div className="absolute inset-x-2 bottom-14 z-20 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md">{ueberlagerung}</div></div>}
      <button onClick={() => einpassen(400)} title="Ganze Region einpassen" aria-label="Einpassen"
        className="absolute right-2.5 top-[76px] z-10 w-[29px] h-[29px] rounded bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.1)] text-neutral-800 text-base leading-none hover:bg-neutral-100">⤢</button>
    </div>
      {/* Quellenangaben unter der Karte (Namensnennung nach Lizenz) */}
      <p className="text-[11px] leading-snug text-muted px-1" aria-label="Quellen">
        Quellen: {quellen.map((q, i) => (
          <span key={q.name}>{i > 0 && " · "}{q.url
            ? <a href={q.url} target="_blank" rel="noreferrer" className="hover:underline">{q.name}</a> : q.name}
            {q.lizenz && q.lizenz !== "eigene Daten" ? ` (${q.lizenz})` : ""}</span>
        ))}
      </p>
    </div>
  );
}
