"use client";
/**
 * Klassenübersicht der Algorithmen-Werkstatt: je Klasse eine Sitzung
 * (SitzungLeiste) und das gemeinsame Dashboard mit den Spalten aus
 * lib/algo/sitzung.ts.
 */
import { useMemo } from "react";
import { SitzungLeiste, type SitzungWahl } from "@/components/SitzungWahl";
import SitzungDashboard from "@/components/sitzung/SitzungDashboard";
import { algoAnsicht } from "@/lib/algo/sitzung";

export default function AlgoUebersicht({ wahl }: { wahl: SitzungWahl }) {
  const ansicht = useMemo(() => algoAnsicht(), []);
  return (
    <div className="flex flex-col gap-3">
      <SitzungLeiste wahl={wahl} />
      <SitzungDashboard code={wahl.sitzung?.code} ansicht={ansicht} />
    </div>
  );
}
