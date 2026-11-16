"use client";
/**
 * Freie 3D-Ansicht: Die Figur läuft frei durch eine gemalte Welt, die Kamera
 * folgt ihr über die Schulter.
 *
 *   W/S oder ↑/↓ laufen, A/D oder ←/→ drehen, Umschalt rennt
 *   Maus ziehen (oder wischen) dreht die Kamera, Mausrad zoomt
 *   Klick/Tippen auf den Boden oder eine Station: hinlaufen
 *   1–9 läuft zur Station mit dieser Nummer, 0 zum Tor; E öffnet, was vor einem steht
 *   auf Tablets: Steuerknüppel unten links
 *
 * Kennt wie das Gebäude keine Inhalte: Wer die Welt benutzt, gibt Karte,
 * Zustände und Abschnitt vor und entscheidet, was bei der Ankunft passiert.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  feldBei, feldMitte, freiWeg, freieStrecke, istFrei, ortBei, ortMitte, schiebeHeraus,
  type FreiOrt, type FreiPlan,
} from "@/lib/gebaeude/frei";
import type { Objekt } from "@/lib/gebaeude/objekte";
import { tickMonster } from "@/lib/angriffe/monsterLader";
import { STANDARD_AVATAR, baueAvatar, type Avatar } from "../avatar";
import { beendeAvatar, bewegeAvatar, tickAvatare } from "../avatarModell";
import { entsorge, type RaumZustand, type Stil } from "../szene";
import { baueMaler, type Guete, type Maler } from "./malfilter";
import { baueLandschaft, baueOrte, type Landschaft, type Marke } from "./welt";

interface Props {
  plan: FreiPlan;
  stock: number;
  /** je Abschnitt die Zustände seiner Stationen */
  zustaende: RaumZustand[][];
  /** je Abschnitt: Tor schon offen? */
  zielOffen: boolean[];
  objekte?: Objekt[][];
  /** je Abschnitt der Baustil — er bestimmt die Welt (Gebäude, Höhle, Wald) */
  stile: Stil[];
  avatar?: Avatar;
  /** je Abschnitt: bewacht ein Boss das Tor? */
  waechter?: boolean[];
  /** Tastatur und Zeiger an (aus, solange z. B. ein Aufgabenfenster offen ist) */
  aktiv: boolean;
  /** von außen: dorthin laufen (neue `nr` = neuer Auftrag) */
  auftrag?: { ort: FreiOrt; nr: number } | null;
  /** Karte ist bei gleichem `seed` gleich bepflanzt */
  seed: number;
  onAnkunft: (ort: FreiOrt) => void;
}

const GEHEN = 6.2, RENNEN = 9.5, DREHEN = 2.3;
const RADIUS = 0.42;
const GUETE_SCHLUESSEL = "hp_frei_guete";
const GUETE_NAME: Record<Guete, string> = { 2: "🎨 gemalt", 1: "🖌️ leicht gemalt", 0: "⚡ schnell" };
const ortSchluessel = (o: FreiOrt | null) => (o ? (o.art === "raum" ? `raum${o.raum}` : o.art) : "");
const TON: Record<Marke["ton"], string> = {
  offen: "bg-amber-100 text-amber-950 border-amber-500", geloest: "bg-green-200 text-green-950 border-green-600",
  info: "bg-blue-100 text-blue-950 border-blue-500", gelesen: "bg-slate-200 text-slate-800 border-slate-500",
  zu: "bg-rose-200 text-rose-950 border-rose-600", weiter: "bg-green-200 text-green-950 border-green-600",
};

