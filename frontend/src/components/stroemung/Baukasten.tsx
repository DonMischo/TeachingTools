"use client";
/**
 * Baukasten von »Druck & Strömung«: eigene Rohrnetze auf dem Raster bauen,
 * mit Wasser, Hydrauliköl oder Luft füllen und zusehen, was passiert.
 * Bedienung wie bei den Stromkreisen: Teil links wählen und setzen (oder
 * aufziehen), Leitungen ziehen, verschieben, Enden ziehen, R dreht, Entf löscht.
 * Modell, Löser-Brücke und Dateien: lib/stroemung/baukasten*.ts.
 */
import { useEffect, useRef, useState } from "react";
import type { Auswahl, Punkt } from "@/lib/raster/editor";
import { BK_TEILE, LEER, RASTER_M, druckAn, editor, simulation, wert, type BkArt, type BkTeil, type Baukasten as Netz } from "@/lib/stroemung/baukasten";
import { BEISPIELE } from "@/lib/stroemung/baukastenBeispiele";
import { alsDatei, alsVorgabe, liesBaukasten, vorgabeAus, type Vorgabe } from "@/lib/stroemung/baukastenDatei";
import { MEDIEN, P_LUFT, type Medium } from "@/lib/stroemung/modell";
import type { Stroemung } from "@/lib/stroemung/loeser";
import { api } from "@/lib/api";
import KlassenVorgabe from "../stromkreis/KlassenVorgabe";
import { Karte, Regler, Wahl, Werte, bar, useTakt, zahl } from "./rahmen";

type Werkzeug = "auswahl" | "leitung" | BkArt;
const G = 24;                                    // px je Kästchen bei Zoom 1
const HOEHE_PX = 560;
/** Standardlage, wenn man nur klickt statt aufzuziehen. */
const STANDARD: Record<BkArt, [number, number]> = {
  quelle: [0, 2], pumpe: [4, 0], rohr: [6, 0], ventil: [3, 0], rueckschlag: [3, 0], druckminderer: [4, 0], durchfluss: [3, 0],
  behaelter: [0, -4], kessel: [0, -3], polster: [0, -2], hahn: [0, 2], zylinder: [6, 0], manometer: [0, -2],
};
/** Startwerte: ändert man sie, beginnt das Teil von vorn (Füllung, Kesseldruck). */
const STARTWERTE = new Set(["fuellung", "druck@kessel"]);
const GRUPPEN: { titel: string; teile: Werkzeug[] }[] = [
  { titel: "Antrieb", teile: ["quelle", "pumpe"] },
  { titel: "Leitungen", teile: ["leitung", "rohr", "ventil", "rueckschlag", "druckminderer"] },
  { titel: "Speicher", teile: ["behaelter", "kessel", "polster"] },
  { titel: "Verbraucher", teile: ["hahn", "zylinder"] },
  { titel: "Messen", teile: ["manometer", "durchfluss"] },
];
const lmin = (q: number) => `${zahl(q * 60000, Math.abs(q * 60000) >= 10 ? 0 : 1)} L/min`;
const START = BEISPIELE[1].baukasten;

interface Verlauf { liste: Netz[]; pos: number }
type Ziehen =
  | { modus: "pan"; sx: number; sy: number; ox: number; oy: number }
  | { modus: "teil"; w: Auswahl; start: Punkt; basis: Netz }
  | { modus: "ende"; w: Auswahl; ende: "a" | "b"; basis: Netz }
  | { modus: "neu"; start: Punkt };

interface Props {
  code?: string | null;
  lehrkraft?: boolean;
  vorgabe?: Vorgabe | null;
  setVorgabe?: (v: Vorgabe | null) => void;
}

