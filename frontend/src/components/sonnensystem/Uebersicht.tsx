"use client";
/**
 * Die 3D-Übersicht: alle Planeten auf ihren echten Bahnen, zu einem wählbaren
 * Datum, mit Zeitraffer.
 *
 * Die Szene lebt außerhalb von React: sie wird einmal gebaut und liest die
 * Schalter jedes Bild aus Refs. React zeichnet nur die Leiste darüber und,
 * ein paarmal je Sekunde, das angezeigte Datum.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { HAUPTKOERPER, KOERPER, KOERPER_NACH_ID } from "@/lib/sonnensystem/daten";
import { bahnPunkte, datumAusJd, heliozentrisch, julianischerTag, mondVersatz, type Vec3 } from "@/lib/sonnensystem/bahnen";
import {
  uebersichtAbstand, uebersichtMondbahn, uebersichtOrt, uebersichtRadius, type AbstandsModus, type GroessenModus,
} from "@/lib/sonnensystem/massstab";
import {
  Texturen, baueGuertel, baueHimmel, baueKoerper, baueSonne, drehwinkel, entsorge, webglVerfuegbar, zuSzene, type KoerperObjekt,
} from "./szene";
import { Schalter, Knopfgruppe } from "./Bedienung";

const TEMPI = [
  { name: "1 Stunde/s", tage: 1 / 24 },
  { name: "1 Tag/s", tage: 1 },
  { name: "1 Woche/s", tage: 7 },
  { name: "1 Monat/s", tage: 30.44 },
  { name: "1 Jahr/s", tage: 365.25 },
];

interface Optionen {
  abstaende: AbstandsModus;
  groessen: GroessenModus;
  monde: boolean;
  bahnen: boolean;
  namen: boolean;
}

export default function Uebersicht({ ausgewaehlt, onWaehle, onKepler }: {
  ausgewaehlt: string | null;
  onWaehle: (id: string) => void;
  /** Weiter zu den Keplerschen Gesetzen — sie erklären genau diese Bahnen. */
  onKepler?: () => void;
}) {
  const buehneRef = useRef<HTMLDivElement>(null);
  const namenRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [fehlt, setFehlt] = useState(false);
  const [geladen, setGeladen] = useState(false);

  const [laeuft, setLaeuft] = useState(true);
  const [tempo, setTempo] = useState(1);
  const [optionen, setOptionen] = useState<Optionen>({
    abstaende: "gestaucht", groessen: "vergroessert", monde: true, bahnen: true, namen: true,
  });
  const [anzeigeJd, setAnzeigeJd] = useState(() => julianischerTag(new Date()));

  // Die Szene liest diese Werte je Bild; ein neuer Wert baut nichts neu auf.
  const zustand = useRef({
    jd: julianischerTag(new Date()), laeuft, tempo, optionen, ausgewaehlt, onWaehle,
    neuBauen: true, sprungJd: null as number | null,
  });
  zustand.current.laeuft = laeuft;
  zustand.current.tempo = tempo;
  zustand.current.ausgewaehlt = ausgewaehlt;
  zustand.current.onWaehle = onWaehle;
  if (zustand.current.optionen !== optionen) {
    zustand.current.optionen = optionen;
    zustand.current.neuBauen = true;
  }

  useEffect(() => {
    const buehne = buehneRef.current;
    if (!buehne) return;
    if (!webglVerfuegbar()) { setFehlt(true); return; }

    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    buehne.prepend(renderer.domElement);
    renderer.domElement.className = "absolute inset-0 w-full h-full touch-none";

    const szene = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(50, 1, 0.0005, 30_000);
    kamera.position.set(0, 55, 85);
    const steuerung = new OrbitControls(kamera, renderer.domElement);
    steuerung.enableDamping = true;
    steuerung.minDistance = 0.005;
    steuerung.maxDistance = 4_000;
    // Verschieben in der Bildebene: sonst klebt der Blick für immer am Ursprung.
    steuerung.enablePan = true;
    steuerung.screenSpacePanning = true;

    const manager = new THREE.LoadingManager(() => setGeladen(true));
    const texturen = new Texturen(manager);

    const himmel = baueHimmel(15_000, texturen);
    szene.add(himmel);
    const sonne = baueSonne(1, texturen);
    szene.add(sonne.gruppe);
    szene.add(new THREE.PointLight(0xffffff, 2.6, 0, 0));
    szene.add(new THREE.AmbientLight(0x8090b0, 0.12));

    const objekte = new Map<string, KoerperObjekt>();
    for (const k of KOERPER) {
      if (k.art === "stern") continue;
      const o = baueKoerper(k, 1, texturen, k.art === "mond" ? 32 : 64);
      objekte.set(k.id, o);
      szene.add(o.gruppe);
    }

    // Was vom Maßstab abhängt, wird bei jedem Umschalten neu gebaut.
    let linien = new THREE.Group();
    szene.add(linien);

    function baueMassstab(opt: Optionen, jd: number) {
      szene.remove(linien);
      entsorge(linien);
      linien = new THREE.Group();
      szene.add(linien);

      sonne.kugel.scale.setScalar(uebersichtRadius(KOERPER_NACH_ID.sonne, opt.groessen));
      sonne.glanz.scale.setScalar(uebersichtRadius(KOERPER_NACH_ID.sonne, opt.groessen) * 9);

      for (const o of objekte.values()) {
        o.achse.scale.setScalar(uebersichtRadius(o.koerper, opt.groessen));
        if (o.koerper.art === "mond") o.gruppe.visible = opt.monde;
      }
      if (!opt.bahnen) return;

      for (const k of HAUPTKOERPER) {
        if (!k.bahn) continue;
        const punkte = bahnPunkte(k.bahn, jd, 256).map(p => zuSzene(uebersichtOrt(p, opt.abstaende)));
        linien.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(punkte),
          new THREE.LineBasicMaterial({ color: k.farbe, transparent: true, opacity: k.art === "planet" ? 0.45 : 0.25 }),
        ));
      }
      const g = (a: number) => uebersichtAbstand(a, opt.abstaende);
      linien.add(baueGuertel(2500, g(2.1), g(3.3), g(2.7) * 0.04, 0x9a8f80, 1.2));
      linien.add(baueGuertel(3000, g(30), g(50), g(40) * 0.06, 0x8090a8, 1.2));

      if (opt.monde) {
        for (const o of objekte.values()) {
          const mond = o.koerper;
          if (mond.art !== "mond") continue;
          const mutter = KOERPER_NACH_ID[mond.mutter!];
          const r = uebersichtMondbahn(mond, mutter, opt.groessen);
          const periode = Math.abs(mond.mondBahn!.umlaufTage);
          const punkte = Array.from({ length: 97 }, (_, i) => {
            const v = mondVersatz(mond, mutter, jd + (periode * i) / 96);
            const l = Math.hypot(...v);
            return zuSzene([(v[0] / l) * r, (v[1] / l) * r, (v[2] / l) * r]);
          });
          const linie = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(punkte),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 }),
          );
          linie.userData.mutter = mutter.id;
          linien.add(linie);
        }
      }
    }

    const hilfsVek = new THREE.Vector3();
    const weltOrt = new Map<string, THREE.Vector3>(KOERPER.map(k => [k.id, new THREE.Vector3()]));

    function stelleAuf(jd: number, opt: Optionen) {
      for (const k of HAUPTKOERPER) {
        if (!k.bahn) continue;
        zuSzene(uebersichtOrt(heliozentrisch(k.bahn, jd), opt.abstaende), weltOrt.get(k.id)!);
      }
      for (const o of objekte.values()) {
        const k = o.koerper;
        if (k.art === "mond") {
          const mutter = KOERPER_NACH_ID[k.mutter!];
          const v: Vec3 = mondVersatz(k, mutter, jd);
          const l = Math.hypot(...v);
          const r = uebersichtMondbahn(k, mutter, opt.groessen);
          zuSzene([(v[0] / l) * r, (v[1] / l) * r, (v[2] / l) * r], hilfsVek);
          weltOrt.get(k.id)!.copy(weltOrt.get(mutter.id)!).add(hilfsVek);
        }
        o.gruppe.position.copy(weltOrt.get(k.id)!);
        o.kugel.rotation.y = drehwinkel(k, jd) % (Math.PI * 2);
      }
      // Mondbahnlinien wandern mit ihrem Planeten.
      for (const l of linien.children) {
        if (l.userData.mutter) l.position.copy(weltOrt.get(l.userData.mutter)!);
      }
    }

    // ── Kamera folgt dem gewählten Körper ──
    let fokus: string | null = null;
    const letzterFokusOrt = new THREE.Vector3();
    let anflug = 0;  // > 0: die Kamera fährt gerade heran
    // Wer ins Leere tippt, will weg vom gewählten Körper — dann hört das
    // Mitziehen auf, bis wieder etwas ausgewählt wird.
    let losgelassen = false;
    /** Ziel eines Schwenks in die Bahnebene, sonst null. */
    let schwenkZiel: THREE.Vector3 | null = null;

    function wunschAbstand(id: string, opt: Optionen): number {
      const k = KOERPER_NACH_ID[id];
      return Math.max(uebersichtRadius(k, opt.groessen) * (k.ringe ? 9 : 6), opt.groessen === "echt" ? 0.002 : 0.4);
    }

    // ── Tippen: auf einen Körper wählt ihn, ins Leere schwenkt dorthin ──
    // Die Planeten liegen alle nahe an einer Ebene. Ein Tipp ins Leere sticht
    // deshalb in genau diese Scheibe und fährt den Blick an die getroffene
    // Stelle — anders käme man aus der Umlaufbahn um die Sonne nie heraus.
    const strahl = new THREE.Raycaster();
    const bahnebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const einstich = new THREE.Vector3();
    const zeiger = new Set<number>();
    let druck: { x: number; y: number } | null = null;
    const runter = (e: PointerEvent) => {
      zeiger.add(e.pointerId);
      // Nur ein einzelner Finger zählt als Tipp; zwei schieben oder zoomen.
      druck = zeiger.size === 1 ? { x: e.clientX, y: e.clientY } : null;
    };
    const hoch = (e: PointerEvent) => {
      zeiger.delete(e.pointerId);
      const start = druck;
      druck = null;
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      strahl.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), kamera);
      const ziele = [sonne.kugel, ...[...objekte.values()].filter(o => o.gruppe.visible).map(o => o.kugel)];
      const treffer = strahl.intersectObjects(ziele, false)[0];
      if (treffer) { zustand.current.onWaehle(treffer.object.userData.id); return; }
      // Flach auf die Ebene geschaut trifft der Strahl erst in der Unendlichkeit;
      // solche Tipps bleiben folgenlos, statt den Blick ins Nichts zu schleudern.
      if (!strahl.ray.intersectPlane(bahnebene, einstich)) return;
      if (einstich.distanceTo(kamera.position) > steuerung.maxDistance * 2) return;
      schwenkZiel = einstich.clone();
      losgelassen = true;
    };
    const abbruch = (e: PointerEvent) => { zeiger.delete(e.pointerId); druck = null; };
    renderer.domElement.addEventListener("pointerdown", runter);
    renderer.domElement.addEventListener("pointerup", hoch);
    renderer.domElement.addEventListener("pointercancel", abbruch);

    const groesse = () => {
      const { clientWidth: w, clientHeight: h } = buehne;
      renderer.setSize(w, h, false);
      kamera.aspect = w / Math.max(h, 1);
      kamera.updateProjectionMatrix();
    };
    const beobachter = new ResizeObserver(groesse);
    beobachter.observe(buehne);
    groesse();

    let letzteZeit = performance.now();
    let letzteAnzeige = 0;
    let bild = 0;
    const projiziert = new THREE.Vector3();

    const schleife = (jetzt: number) => {
      bild = requestAnimationFrame(schleife);
      const dt = Math.min((jetzt - letzteZeit) / 1000, 0.1);
      letzteZeit = jetzt;
      const z = zustand.current;

      if (z.sprungJd !== null) { z.jd = z.sprungJd; z.sprungJd = null; z.neuBauen = true; }
      if (z.laeuft) z.jd += dt * TEMPI[z.tempo].tage;
      if (z.neuBauen) { baueMassstab(z.optionen, z.jd); z.neuBauen = false; }
      stelleAuf(z.jd, z.optionen);

      // Fokus wechseln: die Kamera schwenkt herüber und fährt heran.
      if (z.ausgewaehlt !== fokus) {
        fokus = z.ausgewaehlt;
        losgelassen = false;
        schwenkZiel = null;
        if (fokus) { letzterFokusOrt.copy(weltOrt.get(fokus)!); anflug = 1; }
      }
      // Schwenk in die Bahnebene: Blickpunkt und Kamera wandern gemeinsam,
      // der Abstand und der Winkel bleiben also erhalten.
      if (schwenkZiel) {
        const schritt = hilfsVek.copy(schwenkZiel).sub(steuerung.target).multiplyScalar(0.14);
        steuerung.target.add(schritt);
        kamera.position.add(schritt);
        if (schritt.lengthSq() < 1e-8) schwenkZiel = null;
      }
      if (fokus && !losgelassen) {
        const ort = weltOrt.get(fokus)!;
        const schritt = hilfsVek.copy(ort).sub(letzterFokusOrt);
        kamera.position.add(schritt);
        steuerung.target.add(schritt);
        letzterFokusOrt.copy(ort);
        if (anflug > 0) {
          steuerung.target.lerp(ort, 0.12);
          const soll = wunschAbstand(fokus, z.optionen);
          const blick = kamera.position.clone().sub(steuerung.target);
          const ist = blick.length();
          blick.setLength(ist + (soll - ist) * 0.08);
          kamera.position.copy(steuerung.target).add(blick);
          if (Math.abs(ist - soll) < soll * 0.02 && steuerung.target.distanceTo(ort) < soll * 0.01) anflug = 0;
        }
      }

      himmel.position.copy(kamera.position);
      steuerung.update();
      renderer.render(szene, kamera);

      // Namensschilder über die Szene legen.
      const { clientWidth: w, clientHeight: h } = buehne;
      for (const [id, el] of namenRef.current) {
        const k = KOERPER_NACH_ID[id];
        const ort = id === "sonne" ? projiziert.set(0, 0, 0) : projiziert.copy(weltOrt.get(id)!);
        const abstandKamera = kamera.position.distanceTo(ort);
        let sichtbar = z.optionen.namen || id === fokus;
        if (k.art === "mond") {
          const mutter = weltOrt.get(k.mutter!)!;
          const nah = kamera.position.distanceTo(mutter) < uebersichtMondbahn(k, KOERPER_NACH_ID[k.mutter!], z.optionen.groessen) * 14;
          sichtbar = sichtbar && z.optionen.monde && nah;
        }
        ort.project(kamera);
        if (!sichtbar || ort.z > 1 || Math.abs(ort.x) > 1.1 || Math.abs(ort.y) > 1.1 || abstandKamera < 1e-9) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "";
        el.style.transform = `translate(${((ort.x + 1) / 2) * w}px, ${((1 - ort.y) / 2) * h}px) translateY(-50%)`;
      }

      if (jetzt - letzteAnzeige > 250) { letzteAnzeige = jetzt; setAnzeigeJd(z.jd); }
    };
    bild = requestAnimationFrame(schleife);

    return () => {
      cancelAnimationFrame(bild);
      beobachter.disconnect();
      renderer.domElement.removeEventListener("pointerdown", runter);
      renderer.domElement.removeEventListener("pointerup", hoch);
      renderer.domElement.removeEventListener("pointercancel", abbruch);
      steuerung.dispose();
      entsorge(szene);
      texturen.entsorgen();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const springe = (datum: Date) => { zustand.current.sprungJd = julianischerTag(datum); };
  const setze = (teil: Partial<Optionen>) => setOptionen(o => ({ ...o, ...teil }));
  const datum = datumAusJd(anzeigeJd);

  if (fehlt) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center text-slate-300">
        Dieser Browser kann kein WebGL — die 3D-Ansicht bleibt aus. Größen, Entfernungen und Galerie funktionieren trotzdem.
      </div>
    );
  }

  return (
    <div ref={buehneRef} className="relative h-full w-full overflow-hidden select-none">
      {/* Namensschilder: absolut an der Ecke, verschoben per transform */}
      <div className="absolute inset-0 pointer-events-none">
        {KOERPER.map(k => (
          <button
            key={k.id}
            ref={el => { if (el) namenRef.current.set(k.id, el); else namenRef.current.delete(k.id); }}
            onClick={() => onWaehle(k.id)}
            className="absolute left-0 top-0 pointer-events-auto flex items-center gap-1.5 whitespace-nowrap"
            style={{ display: "none" }}
          >
            <span className="block rounded-full -ml-[4px]" style={{
              width: k.art === "mond" ? 6 : 8, height: k.art === "mond" ? 6 : 8,
              background: k.farbe, boxShadow: `0 0 8px ${k.farbe}`,
              outline: k.id === ausgewaehlt ? "2px solid white" : undefined, outlineOffset: 2,
            }} />
            <span className={`text-[11px] font-bold tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,1)] ${
              k.id === ausgewaehlt ? "text-white" : k.art === "mond" ? "text-slate-400" : "text-slate-200"
            }`}>{k.name}</span>
          </button>
        ))}
      </div>

      {!geladen && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none">
          Planeten werden geladen …
        </div>
      )}

      {/* Zeit */}
      <div className="absolute left-3 top-3 right-3 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl bg-black/55 backdrop-blur px-2 py-1.5 border border-white/10">
          <button
            onClick={() => setLaeuft(l => !l)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            aria-label={laeuft ? "Anhalten" : "Weiterlaufen"}
          >{laeuft ? "⏸" : "▶"}</button>
          <input
            type="date"
            aria-label="Datum"
            value={datum.toISOString().slice(0, 10)}
            onChange={e => { if (e.target.value) springe(new Date(`${e.target.value}T12:00:00`)); }}
            className="bg-transparent text-white text-sm font-bold tabular-nums [color-scheme:dark] w-[8.5rem]"
          />
          <button onClick={() => springe(new Date())} className="text-xs text-sky-300 hover:text-sky-200 px-1">Heute</button>
          <Knopfgruppe
            werte={TEMPI.map((t, i) => ({ wert: i, name: t.name }))}
            aktiv={tempo}
            onWahl={setTempo}
          />
        </div>
      </div>

      {/* Ansicht */}
      <div className="absolute left-3 bottom-3 flex flex-col gap-2 items-start pointer-events-none max-w-[calc(100%-1.5rem)]">
        <div className="pointer-events-auto flex flex-wrap gap-2 rounded-xl bg-black/55 backdrop-blur px-2 py-1.5 border border-white/10">
          <Knopfgruppe
            werte={[{ wert: "gestaucht", name: "Abstände gestaucht" }, { wert: "echt", name: "Abstände echt" }]}
            aktiv={optionen.abstaende}
            onWahl={abstaende => setze({ abstaende })}
          />
          <Knopfgruppe
            werte={[{ wert: "vergroessert", name: "Größen vergrößert" }, { wert: "echt", name: "Größen echt" }]}
            aktiv={optionen.groessen}
            onWahl={groessen => setze({ groessen })}
          />
          <Schalter an={optionen.bahnen} onClick={() => setze({ bahnen: !optionen.bahnen })}>Bahnen</Schalter>
          <Schalter an={optionen.monde} onClick={() => setze({ monde: !optionen.monde })}>Monde</Schalter>
          <Schalter an={optionen.namen} onClick={() => setze({ namen: !optionen.namen })}>Namen</Schalter>
        </div>
        <p className="text-[11px] leading-snug text-slate-400 bg-black/40 rounded-lg px-2 py-1">
          {massstabHinweis(optionen)} Ziehen dreht, Mausrad oder zwei Finger zoomen, rechte Taste verschiebt.
          Antippen wählt einen Körper — ins Leere getippt fährt der Blick an diese Stelle der Bahnebene.
          {onKepler && (
            <button onClick={onKepler} className="ml-1 text-sky-300 hover:text-sky-200 underline pointer-events-auto">
              Warum die Bahnen so laufen: die Keplerschen Gesetze →
            </button>
          )}
        </p>
      </div>
    </div>
  );
}

function massstabHinweis(o: Optionen): string {
  if (o.groessen === "echt" && o.abstaende === "echt") {
    return "Alles maßstabsgetreu — deshalb sind die Planeten viel kleiner als ein Pixel. Die Punkte zeigen, wo sie sind; heranzoomen lohnt sich.";
  }
  if (o.groessen === "echt") return "Größen echt, Abstände gestaucht: die Planeten sind trotzdem winzig.";
  if (o.abstaende === "echt") return "Abstände echt, Planeten stark vergrößert — sonst wären sie unsichtbar.";
  return "Nicht maßstabsgetreu: Abstände gestaucht, Planeten vergrößert, Mondbahnen extra gedehnt.";
}
