"use client";

import { useRef, useEffect } from "react";
import { HausOut } from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_PTS  = 1000;
const CYL_W    = 80;
const CYL_RY   = 12;   // ellipse half-height for caps
const CYL_H    = 260;
const BASE_Y   = 360;
const CANVAS_H = BASE_Y + 80;
const GAP      = 70;
const PAD_L    = 70;

const SAND_HEX    = [0xC8A96E, 0xB89050, 0xD4B070, 0xA07840, 0xE8C890] as const;
const SPARKLE_HEX = [0xFFD700, 0xFFFDE7, 0xFFE57F, 0xFFFFFF, 0xC8E6FF] as const;

// ─── Color helpers ────────────────────────────────────────────────────────────
function hexStrToInt(h: string): number { return parseInt(h.replace("#", ""), 16); }
function rC(n: number) { return (n >> 16) & 0xff; }
function gC(n: number) { return (n >> 8)  & 0xff; }
function bC(n: number) { return  n        & 0xff; }
function mkRgb(r: number, g: number, b: number) { return (r << 16) | (g << 8) | b; }

function lightenHex(h: string, a: number): number {
  const n = hexStrToInt(h);
  return mkRgb(Math.min(255, rC(n)+a), Math.min(255, gC(n)+a), Math.min(255, bC(n)+a));
}
function darkenHex(h: string, a: number): number {
  const n = hexStrToInt(h);
  return mkRgb(Math.max(0, rC(n)-a), Math.max(0, gC(n)-a), Math.max(0, bC(n)-a));
}
function mixHex(h: string, c2: number, t: number): number {
  const n = hexStrToInt(h);
  return mkRgb(
    Math.round(rC(n) + (rC(c2)-rC(n))*t),
    Math.round(gC(n) + (gC(c2)-gC(n))*t),
    Math.round(bC(n) + (bC(c2)-bC(n))*t),
  );
}