export default function Baukasten({ code, lehrkraft = false, vorgabe = null, setVorgabe }: Props) {
  const [verlauf, setVerlauf] = useState<Verlauf>({ liste: [vorgabe && !lehrkraft ? vorgabe.baukasten : START], pos: 0 });
  const bk = verlauf.liste[verlauf.pos];
  const [entwurf, setEntwurf] = useState<Netz | null>(null);
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [werkzeug, setWerkzeug] = useState<Werkzeug>("auswahl");
  const [ansicht, setAnsicht] = useState({ x: 60, y: 160, zoom: 1.4 });
  const [vorschau, setVorschau] = useState<{ a: Punkt; b: Punkt } | null>(null);
  const [laufend, setLaufend] = useState(true);
  const [tempo, setTempo] = useState(1);
  const [hinweis, setHinweis] = useState<string | null>(BEISPIELE[1].idee);
  const [dateiFehler, setDateiFehler] = useState<string | null>(null);
  const [neustart, setNeustart] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const ziehen = useRef<Ziehen | null>(null);
  const dateiWahl = useRef<HTMLInputElement>(null);
  const zeige = entwurf ?? bk;

  const aendern = (n: Netz) => setVerlauf(v => {
    const liste = [...v.liste.slice(0, v.pos + 1), n].slice(-100);
    return { liste, pos: liste.length - 1 };
  });
  const laden = (n: Netz, idee?: string) => { aendern(n); setAuswahl(null); setWerkzeug("auswahl"); setHinweis(idee ?? null); setNeustart(k => k + 1); einpassen(n); };

  // ── Löser: bei jeder Änderung neu bauen, Speicherstände mitnehmen ──
  const sim = useRef<Stroemung | null>(null);
  const neuStart = useRef(new Set<string>());
  const letzterNeustart = useRef(-1);
  useEffect(() => {
    const alt = sim.current && letzterNeustart.current === neustart ? sim.current.stand() : null;
    const s = simulation(bk);
    if (alt) s.setzeStand(alt, neuStart.current);
    s.schritt(0.01);
    neuStart.current = new Set();
    letzterNeustart.current = neustart;
    sim.current = s;
  }, [bk, neustart]);
  // Fließen: Strichmuster je Leitung/Rohr mit v ∝ Q
  const striche = useRef(new Map<string, SVGPathElement>());
  const phase = useRef(new Map<string, number>());
  useTakt(dt => {
    const s = sim.current;
    if (!s) return;
    if (laufend) s.laufe(Math.min(0.05, dt) * tempo, 0.01);
    for (const [id, el] of striche.current) {
      const q = s.fluss(id);
      const v = Math.max(-240, Math.min(240, q * 60000 * 4));
      const p = ((phase.current.get(id) ?? 0) - v * dt) % 1000;
      phase.current.set(id, p);
      el.setAttribute("stroke-dashoffset", String(p));
      el.setAttribute("stroke-opacity", Math.abs(q) > 1e-7 ? "0.85" : "0");
    }
  });
  const merke = (id: string) => (el: SVGPathElement | null) => { if (el) striche.current.set(id, el); else striche.current.delete(id); };
  const s = sim.current;

  // ── Vorgabe der Sitzung ──
  const festlegen = async (aufgabe: string) => {
    if (!code) return;
    const sitzung = await api.toolSessions.einstellungen(code, alsVorgabe(bk, aufgabe));
    setVorgabe?.(vorgabeAus(sitzung.settings));
  };
  const entfernen = async () => {
    if (!code) return;
    await api.toolSessions.einstellungen(code, {});
    setVorgabe?.(null);
  };

  // ── Ansicht ──
  const welt = (cx: number, cy: number) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: (cx - r.left - ansicht.x) / (G * ansicht.zoom), y: (cy - r.top - ansicht.y) / (G * ansicht.zoom) };
  };
  const einpassen = (n: Netz = bk) => {
    const pts = [...n.bauteile.flatMap(t => [t.a, t.b]), ...n.draehte.flatMap(d => [d.a, d.b])];
    const breite = svg.current?.getBoundingClientRect().width ?? 800;
    if (!pts.length) { setAnsicht({ x: 60, y: 160, zoom: 1.4 }); return; }
    const x0 = Math.min(...pts.map(p => p.x)) - 3, x1 = Math.max(...pts.map(p => p.x)) + 3;
    const y0 = Math.min(...pts.map(p => p.y)) - 3, y1 = Math.max(...pts.map(p => p.y)) + 3;
    const zoom = Math.max(0.4, Math.min(2.5, Math.min(breite / ((x1 - x0) * G), HOEHE_PX / ((y1 - y0) * G))));
    setAnsicht({ zoom, x: (breite - (x1 + x0) * G * zoom) / 2, y: (HOEHE_PX - (y1 + y0) * G * zoom) / 2 });
  };
  // Einpassen, sobald die Fläche ihre echte Breite hat (in versteckten Reitern ist sie anfangs 0).
  const eingepasst = useRef(false);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!eingepasst.current && el.getBoundingClientRect().width > 50) { eingepasst.current = true; einpassen(); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      setAnsicht(a => {
        const zoom = Math.max(0.4, Math.min(3, a.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        return { zoom, x: mx - ((mx - a.x) * zoom) / a.zoom, y: my - ((my - a.y) * zoom) / a.zoom };
      });
    };
    el.addEventListener("wheel", rad, { passive: false });
    return () => el.removeEventListener("wheel", rad);
  }, []);

  // ── Zeiger ──
  const runde = (p: { x: number; y: number }): Punkt => ({ x: Math.round(p.x), y: Math.round(p.y) });
  const runter = (e: React.PointerEvent) => {
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* Zeiger schon weg */ }
    const p = welt(e.clientX, e.clientY), q = runde(p);
    if (werkzeug !== "auswahl") { ziehen.current = { modus: "neu", start: q }; setVorschau({ a: q, b: q }); return; }
    const w = editor.treffer(bk, p);
    if (w) {
      setAuswahl({ art: w.art, id: w.id });
      ziehen.current = w.ende ? { modus: "ende", w, ende: w.ende, basis: bk } : { modus: "teil", w, start: q, basis: bk };
    } else {
      setAuswahl(null);
      ziehen.current = { modus: "pan", sx: e.clientX, sy: e.clientY, ox: ansicht.x, oy: ansicht.y };
    }
  };
  const bewegen = (e: React.PointerEvent) => {
    const z = ziehen.current;
    if (!z) return;
    if (z.modus === "pan") { setAnsicht(a => ({ ...a, x: z.ox + e.clientX - z.sx, y: z.oy + e.clientY - z.sy })); return; }
    const q = runde(welt(e.clientX, e.clientY));
    if (z.modus === "neu") setVorschau({ a: z.start, b: q });
    if (z.modus === "teil") setEntwurf(editor.verschiebe(z.basis, z.w, q.x - z.start.x, q.y - z.start.y));
    if (z.modus === "ende") setEntwurf(editor.verschiebeEnde(z.basis, z.w, z.ende, q));
  };
  const hoch = (e: React.PointerEvent) => {
    const z = ziehen.current;
    ziehen.current = null;
    if (!z) return;
    if ((z.modus === "teil" || z.modus === "ende") && entwurf && entwurf !== z.basis) aendern(entwurf);
    setEntwurf(null);
    if (z.modus === "neu") {
      const q = runde(welt(e.clientX, e.clientY));
      setVorschau(null);
      if (werkzeug === "leitung") { if (q.x !== z.start.x || q.y !== z.start.y) aendern(editor.fuegeDrahtHinzu(bk, z.start, q)); return; }
      const art = werkzeug as BkArt;
      const b = q.x !== z.start.x || q.y !== z.start.y ? q : { x: z.start.x + STANDARD[art][0], y: z.start.y + STANDARD[art][1] };
      const r = editor.fuegeBauteilHinzu(bk, art, z.start, b);
      aendern(r.schaltung);
      setAuswahl({ art: "bauteil", id: r.id });
      setWerkzeug("auswahl");
    }
  };
  const doppelklick = (e: React.MouseEvent) => {
    const w = editor.treffer(bk, welt(e.clientX, e.clientY));
    const t = w?.art === "bauteil" ? bk.bauteile.find(x => x.id === w.id) : undefined;
    if (t && (t.art === "hahn" || t.art === "ventil")) aendern(editor.setzeWert(bk, t.id, "oeffnung", wert(t, "oeffnung") > 0 ? 0 : 1));
  };

  // ── Auswahl bearbeiten ──
  const teil = auswahl?.art === "bauteil" ? bk.bauteile.find(t => t.id === auswahl.id) : undefined;
  const draht = auswahl?.art === "draht" ? bk.draehte.find(d => d.id === auswahl.id) : undefined;
  const setzeWert = (t: BkTeil, k: string, v: number) => {
    if (STARTWERTE.has(k) || STARTWERTE.has(`${k}@${t.art}`)) neuStart.current.add(t.id);
    aendern(editor.setzeWert(bk, t.id, k, v));
  };
  const loeschen = () => { if (auswahl) { aendern(editor.loesche(bk, auswahl)); setAuswahl(null); } };
  const drehen = () => { if (auswahl) aendern(editor.drehe(bk, auswahl)); };
  const rueck = () => setVerlauf(v => ({ ...v, pos: Math.max(0, v.pos - 1) }));
  const vor = () => setVerlauf(v => ({ ...v, pos: Math.min(v.liste.length - 1, v.pos + 1) }));
  const tasten = useRef({ loeschen, drehen, rueck, vor });
  useEffect(() => { tasten.current = { loeschen, drehen, rueck, vor }; });
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && ["INPUT", "SELECT", "TEXTAREA"].includes(ziel.tagName)) return;
      const t = tasten.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) t.vor(); else t.rueck(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); t.vor(); }
      else if (e.key === "Delete" || e.key === "Backspace") t.loeschen();
      else if (e.key === "r" || e.key === "R") t.drehen();
      else if (e.key === "Escape") { setWerkzeug("auswahl"); setAuswahl(null); }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

  // ── Dateien ──
  const speichern = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([alsDatei(bk)], { type: "application/json" }));
    a.download = "rohrnetz.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const oeffnen = async (datei: File) => {
    setDateiFehler(null);
    try {
      const r = liesBaukasten(JSON.parse(await datei.text()));
      if ("fehler" in r) setDateiFehler(r.fehler); else laden(r.baukasten);
    } catch { setDateiFehler("Die Datei ist kein gültiges JSON."); }
  };

  // ── Zeichnen ──
  const druckPunkte = s ? [...zeige.bauteile.flatMap(t => [t.a, t.b]), ...zeige.draehte.flatMap(d => [d.a, d.b])].map(p => { try { return druckAn(s, p); } catch { return 0; } }) : [];
  const pMax = Math.max(0.2e5, ...druckPunkte.map(Math.abs));
  const druck = (p: Punkt) => { try { return s ? druckAn(s, p) : 0; } catch { return 0; } };
  const fluss = (id: string) => { try { return s ? s.fluss(id) : 0; } catch { return 0; } };
  const zustand = (id: string) => { try { return s ? s.zustand(id) : 0; } catch { return 0; } };
  const farbe = (p: number) => {
    const f = Math.min(1, Math.abs(p) / pMax);
    if (zeige.medium === "luft") return p >= 0 ? `hsl(190 30% ${Math.round(78 - 38 * f)}%)` : `hsl(0 60% ${Math.round(75 - 30 * f)}%)`;
    if (zeige.medium === "oel") return p >= 0 ? `hsl(40 85% ${Math.round(72 - 35 * f)}%)` : `hsl(0 60% ${Math.round(75 - 30 * f)}%)`;
    return p >= 0 ? `hsl(205 80% ${Math.round(75 - 40 * f)}%)` : `hsl(0 70% ${Math.round(75 - 30 * f)}%)`;
  };
  const px = (p: Punkt) => ({ x: p.x * G, y: p.y * G });
  const dichte = MEDIEN[zeige.medium].dichte;
  const schilder: { x: number; y: number; t: string; rot?: boolean }[] = [];

  const zeichneTeil = (t: BkTeil) => {
    const A = px(t.a), B = px(t.b);
    const L = Math.hypot(B.x - A.x, B.y - A.y), winkel = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
    const mitte = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const quer = { x: -(B.y - A.y) / (L || 1), y: (B.x - A.x) / (L || 1) };
    // Neben dem Körper: bei senkrechten Teilen um die halbe Schildbreite weiter, sonst deckt es den Körper zu.
    const schild = (t2: string, abstand = 22, rot = false) => {
      const weg = abstand + Math.abs(quer.x) * (t2.length * 6.4 + 12) / 2;
      schilder.push({ x: mitte.x + quer.x * weg, y: mitte.y + quer.y * weg + (Math.abs(quer.x) > 0.5 ? 0 : 4), t: t2, rot });
    };
    const pA = druck(t.a), pB = druck(t.b);
    const gewaehlt = auswahl?.art === "bauteil" && auswahl.id === t.id;
    const info = BK_TEILE[t.art];
    const metall = "#56616d";
    const koerper = (() => {
      switch (t.art) {
        case "rohr": {
          const dmm = wert(t, "durchmesser") * 1000, w = 4 + dmm * 0.18;
          schild(`⌀ ${zahl(dmm, 0)} mm · ${lmin(fluss(t.id))}`, w / 2 + 14);
          return <>
            <line x1={0} y1={0} x2={L} y2={0} stroke="#7b8794" strokeWidth={w + 4} strokeLinecap="round" />
            <line x1={0} y1={0} x2={L} y2={0} stroke={farbe((pA + pB) / 2)} strokeWidth={w} strokeLinecap="round" />
            <path ref={merke(t.id)} d={`M0 0 H${L}`} stroke="#fff" strokeWidth={Math.max(2, w / 4)} strokeDasharray="5 11" strokeLinecap="round" fill="none" />
          </>;
        }
        case "pumpe":
          // Förderdruck samt Höhe: Was die Pumpe schafft, steckt auch im Hochheben.
          schild(`+${bar(pB - pA + dichte * 9.81 * (t.a.y - t.b.y) * RASTER_M)} · ${lmin(fluss(t.id))}`, 26);
          return <>
            <line x1={0} y1={0} x2={L} y2={0} stroke={metall} strokeWidth={3} />
            <circle cx={L / 2} cy={0} r={13} fill="#2e6fb5" stroke="#1d3d63" strokeWidth={2} />
            <path d={`M${L / 2 - 6} -7 L${L / 2 + 8} 0 L${L / 2 - 6} 7 Z`} fill="#fff" />
          </>;
        case "ventil": {
          const o = wert(t, "oeffnung");
          schild(`${zahl(o * 100, 0)} % · ${lmin(fluss(t.id))}`, 22);
          return <>
            <line x1={0} y1={0} x2={L} y2={0} stroke={metall} strokeWidth={3} />
            <path d={`M${L / 2 - 11} -9 L${L / 2 + 11} 9 L${L / 2 + 11} -9 L${L / 2 - 11} 9 Z`} fill={o > 0 ? "#f2f4f6" : "#d64541"} stroke={metall} strokeWidth={2} />
            <line x1={L / 2} y1={0} x2={L / 2} y2={-15} stroke={metall} strokeWidth={2} /><line x1={L / 2 - 7} y1={-15} x2={L / 2 + 7} y2={-15} stroke="#b03a2e" strokeWidth={4} />
          </>;
        }
        case "rueckschlag":
          return <>
            <line x1={0} y1={0} x2={L} y2={0} stroke={metall} strokeWidth={3} />
            <path d={`M${L / 2 - 9} -9 L${L / 2 + 7} 0 L${L / 2 - 9} 9 Z`} fill="#f2f4f6" stroke={metall} strokeWidth={2} />
            <line x1={L / 2 + 8} y1={-10} x2={L / 2 + 8} y2={10} stroke={metall} strokeWidth={3} />
          </>;
        case "druckminderer":
          schild(`soll ${bar(wert(t, "druck"), 1)} · hinten ${bar(pB, 1)}`, 26);
          return <>
            <line x1={0} y1={0} x2={L} y2={0} stroke={metall} strokeWidth={3} />
            <rect x={L / 2 - 13} y={-13} width={26} height={26} fill="#f2f4f6" stroke={metall} strokeWidth={2} />
            <path d={`M${L / 2 - 8} 8 L${L / 2 + 8} -8 M${L / 2 + 2} -8 H${L / 2 + 8} V-2`} stroke="#2e6fb5" strokeWidth={2.5} fill="none" />
          </>;
        case "durchfluss":
          schild(lmin(fluss(t.id)), 22);
          return <>
            <line x1={0} y1={0} x2={L} y2={0} stroke={metall} strokeWidth={3} />
            <circle cx={L / 2} cy={0} r={11} fill="#f2f4f6" stroke={metall} strokeWidth={2} />
            <path d={`M${L / 2 - 6} 0 H${L / 2 + 6} M${L / 2 + 2} -4 L${L / 2 + 6} 0 L${L / 2 + 2} 4`} stroke="#2e6fb5" strokeWidth={2} fill="none" />
          </>;
        case "quelle":
          schild(bar(wert(t, "druck"), 1), 22);
          return <>
            <line x1={0} y1={0} x2={Math.max(0, L - 12)} y2={0} stroke={metall} strokeWidth={3} />
            <circle cx={L} cy={0} r={12} fill="#d64541" stroke="#7b241c" strokeWidth={2} />
            <path d={`M${L - 5} -6 L${L + 6} 0 L${L - 5} 6 Z`} transform={`rotate(180 ${L} 0)`} fill="#fff" />
          </>;
        case "behaelter": {
          const h = Math.max(RASTER_M, (L / G) * RASTER_M);
          const fuell = Math.max(0, Math.min(1, zustand(t.id) / h));
          const w = 46;
          schild(`${zahl(zustand(t.id) * 100, 0)} cm`, w / 2 + 18);
          return <>
            {zeige.medium !== "luft" && <rect x={0} y={-w / 2} width={fuell * L} height={w} fill={farbe(pA)} opacity={0.9} />}
            <path d={`M${L} ${-w / 2} H0 V${w / 2} H${L}`} fill="none" stroke={metall} strokeWidth={3} />
          </>;
        }
        case "kessel": {
          const p = zustand(t.id);
          schild(bar(p, 1), 26);
          return <>
            <line x1={0} y1={0} x2={8} y2={0} stroke={metall} strokeWidth={3} />
            <rect x={8} y={-18} width={Math.max(20, L - 8)} height={36} rx={16} fill={farbe(p)} stroke={metall} strokeWidth={3} />
          </>;
        }
        case "polster":
          schild(bar(zustand(t.id), 1), 26);
          return <>
            <line x1={0} y1={0} x2={Math.max(0, L - 16)} y2={0} stroke={metall} strokeWidth={3} />
            <circle cx={L} cy={0} r={16} fill="#f2f4f6" stroke="#d64541" strokeWidth={3} />
            <line x1={L} y1={-16} x2={L} y2={16} stroke="#7b241c" strokeWidth={2} />
          </>;
        case "hahn": {
          const o = wert(t, "oeffnung"), q = fluss(t.id);
          schild(o > 0 ? lmin(q) : "zu", 24);
          return <>
            <line x1={0} y1={0} x2={Math.max(0, L - 8)} y2={0} stroke={metall} strokeWidth={4} />
            <rect x={L - 10} y={-8} width={14} height={16} rx={3} fill={o > 0 ? "#2e9e3e" : "#b03a2e"} />
            {q > 1e-7 && <path d={`M${L + 4} 0 q ${8 + q * 6e4} 0 ${12 + q * 8e4} ${10 + q * 4e4}`} fill="none" stroke={farbe(pA)} strokeWidth={3 + Math.min(6, q * 3e4)} strokeLinecap="round" />}
          </>;
        }
        case "zylinder": {
          const anteil = Math.max(0, Math.min(1, zustand(t.id) / wert(t, "hub")));
          const kolben = 8 + anteil * (L * 0.85 - 8);
          schild(`${zahl(zustand(t.id) * 100, 1)} cm · ${zahl(Math.max(0, pA) * Math.PI * wert(t, "durchmesser") ** 2 / 4, 0)} N`, 30);
          return <>
            <rect x={0} y={-16} width={L * 0.85} height={32} fill="#c7cdd3" stroke={metall} strokeWidth={2.5} />
            <rect x={0} y={-14} width={kolben} height={28} fill={farbe(pA)} />
            <rect x={kolben} y={-14} width={6} height={28} fill={metall} />
            <rect x={kolben + 6} y={-4} width={L * 0.85 - kolben + anteil * L * 0.5} height={8} fill="#8a949e" />
            <rect x={L * 0.85 + anteil * L * 0.5} y={-14} width={16} height={28} rx={3} fill="#a0703c" />
          </>;
        }
        case "manometer": {
          const w2 = (-135 + 270 * Math.max(0, Math.min(1, (pA / pMax + 1) / 2))) * Math.PI / 180;
          schild(bar(pA), 26, pA < 0);
          return <>
            <line x1={0} y1={0} x2={Math.max(0, L - 13)} y2={0} stroke={metall} strokeWidth={3} />
            <circle cx={L} cy={0} r={13} fill="#f8f8f4" stroke={metall} strokeWidth={2.5} />
            <line x1={L} y1={0} x2={L + 10 * Math.sin(w2)} y2={-10 * Math.cos(w2)} stroke="#c0392b" strokeWidth={2} transform={`rotate(${-winkel} ${L} 0)`} />
          </>;
        }
      }
    })();
    return (
      <g key={t.id}>
        {gewaehlt && <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--accent)" strokeOpacity={0.45} strokeWidth={34} strokeLinecap="round" />}
        <g transform={`translate(${A.x} ${A.y}) rotate(${winkel})`}>{koerper}</g>
        {(info.pole === 2 ? [A, B] : [A]).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5} style={{ fill: "var(--text)" }} />)}
      </g>
    );
  };

  const z = ansicht.zoom;
  const chip = (an: boolean) => `px-2.5 py-1.5 rounded-lg text-sm font-bold transition-colors text-left ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Wahl werte={[{ id: "wasser", label: "💧 Wasser" }, { id: "oel", label: "🛢️ Öl" }, { id: "luft", label: "💨 Luft" }]} wert={bk.medium} setze={(m: Medium) => { aendern({ ...bk, medium: m }); setNeustart(k => k + 1); }} />
        <button className="btn btn-primary" onClick={() => setLaufend(l => !l)}>{laufend ? "⏸ Anhalten" : "▶ Weiter"}</button>
        <select className="input w-auto" value={tempo} onChange={e => setTempo(Number(e.target.value))} aria-label="Tempo">
          {[1, 5, 20].map(t => <option key={t} value={t}>{t === 1 ? "Echtzeit" : `Zeitraffer ×${t}`}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={() => setNeustart(k => k + 1)} title="Behälter, Kessel und Zylinder auf ihre Startwerte">⟲ Neu starten</button>
        <select className="input w-auto" value="" aria-label="Beispiel laden" onChange={e => { const b = BEISPIELE.find(x => x.id === e.target.value); if (b) laden(b.baukasten, b.idee); }}>
          <option value="">📚 Beispiel laden …</option>
          {BEISPIELE.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={speichern} title="Rohrnetz als JSON-Datei speichern">💾 Speichern</button>
        <button className="btn btn-secondary" onClick={() => dateiWahl.current?.click()} title="Rohrnetz aus einer JSON-Datei laden">📂 Öffnen</button>
        <input ref={dateiWahl} type="file" accept=".json,application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) oeffnen(f); e.target.value = ""; }} />
        <div className="flex gap-1 ml-auto">
          <button className="btn btn-secondary" onClick={rueck} disabled={verlauf.pos === 0} title="Rückgängig (Strg+Z)">↶</button>
          <button className="btn btn-secondary" onClick={vor} disabled={verlauf.pos >= verlauf.liste.length - 1} title="Wiederholen (Strg+Y)">↷</button>
          <button className="btn btn-secondary" onClick={() => einpassen()} title="Alles zeigen">⤢</button>
          <button className="btn btn-danger" onClick={() => laden({ ...LEER, medium: bk.medium })} title="Alles löschen">🗑</button>
        </div>
      </div>
      {dateiFehler && <div className="rounded-lg border border-bad p-2 text-sm text-bad">Konnte die Datei nicht öffnen: {dateiFehler}</div>}
      {hinweis && <div className="text-sm text-muted">💡 {hinweis}</div>}
      {vorgabe && !lehrkraft && (
        <div className="card p-3 flex flex-wrap items-start justify-between gap-3">
          <div className="text-sm"><div className="font-bold">📋 Aufgabe</div><div className="whitespace-pre-wrap">{vorgabe.aufgabe || "Deine Lehrkraft hat dir dieses Rohrnetz mitgegeben. Probiere es aus und baue es weiter."}</div></div>
          <button className="btn btn-secondary" onClick={() => laden(vorgabe.baukasten)}>⟲ Zurück zur Vorgabe</button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[170px_minmax(0,1fr)_270px]">
        {/* Bauteilkiste */}
        <div className="card p-2 flex flex-col gap-2 order-2 lg:order-1">
          <button className={chip(werkzeug === "auswahl")} onClick={() => setWerkzeug("auswahl")}>👆 Auswählen</button>
          {GRUPPEN.map(g => (
            <div key={g.titel} className="flex flex-col gap-0.5">
              <div className="text-xs font-bold text-muted px-1 mt-1">{g.titel}</div>
              {g.teile.map(w => (
                <button key={w} className={chip(werkzeug === w)} onClick={() => setWerkzeug(w)} title={w === "leitung" ? "Ideale Leitung von Punkt zu Punkt ziehen" : BK_TEILE[w as BkArt].hilfe}>
                  {w === "leitung" ? "〰️ Leitung" : `${BK_TEILE[w as BkArt].icon} ${BK_TEILE[w as BkArt].name}`}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Zeichenfläche */}
        <div className="flex flex-col gap-2 min-w-0 order-1 lg:order-2">
          <div className="card p-0 overflow-hidden">
            <svg
              ref={svg} width="100%" height={HOEHE_PX} className="block select-none touch-none"
              style={{ cursor: werkzeug === "auswahl" ? "default" : "crosshair", background: "var(--bg)" }}
              onPointerDown={runter} onPointerMove={bewegen} onPointerUp={hoch} onDoubleClick={doppelklick}
              role="img" aria-label="Baukasten-Zeichenfläche"
            >
              <defs>
                <pattern id="bkRaster" x={ansicht.x} y={ansicht.y} width={G * z} height={G * z} patternUnits="userSpaceOnUse">
                  <circle cx={0} cy={0} r={1.2} style={{ fill: "var(--text-muted)" }} opacity={0.5} />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#bkRaster)" />
              <g transform={`translate(${ansicht.x} ${ansicht.y}) scale(${z})`}>
                {zeige.draehte.map(d => {
                  const A = px(d.a), B = px(d.b);
                  const gew = auswahl?.art === "draht" && auswahl.id === d.id;
                  return (
                    <g key={d.id}>
                      {gew && <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--accent)" strokeOpacity={0.45} strokeWidth={18} strokeLinecap="round" />}
                      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#7b8794" strokeWidth={9} strokeLinecap="round" />
                      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={farbe((druck(d.a) + druck(d.b)) / 2)} strokeWidth={6} strokeLinecap="round" />
                      <path ref={merke(d.id)} d={`M${A.x} ${A.y} L${B.x} ${B.y}`} stroke="#fff" strokeWidth={2.5} strokeDasharray="4 10" strokeLinecap="round" fill="none" strokeOpacity={0} />
                    </g>
                  );
                })}
                {zeige.bauteile.map(zeichneTeil)}
                {vorschau && (
                  <line x1={vorschau.a.x * G} y1={vorschau.a.y * G} x2={vorschau.b.x * G} y2={vorschau.b.y * G} stroke="var(--accent)" strokeWidth={4} strokeDasharray="6 5" />
                )}
                {schilder.map((sch, i) => {
                  const w = sch.t.length * 6.4 + 12;
                  return (
                    <g key={i} pointerEvents="none">
                      <rect x={sch.x - w / 2} y={sch.y - 11} width={w} height={18} rx={9} style={{ fill: "var(--surface)" }} stroke={sch.rot ? "#d64541" : "#e0a000"} strokeWidth={1.2} opacity={0.95} />
                      <text x={sch.x} y={sch.y + 2} textAnchor="middle" fontSize={11.5} fontWeight={700} style={{ fill: "var(--text)" }}>{sch.t}</text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
          <div className="text-xs text-muted">
            1 Kästchen = {zahl(RASTER_M, 1)} m Höhe. Farbe = Überdruck (dunkler = mehr, rot = Unterdruck), weiße Striche zeigen, wohin es fließt.
            Doppelklick auf Hahn oder Ventil öffnet/schließt. Leere Fläche ziehen verschiebt, Mausrad zoomt.
          </div>
        </div>

        {/* Inspektor */}
        <div className="flex flex-col gap-3 order-3 text-sm">
          {teil ? (
            <Karte titel={`${BK_TEILE[teil.art].icon} ${BK_TEILE[teil.art].name}`}>
              <p className="text-muted">{BK_TEILE[teil.art].hilfe}</p>
              {BK_TEILE[teil.art].felder.map(f => (
                <Regler key={f.schluessel} label={`${f.label}: ${zahl(wert(teil, f.schluessel) / f.faktor, 2)} ${f.einheit}`}
                  min={f.min} max={f.max} step={f.schritt} wert={wert(teil, f.schluessel) / f.faktor}
                  setze={v => setzeWert(teil, f.schluessel, v * f.faktor)} />
              ))}
              <Werte zeilen={[
                ...(BK_TEILE[teil.art].pole === 2
                  ? [["Durchfluss a → b", lmin(fluss(teil.id))], ["Druck a / b", `${bar(druck(teil.a))} / ${bar(druck(teil.b))}`]] as [string, string][]
                  : [["Druck am Anschluss", bar(druck(teil.a))]] as [string, string][]),
                ...(["behaelter"].includes(teil.art) ? [["Füllhöhe", `${zahl(zustand(teil.id) * 100, 0)} cm`]] as [string, string][] : []),
                ...(["kessel", "polster"].includes(teil.art) ? [["Druck innen", bar(zustand(teil.id))], ["absolut", bar(zustand(teil.id) + P_LUFT)]] as [string, string][] : []),
                ...(teil.art === "zylinder" ? [["Weg", `${zahl(zustand(teil.id) * 100, 1)} cm`], ["nötiger Druck F/A", bar(wert(teil, "last") / (Math.PI * wert(teil, "durchmesser") ** 2 / 4))]] as [string, string][] : []),
                ...(["hahn", "quelle"].includes(teil.art) ? [["Durchfluss", lmin(fluss(teil.id))]] as [string, string][] : []),
              ]} />
              <div className="flex gap-2">
                <button className="btn btn-secondary flex-1" onClick={drehen}>↻ Drehen (R)</button>
                <button className="btn btn-danger flex-1" onClick={loeschen}>🗑 Löschen</button>
              </div>
            </Karte>
          ) : draht ? (
            <Karte titel="〰️ Leitung">
              <p className="text-muted">Ideale Verbindung ohne Reibung. Für Reibung ein Rohr einsetzen.</p>
              <Werte zeilen={[["Durchfluss", lmin(Math.abs(fluss(draht.id)))], ["Druck an den Enden", `${bar(druck(draht.a))} / ${bar(druck(draht.b))}`]]} />
              <button className="btn btn-danger" onClick={loeschen}>🗑 Löschen</button>
            </Karte>
          ) : (
            <Karte titel="So geht's">
              <p>Links ein Teil wählen und auf die Fläche klicken — oder aufziehen, um Lage und Länge festzulegen. »Leitung« verbindet Punkte; was sich an einem Punkt trifft, ist verbunden.</p>
              <p className="text-muted">Teil anklicken: Werte einstellen. Ziehen verschiebt, an den Enden ziehen macht länger. R dreht, Entf löscht, Strg+Z nimmt zurück.</p>
            </Karte>
          )}
          {lehrkraft && code && (
            <KlassenVorgabe
              vorgabe={vorgabe && { aufgabe: vorgabe.aufgabe, anzahl: vorgabe.baukasten.bauteile.length }}
              festlegen={festlegen} entfernen={entfernen} laden={() => vorgabe && laden(vorgabe.baukasten)}
              was="Rohrnetz" leer="Noch keine Vorgabe: Wer beitritt, beginnt im Baukasten mit dem Pumpenkreislauf."
              platzhalter="z. B. Baue das Netz so um, dass beide Zapfstellen gleich viel Wasser bekommen."
            />
          )}
        </div>
      </div>
    </div>
  );
}
