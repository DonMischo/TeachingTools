"use client";
/**
 * 3D-Stadt (three.js) mit zwei Arten, sie zu erkunden:
 *   🛩️ Fliegen — W/S vor/zurück, A/D seitwärts, Q/E runter/hoch, Umschalt schneller, Ziehen dreht den Blick
 *   🚶 Laufen  — mit dem eigenen Avatar (wie im TaskCrawler): W/A/S/D, Umschalt rennt, Ziehen dreht die Kamera,
 *               Mausrad zoomt; Häuser, Mauern und Wasser halten auf, Brücken nicht
 * Häuser und Wahrzeichen kommen aus Blender (scripts/stadt/baue.py), Bäume aus den TaskCrawler-Modellen.
 */
import type { GelaendeBilder } from "@/components/gelaende/leinwand";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Gelaende } from "@/lib/gelaende/gelaende";
import type { Haus } from "@/lib/stadt/haeuser";
import type { Stadt } from "@/lib/stadt/modell";
import { zeichneKarte } from "@/lib/stadt/zeichnen";
import { baueAvatar, ladeAvatar } from "@/components/gebaeude/avatar";
import { beendeAvatar, bewegeAvatar, tickAvatare } from "@/components/gebaeude/avatarModell";
import { ladeWeltModelle, weltModelle } from "@/components/gebaeude/frei/modelle";
import { ladeStadtModelle } from "./drei/modelle";
import { baueStadtSzene, type StadtSzene } from "./drei/szene";

type Modus = "flug" | "laufen";
const GEHEN = 1.7, RENNEN = 5;
const TASTEN = new Set(["w", "a", "s", "d", "q", "e", "shift", "arrowup", "arrowdown", "arrowleft", "arrowright"]);

/** Bodenbild: Stadtplan ohne Häuser und Symbole, so fein wie die Grafikkarte erlaubt */
function bodenBild(g: Gelaende, s: Stadt, bild: GelaendeBilder, max: number): HTMLCanvasElement {
  const N = Math.min(4096, max);
  const c = document.createElement("canvas");
  c.width = c.height = N;
  zeichneKarte(c.getContext("2d")!, N, N, { x0: 0, y0: 0, m: N / g.breite }, g, s, { gelaende: bild.land, wasser: bild.wasser, haeuser: [], nurBild: true });
  return c;
}

