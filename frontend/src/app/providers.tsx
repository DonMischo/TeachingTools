"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { SelectedClassProvider } from "@/contexts/SelectedClassContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000 } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SelectedClassProvider>{children}</SelectedClassProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
