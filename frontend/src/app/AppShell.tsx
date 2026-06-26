"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

// Pages that use the full screen — only icon strip shown
const FULLSCREEN = ["/capuths/host/", "/play/"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN.some((p) => pathname.startsWith(p));

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
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</main>
    </div>
  );
}
