"use client";
/**
 * »📊 Auswertung« für Aktivitäten mit eigenen Tabellen (TaskCrawler, Lückentext …):
 * öffnet die gemeinsame Auswertung als Schublade — jederzeit, auch mitten im Spiel.
 * `laden` holt die Daten des Werkzeugs und macht daraus Zeilen + Ansicht (Adapter).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SitzungZeile } from "@/lib/api";
import type { SitzungAnsicht } from "@/lib/sitzung/typen";
import { Schublade } from "./Schublade";
import SitzungAuswertung from "./SitzungAuswertung";

export function AuswertungKnopf({ titel, schluessel, laden, className }: {
  titel: string;
  /** Query-Key, eindeutig je Werkzeug und Sitzung */
  schluessel: unknown[];
  laden: () => Promise<{ zeilen: SitzungZeile[]; ansicht?: SitzungAnsicht }>;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const { data, isError } = useQuery({ queryKey: ["auswertung", ...schluessel], queryFn: laden, enabled: offen, refetchInterval: 15000 });
  return (
    <>
      <button type="button" onClick={() => setOffen(true)}
        className={className ?? "text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent"}>
        📊 Auswertung
      </button>
      {offen && (
        <Schublade titel={`📊 ${titel}`} onClose={() => setOffen(false)}>
          {isError ? <p className="text-sm text-bad">Die Auswertung ließ sich nicht laden.</p>
            : data ? <SitzungAuswertung zeilen={data.zeilen} ansicht={data.ansicht} titel={titel} />
              : <p className="text-sm text-muted">wird geladen …</p>}
        </Schublade>
      )}
    </>
  );
}
