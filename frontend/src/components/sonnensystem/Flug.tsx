"use client";
/**
 * Der Flugmodus: selbst durchs Sonnensystem fliegen.
 *
 * Wie in einem Weltraumspiel: Schub, Pulsantrieb für weite Strecken und für
 * kurze Zeit ein Overdrive. Das Tempo richtet sich immer nach dem Abstand —
 * weit weg von allem wird es rasend schnell, beim Anflug auf das Ziel oder
 * einen anderen Körper bremst das Schiff von selbst (Regeln: flugmodell.ts).
 *
 * Maßstab (siehe massstab.ts): Radien echt, Abstände 60-fach gekürzt, Sonne
 * 4-fach verkleinert. Die Planeten stehen dort, wo sie heute stehen; Monde und
 * Drehungen laufen 1 000-fach beschleunigt, damit sich etwas bewegt.
 *
 * Zum Unterricht gehören Scanner, Forschungsaufträge (Reihenfolge beliebig),
 * Kodex und Erfolge. Was erforscht und erflogen wurde, liegt in `fortschritt`
 * und wird mit Galerie und Kodex geteilt.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  HAUPTKOERPER, KM_JE_AE, KOERPER, KOERPER_NACH_ID, LICHT_KM_S, mondeVon, type Koerper,
} from "@/lib/sonnensystem/daten";
import { heliozentrisch, julianischerTag, mondVersatz, satellitVersatz, type Vec3 } from "@/lib/sonnensystem/bahnen";
import { ORTE, ORTE_NACH_ID, ortAmPlaneten, ortHeliozentrisch, type Ort } from "@/lib/sonnensystem/orte";
import { flugBahnRadius, flugMondbahn, flugOrt, flugRadius, FLUG_KM_JE_EINHEIT } from "@/lib/sonnensystem/massstab";
import { AUFTRAEGE, STUFEN_NAME, auftragZu, type Auftrag } from "@/lib/sonnensystem/auftraege";
import {
  ABSTURZ_TEMPO, HOECHSTTEMPO, KM_JE_FLUGEINHEIT, OVERDRIVE_ABKLINGZEIT, OVERDRIVE_DAUER,
  autopilot, haltAbstand, naechstesTempo, overdriveLohntNicht, schaetzeFlugzeit, schleichTempo, vielfachesLicht, zielTempo,
} from "@/lib/sonnensystem/flugmodell";
import { dauer, km, zahl } from "@/lib/sonnensystem/format";
import {
  Texturen, baueHimmel, baueKoerper, baueSatellit, baueSonne, drehwinkel, entsorge, leuchtTextur, webglVerfuegbar, zuSzene,
  type KoerperObjekt,
} from "./szene";
import { baueMagnetfeld, baueSturmwolke } from "./magnetfeld";
import { mitEintrag, type Fortschritt } from "./fortschritt";
import {
  Einblendung, HaltKnopf, HudKnopf, ScanKarte, Steuerungstabelle, Stick, ZielAuswahl, type Eingabe,
} from "./FlugTeile";

export { ScanKarte } from "./FlugTeile";
export { HOECHSTTEMPO } from "@/lib/sonnensystem/flugmodell";

/**
 * Zeit im Flug. Voreingestellt läuft sie echt: die Monde kreisen so schnell,
 * wie sie wirklich kreisen — Phobos schafft in einer Minute ein Grad seiner
 * Bahn. Wer ihnen beim Laufen zusehen will, schaltet den Zeitraffer im Menü ein.
 *
 * Im Zeitraffer bremst die Nähe eines Körpers die Zeit: Deimos umkreist den
 * Mars 1000-fach beschleunigt mit 0,8 Einheiten je Sekunde, und so schnell darf
 * man in Oberflächennähe gar nicht fliegen — man könnte ihn nie einholen.
 */
export const ZEITSTUFEN = [
  { name: "echt", faktor: 1 },
  { name: "1 Minute je Sekunde", faktor: 60 },
  { name: "1 Stunde je Sekunde", faktor: 3_600 },
  { name: "1 Tag je Sekunde", faktor: 86_400 },
];
const zeitfaktor = (abstand: number, stufe: number) =>
  stufe <= 1 ? 1 : THREE.MathUtils.clamp(abstand / 60, 0.004, 1);
const STAUB = 600;
const STAUB_WUERFEL = 140;
/** Alles, was sich erfassen lässt: Himmelskörper, Raumfahrzeuge und Orte. */
const ERFASSBAR = KOERPER.length + ORTE.length;
/**
 * Ein Lagrangepunkt hat keine Oberfläche. Fürs Anfliegen, Anhalten und Scannen
 * zählt er trotzdem als Kugel dieser Größe — sonst wüsste der Autopilot nicht,
 * wann er da ist.
 */
const ORT_RADIUS = 2;
/**
 * Sonnensturm: so lange braucht die Wolke von der Sonne zur Erde. In echt sind
 * das ein bis drei Tage — hier zwölf Sekunden, sonst säße man nur da.
 */
const STURM_FLUG = 12;
/** Und so lange leuchten die Polarlichter danach noch. */
const STURM_NACHGLUEHEN = 26;

const nameVon = (id: string) => KOERPER_NACH_ID[id]?.name ?? ORTE_NACH_ID[id]?.name ?? id;
/** Wie oft die Statistik in den gespeicherten Fortschritt wandert. */
const STATISTIK_TAKT = 2;
const UNFALL_DAUER = 2.8;

type Modus = "steht" | "flug" | "puls" | "overdrive" | "autopilot";
type UnfallArt = "absturz" | "verglueht";

interface Hud {
  modus: Modus;
  schub: number;
  tempo: number;
  naechster: string;
  ziel: string | null;
  zielAbstand: number;
  /** Abstand zum nächsten Körper, der nicht das Ziel ist — für die Flugzeit */
  startAbstand: number;
  /** Winkel zwischen Blickrichtung und Ziel */
  winkel: number;
  scanBereit: string | null;
  scan: number | null;
  /** Läuft gerade ein Sonnensturm? Sekunden bis zur Erde, und ob er schon da ist. */
  sturm: { rest: number; da: boolean } | null;
  puls: boolean;
  overdrive: number;
  abklingen: number;
}

/** Aufrufe von außen an die Schleife — Knöpfe und Tasten landen hier. */
interface Befehle {
  sturm?: boolean;
  pulsUmschalten?: boolean;
  overdrive?: boolean;
  autopilot?: boolean;
  zielNaechstes?: boolean;
  scan?: boolean;
  anhalten?: boolean;
}

/** Statistik, die seit dem letzten Speichern aufgelaufen ist. */
interface Zuwachs {
  flugzeit: number; strecke: number; vollgas: number; orbitzeit: number; hoechstC: number;
  overdrives: number; umrundungen: number; umrundet: string[];
  verglueht: number; abstuerze: number; abgestuerztAuf: string[];
}
const leererZuwachs = (): Zuwachs => ({
  flugzeit: 0, strecke: 0, vollgas: 0, orbitzeit: 0, hoechstC: 0, overdrives: 0,
  umrundungen: 0, umrundet: [], verglueht: 0, abstuerze: 0, abgestuerztAuf: [],
});

/** Die anderen Ansichten, erreichbar aus dem Menü. */
export type Ansicht = "uebersicht" | "groessen" | "entfernungen" | "galerie" | "kodex";
const ANSICHTEN: { id: Ansicht; name: string }[] = [
  { id: "uebersicht", name: "🪐 Übersicht" },
  { id: "groessen", name: "⚖️ Größen" },
  { id: "entfernungen", name: "📏 Entfernungen" },
  { id: "galerie", name: "🔭 Galerie" },
];

export const flugzeitText = (s: number) => {
  const sek = Math.ceil(s);
  return sek <= 0 ? "angekommen" : sek < 60 ? `${sek} s` : `${Math.floor(sek / 60)} min ${sek % 60} s`;
};

