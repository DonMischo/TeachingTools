/**
 * Malfilter: Die Szene wird erst in ein Zwischenbild gezeichnet, dann wie mit
 * dem Pinsel vereinfacht (Kuwahara-Filter: je Bildpunkt gewinnt das ruhigste
 * der vier Nachbarviertel — Flächen werden glatt, Kanten bleiben scharf),
 * dazu Leinwandkorn, kräftigere Farben und ein dunkler Rand.
 *
 * Güte 2 = breiter Pinsel, 1 = schmaler Pinsel bei kleinerem Bild, 0 = ohne
 * Pinsel (nur Farben) — für schwache Geräte.
 *
 * Leuchten (Bloom): was heller ist als die Schwelle, wird in fünf halbierten Stufen weichgezeichnet
 * und wieder aufaddiert — Kristalle, Feuer und Bildschirme strahlen in ihre Umgebung. Danach ein
 * Bildton je Welt: Schatten und Lichter leicht eingefärbt (z. B. kühle Schatten, warmes Licht).
 */
import * as THREE from "three";

export type Guete = 0 | 1 | 2;

/** Bildhöhe in Pixeln und Pinselradius je Güte */
const STUFE: Record<Guete, { hoehe: number; radius: number }> = {
  0: { hoehe: 720, radius: 0 },
  1: { hoehe: 540, radius: 2 },
  2: { hoehe: 720, radius: 3 },
};

const ECKE = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;

const PINSEL = /* glsl */ `
precision highp float;
uniform sampler2D tBild;
uniform vec2 uPx;
uniform float uBelichtung;
uniform sampler2D tLeuchten;
uniform float uLeuchten;
uniform vec3 uSchatten;
uniform vec3 uLicht;
varying vec2 vUv;

float zufall( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float rauschen( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( zufall( i ), zufall( i + vec2( 1.0, 0.0 ) ), f.x ),
              mix( zufall( i + vec2( 0.0, 1.0 ) ), zufall( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}

vec3 hole( vec2 uv ) { return min( texture2D( tBild, uv ).rgb, vec3( 6.0 ) ); }

#if RADIUS > 0
vec3 pinsel( vec2 uv ) {
  vec3 m0 = vec3( 0.0 ), m1 = vec3( 0.0 ), m2 = vec3( 0.0 ), m3 = vec3( 0.0 );
  vec3 s0 = vec3( 0.0 ), s1 = vec3( 0.0 ), s2 = vec3( 0.0 ), s3 = vec3( 0.0 );
  for ( int j = -RADIUS; j <= RADIUS; j++ ) {
    for ( int i = -RADIUS; i <= RADIUS; i++ ) {
      vec3 c = hole( uv + vec2( float( i ), float( j ) ) * uPx );
      vec3 q = c * c;
      if ( i <= 0 && j <= 0 ) { m0 += c; s0 += q; }
      if ( i >= 0 && j <= 0 ) { m1 += c; s1 += q; }
      if ( i <= 0 && j >= 0 ) { m2 += c; s2 += q; }
      if ( i >= 0 && j >= 0 ) { m3 += c; s3 += q; }
    }
  }
  float n = float( ( RADIUS + 1 ) * ( RADIUS + 1 ) );
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  vec3 v0 = abs( s0 / n - m0 * m0 ), v1 = abs( s1 / n - m1 * m1 ), v2 = abs( s2 / n - m2 * m2 ), v3 = abs( s3 / n - m3 * m3 );
  float a = v0.r + v0.g + v0.b, b = v1.r + v1.g + v1.b, c = v2.r + v2.g + v2.b, d = v3.r + v3.g + v3.b;
  vec3 aus = m0; float kl = a;
  if ( b < kl ) { kl = b; aus = m1; }
  if ( c < kl ) { kl = c; aus = m2; }
  if ( d < kl ) { aus = m3; }
  return aus;
}
#endif

// Filmkurve (ACES, Näherung von Narkowicz)
vec3 film( vec3 x ) { return clamp( ( x * ( 2.51 * x + 0.03 ) ) / ( x * ( 2.43 * x + 0.59 ) + 0.14 ), 0.0, 1.0 ); }
vec3 srgb( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }

void main() {
  vec2 feld = vUv / uPx;
  #if RADIUS > 0
    // der Pinsel zittert: Kanten werden unregelmäßig wie gemalt
    vec2 uv = vUv + ( vec2( rauschen( feld / 7.0 ), rauschen( feld / 7.0 + 31.0 ) ) - 0.5 ) * uPx * 3.0;
    vec3 c = pinsel( uv );
  #else
    vec3 c = hole( vUv );
  #endif
  c = srgb( film( c * uBelichtung + texture2D( tLeuchten, vUv ).rgb * uLeuchten ) );
  // Bildton: Schatten und Lichter getrennt eingefärbt
  float hell = dot( c, vec3( 0.299, 0.587, 0.114 ) );
  c *= mix( uSchatten, uLicht, smoothstep( 0.08, 0.8, hell ) );
  // kräftigere Farben
  float grau = dot( c, vec3( 0.299, 0.587, 0.114 ) );
  c = mix( vec3( grau ), c, 1.22 );
  // Leinwand: grobes und feines Korn
  float korn = rauschen( feld / 2.5 ) * 0.6 + rauschen( feld * vec2( 0.9, 0.25 ) ) * 0.4;
  c *= 0.94 + 0.1 * korn;
  // dunkler Rand
  vec2 r = vUv - 0.5;
  c *= 1.0 - dot( r, r ) * 0.55;
  gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );
}`;

