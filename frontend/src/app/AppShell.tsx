"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useSidebarPanel } from "@/contexts/SidebarPanelContext";
import { useLessonSession } from "@/contexts/LessonSessionContext";
import { LessonGuideSidebar } from "@/components/LessonGuideSidebar";
import { MaterialViewerOverlay } from "@/components/MaterialViewerOverlay";

// Pages that use the full screen — only icon strip shown
const FULLSCREEN = ["/games/caputh/host/", "/play/"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN.some((p) => pathname.startsWith(p));
  const { panelOpen } = useSidebarPanel();
  const { session, collapsed } = useLessonSession();
  const lessonMarginRight = session && !collapsed ? "mr-80" : "";

  if (isFullscreen) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar iconOnly />
        <main className={`flex-1 min-h-0 overflow-hidden transition-[margin-right] duration-200 ease-out ${lessonMarginRight}`}>{children}</main>
        <LessonGuideSidebar />
        <MaterialViewerOverlay />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className={`flex-1 min-h-0 overflow-y-auto flex flex-col transition-[margin-left,margin-right] duration-200 ease-out ${panelOpen ? "ml-72" : ""} ${lessonMarginRight}`}>
        {children}
      </main>
      <LessonGuideSidebar />
      <MaterialViewerOverlay />
    </div>
  );
}
