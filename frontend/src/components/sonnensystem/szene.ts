/**
 * Bausteine, aus denen Übersicht und Flug ihre 3D-Szene zusammensetzen.
 *
 * Koordinaten: die Rechnung liefert Ekliptik (x, y, z mit z nach oben),
 * three.js erwartet y nach oben. `zuSzene` dreht das um.
 *
 * Aufbau eines Körpers:  Gruppe (Position)
 *                          └ Achse (Neigung, bleibt stehen)
 *                              ├ Kugel (dreht sich)  ├ Wolken  └ Nachtlichter
 *                              ├ Saum (Atmosphäre)
 *                              └ Ringe
 * Die Ringe hängen an der Achse, nicht an der Kugel — sonst drehten sie mit.
 */
import * as THREE from "three";
import type { Koerper } from "@/lib/sonnensystem/daten";
import { textur as texturNachweis } from "@/lib/sonnensystem/bilder";
import type { Vec3 } from "@/lib/sonnensystem/bahnen";

export function zuSzene([x, y, z]: Vec3, ziel = new THREE.Vector3()): THREE.Vector3 {
  return ziel.set(x, z, -y);
}

export function webglVerfuegbar(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export class Texturen {
  private lader: THREE.TextureLoader;
  private cache = new Map<string, THREE.Texture>();

  constructor(manager?: THREE.LoadingManager) {
    this.lader = new THREE.TextureLoader(manager);
  }

  /** Lädt die Textur zu einer Id aus bilder.json; ohne Eintrag gibt es null. */
  holen(id: string, farbig = true): THREE.Texture | null {
    const nachweis = texturNachweis(id);
    if (!nachweis) return null;
    let t = this.cache.get(id);
    if (!t) {
      t = this.lader.load(nachweis.datei);
      if (farbig) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      this.cache.set(id, t);
    }
    return t;
  }

  entsorgen() {
    this.cache.forEach(t => t.dispose());
    this.cache.clear();
  }
}

/** Leuchtender Rand dort, wo Sonnenlicht durch eine Atmosphäre fällt. */
function saumMaterial(farbe: string, staerke = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      farbe: { value: new THREE.Color(farbe) },
      sonne: { value: new THREE.Vector3() },
      staerke: { value: staerke },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vNormalWelt;
      varying vec3 vPosWelt;
      void main() {
        vec4 welt = modelMatrix * vec4(position, 1.0);
        vPosWelt = welt.xyz;
        vNormalWelt = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * welt;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform vec3 farbe;
      uniform vec3 sonne;
      uniform float staerke;
      varying vec3 vNormalWelt;
      varying vec3 vPosWelt;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 zurKamera = normalize(cameraPosition - vPosWelt);
        float rand = 1.0 - abs(dot(zurKamera, vNormalWelt));
        float licht = clamp(dot(vNormalWelt, normalize(sonne - vPosWelt)) + 0.35, 0.0, 1.0);
        float a = pow(rand, 3.0) * licht * staerke;
        gl_FragColor = vec4(farbe * a, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/** Stadtlichter der Erde — nur auf der Nachtseite. */
function nachtMaterial(karte: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { karte: { value: karte }, sonne: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      varying vec3 vNormalWelt;
      varying vec3 vPosWelt;
      void main() {
        vUv = uv;
        vec4 welt = modelMatrix * vec4(position, 1.0);
        vPosWelt = welt.xyz;
        vNormalWelt = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * welt;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D karte;
      uniform vec3 sonne;
      varying vec2 vUv;
      varying vec3 vNormalWelt;
      varying vec3 vPosWelt;
      void main() {
        #include <logdepthbuf_fragment>
        float tag = dot(vNormalWelt, normalize(sonne - vPosWelt));
        float nacht = smoothstep(0.05, -0.25, tag);
        vec3 c = texture2D(karte, vUv).rgb * nacht * 1.6;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export interface KoerperObjekt {
  koerper: Koerper;
  gruppe: THREE.Group;
  achse: THREE.Group;
  kugel: THREE.Mesh;
  wolken?: THREE.Mesh;
  /** Materialien, die die Sonnenposition kennen müssen. */
  sonnenMaterialien: THREE.ShaderMaterial[];
  radius: number;
}

export function baueKoerper(k: Koerper, radius: number, texturen: Texturen, feinheit = 64): KoerperObjekt {
  const gruppe = new THREE.Group();
  gruppe.name = k.id;
  const achse = new THREE.Group();
  // Um die x-Achse — genau wie `kippe` die Mondbahnen kippt, sonst lägen die
  // Uranusmonde nicht über seinem Äquator.
  achse.rotation.x = THREE.MathUtils.degToRad(k.achsneigung ?? 0);
  gruppe.add(achse);

  const karte = texturen.holen(k.id);
  const kugel = new THREE.Mesh(
    new THREE.SphereGeometry(radius, feinheit, feinheit / 2),
    new THREE.MeshStandardMaterial({
      map: karte,
      color: karte ? 0xffffff : new THREE.Color(k.farbe),
      roughness: 1,
      metalness: 0,
    }),
  );
  kugel.userData.id = k.id;
  achse.add(kugel);

  const sonnenMaterialien: THREE.ShaderMaterial[] = [];
  let wolken: THREE.Mesh | undefined;

  if (k.id === "erde") {
    const wolkenKarte = texturen.holen("erde-wolken", false);
    if (wolkenKarte) {
      wolken = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.012, feinheit, feinheit / 2),
        new THREE.MeshStandardMaterial({ alphaMap: wolkenKarte, color: 0xffffff, transparent: true, depthWrite: false, roughness: 1 }),
      );
      kugel.add(wolken);
    }
    const nachtKarte = texturen.holen("erde-nacht");
    if (nachtKarte) {
      const nacht = nachtMaterial(nachtKarte);
      sonnenMaterialien.push(nacht);
      kugel.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 1.002, feinheit, feinheit / 2), nacht));
    }
  }

  if (k.saum) {
    const saum = saumMaterial(k.saum, k.art === "planet" ? 1.1 : 0.9);
    sonnenMaterialien.push(saum);
    achse.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 1.04, feinheit, feinheit / 2), saum));
  }

  if (k.ringe) achse.add(baueRinge(k, radius, texturen));

  return { koerper: k, gruppe, achse, kugel, wolken, sonnenMaterialien, radius };
}

