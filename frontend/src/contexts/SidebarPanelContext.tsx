"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SidebarPanelCtx {
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
}

const Ctx = createContext<SidebarPanelCtx>({ panelOpen: false, setPanelOpen: () => {} });

export function SidebarPanelProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);
  return <Ctx.Provider value={{ panelOpen, setPanelOpen }}>{children}</Ctx.Provider>;
}

export const useSidebarPanel = () => useContext(Ctx);
