"use client";
/**
 * Pixel-Studio: der Editor. Das Projekt liegt in einem Ref (Zeichnen ändert Zellen an Ort und Stelle),
 * `ver` zählt Änderungen fürs Neuzeichnen und fürs automatische Speichern. Jede Änderung legt vorher
 * eine Kopie auf die Rückgängig-Liste (`merke`).
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent as RWheelEvent } from "react";
import { api, type MausZugang } from "@/lib/api";
import {
  ausDaten, groesse, hexZuRgb, klonen, leereZelle, MAX_BILDER, MAX_EBENEN, MAX_FARBEN, naechsteFarbe, neueId, PALETTEN,
  zuDaten, zusammensetzen, type Ebene, type PixelDaten, type Projekt,
} from "@/lib/pixel/dokument";
import {
  alleZellen, ausschnitt, bildEinfuegen, bildLoeschen, bildVerschieben, ditherAn, drehenProjekt, ebeneVerschmelzen, einsetzen,
  ellipse, farbeEntfernen, farbenTauschen, fuellen, leinwandGroesse, linie, pinsel, quantisieren, rechteck, schatten, setze,
  skalieren, spiegelnH, spiegelnV, spiegelpunkte, umfaerben, umriss, verschieben, type Punkt,
} from "@/lib/pixel/werkzeuge";
import { gif } from "@/lib/pixel/export";
import { BEWEGUNGEN, bewegungEinfuegen, STANDARD_BEWEGUNG, type BewegungsOptionen } from "@/lib/pixel/animation";
import { farbrampe, neuerModifier, type Modifier } from "@/lib/pixel/modifier";
import { bereichSchieben, einbacken, inselnOrdnen, inselnZuBildern, sheetZuBildern } from "@/lib/pixel/befehle";
import { bildCanvas, bildDateiLesen, dateiname, herunterladen, pngVon, rgbaCanvas, sheetPng, vorschauPng } from "./leinwand";
import { meldung, SCHACH } from "./PixelStudio";

type Werkzeug = "stift" | "radierer" | "fuellen" | "linie" | "rechteck" | "ellipse" | "pipette" | "auswahl" | "verschieben";
const WERKZEUGE: { id: Werkzeug; icon: string; label: string; taste: string }[] = [
  { id: "stift", icon: "✏️", label: "Stift", taste: "B" },
  { id: "radierer", icon: "🧽", label: "Radierer", taste: "E" },
  { id: "fuellen", icon: "🪣", label: "Füllen", taste: "G" },
  { id: "linie", icon: "📏", label: "Linie", taste: "L" },
  { id: "rechteck", icon: "⬜", label: "Rechteck", taste: "R" },
  { id: "ellipse", icon: "⭕", label: "Ellipse", taste: "O" },
  { id: "pipette", icon: "💧", label: "Pipette", taste: "I" },
  { id: "auswahl", icon: "⬚", label: "Auswahl", taste: "M" },
  { id: "verschieben", icon: "✋", label: "Verschieben", taste: "V" },
];
const ZOOMS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
/** Rückgängig-Liste: höchstens so viele Pixel insgesamt */
const UNDO_PIXEL = 24_000_000;

interface Rahmen { x: number; y: number; w: number; h: number }
type Zug =
  | { art: "malen"; letzter: Punkt; wert: number; pfad: Punkt[]; alt: Map<number, number> }
  | { art: "form"; start: Punkt; ende: Punkt; wert: number }
  | { art: "auswahl"; start: Punkt }
  | { art: "schieben"; start: Punkt; teil: Uint8Array; r: Rahmen; dx: number; dy: number }
  | { art: "pan"; sx: number; sy: number; ox: number; oy: number };

