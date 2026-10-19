/** Stadt + Gelände als Voxel-Karte backen — im Browser mit document-Leinwänden */
import type { Gelaende } from "@/lib/gelaende/gelaende";
import type { VoxelKarte } from "@/lib/gelaende/voxel";
import type { Haus } from "@/lib/stadt/haeuser";
import type { Stadt } from "@/lib/stadt/modell";
import { backeVoxel as backe } from "@/lib/stadt/voxelBacken";
import type { GelaendeBilder } from "@/components/gelaende/leinwand";

const leinwand = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return { getContext: (t: "2d") => c.getContext(t, { willReadFrequently: true }) };
};

export function backeVoxel(g: Gelaende, s: Stadt, haeuser: Haus[], bild: GelaendeBilder, N = 2048): VoxelKarte {
  return backe(g, s, haeuser, bild.land, leinwand, N, bild.wasser);
}
