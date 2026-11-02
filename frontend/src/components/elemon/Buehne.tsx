"use client";
/**
 * 3D-Bühne für Elemon-Kämpfe: zwei Figuren (Tier-Avatare oder Monster), die
 * Elementar-Angriffe aus dem Bosskampf und der Käfig zum Fangen. Steuerung von
 * außen über die Ref (angriff, treffer, ko, kaefig). Ohne WebGL2 stehen zwei
 * Emoji da, die wackeln.
 */
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { baueAvatar } from "@/components/gebaeude/avatar";
import { beendeAvatar, bewegeAvatar, tickAvatare } from "@/components/gebaeude/avatarModell";
import { effektWelt, Figur, type ElementId } from "@/lib/angriffe/effekte";
import { ladeMonster, tickMonster, type MonsterFigur } from "@/lib/angriffe/monsterLader";
import { ART } from "@/lib/elemon/daten";
import type { SeiteId } from "@/lib/elemon/kampf";
import { hatWebGL } from "@/components/klikk/Clip3D";

export interface BuehneSteuerung {
  /** Angriff von `seite` auf die andere; liefert die Dauer in Sekunden */
  angriff(seite: SeiteId, element: ElementId | null): number;
  treffer(seite: SeiteId): void;
  ko(seite: SeiteId): void;
  jubel(seite: SeiteId): void;
  /** Käfig über das wilde Elemon (Seite b); liefert die Dauer in Sekunden */
  kaefig(wackeln: number, gefangen: boolean): number;
}

type Bewegung = "angriff" | "treffer" | "tod" | "jubel";
interface Koerper { obj: THREE.Object3D; spiele(b: Bewegung): void; weg(): void }

const HOEHE = 1.6;

/** Modell für eine Art: Tier-Avatar (lädt sein .glb selbst nach) oder Monster */
function koerperFuer(art: string, fertig: (k: Koerper) => void): () => void {
  const m = ART[art].modell;
  if ("tier" in m) {
    const g = baueAvatar({ klasse: "normal", form: "m", haut: 0, tier: m.tier });
    g.scale.setScalar(1.25);
    fertig({
      obj: g,
      spiele: b => { bewegeAvatar(g, b); },
      weg: () => beendeAvatar(g),
    });
    return () => beendeAvatar(g);
  }
  let aus = false, figur: MonsterFigur | null = null;
  ladeMonster(m.monster, HOEHE).then(f => {
    if (aus) { f.dispose(); return; }
    figur = f;
    fertig({
      obj: f.modell,
      spiele: b => { f.spiele(b === "jubel" ? "angriff" : b === "tod" ? "tod" : b); },
      weg: () => f.dispose(),
    });
  }).catch(() => { /* ohne Modell bleibt die Seite leer */ });
  return () => { aus = true; figur?.dispose(); };
}

/** Ein Käfig aus Gitterstäben, zwei Ringen und einem Deckel */
function baueKaefig(): THREE.Group {
  const g = new THREE.Group();
  const metall = new THREE.MeshStandardMaterial({ color: 0xb8a060, metalness: 0.8, roughness: 0.3, emissive: new THREE.Color(0, 0, 0) });
  const r = 0.85, h = 2.1;
  for (let i = 0; i < 12; i++) {
    const w = (i / 12) * Math.PI * 2;
    const stab = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 6), metall);
    stab.position.set(Math.cos(w) * r, h / 2, Math.sin(w) * r);
    stab.userData.richtung = new THREE.Vector3(Math.cos(w), 0.4, Math.sin(w));
    g.add(stab);
  }
  for (const y of [0.02, h]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 32).rotateX(Math.PI / 2), metall);
    ring.position.y = y;
    g.add(ring);
  }
  const deckel = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb8a060, metalness: 0.8, roughness: 0.3, wireframe: true }));
  deckel.position.y = h;
  g.add(deckel);
  const griff = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 16), metall);
  griff.position.y = h + r + 0.1;
  g.add(griff);
  g.userData.metall = metall;
  return g;
}

