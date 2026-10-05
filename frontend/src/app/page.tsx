"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FirstRunSetup } from "@/components/FirstRunSetup";
import { StartSlideshow } from "@/components/StartSlideshow";

export default function Home() {
  const qc = useQueryClient();

  const { data: setup, isLoading: setupLoading, isError: setupError } = useQuery({
    queryKey: ["setup-status"],
    queryFn: api.setup.status,
    staleTime: Infinity,
    retry: 1,
  });

  if (setupLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Laden…</div>;
  }

  if (setupError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-red-400 font-semibold">API nicht erreichbar</p>
          <p className="text-muted text-sm">Ist der Server gestartet? <code>start.bat</code></p>
          <button className="btn-primary mt-4 w-48" onClick={() => window.location.reload()}>Neu laden</button>
        </div>
      </div>
    );
  }

  if (setup?.needs_setup) {
    return (
      <FirstRunSetup
        onComplete={() => {
          qc.invalidateQueries({ queryKey: ["setup-status"] });
          qc.invalidateQueries({ queryKey: ["haeuser"] });
        }}
      />
    );
  }

  return <StartSlideshow />;
}
