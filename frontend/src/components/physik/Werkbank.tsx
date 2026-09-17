"use client";
/**
 * Die Werkbank: die Leinwand, auf der der Aufbau steht.
 *
 * Sie zeichnet und sie lässt anfassen — gerechnet wird hier nichts. Geräte
 * werden gezogen (und rasten im 5-cm-Raster ein), Ports werden durch Antippen
 * verbunden. Zusammenpassen muss es trotzdem; die Prüfung dafür steht in
 * `szene.ts`, nicht hier.
 *
 * Meter treffen ausschließlich in `zumBild`/`zurWelt` auf Pixel.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { geraetTyp } from "@/lib/physik/katalog";
import { istSchwinger } from "@/lib/physik/mechanik";
import { andockStelle, aufgeloest, aushaengen, bewege, haengtIrgendwo, portOrt, stelleEin, verbinde, wirtKette, zumBild, zurWelt } from "@/lib/physik/szene";
import type { LaborZustand } from "@/lib/physik/rechenwerke";
import type { Marker } from "@/lib/physik/phaenomene";
import type { Blick, PortArt, PortZeiger, Punkt, Szene } from "@/lib/physik/typen";
import { EIGENER_HAKEN, koerperOrt, koerperRadius, startWertAus, umriss } from "@/lib/physik/geometrie";
import { feststoff } from "@/lib/physik/material";
import { START_WERT, ZEICHNER } from "./zeichner";

/** Die Farben der Anschlussarten — dieselben wie in der Legende der Palette. */
export const PORT_FARBE: Record<PortArt, string> = {
  mechanik: "#38bdf8",
  strom: "#f59e0b",
  licht: "#fbbf24",
  welle: "#a78bfa",
  waerme: "#ef4444",
  achse: "#94a3b8",
};

/**
 * Geräte werden frei gesetzt, nicht gerastert.
 *
 * Das 5-cm-Raster half beim Ordnen, stand aber im Weg, sobald es auf
 * Zentimeter ankam — etwa den Stapel genau unter die Bahn des Pendels zu
 * stellen. Wer ordnen will, kann immer noch von Hand ausrichten.
 */
const einrasten = (x: number) => x;

/**
 * Anschlusspunkte sind klein und blass.
 *
 * Früher waren sie so groß, dass man beim Greifen eines Geräts fast immer
 * einen Anschluss erwischte und versehentlich eine Verbindung anfing. Die
 * übliche Geste ist das Ziehen; Anschlüsse antippen bleibt möglich, tritt aber
 * in den Hintergrund und wird erst deutlich, wenn es darauf ankommt.
 */
const PORT_RADIUS = 4;
const PORT_TREFFER = 7;