/**
 * Ein Raumfahrzeug: Rumpf, zwei Sonnensegel, dazu ein Glanzpunkt fester
 * Bildschirmgröße, damit man es überhaupt findet.
 *
 * Maßstabsgetreu wäre die ISS ein Hundertstel Pixel groß (siehe
 * FLUG_SATELLIT_RADIUS). Sie ist hier also grob aufgeblasen — der Steckbrief
 * nennt die echten Maße.
 */
export function baueSatellit(k: Koerper, radius: number): KoerperObjekt {
  const gruppe = new THREE.Group();
  gruppe.name = k.id;
  const achse = new THREE.Group();
  gruppe.add(achse);

  const rumpf = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.1, radius * 0.85, radius * 1.7),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(k.farbe), roughness: 0.5, metalness: 0.45 }),
  );
  rumpf.userData.id = k.id;
  achse.add(rumpf);

  const segelMaterial = new THREE.MeshStandardMaterial({ color: 0x1d2c5c, roughness: 0.35, metalness: 0.7 });
  for (const seite of [-1, 1]) {
    const segel = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.4, radius * 0.07, radius * 1.05), segelMaterial);
    segel.position.x = seite * radius * 1.85;
    achse.add(segel);
  }

  const glanz = new THREE.Sprite(new THREE.SpriteMaterial({
    map: leuchtTextur("rgba(255,255,255,0.9)", "rgba(180,220,255,0.2)"),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false,
  }));
  glanz.scale.setScalar(0.03);
  gruppe.add(glanz);

  return { koerper: k, gruppe, achse, kugel: rumpf, sonnenMaterialien: [], radius };
}