export default function Editor({ id, name: name0, daten, geteilt: geteilt0, nurLesen, lehrkraft, zugang, zurueck, kopieren }: {
  id: number; name: string; daten: PixelDaten; geteilt: boolean; nurLesen: boolean; lehrkraft: boolean; zugang?: MausZugang;
  zurueck: () => void; kopieren: (name: string, daten: PixelDaten) => Promise<void>;
}) {
  const pRef = useRef<Projekt>(null as unknown as Projekt);
  if (!pRef.current) pRef.current = ausDaten(daten);
  const p = pRef.current;
  const [ver, setVer] = useState(0);
  const neu = useCallback(() => setVer(v => v + 1), []);
  const [ebene, setEbene] = useState(p.ebenen[p.ebenen.length - 1].id);
  const [bild, setBild] = useState(0);
  const [bereich, setBereich] = useState<[number, number]>([0, 0]);
  const [wz, setWz] = useState<Werkzeug>("stift");
  const [farbe, setFarbe] = useState<[number, number]>([Math.min(1, p.palette.length), 0]);
  const [opt, setOpt] = useState({ pixelgenau: true, spiegelX: false, spiegelY: false, dither: false, gefuellt: false, groesse: 1, global: false, raster: true, zwiebel: false, kachel3: false });
  const [ansicht, setAnsicht] = useState({ zoom: 8, ox: 0, oy: 0 });
  const [abspielen, setAbspielen] = useState(false);
  const [name, setName] = useState(name0);
  const [geteilt, setGeteilt] = useState(geteilt0);
  const [status, setStatus] = useState<"gespeichert" | "ungespeichert" | "speichert" | "fehler">("gespeichert");
  const [fehler, setFehler] = useState("");
  const [, setAuswahlVer] = useState(0);
  const undo = useRef<Projekt[]>([]), redo = useRef<Projekt[]>([]);
  const auswahl = useRef<Rahmen | null>(null);
  const ablage = useRef<{ teil: Uint8Array; w: number; h: number } | null>(null);
  const zug = useRef<Zug | null>(null);
  const zeiger = useRef<Punkt | null>(null);
  const leertaste = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null);
  const farbEingabe = useRef<HTMLInputElement>(null), bildEingabe = useRef<HTMLInputElement>(null);
  const farbZiel = useRef<{ wert: number; gemerkt: boolean } | null>(null);

  // aktive Ebene/Bild gültig halten (nach Löschen, Rückgängig …)
  const ebeneOk = p.ebenen.some(e => e.id === ebene) ? ebene : p.ebenen[p.ebenen.length - 1].id;
  const bildOk = Math.min(bild, p.bilder.length - 1);
  const zelle = () => p.zellen[ebeneOk][bildOk];

  /** vor jeder Änderung: Kopie auf die Rückgängig-Liste */
  const merke = useCallback(() => {
    undo.current.push(klonen(pRef.current));
    let summe = undo.current.reduce((a, q) => a + groesse(q), 0);
    while (undo.current.length > 1 && summe > UNDO_PIXEL) summe -= groesse(undo.current.shift()!);
    redo.current = [];
    setStatus("ungespeichert");
  }, []);
  const rueckgaengig = useCallback((vor: boolean) => {
    const von = vor ? redo.current : undo.current, nach = vor ? undo.current : redo.current;
    const q = von.pop();
    if (!q) return;
    nach.push(klonen(pRef.current));
    pRef.current = q;
    setStatus("ungespeichert");
    neu();
  }, [neu]);

  // ---- Speichern (verzögert, nach jeder Änderung)
  useEffect(() => {
    if (nurLesen || status !== "ungespeichert") return;
    const t = setTimeout(async () => {
      setStatus("speichert");
      try {
        await api.pixel.speichern(id, { name: name.trim() || "Ohne Namen", daten: zuDaten(pRef.current), vorschau: vorschauPng(pRef.current) }, zugang);
        setStatus(s => s === "speichert" ? "gespeichert" : s);
        setFehler("");
      } catch (e) { setStatus("fehler"); setFehler(meldung(e)); }
    }, 1200);
    return () => clearTimeout(t);
  }, [ver, name, status, id, nurLesen, zugang]);

  // ---- Ansicht einpassen
  const einpassen = useCallback(() => {
    const b = box.current;
    if (!b) return;
    const q = pRef.current, roh = Math.min(b.clientWidth / q.breite, b.clientHeight / q.hoehe) * 0.88;
    const zoom = [...ZOOMS].reverse().find(z => z <= roh) ?? 1;
    setAnsicht({ zoom, ox: Math.round((b.clientWidth - q.breite * zoom) / 2), oy: Math.round((b.clientHeight - q.hoehe * zoom) / 2) });
  }, []);
  useEffect(() => { einpassen(); }, [einpassen]);

  // ---- Zeichnen der Leinwand
  const zeichne = useCallback(() => {
    const c = canvas.current, b = box.current;
    if (!c || !b) return;
    const q = pRef.current, dpr = window.devicePixelRatio || 1, W = b.clientWidth, H = b.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { zoom, ox, oy } = ansicht, bw = q.breite * zoom, bh = q.hoehe * zoom;
    // Schachbrett
    // Kästchen am Pixelraster ausgerichtet: groß gezoomt 2×2 je Pixel, klein gezoomt über ganze Pixel
    const kz = zoom >= 16 ? zoom / 2 : zoom * Math.max(1, Math.ceil(8 / zoom));
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, bw, bh); ctx.clip();
    for (let y = 0; y * kz < bh; y++) for (let x = 0; x * kz < bw; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#cfcfcf" : "#f2f2f2";
      ctx.fillRect(ox + x * kz, oy + y * kz, kz, kz);
    }
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
    const bi = Math.min(bild, q.bilder.length - 1);
    if (opt.zwiebel) {
      if (bi > 0) { ctx.globalAlpha = 0.3; ctx.drawImage(bildCanvas(q, bi - 1), ox, oy, bw, bh); }
      if (bi < q.bilder.length - 1) { ctx.globalAlpha = 0.15; ctx.drawImage(bildCanvas(q, bi + 1), ox, oy, bw, bh); }
      ctx.globalAlpha = 1;
    }
    // aktuelles Bild, mit Vorschau der laufenden Form bzw. des verschobenen Ausschnitts
    const eid = q.ebenen.some(e => e.id === ebene) ? ebene : q.ebenen[q.ebenen.length - 1].id;
    const echt = q.zellen[eid][bi];
    const z = zug.current;
    if (z?.art === "form" || z?.art === "schieben") {
      const tmp = echt.slice();
      if (z.art === "form") setze(tmp, q.breite, q.hoehe, formPunkte(z, wz, opt.gefuellt), z.wert, opt.dither ? ditherAn : undefined);
      else einsetzen(tmp, q.breite, q.hoehe, z.teil, z.r.w, z.r.h, z.r.x + z.dx, z.r.y + z.dy);
      q.zellen[eid][bi] = tmp;
      ctx.drawImage(rgbaCanvas(zusammensetzen(q, bi), q.breite, q.hoehe), ox, oy, bw, bh);
      q.zellen[eid][bi] = echt;
    } else ctx.drawImage(rgbaCanvas(zusammensetzen(q, bi), q.breite, q.hoehe), ox, oy, bw, bh);
    // Raster
    if (opt.raster && zoom >= 6) {
      ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 1; x < q.breite; x++) { ctx.moveTo(ox + x * zoom + 0.5, oy); ctx.lineTo(ox + x * zoom + 0.5, oy + bh); }
      for (let y = 1; y < q.hoehe; y++) { ctx.moveTo(ox, oy + y * zoom + 0.5); ctx.lineTo(ox + bw, oy + y * zoom + 0.5); }
      ctx.stroke();
    }
    if (q.kachel > 0) {
      ctx.strokeStyle = "rgba(59,93,201,0.7)"; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let x = q.kachel; x < q.breite; x += q.kachel) { ctx.moveTo(ox + x * zoom, oy); ctx.lineTo(ox + x * zoom, oy + bh); }
      for (let y = q.kachel; y < q.hoehe; y += q.kachel) { ctx.moveTo(ox, oy + y * zoom); ctx.lineTo(ox + bw, oy + y * zoom); }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.strokeRect(ox - 0.5, oy - 0.5, bw + 1, bh + 1);
    // Auswahl
    const a = z?.art === "auswahl" && zeiger.current ? rahmenAus(z.start, zeiger.current) : auswahl.current;
    if (a) {
      const sx = z?.art === "schieben" ? z.dx : 0, sy = z?.art === "schieben" ? z.dy : 0;
      ctx.setLineDash([4, 3]); ctx.strokeStyle = "#000"; ctx.strokeRect(ox + (a.x + sx) * zoom + 0.5, oy + (a.y + sy) * zoom + 0.5, a.w * zoom - 1, a.h * zoom - 1);
      ctx.strokeStyle = "#fff"; ctx.lineDashOffset = 3; ctx.strokeRect(ox + (a.x + sx) * zoom + 0.5, oy + (a.y + sy) * zoom + 0.5, a.w * zoom - 1, a.h * zoom - 1);
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    // Zeiger: Pinselumriss
    const zp = zeiger.current;
    if (zp && !nurLesen && (wz === "stift" || wz === "radierer")) {
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1;
      for (const [x, y] of pinsel(zp[0], zp[1], opt.groesse)) ctx.strokeRect(ox + x * zoom + 0.5, oy + y * zoom + 0.5, zoom - 1, zoom - 1);
    }
  }, [ansicht, bild, ebene, opt, wz, nurLesen]);
  useEffect(() => { zeichne(); }, [zeichne, ver]);
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    const ro = new ResizeObserver(() => zeichne());
    ro.observe(b);
    return () => ro.disconnect();
  }, [zeichne]);

  // ---- Zeiger
  const pixelBei = (e: { clientX: number; clientY: number }): Punkt => {
    const r = canvas.current!.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left - ansicht.ox) / ansicht.zoom), Math.floor((e.clientY - r.top - ansicht.oy) / ansicht.zoom)];
  };
  const innen = ([x, y]: Punkt) => x >= 0 && y >= 0 && x < p.breite && y < p.hoehe;

  function malen(x: number, y: number, wert: number, alt?: Map<number, number>) {
    const q = pRef.current, z = q.zellen[ebeneOk][bildOk];
    for (const pt of pinsel(x, y, opt.groesse)) {
      const pts = spiegelpunkte(pt, q.breite, q.hoehe, opt.spiegelX, opt.spiegelY);
      if (alt) for (const [a, b] of pts) { const i = b * q.breite + a; if (a >= 0 && b >= 0 && a < q.breite && b < q.hoehe && !alt.has(i)) alt.set(i, z[i]); }
      setze(z, q.breite, q.hoehe, pts, wert, opt.dither ? ditherAn : undefined);
    }
  }

  /** pixelgenau: ein Eck-Pixel zwischen zwei schräg benachbarten Punkten wird zurückgenommen (keine »L«-Treppen) */
  function eckeWeg(z: Extract<Zug, { art: "malen" }>) {
    const f = z.pfad, n = f.length;
    if (!opt.pixelgenau || opt.groesse !== 1 || n < 3) return;
    const [a, b, c] = [f[n - 3], f[n - 2], f[n - 1]];
    const nah = (u: Punkt, v: Punkt) => Math.abs(u[0] - v[0]) + Math.abs(u[1] - v[1]) === 1;
    if (!(nah(a, b) && nah(b, c) && Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1)) return;
    const q = pRef.current, zelleJetzt = q.zellen[ebeneOk][bildOk];
    for (const [x, y] of spiegelpunkte(b, q.breite, q.hoehe, opt.spiegelX, opt.spiegelY)) {
      const i = y * q.breite + x;
      if (z.alt.has(i)) zelleJetzt[i] = z.alt.get(i)!;
    }
    f.splice(n - 2, 1);
  }

  function nimmFarbe([x, y]: Punkt, slot: 0 | 1) {
    const q = pRef.current;
    for (let k = q.ebenen.length - 1; k >= 0; k--) {
      const e = q.ebenen[k];
      if (!e.sichtbar) continue;
      const v = q.zellen[e.id][bildOk][y * q.breite + x];
      if (v) { setFarbe(f => slot ? [f[0], v] : [v, f[1]]); return; }
    }
    setFarbe(f => slot ? [f[0], 0] : [0, f[1]]);
  }

  function runter(e: RPointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    const pt = pixelBei(e);
    zeiger.current = pt;
    if (e.button === 1 || leertaste.current || nurLesen) {
      zug.current = { art: "pan", sx: e.clientX, sy: e.clientY, ox: ansicht.ox, oy: ansicht.oy };
      return;
    }
    const slot = e.button === 2 ? 1 : 0, wert = wz === "radierer" ? 0 : farbe[slot];
    const ebeneObj = p.ebenen.find(x => x.id === ebeneOk)!;
    if (!ebeneObj.sichtbar && ["stift", "radierer", "fuellen", "linie", "rechteck", "ellipse", "verschieben"].includes(wz)) {
      setFehler("Diese Ebene ist ausgeblendet — erst einblenden (👁), dann zeichnen."); return;
    }
    switch (wz) {
      case "stift": case "radierer":
        { merke(); const alt = new Map<number, number>(); malen(pt[0], pt[1], wert, alt); zug.current = { art: "malen", letzter: pt, wert, pfad: [pt], alt }; neu(); break; }
      case "fuellen":
        if (!innen(pt)) return;
        merke();
        for (const [x, y] of spiegelpunkte(pt, p.breite, p.hoehe, opt.spiegelX, opt.spiegelY)) fuellen(zelle(), p.breite, p.hoehe, x, y, wert, opt.global);
        neu(); break;
      case "linie": case "rechteck": case "ellipse":
        zug.current = { art: "form", start: pt, ende: pt, wert }; zeichne(); break;
      case "pipette":
        if (innen(pt)) nimmFarbe(pt, slot);
        break;
      case "auswahl":
        auswahl.current = null; zug.current = { art: "auswahl", start: pt }; zeichne(); break;
      case "verschieben": {
        const r = auswahl.current ?? { x: 0, y: 0, w: p.breite, h: p.hoehe };
        merke();
        const teil = ausschnitt(zelle(), p.breite, r.x, r.y, r.w, r.h);
        for (let y = r.y; y < r.y + r.h; y++) zelle().fill(0, y * p.breite + r.x, y * p.breite + r.x + r.w);
        zug.current = { art: "schieben", start: pt, teil, r, dx: 0, dy: 0 };
        zeichne(); break;
      }
    }
  }

  function bewegen(e: RPointerEvent<HTMLCanvasElement>) {
    const pt = pixelBei(e), z = zug.current;
    zeiger.current = pt;
    if (!z) { zeichne(); return; }
    if (z.art === "pan") { setAnsicht(a => ({ ...a, ox: z.ox + e.clientX - z.sx, oy: z.oy + e.clientY - z.sy })); return; }
    if (z.art === "malen") {
      for (const [x, y] of linie(z.letzter[0], z.letzter[1], pt[0], pt[1]).slice(1)) {
        malen(x, y, z.wert, z.alt);
        z.pfad.push([x, y]);
        eckeWeg(z);
      }
      z.letzter = pt; zeichne(); return;
    }
    if (z.art === "form") { z.ende = e.shiftKey ? gerade(z.start, pt, wz === "linie") : pt; zeichne(); return; }
    if (z.art === "schieben") { z.dx = pt[0] - z.start[0]; z.dy = pt[1] - z.start[1]; zeichne(); return; }
    zeichne();
  }

  function hoch() {
    const z = zug.current;
    zug.current = null;
    if (!z) return;
    const q = pRef.current;
    if (z.art === "form") {
      merke();
      for (const pt of formPunkte(z, wz, opt.gefuellt))
        setze(zelle(), q.breite, q.hoehe, spiegelpunkte(pt, q.breite, q.hoehe, opt.spiegelX, opt.spiegelY), z.wert, opt.dither ? ditherAn : undefined);
      neu();
    } else if (z.art === "auswahl" && zeiger.current) {
      const r = rahmenAus(z.start, zeiger.current), k = schneide(r, q);
      auswahl.current = k && (k.w > 1 || k.h > 1) ? k : null;
      setAuswahlVer(v => v + 1); zeichne();
    } else if (z.art === "schieben") {
      einsetzen(zelle(), q.breite, q.hoehe, z.teil, z.r.w, z.r.h, z.r.x + z.dx, z.r.y + z.dy);
      if (auswahl.current) auswahl.current = { ...auswahl.current, x: auswahl.current.x + z.dx, y: auswahl.current.y + z.dy };
      neu();
    } else if (z.art === "malen") neu();
  }

  /** eine Zoomstufe weiter um einen Punkt der Leinwand (ohne Punkt: um die Mitte) */
  function zoomen(richtung: 1 | -1, mx?: number, my?: number) {
    const b = box.current;
    const cx = mx ?? (b ? b.clientWidth / 2 : 0), cy = my ?? (b ? b.clientHeight / 2 : 0);
    setAnsicht(a => {
      const k = ZOOMS.indexOf(a.zoom), nz = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (k < 0 ? 5 : k) + richtung))];
      return { zoom: nz, ox: Math.round(cx - (cx - a.ox) * nz / a.zoom), oy: Math.round(cy - (cy - a.oy) * nz / a.zoom) };
    });
  }
  function rad(e: RWheelEvent) {
    const r = canvas.current!.getBoundingClientRect();
    zoomen(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
  }
  // Rad ohne Seitenscrollen
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const h = (e: WheelEvent) => e.preventDefault();
    c.addEventListener("wheel", h, { passive: false });
    return () => c.removeEventListener("wheel", h);
  }, []);

  // ---- Befehle
  const aendern = (f: () => void) => { if (nurLesen) return; merke(); f(); neu(); };
  const kopiereAuswahl = (ausschneiden: boolean) => {
    const r = auswahl.current ?? { x: 0, y: 0, w: p.breite, h: p.hoehe };
    ablage.current = { teil: ausschnitt(zelle(), p.breite, r.x, r.y, r.w, r.h), w: r.w, h: r.h };
    if (ausschneiden) aendern(() => { for (let y = r.y; y < r.y + r.h; y++) zelle().fill(0, y * p.breite + r.x, y * p.breite + r.x + r.w); });
  };
  const einfuegen = () => {
    const a = ablage.current;
    if (!a) return;
    const x = auswahl.current?.x ?? 0, y = auswahl.current?.y ?? 0;
    aendern(() => einsetzen(zelle(), p.breite, p.hoehe, a.teil, a.w, a.h, x, y));
    auswahl.current = schneide({ x, y, w: a.w, h: a.h }, p);
    setWz("verschieben");
  };
  const auswahlLeeren = () => {
    const r = auswahl.current;
    if (!r) return;
    aendern(() => { for (let y = r.y; y < r.y + r.h; y++) zelle().fill(0, y * p.breite + r.x, y * p.breite + r.x + r.w); });
  };

  // ---- Tasten
  useEffect(() => {
    const runterT = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      // nur Texteingaben sperren die Kürzel – Häkchen und Regler nicht
      const typ = t instanceof HTMLInputElement ? t.type : "";
      if (t && ((t.tagName === "INPUT" && !["checkbox", "range", "button", "color"].includes(typ)) || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const strg = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (e.key === " ") { leertaste.current = true; e.preventDefault(); return; }
      if (strg && k === "z") { e.preventDefault(); rueckgaengig(e.shiftKey); return; }
      if (strg && k === "y") { e.preventDefault(); rueckgaengig(true); return; }
      if (strg && k === "c") { e.preventDefault(); kopiereAuswahl(false); return; }
      if (strg && k === "x") { e.preventDefault(); kopiereAuswahl(true); return; }
      if (strg && k === "v") { e.preventDefault(); einfuegen(); return; }
      if (strg && k === "a") { e.preventDefault(); auswahl.current = { x: 0, y: 0, w: p.breite, h: p.hoehe }; setAuswahlVer(v => v + 1); zeichne(); return; }
      if (strg) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); auswahlLeeren(); return; }
      if (e.key === "Escape") { auswahl.current = null; setAuswahlVer(v => v + 1); zeichne(); return; }
      const w = WERKZEUGE.find(x => x.taste.toLowerCase() === k);
      if (w) { setWz(w.id); return; }
      if (e.altKey && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d: Record<string, Punkt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const [dx, dy] = d[e.key];
        const r = auswahl.current ?? { x: 0, y: 0, w: p.breite, h: p.hoehe };
        aendern(() => bereichSchieben(zelle(), p.breite, r, dx, dy));
        return;
      }
      if (k === "x") { setFarbe(f => [f[1], f[0]]); return; }
      if (k === "[") { setOpt(o => ({ ...o, groesse: Math.max(1, o.groesse - 1) })); return; }
      if (k === "]") { setOpt(o => ({ ...o, groesse: Math.min(8, o.groesse + 1) })); return; }
      if (k === ",") { setBild(b => Math.max(0, b - 1)); return; }
      if (k === ".") { setBild(b => Math.min(pRef.current.bilder.length - 1, b + 1)); return; }
      if (k === "+" || k === "=") { zoomen(1); return; }
      if (k === "-") { zoomen(-1); return; }
      if (k === "0") { einpassen(); return; }
    };
    const hochT = (e: KeyboardEvent) => { if (e.key === " ") leertaste.current = false; };
    window.addEventListener("keydown", runterT);
    window.addEventListener("keyup", hochT);
    return () => { window.removeEventListener("keydown", runterT); window.removeEventListener("keyup", hochT); };
  });

  // ---- Palette
  function paletteLaden(farben: string[]) {
    aendern(() => {
      const q = pRef.current, neuRgb = farben.map(hexZuRgb), alt = q.palette.map(hexZuRgb);
      const abb = [0, ...alt.map(([r, g, b]) => naechsteFarbe(neuRgb, r, g, b))];
      alleZellen(q, z => z.map(v => abb[v] ?? 0));
      q.palette = [...farben];
    });
    setFarbe([1, 0]);
  }
  function farbeBearbeiten(wert: number) {
    if (nurLesen || !wert) return;
    farbZiel.current = { wert, gemerkt: false };
    const f = farbEingabe.current!;
    f.value = p.palette[wert - 1];
    f.click();
  }

  // ---- Import in die aktuelle Zelle
  async function bildImportieren(datei: File) {
    try {
      const { rgba, w, h } = await bildDateiLesen(datei, 256);
      const q = quantisieren(rgba, p.palette, false);
      aendern(() => {
        const z = zelle();
        z.fill(0);
        einsetzen(z, p.breite, p.hoehe, q.zelle, w, h, 0, 0);
      });
    } catch (e) { setFehler(meldung(e)); }
  }

  const statusText = nurLesen ? "📚 Vorlage (nur ansehen)" : { gespeichert: "✓ gespeichert", ungespeichert: "… ungespeichert", speichert: "speichert …", fehler: "⚠️ nicht gespeichert" }[status];
  const aktiveEbene = p.ebenen.find(e => e.id === ebeneOk)!;
  const ebIdx = p.ebenen.indexOf(aktiveEbene);

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 max-w-[var(--seite-breite)] mx-auto w-full">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary" onClick={zurueck}>← Bibliothek</button>
        <input className="input font-bold min-w-0 w-56" value={name} maxLength={80} disabled={nurLesen}
          onChange={e => { setName(e.target.value); setStatus("ungespeichert"); }} />
        <span className={`text-xs ${status === "fehler" ? "text-bad" : "text-muted"}`}>{statusText}</span>
        <span className="text-xs text-muted">{p.breite}×{p.hoehe}</span>
        <div className="flex-1" />
        {!nurLesen && <>
          <button className="btn-secondary" title="Rückgängig (Strg+Z)" disabled={!undo.current.length} onClick={() => rueckgaengig(false)}>↶</button>
          <button className="btn-secondary" title="Wiederholen (Strg+Y)" disabled={!redo.current.length} onClick={() => rueckgaengig(true)}>↷</button>
        </>}
        {!nurLesen && <BildMenue p={p} farbe={farbe} aendern={aendern} zelle={zelle} ebene={ebeneOk} bild={bildOk} einpassen={einpassen}
          importieren={() => bildEingabe.current?.click()} meldung={setFehler}
          neuesProjekt={(n, q) => kopieren(n, zuDaten(q)).catch(e => setFehler(meldung(e)))} name={name} />}
        <ExportMenue p={p} name={name} bild={bildOk} />
        {nurLesen
          ? <button className="btn-primary" onClick={() => kopieren(`${name} (Kopie)`, zuDaten(p)).catch(e => setFehler(meldung(e)))}>Als Kopie bearbeiten</button>
          : lehrkraft && <label className="flex items-center gap-1 text-sm" title="Alle Schüler·innen sehen das Projekt unter »Vorlagen« und können es kopieren">
              <input type="checkbox" checked={geteilt} onChange={async e => {
                const v = e.target.checked;
                try { await api.pixel.speichern(id, { geteilt: v }, zugang); setGeteilt(v); } catch (x) { setFehler(meldung(x)); }
              }} /> 📚 Als Vorlage teilen</label>}
      </div>
      {fehler && <p className="text-bad text-sm">{fehler} <button className="underline" onClick={() => setFehler("")}>ok</button></p>}

      <div className="flex flex-col lg:flex-row gap-3 min-h-0">
        {/* Werkzeuge */}
        {!nurLesen && (
          <div className="card p-2 flex lg:flex-col flex-wrap gap-1 lg:w-[150px] shrink-0 self-start">
            {WERKZEUGE.map(w => (
              <button key={w.id} title={`${w.label} (${w.taste})`} onClick={() => setWz(w.id)}
                className={`rounded-lg px-2 py-1.5 text-sm text-left flex items-center gap-2 ${wz === w.id ? "bg-accent text-accent-fg" : "hover:bg-surface-hover"}`}>
                <span>{w.icon}</span><span className="hidden lg:inline">{w.label}</span><span className="hidden lg:inline ml-auto text-xs opacity-60">{w.taste}</span>
              </button>
            ))}
            <div className="lg:border-t border-line lg:pt-2 lg:mt-1 flex lg:flex-col flex-wrap gap-1 text-sm">
              {(wz === "stift" || wz === "radierer") && (
                <label className="flex items-center gap-1" title="Pinselgröße ([ und ])">Größe
                  <input type="range" min={1} max={8} value={opt.groesse} onChange={e => setOpt({ ...opt, groesse: +e.target.value })} className="w-16" />
                  <span className="text-xs">{opt.groesse}</span></label>
              )}
              {wz === "stift" && opt.groesse === 1 && <Haken an={opt.pixelgenau} setze={v => setOpt({ ...opt, pixelgenau: v })} titel="Striche ohne dicke Ecken: an Knicken bleibt kein zusätzliches Pixel stehen">◢ pixelgenau</Haken>}
              {(wz === "rechteck" || wz === "ellipse") && <Haken an={opt.gefuellt} setze={v => setOpt({ ...opt, gefuellt: v })}>gefüllt</Haken>}
              {wz === "fuellen" && <Haken an={opt.global} setze={v => setOpt({ ...opt, global: v })} titel="alle Pixel dieser Farbe, nicht nur zusammenhängende">überall</Haken>}
              <Haken an={opt.spiegelX} setze={v => setOpt({ ...opt, spiegelX: v })} titel="Symmetrie links/rechts">⇆ spiegeln</Haken>
              <Haken an={opt.spiegelY} setze={v => setOpt({ ...opt, spiegelY: v })} titel="Symmetrie oben/unten">⇅ spiegeln</Haken>
              <Haken an={opt.dither} setze={v => setOpt({ ...opt, dither: v })} titel="nur jedes zweite Pixel (Schachbrett) – für Verläufe">▚ Dither</Haken>
            </div>
          </div>
        )}

        {/* Leinwand */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div ref={box} className="relative rounded-xl border border-line bg-surface overflow-hidden h-[52vh] lg:h-[64vh] touch-none select-none">
            <canvas ref={canvas} className="absolute inset-0 w-full h-full"
              style={{ cursor: nurLesen ? "grab" : wz === "verschieben" ? "move" : wz === "pipette" ? "copy" : "crosshair" }}
              onPointerDown={runter} onPointerMove={bewegen} onPointerUp={hoch} onPointerCancel={hoch}
              onPointerLeave={() => { if (!zug.current) { zeiger.current = null; zeichne(); } }}
              onContextMenu={e => e.preventDefault()} onWheel={rad} />
            <div className="absolute bottom-2 right-2 flex gap-1 items-center text-xs bg-surface/90 rounded-lg border border-line px-2 py-1">
              <button onClick={() => zoomen(-1)}>−</button>
              <span className="w-10 text-center">{ansicht.zoom * 100}%</span>
              <button onClick={() => zoomen(1)}>+</button>
              <button className="ml-1" title="Einpassen (0)" onClick={einpassen}>⤢</button>
              <label className="ml-2 flex items-center gap-1"><input type="checkbox" checked={opt.raster} onChange={e => setOpt({ ...opt, raster: e.target.checked })} />Raster</label>
            </div>
            {zeiger.current && innen(zeiger.current) && <div className="absolute top-2 left-2 text-xs text-muted bg-surface/90 rounded px-1.5">x {zeiger.current[0]} · y {zeiger.current[1]}</div>}
          </div>
          <p className="text-xs text-muted">Linke Maustaste: linke Farbe · rechte Maustaste: rechte Farbe · Mausrad: Zoom · Leertaste oder Mitteltaste + Ziehen: Ansicht verschieben · Shift: gerade Linien und Quadrate · Strg+C/X/V mit Auswahl</p>
          <Zeitleiste p={p} ver={ver} bild={bildOk} setBild={setBild} bereich={bereich} setBereich={setBereich} nurLesen={nurLesen}
            aendern={aendern} zwiebel={opt.zwiebel} setZwiebel={v => setOpt({ ...opt, zwiebel: v })}
            bewegung={(o, alle, dauer) => {
              const art = BEWEGUNGEN.find(b => b.id === o.art)!;
              let n = 0;
              aendern(() => { n = bewegungEinfuegen(p, bildOk, alle ? p.ebenen.map(e => e.id) : [ebeneOk], o, dauer, art.label.toLowerCase()); });
              setBereich([bildOk, bildOk + n - 1]); setAbspielen(true);
            }} />
        </div>

        {/* rechte Spalte */}
        <div className="flex flex-col gap-3 lg:w-[270px] shrink-0">
          <Vorschau p={p} ver={ver} bild={bildOk} bereich={bereich} abspielen={abspielen} setAbspielen={setAbspielen}
            kachel3={opt.kachel3} setKachel3={v => setOpt({ ...opt, kachel3: v })} />
          <section className="card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm flex-1">🎨 Farben</h3>
              <Feld wert={farbe[0]} p={p} titel="linke Farbe" />
              <button className="text-xs" title="tauschen (X)" onClick={() => setFarbe([farbe[1], farbe[0]])}>⇄</button>
              <Feld wert={farbe[1]} p={p} titel="rechte Farbe" />
            </div>
            <div className="grid grid-cols-8 gap-1">
              <button title="durchsichtig" onClick={() => setFarbe([0, farbe[1]])} onContextMenu={e => { e.preventDefault(); setFarbe([farbe[0], 0]); }}
                className={`aspect-square rounded border ${farbe[0] === 0 ? "ring-2 ring-accent" : "border-line"}`} style={SCHACH} />
              {p.palette.map((c, k) => (
                <button key={k} title={`${c} — Doppelklick: ändern`} onClick={() => setFarbe([k + 1, farbe[1]])}
                  onContextMenu={e => { e.preventDefault(); setFarbe([farbe[0], k + 1]); }} onDoubleClick={() => farbeBearbeiten(k + 1)}
                  className={`aspect-square rounded border relative ${farbe[0] === k + 1 ? "ring-2 ring-accent z-10" : farbe[1] === k + 1 ? "ring-2 ring-line-active" : "border-line"}`}
                  style={{ background: c }} />
              ))}
            </div>
            {!nurLesen && (
              <div className="flex flex-wrap gap-1 text-xs">
                <button className="chip" disabled={p.palette.length >= MAX_FARBEN} onClick={() => {
                  aendern(() => p.palette.push(p.palette[Math.max(0, farbe[0] - 1)] ?? "#808080"));
                  setFarbe([p.palette.length, farbe[1]]);
                  farbeBearbeiten(p.palette.length);
                }}>＋ Farbe</button>
                <button className="chip" disabled={!farbe[0]} onClick={() => farbeBearbeiten(farbe[0])}>✏️ ändern</button>
                <button className="chip" disabled={!farbe[0] || p.palette.length <= 1} onClick={() => {
                  const benutzt = Object.values(p.zellen).some(zs => zs.some(z => z.includes(farbe[0])));
                  if (benutzt && !confirm("Diese Farbe wird benutzt. Entfernen macht diese Pixel durchsichtig. Weiter?")) return;
                  aendern(() => farbeEntfernen(pRef.current, farbe[0]));
                  setFarbe([Math.min(farbe[0], pRef.current.palette.length), 0]);
                }}>－ entfernen</button>
                <button className="chip" disabled={farbe[0] <= 1} title="nach links rücken" onClick={() => { aendern(() => farbenTauschen(pRef.current, farbe[0], farbe[0] - 1)); setFarbe([farbe[0] - 1, farbe[1]]); }}>◀</button>
                <button className="chip" disabled={!farbe[0] || farbe[0] >= p.palette.length} title="nach rechts rücken" onClick={() => { aendern(() => farbenTauschen(pRef.current, farbe[0], farbe[0] + 1)); setFarbe([farbe[0] + 1, farbe[1]]); }}>▶</button>
                <select className="input text-xs py-0.5" value="" onChange={e => { const pal = PALETTEN.find(x => x.id === e.target.value); if (pal && confirm(`Palette »${pal.name}« laden? Pixel bekommen die ähnlichste neue Farbe.`)) paletteLaden(pal.farben); }}>
                  <option value="">Palette laden …</option>
                  {PALETTEN.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
            )}
            <input ref={farbEingabe} type="color" className="sr-only" onChange={e => {
              const z = farbZiel.current;
              if (!z) return;
              if (!z.gemerkt) { merke(); z.gemerkt = true; }
              pRef.current.palette[z.wert - 1] = e.target.value;
              neu();
            }} />
          </section>

          <section className="card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <h3 className="font-bold text-sm flex-1">🗂️ Ebenen</h3>
              {!nurLesen && <>
                <button className="chip" title="neue Ebene" disabled={p.ebenen.length >= MAX_EBENEN} onClick={() => {
                  const nid = neueId();
                  aendern(() => {
                    p.ebenen.splice(ebIdx + 1, 0, { id: nid, name: `Ebene ${p.ebenen.length + 1}`, sichtbar: true, deckkraft: 1 });
                    p.zellen[nid] = p.bilder.map(() => leereZelle(p));
                  });
                  setEbene(nid);
                }}>＋</button>
                <button className="chip" title="Ebene verdoppeln" disabled={p.ebenen.length >= MAX_EBENEN} onClick={() => {
                  const nid = neueId();
                  aendern(() => {
                    p.ebenen.splice(ebIdx + 1, 0, { ...aktiveEbene, id: nid, name: `${aktiveEbene.name} Kopie` });
                    p.zellen[nid] = p.zellen[ebeneOk].map(z => z.slice());
                  });
                  setEbene(nid);
                }}>⧉</button>
                <button className="chip" title="mit der Ebene darunter verschmelzen" disabled={ebIdx === 0} onClick={() => { aendern(() => ebeneVerschmelzen(pRef.current, ebIdx)); setEbene(p.ebenen[ebIdx - 1].id); }}>⤓</button>
                <button className="chip" title="Ebene löschen" disabled={p.ebenen.length <= 1} onClick={() => {
                  if (!confirm(`Ebene »${aktiveEbene.name}« löschen?`)) return;
                  aendern(() => { p.ebenen.splice(ebIdx, 1); delete p.zellen[ebeneOk]; });
                }}>🗑</button>
              </>}
            </div>
            <div className="flex flex-col gap-1">
              {[...p.ebenen].reverse().map(e => {
                const k = p.ebenen.indexOf(e);
                return (
                  <div key={e.id} className={`flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm cursor-pointer ${e.id === ebeneOk ? "bg-accent/15 ring-1 ring-accent" : "hover:bg-surface-hover"}`} onClick={() => setEbene(e.id)}>
                    <button title={e.sichtbar ? "ausblenden" : "einblenden"} onClick={x => { x.stopPropagation(); e.sichtbar = !e.sichtbar; neu(); setStatus(nurLesen ? "gespeichert" : "ungespeichert"); }}>{e.sichtbar ? "👁" : "🙈"}</button>
                    <EbenenBild p={p} ver={ver} ebene={e.id} bild={bildOk} />
                    <span className="flex-1 truncate" onDoubleClick={() => { if (nurLesen) return; const n = prompt("Name der Ebene", e.name); if (n?.trim()) aendern(() => { e.name = n.trim().slice(0, 40); }); }}>{e.name}</span>
                    {!nurLesen && <>
                      <button className="text-xs text-muted" title="nach oben" disabled={k === p.ebenen.length - 1} onClick={x => { x.stopPropagation(); aendern(() => { p.ebenen.splice(k, 1); p.ebenen.splice(k + 1, 0, e); }); }}>▲</button>
                      <button className="text-xs text-muted" title="nach unten" disabled={k === 0} onClick={x => { x.stopPropagation(); aendern(() => { p.ebenen.splice(k, 1); p.ebenen.splice(k - 1, 0, e); }); }}>▼</button>
                    </>}
                  </div>
                );
              })}
            </div>
            {!nurLesen && (
              <label className="flex items-center gap-2 text-xs">Deckkraft
                <input type="range" min={10} max={100} step={5} value={Math.round(aktiveEbene.deckkraft * 100)} className="flex-1"
                  onChange={e => { aktiveEbene.deckkraft = +e.target.value / 100; setStatus("ungespeichert"); neu(); }} />
                {Math.round(aktiveEbene.deckkraft * 100)} %</label>
            )}
            <p className="text-xs text-muted">Doppelklick auf den Namen: umbenennen</p>
            {!nurLesen && <ModifierListe ebene={aktiveEbene} p={p} merke={merke} aendern={aendern} neu={() => { setStatus("ungespeichert"); neu(); }} />}
          </section>
        </div>
      </div>
      <input ref={bildEingabe} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) bildImportieren(f); e.target.value = ""; }} />
    </div>
  );
}

