"use client";
/**
 * Die Zeichenfläche: zeichnet die Schaltung, lässt die Simulation laufen und
 * nimmt Maus und Finger entgegen.
 *
 * Die Simulation rechnet hier im Takt der Bildwiederholung — `tempo` Sekunden
 * Simulationszeit je Sekunde echter Zeit, in Schritten, die `schrittweite()`
 * fein genug wählt. Während etwas gezogen wird, zeigt die Fläche eine Vorschau;
 * in die Schaltung (und damit ins Rückgängig) kommt es erst beim Loslassen.
 */
import { useEffect, useRef, type RefObject } from "react";
import { anschluesse, schluessel, type Bauteil, type BauteilArt, type Punkt, type Schaltung } from "@/lib/stromkreis/modell";
import { TEILE } from "@/lib/stromkreis/teile";
import type { Simulation } from "@/lib/stromkreis/simulation";
import { fuegeBauteilHinzu, fuegeDrahtHinzu, treffer, verschiebe, verschiebeEnde, type Auswahl } from "@/lib/stromkreis/editor";
import { hatWechsel, hoechstspannung, schrittweite } from "@/lib/stromkreis/lauf";
import { formatiere } from "@/lib/stromkreis/format";
import {
  potenzialFarbe, strompfade, wertText, zeichneBauteil, zeichneBeschriftung, zeichnePunkte, type Farben,
} from "@/lib/stromkreis/zeichnen";

export const RASTER = 20;

export type Werkzeug = "auswahl" | "draht" | BauteilArt;

export interface Anzeige {
  laufend: boolean;
  /** Sekunden Simulationszeit je echter Sekunde. */
  tempo: number;
  /** Punkte als Elektronen (− → +) statt technischer Stromrichtung. */
  elektronen: boolean;
  /** Leitungen nach ihrem Potenzial einfärben. */
  farbig: boolean;
}

/** Mittel der Quadrate; beim Trafo auch für die Sekundärseite. */
export interface Effektiv { u: number; i: number; u2: number; i2: number }

export interface Ansicht { x: number; y: number; zoom: number }

export interface OsziPuffer {
  id: string | null;
  punkte: { t: number; u: number; i: number }[];
}

interface Props {
  schaltung: Schaltung;
  sim: RefObject<Simulation | null>;
  auswahl: Auswahl | null;
  setAuswahl: (a: Auswahl | null) => void;
  werkzeug: Werkzeug;
  setWerkzeug: (w: Werkzeug) => void;
  aendern: (s: Schaltung) => void;
  schalten: (id: string) => void;
  anzeige: Anzeige;
  ansicht: RefObject<Ansicht>;
  oszi: RefObject<OsziPuffer>;
  /** Gleitende Mittel der Quadrate von U und I (für Effektivwerte) — Messgeräte und Ausgewähltes. */
  mittel: RefObject<Map<string, Effektiv>>;
  /** Hochzählen passt die Ansicht an die Schaltung an. */
  einpassen: number;
  /** Wird etwa zehnmal je Sekunde gerufen, damit die Anzeigen daneben nachziehen. */
  takt: () => void;
}

type Ziehen =
  | { art: "neu"; werkzeug: BauteilArt | "draht"; von: Punkt; bis: Punkt }
  | { art: "verschieben"; w: Auswahl; von: Punkt; bis: Punkt; bewegt: boolean }
  | { art: "ende"; w: Auswahl; ende: "a" | "b"; bis: Punkt }
  | { art: "schwenken"; sx: number; sy: number; x0: number; y0: number; bewegt: boolean };

/** Messgeräte zeigen bei Wechselstrom den Effektivwert, gemittelt über diese Zeit. */
const MITTEL_TAU = 0.25;