function baueRinge(k: Koerper, radius: number, texturen: Texturen): THREE.Mesh {
  const innen = k.ringe!.innen * radius;
  const aussen = k.ringe!.aussen * radius;
  const geo = new THREE.RingGeometry(innen, aussen, 160, 1);
  // RingGeometry legt die Textur quer drüber; hier soll sie von innen nach außen laufen.
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - innen) / (aussen - innen), 0.5);
  }
  const karte = k.id === "saturn" ? texturen.holen("saturn-ring") : null;
  const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: karte,
    color: karte ? 0xffffff : new THREE.Color(k.farbe),
    opacity: karte ? 0.95 : 0.18,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  }));
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

/** Ein weiches, rundes Leuchten als Textur — für Sonne und Sterne. */
export function leuchtTextur(innen = "rgba(255,240,200,1)", mitte = "rgba(255,190,90,0.35)"): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const verlauf = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  verlauf.addColorStop(0, innen);
  verlauf.addColorStop(0.18, mitte);
  verlauf.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = verlauf;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function baueSonne(radius: number, texturen: Texturen): { gruppe: THREE.Group; kugel: THREE.Mesh; glanz: THREE.Sprite } {
  const gruppe = new THREE.Group();
  gruppe.name = "sonne";
  const karte = texturen.holen("sonne");
  const kugel = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    new THREE.MeshBasicMaterial({ map: karte, color: new THREE.Color(1.25, 1.1, 0.9) }),
  );
  kugel.userData.id = "sonne";
  gruppe.add(kugel);
  const glanz = new THREE.Sprite(new THREE.SpriteMaterial({
    map: leuchtTextur(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  glanz.scale.setScalar(radius * 9);
  gruppe.add(glanz);
  return { gruppe, kugel, glanz };
}

/** Die Milchstraße als Kugel von innen. Sie wandert mit der Kamera, damit man sie nie erreicht. */
export function baueHimmel(radius: number, texturen: Texturen): THREE.Mesh {
  const karte = texturen.holen("milchstrasse");
  const himmel = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    new THREE.MeshBasicMaterial({ map: karte, color: karte ? 0xffffff : 0x000000, side: THREE.BackSide, depthWrite: false }),
  );
  // Die Milchstraße steht rund 60° schräg zur Ebene der Planetenbahnen.
  himmel.rotation.x = THREE.MathUtils.degToRad(60);
  himmel.renderOrder = -1;
  return himmel;
}

/** Ein Staubgürtel aus Punkten zwischen zwei Radien (in Szeneneinheiten). */
export function baueGuertel(anzahl: number, innen: number, aussen: number, dicke: number, farbe: number, groesse: number): THREE.Points {
  const pos = new Float32Array(anzahl * 3);
  let s = 12345;
  const zufall = () => ((s = (Math.imul(s, 1_103_515_245) + 12_345) >>> 0) / 4_294_967_296);
  for (let i = 0; i < anzahl; i++) {
    const w = zufall() * Math.PI * 2;
    const r = innen + (aussen - innen) * Math.sqrt(zufall());
    pos[i * 3] = Math.cos(w) * r;
    pos[i * 3 + 1] = (zufall() - 0.5) * dicke;
    pos[i * 3 + 2] = Math.sin(w) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: farbe, size: groesse, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false,
  }));
}

/** Gibt Geometrien und Materialien eines Teilbaums frei. Texturen verwaltet `Texturen`. */
export function entsorge(obj: THREE.Object3D) {
  obj.traverse(o => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(x => x.dispose());
    else mat?.dispose();
  });
}

/** Planetendrehung: Winkel zur Zeit jd. Rückwärts drehende Körper haben negative Stunden. */
export function drehwinkel(k: Koerper, jd: number): number {
  return k.rotationStunden ? ((jd * 24) / k.rotationStunden) * Math.PI * 2 : 0;
}