// ---- Hilfen

function formPunkte(z: { start: Punkt; ende: Punkt }, art: Werkzeug, gefuellt: boolean): Punkt[] {
  const [x0, y0] = z.start, [x1, y1] = z.ende;
  if (art === "rechteck") return rechteck(x0, y0, x1, y1, gefuellt);
  if (art === "ellipse") return ellipse(x0, y0, x1, y1, gefuellt);
  return linie(x0, y0, x1, y1);
}

function gerade(a: Punkt, b: Punkt, linieArt: boolean): Punkt {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (!linieArt) { const m = Math.max(Math.abs(dx), Math.abs(dy)); return [a[0] + Math.sign(dx || 1) * m, a[1] + Math.sign(dy || 1) * m]; }
  const w = Math.atan2(dy, dx), s = Math.round(w / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(dx, dy);
  return [a[0] + Math.round(Math.cos(s) * l), a[1] + Math.round(Math.sin(s) * l)];
}
const rahmenAus = (a: Punkt, b: Punkt): Rahmen => ({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]) + 1, h: Math.abs(a[1] - b[1]) + 1 });
function schneide(r: Rahmen, q: Projekt): Rahmen | null {
  const x = Math.max(0, r.x), y = Math.max(0, r.y), x2 = Math.min(q.breite, r.x + r.w), y2 = Math.min(q.hoehe, r.y + r.h);
  return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null;
}

