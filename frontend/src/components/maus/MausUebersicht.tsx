"use client";
/**
 * Live-Übersicht für die Lehrkraft: wer über den Code mitmacht und welche
 * Stufen geschafft sind — das gemeinsame Dashboard mit den Spalten aus
 * lib/maus/sitzung.ts. Abgefragt wird alle fünf Sekunden.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import SitzungDashboard from "@/components/sitzung/SitzungDashboard";
import { mausAnsicht } from "@/lib/maus/sitzung";

export default function MausUebersicht() {
  const { data: sitzung, isError } = useQuery({
    queryKey: ["maus-sitzung"],
    queryFn: () => api.toolSessions.create("maus"),
  });
  const ansicht = useMemo(() => mausAnsicht(), []);

  if (isError) {
    return <p className="text-sm text-bad">Die Sitzung ließ sich nicht öffnen.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Alle, die über den Code <b className="text-fg tracking-widest">{sitzung?.code ?? "…"}</b> mitmachen.
        🤝 heißt Hilfsmodus.
      </p>
      <SitzungDashboard code={sitzung?.code} ansicht={ansicht} />
    </div>
  );
}
