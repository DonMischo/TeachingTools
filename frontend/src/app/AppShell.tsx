"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarPanel } from "@/contexts/SidebarPanelContext";
import { useLessonSession } from "@/contexts/LessonSessionContext";
import { LessonGuideSidebar } from "@/components/LessonGuideSidebar";
import { MaterialViewerOverlay } from "@/components/MaterialViewerOverlay";
import { LehrkraftLeiste } from "@/components/LehrkraftSpielt";

// Pages that use the full screen — only icon strip shown
const FULLSCREEN = ["/aktivitaeten/caputh/host/", "/play/"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN.some((p) => pathname.startsWith(p));
  const { panelOpen } = useSidebarPanel();
  const { session, collapsed } = useLessonSession();
  const { auth, ready } = useAuth();
  const lessonMarginRight = session && !collapsed ? "mr-80" : "";

  if (isFullscreen) {
    // Gäste bekommen hier keine Navigation: sie sind ohne Konto auf einer
    // Spielerseite, und jeder Eintrag führte nur an die Anmeldung. Solange /me
    // noch läuft, bleibt der Streifen weg — sonst blitzt er beim Gast auf.
    // Auf den übrigen Seiten bleibt die Leiste stehen, dort hängt die
    // Anmeldung selbst daran (siehe RequireAccount: »links unten«).
    const showStrip = ready && !!auth;
    return (
      <div className="flex app-viewport overflow-hidden">
        {showStrip && <Sidebar iconOnly />}
        <main className={`flex-1 min-h-0 h-full overflow-hidden transition-[margin-right] duration-200 ease-out ${lessonMarginRight}`}>{children}</main>
        <LessonGuideSidebar />
        <MaterialViewerOverlay />
        <LehrkraftLeiste />
      </div>
    );
  }

  return (
    <div className="flex app-viewport overflow-hidden">
      <Sidebar />
      <main className={`flex-1 min-h-0 h-full app-scroll flex flex-col transition-[margin-left,margin-right] duration-200 ease-out ${panelOpen ? "ml-72" : ""} ${lessonMarginRight}`}>
        {children}
      </main>
      <LessonGuideSidebar />
      <MaterialViewerOverlay />
      <LehrkraftLeiste />
    </div>
  );
}
