"use client";
/** Voxel-Flug über die aktuelle Stadt */
import type { GelaendeBilder } from "@/components/gelaende/leinwand";
import { useMemo } from "react";
import type { Gelaende } from "@/lib/gelaende/gelaende";
import type { Haus } from "@/lib/stadt/haeuser";
import type { Stadt } from "@/lib/stadt/modell";
import VoxelFlug from "@/components/gelaende/VoxelFlug";
import { backeVoxel } from "./voxelStadt";

const N = 2048;

export default function Stadt3D({ g, stadt, haeuser, bild, mitte }: { g: Gelaende; stadt: Stadt; haeuser: Haus[]; bild: GelaendeBilder; mitte?: { x: number; y: number } | null }) {
  const karte = useMemo(() => backeVoxel(g, stadt, haeuser, bild, N), [g, stadt, haeuser, bild]);
  const m = mitte ? { x: (mitte.x / g.breite) * N, y: (mitte.y / g.breite) * N } : undefined;
  return <VoxelFlug karte={karte} mitte={m} />;
}
