"use client";
/**
 * Das ganze Haus auf einmal, wie die Bilder aus MarkovJunior: alle
 * Stockwerke übereinander mit Treppen und Stützen, auf einem Sockel (beim
 * Gartenpalast: Wasser). Dreht sich langsam; Ziehen dreht von Hand,
 * Mausrad bzw. Knöpfe zoomen.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Plan } from "@/lib/gebaeude/plan";
import type { Objekt } from "@/lib/gebaeude/objekte";
import { STILE, STOCK_H, abschnittBreite, baueStock, entsorge, welt, type RaumZustand, type Stil } from "./szene";
import type { GebaeudeArt } from "./Gebaeude";

interface Props {
  plan: Plan;
  stil: Stil;
  zustaende?: RaumZustand[][];
  objekte?: Objekt[][];
  /** haus (nach oben), verlies (nach unten) oder ebene (nebeneinander) */
  art?: GebaeudeArt;
  waechter?: boolean[];
}

export default function HausModell({ plan, stil, zustaende, objekte, art = "haus", waechter }: Props) {
  const verlies = art === "verlies", flach = art === "ebene";
  const huelle = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const lage = useRef({ zoom, winkel: Math.PI / 4, dreht: true, ziehen: null as null | { x: number; w: number } });
  lage.current.zoom = zoom;
  const drei = useRef<{ welt: THREE.Group; mitte: THREE.Vector3; groesse: number } | null>(null);

  useEffect(() => {
    const el = huelle.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    const szene = new THREE.Scene();
    szene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.5));
    const sonne = new THREE.DirectionalLight(0xffffff, 1.5);
    sonne.position.set(-8, 20, 6);
    szene.add(sonne);
    const weltG = new THREE.Group();
    szene.add(weltG);
    drei.current = { welt: weltG, mitte: new THREE.Vector3(), groesse: 10 };

    const kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
    let seitenverh = 1;
    const groesse = () => {
      const b = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(b, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      seitenverh = b / h;
    };
    groesse();
    const ro = new ResizeObserver(groesse);
    ro.observe(el);

    const runter = (e: PointerEvent) => {
      lage.current.ziehen = { x: e.clientX, w: lage.current.winkel };
      lage.current.dreht = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const bewegen = (e: PointerEvent) => {
      const z = lage.current.ziehen;
      if (z) lage.current.winkel = z.w - (e.clientX - z.x) * 0.01;
    };
    const hoch = () => { lage.current.ziehen = null; };
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.min(4, Math.max(0.4, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
    };
    renderer.domElement.addEventListener("pointerdown", runter);
    renderer.domElement.addEventListener("pointermove", bewegen);
    renderer.domElement.addEventListener("pointerup", hoch);
    renderer.domElement.addEventListener("wheel", rad, { passive: false });

    let id = 0, zuletzt = performance.now();
    const bild = (jetzt: number) => {
      id = requestAnimationFrame(bild);
      const dt = Math.min(0.1, (jetzt - zuletzt) / 1000);
      zuletzt = jetzt;
      const l = lage.current, d = drei.current!;
      if (l.dreht) l.winkel += dt * 0.25;
      const m = d.mitte;
      kamera.position.set(m.x + Math.cos(l.winkel) * 80, m.y + 60, m.z + Math.sin(l.winkel) * 80);
      kamera.lookAt(m);
      const halb = (d.groesse * 0.62) / l.zoom;
      kamera.left = -halb * seitenverh; kamera.right = halb * seitenverh;
      kamera.top = halb; kamera.bottom = -halb;
      kamera.updateProjectionMatrix();
      renderer.render(szene, kamera);
    };
    id = requestAnimationFrame(bild);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", runter);
      renderer.domElement.removeEventListener("pointermove", bewegen);
      renderer.domElement.removeEventListener("pointerup", hoch);
      renderer.domElement.removeEventListener("wheel", rad);
      entsorge(szene);
      renderer.dispose();
      el.removeChild(renderer.domElement);
      drei.current = null;
    };
  }, []);

  // Haus (neu) bauen
  const schluessel = JSON.stringify([stil, zustaende, objekte, art, waechter]);
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    for (const k of [...d.welt.children]) { d.welt.remove(k); entsorge(k); }
    const n = plan.stockwerke.length;
    plan.stockwerke.forEach((st, i) => {
      d.welt.add(baueStock(plan, i, {
        zustaende: zustaende?.[i] ?? st.raeume.map(() => "offen"),
        zielOffen: true,
        zielArt: i < n - 1 ? "treppe" : "ausgang",
        objekte: objekte?.[i],
        unten: false,
        stil,
        ganz: true,
        richtung: verlies ? -1 : 1,
        flach,
        waechter: waechter?.[i] ?? false,
      }));
    });
    // Sockel unter dem Haus — im Verlies unter der tiefsten Ebene, bei der Ebene unter allen Abschnitten.
    const breite = welt(plan.R - 1) + 1.5;
    const lang = flach ? n * abschnittBreite(plan.R) + 1.5 : breite;
    const sockel = new THREE.Mesh(new THREE.BoxGeometry(lang + 4, 0.6, breite + 4),
      new THREE.MeshLambertMaterial({ color: STILE[stil].sockel }));
    const unten = verlies ? -(n - 1) * STOCK_H : 0;
    sockel.position.set(lang / 2 - 0.75, unten - 0.35, breite / 2 - 0.75);
    d.welt.add(sockel);
    d.mitte.set(lang / 2, flach ? STOCK_H / 3 : verlies ? unten / 2 + STOCK_H / 2 : (n * STOCK_H) / 2, breite / 2);
    d.groesse = Math.max(lang * (flach ? 0.75 : 1.1), flach ? 0 : n * STOCK_H * 1.6);
    lage.current.dreht = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, schluessel]);

  const knopf = "w-9 h-9 rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] font-bold hover:border-[var(--accent)]";
  return (
    <div className="relative w-full h-full min-h-[320px]">
      <div ref={huelle} className="absolute inset-0 cursor-grab active:cursor-grabbing" data-hausmodell data-stil={stil} />
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button className={knopf} aria-label="größer" onClick={() => setZoom(z => Math.min(4, z * 1.25))}>＋</button>
        <button className={knopf} aria-label="kleiner" onClick={() => setZoom(z => Math.max(0.4, z / 1.25))}>－</button>
        <button className={knopf} aria-label="drehen an/aus" title="drehen an/aus"
          onClick={() => { lage.current.dreht = !lage.current.dreht; }}>⟳</button>
      </div>
    </div>
  );
}