export default function Flug({
  onSteckbrief, fortschritt, aendere, zuruecksetzen, onVerlassen, onVollbild, vollbild = false, onKodex, angehalten = false,
}: {
  onSteckbrief: (id: string) => void;
  fortschritt: Fortschritt;
  aendere: (fn: (f: Fortschritt) => Fortschritt) => void;
  zuruecksetzen: () => void;
  onVerlassen?: (ansicht: Ansicht) => void;
  onVollbild?: () => void;
  vollbild?: boolean;
  /** Kodex öffnen, wahlweise gleich bei den Erfolgen */
  onKodex?: (bereich: "eintraege" | "erfolge") => void;
  /** Von außen angehalten, etwa während der Kodex offen ist */
  angehalten?: boolean;
}) {
  const buehneRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const randRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [fehlt, setFehlt] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const [gestartet, setGestartet] = useState(false);
  const [hilfe, setHilfe] = useState(false);
  const [beruehrung, setBeruehrung] = useState(false);
  const [hud, setHud] = useState<Hud>({
    modus: "steht", schub: 0, tempo: 0, naechster: "erde", ziel: null, zielAbstand: 0, startAbstand: 0, winkel: 0,
    scanBereit: null, scan: null, sturm: null, puls: false, overdrive: 0, abklingen: 0,
  });
  const [meldung, setMeldung] = useState<string | null>(null);
  // Die Karte merkt sich ihren Auftrag beim Scannen: nach der richtigen Antwort
  // rückt der Vorschlag weiter, die Frage soll aber stehen bleiben.
  const [karte, setKarte] = useState<{ id: string; ort: Ort | null; auftrag: Auftrag | null } | null>(null);
  const [auftragId, setAuftragId] = useState<string | null>(null);
  const [liste, setListe] = useState(false);
  const [menue, setMenue] = useState(false);
  const [unfall, setUnfall] = useState<{ art: UnfallArt; name: string; knall: boolean } | null>(null);
  const [zeitstufe, setZeitstufe] = useState(0);
  const zeitstufeRef = useRef(0);
  zeitstufeRef.current = ZEITSTUFEN[zeitstufe].faktor;
  const [magnetfeld, setMagnetfeld] = useState(false);
  const magnetfeldRef = useRef(false);
  magnetfeldRef.current = magnetfeld;
  const setMagnetfeldRef = useRef(setMagnetfeld);
  setMagnetfeldRef.current = setMagnetfeld;

  const eingabe = useRef<Eingabe>({ tasten: new Set(), maus: { x: 0, y: 0 }, stick: { x: 0, y: 0 }, schubKnopf: false, bremsKnopf: false });
  const befehle = useRef<Befehle>({});
  const zielRef = useRef<string | null>(null);
  const pausiertRef = useRef(true);
  pausiertRef.current = !gestartet || karte !== null || liste || hilfe || menue || angehalten;
  const fortschrittRef = useRef(fortschritt);
  fortschrittRef.current = fortschritt;

  const melde = useCallback((text: string) => {
    setMeldung(text);
    window.setTimeout(() => setMeldung(m => (m === text ? null : m)), 3500);
  }, []);
  const meldeRef = useRef(melde);
  meldeRef.current = melde;
  const scanFertigRef = useRef<(id: string) => void>(() => {});
  const zuwachsRef = useRef<(z: Zuwachs) => void>(() => {});

  useEffect(() => { setBeruehrung(window.matchMedia("(pointer: coarse)").matches); }, []);
  // M öffnet das Menü, K den Kodex; die Maus wird dafür freigegeben.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, select, textarea")) return;
      if (e.code === "KeyM") setMenue(m => !m);
      if (e.code === "KeyK" && onKodex) { if (document.pointerLockElement) document.exitPointerLock(); onKodex("eintraege"); }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onKodex]);
  useEffect(() => { if (menue && document.pointerLockElement) document.exitPointerLock(); }, [menue]);

  // Vorschlag: gewählt oder der erste offene. Gezählt wird jeder, dessen Ziel man scannt.
  const vorschlag: Auftrag | null = useMemo(() => {
    const gewaehlt = AUFTRAEGE.find(a => a.id === auftragId && !fortschritt.erledigt.includes(a.id));
    return gewaehlt ?? AUFTRAEGE.find(a => !fortschritt.erledigt.includes(a.id)) ?? null;
  }, [auftragId, fortschritt.erledigt]);

  scanFertigRef.current = (id: string) => {
    aendere(f => ({ ...f, erforscht: mitEintrag(f.erforscht, id) }));
    setKarte({ id, ort: ORTE_NACH_ID[id] ?? null, auftrag: auftragZu(id, fortschrittRef.current.erledigt) });
    if (document.pointerLockElement) document.exitPointerLock();
  };

  zuwachsRef.current = (z: Zuwachs) => {
    aendere(f => {
      const s = f.statistik;
      return {
        ...f,
        statistik: {
          flugzeit: s.flugzeit + z.flugzeit,
          strecke: s.strecke + z.strecke,
          overdrives: s.overdrives + z.overdrives,
          vollgas: s.vollgas + z.vollgas,
          hoechstC: Math.max(s.hoechstC, z.hoechstC),
          orbitzeit: s.orbitzeit + z.orbitzeit,
          umrundungen: s.umrundungen + z.umrundungen,
          umrundet: z.umrundet.reduce(mitEintrag, s.umrundet),
          verglueht: s.verglueht + z.verglueht,
          abstuerze: s.abstuerze + z.abstuerze,
          abgestuerztAuf: z.abgestuerztAuf.reduce(mitEintrag, s.abgestuerztAuf),
        },
      };
    });
  };

  const setzeZiel = useCallback((id: string | null) => {
    zielRef.current = id;
    // −1 heißt: die Schleife hat den Abstand noch nicht gemessen. Sonst stünde
    // im ersten Augenblick nach der Zielwahl »Ziel erreicht« da.
    setHud(h => ({ ...h, ziel: id, zielAbstand: -1 }));
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
    const markenObjekte: THREE.Sprite[] = [];
    const ort = new Map<string, THREE.Vector3>([["sonne", new THREE.Vector3()]]);
    const radius = new Map<string, number>([["sonne", sonnenRadius]]);
    for (const k of KOERPER) {
      if (k.art === "stern") continue;
      const r = flugRadius(k);
      const o = k.art === "satellit" ? baueSatellit(k, r) : baueKoerper(k, r, texturen, k.art === "mond" ? 48 : 96);
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

    // ── Lagrangepunkte: Marken fester Bildschirmgröße, dazu Jupiters Trojaner ──
    const ortStelle = new Map<string, THREE.Vector3>(ORTE.map(o => [o.id, new THREE.Vector3()]));
    const trojaner = new Map<string, THREE.Points>();
    for (const o of ORTE) {
      const marke = new THREE.Sprite(new THREE.SpriteMaterial({
        map: leuchtTextur("rgba(255,255,255,0.95)", `${o.farbe}44`),
        color: new THREE.Color(o.farbe),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false,
      }));
      marke.scale.setScalar(0.045);
      szene.add(marke);
      marke.userData.id = o.id;
      markenObjekte.push(marke);
      if (o.planet === "jupiter") {
        const wolke = baueTrojaner(new THREE.Color(o.farbe).getHex());
        szene.add(wolke);
        trojaner.set(o.id, wolke);
      }
    }

    // ── Erdmagnetfeld und Sonnensturm ──
    const magnet = baueMagnetfeld(KOERPER_NACH_ID.erde);
    objekte.get("erde")!.achse.add(magnet.feld);
    szene.add(magnet.huelle);
    const sturmwolke = baueSturmwolke();
    szene.add(sturmwolke.wolke);

    const versatz = new THREE.Vector3();
    function stelleMondeAuf() {
      for (const o of objekte.values()) {
        const k = o.koerper;
        if (k.art === "mond" || k.art === "satellit") {
          const mutter = KOERPER_NACH_ID[k.mutter!];
          const v = k.art === "mond" ? mondVersatz(k, mutter, jd) : satellitVersatz(k, mutter, jd);
          const l = Math.hypot(...v);
          // Der Abstand wird gestaucht, die Richtung bleibt. Bei Chandras
          // Ellipse zählt der jeweilige Abstand, nicht die Halbachse.
          const r = k.art === "mond" ? flugMondbahn(k, mutter) : flugBahnRadius(l, mutter);
          zuSzene([(v[0] / l) * r, (v[1] / l) * r, (v[2] / l) * r], versatz);
          ort.get(k.id)!.copy(ort.get(mutter.id)!).add(versatz);
        }
        o.gruppe.position.copy(ort.get(k.id)!);
        o.kugel.rotation.y = drehwinkel(k, jd) % (Math.PI * 2);
        if (o.wolken) o.wolken.rotation.y = (jd * 3) % (Math.PI * 2);
      }
      // L1 und L2 hängen am Planeten und werden wie eine Bahn gestaucht; L3,
      // L4 und L5 liegen auf der Planetenbahn selbst und kommen direkt aus
      // der Rechnung.
      for (const o of ORTE) {
        const stelle = ortStelle.get(o.id)!;
        const nah = ortAmPlaneten(o, jd);
        if (nah) {
          const mutter = KOERPER_NACH_ID[o.planet];
          const planetOrt = ort.get(o.planet)!;
          versatz.copy(planetOrt).normalize().multiplyScalar(flugBahnRadius(nah.km, mutter) * (nah.nachAussen ? 1 : -1));
          stelle.copy(planetOrt).add(versatz);
        } else {
          zuSzene(flugOrt(ortHeliozentrisch(o, jd)), stelle);
        }
        const wolke = trojaner.get(o.id);
        if (wolke) { wolke.position.copy(stelle); wolke.lookAt(0, 0, 0); }
      }
      for (const marke of markenObjekte) marke.position.copy(ortStelle.get(marke.userData.id as string)!);
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
      overdrive: 0,
      abklingen: 0,
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
    let sturm: { t: number; angekommen: boolean } | null = null;

    // ── Unfall: ein kleines Schiff, das aufschlägt, und eine Explosion ──
    const wrack = baueSchiffchen();
    wrack.visible = false;
    szene.add(wrack);
    const TRUEMMER = 220;
    const truemmerOrt = new Float32Array(TRUEMMER * 3);
    const truemmerTempo = new Float32Array(TRUEMMER * 3);
    const truemmerGeo = new THREE.BufferGeometry();
    truemmerGeo.setAttribute("position", new THREE.BufferAttribute(truemmerOrt, 3));
    const truemmerMat = new THREE.PointsMaterial({
      color: 0xffb040, size: 5, sizeAttenuation: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const truemmer = new THREE.Points(truemmerGeo, truemmerMat);
    truemmer.frustumCulled = false;
    szene.add(truemmer);
    let crash: {
      art: UnfallArt; id: string; t: number; knall: boolean;
      stelle: THREE.Vector3; anflug: THREE.Vector3; blick: THREE.Vector3; kamera: THREE.Vector3;
    } | null = null;

    // ── Eingabe ──
    const e = eingabe.current;
    const tasteRunter = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.closest?.("input, select, textarea")) return;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.code)) ev.preventDefault();
      if (ev.repeat) return;
      e.tasten.add(ev.code);
      const b = befehle.current;
      if (ev.code === "Space") b.pulsUmschalten = true;
      if (ev.code === "ShiftLeft" || ev.code === "ShiftRight") b.overdrive = true;
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
    const hilf2 = new THREE.Vector3();
    const drehSchritt = new THREE.Quaternion();
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    const sollQuat = new THREE.Quaternion();
    const kameraUmkehr = new THREE.Quaternion();
    const projiziert = new THREE.Vector3();
    const schiffOben = new THREE.Vector3();
    const randPlaetze: [number, number][] = [];

    /** Wo etwas steht — Himmelskörper, Raumfahrzeug oder Lagrangepunkt. */
    const stelleVon = (id: string) => ort.get(id) ?? ortStelle.get(id)!;
    const radiusVon = (id: string) => radius.get(id) ?? ORT_RADIUS;
    const oberflaeche = (id: string) => schiff.pos.distanceTo(stelleVon(id)) - radiusVon(id);

    /** Wirklicher Ort in km (Planeten zum Startdatum, Monde laufen mit). */
    function echterOrt(id: string): Vec3 {
      const k = KOERPER_NACH_ID[id];
      if (k.art === "stern") return [0, 0, 0];
      if (k.art === "mond" || k.art === "satellit") {
        const mutter = KOERPER_NACH_ID[k.mutter!];
        const m = echterOrt(mutter.id);
        const v = k.art === "mond" ? mondVersatz(k, mutter, jd) : satellitVersatz(k, mutter, jd);
        return [m[0] + v[0], m[1] + v[1], m[2] + v[2]];
      }
      const p = heliozentrisch(k.bahn!, startJd);
      return [p[0] * KM_JE_AE, p[1] * KM_JE_AE, p[2] * KM_JE_AE];
    }
    echterAbstandRef.current = (a, b) => {
      const pa = echterOrt(a), pb = echterOrt(b);
      return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]) - KOERPER_NACH_ID[a].radiusKm - KOERPER_NACH_ID[b].radiusKm;
    };

    // Umlaufbahn: wie weit hat sich das Schiff um den nächsten Körper herumbewegt?
    const orbit = { id: "", winkel: 0, letzte: new THREE.Vector3(), gezaehlt: false };
    let zuwachs = leererZuwachs();
    let bisSpeichern = STATISTIK_TAKT;
    const speichere = () => { zuwachsRef.current(zuwachs); zuwachs = leererZuwachs(); bisSpeichern = STATISTIK_TAKT; };

    function starteUnfall(art: UnfallArt, id: string) {
      const mitte = ort.get(id)!;
      const normale = hilf2.copy(schiff.pos).sub(mitte).normalize();
      const stelle = mitte.clone().addScaledVector(normale, radius.get(id)!);
      schiffOben.set(0, 1, 0).applyQuaternion(schiff.quat);
      const anflug = stelle.clone().addScaledVector(vorne, -4);
      crash = {
        art, id, t: 0, knall: false, stelle, anflug,
        blick: vorne.clone(),
        kamera: stelle.clone().addScaledVector(vorne, -11).addScaledVector(schiffOben, 3.5).addScaledVector(normale, 4),
      };
      wrack.visible = true;
      wrack.position.copy(anflug);
      wrack.quaternion.copy(schiff.quat);
      (wrack.userData.huelle as THREE.MeshStandardMaterial).emissive.setHex(art === "verglueht" ? 0x000000 : 0x000000);
      schiff.v = 0; schiff.schub = 0; schiff.puls = false; schiff.overdrive = 0; schiff.autopilot = false;
      scan = null; scanHuelle.visible = false;
      if (art === "verglueht") zuwachs.verglueht += 1;
      else { zuwachs.abstuerze += 1; zuwachs.abgestuerztAuf = mitEintrag(zuwachs.abgestuerztAuf, id); }
      speichere();
      if (document.pointerLockElement === leinwand) document.exitPointerLock();
      setUnfall({ art, name: KOERPER_NACH_ID[id].name, knall: false });
    }

    function laufeUnfall(dt: number) {
      const c = crash!;
      c.t += dt;
      const huelle = wrack.userData.huelle as THREE.MeshStandardMaterial;
      if (c.t < 0.7) {
        // Hineinstürzen mit Taumeln; bei der Sonne glüht die Hülle auf.
        wrack.position.lerpVectors(c.anflug, c.stelle, c.t / 0.7);
        wrack.rotateZ(dt * 9);
        wrack.rotateX(dt * 4);
        if (c.art === "verglueht") huelle.emissive.setRGB(Math.min(c.t * 2, 1), Math.min(c.t, 0.5), 0);
      } else if (!c.knall) {
        c.knall = true;
        wrack.visible = false;
        for (let i = 0; i < TRUEMMER; i++) {
          const r = hilf.randomDirection().multiplyScalar(2 + Math.random() * 7);
          truemmerOrt[i * 3] = c.stelle.x; truemmerOrt[i * 3 + 1] = c.stelle.y; truemmerOrt[i * 3 + 2] = c.stelle.z;
          truemmerTempo[i * 3] = r.x; truemmerTempo[i * 3 + 1] = r.y; truemmerTempo[i * 3 + 2] = r.z;
        }
        truemmerMat.color.setHex(c.art === "verglueht" ? 0xffe0a0 : 0xff9a30);
        setUnfall(u => (u ? { ...u, knall: true } : u));
      }
      if (c.knall) {
        const bremse = Math.exp(-dt * 1.5);
        for (let i = 0; i < TRUEMMER * 3; i++) {
          truemmerOrt[i] += truemmerTempo[i] * dt;
          truemmerTempo[i] *= bremse;
        }
        truemmerGeo.attributes.position.needsUpdate = true;
        truemmerMat.opacity = Math.max(0, 1 - (c.t - 0.7) / 1.8);
      }
      // Kamera: von hinten zusehen, leicht wackelnd beim Knall.
      kamera.position.copy(c.kamera);
      if (c.knall && c.t < 1.3) kamera.position.addScaledVector(hilf.randomDirection(), 0.25 * (1.3 - c.t));
      kamera.lookAt(c.stelle);
      if (c.t >= UNFALL_DAUER) {
        // Rettungskapsel: ein Stück über der Oberfläche, Blick hinaus ins All.
        const mitte = ort.get(c.id)!;
        const r = radius.get(c.id)!;
        const normale = hilf.copy(c.stelle).sub(mitte).normalize();
        schiff.pos.copy(mitte).addScaledVector(normale, r + Math.max(r * 3, 25));
        schiff.quat.setFromRotationMatrix(blickMatrix.lookAt(schiff.pos, hilf2.copy(schiff.pos).add(normale), oben));
        schiff.drehung.set(0, 0, 0);
        truemmerMat.opacity = 0;
        const name = KOERPER_NACH_ID[c.id].name;
        crash = null;
        setUnfall(null);
        meldeRef.current(`Rettungskapsel: neu gestartet über ${name}.`);
      }
    }

    let letzteZeit = performance.now();
    let zeitraffer = 1;
    let letzterHud = 0;
    let bild = 0;
    let fov = 70;

    const schleife = (jetzt: number) => {
      bild = requestAnimationFrame(schleife);
      const dt = Math.min((jetzt - letzteZeit) / 1000, 0.1);
      letzteZeit = jetzt;
      const pausiert = pausiertRef.current || crash !== null;
      const b = befehle.current;

      // Der Zeitraffer des letzten Bildes: der Abstand dafür steht erst unten fest.
      jd += (dt * zeitstufeRef.current * zeitraffer) / 86_400;
      stelleMondeAuf();

      // Nächster Körper — nach ihm richten sich Tempo, Pulsantrieb und Zeitraffer.
      let naechster = "sonne";
      let naechsterAbstand = oberflaeche("sonne");
      for (const id of objekte.keys()) {
        const d = oberflaeche(id);
        if (d < naechsterAbstand) { naechster = id; naechsterAbstand = d; }
      }
      zeitraffer = zeitfaktor(naechsterAbstand, zeitstufeRef.current);
      vorne.set(0, 0, -1).applyQuaternion(schiff.quat);
      const ziel = zielRef.current;
      const zielAbstand = ziel ? oberflaeche(ziel) : Infinity;
      const zielVoraus = ziel !== null && hilf.copy(stelleVon(ziel)).sub(schiff.pos).normalize().dot(vorne) > 0.5;
      // Frei voraus: der nächste Körper — und das Ziel, sobald man darauf zuhält.
      const voraus = zielVoraus && zielAbstand < naechsterAbstand ? zielAbstand : naechsterAbstand;
      const vorausRadius = radiusVon(zielVoraus && zielAbstand < naechsterAbstand ? ziel! : naechster);

      // ── Befehle ──
      if (!pausiert) {
        if (b.pulsUmschalten) {
          if (schiff.puls) { schiff.puls = false; schiff.overdrive = 0; schiff.schub = 0.5; }
          else if (naechsterAbstand < 6) meldeRef.current(`Zu nah an ${KOERPER_NACH_ID[naechster].name} für den Pulsantrieb.`);
          else { schiff.puls = true; schiff.autopilot = false; }
        }
        if (b.overdrive) {
          if (schiff.overdrive > 0) { /* läuft schon */ }
          else if (schiff.abklingen > 0) meldeRef.current(`Overdrive lädt noch ${Math.ceil(schiff.abklingen)} s.`);
          else if (naechsterAbstand < 6) meldeRef.current(`Zu nah an ${KOERPER_NACH_ID[naechster].name} für den Overdrive.`);
          else if (overdriveLohntNicht(voraus)) meldeRef.current("Das Ziel ist zu nah — der Overdrive würde sofort wieder bremsen.");
          else {
            schiff.puls = true;
            schiff.overdrive = OVERDRIVE_DAUER;
            zuwachs.overdrives += 1;
          }
        }
        if (b.autopilot) {
          if (!ziel) meldeRef.current("Erst ein Ziel wählen: T drücken oder im Menü ☰.");
          else { schiff.autopilot = !schiff.autopilot; if (!schiff.autopilot) { schiff.puls = false; schiff.overdrive = 0; } }
        }
        if (b.anhalten) { schiff.schub = 0; schiff.puls = false; schiff.overdrive = 0; schiff.autopilot = false; }
        if (b.zielNaechstes) {
          let bestes: string | null = null;
          let besterWinkel = 0.35;
          for (const k of KOERPER) {
            if ((k.art === "mond" || k.art === "satellit") && !imSystem(k)) continue;
            const w = hilf.copy(ort.get(k.id)!).sub(schiff.pos).angleTo(vorne);
            if (w < besterWinkel) { besterWinkel = w; bestes = k.id; }
          }
          for (const o of ORTE) {
            const w = hilf.copy(ortStelle.get(o.id)!).sub(schiff.pos).angleTo(vorne);
            if (w < besterWinkel) { besterWinkel = w; bestes = o.id; }
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
      if (b.sturm) {
        if (sturm) meldeRef.current("Der Sturm ist schon unterwegs.");
        else {
          sturm = { t: 0, angekommen: false };
          if (!magnetfeldRef.current) setMagnetfeldRef.current(true);
          // Zu sehen ist der Sturm nur bei der Erde — also gleich dorthin zeigen.
          if (oberflaeche("erde") > 400) {
            setzeZielRef.current("erde");
            meldeRef.current("☀️ Eine Wolke ist losgebrochen. Flieg zur Erde — dort trifft sie in ein bis drei Tagen ein.");
          } else {
            meldeRef.current("☀️ Auf der Sonne ist eine Wolke losgebrochen. In echt braucht sie ein bis drei Tage bis zur Erde.");
          }
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
      soll.clampLength(0, 1.4).multiplyScalar(schiff.overdrive > 0 ? 0.25 : schiff.puls ? 0.5 : 1.2);
      schiff.drehung.lerp(soll, 1 - Math.exp(-dt * 6));
      euler.set(schiff.drehung.x * dt, schiff.drehung.y * dt, schiff.drehung.z * dt * 1.4);
      schiff.quat.multiply(drehSchritt.setFromEuler(euler)).normalize();

      if (!pausiert) {
        if (t.has("KeyW") || e.schubKnopf) schiff.schub = Math.min(1, schiff.schub + dt * 0.8);
        if (t.has("KeyS") || e.bremsKnopf) {
          schiff.schub = Math.max(0, schiff.schub - dt * 1.2);
          schiff.puls = false; schiff.overdrive = 0; schiff.autopilot = false;
        }
      }

      // ── Autopilot: zum Ziel drehen, weit weg im Pulsantrieb, nah langsam ──
      if (schiff.autopilot && ziel && !pausiert) {
        const zielOrt = stelleVon(ziel);
        schiffOben.set(0, 1, 0).applyQuaternion(schiff.quat);
        sollQuat.setFromRotationMatrix(blickMatrix.lookAt(schiff.pos, zielOrt, schiffOben));
        schiff.quat.slerp(sollQuat, 1 - Math.exp(-dt * 2.5));
        const halt = haltAbstand(radiusVon(ziel));
        const entscheidung = autopilot(zielAbstand, halt, naechsterAbstand, schiff.quat.angleTo(sollQuat) < 0.15);
        if (entscheidung.angekommen) {
          schiff.autopilot = false; schiff.puls = false; schiff.overdrive = 0; schiff.schub = 0;
          meldeRef.current(`Angekommen: ${nameVon(ziel)}. Mit C oder 📡 scannen.`);
        } else {
          schiff.puls = entscheidung.puls || (schiff.overdrive > 0 && entscheidung.schub === 1);
          if (!schiff.puls) schiff.overdrive = 0;
          schiff.schub = entscheidung.schub;
        }
      }

      // ── Tempo ──
      const naechsterOrt = ort.get(naechster)!;
      const kommtNaeher = hilf.copy(naechsterOrt).sub(schiff.pos).dot(vorne) > 0;
      if (schiff.puls && kommtNaeher && naechsterAbstand < Math.max(radius.get(naechster)! * 3, 40)) {
        schiff.puls = false;
        schiff.overdrive = 0;
        schiff.schub = 0.6;
        if (!schiff.autopilot) meldeRef.current(`Pulsantrieb aus — ${KOERPER_NACH_ID[naechster].name} voraus.`);
      }
      if (schiff.overdrive > 0) {
        schiff.overdrive -= pausiert ? 0 : dt;
        // Beim Anflug bringt der Overdrive nichts mehr: das Bremstempo liegt schon darunter.
        if (schiff.overdrive <= 0 || (overdriveLohntNicht(voraus) && schiff.v <= HOECHSTTEMPO * 1.05)) {
          schiff.overdrive = 0;
          schiff.abklingen = OVERDRIVE_ABKLINGZEIT;
        }
      } else if (schiff.abklingen > 0 && !pausiert) {
        schiff.abklingen = Math.max(0, schiff.abklingen - dt);
      }
      const antrieb = { puls: schiff.puls, overdrive: schiff.overdrive > 0, schub: schiff.schub };
      const vZiel = pausiert ? 0 : zielTempo(antrieb, voraus, vorausRadius);
      schiff.v = naechstesTempo(schiff.v, vZiel, antrieb, dt);
      schiff.pos.addScaledVector(vorne, schiff.v * dt);

      // ── Aufprall: sanft aufsetzen, zu schnell abstürzen, in der Sonne verglühen ──
      if (!crash) {
        for (const [id, o] of ort) {
          // Sicherheitsabstand: bei großen Körpern 50 km, bei Brocken wie Deimos entsprechend weniger.
          const min = radius.get(id)! * 1.02 + Math.min(0.05, radius.get(id)! * 0.3);
          const d = schiff.pos.distanceTo(o);
          if (d >= min) continue;
          const zurMitte = hilf2.copy(o).sub(schiff.pos).normalize();
          const aufprall = schiff.v * Math.max(0, zurMitte.dot(vorne));
          if (id === "sonne") { starteUnfall("verglueht", id); break; }
          // Zu schnell heißt: schneller als das Schleichtempo vor diesem Körper.
          if (aufprall > Math.min(ABSTURZ_TEMPO, schleichTempo(radius.get(id)!) * 0.8)) { starteUnfall("absturz", id); break; }
          schiff.pos.sub(o).setLength(min).add(o);
        }
      }

      // ── Statistik ──
      if (!pausiert) {
        zuwachs.flugzeit += dt;
        zuwachs.strecke += schiff.v * dt * KM_JE_FLUGEINHEIT;
        zuwachs.hoechstC = Math.max(zuwachs.hoechstC, vielfachesLicht(schiff.v));
        if (schiff.puls && schiff.overdrive <= 0 && schiff.v >= HOECHSTTEMPO * 0.97) zuwachs.vollgas += dt;
        // Umlaufbahn: nah am Körper und seitlich unterwegs — der überstrichene Winkel zählt.
        const nah = naechster !== "sonne" && naechsterAbstand < Math.max(radius.get(naechster)! * 5, 25) && schiff.v > 0.2;
        const rel = hilf2.copy(schiff.pos).sub(naechsterOrt);
        if (nah && orbit.id === naechster) {
          const schritt = orbit.letzte.angleTo(rel);
          if (schritt / Math.max(dt, 1e-3) > 0.01) {
            orbit.winkel += schritt;
            zuwachs.orbitzeit += dt;
          }
          if (orbit.winkel >= Math.PI * 2 && !orbit.gezaehlt) {
            orbit.gezaehlt = true;
            zuwachs.umrundungen += 1;
            zuwachs.umrundet = mitEintrag(zuwachs.umrundet, naechster);
            meldeRef.current(`🔄 ${KOERPER_NACH_ID[naechster].name} einmal ganz umrundet!`);
          }
          if (orbit.winkel >= Math.PI * 4) { orbit.winkel -= Math.PI * 2; orbit.gezaehlt = false; }
        } else {
          orbit.id = nah ? naechster : "";
          orbit.winkel = 0;
          orbit.gezaehlt = false;
        }
        orbit.letzte.copy(rel);
        bisSpeichern -= dt;
        if (bisSpeichern <= 0) speichere();
      }

      // ── Scanner ──
      if (scan) {
        scan.t += dt / 1.6;
        const r = radiusVon(scan.id);
        scanHuelle.visible = true;
        scanHuelle.position.copy(stelleVon(scan.id));
        scanHuelle.scale.setScalar(r * (1.02 + 0.35 * scan.t));
        (scanHuelle.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - scan.t);
        if (scan.t >= 1) {
          scanHuelle.visible = false;
          const id = scan.id;
          scan = null;
          schiff.schub = 0; schiff.puls = false; schiff.overdrive = 0; schiff.autopilot = false;
          scanFertigRef.current(id);
        }
      }

      // ── Magnetfeld und Sonnensturm ──
      const erdOrt = ort.get("erde")!;
      magnet.sichtbar(magnetfeldRef.current);
      if (magnetfeldRef.current) {
        // Die Hülle zeigt zur Sonne: von dort kommt der Sonnenwind, der sie eindrückt.
        magnet.huelle.position.copy(erdOrt);
        magnet.huelle.quaternion.setFromUnitVectors(oben, hilf.copy(erdOrt).negate().normalize());
      }
      if (sturm) {
        sturm.t += pausiert ? 0 : dt;
        sturmwolke.setze((sturm.t / STURM_FLUG) * erdOrt.length(), Math.max(0, 1 - sturm.t / (STURM_FLUG * 1.4)));
        const seitAnkunft = sturm.t - STURM_FLUG;
        if (seitAnkunft >= 0 && !sturm.angekommen) {
          sturm.angekommen = true;
          meldeRef.current("⚡ Die Wolke trifft das Magnetfeld: es wird eingedrückt, an den Polen leuchten Polarlichter.");
        }
        magnet.sturm(seitAnkunft < 0 ? 0
          : seitAnkunft < 1.5 ? seitAnkunft / 1.5
            : Math.max(0, 1 - (seitAnkunft - 1.5) / STURM_NACHGLUEHEN));
        if (seitAnkunft > 1.5 + STURM_NACHGLUEHEN) {
          sturm = null;
          sturmwolke.setze(0, 0);
          magnet.sturm(0);
          meldeRef.current("Der Sturm ist vorbei — das Magnetfeld hat gehalten.");
        }
      }

      // ── Kamera ──
      const overdriveAn = schiff.overdrive > 0;
      if (crash) {
        laufeUnfall(dt);
      } else {
        kamera.position.copy(schiff.pos);
        kamera.quaternion.copy(schiff.quat);
        if (schiff.puls && schiff.v > HOECHSTTEMPO * 0.8) {
          const w = overdriveAn ? 0.06 : 0.02;
          kamera.position.x += (Math.random() - 0.5) * w;
          kamera.position.y += (Math.random() - 0.5) * w;
        }
      }
      const fovZiel = overdriveAn ? 108 : schiff.puls ? 92 : 70;
      fov += (fovZiel - fov) * (1 - Math.exp(-dt * 3));
      kamera.fov = fov;
      kamera.updateProjectionMatrix();
      himmel.position.copy(kamera.position);

      // Staub mitwandern lassen und zu Strichen ziehen.
      const halb = STAUB_WUERFEL / 2;
      const strich = Math.min(schiff.v * 0.08, overdriveAn ? 140 : 60) + 0.06;
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
      staubMat.opacity = Math.min(0.15 + schiff.v / 150, overdriveAn ? 0.9 : 0.7);
      staubMat.color.setHex(overdriveAn ? 0xf0c8ff : schiff.puls ? 0x9fd8ff : 0xa8b8d8);

      renderer.render(szene, kamera);

      // ── Markierungen im Bild, Pfeile am Rand für alles außerhalb ──
      const { clientWidth: w, clientHeight: h } = buehne;
      const kameraVorne = hilf2.set(0, 0, -1).applyQuaternion(kamera.quaternion);
      kameraUmkehr.copy(kamera.quaternion).invert();
      // Wo schon ein Randschild steht, bleibt beim nächsten nur der Pfeil.
      randPlaetze.length = 0;
      for (const [id, el] of markerRef.current) {
        const k = KOERPER_NACH_ID[id];
        const klein = k ? k.art === "mond" || k.art === "satellit" : false;
        const istZiel = id === ziel;
        const rand = randRef.current.get(id);
        const imBlick = !klein || istZiel || imSystem(k);
        projiziert.copy(stelleVon(id));
        const vor = hilf.copy(projiziert).sub(kamera.position).dot(kameraVorne) > 0;
        projiziert.project(kamera);
        const drin = vor && Math.abs(projiziert.x) < 1 && Math.abs(projiziert.y) < 1;
        if (drin && imBlick && !crash) {
          el.style.display = "";
          el.style.transform = `translate(${((projiziert.x + 1) / 2) * w}px, ${((1 - projiziert.y) / 2) * h}px) translate(-50%, -14px)`;
        } else {
          el.style.display = "none";
        }
        if (!rand) continue;
        // Randpfeil: Richtung im Kamerabild, auf den Bildrand gelegt.
        if (drin || crash || (klein && !istZiel)) { rand.style.display = "none"; continue; }
        const r = hilf.copy(stelleVon(id)).sub(kamera.position).applyQuaternion(kameraUmkehr);
        let winkel = Math.atan2(r.y, r.x);
        if (Math.abs(r.x) < 1e-6 && Math.abs(r.y) < 1e-6) winkel = -Math.PI / 2;
        const cos = Math.cos(winkel), sin = Math.sin(winkel);
        const rx = w / 2 - 34, ry = h / 2 - 34;
        const s = Math.min(rx / Math.max(Math.abs(cos), 1e-6), ry / Math.max(Math.abs(sin), 1e-6));
        const px = w / 2 + cos * s, py = h / 2 - sin * s;
        rand.style.display = "";
        rand.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
        (rand.firstElementChild as HTMLElement).style.transform = `rotate(${-winkel}rad)`;
        const eng = randPlaetze.some(([ax, ay]) => Math.abs(ax - px) < 60 && Math.abs(ay - py) < 26);
        (rand.lastElementChild as HTMLElement).style.display = eng && !istZiel ? "none" : "";
        if (!eng) randPlaetze.push([px, py]);
      }

      if (jetzt - letzterHud > 120) {
        letzterHud = jetzt;
        let startAbstand = Infinity;
        for (const id of ort.keys()) if (id !== ziel) startAbstand = Math.min(startAbstand, oberflaeche(id));
        setHud({
          modus: schiff.autopilot ? "autopilot" : overdriveAn ? "overdrive" : schiff.puls ? "puls" : schiff.v < 0.3 && schiff.schub === 0 ? "steht" : "flug",
          schub: schiff.schub,
          tempo: schiff.v,
          naechster,
          ziel,
          zielAbstand: ziel ? zielAbstand : 0,
          startAbstand,
          winkel: ziel ? hilf.copy(stelleVon(ziel)).sub(schiff.pos).angleTo(vorne) : 0,
          scanBereit: scanBereit(naechster),
          scan: scan ? scan.t : null,
          sturm: sturm ? { rest: Math.max(0, STURM_FLUG - sturm.t), da: sturm.angekommen } : null,
          puls: schiff.puls,
          overdrive: Math.max(schiff.overdrive, 0),
          abklingen: schiff.abklingen,
        });
      }

      function imSystem(k: Koerper) {
        const r = systemRadius.get(k.mutter!) ?? 0;
        return schiff.pos.distanceTo(ort.get(k.mutter!)!) < r;
      }
      function scanBereit(naechsterId: string): string | null {
        for (const id of [ziel, naechsterId]) {
          if (id && oberflaeche(id) < radius.get(id)! * 8 + 60) return id;
        }
        return null;
      }
    };

    bild = requestAnimationFrame(schleife);

    return () => {
      cancelAnimationFrame(bild);
      speichere();
      magnet.entsorgen();
      sturmwolke.entsorgen();
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

  const zielLagrange = hud.ziel ? ORTE_NACH_ID[hud.ziel] ?? null : null;
  const zielK = hud.ziel && !zielLagrange ? KOERPER_NACH_ID[hud.ziel] : null;
  const zielTitel = zielK?.name ?? zielLagrange?.name ?? null;
  const standort = KOERPER_NACH_ID[hud.naechster];
  const echteStrecke = zielK && zielK.id !== standort.id ? echterAbstandRef.current(standort.id, zielK.id) : null;
  const gemessen = hud.zielAbstand >= 0;
  const restzeit = zielTitel && gemessen
    ? schaetzeFlugzeit({
      abstand: hud.zielAbstand, zielRadius: zielK ? flugRadius(zielK) : ORT_RADIUS, startAbstand: hud.startAbstand,
      tempo: hud.tempo, puls: hud.puls, overdriveRest: hud.overdrive, winkel: hud.winkel,
    })
    : 0;
  // Nah am Ziel steht eine Flugeinheit für 1 000 km (Radien sind echt), zwischen
  // den Planeten für 60 000 km (Abstände sind gekürzt). Beides ehrlich beschriften.
  const nahbereich = hud.ziel !== null && hud.ziel === hud.naechster && hud.zielAbstand < 300;
  // Raumfahrzeuge und Lagrangepunkte stehen auf gestauchten Bahnen: eine
  // Umrechnung in Kilometer wäre glatt gelogen (die ISS läge dann Millionen km
  // entfernt). Dort steht nur die Flugzeit, die echte Strecke eine Zeile tiefer.
  const gestauchtesZiel = zielLagrange !== null || zielK?.art === "satellit";
  const zielStrecke = km(Math.max(hud.zielAbstand, 0) * (nahbereich ? FLUG_KM_JE_EINHEIT : KM_JE_FLUGEINHEIT));
  const zielZeile = !gemessen ? "wird gemessen …"
    : restzeit <= 0 ? "Ziel erreicht"
      : gestauchtesZiel && !nahbereich ? `Flugzeit ca. ${flugzeitText(restzeit)}`
        : `${zielStrecke} · Flugzeit ca. ${flugzeitText(restzeit)}`;
  const overdriveBereit = hud.overdrive <= 0 && hud.abklingen <= 0;

  return (
    <div ref={buehneRef} className="relative h-full w-full overflow-hidden select-none text-slate-100">
      {/* Vignette, Puls- und Overdrive-Schimmer */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
      }} />
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-700" style={{
        opacity: hud.puls && hud.overdrive <= 0 ? 1 : 0,
        background: "radial-gradient(ellipse at center, transparent 35%, rgba(80,170,255,0.18) 100%)",
      }} />
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-500" style={{
        opacity: hud.overdrive > 0 ? 1 : 0,
        background: "radial-gradient(ellipse at center, transparent 25%, rgba(220,120,255,0.28) 80%, rgba(255,255,255,0.18) 100%)",
      }} />

      {/* Markierungen */}
      <div className="absolute inset-0 pointer-events-none">
        {KOERPER.map(k => {
          const istZiel = k.id === hud.ziel;
          return (
            <button
              key={k.id}
              ref={el => { if (el) markerRef.current.set(k.id, el); else markerRef.current.delete(k.id); }}
              onClick={() => setzeZiel(k.id)}
              className="absolute left-0 top-0 pointer-events-auto flex flex-col items-center"
              style={{ display: "none" }}
            >
              {istZiel && (
                // Über dem Zielmarker: Flugstrecke und geschätzte Flugzeit.
                <span className="absolute bottom-full mb-1 whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-100">
                  {!gemessen ? "…" : gestauchtesZiel && !nahbereich ? flugzeitText(restzeit) : `${zielStrecke} · ${flugzeitText(restzeit)}`}
                </span>
              )}
              <svg viewBox="0 0 20 20" className={istZiel ? "w-8 h-8 text-amber-300" : k.art === "mond" || k.art === "satellit" ? "w-3.5 h-3.5 text-slate-300/70" : "w-5 h-5 text-cyan-200/80"}>
                <path d="M1 7V1h6M13 1h6v6M19 13v6h-6M7 19H1v-6" fill="none" stroke="currentColor" strokeWidth={istZiel ? 2 : 1.6} />
              </svg>
              <span className={`mt-1 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap drop-shadow-[0_1px_2px_#000] ${
                istZiel ? "text-amber-200" : fortschritt.erforscht.includes(k.id) ? "text-emerald-200/90" : "text-cyan-100/80"
              }`}>
                {k.kurz ?? k.name}{fortschritt.erforscht.includes(k.id) ? " ✓" : ""}
              </span>
            </button>
          );
        })}
        {ORTE.map(o => {
          const istZiel = o.id === hud.ziel;
          return (
            <button
              key={o.id}
              ref={el => { if (el) markerRef.current.set(o.id, el); else markerRef.current.delete(o.id); }}
              onClick={() => setzeZiel(o.id)}
              className="absolute left-0 top-0 pointer-events-auto flex flex-col items-center"
              style={{ display: "none" }}
            >
              {istZiel && (
                <span className="absolute bottom-full mb-1 whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-100">
                  {gemessen ? flugzeitText(restzeit) : "…"}
                </span>
              )}
              {/* Ein Punkt ohne Körper: ein Kreis mit dem Kurzzeichen darin. */}
              <svg viewBox="0 0 24 24" className={istZiel ? "w-9 h-9" : "w-6 h-6"} style={{ color: istZiel ? "#fcd34d" : o.farbe }}>
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 2.5" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" />
              </svg>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap drop-shadow-[0_1px_2px_#000]"
                style={{ color: istZiel ? "#fde68a" : o.farbe }}>
                {o.kurz} {KOERPER_NACH_ID[o.planet].name}{fortschritt.erforscht.includes(o.id) ? " ✓" : ""}
              </span>
            </button>
          );
        })}
        {/* Randpfeile für Sonne, Planeten, Zwergplaneten — und das Ziel, falls es ein Mond ist */}
        {[...KOERPER, ...ORTE].map(k => {
          const istZiel = k.id === hud.ziel;
          const art = "art" in k ? k.art : "ort";
          if ((art === "mond" || art === "satellit") && !istZiel) return null;
          return (
            <div
              key={`rand-${k.id}`}
              ref={el => { if (el) randRef.current.set(k.id, el); else randRef.current.delete(k.id); }}
              className="absolute left-0 top-0 flex flex-col items-center"
              style={{ display: "none" }}
            >
              <span className={`block leading-none ${istZiel ? "text-2xl text-amber-300" : "text-sm"}`}
                style={{ color: istZiel ? undefined : k.farbe, filter: "drop-shadow(0 0 4px #000)" }}>➤</span>
              <span className={`mt-0.5 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap drop-shadow-[0_1px_2px_#000] ${istZiel ? "text-amber-200" : "text-slate-300/80"}`}>
                {"punkt" in k ? `${k.kurz} ${KOERPER_NACH_ID[k.planet].name}` : k.kurz ?? k.name}
                {istZiel && gemessen ? ` · ${flugzeitText(restzeit)}` : ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* Beim Eintreffen des Sturms zuckt das Bild kurz orange */}
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-1000" style={{
        opacity: hud.sturm?.da ? 1 : 0,
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(255,150,40,0.18) 100%)",
      }} />

      {/* Fadenkreuz */}
      {!unfall && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-10 h-10 rounded-full border border-cyan-200/40 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-cyan-200/80" />
          </div>
        </div>
      )}

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
          erfolge={Object.keys(fortschritt.erfolge).length}
          zeitstufe={zeitstufe}
          onZeit={() => setZeitstufe(z => (z + 1) % ZEITSTUFEN.length)}
          magnetfeld={magnetfeld}
          onMagnetfeld={() => setMagnetfeld(m => !m)}
          onSturm={() => { befehl("sturm"); setMenue(false); }}
          onAuftraege={() => { setListe(true); setMenue(false); }}
          onKodex={onKodex && (bereich => { setMenue(false); onKodex(bereich); })}
          onHilfe={() => { setHilfe(true); setMenue(false); }}
          onVollbild={onVollbild}
          vollbild={vollbild}
          onVerlassen={onVerlassen}
          onZuruecksetzen={() => {
            if (window.confirm("Allen Forschungsfortschritt, alle Erfolge und die Flugstatistik auf diesem Gerät löschen?")) zuruecksetzen();
          }}
        />
      )}
      <div className="absolute left-[4.25rem] top-3 pointer-events-none">
        <div className={`rounded-xl bg-black/50 backdrop-blur border px-3 py-2 w-[9.5rem] sm:w-auto sm:min-w-[12rem] ${hud.overdrive > 0 ? "border-fuchsia-300/60" : "border-cyan-300/20"}`}>
          <div className={`text-[10px] sm:text-[11px] font-black uppercase tracking-[0.12em] sm:tracking-[0.2em] ${
            hud.modus === "overdrive" ? "text-fuchsia-200" : hud.modus === "puls" ? "text-sky-300" : hud.modus === "autopilot" ? "text-amber-300" : "text-cyan-200"
          }`}>
            {{ steht: "Antrieb bereit", flug: "Impulsflug", puls: "⚡ Pulsantrieb", overdrive: "⚡⚡ Overdrive", autopilot: "🧭 Autopilot" }[hud.modus]}
            {hud.modus === "autopilot" && hud.puls && (hud.overdrive > 0 ? " · ⚡⚡" : " · ⚡")}
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full transition-[width] ${hud.overdrive > 0 ? "bg-fuchsia-300" : "bg-cyan-300"}`}
              style={{ width: `${hud.puls ? Math.min(100, (vielfachesLicht(hud.tempo) / (hud.overdrive > 0 ? 1000 : 100)) * 100) : hud.schub * 100}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-slate-300 tabular-nums">
            {vielfachesLicht(hud.tempo) >= 1
              ? `${zahl(Math.round(vielfachesLicht(hud.tempo)))}-fache Lichtgeschwindigkeit`
              : `nächster Körper: ${standort.name}`}
          </div>
          {/* Overdrive: bereit, läuft oder lädt */}
          <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
            <span className={hud.overdrive > 0 ? "text-fuchsia-200" : overdriveBereit ? "text-fuchsia-300" : "text-slate-500"}>⚡⚡</span>
            <span className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <span className="block h-full bg-fuchsia-300" style={{
                width: `${hud.overdrive > 0 ? (hud.overdrive / OVERDRIVE_DAUER) * 100 : (1 - hud.abklingen / OVERDRIVE_ABKLINGZEIT) * 100}%`,
              }} />
            </span>
            <span className="tabular-nums text-slate-300 normal-case tracking-normal">
              {hud.overdrive > 0 ? `${Math.ceil(hud.overdrive)} s` : overdriveBereit ? (beruehrung ? "bereit" : "bereit · ⇧") : `${Math.ceil(hud.abklingen)} s`}
            </span>
          </div>
          {hud.sturm && (
            <div className="mt-2 border-t border-amber-300/30 pt-1.5">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-200">☀️ Sonnensturm</div>
              <div className="text-[11px] text-amber-50 tabular-nums">
                {hud.sturm.da ? "Die Wolke ist da — sieh auf die Pole." : `Erde erreicht in ${Math.ceil(hud.sturm.rest)} s`}
              </div>
            </div>
          )}
          {zielTitel && (
            // Auf dem Telefon ist die Zielanzeige oben in der Mitte ausgeblendet — hier steht das Wichtigste.
            <div className="md:hidden mt-1 text-[11px] text-amber-200 tabular-nums truncate">🎯 {zielTitel} · {gemessen ? flugzeitText(restzeit) : "…"}</div>
          )}
        </div>
      </div>

      {/* Mitte oben: Ziel */}
      {zielTitel && (
        <div className="absolute left-1/2 -translate-x-1/2 top-3 pointer-events-auto max-w-[min(28rem,calc(100%-26rem))] hidden md:block">
          <div className="rounded-xl bg-black/55 backdrop-blur border border-amber-300/30 px-3 py-2 text-center">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">🎯 {zielTitel}</div>
            <div className="text-sm font-bold text-amber-50 tabular-nums mt-0.5" title="Geschätzt für einen Flug per Autopilot (G)">
              {zielZeile}
            </div>
            {echteStrecke !== null && echteStrecke > 0 && (
              <div className="text-[11px] text-slate-300 mt-0.5">
                In Wirklichkeit {km(echteStrecke)} von {standort.name} · Licht: {dauer(echteStrecke / LICHT_KM_S)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rechts oben: vorgeschlagener Auftrag. Auf dem Telefon unter der Antriebsanzeige. */}
      <div className="absolute right-3 top-[7.5rem] sm:top-3 flex flex-col items-end gap-2 pointer-events-auto">
        {vorschlag && gestartet && (
          <AuftragKarte auftrag={vorschlag} geloest={fortschritt.erledigt.length} onListe={() => setListe(true)} />
        )}
        {!vorschlag && gestartet && (
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
        ) : hud.scanBereit && gestartet && !unfall ? (
          <button onClick={() => befehl("scan")} className="pointer-events-auto rounded-lg bg-cyan-500/20 border border-cyan-300/50 px-3 py-1.5 text-sm font-bold text-cyan-100 hover:bg-cyan-500/30">
            📡 {nameVon(hud.scanBereit)} scannen <span className="hidden md:inline text-cyan-300/70">[C]</span>
            {auftragZu(hud.scanBereit, fortschritt.erledigt) && <span className="ml-1 text-amber-300">◆</span>}
          </button>
        ) : null}
      </div>

      {/* Berührungssteuerung */}
      {beruehrung && gestartet && !unfall && (
        <>
          <Stick eingabe={eingabe.current} />
          <div className="absolute right-3 bottom-3 grid grid-cols-4 gap-2 pointer-events-auto">
            <HaltKnopf onAn={v => { eingabe.current.bremsKnopf = v; }}>Bremse</HaltKnopf>
            <HaltKnopf onAn={v => { eingabe.current.schubKnopf = v; }}>Schub</HaltKnopf>
            <HudKnopf onClick={() => befehl("pulsUmschalten")} aktiv={hud.puls} titel="Pulsantrieb">⚡</HudKnopf>
            <HudKnopf onClick={() => befehl("overdrive")} aktiv={hud.overdrive > 0} titel="Overdrive">
              <span className={overdriveBereit || hud.overdrive > 0 ? "" : "opacity-40"}>⚡⚡</span>
            </HudKnopf>
            <HudKnopf onClick={() => befehl("zielNaechstes")} titel="Ziel im Fadenkreuz">🎯</HudKnopf>
            <HudKnopf onClick={() => befehl("autopilot")} aktiv={hud.modus === "autopilot"} titel="Autopilot">🧭</HudKnopf>
            <HudKnopf onClick={() => befehl("scan")} titel="Scannen">📡</HudKnopf>
            {onKodex && <HudKnopf onClick={() => onKodex("eintraege")} titel="Kodex">📓</HudKnopf>}
          </div>
        </>
      )}
      {!beruehrung && gestartet && !unfall && (
        <div className="absolute left-3 bottom-3 text-[11px] text-slate-400 bg-black/40 rounded-lg px-2 py-1 pointer-events-none">
          Klick: Maus lenkt · Esc: Maus frei · M Menü · K Kodex · W/S Schub · Leertaste Puls · ⇧ Overdrive · T Ziel · G Autopilot · C Scan
        </div>
      )}

      {/* Unfall: roter bzw. glühender Blitz, dann schwarz bis zur Rettungskapsel */}
      {unfall && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 transition-opacity duration-300" style={{
            opacity: unfall.knall ? 1 : 0,
            background: unfall.art === "verglueht"
              ? "radial-gradient(circle, rgba(255,250,220,0.85), rgba(255,140,30,0.55) 60%, rgba(80,20,0,0.85))"
              : "radial-gradient(circle, rgba(255,190,90,0.55), rgba(160,20,10,0.45) 60%, rgba(0,0,0,0.8))",
          }} />
          {unfall.knall && (
            <div className="relative text-center font-mono">
              <div className="text-3xl sm:text-5xl font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_2px_8px_#000]">
                {unfall.art === "verglueht" ? "Verglüht" : "Aufgeschlagen"}
              </div>
              <div className="mt-2 text-sm text-white/90 drop-shadow-[0_1px_4px_#000]">
                {unfall.art === "verglueht" ? `Zu nah an der ${unfall.name}. ` : `Zu schnell auf ${unfall.name}. `}Rettungskapsel startet …
              </div>
            </div>
          )}
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
            Flieg zu einem Himmelskörper, scanne ihn — jeder Scan füllt deinen Kodex und schaltet Bilder in der Galerie frei.
            Ziele, Aufträge, Kodex und Erfolge stecken im Menü ☰ oben links.
          </p>
          <Steuerungstabelle beruehrung={beruehrung} />
          <p className="text-xs text-slate-400 mt-3">
            Maßstab: Planeten und Monde in echter Größe, Abstände 60-fach verkürzt, die Sonne 4-fach verkleinert.
            Die Zeit läuft echt: die Monde stehen dort, wo sie heute wirklich stehen, und kreisen so schnell, wie sie wirklich kreisen.
            Im Menü lässt sich ein Zeitraffer einschalten.
            In echt wäre der Flug zum Jupiter selbst mit Lichtgeschwindigkeit eine gute halbe Stunde lang.
          </p>
          <button onClick={() => setGestartet(true)} className="mt-4 w-full rounded-xl bg-cyan-400 text-slate-950 font-black py-2.5 hover:bg-cyan-300">
            Losfliegen
          </button>
          {(fortschritt.erforscht.length > 0 || fortschritt.erledigt.length > 0) && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              Bisher erforscht: {fortschritt.erforscht.length} von {ERFASSBAR} · Aufträge: {fortschritt.erledigt.length} von {AUFTRAEGE.length}
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
          koerper={karte.ort ? undefined : KOERPER_NACH_ID[karte.id]}
          ort={karte.ort ?? undefined}
          anzahl={fortschritt.erforscht.length}
          auftrag={karte.auftrag}
          onGeloest={id => aendere(f => ({ ...f, erledigt: mitEintrag(f.erledigt, id) }))}
          onSteckbrief={() => onSteckbrief(karte.id)}
          onSchliessen={() => { setKarte(null); setAuftragId(null); }}
        />
      )}

      {liste && (
        <Einblendung onSchliessen={() => setListe(false)} breit>
          <h2 className="text-lg font-black">🛰️ Forschungsaufträge</h2>
          <p className="text-xs text-slate-400 mt-1">
            Die Reihenfolge ist egal: jeder Auftrag zählt, sobald du sein Ziel scannst — auch zufällig.
            Antippen macht einen Auftrag zum Vorschlag oben rechts. Gelöst: {fortschritt.erledigt.length} von {AUFTRAEGE.length}.
          </p>
          <div className="mt-3 flex flex-col gap-3 max-h-[58vh] overflow-y-auto pr-1">
            {([1, 2, 3] as const).map(stufe => (
              <section key={stufe}>
                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300 mb-1.5">
                  {"◆".repeat(stufe)} {STUFEN_NAME[stufe]}
                </h3>
                <ol className="flex flex-col gap-1.5">
                  {AUFTRAEGE.filter(a => a.stufe === stufe).map(a => {
                    const fertig = fortschritt.erledigt.includes(a.id);
                    return (
                      <li key={a.id}>
                        <button
                          disabled={fertig}
                          onClick={() => { setAuftragId(a.id); setListe(false); }}
                          className={`w-full text-left rounded-lg px-3 py-2 text-sm border ${
                            fertig ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                              : a.id === vorschlag?.id ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <span className="font-bold mr-1">{fertig ? "✓" : "○"}</span>
                          {fertig ? `${KOERPER_NACH_ID[a.ziel].name}: ${a.hinweis}` : a.hinweis}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </Einblendung>
      )}
    </div>
  );
}

/**
 * Jupiters Trojaner: eine langgezogene Wolke aus Brocken um den Lagrangepunkt.
 *
 * Sie fallen nicht in den Punkt hinein, sondern pendeln in einer weit
 * ausholenden Bohnenform darum herum — die Wolke ist deshalb viel länger als
 * breit. Die Zahl der Punkte ist eine Andeutung, nicht die Wirklichkeit: dort
 * stehen über 13 000 bekannte Brocken.
 */
function baueTrojaner(farbe: number): THREE.Points {
  const anzahl = 700;
  const stellen = new Float32Array(anzahl * 3);
  for (let i = 0; i < anzahl; i++) {
    const laengs = (Math.random() - 0.5) * 2;
    stellen[i * 3] = laengs * 1500;
    stellen[i * 3 + 1] = (Math.random() - 0.5) * 220;
    stellen[i * 3 + 2] = (Math.random() - 0.5) * 420 + laengs * laengs * 300;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(stellen, 3));
  const punkte = new THREE.Points(geo, new THREE.PointsMaterial({
    color: farbe, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.65, depthWrite: false,
  }));
  punkte.frustumCulled = false;
  return punkte;
}

/** Ein kleines Raumschiff für die Absturz-Szene: Rumpf, Flügel, Triebwerksglühen. */
function baueSchiffchen(): THREE.Group {
  const g = new THREE.Group();
  const huelle = new THREE.MeshStandardMaterial({ color: 0xc8d0dc, metalness: 0.4, roughness: 0.5, emissive: 0x000000 });
  const rumpf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.4, 12), huelle);
  rumpf.rotation.x = -Math.PI / 2;
  g.add(rumpf);
  const fluegel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.45), huelle);
  fluegel.position.z = 0.35;
  g.add(fluegel);
  const glut = new THREE.Sprite(new THREE.SpriteMaterial({
    map: leuchtTextur("rgba(160,230,255,1)", "rgba(60,160,255,0.4)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  glut.scale.setScalar(0.9);
  glut.position.z = 0.8;
  g.add(glut);
  g.userData.huelle = huelle;
  return g;
}

function Menue({ onSchliessen, ziel, onZiel, erforscht, geloest, erfolge, zeitstufe, onZeit, magnetfeld, onMagnetfeld, onSturm, onAuftraege, onKodex, onHilfe, onVollbild, vollbild, onVerlassen, onZuruecksetzen }: {
  onSchliessen: () => void;
  ziel: string | null;
  onZiel: (id: string | null) => void;
  erforscht: string[];
  geloest: number;
  erfolge: number;
  zeitstufe: number;
  onZeit: () => void;
  magnetfeld: boolean;
  onMagnetfeld: () => void;
  onSturm: () => void;
  onAuftraege: () => void;
  onKodex?: (bereich: "eintraege" | "erfolge") => void;
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
        {onKodex && (
          <>
            <button className={eintrag} onClick={() => onKodex("eintraege")}>
              <span>📓 Kodex</span><span className="text-xs text-slate-400">{erforscht.length}/{ERFASSBAR}</span>
            </button>
            <button className={eintrag} onClick={() => onKodex("erfolge")}>
              <span>🏆 Erfolge</span><span className="text-xs text-slate-400">{erfolge}</span>
            </button>
          </>
        )}
        <button className={eintrag} onClick={onZeit} title="Wie schnell die Monde kreisen und die Planeten sich drehen">
          <span>🕒 Zeit</span><span className="text-xs text-slate-400">{ZEITSTUFEN[zeitstufe].name}</span>
        </button>
        <div className="px-3 pt-3 pb-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">Bei der Erde</div>
        <button className={eintrag} onClick={onMagnetfeld} title="Feldlinien, Polarlichtringe und die Blase, die der Sonnenwind eindrückt">
          <span>🧲 Erdmagnetfeld</span><span className="text-xs text-slate-400">{magnetfeld ? "an" : "aus"}</span>
        </button>
        <button className={eintrag} onClick={onSturm} title="Eine Teilchenwolke von der Sonne — sieh zu, was am Magnetfeld passiert">
          <span>☀️ Sonnensturm auslösen</span><span className="text-xs text-slate-400">≈40 s</span>
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

function AuftragKarte({ auftrag, geloest, onListe }: { auftrag: Auftrag; geloest: number; onListe: () => void }) {
  const [offen, setOffen] = useState(true);
  return (
    <div className="rounded-xl bg-black/55 backdrop-blur border border-amber-300/30 px-3 py-2 max-w-[17rem] text-left">
      <button onClick={() => setOffen(o => !o)} className="w-full flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-widest text-amber-200">
        <span>🛰️ Auftrag · {"◆".repeat(auftrag.stufe)} <span className="text-amber-200/60">{geloest}/{AUFTRAEGE.length}</span></span>
        <span>{offen ? "–" : "+"}</span>
      </button>
      {offen && (
        <>
          <p className="text-sm mt-1 leading-snug">{auftrag.hinweis}</p>
          <button onClick={onListe} className="mt-1.5 text-xs text-amber-200/80 underline">Alle Aufträge — Reihenfolge egal</button>
        </>
      )}
    </div>
  );
}