function Haken({ an, setze, titel, children }: { an: boolean; setze: (v: boolean) => void; titel?: string; children: ReactNode }) {
  return <label className="flex items-center gap-1 cursor-pointer" title={titel}><input type="checkbox" checked={an} onChange={e => setze(e.target.checked)} />{children}</label>;
}

function Feld({ wert, p, titel }: { wert: number; p: Projekt; titel: string }) {
  return <span title={titel} className="w-6 h-6 rounded border border-line inline-block" style={wert ? { background: p.palette[wert - 1] } : SCHACH} />;
}

/** kleines Canvas-Bild (Zeitleiste, Ebenen) */
function MiniBild({ zeichne, ver, groesse = 32 }: { zeichne: () => HTMLCanvasElement; ver: unknown; groesse?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const quelle = zeichne(), f = groesse / Math.max(quelle.width, quelle.height);
    c.width = Math.max(1, Math.round(quelle.width * f)); c.height = Math.max(1, Math.round(quelle.height * f));
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(quelle, 0, 0, c.width, c.height);
  }, [zeichne, ver, groesse]);
  return <canvas ref={ref} style={{ imageRendering: "pixelated", ...SCHACH, backgroundSize: "8px 8px" }} className="rounded" />;
}

function EbenenBild({ p, ver, ebene, bild }: { p: Projekt; ver: number; ebene: string; bild: number }) {
  const z = useCallback(() => rgbaCanvas(zusammensetzen(p, bild, ebene), p.breite, p.hoehe), [p, bild, ebene]);
  return <MiniBild zeichne={z} ver={ver} groesse={24} />;
}

