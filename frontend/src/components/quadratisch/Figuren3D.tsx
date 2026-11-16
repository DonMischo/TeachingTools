"use client";
/**
 * Die 3D-Avatare der Plattform als Figuren in einer flachen SVG-Spielszene:
 * ein durchsichtiges WebGL-Bild in einem <foreignObject>, Orthokamera in Metern,
 * damit eine Figur bei (x | y) genau dort steht, wo das SVG den Punkt zeichnet.
 * Ohne WebGL2 meldet `beiBereit(false)` – dann zeichnet das Spiel seine Strichfiguren.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { baueAvatar, type Avatar } from "@/components/gebaeude/avatar";
import { beendeAvatar, bewegeAvatar, tickAvatare, type Bewegung } from "@/components/gebaeude/avatarModell";

/** Abbildung Meter → SVG-Pixel wie im Spiel: Rand MX/MY, sichtbarer Bereich X0…X1, Y0…Y1 */
export type Welt = { W: number; H: number; MX: number; MY: number; X0: number; X1: number; Y0: number; Y1: number };
/** Eine Figur: Füße bei (x | y), `hoehe` in m, blickt nach rechts (1) oder links (−1) */
export type FigurLage = { id: string; avatar: Avatar; x: number; y: number; hoehe: number; blick: 1 | -1; bewegung: Bewegung };

const AVATAR_HOEHE = 1.3;   // baueAvatar: Figur ist ~1,3 hoch
const hatWebGL = () => typeof window !== "undefined" && "WebGL2RenderingContext" in window && !!document.createElement("canvas").getContext("webgl2");

export default function Figuren3D({ welt, figuren, beiBereit }: { welt: Welt; figuren: FigurLage[]; beiBereit: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const lagen = useRef(figuren);
  lagen.current = figuren;
  const bereit = useRef(beiBereit);
  bereit.current = beiBereit;
  const { W, H, MX, MY, X0, X1, Y0, Y1 } = welt;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!hatWebGL()) { bereit.current(false); return; }
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });
    el.appendChild(renderer.domElement);

    // Ränder des ganzen viewBox in Metern
    const mx = (X1 - X0) / (W - 2 * MX), my = (Y1 - Y0) / (H - 2 * MY);
    const kamera = new THREE.OrthographicCamera(X0 - MX * mx, X1 + MX * mx, Y1 + MY * my, Y0 - MY * my, 0.1, 100);
    kamera.position.set(0, 0, 50);
    const szene = new THREE.Scene();
    szene.add(new THREE.HemisphereLight(0xffffff, 0x475569, 2.2));
    const sonne = new THREE.DirectionalLight(0xffffff, 1.4);
    sonne.position.set(-3, 8, 10);
    szene.add(sonne);

    // Meter in x und y sind im SVG verschieden lang: die Hülle staucht x zurück, sonst wirken die Figuren breit
    const quer = mx / my;
    const da = new Map<string, { huelle: THREE.Group; g: THREE.Group; schluessel: string; bewegung: Bewegung }>();
    const schluessel = (a: Avatar) => `${a.klasse}_${a.form}_${a.haut}_${a.tier ?? ""}`;
    bereit.current(true);

    renderer.setAnimationLoop(() => {
      const jetzt = lagen.current;
      for (const f of jetzt) {
        let d = da.get(f.id);
        if (d && d.schluessel !== schluessel(f.avatar)) { szene.remove(d.huelle); beendeAvatar(d.g); da.delete(f.id); d = undefined; }
        if (!d) {
          d = { huelle: new THREE.Group(), g: baueAvatar(f.avatar), schluessel: schluessel(f.avatar), bewegung: f.bewegung };
          d.huelle.scale.set(quer, 1, 1);
          d.huelle.add(d.g);
          bewegeAvatar(d.g, f.bewegung);
          szene.add(d.huelle); da.set(f.id, d);
        }
        if (d.bewegung !== f.bewegung) { bewegeAvatar(d.g, f.bewegung); d.bewegung = f.bewegung; }
        d.g.scale.setScalar(f.hoehe / AVATAR_HOEHE);
        d.huelle.position.set(f.x, f.y, 0);
        d.g.rotation.y = f.blick * (Math.PI / 2 - 0.45);   // halb seitlich: Gesicht bleibt zu sehen
      }
      for (const [id, d] of da) if (!jetzt.some(f => f.id === id)) { szene.remove(d.huelle); beendeAvatar(d.g); da.delete(id); }
      tickAvatare();
      renderer.render(szene, kamera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      for (const d of da.values()) beendeAvatar(d.g);
      szene.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry && !m.geometry.userData.geteilt) m.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [W, H, MX, MY, X0, X1, Y0, Y1]);

  return (
    <foreignObject x={0} y={0} width={W} height={H} style={{ pointerEvents: "none" }}>
      <div ref={ref} style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
    </foreignObject>
  );
}
