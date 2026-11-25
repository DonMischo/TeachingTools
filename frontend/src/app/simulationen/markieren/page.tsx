"use client";
import Markieren from "@/components/markieren/Markieren";
import MarkierUebersicht from "@/components/markieren/MarkierUebersicht";
import { SitzungStart, useWerkzeugSitzung } from "@/components/SitzungWahl";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { markierAnsicht } from "@/lib/markieren/sitzung";

export default function MarkierenPage() {
  const { auth } = useAuth();
  const lehrkraft = auth?.role === "teacher" || auth?.role === "admin";
  // Je Klasse eine Sitzung: QR, Bestenliste »Diese Sitzung« und Übersicht hängen an der gewählten.
  const wahl = useWerkzeugSitzung("markieren", lehrkraft);
  const ansicht = useMemo(() => markierAnsicht(), []);
  const titel = `Markieren & Bearbeiten${wahl.sitzung?.scope_label ? ` (${wahl.sitzung.scope_label})` : ""}`;
  return (
    <RequireAccount icon="🖍️" title="Markieren & Bearbeiten">
      {lehrkraft && !wahl.sitzung ? <SitzungStart wahl={wahl} titel="🖍️ Markieren & Bearbeiten"
        text="Für welche Klasse bzw. welchen Kurs läuft es? Jede bekommt einen eigenen Code, eine eigene Übersicht und »Diese Sitzung« in der Bestenliste." /> : <Markieren
        action={<ToolSessionBar key={wahl.sitzung?.code ?? "-"} tool="markieren" title={titel} sitzung={wahl.sitzung ?? undefined} wahl={wahl} ansicht={ansicht} />}
        rangliste={{ klasse: auth?.student?.klasse ?? null, verwaltung: !!auth && auth.user_type !== "student", sitzungCode: wahl.sitzung?.code ?? null }}
        speicherSchluessel={auth ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : undefined}
        uebersicht={lehrkraft ? <MarkierUebersicht wahl={wahl} /> : undefined}
      />}
    </RequireAccount>
  );
}
