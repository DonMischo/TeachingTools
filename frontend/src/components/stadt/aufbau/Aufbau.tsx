"use client";
/**
 * Reiter »Aufbau« — Stadtbau wie in Anno, in 2,5D:
 *   Mausrad zoomt vom einzelnen Haus bis zur ganzen Stadt (die Kamera kippt dabei flacher),
 *   rechte Maustaste oder Q/E dreht, ziehen oder W/A/S/D verschiebt.
 *   Touch: ein Finger verschiebt, zwei Finger zoomen und drehen; Knöpfe ⟲ ⟳ ＋ －.
 *   Gebäude drehen mit R, ↻ oder dem Mausrad (beim Bauen); auf Touch setzt Tippen den Geist, »✔ Hier bauen« baut.
 *   Wie im Echtzeit-Strategiespiel: B öffnet das Baumenü, Umschalt halten baut mehrfach und zeigt die Werte am
 *   Bauplatz, am Rand scrollt die Karte, »Maus fangen« hält den Zeiger im Spielfeld (Esc löst), I zeigt die Übersicht.
 *   Der Spielstand liegt im Browser (localStorage) je Spieler (`speicherSchluessel`: Konto oder Gastname),
 *   Stadttyp und Gelände; derselbe Typ auf demselben Gelände macht dort weiter.
 *   Gebäude wählen → Geist am Mauszeiger mit Werte-Kärtchen am Bauplatz und Einzugsbereich;
 *   Klick baut. Klick auf ein Gebäude zeigt seine Werte und seinen Einzugsbereich.
 * Häuser und Straßen wachsen feldgenau von selbst (lib/stadt/aufbau.ts).
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Gelaende } from "@/lib/gelaende/gelaende";
import { BAUTEN, STILE, type BauTyp, type Stil } from "@/lib/stadt/modell";
import { lageRegeln } from "@/lib/stadt/bauen";
import { ANBIETER, aufStufen, GUETER, kosten, METER_JE_MINUTE, palette, SCHICHTEN, SEKTOREN, STELLEN, TROCKEN_KOSTEN, zentrumTyp, type Gut, type Sektor } from "@/lib/stadt/aufbauRegeln";
import {
  abdeckung, baue, bauBei, baukosten, besetzung, DORF_HOEFE, DORF_SCHMIEDE, dorfSchmiede, geldDetails, gewerbe, hoefeIm, nahrungsDetails, erreichteHaeuser, fussabdruck, hausFarben, mitteVon, naechsteStufeFehlt, neueWelt, pruefePlatz, reichweite, reisseAb, schritt, stufe, versorgungsQuote,
  trockenlegen, TROCKEN_RADIUS, welteAlsText, welteAusText,
  type Platzpruefung, type Welt,
} from "@/lib/stadt/aufbau";
import { ladeWeltModelle, weltModelle } from "@/components/gebaeude/frei/modelle";
import { ladeStadtModelle } from "../drei/modelle";
import { baueGelaende, hoeheGlatt } from "./gelaende";
import { AufbauObjekte } from "./objekte";

const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;
const zahl = (n: number) => Math.round(n).toLocaleString("de-DE");
const jahrText = (j: number) => (j < 0 ? `${-j} v. Chr.` : `${j}`);
const NAH = 25, FERN = 2600;
/** Neigung der Kamera über dem Boden je Abstand: nah fast seitlich, weit fast von oben */
const neigung = (d: number) => 0.42 + 0.68 * Math.max(0, Math.min(1, Math.log(d / NAH) / Math.log(FERN / NAH)));

interface Ziel { i: number; j: number; bau: BauTyp; dreh: number; pr: Platzpruefung }
interface Auswahl { id: number }

/** Speicherplatz eines Spielstands: Spieler, Stadttyp, Gelände */
const speicherplatz = (wer: string, g: Gelaende, stil: Stil) =>
  `hp_aufbau_${wer}_${stil}_${g.wahl.art}_${g.wahl.seed}_${g.wahl.relief}_${g.wahl.fluss ? 1 : 0}_${(g.wahl.merkmale ?? []).join("+")}`;

