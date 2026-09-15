"use client";
/**
 * Der Flugmodus: selbst durchs Sonnensystem fliegen.
 *
 * Wie in einem Weltraumspiel: Schub, Boost, und für die weiten Strecken ein
 * Pulsantrieb, dessen Tempo sich nach dem nächsten Himmelskörper richtet —
 * weit weg von allem wird er rasend schnell, in der Nähe eines Planeten
 * schaltet er sich ab. So dauert der Flug zu Neptun Sekunden und das
 * Heranfliegen an einen Mond trotzdem nicht zu kurz.
 *
 * Maßstab (siehe massstab.ts): Radien echt, Abstände 60-fach gekürzt, Sonne
 * 4-fach verkleinert. Die Planeten stehen dort, wo sie heute stehen; Monde und
 * Drehungen laufen 1 000-fach beschleunigt, damit sich etwas bewegt.
 *
 * Zum Unterricht gehören der Scanner und die Forschungsaufträge: ein Rätsel
 * führt zu einem Körper, der Scan öffnet eine Frage, deren Antwort im
 * Steckbrief steht.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { ART_NAME, HAUPTKOERPER, KM_JE_AE, KOERPER, KOERPER_NACH_ID, LICHT_KM_S, mondeVon, type Koerper } from "@/lib/sonnensystem/daten";
import { heliozentrisch, julianischerTag, mondVersatz, type Vec3 } from "@/lib/sonnensystem/bahnen";
import { flugMondbahn, flugOrt, flugRadius, FLUG_ABSTANDSTEILER, FLUG_KM_JE_EINHEIT } from "@/lib/sonnensystem/massstab";
import { AUFTRAEGE, gemischteAntworten, type Auftrag } from "@/lib/sonnensystem/auftraege";
import { foto } from "@/lib/sonnensystem/bilder";
import { dauer, km, tage, zahl } from "@/lib/sonnensystem/format";
import {
  Texturen, baueHimmel, baueKoerper, baueSonne, drehwinkel, entsorge, leuchtTextur, webglVerfuegbar, zuSzene, type KoerperObjekt,
} from "./szene";
import { ladeFortschritt, speichereFortschritt, type Fortschritt } from "./fortschritt";

/** Tage Simulationszeit je Sekunde: 1 000-fach. */
const ZEITRAFFER = 1_000 / 86_400;
/**
 * Höchsttempo: 100-fache Lichtgeschwindigkeit, gerechnet in echten Abständen.
 * Eine Flugeinheit steht für 1 000 km × 60 (Abstände sind 60-fach verkürzt).
 */
export const HOECHSTTEMPO = (100 * LICHT_KM_S) / (FLUG_KM_JE_EINHEIT * FLUG_ABSTANDSTEILER);
const STAUB = 600;
const STAUB_WUERFEL = 140;

type Modus = "steht" | "flug" | "boost" | "puls" | "autopilot";

interface Hud {
  modus: Modus;
  schub: number;
  tempo: number;
  naechster: string;
  ziel: string | null;
  zielAbstand: number;
  scanBereit: string | null;
  scan: number | null;
  /** Läuft der Pulsantrieb — auch unter Autopilot. */
  puls: boolean;
}

interface Eingabe {
  tasten: Set<string>;
  maus: { x: number; y: number };
  stick: { x: number; y: number };
  schubKnopf: boolean;
  bremsKnopf: boolean;
}

/** Aufrufe von außen an die Schleife — Knöpfe und Tasten landen hier. */
interface Befehle {
  pulsUmschalten?: boolean;
  autopilot?: boolean;
  zielNaechstes?: boolean;
  scan?: boolean;
  anhalten?: boolean;
}

/** Die anderen Ansichten, erreichbar aus dem Menü. */
export type Ansicht = "uebersicht" | "groessen" | "entfernungen" | "galerie";
const ANSICHTEN: { id: Ansicht; name: string }[] = [
  { id: "uebersicht", name: "🪐 Übersicht" },
  { id: "groessen", name: "⚖️ Größen" },
  { id: "entfernungen", name: "📏 Entfernungen" },
  { id: "galerie", name: "🔭 Galerie" },
];

