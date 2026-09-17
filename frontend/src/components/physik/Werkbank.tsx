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
import { bewege, portOrt, stelleEin, verbinde, zumBild, zurWelt } from "@/lib/physik/szene";
import type { LaborZustand } from "@/lib/physik/rechenwerke";
import type { Blick, PortArt, PortZeiger, Punkt, Szene } from "@/lib/physik/typen";
import { koerperOrt, koerperRadius, startWertAus } from "@/lib/physik/geometrie";
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

/** Raster, in dem Geräte einrasten — 5 cm, wie die Lochplatte im Schrank. */
const RASTER = 0.05;
const einrasten = (x: number) => Math.round(x / RASTER) * RASTER;

const PORT_RADIUS = 7;

export default function Werkbank({ szene, setSzene, ausgewaehlt, setAusgewaehlt, schwebt, setSchwebt, zustand, beobachte }: {
  szene: Szene;
  setSzene: (s: Szene) => void;
  ausgewaehlt: string | null;
  setAusgewaehlt: (id: string | null) => void;
  /** Das Gerät unter dem Zeiger — Entf räumt es weg, ohne es erst anzuklicken. */
  schwebt: string | null;
  setSchwebt: (id: string | null) => void;
  /** Der laufende Rechenzustand — daraus kommt die Stellung der Pendel. */
  zustand: { readonly current: LaborZustand };
  beobachte: (fn: () => void) => () => void;
}) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const huelle = useRef<HTMLDivElement>(null);
  const [blick, setBlick] = useState<Blick>({ mitte: { x: 0, y: 0.5 }, skala: 220, breite: 800, hoehe: 520 });
  const [offen, setOffen] = useState<PortZeiger | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
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

  const bildPunkt = (e: React.PointerEvent): Punkt => {
    const r = leinwand.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** Der Port unter dem Finger, wenn einer da ist. */
  const portUnter = useCallback((p: Punkt): PortZeiger | null => {
    for (const g of [...szene.geraete].reverse()) {
      for (const port of geraetTyp(g.typ)?.ports ?? []) {
        const ort = portOrt(g, port.id, zustand.current.mechanik[g.id]);
        if (!ort) continue;
        const b = zumBild(ort, blick);
        if (Math.hypot(b.x - p.x, b.y - p.y) <= PORT_RADIUS + 5) return { geraet: g.id, port: port.id };
      }
    }
    return null;
  }, [szene.geraete, blick]);

  /**
   * Der schwingende Körper unter dem Finger.
   *
   * Ihn zu greifen heißt, das Pendel auszulenken: gezogen wird der Startwert,
   * und weil die Mechanik bei geändertem Startwert neu loslässt, hängt der
   * Körper währenddessen still am Zeiger und schwingt beim Loslassen los —
   * so wie man es im Vorbereitungsraum auch macht.
   */
  const koerperUnter = useCallback((p: Punkt): string | null => {
    for (const g of [...szene.geraete].reverse()) {
      const ort = koerperOrt(g, zustand.current.mechanik[g.id]);
      if (!ort) continue;
      const b = zumBild(ort, blick);
      const r = Math.max(8, koerperRadius(g.werte.masse ?? 0.2) * blick.skala);
      if (Math.hypot(b.x - p.x, b.y - p.y) <= r + 4) return g.id;
    }
    return null;
  }, [szene.geraete, blick, zustand]);

  /** Zieht den Körper eines Pendels an einen Weltpunkt. */
  const lenkeAus = useCallback((id: string, welt: Punkt) => {
    const g = szene.geraete.find(x => x.id === id);
    if (!g) return;
    const schluessel = START_WERT[g.typ];
    const roh = startWertAus(g, welt);
    if (!schluessel || roh === null) return;
    const def = geraetTyp(g.typ)?.parameter.find(p => p.schluessel === schluessel);
    const wert = def ? Math.min(def.max, Math.max(def.min, roh)) : roh;
    setSzene(stelleEin(szene, id, { [schluessel]: wert }));
  }, [szene, setSzene]);

  /** Das Gerät unter dem Finger — das oberste zuerst. */
  const geraetUnter = useCallback((p: Punkt): string | null => {
    const welt = zurWelt(p, blick);
    for (const g of [...szene.geraete].reverse()) {
      const t = geraetTyp(g.typ);
      if (!t) continue;
      const dx = Math.abs(welt.x - g.pos.x), dy = Math.abs(welt.y - g.pos.y);
      if (dx <= t.groesse.b / 2 && dy <= t.groesse.h / 2) return g.id;
    }
    return null;
  }, [szene.geraete, blick]);

  function beiDruck(e: React.PointerEvent) {
    const p = bildPunkt(e);
    leinwand.current?.setPointerCapture(e.pointerId);

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
      const g = szene.geraete.find(x => x.id === id)!;
      const welt = zurWelt(p, blick);
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
      // Nichts in der Hand: nur merken, worüber der Zeiger steht.
      setSchwebt(koerperUnter(p) ?? geraetUnter(p));
      return;
    }

    if (z.art === "koerper") {
      lenkeAus(z.id, zurWelt(p, blick));
      return;
    }
    if (z.art === "geraet") {
      const welt = zurWelt(p, blick);
      setSzene(bewege(szene, z.id, {
        x: einrasten(welt.x - z.griff.x),
        y: einrasten(welt.y - z.griff.y),
      }));
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

  const beiLoslassen = () => { zieht.current = null; };
  const beiVerlassen = () => { zieht.current = null; setSchwebt(null); };

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

    // Verbindungen zuerst — sie liegen hinter den Geräten.
    ctx.lineWidth = 2.5;
    for (const v of szene.verbindungen) {
      const a = szene.geraete.find(g => g.id === v.von.geraet);
      const b = szene.geraete.find(g => g.id === v.nach.geraet);
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

    for (const g of szene.geraete) {
      const t = geraetTyp(g.typ);
      if (!t) continue;
      const mitte = zumBild(g.pos, blick);
      const b = t.groesse.b * blick.skala, h = t.groesse.h * blick.skala;
      const gewaehlt = g.id === ausgewaehlt;
      const unterZeiger = g.id === schwebt;

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
      ctx.fillStyle = gewaehlt ? "rgba(56,189,248,0.18)" : "rgba(148,163,184,0.12)";
      ctx.strokeStyle = gewaehlt ? "#38bdf8" : unterZeiger ? "rgba(248,250,252,0.8)" : "rgba(148,163,184,0.5)";
      ctx.lineWidth = gewaehlt || unterZeiger ? 2.5 : 1.5;
      kasten(ctx, -b / 2, -h / 2, b, h, Math.max(2, Math.min(10, b / 3, h / 3)));
      ctx.fill();
      ctx.stroke();
      ctx.font = `${Math.max(12, Math.min(34, Math.min(b, h) * 0.6))}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.icon, 0, 0);
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
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, istOffen ? PORT_RADIUS + 3 : PORT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = PORT_FARBE[port.art];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = istOffen ? "#f8fafc" : "rgba(2,6,23,0.65)";
        ctx.stroke();
      }
    }
  }, [szene, blick, ausgewaehlt, schwebt, offen, zustand]);

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
        style={{ width: blick.breite, height: blick.hoehe, display: "block", cursor: schwebt ? "grab" : "default" }}
        onPointerDown={beiDruck}
        onPointerMove={beiBewegung}
        onPointerUp={beiLoslassen}
        onPointerCancel={beiVerlassen}
        onPointerLeave={beiVerlassen}
        onWheel={beiRad}
      />
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