function sr(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function fillH(pts: number): number { return Math.min(pts / MAX_PTS, 1) * CYL_H; }

function density(pts: number): number {
  if (pts <= 0) return 0;
  const frac = Math.min(pts / MAX_PTS, 1);
  let d = Math.log(pts + 1) / Math.log(MAX_PTS + 1);
  if (frac > 0.8) {
    const over = (frac - 0.8) / 0.2;
    d += (1 - d) * (Math.log(over * 9 + 1) / Math.log(10)) * 0.75;
  }
  return Math.min(d, 1);
}

interface FallEntry    { sprite: any; vy: number; stopY: number; type: "sparkle" | "grain"; }
interface TwinkleEntry { sprite: any; speed: number; phase: number; }

// ─── Component ────────────────────────────────────────────────────────────────
export function HaeuserDiagram({ haeuser }: { haeuser: HausOut[] }) {
  const mountRef = useRef<HTMLDivElement>(null);

  const sorted = [...haeuser].sort((a, b) => b.total_points - a.total_points);
  const totalW = Math.max(400, sorted.length * (CYL_W + GAP) - GAP + PAD_L * 2);
  const depKey = sorted.map(h => `${h.id}:${h.total_points}:${h.color}`).join(",") + `|${totalW}`;

  useEffect(() => {
    if (sorted.length === 0 || !mountRef.current) return;
    const mount = mountRef.current;
    mount.innerHTML = "";

    let destroyed = false;
    let pixiApp: any = null;

    (async () => {
      const { Application, Container, Graphics, Sprite, FillGradient } = await import("pixi.js");
      if (destroyed) return;

      const app = new Application();
      await app.init({ width: totalW, height: CANVAS_H, backgroundAlpha: 0, antialias: true });
      if (destroyed) { app.destroy(true); return; }

      pixiApp = app;
      mount.appendChild(app.canvas as HTMLCanvasElement);

      // ── Shared textures ────────────────────────────────────────────────

      const grainGfx = new Graphics();
      grainGfx.circle(0, 0, 2.5).fill(0xffffff);
      const grainTex = app.renderer.generateTexture(grainGfx);
      grainGfx.destroy();

      const starGfx = new Graphics();
      starGfx
        .moveTo(-5, 0).lineTo(5, 0)
        .moveTo(0, -5).lineTo(0, 5)
        .moveTo(-3.5, -3.5).lineTo(3.5, 3.5)
        .moveTo(3.5, -3.5).lineTo(-3.5, 3.5)
        .stroke({ color: 0xffffff, width: 1.2 });
      starGfx.circle(0, 0, 1.3).fill(0xffffff);
      const starTex = app.renderer.generateTexture(starGfx);
      starGfx.destroy();

      // ── Layers ─────────────────────────────────────────────────────────
      const shellLayer   = new Container();
      const sandLayer    = new Container(); // per-cylinder: sand bg + masked grains
      const rimLayer     = new Container();
      const fallingLayer = new Container();
      app.stage.addChild(shellLayer, sandLayer, rimLayer, fallingLayer);

      const twinkles: TwinkleEntry[] = [];
      const falling:  FallEntry[]    = [];
      let lastSpawn = 0;

      // ── Build cylinders ────────────────────────────────────────────────
      sorted.forEach((haus, hi) => {
        const cx      = PAD_L + CYL_W / 2 + hi * (CYL_W + GAP);
        const r       = CYL_W / 2;
        const topY    = BASE_Y - CYL_H;
        const pts     = haus.total_points;
        const fh      = fillH(pts);
        const d       = density(pts);
        const sandTop = BASE_Y - fh;
        const hInt    = hexStrToInt(haus.color);

        // ── Shell (dark tube) ──────────────────────────────────────────
        const shell = new Graphics();

        // Dark interior rect
        shell.rect(cx - r, topY, CYL_W, CYL_H).fill({ color: 0x050302, alpha: 0.92 });

        // Gradient side shading (left bright edge, right darker edge)
        // Left highlight strip
        shell.rect(cx - r, topY, 8, CYL_H).fill({ color: lightenHex(haus.color, 55), alpha: 0.18 });
        // Right shadow strip
        shell.rect(cx + r - 8, topY, 8, CYL_H).fill({ color: 0x000000, alpha: 0.35 });
        // Inner wall color tint (center glow)
        shell.rect(cx - r + 8, topY, CYL_W - 16, CYL_H).fill({ color: hInt, alpha: 0.06 });

        shellLayer.addChild(shell);

        // Bottom cap ellipse (closed tube look)
        const bottomCap = new Graphics();
        bottomCap.ellipse(cx, BASE_Y, r, CYL_RY).fill({ color: darkenHex(haus.color, 30), alpha: 0.6 });
        shellLayer.addChild(bottomCap);

        // ── Sand fill ──────────────────────────────────────────────────
        if (fh > 0) {
          // Gradient sand background: dark at bottom, lighter toward surface
          const sandGfx = new Graphics();
          const grad = new FillGradient(0, BASE_Y - fh, 0, BASE_Y);
          grad.addColorStop(0, mixHex(haus.color, 0xD4A850, 0.45));  // top of sand (lighter)
          grad.addColorStop(1, mixHex(haus.color, 0x5C3A10, 0.55));  // bottom (packed, darker)
          sandGfx.rect(cx - r + 1, BASE_Y - fh, CYL_W - 2, fh).fill(grad);
          sandLayer.addChild(sandGfx);

          // Sand surface ellipse
          const surfGfx = new Graphics();
          surfGfx.ellipse(cx, sandTop, r - 1, CYL_RY * 0.55)
                 .fill({ color: mixHex(haus.color, 0xC8A050, 0.5) });
          surfGfx.ellipse(cx - r * 0.25, sandTop - CYL_RY * 0.3, r * 0.55, CYL_RY * 0.3)
                 .fill({ color: lightenHex(haus.color, 40), alpha: 0.45 });
          sandLayer.addChild(surfGfx);

          // Masked grain container — grains clipped to this cylinder's sand rect
          const grainMask = new Graphics();
          grainMask.rect(cx - r + 1, sandTop, CYL_W - 2, fh).fill(0xffffff);

          const grainCtr = new Container();
          grainCtr.mask = grainMask;
          sandLayer.addChild(grainMask, grainCtr);

          // Place grain sprites at seeded positions
          const STRIP = 5;
          const strips = Math.ceil(fh / STRIP);
          for (let si = 0; si < strips; si++) {
            const stripBaseY = BASE_Y - si * STRIP;
            const relH   = si / strips; // 0 = bottom, 1 = top
            const localD = d * (0.6 + 0.4 * (1 - relH)); // denser at bottom
            const grainR = Math.max(0.3, 2.0 - d * 1.2 + relH * 0.2);
            const n = Math.round(localD * (r * 2 - 6) * STRIP / 16);

            for (let gi = 0; gi < n; gi++) {
              const seed = hi * 300000 + si * 800 + gi;
              const gx   = (cx - r + 3) + sr(seed)     * (r * 2 - 6);
              const gy   = stripBaseY   - sr(seed + 1) * STRIP;
              const roll = sr(seed + 2);

              if (roll < 0.022) {
                // Twinkling embedded sparkle (2.2% of grains)
                const sp = new Sprite(starTex);
                sp.anchor.set(0.5);
                sp.position.set(gx, gy);
                sp.scale.set(grainR * 0.36);
                sp.tint = SPARKLE_HEX[Math.floor(sr(seed + 3) * SPARKLE_HEX.length)];
                grainCtr.addChild(sp);
                twinkles.push({ sprite: sp, speed: 0.8 + sr(seed+4)*2.5, phase: sr(seed+5)*Math.PI*2 });
              } else {
                const sp = new Sprite(grainTex);
                sp.anchor.set(0.5);
                sp.position.set(gx, gy);
                sp.scale.set(grainR * 0.36);
                sp.tint = roll < 0.4
                  ? lightenHex(haus.color, Math.floor(sr(seed + 3) * 40))
                  : SAND_HEX[Math.floor(sr(seed + 3) * SAND_HEX.length)];
                grainCtr.addChild(sp);
              }
            }
          }
        }

        // ── Top rim ────────────────────────────────────────────────────
        const rim = new Graphics();
        rim.ellipse(cx, topY, r, CYL_RY).fill({ color: lightenHex(haus.color, 40) });
        rim.ellipse(cx, topY, r, CYL_RY).stroke({ color: lightenHex(haus.color, 65), width: 1 });
        rim.ellipse(cx - r * 0.3, topY - CYL_RY * 0.3, r * 0.6, CYL_RY * 0.5)
           .fill({ color: lightenHex(haus.color, 90), alpha: 0.45 });
        rimLayer.addChild(rim);
      });

      // ── Falling particles ──────────────────────────────────────────────
      function spawnParticles(cx: number, pts: number, color: string) {
        const r     = CYL_W / 2 - 5;
        const fh    = fillH(pts);
        const stopY = BASE_Y - fh - CYL_RY * 0.4;

        if (Math.random() < 0.4) {
          const sp = new Sprite(starTex);
          sp.anchor.set(0.5);
          sp.scale.set(0.5 + Math.random() * 0.6);
          sp.tint = SPARKLE_HEX[Math.floor(Math.random() * SPARKLE_HEX.length)];
          sp.position.set(
            cx + (Math.random() - 0.5) * r * 1.6,
            BASE_Y - CYL_H - 5 - Math.random() * 15,
          );
          fallingLayer.addChild(sp);
          falling.push({ sprite: sp, vy: 0.4 + Math.random() * 0.8, stopY, type: "sparkle" });
        }

        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const sp = new Sprite(grainTex);
          sp.anchor.set(0.5);
          sp.scale.set(0.45 + Math.random() * 0.6);
          sp.tint = Math.random() < 0.45
            ? lightenHex(color, Math.floor(Math.random() * 40))
            : SAND_HEX[Math.floor(Math.random() * SAND_HEX.length)];
          sp.position.set(
            cx + (Math.random() - 0.5) * r * 1.5,
            BASE_Y - CYL_H + Math.random() * 15,
          );
          fallingLayer.addChild(sp);
          falling.push({ sprite: sp, vy: 1.5 + Math.random() * 2.5, stopY, type: "grain" });
        }
      }

      // ── Ticker ─────────────────────────────────────────────────────────
      app.ticker.add(() => {
        const now = performance.now();

        for (const tw of twinkles) {
          tw.sprite.alpha = 0.3 + 0.7 * Math.abs(Math.sin(now * 0.001 * tw.speed + tw.phase));
        }

        for (let i = falling.length - 1; i >= 0; i--) {
          const f = falling[i];
          f.sprite.y += f.vy;
          f.vy += 0.08;

          if (f.type === "sparkle") {
            f.sprite.alpha = 0.3 + 0.7 * Math.abs(Math.sin(now * 0.008 + f.sprite.x));
          } else {
            f.sprite.alpha = Math.min(1, (f.stopY - f.sprite.y) / 20);
          }

          if (f.sprite.y >= f.stopY) {
            fallingLayer.removeChild(f.sprite);
            f.sprite.destroy();
            falling.splice(i, 1);
          }
        }

        if (now - lastSpawn > 180 && falling.length < 60) {
          sorted.forEach((haus, i) => {
            if (haus.total_points > 0)
              spawnParticles(PAD_L + CYL_W / 2 + i * (CYL_W + GAP), haus.total_points, haus.color);
          });
          lastSpawn = now;
        }
      });
    })();

    return () => {
      destroyed = true;
      if (pixiApp) { pixiApp.destroy(true); pixiApp = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-2xl">
        Noch keine Häuser angelegt.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ position: "relative", width: totalW, height: CANVAS_H, minWidth: totalW }}>
        <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

        {/* HTML overlay: crown + labels */}
        {sorted.map((haus, i) => {
          const cx   = PAD_L + CYL_W / 2 + i * (CYL_W + GAP);
          const topY = BASE_Y - CYL_H;
          return (
            <div key={haus.id} style={{ position: "absolute", left: cx - 40, width: 80, textAlign: "center" }}>
              {i === 0 && haus.total_points > 0 && (
                <div style={{ position: "absolute", top: topY - CYL_RY - 30, width: 80, fontSize: 20 }}>
                  👑
                </div>
              )}
              <div style={{ position: "absolute", top: BASE_Y + CYL_RY + 8, width: 80 }}>
                <div style={{ fontWeight: "bold", fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                  {haus.name}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  {haus.total_points} Pkt
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