export default function Flug({ onSteckbrief, speicherSchluessel, onVerlassen, onVollbild, vollbild = false }: {
  onSteckbrief: (id: string) => void;
  speicherSchluessel: string;
  onVerlassen?: (ansicht: Ansicht) => void;
  onVollbild?: () => void;
  vollbild?: boolean;
}) {
  const buehneRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pfeilRef = useRef<HTMLDivElement>(null);
  const [fehlt, setFehlt] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const [gestartet, setGestartet] = useState(false);
  const [hilfe, setHilfe] = useState(false);
  const [beruehrung, setBeruehrung] = useState(false);
  const [hud, setHud] = useState<Hud>({
    modus: "steht", schub: 0, tempo: 0, naechster: "erde", ziel: null, zielAbstand: 0, scanBereit: null, scan: null, puls: false,
  });
  const [meldung, setMeldung] = useState<string | null>(null);
  // Die Karte merkt sich ihren Auftrag beim Scannen: nach der richtigen Antwort
  // rückt der aktive Auftrag weiter, die Frage soll aber stehen bleiben.
  const [karte, setKarte] = useState<{ id: string; auftrag: Auftrag | null } | null>(null);
  const [fortschritt, setFortschritt] = useState<Fortschritt>(() => ladeFortschritt(speicherSchluessel));
  const [auftragId, setAuftragId] = useState<string | null>(null);
  const [liste, setListe] = useState(false);
  const [menue, setMenue] = useState(false);

  const eingabe = useRef<Eingabe>({ tasten: new Set(), maus: { x: 0, y: 0 }, stick: { x: 0, y: 0 }, schubKnopf: false, bremsKnopf: false });
  const befehle = useRef<Befehle>({});
  const zielRef = useRef<string | null>(null);
  const pausiertRef = useRef(true);
  pausiertRef.current = !gestartet || karte !== null || liste || hilfe || menue;

  const melde = useCallback((text: string) => {
    setMeldung(text);
    window.setTimeout(() => setMeldung(m => (m === text ? null : m)), 3500);
  }, []);
  const meldeRef = useRef(melde);
  meldeRef.current = melde;
  const scanFertigRef = useRef<(id: string) => void>(() => {});

  useEffect(() => { speichereFortschritt(speicherSchluessel, fortschritt); }, [speicherSchluessel, fortschritt]);
  useEffect(() => { setBeruehrung(window.matchMedia("(pointer: coarse)").matches); }, []);
  // M öffnet das Menü; die Maus wird dafür freigegeben.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.code !== "KeyM" || (e.target as HTMLElement)?.closest?.("input, select, textarea")) return;
      setMenue(m => !m);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);
  useEffect(() => { if (menue && document.pointerLockElement) document.exitPointerLock(); }, [menue]);

  // Aktiver Auftrag: gewählt oder der erste offene.
  const auftrag: Auftrag | null = useMemo(() => {
    const gewaehlt = AUFTRAEGE.find(a => a.id === auftragId && !fortschritt.erledigt.includes(a.id));
    return gewaehlt ?? AUFTRAEGE.find(a => !fortschritt.erledigt.includes(a.id)) ?? null;
  }, [auftragId, fortschritt.erledigt]);

  scanFertigRef.current = (id: string) => {
    setFortschritt(f => (f.erforscht.includes(id) ? f : { ...f, erforscht: [...f.erforscht, id] }));
    setKarte({ id, auftrag: auftrag?.ziel === id ? auftrag : null });
    if (document.pointerLockElement) document.exitPointerLock();
  };

  const setzeZiel = useCallback((id: string | null) => {
    zielRef.current = id;
    setHud(h => ({ ...h, ziel: id }));
  }, []);
  const setzeZielRef = useRef(setzeZiel);
  setzeZielRef.current = setzeZiel;
  // Die Szene rechnet echte Abstände (km) — das Ziel-Schild fragt hier nach.
  const echterAbstandRef = useRef<(a: string, b: string) => number>(() => 0);

  useEffect(() => {
    const buehne = buehneRef.current;
    if (!buehne) return;
    if (!webglVerfuegbar()) { setFehlt(true); return; }

    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const leinwand = renderer.domElement;
    leinwand.className = "absolute inset-0 w-full h-full touch-none";
    buehne.prepend(leinwand);

    const szene = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(70, 1, 0.01, 2_000_000);
    const manager = new THREE.LoadingManager(() => setGeladen(true));
    const texturen = new Texturen(manager);

    const himmel = baueHimmel(1_000_000, texturen);
    szene.add(himmel);
    const sonnenRadius = flugRadius(KOERPER_NACH_ID.sonne);
    const sonne = baueSonne(sonnenRadius, texturen);
    szene.add(sonne.gruppe);
    // Aus der Ferne ist die Sonne ein Stern: ein Leuchten fester Bildschirmgröße.
    const fernglanz = new THREE.Sprite(new THREE.SpriteMaterial({
      map: leuchtTextur("rgba(255,250,235,1)", "rgba(255,210,140,0.25)"),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false,
    }));
    fernglanz.scale.setScalar(0.16);
    sonne.gruppe.add(fernglanz);
    szene.add(new THREE.PointLight(0xffffff, 3.2, 0, 0));
    szene.add(new THREE.AmbientLight(0x6070a0, 0.05));

    const startJd = julianischerTag(new Date());
    let jd = startJd;

    // ── Körper ──
    const objekte = new Map<string, KoerperObjekt>();
    const ort = new Map<string, THREE.Vector3>([["sonne", new THREE.Vector3()]]);
    const radius = new Map<string, number>([["sonne", sonnenRadius]]);
    for (const k of KOERPER) {
      if (k.art === "stern") continue;
      const r = flugRadius(k);
      const o = baueKoerper(k, r, texturen, k.art === "mond" ? 48 : 96);
      objekte.set(k.id, o);
      szene.add(o.gruppe);
      radius.set(k.id, r);
      ort.set(k.id, new THREE.Vector3());
      if (k.bahn) zuSzene(flugOrt(heliozentrisch(k.bahn, startJd)), ort.get(k.id)!);
    }
    // Wie weit reicht das Mondsystem eines Planeten? Bis dahin zeigt der Flug Mondnamen.
    const systemRadius = new Map<string, number>();
    for (const p of HAUPTKOERPER) {
      const monde = mondeVon(p.id);
      if (monde.length) systemRadius.set(p.id, Math.max(...monde.map(m => flugMondbahn(m, p))) * 2.5);
    }

    const versatz = new THREE.Vector3();
    function stelleMondeAuf() {
      for (const o of objekte.values()) {
        const k = o.koerper;
        if (k.art === "mond") {
          const mutter = KOERPER_NACH_ID[k.mutter!];
          const v = mondVersatz(k, mutter, jd);
          const l = Math.hypot(...v);
          const r = flugMondbahn(k, mutter);
          zuSzene([(v[0] / l) * r, (v[1] / l) * r, (v[2] / l) * r], versatz);
          ort.get(k.id)!.copy(ort.get(mutter.id)!).add(versatz);
        }
        o.gruppe.position.copy(ort.get(k.id)!);
        o.kugel.rotation.y = drehwinkel(k, jd) % (Math.PI * 2);
        if (o.wolken) o.wolken.rotation.y = (jd * 3) % (Math.PI * 2);
      }
    }
    stelleMondeAuf();

    // ── Schiff: startet neben der Erde, Blick auf sie ──
    const oben = new THREE.Vector3(0, 1, 0);
    const erde = ort.get("erde")!;
    const zurSonne = erde.clone().negate().normalize().applyAxisAngle(oben, 0.7);
    const schiff = {
      pos: erde.clone().addScaledVector(zurSonne, radius.get("erde")! * 9).addScaledVector(oben, 12),
      quat: new THREE.Quaternion(),
      v: 0,
      schub: 0,
      puls: false,
      autopilot: false,
      drehung: new THREE.Vector3(),
    };
    const blickMatrix = new THREE.Matrix4();
    schiff.quat.setFromRotationMatrix(blickMatrix.lookAt(schiff.pos, erde, oben));

    // ── Weltraumstaub: Striche, die mit dem Tempo länger werden ──
    const staubOrt = new Float32Array(STAUB * 3);
    for (let i = 0; i < STAUB * 3; i++) staubOrt[i] = (Math.random() - 0.5) * STAUB_WUERFEL;
    for (let i = 0; i < STAUB; i++) {
      staubOrt[i * 3] += schiff.pos.x; staubOrt[i * 3 + 1] += schiff.pos.y; staubOrt[i * 3 + 2] += schiff.pos.z;
    }
    const staubLinien = new Float32Array(STAUB * 6);
    const staubGeo = new THREE.BufferGeometry();
    staubGeo.setAttribute("position", new THREE.BufferAttribute(staubLinien, 3));
    const staubMat = new THREE.LineBasicMaterial({ color: 0xa8c0ff, transparent: true, opacity: 0.4, depthWrite: false });
    const staub = new THREE.LineSegments(staubGeo, staubMat);
    staub.frustumCulled = false;
    szene.add(staub);

    // ── Scanner-Hülle ──
    const scanHuelle = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 20),
      new THREE.MeshBasicMaterial({ color: 0x66e0ff, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    scanHuelle.visible = false;
    szene.add(scanHuelle);
    let scan: { id: string; t: number } | null = null;

    // ── Eingabe ──
    const e = eingabe.current;
    const tasteRunter = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.closest?.("input, select, textarea")) return;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.code)) ev.preventDefault();
      if (ev.repeat) return;
      e.tasten.add(ev.code);
      const b = befehle.current;
      if (ev.code === "Space") b.pulsUmschalten = true;
      if (ev.code === "KeyG") b.autopilot = true;
      if (ev.code === "KeyT") b.zielNaechstes = true;
      if (ev.code === "KeyC") b.scan = true;
      if (ev.code === "KeyX") b.anhalten = true;
    };
    const tasteHoch = (ev: KeyboardEvent) => { e.tasten.delete(ev.code); };
    const fokusWeg = () => e.tasten.clear();
    const mausBewegung = (ev: MouseEvent) => {
      const gefangen = document.pointerLockElement === leinwand;
      if (!gefangen && !(ev.buttons & 1 && ev.target === leinwand)) return;
      e.maus.x = THREE.MathUtils.clamp(e.maus.x - ev.movementX * 0.004, -1.2, 1.2);
      e.maus.y = THREE.MathUtils.clamp(e.maus.y - ev.movementY * 0.004, -1.2, 1.2);
    };
    const klick = () => {
      if (pausiertRef.current || window.matchMedia("(pointer: coarse)").matches) return;
      if (document.pointerLockElement !== leinwand) leinwand.requestPointerLock?.()?.catch?.(() => {});
    };
    window.addEventListener("keydown", tasteRunter);
    window.addEventListener("keyup", tasteHoch);
    window.addEventListener("blur", fokusWeg);
    window.addEventListener("mousemove", mausBewegung);
    leinwand.addEventListener("click", klick);

    const groesse = () => {
      const { clientWidth: w, clientHeight: h } = buehne;
      renderer.setSize(w, h, false);
      kamera.aspect = w / Math.max(h, 1);
      kamera.updateProjectionMatrix();
    };
    const beobachter = new ResizeObserver(groesse);
    beobachter.observe(buehne);
    groesse();

    // Hilfsobjekte, damit die Schleife nichts neu anlegt.
    const vorne = new THREE.Vector3();
    const hilf = new THREE.Vector3();
    const drehSchritt = new THREE.Quaternion();
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    const sollQuat = new THREE.Quaternion();
    const projiziert = new THREE.Vector3();
    const schiffOben = new THREE.Vector3();

    const oberflaeche = (id: string) => schiff.pos.distanceTo(ort.get(id)!) - radius.get(id)!;

    /** Wirklicher Ort in km (Planeten zum Startdatum, Monde laufen mit). */
    function echterOrt(id: string): Vec3 {
      const k = KOERPER_NACH_ID[id];
      if (k.art === "stern") return [0, 0, 0];
      if (k.art === "mond") {
        const m = echterOrt(k.mutter!);
        const v = mondVersatz(k, KOERPER_NACH_ID[k.mutter!], jd);
        return [m[0] + v[0], m[1] + v[1], m[2] + v[2]];
      }
      const p = heliozentrisch(k.bahn!, startJd);
      return [p[0] * KM_JE_AE, p[1] * KM_JE_AE, p[2] * KM_JE_AE];
    }
    echterAbstandRef.current = (a, b) => {
      const pa = echterOrt(a), pb = echterOrt(b);
      return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]) - KOERPER_NACH_ID[a].radiusKm - KOERPER_NACH_ID[b].radiusKm;
    };

    let letzteZeit = performance.now();
    let letzterHud = 0;
    let bild = 0;
    let fov = 70;

    const schleife = (jetzt: number) => {
      bild = requestAnimationFrame(schleife);
      const dt = Math.min((jetzt - letzteZeit) / 1000, 0.1);
      letzteZeit = jetzt;
      const pausiert = pausiertRef.current;
      const b = befehle.current;

      jd += dt * ZEITRAFFER;
      stelleMondeAuf();

      // Nächster Körper — nach ihm richten sich Tempo und Pulsantrieb.
      let naechster = "sonne";
      let naechsterAbstand = oberflaeche("sonne");
      for (const id of objekte.keys()) {
        const d = oberflaeche(id);
        if (d < naechsterAbstand) { naechster = id; naechsterAbstand = d; }
      }
      vorne.set(0, 0, -1).applyQuaternion(schiff.quat);
      const ziel = zielRef.current;

      // ── Befehle ──
      if (!pausiert) {
        if (b.pulsUmschalten) {
          if (schiff.puls) { schiff.puls = false; schiff.schub = 0.5; }
          else if (naechsterAbstand < 6) meldeRef.current(`Zu nah an ${KOERPER_NACH_ID[naechster].name} für den Pulsantrieb.`);
          else { schiff.puls = true; schiff.autopilot = false; }
        }
        if (b.autopilot) {
          if (!ziel) meldeRef.current("Erst ein Ziel wählen: T drücken oder oben aus der Liste.");
          else { schiff.autopilot = !schiff.autopilot; if (!schiff.autopilot) schiff.puls = false; }
        }
        if (b.anhalten) { schiff.schub = 0; schiff.puls = false; schiff.autopilot = false; }
        if (b.zielNaechstes) {
          let bestes: string | null = null;
          let besterWinkel = 0.35;
          for (const k of KOERPER) {
            if (k.art === "mond" && !imSystem(k)) continue;
            const w = hilf.copy(ort.get(k.id)!).sub(schiff.pos).angleTo(vorne);
            if (w < besterWinkel) { besterWinkel = w; bestes = k.id; }
          }
          if (bestes) setzeZielRef.current(bestes);
          else meldeRef.current("Kein Himmelskörper im Fadenkreuz — dreh dich zu einem hin.");
        }
        if (b.scan && !scan) {
          const bereit = scanBereit(naechster);
          if (bereit) scan = { id: bereit, t: 0 };
          else meldeRef.current("Zu weit weg zum Scannen — flieg näher heran.");
        }
      }
      befehle.current = {};

      // ── Steuern ──
      const t = e.tasten;
      const achse = (plus: boolean, minus: boolean) => (plus ? 1 : 0) - (minus ? 1 : 0);
      e.maus.x *= Math.exp(-dt * 5);
      e.maus.y *= Math.exp(-dt * 5);
      const soll = pausiert ? hilf.set(0, 0, 0) : hilf.set(
        achse(t.has("ArrowUp"), t.has("ArrowDown")) + e.maus.y + e.stick.y,
        achse(t.has("ArrowLeft") || t.has("KeyA"), t.has("ArrowRight") || t.has("KeyD")) + e.maus.x - e.stick.x,
        achse(t.has("KeyQ"), t.has("KeyE")),
      );
      if (schiff.autopilot && soll.lengthSq() > 0.04) schiff.autopilot = false;
      soll.clampLength(0, 1.4).multiplyScalar(schiff.puls ? 0.5 : 1.2);
      schiff.drehung.lerp(soll, 1 - Math.exp(-dt * 6));
      euler.set(schiff.drehung.x * dt, schiff.drehung.y * dt, schiff.drehung.z * dt * 1.4);
      schiff.quat.multiply(drehSchritt.setFromEuler(euler)).normalize();

      if (!pausiert) {
        if (t.has("KeyW") || e.schubKnopf) schiff.schub = Math.min(1, schiff.schub + dt * 0.8);
        if (t.has("KeyS") || e.bremsKnopf) { schiff.schub = Math.max(0, schiff.schub - dt * 1.2); schiff.puls = false; schiff.autopilot = false; }
      }

      // ── Autopilot: zum Ziel drehen, weit weg im Pulsantrieb, nah langsam ──
      if (schiff.autopilot && ziel && !pausiert) {
        const zielOrt = ort.get(ziel)!;
        schiffOben.set(0, 1, 0).applyQuaternion(schiff.quat);
        sollQuat.setFromRotationMatrix(blickMatrix.lookAt(schiff.pos, zielOrt, schiffOben));
        schiff.quat.slerp(sollQuat, 1 - Math.exp(-dt * 2.5));
        const rest = oberflaeche(ziel);
        const halt = haltAbstand(ziel);
        const ausgerichtet = schiff.quat.angleTo(sollQuat) < 0.15;
        if (rest <= halt * 1.05) {
          schiff.autopilot = false; schiff.puls = false; schiff.schub = 0;
          meldeRef.current(`Angekommen: ${KOERPER_NACH_ID[ziel].name}. Mit C oder 📡 scannen.`);
        } else if (ausgerichtet && rest > halt * 12 && naechsterAbstand > 30) {
          schiff.puls = true;
        } else {
          schiff.puls = false;
          schiff.schub = ausgerichtet ? Math.min(1, (rest - halt) / Math.max(halt, 1) + 0.15) : 0.1;
        }
      }

      // ── Tempo ──
      const naechsterOrt = ort.get(naechster)!;
      const kommtNaeher = hilf.copy(naechsterOrt).sub(schiff.pos).dot(vorne) > 0;
      if (schiff.puls && kommtNaeher && naechsterAbstand < Math.max(radius.get(naechster)! * 3, 40)) {
        schiff.puls = false;
        schiff.schub = 0.6;
        if (!schiff.autopilot) meldeRef.current(`Pulsantrieb aus — ${KOERPER_NACH_ID[naechster].name} voraus.`);
      }
      const boost = t.has("ShiftLeft") || t.has("ShiftRight");
      // Bremsweg: das Tempo richtet sich nach dem, was voraus liegt — dem nächsten
      // Körper, und unter Autopilot auch dem Ziel. Weit draußen gilt die Obergrenze.
      const voraus = schiff.autopilot && ziel ? Math.min(naechsterAbstand, oberflaeche(ziel)) : naechsterAbstand;
      const vZiel = pausiert ? 0 : schiff.puls
        ? THREE.MathUtils.clamp(voraus * 0.8, 20, HOECHSTTEMPO)
        : Math.min(schiff.schub * THREE.MathUtils.clamp(voraus * 0.9, 1.5, HOECHSTTEMPO / 5) * (boost ? 4 : 1), HOECHSTTEMPO);
      // Beschleunigen gemächlich, bremsen kräftig — sonst schießt man am Planeten vorbei.
      const rate = vZiel < schiff.v ? 4 : schiff.puls ? 0.9 : 2.4;
      schiff.v += (vZiel - schiff.v) * (1 - Math.exp(-dt * rate));
      schiff.pos.addScaledVector(vorne, schiff.v * dt);

      // Nicht in Planeten hineinfliegen.
      for (const [id, o] of ort) {
        const min = radius.get(id)! * 1.02 + 0.05;
        const d = schiff.pos.distanceTo(o);
        if (d < min) schiff.pos.sub(o).setLength(min).add(o);
      }

      // ── Scanner ──
      if (scan) {
        scan.t += dt / 1.6;
        const r = radius.get(scan.id)!;
        scanHuelle.visible = true;
        scanHuelle.position.copy(ort.get(scan.id)!);
        scanHuelle.scale.setScalar(r * (1.02 + 0.35 * scan.t));
        (scanHuelle.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - scan.t);
        if (scan.t >= 1) {
          scanHuelle.visible = false;
          const id = scan.id;
          scan = null;
          schiff.schub = 0; schiff.puls = false; schiff.autopilot = false;
          scanFertigRef.current(id);
        }
      }

      // ── Kamera ──
      kamera.position.copy(schiff.pos);
      kamera.quaternion.copy(schiff.quat);
      if (schiff.puls && schiff.v > HOECHSTTEMPO * 0.8) {
        kamera.position.x += (Math.random() - 0.5) * 0.02;
        kamera.position.y += (Math.random() - 0.5) * 0.02;
      }
      const fovZiel = schiff.puls ? 92 : boost && schiff.schub > 0 ? 78 : 70;
      fov += (fovZiel - fov) * (1 - Math.exp(-dt * 3));
      kamera.fov = fov;
      kamera.updateProjectionMatrix();
      himmel.position.copy(kamera.position);

      // Staub mitwandern lassen und zu Strichen ziehen.
      const halb = STAUB_WUERFEL / 2;
      const strich = Math.min(schiff.v * 0.08, 60) + 0.06;
      for (let i = 0; i < STAUB; i++) {
        for (let a = 0; a < 3; a++) {
          const c = kamera.position.getComponent(a);
          let p = staubOrt[i * 3 + a];
          if (p - c > halb) p -= STAUB_WUERFEL * Math.ceil((p - c - halb) / STAUB_WUERFEL);
          if (c - p > halb) p += STAUB_WUERFEL * Math.ceil((c - p - halb) / STAUB_WUERFEL);
          staubOrt[i * 3 + a] = p;
          staubLinien[i * 6 + a] = p;
          staubLinien[i * 6 + 3 + a] = p + vorne.getComponent(a) * strich;
        }
      }
      staubGeo.attributes.position.needsUpdate = true;
      staubMat.opacity = Math.min(0.15 + schiff.v / 150, 0.7);
      staubMat.color.setHex(schiff.puls ? 0x9fd8ff : 0xa8b8d8);

      renderer.render(szene, kamera);

      // ── Markierungen ──
      const { clientWidth: w, clientHeight: h } = buehne;
      let zielRichtung: { x: number; y: number; winkel: number } | null = null;
      for (const [id, el] of markerRef.current) {
        const k = KOERPER_NACH_ID[id];
        const istZiel = id === ziel;
        if (k.art === "mond" && !istZiel && !imSystem(k)) { el.style.display = "none"; continue; }
        projiziert.copy(ort.get(id)!);
        const vor = hilf.copy(projiziert).sub(kamera.position).dot(vorne) > 0;
        projiziert.project(kamera);
        const drin = vor && Math.abs(projiziert.x) < 1 && Math.abs(projiziert.y) < 1;
        if (!drin) {
          el.style.display = "none";
          if (istZiel) {
            // Richtung zum Ziel am Bildrand: hinter der Kamera gespiegelt.
            const x = vor ? projiziert.x : -projiziert.x;
            const y = vor ? projiziert.y : -projiziert.y;
            zielRichtung = { x, y, winkel: Math.atan2(-y, x) };
          }
          continue;
        }
        el.style.display = "";
        el.style.transform = `translate(${((projiziert.x + 1) / 2) * w}px, ${((1 - projiziert.y) / 2) * h}px) translate(-50%, -50%)`;
      }
      if (pfeilRef.current) {
        if (zielRichtung) {
          const l = Math.max(Math.abs(zielRichtung.x), Math.abs(zielRichtung.y)) || 1;
          const px = ((zielRichtung.x / l) * 0.85 + 1) / 2 * w;
          const py = ((1 - (zielRichtung.y / l) * 0.8) / 2) * h;
          pfeilRef.current.style.display = "";
          pfeilRef.current.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%) rotate(${zielRichtung.winkel}rad)`;
        } else {
          pfeilRef.current.style.display = "none";
        }
      }

      if (jetzt - letzterHud > 120) {
        letzterHud = jetzt;
        setHud({
          modus: schiff.autopilot ? "autopilot" : schiff.puls ? "puls" : schiff.v < 0.3 && schiff.schub === 0 ? "steht" : boost ? "boost" : "flug",
          schub: schiff.schub,
          tempo: schiff.v,
          naechster,
          ziel,
          zielAbstand: ziel ? oberflaeche(ziel) : 0,
          scanBereit: scanBereit(naechster),
          scan: scan ? scan.t : null,
          puls: schiff.puls,
        });
      }

      function imSystem(mond: Koerper) {
        const r = systemRadius.get(mond.mutter!) ?? 0;
        return schiff.pos.distanceTo(ort.get(mond.mutter!)!) < r;
      }
      function scanBereit(naechsterId: string): string | null {
        for (const id of [ziel, naechsterId]) {
          if (id && oberflaeche(id) < radius.get(id)! * 8 + 60) return id;
        }
        return null;
      }
    };

    function haltAbstand(id: string) {
      return Math.max(radius.get(id)! * 2.5, 6);
    }

    bild = requestAnimationFrame(schleife);

    return () => {
      cancelAnimationFrame(bild);
      beobachter.disconnect();
      window.removeEventListener("keydown", tasteRunter);
      window.removeEventListener("keyup", tasteHoch);
      window.removeEventListener("blur", fokusWeg);
      window.removeEventListener("mousemove", mausBewegung);
      leinwand.removeEventListener("click", klick);
      if (document.pointerLockElement === leinwand) document.exitPointerLock();
      entsorge(szene);
      texturen.entsorgen();
      renderer.dispose();
      leinwand.remove();
    };
  }, []);

  const befehl = (b: keyof Befehle) => { befehle.current[b] = true; };

  if (fehlt) {
    return (
      <div className="h-full flex flex-col gap-4 items-center justify-center p-6 text-center text-slate-300">
        Dieser Browser kann kein WebGL — der Flugmodus bleibt aus. Größen, Entfernungen und Galerie funktionieren trotzdem.
        {onVerlassen && <button onClick={() => onVerlassen("groessen")} className="rounded-xl border border-white/20 px-4 py-2">Zu den Größen</button>}
      </div>
    );
  }

  const zielK = hud.ziel ? KOERPER_NACH_ID[hud.ziel] : null;
  const standort = KOERPER_NACH_ID[hud.naechster];
  const echteStrecke = zielK && zielK.id !== standort.id ? echterAbstandRef.current(standort.id, zielK.id) : null;

  return (
    <div ref={buehneRef} className="relative h-full w-full overflow-hidden select-none text-slate-100">
      {/* Vignette und Puls-Schimmer */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
      }} />
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-700" style={{
        opacity: hud.puls ? 1 : 0,
        background: "radial-gradient(ellipse at center, transparent 35%, rgba(80,170,255,0.18) 100%)",
      }} />

      {/* Markierungen */}
      <div className="absolute inset-0 pointer-events-none">
        {KOERPER.map(k => (
          <button
            key={k.id}
            ref={el => { if (el) markerRef.current.set(k.id, el); else markerRef.current.delete(k.id); }}
            onClick={() => setzeZiel(k.id)}
            className="absolute left-0 top-0 pointer-events-auto flex flex-col items-center"
            style={{ display: "none" }}
          >
            <svg viewBox="0 0 20 20" className={k.id === hud.ziel ? "w-8 h-8 text-amber-300" : k.art === "mond" ? "w-3.5 h-3.5 text-slate-300/70" : "w-5 h-5 text-cyan-200/80"}>
              <path d="M1 7V1h6M13 1h6v6M19 13v6h-6M7 19H1v-6" fill="none" stroke="currentColor" strokeWidth={k.id === hud.ziel ? 2 : 1.6} />
            </svg>
            <span className={`mt-1 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap drop-shadow-[0_1px_2px_#000] ${
              k.id === hud.ziel ? "text-amber-200" : fortschritt.erforscht.includes(k.id) ? "text-emerald-200/90" : "text-cyan-100/80"
            }`}>
              {k.name}{fortschritt.erforscht.includes(k.id) ? " ✓" : ""}
            </span>
          </button>
        ))}
        <div ref={pfeilRef} className="absolute left-0 top-0 text-amber-300 text-2xl drop-shadow-[0_0_6px_#000]" style={{ display: "none" }}>➤</div>
      </div>

      {/* Fadenkreuz */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-10 h-10 rounded-full border border-cyan-200/40 flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-cyan-200/80" />
        </div>
      </div>

      {/* Links oben: Menü und Antrieb */}
      <button
        onClick={() => setMenue(m => !m)}
        aria-label="Menü"
        aria-expanded={menue}
        className={`absolute left-3 top-3 z-30 w-12 h-12 rounded-xl border backdrop-blur flex flex-col items-center justify-center gap-[5px] ${
          menue ? "bg-cyan-400/25 border-cyan-300/70" : "bg-black/55 border-white/15 hover:bg-white/10"
        }`}
      >
        {[0, 1, 2].map(i => <span key={i} className="block w-5 h-0.5 rounded bg-cyan-100" />)}
      </button>
      {menue && (
        <Menue
          onSchliessen={() => setMenue(false)}
          ziel={hud.ziel}
          onZiel={id => { setzeZiel(id); setMenue(false); }}
          erforscht={fortschritt.erforscht}
          geloest={fortschritt.erledigt.length}
          onAuftraege={() => { setListe(true); setMenue(false); }}
          onHilfe={() => { setHilfe(true); setMenue(false); }}
          onVollbild={onVollbild}
          vollbild={vollbild}
          onVerlassen={onVerlassen}
          onZuruecksetzen={() => {
            if (window.confirm("Allen Forschungsfortschritt auf diesem Gerät löschen?")) setFortschritt({ erforscht: [], erledigt: [] });
          }}
        />
      )}
      <div className="absolute left-[4.25rem] top-3 pointer-events-none">
        <div className="rounded-xl bg-black/50 backdrop-blur border border-cyan-300/20 px-3 py-2 w-[8rem] sm:w-auto sm:min-w-[11rem]">
          <div className={`text-[10px] sm:text-[11px] font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] ${hud.modus === "puls" ? "text-sky-300" : hud.modus === "autopilot" ? "text-amber-300" : "text-cyan-200"}`}>
            {{ steht: "Antrieb bereit", flug: "Impulsflug", boost: "Boost", puls: "⚡ Pulsantrieb", autopilot: "🧭 Autopilot" }[hud.modus]}
            {hud.modus === "autopilot" && hud.puls && " · ⚡ Puls"}
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-cyan-300 transition-[width]" style={{ width: `${hud.puls ? 100 : hud.schub * 100}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-slate-400 tabular-nums hidden sm:block">
            {hud.puls
              ? `${zahl(Math.round((hud.tempo * FLUG_KM_JE_EINHEIT * FLUG_ABSTANDSTEILER) / LICHT_KM_S))}-fache Lichtgeschwindigkeit`
              : `nächster Körper: ${standort.name}`}
          </div>
        </div>
      </div>

      {/* Mitte oben: Ziel */}
      {zielK && (
        <div className="absolute left-1/2 -translate-x-1/2 top-3 pointer-events-auto max-w-[min(26rem,calc(100%-24rem))] hidden md:block">
          <div className="rounded-xl bg-black/55 backdrop-blur border border-amber-300/30 px-3 py-2 text-center">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">🎯 {zielK.name}</div>
            {echteStrecke !== null && echteStrecke > 0 && (
              <div className="text-[11px] text-slate-300 mt-0.5">
                In Wirklichkeit {km(echteStrecke)} von {standort.name} · Licht: {dauer(echteStrecke / LICHT_KM_S)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rechts oben: der aktuelle Auftrag. Auf dem Telefon unter der Antriebsanzeige. */}
      <div className="absolute right-3 top-[4.75rem] sm:top-3 flex flex-col items-end gap-2 pointer-events-auto">
        {auftrag && gestartet && (
          <AuftragKarte
            auftrag={auftrag}
            nummer={fortschritt.erledigt.length + 1}
            onListe={() => setListe(true)}
          />
        )}
        {!auftrag && gestartet && (
          <div className="rounded-xl bg-emerald-900/60 border border-emerald-300/30 px-3 py-2 text-xs max-w-[16rem]">
            🏆 Alle {AUFTRAEGE.length} Forschungsaufträge gelöst!
            <button className="block mt-1 text-emerald-200 underline" onClick={() => setListe(true)}>Liste ansehen</button>
          </div>
        )}
      </div>

      {/* Mitte unten: Meldung und Scan */}
      <div className={`absolute left-1/2 -translate-x-1/2 ${beruehrung ? "bottom-44" : "bottom-12"} flex flex-col items-center gap-2 pointer-events-none w-[min(30rem,calc(100%-2rem))]`}>
        {meldung && <div className="rounded-lg bg-black/60 px-3 py-1.5 text-sm text-center">{meldung}</div>}
        {hud.scan !== null ? (
          <div className="w-56 rounded-lg bg-black/60 border border-cyan-300/30 px-3 py-2">
            <div className="text-[11px] uppercase tracking-widest text-cyan-200">Scanne …</div>
            <div className="mt-1 h-1.5 rounded bg-white/10 overflow-hidden"><div className="h-full bg-cyan-300" style={{ width: `${hud.scan * 100}%` }} /></div>
          </div>
        ) : hud.scanBereit && gestartet ? (
          <button onClick={() => befehl("scan")} className="pointer-events-auto rounded-lg bg-cyan-500/20 border border-cyan-300/50 px-3 py-1.5 text-sm font-bold text-cyan-100 hover:bg-cyan-500/30">
            📡 {KOERPER_NACH_ID[hud.scanBereit].name} scannen <span className="hidden md:inline text-cyan-300/70">[C]</span>
          </button>
        ) : null}
      </div>

      {/* Berührungssteuerung */}
      {beruehrung && gestartet && (
        <>
          <Stick eingabe={eingabe.current} />
          <div className="absolute right-3 bottom-3 grid grid-cols-3 gap-2 pointer-events-auto">
            <HaltKnopf onAn={v => { eingabe.current.bremsKnopf = v; }}>Bremse</HaltKnopf>
            <HaltKnopf onAn={v => { eingabe.current.schubKnopf = v; }}>Schub</HaltKnopf>
            <HudKnopf onClick={() => befehl("pulsUmschalten")} aktiv={hud.modus === "puls"} titel="Pulsantrieb">⚡</HudKnopf>
            <HudKnopf onClick={() => befehl("zielNaechstes")} titel="Ziel im Fadenkreuz">🎯</HudKnopf>
            <HudKnopf onClick={() => befehl("autopilot")} aktiv={hud.modus === "autopilot"} titel="Autopilot">🧭</HudKnopf>
            <HudKnopf onClick={() => befehl("scan")} titel="Scannen">📡</HudKnopf>
          </div>
        </>
      )}
      {!beruehrung && gestartet && (
        <div className="absolute left-3 bottom-3 text-[11px] text-slate-400 bg-black/40 rounded-lg px-2 py-1 pointer-events-none">
          Klick: Maus lenkt · Esc: Maus frei · M Menü · W/S Schub · Leertaste Puls · T Ziel · G Autopilot · C Scan
        </div>
      )}

      {!geladen && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none">Lade das Sonnensystem …</div>
      )}

      {!gestartet && geladen && (
        <Einblendung>
          <h2 className="text-xl font-black tracking-tight">🚀 Flug durchs Sonnensystem</h2>
          <p className="text-sm text-slate-300 mt-2">
            Du startest neben der Erde. Die Planeten stehen dort, wo sie heute wirklich stehen.
            Flieg zu einem Himmelskörper, scanne ihn — und löse die Forschungsaufträge oben rechts.
            Ziele, Aufträge und die anderen Ansichten stecken im Menü ☰ oben links.
          </p>
          <Steuerungstabelle beruehrung={beruehrung} />
          <p className="text-xs text-slate-400 mt-3">
            Maßstab: Planeten und Monde in echter Größe, Abstände 60-fach verkürzt, die Sonne 4-fach verkleinert.
            In echt wäre der Flug zum Jupiter selbst mit Lichtgeschwindigkeit eine gute halbe Stunde lang.
          </p>
          <button onClick={() => setGestartet(true)} className="mt-4 w-full rounded-xl bg-cyan-400 text-slate-950 font-black py-2.5 hover:bg-cyan-300">
            Losfliegen
          </button>
          {(fortschritt.erforscht.length > 0 || fortschritt.erledigt.length > 0) && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              Bisher erforscht: {fortschritt.erforscht.length} von {KOERPER.length} · Aufträge: {fortschritt.erledigt.length} von {AUFTRAEGE.length}
            </p>
          )}
        </Einblendung>
      )}

      {hilfe && (
        <Einblendung onSchliessen={() => setHilfe(false)}>
          <h2 className="text-lg font-black">Steuerung</h2>
          <Steuerungstabelle beruehrung={beruehrung} />
        </Einblendung>
      )}

      {karte && (
        <ScanKarte
          koerper={KOERPER_NACH_ID[karte.id]}
          anzahl={fortschritt.erforscht.length}
          auftrag={karte.auftrag}
          onGeloest={id => setFortschritt(f => (f.erledigt.includes(id) ? f : { ...f, erledigt: [...f.erledigt, id] }))}
          onSteckbrief={() => onSteckbrief(karte.id)}
          onSchliessen={() => { setKarte(null); setAuftragId(null); }}
        />
      )}

      {liste && (
        <Einblendung onSchliessen={() => setListe(false)} breit>
          <h2 className="text-lg font-black">🛰️ Forschungsaufträge</h2>
          <p className="text-xs text-slate-400 mt-1">Antippen macht einen Auftrag zum aktuellen. Gelöst: {fortschritt.erledigt.length} von {AUFTRAEGE.length}.</p>
          <ol className="mt-3 flex flex-col gap-1.5 max-h-[55vh] overflow-y-auto pr-1">
            {AUFTRAEGE.map((a, i) => {
              const fertig = fortschritt.erledigt.includes(a.id);
              return (
                <li key={a.id}>
                  <button
                    disabled={fertig}
                    onClick={() => { setAuftragId(a.id); setListe(false); }}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm border ${
                      fertig ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                        : a.id === auftrag?.id ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="font-bold mr-1">{fertig ? "✓" : `${i + 1}.`}</span>
                    {fertig ? `${KOERPER_NACH_ID[a.ziel].name}: ${a.hinweis}` : a.hinweis}
                  </button>
                </li>
              );
            })}
          </ol>
        </Einblendung>
      )}
    </div>
  );
}

function HudKnopf({ onClick, children, titel, aktiv }: { onClick: () => void; children: ReactNode; titel: string; aktiv?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={titel}
      aria-label={titel}
      className={`w-12 h-12 rounded-xl border text-xl backdrop-blur ${aktiv ? "bg-sky-400/30 border-sky-300/70" : "bg-black/50 border-white/15 hover:bg-white/10"}`}
    >{children}</button>
  );
}

function HaltKnopf({ onAn, children }: { onAn: (an: boolean) => void; children: ReactNode }) {
  return (
    <button
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onAn(true); }}
      onPointerUp={() => onAn(false)}
      onPointerCancel={() => onAn(false)}
      onContextMenu={e => e.preventDefault()}
      className="w-12 h-12 rounded-xl border border-white/15 bg-black/50 text-[10px] font-black uppercase active:bg-cyan-400/30 touch-none"
    >{children}</button>
  );
}

