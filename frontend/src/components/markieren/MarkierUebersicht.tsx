"use client";
/**
 * Übersicht der Lehrkraft für »Markieren & Bearbeiten«: je Klasse bzw. Kurs
 * eine eigene Sitzung (SitzungLeiste) und das gemeinsame Dashboard mit den
 * Spalten aus lib/markieren/sitzung.ts.
 */
import { useMemo } from "react";
import { SitzungLeiste, type SitzungWahl } from "@/components/SitzungWahl";
import SitzungDashboard from "@/components/sitzung/SitzungDashboard";
import { markierAnsicht } from "@/lib/markieren/sitzung";

export default function MarkierUebersicht({ wahl }: { wahl: SitzungWahl }) {
  const ansicht = useMemo(() => markierAnsicht(), []);
  return (
    <div className="flex flex-col gap-3">
      <SitzungLeiste wahl={wahl} />
      <SitzungDashboard code={wahl.sitzung?.code} ansicht={ansicht} />
    </div>
  );
}