function Zeitleiste({ p, ver, bild, setBild, bereich, setBereich, nurLesen, aendern, zwiebel, setZwiebel, bewegung }: {
  p: Projekt; ver: number; bild: number; setBild: (k: number) => void; bereich: [number, number]; setBereich: (b: [number, number]) => void;
  nurLesen: boolean; aendern: (f: () => void) => void; zwiebel: boolean; setZwiebel: (v: boolean) => void;
  bewegung: (o: BewegungsOptionen, alleEbenen: boolean, dauer: number) => void;
}) {
  const [a, b] = [Math.min(...bereich), Math.max(...bereich)];
  const [bwOffen, setBwOffen] = useState(false);
  return (
    <section className="card p-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <h3 className="font-bold mr-2">🎞️ Bilder</h3>
        {!nurLesen && <>
          <button className="chip" disabled={p.bilder.length >= MAX_BILDER} title="leeres Bild dahinter" onClick={() => { aendern(() => bildEinfuegen(p, bild, false)); setBild(bild + 1); setBereich([bild + 1, bild + 1]); }}>＋ leer</button>
          <button className="chip" disabled={p.bilder.length >= MAX_BILDER} title="Bild verdoppeln" onClick={() => { aendern(() => bildEinfuegen(p, bild, true)); setBild(bild + 1); setBereich([bild + 1, bild + 1]); }}>⧉ Kopie</button>
          <button className="chip" disabled={p.bilder.length <= 1} onClick={() => { aendern(() => bildLoeschen(p, bild)); setBild(Math.max(0, bild - 1)); setBereich([0, 0]); }}>🗑</button>
          <button className="chip" disabled={bild === 0} title="nach links" onClick={() => { aendern(() => bildVerschieben(p, bild, bild - 1)); setBild(bild - 1); }}>◀</button>
          <button className="chip" disabled={bild >= p.bilder.length - 1} title="nach rechts" onClick={() => { aendern(() => bildVerschieben(p, bild, bild + 1)); setBild(bild + 1); }}>▶</button>
          <label className="flex items-center gap-1 ml-2">Dauer
            <input type="number" className="input w-20 py-0.5" min={20} max={5000} step={10} value={p.bilder[bild].dauer}
              onChange={e => { const v = Math.max(20, Math.min(5000, +e.target.value || 100)); aendern(() => { p.bilder[bild].dauer = v; }); }} /> ms</label>
        </>}
        {!nurLesen && <button className={`chip ${bwOffen ? "chip-on" : ""}`} title="aus diesem Bild eine Animation erzeugen" onClick={() => setBwOffen(!bwOffen)}>🎬 Bewegung …</button>}
        <label className="flex items-center gap-1 ml-2" title="vorheriges und nächstes Bild durchscheinen lassen"><input type="checkbox" checked={zwiebel} onChange={e => setZwiebel(e.target.checked)} />🧅 Zwiebelhaut</label>
      </div>
      {bwOffen && !nurLesen && <BewegungsFeld p={p} frei={MAX_BILDER - p.bilder.length + 1} los={(o, alle, dauer) => { bewegung(o, alle, dauer); setBwOffen(false); }} />}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {p.bilder.map((_, k) => (
          <button key={k} onClick={e => { setBild(k); setBereich(e.shiftKey ? [bild, k] : [k, k]); }}
            title="Klick: Bild wählen · Shift+Klick: Bereich (für Tags und Vorschau)"
            className={`shrink-0 rounded-lg p-1 flex flex-col items-center gap-0.5 border ${k === bild ? "border-accent bg-accent/10" : k >= a && k <= b && a !== b ? "border-line-active" : "border-line"}`}>
            <MiniBild zeichne={() => bildCanvas(p, k)} ver={`${ver}-${k}`} groesse={40} />
            <span className="text-[10px] text-muted">{k + 1}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="text-muted">Tags:</span>
        {p.tags.map((t, i) => (
          <span key={i} className="chip flex items-center gap-1">
            <button onClick={() => { setBereich([t.von, t.bis]); setBild(t.von); }}>🏷️ {t.name} ({t.von + 1}–{t.bis + 1})</button>
            {!nurLesen && <button className="text-muted hover:text-bad" onClick={() => aendern(() => { p.tags.splice(i, 1); })}>×</button>}
          </span>
        ))}
        {!nurLesen && <button className="chip" title="Bereich mit Shift+Klick wählen, dann benennen (z. B. »laufen«)" onClick={() => {
          const n = prompt(`Name für die Bilder ${a + 1}–${b + 1} (z. B. laufen, springen):`);
          if (n?.trim()) aendern(() => { p.tags.push({ name: n.trim().slice(0, 30), von: a, bis: b }); });
        }}>＋ Tag für {a + 1}–{b + 1}</button>}
      </div>
    </section>
  );
}

function Vorschau({ p, ver, bild, bereich, abspielen, setAbspielen, kachel3, setKachel3 }: {
  p: Projekt; ver: number; bild: number; bereich: [number, number]; abspielen: boolean; setAbspielen: (v: boolean) => void;
  kachel3: boolean; setKachel3: (v: boolean) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [k, setK] = useState(0);
  const [a, b] = [Math.min(...bereich), Math.max(...bereich)];
  const von = a !== b ? a : 0, bis = a !== b ? b : p.bilder.length - 1;
  const zeige = abspielen ? Math.min(Math.max(k, von), bis) : bild;
  useEffect(() => {
    if (!abspielen) return;
    const t = setTimeout(() => setK(x => (x < von || x >= bis ? von : x + 1)), p.bilder[Math.min(zeige, p.bilder.length - 1)]?.dauer ?? 120);
    return () => clearTimeout(t);
  }, [abspielen, k, von, bis, zeige, p.bilder]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const n = kachel3 ? 3 : 1, s = Math.max(1, Math.floor(220 / (Math.max(p.breite, p.hoehe) * n)));
    c.width = p.breite * s * n; c.height = p.hoehe * s * n;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const quelle = bildCanvas(p, Math.min(zeige, p.bilder.length - 1));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) ctx.drawImage(quelle, x * p.breite * s, y * p.hoehe * s, p.breite * s, p.hoehe * s);
  }, [p, ver, zeige, kachel3]);
  return (
    <section className="card p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-sm flex-1">👀 Vorschau</h3>
        {p.bilder.length > 1 && <button className="chip" onClick={() => setAbspielen(!abspielen)}>{abspielen ? "⏸ Stopp" : "▶ Abspielen"}</button>}
      </div>
      <div className="rounded-lg flex items-center justify-center p-2" style={SCHACH}>
        <canvas ref={ref} style={{ imageRendering: "pixelated", maxWidth: "100%" }} />
      </div>
      <label className="flex items-center gap-1 text-xs" title="Kachel 3×3 nebeneinander: passt der Rand nahtlos?"><input type="checkbox" checked={kachel3} onChange={e => setKachel3(e.target.checked)} />Kachel 3×3 (Nahtprüfung)</label>
    </section>
  );
}

function BildMenue({ p, farbe, aendern, zelle, ebene, bild, einpassen, importieren, meldung: melde, neuesProjekt, name }: {
  p: Projekt; farbe: [number, number]; aendern: (f: () => void) => void; zelle: () => Uint8Array; ebene: string; bild: number;
  einpassen: () => void; importieren: () => void; meldung: (t: string) => void; neuesProjekt: (name: string, q: Projekt) => void; name: string;
}) {
  const zellen = (alle: boolean, f: (z: Uint8Array) => Uint8Array) => aendern(() => {
    if (alle) p.zellen[ebene] = p.zellen[ebene].map(f);
    else p.zellen[ebene][bild] = f(zelle());
  });
  const knopf = (t: string, f: () => void, titel?: string) => <button className="text-left px-2 py-1 rounded hover:bg-surface-hover text-sm" title={titel} onClick={e => { f(); const d = e.currentTarget.closest("details"); if (d) d.open = false; }}>{t}</button>;
  return (
    <details className="relative">
      <summary className="btn-secondary list-none cursor-pointer">🛠️ Bild</summary>
      <div className="absolute right-0 z-30 mt-1 w-72 card p-2 flex flex-col shadow-lg max-h-[70vh] overflow-y-auto">
        <span className="text-xs text-muted px-2 pt-1">Aktive Ebene, dieses Bild</span>
        {knopf("⇆ Spiegeln (links/rechts)", () => zellen(false, z => spiegelnH(z, p.breite, p.hoehe)))}
        {knopf("⇅ Spiegeln (oben/unten)", () => zellen(false, z => spiegelnV(z, p.breite, p.hoehe)))}
        {knopf("◻ Umriss in linker Farbe", () => farbe[0] && zellen(false, z => umriss(z, p.breite, p.hoehe, farbe[0])), "durchsichtige Pixel neben belegten bekommen die linke Farbe")}
        {knopf("◼ Umriss mit Ecken", () => farbe[0] && zellen(false, z => umriss(z, p.breite, p.hoehe, farbe[0], true)))}
        {knopf("◢ Schatten in linker Farbe", () => farbe[0] && zellen(false, z => schatten(z, p.breite, p.hoehe, farbe[0])), "eine Kopie 1 Pixel nach rechts unten, hinter die Figur")}
        {knopf("↔ Um halbe Größe verschieben", () => zellen(false, z => verschieben(z, p.breite, p.hoehe, Math.floor(p.breite / 2), Math.floor(p.hoehe / 2))), "zeigt bei Kacheln die Naht in der Mitte")}
        <span className="text-xs text-muted px-2 pt-2">Aktive Ebene, alle Bilder</span>
        {knopf("🎨 Linke Farbe → rechte Farbe", () => zellen(true, z => umfaerben(z, farbe[0], farbe[1])))}
        {knopf("⇆ Alle Bilder spiegeln", () => zellen(true, z => spiegelnH(z, p.breite, p.hoehe)), "z. B. eine Laufanimation nach links aus der nach rechts")}
        {knopf("🖼️ Bild importieren (ersetzt dieses Bild der Ebene)", importieren)}
        <span className="text-xs text-muted px-2 pt-2">Befehle</span>
        {knopf("🧩 Inseln ordnen", () => {
          const n = inselnOrdnen(zelle(), p.breite, p.hoehe, 1);
          if (!n) return melde("Die Inseln passen geordnet nicht auf die Leinwand — erst die Leinwand vergrößern.");
          aendern(() => { p.zellen[ebene][bild] = n; });
        }, "jedes zusammenhängende Pixelstück kommt in ein eigenes Rasterfeld, von oben links")}
        {knopf("🎞️ Inseln → Bilder (neues Projekt)", () => {
          const q = inselnZuBildern(p, ebene, bild);
          if (!q) return melde("Auf dieser Ebene ist nichts gezeichnet.");
          neuesProjekt(`${name} (Bilder)`, q);
        }, "jedes Pixelstück wird ein Bild einer Animation, unten mittig ausgerichtet")}
        {knopf("✂️ Sprite-Sheet zerschneiden (neues Projekt) …", () => {
          const t = prompt("Größe eines Bildes im Sheet (Breite×Höhe):", "16x16");
          const m = t?.match(/(\d+)\s*[x×*]\s*(\d+)/);
          if (!m) return;
          const q = sheetZuBildern(zelle(), p.breite, p.hoehe, p.palette, Math.max(1, +m[1]), Math.max(1, +m[2]));
          if (!q) return melde("Keine belegten Felder in dieser Größe gefunden.");
          neuesProjekt(`${name} (Sheet)`, q);
        }, "zeilenweise Felder fester Größe, leere Felder fallen weg")}
        {knopf("🌈 Farbrampe aus linker Farbe", () => {
          if (!farbe[0]) return;
          const neu = farbrampe(p.palette[farbe[0] - 1], 2).filter(c => !p.palette.includes(c));
          if (p.palette.length + neu.length > 255) return melde("Die Palette ist voll.");
          aendern(() => { p.palette.push(...neu); });
        }, "zwei dunklere (Richtung Blau) und zwei hellere Töne (Richtung Gelb) kommen in die Palette")}
        <span className="text-xs text-muted px-2 pt-2">Ganzes Projekt</span>
        {knopf("↻ Um 90° drehen", () => { aendern(() => drehenProjekt(p)); setTimeout(einpassen, 0); })}
        {knopf("📐 Leinwandgröße …", () => {
          const t = prompt("Neue Größe (Breite×Höhe), Inhalt bleibt mittig:", `${p.breite}x${p.hoehe}`);
          const m = t?.match(/(\d+)\s*[x×*]\s*(\d+)/);
          if (!m) return;
          const w = Math.max(1, Math.min(256, +m[1])), h = Math.max(1, Math.min(256, +m[2]));
          aendern(() => leinwandGroesse(p, w, h)); setTimeout(einpassen, 0);
        })}
        {knopf("✖2 Skalieren (doppelt)", () => { if (p.breite * 2 > 256 || p.hoehe * 2 > 256) return alert("Höchstens 256 Pixel je Seite."); aendern(() => skalieren(p, p.breite * 2, p.hoehe * 2)); setTimeout(einpassen, 0); })}
        {knopf("½ Skalieren (halb)", () => { if (p.breite < 2 || p.hoehe < 2) return; aendern(() => skalieren(p, Math.floor(p.breite / 2), Math.floor(p.hoehe / 2))); setTimeout(einpassen, 0); })}
        <div className="flex items-center gap-1 px-2 py-1 text-sm">Kachelraster
          {[0, 8, 16, 32].map(k => <button key={k} className={`chip ${p.kachel === k ? "chip-on" : ""}`} onClick={() => aendern(() => { p.kachel = k; })}>{k || "aus"}</button>)}
        </div>
      </div>
    </details>
  );
}

function ExportMenue({ p, name, bild }: { p: Projekt; name: string; bild: number }) {
  const n = dateiname(name);
  const knopf = (t: string, f: () => void) => <button className="text-left px-2 py-1 rounded hover:bg-surface-hover text-sm" onClick={e => { f(); const d = e.currentTarget.closest("details"); if (d) d.open = false; }}>{t}</button>;
  return (
    <details className="relative">
      <summary className="btn-secondary list-none cursor-pointer">⬇️ Export</summary>
      <div className="absolute right-0 z-30 mt-1 w-64 card p-2 flex flex-col shadow-lg">
        {knopf("PNG – dieses Bild", () => herunterladen(`${n}.png`, pngVon(p, bild)))}
        {knopf("PNG – dieses Bild, 8× groß", () => herunterladen(`${n}-x8.png`, pngVon(p, bild, 8)))}
        {knopf("GIF – Animation", () => herunterladen(`${n}.gif`, new Blob([gif(p, 1) as BlobPart], { type: "image/gif" })))}
        {knopf("GIF – Animation, 4× groß", () => herunterladen(`${n}-x4.gif`, new Blob([gif(p, 4) as BlobPart], { type: "image/gif" })))}
        {knopf("Sprite-Sheet (PNG + JSON)", () => {
          const s = sheetPng(p, p.bilder.length);
          herunterladen(`${n}-sheet.png`, s.png);
          herunterladen(`${n}-sheet.json`, new Blob([s.json], { type: "application/json" }));
        })}
        {knopf("Projektdatei (.json)", () => herunterladen(`${n}.ttpixel.json`, new Blob([JSON.stringify(zuDaten(p))], { type: "application/json" })))}
      </div>
    </details>
  );
}


/** Bewegung aus dem aktuellen Bild: Art, Bilderzahl, Werte, Ebenen */
function BewegungsFeld({ p, frei, los }: { p: Projekt; frei: number; los: (o: BewegungsOptionen, alleEbenen: boolean, dauer: number) => void }) {
  const [o, setO] = useState<BewegungsOptionen>({ ...STANDARD_BEWEGUNG, farbBis: Math.min(4, p.palette.length) });
  const [alle, setAlle] = useState(false);
  const [dauer, setDauer] = useState(100);
  const art = BEWEGUNGEN.find(b => b.id === o.art)!;
  const zahl = (label: string, wert: number, setze: (v: number) => void, min: number, max: number, schritt = 1) => (
    <label className="flex items-center gap-1">{label}
      <input type="number" className="input w-16 py-0.5" min={min} max={max} step={schritt} value={wert} onChange={e => setze(Math.max(min, Math.min(max, +e.target.value || 0)))} /></label>
  );
  return (
    <div className="rounded-lg border border-line p-2 flex flex-col gap-2 text-sm bg-surface-hover/40">
      <div className="flex flex-wrap gap-1">
        {BEWEGUNGEN.map(b => <button key={b.id} className={`chip ${o.art === b.id ? "chip-on" : ""}`} title={b.text} onClick={() => setO({ ...o, art: b.id })}>{b.icon} {b.label}</button>)}
      </div>
      <p className="text-xs text-muted">{art.text} Das aktuelle Bild wird Bild 1, dahinter kommen die neuen Bilder; ein Tag markiert sie.</p>
      <div className="flex flex-wrap gap-3 items-center">
        {zahl("Bilder", o.bilder, v => setO({ ...o, bilder: v }), 2, Math.max(2, Math.min(32, frei)))}
        {zahl("Dauer (ms)", dauer, setDauer, 20, 2000, 10)}
        {o.art === "verschieben" && <>{zahl("dx", o.dx, v => setO({ ...o, dx: v }), -256, 256)}{zahl("dy", o.dy, v => setO({ ...o, dy: v }), -256, 256)}
          <Haken an={o.umlauf} setze={v => setO({ ...o, umlauf: v })} titel="was hinausgleitet, kommt gegenüber wieder herein">Umlauf</Haken></>}
        {(o.art === "huepfen" || o.art === "wackeln") && zahl(o.art === "huepfen" ? "Höhe (px)" : "Weite (px)", o.weite, v => setO({ ...o, weite: v }), 1, 64)}
        {o.art === "drehen" && zahl("Winkel (°)", o.winkel, v => setO({ ...o, winkel: v }), -720, 720, 15)}
        {(o.art === "pulsieren" || o.art === "atmen") && zahl("Stärke (%)", Math.round(o.staerke * 100), v => setO({ ...o, staerke: v / 100 }), 1, 80)}
        {o.art === "farbzyklus" && <>{zahl("Farbe von", o.farbVon, v => setO({ ...o, farbVon: v }), 1, p.palette.length)}{zahl("bis", o.farbBis, v => setO({ ...o, farbBis: v }), 1, p.palette.length)}</>}
        <Haken an={alle} setze={setAlle} titel="sonst bewegt sich nur die aktive Ebene, die anderen bleiben stehen">alle Ebenen</Haken>
        <button className="btn-primary py-1" disabled={frei < 2} onClick={() => los(o, alle, dauer)}>Erzeugen</button>
      </div>
      {frei < 2 && <p className="text-xs text-bad">Es passen keine weiteren Bilder hinein (höchstens {MAX_BILDER}).</p>}
    </div>
  );
}

/** Modifier der aktiven Ebene: Farbe und Umriss, nicht-destruktiv; »Anwenden« backt sie ein */
function ModifierListe({ ebene, p, merke, aendern, neu }: { ebene: Ebene; p: Projekt; merke: () => void; aendern: (f: () => void) => void; neu: () => void }) {
  const [offen, setOffen] = useState<string | null>(null);
  const mods = ebene.mods ?? [];
  const regler = (m: Modifier, feld: string, label: string, min: number, max: number, einheit = "") => {
    const wert = (m as unknown as Record<string, number>)[feld];
    return (
      <label className="flex items-center gap-2 text-xs">{label}
        <input type="range" min={min} max={max} value={wert} className="flex-1" onPointerDown={merke}
          onChange={e => { (m as unknown as Record<string, number>)[feld] = +e.target.value; neu(); }} />
        <span className="w-10 text-right">{wert}{einheit}</span></label>
    );
  };
  return (
    <div className="border-t border-line pt-2 flex flex-col gap-1">
      <div className="flex items-center gap-1 text-xs">
        <span className="font-semibold flex-1">✨ Modifier</span>
        <button className="chip" title="Farbton, Sättigung, Helligkeit, Kontrast" onClick={() => { const m = neuerModifier("farbe", neueId()); aendern(() => { ebene.mods = [...mods, m]; }); setOffen(m.id); }}>＋ Farbe</button>
        <button className="chip" title="Umriss außen oder innen" onClick={() => { const m = neuerModifier("umriss", neueId()); aendern(() => { ebene.mods = [...mods, m]; }); setOffen(m.id); }}>＋ Umriss</button>
      </div>
      {mods.map((m, k) => (
        <div key={m.id} className="rounded-lg border border-line p-1.5 flex flex-col gap-1">
          <div className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={m.an} title="ein/aus" onChange={() => aendern(() => { m.an = !m.an; })} />
            <button className="flex-1 text-left font-semibold" onClick={() => setOffen(offen === m.id ? null : m.id)}>{m.art === "farbe" ? "🎨 Farbe" : "◻ Umriss"} {offen === m.id ? "▾" : "▸"}</button>
            <button className="text-muted" disabled={k === 0} title="früher anwenden" onClick={() => aendern(() => { const l = [...mods]; [l[k - 1], l[k]] = [l[k], l[k - 1]]; ebene.mods = l; })}>▲</button>
            <button className="text-muted hover:text-bad" title="entfernen" onClick={() => aendern(() => { ebene.mods = mods.filter(x => x !== m); })}>×</button>
          </div>
          {offen === m.id && (m.art === "farbe" ? <>
            {regler(m, "farbton", "Farbton", -180, 180, "°")}
            {regler(m, "saettigung", "Sättigung", -100, 100)}
            {regler(m, "helligkeit", "Helligkeit", -100, 100)}
            {regler(m, "kontrast", "Kontrast", -100, 100)}
            {regler(m, "deckkraft", "Deckkraft", 0, 100, " %")}
          </> : <>
            <div className="flex items-center gap-2 text-xs">
              <select className="input text-xs py-0.5" value={m.lage} onChange={e => aendern(() => { m.lage = e.target.value as "aussen" | "innen"; })}>
                <option value="aussen">außen</option><option value="innen">innen</option>
              </select>
              <input type="color" value={m.farbe} onFocus={merke} onChange={e => { m.farbe = e.target.value; neu(); }} />
              <span className="text-muted">oder</span>
              <select className="input text-xs py-0.5 w-20" value="" onChange={e => { const c = e.target.value; if (c) aendern(() => { m.farbe = c; }); }}>
                <option value="">Palette …</option>
                {p.palette.map((c, i) => <option key={i} value={c} style={{ background: c }}>{i + 1}: {c}</option>)}
              </select>
            </div>
            {regler(m, "breite", "Breite", 1, 8, " px")}
            {regler(m, "deckkraft", "Deckkraft", 0, 100, " %")}
          </>)}
        </div>
      ))}
      {mods.length > 0 && <button className="chip self-start" title="Effekte fest in die Pixel aller Bilder schreiben; neue Farben kommen in die Palette"
        onClick={() => aendern(() => einbacken(p, ebene.id))}>✔ Anwenden (einbacken)</button>}
      {!mods.length && <p className="text-xs text-muted">Effekte, die die Pixel nicht verändern und in allen Bildern wirken.</p>}
    </div>
  );
}
