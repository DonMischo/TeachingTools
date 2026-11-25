"use client";
import Algorithmen from "@/components/algo/Algorithmen";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { SitzungStart, useWerkzeugSitzung } from "@/components/SitzungWahl";
import { useAuth } from "@/contexts/AuthContext";
import { D2Kontext } from "@/components/algo/D2Kontext";
import { zeichne } from "@/lib/diagramm/d2laufzeit";
import { useMemo } from "react";
import { algoAnsicht } from "@/lib/algo/sitzung";

export default function AlgoPage() {
  const { auth } = useAuth();
  const lehrkraft = auth?.role === "teacher" || auth?.role === "admin";
  // Je Klasse eine Sitzung (wie bei »Markieren & Bearbeiten«): QR und Übersicht hängen an der gewählten.
  const wahl = useWerkzeugSitzung("algo", lehrkraft);
  const ansicht = useMemo(() => algoAnsicht(), []);
  const titel = `Algorithmen-Werkstatt${wahl.sitzung?.scope_label ? ` (${wahl.sitzung.scope_label})` : ""}`;
  return (
    <RequireAccount icon="🔀" title="Algorithmen-Werkstatt">
      <D2Kontext.Provider value={zeichne}>
      {lehrkraft && !wahl.sitzung
        ? <SitzungStart wahl={wahl} titel="🔀 Algorithmen-Werkstatt"
            text="Für welche Klasse bzw. welchen Kurs läuft es? Jede bekommt einen eigenen Code und eine eigene Klassenübersicht mit Sternen und Punkten." />
        : <Algorithmen action={<ToolSessionBar key={wahl.sitzung?.code ?? "-"} tool="algo" title={titel} sitzung={wahl.sitzung ?? undefined} wahl={wahl} ansicht={ansicht} />}
            wahl={lehrkraft ? wahl : undefined}
            speicherSchluessel={auth ? `hp_algo_stand_konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "hp_algo_stand"} />}
      </D2Kontext.Provider>
    </RequireAccount>
  );
}