export default function Aufbau({ g, stil, setStil, aktiv = true, speicherSchluessel = "geraet" }: { g: Gelaende; stil: Stil; setStil: (s: Stil) => void; aktiv?: boolean; speicherSchluessel?: string }) {
  const pal = palette(stil);
  const huelle = useRef<HTMLDivElement>(null);
  const karte = useRef<HTMLDivElement>(null);
  const welt = useRef<Welt>(neueWelt(g, stil, g.wahl.seed));
  // der Speicherplatz gehört zur Welt (zusammen gesetzt), damit nie unter einem fremden Schlüssel gespeichert wird
  const platz = useRef(speicherplatz(speicherSchluessel, g, stil));
  const speichern = () => { try { localStorage.setItem(platz.current, welteAlsText(welt.current)); } catch { /* voll oder gesperrt */ } };
  const [, setVersion] = useState(0);
  const neuZeichnen = () => setVersion(v => v + 1);
  const [wahl, setWahl] = useState<BauTyp | "abriss" | "trocken" | null>(null);
  const [ziel, setZiel] = useState<Ziel | null>(null);
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(1);
  const [raster, setRaster] = useState(true);
  const [laedt, setLaedt] = useState(true);
  const [ohneWebGL, setOhneWebGL] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [dreh, setDreh] = useState(0);
  const [menue, setMenue] = useState(false);
  const [uebersicht, setUebersicht] = useState(false);
  const [gefangen, setGefangen] = useState(false);
  const [vollbild, setVollbild] = useState(false);
  const umschalt = useRef(false);
  const touchZuletzt = useRef(false);
  const zeigerEl = useRef<HTMLDivElement>(null);
  const drehRef = useRef(dreh); drehRef.current = dreh;
  const wahlRef = useRef(wahl); wahlRef.current = wahl;
  const rasterRef = useRef(raster); rasterRef.current = raster;
  const zielRef = useRef(ziel); zielRef.current = ziel;
  const auswahlRef = useRef(auswahl); auswahlRef.current = auswahl;
  const aktivRef = useRef(aktiv); aktivRef.current = aktiv;
  const laeuftRef = useRef(laeuft); laeuftRef.current = laeuft;
  const tempoRef = useRef(tempo); tempoRef.current = tempo;
  const drei = useRef<{
    renderer: THREE.WebGLRenderer; szene: THREE.Scene; kamera: THREE.PerspectiveCamera; sonne: THREE.DirectionalLight;
    gelaende: ReturnType<typeof baueGelaende> | null; objekte: AufbauObjekte | null; freiSumme: number;
    rig: { x: number; z: number; yaw: number; d: number; ziel: { x: number; z: number; yaw: number; d: number } }; tasten: Set<string>;
  } | null>(null);

  // Welt bei neuem Stadttyp, Gelände oder Spieler: gespeicherten Stand laden, sonst neu
  useEffect(() => {
    const p = speicherplatz(speicherSchluessel, g, stil);
    let gespeichert: string | null = null;
    try { gespeichert = localStorage.getItem(p); } catch { /* kein Speicher */ }
    const geladen = gespeichert ? welteAusText(gespeichert, g, stil) : null;
    welt.current = geladen ?? neueWelt(g, stil, g.wahl.seed);
    platz.current = p;
    setWahl(null); setZiel(null); setAuswahl(null); setLaeuft(false);
    setMeldung(geladen ? `💾 Spielstand geladen: ${geladen.haeuser.length} Häuser, ${geladen.bauten.length} Gebäude.` : null);
    const d = drei.current;
    if (d?.objekte) d.objekte.aktualisiere(welt.current);
    if (d?.gelaende) { d.gelaende.setzeMasken(welt.current); d.freiSumme = -1; }
    neuZeichnen();
  }, [g, stil, speicherSchluessel]);

  // ── Renderer, Kamera, Eingaben, Schleife ──
  useEffect(() => {
    const el = karte.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setOhneWebGL(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.outline = "none";
    renderer.domElement.style.touchAction = "none";
    el.appendChild(renderer.domElement);
    const szene = new THREE.Scene();
    szene.background = new THREE.Color(0xb7d4ea);
    szene.fog = new THREE.Fog(0xb7d4ea, 2500, 6000);
    const kamera = new THREE.PerspectiveCamera(42, 1, 1, 12000);
    szene.add(new THREE.HemisphereLight(0xeaf3ff, 0x5f6b45, 0.95));
    const sonne = new THREE.DirectionalLight(0xfff0d8, 2.8);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(2048, 2048);
    sonne.shadow.bias = -0.0004;
    szene.add(sonne, sonne.target);
    const rig = { x: 0, z: 0, yaw: 0.6, d: 1400, ziel: { x: 0, z: 0, yaw: 0.6, d: 1400 } };
    drei.current = { renderer, szene, kamera, sonne, gelaende: null, objekte: null, freiSumme: -1, rig, tasten: new Set() };

    const groesse = () => { renderer.setSize(el.clientWidth, el.clientHeight); kamera.aspect = el.clientWidth / Math.max(1, el.clientHeight); kamera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(groesse);
    ro.observe(el);
    groesse();

    const strahl = new THREE.Raycaster(), maus = new THREE.Vector2();
    /** Punkt unter dem Zeiger (Karte in Metern): Gelände oder das Haus/Gebäude davor — sonst spränge der Bauplatz hinter Häuser */
    const bodenBei = (cx: number, cy: number): { x: number; y: number } | null => {
      const d = drei.current;
      if (!d?.gelaende) return null;
      const r = renderer.domElement.getBoundingClientRect();
      maus.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      strahl.setFromCamera(maus, kamera);
      const ziele = [...d.gelaende.gruppe.children.filter(o => o.userData.gelaende), ...(d.objekte?.trefferziele() ?? [])];
      const t = strahl.intersectObjects(ziele, true)[0];
      return t ? { x: t.point.x + g.breite / 2, y: t.point.z + g.breite / 2 } : null;
    };
    // gefangene Maus (Pointer Lock): eigener Zeiger, der im Spielfeld bleibt
    const virtuell = { x: el.clientWidth / 2, y: el.clientHeight / 2, drin: false };
    const istGefangen = () => document.pointerLockElement === renderer.domElement;
    /** Bildschirmpunkt eines Ereignisses — bei gefangener Maus der eigene Zeiger */
    const punkt = (e: { clientX: number; clientY: number }) => {
      if (!istGefangen()) return { x: e.clientX, y: e.clientY };
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + virtuell.x, y: r.top + virtuell.y };
    };
    const zielFeld = (p: { x: number; y: number }, b: BauTyp) => {
      const { w, h } = fussabdruck(b, drehRef.current);
      return { i: Math.round(p.x / g.zelle - w / 2), j: Math.round(p.y / g.zelle - h / 2) };
    };

    let griff: { x: number; y: number; knopf: number; weit: number; touch: boolean } | null = null;
    let trockenPunkt: { x: number; y: number } | null = null;
    // Touch: alle Finger; zwei Finger zoomen (Spreizen) und drehen (Winkel)
    const finger = new Map<number, { x: number; y: number }>();
    let zwei: { abst: number; winkel: number; mx: number; my: number } | null = null;
    const zweiMessen = () => {
      const [a, b] = [...finger.values()];
      return { abst: Math.hypot(b.x - a.x, b.y - a.y), winkel: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };
    const verschiebe = (dx: number, dy: number) => {
      const d = drei.current!, f = d.rig.d / 900, s = Math.sin(d.rig.yaw), c = Math.cos(d.rig.yaw);
      d.rig.ziel.x -= (dx * c + dy * s) * f;
      d.rig.ziel.z -= (-dx * s + dy * c) * f;
    };
    const druck = (e: PointerEvent) => {
      renderer.domElement.focus();
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* Zeiger schon weg */ }
      touchZuletzt.current = e.pointerType === "touch";
      const q = punkt(e);
      finger.set(e.pointerId, q);
      if (finger.size === 2) { zwei = zweiMessen(); if (griff) griff.weit = 99; return; }
      griff = { x: q.x, y: q.y, knopf: e.button, weit: 0, touch: e.pointerType === "touch" };
    };
    const zug = (e: PointerEvent) => {
      const d = drei.current!;
      umschalt.current = e.shiftKey;
      if (istGefangen()) {
        virtuell.x = Math.max(0, Math.min(el.clientWidth - 1, virtuell.x + e.movementX));
        virtuell.y = Math.max(0, Math.min(el.clientHeight - 1, virtuell.y + e.movementY));
      } else { const r = renderer.domElement.getBoundingClientRect(); virtuell.x = e.clientX - r.left; virtuell.y = e.clientY - r.top; }
      virtuell.drin = e.pointerType === "mouse";
      if (zeigerEl.current) zeigerEl.current.style.transform = `translate(${virtuell.x - 2}px, ${virtuell.y - 2}px)`;
      const q = punkt(e);
      if (finger.has(e.pointerId)) finger.set(e.pointerId, q);
      if (finger.size >= 2 && zwei) {
        const n = zweiMessen();
        d.rig.ziel.d = Math.max(NAH, Math.min(FERN, d.rig.ziel.d * (zwei.abst / Math.max(1, n.abst))));
        let dw = n.winkel - zwei.winkel;
        dw = Math.atan2(Math.sin(dw), Math.cos(dw));
        d.rig.ziel.yaw -= dw;
        verschiebe(n.mx - zwei.mx, n.my - zwei.my);
        zwei = n;
        return;
      }
      if (griff) {
        const dx = istGefangen() ? e.movementX : q.x - griff.x, dy = istGefangen() ? e.movementY : q.y - griff.y;
        griff.weit += Math.abs(dx) + Math.abs(dy);
        griff.x = q.x; griff.y = q.y;
        if (griff.knopf === 2 || griff.knopf === 1) d.rig.ziel.yaw -= dx * 0.006;
        else if (griff.weit > 5) verschiebe(dx, dy); // Bildschirmbewegung in Bodenrichtung, so weit wie der Abstand
        return;
      }
      const b = wahlRef.current;
      if (b === "trocken") { trockenPunkt = bodenBei(q.x, q.y); return; }
      if (!b || b === "abriss") return;
      const p = bodenBei(q.x, q.y);
      if (!p) return;
      const { i, j } = zielFeld(p, b);
      const z0 = zielRef.current;
      if (z0 && z0.i === i && z0.j === j && z0.bau === b && z0.dreh === drehRef.current) return;
      setZiel({ i, j, bau: b, dreh: drehRef.current, pr: pruefePlatz(g, welt.current, b, i, j, drehRef.current) });
    };
    const los = (e: PointerEvent) => {
      finger.delete(e.pointerId);
      if (finger.size < 2) zwei = null;
      const gr = griff;
      if (finger.size === 0) griff = null;
      // Rechtsklick ohne Ziehen: Bauen bzw. Werkzeug abbrechen (Ziehen mit rechts dreht weiter die Ansicht)
      if (gr && gr.knopf === 2 && gr.weit <= 5 && finger.size === 0) { setWahl(null); setZiel(null); trockenPunkt = null; return; }
      if (!gr || gr.weit > 5 || gr.knopf !== 0 || finger.size > 0) return;
      umschalt.current = e.shiftKey;
      const q = punkt(e);
      const p = bodenBei(q.x, q.y);
      if (!p) return;
      const w = welt.current, b = wahlRef.current;
      if (b === "abriss") {
        const o = bauBei(w, Math.floor(p.x / g.zelle), Math.floor(p.y / g.zelle));
        if (o) abreissenRef.current(o.id);
        return;
      }
      if (b === "trocken") {
        trockenPunkt = p;
        const neu = trockenlegen(g, w, p.x, p.y);
        setMeldung(neu ? `🌾 ${Math.round(neu * g.zelle * g.zelle / 10000 * 10) / 10} ha Aue trockengelegt — hier darf jetzt gebaut werden.` : "Hier gibt es keine nasse, erschlossene Aue zum Trockenlegen.");
        drei.current?.gelaende?.setzeMasken(w);
        speichernRef.current();
        neuZeichnen();
        return;
      }
      if (b && gr.touch) {
        // Touch hat keinen Zeiger zum Zielen: Tippen setzt den Geist, »✔ Hier bauen« baut
        const { i, j } = zielFeld(p, b);
        setZiel({ i, j, bau: b, dreh: drehRef.current, pr: pruefePlatz(g, w, b, i, j, drehRef.current) });
        return;
      }
      if (b) {
        const { i, j } = zielFeld(p, b);
        bauenRef.current(i, j);
        return;
      }
      const o = bauBei(w, Math.floor(p.x / g.zelle), Math.floor(p.y / g.zelle));
      setAuswahl(o ? { id: o.id } : null);
    };
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      // beim Bauen dreht das Rad das Gebäude (wie im Aufbauspiel), sonst zoomt es
      const b = wahlRef.current;
      if (b && b !== "abriss" && b !== "trocken") { drehenRef.current(e.deltaY > 0 ? 1 : -1); return; }
      const d = drei.current!, alt = d.rig.ziel.d;
      const neu = Math.max(NAH, Math.min(FERN, alt * (e.deltaY > 0 ? 1.18 : 1 / 1.18)));
      // beim Hineinzoomen zum Zeiger hin
      const q = punkt(e);
      const p = bodenBei(q.x, q.y);
      if (p && neu < alt) {
        const f = 1 - neu / alt;
        d.rig.ziel.x += (p.x - g.breite / 2 - d.rig.ziel.x) * f;
        d.rig.ziel.z += (p.y - g.breite / 2 - d.rig.ziel.z) * f;
      }
      d.rig.ziel.d = neu;
    };
    const runter = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "shift") { umschalt.current = true; return; }
      if (k === "escape") { setWahl(null); setZiel(null); setAuswahl(null); setMenue(false); setUebersicht(false); return; }
      if (k === "r") { drehenRef.current(1); return; }
      if ((k === "delete" || k === "backspace") && auswahlRef.current) { e.preventDefault(); abreissenRef.current(auswahlRef.current.id); return; }
      if (k === "b") { e.preventDefault(); setMenue(m => !m); setUebersicht(false); return; }
      if (k === "i") { e.preventDefault(); setUebersicht(u => !u); setMenue(false); return; }
      if (k === "f") { e.preventDefault(); umVollbild(); return; }
      if (k === " ") { e.preventDefault(); if (welt.current.bauten.length) setLaeuft(l => !l); return; }
      if (k === "1" || k === "2" || k === "3") { setTempo([1, 2, 4][Number(k) - 1]); return; }
      if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { e.preventDefault(); drei.current?.tasten.add(k); }
    };
    const hoch = (e: KeyboardEvent) => { if (e.key === "Shift") umschalt.current = false; drei.current?.tasten.delete(e.key.toLowerCase()); };
    const c = renderer.domElement;
    const kein = (e: Event) => e.preventDefault();
    c.addEventListener("pointerdown", druck);
    c.addEventListener("pointermove", zug);
    c.addEventListener("pointerup", los);
    c.addEventListener("pointercancel", los);
    c.addEventListener("wheel", rad, { passive: false });
    c.addEventListener("contextmenu", kein);
    const box = huelle.current!;
    box.addEventListener("keydown", runter);
    box.addEventListener("keyup", hoch);
    c.addEventListener("blur", () => drei.current?.tasten.clear());
    c.addEventListener("pointerleave", () => { if (!istGefangen()) virtuell.drin = false; });
    const lockWechsel = () => { const an = istGefangen(); setGefangen(an); if (an) virtuell.drin = true; };
    document.addEventListener("pointerlockchange", lockWechsel);
    const vollWechsel = () => { setVollbild(document.fullscreenElement === box); box.focus(); };
    document.addEventListener("fullscreenchange", vollWechsel);

    const licht = new THREE.Vector3(-0.6, 0.6, -0.35).normalize(), blick = new THREE.Vector3(), bildschirm = new THREE.Vector3();
    let id = 0, zuletzt = performance.now();
    const bild = (jetzt: number) => {
      id = requestAnimationFrame(bild);
      const d = drei.current;
      if (!d || !aktivRef.current) return;
      const dt = Math.min(0.1, (jetzt - zuletzt) / 1000);
      zuletzt = jetzt;
      const r = d.rig, t = d.tasten, sp = r.ziel.d * 0.9 * dt;
      const vw = (t.has("w") || t.has("arrowup") ? 1 : 0) - (t.has("s") || t.has("arrowdown") ? 1 : 0);
      const sw = (t.has("d") || t.has("arrowright") ? 1 : 0) - (t.has("a") || t.has("arrowleft") ? 1 : 0);
      r.ziel.x += (-Math.sin(r.yaw) * vw + Math.cos(r.yaw) * sw) * sp;
      r.ziel.z += (-Math.cos(r.yaw) * vw - Math.sin(r.yaw) * sw) * sp;
      r.ziel.yaw += ((t.has("q") ? 1 : 0) - (t.has("e") ? 1 : 0)) * dt * 1.4;
      // am Rand des Spielfelds scrollen (Maus darin bzw. gefangen), wie im Echtzeit-Strategiespiel
      if (virtuell.drin && !griff) {
        const R = 18, w0 = el.clientWidth, h0 = el.clientHeight;
        const rx = virtuell.x < R ? -1 : virtuell.x > w0 - R ? 1 : 0, ry = virtuell.y < R ? -1 : virtuell.y > h0 - R ? 1 : 0;
        if (rx || ry) {
          r.ziel.x += (Math.cos(r.yaw) * rx + Math.sin(r.yaw) * ry) * sp * 0.8;
          r.ziel.z += (-Math.sin(r.yaw) * rx + Math.cos(r.yaw) * ry) * sp * 0.8;
        }
      }
      const h2 = g.breite / 2;
      r.ziel.x = Math.max(-h2, Math.min(h2, r.ziel.x)); r.ziel.z = Math.max(-h2, Math.min(h2, r.ziel.z));
      // weich nachführen
      const k = Math.min(1, dt * 9);
      r.x += (r.ziel.x - r.x) * k; r.z += (r.ziel.z - r.z) * k; r.yaw += (r.ziel.yaw - r.yaw) * k; r.d += (r.ziel.d - r.d) * k;
      const by = hoeheGlatt(g, r.x + h2, r.z + h2), p = neigung(r.d);
      kamera.position.set(r.x + Math.sin(r.yaw) * Math.cos(p) * r.d, by + Math.sin(p) * r.d, r.z + Math.cos(r.yaw) * Math.cos(p) * r.d);
      const unten = hoeheGlatt(g, kamera.position.x + h2, kamera.position.z + h2) + 3;
      if (kamera.position.y < unten) kamera.position.y = unten;
      kamera.lookAt(r.x, by, r.z);
      // Raster beim Bauen und nah dran, ausgeblendet von weit weg
      if (d.gelaende) d.gelaende.uniforms.uRaster.value = rasterRef.current ? Math.max(0, Math.min(1, (900 - r.d) / 500)) * (wahlRef.current ? 1 : 0.5) : 0;
      // Einzugsbereich: Geist oder gewähltes Gebäude
      const z0 = zielRef.current, a0 = auswahlRef.current, w = welt.current;
      let kreis: { x: number; y: number; r: number } | null = null;
      if (wahlRef.current === "trocken" && trockenPunkt) kreis = { ...trockenPunkt, r: TROCKEN_RADIUS };
      else if (z0) { const { w: fw, h: fh } = fussabdruck(z0.bau, z0.dreh); const m = mitteVon(w, { i: z0.i, j: z0.j, w: fw, h: fh }); kreis = { ...m, r: reichweite(z0.bau) }; }
      else if (a0) { const o = w.bauten.find(x => x.id === a0.id); if (o) kreis = { ...mitteVon(w, o), r: reichweite(o.bau) }; }
      if (d.gelaende) d.gelaende.uniforms.uKreisFarbe.value.set(wahlRef.current === "trocken" ? 0x84cc16 : 0x3b82f6);
      if (d.gelaende) d.gelaende.uniforms.uKreis.value.set(kreis ? kreis.x - h2 : 0, kreis ? kreis.y - h2 : 0, kreis?.r ?? 0, kreis ? 1 : 0);
      // Werte-Kärtchen über dem Bauplatz
      const karteEl = huelle.current?.querySelector<HTMLDivElement>("[data-kaertchen]");
      if (karteEl) {
        if (kreis && (umschalt.current || touchZuletzt.current || (a0 && !z0 && !wahlRef.current))) {
          bildschirm.set(kreis.x - h2, hoeheGlatt(g, kreis.x, kreis.y) + 25, kreis.y - h2).project(kamera);
          const x = (bildschirm.x * 0.5 + 0.5) * el.clientWidth, y = (-bildschirm.y * 0.5 + 0.5) * el.clientHeight;
          // nicht über die Knopfleiste rechts unten und nicht aus dem Bild
          const kx = Math.max(8, Math.min(el.clientWidth - 280, x + 18)), ky = Math.max(8, Math.min(el.clientHeight - 300, y - 20));
          karteEl.style.transform = `translate(${Math.round(kx)}px, ${Math.round(ky)}px)`;
          karteEl.style.visibility = bildschirm.z < 1 ? "visible" : "hidden";
        } else karteEl.style.visibility = "hidden";
      }
      // Schatten um den Blickpunkt
      const sr = Math.min(1600, Math.max(120, r.d * 0.9)), sc = d.sonne.shadow.camera;
      if (Math.abs(sc.right - sr) > sr * 0.1) { sc.left = -sr; sc.right = sr; sc.top = sr; sc.bottom = -sr; sc.far = 6000; sc.updateProjectionMatrix(); }
      blick.set(r.x, by, r.z);
      d.sonne.target.position.copy(blick);
      d.sonne.position.copy(blick).addScaledVector(licht, 2500);
      // Verkehr: Figuren laufen, solange die Zeit läuft (schneller bei 2× und 4×)
      d.objekte?.verkehrBewegen(g.n, laeuftRef.current ? dt * tempoRef.current * 2 : 0);
      renderer.render(szene, kamera);
    };
    id = requestAnimationFrame(bild);

    // Gelände und Modelle
    let ab = false;
    Promise.all([ladeStadtModelle(), ladeWeltModelle()]).then(([teile]) => {
      if (ab || !drei.current) return;
      const d = drei.current;
      d.gelaende = baueGelaende(g, welt.current);
      d.objekte = new AufbauObjekte(g, teile, weltModelle(), hausFarben(welt.current.stil));
      szene.add(d.gelaende.gruppe, d.objekte.gruppe);
      d.objekte.aktualisiere(welt.current);
      // Start: Blick auf die Kartenmitte bzw. den Fluss
      const f = g.flussLinie[Math.floor(g.flussLinie.length / 2)];
      if (f) { rig.ziel.x = rig.x = Math.max(-1200, Math.min(1200, f.x - g.breite / 2)); rig.ziel.z = rig.z = Math.max(-1200, Math.min(1200, f.y - g.breite / 2)); }
      setLaedt(false);
    });

    return () => {
      ab = true;
      cancelAnimationFrame(id);
      ro.disconnect();
      box.removeEventListener("keydown", runter);
      box.removeEventListener("keyup", hoch);
      document.removeEventListener("pointerlockchange", lockWechsel);
      document.removeEventListener("fullscreenchange", vollWechsel);
      if (istGefangen()) document.exitPointerLock();
      c.removeEventListener("wheel", rad);
      drei.current?.gelaende?.entsorge();
      drei.current?.objekte?.entsorge();
      drei.current = null;
      renderer.dispose();
      el.removeChild(c);
    };
  }, [g]);

  /** reißt ein Gebäude ab (Abriss-Werkzeug, oder Auswahl + Entf) — ein Viertel der Baukosten kommt zurück */
  const abreissen = (id: number) => {
    const w = welt.current, o = w.bauten.find(x => x.id === id);
    if (!o) return;
    reisseAb(g, w, id);
    setMeldung(`🧽 ${BAUTEN[o.bau].label} abgerissen.`);
    setAuswahl(null);
    drei.current?.objekte?.aktualisiere(w);
    drei.current?.gelaende?.setzeMasken(w);
    speichern();
    neuZeichnen();
  };
  const abreissenRef = useRef(abreissen); abreissenRef.current = abreissen;

  /** baut das gewählte Gebäude mit der aktuellen Drehung bei (i, j) */
  const bauen = (i: number, j: number) => {
    const w = welt.current, b = wahl;
    if (!b || b === "abriss" || b === "trocken") return;
    const pr = pruefePlatz(g, w, b, i, j, dreh);
    if (!pr.ok) { setMeldung(`❌ ${BAUTEN[b].label}: ${pr.gruende.filter(x => !x.ok).map(x => x.text).slice(0, 2).join(", ")}`); return; }
    const neu = baue(g, w, b, i, j, dreh)!;
    const weichen = pr.gruende.find(x => x.ok && x.text.startsWith("weichen"))?.text;
    setMeldung((pr.faktor < 1 ? `⚠️ ${BAUTEN[b].label} steht ungünstig — wirkt nur zu ${Math.round(pr.faktor * 100)} %.` : `✅ ${BAUTEN[b].label} gebaut.`) + (weichen ? ` Abgerissen und umgeleitet — ${weichen}.` : ""));
    // mit Umschalt mehrere hintereinander bauen, sonst ist die Auswahl erledigt
    if (umschalt.current) setZiel(null);
    else { setAuswahl({ id: neu.id }); setWahl(null); setZiel(null); }
    if (w.bauten.length === 1) setLaeuft(true);
    drei.current?.objekte?.aktualisiere(w);
    drei.current?.gelaende?.setzeMasken(w);
    speichern();
    neuZeichnen();
  };
  const bauenRef = useRef(bauen); bauenRef.current = bauen;
  /** Gebäude um eine Vierteldrehung weiterdrehen; der Geist bleibt an seinem Platz */
  const drehen = (richtung = 1) => {
    const nd = (dreh + (richtung > 0 ? 1 : 3)) % 4;
    setDreh(nd);
    if (ziel) setZiel({ ...ziel, dreh: nd, pr: pruefePlatz(g, welt.current, ziel.bau, ziel.i, ziel.j, nd) });
  };
  const drehenRef = useRef(drehen); drehenRef.current = drehen;
  const speichernRef = useRef(speichern); speichernRef.current = speichern;
  const kamera = (f: (r: { yaw: number; d: number }) => void) => { const r = drei.current?.rig; if (r) f(r.ziel); };

  // Geist zeigen
  useEffect(() => {
    const o = drei.current?.objekte;
    if (!o) return;
    if (!ziel) { o.zeigeGeist(null, 0, 0, "nein"); return; }
    o.zeigeGeist(ziel.bau, ziel.i, ziel.j, !ziel.pr.ok ? "nein" : ziel.pr.faktor < 1 ? "schwach" : "gut", ziel.dreh);
  }, [ziel]);

  // Zeit
  useEffect(() => {
    if (!laeuft || !aktiv) return;
    const t = setInterval(() => {
      const w = welt.current, d = drei.current, alt = stufe(w);
      schritt(g, w);
      if (w.tick % 10 === 0) speichern();
      if (stufe(w) > alt) setMeldung(`🎉 Neue Stufe: ${aufStufen(w.stil)[stufe(w)].name} — mehr Land ist erschlossen, neue Gebäude sind frei.`);
      if (d?.objekte) d.objekte.aktualisiere(w);
      if (d?.gelaende) {
        const s = w.frei.reduce((a, x) => a + x, 0);
        if (s !== d.freiSumme) { d.gelaende.setzeMasken(w); d.freiSumme = s; }
      }
      neuZeichnen();
    }, 450 / tempo);
    return () => clearInterval(t);
  }, [laeuft, aktiv, tempo, g]);

  const w = welt.current;
  const i = stufe(w);
  const stufen = aufStufen(stil), naechste = stufen[i + 1];
  const fehlend = naechsteStufeFehlt(w);
  const stadtHaeuser = w.haeuser.filter(h => !h.bauer);
  // Versorgung je Gut: Anteil der Stadthäuser, deren Straße das Gut erreicht (Güter ihrer und der nächsten Schicht)
  const deckung = (() => {
    if (!stadtHaeuser.length) return [];
    const abd = abdeckung(w);
    const gebraucht = new Set<Gut>(stadtHaeuser.flatMap(h => [...SCHICHTEN[h.schicht].grund, ...(SCHICHTEN[h.schicht + 1]?.grund ?? [])]));
    const da = new Set(pal.flatMap(o => (ANBIETER[o.bau] ?? []).map(a2 => a2.gut)));
    return [...gebraucht].filter(x => da.has(x)).map(x => ({ gut: x, anteil: stadtHaeuser.filter(h => abd.get(x)?.[h.tor]).length / stadtHaeuser.length }));
  })();
  const schichten = SCHICHTEN.map((sch, k) => ({ name: sch.name, leute: w.haeuser.filter(h => h.schicht === k).reduce((a2, h) => a2 + h.bewohner, 0) })).filter(x => x.leute);
  const netto = w.bilanz.steuern - w.bilanz.unterhalt;
  const bes = besetzung(w);
  const erwerb = Object.values(bes.sektoren).reduce((a2, x) => a2 + x, 0);
  const offen = bes.fehlend.map((n, k) => ({ n: Math.round(n), name: SCHICHTEN[k].name })).filter(x => x.n > 0);
  const gewaehlt = auswahl ? w.bauten.find(o => o.id === auswahl.id) ?? null : null;
  const kaertchen = ziel
    ? { bau: ziel.bau, pr: ziel.pr, neu: true, frei: bes.frei }
    : gewaehlt ? { bau: gewaehlt.bau, pr: { ok: true, faktor: gewaehlt.faktor, gruende: [], kosten: kosten(gewaehlt.bau), versorgt: erreichteHaeuser(w, gewaehlt.bau, gewaehlt.i, gewaehlt.j, gewaehlt.w, gewaehlt.h, gewaehlt.dreh) }, neu: false, besetzt: bes.quote.get(gewaehlt.id) } : null;

  /** Vollbild an/aus (Taste F): nur das Spielfeld, Übersicht und Baumenü bleiben erreichbar */
  function umVollbild() {
    if (document.fullscreenElement) document.exitFullscreen();
    else huelle.current?.requestFullscreen?.().catch(() => {});
  }

  if (ohneWebGL) return <div className="flex h-[640px] items-center justify-center rounded-xl border border-line text-muted">Der Aufbau braucht WebGL — dein Browser bietet es gerade nicht an.</div>;
  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex flex-wrap self-start rounded-xl border border-line bg-surface p-1">
        {STILE.map(s => <button key={s.id} onClick={() => setStil(s.id)} className={chip(stil === s.id)}>{s.icon} {s.kurz}</button>)}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div ref={huelle} tabIndex={-1} className={`relative overflow-hidden border-line ${vollbild ? "h-screen" : "h-[640px] rounded-xl border"} bg-[#b7d4ea] outline-none ${gefangen ? "cursor-none" : ""}`}>
          <div ref={karte} className="absolute inset-0" />
          {laedt && <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow">⏳ Gelände wird geformt …</div>}
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-black/45 px-2 py-1 text-xs text-white">
            Leertaste: Pause · 1 2 3: Tempo · B: Baumenü · I: Übersicht · F: Vollbild · Entf: Gewähltes abreißen · Umschalt: Werte, mehrfach bauen · Rad: Zoom (beim Bauen: drehen) · Rechtsklick: abbrechen · rechts ziehen / Q E: drehen · Rand / W A S D: schieben · Esc
          </div>
          {/* Spielleiste: Zeit und Kennzahlen, damit sich auch im Vollbild alles steuern lässt */}
          <div className="absolute left-2 top-2 flex max-w-[55%] flex-wrap items-center gap-1.5 rounded-xl bg-surface/90 p-1 text-xs shadow">
            <button className="btn-primary px-2 py-1" disabled={!w.bauten.length} onClick={() => setLaeuft(l => !l)} title="Zeit an/aus (Leertaste)">{laeuft ? "⏸" : "▶"}</button>
            {[1, 2, 4].map((t, k) => <button key={t} className={`chip ${tempo === t ? "chip-on" : ""}`} onClick={() => setTempo(t)} title={`Tempo ${t}× (Taste ${k + 1})`}>{t}×</button>)}
            <span className="px-1 font-bold" title={`Stufe ${i + 1} von ${stufen.length}`}>{stufen[i].name}</span>
            <span className="px-1" title="Taler · Ergebnis je Schritt">💰 {zahl(w.taler)} <span className={netto >= 0 ? "text-ok" : "text-bad"}>{netto >= 0 ? "+" : ""}{netto.toFixed(1).replace(".", ",")}</span></span>
            <span className="px-1" title="Einwohner">👥 {zahl(w.einwohner)}</span>
            <span className={`px-1 ${w.bilanz.nahrung >= w.bilanz.bedarf ? "" : "text-bad"}`} title="Nahrung für Bedarf">🌾 {zahl(w.bilanz.nahrung)}/{zahl(w.bilanz.bedarf)}</span>
          </div>
          {vollbild && meldung && <div className="pointer-events-none absolute bottom-10 left-1/2 max-w-[60%] -translate-x-1/2 rounded-lg bg-surface/95 px-3 py-1.5 text-sm shadow">{meldung}</div>}
          <div className="absolute right-2 top-2 flex max-w-[44%] flex-wrap justify-end gap-1.5">
            <button className={`chip ${menue ? "chip-on" : ""}`} onClick={() => { setMenue(m => !m); setUebersicht(false); }} title="Baumenü (B)">🏗️ Bauen</button>
            <button className={`chip ${uebersicht ? "chip-on" : ""}`} onClick={() => { setUebersicht(u => !u); setMenue(false); }} title="Übersicht (I)">📊 Übersicht</button>
            <button className={`chip ${raster ? "chip-on" : ""}`} onClick={() => setRaster(r => !r)}># Raster</button>
            <button className={`chip ${vollbild ? "chip-on" : ""}`} onClick={umVollbild} title="Vollbild (F)">⛶ {vollbild ? "Fenster" : "Vollbild"}</button>
            <button className={`chip ${gefangen ? "chip-on" : ""}`} title="Maus im Spielfeld halten — am Rand scrollt die Karte. Esc löst."
              onClick={() => { const c = huelle.current?.querySelector("canvas"); if (gefangen) document.exitPointerLock(); else c?.requestPointerLock(); }}>🖱️ {gefangen ? "Maus frei (Esc)" : "Maus fangen"}</button>
          </div>
          {/* eigener Zeiger, solange die Maus gefangen ist */}
          <div ref={zeigerEl} className="pointer-events-none absolute left-0 top-0 h-4 w-4" style={{ visibility: gefangen ? "visible" : "hidden" }}>
            <svg viewBox="0 0 16 16" className="h-4 w-4 drop-shadow"><path d="M1 1 L1 13 L4.5 9.5 L7 15 L9 14 L6.5 8.5 L11 8.5 Z" fill="white" stroke="black" strokeWidth="1" /></svg>
          </div>
          {menue && <BauMenue stufen={stufen} pal={pal} stufe={i} taler={w.taler} preis={b => baukosten(w, b)} gewaehlt={wahl}
            waehle={b => { setWahl(b); setZiel(null); setAuswahl(null); setMenue(false); huelle.current?.querySelector("canvas")?.focus(); }}
            zu={() => setMenue(false)} />}
          {uebersicht && <Uebersicht w={w} zu={() => setUebersicht(false)} />}
          {/* Knopfleiste für Touch (und Maus): Ansicht drehen und zoomen, Gebäude drehen und bauen */}
          <div className="absolute bottom-16 right-2 flex flex-col items-end gap-1.5">
            {ziel && <button className="btn-primary py-1.5" disabled={!ziel.pr.ok} onClick={() => bauen(ziel.i, ziel.j)}>✔ Hier bauen</button>}
            {wahl && wahl !== "abriss" && <button className="btn-secondary py-1.5" onClick={() => drehen(1)} title="Gebäude drehen (R oder Mausrad)">↻ Gebäude drehen</button>}
            {(wahl || ziel) && <button className="btn-secondary py-1.5" onClick={() => { setWahl(null); setZiel(null); }}>✕ Abbrechen</button>}
            {gewaehlt && !wahl && <button className="btn-secondary py-1.5" onClick={() => abreissen(gewaehlt.id)} title="Gewähltes Gebäude abreißen (Entf) — ein Viertel der Kosten kommt zurück">🧽 {BAUTEN[gewaehlt.bau].label} abreißen</button>}
            <div className="flex gap-1 rounded-xl bg-black/35 p-1">
              <button className="btn-secondary h-10 w-10 p-0 text-lg" title="Ansicht nach links drehen" onClick={() => kamera(r => { r.yaw += Math.PI / 4; })}>⟲</button>
              <button className="btn-secondary h-10 w-10 p-0 text-lg" title="Ansicht nach rechts drehen" onClick={() => kamera(r => { r.yaw -= Math.PI / 4; })}>⟳</button>
              <button className="btn-secondary h-10 w-10 p-0 text-lg" title="Näher heran" onClick={() => kamera(r => { r.d = Math.max(NAH, r.d / 1.5); })}>＋</button>
              <button className="btn-secondary h-10 w-10 p-0 text-lg" title="Weiter weg" onClick={() => kamera(r => { r.d = Math.min(FERN, r.d * 1.5); })}>－</button>
            </div>
          </div>
          <div data-kaertchen className="pointer-events-none absolute left-0 top-0 w-64 rounded-lg border border-line bg-surface/95 p-2 text-xs shadow-lg" style={{ visibility: "hidden" }}>
            {kaertchen && <Kaertchen stil={stil} {...kaertchen} />}
          </div>
        </div>
        <aside className="card flex flex-col gap-3 p-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Stufe {i + 1} von {stufen.length} · um {jahrText(stufen[i].jahr)}</div>
            <h2 className="text-lg font-black">{stufen[i].name}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-surface-hover/60 p-2">
              <div className="font-bold">💰 {zahl(w.taler)} Taler</div>
              <div className={netto >= 0 ? "text-ok" : "text-bad"}>{netto >= 0 ? "+" : ""}{netto.toFixed(1).replace(".", ",")} je Schritt</div>
              <div className="text-muted">Steuern {w.bilanz.steuern.toFixed(1).replace(".", ",")} · Unterhalt {w.bilanz.unterhalt.toFixed(1).replace(".", ",")}</div>
            </div>
            <div className="rounded-lg bg-surface-hover/60 p-2">
              <div className="font-bold">🌾 Nahrung {zahl(w.bilanz.nahrung)}</div>
              <div className={w.bilanz.nahrung >= w.bilanz.bedarf ? "text-ok" : "text-bad"}>Bedarf {zahl(w.bilanz.bedarf)}</div>
              <div className="text-muted">{w.haeuser.filter(h => h.bauer).length} Bauernhöfe in {w.doerfer.length} Dörfern</div>
            </div>
          </div>
          <div className="text-xs">
            <div>👥 {zahl(w.einwohner)} Einwohner{schichten.length ? ": " : ""}{schichten.map(x => `${x.name} ${zahl(x.leute)}`).join(" · ")}</div>
            {naechste && i > 0 && (
              <>
                <div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className="h-full bg-accent" style={{ width: `${Math.min(100, (w.einwohner / Math.max(1, naechste.ab)) * 100)}%` }} /></div>
                <p className="mt-1 text-muted">Nächste Stufe »{naechste.name}« ab {zahl(naechste.ab)} Einwohnern{naechste.quote ? ` · voll versorgt: ${Math.round(versorgungsQuote(w) * 100)} % (nötig ${Math.round(naechste.quote * 100)} %)` : ""}</p>
              </>
            )}
            {i === 0 && <p className="mt-1 font-bold">👉 Wähle {BAUTEN[zentrumTyp(stil)].icon} {BAUTEN[zentrumTyp(stil)].label} und setze es in eines der Dörfer ({w.doerfer.map(d => d.name).join(", ")}) — das erhebt es zum Marktort. Die anderen Dörfer liefern Nahrung.</p>}
            {i > 0 && fehlend.length > 0 && <p className="mt-1">Für den Aufstieg fehlt: {fehlend.join(", ")}</p>}
            {i > 0 && w.engpass && <p className="mt-1 text-bad">{ENGPASS[w.engpass]}</p>}
          </div>
          {deckung.length > 0 && (
            <div className="text-xs">
              <div className="mb-1 font-bold text-muted">Versorgung der Stadthäuser (über die Wege)</div>
              {deckung.map(x => (
                <div key={x.gut} className="flex items-center gap-2">
                  <span className="w-28 truncate">{GUETER[x.gut].icon} {GUETER[x.gut].label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-line"><div className="h-full" style={{ width: `${x.anteil * 100}%`, background: x.anteil > 0.8 ? "#16a34a" : x.anteil > 0.4 ? "#d97706" : "#dc2626" }} /></div>
                  <span className="w-9 text-right">{Math.round(x.anteil * 100)} %</span>
                </div>
              ))}
              <p className="mt-1 text-muted">Fehlt einem Haus ein Grundbedürfnis länger, steigt es ab und steht zuletzt leer. Voll versorgte Häuser steigen auf (Handwerker → Bürger …).</p>
            </div>
          )}
          {erwerb > 0 && i > 0 && (
            <div className="text-xs">
              <div className="mb-1 font-bold text-muted">Berufe (Erwerbstätige je Zweig · Strich = Anteil in Städten um 1450)</div>
              {(Object.keys(SEKTOREN) as Sektor[]).filter(k => bes.sektoren[k] > 0 || SEKTOREN[k].ziel > 0).map(k => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-32 truncate">{SEKTOREN[k].icon} {SEKTOREN[k].label}</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded bg-line">
                    <div className="h-full bg-accent" style={{ width: `${(bes.sektoren[k] / erwerb) * 100}%` }} />
                    {SEKTOREN[k].ziel > 0 && <div className="absolute top-0 h-full w-0.5 bg-fg" style={{ left: `${SEKTOREN[k].ziel * 100}%` }} />}
                  </div>
                  <span className="w-9 text-right">{Math.round((bes.sektoren[k] / erwerb) * 100)} %</span>
                </div>
              ))}
              {offen.length > 0 && <p className="mt-1 text-bad">👷 Unbesetzte Stellen: {offen.map(x => `${zahl(x.n)} ${x.name}`).join(", ")} — Betriebe ohne Personal stehen still. Mehr Häuser dieser Schicht, oder weniger Betriebe.</p>}
            </div>
          )}
          {meldung && <div className="rounded-lg bg-surface-hover/70 p-2 text-sm">{meldung}</div>}
          <div className="flex flex-col gap-2">
            {stufen.map((st, k) => {
              const liste = pal.filter(o => o.stufe === k);
              if (!liste.length) return null;
              const zu = k > i;
              return (
                <div key={k}>
                  <div className="mb-1 text-xs font-bold text-muted">{zu ? "🔒 " : ""}{st.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {liste.map(o => {
                      const k0 = baukosten(w, o.bau), teuer = w.taler < k0;
                      return (
                        <button key={o.bau} disabled={zu} title={`${BAUTEN[o.bau].text} — ${k0} Taler`} onClick={() => { setWahl(x => (x === o.bau ? null : o.bau)); setZiel(null); setAuswahl(null); }}
                          className={`chip ${wahl === o.bau ? "chip-on" : ""} ${zu ? "opacity-40" : ""}`}>
                          {BAUTEN[o.bau].icon} {BAUTEN[o.bau].label} <span className={teuer && !zu ? "text-bad" : "text-muted"}>{k0}</span>{w.bauten.some(x => x.bau === o.bau && !x.dorf) ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-1.5">
              <button className={`chip ${wahl === "trocken" ? "chip-on" : ""}`} title="Gräben und Deich: macht ein Stück nasse Aue bebaubar" onClick={() => { setWahl(x => (x === "trocken" ? null : "trocken")); setZiel(null); }}>🌾 Trockenlegen <span className="text-muted">{TROCKEN_KOSTEN}</span></button>
              <button className={`chip ${wahl === "abriss" ? "chip-on" : ""}`} onClick={() => { setWahl(x => (x === "abriss" ? null : "abriss")); setZiel(null); }}>🧽 Abreißen</button>
            </div>
            {wahl === "trocken" && <p className="text-xs text-muted">Die blaugrüne Fläche ist Aue: Sie wird bei Hochwasser überflutet, Häuser entstehen dort nicht. Tippen oder klicken legt einen Kreis von {TROCKEN_RADIUS} m trocken (Gräben, Deich, {TROCKEN_KOSTEN} Taler) — danach wächst die Stadt hinein.</p>}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <button className="btn-primary" disabled={!w.bauten.length} onClick={() => setLaeuft(l => !l)}>{laeuft ? "⏸ Anhalten" : "▶ Zeit läuft"}</button>
            {[1, 2, 4].map(t => <button key={t} className={`chip ${tempo === t ? "chip-on" : ""}`} onClick={() => setTempo(t)}>{t}×</button>)}
            <button className="btn-secondary" title="Von vorn — der gespeicherte Stand wird gelöscht" onClick={() => { try { localStorage.removeItem(platz.current); } catch { /* egal */ } welt.current = neueWelt(g, stil, g.wahl.seed); setLaeuft(false); setMeldung(null); setAuswahl(null); drei.current?.objekte?.aktualisiere(welt.current); drei.current?.gelaende?.setzeMasken(welt.current); neuZeichnen(); }}>↺ Neu</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Werte-Kärtchen am Bauplatz: Kosten, Güter mit Reichweite, erreichte Häuser, Lage */
function Kaertchen({ stil, bau, pr, neu, besetzt, frei }: { stil: Stil; bau: BauTyp; pr: Platzpruefung; neu: boolean; besetzt?: number; frei?: number[] }) {
  const regeln = lageRegeln(stil, bau);
  const gueter = ANBIETER[bau] ?? [];
  const st = STELLEN[bau];
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-black">{BAUTEN[bau].icon} {BAUTEN[bau].label}</div>
      <div className="grid grid-cols-2 gap-x-2">
        {neu && <><span className="text-muted">Kosten</span><span>{pr.kosten} Taler</span></>}
        {gueter.map(x => <span key={x.gut} className="col-span-2">{GUETER[x.gut].icon} {GUETER[x.gut].label} für {x.minuten} min Fußweg (≈ {x.minuten * METER_JE_MINUTE} m Weg)</span>)}
        {gueter.length > 0 && <><span className="text-muted">erreicht</span><span>{pr.versorgt} Häuser</span></>}
        {st && <><span className="text-muted">Personal</span><span>{st.n} {SCHICHTEN[st.schicht].name}{besetzt !== undefined ? ` · ${Math.round(besetzt * 100)} % besetzt` : frei ? ` · frei: ${Math.floor((frei[st.schicht] ?? 0) + (frei[st.schicht - 1] ?? 0))}` : ""}</span></>}
        <span className="text-muted">Wirkung</span><span className={pr.faktor >= 1 ? "text-ok font-bold" : pr.faktor > 0 ? "font-bold text-[#ca8a04]" : "text-bad font-bold"}>{Math.round(pr.faktor * 100)} %</span>
      </div>
      {neu ? (
        <ul className="mt-1">{pr.gruende.map((x, k) => <li key={k}>{x.ok ? "✅" : "❌"} {x.text}</li>)}</ul>
      ) : (
        <ul className="mt-1 text-muted">{regeln.soll.map(t => <li key={t}>• {t}</li>)}</ul>
      )}
    </div>
  );
}

/** Baumenü (B): alle Gebäude nach Stufen, mit Preis; gesperrte grau */
function BauMenue({ stufen, pal, stufe, taler, preis, gewaehlt, waehle, zu }: {
  stufen: { name: string }[]; pal: { bau: BauTyp; stufe: number }[]; stufe: number; taler: number; preis: (b: BauTyp) => number;
  gewaehlt: string | null; waehle: (b: BauTyp | "abriss" | "trocken") => void; zu: () => void;
}) {
  return (
    <div className="absolute inset-x-4 top-12 z-10 max-h-[70%] overflow-auto rounded-xl border border-line bg-surface/97 p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-black">🏗️ Bauen <span className="text-xs font-normal text-muted">B oder Esc schließt · Umschalt halten baut mehrfach</span></div>
        <button className="chip" onClick={zu}>✕</button>
      </div>
      {stufen.map((st, k) => {
        const liste = pal.filter(o => o.stufe === k);
        if (!liste.length) return null;
        const zuGesperrt = k > stufe;
        return (
          <div key={k} className="mb-2">
            <div className="mb-1 text-xs font-bold text-muted">{zuGesperrt ? "🔒 " : ""}{st.name}</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
              {liste.map(o => {
                const k0 = preis(o.bau), teuer = taler < k0;
                return (
                  <button key={o.bau} disabled={zuGesperrt} onClick={() => waehle(o.bau)} title={BAUTEN[o.bau].text}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs ${gewaehlt === o.bau ? "border-accent bg-accent/15" : "border-line hover:bg-surface-hover"} ${zuGesperrt ? "opacity-40" : ""}`}>
                    <span className="text-lg">{BAUTEN[o.bau].icon}</span>
                    <span className="flex-1"><span className="block font-bold">{BAUTEN[o.bau].label}</span>
                      <span className={teuer && !zuGesperrt ? "text-bad" : "text-muted"}>{k0} Taler{STELLEN[o.bau] ? ` · ${STELLEN[o.bau]!.n} ${SCHICHTEN[STELLEN[o.bau]!.schicht].name}` : ""}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="mb-1 text-xs font-bold text-muted">Werkzeuge</div>
      <div className="flex flex-wrap gap-1.5">
        <button className={`chip ${gewaehlt === "trocken" ? "chip-on" : ""}`} title="Gräben und Deich: macht ein Stück nasse Aue bebaubar" onClick={() => waehle("trocken")}>🌾 Trockenlegen <span className="text-muted">{TROCKEN_KOSTEN}</span></button>
        <button className={`chip ${gewaehlt === "abriss" ? "chip-on" : ""}`} title="Gebäude anklicken zum Abreißen (oder wählen + Entf)" onClick={() => waehle("abriss")}>🧽 Abreißen</button>
      </div>
    </div>
  );
}

const ENGPASS = {
  platz: "🚧 Kein Platz mehr für neue Häuser: Wohnstraßen entstehen nur, wo Markt und Brunnen hinreichen. Setz einen weiteren Markt (ab 600 m vom ersten) und Brunnen an den Stadtrand.",
  nahrung: "🌾 Kein Zuzug: es fehlt Nahrung. Mehr Höfe ans Wegenetz, Mühle, Bäckerei oder Einfuhr.",
} as const;

/** Übersicht (I): Geld, Nahrung, Bevölkerung und Arbeit, Betriebe — je Posten */
function Uebersicht({ w, zu }: { w: Welt; zu: () => void }) {
  const geld = geldDetails(w), nah = nahrungsDetails(w), bes = besetzung(w), verk = gewerbe(w, bes);
  const f = (x: number) => x.toFixed(1).replace(".", ",");
  const betriebe = w.bauten.filter(b => STELLEN[b.bau] && !b.dorf);
  return (
    <div className="absolute inset-x-4 top-12 z-10 max-h-[75%] overflow-auto rounded-xl border border-line bg-surface/97 p-3 text-xs shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-black">📊 Übersicht <span className="font-normal text-muted">I oder Esc schließt</span></div>
        <button className="chip" onClick={zu}>✕</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <section>
          <div className="mb-1 font-bold">💰 Geld je Schritt: {geld.steuern - geld.unterhalt >= 0 ? "+" : ""}{f(geld.steuern - geld.unterhalt)}</div>
          {geld.steuernJe.map((x, k) => x > 0.05 && <div key={k} className="flex justify-between"><span>Steuern {SCHICHTEN[k].name}</span><span className="text-ok">+{f(x)}</span></div>)}
          {geld.verkauf > 0.05 && <div className="flex justify-between"><span>Verkauf der Werkstätten</span><span className="text-ok">+{f(geld.verkauf)}</span></div>}
          <div className="flex justify-between text-muted"><span>Zufriedenheit · Handel (Weberei)</span><span>{Math.round(geld.zufriedenheit * 100)} % · +{Math.round(geld.handel * 100)} %</span></div>
          <div className="flex justify-between"><span>Unterhalt Gebäude</span><span className="text-bad">−{f(geld.gebaeude)}</span></div>
          <div className="flex justify-between"><span>Unterhalt Wege ({geld.strassenfelder} Felder)</span><span className="text-bad">−{f(geld.wege)}</span></div>
          {geld.verwaltung > 0 && <div className="flex justify-between"><span>Verwaltung, Wache, Armenpflege</span><span className="text-bad">−{f(geld.verwaltung)}</span></div>}
        </section>
        <section>
          <div className="mb-1 font-bold">🌾 Nahrung: {zahl(nah.angebot)} für {zahl(nah.bedarf)} Stadtbewohner</div>
          <div className="flex justify-between"><span>Ernte aus {nah.hoefe} Höfen ({nah.angebunden} mit Weg zum Markt)</span><span>{zahl(nah.ernte)}</span></div>
          <div className="flex justify-between text-muted"><span>davon Werkzeug (Schmiede)</span><span>+{Math.round(nah.werkzeug * 100)} %</span></div>
          <div className="flex justify-between"><span>Einfuhr (Bahn, Schiff)</span><span>{zahl(nah.einfuhr)}</span></div>
          <div className="flex justify-between"><span>Mühle und Bäckerei</span><span>+{Math.round(nah.verarbeitung * 100)} %</span></div>
        </section>
        <section>
          <div className="mb-1 font-bold">👥 Bevölkerung und Arbeit</div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3">
            <span className="text-muted">Schicht</span><span className="text-muted">Leute</span><span className="text-muted">Arbeitskräfte</span><span className="text-muted">fehlen</span>
            {SCHICHTEN.map((sch, k) => {
              const leute = w.haeuser.filter(h => h.schicht === k).reduce((a, h) => a + h.bewohner, 0);
              if (!leute && !bes.fehlend[k]) return null;
              return [<span key={`a${k}`}>{sch.name}</span>, <span key={`b${k}`}>{zahl(leute)}</span>, <span key={`c${k}`}>{zahl(bes.angebot[k])}</span>, <span key={`d${k}`} className={bes.fehlend[k] > 0 ? "text-bad" : ""}>{zahl(bes.fehlend[k])}</span>];
            })}
          </div>
        </section>
        <section>
          <div className="mb-1 font-bold">🏡 Dörfer</div>
          {w.engpass && <p className="mb-1 text-bad">{ENGPASS[w.engpass]}</p>}
          {w.doerfer.map(d => (
            <div key={d.name} className="flex justify-between"><span>{d.stadt ? "🏙️" : "🏡"} {d.name}</span>
              <span className="text-muted">{hoefeIm(w, d)} Höfe{d.stadt ? "" : ` (Platz bis ${DORF_HOEFE + 3 * w.stufe})`}{dorfSchmiede(w, d) ? " · ⚒️ Dorfschmiede +15 %" : !d.stadt ? ` · Schmiede ab ${DORF_SCHMIEDE} Höfen` : ""}</span></div>
          ))}
        </section>
        <section>
          <div className="mb-1 font-bold">🏭 Betriebe ({betriebe.length})</div>
          {betriebe.map(b => {
            const q = bes.quote.get(b.id) ?? 1, v = verk.je.get(b.id);
            return <div key={b.id} className="flex justify-between gap-2"><span>{BAUTEN[b.bau].icon} {BAUTEN[b.bau].label}</span><span className={q >= 1 ? "text-ok" : q >= 0.5 ? "text-[#ca8a04]" : "text-bad"}>{Math.round(q * 100)} % besetzt{q < 0.5 ? " · steht still" : ""}
              {v && (v.grund ? <span className="text-bad"> · verkauft nichts ({v.grund})</span> : <span className={v.absatz < 0.7 ? "text-[#ca8a04]" : "text-muted"}> · Absatz {Math.round(v.absatz * 100)} % · +{f(v.ertrag)}</span>)}</span></div>;
          })}
        </section>
      </div>
    </div>
  );
}
