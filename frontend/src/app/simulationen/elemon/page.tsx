"use client";
import ElemonSpiel from "@/components/klikk/elemon/ElemonSpiel";
import { ToolSessionBar } from "@/components/ToolSessionBar";
import { RequireAccount } from "@/components/RequireAccount";
import { useAuth } from "@/contexts/AuthContext";

export default function ElemonPage() {
  const { auth } = useAuth();
  const schluessel = auth ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}` : "standalone";
  return (
    <RequireAccount icon="🐾" title="Elemon">
      <div className="max-w-[var(--seite-breite)] mx-auto p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <h1 className="text-2xl font-black">🐾 Elemon</h1>
          <ToolSessionBar tool="elemon" title="Elemon" />
        </div>
        <ElemonSpiel speicherSchluessel={schluessel} verwaltung={!!auth && auth.user_type !== "student"} />
      </div>
    </RequireAccount>
  );
}
