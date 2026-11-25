"use client";
import MausFuehrerschein from "@/components/maus/MausFuehrerschein";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { mausAnsicht } from "@/lib/maus/sitzung";

export default function MausPage() {
  const { auth } = useAuth();
  const name = auth?.student?.display_name
    ?? (auth?.teacher ? `${auth.teacher.first_name} ${auth.teacher.last_name.slice(0, 1)}.` : "");
  const istSchueler = auth?.user_type === "student";
  const id = auth?.student?.id ?? auth?.teacher?.id;
  const ansicht = useMemo(() => mausAnsicht(), []);
  return (
    <RequireAccount icon="🐭" title="Maus-Führerschein">
      <MausFuehrerschein
        action={<ToolSessionBar tool="maus" title="Maus-Führerschein" ansicht={ansicht} />}
        name={name}
        // Je Konto ein eigener Stand — am Schulrechner melden sich nacheinander mehrere an.
        speicherSchluessel={`konto-${auth?.user_type ?? "unbekannt"}-${id ?? 0}`}
        konto={auth ? { typ: istSchueler ? "student" : "teacher" } : undefined}
        klasse={auth?.student?.klasse ?? null}
        verwaltung={!!auth && !istSchueler}
      />
    </RequireAccount>
  );
}
