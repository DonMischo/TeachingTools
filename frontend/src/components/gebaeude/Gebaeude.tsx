"use client";
/**
 * Isometrisches Gebäude (three.js, orthografische Kamera). Die Figur läuft
 * per Klick/Tippen (Wegsuche) oder mit Pfeiltasten/WASD; kommt sie in einem
 * Zimmer oder an der Treppe an, meldet `onAnkunft` den Ort.
 *
 * Kennt keine Inhalte: Wer das Gebäude benutzt (Exitgame, Regel-Labor,
 * später Verkehr/Rock your Life), gibt Plan, Zustände und Stockwerk vor und
 * entscheidet selbst, was bei der Ankunft passiert.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { begehbar, weg, type Plan, type Punkt } from "@/lib/gebaeude/plan";
import { STOCK_H, baueStock, entsorge, figur, type RaumZustand } from "./szene";

export type Ort = { art: "raum"; raum: number } | { art: "ziel" };

interface Props {
  plan: Plan;
  stock: number;
  /** je Stockwerk die Zustände seiner Zimmer */
  zustaende: RaumZustand[][];
  /** je Stockwerk: Treppe/Ausgang schon offen? */
  zielOffen: boolean[];
  /** Tastatur an (aus, solange z. B. ein Aufgabenfenster offen ist) */
  aktiv: boolean;
  /** von außen: dorthin laufen (neue `nr` = neuer Auftrag) */
  auftrag?: { ort: Ort; nr: number } | null;
  onAnkunft: (ort: Ort) => void;
}

const TEMPO = 7; // Felder pro Sekunde
const TASTEN: Record<string, number> = {
  ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3,
};