/** Ein Daumenstick unten links: Auslenkung = Drehgeschwindigkeit. */
function Stick({ eingabe }: { eingabe: Eingabe }) {
  const [knauf, setKnauf] = useState({ x: 0, y: 0 });
  const bewege = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    eingabe.stick.x = x;
    eingabe.stick.y = -y;
    setKnauf({ x, y });
  };
  const los = () => { eingabe.stick.x = 0; eingabe.stick.y = 0; setKnauf({ x: 0, y: 0 }); };
  return (
    <div
      className="absolute left-4 bottom-4 w-32 h-32 rounded-full border border-white/15 bg-black/35 backdrop-blur touch-none pointer-events-auto"
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); bewege(e); }}
      onPointerMove={e => { if (e.buttons || e.pointerType === "touch") bewege(e); }}
      onPointerUp={los}
      onPointerCancel={los}
      aria-label="Lenken"
    >
      <div className="absolute w-12 h-12 rounded-full bg-cyan-300/40 border border-cyan-200/60 left-1/2 top-1/2" style={{
        transform: `translate(calc(-50% + ${knauf.x * 40}px), calc(-50% + ${knauf.y * 40}px))`,
      }} />
    </div>
  );
}

function Menue({ onSchliessen, ziel, onZiel, erforscht, geloest, onAuftraege, onHilfe, onVollbild, vollbild, onVerlassen, onZuruecksetzen }: {
  onSchliessen: () => void;
  ziel: string | null;
  onZiel: (id: string | null) => void;
  erforscht: string[];
  geloest: number;
  onAuftraege: () => void;
  onHilfe: () => void;
  onVollbild?: () => void;
  vollbild: boolean;
  onVerlassen?: (ansicht: Ansicht) => void;
  onZuruecksetzen: () => void;
}) {
  const eintrag = "w-full text-left rounded-lg px-3 py-2 text-sm font-bold hover:bg-white/10 flex items-center justify-between gap-3";
  return (
    <>
      <div className="absolute inset-0 z-20 bg-black/40" onClick={onSchliessen} />
      <nav
        aria-label="Flugmenü"
        className="absolute left-3 top-[4.25rem] z-30 w-[min(20rem,calc(100%-1.5rem))] max-h-[calc(100%-5.5rem)] overflow-y-auto
          rounded-2xl border border-cyan-300/30 bg-slate-950/95 backdrop-blur p-2 shadow-2xl"
      >
        <div className="px-3 pt-1 pb-2 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">Ziel</div>
        <div className="px-2 pb-2">
          <ZielAuswahl ziel={ziel} onWahl={onZiel} erforscht={erforscht} />
        </div>
        <button className={eintrag} onClick={onAuftraege}>
          <span>🛰️ Forschungsaufträge</span><span className="text-xs text-slate-400">{geloest}/{AUFTRAEGE.length}</span>
        </button>
        <button className={eintrag} onClick={onHilfe}><span>❔ Steuerung</span></button>
        {onVollbild && (
          <button className={eintrag} onClick={onVollbild}><span>{vollbild ? "⤡ Vollbild verlassen" : "⛶ Vollbild"}</span></button>
        )}
        {onVerlassen && (
          <>
            <div className="px-3 pt-3 pb-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">Flug beenden</div>
            {ANSICHTEN.map(a => (
              <button key={a.id} className={eintrag} onClick={() => onVerlassen(a.id)}><span>{a.name}</span></button>
            ))}
          </>
        )}
        <div className="border-t border-white/10 mt-2 pt-2">
          <button className={`${eintrag} text-slate-400 font-normal`} onClick={onZuruecksetzen}>Fortschritt zurücksetzen</button>
        </div>
      </nav>
    </>
  );
}

