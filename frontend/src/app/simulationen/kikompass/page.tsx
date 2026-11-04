"use client";
import KiKompass from "@/components/kikompass/KiKompass";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function KiKompassPage() {
  const { auth } = useAuth();
  const name = auth?.student?.display_name
    ?? (auth?.teacher ? `${auth.teacher.first_name} ${auth.teacher.last_name}` : "");
  const id = auth?.student?.id ?? auth?.teacher?.id;
  return (
    <RequireAccount icon="🧭" title="KI-Kompass">
      <KiKompass
        action={<ToolSessionBar tool="kikompass" title="KI-Kompass" />}
        name={name}
        konto={!!auth}
        verwaltung={!!auth && auth.user_type !== "student"}
        speicherSchluessel={`konto-${auth?.user_type ?? "unbekannt"}-${id ?? 0}`}
      />
    </RequireAccount>
  );
}
