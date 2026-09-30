"use client";
/**
 * Isometrisches Gebäude (three.js, orthografische Kamera). Die Figur läuft
 * per Klick/Tippen (Wegsuche) oder mit Pfeiltasten/WASD; kommt sie in einem
 * Zimmer, an der Treppe weiter oder an der Treppe zurück an, meldet
 * `onAnkunft` den Ort.
 *
 * Drei Arten: Haus (Stockwerke nach oben, die unteren sieht man gedämpft),
 * Verlies (Ebenen nach unten, nur die aktuelle ist zu sehen, dunkel mit
 * einer Fackel um die Figur — wie in Diablo) und Ebene (alle Abschnitte
 * nebeneinander auf einer Karte, verbunden durch Türen).
 *
 * Kennt keine Inhalte: Wer das Gebäude benutzt (Exitgame, Regel-Labor,
 * später Verkehr/Rock your Life), gibt Plan, Zustände und Stockwerk vor und
 * entscheidet selbst, was bei der Ankunft passiert.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { begehbar, weg, type Plan, type Punkt, type Stockwerk } from "@/lib/gebaeude/plan";
import type { Objekt } from "@/lib/gebaeude/objekte";
import {
  baueStock, entsorge, feldAus, figur, hoeheVon, ortAmStrahl, versatzVon, welt as mitte,
  type KlickOrt, type RaumZustand, type Richtung, type Stil,
} from "./szene";

export type Ort = KlickOrt;
export type GebaeudeArt = "haus" | "verlies" | "ebene";

interface Props {
  plan: Plan;
  stock: number;
  /** je Stockwerk die Zustände seiner Zimmer */
  zustaende: RaumZustand[][];
  /** je Stockwerk: Treppe/Ausgang schon offen? */
  zielOffen: boolean[];
  /** je Stockwerk, was in den Zimmern steht (Vorgabe: Schreibtisch) */
  objekte?: Objekt[][];
  stil?: Stil;
  /** haus: nach oben · verlies: nach unten, nur die aktuelle Ebene, Fackellicht · ebene: Abschnitte nebeneinander mit Türen */
  art?: GebaeudeArt;
  /** je Stockwerk: bewacht ein Boss Treppe bzw. Ausgang? */
  waechter?: boolean[];
  /** Tastatur an (aus, solange z. B. ein Aufgabenfenster offen ist) */
  aktiv: boolean;
  /** von außen: dorthin laufen (neue `nr` = neuer Auftrag) */
  auftrag?: { ort: Ort; nr: number } | null;
  onAnkunft: (ort: Ort) => void;
}

const TEMPO = 9; // Welteinheiten pro Sekunde (ein Flurfeld ist 2,2 breit)
const TASTEN: Record<string, number> = {
  ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3,
};

/** Feld eines Ortes auf dem Stockwerk */
function feldVon(st: Stockwerk, ort: Ort): Punkt {
  if (ort.art === "ziel") return st.ziel;
  if (ort.art === "zurueck") return st.start;
  return [st.raeume[ort.raum].x, st.raeume[ort.raum].y];
}

