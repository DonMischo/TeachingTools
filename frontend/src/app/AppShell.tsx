"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useSidebarPanel } from "@/contexts/SidebarPanelContext";

// Pages that use the full screen — only icon strip shown
const FULLSCREEN = ["/capuths/host/", "/play/"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN.some((p) => pathname.startsWith(p));
  const { panelOpen } = useSidebarPanel();

  if (isFullscreen) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar iconOnly />
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className={`flex-1 min-h-0 overflow-y-auto flex flex-col transition-[margin-left] duration-200 ease-out ${panelOpen ? "ml-72" : ""}`}>
        {children}
      </main>
    </div>
  );
}
