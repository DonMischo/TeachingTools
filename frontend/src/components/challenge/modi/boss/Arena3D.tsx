"use client";
/**
 * 3D-Kampfarena für den Bosskampf: Avatar (unten links) gegen 3D-Boss (oben rechts) im Pokémon-Blickwinkel.
 * Treffer des Helden lösen dessen Element aus, Fehlversuche den Gegenzug des Bosses; ein besiegter Boss zerfällt.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { baueAvatar, ladeAvatar, type Klasse } from "@/components/gebaeude/avatar";
import { effektWelt, Figur, type EffektWelt, type ElementId } from "@/lib/angriffe/effekte";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import { baueBoss } from "./bosse3d";
import { SKIN_BOSS } from "@/lib/angriffe/monster";
import { ladeMonster, tickMonster, type MonsterFigur } from "@/lib/angriffe/monsterLader";
import type { Anim } from "./Szene";

/** Ob der Browser WebGL 2 kann (jsdom und alte Geräte nicht: dann bleibt die Pixel-Bühne) */
export const webglDa = () => typeof window !== "undefined" && "WebGL2RenderingContext" in window;

const DUNKEL = new THREE.Color(0x0b1220);
/** Themenfarbe abgedunkelt, damit die leuchtenden Effekte wirken; CSS-Verläufe/transparent nehmen den Standard */
const farbe = (css: string | undefined, standard: number, dunkel: number) =>
  (css && /^#[0-9a-f]{3,8}$/i.test(css) ? new THREE.Color(css) : new THREE.Color(standard)).lerp(DUNKEL, dunkel);

/** Die Klasse des Avatars bestimmt das Element des Helden; Normal und Tiere nehmen das des Skins */
const KLASSEN_ELEMENT: Partial<Record<Klasse, ElementId>> = { krieger: "klingen", magier: "arkan", priester: "licht", rapper: "schall", rocker: "schall" };

const HELD_POS = new THREE.Vector3(-2.2, 0, 1.6), BOSS_POS = new THREE.Vector3(2.3, 0, -2.0);

export default function Arena3D({ skin, himmel, boden, gegnerAnim, heldElement, bossElement, weg }: {
  skin: string; himmel?: string; boden?: string; gegnerAnim?: Anim; /** Element des Skins (wenn die Avatar-Klasse keins mitbringt) */ heldElement: ElementId; bossElement: ElementId; /** Boss besiegt */ weg: boolean;
}) {
  const huelle = useRef<HTMLDivElement>(null);
  const drei = useRef<{ welt: EffektWelt; held: Figur; boss: Figur; klassenElement?: ElementId; monster?: MonsterFigur } | null>(null);
  const elemente = useRef({ heldElement, bossElement });
  elemente.current = { heldElement, bossElement };

  useEffect(() => {
    const el = huelle.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * 1.5);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    el.appendChild(renderer.domElement);

    const szene = new THREE.Scene();
    const hintergrund = farbe(himmel, 0x6a8fc0, 0.7);
    szene.background = hintergrund.clone();
    szene.fog = new THREE.Fog(hintergrund, 14, 30);
    const licht = new THREE.HemisphereLight(0xbfd8ff, 0x203048, 1.8);
    const sonne = new THREE.DirectionalLight(0xffffff, 1.5);
    sonne.position.set(-3, 8, 5);
    szene.add(licht, sonne);
    const bodenFarbe = farbe(boden, 0x4a6a3a, 0.55);
    const grund = new THREE.Mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: bodenFarbe }));
    szene.add(grund);
    for (const p of [HELD_POS, BOSS_POS]) { // Kampfplattformen wie im Original
      const platte = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: bodenFarbe.clone().offsetHSL(0, 0, 0.08) }));
      platte.position.set(p.x, 0.003, p.z);
      szene.add(platte);
    }

    const welt = effektWelt(szene, renderer);
    const held = new Figur(), boss = new Figur();
    const wahl = ladeAvatar(), avatar = baueAvatar(wahl);
    avatar.scale.setScalar(1.4);
    held.setzeModell(avatar, 1.8);
    avatar.userData.beiModell = () => held.setzeModell(avatar, 1.8); // neue Figur geladen: Materialien neu einsammeln
    const b = baueBoss(skin); // Platzhalter, bis das Monster-Modell geladen ist (und Rückfall ohne Netz)
    boss.setzeModell(b.modell, b.hoehe);
    let abgebaut = false;
    ladeMonster(SKIN_BOSS[skin] ?? "dragon_evolved", 2.7).then((m) => {
      if (abgebaut) { m.dispose(); return; }
      boss.setzeModell(m.modell, m.hoehe);
      if (drei.current) drei.current.monster = m;
    }).catch(() => { /* bleibt beim gebauten Boss */ });
    held.basis.copy(HELD_POS); boss.basis.copy(BOSS_POS);
    held.blick = Math.atan2(BOSS_POS.x - HELD_POS.x, BOSS_POS.z - HELD_POS.z);
    boss.blick = Math.atan2(HELD_POS.x - BOSS_POS.x, HELD_POS.z - BOSS_POS.z);
    szene.add(held.gruppe, boss.gruppe);
    drei.current = { welt, held, boss, klassenElement: wahl.tier ? undefined : KLASSEN_ELEMENT[wahl.klasse] };

    const kamera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 80);
    const KAMERA = new THREE.Vector3(-4.6, 3.8, 9.2), BLICK = new THREE.Vector3(0.5, 1.0, -1.2);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(szene, kamera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(480, 270), 0.55, 0.4, 0.9));
    composer.addPass(new OutputPass());
    const groesse = () => {
      const w = el.clientWidth || 480, h = el.clientHeight || 270;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      kamera.aspect = w / h;
      kamera.updateProjectionMatrix();
      welt.setzeSkala((h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(kamera.fov) / 2)));
    };
    groesse();
    const ro = new ResizeObserver(groesse);
    ro.observe(el);

    const ruhig = wenigerBewegung();
    const uhr = new THREE.Clock();
    const bild = (dt: number) => {
      welt.update(dt);
      tickMonster(dt);
      held.update(dt); boss.update(dt);
      const d = welt.dunkel;
      licht.intensity = 1.8 * (1 - 0.65 * d);
      sonne.intensity = 1.5 * (1 - 0.65 * d);
      (szene.background as THREE.Color).copy(hintergrund).multiplyScalar(1 - 0.6 * d);
      const w = ruhig ? 0 : welt.wackel ** 2 * 0.5;
      kamera.position.copy(KAMERA).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(w * 2));
      kamera.lookAt(BLICK);
      composer.render();
    };
    renderer.setAnimationLoop(() => bild(Math.min(uhr.getDelta(), 0.05)));

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      abgebaut = true;
      drei.current?.monster?.dispose();
      drei.current = null;
      welt.dispose();
      szene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        if (m.material) for (const x of ([] as THREE.Material[]).concat(m.material)) x.dispose();
      });
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [skin, himmel, boden]);

  // Treffer des Helden → sein Element; Fehlversuch → Gegenzug des Bosses
  useEffect(() => {
    const d = drei.current;
    if (!d || !gegnerAnim || gegnerAnim.n < 0) return;
    if (gegnerAnim.art === "treffer") {
      d.welt.angriff(d.klassenElement ?? elemente.current.heldElement, d.held, d.boss);
      const t = setTimeout(() => d.monster?.spiele("treffer"), 700); // wenn der Angriff ankommt
      return () => clearTimeout(t);
    }
    if (gegnerAnim.art === "wackel") {
      d.monster?.spiele("angriff");
      d.welt.angriff(elemente.current.bossElement, d.boss, d.held);
    }
  }, [gegnerAnim]);

  // Besiegt: erst den letzten Treffer ausspielen, dann zerfallen; neue Etappe: Boss steht wieder da
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    if (!weg) { d.boss.basis.copy(BOSS_POS); d.boss.gruppe.visible = true; d.monster?.spiele("idle"); return; }
    const tod = setTimeout(() => d.monster?.spiele("tod"), 1400);
    const t = setTimeout(() => d.welt.zerfall(d.boss), d.monster ? 3200 : 2200);
    return () => { clearTimeout(tod); clearTimeout(t); };
  }, [weg]);

  return <div ref={huelle} className="absolute inset-0" aria-hidden />;
}