export default function FreiWelt({
  plan, stock, zustaende, zielOffen, objekte, stile, avatar = STANDARD_AVATAR, waechter, aktiv, auftrag, seed, onAnkunft,
}: Props) {
  const huelle = useRef<HTMLDivElement>(null);
  const [fehler, setFehler] = useState(false);
  const [marken, setMarken] = useState<Marke[]>([]);
  const markenEl = useRef<(HTMLDivElement | null)[]>([]);
  const [nah, setNah] = useState<FreiOrt | null>(null);
  const [guete, setGuete] = useState<Guete>(2);
  const [finger, setFinger] = useState(false);
  const knueppel = useRef<HTMLDivElement>(null);
  const knauf = useRef<HTMLDivElement>(null);

  // Alles, was die Zeichenschleife liest, steht in einem Ref.
  const lage = useRef({
    plan, stock, aktiv, onAnkunft, guete,
    x: 0, z: 0, blick: 0, neigung: 0.34, abstand: 6.5,
    /** Wegpunkte (Welt) für das Laufen per Klick oder Auftrag */
    pfad: [] as [number, number][],
    /** an diesem Ort soll der Weg enden */
    pfadOrt: null as FreiOrt | null,
    tasten: new Set<string>(),
    knueppel: { x: 0, y: 0 },
    /** an welchem Ort die Figur gerade steht */
    drin: "",
    wandHoehe: 0,
    marken: [] as Marke[],
    setNah, setGuete,
  });
  Object.assign(lage.current, { plan, stock, aktiv, onAnkunft, guete });

  const drei = useRef<{
    szene: THREE.Scene; land: THREE.Group; orte: THREE.Group; spieler: THREE.Group;
    himmel: THREE.HemisphereLight; sonne: THREE.DirectionalLight; fackel: THREE.PointLight;
    nebel: THREE.FogExp2; maler: Maler; sonneVon: THREE.Vector3;
  } | null>(null);

  /** Figur an den Anfang (oder ans Tor) des Abschnitts stellen, Blick zur Kartenmitte */
  const stelle = (anTor: boolean) => {
    const l = lage.current, e = l.plan.ebenen[l.stock];
    const [fx, fy] = anTor ? e.ziel : e.start;
    // ein Stück neben die Mitte: dort steht das Tor
    l.x = feldMitte(fx) + 0.2; l.z = feldMitte(fy) + 2.1;
    l.pfad = []; l.pfadOrt = null; l.tasten.clear();
    // Blick den Weg entlang (zur ersten Station bzw. zum Tor), nicht gegen die Wand
    const hin = freiWeg(e, [feldBei(l.x), feldBei(l.z)], anTor || !e.raeume.length ? (anTor ? e.start : e.ziel) : [e.raeume[0].x, e.raeume[0].y]);
    const vorn = hin[Math.min(hin.length - 1, 7)];
    l.blick = vorn ? Math.atan2(feldMitte(vorn[0]) - l.x, feldMitte(vorn[1]) - l.z) : 0;
    l.drin = ortSchluessel(ortBei(e, l.x, l.z, l.stock > 0));
    l.setNah(ortBei(e, l.x, l.z, l.stock > 0));
  };

  /** Weg zu einem Ort bzw. Feld anlegen */
  const laufeZu = (ort: FreiOrt | null, feld?: [number, number]) => {
    const l = lage.current, e = l.plan.ebenen[l.stock];
    const ziel: [number, number] = ort ? (ort.art === "ziel" ? e.ziel : ort.art === "zurueck" ? e.start : [e.raeume[ort.raum].x, e.raeume[ort.raum].y]) : feld!;
    const von: [number, number] = [feldBei(l.x), feldBei(l.z)];
    if (ort && ortSchluessel(ortBei(e, l.x, l.z, l.stock > 0)) === ortSchluessel(ort)) { l.onAnkunft(ort); return; }
    l.pfad = freiWeg(e, von, ziel).map(([x, y]) => [feldMitte(x), feldMitte(y)]);
    l.pfadOrt = ort;
  };

  // ── einmalig: Renderer, Licht, Eingaben, Schleife ────────────────────────
  useEffect(() => {
    const el = huelle.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      setFehler(true);
      return;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const flaeche = renderer.domElement;
    el.appendChild(flaeche);
    Object.assign(flaeche.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });

    let start: Guete = 2;
    try { const g = Number(localStorage.getItem(GUETE_SCHLUESSEL)); if (g === 0 || g === 1) start = g; } catch { /* ohne Speicher */ }
    // ?guete=0…2 legt die Darstellung fest (zum Prüfen): dann wird auch nichts von selbst heruntergestellt
    const fest = new URLSearchParams(window.location.search).get("guete");
    if (fest === "0" || fest === "1" || fest === "2") start = Number(fest) as Guete;
    lage.current.guete = start;
    setGuete(start);
    setFinger(window.matchMedia?.("(pointer: coarse)").matches ?? false);
    const maler = baueMaler(renderer, start);

    const szene = new THREE.Scene();
    const nebel = new THREE.FogExp2(0xffffff, 0.01);
    szene.fog = nebel;
    const himmel = new THREE.HemisphereLight(0xffffff, 0x445566, 1);
    const sonne = new THREE.DirectionalLight(0xffffff, 1);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(2048, 2048);
    Object.assign(sonne.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
    sonne.shadow.bias = -0.0006;
    sonne.shadow.normalBias = 0.05;
    const fackel = new THREE.PointLight(0xffc48a, 0, 26, 1.3);
    const land = new THREE.Group(), orte = new THREE.Group(), spieler = new THREE.Group();
    spieler.scale.setScalar(1.4);
    szene.add(himmel, sonne, sonne.target, fackel, land, orte, spieler);
    drei.current = { szene, land, orte, spieler, himmel, sonne, fackel, nebel, maler, sonneVon: new THREE.Vector3(0, 1, 0) };

    const kamera = new THREE.PerspectiveCamera(55, 1, 0.2, 500);
    const groesse = () => {
      const b = el.clientWidth || 1, h = el.clientHeight || 1;
      maler.groesse(b, h);
      kamera.aspect = b / h;
      kamera.updateProjectionMatrix();
    };
    groesse();
    const ro = new ResizeObserver(groesse);
    ro.observe(el);

    // ── Tastatur ──
    const LAUF = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"]);
    const runter = (ev: KeyboardEvent) => {
      const l = lage.current;
      const t = ev.target as HTMLElement;
      if (!l.aktiv || t.closest("input, textarea, select, [contenteditable]")) return;
      const e = l.plan.ebenen[l.stock];
      const ziffer = /^(?:Numpad|Digit)([0-9])$/.exec(ev.code)?.[1] ?? (/^[0-9]$/.test(ev.key) ? ev.key : null);
      if (ziffer !== null) {
        const n = Number(ziffer);
        if (n === 0) laufeZu({ art: "ziel" });
        else if (e.raeume[n - 1]) laufeZu({ art: "raum", raum: n - 1 });
        ev.preventDefault();
        return;
      }
      const k = ev.key.toLowerCase();
      if (k === "e" || k === "enter") {
        const ort = ortBei(e, l.x, l.z, l.stock > 0);
        if (ort) { ev.preventDefault(); l.onAnkunft(ort); }
        return;
      }
      if (!LAUF.has(k)) return;
      ev.preventDefault();
      l.tasten.add(k);
      if (k !== "shift") { l.pfad = []; l.pfadOrt = null; }
    };
    const hoch = (ev: KeyboardEvent) => { lage.current.tasten.delete(ev.key.toLowerCase()); };
    const weg = () => lage.current.tasten.clear();
    window.addEventListener("keydown", runter);
    window.addEventListener("keyup", hoch);
    window.addEventListener("blur", weg);

    // ── Zeiger: ziehen dreht, tippen läuft ──
    const zeiger = new THREE.Raycaster();
    let griff: { id: number; x: number; y: number; weit: number; zeit: number } | null = null;
    const druck = (ev: PointerEvent) => {
      if (!lage.current.aktiv) return;
      griff = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, weit: 0, zeit: performance.now() };
      flaeche.setPointerCapture(ev.pointerId);
    };
    const zug = (ev: PointerEvent) => {
      if (!griff || griff.id !== ev.pointerId) return;
      const l = lage.current, dx = ev.clientX - griff.x, dy = ev.clientY - griff.y;
      griff.weit += Math.abs(dx) + Math.abs(dy);
      griff.x = ev.clientX; griff.y = ev.clientY;
      if (griff.weit < 6) return;
      l.blick -= dx * 0.006;
      l.neigung = Math.max(0.05, Math.min(1.25, l.neigung + dy * 0.004));
    };
    const los = (ev: PointerEvent) => {
      if (!griff || griff.id !== ev.pointerId) return;
      const tipp = griff.weit < 6 && performance.now() - griff.zeit < 500;
      griff = null;
      const l = lage.current;
      if (!tipp || !l.aktiv) return;
      const r = flaeche.getBoundingClientRect();
      zeiger.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), kamera);
      // zuerst: eine Station, das Tor oder den Rückweg getroffen?
      for (const tr of zeiger.intersectObject(orte, true)) {
        let o: THREE.Object3D | null = tr.object;
        while (o && !o.userData.ort) o = o.parent;
        if (o) { laufeZu(o.userData.ort as FreiOrt); return; }
      }
      const p = new THREE.Vector3();
      if (!zeiger.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return;
      const feld: [number, number] = [feldBei(p.x), feldBei(p.z)];
      if (istFrei(l.plan.ebenen[l.stock], feld[0], feld[1])) laufeZu(null, feld);
    };
    const rad = (ev: WheelEvent) => {
      if (!lage.current.aktiv) return;
      ev.preventDefault();
      lage.current.abstand = Math.max(3, Math.min(12, lage.current.abstand * (ev.deltaY > 0 ? 1.1 : 0.9)));
    };
    flaeche.addEventListener("pointerdown", druck);
    flaeche.addEventListener("pointermove", zug);
    flaeche.addEventListener("pointerup", los);
    flaeche.addEventListener("pointercancel", los);
    flaeche.addEventListener("wheel", rad, { passive: false });

    // ── Schleife ──
    const auge = new THREE.Vector3(), kopf = new THREE.Vector3(), punkt = new THREE.Vector3();
    let id = 0, zuletzt = performance.now(), lahm = 0, gemessen = 0, bilder = 0;
    const bild = (jetzt: number) => {
      const roh = (jetzt - zuletzt) / 1000;
      const dt = Math.min(0.1, roh);
      zuletzt = jetzt;
      tickMonster(dt);
      tickAvatare();
      const l = lage.current, d = drei.current;
      if (!d) return;
      const e = l.plan.ebenen[l.stock];

      // Eingaben: Tasten und Steuerknüppel
      let vor = 0, dreh = 0;
      if (l.aktiv) {
        const t = l.tasten;
        vor = (t.has("w") || t.has("arrowup") ? 1 : 0) - (t.has("s") || t.has("arrowdown") ? 1 : 0) - l.knueppel.y;
        dreh = (t.has("a") || t.has("arrowleft") ? 1 : 0) - (t.has("d") || t.has("arrowright") ? 1 : 0) - l.knueppel.x;
        vor = Math.max(-1, Math.min(1, vor));
        dreh = Math.max(-1, Math.min(1, dreh));
      }
      if (Math.abs(l.knueppel.x) + Math.abs(l.knueppel.y) > 0.1 && l.pfad.length) { l.pfad = []; l.pfadOrt = null; }
      l.blick += dreh * DREHEN * dt;

      let vx = 0, vz = 0, tempo = 0;
      if (l.pfad.length) {
        // gerade Strecken abkürzen: den fernsten Wegpunkt ansteuern, zu dem nichts im Weg ist
        while (l.pfad.length > 1 && freieStrecke(e, l.x, l.z, l.pfad[1][0], l.pfad[1][1], RADIUS + 0.05) === 1) l.pfad.shift();
        const [zx, zz] = l.pfad[0];
        const rest = Math.hypot(zx - l.x, zz - l.z);
        tempo = l.pfad.length > 6 ? RENNEN : GEHEN;
        // vor einer Station bzw. dem Tor stehen bleiben, nicht hineinlaufen
        const amOrt = l.pfadOrt && (() => { const [mx, mz] = ortMitte(e, l.pfadOrt!); return Math.hypot(mx - l.x, mz - l.z) < 1.9; })();
        if (amOrt) { l.pfad = []; l.pfadOrt = null; tempo = 0; }
        else if (rest < 0.25) { l.pfad.shift(); if (!l.pfad.length) l.pfadOrt = null; }
        else { vx = (zx - l.x) / rest; vz = (zz - l.z) / rest; }
        // die Kamera schwenkt sacht hinter die Figur
        if (vx || vz) {
          let diff = Math.atan2(vx, vz) - l.blick;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          l.blick += diff * Math.min(1, dt * 1.6);
        }
      } else if (vor) {
        vx = Math.sin(l.blick) * vor; vz = Math.cos(l.blick) * vor;
        tempo = (l.tasten.has("shift") ? RENNEN : GEHEN) * (vor < 0 ? 0.6 : 1) * Math.abs(vor);
        const n = Math.hypot(vx, vz);
        vx /= n; vz /= n;
      }
      const laeuft = tempo > 0 && (vx !== 0 || vz !== 0);
      if (laeuft) {
        [l.x, l.z] = schiebeHeraus(e, l.x + vx * tempo * dt, l.z + vz * tempo * dt, RADIUS);
        // um die Stationen herum: nicht durch das Objekt laufen
        e.raeume.forEach((_, k) => {
          const [mx, mz] = ortMitte(e, { art: "raum", raum: k });
          const ab = Math.hypot(l.x - mx, l.z - mz);
          if (ab < 1.15 && ab > 1e-6) { l.x = mx + ((l.x - mx) / ab) * 1.15; l.z = mz + ((l.z - mz) / ab) * 1.15; }
        });
        let diff = Math.atan2(vx, vz) - d.spieler.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        d.spieler.rotation.y += diff * Math.min(1, dt * 12);
      }
      d.spieler.position.set(l.x, 0, l.z);
      const figur = d.spieler.children[0];
      if (figur) bewegeAvatar(figur, laeuft ? (tempo > GEHEN + 0.5 ? "rennen" : "lauf") : "idle");
      // ohne Bewegungsclips (Modell lädt noch) hüpft die Figur beim Laufen
      if (laeuft && !figur?.userData.bewegung) d.spieler.position.y = Math.abs(Math.sin(jetzt / 90)) * 0.08;

      // Ankunft: neu an einem Ort
      const ort = ortBei(e, l.x, l.z, l.stock > 0);
      const schluessel = ortSchluessel(ort);
      if (schluessel !== l.drin) {
        l.drin = schluessel;
        l.setNah(ort);
        // der Rückweg öffnet sich nur auf Wunsch (E bzw. Knopf), sonst liefe man aus Versehen zurück
        if (ort && ort.art !== "zurueck" && l.aktiv) { l.pfad = []; l.pfadOrt = null; l.tasten.clear(); l.onAnkunft(ort); }
      }

      // Kamera über der Schulter; Wände halten sie auf
      kopf.set(l.x, 2.1, l.z);
      const flach = Math.cos(l.neigung) * l.abstand, steil = Math.sin(l.neigung) * l.abstand;
      let anteil = 1;
      if (l.wandHoehe > 0 && kopf.y + steil < l.wandHoehe + 0.4) {
        anteil = freieStrecke(e, l.x, l.z, l.x - Math.sin(l.blick) * flach, l.z - Math.cos(l.blick) * flach, 0.35);
        anteil = Math.max(0.4, anteil - 0.04);
      }
      punkt.set(l.x - Math.sin(l.blick) * flach * anteil, kopf.y + steil * anteil, l.z - Math.cos(l.blick) * flach * anteil);
      auge.lerp(punkt, Math.min(1, dt * 14));
      kamera.position.copy(auge);
      kamera.lookAt(kopf);

      // Licht wandert mit
      d.fackel.position.set(l.x, 3.4, l.z);
      if (d.fackel.userData.staerke) d.fackel.intensity = d.fackel.userData.staerke + Math.sin(jetzt / 70) * 2.5 + Math.sin(jetzt / 23) * 1.5;
      d.sonne.target.position.set(l.x, 0, l.z);
      d.sonne.position.set(l.x + d.sonneVon.x * 70, d.sonneVon.y * 70, l.z + d.sonneVon.z * 70);

      d.maler.male(szene, kamera);

      // Schilder über den Stationen
      const b = el.clientWidth, h = el.clientHeight;
      l.marken.forEach((m, i) => {
        const s = markenEl.current[i];
        if (!s) return;
        punkt.set(m.x, m.y, m.z).project(kamera);
        const weit = Math.hypot(m.x - l.x, m.z - l.z);
        if (punkt.z > 1 || punkt.z < -1) { s.style.display = "none"; return; }
        s.style.display = "";
        s.style.transform = `translate(-50%, -50%) translate(${((punkt.x + 1) / 2) * b}px, ${((1 - punkt.y) / 2) * h}px) scale(${Math.max(0.55, Math.min(1.15, 9 / weit))})`;
        s.style.opacity = String(Math.max(0.45, Math.min(1, 26 / weit)));
      });

      // zu langsam? Dann den Pinsel schmaler stellen (einmal alle paar Sekunden prüfen)
      bilder++; gemessen += roh;
      if (gemessen > 3) {
        if (bilder / gemessen < 24 && document.visibilityState === "visible") lahm++; else lahm = 0;
        if (lahm >= 2 && l.guete > 0 && fest === null) { l.setGuete((l.guete - 1) as Guete); lahm = 0; }
        bilder = 0; gemessen = 0;
      }
    };
    const schleife = (jetzt: number) => { id = requestAnimationFrame(schleife); bild(jetzt); };
    stelle(false);
    id = requestAnimationFrame(schleife);
    // ?takt: Bilder von Hand weiterschalten (zum Prüfen, wenn der Browser im Hintergrund keine Bilder zeichnet)
    if (new URLSearchParams(window.location.search).has("takt")) {
      (window as unknown as Record<string, unknown>).hpFrei = { lage: lage.current, flaeche, renderer, bild: (ms = 16) => bild(zuletzt + ms) };
    }

    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("keydown", runter);
      window.removeEventListener("keyup", hoch);
      window.removeEventListener("blur", weg);
      for (const k of spieler.children) beendeAvatar(k);
      entsorge(szene);
      maler.entsorge();
      renderer.dispose();
      el.removeChild(flaeche);
      drei.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Güte: an den Maler geben und merken
  useEffect(() => {
    drei.current?.maler.guete(guete);
    const s = drei.current?.sonne.shadow;
    if (s) { s.mapSize.setScalar(guete === 2 ? 2048 : 1024); s.map?.dispose(); s.map = null; }
  }, [guete]);
  const waehleGuete = () => {
    const g = ((guete + 2) % 3) as Guete;
    setGuete(g);
    try { localStorage.setItem(GUETE_SCHLUESSEL, String(g)); } catch { /* egal */ }
  };

  // ── Spielfigur ───────────────────────────────────────────────────────────
  const avatarSchluessel = JSON.stringify(avatar);
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    for (const k of [...d.spieler.children]) { d.spieler.remove(k); beendeAvatar(k); entsorge(k); }
    const figur = baueAvatar(avatar);
    const schatten = () => figur.traverse(o => { o.castShadow = !o.userData.umriss; });
    figur.userData.beiModell = schatten;
    schatten();
    d.spieler.add(figur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarSchluessel]);

  // ── Landschaft: einmal je Abschnitt und Stil ─────────────────────────────
  const stil = stile[stock] ?? "wald";
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    for (const k of [...d.land.children]) { d.land.remove(k); entsorge(k); }
    const land: Landschaft = baueLandschaft(plan.ebenen[stock], stil, seed + stock);
    d.land.add(land.gruppe);
    const s = land.stimmung;
    d.nebel.color.set(s.nebel);
    d.nebel.density = s.dichte;
    d.himmel.color.set(s.oben); d.himmel.groundColor.set(s.unten); d.himmel.intensity = s.umgebung;
    d.sonne.color.set(s.sonne); d.sonne.intensity = s.sonneStaerke; d.sonne.castShadow = s.sonneStaerke > 0.2;
    d.sonneVon.set(...s.sonneVon).normalize();
    d.fackel.intensity = s.fackel; d.fackel.userData.staerke = s.fackel;
    d.maler.belichtung(s.belichtung);
    lage.current.wandHoehe = land.wandHoehe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, stock, stil, seed]);

  // ── Stationen und Tor: neu bei jedem Fortschritt ─────────────────────────
  const schluessel = JSON.stringify([stock, zustaende[stock], zielOffen[stock], objekte?.[stock], stil, waechter?.[stock]]);
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    for (const k of [...d.orte.children]) { d.orte.remove(k); entsorge(k); }
    const o = baueOrte(plan.ebenen[stock], {
      zustaende: zustaende[stock] ?? [], zielOffen: zielOffen[stock] ?? false,
      zielArt: stock < plan.ebenen.length - 1 ? "weiter" : "ausgang",
      objekte: objekte?.[stock], stil, mitZurueck: stock > 0, waechter: waechter?.[stock] ?? false, abschnitt: stock,
    });
    d.orte.add(o.gruppe);
    lage.current.marken = o.marken;
    setMarken(o.marken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, schluessel]);

  // Abschnitt gewechselt: weiter → an dessen Anfang; zurück → an dessen Tor.
  const vorher = useRef(stock);
  useEffect(() => {
    if (!drei.current) return;
    stelle(stock < vorher.current);
    vorher.current = stock;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, stock]);

  // Auftrag von außen: hinlaufen
  useEffect(() => {
    if (!auftrag || !drei.current) return;
    if (auftrag.ort.art === "zurueck" && stock === 0) return;
    laufeZu(auftrag.ort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auftrag?.nr]);

  // ── Steuerknüppel (Tablets) ──────────────────────────────────────────────
  const knueppelZug = (ev: React.PointerEvent) => {
    const r = knueppel.current!.getBoundingClientRect();
    let x = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const n = Math.hypot(x, y);
    if (n > 1) { x /= n; y /= n; }
    lage.current.knueppel = { x, y };
    if (knauf.current) knauf.current.style.transform = `translate(${x * 30}px, ${y * 30}px)`;
  };
  const knueppelLos = () => {
    lage.current.knueppel = { x: 0, y: 0 };
    if (knauf.current) knauf.current.style.transform = "";
  };

  const knopf = "rounded-lg bg-surface/90 border border-line font-bold hover:border-accent";
  if (fehler) {
    return (
      <div className="w-full h-full min-h-[320px] flex items-center justify-center p-6 text-center text-sm text-muted">
        Dieses Gerät kann die 3D-Welt nicht zeichnen (WebGL fehlt). Wähle oben eine andere Ansicht.
      </div>
    );
  }
  return (
    <div className="relative w-full h-full min-h-[320px] overflow-hidden select-none">
      <div ref={huelle} className="absolute inset-0" data-freiwelt data-stock={stock} data-stil={stil} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {marken.map((m, i) => (
          <div key={`${ortSchluessel(m.ort)}`} ref={n => { markenEl.current[i] = n; }} style={{ display: "none" }}
            className={`absolute left-0 top-0 min-w-9 h-9 px-2 rounded-full border-2 flex items-center justify-center font-black text-base shadow-md ${TON[m.ton]}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
        <button className={`${knopf} px-2 h-8 text-xs`} onClick={waehleGuete} title="Darstellung: gemalt sieht am schönsten aus, schnell läuft auf jedem Gerät">
          {GUETE_NAME[guete]}
        </button>
      </div>
      {nah && aktiv && (
        <button onClick={() => onAnkunft(nah)}
          className="absolute left-1/2 -translate-x-1/2 bottom-5 btn-primary text-sm py-2 px-4 shadow-xl">
          {nah.art === "raum" ? "E · Ansehen" : nah.art === "ziel" ? "E · Zum Tor" : "E · Zurück in den Abschnitt davor"}
        </button>
      )}
      {finger && (
        <div ref={knueppel} className="absolute left-4 bottom-4 w-28 h-28 rounded-full bg-surface/50 border-2 border-line touch-none flex items-center justify-center"
          onPointerDown={ev => { ev.currentTarget.setPointerCapture(ev.pointerId); knueppelZug(ev); }}
          onPointerMove={ev => { if (ev.currentTarget.hasPointerCapture(ev.pointerId)) knueppelZug(ev); }}
          onPointerUp={knueppelLos} onPointerCancel={knueppelLos} aria-label="Steuerknüppel">
          <div ref={knauf} className="w-12 h-12 rounded-full bg-accent/80 pointer-events-none" />
        </div>
      )}
    </div>
  );
}
