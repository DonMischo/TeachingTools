// Flüssigkeits-Shader (WebGL 1 / GLSL ES 1.00): Wirbel in einer Röhre mit Füllstand, fallende Teilchen.
export const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export const FRAG = `
precision highp float;
uniform float u_time;
uniform vec2  u_resolution;
uniform float u_progress;
uniform vec3  u_color;
uniform float u_level;
uniform int   u_fallCount;
uniform float u_elapsed[4];
uniform float u_edgeStart[4];
uniform float u_blobSize[4];
uniform float u_particleCount[4];
uniform int   u_form;
uniform float u_wirbel;
uniform float u_blasen;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {
  float v=0.0, a=0.5;
  for (int i=0; i<5; i++) { v+=a*noise(p); p*=2.0; a*=0.5; }
  return v;
}

void renderFall(vec2 cpx, float elapsed, float edgeStart, float curEdge,
                float blobSize, float pc, inout vec3 col, inout float alp) {
  if (elapsed < 0.0 || elapsed > 6.0) return;
  float fade = 1.0 - smoothstep(4.0, 5.5, elapsed);
  if (fade <= 0.0) return;
  // Uniform control flow: no if/break/continue inside the loop. Dynamic
  // branching in loops fails silently on some embedded WebGL drivers, so the
  // per-particle count and start-time gates are applied branchlessly via step().
  float countF = min(pc, 150.0);
  for (int i = 0; i < 150; i++) {
    float fi = float(i);
    float inCount = 1.0 - step(countF, fi + 0.5);   // count gate (was an early break past the count)
    float seed = fi * 0.6180339887 + 131.0;
    float fallDur = 2.5 + hash(vec2(seed, 8.0)) * 1.0;
    float startDelay = (fi / max(pc, 1.0)) * 1.5;
    float pe = elapsed - startDelay;
    float started = step(0.0, pe);                  // start gate (was an early skip before start time)
    float gate = inCount * started;
    float fp = clamp(pe / fallDur, 0.0, 1.0);
    float landP = clamp((startDelay + fallDur) / 4.0, 0.0, 1.0);
    float targetY = mix(edgeStart, curEdge, landP);
    float curY = fp >= 0.99 ? targetY : mix(1.0, targetY, fp);
    float curX = 0.05 + hash(vec2(seed, 1.0)) * 0.9;
    curX += sin(fp * 3.14159 + seed * 2.0) * 0.01 * (1.0 - fp);
    vec2 pPosPx = vec2(curX * u_resolution.x, curY * u_resolution.y);
    float pSzPx = 2.0 + blobSize * 4.0;
    float p = smoothstep(pSzPx, 0.0, length(cpx - pPosPx));
    float brightness = 0.9 + hash(vec2(seed, 7.0)) * 0.2;
    col += (vec3(1.0, 0.96, 0.82) * brightness + u_color * 0.4) * p * fade * gate;
    alp += p * fade * 0.9 * gate;
  }
  if (curEdge > 0.0 && curEdge < 1.0 && elapsed > 0.8) {
    vec2 uv2 = cpx / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    for (int r = 0; r < 3; r++) {
      float rf = float(r);
      float ringR = 0.04 + rf * 0.05;
      vec2 toC = (uv2 - vec2(0.5, curEdge)) * vec2(aspect, 1.0);
      float ring = smoothstep(0.025, 0.0, abs(length(toC) - ringR))
                 * abs(sin(u_time * 1.5 + rf * 1.1)) * fade;
      col += vec3(1.0, 0.96, 0.8) * ring * 0.35;
      alp += ring * 0.12;
    }
  }
}

void main() {
  vec2 uv  = gl_FragCoord.xy / u_resolution;
  vec2 cpx = gl_FragCoord.xy;
  float fillEdge = u_progress;
  float aspect = u_resolution.x / u_resolution.y;
  float st = u_time * 0.4;
  vec2 fc = (uv - vec2(0.5, fillEdge * 0.5)) * vec2(aspect, 1.0);
  float r = length(fc);
  float theta = atan(fc.y, fc.x);
  float d1 = fbm(uv * 3.5 + st * 0.18) * 0.14;
  float d2 = fbm(uv * 7.0 - st * 0.09) * 0.06;
  float wisp = 0.0;
  for (int s=0; s<8; s++) {
    float sf = float(s);
    wisp += smoothstep(0.55,0.9,sin(theta+d1+r*(6.0+sf)-st*(0.8+sf*0.15)+sf*0.7854))
           *smoothstep(0.55,0.0,r);
  }
  wisp = clamp(wisp / 3.5, 0.0, 1.0);
  float big = 0.0;
  for (int s=0; s<3; s++) {
    float sf = float(s);
    big += smoothstep(0.3,0.75,sin(theta+d2+r*(3.0+sf)-st*(0.3+sf*0.1)+sf*2.09));
  }
  big  = clamp(big / 4.0, 0.0, 1.0);
  float turb = fbm(uv * vec2(5.0,18.0) + st*0.12 + d2);

  float lvlBright   = 1.0 + u_level * 0.12;
  float lvlOpacity  = 0.91 + u_level * 0.025;
  float sparkleGate = 0.06 + u_level * 0.03 + u_wirbel * 0.08;
  float sparkleMult = 1.0 + u_level * 0.4 + u_wirbel * 2.5;

  vec3  col   = vec3(0.0);
  float alpha = 0.0;

  if (uv.y <= fillEdge) {
    float cg = exp(-r * 4.2);
    col  = u_color * 0.05;
    col += u_color * (wisp*0.9 + big*0.3 + turb*0.10);
    col += vec3(0.85,0.75,1.0) * pow(max(0.0,wisp),2.5) * 0.3;
    col += u_color * cg*0.45 + vec3(1.0)*cg*0.08;
    col *= 1.0 - smoothstep(0.0,0.38,abs(uv.x-0.5))*0.55;
    col *= (0.78 + (uv.y / max(fillEdge,0.001)) * 0.35) * lvlBright;

    float spa = 0.0; vec3 spc = vec3(0.0);
    vec2 sc2 = floor(cpx / 5.0);
    for (int dx=-1; dx<=1; dx++) {
      for (int dy=-1; dy<=1; dy++) {
        vec2 nc = sc2 + vec2(float(dx),float(dy));
        float gate = step(hash(nc*0.13+vec2(0.31,0.17)), sparkleGate);
        float twS  = 0.6 + hash(nc+vec2(9.1,0.0))*3.0;
        float twP  = hash(nc+vec2(1.3,4.7))*6.2832;
        float blink = abs(sin(u_time*twS+twP));
        float epoch = floor((u_time*twS+twP)/6.2832);
        vec2 jit  = vec2(hash(nc+vec2(3.3+epoch*7.13,5.1)), hash(nc+vec2(7.7,2.3+epoch*3.71)));
        vec2 spx2 = (nc+jit)*5.0;
        float sy_uv = spx2.y / u_resolution.y;
        float rim = smoothstep(fillEdge,fillEdge*0.85,sy_uv)*step(sy_uv,fillEdge);
        vec2 d3 = abs(cpx-spx2);
        float cr = max(max(0.0,1.0-d3.x/1.2)*max(0.0,1.0-d3.y/6.5),
                       max(0.0,1.0-d3.x/6.5)*max(0.0,1.0-d3.y/1.2));
        float sv = gate*blink*cr*2.5*rim*sparkleMult;
        spa += sv;
        spc += vec3(1.0,0.97,0.72)*sv + u_color*sv*0.45;
      }
    }
    col = mix(col, col+spc, clamp(spa,0.0,1.0)*0.88);
    alpha = lvlOpacity + cg*0.05 + spa*0.2;
    if (fillEdge > 0.0 && fillEdge < 1.0)
      col += u_color * smoothstep(0.03,0.0,abs(uv.y-fillEdge))*0.08;
    col += u_color * u_wirbel * cg * 0.35;

    // Blasen: steigen auf und platzen an der Oberflaeche
    float bub = 0.0;
    for (int b=0; b<10; b++) {
      float bf = float(b);
      float bx = 0.12 + hash(vec2(bf, 3.0)) * 0.76;
      float bs = 0.25 + hash(vec2(bf, 5.0)) * 0.35;
      float by = fract(u_time * bs + hash(vec2(bf, 9.0))) * fillEdge;
      float br = 0.012 + hash(vec2(bf, 11.0)) * 0.02;
      vec2 bd = (uv - vec2(bx + sin(u_time * 2.0 + bf) * 0.02, by)) * vec2(aspect, 1.0);
      bub += smoothstep(0.004, 0.0, abs(length(bd) - br)) * (1.0 - by / max(fillEdge, 0.001));
    }
    col += vec3(0.95, 1.0, 1.0) * bub * u_blasen * 0.8;
    alpha += bub * u_blasen * 0.2;
  }

  // Unrolled fall calls (no dynamic array indexing for WebGL1 compatibility)
  if (u_fallCount > 0) renderFall(cpx, u_elapsed[0], u_edgeStart[0], fillEdge, u_blobSize[0], u_particleCount[0], col, alpha);
  if (u_fallCount > 1) renderFall(cpx, u_elapsed[1], u_edgeStart[1], fillEdge, u_blobSize[1], u_particleCount[1], col, alpha);
  if (u_fallCount > 2) renderFall(cpx, u_elapsed[2], u_edgeStart[2], fillEdge, u_blobSize[2], u_particleCount[2], col, alpha);
  if (u_fallCount > 3) renderFall(cpx, u_elapsed[3], u_edgeStart[3], fillEdge, u_blobSize[3], u_particleCount[3], col, alpha);

  // Gefaessform: 0 Roehre, 1 Kessel, 2 Flasche
  float mask = 1.0;
  if (u_form == 1) {
    float kd = length(vec2((uv.x - 0.5) * 2.0, max(0.0, 0.55 - uv.y) / 0.55));
    mask = 1.0 - smoothstep(0.93, 1.0, kd);
  }
  if (u_form == 2) {
    float hw = mix(0.5, 0.2, smoothstep(0.55, 0.72, uv.y));
    mask = (1.0 - smoothstep(hw - 0.03, hw, abs(uv.x - 0.5))) * smoothstep(0.0, 0.05, uv.y);
  }
  alpha *= mask;
  // Kessel: Blasen, Ringe und Zufluss-Teilchen bleiben in der Suppe, nichts steigt darüber hinaus
  if (u_form == 1) alpha *= 1.0 - smoothstep(fillEdge, fillEdge + 0.012, uv.y);

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.98));
}
`;

