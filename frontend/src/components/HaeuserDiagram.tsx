"use client";

import { useRef, useEffect, useState } from "react";
import { HausOut } from "@/lib/api";

const FRAME_W   = 500;
const FRAME_H   = 800;
const BAR_W     = 150;
const BAR_H     = 400;
const FRAME_GAP = 32;

const THRESHOLDS = [0, 1_000, 10_000, 100_000, 250_000, 500_000];

function getLevelInfo(pts: number): { level: number; progress: number } {
  const p = Math.max(0, pts);
  if (p === 0) return { level: 0, progress: 0 };
  for (let i = 0; i < THRESHOLDS.length - 1; i++) {
    if (p < THRESHOLDS[i + 1]) {
      const raw = (p - THRESHOLDS[i]) / (THRESHOLDS[i + 1] - THRESHOLDS[i]);
      return { level: i, progress: Math.max(0.1, raw) };
    }
  }
  return { level: THRESHOLDS.length - 2, progress: 1 };
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

type Fall = { startTime: number; edgeStart: number; blobSize: number; particleCount: number };
const MAX_FALLS = 4;

// ─── Shaders (WebGL 1 / GLSL ES 1.00) ────────────────────────────────────────
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
  int count = int(min(pc, 150.0));
  for (int i = 0; i < 150; i++) {
    if (i >= count) break;
    float fi = float(i);
    float seed = fi * 0.6180339887 + 131.0;
    float fallDur = 2.5 + hash(vec2(seed, 8.0)) * 1.0;
    float startDelay = (fi / max(pc, 1.0)) * 1.5;
    float pe = elapsed - startDelay;
    if (pe < 0.0) continue;
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
    col += (vec3(1.0, 0.96, 0.82) * brightness + u_color * 0.4) * p * fade;
    alp += p * fade * 0.9;
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
  float sparkleGate = 0.06 + u_level * 0.03;
  float sparkleMult = 1.0 + u_level * 0.4;

  vec3  col   = vec3(0.0);
  float alpha = 0.0;

  if (uv.y <= fillEdge) {
    float cg = exp(-r * 4.2);
    col  = u_color * 0.05;
    col += u_color * (wisp*0.9 + big*0.3 + turb*0.10);
    col += vec3(0.85,0.75,1.0) * pow(wisp,2.5) * 0.3;
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
  }

  // Unrolled fall calls (no dynamic array indexing for WebGL1 compatibility)
  if (u_fallCount > 0) renderFall(cpx, u_elapsed[0], u_edgeStart[0], fillEdge, u_blobSize[0], u_particleCount[0], col, alpha);
  if (u_fallCount > 1) renderFall(cpx, u_elapsed[1], u_edgeStart[1], fillEdge, u_blobSize[1], u_particleCount[1], col, alpha);
  if (u_fallCount > 2) renderFall(cpx, u_elapsed[2], u_edgeStart[2], fillEdge, u_blobSize[2], u_particleCount[2], col, alpha);
  if (u_fallCount > 3) renderFall(cpx, u_elapsed[3], u_edgeStart[3], fillEdge, u_blobSize[3], u_particleCount[3], col, alpha);

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.98));
}
`;

// ─── Per-house WebGL vortex canvas ────────────────────────────────────────────
function HausVortexCanvas({ points, color }: {
  points: number;
  color: [number, number, number];
}) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const stateRef   = useRef({
    color,
    committedPoints: points,
    displayPoints:   points,  // start at current so no animation on first render
    falls:           [] as Fall[],
    lastFrameTime:   0,
  });
  const didMount = useRef(false);

  useEffect(() => { stateRef.current.color = color; }, [color]);

  useEffect(() => {
    // Skip the initial mount — only trigger falls on subsequent changes
    if (!didMount.current) { didMount.current = true; return; }
    const state = stateRef.current;
    const delta = points - state.committedPoints;
    if (delta > 0) {
      const edgeStart    = getLevelInfo(state.displayPoints).progress;
      const blobSize     = Math.min(delta / 300, 1.0);
      const particleCount = Math.max(25, Math.min(150, Math.round(delta / 5)));
      state.falls.push({ startTime: performance.now(), edgeStart, blobSize, particleCount });
      if (state.falls.length > MAX_FALLS) state.falls.shift();
    }
    state.committedPoints = points;
  }, [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    function compile(type: number, src: string) {
      const sh = gl!.createShader(type)!;
      gl!.shaderSource(sh, src); gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        console.error(gl!.getShaderInfoLog(sh)); return null;
      }
      return sh;
    }
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog)); return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    gl.useProgram(prog);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const uTime  = gl.getUniformLocation(prog, "u_time");
    const uRes   = gl.getUniformLocation(prog, "u_resolution");
    const uProg  = gl.getUniformLocation(prog, "u_progress");
    const uColor = gl.getUniformLocation(prog, "u_color");
    const uLevel = gl.getUniformLocation(prog, "u_level");
    const uFallCount = gl.getUniformLocation(prog, "u_fallCount");
    // Use per-element locations for array uniforms (WebGL1 safe)
    const uElapsed      = [0,1,2,3].map(i => gl.getUniformLocation(prog, `u_elapsed[${i}]`));
    const uEdgeStart    = [0,1,2,3].map(i => gl.getUniformLocation(prog, `u_edgeStart[${i}]`));
    const uBlobSize     = [0,1,2,3].map(i => gl.getUniformLocation(prog, `u_blobSize[${i}]`));
    const uParticleCount = [0,1,2,3].map(i => gl.getUniformLocation(prog, `u_particleCount[${i}]`));

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = BAR_W * dpr;
    canvas.height = BAR_H * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);

    const t0 = performance.now();
    let rafId = 0;

    function frame(now: number) {
      const state = stateRef.current;
      const dt = state.lastFrameTime > 0 ? (now - state.lastFrameTime) / 1000 : 0;
      state.lastFrameTime = now;

      // Smooth displayPoints toward committedPoints (~1.2s half-life)
      const diff = state.committedPoints - state.displayPoints;
      if (Math.abs(diff) > 0.5) {
        state.displayPoints += diff * Math.min(1, dt * 1.2);
      } else {
        state.displayPoints = state.committedPoints;
      }

      // Expire old falls
      state.falls = state.falls.filter(f => (now - f.startTime) / 1000 < 6.0);

      const info = getLevelInfo(state.displayPoints);

      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform1f(uTime,  (now - t0) / 1000);
      gl!.uniform1f(uProg,  info.progress);
      gl!.uniform1f(uLevel, info.level);
      const [r, g, b] = state.color;
      gl!.uniform3f(uColor, r, g, b);

      const fallCount = state.falls.length;
      gl!.uniform1i(uFallCount, fallCount);
      for (let i = 0; i < MAX_FALLS; i++) {
        const f = i < fallCount ? state.falls[i] : null;
        gl!.uniform1f(uElapsed[i],       f ? (now - f.startTime) / 1000 : -1);
        gl!.uniform1f(uEdgeStart[i],     f ? f.edgeStart : 0);
        gl!.uniform1f(uBlobSize[i],      f ? f.blobSize : 0);
        gl!.uniform1f(uParticleCount[i], f ? f.particleCount : 0);
      }

      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: BAR_W, height: BAR_H, display: "block" }} />;
}

// ─── Main diagram ─────────────────────────────────────────────────────────────
export function HaeuserDiagram({ haeuser }: { haeuser: HausOut[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const sorted = [...haeuser];

  useEffect(() => {
    if (!containerRef.current || sorted.length === 0) return;
    const naturalW = sorted.length * FRAME_W + (sorted.length - 1) * FRAME_GAP;
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      setScale(Math.min(1, w / naturalW));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [sorted.length]);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-2xl">
        Noch keine Häuser angelegt.
      </div>
    );
  }

  const naturalW = sorted.length * FRAME_W + (sorted.length - 1) * FRAME_GAP;

  return (
    <div ref={containerRef} style={{ width: "100%", height: FRAME_H * scale, position: "relative" }}>
      <div style={{
        position: "absolute", top: 0, left: 0,
        display: "flex", gap: FRAME_GAP,
        transformOrigin: "top left",
        transform: `scale(${scale})`,
        width: naturalW,
      }}>
        {sorted.map(haus => {
          const [r, g, b] = hexToRgb(haus.color);
          return (
            <div key={haus.id} style={{
              width: FRAME_W, height: FRAME_H,
              flexShrink: 0, position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}>
              {/* Image frame */}
              <div style={{
                width: BAR_W, flexShrink: 0,
                border: `2px solid ${haus.color}66`,
                borderRadius: 14,
                overflow: "hidden",
                background: "rgba(0,0,0,0.55)",
                flex: 1,
              }}>
                <HausVortexCanvas points={haus.total_points} color={[r, g, b]} />
              </div>

              {/* Name + points below the frame */}
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontWeight: "bold", fontSize: 20, color: haus.color }}>
                  {haus.name}
                </div>
                <div style={{ fontSize: 14, marginTop: 2, color: "rgba(255,255,255,0.5)" }}>
                  {haus.total_points.toLocaleString()} Punkte
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
