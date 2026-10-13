import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { ModusProps } from "./typen";

export type ModusDef = { id: string; name: string; icon: string; komponente: LazyExoticComponent<ComponentType<ModusProps>> };

/** Gebaute Spielarten; neue tragen sich hier ein. */
export const MODI: Record<string, ModusDef> = {
  normal: { id: "normal", name: "Normal", icon: "⚔️", komponente: lazy(() => import("./Normal")) },
};
