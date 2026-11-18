"use client";
/**
 * Reiter »Aufbau« — Stadtbau wie in Anno, in 2,5D:
 *   Mausrad zoomt vom einzelnen Haus bis zur ganzen Stadt (die Kamera kippt dabei flacher),
 *   rechte Maustaste oder Q/E dreht, ziehen oder W/A/S/D verschiebt.
 *   Touch: ein Finger verschiebt, zwei Finger zoomen und drehen; Knöpfe ⟲ ⟳ ＋ －.
 *   Gebäude drehen mit R oder ↻; auf Touch setzt Tippen den Geist, »✔ Hier bauen« baut.
 *   Der Spielstand liegt im Browser (localStorage) je Spieler (`speicherSchluessel`: Konto oder Gastname),
 *   Stadttyp und Gelände; derselbe Typ auf demselben Gelände macht dort weiter.
 *   Gebäude wählen → Geist am Mauszeiger mit Werte-Kärtchen am Bauplatz und Einzugsbereich;
 *   Klick baut. Klick auf ein Gebäude zeigt seine Werte und seinen Einzugsbereich.
 * Häuser und Straßen wachsen feldgenau von selbst (lib/stadt/aufbau.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Gelaende } from "@/lib/gelaende/gelaende";
import { BAUTEN, STILE, type BauTyp, type Stil } from "@/lib/stadt/modell";
import { BAUPLAENE, fehlt, jahrVonStand, kapazitaet, lageRegeln } from "@/lib/stadt/bauen";
import {
  baue, bauBei, beduerfnisse, fussabdruck, hausFarben, hausMitte, mitteVon, neueWelt, orteVon, pruefePlatz, reichweite, reisseAb, schritt, stufe,
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
  const plan = BAUPLAENE[stil];
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
  const drehRef = useRef(dreh); drehRef.current = dreh;
  const wahlRef = useRef(wahl); wahlRef.current = wahl;
  const rasterRef = useRef(raster); rasterRef.current = raster;
  const zielRef = useRef(ziel); zielRef.current = ziel;
  const auswahlRef = useRef(auswahl); auswahlRef.current = auswahl;
  const aktivRef = useRef(aktiv); aktivRef.current = aktiv;
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
    /** Bodenpunkt unter dem Zeiger (Karte in Metern) */
    const bodenBei = (cx: number, cy: number): { x: number; y: number } | null => {
      const d = drei.current;
      if (!d?.gelaende) return null;
      const r = renderer.domElement.getBoundingClientRect();
      maus.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      strahl.setFromCamera(maus, kamera);
      const t = strahl.intersectObjects(d.gelaende.gruppe.children.filter(o => o.userData.gelaende), false)[0];
      return t ? { x: t.point.x + g.breite / 2, y: t.point.z + g.breite / 2 } : null;
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
      finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (finger.size === 2) { zwei = zweiMessen(); if (griff) griff.weit = 99; return; }
      griff = { x: e.clientX, y: e.clientY, knopf: e.button, weit: 0, touch: e.pointerType === "touch" };
    };
    const zug = (e: PointerEvent) => {
      const d = drei.current!;
      if (finger.has(e.pointerId)) finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
        const dx = e.clientX - griff.x, dy = e.clientY - griff.y;
        griff.weit += Math.abs(dx) + Math.abs(dy);
        griff.x = e.clientX; griff.y = e.clientY;
        if (griff.knopf === 2 || griff.knopf === 1) d.rig.ziel.yaw -= dx * 0.006;
        else if (griff.weit > 5) verschiebe(dx, dy); // Bildschirmbewegung in Bodenrichtung, so weit wie der Abstand
        return;
      }
      const b = wahlRef.current;
      if (b === "trocken") { trockenPunkt = bodenBei(e.clientX, e.clientY); return; }
      if (!b || b === "abriss") return;
      const p = bodenBei(e.clientX, e.clientY);
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
      if (!gr || gr.weit > 5 || gr.knopf !== 0 || finger.size > 0) return;
      const p = bodenBei(e.clientX, e.clientY);
      if (!p) return;
      const w = welt.current, b = wahlRef.current;
      if (b === "abriss") {
        const o = bauBei(w, Math.floor(p.x / g.zelle), Math.floor(p.y / g.zelle));
        if (o) { reisseAb(g, w, o.id); setMeldung(`🧽 ${BAUTEN[o.bau].label} abgerissen.`); drei.current?.objekte?.aktualisiere(w); drei.current?.gelaende?.setzeMasken(w); speichernRef.current(); neuZeichnen(); }
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
      const d = drei.current!, alt = d.rig.ziel.d;
      const neu = Math.max(NAH, Math.min(FERN, alt * (e.deltaY > 0 ? 1.18 : 1 / 1.18)));
      // beim Hineinzoomen zum Zeiger hin
      const p = bodenBei(e.clientX, e.clientY);
      if (p && neu < alt) {
        const f = 1 - neu / alt;
        d.rig.ziel.x += (p.x - g.breite / 2 - d.rig.ziel.x) * f;
        d.rig.ziel.z += (p.y - g.breite / 2 - d.rig.ziel.z) * f;
      }
      d.rig.ziel.d = neu;
    };
    const runter = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "escape") { setWahl(null); setZiel(null); setAuswahl(null); return; }
      if (k === "r") { drehenRef.current(); return; }
      if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { e.preventDefault(); drei.current?.tasten.add(k); }
    };
    const hoch = (e: KeyboardEvent) => drei.current?.tasten.delete(e.key.toLowerCase());
    const c = renderer.domElement;
    const kein = (e: Event) => e.preventDefault();
    c.addEventListener("pointerdown", druck);
    c.addEventListener("pointermove", zug);
    c.addEventListener("pointerup", los);
    c.addEventListener("pointercancel", los);
    c.addEventListener("wheel", rad, { passive: false });
    c.addEventListener("contextmenu", kein);
    c.addEventListener("keydown", runter);
    c.addEventListener("keyup", hoch);
    c.addEventListener("blur", () => drei.current?.tasten.clear());

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
        if (kreis) {
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
      c.removeEventListener("wheel", rad);
      drei.current?.gelaende?.entsorge();
      drei.current?.objekte?.entsorge();
      drei.current = null;
      renderer.dispose();
      el.removeChild(c);
    };
  }, [g]);

  /** baut das gewählte Gebäude mit der aktuellen Drehung bei (i, j) */
  const bauen = (i: number, j: number) => {
    const w = welt.current, b = wahl;
    if (!b || b === "abriss" || b === "trocken") return;
    const pr = pruefePlatz(g, w, b, i, j, dreh);
    if (!pr.ok) { setMeldung(`❌ ${BAUTEN[b].label}: ${pr.gruende.filter(x => !x.ok).map(x => x.text).slice(0, 2).join(", ")}`); return; }
    const neu = baue(g, w, b, i, j, dreh)!;
    setMeldung(pr.faktor < 1 ? `⚠️ ${BAUTEN[b].label} steht ungünstig — wirkt nur zu ${Math.round(pr.faktor * 100)} %.` : `✅ ${BAUTEN[b].label} gebaut.`);
    setAuswahl({ id: neu.id });
    setWahl(null); setZiel(null);
    if (w.bauten.length === 1) setLaeuft(true);
    drei.current?.objekte?.aktualisiere(w);
    drei.current?.gelaende?.setzeMasken(w);
    speichern();
    neuZeichnen();
  };
  const bauenRef = useRef(bauen); bauenRef.current = bauen;
  /** Gebäude um eine Vierteldrehung weiterdrehen; der Geist bleibt an seinem Platz */
  const drehen = () => {
    const nd = (dreh + 1) % 4;
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
      if (stufe(w) > alt) setMeldung(`🎉 Neue Stufe: ${plan.stufen[stufe(w)].name} — mehr Land ist erschlossen.`);
      if (d?.objekte) d.objekte.aktualisiere(w);
      if (d?.gelaende) {
        const s = w.frei.reduce((a, x) => a + x, 0);
        if (s !== d.freiSumme) { d.gelaende.setzeMasken(w); d.freiSumme = s; }
      }
      neuZeichnen();
    }, 450 / tempo);
    return () => clearInterval(t);
  }, [laeuft, aktiv, tempo, g, plan]);

  const w = welt.current;
  const i = stufe(w);
  const { kap } = kapazitaet(g, stil, { orte: orteVon(w), einwohner: w.einwohner, tick: w.tick });
  const fehlend = fehlt(plan, { orte: orteVon(w), einwohner: w.einwohner, tick: 0 });
  const naechste = plan.stufen[i + 1];
  const bed = beduerfnisse(w);
  const deckung = useMemo(() => bed.map(b => ({ b, anteil: w.haeuser.length ? w.haeuser.filter(h => w.bauten.some(o => o.bau === b && Math.hypot(mitteVon(w, o).x - hausMitte(w, h).x, mitteVon(w, o).y - hausMitte(w, h).y) <= reichweite(b))).length / w.haeuser.length : 0 })), [bed.join(), w.haeuser.length, w.bauten.length]);
  const gewaehlt = auswahl ? w.bauten.find(o => o.id === auswahl.id) ?? null : null;
  const kaertchen = ziel
    ? { bau: ziel.bau, pr: ziel.pr, neu: true }
    : gewaehlt ? { bau: gewaehlt.bau, pr: pruefePlatzVorhanden(g, w, gewaehlt.id), neu: false } : null;

  if (ohneWebGL) return <div className="flex h-[640px] items-center justify-center rounded-xl border border-line text-muted">Der Aufbau braucht WebGL — dein Browser bietet es gerade nicht an.</div>;
  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex flex-wrap self-start rounded-xl border border-line bg-surface p-1">
        {STILE.map(s => <button key={s.id} onClick={() => setStil(s.id)} className={chip(stil === s.id)}>{s.icon} {s.kurz}</button>)}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div ref={huelle} className="relative h-[640px] overflow-hidden rounded-xl border border-line bg-[#b7d4ea]">
          <div ref={karte} className="absolute inset-0" />
          {laedt && <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow">⏳ Gelände wird geformt …</div>}
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-black/45 px-2 py-1 text-xs text-white">
            Mausrad / zwei Finger: Haus ↔ Stadt · rechte Maustaste / Q E: drehen · ziehen / W A S D: schieben · R: Gebäude drehen · Esc
          </div>
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button className={`chip ${raster ? "chip-on" : ""}`} onClick={() => setRaster(r => !r)}># Raster</button>
          </div>
          {/* Knopfleiste für Touch (und Maus): Ansicht drehen und zoomen, Gebäude drehen und bauen */}
          <div className="absolute bottom-16 right-2 flex flex-col items-end gap-1.5">
            {ziel && <button className="btn-primary py-1.5" disabled={!ziel.pr.ok} onClick={() => bauen(ziel.i, ziel.j)}>✔ Hier bauen</button>}
            {wahl && wahl !== "abriss" && <button className="btn-secondary py-1.5" onClick={drehen} title="Gebäude drehen (R)">↻ Gebäude drehen</button>}
            {(wahl || ziel) && <button className="btn-secondary py-1.5" onClick={() => { setWahl(null); setZiel(null); }}>✕ Abbrechen</button>}
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
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Stufe {i + 1} von {plan.stufen.length} · Jahr {jahrText(jahrVonStand(plan, w.einwohner))}</div>
            <h2 className="text-lg font-black">{plan.stufen[i].name}</h2>
          </div>
          <div className="text-xs">
            <div className="flex justify-between"><span>👥 {zahl(w.einwohner)} in {zahl(w.haeuser.length)} Häusern</span><span className="text-muted">Platz für {zahl(kap)}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className="h-full bg-accent" style={{ width: `${Math.min(100, (w.einwohner / Math.max(1, naechste?.ab ?? kap)) * 100)}%` }} /></div>
            {naechste && <p className="mt-1 text-muted">Nächste Stufe »{naechste.name}« ab {zahl(naechste.ab)} Einwohnern — erschließt neues Land.</p>}
            {!w.bauten.length && <p className="mt-1 font-bold">👉 Wähle {BAUTEN[plan.stufen[0].braucht[0]].icon} {BAUTEN[plan.stufen[0].braucht[0]].label} und setze es in die Landschaft. Die Farbe am Boden zeigt, ob der Platz passt.</p>}
            {fehlend.length > 0 && w.bauten.length > 0 && <p className="mt-1">Für den Aufstieg fehlt: {fehlend.map(b => `${BAUTEN[b].icon} ${BAUTEN[b].label}`).join(", ")}</p>}
          </div>
          {deckung.length > 0 && w.haeuser.length > 0 && (
            <div className="text-xs">
              <div className="mb-1 font-bold text-muted">Versorgung der Häuser</div>
              {deckung.map(x => (
                <div key={x.b} className="flex items-center gap-2">
                  <span className="w-32 truncate">{BAUTEN[x.b].icon} {BAUTEN[x.b].label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-line"><div className="h-full" style={{ width: `${x.anteil * 100}%`, background: x.anteil > 0.8 ? "#16a34a" : x.anteil > 0.4 ? "#d97706" : "#dc2626" }} /></div>
                  <span className="w-9 text-right">{Math.round(x.anteil * 100)} %</span>
                </div>
              ))}
              <p className="mt-1 text-muted">Gut versorgte Häuser wachsen und haben mehr Bewohner.</p>
            </div>
          )}
          {meldung && <div className="rounded-lg bg-surface-hover/70 p-2 text-sm">{meldung}</div>}
          <div className="flex flex-col gap-2">
            {plan.stufen.map((st, k) => {
              const liste = plan.orte.filter(o => o.stufe === k);
              if (!liste.length) return null;
              const zu = k > i;
              return (
                <div key={k}>
                  <div className="mb-1 text-xs font-bold text-muted">{zu ? "🔒 " : ""}{st.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {liste.map(o => (
                      <button key={o.bau} disabled={zu} title={BAUTEN[o.bau].text} onClick={() => { setWahl(x => (x === o.bau ? null : o.bau)); setZiel(null); setAuswahl(null); }}
                        className={`chip ${wahl === o.bau ? "chip-on" : ""} ${zu ? "opacity-40" : ""}`}>
                        {BAUTEN[o.bau].icon} {BAUTEN[o.bau].label}{w.bauten.filter(x => x.bau === o.bau).length ? " ✓" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-1.5">
              <button className={`chip ${wahl === "trocken" ? "chip-on" : ""}`} title="Gräben und Deich: macht ein Stück nasse Aue bebaubar" onClick={() => { setWahl(x => (x === "trocken" ? null : "trocken")); setZiel(null); }}>🌾 Trockenlegen</button>
              <button className={`chip ${wahl === "abriss" ? "chip-on" : ""}`} onClick={() => { setWahl(x => (x === "abriss" ? null : "abriss")); setZiel(null); }}>🧽 Abreißen</button>
            </div>
            {wahl === "trocken" && <p className="text-xs text-muted">Die blaugrüne Fläche ist Aue: Sie wird bei Hochwasser überflutet, Häuser entstehen dort nicht. Tippen oder klicken legt einen Kreis von {TROCKEN_RADIUS} m trocken (Gräben, Deich) — danach wächst die Stadt hinein.</p>}
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

/** Werte eines gebauten Gebäudes (Lage neu geprüft, ohne sich selbst als Hindernis) */
function pruefePlatzVorhanden(g: Gelaende, w: Welt, id: number): Platzpruefung {
  const o = w.bauten.find(x => x.id === id)!;
  const r = reichweite(o.bau), m = mitteVon(w, o);
  return {
    ok: true, faktor: o.faktor, gruende: [],
    versorgt: w.haeuser.filter(h => Math.hypot(hausMitte(w, h).x - m.x, hausMitte(w, h).y - m.y) <= r).length,
  };
}

/** Werte-Kärtchen am Bauplatz */
function Kaertchen({ stil, bau, pr, neu }: { stil: Stil; bau: BauTyp; pr: Platzpruefung; neu: boolean }) {
  const s = BAUPLAENE[stil].orte.find(o => o.bau === bau);
  const regeln = lageRegeln(stil, bau);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm font-black">{BAUTEN[bau].icon} {BAUTEN[bau].label}</div>
      <div className="grid grid-cols-2 gap-x-2">
        <span className="text-muted">Einzugsbereich</span><span>{reichweite(bau)} m</span>
        <span className="text-muted">Häuser darin</span><span>{pr.versorgt}</span>
        <span className="text-muted">Platz für</span><span>{s ? `${zahl(s.kap * pr.faktor)} Einw.` : "–"}</span>
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