// ── Leuchten: Helles herausziehen, verkleinern, weich wieder vergrößern ──
const HELL = /* glsl */ `
precision highp float;
uniform sampler2D tBild;
uniform vec2 uPx;
uniform float uBelichtung;
uniform float uSchwelleSatt;
varying vec2 vUv;
void main() {
  // vier bilineare Abgriffe = Mittel aus 4 × 4 Bildpunkten, damit nichts flimmert
  vec4 a = texture2D( tBild, vUv + uPx * vec2( -1.0, -1.0 ) ), b = texture2D( tBild, vUv + uPx * vec2( 1.0, -1.0 ) ),
       d = texture2D( tBild, vUv + uPx * vec2( -1.0, 1.0 ) ), e = texture2D( tBild, vUv + uPx * vec2( 1.0, 1.0 ) );
  vec3 c = ( min( a.rgb, vec3( 8.0 ) ) + min( b.rgb, vec3( 8.0 ) ) + min( d.rgb, vec3( 8.0 ) ) + min( e.rgb, vec3( 8.0 ) ) ) * 0.25 * uBelichtung;
  // Alpha 2 = leuchtendes Teil (glutStoff): dort gilt die Schwelle, sonst die doppelte
  float glut = clamp( ( a.a + b.a + d.a + e.a ) * 0.25 - 1.0, 0.0, 1.0 );
  float uSchwelle = mix( uSchwelleSatt * 2.0, uSchwelleSatt, glut );
  float l = max( c.r, max( c.g, c.b ) );
  // weiches Knie: knapp über der Schwelle leuchtet es nur ein wenig
  float k = clamp( l - uSchwelle + 0.4, 0.0, 0.8 );
  float w = max( k * k / 1.6, l - uSchwelle ) / max( l, 1e-4 );
  gl_FragColor = vec4( c * w, 1.0 );
}`;

const RUNTER = /* glsl */ `
precision highp float;
uniform sampler2D tBild;
uniform vec2 uPx;
varying vec2 vUv;
void main() {
  vec3 c = texture2D( tBild, vUv + uPx * vec2( -1.0, -1.0 ) ).rgb + texture2D( tBild, vUv + uPx * vec2( 1.0, -1.0 ) ).rgb
         + texture2D( tBild, vUv + uPx * vec2( -1.0, 1.0 ) ).rgb + texture2D( tBild, vUv + uPx * vec2( 1.0, 1.0 ) ).rgb;
  gl_FragColor = vec4( c * 0.25, 1.0 );
}`;

const HOCH = /* glsl */ `
precision highp float;
uniform sampler2D tBild;
uniform vec2 uPx;
varying vec2 vUv;
void main() {
  // Zeltfilter 3 × 3 über die kleinere Stufe, auf die größere addiert
  vec3 c = texture2D( tBild, vUv ).rgb * 4.0;
  c += ( texture2D( tBild, vUv + vec2( uPx.x, 0.0 ) ).rgb + texture2D( tBild, vUv - vec2( uPx.x, 0.0 ) ).rgb
       + texture2D( tBild, vUv + vec2( 0.0, uPx.y ) ).rgb + texture2D( tBild, vUv - vec2( 0.0, uPx.y ) ).rgb ) * 2.0;
  c += texture2D( tBild, vUv + uPx ).rgb + texture2D( tBild, vUv - uPx ).rgb
     + texture2D( tBild, vUv + vec2( uPx.x, -uPx.y ) ).rgb + texture2D( tBild, vUv + vec2( -uPx.x, uPx.y ) ).rgb;
  gl_FragColor = vec4( c / 16.0, 1.0 );
}`;

/** Bildton einer Welt; jede Angabe darf fehlen */
export interface Bildton {
  /** Faktor auf die dunklen Töne, z. B. [0.9, 0.97, 1.1] = kühle Schatten */
  schatten?: [number, number, number];
  /** Faktor auf die hellen Töne, z. B. [1.08, 1, 0.9] = warmes Licht */
  licht?: [number, number, number];
  /** Stärke des Leuchtens (0 = aus) */
  leuchten?: number;
  /** ab dieser Helligkeit (linear, nach der Belichtung) leuchtet es */
  schwelle?: number;
}
const STUFEN = 5;

export interface Maler {
  /** Größe der Fläche in CSS-Pixeln */
  groesse(b: number, h: number): void;
  male(szene: THREE.Scene, kamera: THREE.Camera): void;
  guete(g: Guete): void;
  belichtung(b: number): void;
  bildton(t?: Bildton): void;
  entsorge(): void;
}