export default function Buehne({ links, rechts, farbe, steuerung }: {
  links: string | null; rechts: string | null; farbe: string; steuerung: Ref<BuehneSteuerung>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ohne, setOhne] = useState(false);
  const [wackel, setWackel] = useState<{ seite: SeiteId; art: string; n: number } | null>(null);
  // Die Szene lebt in Refs, damit Modellwechsel nicht alles neu aufbauen
  const welt = useRef<{
    szene: THREE.Scene; effekte: ReturnType<typeof effektWelt>; figuren: Record<SeiteId, Figur>;
    koerper: Partial<Record<SeiteId, Koerper>>; ablaeufe: ((dt: number) => boolean)[];
  } | null>(null);
  const [bereit, setBereit] = useState(0);

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
    const f = new THREE.Color(farbe);
    szene.background = f;
    szene.fog = new THREE.Fog(f, 9, 22);
    szene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2));
    const sonne = new THREE.DirectionalLight(0xffffff, 1.6);
    sonne.position.set(-3, 6, 5);
    szene.add(sonne);
    szene.add(new THREE.Mesh(new THREE.CircleGeometry(9, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: f.clone().offsetHSL(0, 0, 0.12) })));
    for (const [x, z] of [[-1.5, 1.1], [1.5, -1.1]]) {
      const platz = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: f.clone().offsetHSL(0, 0, 0.22) }));
      platz.position.set(x, 0.01, z);
      szene.add(platz);
    }

    const kamera = new THREE.PerspectiveCamera(40, 16 / 10, 0.1, 50);
    kamera.position.set(0, 2.6, 6.8);
    kamera.lookAt(0, 0.8, 0);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(szene, kamera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(320, 200), 0.6, 0.4, 0.85));
    composer.addPass(new OutputPass());

    const effekte = effektWelt(szene, renderer);
    const a = new Figur(), b = new Figur();
    a.basis.set(-1.5, 0, 1.1); b.basis.set(1.5, 0, -1.1);
    a.blick = Math.atan2(3, -2.2); b.blick = Math.atan2(-3, 2.2);
    szene.add(a.gruppe, b.gruppe);
    welt.current = { szene, effekte, figuren: { a, b }, koerper: {}, ablaeufe: [] };
    setBereit(n => n + 1);

    const groesse = () => {
      const w = el.clientWidth || 320, h = el.clientHeight || 200;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      kamera.aspect = w / h;
      kamera.updateProjectionMatrix();
      effekte.setzeSkala((h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(kamera.fov) / 2)));
    };
    groesse();
    const ro = new ResizeObserver(groesse);
    ro.observe(el);

    const uhr = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(uhr.getDelta(), 0.05);
      const w = welt.current!;
      w.ablaeufe = w.ablaeufe.filter(f => f(dt));
      effekte.update(dt);
      w.figuren.a.update(dt); w.figuren.b.update(dt);
      tickAvatare();
      tickMonster(dt);
      const wa = effekte.wackel;
      kamera.position.set(Math.sin(performance.now() * 0.05) * wa * 0.1, 2.6, 6.8);
      composer.render();
    });

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      const w = welt.current;
      if (w) for (const k of Object.values(w.koerper)) k?.weg();
      welt.current = null;
      effekte.dispose();
      szene.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry && !m.geometry.userData.geteilt) m.geometry.dispose();
      });
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [farbe]);

  // Modell tauschen, wenn ein anderes Elemon in den Ring kommt (Schlüssel »art#nr«)
  const setzeSeite = (seite: SeiteId, schluessel: string | null) => {
    const w = welt.current;
    if (!w) return;
    // Neue Figur statt der alten: deren Zerfall (Absinken, Ausblenden) darf das neue Elemon nicht treffen
    const alt = w.figuren[seite];
    const fig = new Figur();
    fig.basis.copy(alt.basis).setY(0);
    fig.blick = alt.blick;
    w.szene.remove(alt.gruppe);
    w.szene.add(fig.gruppe);
    w.figuren[seite] = fig;
    fig.gruppe.visible = !!schluessel;
    if (!schluessel) return;
    return koerperFuer(schluessel.split("#")[0], k => {
      w.koerper[seite]?.weg();
      w.koerper[seite] = k;
      fig.setzeModell(k.obj, HOEHE);
      k.obj.userData.beiModell = () => fig.setzeModell(k.obj, HOEHE);
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setzeSeite("a", links), [links, bereit]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setzeSeite("b", rechts), [rechts, bereit]);

  useImperativeHandle(steuerung, () => {
    const andere = (s: SeiteId): SeiteId => (s === "a" ? "b" : "a");
    const zuckt = (seite: SeiteId, art: string) => setWackel({ seite, art, n: Date.now() });
    return {
      angriff(seite, element) {
        const w = welt.current;
        zuckt(seite, "angriff");
        if (!w) return 0.6;
        w.koerper[seite]?.spiele("angriff");
        if (!element) {
          // Rempler: kurzer Sprung nach vorn
          const t = w.figuren[seite], o = w.figuren[andere(seite)];
          t.stoss.copy(o.basis).sub(t.basis).setY(0).normalize().multiplyScalar(1.2);
          setTimeout(() => o.treffer({ tint: 0xffffff, staerke: 0.3, stoss: 0.4, dir: o.basis.clone().sub(t.basis).setY(0).normalize() }), 250);
          setTimeout(() => o.loesen(), 600);
          return 0.8;
        }
        return w.effekte.angriff(element, w.figuren[seite], w.figuren[andere(seite)]);
      },
      treffer(seite) { zuckt(seite, "treffer"); welt.current?.koerper[seite]?.spiele("treffer"); },
      ko(seite) {
        zuckt(seite, "ko");
        const w = welt.current;
        if (!w) return;
        w.koerper[seite]?.spiele("tod");
        setTimeout(() => welt.current?.effekte.zerfall(w.figuren[seite]), 700);
      },
      jubel(seite) { welt.current?.koerper[seite]?.spiele("jubel"); },
      kaefig(wackeln, gefangen) {
        zuckt("b", gefangen ? "gefangen" : "kaefig");
        const w = welt.current;
        const dauer = 0.6 + wackeln * 0.7 + 0.9;
        if (!w) return 1 + wackeln * 0.4;
        const k = baueKaefig();
        const ziel = w.figuren.b.basis;
        k.position.set(ziel.x, 5, ziel.z);
        w.szene.add(k);
        const metall = k.userData.metall as THREE.MeshStandardMaterial;
        const modell = w.koerper.b?.obj;
        let t = 0;
        w.ablaeufe.push(dt => {
          t += dt;
          if (t < 0.6) { k.position.y = 5 * (1 - (t / 0.6) ** 2); return true; }
          k.position.y = 0;
          const tw = t - 0.6;
          if (tw < wackeln * 0.7) {
            // Wackeln: das Elemon rüttelt am Gitter
            const p = (tw % 0.7) / 0.7;
            k.rotation.z = p < 0.5 ? Math.sin(p * Math.PI * 4) * 0.12 : 0;
            return true;
          }
          k.rotation.z = 0;
          const te = (tw - wackeln * 0.7) / 0.9;
          if (gefangen) {
            metall.emissive.setRGB(0.3 * Math.min(1, te * 2), 1.2 * Math.min(1, te * 2), 0.4 * Math.min(1, te * 2));
            const s = Math.max(0.001, 1 - te);
            k.scale.setScalar(s);
            if (modell) modell.scale.setScalar(Math.max(0.001, 1 - te) * (modell.userData.grund ?? (modell.userData.grund = modell.scale.x)));
          } else {
            // Gitter springt auseinander
            for (const c of k.children) {
              const r = c.userData.richtung as THREE.Vector3 | undefined;
              if (r) c.position.addScaledVector(r, dt * 6);
            }
            metall.transparent = true;
            metall.opacity = Math.max(0, 1 - te);
          }
          if (te >= 1) { w.szene.remove(k); if (gefangen) w.figuren.b.gruppe.visible = false; return false; }
          return true;
        });
        return dauer;
      },
    };
  }, []);

  if (ohne) return (
    <div className="w-full h-full grid grid-cols-2 items-end px-6 pb-4 select-none" style={{ background: farbe }}>
      {(["a", "b"] as SeiteId[]).map(s => {
        const art = s === "a" ? links : rechts;
        const zuck = wackel?.seite === s ? wackel.art : null;
        return (
          <div key={`${s}-${wackel?.n ?? 0}`} className={`text-6xl text-center ${s === "b" ? "self-start" : ""} ${zuck === "treffer" || zuck === "kaefig" ? "animate-bounce" : ""} ${zuck === "ko" || zuck === "gefangen" ? "opacity-20" : ""}`}>
            {art ? ART[art.split("#")[0]].emoji : ""}{s === "b" && zuck === "kaefig" ? "⛓️" : s === "b" && zuck === "gefangen" ? "🔒" : ""}
          </div>
        );
      })}
    </div>
  );
  return <div ref={ref} className="w-full h-full" />;
}
