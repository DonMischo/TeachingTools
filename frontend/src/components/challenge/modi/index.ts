import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { SPIELARTEN } from "@/lib/challenge/spielarten";
import type { ModusProps } from "./typen";

export type ModusDef = { id: string; name: string; icon: string; komponente: LazyExoticComponent<ComponentType<ModusProps>> };

const KOMPONENTEN: Record<string, () => Promise<{ default: ComponentType<ModusProps> }>> = {
  normal: () => import("./Normal"),
  karten: () => import("./Karten"),
  boss: () => import("./Boss"),
  huepfen: () => import("./Huepfen"),
  turm: () => import("./Turm"),
  detektiv: () => import("./Detektiv"),
  alchemie: () => import("./Alchemie"),
  bruecke: () => import("./Bruecke"),
  gericht: () => import("./Gericht"),
  gluecksrad: () => import("./Gluecksrad"),
};

/** Alle Spielarten mit ihrer Komponente; Name und Icon aus lib/challenge/spielarten.ts. */
export const MODI: Record<string, ModusDef> = Object.fromEntries(
  SPIELARTEN.map((s) => [s.id, { id: s.id, name: s.name, icon: s.icon, komponente: lazy(KOMPONENTEN[s.id]) }]),
);
