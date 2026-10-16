"use client";

import { useRef, useEffect, useState } from "react";
import { HausOut } from "@/lib/api";
import Fluessigkeit, { type Zufluss } from "@/components/fluessigkeit/Fluessigkeit";
import { FRAG, VERT } from "@/components/fluessigkeit/shader";

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

export { VERT, FRAG };

// ─── Per-house WebGL vortex canvas (Shader und Canvas: components/fluessigkeit) ─────────────
function HausVortexCanvas({ points, color }: {
  points: number;
  color: [number, number, number];
}) {
  const [zufluss, setZufluss] = useState<Zufluss | null>(null);
  const committed = useRef(points);
  const didMount = useRef(false);

  useEffect(() => {
    // Skip the initial mount — only trigger falls on subsequent changes
    if (!didMount.current) { didMount.current = true; return; }
    const delta = points - committed.current;
    if (delta > 0) {
      setZufluss((z) => ({
        id: (z?.id ?? 0) + 1,
        groesse: Math.min(delta / 300, 1.0),
        teilchen: Math.max(25, Math.min(150, Math.round(delta / 5))),
      }));
    }
    committed.current = points;
  }, [points]);

  const info = getLevelInfo(points);
  return <Fluessigkeit farbe={color} fuellstand={info.progress} stufe={info.level} breite={BAR_W} hoehe={BAR_H} zufluss={zufluss} />;
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
      <div className="flex items-center justify-center h-48 text-muted border border-dashed border-line rounded-2xl">
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
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
            }}>
              {/* Card with bar */}
              <div style={{
                position: "relative",
                width: BAR_W, height: BAR_H, flexShrink: 0,
                border: `2px solid ${haus.color}44`,
                borderRadius: 20,
                background: "rgba(0,0,0,0.2)",
                overflow: "hidden",
              }}>
                <div style={{
                  width: BAR_W, height: BAR_H,
                  border: `2px solid ${haus.color}66`,
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.55)",
                }}>
                  <HausVortexCanvas points={haus.total_points} color={[r, g, b]} />
                </div>
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: 4,
                  borderRadius: "0 0 18px 18px",
                  background: `linear-gradient(to right, transparent, ${haus.color}, transparent)`,
                }} />
              </div>

              {/* Name + points below the card */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: "bold", fontSize: 22, color: haus.color }}>
                  {haus.name}
                </div>
                <div style={{ fontSize: 15, marginTop: 4, color: "rgba(255,255,255,0.5)" }}>
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