function ZielAuswahl({ ziel, onWahl, erforscht }: { ziel: string | null; onWahl: (id: string | null) => void; erforscht: string[] }) {
  const gruppen: { name: string; koerper: Koerper[] }[] = [
    { name: "Sonne und Planeten", koerper: HAUPTKOERPER },
    ...HAUPTKOERPER.filter(p => mondeVon(p.id).length).map(p => ({ name: `Monde von ${p.name}`, koerper: mondeVon(p.id) })),
  ];
  return (
    <select
      aria-label="Ziel wählen"
      value={ziel ?? ""}
      // Danach den Fokus abgeben: sonst lenken die Pfeiltasten nicht, sondern wechseln das Ziel.
      onChange={e => { onWahl(e.target.value || null); e.target.blur(); }}
      className="h-11 w-full rounded-xl bg-black/60 backdrop-blur border border-white/15 text-sm font-bold px-2 text-slate-100 [color-scheme:dark]"
    >
      <option value="">🎯 Ziel wählen …</option>
      {gruppen.map(g => (
        <optgroup key={g.name} label={g.name}>
          {g.koerper.map(k => <option key={k.id} value={k.id}>{k.name}{erforscht.includes(k.id) ? " ✓" : ""}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function AuftragKarte({ auftrag, nummer, onListe }: { auftrag: Auftrag; nummer: number; onListe: () => void }) {
  const [offen, setOffen] = useState(true);
  return (
    <div className="rounded-xl bg-black/55 backdrop-blur border border-amber-300/30 px-3 py-2 max-w-[17rem] text-left">
      <button onClick={() => setOffen(o => !o)} className="w-full flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-widest text-amber-200">
        <span>🛰️ Auftrag {nummer} von {AUFTRAEGE.length}</span>
        <span>{offen ? "–" : "+"}</span>
      </button>
      {offen && (
        <>
          <p className="text-sm mt-1 leading-snug">{auftrag.hinweis}</p>
          <button onClick={onListe} className="mt-1.5 text-xs text-amber-200/80 underline">Alle Aufträge</button>
        </>
      )}
    </div>
  );
}

function Steuerungstabelle({ beruehrung }: { beruehrung: boolean }) {
  const zeilen: [string, string][] = beruehrung
    ? [
      ["Stick unten links", "lenken"],
      ["Schub / Bremse", "gedrückt halten"],
      ["⚡", "Pulsantrieb für weite Strecken"],
      ["🎯", "Himmelskörper im Fadenkreuz als Ziel — oder im Menü ☰ oben links"],
      ["🧭", "Autopilot fliegt zum Ziel"],
      ["📡", "scannen, wenn du nah genug bist"],
    ]
    : [
      ["Klick ins Bild", "Maus lenkt (Esc gibt sie frei) — oder mit gedrückter Taste ziehen"],
      ["Pfeiltasten, A / D", "lenken ohne Maus"],
      ["Q / E", "rollen"],
      ["W / S", "Schub geben / bremsen"],
      ["Umschalt", "Boost"],
      ["Leertaste", "Pulsantrieb an/aus — für weite Strecken"],
      ["T", "Himmelskörper im Fadenkreuz als Ziel (oder Markierung anklicken)"],
      ["G", "Autopilot zum Ziel"],
      ["C", "scannen, wenn du nah genug bist"],
      ["X", "sofort anhalten"],
      ["M", "Menü: Ziel wählen, Aufträge, andere Ansichten"],
    ];
  return (
    <table className="mt-3 w-full text-sm">
      <tbody>
        {zeilen.map(([taste, was]) => (
          <tr key={taste} className="border-t border-white/10">
            <td className="py-1 pr-3 font-bold text-cyan-200 whitespace-nowrap align-top">{taste}</td>
            <td className="py-1 text-slate-300">{was}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Einblendung({ children, onSchliessen, breit }: { children: ReactNode; onSchliessen?: () => void; breit?: boolean }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm pointer-events-auto">
      <div className={`relative w-full ${breit ? "max-w-xl" : "max-w-md"} max-h-full overflow-y-auto rounded-2xl border border-cyan-300/25 bg-slate-950/90 p-5 shadow-2xl`}>
        {onSchliessen && (
          <button onClick={onSchliessen} className="absolute right-3 top-3 w-8 h-8 rounded-lg hover:bg-white/10" aria-label="Schließen">✕</button>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * Der Analysevisor: das Scan-Ergebnis als Bildschirm im Raumschiff.
 *
 * Abgeschrägte Ecken (clip-path), zwei Lagen — außen der leuchtende Rahmen,
 * innen die Scheibe —, Scanlinien, ein rotierender Ring mit Scanstrahl um das
 * Foto und Zeilen, die nacheinander aufleuchten. Die Animationen stehen im
 * <style> darunter, damit sie ohne Tailwind-Konfiguration auskommen.
 */
const ECKEN = "polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px)";
const KNOPF_ECKEN = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";

const VISOR_STIL = `
@keyframes visor-ein { 0% { opacity: 0; transform: scale(.96) } 12% { opacity: 1 } 16% { opacity: .35 } 22% { opacity: 1; transform: scale(1) } 100% { opacity: 1 } }
@keyframes visor-zeile { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: none } }
@keyframes visor-strahl { 0% { top: -10% } 100% { top: 110% } }
@keyframes visor-dreh { to { transform: rotate(360deg) } }
@keyframes visor-blink { 50% { opacity: 0 } }
.visor-ein { animation: visor-ein .55s ease-out both }
.visor-zeile { opacity: 0; animation: visor-zeile .35s ease-out forwards }
.visor-strahl { animation: visor-strahl 2.4s linear infinite }
.visor-dreh { animation: visor-dreh 14s linear infinite }
.visor-dreh-rueck { animation: visor-dreh 22s linear infinite reverse }
.visor-blink { animation: visor-blink 1s steps(1) infinite }
.visor-glitch { text-shadow: 2px 0 rgba(255,60,140,.55), -2px 0 rgba(60,230,255,.55) }
@media (prefers-reduced-motion: reduce) {
  .visor-ein, .visor-zeile, .visor-strahl, .visor-dreh, .visor-dreh-rueck, .visor-blink { animation: none; opacity: 1 }
}
`;

/** Ein Balken aus zehn Segmenten, wie auf einem Messgerät. */
function Segmente({ anteil, farbe }: { anteil: number; farbe: string }) {
  const an = Math.max(1, Math.min(10, Math.round(anteil * 10)));
  return (
    <span className="flex gap-[2px]" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="w-1.5 h-2.5 skew-x-[-18deg]" style={{ background: i < an ? farbe : "rgba(255,255,255,0.08)" }} />
      ))}
    </span>
  );
}

export function ScanKarte({ koerper, anzahl, auftrag, onGeloest, onSteckbrief, onSchliessen }: {
  koerper: Koerper;
  anzahl: number;
  auftrag: Auftrag | null;
  onGeloest: (auftragId: string) => void;
  onSteckbrief: () => void;
  onSchliessen: () => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<number[]>([]);
  const antworten = useMemo(() => (auftrag ? gemischteAntworten(auftrag) : []), [auftrag]);
  const richtigIndex = antworten.findIndex(a => a.richtig);
  const geloest = gewaehlt.includes(richtigIndex);
  const bild = foto(koerper.id);
  const mutter = koerper.mutter ? KOERPER_NACH_ID[koerper.mutter] : null;
  const kennung = `${koerper.id.slice(0, 3).toUpperCase()}-${String(Math.round(koerper.radiusKm)).padStart(6, "0")}`;

  // Messwerte mit Balken: logarithmisch, damit Phobos und Jupiter beide etwas zeigen.
  const zeilen: { name: string; wert: string; anteil?: number }[] = [
    { name: "Durchmesser", wert: `${zahl(koerper.radiusKm * 2)} km`, anteil: Math.log10(koerper.radiusKm * 2) / Math.log10(1_400_000) },
    { name: "Schwerkraft", wert: `${zahl(koerper.schwerkraft, koerper.schwerkraft < 1 ? 2 : 1)} m/s²`, anteil: Math.min(koerper.schwerkraft / 25, 1) },
    { name: "Eine Drehung", wert: `${tage(koerper.rotationStunden / 24)}${koerper.rotationStunden < 0 ? " · rückwärts" : ""}` },
    { name: "Temperatur", wert: koerper.temperatur },
    { name: "Atmosphäre", wert: koerper.atmosphaere },
  ];
  const buchstabe = "ABCD";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-6 pointer-events-auto font-mono"
      style={{
        background: "radial-gradient(ellipse at center, rgba(0,30,40,0.55), rgba(0,0,0,0.85))",
      }}
    >
      <style>{VISOR_STIL}</style>
      {/* Scanlinien über dem ganzen Bild */}
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{
        background: "repeating-linear-gradient(0deg, rgba(120,255,255,0.05) 0 1px, transparent 1px 3px)",
      }} />

      <div className="visor-ein relative w-full max-w-3xl max-h-full" role="dialog" aria-label={`Scan ${koerper.name}`}
        style={{ clipPath: ECKEN, background: "linear-gradient(135deg, rgba(94,242,255,0.9), rgba(94,242,255,0.15) 40%, rgba(255,179,71,0.8))", padding: 1.5 }}
      >
        <div className="relative max-h-[calc(100vh-3rem)] overflow-y-auto text-cyan-50"
          style={{
            clipPath: ECKEN,
            background: "linear-gradient(160deg, rgba(4,18,26,0.97), rgba(8,10,24,0.97) 60%, rgba(22,12,8,0.97))",
          }}
        >
          {/* Kopfzeile */}
          <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-2 border-b border-cyan-300/20 text-[10px] uppercase tracking-[0.3em]"
            style={{ background: "repeating-linear-gradient(-45deg, rgba(94,242,255,0.08) 0 6px, transparent 6px 12px)" }}
          >
            <span className="text-cyan-300">◢ Analysevisor</span>
            <span className="text-amber-300 hidden sm:inline">Objekt {kennung}</span>
            <span className="text-cyan-300">Erfasst {anzahl}/{KOERPER.length}<span className="visor-blink">▮</span></span>
          </div>

          <div className="grid sm:grid-cols-[13rem_1fr] gap-5 px-5 sm:px-7 pt-5">
            {/* Objektbild mit Ring und Scanstrahl */}
            <div className="relative mx-auto w-44 h-44 sm:w-52 sm:h-52 shrink-0">
              <div className="visor-dreh absolute inset-0 rounded-full border-2 border-dashed border-cyan-300/50" />
              <div className="visor-dreh-rueck absolute inset-3 rounded-full border border-amber-300/40" style={{ borderStyle: "dotted" }} />
              <div className="absolute inset-6 rounded-full overflow-hidden bg-black" style={{ boxShadow: "0 0 30px rgba(94,242,255,0.35)" }}>
                {bild && <img src={bild.datei} alt={koerper.name} className="w-full h-full object-cover" />}
                <div className="visor-strahl absolute left-0 right-0 h-8 pointer-events-none"
                  style={{ background: "linear-gradient(transparent, rgba(94,242,255,0.45), transparent)" }} />
              </div>
              {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "left-0 bottom-0 border-l-2 border-b-2", "right-0 bottom-0 border-r-2 border-b-2"].map(ecke => (
                <span key={ecke} className={`absolute w-4 h-4 border-amber-300 ${ecke}`} />
              ))}
            </div>

            <div className="min-w-0">
              <div className="visor-zeile text-[10px] uppercase tracking-[0.3em] text-emerald-300" style={{ animationDelay: "0.15s" }}>
                ✦ Scan abgeschlossen · {ART_NAME[koerper.art]}{mutter ? ` von ${mutter.name}` : ""}
              </div>
              <h2 className="visor-zeile visor-glitch font-sans text-3xl sm:text-4xl font-black uppercase tracking-[0.12em] mt-1" style={{ animationDelay: "0.25s" }}>
                {koerper.name}
              </h2>
              <p className="visor-zeile font-sans text-sm text-cyan-100/80 mt-2 leading-snug" style={{ animationDelay: "0.35s" }}>
                {koerper.intro}
              </p>
              <dl className="mt-3 flex flex-col gap-1 text-xs">
                {zeilen.map((z, i) => (
                  <div key={z.name} className="visor-zeile grid grid-cols-[7.5rem_1fr] gap-2 items-center border-t border-cyan-300/10 pt-1"
                    style={{ animationDelay: `${0.45 + i * 0.08}s` }}
                  >
                    <dt className="uppercase tracking-widest text-cyan-300/70 text-[10px]">{z.name}</dt>
                    <dd className="flex items-center gap-2 min-w-0 font-sans">
                      <span className="min-w-0">{z.wert}</span>
                      {z.anteil !== undefined && <span className="ml-auto shrink-0"><Segmente anteil={z.anteil} farbe="#5ef2ff" /></span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {auftrag && (
            <div className="visor-zeile mx-5 sm:mx-7 mt-5 border border-amber-300/40 p-3 sm:p-4"
              style={{ clipPath: KNOPF_ECKEN, background: "rgba(255,179,71,0.06)", animationDelay: "0.9s" }}
            >
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300">◆ Forschungsauftrag</div>
              <p className="font-sans font-bold mt-1">{auftrag.frage}</p>
              <div className="flex flex-col gap-1.5 mt-3">
                {antworten.map((a, i) => {
                  const angetippt = gewaehlt.includes(i);
                  return (
                    <button
                      key={a.text}
                      disabled={geloest}
                      onClick={() => {
                        setGewaehlt(g => [...g, i]);
                        if (a.richtig) onGeloest(auftrag.id);
                      }}
                      className={`group flex items-center gap-3 text-left text-sm px-3 py-2 border transition-colors ${
                        angetippt && a.richtig ? "border-emerald-300 bg-emerald-400/15 text-emerald-100"
                          : angetippt ? "border-rose-400/60 bg-rose-500/10 text-rose-200/70 line-through"
                            : "border-cyan-300/25 bg-cyan-300/5 hover:border-amber-300 hover:bg-amber-300/10"
                      }`}
                      style={{ clipPath: KNOPF_ECKEN }}
                    >
                      <span aria-hidden className="shrink-0 text-amber-300 font-bold">[{buchstabe[i]}]</span>
                      <span className="font-sans">{a.text}</span>
                    </button>
                  );
                })}
              </div>
              {geloest && (
                <p className="font-sans text-sm text-emerald-200 mt-3">✓ Richtig! {auftrag.erklaerung}</p>
              )}
              {!geloest && gewaehlt.length > 0 && (
                <p className="font-sans text-sm text-rose-200 mt-3">✕ Noch nicht. Die Antwort steht im Steckbrief — schau nach und versuch es noch einmal.</p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 px-5 sm:px-7 py-5">
            <button onClick={onSteckbrief} className="flex-1 border border-cyan-300/50 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-cyan-300/10"
              style={{ clipPath: KNOPF_ECKEN }}
            >📖 Steckbrief</button>
            <button onClick={onSchliessen} className="flex-1 py-2.5 text-sm font-black uppercase tracking-widest text-slate-950 hover:brightness-110"
              style={{ clipPath: KNOPF_ECKEN, background: "linear-gradient(90deg, #5ef2ff, #ffb347)" }}
            >{auftrag && geloest ? "Nächster Auftrag" : "Weiterfliegen"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
