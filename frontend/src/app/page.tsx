"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FirstRunSetup } from "@/components/FirstRunSetup";
import { HaeuserDiagram } from "@/components/HaeuserDiagram";

export default function Home() {
  const qc = useQueryClient();

  const { data: setup, isLoading: setupLoading, isError: setupError } = useQuery({
    queryKey: ["setup-status"],
    queryFn: api.setup.status,
    staleTime: Infinity,
    retry: 1,
  });

  const { data: haeuser = [] } = useQuery({
    queryKey: ["haeuser"],
    queryFn: api.haeuser.list,
    refetchInterval: 15_000,
    enabled: !setup?.needs_setup,
  });

  if (setupLoading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">Laden…</div>;
  }

  if (setupError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-red-400 font-semibold">API nicht erreichbar</p>
          <p className="text-[var(--text-muted)] text-sm">Ist der Server gestartet? <code>start.bat</code></p>
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

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6">
      <HaeuserDiagram haeuser={haeuser} />
    </div>
  );
}