export default function Gebaeude({ plan, stock, zustaende, zielOffen, aktiv, auftrag, onAnkunft }: Props) {
  const huelle = useRef<HTMLDivElement>(null);
  const [drehung, setDrehung] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Alles, was die Zeichenschleife liest, steht in einem Ref.
  const lage = useRef({
    plan, stock, drehung, zoom, aktiv, onAnkunft,
    feld: plan.stockwerke[stock].start as Punkt,
    pos: new THREE.Vector3(),
    pfad: [] as Punkt[],
  });
  Object.assign(lage.current, { plan, stock, drehung, zoom, aktiv, onAnkunft });

  const drei = useRef<{ szene: THREE.Scene; welt: THREE.Group; spieler: THREE.Group } | null>(null);

  // ── einmalig: Renderer, Kamera, Licht, Schleife ─────────────────────────
  useEffect(() => {
    const el = huelle.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const szene = new THREE.Scene();
    szene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const sonne = new THREE.DirectionalLight(0xffffff, 1.4);
    sonne.position.set(-6, 14, 4);
    szene.add(sonne);
    const welt = new THREE.Group();
    const spieler = figur(0xe11d48);
    szene.add(welt, spieler);
    drei.current = { szene, welt, spieler };

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

    const ankommen = () => {
      const l = lage.current;
      const st = l.plan.stockwerke[l.stock];
      const [x, y] = l.feld;
      if (x === st.ziel[0] && y === st.ziel[1]) l.onAnkunft({ art: "ziel" });
      const k = st.raeume.findIndex(r => r.x === x && r.y === y);
      if (k >= 0) l.onAnkunft({ art: "raum", raum: k });
    };

    const tasten = (e: KeyboardEvent) => {
      const l = lage.current;
      const t = e.target as HTMLElement;
      if (!l.aktiv || t.closest("input, textarea, select, [contenteditable]")) return;
      const r = TASTEN[e.key];
      if (r === undefined) return;
      e.preventDefault();
      if (l.pfad.length) return;
      // Bildschirmrichtung → nächste Rasterrichtung
      const a = winkel() + Math.PI + Math.PI / 4 - (r * Math.PI) / 2;
      const dx = Math.round(Math.cos(a)), dz = Math.round(Math.sin(a));
      const [x, y] = l.feld;
      const [nx, ny] = Math.abs(dx) >= Math.abs(dz) ? [x + Math.sign(dx), y] : [x, y + Math.sign(dz)];
      if (begehbar(l.plan.R, l.plan.stockwerke[l.stock], [nx, ny])) l.pfad = [[nx, ny]];
    };
    window.addEventListener("keydown", tasten);

    const zeiger = new THREE.Raycaster();
    const klick = (e: PointerEvent) => {
      const l = lage.current;
      const r = renderer.domElement.getBoundingClientRect();
      zeiger.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), kamera);
      const ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(l.stock * STOCK_H + 0.25));
      const p = new THREE.Vector3();
      if (!zeiger.ray.intersectPlane(ebene, p)) return;
      const ziel: Punkt = [Math.round(p.x), Math.round(p.z)];
      const st = l.plan.stockwerke[l.stock];
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
      const boden = l.stock * STOCK_H + 0.25;
      // Laufen
      if (l.pfad.length) {
        const [nx, nz] = l.pfad[0];
        const ziel = new THREE.Vector3(nx, boden, nz);
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

      // Kamera folgt weich
      blick.lerp(l.pos, Math.min(1, dt * 5));
      const a = winkel();
      kamera.position.set(blick.x + Math.cos(a) * 50, blick.y + 42, blick.z + Math.sin(a) * 50);
      kamera.lookAt(blick);
      const halb = 7.5 / l.zoom;
      kamera.left = -halb * seitenverh; kamera.right = halb * seitenverh;
      kamera.top = halb; kamera.bottom = -halb;
      kamera.updateProjectionMatrix();
      renderer.render(szene, kamera);
    };
    // Startposition ohne Schwenk
    lage.current.pos.set(lage.current.feld[0], lage.current.stock * STOCK_H + 0.25, lage.current.feld[1]);
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

  // ── Stockwerke neu bauen, wenn sich etwas ändert ─────────────────────────
  const schluessel = JSON.stringify([stock, zustaende, zielOffen]);
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    for (const k of [...d.welt.children]) { d.welt.remove(k); entsorge(k); }
    for (let i = 0; i <= stock; i++) {
      d.welt.add(baueStock(plan, i, {
        zustaende: zustaende[i] ?? [],
        zielOffen: zielOffen[i] ?? false,
        zielArt: i < plan.stockwerke.length - 1 ? "treppe" : "ausgang",
        unten: i < stock,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, schluessel]);

  // Neues Stockwerk (oder neues Haus): Figur an dessen Anfang
  useEffect(() => {
    const l = lage.current;
    l.feld = plan.stockwerke[stock].start;
    l.pfad = [];
    l.pos.x = l.feld[0];
    l.pos.z = l.feld[1];
  }, [plan, stock]);

  // Auftrag von außen: hinlaufen
  useEffect(() => {
    if (!auftrag) return;
    const l = lage.current;
    const st = plan.stockwerke[stock];
    const ziel: Punkt = auftrag.ort.art === "ziel" ? st.ziel : [st.raeume[auftrag.ort.raum].x, st.raeume[auftrag.ort.raum].y];
    if (ziel[0] === l.feld[0] && ziel[1] === l.feld[1] && !l.pfad.length) onAnkunft(auftrag.ort);
    else l.pfad = weg(plan.R, st, l.feld, ziel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auftrag?.nr]);

  const knopf = "w-9 h-9 rounded-lg bg-[var(--surface)]/90 border border-[var(--border)] font-bold hover:border-[var(--accent)]";
  return (
    <div className="relative w-full h-full min-h-[320px]">
      <div ref={huelle} className="absolute inset-0" data-gebaeude data-stock={stock} />
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button className={knopf} title="größer" aria-label="größer" onClick={() => setZoom(z => Math.min(3, z * 1.25))}>＋</button>
        <button className={knopf} title="kleiner" aria-label="kleiner" onClick={() => setZoom(z => Math.max(0.4, z / 1.25))}>－</button>
        <button className={knopf} title="links drehen" aria-label="links drehen" onClick={() => setDrehung(d => (d + 3) % 4)}>⟲</button>
        <button className={knopf} title="rechts drehen" aria-label="rechts drehen" onClick={() => setDrehung(d => (d + 1) % 4)}>⟳</button>
      </div>
    </div>
  );
}
