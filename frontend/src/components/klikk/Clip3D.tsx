"use client";
/**
 * Ein »Video« im Klikk-Feed: die animierten Avatare der Plattform tanzen,
 * zaubern (Elementar-Angriffe aus dem Bosskampf) oder Monster zappeln.
 * Der Feed zeigt immer nur einen Beitrag — es läuft also höchstens eine Szene.
 * Ohne WebGL2 (jsdom, alte Geräte) bleibt ein Emoji-Standbild.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { baueAvatar, ladeAvatar, type Avatar, type Klasse } from "@/components/gebaeude/avatar";
import { beendeAvatar, bewegeAvatar, tickAvatare, type Bewegung } from "@/components/gebaeude/avatarModell";
import { effektWelt, Figur, type ElementId } from "@/lib/angriffe/effekte";
import { ladeMonster, tickMonster, type MonsterFigur } from "@/lib/angriffe/monsterLader";
import type { MonsterId } from "@/lib/angriffe/monster";
import type { Clip, Figur as FigurDef } from "@/lib/klikk/posts";

const TANZ: Bewegung[] = ["jubel", "lauf", "angriff", "jubel", "rennen", "treffer", "jubel"];

function avatarVon(f: FigurDef): Avatar {
  if (f === "ich") return ladeAvatar();
  return { klasse: f.klasse as Klasse, form: f.form, haut: f.haut ?? 0, tier: f.tier };
}

export const hatWebGL = () => typeof window !== "undefined" && "WebGL2RenderingContext" in window && !!document.createElement("canvas").getContext("webgl2");

export default function Clip3D({ clip, ersatz }: { clip: Clip; ersatz: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ohne, setOhne] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!hatWebGL()) { setOhne(true); return; }
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const szene = new THREE.Scene();
    const farbe = new THREE.Color(clip.hintergrund);
    szene.background = farbe;
    szene.fog = new THREE.Fog(farbe, 8, 20);
    szene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2));
    const sonne = new THREE.DirectionalLight(0xffffff, 1.6);
    sonne.position.set(-3, 6, 5);
    szene.add(sonne);
    const boden = new THREE.Mesh(new THREE.CircleGeometry(6, 48).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: farbe.clone().offsetHSL(0, 0, 0.12) }));
    szene.add(boden);

    const kamera = new THREE.PerspectiveCamera(38, 9 / 16, 0.1, 50);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(szene, kamera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(270, 480), 0.6, 0.4, 0.85));
    composer.addPass(new OutputPass());

    const groesse = () => {
      const w = el.clientWidth || 270, h = el.clientHeight || 400;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      kamera.aspect = w / h;
      kamera.updateProjectionMatrix();
      welt?.setzeSkala((h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(kamera.fov) / 2)));
    };

    let welt: ReturnType<typeof effektWelt> | null = null;
    let avatar: THREE.Group | null = null;
    let monster: MonsterFigur | null = null;
    let held: Figur | null = null, gegner: Figur | null = null;
    let abgebaut = false;
    let takt = 0, schritt = 0, zeit = 0;
    const blick = new THREE.Vector3(0, 1, 0);

    if (clip.art === "tanz" || clip.art === "zauber") {
      avatar = baueAvatar(avatarVon(clip.figur));
      avatar.scale.setScalar(1.3);
    }
    if (clip.art === "tanz") {
      szene.add(avatar!);
      bewegeAvatar(avatar!, "jubel");
    } else if (clip.art === "zauber") {
      welt = effektWelt(szene, renderer);
      held = new Figur(); gegner = new Figur();
      held.setzeModell(avatar!, 1.7);
      avatar!.userData.beiModell = () => held!.setzeModell(avatar!, 1.7);
      // Hochformat: hintereinander statt nebeneinander, sonst sind beide halb abgeschnitten
      held.basis.set(-0.7, 0, 1.4); gegner.basis.set(0.7, 0, -1.4);
      held.blick = Math.atan2(1.4, -2.8); gegner.blick = Math.atan2(-1.4, 2.8);
      szene.add(held.gruppe, gegner.gruppe);
      ladeMonster(clip.gegner as MonsterId, 2.2).then(m => {
        if (abgebaut) { m.dispose(); return; }
        monster = m;
        gegner!.setzeModell(m.modell, m.hoehe);
      }).catch(() => { /* ohne Gegner zaubert der Avatar ins Leere */ });
      blick.set(0, 1.1, 0);
    } else {
      ladeMonster(clip.monster as MonsterId, 1.8).then(m => {
        if (abgebaut) { m.dispose(); return; }
        monster = m;
        szene.add(m.modell);
      }).catch(() => setOhne(true));
    }
    groesse();
    const ro = new ResizeObserver(groesse);
    ro.observe(el);

    const uhr = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(uhr.getDelta(), 0.05);
      zeit += dt; takt += dt;
      if (clip.art === "tanz" && takt > 2.2) {
        takt = 0;
        bewegeAvatar(avatar!, TANZ[++schritt % TANZ.length]);
      }
      if (clip.art === "zauber" && takt > 3.4 && held && gegner) {
        takt = 0;
        bewegeAvatar(avatar!, "angriff");
        welt!.angriff(clip.element as ElementId, held, gegner);
        setTimeout(() => monster?.spiele("treffer"), 900);
      }
      if (clip.art === "monster" && takt > 2.8 && monster) {
        takt = 0;
        monster.spiele(++schritt % 2 ? "angriff" : "treffer");
      }
      if (avatar && clip.art === "tanz") avatar.rotation.y = Math.sin(zeit * 0.9) * 0.6;
      welt?.update(dt);
      held?.update(dt); gegner?.update(dt);
      tickAvatare();
      tickMonster(dt);
      // Kamera kreist langsam, wie bei einem gefilmten Clip
      const r = clip.art === "zauber" ? 7.5 : 4.6, w = zeit * 0.25;
      kamera.position.set(Math.sin(w) * r * 0.5, 1.8 + Math.sin(zeit * 0.7) * 0.2, Math.cos(w * 0.5) * r);
      kamera.lookAt(blick);
      composer.render();
    });

    return () => {
      abgebaut = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      if (avatar) beendeAvatar(avatar);
      monster?.dispose();
      welt?.dispose();
      szene.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry && !m.geometry.userData.geteilt) m.geometry.dispose();
      });
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [clip]);

  if (ohne) return <div className="w-full h-full grid place-items-center text-8xl select-none">{ersatz}</div>;
  return <div ref={ref} className="w-full h-full" />;
}