export default function Werkbank({ szene, setSzene, ausgewaehlt, setAusgewaehlt, schwebt, setSchwebt, setzeKoerper, marker, onMarkerKlick, markerWerkzeug, onMarkerSetzen, schwebenderMarker, setSchwebenderMarker, auswahl, setAuswahl, onVerbinden, onTrennen, zustand, beobachte }: {
  szene: Szene;
  setSzene: (s: Szene) => void;
  ausgewaehlt: string | null;
  setAusgewaehlt: (id: string | null) => void;
  /** Das Gerät unter dem Zeiger — Entf räumt es weg, ohne es erst anzuklicken. */
  schwebt: string | null;
  setSchwebt: (id: string | null) => void;
  /** Setzt einen freien Körper an die Hand — sonst zöge man nur die Zeichnung. */
  setzeKoerper: (id: string, pos: Punkt) => void;
  /** Alle festgehaltenen Ereignisse. Sie bleiben stehen, bis man sie wegräumt. */
  marker: Marker[];
  onMarkerKlick: (id: string) => void;
  /** Während das Werkzeug an ist, setzt ein Tipp einen eigenen Marker. */
  markerWerkzeug: boolean;
  onMarkerSetzen: (geraet: string | null, ort: Punkt) => void;
  /** Der Marker unter dem Zeiger — Entf räumt ihn weg, wie bei Geräten auch. */
  schwebenderMarker: string | null;
  setSchwebenderMarker: (id: string | null) => void;
  /** Mit Umschalt markierte Geräte — für Verbinden und Trennen in einem Rutsch. */
  auswahl: string[];
  setAuswahl: (ids: string[]) => void;
  onVerbinden: (ids: string[]) => void;
  onTrennen: (ids: string[]) => void;
  /** Der laufende Rechenzustand — daraus kommt die Stellung der Pendel. */
  zustand: { readonly current: LaborZustand };
  beobachte: (fn: () => void) => () => void;
}) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const huelle = useRef<HTMLDivElement>(null);
  const [blick, setBlick] = useState<Blick>({ mitte: { x: 0, y: 0.5 }, skala: 220, breite: 800, hoehe: 520 });
  const [offen, setOffen] = useState<PortZeiger | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  // Wohin das gezogene Gerät fiele, wenn man jetzt loslässt.
  const [andock, setAndock] = useState<PortZeiger | null>(null);
  // Wo das Rechtsklick-Menü steht, in Bildkoordinaten.
  const [menue, setMenue] = useState<Punkt | null>(null);
  const zieht = useRef<
    | { art: "geraet"; id: string; griff: Punkt }
    | { art: "koerper"; id: string }
    | { art: "blick"; start: Punkt; mitte: Punkt }
    | null
  >(null);

  // Die Leinwand füllt ihren Kasten — auch nach dem Drehen des Tablets.
  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    const messen = () => {
      const r = el.getBoundingClientRect();
      setBlick(b => ({ ...b, breite: Math.round(r.width), hoehe: Math.round(r.height) }));
    };
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  useEffect(() => {
    if (!fehler) return;
    const t = window.setTimeout(() => setFehler(null), 2600);
    return () => window.clearTimeout(t);
  }, [fehler]);

  /**
   * Die Szene, wie sie wirklich dasteht: eingehängte Geräte an ihrem Haken,
   * stehende auf dem Boden. Alles, was zeichnet oder trifft, benutzt diese —
   * sonst liegt ein Massestück da, wo man es fallen ließ, und bekommt nur eine
   * Linie zum Haken gemalt.
   */
  const sicht = useCallback(
    () => aufgeloest(szene, zustand.current.mechanik, zustand.current.welt),
    [szene, zustand]);

  const bildPunkt = (e: React.PointerEvent): Punkt => {
    const r = leinwand.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** Der Port unter dem Finger, wenn einer da ist. */
  const portUnter = useCallback((p: Punkt): PortZeiger | null => {
    for (const g of [...sicht().geraete].reverse()) {
      for (const port of geraetTyp(g.typ)?.ports ?? []) {
        if (port.verborgen) continue;
        const ort = portOrt(g, port.id, zustand.current.mechanik[g.id]);
        if (!ort) continue;
        const b = zumBild(ort, blick);
        if (Math.hypot(b.x - p.x, b.y - p.y) <= PORT_TREFFER) return { geraet: g.id, port: port.id };
      }
    }
    return null;
  }, [sicht, blick]);

  /**
   * Der schwingende Körper unter dem Finger.
   *
   * Ihn zu greifen heißt, das Pendel auszulenken: gezogen wird der Startwert,
   * und weil die Mechanik bei geändertem Startwert neu loslässt, hängt der
   * Körper währenddessen still am Zeiger und schwingt beim Loslassen los —
   * so wie man es im Vorbereitungsraum auch macht.
   */
  const koerperUnter = useCallback((p: Punkt): string | null => {
    for (const g of [...sicht().geraete].reverse()) {
      const ort = koerperOrt(g, zustand.current.mechanik[g.id]);
      if (!ort) continue;
      const b = zumBild(ort, blick);
      const r = Math.max(8, koerperRadius(g.werte.masse ?? 0.2) * blick.skala);
      if (Math.hypot(b.x - p.x, b.y - p.y) <= r + 4) return g.id;
    }
    return null;
  }, [sicht, blick, zustand]);

  /** Zieht den Körper eines Pendels an einen Weltpunkt. */
  const lenkeAus = useCallback((id: string, welt: Punkt) => {
    const g = sicht().geraete.find(x => x.id === id);
    if (!g) return;
    const schluessel = START_WERT[g.typ];
    const roh = startWertAus(g, welt);
    if (!schluessel || roh === null) return;
    const def = geraetTyp(g.typ)?.parameter.find(p => p.schluessel === schluessel);
    const wert = def ? Math.min(def.max, Math.max(def.min, roh)) : roh;
    setSzene(stelleEin(szene, id, { [schluessel]: wert }));
  }, [szene, setSzene, sicht]);

  /** Das Gerät unter dem Finger — das oberste zuerst. */
  const geraetUnter = useCallback((p: Punkt): string | null => {
    const welt = zurWelt(p, blick);
    for (const g of [...sicht().geraete].reverse()) {
      const t = geraetTyp(g.typ);
      if (!t) continue;
      const u = umriss(g, t.groesse);
      const dx = Math.abs(welt.x - u.mitte.x), dy = Math.abs(welt.y - u.mitte.y);
      if (dx <= u.b / 2 && dy <= u.h / 2) return g.id;
    }
    return null;
  }, [sicht, blick]);

  /** Der Marker unter dem Finger — die Kreise liegen über allem. */
  const markerUnter = useCallback((p: Punkt): string | null => {
    for (const m of [...marker].reverse()) {
      const b = zumBild(m.ort, blick);
      if (Math.hypot(b.x - p.x, b.y - p.y) <= 14) return m.id;
    }
    return null;
  }, [marker, blick]);

  function beiDruck(e: React.PointerEvent) {
    const p = bildPunkt(e);
    setMenue(null);

    // Umschalt sammelt ein, statt zu ziehen: so stellt man sich zusammen, was
    // gleich verbunden oder getrennt werden soll.
    if (e.shiftKey) {
      const treffer = koerperUnter(p) ?? geraetUnter(p);
      if (treffer) {
        setAuswahl(auswahl.includes(treffer) ? auswahl.filter(x => x !== treffer) : [...auswahl, treffer]);
      } else {
        setAuswahl([]);
      }
      return;
    }

    leinwand.current?.setPointerCapture(e.pointerId);

    // Das Werkzeug hat Vorrang: hier soll ausdrücklich ein Marker hin.
    if (markerWerkzeug) {
      onMarkerSetzen(geraetUnter(p) ?? koerperUnter(p), zurWelt(p, blick));
      return;
    }

    const getroffen = markerUnter(p);
    if (getroffen) { onMarkerKlick(getroffen); return; }

    const port = portUnter(p);
    if (port) {
      if (!offen) { setOffen(port); return; }
      try {
        setSzene(verbinde(szene, offen, port));
        setOffen(null);
      } catch (err) {
        setFehler(err instanceof Error ? err.message : "Das passt nicht zusammen.");
        setOffen(null);
      }
      return;
    }
    setOffen(null);

    const koerper = koerperUnter(p);
    if (koerper) {
      setAusgewaehlt(koerper);
      zieht.current = { art: "koerper", id: koerper };
      lenkeAus(koerper, zurWelt(p, blick));
      return;
    }

    const id = geraetUnter(p);
    if (id) {
      setAusgewaehlt(id);
      const g = sicht().geraete.find(x => x.id === id)!;
      const welt = zurWelt(p, blick);

      // Hängt es an einem Schwinger, meint das Anfassen den Schwinger: man
      // zieht nicht das Gewicht vom Haken, man lenkt das ganze Pendel aus.
      const schwinger = wirtKette(szene, id).find(w => istSchwinger(w.typ));
      if (schwinger) {
        setAusgewaehlt(schwinger.id);
        zieht.current = { art: "koerper", id: schwinger.id };
        lenkeAus(schwinger.id, welt);
        return;
      }

      // Sonst: wer an etwas hängt, wird durch Ziehen abgenommen — und bleibt
      // dabei stehen, wo er hing, statt zurückzuspringen.
      if (haengtIrgendwo(szene, g)) setSzene(bewege(aushaengen(szene, id), id, g.pos));
      zieht.current = { art: "geraet", id, griff: { x: welt.x - g.pos.x, y: welt.y - g.pos.y } };
      return;
    }
    setAusgewaehlt(null);
    zieht.current = { art: "blick", start: p, mitte: blick.mitte };
  }

  function beiBewegung(e: React.PointerEvent) {
    const z = zieht.current;
    const p = bildPunkt(e);

    if (!z) {
      // Nichts in der Hand: nur merken, worüber der Zeiger steht. Marker
      // liegen über allem, also haben sie Vorrang.
      const ueberMarker = markerUnter(p);
      setSchwebenderMarker(ueberMarker);
      setSchwebt(ueberMarker ? null : (koerperUnter(p) ?? geraetUnter(p)));
      return;
    }

    if (z.art === "koerper") {
      lenkeAus(z.id, zurWelt(p, blick));
      return;
    }
    if (z.art === "geraet") {
      const welt = zurWelt(p, blick);
      const ziel = { x: einrasten(welt.x - z.griff.x), y: einrasten(welt.y - z.griff.y) };
      setSzene(bewege(szene, z.id, ziel));
      setAndock(andockStelle(szene, z.id, ziel, zustand.current.mechanik));
      // Der Körper in der Welt muss mit, sonst zieht man nur das Bild und das
      // Gewicht springt beim Loslassen an seinen alten Platz zurück.
      setzeKoerper(z.id, ziel);
    } else {
      setBlick(b => ({
        ...b,
        mitte: {
          x: z.mitte.x - (p.x - z.start.x) / b.skala,
          y: z.mitte.y + (p.y - z.start.y) / b.skala,
        },
      }));
    }
  }

  /**
   * Loslassen. Hängt das Gerät an, wenn es über einem Haken schwebt.
   *
   * Das ist die Geste, die man erwartet: Gewicht auf den Haken ziehen,
   * loslassen, es hängt. Der Haken darunter bleibt frei, sodass das nächste
   * Gewicht daruntergehängt werden kann.
   */
  const beiLoslassen = () => {
    const z = zieht.current;
    zieht.current = null;
    if (z?.art === "geraet" && andock) {
      const g = szene.geraete.find(x => x.id === z.id);
      const eigener = g ? EIGENER_HAKEN[g.typ] : undefined;
      if (eigener) {
        try {
          setSzene(verbinde(szene, andock, { geraet: z.id, port: eigener }));
        } catch (err) {
          setFehler(err instanceof Error ? err.message : "Das passt nicht zusammen.");
        }
      }
    }
    setAndock(null);
  };
  const beiVerlassen = () => { zieht.current = null; setAndock(null); setSchwebt(null); setSchwebenderMarker(null); };

  /**
   * Rechtsklick öffnet das Menü.
   *
   * Steht der Zeiger auf einem Gerät, das nicht markiert ist, ersetzt es die
   * Markierung — sonst gilt, was man vorher mit Umschalt zusammengestellt hat.
   */
  function beiMenue(e: React.MouseEvent) {
    e.preventDefault();
    const r = leinwand.current!.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    const treffer = koerperUnter(p) ?? geraetUnter(p);
    if (treffer && !auswahl.includes(treffer)) setAuswahl([treffer]);
    else if (!treffer && !auswahl.length) return;
    setMenue(p);
  }

  function beiRad(e: React.WheelEvent) {
    setBlick(b => ({
      ...b,
      skala: Math.min(1400, Math.max(40, b.skala * (e.deltaY < 0 ? 1.12 : 1 / 1.12))),
    }));
  }

  // ── Zeichnen ────────────────────────────────────────────────────────────────
  const zeichne = useCallback(() => {
    const c = leinwand.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    // Nur bei echter Aenderung zuweisen: jede Zuweisung an width/height wirft
    // den Zeichenpuffer weg und legt ihn neu an — bei 60 Bildern je Sekunde
    // merkt man das auf einem Klassensatz-Tablet.
    const breite = Math.max(1, blick.breite * dpr);
    const hoehe = Math.max(1, blick.hoehe * dpr);
    if (c.width !== breite) c.width = breite;
    if (c.height !== hoehe) c.height = hoehe;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, blick.breite, blick.hoehe);

    zeichneRaster(ctx, blick);

    const gezeigt = sicht();

    // Verbindungen zuerst — sie liegen hinter den Geräten.
    ctx.lineWidth = 2.5;
    for (const v of gezeigt.verbindungen) {
      const a = gezeigt.geraete.find(g => g.id === v.von.geraet);
      const b = gezeigt.geraete.find(g => g.id === v.nach.geraet);
      if (!a || !b) continue;
      const pa = portOrt(a, v.von.port, zustand.current.mechanik[a.id]);
      const pb = portOrt(b, v.nach.port, zustand.current.mechanik[b.id]);
      if (!pa || !pb) continue;
      const art = geraetTyp(a.typ)?.ports.find(p => p.id === v.von.port)?.art ?? "mechanik";
      const ba = zumBild(pa, blick), bb = zumBild(pb, blick);
      ctx.strokeStyle = PORT_FARBE[art];
      ctx.beginPath();
      ctx.moveTo(ba.x, ba.y);
      ctx.lineTo(bb.x, bb.y);
      ctx.stroke();
    }

    for (const g of gezeigt.geraete) {
      const t = geraetTyp(g.typ);
      if (!t) continue;
      const u = umriss(g, t.groesse);
      const mitte = zumBild(u.mitte, blick);
      const b = u.b * blick.skala, h = u.h * blick.skala;
      const gewaehlt = g.id === ausgewaehlt;
      const unterZeiger = g.id === schwebt;
      const markiert = auswahl.includes(g.id);

      // Pendel und Verwandte bringen ihre eigene Zeichnung mit — ein Kasten
      // sagt ueber eine Schwingung nichts aus.
      const eigen = ZEICHNER[g.typ];
      if (eigen) {
        eigen(ctx, g, zustand.current, blick);
        if (gewaehlt || unterZeiger) {
          ctx.strokeStyle = unterZeiger ? "rgba(248,250,252,0.85)" : "#38bdf8";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(mitte.x, mitte.y, Math.max(10, Math.max(b, h) * 0.7), 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {

      ctx.save();
      ctx.translate(mitte.x, mitte.y);
      // Minus, weil der Bildschirm y nach unten zählt und die Welt nach oben.
      ctx.rotate(-g.winkel);
      // Bauteile tragen die Farbe ihres Werkstoffs — man soll Holz von Stahl
      // unterscheiden, ohne erst die Einstellungen aufzuklappen.
      const stoff = ("stoff" in g.werte) ? feststoff(g.werte.stoff) : null;
      ctx.fillStyle = gewaehlt ? "rgba(56,189,248,0.18)"
        : stoff ? stoff.farbe + "cc" : "rgba(148,163,184,0.12)";
      ctx.strokeStyle = gewaehlt ? "#38bdf8" : unterZeiger ? "rgba(248,250,252,0.8)" : "rgba(148,163,184,0.5)";
      ctx.lineWidth = gewaehlt || unterZeiger ? 2.5 : 1.5;
      if (g.typ === "kugel") {
        ctx.beginPath();
        ctx.arc(0, 0, b / 2, 0, Math.PI * 2);
      } else {
        kasten(ctx, -b / 2, -h / 2, b, h, Math.max(2, Math.min(10, b / 3, h / 3)));
      }
      ctx.fill();
      ctx.stroke();
      if (!stoff) {
        ctx.font = `${Math.max(12, Math.min(34, Math.min(b, h) * 0.6))}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(t.icon, 0, 0);
      }
      ctx.restore();
      }

      if (markiert) {
        // Markiert: ein gestrichelter Kasten um das ganze Gerät.
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "#4ade80";
        ctx.lineWidth = 2;
        ctx.strokeRect(mitte.x - b / 2 - 5, mitte.y - h / 2 - 5, b + 10, h + 10);
        ctx.restore();
      }

      ctx.fillStyle = "rgba(226,232,240,0.85)";
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(t.name, mitte.x, mitte.y + h / 2 + 5);

      for (const port of t.ports) {
        const ort = portOrt(g, port.id, zustand.current.mechanik[g.id]);
        if (!ort) continue;
        const bp = zumBild(ort, blick);
        const istOffen = offen?.geraet === g.id && offen.port === port.id;
        const istZiel = andock?.geraet === g.id && andock.port === port.id;

        if (istZiel) {
          // Hier fiele es hin: ein deutlicher Ring, damit man vor dem Loslassen
          // weiss, woran es haengen wird.
          ctx.beginPath();
          ctx.arc(bp.x, bp.y, 13, 0, Math.PI * 2);
          ctx.strokeStyle = "#4ade80";
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Verborgene Anschlüsse bleiben unsichtbar — nur als Ziel beim Ziehen
        // leuchten sie kurz auf.
        if (port.verborgen && !istZiel) continue;

        ctx.beginPath();
        ctx.arc(bp.x, bp.y, istOffen || istZiel ? PORT_RADIUS + 3 : PORT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = PORT_FARBE[port.art];
        ctx.globalAlpha = istOffen || istZiel ? 1 : 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = istOffen || istZiel ? 2 : 1;
        ctx.strokeStyle = istOffen ? "#f8fafc" : "rgba(2,6,23,0.65)";
        ctx.stroke();
      }
    }
    // Zuletzt die Marker — sie gehören über den Aufbau, nicht darunter.
    for (const m of marker) {
      const b = zumBild(m.ort, blick);
      const drunter = m.id === schwebenderMarker;
      ctx.beginPath();
      ctx.arc(b.x, b.y, drunter ? 16 : 13, 0, Math.PI * 2);
      ctx.fillStyle = m.art === "stoss" ? "rgba(248,113,113,0.22)" : "rgba(56,189,248,0.22)";
      ctx.fill();
      ctx.strokeStyle = drunter ? "#f8fafc" : m.art === "stoss" ? "#f87171" : "#38bdf8";
      ctx.lineWidth = drunter ? 3 : 2;
      ctx.stroke();
      ctx.font = "14px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(m.art === "stoss" ? "💥" : "🔎", b.x, b.y);
    }
  }, [sicht, szene, blick, ausgewaehlt, schwebt, offen, andock, zustand, marker, schwebenderMarker, auswahl]);

  // Jedes Bild neu zeichnen, angestossen von der Uhr statt von React — sonst
  // haengt das Pendel bewegungslos an seinem Faden.
  useEffect(() => {
    zeichne();
    return beobachte(zeichne);
  }, [beobachte, zeichne]);

  return (
    <div ref={huelle} className="relative h-full w-full touch-none">
      <canvas
        ref={leinwand}
        aria-label="Werkbank"
        style={{ width: blick.breite, height: blick.hoehe, display: "block", cursor: schwebt ? "grab" : schwebenderMarker ? "pointer" : "default" }}
        onPointerDown={beiDruck}
        onPointerMove={beiBewegung}
        onPointerUp={beiLoslassen}
        onPointerCancel={beiVerlassen}
        onPointerLeave={beiVerlassen}
        onContextMenu={beiMenue}
        onWheel={beiRad}
      />
      {menue && (
        <div
          role="menu"
          aria-label="Auswahl"
          className="absolute z-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1 text-sm"
          style={{ left: Math.min(menue.x, blick.breite - 190), top: Math.min(menue.y, blick.hoehe - 110) }}
        >
          <div className="px-3 py-1 text-xs text-[var(--text-muted)] border-b border-[var(--border)] mb-1">
            {auswahl.length === 1 ? "1 Gerät" : `${auswahl.length} Geräte`} markiert
          </div>
          <button
            role="menuitem"
            disabled={auswahl.length < 2}
            onClick={() => { onVerbinden(auswahl); setMenue(null); }}
            className="block w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] disabled:opacity-40"
          >🔗 Verbinden</button>
          <button
            role="menuitem"
            onClick={() => { onTrennen(auswahl); setMenue(null); }}
            className="block w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)]"
          >✂️ Trennen</button>
          <button
            role="menuitem"
            onClick={() => { setAuswahl([]); setMenue(null); }}
            className="block w-full text-left px-3 py-1.5 hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
          >Markierung aufheben</button>
        </div>
      )}

      {offen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-3 rounded-full bg-slate-900/90 border border-white/15 px-4 py-2 text-xs text-slate-200"
          role="status"
        >
          Anschluss gewählt — jetzt den Gegenpart antippen.
        </div>
      )}
      {fehler && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-3 rounded-xl bg-rose-950/90 border border-rose-400/50 px-4 py-2 text-xs font-bold text-rose-100"
          role="alert"
        >
          {fehler}
        </div>
      )}
      {szene.geraete.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-[var(--text-muted)] text-center max-w-xs">
            Der Tisch ist leer. Nimm dir links ein Gerät aus dem Schrank.
          </p>
        </div>
      )}
    </div>
  );
}

function kasten(ctx: CanvasRenderingContext2D, x: number, y: number, b: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + b, y, x + b, y + h, r);
  ctx.arcTo(x + b, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + b, y, r);
  ctx.closePath();
}

/** Ein Raster, das beim Zoomen die Stufe wechselt — cm bis Meter. */
function zeichneRaster(ctx: CanvasRenderingContext2D, blick: Blick) {
  const stufen = [0.01, 0.05, 0.1, 0.5, 1, 5];
  const schritt = stufen.find(s => s * blick.skala >= 28) ?? 10;
  const linksOben = zurWelt({ x: 0, y: 0 }, blick);
  const rechtsUnten = zurWelt({ x: blick.breite, y: blick.hoehe }, blick);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(148,163,184,0.13)";
  ctx.beginPath();
  for (let x = Math.ceil(linksOben.x / schritt) * schritt; x <= rechtsUnten.x; x += schritt) {
    const b = zumBild({ x, y: 0 }, blick).x;
    ctx.moveTo(b, 0); ctx.lineTo(b, blick.hoehe);
  }
  for (let y = Math.ceil(rechtsUnten.y / schritt) * schritt; y <= linksOben.y; y += schritt) {
    const b = zumBild({ x: 0, y }, blick).y;
    ctx.moveTo(0, b); ctx.lineTo(blick.breite, b);
  }
  ctx.stroke();

  // Der Boden: y = 0. Darauf steht später alles, was fällt.
  const boden = zumBild({ x: 0, y: 0 }, blick).y;
  if (boden > -20 && boden < blick.hoehe + 20) {
    ctx.strokeStyle = "rgba(148,163,184,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, boden); ctx.lineTo(blick.breite, boden);
    ctx.stroke();
  }
}
