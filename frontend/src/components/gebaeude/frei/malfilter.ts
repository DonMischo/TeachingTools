/**
 * Malfilter: Die Szene wird erst in ein Zwischenbild gezeichnet, dann wie mit
 * dem Pinsel vereinfacht (Kuwahara-Filter: je Bildpunkt gewinnt das ruhigste
 * der vier Nachbarviertel — Flächen werden glatt, Kanten bleiben scharf),
 * dazu Leinwandkorn, kräftigere Farben und ein dunkler Rand.
 *
 * Güte 2 = breiter Pinsel, 1 = schmaler Pinsel bei kleinerem Bild, 0 = ohne
 * Pinsel (nur Farben) — für schwache Geräte.
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
  c = srgb( film( c * uBelichtung ) );
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

export interface Maler {
  /** Größe der Fläche in CSS-Pixeln */
  groesse(b: number, h: number): void;
  male(szene: THREE.Scene, kamera: THREE.Camera): void;
  guete(g: Guete): void;
  belichtung(b: number): void;
  entsorge(): void;
}

export function baueMaler(renderer: THREE.WebGLRenderer, start: Guete = 2): Maler {
  let stufe = start, breite = 1, hoehe = 1;
  const ziel = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
  const mat = new THREE.ShaderMaterial({
    vertexShader: ECKE, fragmentShader: PINSEL, depthTest: false, depthWrite: false,
    defines: { RADIUS: STUFE[stufe].radius },
    uniforms: { tBild: { value: ziel.texture }, uPx: { value: new THREE.Vector2(1, 1) }, uBelichtung: { value: 1 } },
  });
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
  };

  return {
    groesse(b, h) { breite = Math.max(1, b); hoehe = Math.max(1, h); passe(); },
    male(szene, kamera) {
      renderer.setRenderTarget(ziel);
      renderer.render(szene, kamera);
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
    entsorge() { ziel.dispose(); mat.dispose(); flaeche.geometry.dispose(); },
  };
}