export function baueMaler(renderer: THREE.WebGLRenderer, start: Guete = 2): Maler {
  let stufe = start, breite = 1, hoehe = 1;
  const ziel = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
  const mat = new THREE.ShaderMaterial({
    vertexShader: ECKE, fragmentShader: PINSEL, depthTest: false, depthWrite: false,
    defines: { RADIUS: STUFE[stufe].radius },
    uniforms: {
      tBild: { value: ziel.texture }, uPx: { value: new THREE.Vector2(1, 1) }, uBelichtung: { value: 1 },
      tLeuchten: { value: null as THREE.Texture | null }, uLeuchten: { value: 0.6 },
      uSchatten: { value: new THREE.Vector3(1, 1, 1) }, uLicht: { value: new THREE.Vector3(1, 1, 1) },
    },
  });
  // Leuchten: Kette halbierter Bilder
  const stufen = Array.from({ length: STUFEN }, () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }));
  mat.uniforms.tLeuchten.value = stufen[0].texture;
  const pass = (frag: string, extra: Record<string, THREE.IUniform> = {}, dazu = false) => new THREE.ShaderMaterial({
    vertexShader: ECKE, fragmentShader: frag, depthTest: false, depthWrite: false,
    blending: dazu ? THREE.AdditiveBlending : THREE.NoBlending, transparent: dazu,
    uniforms: { tBild: { value: null }, uPx: { value: new THREE.Vector2(1, 1) }, ...extra },
  });
  const hell = pass(HELL, { uBelichtung: mat.uniforms.uBelichtung, uSchwelleSatt: { value: 1 } });
  const runter = pass(RUNTER), hoch = pass(HOCH, {}, true);
  const leinwand = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hell);
  leinwand.frustumCulled = false;
  const werkstatt = new THREE.Scene();
  werkstatt.add(leinwand);
  const zeichne = (m: THREE.ShaderMaterial, von: THREE.WebGLRenderTarget, nach: THREE.WebGLRenderTarget) => {
    m.uniforms.tBild.value = von.texture;
    m.uniforms.uPx.value.set(1 / von.width, 1 / von.height);
    leinwand.material = m;
    renderer.setRenderTarget(nach);
    renderer.render(werkstatt, auge);
  };
  const leuchte = () => {
    if (mat.uniforms.uLeuchten.value <= 0) return;
    const war = renderer.autoClear;
    zeichne(hell, ziel, stufen[0]);
    for (let i = 1; i < STUFEN; i++) zeichne(runter, stufen[i - 1], stufen[i]);
    renderer.autoClear = false;
    for (let i = STUFEN - 1; i > 0; i--) {
      hoch.uniforms.tBild.value = stufen[i].texture;
      hoch.uniforms.uPx.value.set(1 / stufen[i].width, 1 / stufen[i].height);
      leinwand.material = hoch;
      renderer.setRenderTarget(stufen[i - 1]);
      renderer.render(werkstatt, auge);
    }
    renderer.autoClear = war;
  };
  const flaeche = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  flaeche.frustumCulled = false;
  const buehne = new THREE.Scene();
  buehne.add(flaeche);
  const auge = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const passe = () => {
    // nie mehr Pixel als die Fläche hat; sonst die Höhe der Stufe
    const h = Math.max(1, Math.round(Math.min(STUFE[stufe].hoehe, hoehe * Math.min(2, window.devicePixelRatio || 1))));
    const b = Math.max(1, Math.round((h * breite) / hoehe));
    renderer.setPixelRatio(1);
    renderer.setSize(b, h, false);
    ziel.setSize(b, h);
    mat.uniforms.uPx.value.set(1 / b, 1 / h);
    stufen.forEach((z, i) => z.setSize(Math.max(1, b >> (i + 1)), Math.max(1, h >> (i + 1))));
  };

  return {
    groesse(b, h) { breite = Math.max(1, b); hoehe = Math.max(1, h); passe(); },
    male(szene, kamera) {
      renderer.setRenderTarget(ziel);
      renderer.render(szene, kamera);
      leuchte();
      renderer.setRenderTarget(null);
      renderer.render(buehne, auge);
    },
    guete(g) {
      if (g === stufe) return;
      stufe = g;
      mat.defines.RADIUS = STUFE[g].radius;
      mat.needsUpdate = true;
      passe();
    },
    belichtung(b) { mat.uniforms.uBelichtung.value = b; },
    bildton(t = {}) {
      mat.uniforms.uSchatten.value.set(...(t.schatten ?? [1, 1, 1]));
      mat.uniforms.uLicht.value.set(...(t.licht ?? [1, 1, 1]));
      mat.uniforms.uLeuchten.value = t.leuchten ?? 0.6;
      hell.uniforms.uSchwelleSatt.value = t.schwelle ?? 1;
    },
    entsorge() {
      ziel.dispose(); mat.dispose(); flaeche.geometry.dispose();
      for (const z of stufen) z.dispose();
      hell.dispose(); runter.dispose(); hoch.dispose(); leinwand.geometry.dispose();
    },
  };
}