export function farbenAus(el: Element): Farben & { grund: string; raster: string } {
  const cs = getComputedStyle(el);
  const v = (n: string, e: string) => cs.getPropertyValue(n).trim() || e;
  return {
    linie: v("--text", "#f5f5f5"),
    text: v("--text", "#f5f5f5"),
    flaeche: v("--surface", "#2b2b2b"),
    akzent: v("--accent", "#ffeb3b"),
    neutral: v("--text-muted", "#9ca3af"),
    grund: v("--bg", "#1a1a1a"),
    raster: v("--border", "#505050"),
  };
}

export default function Zeichenflaeche(props: Props) {
  const huelle = useRef<HTMLDivElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const aktuell = useRef(props);
  const ziehen = useRef<Ziehen | null>(null);
  const zeiger = useRef<{ x: number; y: number } | null>(null);
  const phasen = useRef(new Map<string, number>());

  useEffect(() => { aktuell.current = props; });

  const zuRaster = (sx: number, sy: number) => {
    const a = aktuell.current.ansicht.current;
    const rr = RASTER * a.zoom;
    return { x: (sx - a.x) / rr, y: (sy - a.y) / rr };
  };
  const gerundet = (p: { x: number; y: number }): Punkt => ({ x: Math.round(p.x), y: Math.round(p.y) });

  // Bildschleife: rechnen, zeichnen, Anzeigen anstoßen
  useEffect(() => {
    let raf = 0, letzte = performance.now(), bild = 0;
    let farben: ReturnType<typeof farbenAus> | null = null;

    const frame = (jetzt: number) => {
      const echt = Math.min(0.05, (jetzt - letzte) / 1000);
      letzte = jetzt;
      const p = aktuell.current;
      const sim = p.sim.current;
      const s = p.schaltung;
      const wechsel = hatWechsel(s);

      if (sim && p.anzeige.laufend && echt > 0) {
        const dauer = echt * p.anzeige.tempo;
        const n = Math.min(4000, Math.max(1, Math.ceil(dauer / schrittweite(s))));
        const dt = dauer / n;
        const ausgewaehlt = p.auswahl?.art === "bauteil" ? p.auswahl.id : null;
        const messer = s.bauteile.filter(t => t.art === "amperemeter" || t.art === "voltmeter" || t.id === ausgewaehlt);
        const mittel = p.mittel.current;
        const osziId = p.oszi.current.id;
        const fenster = wechsel ? 3 / Math.min(...s.bauteile.filter(t => t.art === "wechselquelle").map(t => t.werte.frequenz ?? 50)) : 5 * p.anzeige.tempo;
        const puffer = p.oszi.current.punkte;
        for (let k = 0; k < n; k++) {
          sim.schritt(dt);
          const k = Math.min(1, dt / MITTEL_TAU);
          for (const t of messer) {
            const m = sim.messung(t.id);
            const alt = mittel.get(t.id);
            const u2 = (m.spannung2 ?? 0) ** 2, i2 = (m.strom2 ?? 0) ** 2;
            if (!alt) { mittel.set(t.id, { u: m.spannung ** 2, i: m.strom ** 2, u2, i2 }); continue; }
            alt.u += (m.spannung ** 2 - alt.u) * k;
            alt.i += (m.strom ** 2 - alt.i) * k;
            alt.u2 += (u2 - alt.u2) * k;
            alt.i2 += (i2 - alt.i2) * k;
          }
          if (osziId) {
            const letzter = puffer[puffer.length - 1];
            if (!letzter || sim.zeit - letzter.t >= fenster / 500) {
              const m = sim.messung(osziId);
              puffer.push({ t: sim.zeit, u: m.spannung, i: m.strom });
            }
          }
        }
        if (osziId) {
          const grenze = sim.zeit - fenster;
          let weg = 0;
          while (weg < puffer.length && puffer[weg].t < grenze) weg++;
          if (weg) puffer.splice(0, weg);
        }
        // Punkte weiterschieben
        const geschw = (strom: number) => {
          const b = Math.abs(strom);
          if (b < 1e-6) return 0;
          return Math.sign(strom) * Math.min(400, 140 * Math.sqrt(b / 0.1)) * p.ansicht.current.zoom * (p.anzeige.elektronen ? -1 : 1);
        };
        for (const d of s.draehte) {
          const k = `d:${d.id}`;
          phasen.current.set(k, (phasen.current.get(k) ?? 0) + geschw(sim.drahtStrom(d.id)) * echt);
        }
        for (const t of s.bauteile) {
          strompfade(t, sim.messung(t.id), { ...t.werte }).forEach((pf, j) => {
            const k = `b:${t.id}:${j}`;
            phasen.current.set(k, (phasen.current.get(k) ?? 0) + geschw(pf.strom) * echt);
          });
        }
      }

      const c = leinwand.current;
      if (c) {
        if (!farben || bild % 60 === 0) farben = farbenAus(c);
        zeichne(c, farben, wechsel);
      }
      if (++bild % 6 === 0) p.takt();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Was gerade zu sehen ist: die Schaltung, oder die Vorschau beim Ziehen. */
  function vorschau(): Schaltung {
    const p = aktuell.current, z = ziehen.current;
    if (z?.art === "verschieben" && z.bewegt) return verschiebe(p.schaltung, z.w, z.bis.x - z.von.x, z.bis.y - z.von.y);
    if (z?.art === "ende") return verschiebeEnde(p.schaltung, z.w, z.ende, z.bis);
    return p.schaltung;
  }

  function zeichne(c: HTMLCanvasElement, f: ReturnType<typeof farbenAus>, wechsel: boolean) {
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = aktuell.current, a = p.ansicht.current;
    const dpr = window.devicePixelRatio || 1;
    const w = c.width / dpr, h = c.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = f.grund;
    ctx.fillRect(0, 0, w, h);

    const rr = RASTER * a.zoom;
    const px = (q: Punkt): [number, number] => [a.x + q.x * rr, a.y + q.y * rr];

    // Raster
    if (rr >= 8) {
      ctx.fillStyle = f.raster;
      const x0 = Math.floor(-a.x / rr), x1 = Math.ceil((w - a.x) / rr);
      const y0 = Math.floor(-a.y / rr), y1 = Math.ceil((h - a.y) / rr);
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
        ctx.fillRect(a.x + gx * rr - 1, a.y + gy * rr - 1, 2, 2);
      }
    }

    const s = vorschau();
    const ziehtGerade = !!ziehen.current && ziehen.current.art !== "schwenken";
    const sim = ziehtGerade ? null : p.sim.current;
    const vmax = hoechstspannung(s);
    const farbe = (q: Punkt) => (sim && p.anzeige.farbig ? potenzialFarbe(sim.potenzial(q), vmax, f.neutral) : f.linie);
    const ausw = p.auswahl;

    // Drähte
    ctx.lineCap = "round";
    for (const d of s.draehte) {
      const [x1, y1] = px(d.a), [x2, y2] = px(d.b);
      if (ausw?.art === "draht" && ausw.id === d.id) {
        ctx.strokeStyle = f.akzent; ctx.globalAlpha = 0.35; ctx.lineWidth = rr * 0.8;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = farbe(d.a); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }

    // Bauteile mit Beschriftung
    for (const t of s.bauteile) {
      const m = sim?.messung(t.id);
      const werte = { ...t.werte };
      zeichneBauteil(ctx, t, px, rr, {
        messung: m, werte: { ...werteMitStandard(t), ...werte },
        pinFarben: anschluesse(t).map(farbe),
        ausgewaehlt: ausw?.art === "bauteil" && ausw.id === t.id,
      }, f);
      let text = wertText(t, werteMitStandard(t), formatiere);
      if ((t.art === "amperemeter" || t.art === "voltmeter") && m) {
        const einheit = t.art === "amperemeter" ? "A" : "V";
        const roh = t.art === "amperemeter" ? m.strom : m.spannung;
        const eff = p.mittel.current.get(t.id);
        const q = eff && (t.art === "amperemeter" ? eff.i : eff.u);
        text = wechsel && q !== undefined ? `${formatiere(Math.sqrt(q), einheit)} ~` : formatiere(roh, einheit);
      }
      if (rr >= 12) zeichneBeschriftung(ctx, t, px, rr, text, f);
    }

    // Strompunkte
    if (sim) {
      const punktFarbe = p.anzeige.elektronen ? "#60a5fa" : "#facc15";
      const abstand = 16 * a.zoom, radius = Math.max(1.5, 2.6 * a.zoom);
      for (const d of s.draehte) {
        if (Math.abs(sim.drahtStrom(d.id)) < 1e-6) continue;
        zeichnePunkte(ctx, px(d.a), px(d.b), phasen.current.get(`d:${d.id}`) ?? 0, abstand, punktFarbe, radius);
      }
      for (const t of s.bauteile) {
        strompfade(t, sim.messung(t.id), werteMitStandard(t)).forEach((pf, j) => {
          if (Math.abs(pf.strom) < 1e-6) return;
          zeichnePunkte(ctx, px(pf.von), px(pf.nach), phasen.current.get(`b:${t.id}:${j}`) ?? 0, abstand, punktFarbe, radius);
        });
      }
    }

    // Knotenpunkte und offene Anschlüsse
    const zaehler = new Map<string, { p: Punkt; n: number; pin: boolean }>();
    const melde = (q: Punkt, pin: boolean) => {
      const k = schluessel(q);
      const e = zaehler.get(k) ?? { p: q, n: 0, pin: false };
      e.n++; e.pin ||= pin;
      zaehler.set(k, e);
    };
    for (const t of s.bauteile) for (const q of anschluesse(t)) melde(q, true);
    for (const d of s.draehte) { melde(d.a, false); melde(d.b, false); }
    for (const { p: q, n, pin } of zaehler.values()) {
      const [x, y] = px(q);
      if (n >= 3) {
        ctx.fillStyle = farbe(q);
        ctx.beginPath(); ctx.arc(x, y, Math.max(3, rr * 0.2), 0, Math.PI * 2); ctx.fill();
      } else if (n === 1 && pin) {
        ctx.strokeStyle = f.neutral; ctx.lineWidth = 1.5; ctx.fillStyle = f.grund;
        ctx.beginPath(); ctx.arc(x, y, Math.max(3, rr * 0.18), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    // Griffe an den Enden des Ausgewählten
    if (ausw) {
      const t = ausw.art === "bauteil" ? s.bauteile.find(x => x.id === ausw.id) : s.draehte.find(x => x.id === ausw.id);
      const mitGriffen = t && !("art" in t && (t.art === "trafo" || t.art === "umschalter"));
      if (t && mitGriffen) {
        ctx.fillStyle = f.akzent;
        for (const q of [t.a, t.b]) {
          const [x, y] = px(q);
          ctx.fillRect(x - 4, y - 4, 8, 8);
        }
      }
    }

    // Vorschau für Neues
    const z = ziehen.current, zg = zeiger.current;
    if (z?.art === "neu") {
      if (z.werkzeug === "draht") {
        const knick = z.von.x !== z.bis.x && z.von.y !== z.bis.y ? { x: z.bis.x, y: z.von.y } : null;
        ctx.strokeStyle = f.akzent; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(...px(z.von));
        if (knick) ctx.lineTo(...px(knick));
        ctx.lineTo(...px(z.bis)); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const neu = fuegeBauteilHinzu({ version: 1, bauteile: [], draehte: [] }, z.werkzeug, z.von, gleichAchse(z.werkzeug, z.von, z.bis));
        ctx.globalAlpha = 0.6;
        zeichneBauteil(ctx, neu.schaltung.bauteile[0], px, rr, { werte: werteMitStandard(neu.schaltung.bauteile[0]) }, f);
        ctx.globalAlpha = 1;
      }
    } else if (zg && p.werkzeug !== "auswahl" && !z) {
      const q = gerundet(zuRaster(zg.x, zg.y));
      const [x, y] = px(q);
      ctx.strokeStyle = f.akzent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      if (p.werkzeug !== "draht") {
        const neu = fuegeBauteilHinzu({ version: 1, bauteile: [], draehte: [] }, p.werkzeug, q);
        ctx.globalAlpha = 0.35;
        zeichneBauteil(ctx, neu.schaltung.bauteile[0], px, rr, { werte: werteMitStandard(neu.schaltung.bauteile[0]) }, f);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Größe an den Rahmen anpassen
  useEffect(() => {
    const el = huelle.current, c = leinwand.current;
    if (!el || !c) return;
    const passe = () => {
      const dpr = window.devicePixelRatio || 1;
      const b = el.clientWidth, h = el.clientHeight;
      c.width = Math.round(b * dpr); c.height = Math.round(h * dpr);
      c.style.width = `${b}px`; c.style.height = `${h}px`;
      if (!angepasst.current) passeAn();
    };
    passe();
    const ro = new ResizeObserver(passe);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ansicht an die Schaltung anpassen — erst, wenn die Fläche eine Größe hat
  const angepasst = useRef(false);
  function passeAn() {
    const el = huelle.current;
    if (!el || !el.clientWidth) return;
    angepasst.current = true;
    const s = aktuell.current.schaltung;
    const punkte = [...s.bauteile.flatMap(anschluesse), ...s.draehte.flatMap(d => [d.a, d.b])];
    const a = aktuell.current.ansicht.current;
    if (!punkte.length) { a.zoom = 1.5; a.x = 40; a.y = 40; return; }
    const xs = punkte.map(q => q.x), ys = punkte.map(q => q.y);
    const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2, y0 = Math.min(...ys) - 3, y1 = Math.max(...ys) + 3;
    const b = el.clientWidth, h = el.clientHeight;
    a.zoom = Math.max(0.3, Math.min(2.5, b / ((x1 - x0) * RASTER), h / ((y1 - y0) * RASTER)));
    const rr = RASTER * a.zoom;
    a.x = (b - (x1 - x0) * rr) / 2 - x0 * rr;
    a.y = (h - (y1 - y0) * rr) / 2 - y0 * rr;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(passeAn, [props.einpassen]);

  // Mausrad zoomt um den Zeiger (passiv geht nicht, sonst scrollt die Seite mit)
  useEffect(() => {
    const c = leinwand.current;
    if (!c) return;
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      const a = aktuell.current.ansicht.current;
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const neu = Math.max(0.3, Math.min(4, a.zoom * Math.exp(-e.deltaY * 0.0015)));
      a.x = sx - ((sx - a.x) * neu) / a.zoom;
      a.y = sy - ((sy - a.y) * neu) / a.zoom;
      a.zoom = neu;
    };
    c.addEventListener("wheel", rad, { passive: false });
    return () => c.removeEventListener("wheel", rad);
  }, []);

  const lage = (e: React.PointerEvent) => {
    const rect = leinwand.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const runter = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = aktuell.current;
    const sp = lage(e);
    const g = zuRaster(sp.x, sp.y);
    const q = gerundet(g);
    if (p.werkzeug !== "auswahl") {
      ziehen.current = { art: "neu", werkzeug: p.werkzeug, von: q, bis: q };
      return;
    }
    const w = treffer(p.schaltung, g, 0.45);
    if (w?.ende) {
      p.setAuswahl({ art: w.art, id: w.id });
      ziehen.current = { art: "ende", w, ende: w.ende, bis: q };
    } else if (w) {
      p.setAuswahl({ art: w.art, id: w.id });
      ziehen.current = { art: "verschieben", w, von: q, bis: q, bewegt: false };
    } else {
      p.setAuswahl(null);
      const a = p.ansicht.current;
      ziehen.current = { art: "schwenken", sx: sp.x, sy: sp.y, x0: a.x, y0: a.y, bewegt: false };
    }
  };

  const bewegen = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sp = lage(e);
    zeiger.current = sp;
    const z = ziehen.current;
    const q = gerundet(zuRaster(sp.x, sp.y));
    if (!z) {
      const p = aktuell.current;
      const w = p.werkzeug === "auswahl" ? treffer(p.schaltung, zuRaster(sp.x, sp.y), 0.45) : null;
      e.currentTarget.style.cursor = p.werkzeug !== "auswahl" ? "crosshair" : w?.ende ? "move" : w ? "pointer" : "grab";
      return;
    }
    if (z.art === "schwenken") {
      const a = aktuell.current.ansicht.current;
      a.x = z.x0 + sp.x - z.sx; a.y = z.y0 + sp.y - z.sy;
      if (Math.hypot(sp.x - z.sx, sp.y - z.sy) > 3) z.bewegt = true;
      e.currentTarget.style.cursor = "grabbing";
    } else if (z.art === "verschieben") {
      z.bis = q;
      if (q.x !== z.von.x || q.y !== z.von.y) z.bewegt = true;
    } else {
      z.bis = q;
    }
  };

  const hoch = () => {
    const z = ziehen.current, p = aktuell.current;
    ziehen.current = null;
    if (!z) return;
    if (z.art === "neu") {
      if (z.werkzeug === "draht") {
        if (z.von.x !== z.bis.x || z.von.y !== z.bis.y) p.aendern(fuegeDrahtHinzu(p.schaltung, z.von, z.bis));
        return;
      }
      const neu = fuegeBauteilHinzu(p.schaltung, z.werkzeug, z.von, gleichAchse(z.werkzeug, z.von, z.bis));
      p.aendern(neu.schaltung);
      p.setAuswahl({ art: "bauteil", id: neu.id });
      p.setWerkzeug("auswahl");
    } else if (z.art === "verschieben") {
      if (z.bewegt) p.aendern(verschiebe(p.schaltung, z.w, z.bis.x - z.von.x, z.bis.y - z.von.y));
      else if (z.w.art === "bauteil") {
        const t = p.schaltung.bauteile.find(x => x.id === z.w.id);
        if (t && (t.art === "schalter" || t.art === "umschalter")) p.schalten(t.id);
      }
    } else if (z.art === "ende") {
      const neu = verschiebeEnde(p.schaltung, z.w, z.ende, z.bis);
      if (neu !== p.schaltung) p.aendern(neu);
    }
  };

  return (
    <div ref={huelle} className="relative w-full h-[min(62vh,620px)] min-h-[360px] rounded-xl overflow-hidden border border-line">
      <canvas
        ref={leinwand}
        className="block touch-none select-none"
        onPointerDown={runter}
        onPointerMove={bewegen}
        onPointerUp={hoch}
        onPointerCancel={() => { ziehen.current = null; }}
        onPointerLeave={() => { zeiger.current = null; }}
        aria-label="Schaltplan"
      />
    </div>
  );
}

function werteMitStandard(t: Bauteil): Record<string, number> {
  return { ...TEILE[t.art].werte, ...t.werte };
}

/** Umschalter und Trafo nur waagerecht oder senkrecht aufziehen. */
function gleichAchse(art: BauteilArt, von: Punkt, bis: Punkt): Punkt | undefined {
  if (von.x === bis.x && von.y === bis.y) return undefined;
  if (art !== "umschalter" && art !== "trafo") return bis;
  return Math.abs(bis.x - von.x) >= Math.abs(bis.y - von.y) ? { x: bis.x, y: von.y } : { x: von.x, y: bis.y };
}