export default function Stadt3D({ g, stadt, haeuser, bild, mitte }: { g: Gelaende; stadt: Stadt; haeuser: Haus[]; bild: GelaendeBilder; mitte?: { x: number; y: number } | null }) {
  const huelle = useRef<HTMLDivElement>(null);
  const [modus, setModus] = useState<Modus>("flug");
  const [laedt, setLaedt] = useState(true);
  const [ohneWebGL, setOhneWebGL] = useState(false);
  const lage = useRef({
    modus: "flug" as Modus, x: 0, y: 300, z: 600, blick: Math.PI, neigung: -0.45, tasten: new Set<string>(),
    sx: 0, sz: 0, sBlick: Math.PI, kNeigung: 0.35, abstand: 7, aktiv: false,
  });
  const drei = useRef<{ renderer: THREE.WebGLRenderer; szene: THREE.Scene; kamera: THREE.PerspectiveCamera; sonne: THREE.DirectionalLight; spieler: THREE.Group; stadt: StadtSzene | null } | null>(null);

  // ── einmal: Renderer, Licht, Avatar, Eingaben, Schleife ──
  useEffect(() => {
    const el = huelle.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch { setOhneWebGL(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.outline = "none";
    renderer.domElement.style.touchAction = "none";
    el.appendChild(renderer.domElement);
    const szene = new THREE.Scene();
    szene.background = new THREE.Color(0xa9cbe8);
    szene.fog = new THREE.Fog(0xa9cbe8, 600, 3200);
    const kamera = new THREE.PerspectiveCamera(60, 1, 0.3, 9000);
    szene.add(new THREE.HemisphereLight(0xdfeeff, 0x6b5b45, 1.4));
    const sonne = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(2048, 2048);
    sonne.shadow.bias = -0.0005;
    szene.add(sonne, sonne.target);
    const spieler = new THREE.Group();
    const figur = baueAvatar(ladeAvatar());
    const box = new THREE.Box3().setFromObject(figur);
    const h = box.max.y - box.min.y;
    spieler.scale.setScalar(h > 0 ? 1.75 / h : 1);
    spieler.add(figur);
    spieler.traverse(o => { o.castShadow = true; });
    spieler.visible = false;
    szene.add(spieler);
    drei.current = { renderer, szene, kamera, sonne, spieler, stadt: null };

    const groesse = () => {
      const w = el.clientWidth, hh = el.clientHeight;
      renderer.setSize(w, hh);
      kamera.aspect = w / Math.max(1, hh);
      kamera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(groesse);
    ro.observe(el);
    groesse();

    // Eingaben: nur, wenn die Szene den Fokus hat
    const runter = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      if (!lage.current.aktiv || !TASTEN.has(k)) return;
      ev.preventDefault();
      lage.current.tasten.add(k);
    };
    const hoch = (ev: KeyboardEvent) => lage.current.tasten.delete(ev.key.toLowerCase());
    const fokus = () => { lage.current.aktiv = true; };
    const weg = () => { lage.current.aktiv = false; lage.current.tasten.clear(); };
    let griff: { x: number; y: number } | null = null;
    const druck = (ev: PointerEvent) => { renderer.domElement.focus(); griff = { x: ev.clientX, y: ev.clientY }; renderer.domElement.setPointerCapture(ev.pointerId); };
    const zug = (ev: PointerEvent) => {
      if (!griff) return;
      const l = lage.current, dx = ev.clientX - griff.x, dy = ev.clientY - griff.y;
      griff = { x: ev.clientX, y: ev.clientY };
      if (l.modus === "flug") { l.blick -= dx * 0.005; l.neigung = Math.max(-1.4, Math.min(0.6, l.neigung - dy * 0.004)); }
      else { l.sBlick -= dx * 0.006; l.kNeigung = Math.max(0.02, Math.min(1.2, l.kNeigung + dy * 0.004)); }
    };
    const los = () => { griff = null; };
    const rad = (ev: WheelEvent) => {
      const l = lage.current;
      if (l.modus !== "laufen") return;
      ev.preventDefault();
      l.abstand = Math.max(2.5, Math.min(25, l.abstand * (ev.deltaY > 0 ? 1.12 : 0.89)));
    };
    const c = renderer.domElement;
    c.addEventListener("keydown", runter);
    c.addEventListener("keyup", hoch);
    c.addEventListener("focus", fokus);
    c.addEventListener("blur", weg);
    c.addEventListener("pointerdown", druck);
    c.addEventListener("pointermove", zug);
    c.addEventListener("pointerup", los);
    c.addEventListener("pointercancel", los);
    c.addEventListener("wheel", rad, { passive: false });

    const vor = new THREE.Vector3(), rechts = new THREE.Vector3(), ziel = new THREE.Vector3(), licht = new THREE.Vector3(-0.5, 0.8, -0.35).normalize();
    let id = 0, zuletzt = performance.now();
    const bild = (jetzt: number) => {
      id = requestAnimationFrame(bild);
      const dt = Math.min(0.1, (jetzt - zuletzt) / 1000);
      zuletzt = jetzt;
      tickAvatare();
      const l = lage.current, d = drei.current, st = d?.stadt;
      if (!d) return;
      const t = l.tasten, schnell = t.has("shift");
      const vw = (t.has("w") || t.has("arrowup") ? 1 : 0) - (t.has("s") || t.has("arrowdown") ? 1 : 0);
      const sw = (t.has("d") || t.has("arrowright") ? 1 : 0) - (t.has("a") || t.has("arrowleft") ? 1 : 0);
      if (l.modus === "flug") {
        const boden = st ? st.boden(l.x, l.z) : 0;
        const tempo = Math.max(25, (l.y - boden) * 1.2) * (schnell ? 3 : 1);
        vor.set(Math.sin(l.blick) * Math.cos(l.neigung), Math.sin(l.neigung), Math.cos(l.blick) * Math.cos(l.neigung));
        rechts.set(-Math.cos(l.blick), 0, Math.sin(l.blick));
        l.x += (vor.x * vw + rechts.x * sw) * tempo * dt;
        l.z += (vor.z * vw + rechts.z * sw) * tempo * dt;
        l.y += (vor.y * vw + ((t.has("e") ? 1 : 0) - (t.has("q") ? 1 : 0))) * tempo * dt;
        const g2 = g.breite / 2;
        l.x = Math.max(-g2, Math.min(g2, l.x)); l.z = Math.max(-g2, Math.min(g2, l.z));
        l.y = Math.max((st ? st.boden(l.x, l.z) : 0) + 3, Math.min(3000, l.y));
        kamera.position.set(l.x, l.y, l.z);
        kamera.lookAt(l.x + vor.x, l.y + vor.y, l.z + vor.z);
        ziel.set(l.x + vor.x * 300, (st ? st.boden(l.x, l.z) : 0), l.z + vor.z * 300);
      } else if (st) {
        let laeuft = false;
        if (vw || sw) {
          const w = l.sBlick + Math.atan2(-sw, vw);
          const tempo = (schnell ? RENNEN : GEHEN) * (vw < 0 && !sw ? 0.6 : 1);
          const nx = l.sx + Math.sin(w) * tempo * dt, nz = l.sz + Math.cos(w) * tempo * dt;
          if (st.frei(nx, nz)) { l.sx = nx; l.sz = nz; laeuft = true; }
          else if (st.frei(nx, l.sz)) { l.sx = nx; laeuft = true; }
          else if (st.frei(l.sx, nz)) { l.sz = nz; laeuft = true; }
          let diff = w - d.spieler.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          d.spieler.rotation.y += diff * Math.min(1, dt * 12);
        }
        const by = st.boden(l.sx, l.sz);
        d.spieler.position.set(l.sx, by, l.sz);
        const f = d.spieler.children[0];
        if (f) bewegeAvatar(f, laeuft ? (schnell ? "rennen" : "lauf") : "idle");
        const kx = l.sx - Math.sin(l.sBlick) * Math.cos(l.kNeigung) * l.abstand, kz = l.sz - Math.cos(l.sBlick) * Math.cos(l.kNeigung) * l.abstand;
        const ky = Math.max(st.boden(kx, kz) + 0.6, by + 1.5 + Math.sin(l.kNeigung) * l.abstand);
        kamera.position.lerp(new THREE.Vector3(kx, ky, kz), Math.min(1, dt * 10));
        kamera.lookAt(l.sx, by + 1.5, l.sz);
        ziel.set(l.sx, by, l.sz);
      }
      // Schatten folgen dem Blick: fein beim Laufen, grob beim Fliegen
      const r = l.modus === "laufen" ? 90 : Math.min(900, Math.max(200, (l.y - ziel.y) * 1.5));
      const sc = d.sonne.shadow.camera;
      if (sc.right !== r) { sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.far = 4000; sc.updateProjectionMatrix(); }
      d.sonne.target.position.copy(ziel);
      d.sonne.position.copy(ziel).addScaledVector(licht, 1500);
      renderer.render(szene, kamera);
    };
    id = requestAnimationFrame(bild);

    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      c.removeEventListener("keydown", runter);
      c.removeEventListener("keyup", hoch);
      c.removeEventListener("focus", fokus);
      c.removeEventListener("blur", weg);
      c.removeEventListener("wheel", rad);
      beendeAvatar(figur);
      drei.current?.stadt?.entsorge();
      drei.current = null;
      renderer.dispose();
      el.removeChild(c);
    };
  }, [g.breite]);

  // ── Stadt bauen, sobald Modelle und Bodenbild da sind ──
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    let ab = false;
    setLaedt(true);
    Promise.all([ladeStadtModelle(), ladeWeltModelle()]).then(([teile]) => {
      if (ab || !drei.current) return;
      const boden = bodenBild(g, stadt, bild, d.renderer.capabilities.maxTextureSize);
      const neu = baueStadtSzene(g, stadt, haeuser, boden, teile, weltModelle(), g.wahl.seed);
      if (d.stadt) { d.szene.remove(d.stadt.gruppe); d.stadt.entsorge(); }
      d.stadt = neu;
      d.szene.add(neu.gruppe);
      setLaedt(false);
    });
    return () => { ab = true; };
  }, [g, stadt, haeuser, bild]);

  // ── Startpunkt: schräg über der Stadtmitte ──
  const mx = mitte?.x ?? g.breite / 2, my = mitte?.y ?? g.breite / 2;
  useEffect(() => {
    const l = lage.current, h2 = g.breite / 2;
    l.x = mx - h2; l.z = my - h2 + 700; l.y = 420; l.blick = Math.PI; l.neigung = -0.5;
  }, [mx, my, g.breite]);

  const wechsle = (m: Modus) => {
    const l = lage.current, d = drei.current, st = d?.stadt;
    l.modus = m;
    setModus(m);
    if (d) d.spieler.visible = m === "laufen";
    if (m === "laufen" && st) {
      // dort landen, wohin die Kamera schaut, auf dem nächsten freien Fleck
      const k = d!.kamera, dir = new THREE.Vector3();
      k.getWorldDirection(dir);
      const tt = dir.y < -0.05 ? Math.min(2000, (k.position.y - st.boden(k.position.x, k.position.z)) / -dir.y) : 200;
      let x = k.position.x + dir.x * tt, z = k.position.z + dir.z * tt;
      outer: for (let r = 0; r < 400; r += 4) for (let a = 0; a < 16; a++) {
        const px = x + Math.cos(a / 16 * Math.PI * 2) * r, pz = z + Math.sin(a / 16 * Math.PI * 2) * r;
        if (st.frei(px, pz)) { x = px; z = pz; break outer; }
      }
      l.sx = x; l.sz = z; l.sBlick = Math.atan2(dir.x, dir.z);
      d!.kamera.position.set(x - Math.sin(l.sBlick) * 8, st.boden(x, z) + 4, z - Math.cos(l.sBlick) * 8);
    }
    if (m === "flug" && d) { l.x = d.kamera.position.x; l.z = d.kamera.position.z; l.y = d.kamera.position.y + 60; l.neigung = -0.4; }
    d?.renderer.domElement.focus();
  };

  if (ohneWebGL) return <div className="flex h-[600px] items-center justify-center rounded-xl border border-line text-muted">3D braucht WebGL — dein Browser bietet es gerade nicht an.</div>;
  return (
    <div className="relative h-[600px] overflow-hidden rounded-xl border border-line bg-[#a9cbe8]">
      <div ref={huelle} className="absolute inset-0" />
      <div className="absolute left-2 top-2 flex gap-1.5">
        <button className={modus === "flug" ? "btn-primary py-1" : "btn-secondary py-1"} onClick={() => wechsle("flug")}>🛩️ Fliegen</button>
        <button className={modus === "laufen" ? "btn-primary py-1" : "btn-secondary py-1"} onClick={() => wechsle("laufen")}>🚶 Laufen</button>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-black/45 px-2 py-1 text-xs text-white">
        {modus === "flug" ? "Klick in die Szene · W/S vor/zurück · A/D seitwärts · Q/E runter/hoch · Umschalt schnell · Ziehen dreht" : "Klick in die Szene · W/A/S/D laufen · Umschalt rennt · Ziehen dreht die Kamera · Mausrad zoomt"}
      </div>
      {laedt && <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow">⏳ Stadt wird gebaut …</div>}
    </div>
  );
}
