"use client";
import MausFuehrerschein from "@/components/maus/MausFuehrerschein";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function MausPage() {
  const { auth } = useAuth();
  const name = auth?.student?.display_name
    ?? (auth?.teacher ? `${auth.teacher.first_name} ${auth.teacher.last_name.slice(0, 1)}.` : "");
  return (
    <RequireAccount icon="🐭" title="Maus-Führerschein">
      <MausFuehrerschein action={<ToolSessionBar tool="maus" title="Maus-Führerschein" />} name={name} />
    </RequireAccount>
  );
}
