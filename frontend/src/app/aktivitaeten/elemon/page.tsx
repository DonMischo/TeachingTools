"use client";
import ElemonSpiel from "@/components/elemon/ElemonSpiel";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";
import { SimKopf } from "@/components/SimKopf";

export default function ElemonPage() {
  const { auth } = useAuth();
  const schluessel = auth ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "standalone";
  return (
    <RequireAccount icon="🐾" title="Elemon">
      <div className="max-w-[var(--seite-breite)] mx-auto p-4 flex flex-col gap-4">
        <SimKopf titel="🐾 Elemon" action={<ToolSessionBar tool="elemon" title="Elemon" />} />
        <ElemonSpiel speicherSchluessel={schluessel} verwaltung={!!auth && auth.user_type !== "student"} />
      </div>
    </RequireAccount>
  );
}