export default function Gebaeude({
  plan, stock, zustaende, zielOffen, objekte, stil, art = "haus", waechter, aktiv, auftrag, onAnkunft,
}: Props) {
  const verlies = art === "verlies";
  const flach = art === "ebene";
  const huelle = useRef<HTMLDivElement>(null);
  const [drehung, setDrehung] = useState(0);
  const [zoom, setZoom] = useState(1);
  const richtung: Richtung = verlies ? -1 : 1;

  // Alles, was die Zeichenschleife liest, steht in einem Ref.
  const lage = useRef({
    plan, stock, drehung, zoom, aktiv, onAnkunft, richtung, flach,
    feld: plan.stockwerke[stock].start as Punkt,
    pos: new THREE.Vector3(),
    pfad: [] as Punkt[],
    /** die Gruppe des aktuellen Stockwerks (für Klicks) */
    hier: null as THREE.Object3D | null,
  });
  Object.assign(lage.current, { plan, stock, drehung, zoom, aktiv, onAnkunft, richtung, flach });

  const drei = useRef<{
    szene: THREE.Scene; welt: THREE.Group; spieler: THREE.Group;
    himmel: THREE.HemisphereLight; sonne: THREE.DirectionalLight; fackel: THREE.PointLight;
  } | null>(null);

  // ── einmalig: Renderer, Kamera, Licht, Schleife ─────────────────────────
  useEffect(() => {
    const el = huelle.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const szene = new THREE.Scene();
    const himmel = new THREE.HemisphereLight(0xffffff, 0x445566, 1.6);
    const sonne = new THREE.DirectionalLight(0xffffff, 1.4);
    sonne.position.set(-6, 14, 4);
    // Fackel: warmes Licht, das mit der Figur wandert (nur im Verlies an)
    const fackel = new THREE.PointLight(0xffa24a, 0, 22, 1.2);
    szene.add(himmel, sonne, fackel);
    const welt = new THREE.Group();
    const spieler = figur(0xe11d48);
    spieler.scale.setScalar(1.4);
    szene.add(welt, spieler);
    drei.current = { szene, welt, spieler, himmel, sonne, fackel };

    const kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
    const blick = new THREE.Vector3();
    const groesse = () => {
      const b = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(b, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      return b / h;
    };
    let seitenverh = groesse();
    const ro = new ResizeObserver(() => { seitenverh = groesse(); });
    ro.observe(el);

    // Blickrichtung (Welt, x/z) für »oben« auf dem Bildschirm
    const winkel = () => Math.PI / 4 + (lage.current.drehung * Math.PI) / 2;
    const bodenHoehe = () => (lage.current.flach ? 0 : hoeheVon(lage.current.stock, lage.current.richtung)) + 0.25;
    /** Ebene: Weltverschiebung des aktuellen Abschnitts */
    const dx = () => versatzVon(lage.current.stock, lage.current.plan.R, lage.current.flach);

    const ankommen = () => {
      const l = lage.current;
      const st = l.plan.stockwerke[l.stock];
      const [x, y] = l.feld;
      if (x === st.ziel[0] && y === st.ziel[1]) l.onAnkunft({ art: "ziel" });
      if (l.stock > 0 && x === st.start[0] && y === st.start[1]) l.onAnkunft({ art: "zurueck" });
      const k = st.raeume.findIndex(r => r.x === x && r.y === y);
      if (k >= 0) l.onAnkunft({ art: "raum", raum: k });
    };

    const tasten = (e: KeyboardEvent) => {
      const l = lage.current;
      const t = e.target as HTMLElement;
      if (!l.aktiv || t.closest("input, textarea, select, [contenteditable]")) return;
      // Ziffern (Nummernblock oder obere Reihe): 1–9 läuft zum Zimmer mit dieser
      // Nummer auf dem Schild, 0 zur Treppe bzw. Tür.
      const ziffer = /^(?:Numpad|Digit)([0-9])$/.exec(e.code)?.[1] ?? (/^[0-9]$/.test(e.key) ? e.key : null);
      if (ziffer !== null) {
        const st = l.plan.stockwerke[l.stock];
        const n = Number(ziffer);
        const ziel: Punkt | null = n === 0 ? st.ziel : st.raeume[n - 1] ? [st.raeume[n - 1].x, st.raeume[n - 1].y] : null;
        if (!ziel) return;
        e.preventDefault();
        if (ziel[0] === l.feld[0] && ziel[1] === l.feld[1] && !l.pfad.length) ankommen();
        else l.pfad = weg(l.plan.R, st, l.feld, ziel);
        return;
      }
      const r = TASTEN[e.key];
      if (r === undefined) return;
      e.preventDefault();
      if (l.pfad.length) return;
      // Bildschirmrichtung → nächste Rasterrichtung. »Oben« zeigt von der
      // Kamera weg (plus 45°, damit die Pfeile den Fluren folgen); rechts/links
      // drehen im Uhrzeigersinn weiter — so wie man es auf dem Bildschirm sieht.
      const a = winkel() + Math.PI + Math.PI / 4 + (r * Math.PI) / 2;
      const dx = Math.round(Math.cos(a)), dz = Math.round(Math.sin(a));
      const [sx, sy] = Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
      const [x, y] = l.feld;
      const st = l.plan.stockwerke[l.stock];
      // Ein Tastendruck = bis zur nächsten Kreuzung (über den kurzen Durchgang hinweg)
      const schritte: Punkt[] = [];
      for (let k = 1; k <= 2; k++) {
        const p: Punkt = [x + sx * k, y + sy * k];
        if (!begehbar(l.plan.R, st, p)) break;
        schritte.push(p);
        if (p[0] % 2 === 1 && p[1] % 2 === 1) break;
      }
      if (schritte.length) l.pfad = schritte;
    };
    window.addEventListener("keydown", tasten);

    const zeiger = new THREE.Raycaster();
    const klick = (e: PointerEvent) => {
      const l = lage.current;
      const r = renderer.domElement.getBoundingClientRect();
      zeiger.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), kamera);
      // Zuerst: ein Zimmer, Objekt, Schild oder eine Treppe getroffen? Dann dorthin.
      const st = l.plan.stockwerke[l.stock];
      const ort = l.hier ? ortAmStrahl(l.hier, zeiger) : null;
      if (ort && (ort.art !== "zurueck" || l.stock > 0)) {
        const ziel = feldVon(st, ort);
        if (ziel[0] === l.feld[0] && ziel[1] === l.feld[1] && !l.pfad.length) ankommen();
        else l.pfad = weg(l.plan.R, st, l.feld, ziel);
        return;
      }
      const ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), -bodenHoehe());
      const p = new THREE.Vector3();
      if (!zeiger.ray.intersectPlane(ebene, p)) return;
      const ziel: Punkt = [feldAus(p.x - dx(), l.plan.R), feldAus(p.z, l.plan.R)];
      if (!begehbar(l.plan.R, st, ziel)) return;
      if (ziel[0] === l.feld[0] && ziel[1] === l.feld[1]) { ankommen(); return; }
      l.pfad = weg(l.plan.R, st, l.feld, ziel);
    };
    renderer.domElement.addEventListener("pointerdown", klick);

    let id = 0, zuletzt = performance.now();
    const bild = (jetzt: number) => {
      id = requestAnimationFrame(bild);
      const dt = Math.min(0.1, (jetzt - zuletzt) / 1000);
      zuletzt = jetzt;
      const l = lage.current;
      const boden = bodenHoehe();
      // Laufen
      if (l.pfad.length) {
        const [nx, nz] = l.pfad[0];
        const ziel = new THREE.Vector3(dx() + mitte(nx), boden, mitte(nz));
        const rest = ziel.clone().sub(l.pos);
        const schritt = TEMPO * dt;
        if (rest.length() <= schritt) {
          l.pos.copy(ziel);
          l.feld = [nx, nz];
          l.pfad.shift();
          if (!l.pfad.length) ankommen();
        } else {
          l.pos.add(rest.normalize().multiplyScalar(schritt));
          spieler.rotation.y = Math.atan2(rest.x, rest.z);
        }
      }
      l.pos.y += (boden - l.pos.y) * Math.min(1, dt * 8);
      spieler.position.copy(l.pos);
      spieler.position.y += l.pfad.length ? Math.abs(Math.sin(jetzt / 90)) * 0.08 : 0;
      // Die Fackel flackert ein wenig über dem Kopf
      fackel.position.set(l.pos.x, l.pos.y + 3.2, l.pos.z);
      if (fackel.intensity > 0) fackel.intensity = 38 + Math.sin(jetzt / 70) * 2.5 + Math.sin(jetzt / 23) * 1.5;

      // Kamera folgt weich
      blick.lerp(l.pos, Math.min(1, dt * 5));
      const a = winkel();
      kamera.position.set(blick.x + Math.cos(a) * 50, blick.y + 42, blick.z + Math.sin(a) * 50);
      kamera.lookAt(blick);
      const halb = 9.5 / l.zoom;
      kamera.left = -halb * seitenverh; kamera.right = halb * seitenverh;
      kamera.top = halb; kamera.bottom = -halb;
      kamera.updateProjectionMatrix();
      renderer.render(szene, kamera);
    };
    // Startposition ohne Schwenk
    lage.current.pos.set(dx() + mitte(lage.current.feld[0]), bodenHoehe(), mitte(lage.current.feld[1]));
    blick.copy(lage.current.pos);
    id = requestAnimationFrame(bild);

    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("keydown", tasten);
      renderer.domElement.removeEventListener("pointerdown", klick);
      entsorge(szene);
      renderer.dispose();
      el.removeChild(renderer.domElement);
      drei.current = null;
    };
  }, []);

  // ── Licht: hell im Haus, dunkel mit Fackel im Verlies ───────────────────
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    d.himmel.intensity = verlies ? 0.12 : 1.6;
    d.sonne.intensity = verlies ? 0.05 : 1.4;
    d.fackel.intensity = verlies ? 38 : 0;
    d.szene.background = verlies ? new THREE.Color(0x050403) : null;
  }, [verlies]);

  // ── Stockwerke neu bauen, wenn sich etwas ändert ─────────────────────────
  const schluessel = JSON.stringify([stock, zustaende, zielOffen, objekte, stil, art, waechter]);
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    for (const k of [...d.welt.children]) { d.welt.remove(k); entsorge(k); }
    // Verlies: nur die aktuelle Ebene. Haus: auch die darunter (gedämpft).
    // Ebene: alle Abschnitte — die noch nicht erreichten gedämpft.
    const bis = flach ? plan.stockwerke.length - 1 : stock;
    for (let i = verlies ? stock : 0; i <= bis; i++) {
      const g = baueStock(plan, i, {
        zustaende: zustaende[i] ?? [],
        zielOffen: zielOffen[i] ?? false,
        objekte: objekte?.[i],
        stil: stil ?? (verlies ? "verlies" : undefined),
        zielArt: i < plan.stockwerke.length - 1 ? "treppe" : "ausgang",
        unten: flach ? i > stock : i < stock,
        richtung,
        flach,
        waechter: waechter?.[i] ?? false,
      });
      d.welt.add(g);
      if (i === stock) lage.current.hier = g;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, schluessel]);

  // Stockwerk gewechselt: hinauf/hinab → an dessen Anfang; zurück → an dessen Treppe.
  const vorher = useRef(stock);
  useEffect(() => {
    const l = lage.current;
    const st = plan.stockwerke[stock];
    l.feld = stock < vorher.current ? st.ziel : st.start;
    vorher.current = stock;
    l.pfad = [];
    l.pos.x = versatzVon(stock, plan.R, flach) + mitte(l.feld[0]);
    l.pos.z = mitte(l.feld[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, stock]);

  // Auftrag von außen: hinlaufen
  useEffect(() => {
    if (!auftrag) return;
    const l = lage.current;
    const st = plan.stockwerke[stock];
    if (auftrag.ort.art === "zurueck" && stock === 0) return;
    const ziel = feldVon(st, auftrag.ort);
    if (ziel[0] === l.feld[0] && ziel[1] === l.feld[1] && !l.pfad.length) onAnkunft(auftrag.ort);
    else l.pfad = weg(plan.R, st, l.feld, ziel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auftrag?.nr]);

  const knopf = "w-9 h-9 rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] font-bold hover:border-[var(--accent)]";
  return (
    <div className="relative w-full h-full min-h-[320px]">
      <div ref={huelle} className="absolute inset-0" data-gebaeude data-stock={stock} data-art={art} />
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button className={knopf} title="größer" aria-label="größer" onClick={() => setZoom(z => Math.min(3, z * 1.25))}>＋</button>
        <button className={knopf} title="kleiner" aria-label="kleiner" onClick={() => setZoom(z => Math.max(0.4, z / 1.25))}>－</button>
        <button className={knopf} title="links drehen" aria-label="links drehen" onClick={() => setDrehung(d => (d + 3) % 4)}>⟲</button>
        <button className={knopf} title="rechts drehen" aria-label="rechts drehen" onClick={() => setDrehung(d => (d + 1) % 4)}>⟳</button>
      </div>
    </div>
  );
}
