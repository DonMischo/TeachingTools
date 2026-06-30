"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { SelectedClassProvider } from "@/contexts/SelectedClassContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SidebarPanelProvider } from "@/contexts/SidebarPanelContext";
import { ToastProvider } from "@/contexts/ToastContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000 } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider><SidebarPanelProvider><SelectedClassProvider>{children}</SelectedClassProvider></SidebarPanelProvider></ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
